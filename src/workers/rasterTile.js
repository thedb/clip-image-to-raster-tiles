import { expose } from "threads/worker"
self.importScripts('https://yk-static.oss-cn-shanghai.aliyuncs.com/lib/jszip.js')

let JSZip;

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
      const start = performance.now();
      JSZip.generateAsync({type:"blob"}, function updateCallback() {
        // console.log(`${metadata.percent}%`)
        console.log('time', performance.now() - start);
      }).then(function(content) {
        resolve(content)
      });

    })
  },
  remove() {
    JSZip = null;
  }
}

expose(rasterTile)