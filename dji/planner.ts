import {areaVertices,inspectMission,missionXml as X,type Mission,type Coordinate} from './mission';
import {terrainProfile,type TerrainOptions,type TerrainPlan} from './terrain';
import {frame,planRaster} from './raster';
export interface PlanSettings {laneSpacing:number;photoDistance:number;terrain?:TerrainPlan;}
export interface PlanResult {mission:Mission;lanes:number;distance:number;duration:number;area:number;photoInterval:number;terrain?:TerrainPlan;}
const median=(n:number[])=>{const s=n.slice().sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
export function inferSettings(m:Mission):PlanSettings|null{
 const template=m.referenceTemplate,waylines=m.referenceWaylines;if(!template||!waylines)return null;
 const td=X.xml(template),wd=X.xml(waylines),source=inspectMission(m.name,template,waylines);
 const angle=X.numeric(td,'direction'),overlap=X.numeric(td,'orthoCameraOverlapW'),front=X.numeric(td,'orthoCameraOverlapH'),originalHeight=X.numeric(td,'globalShootHeight')??X.numeric(td,'height');
 if(angle===null||overlap===null||front===null||overlap>=100||front>=100||source.points.length<4)return null;
 const f=frame(source.points,angle),rows:number[]=[];
 for(let i=1;i<source.points.length;i++){const a=f.project(source.points[i-1]),b=f.project(source.points[i]),dy=Math.abs(b.y-a.y);if(dy>5&&Math.abs(b.x-a.x)<dy*.02)rows.push((a.x+b.x)/2);}
 rows.sort((a,b)=>a-b);const unique=rows.filter((x,i)=>!i||x-rows[i-1]>.1),gaps=unique.slice(1).map((x,i)=>x-unique[i]).filter(n=>n>.25);if(!gaps.length)return null;
 const current=m.template?X.xml(m.template):td,side=X.numeric(current,'orthoCameraOverlapW')??overlap,forward=X.numeric(current,'orthoCameraOverlapH')??front,height=X.numeric(current,'globalShootHeight')??originalHeight;
 const factor=height&&originalHeight&&originalHeight>0?height/originalHeight:1;
 let along:number|null=null;
 for(const e of X.all(wd,'minShootInterval')){const t=Number(e.textContent);if(t>0&&source.speed){along=t*source.speed;break;}}
 if(along===null)for(const g of X.all(wd,'actionGroup')){const mode=X.val(g,'actionTriggerType'),p=X.numeric(g,'actionTriggerParam');if(p&&mode==='multipleTiming'&&source.speed){along=p*source.speed;break;}if(p&&mode==='multipleDistance'){along=p;break;}}
 if(along===null)return null;
 return {laneSpacing:median(gaps)/(1-overlap/100)*(1-side/100)*factor,photoDistance:along/(1-front/100)*(1-forward/100)*factor};
}
export function recalculateMission(m:Mission,settings:PlanSettings):PlanResult{
 if(!m.template||m.templateType!=='mapping2d'||!m.namespace)throw new Error('Local recalculation supports DJI mapping2d missions only.');
 const td=X.xml(m.template);if(X.all(td,'Polygon').length!==1)throw new Error('Use one survey polygon per mission.');
 for(const flag of ['surfaceFollowModeEnable','elevationOptimizeEnable','smartObliqueEnable','facadeWaylineEnable','quickOrthoMappingEnable'])if(X.numeric(td,flag))throw new Error('Terrain-following / oblique / quick-ortho missions need Pilot 2 recalculation.');
 const heightMode=X.val(td,'heightMode');if(!['relativeToStartPoint','WGS84'].includes(heightMode))throw new Error('Only constant relative-to-start or WGS84 flight heights are supported.');
 const height=m.flightHeight,speed=X.numeric(td,'autoFlightSpeed'),direction=X.numeric(td,'direction')??0,margin=X.numeric(td,'margin')??0;
 if(height===null||!Number.isFinite(height)||!speed||speed<=0||speed>15)throw new Error('Invalid flight height / speed.');
 if(!Number.isFinite(settings.photoDistance)||settings.photoDistance<=0||settings.photoDistance>500)throw new Error('Invalid photo spacing.');
 const interval=settings.photoDistance/speed;if(interval<.5)throw new Error('Photo interval is below 0.5 s. Reduce speed or increase photo spacing.');
 const reference=m.referenceWaylines?X.xml(m.referenceWaylines):null;
 if(reference&&X.all(reference,'Folder').length!==1)throw new Error('Only a single 2D wayline folder is supported.');
 if(reference&&!settings.terrain){const heights=X.all(reference,'executeHeight').map(e=>Number(e.textContent));if(heights.length&&Math.max(...heights)-Math.min(...heights)>.01)throw new Error('Variable-height routes cannot be regenerated without terrain data.');}
 const functions=reference?X.all(reference,'Placemark').flatMap(p=>X.all(p,'actionActuatorFunc').map(e=>e.textContent?.trim())):[];
 if(functions.some(n=>!['gimbalRotate','startTimeLapse','stopTimeLapse','takePhoto'].includes(n||'')))throw new Error('This mission has custom waypoint actions. Recalculate in Pilot 2 to retain them.');
 let start:Coordinate|undefined;const raw=X.val(td,'startPositionRef').split(',').map(Number);if(raw.length===3&&raw.every(Number.isFinite))start={lat:raw[0],lon:raw[1],alt:raw[2]};
 if(settings.terrain&&heightMode!=='relativeToStartPoint')throw new Error('Local DEM planning requires relativeToStartPoint; absolute datums must not be mixed.');
 const plan=settings.terrain?.plan||planRaster(m.rings.map(areaVertices),settings.laneSpacing,direction,margin,start);
 if(settings.terrain&&(settings.terrain.heights.length!==plan.points.length||!settings.terrain.heights.every(Number.isFinite)))throw new Error('Invalid terrain height profile.');
 const wd=reference||X.xml(`<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${m.namespace}"><Document/></kml>`),document=X.all(wd,'Document')[0];
 const sourceFolder=reference?X.all(reference,'Folder')[0]:null,prototype=sourceFolder?X.all(sourceFolder,'Placemark')[0]:null;
 function element(name:string,value?:string|number){const e=wd.createElementNS(m.namespace,`wpml:${name}`);if(value!==undefined)e.textContent=String(value);return e;}
 function write(parent:Element,name:string,value:string|number){let e=Array.from(parent.childNodes).find((n):n is Element=>n.nodeType===1&&(n as Element).localName===name);if(!e){e=element(name);parent.appendChild(e);}X.set(e,value);}
 const config=reference?X.all(reference,'missionConfig')[0]:X.all(td,'missionConfig')[0];if(!config)throw new Error('DJI missionConfig is missing.');for(const e of X.all(document,'missionConfig'))document.removeChild(e);document.insertBefore(wd.importNode(config,true),document.firstChild);
 const folder=sourceFolder?sourceFolder.cloneNode(true) as Element:wd.createElementNS('http://www.opengis.net/kml/2.2','Folder');
 for(const p of X.all(folder,'Placemark'))folder.removeChild(p);
 for(const f of X.all(document,'Folder'))document.removeChild(f);
 document.appendChild(folder);write(folder,'templateId',X.val(td,'templateId')||0);write(folder,'waylineId',0);write(folder,'executeHeightMode',heightMode);write(folder,'autoFlightSpeed',speed);write(folder,'distance',plan.distance.toFixed(3));write(folder,'duration',(plan.distance/speed).toFixed(3));
 const sourceActions=sourceFolder?X.all(sourceFolder,'action'):[];
 const findAction=(name:string)=>sourceActions.find(a=>X.val(a,'actionActuatorFunc')===name);
 const originalCapture=findAction('startTimeLapse')||findAction('takePhoto'),originalStop=findAction('stopTimeLapse');
 const position=X.numeric(td,'payloadPositionIndex')??0,lens=X.val(td,'imageFormat');
 function action(name:string):Element{
  const original=name==='startTimeLapse'?findAction('startTimeLapse'):name==='stopTimeLapse'?originalStop:findAction(name);
  if(original)return wd.importNode(original,true) as Element;
  const a=element('action');a.appendChild(element('actionId',0));a.appendChild(element('actionActuatorFunc',name));const params=element('actionActuatorFuncParam');params.appendChild(element('payloadPositionIndex',position));
  const referenceParams=originalCapture?X.all(originalCapture,'actionActuatorFuncParam')[0]:null;
  for(const tag of ['useGlobalPayloadLensIndex','payloadLensIndex']){const e=referenceParams?X.all(referenceParams,tag)[0]:null;if(e)params.appendChild(wd.importNode(e,true));}
  if(!X.all(params,'payloadLensIndex').length&&lens)params.appendChild(element('payloadLensIndex',lens));
  if(name==='startTimeLapse')params.appendChild(element('minShootInterval',interval));a.appendChild(params);return a;
 }
 const shootType=X.val(td,'shootType')||'time';if(!['time','distance'].includes(shootType))throw new Error('Unsupported DJI capture mode.');
 const useLapse=shootType==='time'&&!!findAction('startTimeLapse');
 if(!X.all(folder,'startActionGroup').length){
  const pitch=X.numeric(td,'gimbalPitchAngle');if(pitch===null)throw new Error('Camera gimbal pitch is missing from the template.');
  const startup=element('startActionGroup'),a=element('action'),params=element('actionActuatorFuncParam');a.appendChild(element('actionId',0));a.appendChild(element('actionActuatorFunc','gimbalRotate'));
  for(const [name,value] of Object.entries({gimbalHeadingYawBase:'aircraft',gimbalRotateMode:'absoluteAngle',gimbalPitchRotateEnable:1,gimbalPitchRotateAngle:pitch,gimbalRollRotateEnable:0,gimbalRollRotateAngle:0,gimbalYawRotateEnable:0,gimbalYawRotateAngle:0,gimbalRotateTimeEnable:0,gimbalRotateTime:10,payloadPositionIndex:position}))params.appendChild(element(name,value));a.appendChild(params);startup.appendChild(a);folder.appendChild(startup);
 }
 const turnFrame=frame(plan.points,0);
 const points:Element[]=plan.points.map((p,i)=>{
  const pm=prototype?prototype.cloneNode(true) as Element:wd.createElementNS('http://www.opengis.net/kml/2.2','Placemark');for(const a of X.all(pm,'actionGroup'))pm.removeChild(a);
  let coord=X.all(pm,'coordinates')[0];if(!coord){const point=wd.createElementNS('http://www.opengis.net/kml/2.2','Point');coord=wd.createElementNS('http://www.opengis.net/kml/2.2','coordinates');point.appendChild(coord);pm.insertBefore(point,pm.firstChild);}X.set(coord,`${p.lon.toFixed(12)},${p.lat.toFixed(12)}`);
  write(pm,'index',i);write(pm,'executeHeight',settings.terrain?Number(settings.terrain.heights[i].toFixed(3)):height);write(pm,'waypointSpeed',speed);write(pm,'useStraightLine',1);
  let turn=X.all(pm,'waypointTurnParam')[0];if(!turn){turn=element('waypointTurnParam');pm.appendChild(turn);}const pass=settings.terrain?.passThrough[i];write(turn,'waypointTurnMode',pass?'toPointAndPassWithContinuityCurvature':'toPointAndStopWithDiscontinuityCurvature');
  const q=turnFrame.project(p),previous=i?turnFrame.project(plan.points[i-1]):q,next=i+1<plan.points.length?turnFrame.project(plan.points[i+1]):q;
  write(turn,'waypointTurnDampingDist',pass?Math.min(.1,Math.hypot(q.x-previous.x,q.y-previous.y)/4,Math.hypot(q.x-next.x,q.y-next.y)/4):0);
  let heading=X.all(pm,'waypointHeadingParam')[0];if(!heading){heading=element('waypointHeadingParam');pm.appendChild(heading);}write(heading,'waypointHeadingMode','followWayline');write(heading,'waypointHeadingAngleEnable',0);folder.appendChild(pm);return pm;
 });
 let id=0;function group(index:number,end:number,type:string,param:number|null,actions:Element[]){const g=element('actionGroup');g.appendChild(element('actionGroupId',id++));g.appendChild(element('actionGroupStartIndex',index));g.appendChild(element('actionGroupEndIndex',end));g.appendChild(element('actionGroupMode','sequence'));const trigger=element('actionTrigger');trigger.appendChild(element('actionTriggerType',type));if(param!==null)trigger.appendChild(element('actionTriggerParam',param));g.appendChild(trigger);actions.forEach((a,i)=>{write(a,'actionId',i);g.appendChild(a);});points[index].appendChild(g);}
 for(const [begin,end] of plan.legs){if(useLapse){const startAction=action('startTimeLapse'),params=X.all(startAction,'actionActuatorFuncParam')[0];write(params,'minShootInterval',Number(interval.toFixed(6)));group(begin,begin,'reachPoint',null,[startAction]);group(end,end,'reachPoint',null,[action('stopTimeLapse')]);}else group(begin,end,shootType==='time'?'multipleTiming':'multipleDistance',shootType==='time'?interval:settings.photoDistance,[action('takePhoto')]);}
 // Keep calibrated template overlap consistent with explicit spacing overrides.
 const footprint=photoFootprint(m),side=X.numeric(td,'orthoCameraOverlapW'),front=X.numeric(td,'orthoCameraOverlapH');
 const calibration=inferSettings(m)||(footprint&&side!==null&&front!==null?{laneSpacing:footprint.width*(1-side/100),photoDistance:footprint.length*(1-front/100)}:null);
 if(calibration){for(const [tag,target,previous] of [['orthoCameraOverlapW',settings.laneSpacing,calibration.laneSpacing],['orthoCameraOverlapH',settings.photoDistance,calibration.photoDistance]] as const){const before=X.numeric(td,tag);if(before!==null){const after=100*(1-target/previous*(1-before/100));if(after<0||after>95)throw new Error('Spacing implies overlap outside 0–95%. Adjust lane / photo spacing.');if(Math.abs(after-before)>1e-4)X.set(X.all(td,tag)[0],Number(after.toFixed(6)));}}}
 for(const t of X.all(td,'updateTime'))X.set(t,Date.now());
 const result={...inspectMission(m.name,new XMLSerializer().serializeToString(td),new XMLSerializer().serializeToString(wd),m.entries),templatePath:m.templatePath,waylinesPath:m.waylinesPath,referenceTemplate:m.referenceTemplate,referenceWaylines:m.referenceWaylines};
 return {mission:result,lanes:plan.legs.length,distance:plan.distance,duration:plan.distance/speed,area:plan.area,photoInterval:interval,terrain:settings.terrain};
}

/** Effective footprint inferred from imported lanes/capture actions, or M3E nadir optics. */
export function photoFootprint(m:Mission):{width:number;length:number;calibrated:boolean}|null{
 const inferred=inferSettings(m),side=m.template?X.numeric(X.xml(m.template),'orthoCameraOverlapW'):null,front=m.template?X.numeric(X.xml(m.template),'orthoCameraOverlapH'):null;
 if(inferred&&inferred.laneSpacing>0&&inferred.photoDistance>0&&side!==null&&front!==null&&side<100&&front<100)return {width:inferred.laneSpacing/(1-side/100),length:inferred.photoDistance/(1-front/100),calibrated:true};
 // DJI Mavic 3 Enterprise wide camera: 84 degree diagonal FOV, 5280 x 3956.
 if(m.drone==='77'&&m.payload==='66'&&m.height!==null&&m.height>0){const diagonal=2*m.height*Math.tan(42*Math.PI/180),r=5280/3956;return {width:diagonal*r/Math.hypot(r,1),length:diagonal/Math.hypot(r,1),calibrated:false};}
 return null;
}
export function estimateGsd(m:Mission,widthPixels:number,heightPixels:number):{x:number;y:number;calibrated:boolean}|null{
 const footprint=photoFootprint(m);if(!footprint||![widthPixels,heightPixels].every(n=>Number.isFinite(n)&&n>0))return null;
 return {x:100*footprint.width/widthPixels,y:100*footprint.length/heightPixels,calibrated:footprint.calibrated};
}

export async function recalculateTerrainMission(m:Mission,settings:PlanSettings,options:TerrainOptions):Promise<PlanResult>{
 if(!m.template||m.heightMode!=='relativeToStartPoint')throw new Error('Local DEM planning requires a relative-to-start mission.');
 const td=X.xml(m.template),shoot=X.all(td,'globalShootHeight')[0];if(!shoot)throw new Error('Missing DJI shooting height.');X.set(shoot,options.agl);
 // Export explicit relative waypoint heights; never claim live sensor following.
 for(const tag of ['surfaceFollowModeEnable','elevationOptimizeEnable'])for(const e of X.all(td,tag))X.set(e,0);
 const adjusted={...m,template:new XMLSerializer().serializeToString(td),height:options.agl};
 const plan=planRaster(m.rings.map(areaVertices),settings.laneSpacing,X.numeric(td,'direction')??0,X.numeric(td,'margin')??0,{...options.start,alt:0});
 const terrain=await terrainProfile(plan,options,X.numeric(td,'autoFlightSpeed')??0);
 return recalculateMission(adjusted,{...settings,terrain});
}

export function subjectDistance(relativeFlightHeight:number,subjectAboveLaunchGround:number,launchAboveGround:number):number{
 if(![relativeFlightHeight,subjectAboveLaunchGround,launchAboveGround].every(Number.isFinite)||launchAboveGround<0)throw new Error('Invalid subject / launch height.');
 return relativeFlightHeight+launchAboveGround-subjectAboveLaunchGround;
}
