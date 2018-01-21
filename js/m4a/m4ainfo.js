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
               var contetnRange = request.getResponseHeader('Content-Range');
               self.bitStream = new BitStream(arrayBuffer);
               size = self.checkM4a();
               self.sizes.typeSize = size;
               self.sizes.fileSize = parseInt(contetnRange.substr(contetnRange.indexOf('/') + 1));
               if(!size){
               		reject();
               }else if(size+8<arrayBuffer.byteLength){
               		var moovSize = self.findBoxType('moov');
               		self.bitStream.reset();
               		if(arrayBuffer.byteLength >= size+moovSize){
	               		if(self.parseInfo()){
	               			var meta = arrayBuffer.slice(0,size+moovSize); //保存元数据，用于重建
	               			var tmp = null;
	               			self.meta = new ArrayBuffer(size+moovSize+8) //多出8字节用来存储音频数据大小和mdat
	               			tmp = new Uint8Array(self.meta);
	               			tmp.set(new Uint8Array(meta), 0);
	               			//设置mdat类型标识
	               			tmp[tmp.length-4] = 0x6d;
	               			tmp[tmp.length-3] = 0x64;
	               			tmp[tmp.length-2] = 0x61;
	               			tmp[tmp.length-1] = 0x74;
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
						var meta = arrayBuffer.slice(0,size+self.sizes.typeSize);; //保存元数据，用于重建
               			var tmp = null;
               			self.meta = new ArrayBuffer(size+self.sizes.typeSize+8) //多出8字节用来存储音频数据大小和mdat
               			tmp = new Uint8Array(self.meta);
               			tmp.set(new Uint8Array(meta), 0);
               			//设置mdat类型标识
               			tmp[tmp.length-4] = 0x6d;
               			tmp[tmp.length-3] = 0x64;
               			tmp[tmp.length-2] = 0x61;
               			tmp[tmp.length-1] = 0x74;
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
		this.stts.count = this.bitStream.getBits(32);
		this.stts.beginPos = this.bitStream.getBytePos();
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
		this.stsc.beginPos = this.bitStream.getBytePos();
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
		this.stsz.beginPos = this.bitStream.getBytePos();
		if(this.stsz.sampleSize==0){
			for(var i=0; i<this.stsz.count; i++){
				this.stsz[i] = this.bitStream.getBits(32);
			}
		}

		if(!this.findBoxType('stco')){
			return false;
		}
		this.bitStream.skipBits(32);
		this.stco.count = this.bitStream.getBits(32);
		this.stco.beginPos = this.bitStream.getBytePos();
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
		var tsSum=0,preTsSum=0,scSum=0,preScSum=0,coSum=0,cIndex=0,sample,chunk,offset,beginPos,beginIndex,tmp;
		var uint8Array = new Uint8Array(this.meta);
		var newStsc = [], newStsz=[], newStco=[];
		//time->sample
		for(var i=0; i<this.stts.length; i++){
			tsSum+=this.stts[i].sampleDelta*this.stts[i].sampleCount;
			if(time<tsSum){
				sample = preTsSum+Math.ceil((time-preTsSum)/this.stts[i].sampleDelta);
			}
			preTsSum = tsSum;
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
		ciSample = (sample-preScSum)%this.stsc[cIndex].samplesPerChunk;
		sbegin = sample-ciSample+1;
		for(var i=0; i<ciSample-1; i++){
			if(this.stsz.length){
				offset+=this.stsz[sbegin+i-1];
			}else{
				offset+=this.stsz.sampleSize;
			}
		}

		//rebuild
		
		//rebuild-stts
		beginPos = this.stts.beginPos;
		beginIndex=0;
		tsSum=0;
		for(var i=0; i<this.stts.length; i++){ //清零
			_clearInt(beginPos);
			beginPos+=8
		}
		for(var i=0; i<this.stts.length; i++){
			if(tsSum+this.stts[i].sampleCount >= sample){
				beginIndex = i;
				break;
			}
			tsSum+=this.stts[i].sampleCount;
		}
		beginPos = this.stts.beginPos;
		_setInt(beginPos, this.stts[beginIndex].sampleCount-(sample-tsSum-1));
		_setInt(beginPos+4, this.stts[beginIndex].sampleDelta);
		beginPos+=8;
		for(var i=beginIndex+1; i<this.stts.length; i++){ //重新赋值
			_setInt(beginPos, this.stts[i].sampleCount);
			_setInt(beginPos+4, this.stts[i].sampleDelta);
			beginPos+=8;
		}
		//rebuild-stsc
		var beginPos = this.stsc.beginPos;
		for(var i=0; i<this.stsc.length; i++){ //清零
			_clearInt(beginPos);
			beginPos+=12;
		}
		for(var i=0; i<this.stsc.length-1; i++){
			if(this.stsc[i+1].firstChunk-1 >= chunk){
				i++;
				break;
			}
		}
		beginPos = this.stsc.beginPos
		for(var j=0; j<i; j++){ //重新赋值
			_setInt(beginPos,this.stsc[j].firstChunk);
			_setInt(beginPos+4,this.stsc[j].samplesPerChunk);
			_setInt(beginPos+8,this.stsc[j].sampleDescriptionIndex);
			beginPos+=12;
			newStsc[newStsc.length] = {
				firstChunk: this.stsc[j].firstChunk,
				samplesPerChunk: this.stsc[j].samplesPerChunk,
				sampleDescriptionIndex: this.stsc[j].sampleDescriptionIndex
			}
		}
		for(; i<this.stsc.length; i++){ //重新赋值
			tmp = this.stsc[i].firstChunk-chunk+1;
			_setInt(beginPos,tmp);
			_setInt(beginPos+4,this.stsc[i].samplesPerChunk);
			_setInt(beginPos+8,this.stsc[i].sampleDescriptionIndex);
			beginPos+=12;
			newStsc[newStsc.length] = {
				firstChunk: tmp,
				samplesPerChunk: this.stsc[i].samplesPerChunk,
				sampleDescriptionIndex: this.stsc[i].sampleDescriptionIndex
			}
		}
		//rebuild-stsz
		beginPos = this.stsz.beginPos;
		for(var i=0; i<this.stsz.length-(sample-1); i++){ //重新赋值
			_setInt(beginPos,this.stsz[i+sample-1]);
			beginPos+=4;
			newStsz[newStsz.length] = this.stsz[i+sample-1];
		}
		for(; i<this.stsz.length; i++){ //清空尾部多余数据
			_clearInt(beginPos);
			beginPos+=4;
		}
		//rebuild-stco
		beginPos = this.stco.beginPos;
		var samples = 0, preSamples=0;
		cIndex = 0;
		tmp = this.meta.byteLength;
		for(var i=1; i<=this.stco.length-(chunk-1); i++){ //重新赋值
			_setInt(beginPos,tmp);
			newStco[newStco.length] = tmp;
			beginPos+=4;
			preSamples = samples;
			if(cIndex==newStsc.length-1 || i+1<=(newStsc[cIndex+1].firstChunk-1)*newStsc[cIndex].samplesPerChunk){
				samples+=newStsc[cIndex].samplesPerChunk;
			}else{
				cIndex++;
				samples+=newStsc[cIndex].samplesPerChunk;
			}
			if(i==this.stco.length-(chunk-1)){
				break;
			}else{
				for(; preSamples<samples; preSamples++){
					tmp+=newStsz[preSamples];
				}
			}
		}

		//设置音频数据大小
		_setInt(this.meta.byteLength-8, this.sizes.fileSize);

		function _setInt(beginPos,value){ //赋值4位整数
			var tmp = 0;
			uint8Array[beginPos] = (value/(1<<24))>>0;
			tmp = value - (uint8Array[beginPos]<<24);
			uint8Array[beginPos+1] = (tmp/(1<<16))>>0;
			tmp -= uint8Array[beginPos+1]<<16;
			uint8Array[beginPos+2] = (tmp/(1<<8))>>0;
			tmp -= uint8Array[beginPos+2]<<8;
			uint8Array[beginPos+3] = tmp;
			
		}
		function _clearInt(beginPos){ //清楚4位整数
			uint8Array[beginPos] = 0;
			uint8Array[beginPos+1] = 0;
			uint8Array[beginPos+2] = 0;
			uint8Array[beginPos+3] = 0;
		}

		return offset;
	}
	return M4aInfo;
})