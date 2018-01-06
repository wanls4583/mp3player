/**
 * 音频播放器模块
 * AudioContext wiki: https://developer.mozilla.org/zh-CN/docs/Web/API/AudioContext
 */
define(function(require, exports, module) {
    'use strict';

    var requestRange = require('./common/range');
    var Util = require('./common/util');

    function Mp3Player(_url, opt) {
        var indexSize = 100; //区块个数（根据时间平均分为100份,默认100）
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
        var errorCb = errorCb; //错误回调
        var maxDecodeSize = 5 * 1024 * 1024; // 最大解码字节长度(默认8M)
        var isIos = navigator.userAgent.indexOf('iPhone') > -1;
        var AudioInfo = null;
        var audio = null;
        if (isIos) {
            audio = new Audio();
            audio.src = opt.emptyUrl;
        }
        //音频播放对象
        var Player = {
            _init: function(audioInfo) {
                var self = this;
                this.audioInfo = audioInfo; //音频信息
                this.bufferLength = 0; //音频全部解码后总大小
                this.audioContext = new(window.AudioContext || window.webkitAudioContext)(); //音频上下文对象
                this.audioContext.onstatechange = function() {
                    if(self.audioContext){
                        if(self.audioContext.state!='running'){
                            self.isPlaying = false;
                        }
                        Util.log(self.audioContext.state);
                    }
                    
                }
                this.fileBlocks = new Array(100); //音频数据分区
                this.cacheFrameSize = 0; //每次加载的分区数
                this.indexSize = 100; //索引个数
                this.seeking = false; //是否正在索引
                this.nowSouceNode = null; //正在播放的资源节点
                this.loadingPromise = null; //数据加载异步对象集合
                if(audioInfo.fileSize/indexSize > 1024 * 1024){ //1/100总数据大小是否大于1M
                    this.cacheFrameSize = 1;
                }else{
                    this.cacheFrameSize = Math.ceil(1024 * 1024 / (audioInfo.fileSize/indexSize));
                }
                if(this.audioInfo){
                    this.beginDecodeTime = new Date().getTime();
                    this._decodeAudioData(0, this.cacheFrameSize, true, this.beginDecodeTime);
                }
            },
            //计时器
            timeoutIds: {
                decodeTimeoutId: null, //解码计时器
                updateIntervalId: null, //时间更新计时器
                playTimoutId: null, //播放计时器
                reloadTimeoutId: null //加载失败后重加载计时器
            },
            //解码
            _decodeAudioData: function(index, minSize, negative, beginDecodeTime) {
                var self = this;
                var audioInfo = this.audioInfo;
                if (index >= indexSize) {
                    return;
                }
                return this._loadFrame(index, minSize, negative).then(function(result) {
                    if (beginDecodeTime != self.beginDecodeTime || !result) { //see时强制停止
                        return false;
                    }
                    Util.log('解码:' + result.beginIndex + ',' + result.endIndex);
                    if (Util.ifDebug()) {
                        var decodeBeginTime = new Date().getTime();
                    }
                    self.audioContext.decodeAudioData(result.arrayBuffer,function(buffer) { //使用旧版回调，调试时将有可能被阻塞而不执行回调
                        if (beginDecodeTime != self.beginDecodeTime) { //防止seek时，之前未完成的异步解码对新队列的影响
                            return;
                        }
                        if (Util.ifDebug()) {
                            Util.log('解码花费:', new Date().getTime() - decodeBeginTime);
                        }
                        self.endIndex = result.endIndex;
                        self.beginIndex = result.beginIndex;
                        var del = del = (1152*buffer.sampleRate/self.audioInfo.sampleRate)>>0;
                        var tmp = self.audioContext.createBuffer(buffer.numberOfChannels, buffer.length - del*2, buffer.sampleRate);
                        for(var i=0; i<buffer.numberOfChannels; i++){
                            tmp.getChannelData(i).set(buffer.getChannelData(i).slice(del*2), 0);
                        }
                        self.nextBuffer = tmp;
                        if(self.seeking && !self.pause || self.waiting){
                            if(self.waiting){
                                self.waiting = false;
                                playingCb();
                            }else{
                                self.seeking = false;
                            }
                            self._play(0);
                        }
                    },function(){
                        Util.log(index, "解码失败", e);
                    });

                    return result;
                });
            },
            //播放
            _play: function(startTime) {
                var self = this;
                this.currentTime = Math.round(this.offsetTime);
                if (this.audioContext.state == 'suspended') {
                    this.audioContext.resume();
                }
                var sourceNode = this.audioContext.createBufferSource();
                var scriptProcessor = this.audioContext.createScriptProcessor(2048,2,2);
                var count, index = this.endIndex, del;
                del = (startTime*this.nextBuffer.sampleRate)>>0;
                count = Math.ceil(del/2048)*2048;
                sourceNode.buffer = this.nextBuffer;
                this.nowBuffer = this.nextBuffer;
                this.nextBuffer = null;
                sourceNode.scriptProcessor = scriptProcessor;
                sourceNode.connect(scriptProcessor);
                scriptProcessor.connect(this.audioContext.destination);
                scriptProcessor.onaudioprocess = function(e){
                    var inputBuffer = e.inputBuffer;
                    var outputBuffer = e.outputBuffer;
                    for (var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                        var inputData = inputBuffer.getChannelData(channel);
                        var outputData = outputBuffer.getChannelData(channel);
                        outputData.set(inputData, 0);
                    }
                    count+=inputBuffer.length;
                    if(count + inputBuffer.length >= sourceNode.buffer.length && !scriptProcessor.stop){
                        if(self.nextBuffer){
                            self._play(0);
                        }else if(!self.waiting && index < indexSize - 1){
                            self.waiting = true;
                            self.audioContext.suspend();
                            waitingCb();
                        }
                        scriptProcessor.stop = true;
                    }
                }
                sourceNode.onended = function() {
                    scriptProcessor.disconnect();
                    sourceNode.disconnect();
                    if(index >= indexSize-1){
                        self._end();
                    }else if(!scriptProcessor.stop){
                        if(self.nextBuffer){
                            self._play(0);
                        }else if(!self.waiting && index < indexSize-1){
                            self.waiting = true;
                            self.audioContext.suspend();
                            waitingCb();
                        }
                    }
                }
                if (sourceNode.start) {
                    sourceNode.start(0, startTime);
                } else {
                    sourceNode.noteOn(0, startTime);
                }

                var t = sourceNode.buffer.duration/2;

                self.beginDecodeTime = setTimeout(function(){
                    var size = self.cacheFrameSize*4;
                    if(size/indexSize*self.audioInfo.fileSize > maxDecodeSize){
                        size = (maxDecodeSize/(self.audioInfo.fileSize/indexSize*self.cacheFrameSize))>>0;
                    }
                    self._decodeAudioData(self.endIndex + 1, size, null, self.beginDecodeTime);
                }, t*1000);
                
                this.hasPlayed = true;
                this.nowSouceNode = sourceNode;
                this.offsetTime = this.currentTime = this.beginIndex/indexSize*this.audioInfo.totalTime; //开始计时偏移量
                this._startUpdateTimeoutId();
                this.isPlaying = true;
            },
            //开始更新计时器
            _startUpdateTimeoutId: function() {
                var self = this;
                clearInterval(this.timeoutIds.updateIntervalId);
                this.beginTime = this.audioContext.currentTime;
                this.timeoutIds.updateIntervalId = setInterval(function() {
                    var time = self.audioContext.currentTime - self.beginTime;
                    var currentTime = time + self.offsetTime;
                    if (currentTime >= self.audioInfo.totalTime) {
                        self._end();
                    }
                    if (Math.round(currentTime) > self.currentTime) {
                        self.currentTime = Math.round(currentTime);
                        updateTimeCb(self.currentTime); //时间更新计时器回调
                    }
                }, 1000);
            },
            _end: function() {
                this.finished = true; //播放结束标识
                this._clearTimeout();
                this.audioContext.suspend();
                endCb();
            },
            //获取数据帧
            _loadFrame: function(index, minSize, negative) {
                var self = this;
                var begin = 0;
                var end = 0;
                var cached = true;
                var beginIndex = index; //避免网络加载重复数据
                var endIndex = 0;
                var originMinSize = minSize;
                var audioInfo = this.audioInfo
                index = index >= indexSize ? indexSize - 1 : index;
                if (index + minSize > indexSize) {
                    minSize = indexSize - index;
                }
                //防止头部加载重复数据
                for (var i = index; i < index + minSize; i++) {
                    if (!this.fileBlocks[i]) {
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
                    result = this._joinNextCachedFileBlock(index, minSize, negative);
                    if (result.endIndex < indexSize - 1) {
                        this._loadFrame(result.endIndex + 1, this.cacheFrameSize);
                    }
                    return Promise.resolve(result);
                }
                //防止尾部加载重复数据
                var i = beginIndex + minSize - 1;
                i = i >= indexSize ? indexSize - 1 : i;
                for (; i > beginIndex; i--) {
                    if (this.fileBlocks[i]) {
                        minSize--;
                    } else {
                        break;
                    }
                }
                if (beginIndex + minSize > indexSize) {
                    minSize = indexSize - beginIndex;
                }
                begin = this._getRangeBeginByIndex(beginIndex);
                end = this._getRangeBeginByIndex(beginIndex + minSize) - 1;
                Util.log('loading:', beginIndex, beginIndex + minSize - 1)
                var promise = new Promise(function(resolve, reject) {
                    setTimeout(function() { //交出控制权给Player对象
                        promise.resolve = resolve;
                        promise.reject = reject;
                    }, 0);

                    self.request = requestRange(url, begin, end, {
                        onsuccess: function(request) {
                            var arrayBuffer = request.response;
                            var begin = 0;
                            var end = 0;
                            //数据解密
                            decrypt(arrayBuffer);
                            //缓存数据块
                            for (var i = beginIndex; i < beginIndex + minSize && i < indexSize; i++) {
                                if (audioInfo.toc) { //VBR编码模式
                                    if (i + 1 >= indexSize || i + 1 >= beginIndex + minSize) {
                                        end = arrayBuffer.byteLength;
                                    } else {
                                        end = (begin + (self._getRangeBeginByIndex(i + 1) - self._getRangeBeginByIndex(i))) >> 0;
                                    }
                                    self.fileBlocks[i] = arrayBuffer.slice(begin, end);
                                    begin = end;
                                } else { //CBR编码模式
                                    if (i + 1 >= indexSize || i + 1 >= beginIndex + minSize) {
                                        end = arrayBuffer.byteLength;
                                    } else {
                                        end = begin + (audioInfo.fileSize - audioInfo.audioDataOffset) / indexSize;
                                    }
                                    self.fileBlocks[i] = arrayBuffer.slice(begin, end);
                                    begin = end;
                                }
                            }
                            Util.log('load完成:', beginIndex, beginIndex + minSize - 1);
                            if (self.loadingPromise && !self.loadingPromise.stopNextLoad) { //seek后应该从新的位置加载后面的数据
                                setTimeout(function() {
                                    self._loadFrame(index + originMinSize, originMinSize);
                                }, 0)
                            }
                            self.loadingPromise = null;
                            resolve(self._joinNextCachedFileBlock(index, originMinSize, negative));
                        },
                        ontimeout: function() {
                            clearTimeout(self.timeoutIds.reloadTimeoutId);
                            self.timeoutIds.reloadTimeoutId = setTimeout(function(){ //1秒后重新加载
                                self.loadingPromise = self._loadFrame(index, minSize, negative);
                                self.loadingPromise.then(function() {
                                    resolve(self._joinNextCachedFileBlock(index, originMinSize, negative));
                                });
                            },1000)
                        },
                        onerror: function(e) {
                            clearTimeout(self.timeoutIds.reloadTimeoutId);
                            self.timeoutIds.reloadTimeoutId = setTimeout(function(){ //1秒后重新加载
                                self.loadingPromise = self._loadFrame(index, minSize, negative);
                                self.loadingPromise.then(function() {
                                    resolve(self._joinNextCachedFileBlock(index, originMinSize, negative));
                                });
                            },1000)
                        },
                        onabort: function(e) {
                            reject('abort');
                        }
                    })
                }).catch(function(e) {
                    Util.log(e);
                    self.loadingPromise = null;
                    return false;
                });
                this.loadingPromise = promise;
                return promise;
            },
            //合并index索引之后所有连续的已经缓存过的分区
            _joinNextCachedFileBlock: function(index, minSize, negative) {
                var length = 0;
                var arr = null;
                var result = null;
                var endIndex = index;
                var indexLength = this.fileBlocks.length;
                var exceed = false; //是否超过了最大解码长度
                if (Util.ifDebug()) {
                    var joinBegin = new Date().getTime();
                    Util.log('join', index);
                }

                //开始播放或者seek时只返回minSize个数据块
                if (negative) {
                    indexLength = index + minSize;
                    indexLength = indexLength > indexSize ? indexSize : indexLength;
                }
                for (var i = index; i < indexLength && this.fileBlocks[i]; i++) {
                    endIndex = i;
                    length += this.fileBlocks[i].byteLength;
                    if (length >= maxDecodeSize) {
                        exceed = true;
                        break;
                    }
                }
                result = new ArrayBuffer(length);
                arr = new Uint8Array(result);
                length = 0;
                for (i = index; i <= endIndex; i++) {
                    arr.set(new Uint8Array(this.fileBlocks[i]), length);
                    length += this.fileBlocks[i].byteLength;
                }
                if (Util.ifTest()) { //观测数据正确性
                    var tmp = new Uint8Array(result);
                    Util.testLog('range:', index, endIndex, '\n');
                    if (tmp.length > 0) {
                        Util.testLog('byteLength1:', tmp.length, 'dataBegin1:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd1:', tmp[tmp.length - 1].toString(16), '\n');
                    } else {
                        Util.testLog('byteLength1:', tmp.length);
                    }
                }
                //删除尾部损坏数据
                result = this._fixFileBlock(result, index, endIndex, false, false, 0, 4);
                if (Util.ifTest()) {
                    var tmp = new Uint8Array(result);
                    if (tmp.length > 0) {
                        Util.testLog('byteLength2:', tmp.length, 'dataBegin2:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd2:', tmp[tmp.length - 1].toString(16));
                    } else {
                        Util.testLog('byteLength2:', tmp.length);
                    }
                }
                if (Util.ifTest()) {
                    var tmp = new Uint8Array(result);
                    if (tmp.length > 0) {
                        Util.testLog('byteLength3:', tmp.length, 'dataBegin3:', tmp[0].toString(16), tmp[1].toString(16), 'dataEnd3:', tmp[tmp.length - 1].toString(16), '\n');
                    } else {
                        Util.testLog('byteLength2:', tmp.length);
                    }
                }
                if (Util.ifDebug()) {
                    Util.log('join花费:', new Date().getTime() - joinBegin, 'ms');
                }
                return {
                    exceed: exceed,
                    arrayBuffer: result,
                    beginIndex: index,
                    endIndex: endIndex
                }
            },
            //根据索引号，找到实际的字节位置
            _getRangeBeginByIndex: function(index) {
                var begin = 0;
                var audioInfo = this.audioInfo;
                if (audioInfo.toc) {
                    if (index >= indexSize) {
                        begin = audioInfo.fileSize;
                    } else {
                        begin = ((audioInfo.toc[index] / 256 * audioInfo.totalSize) >> 0) + audioInfo.audioDataOffset;
                    }
                } else {
                    begin = ((audioInfo.fileSize - audioInfo.audioDataOffset) * index / indexSize + audioInfo.audioDataOffset) >> 0;
                }
                if (begin > audioInfo.fileSize) {
                    begin = audioInfo.fileSize;
                }
                return begin;
            },
            //修复数据块头尾损坏数据（分割后，头部数据可能不是数据帧的帧头开始，需要修复）
            _fixFileBlock: function(arrayBuffer, beginIndex, endIndex, excludeBegin, excludeEnd, offset, endFrameSize) {
                endFrameSize = endFrameSize || 1;
                offset = offset || 0;
                var result = arrayBuffer;
                if (!excludeBegin) { //从头部开始
                    var begeinExtraLength = Util.getLengthByFrameSync(arrayBuffer, this.audioInfo.frameSync, offset);
                    if (beginIndex - 1 >= 0 && this.fileBlocks[beginIndex - 1] && this.fileBlocks[beginIndex - 1].rightDeledData) { //修复头部数据
                        var rightDeledData = this.fileBlocks[beginIndex - 1].rightDeledData;
                        var newResult = new ArrayBuffer(result.byteLength + rightDeledData.byteLength);
                        var uint8Array = new Uint8Array(newResult);
                        uint8Array.set(new Uint8Array(rightDeledData), 0);
                        uint8Array.set(new Uint8Array(result), rightDeledData.byteLength);
                        result = newResult;
                    } else if (begeinExtraLength) {
                        //删除头部不完整数据
                        result = arrayBuffer.slice(begeinExtraLength);
                    }
                }
                if (!excludeEnd) { //从尾部开始
                    var endExtraLength = Util.getLengthByFrameSync(arrayBuffer, this.audioInfo.frameSync, null, true);
                    var originResult = result;
                    if (endExtraLength) { //删除尾部不完整数据
                        result = result.slice(0, result.byteLength - endExtraLength);
                    }
                    endExtraLength = Util.getLengthByFrameSync(arrayBuffer, this.audioInfo.frameSync, null, true, endFrameSize);
                    if (endExtraLength) { //存储endFrameSize个帧给接下来的帧使用
                        this.fileBlocks[endIndex].rightDeledData = originResult.slice(originResult.byteLength - endExtraLength);
                    }
                }
                return result;

            },
            //跳转某个索引
            _seek: function(index) {
                var self = this;
                var audioInfo = this.audioInfo;
                if (index >= indexSize) {
                    index = indexSize - 1;
                }
                if(this.waiting){
                    this.waiting = false;
                    playingCb();
                }
                this._clearTimeout();
                this.seeking = true;
                this.hasPlayed = false;
                this.finished = false;
                this.beginDecodeTime = new Date().getTime();
                if (this.nowSouceNode) {
                    this.nowSouceNode.scriptProcessor.disconnect();
                    this.nowSouceNode.disconnect();
                }
                if (this.loadingPromise) { //是否有数据正在加载
                    this.loadingPromise.then(function() {
                        self._decodeAudioData(index, self.cacheFrameSize, true, self.beginDecodeTime);
                    });
                    this.request.abort(); //强制中断下载
                } else {
                    this._decodeAudioData(index, this.cacheFrameSize, true, this.beginDecodeTime);
                }
            },
            //清除所有计时器
            _clearTimeout: function() {
                clearTimeout(this.timeoutIds.decodeTimeoutId);
                clearInterval(this.timeoutIds.updateIntervalId);
                clearTimeout(this.timeoutIds.playTimoutId);
                clearTimeout(this.timeoutIds.reloadTimeoutId);
            }
        }
        //对外接口
        function _Player(_url, opt) {
            url = _url;
            if (typeof opt == 'object') {
                AudioInfo = opt.AudioInfo; //音频信息分析对象
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
                if (typeof opt.loadedmetaCb == 'function') {
                    loadedmetaCb = opt.loadedmetaCb;
                }
                if (typeof opt.loadedmetaCb == 'function') {
                    errorCb = opt.errorCb;
                }
            }else{
                return {};
            }
            this.play = function() {
                if(Player.error){
                    errorCb();
                    return;
                }else if(!this.clickPlayTime){
                    Player.waiting = false;
                    this.clickPlayTime = new Date().getTime();
                }else if(Player.audioInfo === false || new Date().getTime() - this.clickPlayTime > 5000 && !Player.audioInfo){
                    this.clickPlayTime = 0;
                    return;
                }
                var self = this;
                var nowSouceNode = Player.nowSouceNode;
                var audioContext = Player.audioContext;
                var audioInfo = Player.audioInfo;
                clearTimeout(Player.timeoutIds.playTimoutId);
                if (isIos && !this.hasClick) {
                    audio.play();
                    this.hasClick = true;
                }
                if (!Player.hasPlayed) {
                    if (!Player.nextBuffer) {
                        if(!Player.waiting){
                            Player.waiting = true;
                            waitingCb();
                        }
                        Player.timeoutIds.playTimoutId = setTimeout(function() {
                            self.play();
                        }, 500);
                        return;
                    }
                    if(Player.waiting){
                        Player.waiting = false;
                        playingCb();
                    }
                    Player._play(0);
                    playCb();
                } else if ((Player.pause == true || Player.finished) && !Player.waiting) {
                    if (Player.finished) {
                        Player._seek(0);
                    } else {
                        Player.pause = false;
                        audioContext.resume();
                    }
                    playCb();
                }
            }
            this.pause = function() {
                pauseCb();
                Player.pause = true;
                Player.waiting = false;
                if(Player.audioContext){
                    Player.audioContext.suspend();
                }
                clearTimeout(Player.timeoutIds.playTimoutId);
            }
            this.seek = function(percent) {
                percent = percent>>0;
                if(!Player.audioInfo){
                    return false;
                }
                Player._seek(percent);
                return true;
            }
            this.destory = function(){
                Player._clearTimeout();
                if(Player.audioContext){
                    Player.audioContext.close();
                    Player.audioContext = null;
                }
            }
            this.isPlaying = function(){
                return Player.isPlaying;
            }
            AudioInfo.init(url,{
                decrypt: decrypt,
                loadedmetaCb: loadedmetaCb
            }).then(function(audioInfo){
                Player._init(audioInfo);
                if(!audioInfo){
                    errorCb();
                    Player.error = 'parse audioInfo failed';
                }
            }).catch(function(){
                Player.error = 'load audioInfo failed';
                errorCb();
            })
        }
        return new _Player(_url, opt);
    }
    return Mp3Player;
})