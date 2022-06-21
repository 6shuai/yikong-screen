// 插播广告
let $fs = require('fs');
import { cutInAdverJsonPath } from '../utils/index';



export const cutInAdverMixin = {
    data(){
        return {
            cutInAdverData: [],              //所有的插播广告数据
            cutInRatioW: 1,
            cutInRatioH: 1,
        }
    },
    methods: {
        readCutInfile(){
            this.cutInAdverData = {};
            let obj = {},
                data = [];
            if($fs.existsSync(cutInAdverJsonPath)){
                obj = JSON.parse($fs.readFileSync(cutInAdverJsonPath, "utf8"));
                for(let i = 0; i < obj.timelines.length; i++){
                    let { timelinePhases, id } = obj.timelines[i];
                    this.cutInAdverData[id] = obj.timelines[i]; 
                    timelinePhases.forEach(item => {
                        data = data.concat(item.timelineRegions);
                    });
                }

                console.log('插播广告--------->', data, this.cutInAdverData);
                // this.downloadFile(data, 'timeInterval');
                this.downloadBeforeDelRepeat(data);
                
            }

        
            
        },
    },
}
