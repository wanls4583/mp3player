/**
 * huffman解码模块
 */
define(function(require, exports, module) {
    'use strict';

    var Header = require('./header');
    var ScaleFactor = require('./scalefactor');
    var huffmanTable = require('./huffmantable');

    var header = null;
    var scaleFactor = null;
    var sideInfo = null;

    var sfbIndexLong = []; //长块比例因子带
    var sfbIndexShort = []; //短块比例因子带

    function Huffman(arrayBuffer){
    	header = new Header(arrayBuffer);
    	header = header.parseHeader();
    	scaleFactor = new ScaleFactor(arrayBuffer);
    	sideInfo = scaleFactor.parseScaleFactors();
    	sideInfo.region1Start = [[],[]];
    	sideInfo.region2Start = [[],[]];
    	if(!header){
    		throw new Error('帧头解析失败');
    	}
    	if(!sideInfo){
    		throw new Error('比例因子解析失败');
    	}
    	this.initSfbIndex();
        this.parseRegionStart();
    }

    var _proto_ = Huffman.prototype;

    /**
     * 初始化比例因子带
     */
    _proto_.initSfbIndex = function(){
    	switch (header.getSampleRate()) {
		case 44100:
			sfbIndexLong = [ 0, 4, 8, 12, 16, 20, 24, 30, 36, 44,
					52, 62, 74, 90, 110, 134, 162, 196, 238, 288, 342, 418, 576 ];
			sfbIndexShort = [ 0, 4, 8, 12, 16, 22, 30, 40, 52, 66,
					84, 106, 136, 192 ];
			break;
		case 48000:
			sfbIndexLong = [ 0, 4, 8, 12, 16, 20, 24, 30, 36, 42,
					50, 60, 72, 88, 106, 128, 156, 190, 230, 276, 330, 384, 576 ];
			sfbIndexShort = [ 0, 4, 8, 12, 16, 22, 28, 38, 50, 64,
					80, 100, 126, 192 ];
			break;
		case 32000:
			sfbIndexLong = [ 0, 4, 8, 12, 16, 20, 24, 30, 36, 44,
					54, 66, 82, 102, 126, 156, 194, 240, 296, 364, 448, 550, 576 ];
			sfbIndexShort = [ 0, 4, 8, 12, 16, 22, 30, 42, 58, 78,
					104, 138, 180, 192 ];
			break;
		}
    }
    /**
     * 获取从码表得到值的个数
     * @param {number} gr 颗粒
     * @param {number} ch 声道
     */
    _proto_.parseRegionStart = function(gr, ch){

	    var r1, r2;  
	  
	    if (sideInfo.window_switching_flag[gr][ch] != 0) {  
            sideInfo.region1Start[gr][ch] = 36;  
            sideInfo.region2Start[gr][ch] = 576;  
	    } else {  
	        r1 = sideInfo.region0_count[gr][ch] + 1;  
	        r2 = r1 + sideInfo.region1_count[gr][ch] + 1;  
	        if (r2 > intSfbIdxLong.length - 1) {  
	            r2 = intSfbIdxLong.length - 1;  
	        }  
	        sideInfo.region1Start[gr][ch] = intSfbIdxLong[r1];  
	        sideInfo.region2Start[gr][ch] = intSfbIdxLong[r2];  
	    }  
    }
    /**
     * huffman解码
     * @param {number} gr 颗粒
     * @param {number} ch 声道
     */
    _proto_.huffmanDecode = function(gr, ch){
        var part3len = sideInfo.part2_3_length[gr][ch] - sideInfo.part2_length[gr][ch];
        var x = sideInfo.region1Start[gr][ch];    // region1
        var y = sideInfo.region2Start[gr][ch];    // region2
        var i = sideInfo.big_values[gr][ch] << 1; // bv
        var hv = []; //结果
        var region = []; //频率区域（大值区分为三个区域）

        if(i > 574)
            i = 574; // 错误的big_value置为0 ?
        if(x < i) {
            region[0] = x;
            if(y < i) {
                region[1] = y;
                region[2] = i;
            } else
                region[1] = region[2] = i;
        } else
            region[0] = region[1] = region[2] = i;

        /*
         * 1. 解码大值区
         */
        for (i = 0; i < 3; i++) {
        }
    }
})
