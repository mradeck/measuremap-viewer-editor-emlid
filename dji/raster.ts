import Clipper from 'clipper-lib';
import type {Coordinate} from './mission';
export type XY={x:number;y:number};
export interface RasterPlan {points:Coordinate[];legs:[number,number][];distance:number;area:number;}
const EPS=1e-7,SCALE=1000;
const cross=(a:XY,b:XY,c:XY)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const length=(a:XY,b:XY)=>Math.hypot(b.x-a.x,b.y-a.y);
const signedArea=(r:XY[])=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a.x*b.y-b.x*a.y;},0)/2;
function onEdge(p:XY,a:XY,b:XY){return Math.abs(cross(a,b,p))<EPS*Math.max(1,length(a,b))&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
export function inside(p:XY,rings:XY[][]){let yes=false;for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[j],b=r[i];if(onEdge(p,a,b))return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
export function segmentInside(a:XY,b:XY,rings:XY[][]){
 const cuts=[0,1],dx=b.x-a.x,dy=b.y-a.y;
 for(const r of rings)for(let i=0;i<r.length;i++){const c=r[i],d=r[(i+1)%r.length],ex=d.x-c.x,ey=d.y-c.y,det=dx*ey-dy*ex;if(Math.abs(det)<EPS)continue;const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/det,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/det;if(t>0&&t<1&&u>=-EPS&&u<=1+EPS)cuts.push(t);}
 cuts.sort((x,y)=>x-y);for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2;if(!inside({x:a.x+dx*t,y:a.y+dy*t},rings))return false;}return true;
}
function validate(rings:XY[][]){
 if(!rings.length||rings.reduce((n,r)=>n+r.length,0)>150)throw new Error('Use a polygon with 3–150 vertices.');
 for(const r of rings){if(r.length<3||Math.abs(signedArea(r))<.05)throw new Error('The boundary has no usable area.');
  for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];if(length(a,b)<.001)throw new Error('Duplicate adjacent area vertices.');for(let j=i+1;j<r.length;j++){if(j===i+1||i===0&&j===r.length-1)continue;const c=r[j],d=r[(j+1)%r.length];if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)))throw new Error('The boundary intersects itself.');}}
 }
}
export function frame(points:Coordinate[],direction:number){
 const lat=points.reduce((s,p)=>s+p.lat,0)/points.length,lon=points.reduce((s,p)=>s+p.lon,0)/points.length,sx=111320*Math.cos(lat*Math.PI/180),sy=111320,a=direction*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 if(Math.abs(lat)>80)throw new Error('Planning is limited to latitudes below 80°.');
 return {project:(p:Coordinate):XY=>{const e=(p.lon-lon)*sx,n=(p.lat-lat)*sy;return {x:e*c-n*s,y:e*s+n*c};},unproject:(p:XY):Coordinate=>({lon:lon+(p.x*c+p.y*s)/sx,lat:lat+(-p.x*s+p.y*c)/sy,alt:0})};
}
export function planRaster(rings:Coordinate[][],spacing:number,direction:number,margin=0,start?:Coordinate):RasterPlan{
 if(!Number.isFinite(spacing)||spacing<.25||spacing>500||!Number.isFinite(direction)||!Number.isFinite(margin)||margin<0||margin>1000)throw new Error('Invalid lane spacing / direction / margin.');
 const f=frame(rings.flat(),direction);let polygons=rings.map(r=>r.map(f.project));validate(polygons);
 polygons=polygons.map((r,i)=>{if((signedArea(r)>0)!==(i===0))r.reverse();return r;});
 for(let i=1;i<polygons.length;i++){if(!polygons[i].every(p=>inside(p,[polygons[0]])))throw new Error('Interior exclusions must lie inside the outer boundary.');}
 const source=polygons.flat();if(Math.max(...source.map(p=>p.x))-Math.min(...source.map(p=>p.x))>10000||Math.max(...source.map(p=>p.y))-Math.min(...source.map(p=>p.y))>10000)throw new Error('Planning area exceeds 10 km.');
 if(margin){const paths=polygons.map((r,i)=>{const p=r.map(p=>({X:Math.round(p.x*SCALE),Y:Math.round(p.y*SCALE)}));if(Clipper.Clipper.Orientation(p)!==(i===0))p.reverse();return p;});const offset=new Clipper.ClipperOffset(2,.05*SCALE);offset.AddPath(paths[0],Clipper.JoinType.jtMiter,Clipper.EndType.etClosedPolygon);const result:Clipper.Paths=[];offset.Execute(result,margin*SCALE);if(paths.length>1){const clip=new Clipper.Clipper();clip.AddPaths(result,Clipper.PolyType.ptSubject,true);clip.AddPaths(paths.slice(1),Clipper.PolyType.ptClip,true);const difference:Clipper.Paths=[];clip.Execute(Clipper.ClipType.ctDifference,difference,Clipper.PolyFillType.pftEvenOdd,Clipper.PolyFillType.pftEvenOdd);result.splice(0,result.length,...difference);}polygons=result.map(r=>r.map(p=>({x:p.X/SCALE,y:p.Y/SCALE})));}
 const flat=polygons.flat();if(flat.length>300)throw new Error('Buffered boundary is too complex.');
 const min=Math.min(...flat.map(p=>p.x)),max=Math.max(...flat.map(p=>p.x)),count=Math.max(1,Math.ceil((max-min)/spacing));if(count>600)throw new Error('Too many flight lanes. Increase lane spacing.');
 const step=(max-min)/count,lines:[XY,XY][]=[];
 for(let i=0;i<count;i++){const x=min+(i+.5)*step,ys:number[]=[];for(const r of polygons)for(let j=0;j<r.length;j++){const a=r[j],b=r[(j+1)%r.length];if((a.x<=x&&b.x>x)||(b.x<=x&&a.x>x))ys.push(a.y+(x-a.x)*(b.y-a.y)/(b.x-a.x));}ys.sort((a,b)=>a-b);for(let j=0;j+1<ys.length;j+=2)if(ys[j+1]-ys[j]>.01)lines.push([{x,y:ys[j]},{x,y:ys[j+1]}]);}
 if(!lines.length)throw new Error('No flight lanes fit this boundary.');
 // Visibility graph routes transfers around concavities and interior exclusions.
 let adjacency:number[][]|null=null;
 function connector(a:XY,b:XY):XY[]{if(segmentInside(a,b,polygons))return [b];if(!adjacency){adjacency=flat.map(()=>flat.map(()=>Infinity));for(let i=0;i<flat.length;i++)for(let j=i+1;j<flat.length;j++)if(segmentInside(flat[i],flat[j],polygons))adjacency[i][j]=adjacency[j][i]=length(flat[i],flat[j]);}
  const nodes=[...flat,a,b],n=nodes.length,dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),used=nodes.map(()=>false);dist[n-2]=0;
  for(let k=0;k<n;k++){let u=-1;for(let i=0;i<n;i++)if(!used[i]&&(u<0||dist[i]<dist[u]))u=i;if(u<0||!Number.isFinite(dist[u]))break;if(u===n-1)break;used[u]=true;
   for(let v=0;v<n;v++){if(used[v]||u===v)continue;const w=u<flat.length&&v<flat.length?adjacency[u][v]:segmentInside(nodes[u],nodes[v],polygons)?length(nodes[u],nodes[v]):Infinity;if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u;}}
  }
  if(!Number.isFinite(dist[n-1]))throw new Error('Disconnected flight area: split the mission into separate polygons.');const route:XY[]=[];for(let v=n-1;v!==n-2;v=prev[v]){if(v<0)throw new Error('No interior transfer path.');route.unshift(nodes[v]);}return route;
 }
 const sequences=[lines,lines.slice().reverse()].flatMap(ls=>[false,true].map(reverse=>{const path:XY[]=[],legs:[number,number][]=[];let distance=0;for(let i=0;i<ls.length;i++){let [a,b]=ls[i];if(Boolean(i%2)!==reverse)[a,b]=[b,a];if(path.length){const bridge=connector(path[path.length-1],a);for(const p of bridge){distance+=length(path[path.length-1],p);if(length(path[path.length-1],p)>.001)path.push(p);}}else path.push(a);const begin=path.length-1;path.push(b);distance+=length(a,b);legs.push([begin,path.length-1]);}return {path,legs,distance,score:distance+(start?length(f.project(start),path[0]):0)};}));
 sequences.sort((a,b)=>a.score-b.score);const best=sequences[0];if(best.path.length>2000)throw new Error('More than 2000 generated waypoints.');
 return {points:best.path.map(f.unproject),legs:best.legs,distance:best.distance,area:Math.abs(polygons.reduce((s,r)=>s+signedArea(r),0))};
}
