import {translate as t} from '../ui/translations';
import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import {usePreferences} from '../ui/preferences';
import 'leaflet/dist/leaflet.css';
import type {Photo,SurveyPoint,Position} from './model';
import {effectivePosition,matchPhoto} from './model';
import {photoPinSize} from './photo-marker';
import type {Ortho} from './ortho';
import OrthoLayer from './OrthoLayer';
import type {Drawing} from './dxf';
import {areaVertices,type Mission} from '../dji/mission';
export const MAX_MAP_ZOOM=26;
export const ALKIS_URL='https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte';
export const ALKIS_STYLES={farbe:'by_alkis_parzellarkarte_farbe',grau:'by_alkis_parzellarkarte_grau',gelb:'by_alkis_parzellarkarte_umr_gelb',schwarz:'by_alkis_parzellarkarte_umr_schwarz'};
interface Props {editArea:boolean;onEditArea:(ring:number,index:number,op:'move'|'insert'|'delete',p?:{lat:number;lon:number})=>boolean;mission:Mission|null;selectedWaypoint:number;editDji:boolean;onSelectWaypoint:(i:number)=>void;onMoveWaypoint:(i:number,p:{lat:number;lon:number})=>void;ortho:Ortho|null;showOrtho:boolean;orthoOpacity:number;previousPoint:boolean;photos:Photo[];points:SurveyPoint[];selected:string|null;onSelect:(id:string)=>void;onPreview:(id:string|null)=>void;onOpen:(id:string)=>void;drawing:Drawing|null;hiddenLayers:string[];showDxf:boolean;labels:boolean;showPoints:boolean;showPhotos:boolean;alkis:boolean;style:keyof typeof ALKIS_STYLES;opacity:number;fit:number;placing:boolean;onPlace:(p:Position)=>void;onError:(s:string)=>void}
export default function SurveyMap(props:Props) {
  const {language,theme}=usePreferences();
  const [zoomLevel,setZoomLevel]=useState(18);
  const zoom=useRef<L.Control.Zoom>(),skipPan=useRef(false);
  const orthoLayer=useRef<OrthoLayer>();
  const photoMarkers=useRef(new Map<string,L.Marker>()),hoveredPhoto=useRef<string|null>(null);
  const node=useRef<HTMLDivElement>(null),map=useRef<L.Map>(),overlay=useRef<L.LayerGroup>(),cad=useRef<L.LayerGroup>(),surveyPoints=useRef<L.LayerGroup>(),dji=useRef<L.LayerGroup>(),wms=useRef<L.TileLayer.WMS>();
  const latest=useRef(props);latest.current=props;
  useEffect(()=>{
    const m=L.map(node.current!,{maxZoom:MAX_MAP_ZOOM,zoomControl:false,preferCanvas:true}).setView([48.30723,11.65589],18);map.current=m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxNativeZoom:19,maxZoom:MAX_MAP_ZOOM,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m);
    overlay.current=L.layerGroup().addTo(m);cad.current=L.layerGroup().addTo(m);surveyPoints.current=L.layerGroup().addTo(m);dji.current=L.layerGroup().addTo(m);
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
    const m=map.current!;if(orthoLayer.current){m.removeLayer(orthoLayer.current);orthoLayer.current=undefined;}
    if(props.ortho&&props.showOrtho){const layer=new OrthoLayer(props.ortho,props.orthoOpacity);layer.on('tileerror',()=>latest.current.onError(t('Orthofoto konnte nicht nachgeladen werden.')));layer.addTo(m);orthoLayer.current=layer;}
  },[props.ortho,props.showOrtho]);
  useEffect(()=>{orthoLayer.current?.setOpacity(props.orthoOpacity);},[props.orthoOpacity]);
  useEffect(()=>{
    const g=dji.current!;g.clearLayers();const mission=props.mission;if(!mission)return;
    mission.rings.forEach((ring,ri)=>{
      const vertices=areaVertices(ring),original=vertices.map(p=>[p.lat,p.lon] as [number,number]);
      const polygon=L.polygon(original,{color:'#9b5de5',weight:2,fillOpacity:.12,interactive:false}).addTo(g);
      if(!props.editArea)return;
      const extras:L.Marker[]=[];
      vertices.forEach((p,i)=>{
        const marker=L.marker([p.lat,p.lon],{draggable:true,icon:L.divIcon({className:'dji-area-vertex',html:String(i+1),iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:2400}).addTo(g);
        marker.bindTooltip(language==='de'?`Eckpunkt ${i+1} · ziehen oder anklicken`:`Vertex ${i+1} · drag or click`);
        const menu=document.createElement('div'),text=document.createElement('strong'),button=document.createElement('button');text.textContent=language==='de'?`Ring ${ri+1} · Eckpunkt ${i+1}`:`Ring ${ri+1} · vertex ${i+1}`;button.textContent=language==='de'?'Eckpunkt löschen':'Delete vertex';button.type='button';button.disabled=vertices.length<=3;button.className='dji-delete-vertex';button.addEventListener('click',()=>{latest.current.onEditArea(ri,i,'delete');map.current!.closePopup();});menu.append(text,button);marker.bindPopup(menu);
        marker.on('dragstart',()=>{map.current!.closePopup();extras.forEach(m=>g.removeLayer(m));}).on('drag',()=>{const q=marker.getLatLng(),preview=original.slice();preview[i]=[q.lat,q.lng];polygon.setLatLngs(preview);}).on('dragend',()=>{const q=marker.getLatLng();if(!latest.current.onEditArea(ri,i,'move',{lat:q.lat,lon:q.lng})){marker.setLatLng([p.lat,p.lon]);polygon.setLatLngs(original);extras.forEach(m=>g.addLayer(m));}});
        const next=vertices[(i+1)%vertices.length],mid:[number,number]=[(p.lat+next.lat)/2,(p.lon+next.lon)/2];
        const add=L.marker(mid,{draggable:true,icon:L.divIcon({className:'dji-area-insert',html:'+',iconSize:[20,20],iconAnchor:[10,10]}),zIndexOffset:2300}).addTo(g);extras.push(add);
        add.bindTooltip(language==='de'?'Eckpunkt einfügen · klicken oder ziehen':'Insert vertex · click or drag');
        add.on('click',()=>latest.current.onEditArea(ri,i,'insert')).on('dragstart',()=>map.current!.closePopup()).on('drag',()=>{const q=add.getLatLng(),preview=original.slice();preview.splice(i+1,0,[q.lat,q.lng]);polygon.setLatLngs(preview);}).on('dragend',()=>{const q=add.getLatLng();if(!latest.current.onEditArea(ri,i,'insert',{lat:q.lat,lon:q.lng})){add.setLatLng(mid);polygon.setLatLngs(original);}});
      });
    });
    const folders=new Map<number,[number,number][]>();for(const p of mission.points){const list=folders.get(p.folder)||[];list.push([p.lat,p.lon]);folders.set(p.folder,list);}
    for(const line of folders.values())L.polyline(line,{color:'#9b5de5',weight:3,opacity:.8,interactive:false}).addTo(g);
    mission.points.forEach((p,i)=>{
      const active=i===props.selectedWaypoint;
      if(!props.editDji&&!active){L.circleMarker([p.lat,p.lon],{radius:3,color:'#9b5de5',weight:1,fillOpacity:1}).bindTooltip(`WP ${p.index} · ${p.height} m`).on('click',()=>latest.current.onSelectWaypoint(i)).addTo(g);return;}
      L.marker([p.lat,p.lon],{draggable:props.editDji,icon:L.divIcon({className:`dji-waypoint ${active?'selected':''}`,html:String(i+1),iconSize:[22,22],iconAnchor:[11,11]}),zIndexOffset:2100}).bindTooltip(`WP ${p.index} · ${p.height} m · ${p.speed} m/s`).on('click',()=>latest.current.onSelectWaypoint(i)).on('dragend',e=>{const pos=e.target.getLatLng();latest.current.onSelectWaypoint(i);latest.current.onMoveWaypoint(i,{lat:pos.lat,lon:pos.lng});}).addTo(g);
    });
  },[props.mission,props.selectedWaypoint,props.editDji,props.editArea,language]);
  useEffect(()=>{
    const g=cad.current!;g.clearLayers();
    const foreground=getComputedStyle(node.current!).getPropertyValue('--s-text').trim();
    if(props.showDxf && props.drawing) for(const f of props.drawing.features) {
      if(props.hiddenLayers.includes(f.layer))continue;
      // Canvas strokeStyle needs a concrete color, not a CSS variable.
      const color=f.color==='var(--s-text)'?foreground:f.color;
      if(f.kind==='line')L.polyline(f.coords,{color,weight:2,opacity:.9,interactive:false}).addTo(g);
      else if(f.kind==='point')L.circleMarker(f.coords[0],{radius:2,color,weight:1,interactive:false}).addTo(g);
      else if(props.labels) {const el=document.createElement('span');el.textContent=f.text||'';el.style.color=color;L.marker(f.coords[0],{interactive:false,icon:L.divIcon({className:'dxf-label',html:el,iconSize:[110,20]})}).addTo(g);}
    }
  },[props.drawing,props.hiddenLayers,props.showDxf,props.labels,theme]);
  useEffect(()=>{
    const g=surveyPoints.current!;g.clearLayers();
    if(props.showPoints)for(const p of props.points)L.circleMarker([p.lat,p.lon],{radius:3,color:'#74cfca',weight:1,fillOpacity:.55}).bindTooltip(t('PUNKT {name}',{name:p.name})).addTo(g);
  },[props.points,props.showPoints,language]);
  useEffect(()=>{
    const g=overlay.current!;g.clearLayers();photoMarkers.current.clear();hoveredPhoto.current=null;latest.current.onPreview(null);
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
  },[props.photos,props.points,props.showPhotos,props.previousPoint,zoomLevel]);
  useEffect(()=>{
    for(const [id,marker] of photoMarkers.current){
      marker.getElement()?.querySelector('.photo-pin')?.classList.toggle('selected',id===props.selected);
      marker.setZIndexOffset(id===hoveredPhoto.current?2000:id===props.selected?1000:100);
    }
  },[props.selected,props.photos,props.points,zoomLevel,props.showPhotos,props.previousPoint]);
  useEffect(()=>{
    const coords:[number,number][]=[];
    for(const p of props.photos){const pos=effectivePosition(p,props.points,props.previousPoint);if(pos)coords.push([pos.lat,pos.lon]);}
    if(!coords.length)for(const p of props.points)coords.push([p.lat,p.lon]);
    if(props.drawing)for(const f of props.drawing.features)coords.push(...f.coords);
    if(props.ortho&&props.showOrtho)coords.push(...props.ortho.bounds);
    if(props.mission){coords.push(...props.mission.rings.flat().map(p=>[p.lat,p.lon] as [number,number]),...props.mission.points.map(p=>[p.lat,p.lon] as [number,number]));}
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
