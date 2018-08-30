var Mad = {};

Mad.Error = {
  NONE           : 0x0000,      /* no error */

  BUFLEN         : 0x0001,      /* input buffer too small (or EOF) */
  BUFPTR         : 0x0002,      /* invalid (null) buffer pointer */

  NOMEM          : 0x0031,      /* not enough memory */

  LOSTSYNC       : 0x0101,      /* lost synchronization */
  BADLAYER       : 0x0102,      /* reserved header layer value */
  BADBITRATE     : 0x0103,      /* forbidden bitrate value */
  BADSAMPLERATE  : 0x0104,      /* reserved sample frequency value */
  BADEMPHASIS    : 0x0105,      /* reserved emphasis value */

  BADCRC         : 0x0201,      /* CRC check failed */
  BADBITALLOC    : 0x0211,      /* forbidden bit allocation value */
  BADSCALEFACTOR : 0x0221,      /* bad scalefactor index */
  BADMODE        : 0x0222,      /* bad bitrate/mode combination */
  BADFRAMELEN    : 0x0231,      /* bad frame length */
  BADBIGVALUES   : 0x0232,      /* bad big_values count */
  BADBLOCKTYPE   : 0x0233,      /* reserved block_type */
  BADSCFSI       : 0x0234,      /* bad scalefactor selection info */
  BADDATAPTR     : 0x0235,      /* bad main_data_begin pointer */
  BADPART3LEN    : 0x0236,      /* bad audio data length */
  BADHUFFTABLE   : 0x0237,      /* bad Huffman table select */
  BADHUFFDATA    : 0x0238,      /* Huffman data overrun */
  BADSTEREO      : 0x0239       /* incompatible block_type for JS */
};
Mad.BUFFER_GUARD = 8;
Mad.BUFFER_MDLEN = (511 + 2048 + Mad.BUFFER_GUARD);
Mad.Layer = {
    I: 1,
    II: 2,
    III: 3
};
Mad.Mode = {
    SINGLE_CHANNEL      : 0,
    DUAL_CHANNEL        : 1,      /* dual channel */
    JOINT_STEREO        : 2,      /* joint (MS/intensity) stereo */
    STEREO              : 3       /* normal LR stereo */
};
Mad.Emphasis = {
    NONE       : 0,     /* no emphasis */
    _50_15_US  : 1,     /* 50/15 microseconds emphasis */
    CCITT_J_17 : 3,     /* CCITT J.17 emphasis */
    RESERVED   : 2      /* unknown emphasis */
};
Mad.Flag = {
    NPRIVATE_III   : 0x0007,   /* number of Layer III private bits */
    INCOMPLETE : 0x0008,   /* header but not data is decoded */

    PROTECTION : 0x0010,   /* frame has CRC protection */
    COPYRIGHT  : 0x0020,   /* frame is copyright */
    ORIGINAL   : 0x0040,   /* frame is original (else copy) */
    PADDING    : 0x0080,   /* frame has additional slot */

    I_STEREO   : 0x0100,   /* uses intensity joint stereo */
    MS_STEREO  : 0x0200,   /* uses middle/side joint stereo */
    FREEFORMAT : 0x0400,   /* uses free format bitrate */

    LSF_EXT    : 0x1000,   /* lower sampling freq. extension */
    MC_EXT : 0x2000,   /* multichannel audio extension */
    MPEG_2_5_EXT   : 0x4000    /* MPEG 2.5 (unofficial) extension */
};
Mad.Private = {
    HEADER  : 0x0100,   /* header private bit */
    III : 0x001f    /* Layer III private bits (up to 5) */
};
Mad.count1table_select = 0x01;
Mad.scalefac_scale     = 0x02;
Mad.preflag            = 0x04;
Mad.mixed_block_flag   = 0x08;
Mad.I_STEREO  = 0x1;
Mad.MS_STEREO = 0x2;

Mad.sbsampleIndex = function (i, j, k) {
    return i * 36 * 32 + j * 32 + k;
};

Mad.overlapIndex = function (i, j, k) {
    return i * 32 * 18 + j * 18 + k;
};


Mad.recoverable = function (error) {
    return (error & 0xff00) != 0;
};

// credit: http://blog.stevenlevithan.com/archives/fast-string-multiply
Mad.mul = function (str, num) {
        var     i = Math.ceil(Math.log(num) / Math.LN2), res = str;
        do {
                res += res;
        } while (0 < --i);
        return res.slice(0, str.length * num);
};

Mad.memcpy = function (dst, dstOffset, src, srcOffset, length) {
    // this is a pretty weird memcpy actually - it constructs a new version of dst, because we have no other way to do it
    return dst.slice(0, dstOffset) + src.slice(srcOffset, srcOffset + length) + dst.slice(dstOffset + length);
};

Mad.rshift = function (num, bits) {
    return Math.floor(num / Math.pow(2, bits));
};

Mad.lshiftU32 = function (num, bits) {
    return Mad.bitwiseAnd(Mad.lshift(num, bits), 4294967295 /* 2^32 - 1 */);
};

Mad.lshift = function (num, bits) {
    return num * Math.pow(2, bits);
};

Mad.bitwiseOr = function (a, b) {
    var w = 2147483648; // 2^31

    var aHI = (a / w) << 0;
    var aLO = a % w;
    var bHI = (b / w) << 0;
    var bLO = b % w;

    return ((aHI | bHI) * w + (aLO | bLO));
};

Mad.bitwiseAnd = function (a, b) {
    var w = 2147483648; // 2^31

    var aHI = (a / w) << 0;
    var aLO = a % w;
    var bHI = (b / w) << 0;
    var bLO = b % w;

    return ((aHI & bHI) * w + (aLO & bLO));
};

export default Mad;