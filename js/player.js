/**
 * 音频播放器模块
 * AudioContext wiki: https://developer.mozilla.org/zh-CN/docs/Web/API/AudioContext
 */
define(function(require, exports, module) {
    'use strict';

    var requestRange = require('./common/range');
    var Util = require('./common/util');

    function Player(_url, opt) {
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
        var errorCb = emptyCb; //错误回调
        var maxDecodeSize = 5 * 1024 * 1024; // 最大解码字节长度(默认5M)
        var endFrameSize = 8; //尾部保留帧数（MP3音频解码时前后帧有关联）
        var frameDuration = 0; //一帧的时长
        var isIos = navigator.userAgent.indexOf('iPhone') > -1;
        var AudioInfo = null;
        var audio = null;
        if (isIos) {
            audio = new Audio();
            audio.src = opt.emptyUrl;
        }
        //音频播放对象
        var _playerObj = {
            _init: function(audioInfo) {
                var self = this;
                this.audioInfo = audioInfo; //音频信息
                this.bufferLength = 0; //音频全部解码后总大小
                this.audioContext = window.audioContext ? window.audioContext : (window.audioContext = new(window.AudioContext || window.webkitAudioContext)()); //音频上下文对象
                this.audioContext.onstatechange = function() {
                    if(self.audioContext){
                        if(self.audioContext.state!='running'){
                            self.isPlaying = false;
                        }else{
                            self.isPlaying = true;
                        }
                        Util.log(self.audioContext.state);
                    }
                    
                }
                this.fileBlocks = new Array(100); //音频数据分区
                this.firstLoadSize = 0; //首次加载的分区数
                this.indexSize = 100; //索引个数
                this.seeking = false; //是否正在索引
                this.pause = true; //是否暂停
                this.nowSouceNode = null; //正在播放的资源节点
                this.loadingPromise = null; //数据加载异步对象集合
                frameDuration = 1152/audioInfo.sampleRate;
                if(audioInfo.fileSize/indexSize > 1024 * 1024 / 2){ //1/100总数据大小是否大于1/2M
                    this.firstLoadSize = 1;
                }else{
                    this.firstLoadSize = Math.ceil(1024 * 1024 / 2 / (audioInfo.fileSize/indexSize));
                }
                if(this.audioInfo){
                    this.beginDecodeTime = new Date().getTime();
                    this._decodeAudioData(0, this.firstLoadSize, true, this.beginDecodeTime);
                }
            },
            //计时器
            _timeoutIds: {
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
                return this._loadFrame(index, minSize, negative, true).then(function(result) {
                    if (beginDecodeTime != self.beginDecodeTime || !result) { //see时强制停止
                        return false;
                    }
                    Util.log('解码:' + result.beginIndex + ',' + result.endIndex);
                    if (Util.ifDebug()) {
                        var decodeBeginTime = new Date().getTime();
                    }
                    self.audioContext.decodeAudioData(result.arrayBuffer,function(buffer) {
                        if (beginDecodeTime != self.beginDecodeTime) { //防止seek时，之前未完成的异步解码对新队列的影响
                            return;
                        }
                        if (Util.ifDebug()) {
                            Util.log('解码花费:', new Date().getTime() - decodeBeginTime, 'ms', 'duration', buffer.duration);
                        }
                        self.endIndex = result.endIndex;
                        self.beginIndex = result.beginIndex;
                        // var del = (1152*buffer.sampleRate/self.audioInfo.sampleRate)>>0; //去掉前两帧
                        // var tmp = self.audioContext.createBuffer(buffer.numberOfChannels, buffer.length - del*2, buffer.sampleRate);
                        // for(var i=0; i<buffer.numberOfChannels; i++){
                        //     tmp.getChannelData(i).set(buffer.getChannelData(i).slice(del*2), 0);
                        // }
                        self.nextBuffer = buffer;
                        if(self.seeking || self.waiting){ //从seek或等待状态切换到播放
                            if(self.waiting){
                                self.waiting = false;
                                if(!self.pause){
                                    playingCb();
                                }
                            }
                            self._play(0);
                            self.seeking = false;
                        }
                    },function(e){
                        Util.log(index, "解码失败", e);
                        if(minSize>1){
                            minSize--;
                        }
                        self._decodeAudioData(index+1, minSize, negative, beginDecodeTime);
                    });

                    return result;
                });
            },
            //播放
            _play: function(startTime) {
                var self = this;
                if(startTime<0){
                    startTime = 0;
                }
                this.currentTime = Math.round(this.offsetTime);
                var sourceNode = this.audioContext.createBufferSource();
                var index = this.endIndex;
                sourceNode.buffer = this.nextBuffer;
                this.nowBuffer = this.nextBuffer;
                this.nextBuffer = null;
                sourceNode.connect(this.audioContext.destination);
                sourceNode.onended = function() { //播放一段音频后立马播放下一段音频
                    sourceNode.disconnect();
                    if(index >= indexSize-1){
                        self.finished = true; //播放结束标识
                        self._clearTimeout();
                        if(self.audioContext.state=='running'){ //防止连续调用两次suspend
                            self.audioContext.suspend();
                        }
                        self._decodeAudioData(0, self.firstLoadSize, true, self.beginDecodeTime); //为下次播放做准备
                        endCb(); //结束回调
                    }else{
                        if(self.nextBuffer){
                            if (Util.ifDebug()) {
                                Util.log('next');
                            }
                            self._play(self.fileBlocks[self.beginIndex-1].delLength*2/self.nowBuffer.sampleRate-frameDuration);
                        }else if(!self.waiting){
                            self.waiting = true;
                            if(self.audioContext.state=='running'){ //防止连续调用两次suspend
                                self.audioContext.suspend();
                            }
                            if(!self.pause){
                                waitingCb();
                            }
                        }
                    }
                }

                if (sourceNode.start) {
                    sourceNode.start(0, startTime);
                } else {
                    sourceNode.noteOn(0, startTime);
                }

                if (this.audioContext.state == 'suspended' && !this.pause) {
                    this.audioContext.resume();
                }else if(this.pause){
                    if(this.audioContext.state=='running'){ //防止连续调用两次suspend
                        this.audioContext.suspend();
                    }
                }

                self._timeoutIds.decodeTimeoutId = setTimeout(function(){ //播放到一半时开始获取和解码下一段音频
                    var size = self.firstLoadSize*4; //解码数据长度为seek或者第一次播放时的4倍
                    if(size/indexSize*self.audioInfo.fileSize > maxDecodeSize){ //如果超出最多解码长度
                        size = (maxDecodeSize/(self.audioInfo.fileSize/indexSize*self.firstLoadSize))>>0;
                    }
                    self.beginDecodeTime = new Date().getTime();
                    if (self.loadingPromise) { //是否有数据正在加载
                        self.loadingPromise.stopNextLoad = true; //停止自动加载下一段
                        self.loadingPromise.then(function() {
                            self._decodeAudioData(self.endIndex + 1, size, null, self.beginDecodeTime);
                        });
                    }else{
                        self._decodeAudioData(self.endIndex + 1, size, null, self.beginDecodeTime);
                    }
                }, sourceNode.buffer.duration/2*1000);

                this.nowSouceNode = sourceNode;
                this.offsetTime = this.currentTime = this.beginIndex/indexSize*this.audioInfo.totalTime; //开始计时偏移量
                this._startUpdateTimeoutId(); //开始计时
                this.hasPlayed = true; //已经开始播放

                // setTimeout(function(){ //ios状态变更有延迟
                //     if(self.audioContext.state != 'running' && !self.pause){ //ios需要手动触发
                //         self.pause = true;
                //         pauseCb();
                //         clearTimeout(self._timeoutIds.playTimoutId);
                //     }
                // },10);
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
                    if(this.pause){
                        playingCb();
                    }
                }
                this._clearTimeout();
                this.seeking = true;
                this.finished = false;
                this.beginDecodeTime = new Date().getTime();
                if (this.nowSouceNode) {
                    this.nowSouceNode.disconnect();
                }
                if(!this.waiting){
                    this.waiting = true;
                    if(!this.pause){
                        waitingCb();
                    }
                }
                if (this.loadingPromise) { //是否有数据正在加载
                    this.loadingPromise.then(function() {
                        self._decodeAudioData(index, self.firstLoadSize, true, self.beginDecodeTime);
                    });
                    this.request.abort(); //强制中断下载
                } else {
                    this._decodeAudioData(index, this.firstLoadSize, true, this.beginDecodeTime);
                }
            },
            //开始更新计时器
            _startUpdateTimeoutId: function() {
                var self = this;
                clearInterval(this._timeoutIds.updateIntervalId);
                this.beginTime = this.audioContext.currentTime;
                this._timeoutIds.updateIntervalId = setInterval(function() {
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
            //获取数据帧
            _loadFrame: function(index, minSize, negative, join) {
                var self = this;
                var begin = 0; //数据下载开始索引
                var end = 0; //数据下载结束索引
                var cached = true;
                var beginIndex = index; //避免网络加载重复数据
                var endIndex = 0;
                var originMinSize = minSize; //保存初始最小加载数量
                var audioInfo = this.audioInfo;
                beginIndex = index = index >= indexSize ? indexSize - 1 : index;
                if (index + minSize > indexSize) {
                    minSize = indexSize - index;
                }
                //防止头部加载重复数据
                for (var i = index; i < index + minSize; i++) {
                    if (this.fileBlocks[i]) {
                        minSize--;
                    }else{
                        cached = false;
                        beginIndex = i;
                        break;
                    }
                }
                //对应索引区数据已经缓存
                if (cached) {
                    if(join){
                        var result = this._joinNextCachedFileBlock(index, originMinSize, negative); //合并index索引之后的区块
                        if (result.endIndex < indexSize - 1) {
                            this._loadFrame(result.endIndex + 1, this.firstLoadSize*4); //加载下一段音频
                        }
                        return Promise.resolve(result);
                    }else{
                        return Promise.resolve(false);
                    }
                }
                //防止尾部加载重复数据
                var i = beginIndex + minSize - 1;
                for (; i > beginIndex; i--) {
                    if (this.fileBlocks[i]) {
                        minSize--;
                    } else {
                        break;
                    }
                }
                begin = this._getRangeBeginByIndex(beginIndex); //Rnage开始偏移量
                end = this._getRangeBeginByIndex(beginIndex + minSize) - 1; //Range结束偏移量
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
                            decrypt(arrayBuffer).then(function(){
                                //缓存数据块
                                var arr = new Uint8Array(arrayBuffer);
                                for (var i = beginIndex; i < beginIndex + minSize; i++) {
                                    if (audioInfo.toc) { //VBR编码模式
                                        if (i + 1 == beginIndex + minSize) {
                                            end = arrayBuffer.byteLength;
                                        } else {
                                            end = (begin + (self._getRangeBeginByIndex(i + 1) - self._getRangeBeginByIndex(i))) >> 0;
                                        }
                                        self.fileBlocks[i] = arrayBuffer.slice(begin, end);
                                        begin = end;
                                    } else { //CBR编码模式
                                        if (i + 1 == beginIndex + minSize) {
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
                                    if(index + originMinSize < indexSize){
                                        setTimeout(function() {
                                            self._loadFrame(index + originMinSize, self.firstLoadSize*4);
                                        }, 0)
                                    }
                                }
                                self.loadingPromise = null;
                                if(join){ //是否合并
                                    resolve(self._joinNextCachedFileBlock(index, originMinSize, negative));
                                }else{
                                    resolve(false);
                                }
                            });
                        },
                        ontimeout: function() {
                            _reload();
                        },
                        onerror: function(e) {
                            _reload();
                        },
                        onabort: function(e) {
                            reject('abort');
                        }
                    });

                    function _reload(){
                        clearTimeout(self._timeoutIds.reloadTimeoutId);
                        self._timeoutIds.reloadTimeoutId = setTimeout(function(){ //1秒后重新加载
                            self.loadingPromise = self._loadFrame(index, minSize, negative);
                            self.loadingPromise.then(function() {
                                resolve(self._joinNextCachedFileBlock(index, originMinSize, negative));
                            });
                        },1000)
                    } 
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
                var uint8Array = null;
                var result = null;
                var endIndex = index;
                var indexLength = this.fileBlocks.length;
                var exceed = false; //是否超过了最大解码长度

                endIndex = index = index >= indexSize ? indexSize - 1 : index;
                if (index + minSize > indexSize) {
                    minSize = indexSize - index;
                }
                if (Util.ifDebug()) {
                    var joinBegin = new Date().getTime();
                    Util.log('join', index);
                }

                //开始播放或者seek时只返回minSize个数据块
                if (negative) {
                    indexLength = index + minSize;
                }
                for (var i = index; i < indexLength && this.fileBlocks[i]; i++) {
                    endIndex = i;
                    length += this.fileBlocks[i].byteLength; //累计字节长度
                    if (length >= maxDecodeSize) { //超出最大解码长度
                        exceed = true;
                        break;
                    }
                }
                result = new ArrayBuffer(length);
                uint8Array = new Uint8Array(result);
                length = 0;
                for (i = index; i <= endIndex && this.fileBlocks[i]; i++) {
                    uint8Array.set(new Uint8Array(this.fileBlocks[i]), length);
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
                if(index==0){
                    result = this._fixFileBlock(result, index, endIndex, false, false, 4, endFrameSize);
                }else{
                    result = this._fixFileBlock(result, index, endIndex, false, false, 0, endFrameSize);
                }
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
                    var endExtraLength = Util.getLengthByFrameSync(result, this.audioInfo.frameSync, null, true, endFrameSize);
                    this.fileBlocks[endIndex].delLength = 0;
                    if (endExtraLength) { //存储endFrameSize个帧给接下来的帧使用
                        this.fileBlocks[endIndex].rightDeledData = result.slice(result.byteLength - endExtraLength);
                        endExtraLength = Util.getLengthByFrameSync(this.fileBlocks[endIndex].rightDeledData, this.audioInfo.frameSync, null, true, 1);
                        this.fileBlocks[endIndex].delLength = this.fileBlocks[endIndex].rightDeledData.byteLength - endExtraLength;
                    }
                    endExtraLength = Util.getLengthByFrameSync(result, this.audioInfo.frameSync, null, true, 1);
                    if (endExtraLength) { //删除尾部不完整的一帧数据
                        result = result.slice(0, result.byteLength - endExtraLength);
                    }
                    
                }
                return result;

            },
            //清除所有计时器
            _clearTimeout: function() {
                clearTimeout(this._timeoutIds.decodeTimeoutId);
                clearInterval(this._timeoutIds.updateIntervalId);
                clearTimeout(this._timeoutIds.playTimoutId);
                clearTimeout(this._timeoutIds.reloadTimeoutId);
            },
            //ios解锁audioContext
            _unlock: function(){
                var oscillator = this.audioContext.createOscillator();
                oscillator.frequency.value = 400;
                oscillator.connect(this.audioContext.destination);
                oscillator.start(0);
                oscillator.stop(0);
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
                if (typeof opt.errorCb == 'function') {
                    errorCb = opt.errorCb;
                }
            }else{
                return {};
            }
            this.play = function() {
                if(_playerObj.error){
                    errorCb();
                    return;
                }else if(!this.clickPlayTime){
                    this.clickPlayTime = new Date().getTime();
                }else if(_playerObj.audioInfo === false || new Date().getTime() - this.clickPlayTime > 5000 && !_playerObj.audioInfo){
                    this.clickPlayTime = 0;
                    return;
                }
                var self = this;
                var nowSouceNode = _playerObj.nowSouceNode;
                var audioContext = _playerObj.audioContext;
                var audioInfo = _playerObj.audioInfo;
                clearTimeout(_playerObj._timeoutIds.playTimoutId);
                if (isIos && !window.hasClick) { //ios触发声音设备
                    audio.addEventListener('timeupdate',function(){
                        audio.pause();
                    });
                    audio.play();
                    if(!_playerObj.audioContext){
                        _playerObj.audioContext = window.audioContext ? window.audioContext : (window.audioContext = new(window.AudioContext || window.webkitAudioContext)());
                    }
                    _playerObj._unlock();
                    window.hasClick = true;
                }
                if (!_playerObj.hasPlayed) { //seek后第一次播放或者音频首次加载后第一次播放
                    _playerObj.pause = false; //取消暂停状态
                    if (!_playerObj.nextBuffer) { //等待解码
                        if(!_playerObj.waiting){
                            _playerObj.waiting = true;
                            waitingCb();
                        }
                        _playerObj._timeoutIds.playTimoutId = setTimeout(function() { //点击播放计时器
                            self.play();
                        }, 500);
                        return;
                    }
                    playCb(); //播放回调
                    _playerObj._play(0); //播放
                } else if ((_playerObj.pause == true || _playerObj.finished) && !_playerObj.waiting) { //从暂停或等待中切换到播放
                    if (_playerObj.finished) {
                        _playerObj._seek(0);
                    } else {
                        _playerObj.pause = false;
                        audioContext.resume(); //唤醒播放设备
                    }
                    playCb(); //播放回调
                }
            }
            this.pause = function() {
                pauseCb();
                _playerObj.pause = true;
                _playerObj.waiting = false;
                if(_playerObj.audioContext){
                    if(_playerObj.audioContext.state=='running'){ //防止连续调用两次suspend
                        _playerObj.audioContext.suspend();
                    }
                }
                clearTimeout(_playerObj._timeoutIds.playTimoutId);
            }
            this.seek = function(percent) {
                percent = percent>>0;
                if(!_playerObj.audioInfo){
                    return false;
                }
                _playerObj._seek(percent);
                return true;
            }
            this.destory = function(){
                _playerObj._clearTimeout();
                if(_playerObj.nowSouceNode){
                    _playerObj.nowSouceNode.disconnect();
                }
                if(_playerObj.audioContext){
                    if(_playerObj.audioContext.state=='running'){ //防止连续调用两次suspend
                        _playerObj.audioContext.suspend();
                    }
                    _playerObj.audioContext = null;
                }
                if (_playerObj.loadingPromise) { //是否有数据正在加载
                    _playerObj.request.abort(); //强制中断下载
                }
                this.closed = true;
            }
            this.isPlaying = function(){
                return _playerObj.isPlaying;
            }
            AudioInfo.init(url,{
                decrypt: decrypt,
                loadedmetaCb: loadedmetaCb
            }).then(function(audioInfo){
                _playerObj._init(audioInfo);
                if(!audioInfo){
                    errorCb();
                    _playerObj.error = 'parse audioInfo failed';
                }
            }).catch(function(){
                _playerObj.error = 'load audioInfo failed';
                errorCb();
            })
        }
        return new _Player(_url, opt);
    }
    return Player;
})