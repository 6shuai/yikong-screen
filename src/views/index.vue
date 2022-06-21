<template>
	<div class="main">
		<div class="downloading" v-show="showDownloading">
			<img src="../../static/image/download.png" />
		</div>

		<login
			ref="login"
			v-if="!loginSuccess && !showDownloading"
			@loginClick="login"
			:loginError="loginError"
		></login>

		<div class="xfj-screen" v-show="reFresh && loginSuccess">
			<!-- 下个阶段的内容提前加载 防止出现黑屏 -->
			<!-- <div
				v-for="(item, index) in nextStageContent"
				:key="'nextStage' + index"
				class="screen-item"
				:style="{
					top: parseInt(item.y * ratioH) + 'px',
					left: parseInt(item.x * ratioW) + 'px',
					width: parseInt(item.width * ratioW) + 'px',
					height: parseInt(item.height * ratioH) + 'px',
					zIndex: item.layer,
				}"
			>
				<loop-play :nextLoadImage="true" :data="item"></loop-play>
			</div> -->

			<div
				v-for="(item, index) in currentContent"
				:key="index"
				class="screen-item"
				:style="{
					top: parseInt(item.y * ratioH) + 'px',
					left: parseInt(item.x * ratioW) + 'px',
					width: parseInt(item.width * ratioW) + 'px',
					height: parseInt(item.height * ratioH) + 'px',
					zIndex: item.layer,
				}"
			>
				<!-- 按时间轴 时间播放 -->
				<screen-item
					v-if="!item.isRotation"
					:data="item"
					ref="playItem"
					:timelineBeginTime="resData.beginTime"
					:timelineEndTime="resData.endTime"
					@sendMessage="websocketSendData"
					:serverTimeDiff="serverTimeDiff"
				></screen-item>

				<!-- 循环播放 -->
				<loop-play
					v-if="item.isRotation"
					:data="item"
					ref="playItem"
					:timelineBeginTime="resData.beginTime"
					:timelineEndTime="resData.endTime"
					@sendMessage="websocketSendData"
					:serverTimeDiff="serverTimeDiff"
				></loop-play>
			</div>
		</div>

		<!-- 插播广告 -->
		<div
			class="cut-in-advertising"
			v-if="
				currentCutInAdver &&
				currentCutInAdver.timelineRegions &&
				currentCutInAdver.timelineRegions.length
			"
		>
			<div
				v-for="(item, index) in currentCutInAdver.timelineRegions"
				:key="index"
				class="screen-item"
				:style="{
					top: parseInt(item.y * cutInRatioW) + 'px',
					left: parseInt(item.x * cutInRatioH) + 'px',
					width: parseInt(item.width * cutInRatioW) + 'px',
					height: parseInt(item.height * cutInRatioH) + 'px',
					zIndex: item.layer,
				}"
			>
				<screen-item
					:data="item"
					ref="playItem"
					:timelineBeginTime="resData.beginTime"
					:timelineEndTime="resData.endTime"
					@sendMessage="websocketSendData"
					:serverTimeDiff="serverTimeDiff"
				></screen-item>
			</div>
		</div>
	</div>
</template>

<script>
//获取当前窗口
const win = nw.Window.get();
const $fs = require("fs");
const path = require("path");
const request = require("request");
const unzip = require("unzip-stream");
const Bagpipe = require("bagpipe");
let bagpipe = new Bagpipe(1, { timeout: 5000 });

import ScreenItem from "../components/ScreenItem";
import LoopPlay from "../components/LoopPlay";
import Login from "../components/login";

import { screensHotUpload } from "@/mixins/screenshot";
import { timeDisposeTool, md5Tool } from "@/mixins/index";
import { miniviewSocket } from "@/mixins/socket";
import { cutInAdverMixin } from "@/mixins/cutInAdver";
import { scoketId } from "../utils/scoketId";
import { mapState } from "vuex";

import {
	getHomedir,
	miniviewDir,
	addon,
	contentTypeId,
	screenJsonPath,
	serialNumberPath,
} from "../utils/index";

export default {
	mixins: [
		screensHotUpload,
		timeDisposeTool,
		miniviewSocket,
		cutInAdverMixin,
		md5Tool,
	],
	data() {
		return {
			showDownloading: true, //窗口加载中
			loginError: "", //登录错误信息
			timer: undefined, //断线重连 定时器
			resData: undefined, //屏幕时间轴数据
			reFresh: false, //收到时间轴消息 7002 刷新屏幕子组件
			loginSuccess: false, //序列号登录成功
			ratioW: 1, //屏幕尺寸 适配时间轴容器 宽高比例
			ratioH: 1,
			serverTimeDiff: 0, //本地时间和服务器时间相差多少秒

			intervalPubList: [], //定时发布的 时间轴json
			intervalTimer: undefined, //定时发布 定时器

			resContent: [], //所有资源内容
			loopStageContent: [], //轮播阶段的内容
			intercutStageContent: [], //插播阶段的内容
			stageTotalTime: 0, //所有阶段加起来的总时长
			currentContent: [], //当前阶段的内容

			intercutTimer: undefined, //插播定时器
			closeIntercutTimer: undefined, //插播结束定时器

			incutIng: false, //是否插播中
			hasComputed: false, //阶段播放 是否计算过

			currentCutInAdver: {}, //当前插播的广告数据
			adverTimer: undefined, //插播广告倒计时
			playTimer: undefined,
			timelineResData: [], //下载时 时间轴里的资源内容列表
			deleteTimer: undefined,

			nextStageContent: [], //下个阶段内容

			downloadContent: [], //下载资源列表
			downloadContentIds: [], //下载资源id
			fileCiphertext: {},
		};
	},
	computed: {
		...mapState({
			resDir: (state) => state.resDir,
			stageIndex: (state) => state.stageIndex,
			screenData: (state) => state.screenData,
			stageUpdateState: (state) => state.stageUpdateState,
			playIsEnd: (state) => state.playIsEnd,
		}),
	},
	created() {
		//打开窗口
		win.show();

		//窗口置顶
		// win.setAlwaysOnTop(true);
	},
	mounted() {
		let _this = this;
		nw.Screen.Init();
		// 监听屏幕分辨率变化
		nw.Screen.on("displayBoundsChanged", (event) => {
			_this.$nextTick(() => {
				_this.screenAdaptive();
			});
		});

		//监听游戏通信
		window.addEventListener(
			"message",
			(event) => {
				if (event.data === "getGameInfo") {
					let iframe = document.getElementById("miniview-game");
					iframe.contentWindow.postMessage(_this.screenData, "*");
				}
			},
			false
		);

		try {
			var myDate = new Date();
			let date = myDate.toLocaleDateString();
			let localStorageDate = localStorage.yikongDate;
			//解决部分机器不支持webgl问题  重启nw
			if (!Detector.webgl && localStorageDate != date) {
				localStorage.yikongDate = date;
				chrome.runtime.reload();
			}
		} catch (error) {
			console.log(error);
		}

		this.init();
	},
	methods: {
		init() {
			//创建文件夹目录
			var dirPath = path.join(getHomedir, "miniview");
			this.createDir(dirPath);
			this.deleteRes(this.resDir, "deleteDownloading").then((res) => {
				setTimeout(() => {
					this.initWebsocket();
					this.readCutInfile();
				}, 5000);
			});
		},

		//游戏插播广告   stageId: 阶段id
		gameAdver(data) {
			if (this.adverTimer) clearTimeout(this.adverTimer);
			let { width, height, timelinePhases } =
				this.cutInAdverData[data.containerId] || {};
			this.currentCutInAdver =
				timelinePhases[data.timelineStage - 1] || {};

			let cutinWidth = window.screen.width; //屏幕宽
			let cutinHeight = window.screen.height; //屏幕高
			this.cutInRatioW = (cutinWidth / width).toFixed(3); //宽比例
			this.cutInRatioH = (cutinHeight / height).toFixed(3); //高比例

			//this.currentCutInAdver.duration  插播广告时长
			this.adverTimer = window.setTimeout(() => {
				this.currentCutInAdver = {};
			}, this.findStageDuratioMax(this.currentCutInAdver.timelineRegions) * 1000);
		},

		//窗口全屏显示
		enterFullscreen() {
			return new Promise((resolve) => {
				// win.enterFullscreen(true);
				resolve(true);
			});
		},

		//同步时间轴数据
		//getData 1 强制获取时间轴数据
		synTimelineContent(type) {
			this.websocketSendData({
				id: scoketId.synContent,
				getData: type,
			});
		},

		//设置时间轴 消息
		timelineData(msg, type) {
			this.downloadContent = [];
			this.downloadContentIds = [];
			// 定时发布消息 playTime
			if (msg.playTime) {
				msg.playTime = new Date(msg.playTime).getTime() / 1000;
				this.saveIntervalPub(msg);
				return;
			}

			this.writeFile(screenJsonPath, JSON.stringify(msg));
			this.reFresh = false;
			this.resData = {};
			this.$nextTick(() => {
				this.resData = msg;
				this.diffStageType(type);
				this.screenAdaptive();
				this.reFresh = true;

				this.timeInterval();
			});
		},

		//发布时间轴时 清除当前播放的资源
		clearContent() {
			//初始化阶段
			this.$store.commit("SET_STAGE_INIT");
			if (this.$refs.playTime) {
				this.$refs.playItem.forEach((item, index) => {
					try {
						this.$refs.playItem[index].clearCurrentPath();
					} catch (error) {}
				});
			}
		},

		// 写入文件
		writeFile(path, data) {
			$fs.writeFileSync(path, data, "utf8", function (err) {
				if (err) {
					console.log("写文件出错了，错误是：" + err);
				} else {
					console.log("ok");
				}
			});
		},

		//下载之前去重处理
		downloadBeforeDelRepeat(content) {
			window.clearTimeout(this.downloadTimer);
			for (let i = 0; i < content.length; i++) {
				let timeline = content[i].timelineContents;
				for (let t = 0; t < timeline.length; t++) {
					if (
						!this.downloadContentIds.includes(
							timeline[t].contentId
						) &&
						timeline[t].contentTypeId != contentTypeId.live
					) {
						this.downloadContent.push(timeline[t]);
						this.downloadContentIds.push(timeline[t].contentId);
					}
				}
			}

			this.downloadTimer = window.setTimeout(() => {
				this.downloadFile(this.downloadContent);
			}, 10000);
		},

		//下载资源到本地
		downloadFile(content) {
			window.clearTimeout(this.deleteTimer);
			//创建文件夹目录
			var dirPath = this.resDir;
			this.createDir(dirPath);

			for (let t = 0; t < content.length; t++) {
				// 图集
				if (content[t].contentTypeId == contentTypeId.atlas) {
					for (
						let atlasIndex = 0;
						atlasIndex < content[t].subContentsData.length;
						atlasIndex++
					) {
						let data = content[t].subContentsData[atlasIndex];
						data.errorCount = 0;
						this.bigpipDownLoad(data);
					}
				} else {
					content[t].errorCount = 0;
					this.bigpipDownLoad(content[t]);
				}
			}

			this.deleteTimer = window.setTimeout(() => {
				this.deleteRes(this.resDir, null)
					.then((res) => {
						// console.log('删除成功QAQ')
					})
					.catch((err) => {
						console.log("err", err);
					});
			}, 10 * 60000);
		},

		bigpipDownLoad(data) {
			//下载失败次数大于3次  不再下载
			if (data.errorCount && data.errorCount >= 3) {
				this.downloadFileError(data.contentId);
				return;
			}
			bagpipe.push(this.downloadFileResult, data, function (err, res) {});
		},

		//下载失败消息
		downloadFileError(contentId) {
			this.websocketSendData({
				id: scoketId.downloadError,
				contentId: contentId,
			});
		},

		//下载 data: 资源内容   pathDir: 资源下载到本地的目录地址
		downloadFileResult(data) {
			let pathDir = this.resDir;
			let contentPath = "";
			let fileName = "";
			let that = this;
			//游戏
			if (data.contentTypeId === contentTypeId.game) {
				contentPath = data.application.screenPackage;
				if (!contentPath) return;
				fileName = contentPath
					.substring(
						contentPath.lastIndexOf(
							"/",
							contentPath.lastIndexOf("/") - 1
						) + 1
					)
					.replace("/", "-");
			} else {
				contentPath = data.contentPath;
				fileName = contentPath.substring(contentPath.lastIndexOf("/") + 1);
			}

			this.fileCiphertext[fileName] = data.ciphertext ? data.ciphertext : "";

			let name = fileName.indexOf(".zip") > -1 ? fileName.split(".zip")[0] : fileName;
			if (!this.timelineResData.includes(path.join(pathDir, name))) {
				this.$set(
					this.timelineResData,
					this.timelineResData.length,
					path.join(pathDir, name)
				);
			}

			this.searchDownloadingFile(pathDir, fileName).then(
				(resFileName) => {
					if (
						!$fs.existsSync(
							pathDir +
								(resFileName.indexOf(".zip") > -1
									? resFileName.split(".zip")[0]
									: resFileName)
						)
					) {
						let stream = $fs.createWriteStream(
							path.join(pathDir, "downloading" + resFileName)
						);
						request(contentPath)
							.pipe(stream)
							.on("close", function (err) {
								if (!err) {
									console.log(
										"文件[" + stream.path + "]下载完毕"
									);
									that.fileMd5Diff(
										stream.path,
										that,
										resFileName,
										pathDir,
										data
									);
								}
							})
							.on("error", (err) => {
								console.log(
									"文件[" + resFileName + " ]下载失败",
									err
								);
								data.errorCount = data.errorCount
									? data.errorCount + 1
									: 1;
								this.bigpipDownLoad(data, pathDir);
							});
					} else {
						console.log("文件[" + resFileName + "]已存在");
					}
				}
			);
		},

		//查看当前文件是否是下载中的
		searchDownloadingFile(filePath, name) {
			let url = filePath + "downloading" + name;
			return new Promise((resolve) => {
				if ($fs.existsSync(url)) {
				} else {
					resolve(name);
				}
			});
		},

		//游戏zip 文件下载成功后 解压
		fileUncompress(fileDir, fileName) {
			try {
				$fs.createReadStream(fileDir)
					.pipe(unzip.Extract({ path: fileName }))
					.on("close", () => {
						console.log("解压成功");
					});
			} catch (err) {}
		},

		//创建目录文件
		createDir(path) {
			if (!$fs.existsSync(path)) {
				$fs.mkdirSync(path);
				console.log("文件夹创建成功");
			} else {
				console.log("文件夹已存在");
			}
		},

		// 读取文件数据
		readFile() {
			try {
				let obj = $fs.readFileSync(screenJsonPath, "utf8");
				let currentDate = new Date().toLocaleDateString();
				let storageDate = localStorage.storageDate;
				this.synTimelineContent(0);
				if (this.resData && currentDate == storageDate) return;

				localStorage.storageDate = currentDate;
				this.resData = JSON.parse(obj);
				this.reFresh = false;
				this.$nextTick(() => {
					this.diffStageType();
					this.reFresh = true;
					this.timeInterval();
					this.screenAdaptive();
				});
			} catch (error) {
				this.synTimelineContent(1);
			}
		},

		// 读取文件数据  屏幕序列号
		readFileSerialNumber() {
			try {
				let num = $fs.readFileSync(serialNumberPath, "utf8");
				if (this.$refs.login && num)
					this.$refs.login.setSerialNumber(num);

				if (num) {
					this.serialLoginSuccess(num);
				} else {
					this.loginSuccess = false;
					this.showDownloading = false;
				}
			} catch (error) {
				this.loginSuccess = false;
				this.showDownloading = false;
			}
		},

		//序列号登录
		login(num) {
			if (!this.socketConnectSuccess) {
				this.loginError = "网络连接已断开~";
				this.$refs.login.loginLoading = false;
				return;
			}
			this.writeFile(serialNumberPath, num);
			this.serialLoginSuccess(num);
		},

		//发送登录请求
		serialLoginSuccess(num) {
			this.websocketSendData({
				id: scoketId.login,
				serialNumber: num,
				//获取屏幕 mac地址
				mac: addon().getMacAddress(),
				//获取音量
				volume: addon().getVolume(),
			});
		},

		//根据屏幕尺寸 适配时间轴容器
		screenAdaptive(w, h) {
			let _width = w ? w : window.screen.width; //屏幕宽
			let _height = h ? h : window.screen.height; //屏幕高
			this.ratioW = (_width / this.resData.width).toFixed(3); //宽比例
			this.ratioH = (_height / this.resData.height).toFixed(3); //高比例

			//二次验证
			window.setTimeout(() => {
				let width = (_width / this.resData.width).toFixed(3);
				if (_width != window.screen.width) {
					this.screenAdaptive(
						document.body.clientWidth,
						document.body.clientHeight
					);
				}
			}, 3000);
		},

		//本地时间和 服务器返回的时间  相差值 多少秒  time 服务器返回的时间
		compareTime(time) {
			this.serverTimeDiff = Number(
				(new Date().getTime() / 1000).toFixed(0) - (time / 1000).toFixed(0)
			);

			if (this.serverTimeDiff > 0) {
				this.serverTimeDiff = -this.serverTimeDiff;
			} else if (this.serverTimeDiff < 0) {
				this.serverTimeDiff = Math.abs(this.serverTimeDiff);
			}
		},

		//保存定时发布数据
		saveIntervalPub(data) {
			this.intervalPubList = localStorage.timelineArr
				? JSON.parse(localStorage.timelineArr)
				: [];
			if (this.intervalPubList.indexOf(data.playTime) == -1) {
				this.intervalPubList.push(data.playTime);
				this.intervalPubList.sort((a, b) => {
					return a - b;
				});
				localStorage.timelineArr = JSON.stringify(this.intervalPubList);
			}

			this.writeFile(
				`${miniviewDir}/${data.playTime}.json`,
				JSON.stringify(data)
			);

			this.timeInterval();
		},

		//定时发布
		timeInterval() {
			this.intervalPubList = localStorage.timelineArr
				? JSON.parse(localStorage.timelineArr)
				: [];
			if (!this.intervalPubList.length) {
				return;
			}

			window.clearTimeout(this.intervalTimer);
			let intervalPubList = this.intervalPubList.sort((p, n) => {
				return p - n;
			});

			//定时发布的时间戳
			let pubTime = intervalPubList[0];
			let currentTime = new Date().getTime() / 1000 - this.serverTimeDiff;
			let diff = pubTime - currentTime ? pubTime - currentTime : 0;
			let intervalPath = `${miniviewDir}/${pubTime}.json`;
			let file = undefined;
			if ($fs.existsSync(intervalPath)) {
				file = $fs.readFileSync(intervalPath, "utf8");
			} else {
				this.intervalPubList.splice(0, 1);
				localStorage.timelineArr = JSON.stringify(this.intervalPubList);
				this.timeInterval();
				return;
			}

			let json = JSON.parse(file);

			let intervalData = [];
			json.timelinePhases.forEach((item) => {
				intervalData = intervalData.concat(item.timelineRegions);
			});

			// this.downloadFile(intervalData, 'timeInterval');
			this.downloadBeforeDelRepeat(intervalData);

			this.intervalTimer = window.setTimeout(() => {
				this.clearContent();

				delete json.playTime;
				this.timelineData(json);

				this.intervalPubList.splice(0, 1);
				localStorage.timelineArr = JSON.stringify(this.intervalPubList);

				//删除定时发布的json
				$fs.unlinkSync(intervalPath);
			}, diff * 1000);
		},

		//区分阶段类型  phaseType: 1轮播   2插播
		diffStageType() {
			if (!this.resData.timelinePhases) return;
			this.loopStageContent = [];
			this.intercutStageContent = [];
			this.currentContent = [];
			this.resContent = [];
			this.stageTotalTime = 0;

			this.resData.timelinePhases.forEach((item, index) => {
				if (item.phaseType == 1) {
					item.duration =
						this.computedStageDuration(
							item,
							this.resData.timelinePhases[index + 1]
						) || 5;

					this.stageTotalTime =
						this.stageTotalTime +
						this.computedStageDuration(
							item,
							this.resData.timelinePhases[index + 1]
						);

					this.loopStageContent.push(item);
				} else {
					this.intercutStageContent.push(item);
				}

				this.resContent = this.resContent.concat(item.timelineRegions);
			});
			

			//设置循环阶段数据
			this.$store.commit("SET_STAGE_DATA", this.loopStageContent);

			this.timelinePlayStar();
		},

		//计算阶段的时长   data 当前阶段    nextData 下个阶段
		computedStageDuration(data, nextData) {
			data.contentDuration = this.findStageDuratioMax(
				data.timelineRegions
			);
			if (data.isRotation) {
				//循环 当前阶段开始时间 到下一个阶段或者时间轴结束时间的时长
				return this.timeDifference(
					data.beginTime,
					nextData ? nextData.beginTime : this.resData.endTime
				);
			} else {
				//不循环 当前阶段的内容总时长
				return this.findStageDuratioMax(data.timelineRegions);
			}
		},

		//找到阶段里 逻辑区域时长最长的
		findStageDuratioMax(data) {
			let stageTotalDuration = 0;
			data.map((item, index) => {
				let totalDuration = 0;
				item.timelineContents.forEach((t) => {
					totalDuration += Number(t.duration);
				});
				item.totalDuration = totalDuration;
				stageTotalDuration =
					stageTotalDuration > totalDuration
						? stageTotalDuration
						: totalDuration;
			});

			return stageTotalDuration;
		},

		//时间轴播放 开始  10:00 - 2:30
		timelinePlayStar() {
			let { beginTime, endTime } = this.resData
			window.clearTimeout(this.playTimer);
			// this.downloadFile(this.resContent);
			this.downloadBeforeDelRepeat(this.resContent);

			//当前时间 是否过了时间轴的结束时间 
			// let overtime = this.timeDifference(
			// 	endTime,
			// 	this.getNowTime(),
			// 	2
			// );
			// if (overtime > 0) return;

			// 当前时间 是否处于 时间轴的开始时间 
			let downTime = this.timeDifference(
				this.getNowTime(),
				beginTime,
				1
			);

			//结束时间超过晚上12点  
			if(this.timeDifference(beginTime, endTime) < 0){
				console.log('结束时间超过晚上12点')
				//当前时间 大于 时间轴开始时间
				if(this.timeDifference(beginTime, this.getNowTime(), 2) > 0){
					console.log('当前时间 大于 时间轴开始时间')
					downTime = 0
					
					//当前时间超过晚上12点 并且还没到结束的时间
				}else if(this.timeDifference(beginTime, this.getNowTime(), 2) <= 0 && this.timeDifference(endTime, this.getNowTime(), 2) <= 0){
					console.log('//当前时间超过晚上12点 并且还没到结束的时间')
					downTime = 0
				}else{
					downTime = this.timeDifference(this.getNowTime(), beginTime, 1)
				}
			}else {
				//结束时间在晚上 12点之前   
				//当前时间超过 时间轴的结束时间 开始重新计算距离 时间轴的开始还剩多少秒 
				console.log('结束时间在晚上12点之前')
				if(this.timeDifference(endTime, this.getNowTime(), 2) >= 0){
					downTime = 24 * 60 * 60 - Math.abs(this.timeDifference(this.getNowTime(), beginTime, 1))
				}else{
					downTime = this.timeDifference(this.getNowTime(), beginTime, 1)
				}
			}
			
			console.log('downTime------------>', downTime)

			this.$store.commit("SET_TIMELINE_PLAY_END", false);
			this.$store.commit("SET_TIMELINE_LOOP", this.resData.isRotation);

			this.playTimer = window.setTimeout(() => {
				this.hasComputed = false;
				this.incutIng = false;
				this.clearContent();
				this.$nextTick(() => {
					this.timelineStagePlay();
					//插播轴
					this.timelineIntercutPlay();
				});
			}, (downTime < 0 ? 0 : downTime) * 1000);

		},

		//删除资源文件夹
		deleteRes(resDir, delDownloading) {
			return new Promise((resolve, reject) => {
				if ($fs.existsSync(resDir)) {
					try {
						console.log(
							this.timelineResData,
							"timelineResData----------->"
						);
						rmdir(
							resDir,
							this.timelineResData,
							delDownloading,
							() => {
								resolve(true);
							}
						);
					} catch (err) {
						resolve(true);
					}
				} else {
					resolve(true);
				}
			});
		},

		//按照 轮播阶段播放
		timelineStagePlay() {
			if (this.stageTimer) window.clearTimeout(this.stageTimer);
			if (!this.loopStageContent.length || this.incutIng) return;

			let currentPlayPosition = 0;
			let stageIndex = 0;

			if (!this.hasComputed) {
				//当前时间轮播应该播放到的时间段
				let firstTime =
					this.loopStageContent[0].beginTime ||
					this.resData.beginTime;
				let currentPlayTime =
					this.timeDifference(firstTime, this.getNowTime(), 2) %
					this.stageTotalTime;

				let count = 0;

				for (let i = 0; i < this.loopStageContent.length; i++) {
					let item = this.loopStageContent[i];
					if (count + item.duration > currentPlayTime) {
						stageIndex = i;
						currentPlayPosition =
							currentPlayTime - count < 0
								? 0
								: currentPlayTime - count;
						break;
					}
					count += item.duration;
				}
				this.$store.commit("SET_STAGE_INDEX", stageIndex);
				this.$nextTick(() => {
					this.hasComputed = true;
				});
			} else {
				stageIndex = this.stageIndex;
			}

			let { duration, phaseType, timelineRegions, contentDuration } =
				this.loopStageContent[stageIndex];

			this.currentContent = timelineRegions;


			this.$store.commit(
				"SET_CURRENT_PLAY_POSITION",
				currentPlayPosition % contentDuration
			);

			let pTime = duration - currentPlayPosition;

			this.findNextStageTimeline(stageIndex, pTime);

			this.stageTimer = window.setTimeout(() => {
				// if(!duration && phaseType == 1) this.loopStageContent.splice(stageIndex, 1);
				this.$store.dispatch("setStageIndex");
			}, pTime * 1000 - new Date().getMilliseconds());
		},

		//下个阶段内容
		findNextStageTimeline(index, pTime) {
			this.nextStageContent = [];
			if (pTime < 5) return;
			window.clearTimeout(this.nextStageTimer);
			this.nextStageTimer = window.setTimeout(() => {
				let nextIndex =
					index == this.loopStageContent.length - 1 ? 0 : index + 1;

				this.nextStageContent =
					this.loopStageContent[nextIndex].timelineRegions;
			}, (pTime - 5) * 1000);
		},

		//插播   插播内容播放结束后 轮播内容继续播放
		timelineIntercutPlay(index = 0, type) {
			window.clearTimeout(this.intercutTimer);
			if (!this.intercutStageContent.length) return;
			let sign = false;
			let ptime = 0;
			let data = this.intercutStageContent.sort((a, b) => {
				return (
					this.timeDifference(b.beginTime, this.getNowTime(), 2) -
					this.timeDifference(a.beginTime, this.getNowTime(), 2)
				);
			});

			for (let i = 0; i < data.length; i++) {
				if (index <= i) {
					let startTime = data[i].beginTime;
					let duration = data[i].duration;
					if (this.timeDifference(startTime, this.getNowTime(), 2) <= 0) {
						index = i;
						sign = true;
						ptime = this.timeDifference(
							this.getNowTime(),
							data[i].beginTime,
							1
						);
						break;
					} else if (
						this.timeDifference(startTime, this.getNowTime(), 2) >=
							0 &&
						this.timeDifference(
							this.findNewTime(startTime, duration),
							this.getNowTime(),
							2
						) < 0
					) {
						index = i;
						sign = true;
						ptime = 0;
						break;
					}
				}
			}

			this.$nextTick(() => {
				console.log("当前是否有插播的内容------>", sign, ptime);
				if ((!sign || ptime) && type == "incutEnd") {
					this.hasComputed = false;
					this.timelineStagePlay();
				}
				if (!sign) {
					this.computedCutPlayStart(data[0].beginTime);
					return;
				}
				if (!ptime) this.incutIng = true;
				this.intercutTimer = window.setTimeout(() => {
					this.currentContent = [];
					window.clearTimeout(this.stageTimer);
					if (index + 1 <= data.length - 1) {
						this.timelineIntercutPlay(index + 1);
					}
					this.$nextTick(() => {
						this.setTimelineRule(data[index]);
						this.intercutPlayDuration(data[index], index);
					});
				}, ptime * 1000);
			});
		},

		//插播 按照时长播放 ， 到了时间点关闭。 继续播放轮播阶段
		intercutPlayDuration(data) {
			let startTime = data.beginTime;
			let duration = data.duration;
			let ptime = this.timeDifference(
				this.getNowTime(),
				this.findNewTime(startTime, duration),
				1
			);
			if (this.closeIntercutTimer)
				window.clearTimeout(this.closeIntercutTimer);
			this.closeIntercutTimer = window.setTimeout(() => {
				this.currentContent = [];
				this.nextStageContent = [];
				this.incutIng = false;
				this.timelineIntercutPlay(0, "incutEnd");
			}, ptime * 1000);
		},

		//插播全部播放完之后  再  计算距离第一个插播时间还多久
		computedCutPlayStart(beginTime) {
			let dateDuration = 24 * 60 * 60;
			let s =
				dateDuration -
				this.timeDifference(beginTime, this.getNowTime(), 2);
			setTimeout(() => {
				this.timelineIntercutPlay();
			}, s * 1000);
		},

		//插播 当前时间应该播放的位置
		setTimelineRule(data) {
			window.clearTimeout(this.nextStageTimer);
			let { beginTime, duration } = data;

			this.currentContent = data.timelineRegions;
			this.$nextTick(() => {
				//当前时间距离 当前阶段 开始时间的 时长
				let syDuration = this.timeDifference(
					beginTime,
					this.getNowTime(),
					2
				);

				//当前阶段 播放一遍的时长
				let stageDuration = duration;

				let currentPlayPosition = syDuration % stageDuration; //现在阶段应该播放的时长位置
				console.log(
					"阶段播放时长位置-------------->",
					currentPlayPosition
				);
				this.$store.commit(
					"SET_CURRENT_PLAY_POSITION",
					currentPlayPosition
				);
			});
		},

		//更新当前 阶段
		updateStage() {
			this.currentContent = [];
			this.$nextTick(() => {
				this.timelineStagePlay();
			});
		},
	},
	beforeDestroy() {
		this.closeSocket();
	},
	components: {
		ScreenItem,
		LoopPlay,
		Login,
	},

	watch: {
		stageIndex(val) {
			if (val < 0 || !this.hasComputed) return;
			this.updateStage();
		},

		// 更新阶段
		stageUpdateState(val) {
			this.updateStage();
		},

		playIsEnd(val) {
			if (val) {
				console.log("播放结束了");
				window.clearTimeout(this.stageTimer);
				this.nextStageContent = [];
				this.currentContent = [];
				this.timelinePlayStar();
			}
		},
	},
};

//删除文件夹 及 文件
function rmdir(dir, timelineResData, delDownloading, callback) {
	$fs.readdir(dir, (err, files) => {
		/**
		 * @desc 内部循环遍历使用的工具函数
		 * @param {Number} index 表示读取files的下标
		 */
		function next(index) {
			// 如果index 等于当前files的时候说明循环遍历已经完毕，可以删除dir，并且调用callback
			// if (index == files.length) return $fs.rmdir(dir, timelineResData, callback);
			if (index == files.length) return $fs.rmdir(dir, callback);
			// 如果文件还没有遍历结束的话，继续拼接新路径，使用fs.stat读取该路径
			let newPath = path.join(dir, files[index]);
			// 读取文件，判断是文件还是文件目录

			$fs.stat(newPath, (err, stat) => {
				if (err) {
					callback();
				} else if (stat.isDirectory()) {
					// 因为我们这里是深度循环，也就是说遍历玩files[index]的目录以后，才会去遍历files[index+1]
					// 所以在这里直接继续调用rmdir，然后把循环下一个文件的调用放在当前调用的callback中
					// if(timelineResData.includes(newPath)){

					// }
					if (findHasPath(timelineResData, newPath)) {
						next(index + 1);
					} else {
						rmdir(newPath, timelineResData, delDownloading, () =>
							next(index + 1)
						);
					}
				} else {
					// 如果是文件，则直接删除该文件，然后在回调函数中调用遍历nextf方法，并且index+1传进去
					if (
						!delDownloading &&
						(newPath.indexOf("downloading") > -1 ||
							timelineResData.includes(newPath))
					) {
						next(index + 1);
						return;
					}

					if (
						delDownloading &&
						newPath.indexOf("downloading") == -1
					) {
						next(index + 1);
						return;
					}
					$fs.unlink(newPath, (err) => {
						console.log("删除了-->", newPath);
						next(index + 1);
					});
				}
			});
		}
		next(0);
	});
}

//文件路径是否包含timelineResData 数组里面的路径
function findHasPath(timelineResData, path) {
	let handle = false;
	for (let i = 0; i < timelineResData.length; i++) {
		if (path.indexOf(timelineResData[i]) > -1) {
			handle = true;
			break;
		}
	}
	return handle;
}

//轮播阶段
//循环    ->  阶段循环播放, 直到下一个的开始时间到了
//不循环  ->  阶段所有内容播放完, 播放下一个阶段. (不按照下一个阶段开始时间)

//时间轴容器
//时间轴循环 ->  最后一个时间轴不循环, 播放完之后, 再播放第一个时间轴 .. 整个时间轴循环
//时间轴循环不起效果 -> 最后一个时间轴循环
// 1 循环  2 不循环  3 循环

var Detector = {
	canvas: !!window.CanvasRenderingContext2D,
	webgl: (function () {
		try {
			var canvas = document.createElement("canvas");
			return !!(
				window.WebGLRenderingContext &&
				(canvas.getContext("webgl") ||
					canvas.getContext("experimental-webgl"))
			);
		} catch (e) {
			return false;
		}
	})(),
	workers: !!window.Worker,
	fileapi: window.File && window.FileReader && window.FileList && window.Blob,
	getWebGLErrorMessage: function () {
		var element = document.createElement("div");
		element.id = "webgl-error-message";
		element.style.fontFamily = "monospace";
		element.style.fontSize = "13px";
		element.style.fontWeight = "normal";
		element.style.textAlign = "center";
		element.style.background = "#fff";
		element.style.color = "#000";
		element.style.padding = "1.5em";
		element.style.width = "400px";
		element.style.margin = "5em auto 0";
		if (!this.webgl) {
			element.innerHTML = window.WebGLRenderingContext
				? [
						'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" rel="external nofollow" rel="external nofollow" style="color:#000">WebGL</a>.<br />',
						'Find out how to get it <a href="http://get.webgl.org/" rel="external nofollow" rel="external nofollow" style="color:#000">here</a>.',
				  ].join("\n")
				: [
						'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" rel="external nofollow" rel="external nofollow" style="color:#000">WebGL</a>.<br/>',
						'Find out how to get it <a href="http://get.webgl.org/" rel="external nofollow" rel="external nofollow" style="color:#000">here</a>.',
				  ].join("\n");
		}
		return element;
	},
	addGetWebGLMessage: function (parameters) {
		var parent, id, element;
		parameters = parameters || {};
		parent =
			parameters.parent !== undefined ? parameters.parent : document.body;
		id = parameters.id !== undefined ? parameters.id : "oldie";
		element = Detector.getWebGLErrorMessage();
		element.id = id;
		parent.appendChild(element);
	},
};
</script>
<style scope>
@import "../styles/index.css";
</style>
