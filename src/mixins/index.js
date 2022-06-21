
const $fs = require("fs");
const path = require("path");
const crypto = require('crypto');
import { contentTypeId } from '../utils/index';

//处理 转换时间的工具
export const timeDisposeTool = {
    methods: {
        //时间戳 转化为时间格式
        formatTime(timestamp, type) {
            var date = new Date(timestamp * 1000);//时间戳为10位需*1000，时间戳为13位的话不需乘1000
            var Y = date.getFullYear() + '-';
            var M = this.addPreZero(date.getMonth() + 1) + '-';
            var D = this.addPreZero(date.getDate()) + ' ';
            var h = this.addPreZero(date.getHours()) + ':';
            var m = this.addPreZero(date.getMinutes()) + ':';
            var s = this.addPreZero(date.getSeconds());
            if (type == 'time') {
                return h + m + s;
            } else {
                return Y + M + D + h + m + s
            }
        },

        //计算时间差（相差分钟）
        timeDifferenceMinute(beginTime, endTime) {
            var start1 = beginTime.split(":");
            var startAll = parseInt(start1[0] * 60) + parseInt(start1[1]);

            var end1 = endTime.split(":");
            var endAll = parseInt(end1[0] * 60) + parseInt(end1[1]);

            return endAll - startAll;
        },

        //现在的时间  时分秒
        getNowTime() {
            let nowTime = this.formatTime(new Date() / 1000, 'time');
            return nowTime
        },

        //相差多少秒 开始时间  结束时间    index 查找开始 或 结束的真实时间
        timeDifference(beginTime, endTime, index) {
            if(index == 1){
                beginTime = this.findNewTime(beginTime, this.serverTimeDiff);
            }else if(index == 2){
                endTime = this.findNewTime(endTime, this.serverTimeDiff);
            }

            var start = beginTime.split(":");
            var startAll = parseInt(start[0] * 60) + parseInt(start[1]);
            if (!endTime) {
                return startAll * 60 + parseInt(start[2]);
            }

            var end1 = endTime.split(":");
            var endAll = parseInt(end1[0] * 60) + parseInt(end1[1]);

            let minute = endAll - startAll;
            return Number(minute * 60 - (parseInt(start[2]) - parseInt(end1[2])));
        },

        //传入时间  和 时长  返回一个新的时间
        findNewTime(time, duration) {
            let t = time.split(":");
            //小时
            let h = Number(t[0]);
            //分钟
            let m = Number(t[1]);
            //秒
            let s = Number(t[2]);

            //秒转换成分钟  余出来的秒数
            let remainderS = duration % 60;

            if (d > 60) {
                h = h + (d - d % 60) / 60;
                d = d % 60;
            } else if (d < -60) {
                h = h - (Math.abs(d) - d % 60) / 60;
                d = d % 60;
            } 

            //秒数转为 分钟
            let d = (duration - remainderS) / 60;
            if (s + remainderS >= 60) {
                s = s + remainderS - 60;
                m = m + 1;
            } else if (s + remainderS < 0) {
                s = 60 - Math.abs(s + remainderS);
                m = m - 1;
            } else {
                s = s + remainderS;
            }
            if (m + d >= 60) {
                m = m + d - 60;
                h = h + 1;
            } else if (m + d < 0) {
                m = 60 - Math.abs(m + d);
                h = h - 1;
            } else {
                m = m + d;
            }
            return (
                this.addPreZero(h) +
                ":" +
                this.addPreZero(m) +
                ":" +
                this.addPreZero(s)
            );
        },

        //小于10 前面补个0
        addPreZero(number) {
            return number < 10 ? '0' + number : number;
        },
    }
}


//播放资源
export const playResources = {
    methods: {
        getResourcesPath(data) {
            //本地资源目录路径
            const resDir = this.$store.state.resDir;
            if (!data) return;
            try {
                if(data.contentTypeId == contentTypeId.live) return data;
                if (data.contentPath || data.contentTypeId == contentTypeId.game) {
                    let url = '';
                    if (data.contentTypeId == contentTypeId.game) {
                        let contentPath = data.application.screenPackage;
                        url = `${resDir}${contentPath.substring(contentPath.lastIndexOf("/", contentPath.lastIndexOf("/") - 1) + 1).replace('/', '-').split('.zip')[0]}/index.html`;

                    } else {
                        url = `${resDir}${data.contentPath.substring(data.contentPath.lastIndexOf("/") + 1)}`;
                    }

                    // 游戏资源 通过iframe 通信
                    if (data.contentTypeId == contentTypeId.game) {
                        this.gameParamsProps(data);
                    }
                    
                    if ($fs.existsSync(url)) {
                        // 播放本地资源
                        let urlPath = url.indexOf('dist/') > -1 ? url.split('dist/')[1] : url;
                        data.contentPath = urlPath;
                        return data;
                    }

                    return data;
                }

            } catch (error) {
                console.log(error)
            }
        },


        //头脑王者 屏幕id 时间轴id 参数  通过iframe 通信
        gameParamsProps(data){
            let screenData = {
                ...data.application,
                screenId: this.$store.state.screenId ? this.$store.state.screenId : localStorage.screenId,
                contentId: data.contentId
            }
            this.$store.commit('SET_SCREEN_DATA', screenData);
        }
    },
}


//视频按照指定时间开始播放  
export const playVideo = {
    methods: {
        accordingTimePlay(data){
            this.$nextTick(() => {
                if(data.surplusDuration && this.$refs['video' + data.contentId]){
                    //视频从第n秒开始播放
                    this.$refs['video' + data.contentId].currentTime = data.duration - data.surplusDuration;
                }
            })
        }
    },
}

//md5 比较下载成功的文件是否完整
export const md5Tool = {
    methods: {
        fileMd5Diff(filePath, that, resFileName, pathDir, data){
            try {
                
                if ($fs.existsSync(filePath)) {

                    const stream = $fs.createReadStream(filePath);
                    const hash = crypto.createHash('md5');
                    stream.on('data', chunk => {
                        hash.update(chunk, 'utf8');
                    });
                    stream.on('end', () => {
                        const md5 = hash.digest('hex');
                        if(md5 == that.fileCiphertext[resFileName]){
                            $fs.rename(
                                path.join(filePath),
                                path.join(filePath.split('downloading')[0] + filePath.split('downloading')[1]),
                                (err) => {
                                    if (!err) {
                                        if (resFileName.indexOf(".zip") > -1) {
                                            that.fileUncompress(
                                                pathDir + resFileName,
                                                path.join(
                                                    pathDir,
                                                    resFileName.split(
                                                        ".zip"
                                                    )[0]
                                                )
                                            );
                                        }
                                    }
                                }
                            );
                        }else{
                            console.log('下载失败!!')
                            $fs.unlinkSync(filePath);
                            this.$nextTick(() => {
                                data.errorCount = data.errorCount ? data.errorCount + 1 : 1;
                                that.bigpipDownLoad(data, pathDir);
                            })
                        }



                    });
                }
            } catch (err) {
                console.log(err);
            }
        }
    }
}