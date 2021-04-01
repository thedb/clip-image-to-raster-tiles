import { expose } from "threads/worker"
self.importScripts('https://yk-static.oss-cn-shanghai.aliyuncs.com/lib/jszip.js')

let JSZip;
let progress = 0;
// let performanceTime = null;

const rasterTile = {
  init() {
    if (JSZip) {
      JSZip = null;
    }
    JSZip = new self.JSZip();
  },
  addTiles({name, count, c, i, k, tilesBlob}) {
    JSZip.folder(`${name}`).folder(`${count - c}`).folder(`${i}`).file(`${k}.png`, tilesBlob, {binary: true});
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