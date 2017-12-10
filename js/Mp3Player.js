! function(global) {
    var indexSize = 100; //区块个数
    var url = ''; //音频链接
    var decrypt = function() {}; //解密函数
    var updateTimeCb = function() {}; //更新时间回调
    var iosClicked = false;
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
            return new Promise(MP3InfoAnalysis.loadHeaderInfo).then(MP3InfoAnalysis.loadFirstFrame).then(MP3InfoAnalysis.getInfo);
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
            var samplingRate = MP3InfoAnalysis.getSamplingRate(arrayBuffer);
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
                return _getInfo(vbrDataBuffer);
            } else { //纯CBR编码
                var frameSize = MP3InfoAnalysis.getFrameSize(arrayBuffer);
                var totalTime = (mp3Info.fileSize - mp3Info.headerLength) / samplingRate;
                return {
                    frameSize: frameSize
                };
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
            //获取数据帧总大小(bit)
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
            return 1152 * bitRate / samplingRate + padding * 8;
        }
    }
    //音频播放对象
    var Player = {
        init: function() {
            Player.audioContext = null;
            Player.AudioContext = window.AudioContext || window.webkitAudioContext;
            Player.fileBlocks = new Array(100); //音频数据分区
            Player.cacheFrameSize = 10; //每次加载的分区数
            Player.indexSize = 100; //索引个数
            Player.hasPlayed = false; //是否已经开始播放
            Player.souceNodeQueue = []; //音频资源节点队列
            Player.nowSouceNode = null; //正在播放的资源节点
            Player.loading = false; //加载中
            Player.decoding = false; //解码中
            Player.loadingIndexMap = []; //正在加载中的索引，防止重复加载相同的数据
            Player.loadingPromise = null; //数据加载异步对象集合
            Player.decodeAudioData(0, Player.cacheFrameSize, true, Player.souceNodeQueue);
        },
        // 计时器
        timeoutIds: {
            decodeTimeoutId: null,
            waiteForDecodeTimeoutId: null,
            nodePlayTimoutId: null,
            updateTimeoutId: null
        },
        //解码
        decodeAudioData: function(index, minSize, negative, souceNodeQueue) {
            var mp3Info = MP3InfoAnalysis.mp3Info;
            if (index >= indexSize) {
                Player.loading = false;
                Player.decoding = false;
                return;
            }
            if (Player.audioContext && Player.audioContext.state == 'running' && (!Player.nowSouceNode || Player.nowSouceNode && Player.nowSouceNode.finished)) {
                //加载中
                Player.loading = true;
            }
            return Player.loadFrame(index, minSize, negative).then(function(result) {
                if (souceNodeQueue != Player.souceNodeQueue || !result) { //see时强制停止
                    Player.decoding = false;
                    Player.loading = false;
                    return false;
                }
                Player.loading = false;
                if (!Player.audioContext) {
                    Player.audioContext = new Player.AudioContext();
                    Player.audioContext.onstatechange = function() {
                        log(Player.audioContext.state);
                    }
                } else if (Player.audioContext.state == 'suspended') {
                    Player.audioContext.resume();
                }
                if (!Player.nowSouceNode || Player.nowSouceNode && Player.nowSouceNode.finished) {
                    //解码中
                    Player.decoding = true;
                }
                log('解码:' + result.beginIndex + ',' + result.endIndex);
                if(ifDebug()){
                    var decodeBeginTime = new Date().getTime();
                }
                Player.audioContext.decodeAudioData(result.arrayBuffer, function(buffer) { //解码成功则调用此函数，参数buffer为解码后得到的结果
                    var souceNode = null;
                    if (souceNodeQueue != Player.souceNodeQueue) { //防止seek时，之前未完成的异步解码对新队列的影响
                        return;
                    }
                    souceNode = Player.audioContext.createBufferSource();
                    souceNode.connect(Player.audioContext.destination);
                    souceNode.buffer = buffer;
                    souceNode.beginIndex = result.beginIndex;
                    souceNode.endIndex = result.endIndex;
                    souceNodeQueue.push(souceNode);
                    Player.decoding = false;
                    log(new Date().toLocaleString() , '解码完成:' + result.beginIndex + ',' + result.endIndex, 'duration:', buffer.duration);
                    if(ifDebug()){
                        log('解码时间:', new Date().getTime() - decodeBeginTime, 'ms');
                    }
                    if (!Player.hasPlayed) {
                        Player.hasPlayed = true;
                        Player.beginTime = Player.audioContext.currentTime;
                        Player.offsetTime = mp3Info.totalTime * souceNode.beginIndex/indexSize;
                        if (souceNode.endIndex + 1 < indexSize) {
                            Player.timeoutIds.decodeTimeoutId = setTimeout(function() {
                                if (Player.loadingPromise) {
                                    Player.loadingPromise.stopNextLoad = true;
                                    Player.loadingPromise.then(function() {
                                        Player.decodeAudioData(souceNode.beginIndex, souceNode.endIndex - souceNode.beginIndex + 1 + minSize, null, souceNodeQueue);
                                    })
                                } else {
                                    Player.decodeAudioData(souceNode.beginIndex, souceNode.endIndex - souceNode.beginIndex + 1 + minSize, null, souceNodeQueue);
                                }
                            }, buffer.duration * 1000 / 2);
                        }
                        if (isIos && iosClicked || !isIos) {
                            _play(souceNode, 0, buffer.duration);
                            log('play1:', souceNode.beginIndex, souceNode.endIndex);
                        } else { // ios首次播放必须手动触发
                            new Promise(function(resolve) {
                                Player.firstPlayResolve = resolve;
                            }).then(function() {
                                _play(souceNode);
                                log('play1:', souceNode.beginIndex, souceNode.endIndex);
                            })
                        }
                        souceNodeQueue.shift();
                        Player.nowSouceNode = souceNode;
                        clearInterval(Player.timeoutIds.updateTimeoutId);
                        _startUpdateTimeoutId();
                    }

                    // souceNode.onended = function() {
                    //     _finish(souceNode, souceNode.buffer.duration);
                    // }
                    // 开始更新计时器
                    function _startUpdateTimeoutId(){
                        Player.timeoutIds.updateTimeoutId = setInterval(function(){
                            var beginIndex = Player.nowSouceNode.beginIndex;
                            var endIndex = Player.nowSouceNode.endIndex;
                            //平衡音频时间
                            var time = Player.audioContext.currentTime - Player.beginTime * ((mp3Info.totalTime * (endIndex - beginIndex)/indexSize)/Player.nowSouceNode.buffer.duration);
                            updateTimeCb(time + Player.offsetTime);
                        },1000);
                    }
                    // 播放
                    function _play(souceNode, startTime, seconds) {
                        startTime = startTime || 0;
                        if(Player.audioContext.state == 'suspended'){
                            Player.audioContext.resume();
                        }
                        if (souceNode.start) {
                            souceNode.start(0, startTime);
                        } else {
                            souceNode.noteOn(0, startTime);
                        }
                        _startPlayTimeInterval(souceNode, seconds);
                    }
                    // 播放计时器(onended有稍微误差)
                    function _startPlayTimeInterval(souceNode, seconds) {
                        var context = souceNode.context;
                        var beginTime = context.currentTime;
                        clearInterval(Player.timeoutIds.nodePlayTimoutId);
                        Player.timeoutIds.nodePlayTimoutId = setInterval(function() {
                            var startTime = souceNode.startTime || 0;
                            if (context.currentTime - beginTime + 0.1 > seconds) {
                                _finish(souceNode, souceNode.buffer.duration - (seconds - (context.currentTime - beginTime)));
                            }
                        }, 100);
                    }
                    // 完成后播放下一段
                    function _finish(souceNode, startTime) {
                        clearInterval(Player.timeoutIds.nodePlayTimoutId);
                        souceNode.finished = true;
                        setTimeout(function(){
                            souceNode.disconnect();
                        },200);
                        if (souceNode.endIndex == indexSize - 1) {
                            Player.audioContext.suspend();
                        } else {
                            if (souceNodeQueue.length > 0) {
                                var newSouceNode = souceNodeQueue.shift();
                                log('continue')
                                _play(newSouceNode, startTime, newSouceNode.buffer.duration - Player.nowSouceNode.buffer.duration);
                                log('play2:', newSouceNode.beginIndex, newSouceNode.endIndex);
                                if (newSouceNode.endIndex + 1 < indexSize) {
                                    var timeout = 0;
                                    if (Player.nowSouceNode) {
                                        timeout = (newSouceNode.buffer.duration - Player.nowSouceNode.buffer.duration) * 1000 / 2;
                                    } else {
                                        timeout = newSouceNode.buffer.duration * 1000 / 2;
                                    }
                                    clearTimeout(Player.timeoutIds.decodeTimeoutId);
                                    Player.timeoutIds.decodeTimeoutId = setTimeout(function() {
                                        if (Player.loadingPromise) {
                                            Player.loadingPromise.stopNextLoad = true;
                                            Player.loadingPromise.then(function() {
                                                Player.decodeAudioData(newSouceNode.beginIndex, newSouceNode.endIndex - newSouceNode.beginIndex + 1 + minSize, null, souceNodeQueue);
                                            })
                                        } else {
                                            Player.decodeAudioData(newSouceNode.beginIndex, newSouceNode.endIndex - newSouceNode.beginIndex + 1 + minSize, null, souceNodeQueue);
                                        }
                                    }, timeout);
                                }
                                Player.nowSouceNode = newSouceNode;
                            } else {
                                Player.audioContext.suspend(); // 等待解码时，先暂停
                                // 下一段音频还没有解码完成
                                Player.timeoutIds.waiteForDecodeTimeoutId = setTimeout(function() {
                                    _finish(souceNode, startTime);
                                }, 1000);
                            }
                        }
                    }
                }, function(e) {
                    log(index, "解码失败");
                });
                return result;
            });
        },
        //获取数据帧
        loadFrame: function(index, minSize, negative) {
            var begin = 0;
            var end = 0;
            var cached = true;
            var beginIndex = index; //避免网络加载重复数据
            var endIndex = 0;
            var originMinSize = minSize;
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
                        if (MP3InfoAnalysis.mp3Info.toc) { //VBR编码模式
                            end = (begin + (Player.getRangeBeginByIndex(i + 1) - Player.getRangeBeginByIndex(i))) >> 0;
                            Player.fileBlocks[i] = arrayBuffer.slice(begin, end);
                            begin = end;
                        } else { //CBR编码模式
                            end = begin + MP3InfoAnalysis.mp3Info.frameSize;
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
            log('join', index)
            //消极情况下只返回minSize个数据块
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
                testLog('range1:', index, endIndex, ':\n');
                testLog('byteLength1:', tmp.length, 'dataBegin1:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd1:', tmp[tmp.length - 1].toString(16));
            }
            //删除头部与尾部损坏数据
            result = Player.fixFileBlock(result);
            if (ifTest()) {
                var tmp = new Uint8Array(result);
                testLog('byteLength2:', tmp.length, 'dataBegin2:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd2:', tmp[tmp.length - 1].toString(16));
            }
            //删除VBR数据帧(兼容ios)
            if (MP3InfoAnalysis.hasVbrHeader(result) != -1) {
                result = Player.fixFileBlock(result, 2, false, true);
            }
            if (ifTest()) {
                var tmp = new Uint8Array(result);
                testLog('byteLength3:', tmp.length, 'dataBegin3:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd3:', tmp[tmp.length - 1].toString(16), '\n');
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
            var mp3Info = MP3InfoAnalysis.mp3Info;
            if (mp3Info.toc) {
                if (index >= indexSize) {
                    begin = mp3Info.fileSize;
                } else {
                    begin = ((mp3Info.toc[index] / 256 * mp3Info.totalSize) >> 0) + mp3Info.headerLength;
                }
            } else {
                begin = (mp3Info.frameSize * index + mp3Info.headerLength) >> 0;
            }
            if (begin > mp3Info.fileSize) {
                begin = mp3Info.fileSize
            }
            return begin;
        },
        //删除数据块头尾损坏数据
        fixFileBlock: function(arrayBuffer, beginIndex, excludeBegin, excludeEnd) {
            beginIndex = beginIndex || 0;
            var result = arrayBuffer;
            if (!excludeBegin) {
                var begeinExtraLength = _getExtraLength(arrayBuffer);
                if (begeinExtraLength) {
                    result = arrayBuffer.slice(begeinExtraLength)
                }
            }
            if (!excludeEnd) {
                var endExtraLength = _getExtraLength(arrayBuffer, true);
                if (endExtraLength) {
                    result = result.slice(0, result.byteLength - endExtraLength);
                }
            }
            return result;
            //获取数据块头部或尾部多余的数据长度(字节)
            function _getExtraLength(arrayBuffer, reverse) {
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
                        if (bufferStr.indexOf(MP3InfoAnalysis.mp3Info.frameHeaderFlag, beginIndex * 2) != -1) {
                            return bufferStr.indexOf(MP3InfoAnalysis.mp3Info.frameHeaderFlag, beginIndex * 2) / 2;
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
                        if (bufferStr.indexOf(MP3InfoAnalysis.mp3Info.frameHeaderFlag) != -1) {
                            return bufferStr.length / 2 - bufferStr.indexOf(MP3InfoAnalysis.mp3Info.frameHeaderFlag) / 2;
                        }
                        if (i == 0) {
                            return 0;
                        }
                        count -= 200;
                    }
                }
            }
        },
        //跳转某个索引
        seek: function(index) {
            Player.hasPlayed = false;
            Player.souceNodeQueue = [];
            Player._clearTimeout();
            if (Player.nowSouceNode) {
                Player.nowSouceNode.disconnect();
                Player.nowSouceNode = null;
            }
            if (Player.loadingPromise) { //是否有数据正在加载
                // Player.loadingPromise.stopNextLoad = true
                // Player.loadingPromise.then(function() {
                // Player.decodeAudioData(index, Player.cacheFrameSize, true, Player.souceNodeQueue)
                // });
                Player.loadingPromise.then(function() {
                    Player.decodeAudioData(index, Player.cacheFrameSize, true, Player.souceNodeQueue);
                });
                Player.request.abort(); //强制中断下载
            } else {
                Player.decodeAudioData(index, Player.cacheFrameSize, true, Player.souceNodeQueue)
            }
        },
        _clearTimeout: function() {
            clearTimeout(iosPlayTimoutId);
            clearTimeout(Player.timeoutIds.decodeTimeoutId);
            clearTimeout(Player.timeoutIds.waiteForDecodeTimeoutId);
            clearInterval(Player.timeoutIds.nodePlayTimoutId);
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
            if(typeof opt.decrypt == 'function'){
                decrypt = opt.decrypt;
            }
            if(typeof opt.updateTimeCb == 'function'){
                updateTimeCb = opt.updateTimeCb;
            }
        }
        MP3InfoAnalysis.init().then(Player.init);
        this.play = function() {
            var self = this;
            var nowSouceNode = Player.nowSouceNode;
            var audioContext = Player.audioContext
            clearTimeout(iosPlayTimoutId);
            if (isIos && !Player.firstPlayResolve) {
                iosPlayTimoutId = setTimeout(function() {
                    self.play();
                }, 100);
            }
            if (isIos && nowSouceNode && !iosClicked) {
                Player.firstPlayResolve();
                iosClicked = true;
            } else if (audioContext.state == 'suspend') {
                audioContext.resume();
            } else if (audioContext.state == 'closed') {
                Player.seek(0);
            }
        }
        this.pause = function() {
            if (Player.audioContext) {
                Player.audioContext.suspend();
            }
        }
        this.seek = function(percent) {
            Player.seek(percent);
        }
    }
    if (window.define) {
        define(function() {
            return Mp3Player;
        })
    } else {
        global.Mp3Player = Mp3Player;
    }
}(window)
