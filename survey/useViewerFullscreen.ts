import {useEffect,useRef,useState} from 'react';

/** Keep the same viewer mounted, including its map, photo and navigation state. */
export function useViewerFullscreen() {
  const ref=useRef<HTMLElement>(null);
  const [native,setNative]=useState(false),[expanded,setExpanded]=useState(false);
  useEffect(()=>{
    const sync=()=>setNative(document.fullscreenElement===ref.current);
    document.addEventListener('fullscreenchange',sync);
    return()=>document.removeEventListener('fullscreenchange',sync);
  },[]);
  useEffect(()=>{
    if(!expanded&&!native)return;
    const previous=document.body.style.overflow;
    if(expanded)document.body.style.overflow='hidden';
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();
        if(document.fullscreenElement===ref.current)void document.exitFullscreen().catch(()=>{});
        else setExpanded(false);
      }
    };
    window.addEventListener('keydown',escape,true);
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape,true);};
  },[expanded,native]);
  async function toggle(){
    if(document.fullscreenElement===ref.current){await document.exitFullscreen();return;}
    if(expanded){setExpanded(false);return;}
    const viewer=ref.current;if(!viewer)return;
    if(document.fullscreenEnabled&&viewer.requestFullscreen){
      try{await viewer.requestFullscreen();return;}catch{/* Browser restriction: fill the window instead. */}
    }
    setExpanded(true);
  }
  return {ref,active:native||expanded,expanded,toggle};
}
