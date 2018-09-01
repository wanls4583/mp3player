/**
 * MP3音频ID3标签信息模块
 * http://wiki.hydrogenaud.io/index.php?this.title=Ape_Tags_Flags
 */

import BitStream from '../common/bitstream';

var MAX_TAG_OFF = 10 * 1024; //查找标签头时，最多查找10K
var TEXT_ENCODING = []; //字符解码器
TEXT_ENCODING[0] = new TextDecoder('GBK');
TEXT_ENCODING[1] = new TextDecoder('UTF-16');
TEXT_ENCODING[2] = new TextDecoder('UTF-16BE');
TEXT_ENCODING[3] = new TextDecoder('UTF-8');

var gbkDecoder = TEXT_ENCODING[0];
var utf8Decoder = TEXT_ENCODING[3];

function Id3Tag(arrayBuffer) {
    this.bitStream = new BitStream(arrayBuffer);
}

var _proto_ = Id3Tag.prototype;

/**
 * 判断是否为ID3V1标签
 */
_proto_.checkId3V1 = function() {
    if (this.bitStream.getSize() < 128) {
        return false;
    }
    var tag = '';
    do {
        tag = String.fromCharCode(this.bitStream.getByte(), this.bitStream.getByte(), this.bitStream.getByte());
        if (this.bitStream.isEnd()) {
            break;
        }
        if (tag != 'TAG') {
            this.bitStream.rewindBytes(2);
        }
    } while (tag != 'TAG' && this.bitStream.getBytePos() < MAX_TAG_OFF);

    if (tag != 'TAG') {
        return false;
    }

    this.tagSize = 128; //标签长度
    return true;
}
/**
 * 判断是否为ID3V2标签
 */
_proto_.checkId3V2 = function() {
    var tag = '';
    do {
        tag = String.fromCharCode(this.bitStream.getByte(), this.bitStream.getByte(), this.bitStream.getByte());
        if (this.bitStream.isEnd()) {
            break;
        }
        if (tag != 'ID3') {
            this.bitStream.rewindBytes(2);
        }
    } while (tag != 'ID3' && this.bitStream.getBytePos() < MAX_TAG_OFF);

    if (tag != 'ID3') {
        return false;
    }
    return true;
}
/**
 * 判断是否为APE标签
 */
_proto_.checkApe = function() {
    var bytes = [];
    var tag = '';
    do {
        for (var i = 0; i < 8; i++) {
            bytes[i] = this.bitStream.getByte();
        }
        tag = String.fromCharCode.apply(null, bytes);
        if (this.bitStream.isEnd()) {
            break;
        }
        if (tag != 'APETAGEX') {
            this.bitStream.rewindBytes(7);
        }
    } while (tag != 'APETAGEX' && this.bitStream.getBytePos() < MAX_TAG_OFF);

    if (tag != 'APETAGEX') {
        return false;
    }
    return true;
}
/**
 * 解析ID3V1标签
 * @return number this.tagSize
 */
_proto_.parseId3V1 = function() {
    this.bitStream.reset();
    if (this.checkId3V1() == false)
        return 0;
    var i = 0;
    var bytes = new Uint8Array(30);
    if (this.bitStream.getSize() < 128) {
        return this.tagSize;
    }
    for (i = 0; i < 30; i++) {
        bytes[i] = this.bitStream.getByte();
    }
    this.title = gbkDecoder.decode(bytes); //标题

    for (i = 0; i < 30; i++) {
        bytes[i] = this.bitStream.getByte();
    }
    this.artist = gbkDecoder.decode(bytes); //艺术家

    for (i = 0; i < 30; i++) {
        bytes[i] = this.bitStream.getByte();
    }
    this.album = gbkDecoder.decode(bytes); //专辑

    for (i = 0; i < 4; i++) {
        bytes[i] = this.bitStream.getByte();
    }
    this.year = gbkDecoder.decode(bytes); //年份

    for (i = 0; i < 30; i++) {
        bytes[i] = this.bitStream.getByte();
    }
    this.comment = gbkDecoder.decode(bytes); //注释

    this.genre = this.bitStream.getByte(); //风格

    return this.tagSize;
}
/**
 * 解析ID3V2标签
 * @return number this.tagSize
 */
_proto_.parseId3V2 = function() {
    var self = this;
    this.bitStream.reset();
    if (this.checkId3V2() == false)
        return 0;
    this.bitStream.skipBytes(3);
    this.tagSize = (((this.bitStream.getByte() & 0x7F) << 21) |
        ((this.bitStream.getByte() & 0x7F) << 14) |
        ((this.bitStream.getByte() & 0x7F) << 7) |
        (this.bitStream.getByte() & 0x7F)) + 10;

    if (this.bitStream.getSize() < this.tagSize) {
        return this.tagSize;
    }

    while (this.bitStream.getBytePos() < this.tagSize && !this.bitStream.isEnd()) {
        _getItem();
    }

    function _getItem() {
        var key = String.fromCharCode(self.bitStream.getByte(), self.bitStream.getByte(), self.bitStream.getByte(), self.bitStream.getByte());
        var len = self.bitStream.getBits(32);
        var cont = '';
        var bytes = new Uint8Array(len);
        var strCode = 0; //字符编码索引

        if (!(key.charAt(0) <= 'z' && key.charAt(0) >= 'a') && !(key.charAt(0) <= 'Z' && key.charAt(0) >= 'A')) { //信息已读取完毕，后面为垃圾数据
            self.bitStream.setBytePos(self.tagSize);
            self.bitStream.setBitPos(0);
            return;
        }

        self.bitStream.skipBytes(2);
        strCode = self.bitStream.getByte();
        if (strCode > 3) {
            strCode = 3;
        }
        for (var i = 0; i < len - 1; i++) {
            bytes[i] = self.bitStream.getByte();
        }

        cont = TEXT_ENCODING[strCode].decode(bytes);

        // if(strCode>0){
        //  cont = cont.replace(/[^\u4e00-\u9fa5]/g, "");
        // }

        switch (key) {
            case 'TIT2':
                self.title = cont;
                break;
            case 'TPE1':
                self.artist = cont;
                break;
            case 'TALB':
                self.album = cont;
                break;
            case 'TYER':
                self.year = cont;
                break;
            case 'COMM':
                self.comment = cont;
                break;
            case 'TCON':
                self.genre = cont;
                break;
        }
    }
    return this.tagSize;
}
/**
 * 解析APE标签
 */
_proto_.parseApe = function() {
    var self = this;
    var itemSize = 0;
    var isApeHeader = 0;
    var isHeader = 0;
    this.bitStream.reset();
    if (this.checkApe() == false)
        return 0;
    this.bitStream.skipBytes(4);
    //低位在前
    this.tagSize = this.bitStream.getByte() | (this.bitStream.getByte() << 8) | (this.bitStream.getByte() << 16) | (this.bitStream.getByte() << 24);
    itemSize = this.bitStream.getByte() | (this.bitStream.getByte() << 8) | (this.bitStream.getByte() << 16) | (this.bitStream.getByte() << 24);
    this.bitStream.skipBits(2);
    if (this.bitStream.getBits1()) { //是ApeHeader
        this.tagSize += 32;
        isHeader = 1;
    }
    this.bitStream.skipBits(32 - 3);
    this.bitStream.skipBytes(8);
    if (this.bitStream.getBytePos() < this.tagSize || this.bitStream.getSize() < this.tagSize) {
        return this.tagSize;
    }
    if (!isHeader) {
        this.bitStream.rewindBytes(this.tagSize);
    }
    for (var i = 0; i < itemSize && this.bitStream.getBytePos() < this.tagSize && !this.bitStream.isEnd(); i++) {
        _getItem();
    }

    function _getItem() {
        var key = '';
        var cont = '';
        var byte = 0;
        //低位在前
        var len = self.bitStream.getByte() | (self.bitStream.getByte() << 8) | (self.bitStream.getByte() << 16) | (self.bitStream.getByte() << 24);
        var bytes = new Uint8Array(len);
        self.bitStream.skipBytes(4);
        byte = self.bitStream.getByte();

        while (byte != 0 && self.bitStream.getBytePos() < self.tagSize) {
            key += String.fromCharCode(byte);
            byte = self.bitStream.getByte();
        }

        for (var i = 0; i < len; i++) {
            bytes[i] = self.bitStream.getByte();
        }
        cont = utf8Decoder.decode(bytes);
        switch (key) {
            case 'Title':
                self.title = cont;
                break;
            case 'Artist':
                self.artist = cont;
                break;
            case 'Album':
                self.album = cont;
                break;
            case 'Year':
                self.year = cont;
                break;
            case 'Comment':
                self.comment = cont;
                break;
            case 'Genre':
                self.genre = cont;
                break;
        }
    }
    return this.tagSize;
}

export default Id3Tag;