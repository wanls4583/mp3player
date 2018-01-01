/**
 * 子带混合模块
 */
define(function(require, exports, module) {
    'use strict';

    var imdctWin = [
		[0.0322824,0.1072064,0.2014143,0.3256164,0.5,0.7677747,
		1.2412229,2.3319514,7.7441506,-8.4512568,-3.0390580,-1.9483297,
		-1.4748814,-1.2071068,-1.0327232,-0.9085211,-0.8143131,-0.7393892,
		-0.6775254,-0.6248445,-0.5787917,-0.5376016,-0.5,-0.4650284,
		-0.4319343,-0.4000996,-0.3689899,-0.3381170,-0.3070072,-0.2751725,
		-0.2420785,-0.2071068,-0.1695052,-0.1283151,-0.0822624,-0.0295815],
		[0.0322824,0.1072064,0.2014143,0.3256164,0.5,0.7677747,
		1.2412229,2.3319514,7.7441506,-8.4512568,-3.0390580,-1.9483297,
		-1.4748814,-1.2071068,-1.0327232,-0.9085211,-0.8143131,-0.7393892,
		-0.6781709,-0.6302362,-0.5928445,-0.5636910,-0.5411961,-0.5242646,
		-0.5077583,-0.4659258,-0.3970546,-0.3046707,-0.1929928,-0.0668476,
		-0.0,-0.0,-0.0,-0.0,-0.0,-0.0],
		[/* block_type = 2 */],
		[0.0,0.0,0.0,0.0,0.0,0.0,
		0.3015303,1.4659259,6.9781060,-9.0940447,-3.5390582,-2.2903500,
		-1.6627548,-1.3065630,-1.0828403,-0.9305795,-0.8213398,-0.7400936,
		-0.6775254,-0.6248445,-0.5787917,-0.5376016,-0.5,-0.4650284,
		-0.4319343,-0.4000996,-0.3689899,-0.3381170,-0.3070072,-0.2751725,
		-0.2420785,-0.2071068,-0.1695052,-0.1283151,-0.0822624,-0.0295815] ];

	function Imdct(_sideInfo){
		this.sideInfo = _sideInfo;
	}

	var _proto_ = Imdct.prototype;

	_proto_.imdct12 = function(xrch, pre, off) {
		var io = xrch;
		var i,j;
		var in1,in2,in3,in4;
		var out0, out1, out2, out3, out4, out5, tmp;
		var out6=0, out7=0, out8=0, out9=0, out10=0, out11=0;
		var out12=0, out13=0, out14=0, out15=0, out16=0, out17=0;
		var f0 = 0, f1 = 0, f2 = 0, f3 = 0, f4 = 0, f5 = 0;

		for (j = 0; j != 3; j++) {
			i = j + off;
			//>>>>>>>>>>>> 12-point IMDCT
			//>>>>>> 6-point IDCT
			io[15 + i] += (io[12 + i] += io[9 + i]) + io[6 + i];
			io[9 + i] += (io[6 + i] += io[3 + i]) + io[i];
			io[3 + i] += io[i];

			//>>> 3-point IDCT on even
			out1 = (in1 = io[i]) - (in2 = io[12 + i]);
			in3 = in1 + in2 * 0.5;
			in4 = io[6 + i] * 0.8660254;
			out0 = in3 + in4;
			out2 = in3 - in4;
			//<<< End 3-point IDCT on even

			//>>> 3-point IDCT on odd (for 6-point IDCT)
			out4 = ((in1 = io[3 + i]) - (in2 = io[15 + i])) * 0.7071068;
			in3 = in1 + in2 * 0.5;
			in4 = io[9 + i] * 0.8660254;
			out5 = (in3 + in4) * 0.5176381;
			out3 = (in3 - in4) * 1.9318516;
			//<<< End 3-point IDCT on odd

			// Output: butterflies on 2,3-point IDCT's (for 6-point IDCT)
			tmp = out0; out0 += out5; out5 = tmp - out5;
			tmp = out1; out1 += out4; out4 = tmp - out4;
			tmp = out2; out2 += out3; out3 = tmp - out3;
			//<<<<<< End 6-point IDCT
			//<<<<<<<<<<<< End 12-point IDCT

			tmp = out3 * 0.1072064;
			switch(j) {
			case 0:
				out6  = tmp;
				out7  = out4 * 0.5;
				out8  = out5 * 2.3319512;
				out9  = -out5 * 3.0390580;
				out10 = -out4 * 1.2071068;
				out11 = -tmp  * 7.5957541;

				f0 = out2 * 0.6248445;
				f1 = out1 * 0.5;
				f2 = out0 * 0.4000996;
				f3 = out0 * 0.3070072;
				f4 = out1 * 0.2071068;
				f5 = out2 * 0.0822623;
				break;
			case 1:
				out12 = tmp - f0;
				out13 = out4 * 0.5 - f1;
				out14 = out5 * 2.3319512 - f2;
				out15 = -out5 * 3.0390580 - f3;
				out16 = -out4 * 1.2071068 - f4;
				out17 = -tmp * 7.5957541 - f5;

				f0 = out2 * 0.6248445;
				f1 = out1 * 0.5;
				f2 = out0 * 0.4000996;
				f3 = out0 * 0.3070072;
				f4 = out1 * 0.2071068;
				f5 = out2 * 0.0822623;
				break;
			case 2:
				// output
				i = off;
				io[i + 0] = pre[i + 0];
				io[i + 1] = pre[i + 1];
				io[i + 2] = pre[i + 2];
				io[i + 3] = pre[i + 3];
				io[i + 4] = pre[i + 4];
				io[i + 5] = pre[i + 5];
				io[i + 6] = pre[i + 6] + out6;
				io[i + 7] = pre[i + 7] + out7;
				io[i + 8] = pre[i + 8] + out8;
				io[i + 9] = pre[i + 9] + out9;
				io[i + 10] = pre[i + 10] + out10;
				io[i + 11] = pre[i + 11] + out11;
				io[i + 12] = pre[i + 12] + out12;
				io[i + 13] = pre[i + 13] + out13;
				io[i + 14] = pre[i + 14] + out14;
				io[i + 15] = pre[i + 15] + out15;
				io[i + 16] = pre[i + 16] + out16;
				io[i + 17] = pre[i + 17] + out17;

				pre[i + 0] = tmp - f0;
				pre[i + 1] = out4 * 0.5 - f1;
				pre[i + 2] = out5 * 2.3319512 - f2;
				pre[i + 3] = -out5 * 3.0390580 - f3;
				pre[i + 4] = -out4 * 1.2071068 - f4;
				pre[i + 5] = -tmp * 7.5957541 - f5;
				pre[i + 6] = -out2 * 0.6248445;
				pre[i + 7] = -out1 * 0.5;
				pre[i + 8] = -out0 * 0.4000996;
				pre[i + 9] = -out0 * 0.3070072;
				pre[i + 10] = -out1 * 0.2071068;
				pre[i + 11] = -out2 * 0.0822623;
				pre[i + 12] = pre[i + 13] = pre[i + 14] = 0;
				pre[i + 15] = pre[i + 16] = pre[i + 17] = 0;
			}
		}
	}

	_proto_.imdct36 = function(xrch, preBlck, off, block_type) {
		var io = xrch;
		var pre = preBlck;
		var i = off;
		var in0, in1, in2, in3, in4, in5, in6, in7, in8, in9, in10, in11;
		var in12, in13, in14, in15, in16, in17;
		var out0, out1, out2, out3, out4, out5, out6, out7, out8, out9;
		var out10, out11, out12, out13, out14, out15, out16, out17, tmp;

		//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 36-point IDCT
		//>>>>>>>>>>>>>>>>>> 18-point IDCT for odd
		io[i + 17] += (io[i + 16] += io[i + 15]) + io[i + 14];
		io[i + 15] += (io[i + 14] += io[i + 13]) + io[i + 12];
		io[i + 13] += (io[i + 12] += io[i + 11]) + io[i + 10];
		io[i + 11] += (io[i + 10] += io[i + 9]) + io[i + 8];
		io[i + 9] += (io[i + 8] += io[i + 7]) + io[i + 6];
		io[i + 7] += (io[i + 6] += io[i + 5]) + io[i + 4];
		io[i + 5] += (io[i + 4] += io[i + 3]) + io[i + 2];
		io[i + 3] += (io[i + 2] += io[i + 1]) + io[i + 0];
		io[i + 1] += io[i + 0];

		//>>>>>>>>> 9-point IDCT on even
		/*
		 *  for(m = 0; m < 9; m++) {
		 *      sum = 0;
		 *      for(n = 0; n < 18; n += 2)
		 *          sum += in[n] * cos(PI36 * (2 * m + 1) * n);
		 *      out18[m] = sum;
		 *  }
		 */
		in0 = io[i + 0] + io[i + 12] * 0.5;
		in1 = io[i + 0] - io[i + 12];
		in2 = io[i + 8] + io[i + 16] - io[i + 4];

		out4 = in1 + in2;

		in3 = in1 - in2 * 0.5;
		in4 = (io[i + 10] + io[i + 14] - io[i + 2]) * 0.8660254; // cos(PI/6)

		out1 = in3 - in4;
		out7 = in3 + in4;

		in5 = (io[i+4] + io[i+8]) * 0.9396926;		//cos( PI/9)
		in6 = (io[i+16] - io[i+8]) * 0.1736482;	//cos(4PI/9)
		in7 = -(io[i+4] + io[i+16]) * 0.7660444;	//cos(2PI/9)

		in17 = in0 - in5 - in7;
		in8 = in5 + in0 + in6;
		in9 = in0 + in7 - in6;

		in12 = io[i+6] * 0.8660254;				//cos(PI/6)
		in10 = (io[i+2] + io[i+10]) * 0.9848078;	//cos(PI/18)
		in11 = (io[i+14] - io[i+10]) * 0.3420201;	//cos(7PI/18)

		in13 = in10 + in11 + in12;

		out0 = in8 + in13;
		out8 = in8 - in13;

		in14 = -(io[i+2] + io[i+14]) * 0.6427876;	//cos(5PI/18)
		in15 = in10 + in14 - in12;
		in16 = in11 - in14 - in12;

		out3 = in9 + in15;
		out5 = in9 - in15;

		out2 = in17 + in16;
		out6 = in17 - in16;
		//<<<<<<<<< End 9-point IDCT on even

		//>>>>>>>>> 9-point IDCT on odd
		/* 
		 *  for(m = 0; m < 9; m++) {
		 *      sum = 0;
		 *      for(n = 0;n < 18; n += 2)
		 *          sum += in[n + 1] * cos(PI36 * (2 * m + 1) * n);
		 *      out18[17-m] = sum;
		 * }
		 */
		in0 = io[i+1] + io[i+13] * 0.5;	//cos(PI/3)
		in1 = io[i+1] - io[i+13];
		in2 = io[i+9] + io[i+17] - io[i+5];

		out13 = (in1 + in2) * 0.7071068;	//cos(PI/4)

		in3 = in1 - in2 * 0.5;
		in4 = (io[i+11] + io[i+15] - io[i+3]) * 0.8660254;	//cos(PI/6)

		out16 = (in3 - in4) * 0.5176381;	// 0.5/cos( PI/12)
		out10 = (in3 + in4) * 1.9318517;	// 0.5/cos(5PI/12)

		in5 = (io[i+5] + io[i+9]) * 0.9396926;	// cos( PI/9)
		in6 = (io[i+17] - io[i+9])* 0.1736482;	// cos(4PI/9)
		in7 = -(io[i+5] + io[i+17])*0.7660444;	// cos(2PI/9)

		in17 = in0 - in5 - in7;
		in8 = in5 + in0 + in6;
		in9 = in0 + in7 - in6;

		in12 = io[i+7] * 0.8660254;				// cos(PI/6)
		in10 = (io[i+3] + io[i+11]) * 0.9848078;	// cos(PI/18)
		in11 = (io[i+15] - io[i+11])* 0.3420201;	// cos(7PI/18)

		in13 = in10 + in11 + in12;

		out17 = (in8 + in13) * 0.5019099;		// 0.5/cos(PI/36)
		out9 = (in8 - in13) * 5.7368566;		// 0.5/cos(17PI/36)

		in14 = -(io[i+3] + io[i+15]) * 0.6427876;	// cos(5PI/18)
		in15 = in10 + in14 - in12;
		in16 = in11 - in14 - in12;

		out14 = (in9 + in15) * 0.6103873;		// 0.5/cos(7PI/36)
		out12 = (in9 - in15) * 0.8717234;		// 0.5/cos(11PI/36)

		out15 = (in17 + in16) * 0.5516890;		// 0.5/cos(5PI/36)
		out11 = (in17 - in16) * 1.1831008;		// 0.5/cos(13PI/36)
		//<<<<<<<<< End. 9-point IDCT on odd

		// Butterflies on 9-point IDCT's
		tmp = out0; out0 += out17; out17 = tmp - out17;
		tmp = out1; out1 += out16; out16 = tmp - out16;
		tmp = out2; out2 += out15; out15 = tmp - out15;
		tmp = out3; out3 += out14; out14 = tmp - out14;
		tmp = out4; out4 += out13; out13 = tmp - out13;
		tmp = out5; out5 += out12; out12 = tmp - out12;
		tmp = out6; out6 += out11; out11 = tmp - out11;
		tmp = out7; out7 += out10; out10 = tmp - out10;
		tmp = out8; out8 += out9;  out9  = tmp - out9;
		//<<<<<<<<<<<<<<<<<< End of 18-point IDCT
		//<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< End of 36-point IDCT

		// output
		var win = imdctWin[block_type];

		io[i + 0] = pre[i + 0] + out9 * win[0];
		io[i + 1] = pre[i + 1] + out10 * win[1];
		io[i + 2] = pre[i + 2] + out11 * win[2];
		io[i + 3] = pre[i + 3] + out12 * win[3];
		io[i + 4] = pre[i + 4] + out13 * win[4];
		io[i + 5] = pre[i + 5] + out14 * win[5];
		io[i + 6] = pre[i + 6] + out15 * win[6];
		io[i + 7] = pre[i + 7] + out16 * win[7];
		io[i + 8] = pre[i + 8] + out17 * win[8];
		io[i + 9] = pre[i + 9] + out17 * win[9];
		io[i + 10] = pre[i + 10] + out16 * win[10];
		io[i + 11] = pre[i + 11] + out15 * win[11];
		io[i + 12] = pre[i + 12] + out14 * win[12];
		io[i + 13] = pre[i + 13] + out13 * win[13];
		io[i + 14] = pre[i + 14] + out12 * win[14];
		io[i + 15] = pre[i + 15] + out11 * win[15];
		io[i + 16] = pre[i + 16] + out10 * win[16];
		io[i + 17] = pre[i + 17] + out9 * win[17];

		pre[i + 0] = out8 * win[18];
		pre[i + 1] = out7 * win[19];
		pre[i + 2] = out6 * win[20];
		pre[i + 3] = out5 * win[21];
		pre[i + 4] = out4 * win[22];
		pre[i + 5] = out3 * win[23];
		pre[i + 6] = out2 * win[24];
		pre[i + 7] = out1 * win[25];
		pre[i + 8] = out0 * win[26];
		pre[i + 9] = out0 * win[27];
		pre[i + 10] = out1 * win[28];
		pre[i + 11] = out2 * win[29];
		pre[i + 12] = out3 * win[30];
		pre[i + 13] = out4 * win[31];
		pre[i + 14] = out5 * win[32];
		pre[i + 15] = out6 * win[33];
		pre[i + 16] = out7 * win[34];
		pre[i + 17] = out8 * win[35];
	}
	
	_proto_.hybrid = function(gr, ch, xrch, preb) {
		var maxi = this.sideInfo.rzeroIndex[ch];
		var i, block_type;
		
		for (i = 0; i < maxi; i += 18) {
			block_type = ((this.sideInfo.window_switching_flag[gr][ch] != 0)
					&& (this.sideInfo.mixed_block_flag[gr][ch] != 0) && (i < 36)) ? 0
					: this.sideInfo.block_type[gr][ch];

			if(block_type == 2)
				imdct12(xrch, preb, i);
			else
				imdct36(xrch, preb, i, block_type);
		}

		// 0值区
		for (; i < 576; i++) {
			xrch[i] = preb[i];
			preb[i] = 0;
		}
	}
	
	return Imdct;
})