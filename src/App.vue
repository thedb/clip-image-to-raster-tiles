<template>
  <section>create raster tiles</section>
  <section>
    <p>上传图片进行切片<br>(支持多选)</p>
    <br>
    <section class="select_threading">
      <section class="select_btn" :class="{btn_selected: selectThreading === 0}" @click="chooseThread(0)">单线程切割+单线程保存</section>
      <section class="select_btn" :class="{btn_selected: selectThreading === 1}" @click="chooseThread(1)">单线程切割+多线程保存</section>
      <section class="select_btn" :class="{btn_selected: selectThreading === 2}" @click="chooseThread(2)">线程池切割+线程池保存</section>
      <section class="select_btn" :class="{btn_selected: selectThreading === 3}" @click="chooseThread(3)">全部多线程</section>
    </section>
    <!-- <p>当前选择: {{selectThreading}}</p> -->
    <br>
    <br>
    <br>
    <section class="img_input">
      <img class="img_input_bg" src="./assets/plus.svg" alt="">
      <input id="photoInput" class="control_input" type="file" accept="image/*" v-on:change="changeUploadFile" multiple ref="photoInput">
    </section>
    <br/>
    <br/>
    <p v-if="uploadImgs.length !== 0">总任务 {{currentTask}} / {{allTask}}</p>
    <section v-if="uploadImgs.length !== 0" class="upload_imgs">
      <img v-for="v in uploadImgs" :src="v.src" :key="v.value">
    </section>
    <br/>
    <br/>
    <p v-show="clipStatus !== 100 && clipStatus !== 0">正在切片<br>当前切片进度{{clipStatus}}%</p>
    <section v-show="selectThreading === 0 &&currentTask === allTask && (zipProgress === 0 || zipProgress === 100) && allTask !== 0">
      <button @click="downloadImgsZip" >单线程保存文件</button>
      <br/>
      <br/> -->
    </section>
    <button v-show="selectThreading !== 0 &&currentTask === allTask && (zipProgress === 0 || zipProgress === 100) && allTask !== 0" @click="check" >查看多线程</button>
    <button v-show="selectThreading !== 0 &&currentTask === allTask && (zipProgress === 0 || zipProgress === 100) && allTask !== 0" @click="generateMTTiles" >多线程保存文件</button>
    <button v-show="selectThreading !== 0 &&currentTask === allTask && (zipProgress === 0 || zipProgress === 100) && allTask !== 0" @click="poolGenerate" >pool线程保存文件</button>
    <section class="progress_bar" v-if="zipProgress !== 0 && zipProgress !== 100">
      <section :style="{width: `${zipProgress}%`}" class="progress_line" ></section>
    </section>
    <p v-if="useTime">文件压缩总用时：{{useTime}}秒</p>
    <br/>
    <br/>
    <br/>
  </section>
</template>

<script>
import {
  blobToImg,
  canvasToBlob,
} from 'jason-lib-pkg'
import {
  getCount,
  getImgInfo,
  initMT,
  initST,
} from './assets/export/index.js'

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  ref,
  reactive
} from 'vue'

import { 
  spawn, 
  Thread, 
  Worker,
  Transfer,
  Pool,
} from "threads"

export default {
  name: 'App',
  setup() {
    // ST === SingleThreading;
    // MT === MultiThreading;
    let selectThreading = ref(0); 
    // 0 全部单线程
    // 1 浏览器单线程&web worker
    // 2 线程池切割
    // 3 多线程切割
    // let isMT = ref(true);
    let clipStatus = ref(0);
    let uploadImgs = reactive([]);
    let allTask = ref(null);
    let currentTask = ref(0);

    const zipName = 'raster tiles';
    let zipTool;
    zipTool = new JSZip();
    let rasterTile;
    const photoInput = ref(null)

    const chooseThread = async(index) => {
      selectThreading.value = index;
      // reset
      useTime.value = null;
      zipProgress.value = 0;
      allTask.value = 0;
      currentTask.value = 0;
      clipStatus.value = 0;
      uploadImgs.length = 0;
      if (photoInput.value) {
        photoInput.value.value = null;
      }
      if (selectThreading.value === 0) {
        // clear 单线程
        if (rasterTile) {
          await Thread.terminate(rasterTile);
          rasterTile.value = null;
        }
      } else {
        // clear 多线程
        if (MTCore) {
          for(let i = 0; i < MTCore.length; i++) {
            await Thread.terminate(MTCore[i]);
          }
          MTCore.length = 0;
        }
      }
    }
    const check = async() => {
      console.log(MTCore);
      const startTime = performance.now();
      const checkArr = [];
      for(let i = 0; i < MTCore.length; i++) {
        checkArr.push(checkCore(MTCore[i]));
      }

      await Promise.all(checkArr);
      console.log('all time:',(performance.now() - startTime).toFixed() + 'ms');
    }
    const checkCore = async(core) => {
      const debuggerInfo = await core.fibonacci(40);
      return new Promise((resolve) => {
        console.log(debuggerInfo);
        resolve();
      })
    }
    
    let workerPool;
    const initPool = async() => {
      workerPool = Pool(() => spawn(new Worker("./workers/rasterTile")), {
        concurrency: 100, // 同时运行任务数
        // size: 8 // 要产生的工作程序数量，默认为CPU内核数量
      });
      return new Promise((resolve) => {
        resolve();
      })
    }

    const usePool = async(file) => {
      const img = await blobToImg(file);
      const imgInfo = getImgInfo(img, file.name);
      const task = workerPool.queue(async(worker) => {
        worker.init();
        const offscreenCav = new OffscreenCanvas(256, 256);
        const imageBitmap = await createImageBitmap(img, 0, 0, imgInfo.imgWidth, imgInfo.imgHeight);
        await worker.offscreenClip(Transfer(offscreenCav), Transfer(imageBitmap), imgInfo);
        uploadImgs.push(img);
        currentTask.value++;
      });
      return task
    }


    let MTCore = [];

    const MTAddTiles = async(core, obj) => {
      await core.addTiles(obj);
    }
    const initWebWorker = async() => {
      rasterTile = await spawn(new Worker("./workers/rasterTile"));
      await rasterTile.init();
    }

    const addTiles = async(obj) => {
      await rasterTile.addTiles(obj);
    }

    // web work保存zip文件
    let zipProgress = ref(0);
    const getProgress = (threadCore) => {
      const timer = setInterval(async() => {
        zipProgress.value = await threadCore.getProgress();
        if (zipProgress.value === 100) {
          clearInterval(timer);
        }
      }, 200)
    }
    
    const getMTProgress = (threadCore) => {
      let threadCoreProgress = 0;
      const timer = setInterval(async() => {
        threadCoreProgress = await threadCore.getProgress();
        let totalProgress = 0;
        for (let k = 0; k < MTCore.length; k++) {
          totalProgress += threadCoreProgress;
          console.log(totalProgress)
        }
        zipProgress.value = totalProgress / MTCore.length;
        if (threadCoreProgress === 100) {
          clearInterval(timer);
        }
      }, 200)
    }

    let useTime = ref(null);

    const asyncCoreGenerate = async(core) => {
      const content = await core.generate();
      // core.debugger();
      await Thread.terminate(core);
      return new Promise((resolve) => {
        console.log(content);
        // allBlob.push(content.arrayBuffer());
        zipTool.file(`${Math.random()*100}.zip`, content, {binary: true});
        resolve()
      })
    }
    // const allBlob = [];
    const generateMTTiles = async() => {
      const start = performance.now();
      zipProgress.value = 0;
      useTime.value = null;
      let MTCoreArr = [];
      for(let i = 0; i < MTCore.length; i++) {
        // getMTProgress(MTCore[i]);
        MTCoreArr.push(asyncCoreGenerate(MTCore[i]));
      }

      await Promise.all(MTCoreArr);

      await saveZip();
      // console.log(allBlob);
      // const allFile = new Blob(allBlob, {type: "application/zip"});
      // saveAs(allFile, `${zipName}.zip`);
      // useTime.value = ((performance.now() - start) / 1000).toFixed(1);
      console.log(`共下载${allTask.value}个文件，共耗时：`, (performance.now() - start).toFixed() + 'ms');
    }
    const saveZip = () => {
      return new Promise((resolve) => {
        zipTool.generateAsync({type:"blob"}).then(function(content) {
          saveAs(content, `${zipName}.zip`);
          resolve();
        });
      })
    }
    const poolGenerate = async() => {
      const start = performance.now();
      workerPool.queue(async(worker) => {
        console.log(worker.debugger());
        const content = await worker.generate();
        saveAs(content, `${zipName}.zip`);
      });
      await workerPool.completed();
      await workerPool.terminate();
      console.log(`共下载${allTask.value}个文件，共耗时：`, (performance.now() - start).toFixed() + 'ms');
    }
    
    const changeUploadFile = async (e) => {
      if (workerPool) {
        await workerPool.terminate(true);
        // 强制清除线程
      }
      MTCore = [];
      if (useTime.value) {
        useTime.value = null;
      }
      const file = e.target.files || e.dataTransfer.files;
      if (!file.length) {
        return
      }
      uploadImgs.length = 0;
      allTask.value = file.length;
      currentTask.value = 0;

      if (selectThreading.value === 3) {
        // 3 多线程切割
        MTClip(file); 
      } else if (selectThreading.value === 2) {
        // 2 线程池切割
        poolClip(file); 
      } else if (selectThreading.value === 1) {
        // 1 web worker保存+浏览器单线程切割
        STClip(file); 
      } else if (selectThreading.value === 0) {
        // 0 全部单线程
        await initWebWorker();
        const startTime = performance.now();
        for (let i = 0; i < file.length; i++) {
          const img = await blobToImg(file[i]);
          const imgInfo = getImgInfo(img, file[i].name);
          uploadImgs.push(img);
          await createTiles(null, zipTool, img, imgInfo);
          currentTask.value++;
        }
        console.log(`单线程,切割了${allTask.value}个文件，共耗时：`, (performance.now() - startTime).toFixed() + 'ms');
      }
    }
    const poolClip = async(file) => {
      //pool线程切割
      await initPool();
      const startTime = performance.now();
      let poolCore = [];
      for (let i = 0; i < file.length; i++) {
        poolCore.push(usePool(file[i]));
      }
      await Promise.all(poolCore);
      console.log(`${allTask.value}个文件，共耗时：`, (performance.now() - startTime).toFixed() + 'ms');
    }

    const STClip = async(file) => {
      let startTime = performance.now();
      const asyncSTCore = [];
      for (let i = 0; i < file.length; i++) {
        asyncSTCore.push(initST({
          cores: MTCore,
          worker: await spawn(new Worker('./workers/rasterTile'))
        }));
      }
      await Promise.all(asyncSTCore);
      for (let i = 0; i < file.length; i++) {
        const img = await blobToImg(file[i]);
        const imgInfo = getImgInfo(img, file[i].name);
        uploadImgs.push(img);
        await createTiles(MTCore[i], zipTool, img, imgInfo); 
        // 单线程切割
        currentTask.value++;
      }
      console.log(`${allTask.value}个文件，共耗时：`, (performance.now() - startTime).toFixed() + 'ms');
    }

    const MTClip = async(file) => {
      let startTime = performance.now();
      const asyncMTCore = [];
      for (let i = 0; i < file.length; i++) {
        const img = await blobToImg(file[i]);
        asyncMTCore.push(initMT({
          img: img,
          fileName: file[i].name, 
          cores: MTCore, 
          worker: await spawn(new Worker('./workers/rasterTile')),
        }, () => {
          currentTask.value++;
          uploadImgs.push(img);
        }));
      }
      await Promise.all(asyncMTCore);

      console.log(`${allTask.value}个文件，共耗时：`, (performance.now() - startTime).toFixed() + 'ms');
    }

    /**
     * @param {String} name
     * @param {object} img
     * @param {Number} imgWidth
     * @param {Number} imgHeight
     * @param {Number} referValue 切片宽高默认值256
     * @param {Number} widthRatio imgWidth / referValue
     * @param {Number} heightRatio imgHeight / referValue
     */
    const createTiles = async(core, zipTool, img, {name, imgWidth, imgHeight, referValue, widthRatio, heightRatio}) => {
      const referCav = document.createElement('canvas');
      referCav.width = 256;
      referCav.height = 256;
      const referCtx = referCav.getContext('2d');
      // 初始化切片用canvas，避免重复生成
      let count = getCount(widthRatio, heightRatio);
      // 单个图片切片层数
      let totalClip = 0;
      // 计算所有切片总数
      for (let c = 0; c <= count; c++) {
        for (let i = 0; i < widthRatio / Math.pow(2, c); i++) {
          for (let k = 0; k < heightRatio / Math.pow(2, c); k++) {
            totalClip++;
          }
        }
      }
      let currentClip = 0; // 当前切片
      for (let c = 0; c <= count; c++) {
        for (let i = 0; i < widthRatio / Math.pow(2, c); i++) {
          for (let k = 0; k < heightRatio / Math.pow(2, c); k++) {
            currentClip++;
            referCtx.drawImage(img, -i * referValue, -k * referValue, imgWidth / Math.pow(2, c), imgHeight / Math.pow(2, c));
            let tilesBlob = await canvasToBlob(referCav);
            if (core != null) {
              MTAddTiles(core, {
                name, 
                count, 
                countIndex: c, 
                folderIndex: i, 
                fileIndex: k, 
                tilesBlob
              });
            } else {
              addTiles({name, count, c, i, k, tilesBlob});
              zipTool.folder(`${name}`).folder(`${count - c}`).folder(`${i}`).file(`${k}.png`, tilesBlob, {binary: true});
            }
            referCtx.clearRect(0, 0, referValue, referValue);
            clipStatus.value = Math.floor(currentClip * 100 / totalClip);
          }
        }
      }
    }

    const downloadImgsZip = () => {
      useTime.value = null;
      const start = performance.now();
      zipTool.generateAsync({type:"blob"}, function updateCallback(metadata) {
        zipProgress.value = metadata.percent;
        let performanceTime = performance.now() - start;
        useTime.value = (performanceTime / 1000).toFixed(1);
      }).then(function(content) {
        saveAs(content, `${zipName}.zip`);
      });
    }
    return {
      selectThreading,
      photoInput,
      chooseThread,
      // isMT,
      changeUploadFile,
      downloadImgsZip,
      clipStatus,
      uploadImgs,
      allTask,
      currentTask,
      zipProgress,
      useTime,
      generateMTTiles,
      poolGenerate,
      check
    }
  }
}
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
.img_input{
  width: 200px;
  height: 200px;
  border: 1px solid #ddd;
  margin: 0 auto;
  position: relative;
  .img_input_bg{
    width: 50px;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
}
.control_input{
  cursor: pointer;
  width: 100%;
  height: 100%;
  opacity: 0;
}
.upload_imgs{
  width: 720px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  img{
    display: block;
    width: 200px;
    margin: 20px 20px;
  }
}
.progress_bar{
  width: 500px;
  margin: 0 auto;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 12px;
  overflow: hidden;
  .progress_line{
    height: 100%;
    background: url(./assets/progress_line.jpg);
    background-size: auto 100%;
    border-radius: 20px;
    width: 0;
  }
}
.select_threading{
  width: 800px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-around;
  cursor: pointer;
  .select_btn{
    padding: 4px 10px;
    border-radius: 15px;
    transition: all .5s ease-in-out;
  }
  .btn_selected{
    background-color: #1eaf6d;
    color: #fff;
  }
}
.mt_choose{
  width: 60px;
  height: 24px;
  margin: 0 auto;
  border: 1px solid #ddd;
  border-radius: 12px;
  cursor: pointer;
  .mt_btn{
    width: 24px;
    height: 24px;
    border-radius: 15px;
    background-color: skyblue;
    transition: all .5s ease-in-out;
  }
  .is_mt{
    transform: translateX(36px);
    background-color: #1eaf6d;
  }
}
</style>
