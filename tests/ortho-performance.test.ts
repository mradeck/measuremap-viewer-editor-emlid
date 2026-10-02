import {test} from 'node:test';
import assert from 'node:assert/strict';
import proj4 from 'proj4';
import {warpGrid} from '../survey/ortho-warp';
import {cachedRasterReader} from '../survey/ortho-cache';
import {rasterCrs,worldToPixel,type Affine,type RasterWindow} from '../survey/ortho';

function projection(zoom:number,size:number,affine:Affine){
 const utm=proj4(rasterCrs({ProjectedCSTypeGeoKey:25832}),'EPSG:4326'),center=utm.forward([696900,5353800]);
 const scale=256*2**zoom,lonX=(center[0]+180)/360*scale,sin=Math.sin(center[1]*Math.PI/180),latY=(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale;
 return (x:number,y:number):[number,number]=>{
   const mx=lonX+(x-size/2)/2,my=latY+(y-size/2)/2;
   const lon=mx/scale*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*my/scale)))*180/Math.PI;
   return worldToPixel(affine,...utm.inverse([lon,lat]) as [number,number]);
 };
}
test('adaptive reprojection preserves subpixel position at distant and detailed zooms, including rotated TIFFs',()=>{
 for(const zoom of [10,18,24,26])for(const affine of [[.01,0,696900,0,-.01,5353800],[.01,.003,696900,.002,-.01,5353800]] as Affine[]){
   const size=128,exact=projection(zoom,size,affine);let calls=0;
   const xy=warpGrid(size,(x,y)=>{calls++;return exact(x,y);});
   let error=0;
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=exact(x,y),i=(y*size+x)*2;error=Math.max(error,Math.hypot(xy[i]-p[0],xy[i+1]-p[1]));}
   assert.ok(error<=.11,`zoom ${zoom}: ${error} source pixels`);
   if(zoom>=18)assert.ok(calls<300,`${calls} exact projections`);
 }
});
const raster=async([x,y,right,bottom]:RasterWindow)=>{
 const width=right-x,height=bottom-y,pixels=new Uint8ClampedArray(width*height*4);
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){const k=(row*width+col)*4;pixels[k]=(x+col)%256;pixels[k+1]=(y+row)%256;pixels[k+3]=255;}
 return {width,height,pixels};
};
test('overlapping windows and concurrent callers reuse decoded blocks and stitch source pixels at edges',async()=>{
 let reads=0;const reader=cachedRasterReader(1030,520,async w=>{reads++;return raster(w);});
 const [a,b]=await Promise.all([reader([500,500,530,520]),reader([510,505,1030,520])]);
 assert.equal(reads,6);assert.deepEqual([...a.pixels.slice(0,4)],[244,244,0,255]);
 assert.deepEqual([...a.pixels.slice(12*4,13*4)],[0,244,0,255]);assert.deepEqual([...b.pixels.slice(-4)],[5,7,0,255]);
 await reader([512,512,520,519]);assert.equal(reads,6);
});
test('cancellation of one consumer leaves another shared read intact; reads and cache memory are bounded',async()=>{
 let active=0,max=0,reads=0;const abort=new AbortController();
 const reader=cachedRasterReader(64,64,async w=>{reads++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return raster(w);},16*16*4,16);
 const cancelled=reader([0,0,4,4],abort.signal);const shared=reader([0,0,4,4]);abort.abort();
 await assert.rejects(cancelled,{name:'AbortError'});assert.equal((await shared).pixels[3],255);assert.equal(reads,1);
 await Promise.all([reader([16,0,20,4]),reader([32,0,36,4]),reader([48,0,52,4])]);assert.ok(max<=2);
 await reader([0,0,4,4]);assert.equal(reads,5,'evicted block must be read again');
});
test('obsolete queued blocks skip decoding and can be requested again',async()=>{
 let reads=0;const releases:Array<()=>void>=[];
 const reader=cachedRasterReader(64,16,async w=>{reads++;await new Promise<void>(r=>releases.push(r));return raster(w);},4096,16);
 const a=reader([0,0,4,4]),b=reader([16,0,20,4]),abort=new AbortController();
 const stale=reader([32,0,36,4],abort.signal);const rejected=assert.rejects(stale,{name:'AbortError'});abort.abort();
 releases.shift()!();await a;await rejected;assert.equal(reads,2);
 releases.shift()!();await b;
 const retry=reader([32,0,36,4]);assert.equal(reads,3);releases.shift()!();await retry;
});
