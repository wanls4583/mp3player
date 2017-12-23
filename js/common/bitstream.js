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
			sum = (sum<<1) + ((byte>>(7-_bitPos))&1);
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
		var bit = _uint8Array[_bitPos]>>1;
		_bitPos++;
		if(_bitPos%8 == 0){
			_bytePos++;
			_bitPos = 0;
		}
		return bit;
	}
	/**
	 * 获取len个bit位二进制字符串
	 * @param  number len bit长度
	 * @return  string 二进制字符串
	 */
	_proto_.getBitsStr = function(len){
		return this._getBits(len).toString(2);
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
	return BitStream;
})