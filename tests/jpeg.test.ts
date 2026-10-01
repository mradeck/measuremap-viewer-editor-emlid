import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import piexif from 'piexifjs';
import {geotagJpeg,mergeSurveyXmp,extractXmp,jpegSegments,binary} from '../survey/jpeg';
import {parseSurveyCsv} from '../survey/model';
Object.assign(globalThis,{DOMParser,XMLSerializer});
const tiny=new Uint8Array(readFileSync(new URL('./fixtures/tiny.jpg',import.meta.url)));
const pos={lat:48.30710952,lon:11.65598703,altitude:463.856};
test('JPEG export preserves pixel stream, orientation, copyright, capture date and GPS heading',()=>{
  const exif=piexif.load(binary(tiny));
  exif['0th']![piexif.ImageIFD.Orientation]=6;
  exif['0th']![piexif.ImageIFD.Copyright]='Example Photographer';
  exif.Exif![piexif.ExifIFD.DateTimeOriginal]='2026:08:03 12:21:33';
  exif.GPS![16]='T';exif.GPS![17]=[83,1];
  const before=Uint8Array.from(piexif.insert(piexif.dump(exif),binary(tiny)),c=>c.charCodeAt(0));
  const after=geotagJpeg(before,pos,null),tags=piexif.load(binary(after));
  assert.equal(tags['0th']![274],6);assert.equal(tags['0th']![33432],'Example Photographer');
  assert.equal(tags.Exif![36867],'2026:08:03 12:21:33');assert.deepEqual(tags.GPS![17],[83,1]);
  assert.deepEqual(after.slice(jpegSegments(after).scanStart),before.slice(jpegSegments(before).scanStart));
});
test('XMP merges while preserving panorama/copyright/drone metadata and removing stale EXIF-XMP GPS',()=>{
  const original='<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:GPano="http://ns.google.com/photos/1.0/panorama/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dji="http://www.dji.com/drone-dji/1.0/" xmlns:exif="http://ns.adobe.com/exif/1.0/" GPano:ProjectionType="equirectangular" dji:GimbalYawDegree="45" exif:GPSLatitude="1,0N"><dc:rights>Rights &amp; owner</dc:rights></rdf:Description></rdf:RDF></x:xmpmeta>';
  const merged=mergeSurveyXmp(original,pos,null);
  assert.ok(merged.includes('equirectangular'));assert.ok(merged.includes('GimbalYawDegree="45"'));assert.ok(merged.includes('Rights &amp; owner'));assert.ok(!merged.includes('1,0N'));
  assert.ok(merged.includes('48.30710952'));assert.ok(!merged.includes('RtkFlag'));
});
test('a fresh manual position removes stale RTK quality and UTM from earlier tagging',()=>{
  const pt=parseSurveyCsv('Name,Latitude,Longitude,Easting,Northing,Elevation,Ellipsoidal height,Lateral RMS,Solution status,Correction type\nP1,48.3,11.6,696000,5350000,463.8,509.4,0.017,FIX,RTK').points[0];
  const tagged=geotagJpeg(tiny,pt,pt);
  const output=geotagJpeg(tagged,{lat:-33.85,lon:-70.66,altitude:null},null),gps=piexif.load(binary(output)).GPS!;
  assert.equal(gps[6],undefined);assert.equal(gps[31],undefined);assert.equal(gps[1],'S');assert.equal(gps[3],'W');
  assert.ok(!extractXmp(output)?.includes('<mls:Easting>'));
});
test('invalid image/position and malformed XMP fail rather than destroy metadata',()=>{
  assert.throws(()=>geotagJpeg(new Uint8Array([1,2,3]),pos,null),/JPEG/);
  assert.throws(()=>geotagJpeg(tiny,{lat:100,lon:0,altitude:null},null),/Ungültige/);
  assert.throws(()=>mergeSurveyXmp('<bad/>',pos,null),/RDF/);
});
