/**
 * MP3音频帧边信息模块
 */
define(function(require, exports, module) {
    'use strict';

    var BitStream = require('../common/bitstream');
    
    var HEADER_MASK = 0xffe0 >> 5; //同步头
    var MAX_TAG_OFF = 10 * 1024; //查找帧头，最多查找10K
    var bitStream = null;
    var channels = 0; //声道数

    function SideInfo(arrayBuffer) {
        bitStream = new BitStream(arrayBuffer);
        /*帧变信息-BEGIN*/
        this.main_data_begin = 0; //主数据开始位置偏移量(<=0)
        this.private_bits = 0; //私有位(ISO在以后将不适用这些位)
        this.scfsi = []; //scfsi[ch][scfsi_band]，scfsi控制着比例因子到颗粒中的使用
        this.part2_3_length = [[],[]]; //part2_3_length[gr][ch]，该值包含了主数据中比例因子和哈弗曼编码使用的比特数
        this.big_values = [[],[]]; //bit_values[gr][ch]，大值区域个数
        this.global_gain = [[],[]]; //global_gain[gr][ch]，量化步长
        this.scalefac_compress = [[],[]]; //scalefac_compress[gr][ch]，用来选择比例因子所使用的比特位个数
        this.window_switching_flag = [[],[]]; //window_switching_flag[gr][ch]，用来表示使用了不是标准窗(type 0)的标志
        this.block_type = [[],[]]; //block_type[gr][ch]，指出实际颗粒的加窗函数类型
        this.mixed_block_flag = [[],[]]; //mixed_block_flag[gr][ch]，窗转换类型标志
        this.table_select = [[[],[]],[[],[]]]; //table_select[gr][ch][region]，哈弗曼编码表选择信息
        this.subblock_gain = [[[],[]],[[],[]]]; //subblock_gain[gr][ch][windwo]，子块增益偏移
        this.region0_count = [[],[]]; //region0_count[gr][ch]，bit_values区域细分
        this.region1_count = [[],[]]; //region1_count[gr][ch]，bit_values区域细分
        this.preflag = [[],[]]; //preflag[gr][ch]，量化相关标志
        this.scalefac_scale = [[],[]]; //scalefac_scale[gr][ch]，比例因子乘数
        this.count1table_select = [[],[]]; //count1table_select[gr][ch]，count1区域哈弗曼编码表选择信息
        /*帧变信息-END*/
    }

    var _proto_ = SideInfo.prototype;

    _proto_.parseSideInfo = function() {
        bitStream.reset(); //指针指向头部
        var mask = 0;
        var channelMode = 0;
        var offset = 0;
        channels = 0;
        do {
            mask = bitStream.getBits(11); //获取是11位同步头
            if (mask != HEADER_MASK) {
                if (bitStream.isEnd()) {
                    break;
                }
                bitStream.rewindBits(3);
                continue;
            }
            bitStream.skipBits(24 - 11);
            channelMode = bitStream.getBits(2);
            bitStream.skipBits(32 - 26);
            offset = bitStream.getBytePos();
            this.main_data_begin = bitStream.getBits(9);
            if (channelMode == 3){
                channels = 1;
                bitStream.getBits(5); //private_bits  
            }else{
                channels = 2;
                bitStream.getBits(3); //private_bits  
            }
            for (ch = 0; ch < channels; ch++) {
                this.scfsi[0] = bitStream.getBits1();
                this.scfsi[1] = bitStream.getBits1();
                this.scfsi[2] = bitStream.getBits1();
                this.scfsi[3] = bitStream.getBits1();
            }
            for (var gr = 0; gr < 2; gr++) {
                for (var ch = 0; ch < channels; ch++) {
                    this.part2_3_length[gr][ch] = bitStream.getBits(12);
                    this.big_values[gr][ch] = bitStream.getBits(9);
                    this.global_gain[gr][ch] = bitStream.getBits(8);
                    this.scalefac_compress[gr][ch] = bitStream.getBits(4);
                    this.window_switching_flag[gr][ch] = bitStream.getBits1();
                    if ((this.window_switching_flag[gr][ch]) != 0) {
                        this.block_type[gr][ch] = bitStream.getBits(2);
                        this.mixed_block_flag[gr][ch] = bitStream.getBits1();
                        this.table_select[gr][ch][0] = bitStream.getBits(5);
                        this.table_select[gr][ch][1] = bitStream.getBits(5);
                        this.subblock_gain[gr][ch][0] = bitStream.getBits(3);
                        this.subblock_gain[gr][ch][1] = bitStream.getBits(3);
                        this.subblock_gain[gr][ch][2] = bitStream.getBits(3);
                        if (this.block_type[gr][ch] == 0)
                            return false;
                        else if (this.block_type[gr][ch] == 2 && this.mixed_block_flag[gr][ch] == 0)
                            this.region0_count[gr][ch] = 8;
                        else
                            this.region0_count[gr][ch] = 7;
                        this.region1_count[gr][ch] = 20 - this.region0_count[gr][ch];
                    } else {
                        this.table_select[gr][ch][0] = bitStream.getBits(5);
                        this.table_select[gr][ch][1] = bitStream.getBits(5);
                        this.table_select[gr][ch][2] = bitStream.getBits(5);
                        this.region0_count[gr][ch] = bitStream.getBits(4);
                        this.region1_count[gr][ch] = bitStream.getBits(3);
                        this.block_type[gr][ch] = 0;
                    }
                    this.preflag[gr][ch] = bitStream.getBits1();
                    this.scalefac_scale[gr][ch] = bitStream.getBits1();
                    this.count1table_select[gr][ch] = bitStream.getBits1();
                }
            }
            if(channelMode==3){
                offset+=17;
            }else{
                offset+=32;
            }
            return offset; //返回偏移量位置，拱后续解析比例因子

        } while (bitStream.getBytePos() < MAX_TAG_OFF);

        return false;
    }

    return SideInfo;
})
