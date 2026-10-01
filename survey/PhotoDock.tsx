import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,ChevronDown,ChevronUp,Maximize2} from 'lucide-react';
import type {Photo} from './model';
import {photoTime} from './chronology';
import {translate as t} from '../ui/translations';
import {usePreferences} from '../ui/preferences';

export default function PhotoDock({photos,selected,previewId,onSelect,onOpen,collapsed,onToggle}:{photos:Photo[];selected:string|null;previewId:string|null;onSelect:(id:string)=>void;onOpen:(id:string)=>void;collapsed:boolean;onToggle:()=>void}) {
  const {language}=usePreferences();
  const index=Math.max(0,photos.findIndex(p=>p.id===selected));
  const previewIndex=photos.findIndex(p=>p.id===previewId),browsing=previewIndex<0?index:previewIndex;
  // Freeze the five slots while scrubbing: replacing them under the pointer
  // would otherwise cascade through the collection without a deliberate move.
  const [anchor,setAnchor]=useState<string|null>(null),[pointer,setPointer]=useState<number|null>(null);
  const strip=useRef<HTMLDivElement>(null);
  if(!photos.length)return null;
  const anchored=photos.findIndex(p=>p.id===anchor),center=anchored<0?browsing:anchored;
  const current=photos[browsing],stamp=photoTime(current);
  const date=stamp.time===null?t('Datum unbekannt'):new Date(stamp.time).toLocaleString(language==='de'?'de-DE':'en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const source=t(stamp.source==='exif'?'Aufnahme (EXIF)':stamp.source==='filename'?'Aufnahme (Dateiname)':stamp.source==='file'?'Dateidatum (Ersatz)':'Datum unbekannt');
  function move(delta:number){const next=photos[index+delta];if(next){setAnchor(null);setPointer(null);onSelect(next.id);}}
  return <section className={`photo-dock ${collapsed?'collapsed':''}`} aria-label={t('Fotoleiste nach Aufnahmedatum')}>
    <div className="dock-actions"><button className="dock-action" aria-label={t('Foto groß anzeigen')} title={t('Foto groß anzeigen')} onClick={()=>onOpen(current.id)}><Maximize2 size={14}/></button><button className="dock-action" aria-label={t(collapsed?'Fotoleiste ausklappen':'Fotoleiste einklappen')} title={t(collapsed?'Fotoleiste ausklappen':'Fotoleiste einklappen')} aria-expanded={!collapsed} onClick={onToggle}>{collapsed?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button></div>
    <div className="dock-navigation">
      <button className="dock-arrow" aria-label={t('Vorheriges Foto')} title={t('Vorheriges Foto')} aria-disabled={index===0} onClick={()=>move(-1)}><ChevronLeft size={20}/></button>
      {collapsed?<span className="dock-mini-count">{index+1} / {photos.length}</span>:<div className="dock-strip" ref={strip} onPointerEnter={e=>{if(e.pointerType==='mouse'){setAnchor(current.id);}}} onPointerMove={e=>{
        if(e.pointerType!=='mouse')return;
        const bounds=strip.current!.getBoundingClientRect();setPointer((e.clientX-bounds.left)/bounds.width*5-.5);
      }} onPointerLeave={()=>{setAnchor(null);setPointer(null);}}>
        {[-2,-1,0,1,2].map((offset,slot)=>{
          const photo=photos[center+offset];
          const distance=Math.abs(slot-(pointer??2)),scale=1+Math.max(0,1-distance/2.5)*.85;
          return <div className="dock-slot" key={slot} style={{zIndex:Math.round(20-distance*5)}}>{photo&&<button
            className={`dock-photo ${photo.id===selected?'active':''}`} style={{transform:`scale(${scale}) translateY(${-Math.max(0,1-distance/2.5)*12}px)`}}
            aria-label={photo.file.name} aria-pressed={photo.id===selected} title={photo.file.name}
            onPointerEnter={e=>{if(e.pointerType==='mouse')onSelect(photo.id);}}
            onFocus={()=>{setAnchor(photos[center]?.id??null);}}
            onClick={()=>onSelect(photo.id)} onDoubleClick={()=>onOpen(photo.id)}>
            <img src={photo.url} alt="" draggable={false}/><span>{center+offset+1}</span>
          </button>}</div>;
        })}
      </div>}
      <button className="dock-arrow" aria-label={t('Nächstes Foto')} title={t('Nächstes Foto')} aria-disabled={index===photos.length-1} onClick={()=>move(1)}><ChevronRight size={20}/></button>
    </div>
    {!collapsed&&<div className="dock-caption"><strong>{browsing+1} / {photos.length} · {current.file.name}</strong><span>{date} · {source}</span><small>{t('Doppelklick: großes Bild · Pfeiltasten / horizontales Mausrad')}</small></div>}
  </section>;
}
