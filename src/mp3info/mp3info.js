/**
 * MP3音频信息解析模块
 * http://wiki.hydrogenaud.io/index.php?title=APEv2_specification
 * http://www.docin.com/p-1261649617.html
 * https://www.codeproject.com/Articles/8295/MPEG-Audio-Frame-Header
 *
 * audioInfo需要包括的字段:{
 *      fileSize: 音频文件大小(byte),
 *      frameSync: 同步头（16进制字符串）,
 *      duration: 总时长（秒）,
 *      sampleRate: 采样率,
 *      audioDataOffset: audioData开始偏移量（相对于0字节位置）,
 *      totalSize: audioData总大小（仅当音频码率模式为VBR时返回）,
 *      toc: 音频数据索引表（仅当音频码率模式为VBR时返回）   
 * }
 */

import requestRange from '../common/range';
import bitStream from '../common/bitstream';
import Util from '../common/util';
import Mp3Header from './header';
import Mp3Id3Tag from './id3tag';

//MP3播放信息解析对象
var MP3Info = {
    init: function(url, opt) {
        var self = this;
        var emptyFun = function() {};
        this.url = url;
        this.decrypt = this.onloadedmetadata = emptyFun;
        this.indexSize = 100; //分区数，默认100
        this.audioInfo = {}; //存储mp3相关的信息
        if (typeof opt == 'object') {
            opt.decrypt && (this.decrypt = opt.decrypt);
            opt.onloadedmetadata && (this.onloadedmetadata = opt.onloadedmetadata);
            opt.indexSize && (this.indexSize = opt.indexSize);
        }
        return new Promise(function(resolve, reject) {
            self._loadHeaderInfo(resolve, reject);
        }).then(function() {
            return self._loadFirstFrame();
        }).then(function(arrayBuffer) {
            var header = new Mp3Header(new bitStream(arrayBuffer));
            var result = header.parseHeader(true);
            if (result) {
                self.audioInfo.toc = header.toc;
                self.audioInfo.totalSize = header.totalBytes;
                self.audioInfo.sampleRate = header.sampleRate;
                self.audioInfo.frameSync = header.frameSync;
                self.audioInfo.duration = header.totalDuration;
                self.audioInfo.bitRate = header.bitRate;
                if (!self.audioInfo.toc) { //cbr模式
                    return self._getFooterLength();
                } else {
                    self.onloadedmetadata(self.audioInfo.duration);
                    return self.audioInfo;
                }
            } else {
                return false;
            }
        });
    },
    //ajax获取音频头部标签头(32B)
    _loadHeaderInfo: function(resolve, reject) {
        var self = this;
        requestRange(self.url, 0, 32 * 8 + 32 * 8 - 1, {
            onsuccess: function(request) { //加载前32个字节（判断是否存在ID3V2|Ape头）
                var arrayBuffer = request.response;
                var contetnRange = request.getResponseHeader('Content-Range');
                var length = 0;
                var id3tag = null;
                self.decrypt(arrayBuffer); //解密
                id3tag = new Mp3Id3Tag(arrayBuffer);
                self.audioInfo.audioDataOffset = id3tag.parseId3V2() + id3tag.parseApe();
                self.audioInfo.fileSize = parseInt(contetnRange.substr(contetnRange.indexOf('/') + 1));
                resolve();
            }
        });
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
    //获取尾部额外信息长度（可能存在id3v1或者ape信息）
    _getFooterLength: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            requestRange(self.url, self.audioInfo.fileSize - (128 + 32), self.audioInfo.fileSize - 1, {
                onsuccess: function(request) {
                    var arrayBuffer = request.response;
                    var id3tag = null;
                    var length = 0;
                    self.decrypt(arrayBuffer); //解密
                    id3tag = new Mp3Id3Tag(arrayBuffer);
                    self.audioInfo.footerLength = id3tag.parseId3V1() + id3tag.parseApe();
                    self.audioInfo.totalSize = self.audioInfo.fileSize - self.audioInfo.audioDataOffset - self.audioInfo.footerLength;
                    self.audioInfo.duration = self.audioInfo.totalSize * 8 / self.audioInfo.bitRate;
                    self.onloadedmetadata(self.audioInfo);
                    resolve(self.audioInfo);
                }
            })
        })
    }
}

export default MP3Info;