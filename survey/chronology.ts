import type {Photo} from './model';
// Emlid embeds local capture time in the filename when EXIF is absent.
export function filenameTime(name:string):number|null {
  const m=/(?:^|_)(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?=\.[^.]+$)/.exec(name);
  if(!m)return null;
  const [y,mo,d,h,mi,s]=m.slice(1).map(Number),date=new Date(y,mo-1,d,h,mi,s);
  if(date.getFullYear()!==y||date.getMonth()!==mo-1||date.getDate()!==d||date.getHours()!==h||date.getMinutes()!==mi||date.getSeconds()!==s)return null;
  return date.getTime();
}
export function photoTime(photo:Photo):{time:number|null;source:'exif'|'filename'|'file'|'unknown'} {
  if(photo.capturedAt!=null&&Number.isFinite(photo.capturedAt))return {time:photo.capturedAt,source:'exif'};
  const filename=filenameTime(photo.file.name);
  if(filename!==null)return {time:filename,source:'filename'};
  if(photo.file.lastModified>0)return {time:photo.file.lastModified,source:'file'};
  return {time:null,source:'unknown'};
}
export function chronologicalPhotos(photos:Photo[]):Photo[] {
  return [...photos].sort((a,b)=>(photoTime(a).time??Infinity)-(photoTime(b).time??Infinity)||a.file.name.localeCompare(b.file.name,undefined,{numeric:true})||a.id.localeCompare(b.id));
}
