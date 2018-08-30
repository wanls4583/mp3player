import ByteStream from './bytestream';

var StringStream = function(string) {
    this.state = { offset: 0, buffer: string, amountRead: string.length, length: string.length };
}

StringStream.prototype = new ByteStream();

StringStream.prototype.absoluteAvailable = function(n, updated) {
    return n < this.state['amountRead'];
}

StringStream.prototype.seek = function(n) {
    this.state['offset'] += n;
}

StringStream.prototype.read = function(n) {
    var result = this.peek(n);
    
    this.seek(n);
    
    return result;
}

StringStream.prototype.peek = function(n) {
    if (this.available(n)) {
        var offset = this.state['offset'];
        
        var result = this.get(offset, n);
        
        return result;
    } else {
        throw 'TODO: THROW PEEK ERROR!';
    }
}

StringStream.prototype.get = function(offset, length) {
    if (this.absoluteAvailable(offset + length)) {
        return this.state['buffer'].slice(offset, offset + length);
    } else {
        throw 'TODO: THROW GET ERROR!';
    }
}

export default StringStream;