/**
 * bit流模块
 */
function BitStream(arrayBuffer) {
    if (arrayBuffer instanceof ArrayBuffer) {
        this._uint8Array = new Uint8Array(arrayBuffer);
    } else if (typeof arrayBuffer == 'number') {
        arrayBuffer = new ArrayBuffer(arrayBuffer);
        this._uint8Array = new Uint8Array(arrayBuffer);
    } else {
        throw Error('参数错误');
    }
    this._bytePos = 0; //当前bit位置
    this._bitPos = 0; //当前字节位置
    this.buffer = arrayBuffer;
    this.end = 0;
}
var _proto_ = BitStream.prototype;
/**
 * 返回buffer
 * @return  arraybuffer
 */
_proto_.getBuffer = function() {
        return this._uint8Array.buffer;
    },
    /**
     * 获取len个bit位
     * @param  number len bit长度
     * @return  number 整数
     */
    _proto_.getBits = function(len) {
        var sum = 0;
        var byte = 0;
        if (this._bytePos >= this._uint8Array.length)
            return false;
        for (var i = 0; i < len && this._bytePos < this._uint8Array.length; i++) {
            byte = this._uint8Array[this._bytePos];
            sum = (sum << 1) | ((byte >> (7 - this._bitPos)) & 1);
            this._bitPos++;
            if (this._bitPos % 8 == 0) {
                this._bytePos++;
                this._bitPos = 0;
            }
        }
        return sum;
    }
/**
 * 获取1个bit位
 * @return  number 0|1
 */
_proto_.getBits1 = function(len) {
    if (this._bytePos >= this._uint8Array.length)
        return false;
    var bit = (this._uint8Array[this._bytePos] >> (7 - this._bitPos)) & 1;
    this._bitPos++;
    if (this._bitPos % 8 == 0) {
        this._bytePos++;
        this._bitPos = 0;
    }
    return bit;
}
/**
 * 获取1个字节
 * @return  number 0|1
 */
_proto_.getByte = function() {
    if (this._bytePos >= this._uint8Array.length)
        return false;
    var byte = this._uint8Array[this._bytePos];
    this._bytePos++;
    return byte;
}
/**
 * 获取len个bit位二进制字符串
 * @param  number len bit长度
 * @param  boolean zeroize 头部是否补0
 * @return  string 二进制字符串
 */
_proto_.getBitsStr = function(len, zeroize) {
    var str = this.getBits(len).toString(2);
    if (str.legnth < len) {
        var zeros = '';
        for (var i = 0; i < len - str.length; i++) {
            zeros += '0';
        }
        str = zeros + str;
    }
    return str;
}
/**
 * 返回字节位置
 * @retrun  number pos 位置
 */
_proto_.getBytePos = function(pos) {
    return this._bytePos;
}
/**
 * 返回bit位置
 * @retrun  number pos 位置
 */
_proto_.getBitPos = function(pos) {
    return this._bitPos;
}
/**
 * 设置字节位置
 * @param  number pos 位置
 */
_proto_.setBytePos = function(pos) {
    if (pos > this._uint8Array.length) {
        pos = this._uint8Array.length;
    }
    this._bytePos = pos;
}
/**
 * 设置bit位置
 * @param  number pos 位置
 */
_proto_.setBitPos = function(pos) {
    this._bitPos = pos % 8;
}
/**
 * 设置一位bit
 */
_proto_.setBit = function(bytePos, bitPos, bit) {
    var byte = bit << bitPos & 0xff;
    if (bytePos >= this._uint8Array.length) {
        return;
    }
    this._uint8Array[bytePos] = this._uint8Array[bytePos] & byte;
}
/**
 * 设置一位bit
 */
_proto_.setByte = function(bytePos, byte) {
    if (bytePos >= this._uint8Array.length) {
        return;
    }
    this._uint8Array[bytePos] = byte;
}
/**
 * 跳过len个bit
 */
_proto_.skipBits = function(len) {
    this._bytePos = this._bytePos + (((this._bitPos + len) / 8) >> 0);
    this._bitPos = (this._bitPos + len) % 8;
    if (this._bytePos > this._uint8Array.length) {
        this._bytePos = this._uint8Array.length;
    }
}
/**
 * 跳过len个byte
 */
_proto_.skipBytes = function(len) {
    this._bytePos = this._bytePos + len;
    if (this._bytePos > this._uint8Array.length) {
        this._bytePos = this._uint8Array.length;
    }
}
/**
 * 回退len个bit
 */
_proto_.rewindBits = function(len) {
    this._bitPos = this._bitPos - len;
    if (this._bitPos < 0) {
        this._bitPos = 0;
    }
}
/**
 * 回退len个byte
 */
_proto_.rewindBytes = function(len) {
    this._bytePos = this._bytePos - len;
    if (this._bytePos < 0) {
        this._bytePos = 0;
    }
}
/**
 * 在尾部添加字节
 * @return  返回新的buffer
 */
_proto_.append = function(arrayBuffer) {
    var newBuffer = new ArrayBuffer(this._uint8Array.length + arrayBuffer.length);
    this._uint8Array = new Uint8Array(newBuffer);
    this._uint8Array.set(arrayBuffer, this._uint8Array.length - arrayBuffer.length);
    return newBuffer;
}
/**
 * 在头部添加字节
 * @return  返回新的buffer
 */
_proto_.unshift = function(arrayBuffer) {
    var newBuffer = new ArrayBuffer(this._uint8Array.length + arrayBuffer.length);
    this._uint8Array = new Uint8Array(newBuffer);
    this._uint8Array.set(arrayBuffer, 0);
    return newBuffer;
}
/**
 * 是否已到达最后一个bit
 * @return  boolean
 */
_proto_.isEnd = function() {
    return this._bytePos >= this._uint8Array.length;
}
/**
 * 返回流字节个数
 * @return  number
 */
_proto_.getSize = function() {
    return this._uint8Array.length;
}
/**
 * 重头开始
 */
_proto_.reset = function() {
    this._bitPos = 0;
    this._bytePos = 0;
}
/**
 * 比特流数组截取
 * @param  {number} begin 开始索引
 * @param  {number} end   结束索引
 * @return {arrary}       比特流数组
 */
_proto_.slice = function(begin, end) {
    return this._uint8Array.slice(begin, end);
}
/**
 * 追加数据
 * @param  {object} byteArr 二进制数组
 */
_proto_.append = function(byteArr) {
    var tmp = new Uint8Array(this.getSize());
    if (this._bytePos > 0) {
        tmp.set(this._uint8Array.slice(this._bytePos), 0);
        tmp.set(byteArr, this.end);
    } else {
        tmp.set(byteArr, 0);
    }
    this.end = this._bytePos + byteArr.length; //有效数据尾
    this._uint8Array = tmp;
    this._bytePos = 0;
}

export default BitStream;