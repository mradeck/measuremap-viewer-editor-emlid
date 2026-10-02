import JSZip from 'jszip';
export type Coordinate={lon:number;lat:number;alt:number};
export interface Waypoint extends Coordinate {folder:number;index:number;height:number;speed:number;}
export interface Mission {name:string;template:string|null;waylines:string|null;entries:Map<string,Uint8Array>;templatePath?:string;waylinesPath?:string;referenceTemplate?:string|null;referenceWaylines?:string|null;namespace:string;templateType:string;points:Waypoint[];rings:Coordinate[][];speed:number|null;height:number|null;flightHeight:number|null;heightMode:string;drone:string;payload:string;}
const KML='http://www.opengis.net/kml/2.2';
function xml(source:string):Document {
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('DTD / entities are not supported.');
 const d=new DOMParser().parseFromString(source,'application/xml');
 if(d.getElementsByTagName('parsererror').length||d.documentElement?.localName!=='kml')throw new Error('Invalid KML / WPML XML.');
 return d;
}
function all(node:Document|Element,name:string):Element[]{return Array.from(node.getElementsByTagName('*')).filter(e=>e.localName===name);}
function val(node:Document|Element,name:string):string{return all(node,name)[0]?.textContent?.trim()||'';}
function numeric(node:Document|Element,name:string):number|null{const s=val(node,name);return s!==''&&Number.isFinite(Number(s))?Number(s):null;}
function set(el:Element,value:string|number){el.textContent=String(value);}
function coords(s:string):Coordinate[]{return s.trim().split(/\s+/).filter(Boolean).map(row=>{const a=row.split(',').map(Number);if(a.length<2||!a.slice(0,2).every(Number.isFinite)||Math.abs(a[0])>180||Math.abs(a[1])>90||a.length>2&&!Number.isFinite(a[2]))throw new Error('Invalid WGS84 coordinates.');return {lon:a[0],lat:a[1],alt:a[2]||0};});}
function coordText(p:Coordinate){return `${p.lon.toFixed(12)},${p.lat.toFixed(12)},${p.alt}`;}
export function inspectMission(name:string,template:string|null,waylines:string|null,entries=new Map<string,Uint8Array>()):Mission{
 if(!template&&!waylines)throw new Error('No KML / WPML mission found.');
 const td=template?xml(template):null,wd=waylines?xml(waylines):null,d=td||wd!;
 const namespace=d.documentElement.lookupNamespaceURI('wpml')||Array.from(d.documentElement.attributes).find(a=>a.value.startsWith('http://www.dji.com/wpmz/'))?.value||'';
 const rings=td?all(td,'LinearRing').map(r=>coords(val(r,'coordinates'))):[];
 let points:Waypoint[]=[];
 if(wd)all(wd,'Folder').forEach((f,folder)=>all(f,'Placemark').forEach(p=>{const c=all(p,'Point')[0];if(!c)return;const q=coords(val(c,'coordinates'))[0];if(!q)return;points.push({...q,folder,index:numeric(p,'index')??points.length,height:numeric(p,'executeHeight')??q.alt,speed:numeric(p,'waypointSpeed')??numeric(f,'autoFlightSpeed')??0});}));
 else if(td)all(td,'Placemark').forEach((p,index)=>{const c=all(p,'Point')[0];if(!c)return;const q=coords(val(c,'coordinates'))[0];if(q)points.push({...q,folder:0,index:numeric(p,'index')??index,height:numeric(p,'height')??numeric(td,'globalHeight')??q.alt,speed:numeric(p,'waypointSpeed')??numeric(td,'autoFlightSpeed')??0});});
 if(!points.length&&!namespace&&td)points=all(td,'LineString').flatMap((line,folder)=>coords(val(line,'coordinates')).map((p,index)=>({...p,folder,index,height:p.alt,speed:0})));
 if(!points.length&&!rings.some(r=>r.length>=3))throw new Error('No route points or survey polygon found.');
 return {name,template,waylines,entries,referenceTemplate:template,referenceWaylines:waylines,namespace,templateType:val(d,'templateType')||(namespace?'waypoint':'KML'),points,rings,speed:numeric(wd||d,'autoFlightSpeed'),height:numeric(d,'globalShootHeight')??numeric(d,'globalHeight')??points[0]?.height??null,flightHeight:points[0]?.height??numeric(d,'globalHeight')??numeric(d,'height')??numeric(d,'globalShootHeight'),heightMode:val(wd||d,'executeHeightMode')||val(d,'heightMode')||'unknown',drone:val(d,'droneEnumValue'),payload:val(d,'payloadEnumValue')};
}
export async function readMission(file:{name:string;arrayBuffer:()=>Promise<ArrayBuffer>}):Promise<Mission>{
 const bytes=await file.arrayBuffer();if(bytes.byteLength>64*1024*1024)throw new Error('Mission file exceeds 64 MB.');
 if(/\.kml$/i.test(file.name))return inspectMission(file.name,new TextDecoder().decode(bytes),null);
 if(!/\.kmz$/i.test(file.name))throw new Error('Please select a KML or KMZ file.');
 const z=await JSZip.loadAsync(bytes),entries=new Map<string,Uint8Array>();let total=0;
 for(const e of Object.values(z.files)){
  if(e.dir)continue;
  if(e.name.includes('..')||e.name.startsWith('/')||e.name.includes('\\'))throw new Error('Unsafe archive path.');
  const size=(e as any)._data?.uncompressedSize??0;if(size>64*1024*1024||total+size>128*1024*1024)throw new Error('Mission archive is too large.');
  const b=await e.async('uint8array');total+=b.length;if(total>128*1024*1024)throw new Error('Mission archive is too large.');entries.set(e.name,b);
 }
 const names=[...entries.keys()],t=names.find(n=>n.toLowerCase()==='wpmz/template.kml')||names.find(n=>/\.kml$/i.test(n)),w=names.find(n=>n.toLowerCase()==='wpmz/waylines.wpml');
 return {...inspectMission(file.name,t?new TextDecoder().decode(entries.get(t)):null,w?new TextDecoder().decode(entries.get(w)):null,entries),templatePath:t,waylinesPath:w};
}
function rewrite(m:Mission,edit:(d:Document,execution:boolean)=>void):Mission {
 const apply=(s:string|null,execution:boolean)=>{if(!s)return null;const d=xml(s);edit(d,execution);if(!execution)for(const e of all(d,'updateTime'))set(e,Date.now());return new XMLSerializer().serializeToString(d);};
 return {...inspectMission(m.name,apply(m.template,false),apply(m.waylines,true),m.entries),templatePath:m.templatePath,waylinesPath:m.waylinesPath,referenceTemplate:m.referenceTemplate,referenceWaylines:m.referenceWaylines,...(!m.waylines?{flightHeight:m.flightHeight}:{})};
}
export function transformMission(m:Mission,east:number,north:number,angle:number):Mission{
 if(![east,north,angle].every(Number.isFinite))throw new Error('Invalid transformation.');
 const base=m.rings.flat().length?m.rings.flat():m.points,lat=base.reduce((s,p)=>s+p.lat,0)/base.length,lon=base.reduce((s,p)=>s+p.lon,0)/base.length;
 const sx=111320*Math.cos(lat*Math.PI/180),sy=111320,a=angle*Math.PI/180;
 const transform=(p:Coordinate):Coordinate=>{const x=(p.lon-lon)*sx,y=(p.lat-lat)*sy;return {...p,lon:lon+(x*Math.cos(a)+y*Math.sin(a)+east)/sx,lat:lat+(-x*Math.sin(a)+y*Math.cos(a)+north)/sy};};
 return rewrite(m,d=>{
  for(const e of all(d,'coordinates'))set(e,coords(e.textContent||'').map(transform).map(coordText).join('\n'));
  // DJI reference / POI order is latitude,longitude,height.
  for(const tag of ['startPositionRef','waypointPoiPoint'])for(const e of all(d,tag)){const v=(e.textContent||'').split(',').map(Number);if(v.length===3&&v.every(Number.isFinite)&&!(v[0]===0&&v[1]===0)){const p=transform({lat:v[0],lon:v[1],alt:v[2]});set(e,`${p.lat},${p.lon},${p.alt}`);}}
  if(angle)for(const tag of ['direction','waypointHeadingAngle','waypointGimbalYawAngle','gimbalYawRotateAngle','mappingHeadingAngle'])for(const e of all(d,tag)){const n=Number(e.textContent);if(Number.isFinite(n))set(e,tag==='direction'?((n+angle)%360+360)%360:((n+angle+180)%360+360)%360-180);}
 });
}
export function changeHeight(m:Mission,delta:number):Mission{
 if(!Number.isFinite(delta))throw new Error('Invalid height offset.');
 const result=rewrite(m,(d,execution)=>{for(const tag of ['globalShootHeight','globalHeight','height','ellipsoidHeight','executeHeight'])for(const e of all(d,tag)){const n=Number(e.textContent);if(Number.isFinite(n))set(e,!execution&&m.templateType==='mapping2d'&&['height','globalHeight'].includes(tag)&&m.flightHeight!==null?m.flightHeight+delta:n+delta);}});
 return {...result,flightHeight:m.flightHeight===null?result.flightHeight:m.flightHeight+delta};
}
export function setFlightHeight(m:Mission,height:number):Mission{
 if(!Number.isFinite(height)||m.flightHeight===null)throw new Error('Invalid flight height.');
 return changeHeight(m,height-m.flightHeight);
}
// Copy the execution height into the template before discarding the old route.
function planningOnly(m:Mission):Mission{
 const normalized=rewrite(m,(d,execution)=>{if(!execution&&m.templateType==='mapping2d'&&m.flightHeight!==null){for(const tag of ['height','globalHeight'])for(const e of all(d,tag))set(e,m.flightHeight);}});
 return {...normalized,...inspectMission(m.name,normalized.template,null,m.entries),templatePath:m.templatePath,waylinesPath:m.waylinesPath,referenceTemplate:m.referenceTemplate,referenceWaylines:m.referenceWaylines,flightHeight:m.flightHeight};
}
export function changeSpeed(m:Mission,speed:number):Mission{
 if(!Number.isFinite(speed)||speed<=0||speed>15)throw new Error('Speed must be > 0 and ≤ 15 m/s.');
 return rewrite(m,d=>{
  for(const tag of ['autoFlightSpeed','waypointSpeed'])for(const e of all(d,tag))set(e,speed);
  updateMetrics(d);
 });
}
function distance(a:Coordinate,b:Coordinate){const r=Math.PI/180,x=(b.lon-a.lon)*r*Math.cos((a.lat+b.lat)/2*r),y=(b.lat-a.lat)*r;return Math.hypot(x,y)*6371008.8;}
function updateMetrics(d:Document){for(const f of all(d,'Folder')){const p=all(f,'Placemark').filter(p=>all(p,'Point').length);let total=0,time=0;for(let i=1;i<p.length;i++){const a=coords(val(p[i-1],'coordinates'))[0],b=coords(val(p[i],'coordinates'))[0];if(!a||!b)continue;const n=distance(a,b);total+=n;time+=n/(numeric(p[i],'waypointSpeed')||numeric(f,'autoFlightSpeed')||1);}for(const e of Array.from(f.childNodes).filter((n):n is Element=>n.nodeType===1).filter(e=>e.localName==='distance'))set(e,total.toFixed(3));for(const e of Array.from(f.childNodes).filter((n):n is Element=>n.nodeType===1).filter(e=>e.localName==='duration'))set(e,time.toFixed(3));}}
export function editWaypoint(m:Mission,point:number,values:Pick<Waypoint,'lat'|'lon'|'height'|'speed'>):Mission{
 if(!Number.isFinite(values.lat)||Math.abs(values.lat)>90||!Number.isFinite(values.lon)||Math.abs(values.lon)>180||!Number.isFinite(values.height)||!Number.isFinite(values.speed)||values.speed<=0||values.speed>15)throw new Error('Invalid waypoint values.');
 const target=m.points[point];if(!target)throw new Error('Waypoint not found.');
 return rewrite(m,(d,execution)=>{
  if(m.waylines&&!execution&&m.templateType!=='waypoint')return;
  const folder=all(d,'Folder')[target.folder];if(!folder)return;
  const ps=all(folder,'Placemark').filter(p=>all(p,'Point').length),p=ps.find(p=>numeric(p,'index')===target.index)||ps[point];if(!p)return;
  const e=all(p,'coordinates')[0];if(e){const c=coords(e.textContent||'')[0];set(e,coordText({...c,lat:values.lat,lon:values.lon}));}
  for(const tag of [execution?'executeHeight':'height','ellipsoidHeight','waypointSpeed','useGlobalHeight','useGlobalSpeed'])for(const el of all(p,tag))set(el,tag==='waypointSpeed'?values.speed:tag.startsWith('useGlobal')?0:values.height);
  updateMetrics(d);
 });
}
export function mappingValue(m:Mission,key:string):number|null {return m.template?numeric(xml(m.template),key):null;}
export function editMappingTemplate(m:Mission,values:{direction:number;orthoCameraOverlapH:number;orthoCameraOverlapW:number;margin:number}):Mission{
 if(!m.template||!m.templateType.startsWith('mapping'))throw new Error('A DJI mapping template is required.');
 if(!Object.values(values).every(Number.isFinite)||values.direction<0||values.direction>360||values.margin<0||values.margin>1000||values.orthoCameraOverlapH<0||values.orthoCameraOverlapH>95||values.orthoCameraOverlapW<0||values.orthoCameraOverlapW>95)throw new Error('Invalid mapping parameters.');
 const changed=rewrite(m,(d,execution)=>{if(!execution)for(const [key,value] of Object.entries(values)){const e=all(d,key)[0];if(!e)throw new Error(`Missing DJI field: ${key}`);set(e,value);}});
 // Never keep a stale executable route after raster-generating changes.
 return planningOnly(changed);
}
export async function exportMission(m:Mission):Promise<Uint8Array>{
 if(!m.namespace.startsWith('http://www.dji.com/wpmz/'))throw new Error('This KML has no DJI WPML device / mission settings. Import a Pilot 2 mission for compatible export.');
 const check=inspectMission(m.name,m.template,m.waylines,m.entries);
 if(m.waylines&&xml(m.waylines).documentElement.lookupNamespaceURI('wpml')!==m.namespace)throw new Error('Template and execution WPML namespaces differ.');
 if(check.points.some(p=>![p.lat,p.lon,p.height,p.speed].every(Number.isFinite)||p.speed<=0||Math.abs(p.lat)>90||Math.abs(p.lon)>180))throw new Error('Invalid executable waypoint / speed.');
 if(check.waylines&&!check.points.length)throw new Error('Executable route contains no waypoints.');
 const z=new JSZip();for(const [name,data] of m.entries)if(!['wpmz/template.kml','wpmz/waylines.wpml',m.templatePath,m.waylinesPath].includes(name))z.file(name,data);
 if(m.template)z.file('wpmz/template.kml',m.template);if(m.waylines)z.file('wpmz/waylines.wpml',m.waylines);
 const bytes=await z.generateAsync({type:'uint8array',compression:'DEFLATE'});
 const round=await readMission({name:'check.kmz',arrayBuffer:async()=>bytes.slice().buffer as ArrayBuffer});
 if(round.points.length!==m.points.length||round.rings.length!==m.rings.length||round.namespace!==m.namespace)throw new Error('KMZ round-trip validation failed.');return bytes;
}
export function editAreaVertex(m:Mission,ring:number,index:number,position:{lat:number;lon:number}):Mission {
 if(!m.template)throw new Error('A planning template is required.');
 if(!Number.isFinite(position.lat)||Math.abs(position.lat)>90||!Number.isFinite(position.lon)||Math.abs(position.lon)>180)throw new Error('Invalid WGS84 area vertex.');
 const result=rewrite(m,(d,execution)=>{if(execution)return;const r=all(d,'LinearRing')[ring];if(!r)throw new Error('Area ring not found.');const e=all(r,'coordinates')[0],c=coords(e.textContent||'');if(!c[index])throw new Error('Area vertex not found.');const closed=c.length>1&&c[0].lat===c[c.length-1].lat&&c[0].lon===c[c.length-1].lon;c[index]={...c[index],...position};if(closed&&(index===0||index===c.length-1)){c[0]={...c[0],...position};c[c.length-1]={...c[c.length-1],...position};}set(e,c.map(coordText).join('\n'));});
 return planningOnly(result);
}
/** Remove the repeated closing coordinate from the editing handles. */
export function areaVertices(ring:Coordinate[]):Coordinate[]{
 const first=ring[0],last=ring[ring.length-1];
 return first&&last&&ring.length>1&&first.lat===last.lat&&first.lon===last.lon?ring.slice(0,-1):ring.slice();
}
export function changeAreaTopology(m:Mission,ring:number,operation:'insert'|'delete',index:number,position?:{lat:number;lon:number}):Mission {
 if(!m.template)throw new Error('A planning template is required.');
 const result=rewrite(m,(d,execution)=>{
  if(execution)return;const el=all(d,'LinearRing')[ring];if(!el)throw new Error('Area ring not found.');
  const e=all(el,'coordinates')[0],original=coords(e.textContent||''),vertices=areaVertices(original),closed=vertices.length!==original.length;
  if(!Number.isInteger(index)||index<0||index>=vertices.length)throw new Error('Area vertex not found.');
  if(operation==='delete'){if(vertices.length<=3)throw new Error('An area needs at least three vertices.');vertices.splice(index,1);}
  else{const a=vertices[index],b=vertices[(index+1)%vertices.length],p=position||{lat:(a.lat+b.lat)/2,lon:(a.lon+b.lon)/2};if(!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>180)throw new Error('Invalid WGS84 area vertex.');vertices.splice(index+1,0,{...p,alt:(a.alt+b.alt)/2});}
  if(closed)vertices.push({...vertices[0]});set(e,vertices.map(coordText).join('\n'));
 });
 return planningOnly(result);
}

export const missionXml={xml,all,val,numeric,set,coordText,updateMetrics};

export function setShootingHeight(m:Mission,height:number):Mission{
 if(!Number.isFinite(height)||height<=0)throw new Error('Shooting height must be positive.');
 return rewrite(m,(d,execution)=>{if(execution)return;const e=all(d,'globalShootHeight')[0];if(!e)throw new Error('Missing DJI shooting height.');set(e,height);});
}

export function setSubjectSurface(m:Mission,subjectAboveLaunchGround:number,launchAboveGround:number):Mission{
 if(m.heightMode!=='relativeToStartPoint'||m.flightHeight===null||![subjectAboveLaunchGround,launchAboveGround].every(Number.isFinite)||launchAboveGround<0)throw new Error('A relative-to-launch mission and valid subject / launch levels are required.');
 if(m.points.length>1&&Math.max(...m.points.map(p=>p.height))-Math.min(...m.points.map(p=>p.height))>.01)throw new Error('A fixed subject surface requires a constant flight height.');
 const clearance=m.flightHeight+launchAboveGround-subjectAboveLaunchGround;
 return planningOnly(setShootingHeight(m,clearance));
}
