/**
 * huffman解码模块
 */
define(function(require, exports, module) {
    'use strict';

    var Header = require('./header');
    var ScaleFactor = require('./scaleFactor');

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
        var part3len = ci.part2_3_length - ci.part2_length;
        var x = ci.region1Start;    // region1
        var y = ci.region2Start;    // region2
        var i = ci.big_values << 1; // bv
        var hv = []; //结果
        
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
         * 2. 使位流缓冲区按字节对齐
         */
        var num = (8 - bitPos) & 7;
        var mask = 0;
        if (num > 0) {
            mask = getBits9(num);
            mask <<= 32 - num;
            part3len -= num;
        }

        /*
         * 3. 解码大值区
         */
        for (i = 0; i < 3; i++) {
            maxidx = region[i];
            tmp = ci.table_select[i];
            htab = htbv[tmp];
            linbits = lin[tmp];
            while (idx < maxidx) {
                if (part3len + num <= 0) { //检测位流是否有错误
                    num -= part3len + num;
                    break;
                }
                
                while (num < 24) { // refresh mask
                    mask |= (b[bytePos++] & 0xff) << (24 - num);
                    num += 8;
                    part3len -= 8;
                }
                tmp = mask;
                y = htab[tmp >>> 30];
                while (y < 0) {
                    tmp <<= 2;
                    y = htab[(tmp >>> 30) - y];
                }
                x = y >> 8; // x暂存hlen
                num -= x;
                mask <<= x;

                x = (y >> 4) & 0xf; // 解得x,y
                y &= 0xf;

                if (x != 0) {
                    if (x == 15 && linbits != 0) {
                        while (num < 24) { // refresh mask
                            mask |= (b[bytePos++] & 0xff) << (24 - num);
                            num += 8;
                            part3len -= 8;
                        }
                        x += mask >>> (32 - linbits); // 循环右移
                        num -= linbits;
                        mask <<= linbits;
                    }
                    hv[idx++] = (mask < 0) ? -x : x;
                    num--;
                    mask <<= 1;
                } else
                    hv[idx++] = 0;

                if (y != 0) {
                    if (y == 15 && linbits != 0) {
                        while (num < 24) { // refresh mask
                            mask |= (b[bytePos++] & 0xff) << (24 - num);
                            num += 8;
                            part3len -= 8;
                        }
                        y += mask >>> (32 - linbits);
                        num -= linbits;
                        mask <<= linbits;
                    }
                    hv[idx++] = (mask < 0) ? -y : y;
                    num--;
                    mask <<= 1;
                } else
                    hv[idx++] = 0;
            }
        }
    }
})
