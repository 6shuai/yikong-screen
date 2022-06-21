<template>
    <div class="screen-content" v-if="currentData">
        <div class="iframe-wrap"></div>
        
        <img 
            v-if="currentData.contentTypeId==contentTypeId.image" 
            :src="currentData.contentPath"
        >

        <video 
            style="object-fit: fill;" 
            v-if="currentData.contentTypeId==contentTypeId.video" 
            width="100%" 
            height="100%" 
            :autoplay="true" 
            :loop="true" 
            :ref="'video' + currentData.contentId"
            :src="currentData.contentPath">
        </video>

        <iframe 
            id="miniview-game"
            v-if="currentData.contentTypeId==contentTypeId.game"
            :src="currentData.contentPath"
            style="width: 100%; height: 100%;"
            frameborder="no" 
            border="0" 
            scrolling="no">
        </iframe>

        <!-- 直播 -->
        <live
            v-if="currentData.contentTypeId==contentTypeId.live"
            :data="currentData"
        ></live>

    </div>
</template>

<script>
let $fs = require('fs');
import { contentTypeId } from '../utils/index';
import {
    timeDisposeTool,
    playResources, 
    playVideo
} from '@/mixins/index.js';
import {
    scoketId
} from '../utils/scoketId';
import { mapState } from 'vuex';
import Live from '../components/Live';

export default {
    props: {
        data: Object,
        serverTimeDiff: Number,
        timelineBeginTime: String,  //时间轴的开始时间
        timelineEndTime: String,    //时间轴的结束时间
    },
    mixins: [timeDisposeTool, playResources, playVideo],
    data() {
        return {
            timelineData: [],
            contentTypeId: contentTypeId,
            timer: undefined, //定时器
            atlasTimer: undefined, //图集定时器
            contentDuration: 0, //当前播放的内容 时长(秒)
            currentData: undefined, //当前播放的内容
            currentPlayIndex: 0, //当前播放的内容 index
            msgTimer: undefined, //每隔五分钟发送 3003 定时器
        }
    },
    computed: {
        ...mapState({
            currentPlayPosition: state => state.currentPlayPosition
        })
    },
    created() {
        this.dataSort();
    },
    methods: {
        //时间轴排序  开始时间最早的放在前面
        dataSort(obj) {
            let data = obj ? obj : this.data;
            if(!data.timelineContents.length) {
                this.currentData = {}
                return
            };
            this.timelineData = JSON.parse(JSON.stringify(data.timelineContents));

            let duration = 0;
            if(this.currentPlayPosition){
                for(let i = 0; i < this.timelineData.length; i++){
                    let item = this.timelineData[i];
                    duration += Number(item.duration);
                    if(duration >= this.currentPlayPosition){
                        this.currentPlayIndex = i;
                        //还剩余的时长
                        this.$set(this.timelineData[i], 'surplusDuration', duration - this.currentPlayPosition);
                        break;
                    }
                }
            }

            this.$nextTick(() =>{
                //清空当前步骤的 已播放时长
                this.$store.commit('SET_CURRENT_PLAY_POSITION', 0);
                this.init();
            })
        },

        //websocket 发送消息
        socketSendMessage(data) {
            let obj = {
                ...data,
                contentId: this.currentData.contentId,
                sendTime: this.formatTime(new Date() / 1000 - this.serverTimeDiff)
            }
            this.$emit('sendMessage', obj);
        },

        init() {
            // 先清除定时
            if (this.msgTimer) window.clearInterval(this.msgTimer);
            if (this.atlasTimer) window.clearTimeout(this.atlasTimer);
            if(this.timer) window.clearTimeout(this.timer);

            //当前要播放的内容
            this.currentData = this.getResourcesPath(JSON.parse(JSON.stringify(this.timelineData[this.currentPlayIndex])));
            
            //时间轴是否播放结束
            this.timelineIsPlayEnd();

            // 当前要播放的内容  总共多少秒  播放结束后 继续播放下一个内容
            this.contentDuration = this.currentData.surplusDuration || this.currentData.duration;

            //图集内容
            if (this.currentData.contentTypeId == contentTypeId.atlas) {
                this.atlasPlay(0);
            }

            //指定视频播放时间点
            if(this.currentData.surplusDuration) this.accordingTimePlay(this.currentData);

            //资源播放时 发送 3002
            this.socketSendMessage({
                id: scoketId.playOnce
            });

            this.timingSendMsg();

            this.timer = window.setTimeout(() => {
                //播放结束时  发送 3003  isOver：1
                this.socketSendMessage({
                    id: 3003,
                    isOver: 1
                });
                
                 //播放结束
                if(this.currentData.isEnd){
                    this.endPlay();
                    return
                }
                

                this.timelineData[this.currentPlayIndex].surplusDuration = 0;

                // 播放到最后一个内容时
                if (this.currentPlayIndex + 1 >= this.timelineData.length) {
                    window.clearTimeout(this.timer);
                    window.clearTimeout(this.msgTimer);
                    this.currentData = {};
                    return
                } else {
                    this.currentPlayIndex += 1;
                }

                this.init();
            }, this.contentDuration * 1000);

        },

        //清空当前资源路径
        clearCurrentPath(){
            if(this.currentData.contentTypeId == contentTypeId.game){
                this.$set(this.currentData, 'contentPath', '');
            }
        },

        //资源播放时 发送 3002 然后每隔五分钟发送一次 3003， 最后播放结束时不足五分钟也要发送 3003
        //未结束isOver:0   结束时 isOver：1
        timingSendMsg() {
            this.msgTimer = window.setInterval(() => {
                this.socketSendMessage({
                    id: scoketId.playPeriod,
                    isOver: 0
                });
            }, 60000 * 5);
        },

        //图集播放
        atlasPlay(index = 0) {
            if (this.atlasTimer) window.clearTimeout(this.atlasTimer);
            let obj = this.getResourcesPath(this.currentData.subContentsData[index]);
            this.$set(this.currentData, 'contentPath', obj.contentPath);
            this.$set(this.currentData, 'contentTypeId', obj.contentType);

            
            let duration = obj.duration;
            this.atlasTimer = window.setTimeout(() => {
                index = index + 1 >= this.currentData.subContentsData.length ? 0 : index + 1;
                this.atlasPlay(index);
            }, duration * 1000);
        },

        //当前时间超过 时间轴结束时间 结束播放
        timelineIsPlayEnd(){  
            try {
                let data = this.currentData;
                let duration = this.timeDifference(this.timelineBeginTime, this.getNowTime(), 2) + Number(data.duration);
                if(duration >= this.timeDifference(this.timelineBeginTime, this.timelineEndTime)){
                    //距离结束还剩余时间
                    this.currentData.surplusDuration = this.timeDifference(this.getNowTime(), this.timelineEndTime, 1)

                    // 播放结束
                    this.currentData.isEnd = true;
                    this.$store.commit('SET_TIMELINE_PLAY_END', true);
                }
            } catch (error) {
                console.log(error)
            }
        },

        //播放结束
        endPlay(){
            this.socketSendMessage({ id: 3003, isOver: 1});
            this.currentPlayIndex = 0;
            this.currentData = {};
            if(this.msgTimer) window.clearInterval(this.msgTimer);
            if(this.atlasTimer) window.clearTimeout(this.atlasTimer);

        }
    },
    components: {
        Live
    },
    destroyed () {
        window.clearTimeout(this.timer); // 清除
        window.clearTimeout(this.atlasTimer);
        window.clearInterval(this.msgTimer);
    },
    watch: {
        data: {
            handler(val, oldVal){
                this.currentPlayIndex = 0;
                this.dataSort(val);
            }
        }
    }
}
</script>
