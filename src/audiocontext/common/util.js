var Util = {};

//ArrayBuffer转16进制字符串
Util.arrayBufferToHexChar = function(arrayBuffer) {
    var bufferStr = '';
    var uint8Array = new Uint8Array(arrayBuffer);
    for (var i = 0; i < uint8Array.length; i++) {
        if (uint8Array[i] <= 15) {
            bufferStr += '0' + uint8Array[i].toString(16);
        } else {
            bufferStr += uint8Array[i].toString(16);
        }
        bufferStr += ',';
    }
    return bufferStr.slice(0, bufferStr.length - 1);
}

/**
 * 根据同步标识返回相应数据长度
 * @param  {ArrayBuffer} arrayBuffer 音频源数据
 * @param  {String}      frameSync   16进制同步字符串标识
 * @param  {Number}      offset      正向查找时头部需要跳过的字节数
 * @param  {Boolean}     reverse     查找方向
 * @param  {Number}      frameSize   逆向查找时需要返回多少帧数据长度
 * @return {Number}                  数据长度
 */
Util.getLengthByFrameSync = function(arrayBuffer, frameSync, offset, reverse, frameSize) {
    var i = 0;
    var count = 200;
    var bufferStr = '';
    var uint8Array = new Uint8Array(arrayBuffer);
    offset = offset || 0;
    frameSize = frameSize || 1;
    if (!reverse) {
        while (true) {
            for (; i < count && i < uint8Array.length; i++) {
                if (uint8Array[i] <= 15) {
                    bufferStr += '0' + uint8Array[i].toString(16);
                } else {
                    bufferStr += uint8Array[i].toString(16);
                }
                bufferStr += ',';
            }
            bufferStr = bufferStr.toUpperCase();
            if (bufferStr.indexOf(frameSync, offset * 3) != -1) {
                return bufferStr.indexOf(frameSync, offset * 3) / 3;
            }
            if (i >= uint8Array.length) {
                return 0;
            }
            count += 200;
        }
    } else {
        var flagReg = new RegExp(frameSync, 'g');
        var match = null;
        i = uint8Array.length - 1;
        count = uint8Array.length - 200;
        while (true) {
            for (; i > count && i > 0; i--) {
                if (uint8Array[i] <= 15) {
                    bufferStr = '0' + uint8Array[i].toString(16) + ',' + bufferStr;
                } else {
                    bufferStr = uint8Array[i].toString(16) + ',' + bufferStr;
                }
            }
            bufferStr = bufferStr.toUpperCase();
            match = bufferStr.match(flagReg);
            if (match && match.length >= frameSize) { //找出多少帧
                return bufferStr.length / 3 - bufferStr.indexOf(frameSync) / 3;
            }
            if (i == 0) {
                return 0;
            }
            count -= 200;
        }
    }
}

Util.formatCountDown = function(seconds, noZero) {
    var date = new Date();
    date.setDate(0);
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setSeconds(seconds);
    var data = {
        date: Math.floor(seconds / (60 * 60 * 24)),
        hours: date.getHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds()
    }
    if (!noZero) {
        data.date = data.date >= 10 ? data.date : '0' + data.date;
        data.hours = data.hours >= 10 ? data.hours : '0' + data.hours;
        data.minutes = data.minutes >= 10 ? data.minutes : '0' + data.minutes;
        data.seconds = data.seconds >= 10 ? data.seconds : '0' + data.seconds;
    }
    return data;
}

Util.ifDebug = function(){
    return location.href.indexOf('debug') > -1;
}

Util.log = function() {
    if (location.search.indexOf('audio-debug') > -1) {
        console.log.apply(window, arguments);
    }
}

export default Util;