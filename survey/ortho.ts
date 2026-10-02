import proj4 from 'proj4';
import {translate as t} from '../ui/translations';
import type {GeoTIFFImage,Pool} from 'geotiff';
import {cachedRasterReader} from './ortho-cache';
let decoderPool:Promise<Pool>|undefined;
async function getDecoderPool(){if(typeof Worker==='undefined')return undefined;return decoderPool??=import('geotiff').then(({Pool})=>new Pool(2));}
export type Affine=[number,number,number,number,number,number];
export interface Ortho {name:string;crs:string;width:number;height:number;previewWidth:number;previewHeight:number;pixels:Uint8ClampedArray;affine:Affine;bounds:[number,number][];projection:proj4.Converter;readWindow:(window:RasterWindow,signal?:AbortSignal)=>Promise<RasterPixels>}
export type RasterWindow=[number,number,number,number];
export interface RasterPixels {width:number;height:number;pixels:Uint8ClampedArray}
export function pixelToWorld(a:Affine,x:number,y:number):[number,number]{return [a[0]*x+a[1]*y+a[2],a[3]*x+a[4]*y+a[5]];}
export function worldToPixel(a:Affine,x:number,y:number):[number,number]{const det=a[0]*a[4]-a[1]*a[3];if(!Number.isFinite(det)||Math.abs(det)<1e-20)throw new Error(t('GeoTIFF: ungültige Georeferenzierung.'));return [(a[4]*(x-a[2])-a[1]*(y-a[5]))/det,(-a[3]*(x-a[2])+a[0]*(y-a[5]))/det];}
export function rasterCrs(keys:Record<string,any>):string {
  const projected=Number(keys.ProjectedCSTypeGeoKey),geographic=Number(keys.GeographicTypeGeoKey);
  const code=projected&&projected!==32767?projected:keys.GTModelTypeGeoKey===2?geographic:0;
  if(code>=32601&&code<=32660||code>=32701&&code<=32760||code>=25828&&code<=25838){
    const zone=code%100;proj4.defs(`EPSG:${code}`,`+proj=utm +zone=${zone} ${code>=32701&&code<=32760?'+south ':''}+ellps=${code>=25828&&code<=25838?'GRS80':'WGS84'} +units=m +no_defs`);
  }
  const crs=`EPSG:${code}`;
  if(!code||!proj4.defs(crs))throw new Error(t('GeoTIFF: fehlendes oder nicht unterstütztes CRS ({crs}). Bitte als ETRS89/UTM, WGS84/UTM, EPSG:4326 oder EPSG:3857 exportieren.',{crs:code||'—'}));
  return crs;
}
export function imageAffine(image:GeoTIFFImage):Affine {
  const dir=image.getFileDirectory(),matrix=dir.getValue('ModelTransformation');let a:Affine;
  if(matrix){a=[matrix[0],matrix[1],matrix[3],matrix[4],matrix[5],matrix[7]];}
  else {const scales=dir.getValue('ModelPixelScale'),ties=dir.getValue('ModelTiepoint');if(!scales||!ties||ties.length<6)throw new Error(t('GeoTIFF: keine eingebettete Georeferenzierung.'));a=[scales[0],0,ties[3]-ties[0]*scales[0],0,-scales[1],ties[4]+ties[1]*scales[1]];}
  worldToPixel(a,a[2],a[5]);
  if(image.getGeoKeys()?.GTRasterTypeGeoKey===2){a[2]-=.5*(a[0]+a[1]);a[5]-=.5*(a[3]+a[4]);}
  return a;
}
export async function readOrtho(file:File):Promise<Ortho> {
  const {fromBlob}=await import('geotiff');const tiff=await fromBlob(file);const image=await tiff.getImage();
  return decodeOrtho(image,file.name);
}
export async function decodeOrtho(image:GeoTIFFImage,name:string):Promise<Ortho> {
  const pool=await getDecoderPool();
  const crs=rasterCrs(image.getGeoKeys()||{}),affine=imageAffine(image),width=image.getWidth(),height=image.getHeight();
  if(!width||!height)throw new Error(t('GeoTIFF: leeres Raster.'));
  const projection=proj4(crs,'EPSG:4326');
  const bounds:[number,number][]=[];
  // Densify all four edges: projected outlines can curve in Web Mercator.
  for(let i=0;i<=32;i++)for(const [x,y] of [[width*i/32,0],[width*i/32,height],[0,height*i/32],[width,height*i/32]]){
    const [lon,lat]=projection.forward(pixelToWorld(affine,x,y));if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85.05113||Math.abs(lon)>180)throw new Error(t('GeoTIFF: Position außerhalb der unterstützten Karte.'));bounds.push([lat,lon]);
  }
  const scale=Math.min(1,4096/Math.max(width,height)),previewWidth=Math.max(1,Math.round(width*scale)),previewHeight=Math.max(1,Math.round(height*scale));
  const pixels=new Uint8ClampedArray(previewWidth*previewHeight*4);
  validateColorFormat(image);
  // Read bounded horizontal windows rather than allocating the entire native raster.
  const rows=Math.max(1,Math.min(64,Math.floor(4_000_000/width*previewHeight/height)));
  for(let y=0;y<previewHeight;y+=rows){
    const n=Math.min(rows,previewHeight-y),top=Math.floor(y*height/previewHeight),bottom=Math.ceil((y+n)*height/previewHeight);
    const window:[number,number,number,number]=[0,top,width,bottom];
    const raster=await readRasterWindow(image,window,previewWidth,n,undefined,pool);
    pixels.set(raster.pixels,y*previewWidth*4);
    await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  return {name,crs,width,height,previewWidth,previewHeight,pixels,affine,bounds,projection,readWindow:cachedRasterReader(width,height,window=>readRasterWindow(image,window,undefined,undefined,undefined,pool))};
}

function validateColorFormat(image:GeoTIFFImage){
  const dir=image.getFileDirectory(),bits=dir.getValue('BitsPerSample')||[8],pi=dir.getValue('PhotometricInterpretation');
  if(pi===2&&(image.getSamplesPerPixel()>4||bits.some(b=>b!==8&&b!==16)))throw new Error(t('GeoTIFF: unterstützt werden RGB/RGBA mit 8 oder 16 Bit, Graustufen und Farbindizes.'));
}
export async function readRasterWindow(image:GeoTIFFImage,window:RasterWindow,width=window[2]-window[0],height=window[3]-window[1],signal?:AbortSignal,pool?:Pool):Promise<RasterPixels>{
  const dir=image.getFileDirectory(),bits=dir.getValue('BitsPerSample')||[8],pi=dir.getValue('PhotometricInterpretation'),extra=dir.getValue('ExtraSamples'),nodata=image.getGDALNoData();
  const options={window,width,height,interleave:true as const,resampleMethod:'nearest',signal,pool};
  const rgb=await image.readRGB({...options,enableAlpha:true}),channels=rgb.length/(width*height);
  const mask=nodata!==null&&pi!==2?await image.readRasters({...options,samples:[0]}):null;
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let k=0;k<width*height;k++){
    const dst=k*4,src=k*channels;
    const empty=nodata!==null&&(mask?Number(mask[k])===nodata||Number.isNaN(nodata)&&Number.isNaN(Number(mask[k])):[0,1,2].every(c=>Number(rgb[src+c])===nodata));
    const alpha=channels===4?Number(rgb[src+3])/(2**(bits[3]||8)-1):1;
    for(let c=0;c<3;c++){const value=Number(rgb[src+c])*(pi===2?255/(2**(bits[c]||bits[0])-1):1);pixels[dst+c]=extra?.[0]===1&&alpha>0?value/alpha:value;}
    pixels[dst+3]=empty?0:alpha*255;
  }
  return {pixels,width,height};
}
