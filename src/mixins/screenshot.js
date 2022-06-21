var win = nw.Window.get();
import { scoketId } from '../utils/scoketId';
import { serverUrl } from '../utils';

export const screensHotUpload = {
    data(){
        return{
            action: serverUrl + '/common/upload',
            updateImgTimer: undefined,                             //更新截图 定时器
        }
    },
    methods: {
        //更新屏幕截图  五分钟更新一次
        updatedScreensHot(){
            this.updateImgTimer = window.setTimeout(() => {
                this.ykScreensHot();
            }, 60000 * 5);
        },

        //截图
        ykScreensHot(){
            if(!this.socketConnectSuccess) return;
            let that = this;
            if(that.updateImgTimer) window.clearTimeout(that.updateImgTimer);
            win.capturePage(function(base64string){
            // 使用base64编码字符串处理某些需求
                let base64 = 'data:image/jpg;base64,' + base64string;
                that.uploadImg(base64);
            }, { format : 'jpg', datatype : 'raw'} );     
            that.updatedScreensHot();   
        },

        // 上传图片
        uploadImg(dataURI){
            let that = this;
            var blob = this.dataURItoBlob(dataURI);

            var xhr = new XMLHttpRequest();
            var fd = new FormData();
            fd.append('fileType', 'screenshot');
            fd.append('file', blob, new Date().getTime() +'.jpg');
            xhr.addEventListener('load',  function(){ that.imageSuccess(event) }, false);
            xhr.addEventListener('error', function(){ that.uploadError() }, false);
            xhr.addEventListener('abort', function(){ that.uploadError() }, false);
            xhr.open('POST', that.action);
            xhr.send(fd);
            xhr.getAllResponseHeaders()
        },

        //截图上传成功
        imageSuccess(res){
            let msg = JSON.parse(res.target.response);
            if(msg.code === 0){
                this.websocketSendData({
                    id: scoketId.screenshotCallback,
                    screenshotUri: msg.obj.path,
                })
            }
        },

        //截图上传出错
        uploadError(error){
            console.log(error, '上传错误')
        },

        //base64 转 二进制
        dataURItoBlob(dataURI) {
            var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]; // mime类型
            var byteString = atob(dataURI.split(',')[1]); //base64 解码
            var arrayBuffer = new ArrayBuffer(byteString.length); //创建缓冲数组
            var intArray = new Uint8Array(arrayBuffer); //创建视图

            for (var i = 0; i < byteString.length; i++) {
                intArray[i] = byteString.charCodeAt(i);
            }
            return new Blob([intArray], {type: mimeString});
        },
    },
}