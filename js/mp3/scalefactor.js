/**
 * MP3音频比例因子模块
 */
define(function(require, exports, module) {
    'use strict';

    var slen0 = [ 0, 0, 0, 0, 3, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4 ];  
    var slen1 = [ 0, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 1, 2, 3, 2, 3 ];

    function ScaleFactor(_bitstream, _sideInfo){
        this.init(_bitstream, _sideInfo);
    }

    var _proto_ = ScaleFactor.prototype;

    _proto_.init = function(_bitstream, _sideInfo){
        this.sideInfo = _sideInfo;
        this.sideInfo.part2_length = [[],[]];
        this.bitStream = _bitstream;
        this.sideInfo.scfL = [[],[]]; // [2][23];
        this.sideInfo.scfS = [[[],[],[]],[[],[],[]]]; // [2][3][13];
    }

    _proto_.parseScaleFactors = function(gr, ch){
        var scale_comp = this.sideInfo.scalefac_compress[gr][ch];  
        var length0 = slen0[scale_comp];  
        var length1 = slen1[scale_comp];  
        var sfb, win;
        var l = this.sideInfo.scfL[ch];  
        var s = this.sideInfo.scfS[ch];
        this.sideInfo.part2_length[gr][ch] = 0;  
      
        if (this.sideInfo.window_switching_flag[gr][ch] != 0 && this.sideInfo.block_type[gr][ch] == 2) {  
            if (this.sideInfo.mixed_block_flag[gr][ch] != 0) {  
                // MIXED block  
                this.sideInfo.part2_length[gr][ch] = 17 * length0 + 18 * length1;  
                for (sfb = 0; sfb < 8; sfb++)  
                    l[sfb] = this.bitStream.getBits(length0);  
      
                for (sfb = 3; sfb < 6; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = this.bitStream.getBits(length0);  
      
                for (sfb = 6; sfb < 12; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = this.bitStream.getBits(length1);  
            } else {  
                // pure SHORT block  
                this.sideInfo.part2_length[gr][ch] = 18 * (length0 + length1);  
                for (sfb = 0; sfb < 6; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = this.bitStream.getBits(length0);  
                for (sfb = 6; sfb < 12; sfb++)  
                    for (win = 0; win < 3; win++)  
                        s[win][sfb] = this.bitStream.getBits(length1);  
            }  
        } else {  
            // LONG types 0,1,3  
            var scfsi = this.sideInfo.scfsi[ch];  
            if (gr == 0) {  
                this.sideInfo.part2_length[gr][ch] = 10 * (length0 + length1) + length0;  
                for (sfb = 0; sfb < 11; sfb++)  
                    l[sfb] = this.bitStream.getBits(length0);  
                for (sfb = 11; sfb < 21; sfb++)  
                    l[sfb] = this.bitStream.getBits(length1);  
            } else {  
                this.sideInfo.part2_length[gr][ch] = 0;  
                if (scfsi[0] == 0) {  
                    for (sfb = 0; sfb < 6; sfb++)  
                        l[sfb] = this.bitStream.getBits(length0);  
                    this.sideInfo.part2_length[gr][ch] += 6 * length0;  
                }  
                if (scfsi[1] == 0) {  
                    for (sfb = 6; sfb < 11; sfb++)  
                        l[sfb] = this.bitStream.getBits(length0);  
                    this.sideInfo.part2_length[gr][ch] += 5 * length0;  
                }  
                if (scfsi[2] == 0) {  
                    for (sfb = 11; sfb < 16; sfb++)  
                        l[sfb] = this.bitStream.getBits(length1);  
                    this.sideInfo.part2_bits[gr][ch] += 5 * length1;  
                }  
                if (scfsi[3] == 0) {  
                    for (sfb = 16; sfb < 21; sfb++)  
                        l[sfb] = this.bitStream.getBits(length1);  
                    this.sideInfo.part2_length[gr][ch] += 5 * length1;  
                }  
            }  
        }
        return this.bitStream;
    }

    _proto_.getSideInfo = function(){
        return this.sideInfo;
    }
    return ScaleFactor;
})
