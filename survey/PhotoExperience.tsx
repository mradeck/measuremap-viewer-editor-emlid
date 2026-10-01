import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import type {Photo} from './model';
import PhotoDock from './PhotoDock';
import {translate as t} from '../ui/translations';

interface Props {showDock:boolean;photos:Photo[];selected:string|null;previewId:string|null;onSelect:(id:string)=>void;opened:boolean;onOpen:(id:string)=>void;onClose:()=>void}
export default function PhotoExperience(props:Props) {
  const [collapsed,setCollapsed]=useState(false);
  const region=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
  useEffect(()=>{
    const surface=region.current!.parentElement!;
    let wheelAmount=0,lastWheel=0;
    function active(){return surface.getClientRects().length>0&&latest.current.photos.length>0;}
    function move(delta:number){
      const p=latest.current,index=Math.max(0,p.photos.findIndex(photo=>photo.id===p.selected)),next=p.photos[index+delta];
      if(next)p.onSelect(next.id);
    }
    function key(e:KeyboardEvent){
      const target=e.target as HTMLElement;
      if(!active()||e.ctrlKey||e.metaKey||e.altKey||target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key==='Escape'&&latest.current.opened){e.preventDefault();latest.current.onClose();return;}
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();e.stopPropagation();
      if(e.key==='Home'||e.key==='End'){
        const photos=latest.current.photos;latest.current.onSelect(photos[e.key==='Home'?0:photos.length-1].id);
      }else move(e.key==='ArrowLeft'?-1:1);
    }
    function wheel(e:WheelEvent){
      if(!active()||e.ctrlKey||e.metaKey||e.altKey)return;
      const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.shiftKey?e.deltaY:0;
      if(!delta)return;
      e.preventDefault();e.stopPropagation();
      const now=performance.now();if(now-lastWheel<180)return;
      if(Math.sign(delta)!==Math.sign(wheelAmount))wheelAmount=0;
      wheelAmount+=delta*(e.deltaMode===1?16:e.deltaMode===2?surface.clientWidth:1);
      if(Math.abs(wheelAmount)>=24){move(Math.sign(wheelAmount));wheelAmount=0;lastWheel=now;}
    }
    document.addEventListener('keydown',key,true);
    surface.addEventListener('wheel',wheel,{passive:false,capture:true});
    return()=>{document.removeEventListener('keydown',key,true);surface.removeEventListener('wheel',wheel,true);};
  },[]);
  const current=props.photos.find(p=>p.id===props.selected);
  return <><div ref={region} className="photo-experience-anchor"/>
    {props.opened&&current&&<section className="large-photo-view" aria-label={t('Große Bildansicht')}>
      <img src={current.url} alt={current.file.name} onDoubleClick={props.onClose}/>
      <div className="large-photo-heading"><span>{current.file.name}</span><button className="icon-button" aria-label={t('Zurück zur Karte')} title={t('Zurück zur Karte')} onClick={props.onClose}><X size={20}/></button></div>
    </section>}
    {props.showDock&&<PhotoDock photos={props.photos} selected={props.selected} previewId={props.opened?null:props.previewId} onSelect={props.onSelect} onOpen={props.onOpen} collapsed={collapsed} onToggle={()=>setCollapsed(old=>!old)}/>}
  </>;
}
