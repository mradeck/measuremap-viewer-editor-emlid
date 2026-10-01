import {useEffect,useRef,useState} from 'react';
import {Minus,Plus,ScanLine,X} from 'lucide-react';
import type {Photo} from './model';
import {translate as t} from '../ui/translations';
import {FIT_IMAGE,clampImage,zoomImage,type ImageViewSize,type ImageTransform} from './imageTransform';

export default function ImageViewer({photo,onClose}:{photo:Photo;onClose:()=>void}) {
  const node=useRef<HTMLElement>(null),image=useRef<HTMLImageElement>(null);
  const size=useRef<ImageViewSize>({width:0,height:0,imageWidth:0,imageHeight:0});
  const [transform,setTransform]=useState<ImageTransform>(FIT_IMAGE),current=useRef(transform);current.current=transform;
  const drag=useRef<{id:number;x:number;y:number;start:ImageTransform}|null>(null),[dragging,setDragging]=useState(false);
  function apply(value:ImageTransform){current.current=value;setTransform(value);}
  function measure(){
    const el=node.current,img=image.current;if(!el||!img)return;
    size.current={width:el.clientWidth,height:el.clientHeight,imageWidth:img.naturalWidth,imageHeight:img.naturalHeight};
    apply(clampImage(size.current,current.current));
  }
  function zoom(factor:number,point={x:0,y:0}){apply(zoomImage(size.current,current.current,factor,point));}
  useEffect(()=>{
    const el=node.current!;measure();
    const observer=new ResizeObserver(measure);observer.observe(el);
    function wheel(e:WheelEvent){
      if(!e.ctrlKey)return;
      e.preventDefault();e.stopPropagation();
      const bounds=el.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1);
      zoom(Math.exp(-Math.max(-500,Math.min(500,delta))*.002),{x:e.clientX-bounds.left-bounds.width/2,y:e.clientY-bounds.top-bounds.height/2});
    }
    el.addEventListener('wheel',wheel,{passive:false});
    return()=>{observer.disconnect();el.removeEventListener('wheel',wheel);};
  },[]);
  function stopDrag(id:number){if(drag.current?.id===id){drag.current=null;setDragging(false);if(node.current?.hasPointerCapture(id))node.current.releasePointerCapture(id);}}
  return <section ref={node} className={`large-photo-view ${dragging?'dragging':''}`} aria-label={t('Große Bildansicht')} data-scale={transform.scale} onPointerDown={e=>{
    if(!e.altKey||e.button!==0||(e.target as HTMLElement).closest('button')||current.current.scale<=1)return;
    e.preventDefault();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:current.current};setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={e=>{
    const active=drag.current;if(!active||active.id!==e.pointerId)return;
    e.preventDefault();apply(clampImage(size.current,{...active.start,x:active.start.x+e.clientX-active.x,y:active.start.y+e.clientY-active.y}));
  }} onPointerUp={e=>stopDrag(e.pointerId)} onPointerCancel={e=>stopDrag(e.pointerId)} onLostPointerCapture={()=>{drag.current=null;setDragging(false);}}>
    <img ref={image} src={photo.url} alt={photo.file.name} draggable={false} onLoad={measure} style={{transform:`translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`}} onDoubleClick={e=>{if(!e.altKey&&!e.ctrlKey)onClose();}}/>
    <div className="large-photo-heading"><span>{photo.file.name}</span><button className="icon-button" aria-label={t('Zurück zur Karte')} title={t('Zurück zur Karte')} onClick={onClose}><X size={20}/></button></div>
    <div className="image-zoom-controls" role="group" aria-label={t('Bildzoom')}>
      <button aria-label={t('Bild verkleinern')} title={t('Bild verkleinern')} disabled={transform.scale<=1} onClick={()=>zoom(1/1.5)}><Minus size={16}/></button>
      <span>{Math.round(transform.scale*100)} %</span>
      <button aria-label={t('Bild vergrößern')} title={t('Bild vergrößern')} disabled={transform.scale>=16} onClick={()=>zoom(1.5)}><Plus size={16}/></button>
      <button className="image-fit" aria-label={t('Bild einpassen')} title={t('Bild einpassen')} onClick={()=>apply(FIT_IMAGE)}><ScanLine size={16}/>{t('Einpassen')}</button>
    </div>
    <div className="image-gesture-hint">{t('Strg + Mausrad: Zoom · Alt + Ziehen: Verschieben')}</div>
  </section>;
}
