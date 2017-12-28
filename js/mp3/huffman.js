/**
 * huffman解码模块
 */
define(function(require, exports, module) {
    'use strict';

    var Header = require('./header');
    var ScaleFactor = require('./scalefactor');
    var huffmanTable = require('./huffmantable');

    var header = null;
    var sideInfo = null;
    var bitStream = null;

    var sfbIndexLong = []; //长块比例因子带
    var sfbIndexShort = []; //短块比例因子带

    function Huffman(_bitStream, _header, _sideInfo){
        bitStream = _bitStream;
        header = _header;
        sideInfo = _sideInfo;
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
	        if (r2 > sfbIndexLong.length - 1) {  
	            r2 = sfbIndexLong.length - 1;  
	        }  
	        sideInfo.region1Start[gr][ch] = sfbIndexLong[r1];  
	        sideInfo.region2Start[gr][ch] = sfbIndexLong[r2];  
	    }  
    }
    /**
     * huffman解码
     * @param {number} gr 颗粒
     * @param {number} ch 声道
     */
    _proto_.huffmanDecode = function(gr, ch){
        this.parseRegionStart(gr, ch);
        var part3len = sideInfo.part2_3_length[gr][ch] - sideInfo.part2_length[gr][ch];
        var x = sideInfo.region1Start[gr][ch];    // region1
        var y = sideInfo.region2Start[gr][ch];    // region2
        var i = sideInfo.big_values[gr][ch] << 1; // bv
        var hv = []; //结果
        var region = []; //频率区域（大值区分为三个区域）
        var idx = 0;
        var bits = 0;
        var hv = []; //解码结果

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
            var maxidx = region[i];
            var tmp = sideInfo.table_select[gr][ch][i];
            var htab = huffmanTable.hct[tmp]; //Huffman码表
            var linbits = huffmanTable.lin[tmp]; //linbits码表
            var x,y,hcode='';
            while (idx < maxidx && !bitStream.isEnd()){
                if(tmp==0){
                    hv[idx++] = 0;
                    hv[idx++] = 0;
                    continue;
                }
                hcode+=bitStream.getBitsStr(1);
                bits++; //记录用去的bit数
                if(htab[hcode]){
                    x = htab[hcode][0]; //x
                    y = htab[hcode][1]; //y

                    if(x==15 && linbits){
                        x+=bitStream.getBits(linbits);
                    }else if(x!=0){
                        x = bitStream.getBits1() == 1 ? -x : x;
                    }
                    hv[idx++] = x;

                    if(y==15 && linbits){
                        y+=bitStream.getBits(linbits);
                    }else if(y!=0){
                        y = bitStream.getBits1() == 1 ? -y : y;
                    }
                    hv[idx++] = x;

                    hcode = '';
                }
            }
        }
        /*
         * 2. 解码count1区
         */
        while(idx<572 && bits<part3len){
            var tmp = sideInfo.count1table_select[gr][ch];
            var htab = 0;
            var v,w,x,y;
            if(!tmp){
                htab = huffmanTable.hctA; //Huffman码表
            }else{
                htab = huffmanTable.hctB; //Huffman码表
            }
            tmp = '';
            while(!htab[tmp]){
                tmp+=bitStream.getBits1();
            }
            v = htab[tmp][0];
            w = htab[tmp][1];
            x = htab[tmp][2];
            y = htab[tmp][3];
            if(v!=0){
                v = bitStream.getBits1() == 1 ? -v : v;
            }
            if(w!=0){
                w = bitStream.getBits1() == 1 ? -w : w;
            }
            if(x!=0){
                x = bitStream.getBits1() == 1 ? -x : x;
            }
            if(y!=0){
                y = bitStream.getBits1() == 1 ? -y : y;
            }
            hv[idx++] = v;
            hv[idx++] = w;
            hv[idx++] = x;
            hv[idx++] = y;
        }
        /**
         * 3.zero区
         */
        while(idx<576){
            hv[idx++] = 0;
        }
        return bitStream;
    }
    return  Huffman;
})
