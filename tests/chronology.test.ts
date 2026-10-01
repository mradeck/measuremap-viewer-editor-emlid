import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filenameTime,photoTime,chronologicalPhotos} from '../survey/chronology';
import type {Photo} from '../survey/model';
const photo=(name:string,modified=0,capturedAt?:number):Photo=>({id:name,file:{name,lastModified:modified} as File,url:'',original:null,capturedAt});
test('capture order prefers EXIF, accepts Emlid time, labels file fallback and keeps input unchanged',()=>{
  const early=new Date(2026,8,10,10,0,0).getTime();
  const exif=photo('phone.jpg',early+999999,early);
  const emlid=photo('P1_ab12_20260910110000.jpg',early-999999);
  const fallback=photo('download.jpg',early+7200000);
  const unknown=photo('unknown.jpg');
  const input=[unknown,fallback,emlid,exif];
  assert.deepEqual(chronologicalPhotos(input),[exif,emlid,fallback,unknown]);
  assert.equal(input[0],unknown);assert.equal(photoTime(exif).source,'exif');
  assert.equal(photoTime(emlid).source,'filename');assert.equal(photoTime(fallback).source,'file');
});
test('invalid filename dates are rejected and identical dates have deterministic natural order',()=>{
  assert.equal(filenameTime('P1_a_20260230120000.jpg'),null);
  assert.equal(filenameTime('P1_a_20261301120000.jpg'),null);
  assert.equal(filenameTime('P1_a_20260101250000.jpg'),null);
  assert.equal(filenameTime('photo.jpg'),null);
  const a=photo('photo10.jpg',1),b=photo('photo2.jpg',1);
  assert.deepEqual(chronologicalPhotos([a,b]),[b,a]);
});
