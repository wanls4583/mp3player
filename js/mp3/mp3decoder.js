/**
 * mp3解码模块
 */
define(function(require, exports, module){
	'use strict';

	var Bitstream = require('../common/bitstream');
	var Header = require('./header');
	var SideInfo = require('./sideInfo');
	var ScalleFactor = require('./scalefactor');
	var Huffman = require('./huffman');
	var Requantizer = require('./requantizer');
	var Stereo = require('./stereo');
	var Antialias = require('./antialias');
	var Imdct = require('./imdct');

	var channels = 0;
	var preBlckCh0 = [];
	var preBlckCh1 = [];

	function Mp3Decoder(arrayBuffer){
		this.mainDataBitstream = new Bitstream(4096+512); //主数据位流缓冲区初始化
		this.init(arrayBuffer);
	}

	var _proto_ = Mp3Decoder.prototype;

	_proto_.init = function(arrayBuffer){
		this.bitStream = new Bitstream(arrayBuffer);
		this.header = new Header(this.bitStream);
		this.sideInfo = new SideInfo(this.bitStream, this.header);
		this.scalleFactor = new ScalleFactor(this.mainDataBitstream, this.sideInfo);
		this.huffman = new Huffman(this.mainDataBitstream, this.header, this.sideInfo);
		this.requantizer = new Requantizer(this.sideInfo, this.header);
		this.stereo = new Stereo(this.sideInfo);
		this.antialias = new Antialias(this.sideInfo);
		this.imdct = new Imdct(this.sideInfo);
		for(var i=0; i<18; i++){
			preBlckCh0[i] = 0;
			preBlckCh1[i] = 0;
		}
	}

	_proto_.decodeFrame = function(){
		var huffv = null; //哈夫曼解码结果
		var xrch = null; //存储处理结果
		var self = this;
		var begin = new Date().getTime();
		function _decode(resolve){
			if(!self.header.parseHeader()){
				console.log('decode cost:', new Date().getTime() - begin, 'ms');
				resolve();
				return;
			}
			self.sideInfo.parseSideInfo();
			self.mainDataBitstream.skipBytes(self.mainDataBitstream.end - self.sideInfo.main_data_begin); //跳过垃圾数据
			self.mainDataBitstream.append(self.mainDataBitstream.slice(self.mainDataBitstream.getBytePos(),self.mainDataBitstream.getBytePos()+self.header.mainDataSize));
			self.bitStream.skipBytes(self.header.mainDataSize);
			if (self.header.channelMode == 3){
	            channels = 1;
	            huffv = [[],[]]; //huffv[2][1]
	            xrch = [[],[]]; //xrch[2][1]
	        }else{
	            channels = 2;
	            huffv = [[[],[]],[[],[]]]; //huffv[2][2]
	            xrch = [[[],[]],[[],[]]]; //xrch[2][2]
	        }
			for(var gr=0; gr<2; gr++){ //2个颗粒
				for(var ch=0; ch<channels; ch++){
					self.scalleFactor.parseScaleFactors(gr, ch); //解码比例因子
					huffv[gr][ch] = self.huffman.huffmanDecode(gr, ch); //解码huffman编码
					xrch[gr][ch] = self.requantizer.doRequantizer(gr, ch, huffv[gr][ch]); //逆量化与重排序
				}
				if(channels==2 && (self.header.channelModeExtension == 2 || self.header.channelModeExtension == 3)){
					self.stereo.ms_stereo(gr, xrch[gr]); //立体声处理
				}
				self.antialias.doAntialias(gr, 0, xrch[gr][0]); //消混叠处理
				
				self.imdct.hybrid(gr, 0, xrch[gr][0], preBlckCh0);//子带混合处理

				if (channels == 2) {
					self.antialias.doAntialias(gr, 1, xrch[gr][1]);
					self.imdct.hybrid(gr, 1, xrch[gr][1], preBlckCh1);
				}
			}
			setTimeout(function(){
				_decode(resolve);
			},10);
		}
		return new Promise(_decode);
	}

	return Mp3Decoder;
})