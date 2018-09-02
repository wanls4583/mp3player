function Audio(options) {
    var emptyFn = function() {};
    var onloadstart = null;
    var onloadedmetadata = null; //更新总时长回调
    var ontimeupdate = null; //更新时间回调
    var onupdateBar = null; // 更新进度条回调
    var onwaiting = null; //开始播放或播放过程中由于缓冲暂停时回调
    var onplaying = null; //开始播放或播放过程中缓冲完成回调
    var oncanplay = null; //当前位置可播放时回调
    var onseeking = null; //寻址中回调
    var onplay = null; //播放回调
    var onended = null; //播放完成
    var onpause = null; //暂停回调
    var onerror = null; //错误回调
    var audio = null; //音频对象
    var playBtn = null; //播放按钮
    var pauseBtn = null; //暂停按钮
    var forceSeek = false; //是否强制移动播放位置
    var currentTime = 0; //当前播放位置
    var seekTimeoutId = null; //寻址超时计时器
    var seekMaxTime = 30000; //最大寻址时长
    var seeking = false; //是否正在寻址中
    var canplay = false; //是否就绪
    var canUpdateTime = true; //是否可更新时长
    var allListener = [];
    var AudioObj = {
        init: function(options) {
            ontimeupdate = options.ontimeupdate || emptyFn;
            onseeking = options.onseeking || emptyFn;
            onwaiting = options.onwaiting || emptyFn;
            onplaying = options.onplaying || emptyFn;
            oncanplay = options.oncanplay || emptyFn;
            onloadstart = options.onloadstart || emptyFn;
            onplay = options.onplay || emptyFn;
            onended = options.onended || emptyFn;
            onpause = options.onpause || emptyFn;
            onupdateBar = options.onupdateBar || emptyFn;
            onloadedmetadata = options.onloadedmetadata || emptyFn;
            onerror = options.onerror || emptyFn;
            audio = options.audio;
            forceSeek = options.forceSeek || false;
            playBtn = options.playBtn;
            pauseBtn = options.pauseBtn;
            if (!audio) {
                return;
            }
            this.audio = audio;
            this._bindAudioEvent();
            this._bindClickEvent();
        },
        destroy: function() {
            this._removeAllEvent();
        },
        /**
         * [seek 设置播放位置,对外接口]
         * @param  {Number}  percent [百分比或时间]
         * @param  {Boolean} isTime  [是否是时间]
         * @param  {Boolean} ifStop  [是否停止]
         */
        seek: function(percent, isTime, ifStop) {
            if (!audio.duration) {
                if (!isTime)
                    onupdateBar(percent);
                return;
            }
            var self = this;
            if (!ifStop) {
                this.play();
            } else {
                this.pause()
            }
            if (!isTime) {
                percent = percent > 100 ? 100 : percent;
                percent = percent < 0 ? 0 : percent;
                currentTime = percent * audio.duration / 100;
            } else {
                currentTime = percent;
                percent = currentTime / audio.duration * 100;
            }
            if (!this._ifSeekable(currentTime)) {
                console.log('can not seek');
                onupdateBar(percent);
                return;
            }
            ontimeupdate(currentTime);
            onupdateBar(percent);
            audio.currentTime = currentTime;
            if (forceSeek) {
                seeking = true;
                self.pause();
                seekTimeoutId = setTimeout(function() {
                    seeking = false;
                    self._setNearCurrentTime();
                    if (!ifStop) {
                        self.play(audio);
                    }
                }, seekMaxTime);
            }
        },
        /**
         * @todo [更新时间，对外接口]
         * @param    {[Number]}   percent [百分比或时长]
         * @param    {Boolean}  isTime  [是否是时长]
         */
        updateTime: function(percent, isTime) {
            if (isTime) {
                ontimeupdate(percent);
                return;
            } else if (!audio.duration || !audio.seekable.length) {
                return;
            } else {
                percent = percent > 100 ? 100 : percent;
                percent = percent < 0 ? 0 : percent;
                ontimeupdate(percent * audio.duration / 100);
            }
        },
        /**
         * [play 播放，对外接口]
         */
        play: function() {
            if (audio.paused) {
                audio.play();
            }
        },
        /**
         * [play 暂停播放，对外接口]
         */
        pause: function() {
            if (!audio.paused) {
                audio.pause();
            }
        },
        /**
         * [stopUpdateTime 停止内部更新时间，对外接口]
         */
        stopUpdateTime: function() {
            canUpdateTime = false;
        },
        /**
         * [startUpdateTime 开始内部更新时间，对外接口]
         */
        startUpdateTime: function() {
            canUpdateTime = true;
        },
        removeAllEvent: function() {
            this._removeAllEvent();

        },
        getSource: function() {
            return audio;
        },
        _bindAudioEvent: function() {
            var self = this;
            this._addEvent(audio, 'loadstart', function() {
                onloadstart();
                console.log('loadstart');
            });
            this._addEvent(audio, 'play', function() {
                onplay();
                console.log('play');
            });
            this._addEvent(audio, 'ended', function() {
                onended();
                console.log('ended');
            });
            this._addEvent(audio, 'pause', function() {
                onpause();
                console.log('puase');
            });
            this._addEvent(audio, 'waiting', function() {
                onwaiting();
                console.log('waiting');
            });
            this._addEvent(audio, 'playing', function() {
                if (this.readyState == 4) {
                    onplaying();
                }
                console.log('playing');
            });
            this._addEvent(audio, 'seeking', function() {
                onseeking();
                console.log('seeking');
            });
            if (forceSeek) {
                this._addEvent(audio, 'seeked', function() {
                    if (seeking) {
                        seeking = false;
                        clearTimeout(seekTimeoutId);
                        self.play();
                    }
                    console.log('seeked');
                });
            }
            this._addEvent(audio, 'loadedmetadata', function() {
                onloadedmetadata(audio.duration);
                //兼容ios首次必须交互触发canplay事件
                oncanplay();
                canplay = true;
                console.log('loadedmetadata');
            })
            this._addEvent(audio, 'canplay', function() {
                oncanplay();
                canplay = true;
                console.log('canplay');
            });
            this._addEvent(audio, 'timeupdate', function() {
                if (!canUpdateTime)
                    return;
                var percent = 0;
                var time = audio.currentTime;
                if (Math.abs(time - currentTime) > 0.05 && !audio.seeking) {
                    ontimeupdate(time, true);
                } else {
                    ontimeupdate(time);
                }
                if (audio.duration) {
                    percent = time / audio.duration * 100;
                }
                onupdateBar(percent);
            });
            this._addEvent(audio, 'stalled', function(e) {
                console.log('stalled');
            });
            this._addEvent(audio, 'error', function(e) {
                onerror();
                console.log('error');
            });
            this._addEvent(audio, 'abort', function(e) {
                console.log('abort');
            });

        },
        _bindClickEvent: function() {
            var self = this;
            if (playBtn) {
                this._addEvent(playBtn, 'click', function(event) {
                    self._stopPropagation(event);
                    self.play();
                })
            }
            if (pauseBtn) {
                this._addEvent(pauseBtn, 'click', function(event) {
                    self._stopPropagation(event);
                    self.pause();
                })
            }
        },
        /**
         * @todo [播放位置是否可寻址]
         * @param    {[Number]}   time [时长]
         * @return   {[Boolean]}       [结果]
         */
        _ifSeekable: function(time) {
            var seekable = audio.seekable;
            var canSeek = false;
            for (var i = 0; i < seekable.length; i++) {
                var start = seekable.start(i);
                var end = seekable.end(i);
                if (time >= start && time <= end) {
                    canSeek = true;
                    break;
                }
            }
            return canSeek;
        },
        /**
         * [_setNearCurrentTime 设置最接近的播放位置]
         */
        _setNearCurrentTime: function() {
            var bufferd = audio.bufferd;
            var distance = 0;
            var preTime = 0;
            for (var i = 0; i < bufferd.length; i++) {
                var start = bufferd.start(i);
                var end = bufferd.end(i);
                if (Math.abs(start - currentTime) < distance || distance == 0) {
                    distance = Math.abs(start - currentTime);
                    preTime = start;
                }
                if (Math.abs(end - currentTime) < distance || distance == 0) {
                    distance = Math.abs(end - currentTime);
                    preTime = end;
                }
            }
            currentTime = preTime;
            audio.currentTime = currentTime;
        },
        _addEvent: function(ele, event_name, func) {
            if (window.attachEvent) {
                ele.attachEvent('on' + event_name, func);
            } else {
                ele.addEventListener(event_name, func, false); //默认事件是冒泡
            }
            allListener[allListener.length] = {
                ele: ele,
                func: func,
                event: event_name
            }
        },
        _removeEvent: function(ele, event_name, func) {
            if (window.attachEvent) {
                ele.detachEvent('on' + event_name, func);
            } else {
                ele.removeEventListener(event_name, func, false);
            }
        },
        _removeAllEvent: function() {
            for (var i = 0; i < allListener.length; i++) {
                var listener = allListener[i];
                this._removeEvent(listener.ele, listener.event, listener.func);
            }
        },
        _stopPropagation: function(e) {
            if (e && e.stopPropagation) { //非IE   
                e.stopPropagation();
            } else { //IE   
                window.event.cancelBubble = true;
            }
        },
        _preventDefault: function(e) {
            e.preventDefault ? e.preventDefault() : (e.returnValue = false);
        }
    }
    if (options) {
        AudioObj.init(options);
    }
    return AudioObj;
}

export default Audio;