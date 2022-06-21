import { stat } from 'fs';
import Vue from 'vue'
import Vuex from 'vuex'
const path = require("path");

Vue.use(Vuex)
const state = {
    //屏幕id
    screenId: undefined,           

    //屏幕信息
    screenData: {},   

    //阶段数组             
    stageData: [],                 
    resDir: process.env.NODE_ENV === "development"
        ? path.resolve("./") + "/static/res/"
        : path.resolve("./") + "/dist/static/res/",

    //当前阶段
    stageIndex: -1,                

    //当前阶段 已经播放了多少秒
    currentPlayPosition: 0,        

    //当只有一个步骤时  stageIndex watch不会触发， 监听此状态
    stageUpdateState: false,       

    //时间轴是否循环播放
    timelineIsLoop: false,         

    fileBase64: {},

    //时间轴是否播放结束
    playIsEnd: false,    
    
    //时间轴的开始时间
    timelineStartTime: null,

    //时间轴的结束时间
    timelineEndTime: null
}

const mutations = {
    //屏幕id
    SET_SCREEN_ID(state, infos) {
        state.screenId = infos
    },

    //屏幕信息
    SET_SCREEN_DATA(state, data) {
        state.screenData = data;
    },

    //阶段数组
    SET_STAGE_DATA(state, data){
        state.stageData = data;
    },

    //当前阶段
    SET_STAGE_INDEX(state, data){
        state.stageIndex = data;
    },

    //初始化 阶段和 步骤 index
    SET_STAGE_INIT(){
        state.stageIndex = -1;
    },

    //当前阶段已经播放了多少秒
    SET_CURRENT_PLAY_POSITION(state, data){
        state.currentPlayPosition = data;
    },
    
    SET_STAGE_UPDATE_STATE(state, data){
        state.stageUpdateState = !state.stageUpdateState;
    },

    //更改本地资源目录地址
    SET_RES_DIR(state, fileName){
        state.resDir = process.env.NODE_ENV === "development"
        ? path.resolve("./") + `/static/${fileName}/`
        : path.resolve("./") + `/dist/static/${fileName}/`;
    },

    //设置时间轴是否循环
    SET_TIMELINE_LOOP(state, type){
        state.timelineIsLoop = type;
    },

    //设置时间轴是否播放结束
    SET_TIMELINE_PLAY_END(state, status){
        state.playIsEnd = status;
    },

    //设置时间轴的开始和结束时间
    SET_TIMELINE_TIME(state, data){
        let { beginTime, endTime } = data;
        state.timelineStartTime = beginTime;
        state.timelineEndTime = endTime;
    }

}

const actions = {
    setScreenId({commit}, data) {
        commit('SET_SCREEN_ID', data);
    },

    setStageIndex({commit, state}, data) {
        //时间轴播放结束 return
        if(state.playIsEnd) {
            console.log('结束了')
            return
        };

        let index = state.stageIndex;

        if((index >= state.stageData.length - 1 && !state.timelineIsLoop) || state.stageData.length <= 1){
            commit('SET_STAGE_UPDATE_STATE');
            return;
        }

        index += 1;
        if(index > state.stageData.length-1 && state.timelineIsLoop){
            index = 0;
        }
        commit('SET_STAGE_INDEX', index);
    }
}


export default new Vuex.Store({
    state,
    mutations,
    actions
})