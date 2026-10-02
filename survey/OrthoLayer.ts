import L from 'leaflet';
import {worldToPixel,type Ortho,type RasterWindow,type RasterPixels} from './ortho';
import {sampleRaster} from './ortho-sampling';
import {warpGrid} from './ortho-warp';
/** Overview at distant zooms; native GeoTIFF windows as soon as details matter. */
export default class OrthoLayer extends L.GridLayer {
  private requests=new Map<HTMLElement,AbortController>();
  constructor(private ortho:Ortho,opacity:number){
    super({opacity,zIndex:250,tileSize:256,maxZoom:26,bounds:L.latLngBounds(ortho.bounds),keepBuffer:1,updateWhenIdle:true});
    this.on('tileunload',e=>{this.requests.get(e.tile)?.abort();this.requests.delete(e.tile);});
    this.on('remove',()=>{for(const request of this.requests.values())request.abort();this.requests.clear();});
  }
  createTile(coords:L.Coords,done:L.DoneCallback):HTMLElement {
    const canvas=document.createElement('canvas'),ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    canvas.width=canvas.height=Math.round(256*ratio);
    const request=new AbortController();this.requests.set(canvas,request);
    // Defer completion so Leaflet has registered this asynchronous tile first.
    void Promise.resolve().then(()=>this.renderTile(canvas,coords,request.signal)).then(()=>done(undefined,canvas),error=>{if(!request.signal.aborted)done(error instanceof Error?error:new Error(String(error)),canvas);}).finally(()=>this.requests.delete(canvas));
    return canvas;
  }
  private async renderTile(canvas:HTMLCanvasElement,coords:L.Coords,signal:AbortSignal){
    if(signal.aborted||!this._map)return;
    const map=this._map,n=canvas.width,ratio=n/256,o=this.ortho;
    const xy=warpGrid(n,(x,y)=>{
      const ll=map.unproject(L.point(coords.x*256+(x+.5)/ratio,coords.y*256+(y+.5)/ratio),coords.z);
      const [wx,wy]=o.projection.inverse([ll.lng,ll.lat]);return worldToPixel(o.affine,wx,wy);
    });
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const i=(y*n+x)*2,px=xy[i],py=xy[i+1];
      if(px>=0&&py>=0&&px<o.width&&py<o.height){left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);}
    }
    if(!Number.isFinite(left))return;
    const window:RasterWindow=[Math.max(0,Math.floor(left)-1),Math.max(0,Math.floor(top)-1),Math.min(o.width,Math.ceil(right)+2),Math.min(o.height,Math.ceil(bottom)+2)];
    // <= 4 MiB RGBA per native window; broad views already have sufficient overview detail.
    const native=window[2]-window[0]<=1024&&window[3]-window[1]<=1024;
    canvas.dataset.orthoResolution=native?'native':'overview';
    const raster:RasterPixels=native?await o.readWindow(window,signal):{pixels:o.pixels,width:o.previewWidth,height:o.previewHeight};
    if(signal.aborted||!this._map)return;
    const ctx=canvas.getContext('2d')!,image=ctx.createImageData(n,n);
    let lastYield=performance.now();
    for(let k=0;k<n*n;k++){
      if(k%(n*8)===0&&performance.now()-lastYield>8){
        await new Promise<void>(resolve=>setTimeout(resolve,0));
        if(signal.aborted||!this._map)return;lastYield=performance.now();
      }
      const px=xy[k*2],py=xy[k*2+1];if(px<0||py<0||px>=o.width||py>=o.height)continue;
      const sx=native?px-window[0]-.5:px/o.width*o.previewWidth-.5,sy=native?py-window[1]-.5:py/o.height*o.previewHeight-.5;
      sampleRaster(raster,sx,sy,image.data,k*4);
    }
    ctx.putImageData(image,0,0);
  }
}
