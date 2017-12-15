! function(global) {
    var indexSize = 100; //区块个数（根据时间平均分为100份）
    var url = ''; //音频链接
    var emptyUrl = ''; //空音频链接（用于触发IOS上音频播放）
    var emptyCb = function() {};
    var decrypt = emptyCb; //解密函数
    var loadedmetaCb = emptyCb; //元数据请求完毕回调
    var updateTimeCb = emptyCb; //更新时间回调
    var playCb = emptyCb; //播放回调
    var pauseCb = emptyCb; //暂停回调
    var waitingCb = emptyCb; //等待回调
    var playingCb = emptyCb; //等待结束回调
    var endCb = emptyCb; //播放结束回调
    var iosClicked = false; //ios首次播放是否点击过
    var isIos = navigator.userAgent.indexOf('iPhone') > -1;
    var iosPlayTimoutId = null;
    Array.prototype.indexOf = function(item) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == item) {
                return i;
            }
        }
        return -1;
    }

    function log() {
        if (location.search.indexOf('debug') > -1) {
            console.log.apply(this, arguments);
        }
    }

    function testLog() {
        if (location.search.indexOf('test') > -1) {
            console.log.apply(this, arguments);
        }
    }

    function ifDebug() {
        if (location.search.indexOf('debug') > -1) {
            return true;
        }
    }

    function ifTest() {
        if (location.search.indexOf('test') > -1) {
            return true;
        }
    }
    //MP3播放信息解析对象
    var MP3InfoAnalysis = {
        init: function() {
            this.mp3Info = {}; //存储mp3相关的信息
            return new Promise(MP3InfoAnalysis.loadHeaderInfo)
            .then(MP3InfoAnalysis.loadFirstFrame)
            .then(MP3InfoAnalysis.getInfo);
        },
        //ajax获取音频头部标签头(32B)
        loadHeaderInfo: function(resolve, reject) {
            _loadData(0, 32 * 8 - 1, function() {
                _loadData(32 * 8, 32 * 8 + 32 * 8 - 1);
            });
            // 需要load两次数据（可能同时存在APETAGEX标签和ID3V2标签）
            function _loadData(begin, end, callback) {
                var request = new XMLHttpRequest();
                request.open('GET', url, true);
                request.responseType = 'arraybuffer';
                request.onload = function() {
                    var arrayBuffer = request.response;
                    var contentLength = request.getResponseHeader('Content-Length');
                    var contetnRange = request.getResponseHeader('Content-Range');
                    var length = 0;
                    //数据解密
                    decrypt(arrayBuffer);
                    if (contentLength != end - begin + 1) {
                        console.error('获取头部信息出错');
                    }
                    length = MP3InfoAnalysis.getHeaderLength(arrayBuffer);
                    if (!MP3InfoAnalysis.mp3Info.headerLength) {
                        MP3InfoAnalysis.mp3Info.headerLength = length;
                    } else {
                        MP3InfoAnalysis.mp3Info.headerLength += length;
                    }
                    if (!MP3InfoAnalysis.mp3Info.fileSize) {
                        MP3InfoAnalysis.mp3Info.fileSize = parseInt(contetnRange.substr(contetnRange.indexOf('/') + 1));
                    }
                    if (callback) {
                        callback();
                    } else {
                        resolve();
                    }
                }
                request.setRequestHeader("Range", 'bytes=' + begin + '-' + end);
                request.send();
            }
        },
        //获取ID3V2|APEV2标签长度
        getHeaderLength: function(arrayBuffer) {
            var uint8Array = new Uint8Array(arrayBuffer);
            var headerLength = 0;
            var tag = '';
            var type = '';
            for (var i = 0; i < 8; i++) {
                tag += String.fromCharCode(uint8Array[i])
            }
            if (tag.substring(0, 3) == 'ID3') {
                headerLength = (((uint8Array[6] & 0x7F) << 21) | ((uint8Array[7] & 0x7F) << 14) | ((uint8Array[8] & 0x7F) << 7) | (uint8Array[9] & 0x7F)) + 10;
            } else if (tag == 'APETAGEX') {
                headerLength = ((uint8Array[12]) | (uint8Array[13] << 8) | (uint8Array[14] << 16) | (uint8Array[15] << 24)) + 32;
            }
            return headerLength;
        },
        //加载第一个数据帧
        loadFirstFrame: function() {
            var mp3Info = MP3InfoAnalysis.mp3Info;
            return new Promise(function(resolve, reject) {
                var request = new XMLHttpRequest();
                request.open('GET', url, true);
                request.responseType = 'arraybuffer';
                request.onload = function() {
                    var arrayBuffer = request.response;
                    var contentLength = request.getResponseHeader('Content-Length');
                    var contetnRange = request.getResponseHeader('Content-Range');
                    mp3Info.firstFrame = arrayBuffer; //存储第一帧数据帧
                    //数据解密
                    decrypt(arrayBuffer);
                    if (contentLength != 156 * 8) {
                        console.error('获取第一帧数据帧出错');
                    }
                    resolve(arrayBuffer);
                }
                request.setRequestHeader("Range", "bytes=" + mp3Info.headerLength + '-' + (mp3Info.headerLength + 156 * 8 - 1));
                request.send();
            })
        },
        //获取VBR(OR CBR)信息
        getInfo: function(arrayBuffer) {
            var mp3Info = MP3InfoAnalysis.mp3Info;
            var bufferStr = '';
            var uint8Array = null;
            var vbrDataBuffer = null;
            var bitRate = MP3InfoAnalysis.getBitRate(arrayBuffer);
            var headerFlag = '';
            uint8Array = new Uint8Array(arrayBuffer);
            //转换成16进制码
            for (var i = 0; i < 4; i++) {
                if (uint8Array[i] <= 15) {
                    bufferStr += '0' + uint8Array[i].toString(16);
                } else {
                    bufferStr += uint8Array[i].toString(16);
                }
            }
            bufferStr = bufferStr.toUpperCase();
            mp3Info.frameHeaderFlag = bufferStr.substring(0, 4); //数据帧开始标识
            headerFlag = MP3InfoAnalysis.hasVbrHeader(arrayBuffer);
            if (headerFlag != -1) { //存在Info头或者Xing头
                vbrDataBuffer = arrayBuffer.slice(headerFlag / 2);
                loadedmetaCb(mp3Info); //元数据请求完毕回调
                return _getInfo(vbrDataBuffer);
            } else { //纯CBR编码
                var totalTime = (mp3Info.fileSize - mp3Info.headerLength) / bitRate * 8;
                mp3Info.totalTime = totalTime;
                loadedmetaCb(mp3Info); //元数据请求完毕回调
                return mp3Info;
            }
            //获取总帧数
            function _getTotalFrame(vbrDataBuffer) {
                vbrDataBuffer = vbrDataBuffer.slice(0, 12);
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 1) {
                    return (vbrUint8Array[8] << 24) + (vbrUint8Array[9] << 16) + (vbrUint8Array[10] << 8) + (vbrUint8Array[11]);
                } else
                    return false;
            }
            //获取数据帧总大小(byte)
            function _getTotalSize(vbrDataBuffer) {
                vbrDataBuffer = vbrDataBuffer.slice(0, 16);
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 2) {
                    if (vbrUint8Array[7] & 1 == 0) {
                        return (vbrUint8Array[8] << 24) + (vbrUint8Array[9] << 16) + (vbrUint8Array[10] << 8) + (vbrUint8Array[11]);
                    } else {
                        return (vbrUint8Array[12] << 24) + (vbrUint8Array[13] << 16) + (vbrUint8Array[14] << 8) + (vbrUint8Array[15]);
                    }
                } else
                    return false;
            }
            //获取帧索引数组(100个)
            function _getToc(vbrDataBuffer) {
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 4) {
                    if (!(vbrUint8Array[7] & 1) && !(vbrUint8Array[7] & 2)) {
                        return _getToc_(vbrDataBuffer.slice(8));
                    } else if ((vbrUint8Array[7] & 1) && !(vbrUint8Array[7] & 2) || !(vbrUint8Array[7] & 1) && (vbrUint8Array[7] & 2)) {
                        return _getToc_(vbrDataBuffer.slice(12));
                    } else {
                        return _getToc_(vbrDataBuffer.slice(16));
                    }
                }

                function _getToc_(docArrayBuffer) {
                    var indexArr = [];
                    var docuUnit8Array = new Uint8Array(docArrayBuffer.slice(0, indexSize));
                    for (var i = 0; i < 100; i++) {
                        indexArr[i] = docuUnit8Array[i];
                    }
                    return indexArr;
                }
            }

            function _getInfo(vbrDataBuffer) {
                mp3Info.totalFrame = _getTotalFrame(vbrDataBuffer);
                mp3Info.totalTime = 1152 * mp3Info.totalFrame / samplingRate;
                mp3Info.totalSize = _getTotalSize(vbrDataBuffer);
                mp3Info.toc = _getToc(vbrDataBuffer);
                return mp3Info;
            }
        },
        //是否存在Info头或者Xing头
        hasVbrHeader: function(arrayBuffer) {
            var bufferStr = '';
            var uint8Array = new Uint8Array(arrayBuffer);
            //转换成16进制码
            for (var i = 0; i < indexSize && i < uint8Array.length; i++) {
                if (uint8Array[i] <= 15) {
                    bufferStr += '0' + uint8Array[i].toString(16);
                } else {
                    bufferStr += uint8Array[i].toString(16);
                }
            }
            bufferStr = bufferStr.toUpperCase();
            if (bufferStr.indexOf('496E666F') != -1) { //存在Info头
                return bufferStr.indexOf('496E666F');
            } else if (bufferStr.indexOf('58696E67') != -1) { //存在Xing头
                return bufferStr.indexOf('58696E67');
            }
            return -1;
        },
        //获取比特率
        getBitRate: function(arrayBuffer) {
            //比特率对应表(bit/s)
            var brMap = {
                '1': 32000,
                '10': 40000,
                '11': 48000,
                '100': 56000,
                '101': 64000,
                '110': 80000,
                '111': 96000,
                '1000': 112000,
                '1001': 128000,
                '1010': 160000,
                '1011': 192000,
                '1100': 224000,
                '1101': 256000,
                '1110': 320000
            }
            var uint8Array = new Uint8Array(arrayBuffer);
            var brCode = (uint8Array[2] & 0xF0).toString(2).substring(0, 4);
            return brMap[brCode];
        },
        //获取采样率
        getSamplingRate: function(arrayBuffer) {
            //比特率对应表(Hz)
            var srMap = {
                '0': 44100,
                '1': 48000,
                '10': 32000,
            }
            var uint8Array = new Uint8Array(arrayBuffer);
            var srCode = (uint8Array[2] & 0x0C).toString(2).substring(0, 2);
            return srMap[srCode];
        },
        //获取第一帧填充数
        getPadding: function(arrayBuffer) {
            var uint8Array = new Uint8Array(arrayBuffer);
            var pdCode = (uint8Array[2] & 0x02).toString(2);
            if (pdCode == '1') {
                return 1;
            } else {
                return 0;
            }
        },
        //获取帧大小(bit)
        getFrameSize: function(arrayBuffer) {
            var samplingRate = MP3InfoAnalysis.getSamplingRate(arrayBuffer);
            var bitRate = MP3InfoAnalysis.getBitRate(arrayBuffer);
            var padding = MP3InfoAnalysis.getPadding(arrayBuffer);
            return 1152 * bitRate / samplingRate / 8 + padding;
        }
    }
    //音频播放对象
    var Player = {
        init: function(audioInfo) {
        	Player.audioInfo = audioInfo; // 音频信息
            Player.bufferLength = 0; // 音频全部解码后总大小
            Player.audioContext = new (window.AudioContext || window.webkitAudioContext)(); // 音频上下文对象
            Player.audioContext.onstatechange = function() {
                log(Player.audioContext.state);
                if(Player.finished && Player.audioContext.state == 'suspended'){
                    endCb();
                }
            }
            Player.fileBlocks = new Array(100); // 音频数据分区
            Player.cacheFrameSize = 10; // 每次加载的分区数
            Player.indexSize = 100; // 索引个数
            Player.hasPlayed = false; // 是否已经开始播放
            Player.totalBuffer = null; // 音频资源节点队列
            Player.nowSouceNode = null; // 正在播放的资源节点
            Player.loadingPromise = null; // 数据加载异步对象集合
            Player.decodeAudioData(0, Player.cacheFrameSize, true, Player.totalBuffer);
            if(isIos){
		        Player.audio = new Audio();
		        Player.audio.src = emptyUrl;
		    }
        },
        // 计时器
        timeoutIds: {
            decodeTimeoutId: null,
            updateTimeoutId: null
        },
        // 解码
        decodeAudioData: function(index, minSize, negative, totalBuffer) {
            var mp3Info = Player.audioInfo;
            if (index >= indexSize) {
                Player.changeState(false, false);
                Player.loading = false;
                Player.decoding = false;
                return;
            }
            if (Player.audioContext && !Player.finished && (!Player.nowSouceNode || Player.nowSouceNode && Player.nowSouceNode.finished)) {
                Player.changeState(true);
                Player.loading = true;
            }
            return Player.loadFrame(index, minSize, negative).then(function(result) {
                if (totalBuffer && totalBuffer != Player.totalBuffer || !result) { //see时强制停止
                    return false;
                }
                Player.changeState(false);
                Player.loading = false;
                if (Player.audioContext.state == 'suspended') {
                    Player.audioContext.resume();
                }
                if (!Player.finished && (!Player.nowSouceNode || Player.nowSouceNode && Player.nowSouceNode.finished)) {
                    Player.changeState(null, true);
                    Player.decoding = true;
                }
                log('解码:' + result.beginIndex + ',' + result.endIndex);
                if (ifDebug()) {
                    var decodeBeginTime = new Date().getTime();
                }
                Player.audioContext.decodeAudioData(result.arrayBuffer, function(buffer) { //解码成功则调用此函数，参数buffer为解码后得到的结果
                    var souceNode = null;
                    if (totalBuffer && totalBuffer != Player.totalBuffer) { //防止seek时，之前未完成的异步解码对新队列的影响
                        return;
                    }
                    if(!Player.bufferLength){
                        Player.bufferLength = Math.ceil(mp3Info.totalTime*buffer.sampleRate);
                    }
                    if(!Player.numberOfChannels){
                        Player.numberOfChannels = buffer.numberOfChannels;
                    }
                    if(!Player.sampleRate){
                        Player.sampleRate = buffer.sampleRate;
                    }
                    if(!totalBuffer){
                        Player.totalBuffer = totalBuffer = Player.audioContext.createBuffer(Player.numberOfChannels, Player.bufferLength, Player.sampleRate);
                    }
                    Player.changeState(null, false);
                    Player.decoding = false;
                    log('解码完成:' + result.beginIndex + ',' + result.endIndex, 'duration:', buffer.duration);
                    if (ifDebug()) {
                        log('解码时间:', new Date().getTime() - decodeBeginTime, 'ms');
                    }
                    if (!Player.hasPlayed) {
                        Player.hasPlayed = true;
                        Player.totalBuffer.dataBegin = Player.totalBuffer.dataEnd = (totalBuffer.length * result.beginIndex / indexSize)>>0;
                        Player._copyPCMData(buffer);
                        Player._play(Player.totalBuffer.dataBegin / Player.totalBuffer.length * mp3Info.totalTime);
                        if (result.endIndex + 1 < indexSize) {
                            Player.timeoutIds.decodeTimeoutId = setTimeout(function() {
                                if (Player.loadingPromise) {
                                    Player.loadingPromise.stopNextLoad = true;
                                    Player.loadingPromise.then(function() {
                                        Player.decodeAudioData(result.endIndex + 1, minSize, null, totalBuffer);
                                    })
                                } else {
                                    Player.decodeAudioData(result.endIndex + 1, minSize, null, totalBuffer);
                                }
                            }, buffer.duration * 1000 / 2);
                        }
                    }else{
                        Player._copyPCMData(buffer);
                        if(Player.waiting){
                            Player.audioContext.resume();
                        }
                    }
                    
                }, function(e) {
                    log(index, "解码失败");
                });
                return result;
            });
        },
        // 复制PCM流
        _copyPCMData: function(_buffer){
            var offset = Player.totalBuffer.dataEnd;
            for(var i=0; i<_buffer.numberOfChannels; i++){
                Player.totalBuffer.copyToChannel(_buffer.getChannelData(i),i,offset);
            }
            Player.totalBuffer.dataEnd += _buffer.length;
        },
        // 播放
        _play: function(startTime) {
            Player.offsetTime = startTime;
            Player.currentTime = Math.round(Player.offsetTime);
            if (Player.audioContext.state == 'suspended') {
                Player.audioContext.resume();
            }
            if(Player.souceNode){
                Player.souceNode.disconnect();
            }
            var souceNode = Player.audioContext.createBufferSource();
            souceNode.buffer = Player.totalBuffer;
            souceNode.connect(Player.audioContext.destination);
            souceNode.onended = function() {
                souceNode.disconnect();
                Player.finished = true;
                Player._clearTimeout();
                Player.audioContext.suspend();
            }
            if (souceNode.start) {
                souceNode.start(0, startTime);
            } else {
                souceNode.noteOn(0, startTime);
            }
            Player.souceNode = souceNode;
            Player._startUpdateTimeoutId();
        },
        // 开始更新计时器
        _startUpdateTimeoutId: function() {
            clearInterval(Player.timeoutIds.updateTimeoutId);
            Player.beginTime = Player.audioContext.currentTime;
            Player.timeoutIds.updateTimeoutId = setInterval(function() {
                var time = Player.audioContext.currentTime - Player.beginTime;
                var currentTime = time + Player.offsetTime;
                if (Math.round(currentTime) > Player.currentTime) {
                    Player.currentTime = Math.round(currentTime);
                    updateTimeCb(Player.currentTime);
                }
                if((time+2) * Player.sampleRate > Player.bufferLength.dataEnd - Player.bufferLength.dataBegin){
                    Player.waiting = true;
                    Player.audioContext.suspend();
                    waitingCb();
                }
            }, 1000);
        },
        //获取数据帧
        loadFrame: function(index, minSize, negative) {
            var begin = 0;
            var end = 0;
            var cached = true;
            var beginIndex = index; //避免网络加载重复数据
            var endIndex = 0;
            var originMinSize = minSize;
            var audioInfo = Player.audioInfo
            index = index >= indexSize ? indexSize - 1 : index;
            if (index + minSize > indexSize) {
                minSize = indexSize - index;
            }
            //防止头部加载重复数据
            for (var i = index; i < index + minSize; i++) {
                if (!Player.fileBlocks[i]) {
                    cached = false;
                    beginIndex = i;
                    minSize = minSize - (beginIndex - index);
                    break;
                }
            }
            //对应索引区数据已经缓存
            if (cached) {
                var arr = null;
                var result = null;
                var length = 0;
                result = Player.joinNextCachedFileBlock(index, minSize, negative);
                if (result.endIndex < indexSize - 1) {
                    Player.loadFrame(result.endIndex + 1, Player.cacheFrameSize);
                }
                return Promise.resolve(result);
            }
            //防止尾部加载重复数据
            var i = beginIndex + minSize - 1;
            i = i >= indexSize ? indexSize - 1 : i;
            for (; i > beginIndex; i--) {
                if (Player.fileBlocks[i]) {
                    minSize--;
                } else {
                    break;
                }
            }
            if (beginIndex + minSize > indexSize) {
                minSize = indexSize - beginIndex;
            }
            begin = Player.getRangeBeginByIndex(beginIndex);
            end = Player.getRangeBeginByIndex(beginIndex + minSize);
            log('loading:', beginIndex, beginIndex + minSize - 1)
            var promise = new Promise(function(resolve, reject) {
                var request = Player.request = new XMLHttpRequest();
                request.open('GET', url, true);
                request.responseType = 'arraybuffer';
                setTimeout(function() {
                    promise.resolve = resolve;
                    promise.reject = reject;
                }, 0);
                request.onload = function() {
                    var arrayBuffer = request.response;
                    var begin = 0;
                    var end = 0;
                    //数据解密
                    decrypt(arrayBuffer);
                    //缓存数据块
                    for (var i = beginIndex; i < beginIndex + minSize && i < indexSize; i++) {
                        if (audioInfo.toc) { //VBR编码模式
                            if(i+1>=indexSize || i+1>=beginIndex + minSize){
                                end = arrayBuffer.byteLength;
                            }else{
                                end = (begin + (Player.getRangeBeginByIndex(i + 1) - Player.getRangeBeginByIndex(i))) >> 0;
                            }
                            Player.fileBlocks[i] = arrayBuffer.slice(begin, end);
                            begin = end;
                        } else { //CBR编码模式
                            if(i+1>=indexSize || i+1>=beginIndex + minSize){
                                end = arrayBuffer.byteLength;
                            }else{
                                end = begin + (audioInfo.fileSize - audioInfo.headerLength) / indexSize;
                            }
                            Player.fileBlocks[i] = arrayBuffer.slice(begin, end);
                            begin = end;
                        }
                    }
                    log('load完成:', beginIndex, beginIndex + minSize - 1);
                    if (!Player.loadingPromise.stopNextLoad) { //seek后应该从新的位置加载后面的数据
                        setTimeout(function() {
                            Player.loadFrame(index + originMinSize, originMinSize);
                        }, 0)
                    }
                    Player.loadingPromise = null;
                    resolve(Player.joinNextCachedFileBlock(index, originMinSize, negative));
                }
                request.ontimeout = function(e) {
                    Player.loadingPromise = Player.loadFrame(index, minSize, negative);
                    Player.loadingPromise.then(function() {
                        resolve(Player.joinNextCachedFileBlock(index, originMinSize, negative));
                    });
                }
                request.onerror = function(e) {
                    Player.loadingPromise = Player.loadFrame(index, minSize, negative);
                    Player.loadingPromise.then(function() {
                        resolve(Player.joinNextCachedFileBlock(index, originMinSize, negative));
                    });
                }
                request.onabort = function(e) {
                    reject('abort');
                }
                request.setRequestHeader("Range", "bytes=" + begin + '-' + (end - 1));
                request.send();
            }).catch(function(e) {
                log(e);
                Player.loadingPromise = null;
                return false;
            });
            Player.loadingPromise = promise;
            return promise;
        },
        //合并index索引之后所有连续的已经缓存过的分区
        joinNextCachedFileBlock: function(index, minSize, negative) {
            var length = 0;
            var arr = null;
            var result = null;
            var endIndex = index;
            var indexLength = Player.fileBlocks.length;
            if(ifDebug()){
                var joinBegin = new Date().getTime();
                log('join', index);
            }
            
            // 开始播放或者seek时只返回minSize个数据块
            if (negative) {
                indexLength = index + minSize;
                indexLength = indexLength > indexSize ? indexSize : indexLength;
            }
            for (var i = index; i < indexLength && Player.fileBlocks[i]; i++) {
                endIndex = i;
            }
            for (var i = index; i < indexLength && Player.fileBlocks[i]; i++) {
                length += Player.fileBlocks[i].byteLength;
            }
            result = new ArrayBuffer(length);
            arr = new Uint8Array(result);
            length = 0;
            for (i = index; i <= endIndex; i++) {
                arr.set(new Uint8Array(Player.fileBlocks[i]), length);
                length += Player.fileBlocks[i].byteLength;
            }
            if (ifTest()) { //观测数据正确性
                var tmp = new Uint8Array(result);
                testLog('range:', index, endIndex, '\n');
                if(tmp.length > 0){
                    testLog('byteLength1:', tmp.length, 'dataBegin1:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd1:', tmp[tmp.length - 1].toString(16), '\n');
                }else{
                    testLog('byteLength1:', tmp.length);
                }
            }
            //删除头部与尾部损坏数据
            result = Player.fixFileBlock(result, index, endIndex);
            if (ifTest()) {
                var tmp = new Uint8Array(result);
                if(tmp.length > 0){
                    testLog('byteLength2:', tmp.length, 'dataBegin2:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd2:', tmp[tmp.length - 1].toString(16));
                }else{
                    testLog('byteLength2:', tmp.length);
                }
            }
            //删除VBR数据帧(兼容ios)
            if (MP3InfoAnalysis.hasVbrHeader(result) != -1) {
                result = Player.fixFileBlock(result, index, endIndex, false, true, 2);
            }
            if (ifTest()) {
                var tmp = new Uint8Array(result);
                if(tmp.length > 0){
                    testLog('byteLength3:', tmp.length, 'dataBegin3:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd3:', tmp[tmp.length - 1].toString(16), '\n');
                }else{
                    testLog('byteLength2:', tmp.length);
                }
            }
            if(ifDebug()){
                log('join花费:', new Date().getTime() - joinBegin, 'ms');
            }
            return {
                arrayBuffer: result,
                beginIndex: index,
                endIndex: endIndex
            }
        },
        //根据索引号，找到实际的字节位置
        getRangeBeginByIndex: function(index) {
            var begin = 0;
            var mp3Info = Player.audioInfo;
            if (mp3Info.toc) {
                if (index >= indexSize) {
                    begin = mp3Info.fileSize;
                } else {
                    begin = ((mp3Info.toc[index] / 256 * mp3Info.totalSize) >> 0) + mp3Info.headerLength;
                }
            } else {
                begin = ((mp3Info.fileSize - mp3Info.headerLength) * index/indexSize + mp3Info.headerLength) >> 0;
            }
            if (begin > mp3Info.fileSize) {
                begin = mp3Info.fileSize
            }
            return begin;
        },
        //修复数据块头尾损坏数据（分割后，头部数据可能不是数据帧的帧头开始，需要修复）
        fixFileBlock: function(arrayBuffer, beginIndex, endIndex, excludeBegin, excludeEnd, offset) {
            offset = offset || 0;
            var result = arrayBuffer;
            if (!excludeBegin) {
                var begeinExtraLength = _getExtraLength(arrayBuffer);
                if (beginIndex - 1 >= 0 && Player.fileBlocks[beginIndex - 1] && Player.fileBlocks[beginIndex - 1].rightDeledData) { // 修复头部数据
                    var rightDeledData = Player.fileBlocks[beginIndex - 1].rightDeledData;
                    var newResult = new ArrayBuffer(result.byteLength + rightDeledData.byteLength);
                    var uint8Array = new Uint8Array(newResult);
                    uint8Array.set(new Uint8Array(rightDeledData), 0);
                    uint8Array.set(new Uint8Array(result), rightDeledData.byteLength);
                    result = newResult;
                } else if (begeinExtraLength) {
                    // 删除头部不完整数据
                    result = arrayBuffer.slice(begeinExtraLength);
                }
            }
            if (!excludeEnd) {
                var endExtraLength = _getExtraLength(arrayBuffer, true);
                if (endExtraLength) { // 删除尾部不完整数据
                    Player.fileBlocks[endIndex].rightDeledData = result.slice(result.byteLength - endExtraLength);
                    result = result.slice(0, result.byteLength - endExtraLength);
                }
            }
            return result;
            //获取数据块头部或尾部多余的数据长度(字节)
            function _getExtraLength(arrayBuffer, reverse) {
            	var audioInfo = Player.audioInfo;
                var i = 0;
                var count = 200;
                var bufferStr = '';
                var uint8Array = new Uint8Array(arrayBuffer);
                if (!reverse) {
                    while (true) {
                        for (; i < count && i < uint8Array.length; i++) {
                            if (uint8Array[i] <= 15) {
                                bufferStr += '0' + uint8Array[i].toString(16);
                            } else {
                                bufferStr += uint8Array[i].toString(16);
                            }
                        }
                        bufferStr = bufferStr.toUpperCase();
                        if (bufferStr.indexOf(audioInfo.frameHeaderFlag, offset * 2) != -1) {
                            return bufferStr.indexOf(audioInfo.frameHeaderFlag, offset * 2) / 2;
                        }
                        if (i >= uint8Array.length) {
                            return 0;
                        }
                        count += 200;
                    }
                } else {
                    i = uint8Array.length - 1;
                    count = uint8Array.length - 200;
                    while (true) {
                        for (; i > count && i > 0; i--) {
                            if (uint8Array[i] <= 15) {
                                bufferStr = '0' + uint8Array[i].toString(16) + bufferStr;
                            } else {
                                bufferStr = uint8Array[i].toString(16) + bufferStr;
                            }
                        }
                        bufferStr = bufferStr.toUpperCase();
                        if (bufferStr.indexOf(audioInfo.frameHeaderFlag) != -1) {
                            return bufferStr.length / 2 - bufferStr.indexOf(audioInfo.frameHeaderFlag) / 2;
                        }
                        if (i == 0) {
                            return 0;
                        }
                        count -= 200;
                    }
                }
            }
        },
        //状态改变
        changeState: function(loading, decoding, pause){
        	if(typeof loading != 'boolean'){
        		loading = Player.loading;
        	}
        	if(typeof decoding != 'boolean'){
        		decoding = Player.decoding;
        	}
        	if(pause && !Player.loading && !Player.decoding){
        		waitingCb();
        	}else if(!Player.loading && !Player.decoding && (loading || decoding)){
        		waitingCb();
        	}else if(!Player.loading && Player.decoding && !decoding){
        		playingCb();
        	}else if(Player.loading && !Player.decoding && !loading){
        		playingCb();
        	}
        },
        //跳转某个索引
        seek: function(index) {
            var mp3Info = Player.audioInfo;
            if(Player.totalBuffer){
                var begin = Player.totalBuffer.length * index / indexSize;
                if(begin > Player.totalBuffer.dataBegin && begin+5*Player.sampleRate < Player.totalBuffer.dataEnd){
                    var startTime = index / indexSize * mp3Info.totalTime;
                    Player._play(startTime);
                    return;
                }
            }
            
            Player.hasPlayed = false;
            Player.finished = false;
            Player._clearTimeout();
            if (Player.souceNode) {
                Player.souceNode.disconnect();
            }
            Player.totalBuffer = totalBuffer = Player.audioContext.createBuffer(Player.numberOfChannels, Player.bufferLength, Player.sampleRate);
            if (Player.loadingPromise) { //是否有数据正在加载
                Player.loadingPromise.then(function() {
                    Player.decodeAudioData(index, Player.cacheFrameSize, true, Player.totalBuffer);
                });
                Player.request.abort(); //强制中断下载
            } else {
                Player.decodeAudioData(index, Player.cacheFrameSize, true, Player.totalBuffer);
            }
        },
        _clearTimeout: function() {
            clearTimeout(iosPlayTimoutId);
            clearTimeout(Player.timeoutIds.decodeTimeoutId);
            clearInterval(Player.timeoutIds.updateTimeoutId);
        }
    }
    //调试模式抛出到全局
    if (ifDebug()) {
        global.Player = Player;
    }
    //对外接口
    function Mp3Player(_url, opt) {
        url = _url;
        if (typeof opt == 'object') {
            if (typeof opt.decrypt == 'function') {
                decrypt = opt.decrypt;
            }
            if (typeof opt.updateTimeCb == 'function') {
                updateTimeCb = opt.updateTimeCb;
            }
    		if (typeof opt.playCb == 'function') {
                playCb = opt.playCb;
            }
            if (typeof opt.pauseCb == 'function') {
                pauseCb = opt.pauseCb;
            }
            if (typeof opt.waitingCb == 'function') {
                waitingCb = opt.waitingCb;
            }
            if (typeof opt.playingCb == 'function') {
                playingCb = opt.playingCb;
            }
            if (typeof opt.endCb == 'function') {
                endCb = opt.endCb;
            }
            if (typeof opt.loadedmetaCb == 'function'){
                loadedmetaCb = opt.loadedmetaCb;
            }
            if (opt.emptyUrl){
            	emptyUrl = opt.emptyUrl;
            }
        }
        this.play = function() {
            var self = this;
            var nowSouceNode = Player.nowSouceNode;
            var audioContext = Player.audioContext
            if(isIos){
            	Player.audio.play();
            }
            clearTimeout(iosPlayTimoutId);
            if (isIos && Player.firstPlayResolve && !iosClicked) {
                Player.firstPlayResolve();
                iosClicked = true;
            }else if (audioContext.state == 'suspended') {
                if(Player.finished){
                    Player.seek(0);
                }else{
                    audioContext.resume();
                }
            }
        }
        this.pause = function() {
            if (Player.audioContext) {
                Player.audioContext.suspend();
                pauseCb();
            }
        }
        this.seek = function(percent) {
            Player.seek(percent);
        }
        MP3InfoAnalysis.init().then(Player.init);
    }
    if (window.define) {
        define(function() {
            return Mp3Player;
        })
    } else {
        global.Mp3Player = Mp3Player;
    }
}(window)