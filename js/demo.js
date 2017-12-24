define(function(require, exports, module) {
    'use strict';
    var MP3InfoAnalysis = require('./mp3-info-analysis');
    var Player = require('./player');
    var Util = require('./common/util');
    // MP3InfoAnalysis.init('//file.qf.56.com/f/h5/style/common/audio/demo/test.mp3').then(function(audioInfo){
    // 	console.log(audioInfo);
    // });
    // new Player('//file.qf.56.com/f/h5/style/common/audio/demo/test.mp3', {
    //     audioInfoAnalysis: MP3InfoAnalysis
    // });
    var totalTime = 0;
    var myRange = document.getElementById("myRange");
    var mp3 = new Player('test.mp3', {
        emptyUrl: 'empty.mp3',
        audioInfoAnalysis: MP3InfoAnalysis,
        loadedmetaCb: function(info) {
            var data = '';
            totalTime = info.totalTime;
            data = Util.formatCountDown(totalTime);
            data = data.hours + ':' + data.minutes + ':' + data.seconds;
            document.getElementById("right_time").innerHTML = data;
        },
        updateTimeCb: function(seconds) {
            if (seconds > totalTime) {
                return;
            }
            var date = Util.formatCountDown(seconds);
            date = date.hours + ':' + date.minutes + ':' + date.seconds;
            document.getElementById("left_time").innerHTML = date;
            myRange.value = Math.round((seconds / totalTime) * 100);
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
        decrypt: function(arrayBuffer) {
            // var arr = new Uint8Array(arrayBuffer);
            // for (var i = 0; i < arr.length; i++) {
            //     arr[i] = arr[i] ^ 255;
            // }
        }
    });
    document.getElementById("myRange").onchange = function() {
        var percent = myRange.value;
        mp3.seek(parseInt(percent));
    }

    document.querySelector('.play').addEventListener('click',function(){
    	mp3.play();
    })

    document.querySelector('.pause').addEventListener('click',function(){
    	mp3.pause();
    })

})