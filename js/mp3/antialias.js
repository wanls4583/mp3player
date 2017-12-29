/**
 * 消混叠处理模块
 */
define(function(require, exports , module){
	'use strict';

	var sideInfo = null;

	function Antialias(_sideInfo){
		sideInfo = _sideInfo;
	}

	var _proto_ = Antialias.prototype;
	/**
	 * 消混叠处理（相邻18个频率线中间相邻的8个频率线对做蝶形变换）
     * @param  number gr 颗粒索引
     * @param  number ch 声道索引
     * @param  array xrch 立体声处理后的value数组
	 */
	_proto_.doAntialias = function(gr, ch, xrch){
		var i, maxidx;
		var bu, bd;

		if (sideInfo.block_type[gr][ch] == 2) {
			if (sideInfo.mixed_block_flag[gr][ch] == 0)
				return;
			maxidx = 18;
		} else
			maxidx = sideInfo.rzeroIndex[gr][ch] - 18;

		for (i = 0; i < maxidx; i += 18) {
			bu = xrch[i + 17];
			bd = xrch[i + 18];
			xrch[i + 17] = bu * 0.85749293 + bd * 0.51449576;
			xrch[i + 18] = bd * 0.85749293 - bu * 0.51449576;
			bu = xrch[i + 16];
			bd = xrch[i + 19];
			xrch[i + 16] = bu * 0.8817420 + bd * 0.47173197;
			xrch[i + 19] = bd * 0.8817420 - bu * 0.47173197;
			bu = xrch[i + 15];
			bd = xrch[i + 20];
			xrch[i + 15] = bu * 0.94962865 + bd * 0.31337745;
			xrch[i + 20] = bd * 0.94962865 - bu * 0.31337745;
			bu = xrch[i + 14];
			bd = xrch[i + 21];
			xrch[i + 14] = bu * 0.98331459 + bd * 0.18191320;
			xrch[i + 21] = bd * 0.98331459 - bu * 0.18191320;
			bu = xrch[i + 13];
			bd = xrch[i + 22];
			xrch[i + 13] = bu * 0.99551782 + bd * 0.09457419;
			xrch[i + 22] = bd * 0.99551782 - bu * 0.09457419;
			bu = xrch[i + 12];
			bd = xrch[i + 23];
			xrch[i + 12] = bu * 0.99916056 + bd * 0.04096558;
			xrch[i + 23] = bd * 0.99916056 - bu * 0.04096558;
			bu = xrch[i + 11];
			bd = xrch[i + 24];
			xrch[i + 11] = bu * 0.99989920 + bd * 0.0141986;
			xrch[i + 24] = bd * 0.99989920 - bu * 0.0141986;
			bu = xrch[i + 10];
			bd = xrch[i + 25];
			xrch[i + 10] = bu * 0.99999316 + bd * 3.69997467e-3;
			xrch[i + 25] = bd * 0.99999316 - bu * 3.69997467e-3;
		}
	}
})