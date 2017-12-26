/**
 * MP3音频帧边信息模块
 */
define(function(require, exports, module) {
    'use strict';

    var BitStream = require('../common/bitstream');

    var bitStream = null;
    var main_data_begin = 0; //主数据开始位置偏移量(<=0)
    var private_bits = 0; //私有位(ISO在以后将不适用这些位)
    var scfsi = []; //scfsi[ch][scfsi_band]，scfsi控制着比例因子到颗粒中的使用
    var part2_3_length = []; //part2_3_length[gr][ch]，该值包含了主数据中比例因子和哈弗曼编码使用的比特数
    var bit_values = []; //bit_values[gr][ch]，大值区域个数
    var global_gain= []; //global_gain[gr][ch]，量化步长
    var scalefac_compress = []; //scalefac_compress[gr][ch]，用来选择比例因子所使用的比特位个数
    var window_switching_flag = []; //window_switching_flag[gr][ch]，用来表示使用了不是标准窗(type 0)的标志
    var block_type = []; //block_type[gr][ch]，指出实际颗粒的加窗函数类型
    var mixed_block_flag = []; //mixed_block_flag[gr][ch]，窗转换类型标志
    var table_select = []; //table_select[gr][ch][region]，哈弗曼编码表选择信息
    var subblock_gain = []; //subblock_gain[gr][ch][windwo]，子块增益偏移
    var region0_count = []; //region0_count[gr][ch]，bit_values区域细分
    var region1_count = []; //region1_count[gr][ch]，bit_values区域细分
    var preflag = []; //preflag[gr][ch]，量化相关标志
    var scalefac_scale = []; //scalefac_scale[gr][ch]，比例因子乘数
    var count1table_select = []; //count1table_select[gr][ch]，count1区域哈弗曼编码表选择信息

    function SideInfo(arrayBuffer){

    }
})