import { expose } from "threads/worker"
self.importScripts('https://yk-static.oss-cn-shanghai.aliyuncs.com/lib/jszip.js')

let JSZip;
let progress = 0;
let offscreenTile = null; // 小切片用
let offscreenTileCtx = null;
const referValue = 256;
// let performanceTime = null;

const rasterTile = {
  init() {
    if (JSZip) {
      JSZip = null;
    }
    JSZip = new self.JSZip();
  },
  addTiles({name, count, countIndex, folderIndex, fileIndex, tilesBlob}) {
    JSZip.folder(`${name}`).folder(`${count - countIndex}`).folder(`${folderIndex}`).file(`${fileIndex}.png`,
    tilesBlob,
    {binary: true});
  },
  getCount(a, b) {
    return a >= b ? Math.ceil(Math.log2(a)) : Math.ceil(Math.log2(b));
  },
  offscreenClip(offscreen, imageBitmap, {name, imgWidth, imgHeight, widthRatio, heightRatio}) {
    offscreenTile = offscreen;
    offscreenTileCtx = offscreenTile.getContext('2d');
    const count = rasterTile.getCount(widthRatio, heightRatio);
    // let currentClip = 0;
    for (let index = 0; index <= count; index++) {
      for (let i = 0; i < widthRatio / Math.pow(2, index); i++) {
        for (let k = 0; k < heightRatio / Math.pow(2, index); k++) {
          // currentClip++;
          offscreenTileCtx.drawImage(imageBitmap, -i * referValue, -k * referValue, imgWidth / Math.pow(2, index), imgHeight / Math.pow(2, index));
          offscreenTile.convertToBlob()
          .then(function(blob) {
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
      JSZip.generateAsync({type: 'blob'}, function updateCallback(metadata) {
        progress = metadata.percent;
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