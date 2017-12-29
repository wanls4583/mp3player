/**
 * 逆量化与重排序模块
 */
define(function(require, exports, module) {
    'use strict';

    var sideInfo = null;
    var header = null;
    var pretab = [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,3,3,3,2,0]; //Layer III Preemphasis
	var floatPowIS = new Array(8207); // 用于查表求 v^(4/3)，v是经哈夫曼解码出的一个(正)值，该值的范围是0..8191
	for (var i = 0; i < 8207; i++)
		floatPowIS[i] = Math.pow(i, 4.0 / 3.0);
    var floatPow2 = new Array(328 + 46); //查表法时下标范围为0..328+45.
	for (i = 0; i < 374; i++)
		floatPow2[i] = Math.pow(2.0, -0.25 * (i - 45));

    function Requantizer(_sideInfo, _header) {
    	sideInfo = _sideInfo;
    	header = _header;
    }

    var _proto_ = Requantizer.prototype;

    /**
     * 逆量化
     * @param  number gr 颗粒索引
     * @param  number ch 声道索引
     * @param  array hv 哈夫曼解码后的value数组
     * @return array  逆量化和重排序后的value数组
     */
    _proto_.doRequantizer = function(gr, ch, hv) {
        var preflag = sideInfo.preflag[gr][ch] == 1;
        var shift = 1 + sideInfo.scalefac_scale[gr][ch];
        var maxi = sideInfo.rzeroIndex[gr][ch];
        var requVal;
        var bi = 0, sfb = 0, width, pre, val, hvIdx = 0, xri = 0, scf = 0;
        var xriStart = 0; // 用于计算短块重排序后的下标
        var pow2i = 255 - sideInfo.global_gain[gr][ch];
        var rzeroBandShort = [];
        var rzeroBandLong = -1;
        var xrch = []; //逆量化结果

        if (header.channelModeExtension==2 || header.channelModeExtension==3) //isMS
            pow2i += 2; // 若声道模式为ms_stereo,要除以根2

        // pure SHORT blocks:
        // window_switching_flag=1, block_type=2, mixed_block_flag=0

        if (sideInfo.window_switching_flag[gr][ch] == 1 && sideInfo.block_type[gr][ch] == 2) {
            rzeroBandShort[0] = rzeroBandShort[1] = rzeroBandShort[2] = -1;
            if (sideInfo.mixed_block_flag[gr][ch] == 1) {
                /*
                 * 混合块:
                 * 混合块的前8个频带是长块。 前8块各用一个增益因子逆量化，这8个增益因子 的频带总和为36，
                 * 这36条频率线用长块公式逆量化。
                 */
                rzeroBandLong = -1;
                for (; sfb < 8; sfb++) {
                    pre = sideInfo.preflag[gr][ch] ? pretab[sfb] : 0;
                    requVal = floatPow2[pow2i + ((sideInfo.scfL[ch][sfb] + pre) << shift)];
                    width = sideInfo.widthLong[sfb];
                    for (bi = 0; bi < width; bi++) {
                        val = hv[hvIdx]; // 哈夫曼值
                        if (val < 0) {
                            xrch[hvIdx] = -requVal * floatPowIS[-val];
                            rzeroBandLong = sfb;
                        } else if (val > 0) {
                            xrch[hvIdx] = requVal * floatPowIS[val];
                            rzeroBandLong = sfb;
                        } else
                            xrch[hvIdx] = 0;
                        hvIdx++;
                    }
                }

                /*
                 * 混合块的后9个频带是被加窗的短块，其每一块同一窗口内3个值的增益因子频带相同。
                 * 后9块增益因子对应的频率子带值为widthShort[3..11]
                 */
                rzeroBandShort[0] = rzeroBandShort[1] = rzeroBandShort[2] = 2;
                rzeroBandLong++;
                sfb = 3;
                scf = 9;
                xriStart = 36; // 为短块重排序准备好下标
            }

            // 短块(混合块中的短块和纯短块)
            var subgain = subblock_gain[gr][ch];
            var win;
            subgain[0] <<= 3;
            subgain[1] <<= 3;
            subgain[2] <<= 3;
            for (; hvIdx < maxi; sfb++) {
                width = widthShort[sfb];
                for (win = 0; win < 3; win++) {
                    requVal = floatPow2[pow2i + subgain[win] + (sideInfo.scfS[ch][scf++] << shift)];
                    xri = xriStart + win;
                    for (bi = 0; bi < width; bi++) {
                        val = hv[hvIdx];
                        if (val < 0) {
                            xrch[xri] = -requVal * floatPowIS[-val];
                            rzeroBandShort[win] = sfb;
                        } else if (val > 0) {
                            xrch[xri] = requVal * floatPowIS[val];
                            rzeroBandShort[win] = sfb;
                        } else
                            xrch[xri] = 0;
                        hvIdx++;
                        xri += 3;
                    }
                }
                xriStart = xri - 2;
            }
            rzeroBandShort[0]++;
            rzeroBandShort[1]++;
            rzeroBandShort[2]++;
            rzeroBandLong++;
        } else {
            // 长块
            xri = -1;
            for (; hvIdx < maxi; sfb++) {
                pre = preflag ? pretab[sfb] : 0;
                requVal = floatPow2[pow2i + ((sideInfo.scfL[ch][sfb] + pre) << shift)];
                bi = hvIdx + sideInfo.widthLong[sfb];
                for (; hvIdx < bi; hvIdx++) {
                    val = hv[hvIdx];
                    if (val < 0) {
                        xrch[hvIdx] = -requVal * floatPowIS[-val];
                        xri = sfb;
                    } else if (val > 0) {
                        xrch[hvIdx] = requVal * floatPowIS[val];
                        xri = sfb;
                    } else
                        xrch[hvIdx] = 0;
                }
            }
            rzeroBandLong = xri + 1;
        }

        // 不逆量化0值区,置0.
        for (; hvIdx < 576; hvIdx++)
            xrch[hvIdx] = 0;
        sideInfo.rzeroBandLong = rzeroBandLong; //用于强度立体声(intensity stereo)处理
        sideInfo.rzeroBandShort = rzeroBandShort; //用于强度立体声处理

        return xrch;
    }
    return	Requantizer;
})