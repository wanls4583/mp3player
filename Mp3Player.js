! function(global) {
    var indexSize = 100; //区块个数
    var url = ''; //音频链接
    var decrypt = function() {}; //解密函数
    Array.prototype.indexOf = function(item) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == item) {
                return i;
            }
        }
        return -1;
    }
    //MP3播放信息解析对象
    var MP3InfoAnalysis = {
        init: function() {
            this.mp3Info = {}; //存储mp3相关的信息
            return new Promise(MP3InfoAnalysis.loadHeaderInfo).then(MP3InfoAnalysis.loadFirstFrame).then(MP3InfoAnalysis.getInfo);
        },
        //ajax获取音频头部标签头(32B)
        loadHeaderInfo: function(resolve, reject) {
            var request = new XMLHttpRequest();
            request.open('GET', url, true);
            request.responseType = 'arraybuffer';
            request.onload = function() {
                var arrayBuffer = request.response;
                var contentLength = request.getResponseHeader('Content-Length');
                var contetnRange = request.getResponseHeader('Content-Range');
                //数据解密
                decrypt(arrayBuffer);
                if (contentLength != 32 * 8) {
                    console.error('获取头部信息出错');
                }
                MP3InfoAnalysis.mp3Info.fileSize = parseInt(contetnRange.substr(contetnRange.indexOf('/') + 1));
                MP3InfoAnalysis.mp3Info.headerLength = MP3InfoAnalysis.getHeaderLength(arrayBuffer);
                resolve();
            }
            request.setRequestHeader("Range", "bytes=0-" + (32 * 8 - 1));
            request.send();
        },
        //获取ID3V2|APEV2标签长度
        getHeaderLength: function(arrayBuffer) {
            var uint8Array = new Uint8Array(arrayBuffer);
            var headerLength = 0;
            var tag = '';
            var type = '';
            for (var i = 0; i < 8; i++) {
                tag += String.fromCharCode(uint8Array[i])
            }
            if (tag.substring(0, 3) == 'ID3') {
                headerLength = (((uint8Array[6] & 0x7F) << 21) | ((uint8Array[7] & 0x7F) << 14) | ((uint8Array[8] & 0x7F) << 7) | (uint8Array[9] & 0x7F)) + 10;
            } else if (tag == 'APETAGEX') {
                headerLength = ((uint8Array[12]) | (uint8Array[13] << 8) | (uint8Array[14] << 16) | (uint8Array[15] << 24)) + 32;
            }
            return headerLength;
        },
        //加载第一个数据帧
        loadFirstFrame: function() {
            return new Promise(function(resolve, reject) {
                var request = new XMLHttpRequest();
                request.open('GET', url, true);
                request.responseType = 'arraybuffer';
                request.onload = function() {
                    var arrayBuffer = request.response;
                    var contentLength = request.getResponseHeader('Content-Length');
                    var contetnRange = request.getResponseHeader('Content-Range');
                    //数据解密
                    decrypt(arrayBuffer);
                    if (contentLength != 156 * 8) {
                        console.error('获取第一帧数据帧出错');
                    }
                    resolve(arrayBuffer);
                }
                request.setRequestHeader("Range", "bytes=" + MP3InfoAnalysis.mp3Info.headerLength + '-' + (MP3InfoAnalysis.mp3Info.headerLength + 156 * 8 - 1));
                request.send();
            })
        },
        //获取VBR(OR CBR)信息
        getInfo: function(arrayBuffer) {
            var bufferStr = '';
            var uint8Array = null;
            var vbrDataBuffer = null;
            var samplingRate = MP3InfoAnalysis.getSamplingRate(arrayBuffer);
            uint8Array = new Uint8Array(arrayBuffer);
            //转换成16进制码
            for (var i = 0; i < indexSize; i++) {
                if (uint8Array[i] <= 15) {
                    bufferStr += '0' + uint8Array[i].toString(16);
                } else {
                    bufferStr += uint8Array[i].toString(16);
                }
            }
            bufferStr = bufferStr.toUpperCase();
            if (bufferStr.indexOf('496E666F') != -1) { //存在Info头
                vbrDataBuffer = arrayBuffer.slice(bufferStr.indexOf('496E666F') / 2);
                return getInfo(vbrDataBuffer);
            } else if (bufferStr.indexOf('58696E67') != -1) { //存在Xing头
                vbrDataBuffer = arrayBuffer.slice(bufferStr.indexOf('58696E67') / 2);
                return getInfo(vbrDataBuffer);
            } else { //纯CBR编码
                var frameSize = MP3InfoAnalysis.getFrameSize(arrayBuffer);
                var totalTime = (MP3InfoAnalysis.mp3Info.fileSize - MP3InfoAnalysis.mp3Info.headerLength) / samplingRate;
                return {
                    frameSize: frameSize
                };
            }
            //获取总帧数
            function getTotalFrame(vbrDataBuffer) {
                vbrDataBuffer = vbrDataBuffer.slice(0, 12);
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 1) {
                    return (vbrUint8Array[8] << 24) + (vbrUint8Array[9] << 16) + (vbrUint8Array[10] << 8) + (vbrUint8Array[11]);
                } else
                    return false;
            }
            //获取数据帧总大小(bit)
            function getTotalSize(vbrDataBuffer) {
                vbrDataBuffer = vbrDataBuffer.slice(0, 16);
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 2) {
                    if (vbrUint8Array[7] & 1 == 0) {
                        return (vbrUint8Array[8] << 24) + (vbrUint8Array[9] << 16) + (vbrUint8Array[10] << 8) + (vbrUint8Array[11]);
                    } else {
                        return (vbrUint8Array[12] << 24) + (vbrUint8Array[13] << 16) + (vbrUint8Array[14] << 8) + (vbrUint8Array[15]);
                    }
                } else
                    return false;
            }
            //获取帧索引数组(100个)
            function getToc(vbrDataBuffer) {
                var vbrUint8Array = new Uint8Array(vbrDataBuffer);
                if (vbrUint8Array[7] & 4) {
                    if (!(vbrUint8Array[7] & 1) && !(vbrUint8Array[7] & 2)) {
                        return _getToc(vbrDataBuffer.slice(8));
                    } else if ((vbrUint8Array[7] & 1) && !(vbrUint8Array[7] & 2) || !(vbrUint8Array[7] & 1) && (vbrUint8Array[7] & 2)) {
                        return _getToc(vbrDataBuffer.slice(12));
                    } else {
                        return _getToc(vbrDataBuffer.slice(16));
                    }
                }

                function _getToc(docArrayBuffer) {
                    var indexArr = [];
                    var docuUnit8Array = new Uint8Array(docArrayBuffer.slice(0, indexSize));
                    for (var i = 0; i < 100; i++) {
                        indexArr[i] = docuUnit8Array[i];
                    }
                    return indexArr;
                }
            }

            function getInfo(vbrDataBuffer) {
                MP3InfoAnalysis.mp3Info.totalFrame = getTotalFrame(vbrDataBuffer);
                MP3InfoAnalysis.mp3Info.totalTime = 1152 * MP3InfoAnalysis.mp3Info.totalFrame / samplingRate;
                MP3InfoAnalysis.mp3Info.totalSize = getTotalSize(vbrDataBuffer) + MP3InfoAnalysis.mp3Info.headerLength;
                MP3InfoAnalysis.mp3Info.toc = getToc(vbrDataBuffer);
                return MP3InfoAnalysis.mp3Info;
            }
        },
        //获取比特率
        getBitRate: function(arrayBuffer) {
            //比特率对应表(bit/s)
            var brMap = {
                '1': 32000,
                '10': 40000,
                '11': 48000,
                '100': 56000,
                '101': 64000,
                '110': 80000,
                '111': 96000,
                '1000': 112000,
                '1001': 128000,
                '1010': 160000,
                '1011': 192000,
                '1100': 224000,
                '1101': 256000,
                '1110': 320000
            }
            var uint8Array = new Uint8Array(arrayBuffer);
            var brCode = (uint8Array[2] & 0xF0).toString(2).substring(0, 4);
            return brMap[brCode];
        },
        //获取采样率
        getSamplingRate: function(arrayBuffer) {
            //比特率对应表(Hz)
            var srMap = {
                '0': 44100,
                '1': 48000,
                '10': 32000,
            }
            var uint8Array = new Uint8Array(arrayBuffer);
            var srCode = (uint8Array[2] & 0x0C).toString(2).substring(0, 2);
            return srMap[srCode];
        },
        //获取第一帧填充数
        getPadding: function(arrayBuffer) {
            var uint8Array = new Uint8Array(arrayBuffer);
            var pdCode = (uint8Array[2] & 0x02).toString(2);
            if (pdCode == '1') {
                return 1;
            } else {
                return 0;
            }
        },
        //获取帧大小(bit)
        getFrameSize: function(arrayBuffer) {
            var samplingRate = MP3InfoAnalysis.getSamplingRate(arrayBuffer);
            var bitRate = MP3InfoAnalysis.getBitRate(arrayBuffer);
            var padding = MP3InfoAnalysis.getPadding(arrayBuffer);
            return 1152 * bitRate / samplingRate + padding * 8;
        }
    }
    //音频播放对象
    var Player = {
        init: function(mp3Info) {
            Player.mp3Info = mp3Info;
            Player.audioContext = null;
            Player.AudioContext = AudioContext || webkitAudioContext;
            Player.fileBlocks = new Array(100); //音频数据分区
            Player.cacheFrameSize = 10; //每次加载的帧数
            Player.indexSize = 100; //索引个数
            Player.playIntervalId = null; //播放计时器
            Player.hasPlayed = false; //是否已经开始播放
            Player.souceNodeQueue = []; //音频资源队列
            Player.nowSouceNode = null; //正在播放的资源节点
            Player.loading = false; //加载中
            Player.decoding = false; //解码中
            Player.decodeAudioData(0, Player.cacheFrameSize, true);
        },
        //解码
        decodeAudioData: function(index, minSize, negative) {
            if (index >= indexSize) {
                return;
            }
            if (Player.audioContext && Player.audioContext.state == 'running' && (!Player.nowSouceNode || Player.nowSouceNode && Player.nowSouceNode.finished)) {
                //加载中
                Player.loading = true;
            }
            Player.loadFrame(index, minSize, negative).then(function(result) {
                Player.loading = false;
                if (!Player.audioContext) {
                    Player.audioContext = new Player.AudioContext();
                    Player.audioContext.onstatechange = function() {
                        console.log(Player.audioContext.state);
                    }
                } else if (Player.audioContext.state == 'suspended') {
                    Player.audioContext.resume();
                }
                if (!Player.nowSouceNode || Player.nowSouceNode && Player.nowSouceNode.finished) {
                    //解码中
                    Player.decoding = true;
                }
                // alert('解码:'+result.beginIndex+','+result.endIndex)
                Player.audioContext.decodeAudioData(result.arrayBuffer, function(buffer) { //解码成功则调用此函数，参数buffer为解码后得到的结果
                    var audioBufferSouceNode = Player.audioContext.createBufferSource();
                    audioBufferSouceNode.connect(Player.audioContext.destination);
                    audioBufferSouceNode.buffer = buffer;
                    audioBufferSouceNode.beginIndex = result.beginIndex;
                    audioBufferSouceNode.endIndex = result.endIndex;
                    Player.souceNodeQueue.push(audioBufferSouceNode);
                    Player.decoding = false;
                    // alert('解码完成:'+result.beginIndex+','+result.endIndex);
                    if (!Player.hasPlayed) {
                        Player.hasPlayed = true;
                        audioBufferSouceNode.start(0);
                        if (audioBufferSouceNode.endIndex + 1 < indexSize) {
                            setTimeout(function() {
                                Player.decodeAudioData(audioBufferSouceNode.beginIndex, minSize * 2);
                            }, buffer.duration * 1000 / 2);
                        }
                        Player.souceNodeQueue.shift();
                        Player.nowSouceNode = audioBufferSouceNode;
                        startPlayInterval(buffer);
                    }

                    function startPlayInterval(buffer) {
                        var stopingTime = 0; //暂停时长
                        clearInterval(Player.playIntervalId);
                        beginTime = Player.audioContext.currentTime;
                        Player.playIntervalId = setInterval(function() {
                            if (Player.audioContext.state != 'running') {
                                stopingTime += 20;
                                return;
                            }
                            //该分区播放完前500ms，开始播接下来的音频数据
                            if ((Player.audioContext.currentTime - beginTime) * 1000 + 500 >= buffer.duration * 1000) {
                                if (Player.souceNodeQueue.length > 0) {
                                    var startTime = Player.audioContext.currentTime - beginTime - stopingTime;
                                    //计算时延
                                    startTime = startTime > buffer.duration ? buffer.duration : startTime;
                                    finish(Player.nowSouceNode, startTime);
                                }
                            }
                        }, 20);
                    }
                    //兼容移动端黑屏后interVal计时器停止的问题
                    audioBufferSouceNode.onended = function() {
                        finish(audioBufferSouceNode, audioBufferSouceNode.buffer.duration);
                    }

                    function finish(audioBufferSouceNode, startTime) {
                        audioBufferSouceNode.finished = true;
                        audioBufferSouceNode.disconnect();
                        if (audioBufferSouceNode.endIndex == indexSize - 1) {
                            clearInterval(Player.playIntervalId);
                            Player.audioContext.suspend();
                            //释放资源
                            Player.souceNodeQueue = [];
                            playedSouceNodeQueue = [];
                        } else {
                            if (Player.souceNodeQueue.length > 0) {
                                var souceNode = Player.souceNodeQueue.shift();
                                souceNode.start(0, startTime - 0.1);
                                if (souceNode.endIndex + 1 < indexSize) {
                                    Player.decodeAudioData(souceNode.beginIndex, minSize * 2);
                                }
                                Player.nowSouceNode = souceNode;
                                startPlayInterval(souceNode.buffer, souceNode);
                            }
                        }
                    }
                }, function(e) { //这个是解码失败会调用的函数
                    console.log(index, "!哎玛，文件解码失败:(");
                });
            });
        },
        //获取数据帧
        loadFrame: function(index, minSize, negative) {
            var begin = 0;
            var end = 0;
            var cached = true;
            var beginIndex = index; //避免网络加载重复数据
            index = index >= indexSize ? indexSize - 1 : index;
            for (var i = index; i < index + minSize && i < indexSize; i++) {
                if (!Player.fileBlocks[i]) {
                    cached = false;
                    break;
                }
                beginIndex = i;
            }
            //对应索引区数据已经缓存
            if (cached) {
                var arr = null;
                var result = null;
                var length = 0;
                result = Player.joinNextCachedFileBlock(index, minSize, negative);
                return new Promise(function(resolve) {
                    resolve(result);
                })
            }
            if (Player.mp3Info.toc != null) {
                begin = (Player.mp3Info.toc[index] / 256 * Player.mp3Info.fileSize) >> 0;
                end = (Player.mp3Info.toc[index + minSize] / 256 * Player.mp3Info.fileSize) >> 0;
                end = end >= Player.mp3Info.fileSize ? Player.mp3Info.fileSize : end;
            } else {
                begin = (Player.mp3Info.frameSize * index + Player.mp3Info.headerLength) >> 0;
                end = (begin + Player.mp3Info.frameSize * minSize) >> 0;
                end = end >= Player.mp3Info.fileSize ? Player.mp3Info.fileSize : end;
            }
            return new Promise(function(resolve, reject) {
                var request = new XMLHttpRequest();
                request.open('GET', url, true);
                request.responseType = 'arraybuffer';
                request.onload = function() {
                    var arrayBuffer = request.response;
                    var begin = 0;
                    var end = 0;
                    //数据解密
                    decrypt(arrayBuffer);
                    //缓存数据块
                    for (var i = beginIndex; i < index + minSize && i < indexSize; i++) {
                        if (Player.mp3Info.toc) { //VBR编码模式
                            end = begin + (Player.mp3Info.toc[i + 1] / 256 * Player.mp3Info.fileSize - Player.mp3Info.toc[i] / 256 * Player.mp3Info.fileSize) >> 0;
                            Player.fileBlocks[i] = arrayBuffer.slice(begin, end);
                            begin = end;
                        } else { //CBR编码模式
                            end = begin + Player.mp3Info.frameSize;
                            Player.fileBlocks[i] = arrayBuffer.slice(begin, end);
                            begin = end;
                        }
                    }
                    resolve(Player.joinNextCachedFileBlock(index, minSize, negative));
                    Player.loadFrame(index + minSize, minSize);
                }
                request.setRequestHeader("Range", "bytes=" + begin + '-' + (end - 1));
                request.send();
            });
        },
        //合并index索引之后所有连续的已经缓存过的分区
        joinNextCachedFileBlock: function(index, minSize, negative) {
            var length = 0;
            var arr = null;
            var result = null;
            var endIndex = index;
            var indexLength = Player.fileBlocks.length;
            //消极情况下只返回minSize个数据块
            if (negative) {
                indexLength = index + minSize;
                indexLength = indexLength >= indexSize ? indexSize - 1 : indexLength;
            }
            for (var i = index; i < indexLength && Player.fileBlocks[i]; i++) {
                length += Player.fileBlocks[i].byteLength;
                endIndex = i;
            }
            result = new ArrayBuffer(length);
            arr = new Uint8Array(result);
            length = 0;
            for (i = index; i <= endIndex; i++) {
                arr.set(new Uint8Array(Player.fileBlocks[i]), length);
                length += Player.fileBlocks[i].byteLength;
            }
            return {
                arrayBuffer: result,
                beginIndex: index,
                endIndex: endIndex
            }
        },
        //跳转某个索引
        seek: function(index) {
            if (Player.loading || Player.decoding) {
                setTimeout(function() {
                    seek(index);
                }, 500);
                return;
            }
            clearInterval(Player.playIntervalId);
            Player.hasPlayed = false;
            if (Player.nowSouceNode) {
                Player.nowSouceNode.disconnect();
                Player.nowSouceNode = null;
            }
            Player.souceNodeQueue = [];
            Player.decodeAudioData(index, Player.cacheFrameSize, true);
        }
    }
    //对外接口
    function Mp3Player(_url, opt) {
        url = _url;
        if (typeof opt == 'object' && typeof opt.decrypt == 'function') {
            decrypt = opt.decrypt;
        }
        this.play = function() {
            MP3InfoAnalysis.init().then(Player.init);
        }
        this.pause = function() {
            if (Player.audioContext) {
                Player.audioContext.suspend();
            }
        }
        this.seek = function(percent) {
            if (Player.audioContext) {
                Player.seek(percent);
            }
        }
    }
    if (window.define) {
        define(function() {
            return Mp3Player;
        })
    } else {
        global.Mp3Player = Mp3Player;
    }
}(window)
