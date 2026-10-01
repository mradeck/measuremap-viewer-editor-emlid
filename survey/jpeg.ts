import {translate as t} from '../ui/translations';
import piexif from 'piexifjs';
import {VERSION, validPosition, type Position, type SurveyPoint} from './model';

const XMP = 'http://ns.adobe.com/xap/1.0/\0';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const SURVEY_NS = 'https://michael-radeck.de/ns/metalens/survey/1.0/';
export const binary = (bytes:Uint8Array) => {
  let s=''; for(let i=0;i<bytes.length;i+=32768) s+=String.fromCharCode(...bytes.subarray(i,i+32768)); return s;
};
const bytes = (s:string) => Uint8Array.from(s,c=>c.charCodeAt(0));
export function dms(deg:number) {
  const micro=Math.round(Math.abs(deg)*3600*1e6), d=Math.floor(micro/3.6e9), rem=micro-d*3.6e9, m=Math.floor(rem/6e7);
  return [[d,1],[m,1],[rem-m*6e7,1e6]];
}
export function jpegSegments(data:Uint8Array) {
  if(data[0]!==255 || data[1]!==216) throw new Error(t("Metadatenexport unterstützt ausschließlich JPEG-Originale."));
  const segments:{marker:number;start:number;end:number}[]=[];
  let i=2;
  while(i<data.length) {
    if(data[i]!==255) throw new Error(t("Beschädigter JPEG-Header."));
    const start=i; while(data[i]===255) i++;
    const marker=data[i++];
    if(marker===0xda || marker===0xd9) return {segments, scanStart:start};
    if(marker===1 || marker>=0xd0 && marker<=0xd7) {segments.push({marker,start,end:i});continue;}
    const len=(data[i]<<8)|data[i+1];
    if(len<2 || i+len>data.length) throw new Error(t("Beschädigtes JPEG-Segment."));
    i+=len; segments.push({marker,start,end:i});
  }
  throw new Error(t("JPEG ohne Bilddaten."));
}
export function extractXmp(data:Uint8Array):string|null {
  const {segments}=jpegSegments(data);
  for(const s of segments) if(s.marker===0xe1 && binary(data.slice(s.start+4,s.start+4+XMP.length))===XMP)
    return new TextDecoder().decode(data.slice(s.start+4+XMP.length,s.end)).replace(/\0/g,'').trim();
  return null;
}
function injectXmp(data:Uint8Array, xml:string) {
  const {segments,scanStart}=jpegSegments(data);
  const payload=new TextEncoder().encode(XMP+xml), len=payload.length+2;
  if(len>65535) throw new Error(t("XMP zu groß für ein JPEG-Segment."));
  const app=new Uint8Array(payload.length+4); app.set([255,225,len>>8,len&255]);app.set(payload,4);
  const chunks=[data.slice(0,2),app];
  for(const s of segments) {
    if(s.marker===0xe1 && binary(data.slice(s.start+4,s.start+4+XMP.length))===XMP) continue;
    chunks.push(data.slice(s.start,s.end));
  }
  chunks.push(data.slice(scanStart));
  const out=new Uint8Array(chunks.reduce((a,c)=>a+c.length,0));let off=0;
  for(const c of chunks){out.set(c,off);off+=c.length;} return out;
}
export function mergeSurveyXmp(original:string|null, position:Position, point:SurveyPoint|null):string {
  const parser=new DOMParser();
  const doc=parser.parseFromString(original || `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="${RDF}"/></x:xmpmeta>`, 'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error(t("Vorhandenes XMP ist ungültig. Es wird nicht überschrieben."));
  const rdf=doc.getElementsByTagNameNS(RDF,'RDF')[0];
  if(!rdf) throw new Error(t("Vorhandenes XMP enthält kein RDF."));
  // Keep camera/drone metadata in its original namespace. Survey positions have their own provenance.
  const all=Array.from(doc.getElementsByTagName('*'));
  const gpsNames=['GPSLatitude','GPSLongitude','GPSAltitude','GPSAltitudeRef','GPSMapDatum','GPSHPositioningError'];
  for(const node of all) {
    if(node.namespaceURI===SURVEY_NS) {node.parentNode?.removeChild(node);continue;}
    for(const attr of Array.from(node.attributes)) {
      if(attr.namespaceURI===SURVEY_NS || attr.namespaceURI==='http://ns.adobe.com/exif/1.0/' && gpsNames.includes(attr.localName)) node.removeAttributeNode(attr);
    }
    if(node.namespaceURI==='http://ns.adobe.com/exif/1.0/' && gpsNames.includes(node.localName)) node.parentNode?.removeChild(node);
  }
  const desc=doc.createElementNS(RDF,'rdf:Description'); desc.setAttributeNS(RDF,'rdf:about','');
  const values:Record<string,string>={Version:VERSION,Latitude:String(position.lat),Longitude:String(position.lon),PositionSource:point?'Emlid survey point':'Manual map position',PositionRole:point?'SurveyPoint':'PhotoLocation'};
  if(position.altitude!==null) {values.ExportAltitude=String(position.altitude); values.ExportHeightReference=point?point.heightReference:'Unspecified';}
  if(point) {
    values.PointName=point.name;values.CoordinateSystem=point.crs;values.CoordinateSystemName=point.raw['CS name']||'';
    values.SolutionStatus=point.solution;values.CorrectionType=point.correction;
    if(point.easting!==null)values.Easting=String(point.easting);
    if(point.northing!==null)values.Northing=String(point.northing);
    if(point.elevation!==null)values.OrthometricHeight=String(point.elevation);
    if(point.ellipsoidal!==null)values.EllipsoidalHeight=String(point.ellipsoidal);
    values.MeasurementTime=point.raw['Averaging end']||'';
    // Source fields, including RMS, antenna height and receiver, remain complete and lossless.
    values.SourceRecord=JSON.stringify(point.raw);
  }
  for(const [name,value] of Object.entries(values)) {const el=doc.createElementNS(SURVEY_NS,`mls:${name}`);el.textContent=value;desc.appendChild(el);}
  rdf.appendChild(desc);
  return new XMLSerializer().serializeToString(doc);
}
export function geotagJpeg(input:Uint8Array, position:Position, point:SurveyPoint|null):Uint8Array {
  if(!validPosition(position) || position.altitude!==null && !Number.isFinite(position.altitude)) throw new Error(t("Ungültige Position."));
  jpegSegments(input);
  const originalXmp=extractXmp(input), s=binary(input);
  // Fail on unreadable EXIF rather than discard existing camera metadata.
  const exif=piexif.load(s);
  const gps=exif.GPS || {};
  gps[0]=[2,3,0,0];gps[1]=position.lat<0?'S':'N';gps[2]=dms(position.lat);
  gps[3]=position.lon<0?'W':'E';gps[4]=dms(position.lon);gps[18]='WGS-84';
  // Remove stale altitude/time/quality from the overwritten position.
  for(const tag of [5,6,7,29,30,31,27,8,9,10,11])delete gps[tag];
  if(position.altitude!==null) {gps[5]=position.altitude<0?1:0;gps[6]=[Math.round(Math.abs(position.altitude)*1000),1000];}
  if(point) {
    const rms=Number(point.raw['Lateral RMS']);
    if(point.raw['Lateral RMS']?.trim() && Number.isFinite(rms) && rms>=0)gps[31]=[Math.round(rms*1e6),1e6];
    gps[27]='ASCII\0\0\0'+`Emlid ${point.correction} ${point.solution}; surveyed point`;
  }
  exif.GPS=gps;
  const changed=bytes(piexif.insert(piexif.dump(exif),s));
  return injectXmp(changed,mergeSurveyXmp(originalXmp,position,point));
}
