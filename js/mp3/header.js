/**
 * MP3音频帧头信息模块
 * http://www.docin.com/p-1261649617.html
 * https://www.codeproject.com/Articles/8295/MPEG-Audio-Frame-Header
 */
define(function(require, exports, module) {
    'use strict';

    var BitStream = require('../common/bitstream');

    //比特率对应表(bit/s) MEPG1.0 LayerIII
    var bitRateMap = {
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
    //采样率对应表(Hz) MEPG1.0 LayerIII
    var sampleRateMap = {
        '0': 44100,
        '1': 48000,
        '10': 32000
    }
    
    var HEADER_MASK = 0xffe0>>5; //同步头
    var MPEG1 = 3;
    var LAYER3 = 1;

    var bitStream = null;
    /*帧头信息--BEGIN*/
    var verID = 0; //MPEG版本
    var layer = 0; //MPEG层数
    var protectionBit = 0; //保护位
    var bitrateIndex = 0; //比特率索引
    var sampleRateIndex = 0; //采样路索引
    var paddingBit = 0; //填充位
    var privateBit = 0; //私有位
    var channelMode = 0; //声道模式
    var channelModeExtension = 0; //立体声扩展模式 
    var copyright = 0; //是否有版权信息
    var original = 0; //是否是原始版本
    var emphasis = 0; //强调
     /*帧头信息--END*/

    var sideInfoSize = 0; //帧边信息长度
    var framesize = 0; //帧长度
    var maindatasize = 0; //主数据长度

    /*vbr信息--BEGIN*/    
    var totalFrames = 0; //总的数据帧数
    var totalBytes = 0; //总的数据字节数
    var tocSize = 0; //索引表长度
    var toc = null; //vbr索引表
    /*vbr信息--BEGIN*/

    var duration = 0; //播放时长

    function Header(arrayBuffer){
        bitStream = new BitStream(arrayBuffer);
    }

    var _proto_ = Header.prototype;

    /**
     * 解析帧头信息
     */
    _proto_.parseHeader = function(){
        bitStream.reset(); //指针指向头部
        var mask = 0;
        do{
            mask = bitStream.getBits(11); //获取是11位同步头
            console.log(mask.toString(2),bitStream.getBytePos(),bitStream.getBitPos());
            if(mask != HEADER_MASK){
                bitStream.skipBits(5);
                continue;
            }
            verID = bitStream.getBits(2);
            layer = bitStream.getBits(2);
            protectionBit = bitStream.getBits(1);
            bitrateIndex = bitStream.getBits(4);
            sampleRateIndex = bitStream.getBits(2);
            paddingBit = bitStream.getBits(1);
            privateBit = bitStream.getBits(1);
            channelMode = bitStream.getBits(2);
            channelModeExtension = bitStream.getBits(2);
            copyright = bitStream.getBits(1);
            original = bitStream.getBits(1);
            emphasis = bitStream.getBits(2);

            if(verID!=MPEG1 || layer!=LAYER3){
                throw Error('不是mp3文件');
            }

            framesize  = bitRateMap[bitrateIndex] * 1152/8;
            framesize /= sampleRateMap[sampleRateIndex];
            framesize += paddingBit;
            sideinfosize = (channelMode == 3) ? 17 : 32;

            //计算主数据长度
            maindatasize = framesize - 4 - sideinfosize;
            if(protectionBit == 0)
                maindatasize -= 2;  //CRC
            break;

        }while(!bitStream.isEnd())
    }
    /**
     * 解析vbr信息
     */
    _proto_.parseVbr = function(){
        var flags = 0;
        bitStream.reset(); //指针指向头部
        bitStream.skipBytes(4+sideInfoSize);
        var tag = String.fromCharCode(bitStream.getByte(), bitStream.getByte(), bitStream.getByte(), bitStream.getByte());
        if(tag == 'Xing' || tag == 'Info'){ //Xing，Info头
            tocSize = 100;
            flags = bitStream.getBits(32);
            if(flags & 1){
                totalFrames = bitStream.getBits(32);
            }
            if(flags & 2){
                totalBytes = bitStream.getBits(32);
            }
            if(flags & 4){
                toc = [];
                for(var i=0; i<tocSize; i++){
                    toc[i] = bitStream.getByte();
                }
            }
        }else if(tag == 'VBRI'){ //VBRI头
            bitStream.skipBytes(6);
            totalBytes = bitStream.getBits(32);
            totalFrames = bitStream.getBits(32);
            tocSize = bitStream.getBits(16);
            bitStream.skipBytes(6);
            toc = [];
            for(var i=0; i<tocSize; i++){
                toc[i] = bitStream.getByte();
            }
        }else{
            return;
        }
    }
    /*帧头信息--BEGIN*/
    _proto_.getVerID = function(){
        return verID;
    }
    _proto_.getLayer = function(){
        return layer;
    }
    _proto_.getProtectionBit = function(){
        return protectionBit;
    }
    _proto_.getBitrate = function(){
        return bitRateMap[bitrateIndex];
    }
    _proto_.getSampleRate = function(){
        return sampleRateMap[sampleRateIndex];
    }
    _proto_.getPaddingBit = function(){
        return paddingBit;
    }
    _proto_.getPrivateBit = function(){
        return privateBit;
    }
    _proto_.getChannelMode = function(){
        return channelMode;
    }
    _proto_.getChannelModeExtension = function(){
        return channelModeExtension;
    }
    _proto_.getCopyright = function(){
        return copyright;
    }
    _proto_.getOriginal = function(){
        return original;
    }
    _proto_.getEmphasis = function(){
        return emphasis;
    }
    /*帧头信息--END*/

    _proto_.getSideInfoSize = function(){
        return sideInfoSize;
    }
    _proto_.getFramesize = function(){
        return framesize;
    }
    _proto_.getMaindatasize = function(){
        return maindatasize;
    }

    /*vbr信息--BEGIN*/
    _proto_.getTotalFrames = function(){
        return totalFrames;
    }
    _proto_.getTotalBytes = function(){
        return totalBytes;
    }
    _proto_.getTocSize = function(){
        return tocSize;
    }
    _proto_.getToc = function(){
        return toc;
    }
    /*vbr信息--END*/

    return Header;
})