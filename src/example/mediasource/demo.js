import MP3Info from '../../mp3info/mp3info';
import Player from '../../mediasource/player';
import Util from '../../common/util';

var totalTime = 0;
var myRange = document.getElementById("myRange");
var audio = document.querySelector('audio');
window.mp3 = new Player('res/test.mp3', {
    AudioInfo: MP3Info,
    audio: audio,
    loadedmetadataCb: function(duration) {
        var data = '';
        totalTime = duration;
        if (validateDuration(totalTime)) {
            data = Util.formatCountDown(totalTime);
            data = data.hours + ':' + data.minutes + ':' + data.seconds;
            document.getElementById("right_time").innerHTML = data;
        }
    },
    updateTimeCb: function(seconds) {
        if (seconds > totalTime || !validateDuration(totalTime)) {
            loadedmetadataCb(audio.duration);
            return;
        }
        var date = Util.formatCountDown(seconds);
        date = date.hours + ':' + date.minutes + ':' + date.seconds;
        document.getElementById("left_time").innerHTML = date;
        myRange.value = Math.round((seconds / totalTime) * 100) || 0;
    },
    playCb: function() {
        console.log('开始播放');
    },
    pauseCb: function() {
        console.log('播放暂停');
    },
    waitingCb: function() {
        console.log('加载中');
    },
    playingCb: function() {
        console.log('缓冲结束');
    },
    endCb: function() {
        myRange.value = 0;
        document.getElementById("left_time").innerHTML = '00:00:00'
        console.log('播放结束');
    },
    //该回调用来解密加密过的字节
    decrypt: function(arrayBuffer) {
        // var arr = new Uint8Array(arrayBuffer);
        // for (var i = 0; i < arr.length; i++) {
        //     arr[i] = arr[i] ^ 255;
        // }
    }
});

function validateDuration(duration) {
    if (duration <= 0 || duration == Infinity || isNaN(duration)) {
        return false;
    }
    return true;
}

document.getElementById("myRange").onchange = function() {
    var percent = myRange.value;
    mp3.seek(parseInt(percent));
}

document.querySelector('.play').addEventListener('click', function() {
    mp3.play();
})

document.querySelector('.pause').addEventListener('click', function() {
    mp3.pause();
})