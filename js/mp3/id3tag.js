/**
 * MP3音频ID3标签信息模块
 * http://wiki.hydrogenaud.io/index.php?title=Ape_Tags_Flags
 */
define(function(require, exports, module) {
    'use strict';

    var BitStream = require('../common/bitstream');

    var bitStream = null;
    var tagSize = 0; //标签长度
    var title = ''; //标题
    var artist = ''; //艺术家
    var album = ''; //专辑
    var year = ''; //年份
    var comment = ''; //注释
    var genre = ''; //风格

    var TEXT_ENCODING = [];
    TEXT_ENCODING[0] = new TextDecoder('GBK');
    TEXT_ENCODING[1] = new TextDecoder('UTF-16');
    TEXT_ENCODING[2] = new TextDecoder('UTF-16BE');
    TEXT_ENCODING[3] = new TextDecoder('UTF-8');

    var asciiDecoder = new TextDecoder('ascii');

    function Id3Tag(arrayBuffer){
    	bitStream = new BitStream(arrayBuffer);
    }

    var _proto_ = Id3Tag.prototype;

    /**
     * 判断是否为ID3V1标签
     */
    _proto_.checkId3V1 = function(){
    	var tag = String.fromCharCode(bitStream.getByte(), bitStream.getByte(), bitStream.getByte());
    	if (tag!='TAG' || bitStream.getSize() < 128)
			return false;
		tagSize = 128;
		return true;
    }
    /**
     * 判断是否为ID3V2标签
     */
    _proto_.checkId3V2 = function(){
    	var tag = String.fromCharCode(bitStream.getByte(), bitStream.getByte(), bitStream.getByte());
    	if (tag!='ID3')
			return false;
		return true;
    }
    /**
     * 判断是否为APE标签
     */
    _proto_.checkApe = function(){
    	var bytes = [];
    	for(var i=0; i<8; i++){
    		bytes[i] = bitStream.getByte();
    	}
    	var tag = String.fromCharCode.apply(null,bytes);
    	if (tag!='APETAGEX')
			return false;
		return true;
    }
    /**
     * 解析ID3V1标签
     * @return number tagSize
     */
    _proto_.parseId3V1 = function(){
    	bitStream.reset();
    	if (this.checkId3V1() == false)
			return;
		var i = 0;
		var bytes = new Uint8Array(30);
		for(i=0; i<30; i++){
			bytes[i] = bitStream.getByte();
		}
		title = asciiDecoder.decode(bytes);

		for(i=0; i<30; i++){
			bytes[i] = bitStream.getByte();
		}
		artist = asciiDecoder.decode(bytes);

		for(i=0; i<30; i++){
			bytes[i] = bitStream.getByte();
		}
		album = asciiDecoder.decode(bytes);

		for(i=0; i<4; i++){
			bytes[i] = bitStream.getByte();
		}
		year = asciiDecoder.decode(bytes);

		for(i=0; i<30; i++){
			bytes[i] = bitStream.getByte();
		}
		comment = asciiDecoder.decode(bytes);

		genre = bitStream.getByte();

		return tagSize;
    }
    /**
     * 解析ID3V2标签
     * @return number tagSize
     */
    _proto_.parseId3V2 = function(){
    	bitStream.reset();
    	if (this.checkId3V2() == false)
			return;
		bitStream.skipBytes(3);
		tagSize = (((bitStream.getByte() & 0x7F) << 21) | 
			((bitStream.getByte() & 0x7F) << 14) | 
			((bitStream.getByte() & 0x7F) << 7) | 
			(bitStream.getByte() & 0x7F)) + 10;

		while(bitStream.getBytePos() < tagSize){
			_getItem();
		}
		function _getItem(){
			var key = String.fromCharCode(bitStream.getByte(), bitStream.getByte(), bitStream.getByte(), bitStream.getByte());
			var len = bitStream.getBits(32);
			var cont = '';
			var bytes = new Uint8Array(len);
			var strCode = 0;

			if(!(key.charAt(0)<='z' && key.charAt(0)>='a') && !(key.charAt(0)<='Z' && key.charAt(0)>='A')){ //信息已读取完毕，后面为垃圾数据
				bitStream.setBytePos(tagSize);
				bitStream.setBitPos(0);
				return;
			}

			bitStream.skipBytes(2);

			strCode = bitStream.getByte();

    		for(var i=0; i<len-1; i++){
    			bytes[i] = bitStream.getByte();
    		}

			cont = TEXT_ENCODING[strCode].decode(bytes);

			// if(strCode>0){
			// 	cont = cont.replace(/[^\u4e00-\u9fa5]/g, "");
			// }

			switch(key){
				case 'TIT2': title = cont; break;
				case 'TPE1': artist = cont; break;
				case 'TALB': album = cont; break;
				case 'TYER': year = cont; break;
				case 'COMM': comment = cont; break;
				case 'TCON': genre = cont; break;
			}
		}
		return tagSize;
    }
    /**
     * 解析APE标签
     */
    _proto_.parseApe = function(){
    	var itemSize = 0;
    	var isApeHeader = 0;
    	bitStream.reset();
    	if (checkApe() == false)
			return;
		bitStream.skipBytes(4);
		//低位在前
		tagSize = bitStream.getByte() | (bitStream.getByte() << 8) | (bitStream.getByte() << 16) | (bitStream.getByte() << 24);
    	itemSize = bitStream.getBits(32);
    	bitStream.skipBits(2);
    	if(bitStream.getBits1()){ //是ApeHeader
    		tagSize += 32;
    	}
    	for(var i=0; i<itemSize && bitStream.getBytePos()<tagSize; i++){
    		_getItem();
    	}
    	function _getItem(){
    		var key = '';
    		var cont = '';
    		var byte = 0;
    		//低位在前
    		var len = bitStream.getByte() | (bitStream.getByte() << 8) | (bitStream.getByte() << 16) | (bitStream.getByte() << 24);
    		var bytes = new Uint8Array(len);
    		bitStream.skipBytes(4);
    		do{
    			byte = bitStream.getByte();
    			key += String.fromCharCode(byte);
    		}while(byte!=0 && bitStream.getBytePos()<tagSize)

    		for(var i=0; i<len; i++){
    			bytes[i] = bitStream.getByte();
    		}
    		cont = utf8Decoder.decode(bytes);
    		switch(key){
    			case 'Title': title = cont; break;
				case 'Artist': artist = cont; break;
				case 'Album': album = cont; break;
				case 'Year': year = cont; break;
				case 'Comment': comment = cont; break;
				case 'Genre': genre = cont; break;
    		}
    	}
    }
    _proto_.getTagSize = function(){
    	return tagSize;
    }
    _proto_.getTitle = function(){
    	return title;
    }
    _proto_.getArtist = function(){
    	return artist;
    }
    _proto_.getAlbum = function(){
    	return album;
    }
    _proto_.getYear = function(){
    	return year;
    }
    _proto_.getComment = function(){
    	return comment;
    }
    _proto_.getGenre = function(){
    	return genre;
    }

    return Id3Tag;
})