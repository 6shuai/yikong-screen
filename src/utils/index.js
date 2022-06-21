let os = require('os');
let path = require('path');

export const serverUrl = 'http://123.206.83.233:8181'; //'http://211.159.173.153:8181';    
export const wsUrl = 'ws://123.206.83.233:8181/screen_server';
// export const wsUrl = 'ws://192.168.1.32:8181/screen_server';



//当前用户的home目录
export const getHomedir = os.homedir();

//项目下载的文件路径
export const miniviewDir = os.homedir() + '/miniview';


//时间轴内容 json 文件路径
export const screenJsonPath = miniviewDir + "/screenJson.json";

//序列号 文件路径
export const serialNumberPath = miniviewDir + "/serialNumber.txt";

//插播广告内容 json 文件路径
export const cutInAdverJsonPath = miniviewDir + "/cutInAdver.json";

//定时发布的 已播放时间戳文件路径
export const intervalTxtPath = process.env.NODE_ENV === "development" ? 
                                path.resolve("./") + "/static/interval.txt" : 
                                path.resolve("./") + "/dist/static/interval.txt";

//c++插件
export function addon(){
    let node = undefined;
    try {
        if(os.type() === 'Windows_NT'){
            node = process.env.NODE_ENV === 'development' ? global.elRequire('static/addon/addon-win.node') : global.elRequire('./static/addon/addon-win.node');
        }else if(os.type() === 'Linux'){
            node = process.env.NODE_ENV === 'development' ? global.elRequire('static/addon/addon-linux.node') : global.elRequire('./static/addon/addon-linux.node');
        }
    } catch (error) {
        
    }
    return node
}

// 资源 类型
export const contentTypeId = {
    image: 1,   //图片
    video: 2,   //视频
    game: 3,    //游戏
    atlas: 4,   //图集
    live: 5,    //直播
}

