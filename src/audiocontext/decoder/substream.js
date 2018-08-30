import ByteStream from './bytestream';

var SubStream = function(stream, offset, length) {
    this.state = { 'offset': 0 };
    
    this.state['start'] = offset;
    
    this.parentStream = stream;
    
    this.length = length;
}

SubStream.prototype = new ByteStream();

SubStream.prototype.absoluteAvailable = function(n) {
    return this.parentStream.absoluteAvailable(this.state['start'] + n);
}

SubStream.prototype.seek = function(n) {
    this.state['offset'] += n;
}

SubStream.prototype.read = function(n) {
    var result = this.peek(n);
    
    this.seek(n);
    
    return result;
}

SubStream.prototype.peek = function(n) {
    return this.get(this.state['offset'], n);
}

SubStream.prototype.get = function(offset, length) {
    return this.parentStream.get(this.state['start'] + offset, length);
}

SubStream.prototype.slice = function(start, end) {
    return this.parentStream.get(this.state['start'] + start, end - start);
}

SubStream.prototype.requestAbsolute = function(n, callback) {
    this.parentStream.requestAbsolute(this.state['start'] + n)
}

SubStream.prototype.request = function(n, callback) {
    this.parentStream.requestAbsolute(this.state['start'] + this.state['offset'] + n)
}

export default SubStream;