import Frame from './frame';
import Synth from './synth';
import Stream from './stream';
import BufferStream from './bufferStream';
import SubStream from './substream';
import Mad from './global';

var Decoder = function() {
    this.decodeQue = [];
};
/**
 * 重置解码器
 * @param           {Object}  opt   参数
 * opt.onsuccess    {Function}      成功回调
 * opt.ArrayBuffer  {ArrayBuffer}   音频数据
 * opt.beginIndex   {Number}        开始片段索引
 * opt.endIndex     {Number}        结束片段索引
 * @return          {Boolean}       是否重置成功
 */
Decoder.prototype.reset = function(opt) {
    this.createMpegStream(opt);
    this.onsuccess = opt.onsuccess;
    this.onerror = opt.onerror;
    if (!this.channelCount) {
        this.frame = Frame.decode(this.frame, this.mpeg);
        if (this.frame == null) {
            this.kill();
            console.log('error_reset');
            if (this.mpeg.error == Mad.Error.BUFLEN) {
                this.mpeg = null;
                this.stream = null;
                console.log("End of file!");
            } else {
                this.stream = null;
                this.mpeg = null;
                this.onerror && this.onerror();
            }
            return false;
        }
        this.synth = new Synth();
        this.channelCount = this.frame.header.nchannels();
        this.sampleRate = this.frame.header.samplerate;
        this.synth.frame(this.frame);
    }
    return true;
};
/**
 * 解码音频数据
 * @param           {Object}  opt   参数
 * opt.onsuccess    {Function}      成功回调
 * opt.ArrayBuffer  {ArrayBuffer}   音频数据
 * opt.beginIndex   {Number}        开始片段索引
 * opt.endIndex     {Number}        结束片段索引
 * @return          {Array}         PCM数据
 */
Decoder.prototype.decode = function(opt) {
    var buffer = null,
        startTime = Date.now(),
        self = this;
    if (this.decoding) {
        this.decodeQue.push(opt);
        return;
    }
    if (this.reset(opt)) {
        buffer = new Mp3AudioBuffer(this.channelCount, this.sampleRate);
        buffer.length = 0;
        _decode();
    }


    function _decode() {
        self.decoding = true;
        //一次最多解码200帧，防止浏览器阻塞
        for (var i = 0; i < 20; i++) {
            if (self.mpeg.bufend - self.mpeg.next_frame <= (self.mpeg.next_frame - self.mpeg.this_frame) * 4) {
                buffer.duration = buffer.length / buffer.sampleRate;
                // console.log('success_decode', buffer.length);
                self.onsuccess && self.onsuccess(buffer);
                _compelete();
                buffer = null;
                return;
            } else {
                self.frame = Frame.decode(self.frame, self.mpeg);
                if (self.frame) {
                    self.synth.frame(self.frame);
                    for (var ch = 0; ch < self.channelCount; ++ch) {
                        buffer.samples[ch] = buffer.samples[ch].concat(self.synth.pcm.samples[ch]);
                    }
                    buffer.length += self.synth.pcm.samples[0].length;
                } else {
                    buffer = null;
                    self.kill();
                    console.log('error_decode');
                    self.onerror && self.onerror();
                    return;
                }
            }
        }
        //解码剩余的数据
        self.decodeTimmer = setTimeout(function() {
            _decode();
        }, 0);
    }
    //当前音频片段解码完成
    function _compelete() {
        clearTimeout(self.decodeTimmer);
        self.decoding = false;
        // console.log('cost', Date.now() - startTime, 'ms', 'duration', buffer.duration);
        if (self.decodeQue.length) {
            self.decode(self.decodeQue.shift());
        }
    }
};

/**
 * 解码音频数据
 * @param           {Object}  opt   参数
 * opt.ArrayBuffer  {ArrayBuffer}   音频数据
 * opt.beginIndex   {Number}        开始片段索引
 * opt.endIndex     {Number}        结束片段索引
 */
Decoder.prototype.createMpegStream = function(opt) {
    var beginIndex = opt.beginIndex;
    var endIndex = opt.endIndex;
    var arrayBuffer = opt.arrayBuffer;
    //接着上个片段继续解码
    if (this.mpeg && this.endIndex + 1 == beginIndex) {
        var oldBuffer = this.stream.state['arrayBuffer'];
        var newBuffer = new ArrayBuffer(oldBuffer.byteLength + arrayBuffer.byteLength);
        var uint8Array = new Uint8Array(newBuffer);
        uint8Array.set(new Uint8Array(oldBuffer), 0);
        uint8Array.set(new Uint8Array(arrayBuffer), oldBuffer.byteLength);
        var stream = new BufferStream(newBuffer);
        this.stream = stream;
        stream = new SubStream(stream, 0, newBuffer.byteLength);
        this.mpeg.bufend = newBuffer.byteLength;
        this.mpeg.stream = stream;
        this.mpeg.anc_ptr.stream = stream;
        this.mpeg.ptr.stream = stream;
    } else {
        this.stream = new BufferStream(arrayBuffer);
        this.mpeg = new Stream(new SubStream(this.stream, 0, this.stream.state['amountRead']));
        this.frame = new Frame();
        this.channelCount = 0;
    }
    this.endIndex = endIndex;
}

/**
 * 停止当前音频片段的解码
 */
Decoder.prototype.kill = function() {
    clearTimeout(this.decodeTimmer);
    this.decoding = false;
    this.decodeQue = [];
}

/**
 * 模拟AudioBuffer对象
 * @param {Number} channelCount 声道数量
 * @param {Number} sampleRate   采样率
 */
function Mp3AudioBuffer(channelCount, sampleRate) {
    this.samples = [];
    this.numberOfChannels = channelCount;
    this.sampleRate = sampleRate;
    for (var i = 0; i < channelCount; i++) {
        this.samples[i] = [];
    }
}

/**
 * 获取单个声道PCM数据
 * @param  {Number}      channel  声道
 * @return {Float32Array}         PCM数据
 */
Mp3AudioBuffer.prototype.getChannelData = function(channel) {
    return this.samples[channel];
}

export default Decoder;