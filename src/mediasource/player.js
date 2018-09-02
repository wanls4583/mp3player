import Audio from '../audio/index';
import requestRange from '../common/range';
import MP3Info from '../mp3info/mp3info';

var player = {
    /**
     * 初始化播放器
     * @param  {Object} opt 参数对象
     * @param  {String} opt.url 音频文件地址
     * @param  {Object} opt.audioInfo 音频信息对象
     * @param  {Audio} opt.audio audio文档对象
     */
    _init: function(opt) {
        this.url = opt.url; //mp3文件地址
        this.audioInfo = opt.audioInfo; //mp3文件信息
        this.audio = opt.audio;
        this.onbeforedecode = opt.onbeforedecode || function(){}; //解密函数
        this.fileSize = this.audioInfo.fileSize; //文件总大小
        this.blockSize = 1024 * 1024; //每次加载1M
        this.end = -1; //上个片段的末尾偏移量
        this.mimeCodec = 'audio/mpeg';
        this._generateBlob();
    },
    //生成blob对象
    _generateBlob: function() {
        var self = this;
        this.mediaSource = new MediaSource();
        this.audio.src = URL.createObjectURL(this.mediaSource);
        this.mediaSource.addEventListener('sourceopen', function() {
            if (self.mediaSource.readyState == 'open') {
                self.sourceBuffer = self.mediaSource.addSourceBuffer(self.mimeCodec);
                self.sourceBuffer.addEventListener('updateend', function() {
                    if (self.end >= self.fileSize - 1) {
                        self.mediaSource.endOfStream();
                    } else {
                        self._loadNext();
                    }
                })
                self._loadNext();
            }
        });
    },
    //下载下一个音频片段数据
    _loadNext: function() {
        var self = this;
        this.begin = this.end+1;
        this.end = this.begin + this.blockSize;
        if (this.begin == 0) {
            this.end += this.audioInfo.audioDataOffset;
        }
        if (this.end >= this.fileSize) {
            this.end = this.fileSize - 1;
        }
        requestRange(this.url, this.begin, this.end, {
            onsuccess: function(request) {
                var buffer = request.response;
                //数据解密
                self.onbeforedecode(buffer);
                self.sourceBuffer.appendBuffer(buffer);
            }
        });
    }
}

function Mp3Player(url, opt) {
    this.url = url;
    opt.audio = new window.Audio();
    this._init(opt);
    return new Audio(opt);
}

Mp3Player.prototype._init = function(opt) {
    var onloadedmetadata = opt.onloadedmetadata;
    var self = this;
    //on使用mediasource方式，Aduio对象的loadedmetadata事件可能获取不到时长，因此使用AudioInfo去回调loadedmetadata
    opt.onloadedmetadata = null;
    MP3Info.init(this.url, {
        onloadedmetadata: onloadedmetadata,
        onbeforedecode: opt.onbeforedecode
    }).then(function(audioInfo) {
        player._init({
            url: self.url,
            audioInfo: audioInfo,
            audio: opt.audio,
            onbeforedecode: opt.onbeforedecode
        });
        if (!audioInfo) {
            opt.errorCb && errorCb('parse audioInfo failed');
        }
    }).catch(function(e) {
        console.log(e);
        opt.errorCb && errorCb('load audioInfo failed');
    });
}

export default Mp3Player;