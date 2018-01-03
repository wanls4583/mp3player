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
        var maxDecodeSize = 8 * 1024 * 1024; // 最大解码字节长度(默认8M)
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
                    Util.log(self.audioContext.state);
                }
                this.fileBlocks = new Array(100); //音频数据分区
                this.cacheFrameSize = 0; //每次加载的分区数
                this.indexSize = 100; //索引个数
                this.seeking = true; //是否正在索引
                this.totalBuffer = null; //音频资源节点队列
                this.nowSouceNode = null; //正在播放的资源节点
                this.loadingPromise = null; //数据加载异步对象集合
                if(audioInfo.fileSize/indexSize > 1024 * 1024){ //1/100总数据大小是否大于1M
                    this.cacheFrameSize = 1;
                }else{
                    this.cacheFrameSize = Math.ceil(1024 * 1024 / (audioInfo.fileSize/indexSize));
                }
                this._decodeAudioData(0, this.cacheFrameSize, true, this.totalBuffer);
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
                    self.decodingPromise = self.audioContext.decodeAudioData(result.arrayBuffer).then(function(buffer) { //使用旧版回调，调试时将有可能被阻塞而不执行回调
                        if (beginDecodeTime != self.beginDecodeTime) { //防止seek时，之前未完成的异步解码对新队列的影响
                            return;
                        }
                        if (!self.bufferLength) {
                            self.bufferLength = Math.ceil(audioInfo.totalTime * buffer.sampleRate);
                        }
                        if (!self.numberOfChannels) {
                            self.numberOfChannels = buffer.numberOfChannels;
                        }
                        if (!self.sampleRate) {
                            self.sampleRate = buffer.sampleRate;
                        }
                        if (!self.totalBuffer) {
                            self.totalBuffer = self.audioContext.createBuffer(self.numberOfChannels, self.bufferLength, self.sampleRate);
                        }
                        Util.log('解码完成:' + result.beginIndex + ',' + result.endIndex, 'duration:', buffer.duration);
                        if (Util.ifDebug()) {
                            Util.log('解码花费:', new Date().getTime() - decodeBeginTime, 'ms');
                        }
                        if (self.seeking) {
                            self.seeking = false;
                            self.totalBuffer.dataOffset = self.totalBuffer.dataBegin = self.totalBuffer.dataEnd = (self.totalBuffer.length * result.beginIndex / indexSize) >> 0;
                            self._copyPCMData(buffer);
                            if (self.hasPlayed && !self.pause) {
                                self._play(self.totalBuffer.dataBegin / self.totalBuffer.length * audioInfo.totalTime);
                            }
                        } else {
                            self._copyPCMData(buffer);
                            if (self.waiting) {
                                self.waiting = false;
                                if (!self.pause) { //从等待状态唤醒
                                    self.audioContext.resume();
                                    playingCb();
                                }
                            }
                        }
                        self.totalBuffer.endIndex = result.endIndex;
                        if (result.endIndex + 1 < indexSize) {
                            var nextDecodeTime = buffer.duration * 1000 / 2;
                            if (nextDecodeTime > 10000) {
                                nextDecodeTime = 10000;
                            }
                            clearTimeout(self.timeoutIds.decodeTimeoutId);
                            self.timeoutIds.decodeTimeoutId = setTimeout(function() {
                                if (self.loadingPromise) {
                                    self.loadingPromise.stopNextLoad = true;
                                    self.loadingPromise.then(function() {
                                        _nextDecode(result, self.totalBuffer, minSize, audioInfo);
                                    })
                                } else {
                                    _nextDecode(result, self.totalBuffer, minSize, audioInfo);
                                }
                            }, nextDecodeTime);
                        }
                        self.decodingPromise = null;
                    }).catch(function(e) {
                        Util.log(index, "解码失败", e);
                        self.decodingPromise = null;
                    });

                    function _nextDecode(result, totalBuffer, minSize, audioInfo) {
                        if (!result.exceed) {
                            self._decodeAudioData(result.beginIndex, result.endIndex - result.beginIndex + 1 + self.cacheFrameSize, null, beginDecodeTime);
                        } else {
                            totalBuffer.dataOffset = totalBuffer.dataEnd;
                            self._decodeAudioData(result.endIndex + 1, self.cacheFrameSize, null, beginDecodeTime);
                        }
                    }
                    return result;
                });
            },
            //复制PCM流
            _copyPCMData: function(_buffer) {
                var offset = this.totalBuffer.dataOffset;
                var sampleSize = (1152 *  this.sampleRate / this.audioInfo.sampleRate)>>0;
                var delLength = sampleSize * 2; // 需要删除的断点损坏数据长度
                if(this.audioInfo.toc){
                    delLength = sampleSize * 6;
                }
                for (var i = 0; i < _buffer.numberOfChannels; i++) {
                    var data = _buffer.getChannelData(i);
                    this.totalBuffer.copyToChannel(_buffer.getChannelData(i).slice(delLength), i, offset);
                }
                this.totalBuffer.dataEnd = offset + _buffer.length - delLength;

            },
            //播放
            _play: function(startTime) {
                var self = this;
                this.offsetTime = startTime;
                this.currentTime = Math.round(this.offsetTime);
                if (this.audioContext.state == 'suspended') {
                    this.audioContext.resume();
                }
                if (this.nowSouceNode) {
                    this.nowSouceNode.disconnect();
                }
                var sourceNode = this.audioContext.createBufferSource();
                sourceNode.buffer = this.totalBuffer;
                sourceNode.connect(this.audioContext.destination);
                sourceNode.onended = function() {
                    self._end();
                }
                if (sourceNode.start) {
                    sourceNode.start(0, startTime);
                } else {
                    sourceNode.noteOn(0, startTime);
                }
                this.hasPlayed = true;
                this.nowSouceNode = sourceNode;
                this._startUpdateTimeoutId();
            },
            //开始更新计时器
            _startUpdateTimeoutId: function() {
                var self = this;
                clearInterval(this.timeoutIds.updateIntervalId);
                this.beginTime = this.audioContext.currentTime;
                this.timeoutIds.updateIntervalId = setInterval(function() {
                    var time = self.audioContext.currentTime - self.beginTime;
                    var currentTime = time + self.offsetTime;
                    if (self.audioInfo.toc && currentTime > self.audioInfo.totalTime) {
                        self._end();
                    }
                    if (Math.round(currentTime) > self.currentTime) {
                        self.currentTime = Math.round(currentTime);
                        updateTimeCb(self.currentTime); //时间更新计时器回调
                    }
                    //等待数据解码
                    if (!self.waiting && self.totalBuffer.endIndex < indexSize - 1 && (currentTime + 2) * self.sampleRate > self.totalBuffer.dataEnd) {
                        self.waiting = true;
                        self.audioContext.suspend();
                        waitingCb();
                    }
                }, 1000);
            },
            _end: function() {
                this.nowSouceNode.disconnect();
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
                result = this._fixFileBlock(result, index, endIndex, false, false, 0, 8);
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
                if (this.totalBuffer) {
                    var begin = this.totalBuffer.length * index / indexSize;
                    if (begin > this.totalBuffer.dataBegin && begin + 5 * this.sampleRate < this.totalBuffer.dataEnd) {
                        var startTime = index / indexSize * audioInfo.totalTime;
                        if(this.pause){
                            this.resumeTime = startTime;
                        }else{
                            clearInterval(this.timeoutIds.updateIntervalId);
                            clearTimeout(this.timeoutIds.playTimoutId);
                            this._play(startTime);
                        }
                        return;
                    }
                    this.totalBuffer = this.audioContext.createBuffer(this.numberOfChannels, this.bufferLength, this.sampleRate);
                }
                this._clearTimeout();
                this.seeking = true;
                this.finished = false;
                this.beginDecodeTime = new Date().getTime();
                if (this.nowSouceNode) {
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
            }else{
                return {};
            }
            this.play = function() {
                if(!Player.audioInfo){
                    return;
                }
                var self = this;
                var nowSouceNode = Player.nowSouceNode;
                var audioContext = Player.audioContext;
                var audioInfo = Player.audioInfo;
                clearTimeout(Player.timeoutIds.playTimoutId);
                if (isIos) {
                    audio.play();
                }
                if (!Player.hasPlayed) {
                    if (!Player.totalBuffer || typeof Player.totalBuffer.dataBegin == undefined) {
                        Player.timeoutIds.playTimoutId = setTimeout(function() {
                            self.play();
                        }, 500);
                        return;
                    }
                    Player._play(Player.totalBuffer.dataBegin / Player.totalBuffer.length * audioInfo.totalTime);
                    playCb();
                } else if ((Player.pause == true || Player.finished) && !Player.waiting) {
                    if (Player.finished) {
                        Player._seek(0);
                    } else {
                        Player.pause = false;
                        if(Player.resumeTime!=-1){
                            Player._play(Player.resumeTime);
                        }else{
                            audioContext.resume();
                        }
                    }
                    playCb();
                }
            }
            this.pause = function() {
                if(!Player.audioInfo){
                    return;
                }
                Player.resumeTime = -1;
                Player.pause = true;
                Player.audioContext.suspend();
                clearTimeout(Player.timeoutIds.playTimoutId);
                pauseCb();
            }
            this.seek = function(percent) {
                percent = percent>>0;
                if(!Player.audioInfo){
                    return;
                }
                Player._seek(percent);
            }
            this.destory = function(){
                Player.audioContext.close();
            }
            AudioInfo.init(url,{
                decrypt: decrypt,
                loadedmetaCb: loadedmetaCb
            }).then(function(audioInfo){
                Player._init(audioInfo);
            });
        }
        return new _Player(_url, opt);
    }
    return Mp3Player;
})