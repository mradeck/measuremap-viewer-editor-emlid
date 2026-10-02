import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fromArrayBuffer,writeArrayBuffer} from 'geotiff';
import {decodeOrtho,pixelToWorld,worldToPixel,rasterCrs,imageAffine,type Affine} from '../survey/ortho';
test('affine raster transform handles rotation and inverse coordinates',()=>{
 const a:Affine=[.2,.05,696900,.03,-.2,5353800];
 for(const p of [[0,0],[100,50],[-.5,12]]){const xy=pixelToWorld(a,...p as [number,number]);const back=worldToPixel(a,...xy);assert.ok(Math.abs(back[0]-p[0])<1e-7&&Math.abs(back[1]-p[1])<1e-7);}
 assert.throws(()=>worldToPixel([0,0,1,0,0,1],0,0));
 assert.throws(()=>rasterCrs({}));assert.throws(()=>rasterCrs({ProjectedCSTypeGeoKey:32767}));
 assert.equal(rasterCrs({ProjectedCSTypeGeoKey:25832}),'EPSG:25832');assert.equal(rasterCrs({ProjectedCSTypeGeoKey:32756}),'EPSG:32756');
});
const metadata={width:2,height:2,ModelPixelScale:[1,1,0],ModelTiepoint:[0,0,0,696900,5353800,0],GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:25832,GTRasterTypeGeoKey:1};
test('GeoTIFF RGB import preserves colors, UTM location and native dimensions',async()=>{
 const image=await (await fromArrayBuffer(writeArrayBuffer(new Uint8Array([255,0,0,0,255,0,0,0,255,255,255,255]),{...metadata,PhotometricInterpretation:2,SamplesPerPixel:3,BitsPerSample:[8,8,8]}))).getImage();
 const o=await decodeOrtho(image,'test.tif');assert.equal(o.crs,'EPSG:25832');assert.equal(o.width,2);assert.equal(o.previewWidth,2);
 assert.deepEqual([...o.pixels],[255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
 assert.ok(o.bounds.every(([lat,lon])=>lat>48&&lat<49&&lon>11&&lon<12));
});
test('NoData and alpha become transparent, PixelIsPoint centers are respected',async()=>{
 const image=await (await fromArrayBuffer(writeArrayBuffer(new Uint8Array([0,0,0,255,255,0,0,0,0,255,0,128,0,0,255,255]),{...metadata,PhotometricInterpretation:2,SamplesPerPixel:4,BitsPerSample:[8,8,8,8],ExtraSamples:[2],GDAL_NODATA:'0',GTRasterTypeGeoKey:2}))).getImage();
 assert.deepEqual(pixelToWorld(imageAffine(image),.5,.5),[696900,5353800]);
 const o=await decodeOrtho(image,'rgba.tif');assert.deepEqual([o.pixels[3],o.pixels[7],o.pixels[11],o.pixels[15]],[0,0,128,255]);
});
test('16K raster windows retain individual pixels lost by the overview',async()=>{
 const width=16384,height=4,values=new Uint8Array(width*height*3);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*3;values[i]=x%2?255:0;values[i+1]=y*50;values[i+2]=x%256;}
 const image=await (await fromArrayBuffer(writeArrayBuffer(values,{...metadata,width,height,PhotometricInterpretation:2,SamplesPerPixel:3,BitsPerSample:[8,8,8]}))).getImage();
 const o=await decodeOrtho(image,'16k.tif');assert.equal(o.width,16384);assert.equal(o.previewWidth,4096);
 const region=await o.readWindow([12344,1,12348,3]);assert.equal(region.width,4);assert.equal(region.height,2);
 assert.deepEqual([...region.pixels.slice(0,8)],[0,50,56,255,255,50,57,255]);
 assert.deepEqual(await o.readWindow([12344,1,12348,3]),region);
 const abort=new AbortController();abort.abort();await assert.rejects(o.readWindow([12344,1,12348,3],abort.signal),{name:'AbortError'});
});
