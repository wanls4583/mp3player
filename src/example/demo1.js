import Player from '../../index';
import Util from '../common/util';

var totalTime = 0;
var myRange = document.getElementById("myRange");
window.mp3 = new Player('res/test.mp3', {
    emptyUrl: 'res/empty.mp3',
    onloadedmetadata: function(duration) {
        var data = '';
        totalTime = duration;
        if (validateDuration(totalTime)) {
            data = Util.formatCountDown(totalTime);
            data = data.hours + ':' + data.minutes + ':' + data.seconds;
            document.getElementById("right_time").innerHTML = data;
        }
    },
    ontimeupdate: function(seconds) {
        if (seconds > totalTime || !validateDuration(totalTime)) {
            onloadedmetadata(audio.duration);
            return;
        }
        var date = Util.formatCountDown(seconds);
        date = date.hours + ':' + date.minutes + ':' + date.seconds;
        document.getElementById("left_time").innerHTML = date;
        myRange.value = Math.round((seconds / totalTime) * 100) || 0;
    },
    onplay: function() {
        console.log('开始播放');
    },
    onpause: function() {
        console.log('播放暂停');
    },
    onwaiting: function() {
        console.log('加载中');
    },
    onplaying: function() {
        console.log('缓冲结束');
    },
    onend: function() {
        myRange.value = 0;
        document.getElementById("left_time").innerHTML = '00:00:00'
        console.log('播放结束');
    },
    //可对数据进行二次处理，例如解密等工作
    onbeforedecode: function(arrayBuffer) {
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