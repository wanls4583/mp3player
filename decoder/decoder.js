Mad.Decoder = function() {
    this.decodeQue = [];
};
/**
 * 重置解码器
 * @return {Boolean} 是否重置成功
 */
Mad.Decoder.prototype.reset = function() {
    this.mpeg = new Mad.Stream(new Mad.SubStream(this.stream, 0, this.stream.state['amountRead']));
    this.synth = new Mad.Synth();
    this.frame = new Mad.Frame();
    for (var i = 0; this.frame && i < this.skipFrames; i++) {
        this.frame = Mad.Frame.decode(this.frame, this.mpeg);
    }
    if (this.frame == null) {
        if (this.mpeg.error == Mad.Error.BUFLEN) {
            console.log("End of file!");
        }
        return false;
    }
    //mp3前后数据帧有关联
    if (this.skipFrames > 0 && this.overlap) {
        this.frame.overlap = this.overlap;
    }
    this.frame = Mad.Frame.decode(this.frame, this.mpeg);
    if (this.frame == null) {
        if (this.mpeg.error == Mad.Error.BUFLEN) {
            console.log("End of file!");
        }
        return false;
    }
    this.channelCount = this.frame.header.nchannels();
    this.sampleRate = this.frame.header.samplerate;
    this.offset = 0;
    this.absoluteFrameIndex = 0;
    this.synth.frame(this.frame);
    return true;
};
/**
 * 解码音频数据
 * @param           {Object}  opt   参数
 * opt.callback     {Function}      成功回调
 * opt.skipFrames   {Number}        头部需要跳过多少帧
 * opt.ArrayBuffer  {ArrayBuffer}   音频数据
 * @return          {Array}         PCM数据
 */
Mad.Decoder.prototype.decode = function(opt) {
    var buffer = null,
        self = this;
    if (this.decoding) {
        this.decodeQue.push(opt);
        return;
    }
    this.stream = new Mad.BufferStream(opt.arrayBuffer);
    this.callback = opt.callback;
    this.skipFrames = opt.skipFrames || 0;
    if (!this.reset()) {
        //数该段据错误，继续解码队列中的音频数据
        if (this.decodeQue.length) {
            this.decode(this.decodeQue.shift());
        }
        return;
    }
    buffer = new Mp3AudioBuffer(this.channelCount, this.sampleRate);
    buffer.length = 0;

    _decode();

    function _decode() {
        self.decoding = true;
        //一次最多解码200帧，防止浏览器阻塞
        for (var i = 0; i < 200; i++) {
            for (var ch = 0; ch < self.channelCount; ++ch) {
                buffer.samples[ch] = buffer.samples[ch].concat(self.synth.pcm.samples[ch]);
            }
            buffer.length += self.synth.pcm.samples[0].length;
            self.frame = Mad.Frame.decode(self.frame, self.mpeg);
            if (self.frame == null) {
                self.mpeg = null;
                self.stream = null;
                buffer.duration = buffer.length / buffer.sampleRate;
                self.callback && self.callback(buffer);
                self.decoding = false;
                if (self.decodeQue.length) {
                    self.decode(self.decodeQue.shift());
                }
                return;
            } else {
                self.synth.frame(self.frame);
                self.absoluteFrameIndex++;
                self.overlap = self.frame.overlap;
            }
        }
        //解码剩余的数据
        setTimeout(function() {
            _decode();
        }, 10);
    }
};

function Mp3AudioBuffer(channelCount, sampleRate){
    this.samples = [];
    this.numberOfChannels = channelCount;
    this.sampleRate = sampleRate;
    for(var i=0; i<channelCount; i++){
        this.samples[i] = [];
    }
}

Mp3AudioBuffer.prototype.getChannelData  = function(channel){
    return this.samples[channel];
}