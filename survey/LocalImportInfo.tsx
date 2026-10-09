import {useState} from 'react';
import {Info} from 'lucide-react';
import {translate as t} from '../ui/translations';

export default function LocalImportInfo(){
  const [hover,setHover]=useState(false),[focus,setFocus]=useState(false),[pinned,setPinned]=useState(false);
  const visible=hover||focus||pinned;
  return <div className="local-import-info" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onBlur={event=>{
    if(!event.currentTarget.contains(event.relatedTarget as Node|null)){setFocus(false);setPinned(false);}
  }} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setHover(false);setFocus(false);setPinned(false);}
  }}>
    <button type="button" className="icon-button" aria-label={t('Info zur lokalen Fotoauswahl')} aria-describedby="local-import-tooltip" aria-expanded={visible} onFocus={event=>setFocus(event.currentTarget.matches(':focus-visible'))} onClick={()=>setPinned(value=>!value)}><Info size={18}/></button>
    <div id="local-import-tooltip" role="tooltip" className="local-import-tooltip" hidden={!visible}>{t('Hier werden keine Bilder ins Internet hochgeladen. MeasureMap liest Fotos und Projektdateien ausschließlich lokal im Browser. Die Browsermeldung „Upload“ bezeichnet die Freigabe zum Lesen der ausgewählten Dateien. Alternativ kannst du über „Dateien hinzufügen“ mehrere Bilder direkt markieren.')}</div>
  </div>;
}
