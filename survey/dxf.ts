import {translate as t} from '../ui/translations';
import DxfParser from 'dxf-parser';
import {projectToLatLon} from './model';
export interface DrawingFeature {color:string;layer:string; kind:'line'|'point'|'text'; coords:[number,number][]; text?:string}
export interface Drawing {name:string; features:DrawingFeature[]; unsupported:string[]; crs:string}
export interface DrawingDocument extends Drawing {id:string;source:string;visible:boolean;hiddenLayers:string[]}
export function visibleDrawing(documents:DrawingDocument[]):Drawing|null {
  if(!documents.length)return null;
  return {name:'DXF',crs:'',unsupported:[...new Set(documents.flatMap(d=>d.unsupported))],features:documents.filter(d=>d.visible).flatMap(d=>d.features.filter(f=>!d.hiddenLayers.includes(f.layer)))};
}
/** The parser does not retain layer TrueColor tags; retain their precedence here. */
function trueColors(text:string){
  const layers=new Map<string,number>(),entities=new Map<string,number>(),lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  let type='',name='',handle='',color:number|undefined;
  const flush=()=>{if(color!==undefined&&color>=0&&color<=0xffffff){if(type==='LAYER')layers.set(name,color);else if(handle)entities.set(handle,color);}};
  for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim()),value=lines[i+1].trim();if(code===0){flush();type=value;name='';handle='';color=undefined;}else if(code===2)name=value;else if(code===5)handle=value;else if(code===420)color=Number(value);}
  flush();return {layers,entities};
}
export function parseDrawing(text:string,name:string,crs:string):Drawing {
  const drawing=new DxfParser().parseSync(text);
  if(!drawing) throw new Error(t("DXF konnte nicht gelesen werden."));
  const trueColor=trueColors(text),layerTable=drawing.tables?.layer?.layers||{};
  const features:DrawingFeature[]=[], unsupported=new Set<string>();
  for(const entity of drawing.entities as any[]) {
    const layer=entity.layer||'0', type=entity.type,layerInfo=layerTable[layer];
    const explicit=trueColor.entities.get(entity.handle);
    const layerRgb=trueColor.layers.get(layer);
    const inherited=entity.colorIndex===undefined||entity.colorIndex===0||Math.abs(entity.colorIndex)===256;
    const entityTrue=explicit??(inherited&&entity.colorIndex!==0?entity.color:undefined);
    const rgb=entityTrue??(!inherited?entity.color:layerRgb??layerInfo?.color);
    const auto=entityTrue===undefined&&(inherited?layerRgb===undefined&&(layerInfo?.colorIndex===7||rgb===undefined):Math.abs(entity.colorIndex)===7);
    const color=auto?'var(--s-text)':`#${Number(rgb??0xffffff).toString(16).padStart(6,'0')}`;

    const project=(p:{x:number;y:number})=>projectToLatLon(p.x,p.y,crs);
    if(type==='POINT') features.push({color,layer,kind:'point',coords:[project(entity.position)]});
    else if(type==='TEXT' || type==='MTEXT') {
      const p=entity.position||entity.startPoint;
      if(p) features.push({color,layer,kind:'text',coords:[project(p)],text:(entity.text||'').replace(/\\P/g,' ').replace(/\\[^;]+;/g,'').replace(/[{}]/g,'')});
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
      features.push({color,layer,kind:'line',coords:expanded.map(project)});
    } else if(type==='CIRCLE' || type==='ARC') {
      const start=type==='ARC'?entity.startAngle:0, end=type==='ARC'?entity.endAngle:Math.PI*2;
      const sweep=end>start?end-start:end-start+Math.PI*2;
      features.push({color,layer,kind:'line',coords:Array.from({length:97},(_,i)=>project({x:entity.center.x+entity.radius*Math.cos(start+sweep*i/96),y:entity.center.y+entity.radius*Math.sin(start+sweep*i/96)}))});
    } else unsupported.add(type);
  }
  if(!features.length)throw new Error(t("Keine unterstützte DXF-Geometrie gefunden."));
  return {name,features,unsupported:[...unsupported],crs};
}
