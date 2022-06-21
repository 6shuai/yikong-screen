export const scoketId = {
    // 接收消息时的id 状态
    pong: 7000,                 //心跳回应
    volume: 7001,               //设置音量
    timeline: 7002,             //设置时间轴
    mute: 7003,                 //设置静音
    screenshot: 7004,           //请求更新截图

    //发送消息时的 id 状态
    ping: 3000,                 //心跳
    login: 3001,                //屏幕客户端登录
    playOnce: 3002,             //某个内容播放了一次
    playPeriod: 3003,           //某个内容播放了一个时间周期（暂定5分钟
    screenshotCallback: 3004,   //截图回调
    macBind: 3005,              //硬件绑定
    synContent: 3006,           //同步时间轴内容
    downloadError: 3007,        //下载内容失败
}