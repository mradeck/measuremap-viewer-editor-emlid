export type PixelProjection=(x:number,y:number)=>[number,number];
/** Adaptively interpolate smooth map projections, with subpixel error checks.
 * Coordinates address pixel centres. Exact evaluation remains the fallback. */
export function warpGrid(size:number,project:PixelProjection,tolerance=.1):Float64Array {
  const xy=new Float64Array(size*size*2),nodes=new Map<string,[number,number]>();
  const at=(x:number,y:number)=>{const key=`${x},${y}`;let p=nodes.get(key);if(!p){p=project(x,y);nodes.set(key,p);}return p;};
  function cell(x0:number,y0:number,x1:number,y1:number){
    const a=at(x0,y0),b=at(x1,y0),c=at(x0,y1),d=at(x1,y1);
    const interpolate=(x:number,y:number):[number,number]=>{
      const u=x1===x0?0:(x-x0)/(x1-x0),v=y1===y0?0:(y-y0)/(y1-y0);
      return [0,1].map(k=>(a[k]*(1-u)+b[k]*u)*(1-v)+(c[k]*(1-u)+d[k]*u)*v) as [number,number];
    };
    const mx=(x0+x1)/2,my=(y0+y1)/2;
    const accurate=[[mx,my],[mx,y0],[mx,y1],[x0,my],[x1,my]].every(([x,y])=>{
      const exact=at(x,y),approx=interpolate(x,y);return Math.hypot(exact[0]-approx[0],exact[1]-approx[1])<=tolerance;
    });
    if(!accurate&&(x1-x0>1||y1-y0>1)){
      const sx=Math.floor(mx),sy=Math.floor(my);
      const xs=x1-x0>1?[[x0,sx],[sx+1,x1]]:[[x0,x1]],ys=y1-y0>1?[[y0,sy],[sy+1,y1]]:[[y0,y1]];
      for(const [l,r] of xs)for(const [t,bottom] of ys)cell(l,t,r,bottom);return;
    }
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=(y*size+x)*2;
      if(!accurate){const p=at(x,y);xy[i]=p[0];xy[i+1]=p[1];continue;}
      const u=x1===x0?0:(x-x0)/(x1-x0),v=y1===y0?0:(y-y0)/(y1-y0);
      xy[i]=(a[0]*(1-u)+b[0]*u)*(1-v)+(c[0]*(1-u)+d[0]*u)*v;
      xy[i+1]=(a[1]*(1-u)+b[1]*u)*(1-v)+(c[1]*(1-u)+d[1]*u)*v;
    }
  }
  for(let y=0;y<size;y+=32)for(let x=0;x<size;x+=32)cell(x,y,Math.min(x+31,size-1),Math.min(y+31,size-1));
  return xy;
}
