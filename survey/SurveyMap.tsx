import {translate as t} from '../ui/translations';
import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import {usePreferences} from '../ui/preferences';
import 'leaflet/dist/leaflet.css';
import type {Photo,SurveyPoint,Position} from './model';
import {effectivePosition,matchPhoto} from './model';
import {photoPinSize} from './photo-marker';
import type {Drawing} from './dxf';
export const MAX_MAP_ZOOM=26;
export const ALKIS_URL='https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte';
export const ALKIS_STYLES={farbe:'by_alkis_parzellarkarte_farbe',grau:'by_alkis_parzellarkarte_grau',gelb:'by_alkis_parzellarkarte_umr_gelb',schwarz:'by_alkis_parzellarkarte_umr_schwarz'};
interface Props {previousPoint:boolean;photos:Photo[];points:SurveyPoint[];selected:string|null;onSelect:(id:string)=>void;onPreview:(id:string|null)=>void;onOpen:(id:string)=>void;drawing:Drawing|null;hiddenLayers:string[];showDxf:boolean;labels:boolean;showPoints:boolean;showPhotos:boolean;alkis:boolean;style:keyof typeof ALKIS_STYLES;opacity:number;fit:number;placing:boolean;onPlace:(p:Position)=>void;onError:(s:string)=>void}
export default function SurveyMap(props:Props) {
  const {language}=usePreferences();
  const [zoomLevel,setZoomLevel]=useState(18);
  const zoom=useRef<L.Control.Zoom>(),skipPan=useRef(false);
  const photoMarkers=useRef(new Map<string,L.Marker>()),hoveredPhoto=useRef<string|null>(null);
  const node=useRef<HTMLDivElement>(null),map=useRef<L.Map>(),overlay=useRef<L.LayerGroup>(),wms=useRef<L.TileLayer.WMS>();
  const latest=useRef(props);latest.current=props;
  useEffect(()=>{
    const m=L.map(node.current!,{maxZoom:MAX_MAP_ZOOM,zoomControl:false}).setView([48.30723,11.65589],18);map.current=m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:MAX_MAP_ZOOM,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m);
    overlay.current=L.layerGroup().addTo(m);
    m.on('zoomend',()=>setZoomLevel(m.getZoom()));
    m.on('click',e=>{if(latest.current.placing)latest.current.onPlace({lat:e.latlng.lat,lon:e.latlng.lng,altitude:null});});
    const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(node.current!);
    return()=>{observer.disconnect();m.remove();map.current=undefined;};
  },[]);
  useEffect(()=>{if(zoom.current)map.current!.removeControl(zoom.current);zoom.current=L.control.zoom({zoomInTitle:t('Vergrößern'),zoomOutTitle:t('Verkleinern')}).addTo(map.current!);},[language]);
  useEffect(()=>{
    const m=map.current!;if(wms.current){m.removeLayer(wms.current);wms.current=undefined;}
    if(!props.alkis)return;
    const layer=L.tileLayer.wms(ALKIS_URL,{layers:ALKIS_STYLES[props.style],format:'image/png',transparent:true,version:'1.1.1',opacity:props.opacity,maxNativeZoom:22,maxZoom:MAX_MAP_ZOOM,attribution:'© Bayerische Vermessungsverwaltung · <a href="https://www.ldbv.bayern.de/produkte/weitere/opendata.html">LDBV</a> · <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>'});
    layer.on('tileerror',()=>latest.current.onError(t("ALKIS konnte nicht geladen werden. Internetverbindung bzw. Dienst prüfen.")));
    layer.addTo(m);wms.current=layer;
  },[props.alkis,props.style,props.opacity]);
  useEffect(()=>{
    const g=overlay.current!;g.clearLayers();photoMarkers.current.clear();hoveredPhoto.current=null;latest.current.onPreview(null);
    if(props.showDxf && props.drawing) for(const f of props.drawing.features) {
      if(props.hiddenLayers.includes(f.layer))continue;
      if(f.kind==='line')L.polyline(f.coords,{color:'#f1b954',weight:2,opacity:.9}).addTo(g);
      else if(f.kind==='point')L.circleMarker(f.coords[0],{radius:2,color:'#f1b954',weight:1}).addTo(g);
      else if(props.labels) {const el=document.createElement('span');el.textContent=f.text||'';L.marker(f.coords[0],{interactive:false,icon:L.divIcon({className:'dxf-label',html:el,iconSize:[110,20]})}).addTo(g);}
    }
    if(props.showPoints)for(const p of props.points)L.circleMarker([p.lat,p.lon],{radius:3,color:'#74cfca',weight:1,fillOpacity:.55}).bindTooltip(t('PUNKT {name}',{name:p.name})).addTo(g);
    // Small screen-space stacks reveal at most five slots at any zoom.
    // Every Leaflet marker retains the exact geographic anchor.
    const groups=new Map<string,number>();
    for(const p of props.showPhotos?props.photos:[]) {
      const pos=effectivePosition(p,props.points,props.previousPoint);if(!pos)continue;
      const pixel=map.current!.project([pos.lat,pos.lon]);
      const key=`${Math.round(pixel.x/36)},${Math.round(pixel.y/36)}`,n=groups.get(key)||0;groups.set(key,n+1);
      const hitbox=document.createElement('div');hitbox.className='photo-pin-hitbox';
      const div=document.createElement('div');hitbox.appendChild(div);div.className=`photo-pin ${p.id===props.selected?'selected':''} ${p.excluded?'excluded':''}`;
      const img=document.createElement('img');img.alt=p.file.name;img.draggable=false;div.appendChild(img);
      const badge=document.createElement('b');badge.textContent=matchPhoto(p,props.points,props.previousPoint).point?.name||'GPS';div.appendChild(badge);
      const sizePin=()=>{
        const size=photoPinSize(img.naturalWidth,img.naturalHeight);
        hitbox.style.width=`${size.width}px`;hitbox.style.height=`${size.height}px`;
        hitbox.style.left=`${-size.width/2+(n%5)*9}px`;hitbox.style.top=`${-size.height-8-(n%5)*5}px`;
      };
      sizePin();img.onload=sizePin;img.src=p.url;
      const marker=L.marker([pos.lat,pos.lon],{icon:L.divIcon({html:hitbox,className:'photo-marker',iconSize:[0,0],iconAnchor:[0,0]}),zIndexOffset:p.id===props.selected?1000:100}).on('click',()=>{if(p.id!==latest.current.selected)skipPan.current=true;latest.current.onSelect(p.id);}).on('dblclick',e=>{L.DomEvent.stopPropagation(e.originalEvent);latest.current.onOpen(p.id);}).addTo(g);
      // Only the unscaled hitbox receives pointer events. Enlarged cards cannot
      // steal the pointer from their neighbours or keep hover alive outside it.
      hitbox.addEventListener('mouseenter',()=>{
        hoveredPhoto.current=p.id;div.classList.add('is-hovered');marker.setZIndexOffset(2000);latest.current.onPreview(p.id);
      });
      hitbox.addEventListener('mouseleave',()=>{
        div.classList.remove('is-hovered');marker.setZIndexOffset(p.id===latest.current.selected?1000:100);
        if(hoveredPhoto.current===p.id){hoveredPhoto.current=null;latest.current.onPreview(null);}
      });
      photoMarkers.current.set(p.id,marker);
    }
  },[props.photos,props.points,props.drawing,props.hiddenLayers,props.showDxf,props.labels,props.showPoints,props.showPhotos,props.previousPoint,language,zoomLevel]);
  useEffect(()=>{
    for(const [id,marker] of photoMarkers.current){
      marker.getElement()?.querySelector('.photo-pin')?.classList.toggle('selected',id===props.selected);
      marker.setZIndexOffset(id===hoveredPhoto.current?2000:id===props.selected?1000:100);
    }
  },[props.selected,props.photos,props.points,zoomLevel,props.drawing,props.hiddenLayers,props.showDxf,props.labels,props.showPoints,props.showPhotos,props.previousPoint,language]);
  useEffect(()=>{
    const coords:[number,number][]=[];
    for(const p of props.photos){const pos=effectivePosition(p,props.points,props.previousPoint);if(pos)coords.push([pos.lat,pos.lon]);}
    if(!coords.length)for(const p of props.points)coords.push([p.lat,p.lon]);
    if(props.drawing)for(const f of props.drawing.features)coords.push(...f.coords);
    if(coords.length)map.current!.fitBounds(L.latLngBounds(coords).pad(.2),{maxZoom:20});
  },[props.fit]);
  useEffect(()=>{
    if(skipPan.current){skipPan.current=false;return;}
    const p=props.photos.find(p=>p.id===props.selected),pos=p&&effectivePosition(p,props.points,props.previousPoint);
    if(pos){
      const m=map.current!;
      // Keep the selected location above the floating photo strip.
      const center=m.unproject(m.project([pos.lat,pos.lon]).add([0,m.getSize().y*.16]));
      m.panTo(center,{animate:true,duration:.35});
    }
  },[props.selected,props.previousPoint]);
  return <div ref={node} data-zoom={zoomLevel} className={`survey-map ${props.placing?'placing':''}`} aria-label={t("Karte mit Fotos und Vermessungspunkten")}/>;
}
