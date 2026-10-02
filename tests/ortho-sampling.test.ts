import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleRaster} from '../survey/ortho-sampling';
test('bilinear sampling preserves native pixel centers and avoids transparent-edge halos',()=>{
 const raster={width:2,height:1,pixels:new Uint8ClampedArray([255,0,0,255,0,0,0,0])},out=new Uint8ClampedArray(4);
 sampleRaster(raster,0,0,out,0);assert.deepEqual([...out],[255,0,0,255]);
 sampleRaster(raster,.5,0,out,0);assert.deepEqual([...out],[255,0,0,128]);
 sampleRaster(raster,-1,0,out,0);assert.deepEqual([...out],[255,0,0,255]);
});
