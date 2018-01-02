/**
 * 多相合成滤波
 */
define(function(require, exports, module){
	'use strict'

	var dewin = [ // [32][16]
		[0,-14.5,106.5,-229.5,1018.5,-2576.5,3287,-18744.5,
		37519,18744.5,3287,2576.5,1018.5,229.5,106.5,14.5],
		[-0.5,-15.5,109,-259.5,1000,-2758.5,2979.5,-19668,
		37496,17820,3567,2394,1031.5,200.5,104,13],
		[-0.5,-17.5,111,-290.5,976,-2939.5,2644,-20588,
		37428,16895.5,3820,2212.5,1040,173.5,101,12],
		[-0.5,-19,112.5,-322.5,946.5,-3118.5,2280.5,-21503,
		37315,15973.5,4046,2031.5,1043.5,147,98,10.5],
		[-0.5,-20.5,113.5,-355.5,911,-3294.5,1888,-22410.5,
		37156.5,15056,4246,1852.5,1042.5,122,95,9.5],
		[-0.5,-22.5,114,-389.5,869.5,-3467.5,1467.5,-23308.5,
		36954,14144.5,4420,1675.5,1037.5,98.5,91.5,8.5],
		[-0.5,-24.5,114,-424,822,-3635.5,1018.5,-24195,
		36707.5,13241,4569.5,1502,1028.5,76.5,88,8],
		[-1,-26.5,113.5,-459.5,767.5,-3798.5,541,-25068.5,
		36417.5,12347,4694.5,1331.5,1016,55.5,84.5,7],
		[-1,-29,112,-495.5,707,-3955,35,-25926.5,
		36084.5,11464.5,4796,1165,1000.5,36,80.5,6.5],
		[-1,-31.5,110.5,-532,640,-4104.5,-499,-26767,
		35710,10594.5,4875,1003,981,18,77,5.5],
		[-1,-34,107.5,-568.5,565.5,-4245.5,-1061,-27589,
		35295,9739,4931.5,846,959.5,1,73.5,5],
		[-1.5,-36.5,104,-605,485,-4377.5,-1650,-28389,
		34839.5,8899.5,4967.5,694,935,-14.5,69.5,4.5],
		[-1.5,-39.5,100,-641.5,397,-4499,-2266.5,-29166.5,
		34346,8077.5,4983,547.5,908.5,-28.5,66,4],
		[-2,-42.5,94.5,-678,302.5,-4609.5,-2909,-29919,
		33814.5,7274,4979.5,407,879.5,-41.5,62.5,3.5],
		[-2,-45.5,88.5,-714,201,-4708,-3577,-30644.5,
		33247,6490,4958,272.5,849,-53,58.5,3.5],
		[-2.5,-48.5,81.5,-749,92.5,-4792.5,-4270,-31342,
		32645,5727.5,4919,144,817,-63.5,55.5,3],
		[-2.5,-52,73,-783.5,-22.5,-4863.5,-4987.5,-32009.5,
		32009.5,4987.5,4863.5,22.5,783.5,-73,52,2.5],
		[-3,-55.5,63.5,-817,-144,-4919,-5727.5,-32645,
		31342,4270,4792.5,-92.5,749,-81.5,48.5,2.5],
		[-3.5,-58.5,53,-849,-272.5,-4958,-6490,-33247,
		30644.5,3577,4708,-201,714,-88.5,45.5,2],
		[-3.5,-62.5,41.5,-879.5,-407,-4979.5,-7274,-33814.5,
		29919,2909,4609.5,-302.5,678,-94.5,42.5,2],
		[-4,-66,28.5,-908.5,-547.5,-4983,-8077.5,-34346,
		29166.5,2266.5,4499,-397,641.5,-100,39.5,1.5],
		[-4.5,-69.5,14.5,-935,-694,-4967.5,-8899.5,-34839.5,
		28389,1650,4377.5,-485,605,-104,36.5,1.5],
		[-5,-73.5,-1,-959.5,-846,-4931.5,-9739,-35295,
		27589,1061,4245.5,-565.5,568.5,-107.5,34,1],
		[-5.5,-77,-18,-981,-1003,-4875,-10594.5,-35710,
		26767,499,4104.5,-640,532,-110.5,31.5,1],
		[-6.5,-80.5,-36,-1000.5,-1165,-4796,-11464.5,-36084.5,
		25926.5,-35,3955,-707,495.5,-112,29,1],
		[-7,-84.5,-55.5,-1016,-1331.5,-4694.5,-12347,-36417.5,
		25068.5,-541,3798.5,-767.5,459.5,-113.5,26.5,1],
		[-8,-88,-76.5,-1028.5,-1502,-4569.5,-13241,-36707.5,
		24195,-1018.5,3635.5,-822,424,-114,24.5,0.5],
		[-8.5,-91.5,-98.5,-1037.5,-1675.5,-4420,-14144.5,-36954,
		23308.5,-1467.5,3467.5,-869.5,389.5,-114,22.5,0.5],
		[-9.5,-95,-122,-1042.5,-1852.5,-4246,-15056,-37156.5,
		22410.5,-1888,3294.5,-911,355.5,-113.5,20.5,0.5],
		[-10.5,-98,-147,-1043.5,-2031.5,-4046,-15973.5,-37315,
		21503,-2280.5,3118.5,-946.5,322.5,-112.5,19,0.5],
		[-12,-101,-173.5,-1040,-2212.5,-3820,-16895.5,-37428,
		20588,-2644,2939.5,-976,290.5,-111,17.5,0.5],
		[-13,-104,-200.5,-1031.5,-2394,-3567,-17820,-37496,
		19668,-2979.5,2758.5,-1000,259.5,-109,15.5,0.5]
	];

	function Synthesis(channels){
		this.fifobuf = [];
		this.fifoIndex = [0,0];
		for(var i=0; i<channels; i++){
			this.fifobuf[i] = new Array(1024);
			for(var j=0; j<1024; j++){
				this.fifobuf[i][j] = 0;
			}
		}
	}

	var _proto_ = Synthesis.prototype;

	_proto_.dct32to64 = function( src, dest, off) {
		var _in = src, out = dest;
		var i = off;
		var in0,in1,in2,in3,in4,in5,in6,in7,in8,in9,in10,in11,in12,in13,in14,in15;
		var out0,out1,out2,out3,out4,out5,out6,out7,out8,out9,out10,out11,out12,out13,out14,out15;
		var d8_0,d8_1,d8_2,d8_3,d8_4,d8_5,d8_6,d8_7;
		var ein0, ein1, oin0, oin1;

		//>>>>>>>>>>>>>>>>
		// 用DCT16计算DCT32输出[0..31]的偶数下标元素
		in0 =  _in[0]  + _in[31];
		in1 =  _in[1]  + _in[30];
		in2 =  _in[2]  + _in[29];
		in3 =  _in[3]  + _in[28];
		in4 =  _in[4]  + _in[27];
		in5 =  _in[5]  + _in[26];
		in6 =  _in[6]  + _in[25];
		in7 =  _in[7]  + _in[24];
		in8 =  _in[8]  + _in[23];
		in9 =  _in[9]  + _in[22];
		in10 = _in[10] + _in[21];
		in11 = _in[11] + _in[20];
		in12 = _in[12] + _in[19];
		in13 = _in[13] + _in[18];
		in14 = _in[14] + _in[17];
		in15 = _in[15] + _in[16];

		//DCT16
		//{
			//>>>>>>>> 用DCT8计算DCT16输出[0..15]的偶数下标元素
			d8_0 = in0 + in15;
			d8_1 = in1 + in14;
			d8_2 = in2 + in13;
			d8_3 = in3 + in12;
			d8_4 = in4 + in11;
			d8_5 = in5 + in10;
			d8_6 = in6 + in9;
			d8_7 = in7 + in8;

			//DCT8. 加(减)法29,乘法12次
			//{
				//>>>>e 用DCT4计算DCT8的输出[0..7]的偶数下标元素
				out1 = d8_0 + d8_7;
				out3 = d8_1 + d8_6;
				out5 = d8_2 + d8_5;
				out7 = d8_3 + d8_4;

				//>>e DCT2
				ein0 = out1 + out7;
				ein1 = out3 + out5;
				out[i + 48] =  -ein0 - ein1;
				out[i] = (ein0 - ein1) * 0.7071068;// 0.5/cos(PI/4)

				//>>o DCT2
				oin0 = (out1 - out7) * 0.5411961;	// 0.5/cos( PI/8)
				oin1 = (out3 - out5) * 1.3065630;	// 0.5/cos(3PI/8)

				out2 =  oin0 + oin1;
				out12 = (oin0 - oin1) * 0.7071068; // cos(PI/4)

				out[i + 40] = out[i + 56] = -out2 - out12;
				out[i + 8] = out12;
				//<<<<e 完成计算DCT8的输出[0..7]的偶数下标元素

				//>>>>o 用DCT4计算DCT8的输出[0..7]的奇数下标元素
				//o DCT4 part1
				out1 = (d8_0 - d8_7) * 0.5097956;	// 0.5/cos( PI/16)
				out3 = (d8_1 - d8_6) * 0.6013449;	// 0.5/cos(3PI/16)
				out5 = (d8_2 - d8_5) * 0.8999762;	// 0.5/cos(5PI/16)
				out7 = (d8_3 - d8_4) * 2.5629154;	// 0.5/cos(7PI/16)

				//o DCT4 part2

				//e DCT2 part1
				ein0 = out1 + out7;
				ein1 = out3 + out5;

				//o DCT2 part1
				oin0 = (out1 - out7) * 0.5411961;	// 0.5/cos(PI/8)
				oin1 = (out3 - out5) * 1.3065630;	// 0.5/cos(3PI/8)

				//e DCT2 part2
				out1 =  ein0 + ein1;
				out5 = (ein0 - ein1) * 0.7071068;	// cos(PI/4)

				//o DCT2 part2
				out3 = oin0 + oin1;
				out7 = (oin0 - oin1) * 0.7071068;	// cos(PI/4)
				out3 += out7;

				//o DCT4 part3
				out[i + 44] = out[i + 52] = -out1 - out3;	//out1+=out3
				out[i + 36] = out[i + 60] = -out3 - out5;	//out3+=out5
				out[i + 4] = out5 + out7;					//out5+=out7
				out[i + 12] = out7;
				//<<<<o 完成计算DCT8的输出[0..7]的奇数下标元素
			//}
			//<<<<<<<< 完成计算DCT16输出[0..15]的偶数下标元素

			//-----------------------------------------------------------------

			//>>>>>>>> 用DCT8计算DCT16输出[0..15]的奇数下标元素
			d8_0 = (in0 - in15) * 0.5024193;	// 0.5/cos( 1 * PI/32)
			d8_1 = (in1 - in14) * 0.5224986;	// 0.5/cos( 3 * PI/32)
			d8_2 = (in2 - in13) * 0.5669440;	// 0.5/cos( 5 * PI/32)
			d8_3 = (in3 - in12) * 0.6468218;	// 0.5/cos( 7 * PI/32)
			d8_4 = (in4 - in11) * 0.7881546;	// 0.5/cos( 9 * PI/32)
			d8_5 = (in5 - in10) * 1.0606777;	// 0.5/cos(11 * PI/32)
			d8_6 = (in6 - in9) * 1.7224471;	// 0.5/cos(13 * PI/32)
			d8_7 = (in7 - in8) * 5.1011486;	// 0.5/cos(15 * PI/32)

			//DCT8
			//{
				//>>>>e 用DCT4计算DCT8的输出[0..7]的偶数下标元素.
				out3  = d8_0 + d8_7;
				out7  = d8_1 + d8_6;
				out11 = d8_2 + d8_5;
				out15 = d8_3 + d8_4;

				//>>e DCT2
				ein0 = out3 + out15;
				ein1 = out7 + out11;
				out1 = ein0 + ein1;
				out9 = (ein0 - ein1) * 0.7071068;		// 0.5/cos(PI/4)

				//>>o DCT2
				oin0 = (out3 - out15) * 0.5411961;	// 0.5/cos( PI/8)
				oin1 = (out7 - out11) * 1.3065630;	// 0.5/cos(3PI/8)

				out5 =  oin0 + oin1;
				out13 = (oin0 - oin1) * 0.7071068;	// cos(PI/4)

				out5 += out13;
				//<<<<e 完成计算DCT8的输出[0..7]的偶数下标元素

				//>>>>o 用DCT4计算DCT8的输出[0..7]的奇数下标元素
				//o DCT4 part1
				out3  = (d8_0 - d8_7) * 0.5097956;	// 0.5/cos( PI/16)
				out7  = (d8_1 - d8_6) * 0.6013449;	// 0.5/cos(3PI/16)
				out11 = (d8_2 - d8_5) * 0.8999762;	// 0.5/cos(5PI/16)
				out15 = (d8_3 - d8_4) * 2.5629154;	// 0.5/cos(7PI/16)

				//o DCT4 part2

				//e DCT2 part1
				ein0 = out3 + out15;
				ein1 = out7 + out11;

				//o DCT2 part1
				oin0 = (out3 - out15) * 0.5411961;	// 0.5/cos(PI/8)
				oin1 = (out7 - out11) * 1.3065630;	// 0.5/cos(3PI/8)

				//e DCT2 part2
				out3 =  ein0 + ein1;
				out11 = (ein0 - ein1) * 0.7071068;	// cos(PI/4)

				//o DCT2 part2
				out7 = oin0 + oin1;
				out15 = (oin0 - oin1) * 0.7071068;	// cos(PI/4)
				out7 += out15;

				//o DCT4 part3
				out3  += out7;
				out7  += out11;
				out11 += out15;
				//<<<<o 完成计算DCT8的输出[0..7]的奇数下标元素
			//}

			out[i + 46] = out[i + 50] = -out1 - out3;	//out1 += out3
			out[i + 42] = out[i + 54] = -out3 - out5;	//out3 += out5
			out[i + 38] = out[i + 58] = -out5 - out7;	//out5 += out7
			out[i + 34] = out[i + 62] = -out7 - out9;	//out7 += out9
			out[i + 2]  = out9 + out11;					//out9 += out11
			out[i + 6]  = out11 + out13;				//out11 += out13
			out[i + 10] = out13 + out15;				//out13 += out15
			//<<<<<<<< 完成计算DCT16输出[0..15]的奇数下标元素
		//}
		out[i + 14] = out15;	//out[i + 14]=out32[30]
		//<<<<<<<<<<<<<<<<
		// 完成计算DCT32输出[0..31]的偶数下标元素

		//=====================================================================

		//>>>>>>>>>>>>>>>>
		// 用DCT16计算DCT32输出[0..31]的奇数下标元素
		in0  = (_in[0]  - _in[31]) * 0.5006030;	// 0.5/cos( 1 * PI/64)
		in1  = (_in[1]  - _in[30]) * 0.5054710;	// 0.5/cos( 3 * PI/64)
		in2  = (_in[2]  - _in[29]) * 0.5154473;	// 0.5/cos( 5 * PI/64)
		in3  = (_in[3]  - _in[28]) * 0.5310426;	// 0.5/cos( 7 * PI/64)
		in4  = (_in[4]  - _in[27]) * 0.5531039;	// 0.5/cos( 9 * PI/64)
		in5  = (_in[5]  - _in[26]) * 0.5829350;	// 0.5/cos(11 * PI/64)
		in6  = (_in[6]  - _in[25]) * 0.6225041;	// 0.5/cos(13 * PI/64)
		in7  = (_in[7]  - _in[24]) * 0.6748083;	// 0.5/cos(15 * PI/64)
		in8  = (_in[8]  - _in[23]) * 0.7445362;	// 0.5/cos(17 * PI/64)
		in9  = (_in[9]  - _in[22]) * 0.8393496;	// 0.5/cos(19 * PI/64)
		in10 = (_in[10] - _in[21]) * 0.9725682;	// 0.5/cos(21 * PI/64)
		in11 = (_in[11] - _in[20]) * 1.1694399;	// 0.5/cos(23 * PI/64)
		in12 = (_in[12] - _in[19]) * 1.4841646;	// 0.5/cos(25 * PI/64)
		in13 = (_in[13] - _in[18]) * 2.0577810;	// 0.5/cos(27 * PI/64)
		in14 = (_in[14] - _in[17]) * 3.4076084;	// 0.5/cos(29 * PI/64)
		in15 = (_in[15] - _in[16]) * 10.190008;	// 0.5/cos(31 * PI/64)

		//DCT16
		//{
			//>>>>>>>> 用DCT8计算DCT16输出[0..15]的偶数下标元素
			d8_0 = in0 + in15;
			d8_1 = in1 + in14;
			d8_2 = in2 + in13;
			d8_3 = in3 + in12;
			d8_4 = in4 + in11;
			d8_5 = in5 + in10;
			d8_6 = in6 + in9;
			d8_7 = in7 + in8;

			//DCT8
			//{
				//>>>>e 用DCT4计算DCT8的输出[0..7]的偶数下标元素
				out1 = d8_0 + d8_7;
				out3 = d8_1 + d8_6;
				out5 = d8_2 + d8_5;
				out7 = d8_3 + d8_4;

				//>>e DCT2
				ein0 = out1 + out7;
				ein1 = out3 + out5;
				out0 = ein0 + ein1;
				out8 = (ein0 - ein1) * 0.7071068;	// 0.5/cos(PI/4)

				//>>o DCT2
				oin0 = (out1 - out7) * 0.5411961;	// 0.5/cos( PI/8)
				oin1 = (out3 - out5) * 1.3065630;	// 0.5/cos(3PI/8)

				out4 =  oin0 + oin1;
				out12 = (oin0 - oin1) * 0.7071068;// cos(PI/4)

				out4 += out12;
				//<<<<e 完成计算DCT8的输出[0..7]的偶数下标元素

				//>>>>o 用DCT4计算DCT8的输出[0..7]的奇数下标元素
				//o DCT4 part1
				out1 = (d8_0 - d8_7) * 0.5097956;	// 0.5/cos( PI/16)
				out3 = (d8_1 - d8_6) * 0.6013449;	// 0.5/cos(3PI/16)
				out5 = (d8_2 - d8_5) * 0.8999762;	// 0.5/cos(5PI/16)
				out7 = (d8_3 - d8_4) * 2.5629154;	// 0.5/cos(7PI/16)

				//o DCT4 part2

				//e DCT2 part1
				ein0 = out1 + out7;
				ein1 = out3 + out5;

				//o DCT2 part1
				oin0 = (out1 - out7) * 0.5411961;	// 0.5/cos(PI/8)
				oin1 = (out3 - out5) * 1.3065630;	// 0.5/cos(3PI/8)

				//e DCT2 part2
				out2 = ein0 + ein1;
				out10 = (ein0 - ein1) * 0.7071068;// cos(PI/4)

				//o DCT2 part2
				out6 = oin0 + oin1;
				out14 = (oin0 - oin1) * 0.7071068;
				out6 += out14;

				//o DCT4 part3
				out2  += out6;
				out6  += out10;
				out10 += out14;
				//<<<<o 完成计算DCT8的输出[0..7]的奇数下标元素
			//}
			//<<<<<<<< 完成计算DCT16输出[0..15]的偶数下标元素

			//-----------------------------------------------------------------

			//>>>>>>>> 用DCT8计算DCT16输出[0..15]的奇数下标元素
			d8_0 = (in0 - in15) * 0.5024193;	// 0.5/cos( 1 * PI/32)
			d8_1 = (in1 - in14) * 0.5224986;	// 0.5/cos( 3 * PI/32)
			d8_2 = (in2 - in13) * 0.5669440;	// 0.5/cos( 5 * PI/32)
			d8_3 = (in3 - in12) * 0.6468218;	// 0.5/cos( 7 * PI/32)
			d8_4 = (in4 - in11) * 0.7881546;	// 0.5/cos( 9 * PI/32)
			d8_5 = (in5 - in10) * 1.0606777;	// 0.5/cos(11 * PI/32)
			d8_6 = (in6 - in9) * 1.7224471;	// 0.5/cos(13 * PI/32)
			d8_7 = (in7 - in8) * 5.1011486;	// 0.5/cos(15 * PI/32)

			//DCT8
			//{
				//>>>>e 用DCT4计算DCT8的输出[0..7]的偶数下标元素.
				out1 = d8_0 + d8_7;
				out3 = d8_1 + d8_6;
				out5 = d8_2 + d8_5;
				out7 = d8_3 + d8_4;

				//>>e DCT2
				ein0 = out1 + out7;
				ein1 = out3 + out5;
				in0 =  ein0 + ein1;	//out0->in0,out4->in4
				in4 = (ein0 - ein1) * 0.7071068;	// 0.5/cos(PI/4)

				//>>o DCT2
				oin0 = (out1 - out7) * 0.5411961;	// 0.5/cos( PI/8)
				oin1 = (out3 - out5) * 1.3065630;	// 0.5/cos(3PI/8)

				in2 =  oin0 + oin1;					//out2->in2,out6->in6
				in6 = (oin0 - oin1) * 0.7071068;	// cos(PI/4)

				in2 += in6;
				//<<<<e 完成计算DCT8的输出[0..7]的偶数下标元素

				//>>>>o 用DCT4计算DCT8的输出[0..7]的奇数下标元素
				//o DCT4 part1
				out1 = (d8_0 - d8_7) * 0.5097956;	// 0.5/cos( PI/16)
				out3 = (d8_1 - d8_6) * 0.6013449;	// 0.5/cos(3PI/16)
				out5 = (d8_2 - d8_5) * 0.8999762;	// 0.5/cos(5PI/16)
				out7 = (d8_3 - d8_4) * 2.5629154;	// 0.5/cos(7PI/16)

				//o DCT4 part2

				//e DCT2 part1
				ein0 = out1 + out7;
				ein1 = out3 + out5;

				//o DCT2 part1
				oin0 = (out1 - out7) * 0.5411961;	// 0.5/cos(PI/8)
				oin1 = (out3 - out5) * 1.3065630;	// 0.5/cos(3PI/8)

				//e DCT2 part2
				out1 =  ein0 + ein1;
				out5 = (ein0 - ein1) * 0.7071068;	// cos(PI/4)

				//o DCT2 part2
				out3 = oin0 + oin1;
				out15 = (oin0 - oin1) * 0.7071068;
				out3 += out15;

				//o DCT4 part3
				out1 += out3;
				out3 += out5;
				out5 += out15;
				//<<<<o 完成计算DCT8的输出[0..7]的奇数下标元素
			//}
									//out15=out7
			out13 = in6 + out15;	//out13=out6+out7
			out11 = out5 + in6;		//out11=out5+out6
			out9 = in4 + out5;		//out9 =out4+out5
			out7 = out3 + in4;		//out7 =out3+out4
			out5 = in2 + out3;		//out5 =out2+out3
			out3 = out1 + in2;		//out3 =out1+out2
			out1 += in0;			//out1 =out0+out1
			//<<<<<<<< 完成计算DCT16输出[0..15]的奇数下标元素
		//}

		//DCT32out[i]=out[i]+out[i+1]; DCT32out[31]=out[15]
		out[i + 47] = out[i + 49] = -out0 - out1;
		out[i + 45] = out[i + 51] = -out1 - out2;
		out[i + 43] = out[i + 53] = -out2 - out3;
		out[i + 41] = out[i + 55] = -out3 - out4;
		out[i + 39] = out[i + 57] = -out4 - out5;
		out[i + 37] = out[i + 59] = -out5 - out6;
		out[i + 35] = out[i + 61] = -out6 - out7;
		out[i + 33] = out[i + 63] = -out7 - out8;
		out[i + 1] = out8 + out9;
		out[i + 3] = out9 + out10;
		out[i + 5] = out10 + out11;
		out[i + 7] = out11 + out12;
		out[i + 9] = out12 + out13;
		out[i + 11] = out13 + out14;
		out[i + 13] = out14 + out15;
		out[i + 15] = out15;
		//<<<<<<<<<<<<<<<<

		out[i + 16] = 0;

		out[i + 17] = -out15;	//out[i + 17] = -out[i + 15]
		out[i + 18] = -out[i + 14];
		out[i + 19] = -out[i + 13];
		out[i + 20] = -out[i + 12];
		out[i + 21] = -out[i + 11];
		out[i + 22] = -out[i + 10];
		out[i + 23] = -out[i + 9];
		out[i + 24] = -out[i + 8];
		out[i + 25] = -out[i + 7];
		out[i + 26] = -out[i + 6];
		out[i + 27] = -out[i + 5];
		out[i + 28] = -out[i + 4];
		out[i + 29] = -out[i + 3];
		out[i + 30] = -out[i + 2];
		out[i + 31] = -out[i + 1];
		out[i + 32] = -out[i];
	}

	_proto_.synthesisSubBand = function(samples, ch, pcmbuff) {
		var fifo = this.fifobuf[ch];
		var sum, win = [];
		var i, pcmi;
		//1. Shift
		this.fifoIndex[ch] = (this.fifoIndex[ch] - 64) & 0x3FF;
		//960,896,832,768,704,640,576,512,448,384,320,256,192,128,64,0

		//2. Matrixing
		this.dct32to64(samples, fifo, this.fifoIndex[ch]);

		//3. Build the U vector
		//4. Dewindowing
		//5. Calculate and output 32 samples
		switch(this.fifoIndex[ch]) {
		case 0:
		//u_vector={0,96,128,224,256,352,384,480,512,608,640,736,768,864,896,992}=u_base
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i];
				sum += win[1] * fifo[i + 96];
				sum += win[2] * fifo[i + 128];
				sum += win[3] * fifo[i + 224];
				sum += win[4] * fifo[i + 256];
				sum += win[5] * fifo[i + 352];
				sum += win[6] * fifo[i + 384];
				sum += win[7] * fifo[i + 480];
				sum += win[8] * fifo[i + 512];
				sum += win[9] * fifo[i + 608];
				sum += win[10] * fifo[i + 640];
				sum += win[11] * fifo[i + 736];
				sum += win[12] * fifo[i + 768];
				sum += win[13] * fifo[i + 864];
				sum += win[14] * fifo[i + 896];
				sum += win[15] * fifo[i + 992];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum); //clip
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 64:
			//u_vector={64,160,192,288,320,416,448,544,576,672,704,800,832,928,960,32}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 64];
				sum += win[1] * fifo[i + 160];
				sum += win[2] * fifo[i + 192];
				sum += win[3] * fifo[i + 288];
				sum += win[4] * fifo[i + 320];
				sum += win[5] * fifo[i + 416];
				sum += win[6] * fifo[i + 448];
				sum += win[7] * fifo[i + 544];
				sum += win[8] * fifo[i + 576];
				sum += win[9] * fifo[i + 672];
				sum += win[10] * fifo[i + 704];
				sum += win[11] * fifo[i + 800];
				sum += win[12] * fifo[i + 832];
				sum += win[13] * fifo[i + 928];
				sum += win[14] * fifo[i + 960];
				sum += win[15] * fifo[i + 32];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 128:
			//u_vector={128,224,256,352,384,480,512,608,640,736,768,864,896,992,0,96}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 128];
				sum += win[1] * fifo[i + 224];
				sum += win[2] * fifo[i + 256];
				sum += win[3] * fifo[i + 352];
				sum += win[4] * fifo[i + 384];
				sum += win[5] * fifo[i + 480];
				sum += win[6] * fifo[i + 512];
				sum += win[7] * fifo[i + 608];
				sum += win[8] * fifo[i + 640];
				sum += win[9] * fifo[i + 736];
				sum += win[10] * fifo[i + 768];
				sum += win[11] * fifo[i + 864];
				sum += win[12] * fifo[i + 896];
				sum += win[13] * fifo[i + 992];
				sum += win[14] * fifo[i];
				sum += win[15] * fifo[i + 96];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 192:
			//u_vector={192,288,320,416,448,544,576,672,704,800,832,928,960,32,64,160}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 192];
				sum += win[1] * fifo[i + 288];
				sum += win[2] * fifo[i + 320];
				sum += win[3] * fifo[i + 416];
				sum += win[4] * fifo[i + 448];
				sum += win[5] * fifo[i + 544];
				sum += win[6] * fifo[i + 576];
				sum += win[7] * fifo[i + 672];
				sum += win[8] * fifo[i + 704];
				sum += win[9] * fifo[i + 800];
				sum += win[10] * fifo[i + 832];
				sum += win[11] * fifo[i + 928];
				sum += win[12] * fifo[i + 960];
				sum += win[13] * fifo[i + 32];
				sum += win[14] * fifo[i + 64];
				sum += win[15] * fifo[i + 160];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 256:
			//u_vector={256,352,384,480,512,608,640,736,768,864,896,992,0,96,128,224}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 256];
				sum += win[1] * fifo[i + 352];
				sum += win[2] * fifo[i + 384];
				sum += win[3] * fifo[i + 480];
				sum += win[4] * fifo[i + 512];
				sum += win[5] * fifo[i + 608];
				sum += win[6] * fifo[i + 640];
				sum += win[7] * fifo[i + 736];
				sum += win[8] * fifo[i + 768];
				sum += win[9] * fifo[i + 864];
				sum += win[10] * fifo[i + 896];
				sum += win[11] * fifo[i + 992];
				sum += win[12] * fifo[i];
				sum += win[13] * fifo[i + 96];
				sum += win[14] * fifo[i + 128];
				sum += win[15] * fifo[i + 224];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 320:
			//u_vector={320,416,448,544,576,672,704,800,832,928,960,32,64,160,192,288}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 320];
				sum += win[1] * fifo[i + 416];
				sum += win[2] * fifo[i + 448];
				sum += win[3] * fifo[i + 544];
				sum += win[4] * fifo[i + 576];
				sum += win[5] * fifo[i + 672];
				sum += win[6] * fifo[i + 704];
				sum += win[7] * fifo[i + 800];
				sum += win[8] * fifo[i + 832];
				sum += win[9] * fifo[i + 928];
				sum += win[10] * fifo[i + 960];
				sum += win[11] * fifo[i + 32];
				sum += win[12] * fifo[i + 64];
				sum += win[13] * fifo[i + 160];
				sum += win[14] * fifo[i + 192];
				sum += win[15] * fifo[i + 288];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 384:
			//u_vector={384,480,512,608,640,736,768,864,896,992,0,96,128,224,256,352}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 384];
				sum += win[1] * fifo[i + 480];
				sum += win[2] * fifo[i + 512];
				sum += win[3] * fifo[i + 608];
				sum += win[4] * fifo[i + 640];
				sum += win[5] * fifo[i + 736];
				sum += win[6] * fifo[i + 768];
				sum += win[7] * fifo[i + 864];
				sum += win[8] * fifo[i + 896];
				sum += win[9] * fifo[i + 992];
				sum += win[10] * fifo[i];
				sum += win[11] * fifo[i + 96];
				sum += win[12] * fifo[i + 128];
				sum += win[13] * fifo[i + 224];
				sum += win[14] * fifo[i + 256];
				sum += win[15] * fifo[i + 352];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 448:
			//u_vector={448,544,576,672,704,800,832,928,960,32,64,160,192,288,320,416}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 448];
				sum += win[1] * fifo[i + 544];
				sum += win[2] * fifo[i + 576];
				sum += win[3] * fifo[i + 672];
				sum += win[4] * fifo[i + 704];
				sum += win[5] * fifo[i + 800];
				sum += win[6] * fifo[i + 832];
				sum += win[7] * fifo[i + 928];
				sum += win[8] * fifo[i + 960];
				sum += win[9] * fifo[i + 32];
				sum += win[10] * fifo[i + 64];
				sum += win[11] * fifo[i + 160];
				sum += win[12] * fifo[i + 192];
				sum += win[13] * fifo[i + 288];
				sum += win[14] * fifo[i + 320];
				sum += win[15] * fifo[i + 416];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 512:
			//u_vector={512,608,640,736,768,864,896,992,0,96,128,224,256,352,384,480}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 512];
				sum += win[1] * fifo[i + 608];
				sum += win[2] * fifo[i + 640];
				sum += win[3] * fifo[i + 736];
				sum += win[4] * fifo[i + 768];
				sum += win[5] * fifo[i + 864];
				sum += win[6] * fifo[i + 896];
				sum += win[7] * fifo[i + 992];
				sum += win[8] * fifo[i];
				sum += win[9] * fifo[i + 96];
				sum += win[10] * fifo[i + 128];
				sum += win[11] * fifo[i + 224];
				sum += win[12] * fifo[i + 256];
				sum += win[13] * fifo[i + 352];
				sum += win[14] * fifo[i + 384];
				sum += win[15] * fifo[i + 480];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 576:
			//u_vector={576,672,704,800,832,928,960,32,64,160,192,288,320,416,448,544}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 576];
				sum += win[1] * fifo[i + 672];
				sum += win[2] * fifo[i + 704];
				sum += win[3] * fifo[i + 800];
				sum += win[4] * fifo[i + 832];
				sum += win[5] * fifo[i + 928];
				sum += win[6] * fifo[i + 960];
				sum += win[7] * fifo[i + 32];
				sum += win[8] * fifo[i + 64];
				sum += win[9] * fifo[i + 160];
				sum += win[10] * fifo[i + 192];
				sum += win[11] * fifo[i + 288];
				sum += win[12] * fifo[i + 320];
				sum += win[13] * fifo[i + 416];
				sum += win[14] * fifo[i + 448];
				sum += win[15] * fifo[i + 544];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 640:
			//u_vector={640,736,768,864,896,992,0,96,128,224,256,352,384,480,512,608}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 640];
				sum += win[1] * fifo[i + 736];
				sum += win[2] * fifo[i + 768];
				sum += win[3] * fifo[i + 864];
				sum += win[4] * fifo[i + 896];
				sum += win[5] * fifo[i + 992];
				sum += win[6] * fifo[i];
				sum += win[7] * fifo[i + 96];
				sum += win[8] * fifo[i + 128];
				sum += win[9] * fifo[i + 224];
				sum += win[10] * fifo[i + 256];
				sum += win[11] * fifo[i + 352];
				sum += win[12] * fifo[i + 384];
				sum += win[13] * fifo[i + 480];
				sum += win[14] * fifo[i + 512];
				sum += win[15] * fifo[i + 608];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 704:
			//u_vector={704,800,832,928,960,32,64,160,192,288,320,416,448,544,576,672}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 704];
				sum += win[1] * fifo[i + 800];
				sum += win[2] * fifo[i + 832];
				sum += win[3] * fifo[i + 928];
				sum += win[4] * fifo[i + 960];
				sum += win[5] * fifo[i + 32];
				sum += win[6] * fifo[i + 64];
				sum += win[7] * fifo[i + 160];
				sum += win[8] * fifo[i + 192];
				sum += win[9] * fifo[i + 288];
				sum += win[10] * fifo[i + 320];
				sum += win[11] * fifo[i + 416];
				sum += win[12] * fifo[i + 448];
				sum += win[13] * fifo[i + 544];
				sum += win[14] * fifo[i + 576];
				sum += win[15] * fifo[i + 672];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 768:
			//u_vector={768,864,896,992,0,96,128,224,256,352,384,480,512,608,640,736}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 768];
				sum += win[1] * fifo[i + 864];
				sum += win[2] * fifo[i + 896];
				sum += win[3] * fifo[i + 992];
				sum += win[4] * fifo[i];
				sum += win[5] * fifo[i + 96];
				sum += win[6] * fifo[i + 128];
				sum += win[7] * fifo[i + 224];
				sum += win[8] * fifo[i + 256];
				sum += win[9] * fifo[i + 352];
				sum += win[10] * fifo[i + 384];
				sum += win[11] * fifo[i + 480];
				sum += win[12] * fifo[i + 512];
				sum += win[13] * fifo[i + 608];
				sum += win[14] * fifo[i + 640];
				sum += win[15] * fifo[i + 736];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 832:
			//u_vector={832,928,960,32,64,160,192,288,320,416,448,544,576,672,704,800}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 832];
				sum += win[1] * fifo[i + 928];
				sum += win[2] * fifo[i + 960];
				sum += win[3] * fifo[i + 32];
				sum += win[4] * fifo[i + 64];
				sum += win[5] * fifo[i + 160];
				sum += win[6] * fifo[i + 192];
				sum += win[7] * fifo[i + 288];
				sum += win[8] * fifo[i + 320];
				sum += win[9] * fifo[i + 416];
				sum += win[10] * fifo[i + 448];
				sum += win[11] * fifo[i + 544];
				sum += win[12] * fifo[i + 576];
				sum += win[13] * fifo[i + 672];
				sum += win[14] * fifo[i + 704];
				sum += win[15] * fifo[i + 800];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 896:
			//u_vector={896,992,0,96,128,224,256,352,384,480,512,608,640,736,768,864}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 896];
				sum += win[1] * fifo[i + 992];
				sum += win[2] * fifo[i];
				sum += win[3] * fifo[i + 96];
				sum += win[4] * fifo[i + 128];
				sum += win[5] * fifo[i + 224];
				sum += win[6] * fifo[i + 256];
				sum += win[7] * fifo[i + 352];
				sum += win[8] * fifo[i + 384];
				sum += win[9] * fifo[i + 480];
				sum += win[10] * fifo[i + 512];
				sum += win[11] * fifo[i + 608];
				sum += win[12] * fifo[i + 640];
				sum += win[13] * fifo[i + 736];
				sum += win[14] * fifo[i + 768];
				sum += win[15] * fifo[i + 864];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		case 960:
			//u_vector={960,32,64,160,192,288,320,416,448,544,576,672,704,800,832,928}
			for(i = 0; i < 32; i++) {
				win = dewin[i];
				sum = win[0] * fifo[i + 960];
				sum += win[1] * fifo[i + 32];
				sum += win[2] * fifo[i + 64];
				sum += win[3] * fifo[i + 160];
				sum += win[4] * fifo[i + 192];
				sum += win[5] * fifo[i + 288];
				sum += win[6] * fifo[i + 320];
				sum += win[7] * fifo[i + 416];
				sum += win[8] * fifo[i + 448];
				sum += win[9] * fifo[i + 544];
				sum += win[10] * fifo[i + 576];
				sum += win[11] * fifo[i + 672];
				sum += win[12] * fifo[i + 704];
				sum += win[13] * fifo[i + 800];
				sum += win[14] * fifo[i + 832];
				sum += win[15] * fifo[i + 928];
				pcmi = sum > 32767 ? 32767 : (sum < -32768 ? -32768 : sum);
				pcmbuff[pcmbuff.length] = pcmi/(pcmi>0 ? 32767 : 32768);
			}
			break;
		}
	}

	_proto_.doSynthesis = function(xrch, ch, pcmbuff){
		var samples = [];
		for (var gr = 0; gr < 2; gr++) {
			var xr = xrch[gr][ch];
			for (var ss = 0; ss < 18; ss += 2) {
				for (var i = ss, sub = 0; sub < 32; sub++, i += 18)
				{
					samples[sub] = xr[i];
				}
				this.synthesisSubBand(samples, ch, pcmbuff);

				for (i = ss + 1, sub = 0; sub < 32; sub += 2, i += 36) {
					samples[sub] = xr[i];

					// 多相频率倒置(INVERSE QUANTIZE SAMPLES)
					samples[sub + 1] = -xr[i + 18];
				}
				this.synthesisSubBand(samples, ch, pcmbuff);
			}
		}
	}

	return Synthesis;
})