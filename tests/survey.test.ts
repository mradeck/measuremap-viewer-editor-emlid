import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import piexif from 'piexifjs';
import {parseSurveyCsv,matchPhoto,inferCrs,effectivePosition,type Photo} from '../survey/model';
import {geotagJpeg,jpegSegments,binary,dms,extractXmp} from '../survey/jpeg';
import {parseDrawing} from '../survey/dxf';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const fixture='Name,Latitude,Longitude,Easting,Northing,Elevation,Ellipsoidal height,Point photos,Solution status,Correction type,CS name,Lateral RMS\n18,48.30710952,11.65598703,696937.890,5353844.725,463.856,509.418,18_e696c28e_20260803122133.jpeg,FIX,RTK,ETRS89 / UTM zone 32N + DHHN2016 height,0.017';
const point=parseSurveyCsv(fixture).points[0];
const photo=(name:string):Photo=>({id:name,file:{name} as File,url:'',original:null});
test('CSV preserves projected coordinates, independent heights and exact file matching',()=>{
  assert.equal(point.crs,'EPSG:25832');assert.equal(point.easting,696937.89);assert.equal(point.elevation,463.856);assert.equal(point.ellipsoidal,509.418);
  assert.equal(matchPhoto(photo(point.photos[0]),[point]).method,'csv');
  assert.equal(matchPhoto(photo('18_ffffffff_20260803123456.jpeg'),[point]).method,'name');
});
test('ambiguous photo names and point names never silently resolve',()=>{
  assert.equal(matchPhoto(photo(point.photos[0]),[point,{...point,id:'second'}]).method,'ambiguous');
  assert.equal(matchPhoto(photo('18_ffff_20260803123456.jpeg'),[point,{...point,id:'second'}]).point,null);
});
test('blank coordinates are skipped; BOM and quoted values work',()=>{
  assert.throws(()=>parseSurveyCsv('Name,Latitude,Longitude\n1,,11'),/keine gültigen/);
  const csv='\uFEFFName;Latitude;Longitude;Point photos\r\n"a;b";48.3;11.6;"a.jpg|b.jpg"';
  assert.equal(parseSurveyCsv(csv).points[0].name,'a;b');assert.deepEqual(parseSurveyCsv(csv).points[0].photos,['a.jpg','b.jpg']);
});
test('manual and original positions have explicit precedence',()=>{
  const p={...photo(point.photos[0]),original:{lat:1,lon:2,altitude:null}};
  assert.equal(effectivePosition(p,[point])?.lat,point.lat);
  assert.equal(effectivePosition({...p,pointId:null},[point])?.lat,1);
  assert.equal(effectivePosition({...p,override:{lat:3,lon:4,altitude:null}},[point])?.lat,3);
  assert.equal(inferCrs('WGS84 / UTM zone 33N'),'EPSG:32633');
});
test('DMS precision survives second rollover and southern/western coordinates',()=>{
  assert.deepEqual(dms(47+59/60+59.9999999/3600),[[48,1],[0,1],[0,1000000]]);
  const d=dms(-48.30710952);const deg=d[0][0]+d[1][0]/60+d[2][0]/d[2][1]/3600;
  assert.ok(Math.abs(deg-48.30710952)<1e-9);
});
const source=process.env.EMLID_TEST_SOURCE;
if(source) {
  const csv=readFileSync(`${source}/nf01/nf01.csv`,'utf8'),points=parseSurveyCsv(csv).points;
  const names=readdirSync(`${source}/nf01`).filter(n=>/\.jpe?g$/i.test(n));
  test('Neufahrn: all 11 originals matched and JPEG pixel streams preserved',()=>{
    assert.equal(names.length,11);assert.equal(points.length,107);
    for(const name of names) {
      const m=matchPhoto(photo(name),points);assert.equal(m.method,'csv');assert.ok(m.point);
      const original:Uint8Array=new Uint8Array(readFileSync(`${source}/nf01/${name}`));
      const output=geotagJpeg(original,m.point,m.point);
      assert.deepEqual(output.slice(jpegSegments(output).scanStart),original.slice(jpegSegments(original).scanStart));
      for(const seg of jpegSegments(original).segments.filter(s=>s.marker===0xe2))assert.ok(binary(output).includes(binary(original.slice(seg.start,seg.end))),'ICC preserved');
      const gps=piexif.load(binary(output)).GPS!;
      const coord=(d:any)=>d[0][0]/d[0][1]+d[1][0]/d[1][1]/60+d[2][0]/d[2][1]/3600;
      assert.ok(Math.abs(coord(gps[2])-m.point.lat)<1e-9);
      assert.ok(Math.abs(coord(gps[4])-m.point.lon)<1e-9);
      assert.equal(gps[6][0]/gps[6][1],m.point.elevation);
      assert.ok(extractXmp(output)?.includes(String(m.point.easting)));
      const second=geotagJpeg(output,m.point,m.point);assert.equal(extractXmp(second)?.match(/<mls:PointName/g)?.length,1);
      const manual=geotagJpeg(output,{lat:-33.85,lon:-70.66,altitude:null},null);
      assert.equal(piexif.load(binary(manual)).GPS![1],'S');assert.equal(piexif.load(binary(manual)).GPS![3],'W');
      assert.equal(piexif.load(binary(manual)).GPS![6],undefined);assert.equal(piexif.load(binary(manual)).GPS![31],undefined);
      assert.ok(!extractXmp(manual)?.includes('<mls:Easting>'));
    }
  });
  test('Neufahrn DXF projects onto survey coordinates',()=>{
    const d=parseDrawing(readFileSync(`${source}/nf01.dxf`,'utf8'),'nf01.dxf','EPSG:25832');
    assert.equal(d.unsupported.length,0);assert.ok(d.features.length>117);
    const pt=d.features.find(f=>f.kind==='point')!.coords[0];assert.ok(Math.abs(pt[0]-48.3072)<.002);assert.ok(Math.abs(pt[1]-11.6559)<.002);
  });
}
