import { 
  Transfer,
} from "threads"

/**
 * @param {Number} a 
 * @param {Number} b 
 * 计算需要切片多少次
 */
export function getCount(a, b){
  return a >= b ? Math.ceil(Math.log2(a)) : Math.ceil(Math.log2(b));
}

/**
 * @param {object} img blob转换的img对象
 * @param {string} name blob转换img会丢失文件原本的名字，压缩文件需要区分各个文件名，所以在input的时候要带上
 */
export function getImgInfo(img, name){
  const referValue = 256;
  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;
  const widthRatio = Math.ceil(imgWidth / referValue);
  const heightRatio = Math.ceil(imgHeight / referValue);
  return {
    name,
    referValue,
    imgWidth,
    imgHeight,
    widthRatio,
    heightRatio
  }
}


export async function initMT({img, fileName, cores, worker}, callback) {
  const imgInfo = getImgInfo(img, fileName);
  const rasterTile = worker;
  await rasterTile.init();
  cores.push(rasterTile);
  await asyncOffscreenCreateTiles({core: rasterTile, img, imgInfo}); 
  if (callback) {
    callback();
  }
  return new Promise((resolve) => {
    resolve()
  })
}

export async function initST({cores, worker}, callback) {
  const rasterTile = worker;
  await rasterTile.init();
  cores.push(rasterTile);
  if (callback) {
    callback();
  }
}
/**
 * @param {Number} core 当前核心
 * @param {object} img 切片图片
 * @param {object} imgInfo 图片基本信息
 */
export async function asyncOffscreenCreateTiles({core, img, imgInfo}){
  const offscreenCav = new OffscreenCanvas(256, 256);
  const imageBitmap = await createImageBitmap(img, 0, 0, imgInfo.imgWidth, imgInfo.imgHeight);
  await core.offscreenClip(Transfer(offscreenCav), Transfer(imageBitmap), imgInfo);
  return new Promise((resolve) => {
    resolve()
  })
}