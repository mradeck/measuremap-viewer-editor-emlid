import proj4 from 'proj4';
import type {GeoTIFFImage} from 'geotiff';
import {imageAffine,rasterCrs,worldToPixel} from '../survey/ortho';
import {frame,type RasterPlan} from './raster';
import type {Coordinate} from './mission';
export interface ElevationModel {name:string;crs:string;width:number;height:number;sample:(p:Pick<Coordinate,'lat'|'lon'>)=>Promise<number>}
export interface TerrainOptions {model:ElevationModel;start:{lat:number;lon:number};launchOffset:number;agl:number;step:number;maxVerticalSpeed:number}
export interface TerrainPlan {plan:RasterPlan;heights:number[];passThrough:boolean[];agl:number;startElevation:number;launchOffset:number;maxVerticalSpeed:number;modelName:string}
export function relativeHeight(ground:number,startGround:number,agl:number,launchOffset:number){
 if(![ground,startGround,agl,launchOffset].every(Number.isFinite)||agl<=0||launchOffset<0)throw new Error('Invalid terrain / launch height.');
 return ground-startGround+agl-launchOffset;
}
export async function readElevationModel(file:File):Promise<ElevationModel>{
 const {fromBlob}=await import('geotiff');return decodeElevationModel(await (await fromBlob(file)).getImage(),file.name);
}
export function decodeElevationModel(image:GeoTIFFImage,name:string):ElevationModel{
 if(image.getSamplesPerPixel()!==1)throw new Error('DEM/DSM requires one numeric elevation band, not an RGB orthophoto.');
 const keys=image.getGeoKeys()||{},units=Number(keys.VerticalUnitsGeoKey);if(units&&units!==9001)throw new Error('Elevation values must use metres.');
 const crs=rasterCrs(keys),affine=imageAffine(image),projection=proj4('EPSG:4326',crs),width=image.getWidth(),height=image.getHeight(),nodata=image.getGDALNoData();
 const cache=new Map<string,Promise<ArrayLike<number>>>(),size=128;
 async function cell(x:number,y:number){const tx=Math.floor(x/size)*size,ty=Math.floor(y/size)*size,key=`${tx}:${ty}`,w=Math.min(size,width-tx);let block=cache.get(key);
  if(!block){block=image.readRasters({window:[tx,ty,Math.min(width,tx+size),Math.min(height,ty+size)],samples:[0],interleave:true}).then(r=>r as unknown as ArrayLike<number>);cache.set(key,block);if(cache.size>32)cache.delete(cache.keys().next().value!);}else{cache.delete(key);cache.set(key,block);}
  let value:number;try{value=Number((await block)[(y-ty)*w+x-tx]);}catch(e){cache.delete(key);throw e;}
  if(!Number.isFinite(value)||nodata!==null&&value===nodata)throw new Error('DEM/DSM has NoData at the start or along the route.');return value;
 }
 return {name,crs,width,height,async sample(p){
  if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>85||Math.abs(p.lon)>180)throw new Error('Invalid terrain sample position.');
  const world=projection.forward([p.lon,p.lat]),pixel=worldToPixel(affine,world[0],world[1]);
  if(pixel[0]<0||pixel[1]<0||pixel[0]>=width||pixel[1]>=height)throw new Error('DEM/DSM does not cover the start and the complete route.');
  const x=Math.max(0,Math.min(width-1,pixel[0]-.5)),y=Math.max(0,Math.min(height-1,pixel[1]-.5)),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=x-x0,fy=y-y0;
  const values=await Promise.all([cell(x0,y0),cell(x1,y0),cell(x0,y1),cell(x1,y1)]);return values[0]*(1-fx)*(1-fy)+values[1]*fx*(1-fy)+values[2]*(1-fx)*fy+values[3]*fx*fy;
 }};
}
export function densifyPlan(plan:RasterPlan,step:number):RasterPlan{
 if(!Number.isFinite(step)||step<1||step>50)throw new Error('Terrain sampling step must be 1–50 m.');
 const f=frame(plan.points,0),points:Coordinate[]=[plan.points[0]],indices=[0];
 for(let i=1;i<plan.points.length;i++){const a=plan.points[i-1],b=plan.points[i],pa=f.project(a),pb=f.project(b),count=Math.max(1,Math.ceil(Math.hypot(pb.x-pa.x,pb.y-pa.y)/step));if(points.length+count>2000)throw new Error('Terrain route exceeds 2000 waypoints. Increase sampling step or lane spacing.');
  for(let j=1;j<=count;j++)points.push(j===count?{...b}:{...b,lat:a.lat+(b.lat-a.lat)*j/count,lon:a.lon+(b.lon-a.lon)*j/count});indices.push(points.length-1);
 }
 return {...plan,points,legs:plan.legs.map(([a,b])=>[indices[a],indices[b]])};
}
export async function terrainProfile(plan:RasterPlan,options:TerrainOptions,speed:number):Promise<TerrainPlan>{
 const {model,start,launchOffset,agl,step,maxVerticalSpeed}=options;
 if(!Number.isFinite(maxVerticalSpeed)||maxVerticalSpeed<=0||maxVerticalSpeed>5||!Number.isFinite(speed)||speed<=0)throw new Error('Invalid terrain climb/descent limit or speed.');
 const dense=densifyPlan(plan,step),startElevation=await model.sample(start),heights:number[]=[],f=frame(dense.points,0);let distance=0;
 for(let i=0;i<dense.points.length;i++){
  const h=relativeHeight(await model.sample(dense.points[i]),startElevation,agl,launchOffset);heights.push(h);
  if(i){const a=f.project(dense.points[i-1]),b=f.project(dense.points[i]),horizontal=Math.hypot(b.x-a.x,b.y-a.y),dh=h-heights[i-1];if(horizontal<.001||Math.abs(dh)/horizontal*speed>maxVerticalSpeed)throw new Error('Terrain slope exceeds the chosen climb/descent rate. Reduce flight speed or review the elevation model.');distance+=Math.hypot(horizontal,dh);}
 }
 const original=new Set(plan.points.map(p=>`${p.lon}:${p.lat}`)),passThrough=dense.points.map(p=>!original.has(`${p.lon}:${p.lat}`));
 return {plan:{...dense,distance},heights,passThrough,agl,startElevation,launchOffset,maxVerticalSpeed,modelName:model.name};
}
