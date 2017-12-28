/**
 * bit流模块
 */
define(function(require, exports, module) {
	var _uint8Array = null;
	var _bytePos = 0; //当前bit位置
	var _bitPos = 0; //当前字节位置

	function BitStream(arrayBuffer){
		if(arrayBuffer instanceof ArrayBuffer){
			_uint8Array = new Uint8Array(arrayBuffer);
		}else if(typeof arrayBuffer == 'number'){
			arrayBuffer = new ArrayBuffer(arrayBuffer);
			_uint8Array = new Uint8Array(arrayBuffer);
		}else{
			throw Error('参数错误');
		}
		this.buffer = arrayBuffer;
	}
	var _proto_ = BitStream.prototype;
	/**
	 * 返回buffer
	 * @return  arraybuffer
	 */
	_proto_.getBuffer = function(){
		return _uint8Array.buffer;
	},
	/**
	 * 获取len个bit位
	 * @param  number len bit长度
	 * @return  number 整数
	 */
	_proto_.getBits = function(len){
		var sum = 0;
		var byte = 0;
		if(_bytePos >= _uint8Array.length)
			return false;
		for(var i=0; i<len && _bytePos < _uint8Array.length; i++){
			byte = _uint8Array[_bytePos];
			sum = (sum<<1) | ((byte>>(7-_bitPos))&1);
			_bitPos++;
			if(_bitPos%8 == 0){
				_bytePos++;
				_bitPos = 0;
			}
		}
		return sum;
	}
	/**
	 * 获取1个bit位
	 * @return  number 0|1
	 */
	_proto_.getBits1 = function(len){
		if(_bytePos >= _uint8Array.length)
			return false;
		var bit = (_uint8Array[_bytePos]>>(7-_bitPos))&1;
		_bitPos++;
		if(_bitPos%8 == 0){
			_bytePos++;
			_bitPos = 0;
		}
		return bit;
	}
	/**
	 * 获取1个字节
	 * @return  number 0|1
	 */
	_proto_.getByte = function(){
		if(_bytePos >= _uint8Array.length)
			return false;
		var byte = _uint8Array[_bytePos];
		_bytePos++;
		return byte;
	}
	/**
	 * 获取len个bit位二进制字符串
	 * @param  number len bit长度
	 * @param  boolean zeroize 头部是否补0
	 * @return  string 二进制字符串
	 */
	_proto_.getBitsStr = function(len, zeroize){
		var str = this.getBits(len).toString(2);
		if(str.legnth < len){
			var zeros = '';
			for(var i=0; i<len-str.length; i++){
				zeros+='0';
			}
			str = zeros+str;
		}
		return str;
	}
	/**
	 * 返回字节位置
	 * @retrun  number pos 位置
	 */
	_proto_.getBytePos = function(pos){
		return _bytePos;
	}
	/**
	 * 返回bit位置
	 * @retrun  number pos 位置
	 */
	_proto_.getBitPos = function(pos){
		return _bitPos;
	}
	/**
	 * 设置字节位置
	 * @param  number pos 位置
	 */
	_proto_.setBytePos = function(pos){
		if(pos > _uint8Array.length){
			pos = _uint8Array.length;
		}
		_bytePos = pos;
	}
	/**
	 * 设置bit位置
	 * @param  number pos 位置
	 */
	_proto_.setBitPos = function(pos){
		_bitPos = pos%8;
	}
	/**
	 * 设置一位bit
	 */
	_proto_.setBit = function(bytePos, bitPos, bit){
		var byte = bit<<bitPos & 0xff;
		if(bytePos >= _uint8Array.length){
			return;
		}
		_uint8Array[bytePos] = _uint8Array[bytePos] & byte;
	}
	/**
	 * 设置一位bit
	 */
	_proto_.setByte = function(bytePos, byte){
		if(bytePos >= _uint8Array.length){
			return;
		}
		_uint8Array[bytePos] = byte;
	}
	/**
	 * 跳过len个bit
	 */
	_proto_.skipBits = function(len){
		_bytePos = _bytePos + (((_bitPos+len)/8)>>0);
		_bitPos = (_bitPos+len)%8;
		if(_bytePos > _uint8Array.length){
			_bytePos = _uint8Array.length;
		}
	}
	/**
	 * 跳过len个byte
	 */
	_proto_.skipBytes = function(len){
		_bytePos = _bytePos + len;
		if(_bytePos > _uint8Array.length){
			_bytePos = _uint8Array.length;
		}
	}
	/**
	 * 回退len个bit
	 */
	_proto_.rewindBits = function(len){
		_bitPos = _bitPos - len;
		if(_bitPos < 0){
			_bitPos = 0;
		}
	}
	/**
	 * 回退len个byte
	 */
	_proto_.rewindBytes = function(len){
		_bytePos = _bytePos - len;
		if(_bytePos < 0){
			_bytePos = 0;
		}
	}
	/**
	 * 在尾部添加字节
	 * @return  返回新的buffer
	 */
	_proto_.append = function(arrayBuffer){
		var newBuffer = new ArrayBuffer(_uint8Array.length + arrayBuffer.length);
		_uint8Array = new Uint8Array(newBuffer);
		_uint8Array.set(arrayBuffer,_uint8Array.length - arrayBuffer.length);
		return newBuffer;
	}
	/**
	 * 在头部添加字节
	 * @return  返回新的buffer
	 */
	_proto_.unshift = function(arrayBuffer){
		var newBuffer = new ArrayBuffer(_uint8Array.length + arrayBuffer.length);
		_uint8Array = new Uint8Array(newBuffer);
		_uint8Array.set(arrayBuffer,0);
		return newBuffer;
	}
	/**
	 * 是否已到达最后一个bit
	 * @return  boolean
	 */
	_proto_.isEnd = function(){
		return _bytePos >= _uint8Array.length;
	}
	/**
	 * 返回流字节个数
	 * @return  number
	 */
	_proto_.getSize = function(){
		return _uint8Array.length;
	}
	/**
	 * 重头开始
	 */
	_proto_.reset = function(){
		_bitPos = 0;
		_bytePos = 0;
	}
	return BitStream;
})