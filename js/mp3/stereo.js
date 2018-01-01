/**
 * stereo立体声处理模块
 */
define(function(require, exports, module) {
    'use strict';

    function Stereo(_sideInfo){
    	this.sideInfo = _sideInfo;
    }

    var _proto_ = Stereo.prototype;

    /**
     * Middle/Side stereo立体声处理
     * @param  number gr   颗粒索引
     * @param  arrary xrch  逆量化后的value数组(左边声道，右声道)
     */
    _proto_.ms_stereo = function(gr, xrch){
    	var xr0 = xrch[0], xr1 = xrch[1];
		var rzero_xr = (this.sideInfo.rzeroIndex[gr][0] > this.sideInfo.rzeroIndex[gr][1]) ? this.sideInfo.rzeroIndex[gr][0] : this.sideInfo.rzeroIndex[gr][1];
		var tmp0, tmp1;
		
		for (var xri = 0; xri < rzero_xr; xri++) {
			tmp0 = xr0[xri];
			tmp1 = xr1[xri];
			xr0[xri] = tmp0 + tmp1;
			xr1[xri] = tmp0 - tmp1;
		}
		this.sideInfo.rzeroIndex[gr][0] = this.sideInfo.rzeroIndex[gr][1] = rzero_xr; // ...不然可能导致声音细节丢失  
    }
    /**
     * intensity stereo立体声处理（很难听出差别，可不处理）
     */
    _proto_.i_stereo = function(){}

    return Stereo;
})