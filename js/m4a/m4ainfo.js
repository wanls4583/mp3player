/**
 * m4a元数据解析模块
 */
define(function(require, exports, module){
	'use strict';

	var BitStream = require('../common/bitstream');

	function M4aInfo(arrayBuffer){
		this.bitStream = new BitStream(arrayBuffer);
	}

	var _proto_ = M4aInfo.prototype;
	/**
	 * 检测是否为m4a格式
	 * @return {boolean} 是否为m4a
	 */
	_proto_.checkM4a = function(){
		var length = this.bitStream.getBits(32);
		var strs = '';
		length = length>32?32:length;
		while(this.bitStream.getBytePos() < length){
			strs+=String.fromCharCode(this.bitStream.getByte());
		}
		if(strs.indexOf('M4A')!=-1){
			this.bitStream.reset();
			return true;
		}
		return false;
	}
	/**
	 * 获取盒大小
	 * @return {number} 盒大小
	 */
	_proto_.getBoxSize = function(){
		return this.bitStream.getBits(32);
	}
	/**
	 * 获取盒类型
	 * @return {string} 4个字母的盒类型
	 */
	_proto_.getBoxType = function(){
		var strs = [];
		for(var i=0; i<4; i++){
			strs+=String.fromCharCode(this.bitStream.getByte());
		}
		return strs
	}
	/**
	 * 查找盒子
	 * @return {boolean} 查找是否成功
	 */
	_proto_.findBoxType = function(type){
		var boxSize = this.getBoxSize();
		var boxType = this.getBoxType();
		while(boxType!=type && !this.bitStream.isEnd()){
			this.bitStream.skipBytes(boxSize-8);
			boxSize = this.getBoxSize();
			boxType = this.getBoxType();
		}
		if(boxType!=type)
			return false;
		this[type+'Size'] = boxSize;
		return boxSize;
	}
	/**
	 * 解析movh信息
	 * @return {boolean} 解析是否成功
	 */
	_proto_.parseMvhd = function(){
		if(!this.findBoxType('mvhd'))
			return false;
		var version = this.bitStream.getByte();
		this.bitStream.skipBytes(3);
		if(version){
			this.bitStream.skipBytes(16);
			this.timescale = this.bitStream.getBits(32);
			this.duration = this.bitStream.getBits(64);
			this.bitStream.skipBytes(this.mvhdSize-8-4-16-4-8);
		}else{
			this.bitStream.skipBytes(8);
			this.timescale = this.bitStream.getBits(32);
			this.duration = this.bitStream.getBits(32);
			this.bitStream.skipBytes(this.mvhdSize-8-4-8-4-4);
		}
		return true;
	}
	/**
	 * 解析stbl信息
	 * @return {boolean} 解析是否成功
	 */
	_proto_.parseStbl = function(){
		this.stts = [];
		this.stsc = [];
		this.stsz = {};
		this.stco = [];
		if(!this.findBoxType('trak')||!this.findBoxType('mdia')||!this.findBoxType('minf')||!this.findBoxType('stbl'))
			return false;
		if(!this.findBoxType('stts')){
			return false;
		}
		this.bitStream.skipBits(32);
		this.stts.count = this.bitStream.getBits(32);
		for(var i=0; i<this.stts.count; i++){
			this.stts[i] = {
				sampleCount: this.bitStream.getBits(32),
				sampleDelta: this.bitStream.getBits(32)
			};
		}

		if(!this.findBoxType('stsc')){
			return false;
		}
		this.bitStream.skipBits(32);
		this.stsc.count = this.bitStream.getBits(32);
		for(var i=0; i<this.stsc.count; i++){
			this.stsc[i] = {
				firstChunk: this.bitStream.getBits(32),
				samplesPerChunk: this.bitStream.getBits(32),
				sampleDescriptionIndex: this.bitStream.getBits(32)
			};
		}

		if(!this.findBoxType('stsz')){
			return false;
		}
		this.bitStream.skipBits(32);
		this.stsz.sampleSize = this.bitStream.getBits(32);
		this.stsz.count = this.bitStream.getBits(32);
		if(this.stsz.sampleSize==0){
			this.stsz.entrySize = [];
			for(var i=0; i<this.stsz.count; i++){
				this.stsz.entrySize[i] =  this.bitStream.getBits(32);
			}
		}

		if(!this.findBoxType('stco')){
			return false;
		}
		this.bitStream.skipBits(32);
		this.stco.count = this.bitStream.getBits(32);
		for(var i=0; i<this.stco.count; i++){
			this.stco[i] = {
				chunk_offset: this.bitStream.getBits(32)
			};
		}
	}
	/**
	 * 解析元数据
	 * @return {[type]} [description]
	 */
	_proto_.parseInfo = function(){
		
		if(!this.findBoxType('moov')){
			return false;
		}

		//解析movie header
		if(!this.parseMvhd()){
			return false;
		}
		//解析stbl
		if(!this.parseStbl()){
			return false;
		}
	}

	return M4aInfo;
})