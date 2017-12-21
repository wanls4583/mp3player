/**
 * MP3音频信息解析模块
 * http://wiki.hydrogenaud.io/index.php?title=APEv2_specification
 * http://www.docin.com/p-1261649617.html
 * https://www.codeproject.com/Articles/8295/MPEG-Audio-Frame-Header
 *
 * audioInfo需要包括的字段:{
 * 		fileSize: 音频文件大小(byte),
 * 		frameSync: 同步头（16进制字符串）,
 * 		totalTime: 总时长（秒）,
 * 		sampleRate: 采样率,
 * 		audioDataOffset: audioData开始偏移量（相对于0字节位置）,
 * 		totalSize: audioData总大小（仅当音频码率模式为VBR时返回）,
 *   	toc: 音频数据索引表（仅当音频码率模式为VBR时返回）	
 * }
 */
define(function(require, exports, module) {
    'use strict';

    var requestRange = require('./request-range');
    var Util = require('./Util');
    //MP3播放信息解析对象
    var MP3InfoAnalysis = {
        init: function(url, opt) {
        	var self = this;
        	var emptyFun = function(){};
        	this.url = url;
        	this.decrypt = this.loadedmetaCb = emptyFun;
        	this.indexSize = 100; //分区数，默认100
            this.audioInfo = {}; //存储mp3相关的信息
        	if(typeof opt == 'object'){
        		opt.decrypt && (this.decrypt = opt.decrypt);
        		opt.loadedmetaCb && (this.loadedmetaCb = opt.loadedmetaCb);
        		opt.indexSize && (this.indexSize = opt.indexSize);
        	}
            return new Promise(function(resolve, reject){
            	self._loadHeaderInfo(resolve, reject);
            }).then(function(){
            	return self._loadFirstFrame();
            }).then(function(arrayBuffer){
            	return self._getInfo(arrayBuffer);
            });
        },
        //ajax获取音频头部标签头(32B)
        _loadHeaderInfo: function(resolve, reject) {
            var self = this;
            requestRange(self.url, 0, 32 * 8 - 1, {
            	onsuccess: function(request) { //加载前32个字节（判断是否存在ID3V2头）
	                var arrayBuffer = request.response;
	                var contetnRange = request.getResponseHeader('Content-Range');
	                var length = 0;

	                self.decrypt(arrayBuffer); //解密
	                length = self._getHeaderLength(arrayBuffer);
	                self.audioInfo.audioDataOffset = length;
	                self.audioInfo.fileSize = parseInt(contetnRange.substr(contetnRange.indexOf('/') + 1));

	                requestRange(self.url, 32 * 8, 32 * 8 + 32 * 8 - 1,{
	                	onsuccess:  function(request) { //再加载前32个字节（判断是否存在APEV2头）
		                    arrayBuffer = request.response;
		                    length = self._getHeaderLength(arrayBuffer);
		                    self.audioInfo.audioDataOffset += length;
		                    resolve();
		                }
	                });
	            }
            });
        },
        //获取ID3V2|APEV2标签长度
        _getHeaderLength: function(arrayBuffer) {
            var uint8Array = new Uint8Array(arrayBuffer);
            var audioDataOffset = 0;
            var tag = '';
            var type = '';
            for (var i = 0; i < 8; i++) {
                tag += String.fromCharCode(uint8Array[i])
            }
            if (tag.substring(0, 3) == 'ID3') {
                audioDataOffset = (((uint8Array[6] & 0x7F) << 21) | ((uint8Array[7] & 0x7F) << 14) | ((uint8Array[8] & 0x7F) << 7) | (uint8Array[9] & 0x7F)) + 10;
            } else if (tag == 'APETAGEX') {
                audioDataOffset = ((uint8Array[12]) | (uint8Array[13] << 8) | (uint8Array[14] << 16) | (uint8Array[15] << 24)) + 32;
            }
            return audioDataOffset;
        },
        //加载第一个数据帧(用来判断音频码率模式)
        _loadFirstFrame: function(resolve, reject) {
            var self = this;
            return new Promise(function(resolve, reject) {
                requestRange(self.url, self.audioInfo.audioDataOffset, self.audioInfo.audioDataOffset + 156 * 8 - 1, {
                	onsuccess: function(request) {
                    var arrayBuffer = request.response;

	                    self.decrypt(arrayBuffer); //解密
	                    resolve(arrayBuffer);
	                }
                })
            })
        },
        //获取VBR(OR CBR)信息
        _getInfo: function(arrayBuffer) {
            var self = this;
            var bufferStr = '';
            var uint8Array = null;
            var vbrDataBuffer = null;
            var bitRate = this._getBitRate(arrayBuffer);
            var sampleRate = this._getSampleRate(arrayBuffer);
            var headerFlag = '';
            this.audioInfo.sampleRate = sampleRate;
            bufferStr = Util.arrayBufferToHexChar(arrayBuffer.slice(0,2)); //转换成16进制码
            this.audioInfo.frameSync = bufferStr.toUpperCase(); //数据帧开始标识
            headerFlag = this._hasVbrHeader(arrayBuffer);
            if (headerFlag != -1) { //存在Info头或者Xing头
                this.audioInfo.audioDataOffset += Util.getLengthByFrameSync(arrayBuffer, this.audioInfo.frameSync, 10); //音频数据不需要VBR数据帧(兼容ios)
                vbrDataBuffer = arrayBuffer.slice(headerFlag / 3);
                _getInfo(vbrDataBuffer);
                this.loadedmetaCb(this.audioInfo); //元数据请求完毕回调
                return this.audioInfo;
            } else { //纯CBR编码
                var totalTime = (this.audioInfo.fileSize - this.audioInfo.audioDataOffset) / bitRate * 8;
                this.audioInfo.totalTime = totalTime;
                this.loadedmetaCb(this.audioInfo); //元数据请求完毕回调
                return this.audioInfo;
            }
            //获取总帧数
            function _getTotalFrame(vbrDataBuffer) {
                vbrDataBuffer = vbrDataBuffer.slice(0, 12);
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 1) {
                    return (vbrUint8Array[8] << 24) + (vbrUint8Array[9] << 16) + (vbrUint8Array[10] << 8) + (vbrUint8Array[11]);
                } else
                    return false;
            }
            //获取数据帧总大小(byte)
            function _getTotalSize(vbrDataBuffer) {
                vbrDataBuffer = vbrDataBuffer.slice(0, 16);
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 2) {
                    if (vbrUint8Array[7] & 1 == 0) {
                        return (vbrUint8Array[8] << 24) + (vbrUint8Array[9] << 16) + (vbrUint8Array[10] << 8) + (vbrUint8Array[11]);
                    } else {
                        return (vbrUint8Array[12] << 24) + (vbrUint8Array[13] << 16) + (vbrUint8Array[14] << 8) + (vbrUint8Array[15]);
                    }
                } else
                    return false;
            }
            //获取帧索引数组(100个)
            function _getToc(vbrDataBuffer) {
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 4) {
                    if (!(vbrUint8Array[7] & 1) && !(vbrUint8Array[7] & 2)) {
                        return _getToc_(vbrDataBuffer.slice(8));
                    } else if ((vbrUint8Array[7] & 1) && !(vbrUint8Array[7] & 2) || !(vbrUint8Array[7] & 1) && (vbrUint8Array[7] & 2)) {
                        return _getToc_(vbrDataBuffer.slice(12));
                    } else {
                        return _getToc_(vbrDataBuffer.slice(16));
                    }
                }

                function _getToc_(docArrayBuffer) {
                    var indexArr = [];
                    var docuUnit8Array = new Uint8Array(docArrayBuffer.slice(0, self.indexSize));
                    for (var i = 0; i < 100; i++) {
                        indexArr[i] = docuUnit8Array[i];
                    }
                    return indexArr;
                }
            }

            function _getInfo(vbrDataBuffer) {
                var totalFrame = _getTotalFrame(vbrDataBuffer);
                self.audioInfo.totalTime = 1152 * totalFrame / sampleRate;
                self.audioInfo.totalSize = _getTotalSize(vbrDataBuffer);
                self.audioInfo.toc = _getToc(vbrDataBuffer);
                return self.audioInfo;
            }
        },
        //是否存在Info头或者Xing头
        _hasVbrHeader: function(arrayBuffer) {
            var bufferStr = Util.arrayBufferToHexChar(arrayBuffer.slice(0,100));
            bufferStr = bufferStr.toUpperCase();
            if (bufferStr.indexOf('49,6E,66,6F') != -1) { //存在Info头
                return bufferStr.indexOf('49,6E,66,6F');
            } else if (bufferStr.indexOf('58,69,6E,67') != -1) { //存在Xing头
                return bufferStr.indexOf('58,69,6E,67');
            }
            return -1;
        },
        //获取比特率
        _getBitRate: function(arrayBuffer) {
            //比特率对应表(bit/s)
            var brMap = {
                '1': 32000,
                '10': 40000,
                '11': 48000,
                '100': 56000,
                '101': 64000,
                '110': 80000,
                '111': 96000,
                '1000': 112000,
                '1001': 128000,
                '1010': 160000,
                '1011': 192000,
                '1100': 224000,
                '1101': 256000,
                '1110': 320000
            }
            var uint8Array = new Uint8Array(arrayBuffer);
            var brCode = (uint8Array[2] >> 4).toString(2);
            return brMap[brCode];
        },
        //获取采样率
        _getSampleRate: function(arrayBuffer) {
            //比特率对应表(Hz)
            var srMap = {
                '0': 44100,
                '1': 48000,
                '10': 32000,
            }
            var uint8Array = new Uint8Array(arrayBuffer);
            var srCode = (uint8Array[2] & 0x0C).toString(2).substring(0, 2);
            return srMap[srCode];
        },
        //获取第一帧填充数
        _getPadding: function(arrayBuffer) {
            var uint8Array = new Uint8Array(arrayBuffer);
            var pdCode = (uint8Array[2] & 0x02).toString(2);
            if (pdCode == '1') {
                return 1;
            } else {
                return 0;
            }
        },
        //获取帧大小(bit)
        _getFrameSize: function(arrayBuffer) {
            var sampleRate = this._getSampleRate(arrayBuffer);
            var bitRate = this._getBitRate(arrayBuffer);
            var padding = this._getPadding(arrayBuffer);
            return 1152 * bitRate / sampleRate / 8 + padding;
        }
    }
    return MP3InfoAnalysis;
})