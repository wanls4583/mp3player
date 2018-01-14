/**
 * m4a元数据解析模块
 */
define(function(require, exports, module){
	'use strict';

	var requestRange = require('../common/range');
	var BitStream = require('../common/bitstream');

	function M4aInfo(url){
		this.sizes = {};//存储各种元数据的长度
		this.url = url;
	}

	var _proto_ = M4aInfo.prototype;

	_proto_.init = function(){
		var self = this;
		return new Promise(function(resolve,reject){
			self.loadTypeInfo(resolve,reject);
		}).then(function(size){
			if(typeof size === 'number'){
				return self.loadMoovInfo(size);
			}else{
				return self;
			}
		})
	}
	/**
	 * 加载文件类型信息
	 */
	_proto_.loadTypeInfo = function(resolve,reject){
		var self = this;
		requestRange(self.url, 0, 1024*40, { //40K
        	onsuccess: function(request) {
               var arrayBuffer = request.response;
               var size = 0;
               self.bitStream = new BitStream(arrayBuffer);
               size = self.checkM4a();
               self.sizes.typeSize = size;
               if(!size){
               		reject();
               }else if(size+8<arrayBuffer.byteLength){
               		var moovSize = self.findBoxType('moov');
               		self.bitStream.reset();
               		if(arrayBuffer.byteLength >= size+moovSize){
	               		if(self.parseInfo()){
	               			self.meta = arrayBuffer.slice(0,size+moovSize); //保存元数据，用于重建
		               		resolve(self);
	               		}else{
	               			reject();
	               		}
               		}else{
               			resolve(moovSize);
               		}
               }else{
               		size = self.findBoxType('moov');
               		resolve(size);
               }
            }
        });
	}
	/**
	 * 加载文件元数据信息
	 */
	_proto_.loadMoovInfo = function(size){
		var self = this;
		return new Promise(function(resolve,reject){
			requestRange(self.url, 0, size+self.sizes.typeSize, {
	        	onsuccess: function(request) {
					var arrayBuffer = request.response;
					self.bitStream = new BitStream(arrayBuffer);
					if(self.parseInfo()){
						self.meta = arrayBuffer.slice(0,size+self.sizes.typeSize);
						resolve(self);
					}else{
						reject();
					}
	            }
	        });
		})
	}
	/**
	 * 检测是否为m4a格式
	 * @return {boolean} 是否为m4a
	 */
	_proto_.checkM4a = function(){
		var boxSize = this.bitStream.getBits(32);
		var strs = '';
		if(boxSize>100){
			return false;
		}
		while(this.bitStream.getBytePos() < boxSize && !this.bitStream.isEnd()){
			strs+=String.fromCharCode(this.bitStream.getByte());
		}
		if(strs.indexOf('M4A')!=-1){
			this.bitStream.reset();
			return boxSize;
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
		this.sizes[type+'Size'] = boxSize;
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
		this.mvhd = {};
		if(version){
			this.bitStream.skipBytes(16);
			this.mvhd.timescalePos = this.bitStream.getBytePos();
			this.mvhd.timescale = this.bitStream.getBits(32);
			this.mvhd.durationPos = this.bitStream.getBytePos();
			this.mvhd.duration = this.bitStream.getBits(64);
			this.bitStream.skipBytes(this.sizes['mvhdSize']-8-4-16-4-8);
		}else{
			this.bitStream.skipBytes(8);
			this.mvhd.timescalePos = this.bitStream.getBytePos();
			this.mvhd.timescale = this.bitStream.getBits(32);
			this.mvhd.durationPos = this.bitStream.getBytePos();
			this.mvhd.duration = this.bitStream.getBits(32);
			this.bitStream.skipBytes(this.sizes['mvhdSize']-8-4-8-4-4);
		}
		return true;
	}
	/**
	 * 解析tkhd信息
	 * @return {boolean} 解析是否成功
	 */
	_proto_.parseTkhd = function(){
		if(!this.findBoxType('tkhd'))
			return false;
		var version = this.bitStream.getByte();
		this.bitStream.skipBytes(3);
		this.tkhd = {};
		if(version){
			this.bitStream.skipBytes(32);
			this.tkhd.durationPos = this.bitStream.getBytePos();
			this.tkhd.duration = this.bitStream.getBits(64);
			this.bitStream.skipBytes(this.sizes['tkhdSize']-8-4-32-8);
		}else{
			this.bitStream.skipBytes(16);
			this.tkhd.durationPos = this.bitStream.getBytePos();
			this.tkhd.duration = this.bitStream.getBits(32);
			this.bitStream.skipBytes(this.sizes['tkhdSize']-8-4-16-4);
		}
		return true;
	}
	/**
	 * 解析tkhd信息
	 * @return {boolean} 解析是否成功
	 */
	_proto_.parseMdhd = function(){
		if(!this.findBoxType('mdhd'))
			return false;
		var version = this.bitStream.getByte();
		this.bitStream.skipBytes(3);
		this.mdhd = {};
		if(version){
			this.bitStream.skipBytes(16);
			this.mdhd.timescalePos = this.bitStream.getBytePos();
			this.mdhd.timescale = this.bitStream.getBits(32);
			this.mdhd.durationPos = this.bitStream.getBytePos();
			this.mdhd.duration = this.bitStream.getBits(64);
			this.bitStream.skipBytes(this.sizes['mdhdSize']-8-4-16-4-8);
		}else{
			this.bitStream.skipBytes(8);
			this.mdhd.timescalePos = this.bitStream.getBytePos();
			this.mdhd.timescale = this.bitStream.getBits(32);
			this.mdhd.durationPos = this.bitStream.getBytePos();
			this.mdhd.duration = this.bitStream.getBits(32);
			this.bitStream.skipBytes(this.sizes['mdhdSize']-8-4-8-4-4);
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
		this.stsz = [];
		this.stco = [];
		
		if(!this.findBoxType('stbl'))
			return false;
		if(!this.findBoxType('stts')){
			return false;
		}
		this.bitStream.skipBits(32);
		this.stts.beginPos = this.bitStream.getBytePos();
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
		this.stsc.beginPos = this.bitStream.getBytePos();
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
		this.stsz.beginPos = this.bitStream.getBytePos();
		this.stsz.sampleSize = this.bitStream.getBits(32);
		this.stsz.count = this.bitStream.getBits(32);
		if(this.stsz.sampleSize==0){
			for(var i=0; i<this.stsz.count; i++){
				this.stsz[i] = this.bitStream.getBits(32);
			}
		}

		if(!this.findBoxType('stco')){
			return false;
		}
		this.bitStream.skipBits(32);
		this.stco.beginPos = this.bitStream.getBytePos();
		this.stco.count = this.bitStream.getBits(32);
		for(var i=0; i<this.stco.count; i++){
			this.stco[i] = this.bitStream.getBits(32);
		}
		return true;
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
		//track-box包含tkhd，mdia
		if(!this.findBoxType('trak')){
			return false;
		}
		//解析tkhd
		if(!this.parseTkhd()){
			return false;
		}
		//mdia-box包含mdhd，minf
		if(!this.findBoxType('mdia')){
			return false;
		}
		//解析mdhd
		if(!this.parseMdhd()){
			return false;
		}
		//minf-box包含stbl
		if(!this.findBoxType('minf')){
			return false;
		}
		//解析stbl
		if(!this.parseStbl()){
			return false;
		}
		return true;
	}
	/**
	 * 根据时间重建moov-box
	 * @return {number} 偏移量
	 */
	_proto_.rebuildByTime = function(seconds){
		var time = seconds*this.mdhd.timescale;
		var tsSum=0,scSum=0,preScSum=0,coSum=0,cIndex=0,sample,chunk,offset;
		//time->sample
		for(var i=0; i<this.stts.length; i++){
			tsSum+=this.stts[i].sampleDelta*this.stts[i].sampleCount;
			if(time<tsSum){
				sample = Math.ceil(time/this.stts[i].sampleDelta);
			}
		}
		if(!sample){
			time = tsSum;
		}
		//sample->chunk
		for(var i=0; i<this.stsc.length-1; i++){
			scSum+=(this.stsc[i+1].firstChunk-1)*this.stsc[i].samplesPerChunk;
			if(sample<=scSum){
				cIndex = i;
				chunk = this.stsc[i].firstChunk+Math.floor((sample-preScSum)/this.stsc[i].samplesPerChunk);
				break;
			}
			preScSum = scSum;
		}
		if(!chunk){
			cIndex = i;
			chunk = this.stsc[i].firstChunk+Math.floor((sample-preScSum)/this.stsc[i].samplesPerChunk);
		}
		//chunk->offset
		offset = this.stco[chunk-1];
		var ciSample,sbegin;
		ciSample = (sample-preScSum)%this.stsc[cIndex].samplesPerChunk-1;
		sbegin = sample-ciSample;
		for(var i=0; i<ciSample; i++){
			if(this.stsz.length){
				offset+=this.stsz[sbegin+i-1];
			}else{
				offset+=this.stsz.sampleSize;
			}
		}
		return offset;
	}
	return M4aInfo;
})