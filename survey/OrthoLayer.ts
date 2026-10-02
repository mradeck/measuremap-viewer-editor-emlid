import L from 'leaflet';
import {worldToPixel,type Ortho} from './ortho';
/** Reproject each map pixel into the raster, including rotated affine transforms. */
export default class OrthoLayer extends L.GridLayer {
  constructor(private ortho:Ortho,opacity:number){super({opacity,zIndex:250,tileSize:256,maxZoom:26,bounds:L.latLngBounds(ortho.bounds),keepBuffer:1,updateWhenIdle:true});}
  createTile(coords:L.Coords):HTMLElement {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d')!,image=ctx.createImageData(256,256),o=this.ortho;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const ll=this._map.unproject(L.point(coords.x*256+x+.5,coords.y*256+y+.5),coords.z);
      const [wx,wy]=o.projection.inverse([ll.lng,ll.lat]),[px,py]=worldToPixel(o.affine,wx,wy);
      if(px<0||py<0||px>=o.width||py>=o.height)continue;
      const src=(Math.min(o.previewHeight-1,Math.floor(py/o.height*o.previewHeight))*o.previewWidth+Math.min(o.previewWidth-1,Math.floor(px/o.width*o.previewWidth)))*4,dst=(y*256+x)*4;
      image.data[dst]=o.pixels[src];image.data[dst+1]=o.pixels[src+1];image.data[dst+2]=o.pixels[src+2];image.data[dst+3]=o.pixels[src+3];
    }
    ctx.putImageData(image,0,0);return canvas;
  }
}
