import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import piexif from 'piexifjs';
import {parseSurveyCsv,matchPhoto,effectivePosition,type Photo} from '../survey/model';
import {geotagJpeg,binary,jpegSegments,extractXmp} from '../survey/jpeg';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const csv='Name,Latitude,Longitude,Easting,Northing,Elevation,Ellipsoidal height,Point photos,Solution status,CS name,Lateral RMS\nA,48.1,11.1,610000,5330000,450,500,first.jpg,FIX,ETRS89 / UTM zone 32N,0.01\n42,48.2,11.2,620000,5340000,460,510,second.jpg|extra.jpg,FIX,ETRS89 / UTM zone 32N,0.02\n19,48.3,11.3,630000,5350000,470,520,last.jpg,FIX,ETRS89 / UTM zone 32N,0.03';
const points=parseSurveyCsv(csv).points;
const photo=(name:string):Photo=>({id:name,file:{name} as File,url:'',original:null});
test('optional correction follows CSV order, moves all photos at the same point and switches off without mutating data',()=>{
  const before=JSON.stringify(points),p=photo('second.jpg');
  assert.equal(matchPhoto(p,points).point?.name,'42');
  for(const name of ['second.jpg','extra.jpg']){
    const match=matchPhoto(photo(name),points,true);assert.equal(match.point?.name,'A');assert.equal(match.sourcePoint?.name,'42');assert.equal(match.method,'shifted');
  }
  assert.equal(matchPhoto(photo('last.jpg'),points,true).point?.name,'42');
  assert.equal(matchPhoto(photo('42_abcd_20261002120000.jpg'),points,true).point?.name,'A');
  assert.equal(matchPhoto(p,points,false).point?.name,'42');assert.equal(JSON.stringify(points),before);
});
test('first row and invalid preceding row cannot wrap around or fall back to old EXIF GPS',()=>{
  const first={...photo('first.jpg'),original:{lat:50,lon:12,altitude:1}};
  assert.equal(matchPhoto(first,points,true).method,'offset-missing');assert.equal(effectivePosition(first,points,true),null);
  const invalid=parseSurveyCsv('Name,Latitude,Longitude,Point photos\nA,48,11,a.jpg\nB,,11,b.jpg\nC,49,12,c.jpg').points;
  assert.equal(matchPhoto(photo('c.jpg'),invalid,true).point,null);
});
test('manual assignments, manual coordinates, GPS-only and ambiguous photos remain unchanged',()=>{
  const p=photo('second.jpg');
  const manual={...p,pointId:points[2].id};assert.equal(matchPhoto(manual,points,true).point?.name,'19');
  const override={...p,override:{lat:49,lon:13,altitude:0}};assert.deepEqual(effectivePosition(override,points,true),override.override);
  const gps={...photo('phone.jpg'),original:{lat:50,lon:14,altitude:2}};assert.deepEqual(effectivePosition(gps,points,true),gps.original);
  assert.equal(matchPhoto(p,[...points,{...points[1],id:'duplicate'}],true).method,'ambiguous');
});
test('corrected JPEG contains predecessor GPS and UTM while preserving encoded image pixels',()=>{
  const tiny=new Uint8Array(readFileSync(new URL('./fixtures/tiny.jpg',import.meta.url))),p=photo('second.jpg');
  const match=matchPhoto(p,points,true),position=effectivePosition(p,points,true)!;
  const output=geotagJpeg(tiny,position,match.point),tags=piexif.load(binary(output));
  const dms=(values:number[][])=>values.reduce((sum,[n,d],i)=>sum+n/d/[1,60,3600][i],0);
  assert.ok(Math.abs(dms(tags.GPS![piexif.GPSIFD.GPSLatitude])-48.1)<1e-8);
  assert.ok(Math.abs(dms(tags.GPS![piexif.GPSIFD.GPSLongitude])-11.1)<1e-8);
  assert.equal(tags.GPS![piexif.GPSIFD.GPSAltitude][0]/tags.GPS![piexif.GPSIFD.GPSAltitude][1],450);
  const xml=extractXmp(output)||'';assert.match(xml,/610000/);assert.match(xml,/5330000/);assert.match(xml,/0\.01/);
  assert.deepEqual(output.subarray(jpegSegments(output).scanStart),tiny.subarray(jpegSegments(tiny).scanStart));
});
