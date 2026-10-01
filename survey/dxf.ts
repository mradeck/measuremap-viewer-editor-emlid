import {translate as t} from '../ui/translations';
import DxfParser from 'dxf-parser';
import {projectToLatLon} from './model';
export interface DrawingFeature {layer:string; kind:'line'|'point'|'text'; coords:[number,number][]; text?:string}
export interface Drawing {name:string; features:DrawingFeature[]; unsupported:string[]; crs:string}
export function parseDrawing(text:string,name:string,crs:string):Drawing {
  const drawing=new DxfParser().parseSync(text);
  if(!drawing) throw new Error(t("DXF konnte nicht gelesen werden."));
  const features:DrawingFeature[]=[], unsupported=new Set<string>();
  for(const entity of drawing.entities as any[]) {
    const layer=entity.layer||'0', type=entity.type;
    const project=(p:{x:number;y:number})=>projectToLatLon(p.x,p.y,crs);
    if(type==='POINT') features.push({layer,kind:'point',coords:[project(entity.position)]});
    else if(type==='TEXT' || type==='MTEXT') {
      const p=entity.position||entity.startPoint;
      if(p) features.push({layer,kind:'text',coords:[project(p)],text:(entity.text||'').replace(/\\P/g,' ').replace(/\\[^;]+;/g,'').replace(/[{}]/g,'')});
    } else if(['LINE','LWPOLYLINE','POLYLINE'].includes(type)) {
      const vertices=entity.vertices || [];
      if(vertices.length<2)continue;
      const expanded:{x:number;y:number}[]=[];
      const edgeCount=entity.shape?vertices.length:vertices.length-1;
      for(let i=0;i<edgeCount;i++) {
        const a=vertices[i], b=vertices[(i+1)%vertices.length];expanded.push(a);
        if(a.bulge) {
          const theta=4*Math.atan(a.bulge), chord=Math.hypot(b.x-a.x,b.y-a.y);
          const off=chord*(1-a.bulge*a.bulge)/(4*a.bulge);
          const cx=(a.x+b.x)/2-(b.y-a.y)/chord*off, cy=(a.y+b.y)/2+(b.x-a.x)/chord*off;
          const start=Math.atan2(a.y-cy,a.x-cx), radius=Math.hypot(a.x-cx,a.y-cy), steps=Math.max(8,Math.ceil(Math.abs(theta)*24));
          for(let j=1;j<steps;j++)expanded.push({x:cx+radius*Math.cos(start+theta*j/steps),y:cy+radius*Math.sin(start+theta*j/steps)});
        }
      }
      expanded.push(entity.shape?vertices[0]:vertices[vertices.length-1]);
      features.push({layer,kind:'line',coords:expanded.map(project)});
    } else if(type==='CIRCLE' || type==='ARC') {
      const start=type==='ARC'?entity.startAngle:0, end=type==='ARC'?entity.endAngle:Math.PI*2;
      const sweep=end>start?end-start:end-start+Math.PI*2;
      features.push({layer,kind:'line',coords:Array.from({length:97},(_,i)=>project({x:entity.center.x+entity.radius*Math.cos(start+sweep*i/96),y:entity.center.y+entity.radius*Math.sin(start+sweep*i/96)}))});
    } else unsupported.add(type);
  }
  if(!features.length)throw new Error(t("Keine unterstützte DXF-Geometrie gefunden."));
  return {name,features,unsupported:[...unsupported],crs};
}
