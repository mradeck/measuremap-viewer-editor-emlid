import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoPinSize} from '../survey/photo-marker';
test('map photo frames preserve landscape, portrait and square image ratios',()=>{
  for(const [w,h] of [[1600,900],[900,1600],[1000,1000],[4000,500]]){
    const size=photoPinSize(w,h);
    assert.ok(Math.abs((size.width-10)/(size.height-10)-w/h)<1e-10);
    assert.ok(size.width<=54&&size.height<=46);
  }
  assert.deepEqual(photoPinSize(0,0),photoPinSize(1,1));
});
