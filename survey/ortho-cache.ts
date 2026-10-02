import type {RasterPixels,RasterWindow,Ortho} from './ortho';
/** Fixed source blocks let neighbouring map tiles and zoom levels share pixels.
 * Shared reads survive cancellation of one consumer; obsolete queued reads skip decoding. */
export function cachedRasterReader(width:number,height:number,decode:(window:RasterWindow)=>Promise<RasterPixels>,budget=32*1024*1024,blockSize=512):Ortho['readWindow'] {
  const cache=new Map<string,RasterPixels>(),pending=new Map<string,{promise:Promise<RasterPixels>;consumers:Set<AbortSignal|undefined>}>();
  let bytes=0,active=0;const queue:Array<()=>void>=[];
  const aborted=()=>new DOMException('Aborted','AbortError');
  async function block(x:number,y:number,signal?:AbortSignal){
    if(signal?.aborted)throw aborted();
    const key=`${x},${y}`,hit=cache.get(key);
    if(hit){cache.delete(key);cache.set(key,hit);return hit;}
    const shared=pending.get(key);if(shared){shared.consumers.add(signal);return shared.promise;}
    const consumers=new Set([signal]);
    const promise=(async()=>{
      if(active>=2)await new Promise<void>(resolve=>queue.push(resolve));else active++;
      try {
        if([...consumers].every(s=>s?.aborted))throw aborted();
        const pixels=await decode([x,y,Math.min(width,x+blockSize),Math.min(height,y+blockSize)]);
        cache.set(key,pixels);bytes+=pixels.pixels.byteLength;
        while(bytes>budget&&cache.size){const first=cache.keys().next().value!;bytes-=cache.get(first)!.pixels.byteLength;cache.delete(first);}
        return pixels;
      }finally{pending.delete(key);const next=queue.shift();if(next)next();else active--;}
    })();
    pending.set(key,{promise,consumers});return promise;
  }
  return async(window,signal)=>{
    if(signal?.aborted)throw aborted();
    const [left,top,right,bottom]=window,w=right-left,h=bottom-top;
    const result:RasterPixels={width:w,height:h,pixels:new Uint8ClampedArray(w*h*4)};
    for(let y=Math.floor(top/blockSize)*blockSize;y<bottom;y+=blockSize)for(let x=Math.floor(left/blockSize)*blockSize;x<right;x+=blockSize){
      const raster=await block(x,y,signal);if(signal?.aborted)throw aborted();
      const l=Math.max(left,x),r=Math.min(right,x+raster.width),t=Math.max(top,y),b=Math.min(bottom,y+raster.height);
      for(let row=t;row<b;row++)result.pixels.set(raster.pixels.subarray(((row-y)*raster.width+l-x)*4,((row-y)*raster.width+r-x)*4),((row-top)*w+l-left)*4);
    }
    return result;
  };
}
