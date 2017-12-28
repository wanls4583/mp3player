/**
 * MP3音频比例因子模块
 */
define(function(require, exports, module) {
    'use strict';

    var bitStream = null;
    var sideInfo = null; 
    var offset = 0; //比例因子数据偏移量

    var slen0 = [ 0, 0, 0, 0, 3, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4 ];  
    var slen1 = [ 0, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 1, 2, 3, 2, 3 ];

    function ScaleFactor(_bitstream, _sideInfo){
        sideInfo = _sideInfo;
        offset = sideInfo.parseSideInfo();
        sideInfo.part2_length = [[],[]];
        bitStream = _bitstream;
        sideInfo.scfL = [[],[]]; // [2][23];
        sideInfo.scfS = [[[],[]],[[],[]]]; // [2][3][13];
    }

    var _proto_ = ScaleFactor.prototype;

    _proto_.parseScaleFactors = function(gr, ch){
        if(!offset){
            return false;
        }
        var scale_comp = sideInfo.scalefac_compress[gr][ch];  
        var length0 = slen0[scale_comp];  
        var length1 = slen1[scale_comp];  
        var sfb, win;
        var l = sideInfo.scfL[ch];  
        var s = sideInfo.scfS[ch];
        sideInfo.part2_length[gr][ch] = 0;  
      
        if (sideInfo.window_switching_flag[gr][ch] != 0 && sideInfo.block_type[gr][ch] == 2) {  
            if (sideInfo.mixed_block_flag[gr][ch] != 0) {  
                // MIXED block  
                sideInfo.part2_length[gr][ch] = 17 * length0 + 18 * length1;  
                for (sfb = 0; sfb < 8; sfb++)  
                    l[sfb] = bitStream.getBits(length0);  
      
                for (sfb = 3; sfb < 6; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = bitStream.getBits(length0);  
      
                for (sfb = 6; sfb < 12; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = bitStream.getBits(length1);  
            } else {  
                // pure SHORT block  
                sideInfo.part2_length[gr][ch] = 18 * (length0 + length1);  
                for (sfb = 0; sfb < 6; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = bitStream.getBits(length0);  
                for (sfb = 6; sfb < 12; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = bitStream.getBits(length1);  
            }  
        } else {  
            // LONG types 0,1,3  
            var scfsi = sideInfo.scfsi[ch];  
            if (gr == 0) {  
                sideInfo.part2_length[gr][ch] = 10 * (length0 + length1) + length0;  
                for (sfb = 0; sfb < 11; sfb++)  
                    l[sfb] = bitStream.getBits(length0);  
                for (sfb = 11; sfb < 21; sfb++)  
                    l[sfb] = bitStream.getBits(length1);  
            } else {  
                sideInfo.part2_length[gr][ch] = 0;  
                if (scfsi[0] == 0) {  
                    for (sfb = 0; sfb < 6; sfb++)  
                        l[sfb] = bitStream.getBits(length0);  
                    sideInfo.part2_length[gr][ch] += 6 * length0;  
                }  
                if (scfsi[1] == 0) {  
                    for (sfb = 6; sfb < 11; sfb++)  
                        l[sfb] = bitStream.getBits(length0);  
                    sideInfo.part2_length[gr][ch] += 5 * length0;  
                }  
                if (scfsi[2] == 0) {  
                    for (sfb = 11; sfb < 16; sfb++)  
                        l[sfb] = bitStream.getBits(length1);  
                    sideInfo.part2_bits[gr][ch] += 5 * length1;  
                }  
                if (scfsi[3] == 0) {  
                    for (sfb = 16; sfb < 21; sfb++)  
                        l[sfb] = bitStream.getBits(length1);  
                    sideInfo.part2_length[gr][ch] += 5 * length1;  
                }  
            }  
        }
        return bitStream;
    }

    _proto_.getSideInfo = function(){
        return sideInfo;
    }
    return ScaleFactor;
})
