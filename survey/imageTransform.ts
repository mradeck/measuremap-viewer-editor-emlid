export interface ImageViewSize {width:number;height:number;imageWidth:number;imageHeight:number}
export interface ImageTransform {scale:number;x:number;y:number}
export const FIT_IMAGE:ImageTransform={scale:1,x:0,y:0};
export function clampImage(view:ImageViewSize,transform:ImageTransform):ImageTransform {
  const scale=Math.min(16,Math.max(1,transform.scale));
  if(!view.width||!view.height||!view.imageWidth||!view.imageHeight)return {scale,x:0,y:0};
  const fit=Math.min(view.width/view.imageWidth,view.height/view.imageHeight);
  const maxX=Math.max(0,(view.imageWidth*fit*scale-view.width)/2),maxY=Math.max(0,(view.imageHeight*fit*scale-view.height)/2);
  return {scale,x:Math.max(-maxX,Math.min(maxX,transform.x)),y:Math.max(-maxY,Math.min(maxY,transform.y))};
}
export function zoomImage(view:ImageViewSize,current:ImageTransform,factor:number,point:{x:number;y:number}):ImageTransform {
  const scale=Math.min(16,Math.max(1,current.scale*factor)),ratio=scale/current.scale;
  return clampImage(view,{scale,x:point.x-(point.x-current.x)*ratio,y:point.y-(point.y-current.y)*ratio});
}
