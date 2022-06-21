<!--
 * @Author: liushuai
 * @Date: 2021-05-13 11:19:12
 * @LastEditors: liushuai
 * @LastEditTime: 2022-06-16 16:10:40
 * @Description: file content
 * @FilePath: \sclient\src\components\Live.vue
-->
<template>
    <div class="live-wrap">
        <hrm-player :autoplay="true" :controls="false" ref="myPlayer" :source="src"/>
    </div>
</template>

<script>
import hrmPlayer from 'hrm-player'

export default {
    components: {
        hrmPlayer
    },
    props: ['data'],
    data(){
        return{
            showDownloading: false,
            player: undefined,
            liveType: { 
                'hls': 'application/x-mpegURL',
                'rtmp': 'rtmp/flv'
            },
            src: '',
            timer: undefined,
            reloadTimes: 0
        }
    },
    mounted() {
        this.src = this.data.streamUri
    }
}
</script>

<style>
    .video-js{
        width: 100% !important;
        height: 100% !important;
    }
    .vjs-loading-spinner, .vjs-big-play-button, .vjs-control-bar, .vjs-error-display, .vjs-modal-dialog{
        display: none;
    }
</style>