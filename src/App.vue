<template>
  <section>create raster tiles</section>
  <section>
    <p>上传图片进行切片<br>(支持多选)</p>
    <br>
    <p>当前选择: {{isMT ? '多线程': '单线程'}}</p>
    <section class="mt_choose" @click="changeThread">
      <section class="mt_btn" :class="{is_mt: isMT}" ></section>
    </section>
    <br>
    <!-- <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view> -->
    <br>
    <section class="img_input">
      <img class="img_input_bg" src="./assets/plus.svg" alt="">
      <input id="photoInput" class="control_input" type="file" accept="image/*" v-on:change="changeUploadFile" multiple ref="photoInput">
      <!-- <input class="control_input" type="file" accept="image/*" v-on:change="changeUploadFile" multiple ref="photoInput"> -->
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
    <section v-show="!isMT &&currentTask === allTask && (zipProgress === 0 || zipProgress === 100) && allTask !== 0">
      <button @click="downloadImgsZip" >保存文件（单线程）</button>
      <br/>
      <br/>
      <button @click="generateTiles" >保存文件（web worker）</button>
      <br/>
      <br/>
    </section>
    <button v-show="isMT &&currentTask === allTask && (zipProgress === 0 || zipProgress === 100) && allTask !== 0" @click="generateMTTiles" >多线程保存文件</button>
    <section class="progress_bar" v-if="zipProgress !== 0 && zipProgress !== 100">
      <section :style="{width: `${zipProgress}%`}" class="progress_line" ></section>
    </section>
    <p v-if="useTime">文件压缩总用时：{{useTime}}秒</p>
    <br/>
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
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  ref,
  reactive
} from 'vue'

import { 
  spawn, 
  Thread, 
  Worker 
} from "threads"

export default {
  name: 'App',
  setup() {
    // MT === MultiThreading;
    let isMT = ref(false);
    let clipStatus = ref(0);
    let uploadImgs = reactive([]);
    let allTask = ref(null);
    let currentTask = ref(0);

    const zipName = 'raster tiles';
    let zip;
    zip = new JSZip();
    let rasterTile;
    const photoInput = ref(null)

    const changeThread = async() => {
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
      if (isMT.value) {
        if (rasterTile) {
          // clear 单线程
          await Thread.terminate(rasterTile);
          rasterTile.value = null;
        }
      } else {
        if (MTCore) {
          // clear 多线程
          for(let i = 0; i < MTCore.length; i++) {
            await Thread.terminate(MTCore[i]);
          }
          MTCore.length = 0;
        }
      }
      isMT.value = !isMT.value;
    }

    let MTCore = [];
    const initMT = async() => {
      const rasterTile = await spawn(new Worker("./workers/rasterTile"));
      await rasterTile.init();
      MTCore.push(rasterTile);
    }

    const MTAddTiles = async(i, obj) => {
      await MTCore[i].addTiles(obj);
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
    const generateTiles = async() => {
      const start = performance.now();
      zipProgress.value = 0;
      useTime.value = null;
      getProgress(rasterTile);
      const content = await rasterTile.generate();
      saveAs(content, `${zipName}.zip`);
      useTime.value = ((performance.now() - start) / 1000).toFixed(1);
    }

    const asyncCore = async(core) => {
      const content = await core.generate();
      return new Promise((resolve) => {
        saveAs(content, `${zipName}.zip`);
        resolve('success')
      })
    }

    const generateMTTiles = async() => {
      const start = performance.now();
      zipProgress.value = 0;
      useTime.value = null;
      let MTCoreArr = [];
      for(let i = 0; i < MTCore.length; i++) {
        getMTProgress(MTCore[i]);
        MTCoreArr.push(asyncCore(MTCore[i]));
      }

      await Promise.all(MTCoreArr);
      useTime.value = ((performance.now() - start) / 1000).toFixed(1);
    }
    
    const changeUploadFile = async (e) => {
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

      if (isMT.value) {
        for (let i = 0; i < file.length; i++) {
          initMT();
        }
        setTimeout(async() => {
          // init 延迟
          for (let i = 0; i < file.length; i++) {
            const img = await blobToImg(file[i]);
            const imgInfo = getImgInfo(img, file[i].name);
            uploadImgs.push(img);
            await createTiles(i, imgInfo);
            currentTask.value++;
          }
        }, 200)
      } else {
        // 单线程
        initWebWorker();
        setTimeout(async() => {
          for (let i = 0; i < file.length; i++) {
            const img = await blobToImg(file[i]);
            const imgInfo = getImgInfo(img, file[i].name);
            uploadImgs.push(img);
            await createTiles(null, imgInfo);
            currentTask.value++;
          }
        }, 200)
      }
    }

    /**
     * @param {object} img blob转换的img对象
     * @param {string} name blob转换img会丢失文件原本的名字，压缩文件需要区分各个文件名，所以在input的时候要带上
     */
    const getImgInfo = (img, name) => {
      const referValue = 256;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const widthRatio = Math.ceil(imgWidth / referValue);
      const heightRatio = Math.ceil(imgHeight / referValue);
      return {
        name,
        img,
        referValue,
        imgWidth,
        imgHeight,
        widthRatio,
        heightRatio
      }
    }

    /**
     * @param {Number} a 
     * @param {Number} b 
     * 计算需要切片多少次
     */
    const getCount = (a, b) => {
      return a >= b ? Math.ceil(Math.log2(a)) : Math.ceil(Math.log2(b));
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

    const createTiles = async(core, {name, img, imgWidth, imgHeight, referValue, widthRatio, heightRatio}) => {
      let count = getCount(widthRatio, heightRatio);
      let totalClip = 0;
      for (let c = 0; c <= count; c++) {
        for (let i = 0; i < widthRatio / Math.pow(2, c); i++) {
          for (let k = 0; k < heightRatio / Math.pow(2, c); k++) {
            totalClip++;
          }
        }
      }
      let currentClip = 0;
      for (let c = 0; c <= count; c++) {
        let tilesCav = document.createElement('canvas');
        tilesCav.width = widthRatio * referValue / Math.pow(2, c);
        tilesCav.height = heightRatio * referValue / Math.pow(2, c);
        const tilesCtx = tilesCav.getContext('2d');
        tilesCtx.drawImage(img, 0, 0, imgWidth / Math.pow(2, c), imgHeight / Math.pow(2, c));
        const referCav = document.createElement('canvas');
        referCav.width = 256;
        referCav.height = 256;
        const referCtx = referCav.getContext('2d');

        for (let i = 0; i < widthRatio / Math.pow(2, c); i++) {
          for (let k = 0; k < heightRatio / Math.pow(2, c); k++) {
            currentClip++;
            referCtx.drawImage(tilesCav, -i * referValue, -k * referValue);
            let tilesBlob = await canvasToBlob(referCav);
            if (core != null) {
              MTAddTiles(core, {name, count, c, i, k, tilesBlob});
            } else {
              addTiles({name, count, c, i, k, tilesBlob});
              zip.folder(`${name}`).folder(`${count - c}`).folder(`${i}`).file(`${k}.png`, tilesBlob, {binary: true});
            }
            referCtx.clearRect(0, 0, referValue, referValue);
            clipStatus.value = Math.floor(currentClip * 100 / totalClip);
          }
        }
        tilesCav = null;
      }
    }

    const downloadImgsZip = () => {
      useTime.value = null;
      const start = performance.now();
      zip.generateAsync({type:"blob"}, function updateCallback(metadata) {
        // console.log(`${metadata.percent}%`)
        zipProgress.value = metadata.percent;
        let performanceTime = performance.now() - start;
        useTime.value = (performanceTime / 1000).toFixed(1);
      }).then(function(content) {
        saveAs(content, `${zipName}.zip`);
      });
    }
    return {
      photoInput,
      changeThread,
      isMT,
      changeUploadFile,
      downloadImgsZip,
      generateTiles,
      clipStatus,
      uploadImgs,
      allTask,
      currentTask,
      zipProgress,
      useTime,
      generateMTTiles,
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
