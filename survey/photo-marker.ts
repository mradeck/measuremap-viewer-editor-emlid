/** Fit the complete image inside a small map pin, preserving its display ratio. */
export function photoPinSize(width:number,height:number) {
  const ratio=width>0&&height>0?width/height:1;
  const imageWidth=Math.min(44,36*ratio),imageHeight=Math.min(36,44/ratio);
  return {width:imageWidth+10,height:imageHeight+10};
}
