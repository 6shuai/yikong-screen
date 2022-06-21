<template>
    <div class="live-wrap">
        <video id="yk-live-video" class="live-video w-full h-full video-js vjs-default-skin">
            <!-- <source src="http//ivi.bupt.edu.cn/hls/cctv1hd.m3u8" type="application/x-mpegURL" /> -->
        </video>

        <div class="downloading" v-show="showDownloading">
            <img src="../../static/image/download.png">
        </div>
    </div>
</template>

<script>
import Video from 'video.js';

export default {
    props: ['data'],
    data(){
        return{
            showDownloading: false,
            player: undefined,
            liveType: { 
                'hls': 'application/x-mpegURL',
                'rtmp': 'rtmp/flv'
            },
            timer: undefined,
            reloadTimes: 0
        }
    },
    mounted() {
        setTimeout(() => {
            this.livePlay();
        }, 100);
    },
    methods: {
        livePlay(){
            let { streamUri, protocolName } = this.data;
            this.liveParams = {
                src: streamUri,
                type: this.liveType[protocolName]
            }

            this.showDownloading = true;
            let _this = this;
            
            this.player = Video(
                'yk-live-video',
                {
                    autoplay: true,
                    controls: false,
                    preload: true,
                    liveui: false,
                    sources: [
                        // {
                        //     src: 'http://cctvalih5ca.v.myalicdn.com/live/cctv1_2/index.m3u8',
                        //     type: 'application/x-mpegURL',
                        //     // src: 'rtmp://58.200.131.2:1935/livetv/cctv1',
                        //     // type: 'rtmp/flv',
                        // },
                        {
                            src: streamUri,
                            type: 'application/x-mpegURL'
                        }
                    ],
                    html5: {
                        vhs: {
                            withCredentials: false,
                        },
                    },
                },
                function(){
                    this.on('play', function() {
                        console.log('播放器准备完毕');
                    })
                    this.on('pause', function() {
                        console.log('暂停播放');
                        _this.showDownloading = true;
                    })
                    this.on('waiting', function() {
                        console.log('播放过程中由于网络或其他原因产生的等待，此时视频播放暂停，等网络恢复后会自动执行【playing】自动播放');
                        _this.showDownloading = true;
                        _this.videoLoad(this)
                    })
                    this.on('playing', function() {
                        console.log('恢复播放');
                        clearTimeout(_this.timer)
                        _this.reloadTimes = 0
                        _this.showDownloading = false;
                    })
                    this.on('error', function(err){
                        console.log('error', err);
                    })
                },
            )
        },

        //卡顿超过30秒 重新load           load 三次后刷新页面
        videoLoad(video){
            clearTimeout(this.timer)
            this.timer = setTimeout(() => {
                // let videoPlayer = document.getElementById('yk-live-video_html5_api');
                this.player.load()
                this.reloadTimes++
                console.log('重新加载：', this.reloadTimes)
                if(this.reloadTimes >= 3) {
                    location.reload()
                }
            }, 30 * 1000);
        }
    },
    destroyed () {//页面销毁，同时也销毁video.js对象
        this.player.dispose();
    }
}

// <object type="application/x-shockwave-flash" data="//demosc.chinaz.net/Files/DownLoad/flash2/202105/flash8661.swf" width="700" height="500" id="flashid" style="visibility: visible;"><param name="base" value="."><param name="wmode" value="Opaque"><param name="allowScriptAccess" value="always"><param name="quality" value="high"><param name="allowNetWorking" value="all"></object>
</script>

<style>
    .vjs-loading-spinner, .vjs-big-play-button, .vjs-control-bar, .vjs-error-display, .vjs-modal-dialog{
        display: none;
    }
</style>