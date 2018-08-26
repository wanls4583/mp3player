Mad.BufferStream = function(arrayBuffer) {
    this.state = {};
    this.state['arrayBuffer'] = arrayBuffer;
    this.state['byteBuffer'] = new Uint8Array(arrayBuffer);
    this.state['amountRead'] = arrayBuffer.byteLength;
}

Mad.BufferStream.prototype = new Mad.ByteStream();


Mad.BufferStream.prototype.absoluteAvailable = function(n) {
    if (n > this.state['amountRead']) {
        throw new Error("buffer underflow with absoluteAvailable!");
    } else {
        return true;
    }
}

Mad.BufferStream.prototype.seek = function(n) {
    this.state['offset'] += n;
}

Mad.BufferStream.prototype.read = function(n) {
    var result = this.peek(n);

    this.seek(n);

    return result;
}

Mad.BufferStream.prototype.peek = function(n) {
    if (this.available(n)) {
        var offset = this.state['offset'];

        var result = this.get(offset, n);

        return result;
    } else {
        throw new Error("buffer underflow with peek!");
    }
}

Mad.BufferStream.prototype.get = function(offset, length) {
    if (this.absoluteAvailable(offset + length)) {
        var tmpbuffer = "";
        for (var i = offset; i < offset + length; i += 1) {
            tmpbuffer = tmpbuffer + String.fromCharCode(this.state['byteBuffer'][i]);
        }
        return tmpbuffer;
    } else {
        throw new Error("buffer underflow with get!");
    }
}

Mad.ByteStream.prototype.getU8 = function(offset, bigEndian) {
    if (this.state['byteBuffer']) {
        return this.state['byteBuffer'][offset];
    }

    return this.get(offset, 1).charCodeAt(0);
}

Mad.BufferStream.prototype.requestAbsolute = function(n, callback) {
    if (n < this.state['amountRead']) {
        callback();
    } else {
        this.state['callbacks'].push([n, callback]);
    }
}

Mad.BufferStream.prototype.request = function(n, callback) {
    this.requestAbsolute(this.state['offset'] + n, callback);
}