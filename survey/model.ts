import {translate as t} from '../ui/translations';
import Papa from 'papaparse';
import exifr from 'exifr';
import proj4 from 'proj4';

export const VERSION = 'v2026.10.1.6';
export const CRS_OPTIONS = ['EPSG:25832', 'EPSG:25833', 'EPSG:32632', 'EPSG:32633', 'EPSG:4326'] as const;
for (const zone of [32, 33]) {
  proj4.defs(`EPSG:258${zone}`, `+proj=utm +zone=${zone} +ellps=GRS80 +units=m +no_defs`);
  proj4.defs(`EPSG:326${zone}`, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
}
export interface Position { lat: number; lon: number; altitude: number | null }
export interface SurveyPoint extends Position {
  id: string; name: string; easting: number | null; northing: number | null;
  elevation: number | null; ellipsoidal: number | null; crs: string; heightReference:string;
  photos: string[]; solution: string; correction: string; raw: Record<string, string>;
}
export interface Photo {
  id: string; file: File; url: string; original: Position | null; metadataError?: string; capturedAt?: number;
  override?: Position | null; pointId?: string | null; excluded?: boolean;
}
export type Match = { point: SurveyPoint | null; method: 'csv' | 'name' | 'manual' | 'ambiguous' | 'none' };
export const number = (s: unknown): number | null => {
  if (s === null || s === undefined || String(s).trim() === '') return null;
  const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null;
};
export const validPosition = (p: Position) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
export function inferCrs(name: string): string {
  const zone = /UTM\s*(?:zone\s*)?(\d{1,2})\s*N/i.exec(name)?.[1];
  if (zone && /ETRS89/i.test(name)) return `EPSG:258${zone.padStart(2, '0')}`;
  if (zone && /WGS\s*84/i.test(name)) return `EPSG:326${zone.padStart(2, '0')}`;
  return name;
}
export function parseSurveyCsv(text: string): {points: SurveyPoint[]; skipped: number} {
  const result = Papa.parse<Record<string,string>>(text.replace(/^\uFEFF/, ''), {header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim()});
  if (result.errors.length) throw new Error(`CSV: ${result.errors[0].message}`);
  if (!result.meta.fields?.includes('Latitude') || !result.meta.fields.includes('Longitude')) throw new Error(t('CSV benötigt die Spalten Latitude und Longitude.'));
  let skipped = 0;
  const points = result.data.flatMap((raw, i) => {
    const lat = number(raw.Latitude), lon = number(raw.Longitude);
    if (lat === null || lon === null || !validPosition({lat, lon, altitude:null})) { skipped++; return []; }
    const elevation = number(raw.Elevation), ellipsoidal = number(raw['Ellipsoidal height']);
    return [{id:`row-${i}`, name:raw.Name || `P${i+1}`, lat, lon, altitude:elevation,
      easting:number(raw.Easting), northing:number(raw.Northing), elevation, ellipsoidal,
      crs:inferCrs(raw['CS name'] || ''), heightReference:/DHHN2016/i.test(raw['CS name']||'')?'DHHN2016 (NHN)':/NHN/i.test(raw['CS name']||'')?'NHN (realization unspecified)':'Elevation (reference unspecified)', photos:(raw['Point photos'] || '').split(/[;|\n]/).filter(Boolean).map(n=>n.trim().split(/[\\/]/).pop()!),
      solution:raw['Solution status'] || '', correction:raw['Correction type'] || '', raw}];
  });
  if (!points.length) throw new Error(t('CSV enthält keine gültigen geografischen Positionen.'));
  return {points, skipped};
}
export function matchPhoto(photo: Photo, points: SurveyPoint[]): Match {
  if (photo.pointId === null) return {point:null, method:'none'};
  if (photo.pointId !== undefined) return {point:points.find(p=>p.id===photo.pointId) || null, method:'manual'};
  const name = photo.file.name.toLowerCase();
  const exact = points.filter(p=>p.photos.some(n=>n.toLowerCase()===name));
  if (exact.length) return {point:exact.length===1?exact[0]:null, method:exact.length===1?'csv':'ambiguous'};
  const stem = name.replace(/\.[^.]+$/, '');
  const emlid = /^(.*)_[0-9a-f]+_\d{14}$/i.exec(stem)?.[1];
  const byName = points.filter(p=>p.name.toLowerCase() === (emlid || stem));
  return {point:byName.length===1?byName[0]:null, method:byName.length>1?'ambiguous':byName.length===1?'name':'none'};
}
export function effectivePosition(photo: Photo, points: SurveyPoint[]): Position | null {
  if (photo.override !== undefined) return photo.override;
  return matchPhoto(photo, points).point || photo.original;
}
export async function readPhoto(file: File): Promise<Photo> {
  let original: Position | null = null, metadataError: string | undefined, capturedAt:number|undefined;
  try {
    const tags = await exifr.parse(file, {gps:true, tiff:true, exif:true});
    const date=tags?.DateTimeOriginal ?? tags?.CreateDate;
    if(date instanceof Date && Number.isFinite(date.getTime()))capturedAt=date.getTime();
    if (tags && typeof tags.latitude === 'number' && typeof tags.longitude === 'number') {
      const altitude = number(tags.GPSAltitude);
      const p = {lat:tags.latitude, lon:tags.longitude, altitude:altitude===null?null:tags.GPSAltitudeRef===1?-Math.abs(altitude):altitude};
      if (validPosition(p)) original = p;
    }
  } catch { metadataError = 'EXIF konnte nicht gelesen werden; Export prüft die Datei erneut.'; }
  return {id:crypto.randomUUID(), file, url:URL.createObjectURL(file), original, metadataError, capturedAt};
}
export function projectToLatLon(x:number, y:number, crs:string): [number,number] {
  const [lon,lat] = proj4(crs, 'EPSG:4326', [x,y]);
  if (!validPosition({lat,lon,altitude:null})) throw new Error(t('Ungültige DXF-Koordinaten. Bitte Koordinatensystem prüfen.'));
  return [lat,lon];
}
