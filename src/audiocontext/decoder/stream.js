import Bit from './bit';
import Mad from './global';

var Stream = function (stream) {
    this.stream = stream;                           /* actual buffer (js doesn't have pointers!) */
    this.buffer = 0;                                /* input bitstream buffer */
    this.bufend = stream.length;                    /* input bitstream buffer */
    this.skiplen = 0;                               /* bytes to skip before next frame */

    this.sync = 0;                                  /* stream sync found */
    this.freerate = 0;                              /* free bitrate (fixed) */

    this.this_frame = 0;                            /* start of current frame */
    this.next_frame = 0;                            /* start of next frame */
    
    this.ptr = new Bit(this.stream, this.buffer); /* current processing bit pointer */
    
    this.anc_ptr = /* MadBit */ null;               /* ancillary bits pointer */
    this.anc_bitlen = 0;                            /* number of ancillary bits */

    this.main_data = /* string */ Mad.mul("\0", Mad.BUFFER_MDLEN); /* Layer III main_data() */
    this.md_len = 0; /* bytes in main_data */

    var options = 0;                                /* decoding options (see below) */
    var error = Mad.Error.NONE;                     /* error code (see above) */
};

Stream.fromFile = function(file, callback) {
    var reader = new FileReader();
    reader.onloadend = function (evt) {
        callback(new Stream(evt.target.result));
    };
    reader.readAsBinaryString(file);
};

Stream.prototype.readShort = function(bBigEndian) {
    return this.stream.readU16(bBigEndian);
};
    
Stream.prototype.readSShort = function(bBigEndian) {
    return this.stream.readI16(bBigEndian);
};

Stream.prototype.getU8 = function(index) {
    return this.stream.getU8(index);
};


Stream.prototype.readU8 = function() {
    return this.stream.readU8(index);
};

Stream.prototype.readChars = function(length) {
    return this.stream.read(length);
};

Stream.prototype.peekChars = function(length) {
    return this.stream.peek(length);
}

/*
 * NAME:        stream->sync()
 * DESCRIPTION: locate the next stream sync word
 */
Stream.prototype.doSync = function() {
    var ptr = this.ptr.nextbyte();
    var end = this.bufend;

    while (ptr < end - 1 && !(this.getU8(ptr) == 0xff && (this.getU8(ptr + 1) & 0xe0) == 0xe0)) {
        ++ptr;
    }

    if (end - ptr < Mad.BUFFER_GUARD) {
        return -1;
    }

    this.ptr = new Bit(this.stream, ptr);
    
    return 0;
}

export default Stream;
