/**
 * 音频播放器模块
 * AudioContext wiki: https://developer.mozilla.org/zh-CN/docs/Web/API/AudioContext
 */


import requestRange from '../common/range';
import Util from '../common/util';
import BitStream from '../common/bitstream';
import Decoder from './decoder/decoder';
import MP3Info from '../mp3info/mp3info';

var indexSize = 100; //区块个数（根据时间平均分为100份,默认100）
var url = ''; //音频链接
var emptyUrl = ''; //空音频链接（用于触发IOS上音频播放）
var emptyCb = function() {};
var onbeforedecode = emptyCb;
var ontimeupdate = emptyCb;
var onplay = emptyCb;
var onpause = emptyCb;
var onwaiting = emptyCb;
var onplaying = emptyCb;
var onended = emptyCb;
var onloadedmetadata = emptyCb;
var onerror = emptyCb;
var maxDecodeSize = 0.1 * 1024 * 1024; // 最大解码字节长度(默认8M)
var isIos = navigator.userAgent.indexOf('iPhone') > -1;
var AudioInfo = null;
var audio = null;
if (isIos) {
    audio = new Audio();
    audio.src = opt.emptyUrl;
}

function Player() {
    this.timeoutIds = {
        decodeTimeoutId: null, //解码计时器
        updateIntervalId: null, //时间更新计时器
        playTimoutId: null, //播放计时器
        reloadTimeoutId: null //加载失败后重加载计时器
    }
}

Player.prototype._init = function(audioInfo) {
    var self = this;
    this.audioInfo = audioInfo; //音频信息
    this.bufferLength = 0; //音频全部解码后总大小
    this.audioContext = new(window.AudioContext || window.webkitAudioContext)(); //音频上下文对象
    this.audioContext.onstatechange = function() {
        if (self.audioContext) {
            if (self.audioContext.state != 'running') {
                self.isPlaying = false;
            }
            Util.log(self.audioContext.state);
        }

    }
    this.decoder = new Decoder();
    this.fileBlocks = new Array(100); //音频数据分区
    this.cacheFrameSize = 0; //每次加载的分区数
    this.indexSize = 100; //索引个数
    this.seeking = true; //是否正在索引
    this.totalBuffer = null; //音频资源节点队列
    this.nowSouceNode = null; //正在播放的资源节点
    this.loadingPromise = null; //数据加载异步对象集合
    if (audioInfo.fileSize / indexSize > 1024 * 1024) { //1/100总数据大小是否大于1M
        this.cacheFrameSize = 1;
    } else {
        this.cacheFrameSize = Math.ceil(1024 * 1024 / (audioInfo.fileSize / indexSize));
    }
    if (this.audioInfo) {
        this._decodeAudioData(0, this.cacheFrameSize, true, this.totalBuffer);
    }
}

//解码
Player.prototype._decodeAudioData = function(index, minSize, negative, beginDecodeTime) {
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
        var redoCount = 0;
        var arrayBuffer = result.arrayBuffer;
        var beginIndex = result.beginIndex;
        var endIndex = result.endIndex;
        if (negative) {
            self.decoder.kill();
        }
        self.decoder.decode({
            onsuccess: _onsuccess,
            onerror: _onerror,
            arrayBuffer: arrayBuffer,
            beginIndex: beginIndex,
            endIndex: endIndex
        });
        /**
         * 解码成功回调
         * @param  {AudioBuffer} buffer PCM数据
         */
        function _onsuccess(buffer) {
            //防止seek时，之前未完成的异步解码对新队列的影响
            if (beginDecodeTime != self.beginDecodeTime) {
                return;
            }
            if (!self.bufferLength) {
                self.bufferLength = Math.ceil(audioInfo.duration * buffer.sampleRate);
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
            Util.log('解码花费:', new Date().getTime() - decodeBeginTime, 'ms');
            if (self.seeking) {
                self.preBuffer = null;
                self.seeking = false;
                self.totalBuffer.dataOffset = self.totalBuffer.dataBegin = self.totalBuffer.dataEnd = (self.totalBuffer.length * result.beginIndex / indexSize) >> 0;
                self._copyPCMData(buffer);
                if (self.hasPlayed && !self.pause) {
                    self._play(self.totalBuffer.dataBegin / self.totalBuffer.length * audioInfo.duration);
                }
            } else {
                self._copyPCMData(buffer);
                if (self.waiting) {
                    self.waiting = false;
                    if (!self.pause) { //从等待状态唤醒
                        self.audioContext.resume();
                        onplaying();
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
        }
        //解码失败回调
        function _onerror() {
            if (beginDecodeTime != self.beginDecodeTime) {
                return;
            }
            //最多重试3次
            if (redoCount > 5) {
                return;
            }
            redoCount++;
            Util.log('decode fail...redo', redoCount);
            arrayBuffer = arrayBuffer.slice(100);
            arrayBuffer = self._fixFileBlock(arrayBuffer);
            self.decoder.decode({
                onsuccess: _onsuccess,
                onerror: _onerror,
                arrayBuffer: arrayBuffer,
                beginIndex: beginIndex,
                endIndex: endIndex
            });
        }

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
}

//复制PCM流
Player.prototype._copyPCMData = function(_buffer) {
    var offset = this.totalBuffer.dataOffset;
    for (var i = 0; i < _buffer.numberOfChannels; i++) {
        var cData = _buffer.getChannelData(i);
        if (cData.length + offset > this.totalBuffer.length) {
            cData = cData.slice(0, cData.length + offset - this.totalBuffer.length);
        }
        this.totalBuffer.getChannelData(i).set(cData, offset);
    }
    this.totalBuffer.dataEnd = offset + _buffer.length;

    //展示前后衔接处波形图，帮助分析
    // if (this.preBuffer) {
    //     var d1 = this.preBuffer.getChannelData(0).slice(-1152 * 2);
    //     var d2 = _buffer.getChannelData(0).slice(0, 1152 * 2);
    //     var ctx = document.querySelector('#canvas').getContext("2d");
    //     ctx.clearRect(0, 0, ctx.canvas.width, 200);
    //     ctx.beginPath();
    //     ctx.moveTo(0, 100);
    //     for (var i = 0; i < d1.length; i++) {
    //         var h = d1[i] * 100 + 100;
    //         ctx.lineTo(i, h);
    //     }
    //     ctx.strokeStyle = 'blue';
    //     ctx.stroke();
    //     ctx.closePath();

    //     ctx.beginPath();
    //     ctx.moveTo(d1.length - 1, h);
    //     for (var i = 0; i < d2.length; i++) {
    //         var h = d2[i] * 100 + 100;
    //         ctx.lineTo(i + d1.length, h);
    //     }
    //     ctx.strokeStyle = 'red';
    //     ctx.stroke();
    //     ctx.closePath();
    // }
    // this.preBuffer = _buffer;
}

//播放
Player.prototype._play = function(startTime) {
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
    this.isPlaying = true;
    Util.log('play');
}

//开始更新计时器
Player.prototype._startUpdateTimeoutId = function() {
    var self = this;
    clearInterval(this.timeoutIds.updateIntervalId);
    this.beginTime = this.audioContext.currentTime;
    this.timeoutIds.updateIntervalId = setInterval(function() {
        var time = self.audioContext.currentTime - self.beginTime;
        var currentTime = time + self.offsetTime;
        if (self.audioInfo.toc && currentTime > self.audioInfo.duration) {
            self._end();
        }
        if (Math.round(currentTime) > self.currentTime) {
            self.currentTime = Math.round(currentTime);
            ontimeupdate(self.currentTime); //时间更新计时器回调
        }
        //等待数据解码
        if (!self.waiting && self.totalBuffer.endIndex < indexSize - 1 && (currentTime + 2) * self.sampleRate > self.totalBuffer.dataEnd) {
            self.waiting = true;
            self.audioContext.suspend();
            onwaiting();
        }
    }, 1000);
}

Player.prototype._end = function() {
    this.nowSouceNode.disconnect();
    this.finished = true; //播放结束标识
    this._clearTimeout();
    this.audioContext.suspend();
    onended();
}

//获取数据帧
Player.prototype._loadFrame = function(index, minSize, negative) {
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
                onbeforedecode(arrayBuffer);
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
                self.timeoutIds.reloadTimeoutId = setTimeout(function() { //1秒后重新加载
                    self.loadingPromise = self._loadFrame(index, minSize, negative);
                    self.loadingPromise.then(function() {
                        resolve(self._joinNextCachedFileBlock(index, originMinSize, negative));
                    });
                }, 1000)
            },
            onerror: function(e) {
                clearTimeout(self.timeoutIds.reloadTimeoutId);
                self.timeoutIds.reloadTimeoutId = setTimeout(function() { //1秒后重新加载
                    self.loadingPromise = self._loadFrame(index, minSize, negative);
                    self.loadingPromise.then(function() {
                        resolve(self._joinNextCachedFileBlock(index, originMinSize, negative));
                    });
                }, 1000)
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
}

//合并index索引之后所有连续的已经缓存过的分区
Player.prototype._joinNextCachedFileBlock = function(index, minSize, negative) {
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
    //删除头部和尾部损坏数据
    if (negative) {
        result = this._fixFileBlock(result);
    }
    Util.log('join花费:', new Date().getTime() - joinBegin, 'ms');
    return {
        exceed: exceed,
        arrayBuffer: result,
        beginIndex: index,
        endIndex: endIndex
    }
}

//根据索引号，找到实际的音频数据字节位置
Player.prototype._getRangeBeginByIndex = function(index) {
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
}

/**
 * 修复数据块头尾损坏数据（分割后，头部数据可能不是数据帧的帧头开始，需要修复）
 * @param  {ArrayBuffer} arrayBuffer  源数据
 * @return {ArrayBuffer}              修复后的数据
 */
Player.prototype._fixFileBlock = function(arrayBuffer) {
    var frameSync = this.audioInfo.frameSync;
    //删除帧头部多余数据
    var begeinExtraLength = Util.getLengthByFrameSync(arrayBuffer, frameSync, 0);
    arrayBuffer = arrayBuffer.slice(begeinExtraLength);
    begeinExtraLength = Util.getLengthByFrameSync(arrayBuffer, frameSync, 4);
    var mainDataOffset = _getMainDataOffset(arrayBuffer)
    //下一帧主数据偏移量大于上一帧总长度，说明上一帧为无效帧
    if (mainDataOffset >= begeinExtraLength) {
        return this._fixFileBlock(arrayBuffer.slice(begeinExtraLength));
    }
    var u8a = new Uint8Array(arrayBuffer);
    //第一帧数据清零
    for (var i = 4; i < begeinExtraLength - mainDataOffset; i++) {
        u8a[i] = 0;
    }
    return arrayBuffer;

    //获取mainData偏移量
    function _getMainDataOffset(arrayBuffer) {
        var mainDataOffset = 0;
        //下一帧开始偏移量
        var begeinExtraLength = Util.getLengthByFrameSync(arrayBuffer, frameSync, 4);
        var bitstream = new BitStream(arrayBuffer.slice(begeinExtraLength));
        var mainDataOffset = 0;
        bitstream.skipBits(32);
        //主数据负偏移量
        mainDataOffset = bitstream.getBits(9);
        return mainDataOffset;
    }
}

//跳转某个索引
Player.prototype._seek = function(index) {
    var self = this;
    var audioInfo = this.audioInfo;
    if (index >= indexSize) {
        index = indexSize - 1;
    }
    if (this.waiting) {
        this.waiting = false;
        onplaying();
    }
    if (this.totalBuffer) {
        var begin = this.totalBuffer.length * index / indexSize;
        var startTime = index / indexSize * audioInfo.duration;
        if (begin > this.totalBuffer.dataBegin && begin + 5 * this.sampleRate < this.totalBuffer.dataEnd) {
            if (this.pause) {
                this.resumeTime = startTime;
            } else {
                clearInterval(this.timeoutIds.updateIntervalId);
                clearTimeout(this.timeoutIds.playTimoutId);
                this._play(startTime);
            }
            return;
        } else if (this.pause) {
            this.resumeTime = -1;
            this.hasPlayed = false;
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
}

//清除所有计时器
Player.prototype._clearTimeout = function() {
    clearTimeout(this.timeoutIds.decodeTimeoutId);
    clearInterval(this.timeoutIds.updateIntervalId);
    clearTimeout(this.timeoutIds.playTimoutId);
    clearTimeout(this.timeoutIds.reloadTimeoutId);
}

function Mp3Player(_url, opt) {
    url = _url;
    this.player = new Player();
    this._init(opt);
}

Mp3Player.prototype._init = function(opt) {
    var self = this;
    onbeforedecode = opt.onbeforedecode || emptyCb;
    ontimeupdate = opt.ontimeupdate || emptyCb;
    onplay = opt.onplay || emptyCb;
    onpause = opt.onpause || emptyCb;
    onwaiting = opt.onwaiting || emptyCb;
    onplaying = opt.onplaying || emptyCb;
    onended = opt.onended || emptyCb;
    onloadedmetadata = opt.onloadedmetadata || emptyCb;
    onerror = opt.onerror || emptyCb;
    MP3Info.init(url, {
        onbeforedecode: onbeforedecode,
        onloadedmetadata: onloadedmetadata
    }).then(function(audioInfo) {
        self.player._init(audioInfo);
        if (!audioInfo) {
            onerror();
            self.player.error = 'parse audioInfo failed';
        }
    }).catch(function(e) {
        self.player.error = 'load audioInfo failed';
        console.log(e);
        onerror();
    });
}

Mp3Player.prototype.play = function() {
    if (this.player.error) {
        onerror();
        return;
    } else if (!this.clickPlayTime) {
        this.player.waiting = false;
        this.clickPlayTime = new Date().getTime();
    } else if (this.player.audioInfo === false || new Date().getTime() - this.player.clickPlayTime > 5000 && !this.player.audioInfo) {
        this.clickPlayTime = 0;
        return;
    }
    var self = this;
    var nowSouceNode = this.player.nowSouceNode;
    var audioContext = this.player.audioContext;
    var audioInfo = this.player.audioInfo;
    clearTimeout(this.player.timeoutIds.playTimoutId);
    //ios需要手动触发音频设备
    if (isIos && !this.hasClick) {
        audio.play();
        this.hasClick = true;
    }
    if (!this.player.hasPlayed) {
        if (!this.player.totalBuffer || typeof this.player.totalBuffer.dataBegin == undefined) {
            if (!this.player.waiting) {
                this.player.waiting = true;
                onwaiting();
            }
            this.player.timeoutIds.playTimoutId = setTimeout(function() {
                self.play();
            }, 500);
            return;
        }
        if (this.player.waiting) {
            this.player.waiting = false;
            onplaying();
        }
        this.player._play(this.player.totalBuffer.dataBegin / this.player.totalBuffer.length * audioInfo.duration);
        this.player.pause = false;
        onplay();
    } else if ((this.player.pause == true || this.player.finished) && !this.player.waiting) {
        if (this.player.finished) {
            this.player._seek(0);
        } else {
            this.player.pause = false;
            if (this.player.resumeTime != -1) {
                this.player._play(this.player.resumeTime);
            } else {
                audioContext.resume();
            }
        }
        onplay();
    }
}

Mp3Player.prototype.pause = function() {
    onpause();
    this.player.resumeTime = -1;
    this.player.pause = true;
    this.player.waiting = false;
    if (this.player.audioContext) {
        this.player.audioContext.suspend();
    }
    clearTimeout(this.player.timeoutIds.playTimoutId);
}

Mp3Player.prototype.seek = function(percent) {
    percent = percent >> 0;
    if (!this.player.audioInfo) {
        return false;
    }
    this.player._seek(percent);
    return true;
}

Mp3Player.prototype.destory = function() {
    this.player._clearTimeout();
    if (this.player.audioContext) {
        this.player.audioContext.close();
        this.player.audioContext = null;
    }
}

Mp3Player.prototype.isPlaying = function() {
    return this.player.isPlaying;
}

export default Mp3Player;