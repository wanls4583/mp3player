import ByteStream from './bytestream';

var BufferStream = function(arrayBuffer) {
    this.state = {};
    this.state['arrayBuffer'] = arrayBuffer;
    this.state['byteBuffer'] = new Uint8Array(arrayBuffer);
    this.state['amountRead'] = arrayBuffer.byteLength;
}

BufferStream.prototype = new ByteStream();


BufferStream.prototype.absoluteAvailable = function(n) {
    if (n > this.state['amountRead']) {
        throw new Error("buffer underflow with absoluteAvailable!");
    } else {
        return true;
    }
}

BufferStream.prototype.seek = function(n) {
    this.state['offset'] += n;
}

BufferStream.prototype.read = function(n) {
    var result = this.peek(n);

    this.seek(n);

    return result;
}

BufferStream.prototype.peek = function(n) {
    if (this.available(n)) {
        var offset = this.state['offset'];

        var result = this.get(offset, n);

        return result;
    } else {
        throw new Error("buffer underflow with peek!");
    }
}

BufferStream.prototype.get = function(offset, length) {
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

ByteStream.prototype.getU8 = function(offset, bigEndian) {
    if (this.state['byteBuffer']) {
        return this.state['byteBuffer'][offset];
    }

    return this.get(offset, 1).charCodeAt(0);
}

BufferStream.prototype.requestAbsolute = function(n, callback) {
    if (n < this.state['amountRead']) {
        callback();
    } else {
        this.state['callbacks'].push([n, callback]);
    }
}

BufferStream.prototype.request = function(n, callback) {
    this.requestAbsolute(this.state['offset'] + n, callback);
}

export default BufferStream;