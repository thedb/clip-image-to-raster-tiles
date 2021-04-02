import { expose } from "threads/worker"
self.importScripts('https://yk-static.oss-cn-shanghai.aliyuncs.com/lib/jszip.js')

let JSZip;
let progress = 0;
let offscreenTile = null; // 小切片用
let offscreenTileCtx = null;
// let performanceTime = null;
/**
 * @param {Number} a 
 * @param {Number} b 
 * 计算需要切片多少次
 */

const rasterTile = {
  init() {
    if (JSZip) {
      JSZip = null;
    }
    JSZip = new self.JSZip();
  },
  addTiles({name, count, countIndex, folderIndex, fileIndex, tilesBlob}) {
    JSZip.folder(`${name}`).folder(`${count - countIndex}`).folder(`${folderIndex}`).file(`${fileIndex}.png`, tilesBlob, {binary: true});
  },
  offscreenInit(offscreen, widthRatio, heightRatio, count) {
    offscreenTile = offscreen;
    offscreenTileCtx = offscreenTile.getContext('2d');
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
    console.log(totalClip);
    return
  },
  offscreenClip(imageBitmap, {name, imgWidth, imgHeight, referValue, widthRatio, heightRatio}, count) {
    // let currentClip = 0;
    for (let index = 0; index <= count; index++) {
      for (let i = 0; i < widthRatio / Math.pow(2, index); i++) {
        for (let k = 0; k < heightRatio / Math.pow(2, index); k++) {
          // currentClip++;
          offscreenTileCtx.drawImage(imageBitmap, -i * referValue, -k * referValue, imgWidth / Math.pow(2, index), imgHeight / Math.pow(2, index));
          // referCtx.drawImage(tilesCav, -i * referValue, -k * referValue);
          offscreenTile.convertToBlob()
          .then(function(blob) {
            // console.log('tilesBlob', blob)
            rasterTile.addTiles({
              name, 
              count, 
              countIndex: index, 
              folderIndex: i, 
              fileIndex: k, 
              tilesBlob: blob
            });
          });
          offscreenTileCtx.clearRect(0, 0, referValue, referValue);
        }
      }
    }
    // console.log(currentClip)
  },
  generate() {
    return new Promise((resolve) => {
      progress = 0;
      // const start = performance.now();
      JSZip.generateAsync({type:"blob"}, function updateCallback(metadata) {
        progress = metadata.percent;
        // performanceTime = performance.now() - start;
      }).then(function(content) {
        resolve(content)
      });
    })
  },
  getProgress() {
    return Math.floor(progress)
  },
  remove() {
    JSZip = null;
  }
}

expose(rasterTile)