import { wsUrl, addon } from '../utils/index';
import { scoketId } from "../utils/scoketId";
const $fs = require("fs");
import { serialNumberPath, cutInAdverJsonPath } from "../utils/index";

export const miniviewSocket = {
    data(){
        return{
            isContent: false,
            socketConnectLoading: false,
            socketConnectSuccess: false, //socket 是否连接成功
            pongTime: undefined, //心跳收到回复 时间
            overtime: 60,         //超时时间

            heartBeatTimeOut: undefined, //心跳  定时器
            haveReconnection: false,     //是否重连
        }
    },
    mounted() {
        let that = this;
        //联网监听
        window.addEventListener("online", function(){
            console.log('网络恢复0.0')
            that.initWebsocket();
        });
    },
    methods: {
        //初始化websocket
        initWebsocket() {
            console.log('初始化websocket')
            if (this.socketConnectSuccess || this.socketConnectLoading) return;
            this.socketConnectLoading = true;
            this.closeSocket();
            this.$nextTick(() => {
                window.clearTimeout(this.timer);
                this.websock = new WebSocket(wsUrl);
                this.websock.onopen = this.websocketopen;
                this.websock.onmessage = this.websocketonmessage;
                this.websock.onclose = this.websocketclose;
                this.websock.onerror = this.websocketerror;
            })
        },

        //websocket连接成功
        websocketopen(data) {
            console.log("websocket连接成功");
            this.socketConnectSuccess = true;
            window.clearTimeout(this.heartBeatTimeOut);
            if (this.timer) window.clearTimeout(this.timer);
            this.heartBeat();
            this.readFileSerialNumber();
        },

        //socket 发送消息
        websocketSendData(data) {
            try {
                if (this.socketConnectSuccess) {
                    this.websock.send(JSON.stringify(data));
                }
            } catch (error) {}
        },

         //socket 收到消息
        websocketonmessage(event) {
            let msg = JSON.parse(event.data);
            if (!msg) return;

            if (msg.code === 304) {
                //序列号 登录失败
                console.log('序列号 登录失败')
                this.writeFile(serialNumberPath, "");
                this.loginError = msg.message;
                this.$refs.login.loginLoading = false;
            } else if (msg.code === 0) {
                //序列号 登录成功
                console.log('序列号 登录成功')
                this.enterFullscreen().then((res) => {
                    this.readFile();
                    this.loginSuccess = true;
                    this.showDownloading = false;

                    //屏幕截图
                    this.updatedScreensHot();
                    if(msg.obj.screenId){
                        localStorage.screenId = msg.obj.screenId;
                        this.$store.dispatch("setScreenId", msg.obj.screenId);
                    }
                    if(msg.obj.timeStamp){
                        this.compareTime(msg.obj.timeStamp);
                    }
                });
            }
            this.messageType(msg);
        },

        //消息类型
        messageType(msg){
            switch (msg.id) {
                case 7000: //心跳回应
                    this.pongTime = new Date().getTime();
                    break;
                case 7001: //设置音量
                    this.setVolume(msg.value);
                    break;
                case 7002: //设置时间轴数据
                    console.log('设置时间轴数据')
                    this.timelineData(msg, 'download');
                    break;
                case 7003: //设置静音
                    this.setMute();
                    break;
                case 7004: //请求更新截图
                    this.ykScreensHot();
                    break;
                case 7005: //请求硬件绑定
                    this.bindMacAddress();
                    break;
                case 7006: //插播广告  阶段下标
                    this.gameAdver(msg);
                    break;
                case 7007: //插播广告时间轴数据
                    this.cutInAdvTimelineData(msg);
                    break;
                default:
                    break;
            }
        },

        //硬件绑定
        bindMacAddress() {
            this.websocketSendData({
                id: scoketId.macBind,
                mac: addon().getMacAddress(),
            });
        },

        //设置静音
        setMute() {
            addon().setVolume(0);
        },

        //设置音量
        setVolume(value) {
            addon().setVolume(value);
        },

        //websocket关闭
        websocketclose() {
            console.log("WebSocket关闭");
            this.socketConnectSuccess = false;
            this.socketConnectLoading = false;
            this.reconnection();
        },

        //websocket连接失败
        websocketerror() {
            console.log("WebSocket连接失败");
            this.socketConnectSuccess = false;
            this.socketConnectLoading = false;
            window.clearTimeout(this.heartBeatTimeOut);
            this.reconnection();

            if (!this.isContent && $fs.readFileSync(serialNumberPath, "utf8")) {
                this.isContent = true;
                this.enterFullscreen();
                this.readFile();
                this.loginSuccess = true;
                this.showDownloading = false;
            }
        },


        //关闭socket
        closeSocket() {
            try{
                window.clearTimeout(this.heartBeatTimeOut);
                this.websock.close();
            }catch(err){
                
            }
        },

        //websocket断线重连  10秒重连一次
        reconnection() {
            this.pongTime = undefined;
            this.haveReconnection = true;
            if (this.timer) window.clearTimeout(this.timer);
            this.timer = window.setTimeout(() => {
                this.initWebsocket();
            }, 10000);
        },

        //websocket心跳  20秒一次
        heartBeat() {
            if (this.heartBeatTimeOut) window.clearTimeout(this.heartBeatTimeOut);
            let date = new Date().getTime();
            if(this.pongTime && ((date - this.pongTime) / 1000) > this.overtime){
                console.log('连接超时')
                this.websocketclose();
            }
            this.websocketSendData({ id: scoketId.ping });
            this.heartBeatTimeOut = window.setTimeout(() => {
                this.heartBeat();
            }, 20000);
        },

        //设置插播广告 时间轴 
        cutInAdvTimelineData(msg){
            this.writeFile(cutInAdverJsonPath, JSON.stringify(msg));
            this.$nextTick(() => {
                this.readCutInfile();
            })
        },

    }
}