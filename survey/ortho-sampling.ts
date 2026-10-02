import type {RasterPixels} from './ortho';
/** Interpolate premultiplied colors to avoid dark halos around transparent pixels. */
export function sampleRaster(r:RasterPixels,x:number,y:number,out:Uint8ClampedArray,dst:number){
  x=Math.max(0,Math.min(r.width-1,x));y=Math.max(0,Math.min(r.height-1,y));
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,r.width-1),y1=Math.min(y0+1,r.height-1),fx=x-x0,fy=y-y0;
  const i0=(y0*r.width+x0)*4,i1=(y0*r.width+x1)*4,i2=(y1*r.width+x0)*4,i3=(y1*r.width+x1)*4;
  const p=r.pixels,w0=(1-fx)*(1-fy)*p[i0+3],w1=fx*(1-fy)*p[i1+3],w2=(1-fx)*fy*p[i2+3],w3=fx*fy*p[i3+3],alpha=w0+w1+w2+w3;
  if(alpha>0)for(let c=0;c<3;c++)out[dst+c]=(p[i0+c]*w0+p[i1+c]*w1+p[i2+c]*w2+p[i3+c]*w3)/alpha;
  out[dst+3]=alpha;
}
