import {test} from 'node:test';import assert from 'node:assert/strict';import {fromArrayBuffer,writeArrayBuffer} from 'geotiff';import proj4 from 'proj4';
import {decodeElevationModel,densifyPlan,terrainProfile,relativeHeight} from '../dji/terrain';import type {RasterPlan} from '../dji/raster';
const plan:RasterPlan={points:[{lat:48,lon:11.5,alt:0},{lat:48.0005,lon:11.5,alt:0},{lat:48.0005,lon:11.5001,alt:0},{lat:48,lon:11.5001,alt:0}],legs:[[0,1],[2,3]],distance:120,area:400};
test('hand launch compensation has the correct sign, accepts model deltas, and rejects invalid input',()=>{assert.equal(relativeHeight(500,500,30,2),28);assert.equal(relativeHeight(510,500,30,2),38);assert.equal(relativeHeight(495,500,30,2),23);assert.throws(()=>relativeHeight(NaN,500,30,2));assert.throws(()=>relativeHeight(500,500,0,2));assert.throws(()=>relativeHeight(500,500,30,-2));});
test('terrain profile samples lanes and transfers, remaps photo leg endpoints, keeps originals and enforces rate limits',async()=>{
 const dense=densifyPlan(plan,5);assert.ok(dense.points.length>plan.points.length);assert.deepEqual(dense.points[dense.legs[0][1]],plan.points[1]);assert.deepEqual(dense.points[dense.legs[1][0]],plan.points[2]);assert.ok(dense.legs[1][0]>dense.legs[0][1]);
 const options={model:{name:'synthetic',crs:'EPSG:4326',width:10,height:10,sample:async(p:{lat:number;lon:number})=>500+(p.lat-48)*10000},start:{lat:48,lon:11.5},agl:30,launchOffset:2,step:5,maxVerticalSpeed:2};
 const q=await terrainProfile(plan,options,2);assert.equal(q.heights[0],28);assert.ok(Math.abs(Math.max(...q.heights)-33)<.001);assert.equal(q.startElevation,500);assert.equal(q.passThrough.filter(x=>!x).length,plan.points.length);assert.ok(q.plan.distance>0);
 await assert.rejects(terrainProfile(plan,{...options,maxVerticalSpeed:.1},2),/slope/);await assert.rejects(terrainProfile(plan,{...options,model:{...options.model,sample:async()=>{throw new Error('NoData');}}},2),/NoData/);assert.throws(()=>densifyPlan(plan,.5),/1–50/);
});
const meta={width:2,height:2,ModelPixelScale:[1,1,0],ModelTiepoint:[0,0,0,696900,5353800,0],GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:25832,GTRasterTypeGeoKey:1,PhotometricInterpretation:1,SamplesPerPixel:1,BitsPerSample:[32],SampleFormat:[3]};
test('elevation GeoTIFF preserves fractional metre heights, UTM and pixel centres with bilinear interpolation',async()=>{
 const image=await(await fromArrayBuffer(writeArrayBuffer(new Float32Array([500.25,502.25,504.25,506.25]),{...meta}))).getImage(),model=decodeElevationModel(image,'synthetic.tif');
 const wgs=proj4('EPSG:25832','EPSG:4326',[696901,5353799]);assert.ok(Math.abs(await model.sample({lon:wgs[0],lat:wgs[1]})-503.25)<.001);
 const corner=proj4('EPSG:25832','EPSG:4326',[696900.5,5353799.5]);assert.ok(Math.abs(await model.sample({lon:corner[0],lat:corner[1]})-500.25)<.001);
 await assert.rejects(model.sample({lon:0,lat:0}),/cover/);
});
test('RGB orthophotos, feet, NaN / NoData and missing georeference are refused for elevation planning',async()=>{
 const image=await(await fromArrayBuffer(writeArrayBuffer(new Float32Array([500,-9999,500,500]),{...meta,GDAL_NODATA:'-9999'}))).getImage(),model=decodeElevationModel(image,'nodata.tif'),p=proj4('EPSG:25832','EPSG:4326',[696901,5353799]);await assert.rejects(model.sample({lon:p[0],lat:p[1]}),/NoData/);
 const rgb=await(await fromArrayBuffer(writeArrayBuffer(new Uint8Array(12),{...meta,PhotometricInterpretation:2,SamplesPerPixel:3,BitsPerSample:[8,8,8],SampleFormat:[1,1,1]}))).getImage();assert.throws(()=>decodeElevationModel(rgb,'ortho.tif'),/numeric elevation/);
 const feetMeta={...meta,VerticalUnitsGeoKey:9002};const feet=await(await fromArrayBuffer(writeArrayBuffer(new Float32Array(4),feetMeta))).getImage();assert.throws(()=>decodeElevationModel(feet,'feet.tif'),/metres/);
 const invalid=await(await fromArrayBuffer(writeArrayBuffer(new Float32Array([NaN,500,500,500]),{...meta}))).getImage();await assert.rejects(decodeElevationModel(invalid,'invalid.tif').sample({lon:p[0],lat:p[1]}),/NoData/);
 const {ModelPixelScale,ModelTiepoint,...missing}=meta;const unreferenced=await(await fromArrayBuffer(writeArrayBuffer(new Float32Array(4),missing))).getImage();assert.throws(()=>decodeElevationModel(unreferenced,'missing.tif'),/Georeferenzierung/);
});
