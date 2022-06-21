<template>
    <div class="screen-content" v-if="currentData">
        <div class="iframe-wrap"></div>
        
        <div class="current-content" v-show="playStatus == 1 || showAtlas">
            <img 
                v-if="currentData && currentData.contentTypeId==contentTypeId.image && currentData.contentPath" 
                :src="currentData.contentPath"
            >
            <!-- <video 
                id="current-video"
                style="object-fit: fill;"
                v-if="currentData && currentData.contentTypeId==contentTypeId.video"
                width="100%"
                height="100%"
                :loop="true"
                :ref="'video' + currentData.contentId"
                :src="currentData.contentPath">
            </video> -->
        </div>

        <div class="current-content" v-show="playStatus == 2">
            <img 
                v-if="nextData && nextData.contentTypeId==contentTypeId.image && nextData.contentPath" 
                :src="nextData.contentPath"
            >
        </div>

         <video 
            id="next-video"
            style="object-fit: fill;"
            v-if="currentData.contentTypeId==contentTypeId.video"
            width="100%"
            height="100%"
            autoplay
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
            crolling="no">
        </iframe>

        <!-- 直播 -->
        <live
            v-if="currentData.contentTypeId==contentTypeId.live"
            :data="currentData.liveStream"
        ></live>
        
    </div>
</template>

<script>
import { timeDisposeTool, playResources, playVideo } from '@/mixins/index.js';
import { contentTypeId } from '../utils/index';
import { scoketId } from '../utils/scoketId';
import { mapState } from 'vuex';
import Live from '../components/Live';

export default {
    props: {
        data: Object,
        serverTimeDiff: Number,
        timelineBeginTime: String,  //时间轴的开始时间
        timelineEndTime: String,    //时间轴的结束时间
        nextLoadImage: Boolean,
    },
    mixins: [timeDisposeTool, playResources, playVideo],
    data(){
        return {
            contentTypeId: contentTypeId,
            timer: undefined,              //定时器
            atlasTimer: undefined,         //图集定时器
            contentDuration: 0,            //当前播放的内容 时长(秒)
            currentData: undefined,        //当前播放的内容
            currentPlayIndex: 0,           //当前播放的内容 index
            timelineData: [],
            msgTimer: undefined,           //每隔五分钟发送 3003 定时器
            time: null,
            showNextImg: true,
            nextData: undefined,           //下一个资源内容
            playStatus: null,
            showAtlas: false,
            date: new Date()
        }
    },
    computed: {
        ...mapState({
            currentPlayPosition: state => state.currentPlayPosition,  //当前内容已播放时长
        })
    },
    created () {
        this.dataSort();
        // console.log('阶段开始---------->', this.date)
    },
    methods: {
        //时间轴排序  开始时间最早的放在前面
        dataSort(){
            if(!this.data.timelineContents.length) {
                this.currentData = {}
                return
            };
            this.timelineData = JSON.parse(JSON.stringify(this.data.timelineContents));

            if(this.nextLoadImage){
                if(this.timelineData[0].contentTypeId == contentTypeId.image){
                    this.currentData = this.getResourcesPath(this.timelineData[0]);
                }
                return
            }

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
                this.loopPlay();
            })
        },  

        //websocket 发送消息
        socketSendMessage(data){
            try {
                if((this.nextData && this.nextData.contentId)|| (this.currentData && this.currentData.contentId)) {
                    let obj = {
                        ...data,
                        contentId: this.playStatus === 2 ? this.nextData.contentId : this.currentData.contentId,
                        sendTime: this.formatTime(new Date() / 1000 - this.serverTimeDiff)
                    }
                    this.$emit('sendMessage', obj);
                }
            } catch (error) {
                console.log('播放统计--->', error)
            }
        },
        

        loopPlay(){
            //播放结束时  发送 3003  isOver：1
            this.socketSendMessage({ id: 3003, isOver: 1 });
            
            // 先清除定时
            this.showAtlas = false;
            if(this.msgTimer) window.clearInterval(this.msgTimer);
            if(this.atlasTimer) window.clearTimeout(this.atlasTimer);
            if(this.timer) window.clearTimeout(this.timer);

            //当前要播放的内容
            let currentData = JSON.parse(JSON.stringify(this.timelineData[this.currentPlayIndex]));
            let nextData = this.currentPlayIndex +1 >= this.timelineData.length ? this.timelineData[0] : this.timelineData[this.currentPlayIndex+1];

            //把当前的图片 和 下一个图(display: none)都先加载出来. 当前图片播放完之后才显示下一个
            if(currentData.contentTypeId == contentTypeId.image){
                if(this.playStatus == 1){
                    if(nextData.contentTypeId == contentTypeId.image) this.currentData = this.getResourcesPath(nextData); 
                    this.playStatus = 2;
                    //next  播放完    current 播放完
                }else if(this.playStatus == 2){
                    this.nextData = this.getResourcesPath(nextData);
                    this.playStatus = 1;
                }else{
                    this.nextData = this.getResourcesPath(nextData); 
                    this.currentData = this.getResourcesPath(currentData);
                    this.playStatus = 1;
                }
            }else{
                this.playStatus = null;
                this.currentData = this.getResourcesPath(currentData);
            }

            // this.$nextTick(() => {

                // 当前要播放的内容  总共多少秒  播放结束后 继续播放下一个内容
                this.contentDuration = currentData.surplusDuration || currentData.duration;

                //图集内容
                if(currentData.contentTypeId == contentTypeId.atlas){
                    this.currentData = currentData;
                    this.showAtlas = true;
                    this.atlasPlay(0);
                }

                //指定视频播放时间点
                if(currentData.surplusDuration) this.accordingTimePlay(currentData);

                //资源播放时 发送 3002
                this.socketSendMessage({ id: scoketId.playOnce });
                
                this.timingSendMsg(5000);

                this.nowTimeFindContent();


                this.timer = window.setTimeout(() => {
                    //播放结束
                    if(this.currentData.isEnd){
                        this.endPlay();
                        return
                    }

                    if(!this.timelineData.length) {
                        this.currentData = {};
                        this.nextData = {};
                        this.contentDuration = 0;
                        console.log('播放结束over')
                        return;
                    }

                    //剩余时长清0
                    this.timelineData[this.currentPlayIndex].surplusDuration = 0;
                    
                    // 播放到最后一个内容时
                    if(this.currentPlayIndex + 1 >= this.timelineData.length) {
                        this.currentPlayIndex = 0;
                    }else{
                        this.currentPlayIndex += 1;
                    }
                    // this.$set(this.currentData, 'contentPath', '');
                    this.$nextTick(() => {
                        this.loopPlay();
                    })
                }, this.contentDuration * 1000 - (new Date().getMilliseconds() > 900 ? 1000 - new Date().getMilliseconds() : 0));
            // })
        },

        //清空当前 游戏 资源路径
        clearCurrentPath(){
            if(this.currentData.contentTypeId == contentTypeId.game){
                this.$set(this.currentData, 'contentPath', '');
            }
        },

        //资源播放时 发送 3002 然后每隔五分钟发送一次 3003， 最后播放结束时不足五分钟也要发送 3003
        //未结束isOver:0   结束时 isOver：1
        timingSendMsg(){
            this.msgTimer = window.setInterval(() => {
                this.socketSendMessage({ id: scoketId.playPeriod, isOver: 0});
            }, 60000 * 5);
        },


        //当前内容播放完的时间 是否大于等于 时间轴的结束时间。 
        nowTimeFindContent(){  
            try {
                let duration = this.timeDifference(this.timelineBeginTime, this.getNowTime(), 2);
                
                //结束时间超过晚上12点
                if(this.timeDifference(this.timelineBeginTime, this.timelineEndTime) < 0){
                    //当前时间 大于 时间轴开始时间
                    if(this.timeDifference(this.timelineBeginTime, this.getNowTime(), 2) > 0){
                        
                        //当前时间超过晚上12点 并且还没到结束的时间
                    }else if(this.timeDifference(this.timelineBeginTime, this.getNowTime(), 2) <= 0 && this.timeDifference(this.timelineEndTime, this.getNowTime(), 2) <= 0){

                    }else{
                        this.endPlay();
                    }

                    return 
                }


                if(duration >= this.timeDifference(this.timelineBeginTime, this.timelineEndTime)){
                    this.currentData.surplusDuration = this.timeDifference(this.getNowTime(), this.timelineEndTime, 1)
                    // 播放结束
                    this.endPlay();
                }
            } catch (error) {
                console.log(error)
            }
        },

        //图集播放
        atlasPlay(index=0){
            if(this.atlasTimer) window.clearTimeout(this.atlasTimer);
            let obj = this.getResourcesPath(this.currentData.subContentsData[index]);
            this.$set(this.currentData, 'contentPath', obj.contentPath);
            this.$set(this.currentData, 'contentTypeId', obj.contentType);

            let duration = obj.duration;
            this.atlasTimer = window.setTimeout(() => {
                index = index + 1 >= this.currentData.subContentsData.length ? 0 : index + 1;
                this.atlasPlay(index);
            }, duration * 1000);
        },

        //播放结束
        endPlay(){
            this.currentPlayIndex = 0;
            this.currentData = {};   
            this.$store.commit('SET_TIMELINE_PLAY_END', true);
            window.clearTimeout(this.timer);
            window.clearInterval(this.msgTimer);
            if(this.atlasTimer) window.clearTimeout(this.atlasTimer);
        }
    },
    components: {
        Live
    },
    destroyed () {
        this.socketSendMessage({ id: 3003, isOver: 1});
        window.clearTimeout(this.timer) // 清除
        window.clearTimeout(this.atlasTimer)
        window.clearInterval(this.msgTimer);
    },
    watch: {
        data: {
            // handler(val, oldVal){
            //     console.log('watch', new Date().getTime() / 1000)
            //     this.currentPlayIndex = 0;
            //     this.timelineData = val.timelineContents;
            //     this.loopPlay();
            // }
        }
    }
}

</script>