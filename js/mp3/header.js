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
    var MAX_TAG_OFF = 10 * 1024; //查找帧头，最多查找10K

    var bitStream = null;
    var hasParseVbr = false;

    function Header(arrayBuffer){
        this.init(arrayBuffer);
    }

    var _proto_ = Header.prototype;

    /**
     * 初始化
     * @param  {object} arrayBuffer 二进制数组
     */
    _proto_.init = function(_bitStream){
        bitStream = _bitStream;
    }
    /**
     * 解析帧头信息
     * @return object 比特流
     */
    _proto_.parseHeader = function(){
        var mask = 0;
        do{
            mask = bitStream.getBits(11); //获取11位同步头
            if(mask != HEADER_MASK){
                if(bitStream.isEnd()){
                    break;
                }
                bitStream.rewindBits(3);
                continue;
            }
            this.verID = bitStream.getBits(2); //MPEG版本
            this.layer = bitStream.getBits(2); //MPEG层数
            this.protectionBit = bitStream.getBits(1); //保护位
            if(!this.frameSync){
                bitStream.rewindBytes(2);
                this.frameSync = bitStream.getBits(8).toString(16)+','+bitStream.getBits(8).toString(16);
                this.frameSync = this.frameSync.toUpperCase(); //同步头
            }
            this.bitrateIndex = bitStream.getBitsStr(4);
            this.bitRate = bitRateMap[this.bitrateIndex]; //比特率
            this.sampleRateIndex = bitStream.getBitsStr(2);
            this.sampleRate = sampleRateMap[this.sampleRateIndex]; //采样路索引
            this.paddingBit = bitStream.getBits(1); //填充位
            this.privateBit = bitStream.getBits(1); //私有位
            this.channelMode = bitStream.getBits(2); //声道模式
            this.channelModeExtension = bitStream.getBits(2); //声道扩展模式
            this.copyright = bitStream.getBits(1); //版权
            this.original = bitStream.getBits(1); //填充位
            this.emphasis = bitStream.getBits(2); //强调

            if(this.verID!=MPEG1 || this.layer!=LAYER3){
                return false;
            }

            this.frameSize  = bitRateMap[this.bitrateIndex] * 1152/8;
            this.frameSize /= sampleRateMap[this.sampleRateIndex];
            this.frameSize += this.paddingBit; //帧长度
            this.sideInfoSize = (this.channelMode == 3) ? 17 : 32; //帧边信息长度
            this.duration = 1152/sampleRateMap[this.sampleRateIndex]; //本帧时长

            //计算主数据长度
            this.mainDataSize = (this.frameSize - 4 - this.sideInfoSize)>>0; //主数据长度
            if(this.protectionBit == 0)
                this.mainDataSize -= 2;  //CRC
            break;

        }while(bitStream.getBytePos() < MAX_TAG_OFF);

        if(bitStream.getBytePos() >= MAX_TAG_OFF){
            return false;
        }

        if(!hasParseVbr){
            hasParseVbr = true;
            this.parseVbr();
            if(this.toc){
                this.totalDuration = this.totalFrames*1152/sampleRateMap[this.sampleRateIndex]; //总时长
            }
        }
        return bitStream;
    }
    /**
     * 解析vbr信息
     */
    _proto_.parseVbr = function(){
        var flags = 0;
        var tag = '';
        bitStream.reset(); //指针指向头部

        do{
            tag = String.fromCharCode(bitStream.getByte(), bitStream.getByte(), bitStream.getByte(), bitStream.getByte());
            if(tag == 'Xing' || tag == 'Info'){ //Xing，Info头
                this.tocSize = 100; //vbr索引表长度
                flags = bitStream.getBits(32);
                if(flags & 1){
                    this.totalFrames = bitStream.getBits(32); //总帧数
                }
                if(flags & 2){
                    this.totalBytes = bitStream.getBits(32); //总长度
                }
                if(flags & 4){
                    this.toc = []; //vbr索引表
                    for(var i=0; i<this.tocSize; i++){
                        this.toc[i] = bitStream.getByte();
                    }
                }
                return bitStream;
            }else if(tag == 'VBRI'){ //VBRI头
                bitStream.skipBytes(6);
                this.totalBytes = bitStream.getBits(32);
                this.totalFrames = bitStream.getBits(32);
                this.tocSize = bitStream.getBits(16);
                bitStream.skipBytes(6);
                this.toc = [];
                for(var i=0; i<tocSize; i++){
                    this.toc[i] = bitStream.getByte();
                }
                return bitStream;
            }else{
                if(bitStream.isEnd()){
                    break;
                }
                bitStream.rewindBytes(3);
            }
        }while(tag!='Xing' && tag != 'Info' && tag != 'VBRI' && bitStream.getBytePos() < MAX_TAG_OFF)

        return false;
    }
    return Header;
})