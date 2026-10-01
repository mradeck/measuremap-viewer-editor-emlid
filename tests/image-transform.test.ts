import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FIT_IMAGE,clampImage,zoomImage} from '../survey/imageTransform';
const view={width:800,height:600,imageWidth:1600,imageHeight:1200};
test('zoom keeps the pixel under the pointer fixed while there is room to pan',()=>{
  const point={x:100,y:-75},next=zoomImage(view,FIT_IMAGE,2,point);
  assert.deepEqual(next,{scale:2,x:-100,y:75});
  assert.equal((point.x-next.x)/next.scale,point.x);
  assert.equal((point.y-next.y)/next.scale,point.y);
});
test('pan cannot move the image offscreen and respects letterboxing',()=>{
  assert.deepEqual(clampImage(view,{scale:2,x:9999,y:-9999}),{scale:2,x:400,y:-300});
  assert.deepEqual(clampImage({...view,imageHeight:400},{scale:2,x:0,y:9999}),{scale:2,x:0,y:0});
  assert.deepEqual(clampImage(view,{scale:.2,x:500,y:500}),FIT_IMAGE);
});
test('zoom caps at 16 and returns exactly to fitted view',()=>{
  const zoom=zoomImage(view,FIT_IMAGE,100,{x:0,y:0});assert.equal(zoom.scale,16);
  assert.deepEqual(zoomImage(view,zoom,.001,{x:250,y:100}),FIT_IMAGE);
});
