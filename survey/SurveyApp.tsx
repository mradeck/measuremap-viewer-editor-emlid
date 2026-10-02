import {translate as t} from '../ui/translations';
import React,{useState,useRef,useEffect,useMemo} from 'react';
import {Camera,MapPin,Upload,Download,Layers,FileSpreadsheet,ScanLine,LocateFixed,CheckCircle2,AlertTriangle,X,ChevronRight,Image as ImageIcon,Trash2,Info,Eye,EyeOff} from 'lucide-react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import SurveyMap,{ALKIS_STYLES} from './SurveyMap';
import PhotoExperience from './PhotoExperience';
import {chronologicalPhotos} from './chronology';
import {VERSION,CRS_OPTIONS,parseSurveyCsv,readPhoto,matchPhoto,effectivePosition,number,validPosition,type Photo,type SurveyPoint,type Position} from './model';
import {parseDrawing,visibleDrawing,type DrawingDocument} from './dxf';
import {geotagJpeg} from './jpeg';
import {readOrtho,type Ortho} from './ortho';
import './survey.css';
import {AppearanceControls,usePreferences} from '../ui/preferences';
import Footer from '../ui/Footer';

const methodLabel={csv:t("CSV-Dateiname"),name:t("Emlid-Punktname"),manual:t("Manuelle Zuordnung"),ambiguous:t("Mehrdeutige Zuordnung"),none:t("Keine CSV-Zuordnung"),shifted:t("Emlid: vorherige CSV-Zeile"),'offset-missing':t("Kein vorheriger Messpunkt")};
function save(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export default function SurveyApp({openInspector}:{openInspector:()=>void}) {
  const {language}=usePreferences();
  const fmt=(n:number|null|undefined,d=3)=>n===null||n===undefined?'—':n.toLocaleString(language==='de'?'de-DE':'en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
  const [photos,setPhotos]=useState<Photo[]>([]),[points,setPoints]=useState<SurveyPoint[]>([]),[selected,setSelected]=useState<string|null>(null);
  const [previousPoint,setPreviousPoint]=useState(true),[emlidFixInfo,setEmlidFixInfo]=useState(false);
  const [imageView,setImageView]=useState(false),[showPhotos,setShowPhotos]=useState(true);
  function openPhoto(id:string){selectPhoto(id);setImageView(true);}
  const [dockPreview,setDockPreview]=useState<string|null>(null);
  function selectPhoto(id:string){setDockPreview(null);setSelected(id);}
  useEffect(()=>setDockPreview(null),[selected]);
  const [ortho,setOrtho]=useState<Ortho|null>(null),[showOrtho,setShowOrtho]=useState(true),[orthoOpacity,setOrthoOpacity]=useState(1);
  const [drawings,setDrawings]=useState<DrawingDocument[]>([]),[crs,setCrs]=useState('EPSG:25832');
  const drawing=useMemo(()=>visibleDrawing(drawings),[drawings]);
  const [hiddenLayers]=useState<string[]>([]),[showDxf,setShowDxf]=useState(true),[labels,setLabels]=useState(false),[showPoints,setShowPoints]=useState(true);
  const [alkis,setAlkis]=useState(false),[style,setStyle]=useState<keyof typeof ALKIS_STYLES>('farbe'),[opacity,setOpacity]=useState(.75);
  const [fit,setFit]=useState(0),[placing,setPlacing]=useState(false),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[help,setHelp]=useState(false);
  const [csvName,setCsvName]=useState(''),[manualLat,setManualLat]=useState(''),[manualLon,setManualLon]=useState(''),[manualAlt,setManualAlt]=useState('');
  const gallery=useRef<HTMLDivElement>(null);
  const filesInput=useRef<HTMLInputElement>(null),folderInput=useRef<HTMLInputElement>(null),allPhotos=useRef<Photo[]>([]);allPhotos.current=photos;
  useEffect(()=>()=>{allPhotos.current.forEach(p=>URL.revokeObjectURL(p.url));},[]);
  const current=photos.find(p=>p.id===selected),match=current?matchPhoto(current,points,previousPoint):null,pos=current?effectivePosition(current,points,previousPoint):null;
  const exportable=photos.filter(p=>!p.excluded&&effectivePosition(p,points,previousPoint)&&/\.jpe?g$/i.test(p.file.name));
  const assigned=photos.filter(p=>matchPhoto(p,points,previousPoint).point&&p.override===undefined).length;
  const without=photos.filter(p=>!effectivePosition(p,points,previousPoint)).length;
  const orderedPhotos=useMemo(()=>chronologicalPhotos(photos),[photos]);
  const visible=orderedPhotos.filter(p=>(filter!=='missing'||!effectivePosition(p,points,previousPoint))&&(filter!=='rtk'||matchPhoto(p,points,previousPoint).point)&&(p.file.name.toLowerCase().includes(search.toLowerCase())));
  useEffect(()=>{
    const strip=gallery.current;if(!strip)return;
    function centerSelected(){
      const tile=strip!.querySelector<HTMLElement>('.photo-tile.active');
      if(!tile||!strip!.clientWidth)return;
      const frame=strip!.getBoundingClientRect(),item=tile.getBoundingClientRect();
      const desired=strip!.scrollLeft+item.left-frame.left-strip!.clientLeft+(item.width-strip!.clientWidth)/2;
      const left=Math.max(0,Math.min(desired,strip!.scrollWidth-strip!.clientWidth));
      strip!.scrollTo({left,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
    centerSelected();
    const observer=new ResizeObserver(centerSelected);observer.observe(strip);
    return()=>observer.disconnect();
  },[selected,photos,points,filter,search,previousPoint]);
  const layerNames=useMemo(()=>[...new Set(drawing?.features.map(f=>f.layer)||[])],[drawing]);
  useEffect(()=>{setPlacing(false);setManualLat(pos?String(pos.lat):'');setManualLon(pos?String(pos.lon):'');setManualAlt(pos?.altitude!=null?String(pos.altitude):'');},[selected,points,photos,previousPoint]);
  async function importFiles(input:File[]) {
    setBusy(t("Dateien einlesen …"));setError('');setNotice('');
    const warnings:string[]=[],errors:string[]=[],incoming:Photo[]=[];
    try {
      const expanded:File[]=[];
      for(const f of input) {
        if(/\.zip$/i.test(f.name)) {
          const zip=await JSZip.loadAsync(f);
          for(const entry of Object.values(zip.files))if(!entry.dir&&!entry.name.includes('__MACOSX')&&/\.(csv|dxf|tiff?|jpe?g|png|webp|heic|heif)$/i.test(entry.name)) {
            expanded.push(new File([new Uint8Array(await entry.async('uint8array')).buffer],entry.name.split('/').pop()!,{type:/\.jpe?g$/i.test(entry.name)?'image/jpeg':'',lastModified:entry.date.getTime()}));
          }
        } else expanded.push(f);
      }
      const csvs=expanded.filter(f=>/\.csv$/i.test(f.name));
      if(csvs.length>1)throw new Error(t("Bitte nur eine Vermessungs-CSV pro Import auswählen."));
      if(csvs[0]) {const parsed=parseSurveyCsv(await csvs[0].text());setPoints(parsed.points);setPreviousPoint(true);setCsvName(csvs[0].name);setPhotos(old=>old.map(p=>({...p,pointId:undefined})));if(parsed.skipped)warnings.push(t('{count} ungültige Zeilen übersprungen',{count:parsed.skipped}));}
      const dxfs=expanded.filter(f=>/\.dxf$/i.test(f.name));
      const importedDrawings:DrawingDocument[]=[];
      for(const file of dxfs){try{const source=await file.text();importedDrawings.push({...parseDrawing(source,file.name,crs),source,id:crypto.randomUUID(),visible:true,hiddenLayers:[]});}catch(e){errors.push(`${file.name}: ${e instanceof Error?e.message:String(e)}`);}}
      if(importedDrawings.length)setDrawings(old=>[...old,...importedDrawings]);
      const orthos=expanded.filter(f=>/\.tiff?$/i.test(f.name));
      if(orthos.length>1)throw new Error(t('Bitte nur ein Orthofoto pro Import auswählen.'));
      if(orthos[0]){setBusy(t('Orthofoto einlesen …'));const result=await readOrtho(orthos[0]);setOrtho(result);setShowOrtho(true);}
      const images=expanded.filter(f=>/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
      const seen=new Set(photos.map(p=>`${p.file.name}:${p.file.size}:${p.file.lastModified}`));
      for(let i=0;i<images.length;i++) {
        setBusy(t('Foto {index} / {total} lesen …',{index:i+1,total:images.length}));
        const file=images[i], key=`${file.name}:${file.size}:${file.lastModified}`;
        if(seen.has(key))continue;seen.add(key);
        try {incoming.push(await readPhoto(file));}catch(e){errors.push(`${file.name}: ${String(e)}`);}
      }
      if(incoming.length){setPhotos(old=>[...old,...incoming]);if(!selected)setSelected(chronologicalPhotos(incoming)[0].id);}
      if(!incoming.length&&!csvs.length&&!dxfs.length&&!orthos.length&&!errors.length)warnings.push(t("Keine neuen unterstützten Dateien gefunden."));
      setNotice(warnings.join(' · '));if(errors.length)setError(errors.join('\n'));setFit(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}
  }
  function updatePhoto(change:Partial<Photo>) {if(current)setPhotos(old=>old.map(p=>p.id===current.id?{...p,...change}:p));}
  function onPlace(p:Position){updatePhoto({override:p,pointId:null});setPlacing(false);setNotice(t("Manuelle Kartenposition gesetzt. RTK-Qualität wird dafür nicht übernommen."));}
  function manualSave(){const lat=number(manualLat),lon=number(manualLon),altitude=number(manualAlt);if(lat===null||lon===null||!validPosition({lat,lon,altitude})||manualAlt.trim()&&altitude===null){setError(t("Bitte gültige Koordinaten eingeben."));return;}setError('');updatePhoto({override:{lat,lon,altitude},pointId:null});}
  function changeDrawingCrs(id:string,value:string){try{const doc=drawings.find(d=>d.id===id);if(!doc)return;const parsed=parseDrawing(doc.source,doc.name,value);setDrawings(old=>old.map(d=>d.id===id?{...d,...parsed}:d));setFit(n=>n+1);setError('');}catch(e){setError(String(e));}}

  async function exportZip(onlyCurrent=false) {
    setError('');setBusy(t("Export vorbereiten …"));
    try {
      const list=onlyCurrent?exportable.filter(p=>p.id===selected):exportable;
      if(!list.length)throw new Error(t("Keine exportierbaren JPEG-Fotos mit Position."));
      const zip=new JSZip(),manifest:any[]=[],used=new Set<string>(),failed:string[]=[];
      for(let i=0;i<list.length;i++) {
        const photo=list[i],position=effectivePosition(photo,points,previousPoint)!,m=matchPhoto(photo,points,previousPoint),point=photo.override===undefined?m.point:null;
        setBusy(t('Metadaten schreiben {index} / {total} …',{index:i+1,total:list.length}));
        try {
          const input=new Uint8Array(await photo.file.arrayBuffer());
          const changed=!!point||photo.override!==undefined;
          const output=changed?geotagJpeg(input,position,point):input;
          let name=photo.file.name,n=2;while(used.has(name.toLowerCase()))name=photo.file.name.replace(/(\.[^.]+)$/,`_${n++}$1`);used.add(name.toLowerCase());
          zip.file(`photos/${name}`,output);
          manifest.push({file:name,originalFile:photo.file.name,modified:changed,source:point?'Emlid survey point':photo.override?'Manual':'Original EXIF',role:point?'SurveyPoint':'PhotoLocation',point:point?.name||'',latitude:position.lat,longitude:position.lon,exifAltitude:position.altitude,heightReference:point?point.heightReference:'Unspecified',crs:point?.crs||'',easting:point?.easting??'',northing:point?.northing??'',orthometricHeight:point?.elevation??'',ellipsoidalHeight:point?.ellipsoidal??'',solution:point?.solution||'',correction:point?.correction||'',assignmentCorrection:m.method==='shifted'?'previous-csv-row':'',originalAssignmentPoint:m.sourcePoint?.name||'',originalAssignmentRecord:m.sourcePoint?.raw||null,originalPosition:photo.original,surveyRecord:point?.raw||null});
        }catch(e){failed.push(`${photo.file.name}: ${e instanceof Error?e.message:String(e)}`);}
      }
      if(!manifest.length)throw new Error(failed.join('\n'));
      zip.file('positions.json',JSON.stringify({version:VERSION,previousCsvPointCorrection:previousPoint,files:manifest,failed},null,2));
      zip.file('positions.csv',Papa.unparse(manifest.map(({surveyRecord,originalPosition,originalAssignmentRecord,...row})=>row)));
      zip.file('README.txt',[
        `MeasureMap ${VERSION}`, 'EXIF GPS + MetaLens Survey XMP.',
        t('Emlid-Positionen sind vermessene Punkte, keine belegten Kameraposen.'),
        t('EXIF-Höhe: CSV Elevation. Höhenbezug und Ellipsoid-/UTM-Daten im XMP.'),
        t('Originale wurden nicht verändert.'),
        t(previousPoint?'Emlid-Korrektur: vorherige CSV-Zeile aktiv. Manuelle Zuordnungen bleiben erhalten.':'Emlid-Korrektur: aus.'),
        `${t('Nicht exportiert')}: ${photos.length-list.length} ${t('Fotos (nicht ausgewählt, ohne Position oder kein JPEG).')}`,
        `${t('Fehlgeschlagen')}: ${failed.length}`,failed.join('\n')
      ].join('\n'));

      const blob=await zip.generateAsync({type:'blob',compression:'STORE'},m=>setBusy(t('ZIP erstellen {percent} % …',{percent:Math.round(m.percent)})));
      save(blob,`MeasureMap-${VERSION}-${onlyCurrent?t("Foto"):'geotagged'}.zip`);
      setNotice(t('{count} Fotos exportiert. {skipped} nicht ausgewählt / ohne Position / kein JPEG.',{count:manifest.length,skipped:photos.length-list.length}));
      if(failed.length)setError(t('{count} Fotos konnten nicht exportiert werden:',{count:failed.length})+'\n'+failed.join('\n'));
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}
  }
  return <div className="survey-shell" onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!busy)void importFiles(Array.from(e.dataTransfer.files));}}>
    <header className="survey-header"><div className="brand-mark"><ScanLine size={24}/></div><div className="brand-word">MeasureMap <span>VIEWER · EDITOR · EMLID</span></div><span className="version">{VERSION}</span><div className="header-spacer"/><AppearanceControls/><span className="local-badge"><span/> {t("Lokal im Browser")}</span><button className="quiet-button" onClick={openInspector}>{t("Metadaten-Inspektor ")}<ChevronRight size={15}/></button><button className="icon-button" aria-label={t("Hilfe")} onClick={()=>setHelp(true)}><Info size={20}/></button></header>
    <div className="survey-titlebar"><div><div className="eyebrow">{t("VERMESSUNG & FOTODOKUMENTATION")}</div><h1>{t("Fotos. Präzise verortet.")}</h1><p>{t("Messpunkte zuordnen, auf der Karte prüfen und Positionsdaten ins Originalformat schreiben.")}</p></div><button className="primary-button" disabled={!!busy||!exportable.length} onClick={()=>void exportZip()}><Download size={17}/> {t("Fotos exportieren ")}<span>{exportable.length}</span></button></div>
    <main className="workspace-grid">
      <aside className="import-panel"><div className="panel-title"><span>{t("Projektdateien")}</span><span className="step">01</span></div>
        <input ref={filesInput} type="file" aria-label={t("Projektdateien auswählen")} multiple accept=".csv,.dxf,.tif,.tiff,.zip,.jpg,.jpeg,.png,.webp,.heic,.heif" hidden onChange={e=>{if(e.target.files)void importFiles(Array.from(e.target.files));e.target.value='';}}/>
        <input ref={folderInput} type="file" aria-label={t("Fotoordner auswählen")} multiple {...({webkitdirectory:'',directory:''} as any)} hidden onChange={e=>{if(e.target.files)void importFiles(Array.from(e.target.files));e.target.value='';}}/>
        <button className="drop-zone" disabled={!!busy} onClick={()=>filesInput.current?.click()}><div className="upload-symbol"><Upload size={23}/></div><strong>{t("Dateien hinzufügen")}</strong><span>{t("Fotos, Emlid-CSV, DXF, GeoTIFF oder ZIP")}</span><small>{t("Hier ablegen oder auswählen")}</small></button>
        <button className="secondary-button full" disabled={!!busy} onClick={()=>folderInput.current?.click()}><Camera size={16}/> {t("Fotoordner öffnen")}</button>
        <div className="source-row"><FileSpreadsheet size={18}/><div><strong>{csvName||'Emlid CSV'}</strong><small>{points.length?t('{count} Messpunkte',{count:points.length})+' · '+(points[0]?.crs||t('CRS unbekannt')):t("Noch keine Messpunkte geladen")}</small></div><span className={`source-dot ${points.length?'loaded':''}`}/></div>
        <div className="emlid-fix-controls"><button className={`secondary-button emlid-fix-button ${previousPoint?'active':''}`} disabled={!!busy||!points.length} aria-pressed={previousPoint} onClick={()=>{setPreviousPoint(old=>!old);setDockPreview(null);}}>{t('Emlid: einen Messpunkt zurück')}<span>{t(previousPoint?'An':'Aus')}</span></button><button className="icon-button" aria-label={t('Info zur Emlid-Korrektur')} title={t('Info zur Emlid-Korrektur')} aria-expanded={emlidFixInfo} onClick={()=>setEmlidFixInfo(old=>!old)}><Info size={18}/></button></div>
        {emlidFixInfo&&<section className="emlid-fix-info" aria-label={t('Info zur Emlid-Korrektur')}><p>{t('Beobachteter Emlid-Versatz: Ein Foto des gerade gespeicherten Messpunkts kann im Export beim nächsten Messpunkt stehen. Diese Option ordnet automatisch verknüpfte Fotos stattdessen dem vorherigen Messpunkt zu.')}</p><p>{t('Maßgeblich ist die Reihenfolge der CSV-Zeilen, nicht die Punktnummer minus eins. Manuelle Punktzuordnungen, manuelle Positionen und reine GPS-Fotos bleiben unverändert.')}</p><p>{t('Ohne gültige vorherige CSV-Zeile wird keine Position übernommen. Ausschalten stellt die ursprüngliche automatische Zuordnung wieder her. Bei neuer CSV ist die Korrektur standardmäßig aktiv.')}</p><p>{t('Karte, RTK-Messwerte und JPEG-Export verwenden dieselbe korrigierte Zuordnung. Die ursprüngliche Zuordnung wird im Exportprotokoll festgehalten.')}</p></section>}
        <div className="source-row"><Layers size={18}/><div><strong>{drawings.length?t("{count} DXF-Dateien",{count:drawings.length}):t("DXF-Zeichnung")}</strong><small>{drawing?t('{count} Elemente · {layers} Layer',{count:drawing.features.length,layers:layerNames.length}):t("Optionaler Vermessungsplan")}</small></div><span className={`source-dot ${drawing?'loaded':''}`}/></div>
        <div className="source-row"><ImageIcon size={18}/><div><strong>{ortho?.name||t("Orthofoto · GeoTIFF")}</strong><small>{ortho?`${ortho.width} × ${ortho.height} · ${ortho.crs}`:t("Georeferenziertes TIFF hinzufügen")}</small></div><span className={`source-dot ${ortho?'loaded':''}`}/></div>
        <div className="divider"/><div className="panel-title"><span>{t("Kartenebenen")}</span><span className="step">02</span></div>
        <label className="toggle-row"><span>OpenStreetMap</span><span className="always-on">{t("AKTIV")}</span></label>
        <label className="toggle-row"><span>{t("ALKIS Bayern")}</span><input type="checkbox" checked={alkis} onChange={e=>setAlkis(e.target.checked)}/></label>
        {alkis&&<div className="layer-options"><label>{t("Darstellung")}<select aria-label={t("ALKIS-Darstellung")} value={style} onChange={e=>setStyle(e.target.value as keyof typeof ALKIS_STYLES)}><option value="farbe">{t("Farbe")}</option><option value="grau">{t("Grau")}</option><option value="gelb">{t("Umriss gelb")}</option><option value="schwarz">{t("Umriss schwarz")}</option></select></label><label>{t("Deckkraft ")}<span>{Math.round(opacity*100)} %</span><input aria-label={t("ALKIS-Deckkraft")} type="range" min="0" max="1" step=".05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><small>{t("Flurstücke in Bayern · LDBV")}</small></div>}
        {ortho&&<><label className="toggle-row"><span>{t("Orthofoto")}</span><input type="checkbox" checked={showOrtho} onChange={e=>setShowOrtho(e.target.checked)}/></label><div className="layer-options"><label>{t("Deckkraft ")}<span>{Math.round(orthoOpacity*100)} %</span><input aria-label={t("Orthofoto-Deckkraft")} type="range" min="0" max="1" step=".05" value={orthoOpacity} onChange={e=>setOrthoOpacity(Number(e.target.value))}/></label><small>{t("Detailansicht in Originalauflösung. Bildbereiche werden beim Zoomen lokal nachgeladen.")}</small><button className="quiet-button" onClick={()=>setOrtho(null)}>{t("Orthofoto entfernen")}</button></div></>}
        <label className="toggle-row"><span>{t("Messpunkte ")}<small>{points.length}</small></span><input type="checkbox" checked={showPoints} onChange={e=>setShowPoints(e.target.checked)}/></label>
        <label className="toggle-row"><span>{t("DXF-Overlay")}</span><input type="checkbox" checked={showDxf} onChange={e=>setShowDxf(e.target.checked)}/></label>
        <label className="field-label">{t("DXF-CRS für neue Dateien")}<select aria-label={t("DXF-CRS für neue Dateien")} value={crs} onChange={e=>setCrs(e.target.value)}>{CRS_OPTIONS.map(c=><option key={c}>{c}</option>)}</select></label>
        {!!drawings.length&&<><label className="toggle-row"><span>{t("DXF-Beschriftungen")}</span><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/></label><div className="dxf-documents">{drawings.map(doc=><section key={doc.id} className="dxf-document"><div className="dxf-document-heading"><label><input type="checkbox" aria-label={t('DXF anzeigen: {name}',{name:doc.name})} checked={doc.visible} onChange={e=>setDrawings(old=>old.map(d=>d.id===doc.id?{...d,visible:e.target.checked}:d))}/><strong title={doc.name}>{doc.name}</strong></label><button className="quiet-button" aria-label={t('DXF entfernen: {name}',{name:doc.name})} title={t('DXF entfernen: {name}',{name:doc.name})} onClick={()=>setDrawings(old=>old.filter(d=>d.id!==doc.id))}><X size={14}/></button></div><select aria-label={t('DXF-Koordinatensystem: {name}',{name:doc.name})} value={doc.crs} onChange={e=>changeDrawingCrs(doc.id,e.target.value)}>{CRS_OPTIONS.map(c=><option key={c}>{c}</option>)}</select><small>{t('{count} Elemente',{count:doc.features.length})}</small><div className="dxf-layers">{[...new Set(doc.features.map(f=>f.layer))].map(layer=><label key={layer}><input type="checkbox" aria-label={`${doc.name} · ${layer}`} checked={!doc.hiddenLayers.includes(layer)} onChange={e=>setDrawings(old=>old.map(d=>d.id===doc.id?{...d,hiddenLayers:e.target.checked?d.hiddenLayers.filter(l=>l!==layer):[...d.hiddenLayers,layer]}:d))}/><i className="dxf-color" style={{background:doc.features.find(f=>f.layer===layer)?.color}}/>{layer}</label>)}</div>{doc.unsupported.length>0&&<small>{t("Nicht dargestellt: ")}{doc.unsupported.join(', ')}</small>}</section>)}</div></>}

        <div className="privacy-note"><LocateFixed size={16}/><p>{t("Fotos und Messdaten bleiben auf diesem Gerät. Die Karte lädt OSM- und optionale ALKIS-Kacheln.")}</p></div>
      </aside>
      <section className="map-panel"><div className="map-toolbar"><div><span className="status-dot"/> {t("Positionsübersicht ")}<small>{assigned} {t("mit Messpunkt · ")}{without} {t("ohne Position")}</small></div><div className="map-toolbar-actions"><button className="icon-button" aria-label={t(showPhotos?"Foto-Thumbnails ausblenden":"Foto-Thumbnails einblenden")} title={t(showPhotos?"Foto-Thumbnails ausblenden":"Foto-Thumbnails einblenden")} aria-pressed={!showPhotos} onClick={()=>{setShowPhotos(old=>!old);setDockPreview(null);}}>{showPhotos?<Eye size={18}/>:<EyeOff size={18}/>}</button><button className="quiet-button" onClick={()=>setFit(n=>n+1)}><LocateFixed size={15}/> {t("Alles zeigen")}</button></div></div>
        <SurveyMap ortho={ortho} showOrtho={showOrtho} orthoOpacity={orthoOpacity} photos={photos} points={points} selected={selected} previousPoint={previousPoint} onSelect={selectPhoto} onPreview={setDockPreview} onOpen={openPhoto} drawing={drawing} hiddenLayers={hiddenLayers} showDxf={showDxf} labels={labels} showPoints={showPoints} showPhotos={showPhotos} alkis={alkis} style={style} opacity={opacity} fit={fit} placing={placing} onPlace={onPlace} onError={setError}/>
        <PhotoExperience photos={orderedPhotos} selected={selected} previewId={dockPreview} onSelect={selectPhoto} opened={imageView} onOpen={openPhoto} onClose={()=>setImageView(false)}/>
        {placing&&<div className="map-message">{t("Auf die gewünschte Position klicken.")}<button onClick={()=>setPlacing(false)}>{t("Abbrechen")}</button></div>}
        {!photos.length&&!points.length&&!drawing&&!ortho&&<div className="map-empty"><MapPin size={25}/><strong>{t("Dein Projekt auf der Karte")}</strong><span>{t("Fotos und die zugehörige CSV hinzufügen.")}</span></div>}
        <div className="map-legend"><span><i className="mint-dot"/> {t("Messpunkt")}</span><span><i className="amber-line"/> DXF</span><span><ImageIcon size={12}/> {t("Foto")}</span></div>
      </section>
      <aside className="detail-panel"><div className="panel-title"><span>{t("Foto & Position")}</span><span className="step">03</span></div>
        {current?<><div className="photo-preview" onDoubleClick={()=>openPhoto(current.id)}><img src={current.url} alt={current.file.name} onError={e=>{e.currentTarget.alt=t("Bildvorschau wird von diesem Browser nicht unterstützt.");}}/><span>{match?.point&&current.override===undefined?t('PUNKT {name}',{name:match.point.name}):t("FOTO")}</span></div><h2>{current.file.name}</h2><div className={`position-state ${pos?'good':'warning'}`}>{pos?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>} {current.override?t("Manuelle Position"):match?.point?t("Messpunkt zugeordnet"):current.original?t("GPS aus Original"):t("Position fehlt")}</div>
        {current.metadataError&&<p className="warning-text">{t(current.metadataError)}</p>}
        <label className="field-label">{t("Vermessungspunkt")}<select aria-label={t("Vermessungspunkt zuordnen")} value={current.pointId===undefined?'auto':current.pointId||'none'} onChange={e=>updatePhoto({pointId:e.target.value==='auto'?undefined:e.target.value==='none'?null:e.target.value,override:undefined})}><option value="auto">{t("Automatisch zuordnen")}</option><option value="none">{t("Keine CSV-Zuordnung / Original-GPS")}</option>{points.map(p=><option key={p.id} value={p.id}>{p.name} · {p.solution} · {p.raw.Code}</option>)}</select></label>
        <small className="match-method">{match&&t(methodLabel[match.method])}</small>
        {match?.sourcePoint&&<p className={match.point?'point-note':'warning-text'}>{match.point?t('CSV-Punkt {source} → {target}',{source:match.sourcePoint.name,target:match.point.name}):t('Kein gültiger vorheriger CSV-Messpunkt. Foto manuell zuordnen.')}</p>}
        <div className="coordinate-card"><div><span>{t("Breitengrad")}</span><strong>{fmt(pos?.lat,8)}°</strong></div><div><span>{t("Längengrad")}</span><strong>{fmt(pos?.lon,8)}°</strong></div><div><span>{match?.point&&current.override===undefined?t("NHN / EXIF-Höhe"):t("EXIF-Höhe")}</span><strong>{fmt(pos?.altitude)} m</strong></div></div>
        {match?.point&&current.override===undefined&&<><div className="rtk-heading"><span>{t("VERMESSUNGSDATEN")}</span><b>{match.point.correction} {match.point.solution}</b></div><dl className="survey-values"><div><dt>{t("Koordinatensystem")}</dt><dd>{match.point.crs||t("Unbekannt")}</dd></div><div><dt>UTM Easting</dt><dd>{fmt(match.point.easting)} m</dd></div><div><dt>UTM Northing</dt><dd>{fmt(match.point.northing)} m</dd></div><div><dt>{t("Ellipsoidhöhe")}</dt><dd>{fmt(match.point.ellipsoidal)} m</dd></div><div><dt>Lateral RMS</dt><dd>{fmt(number(match.point.raw['Lateral RMS']))} m</dd></div></dl><p className="point-note">{t("Position des vermessenen Punktes. Kameraversatz und Blickrichtung sind nicht bekannt.")}</p></>}
        <details className="manual-details"><summary>{t("Position manuell bearbeiten")}</summary><label>{t("Breitengrad")}<input value={manualLat} onChange={e=>setManualLat(e.target.value)} inputMode="decimal"/></label><label>{t("Längengrad")}<input value={manualLon} onChange={e=>setManualLon(e.target.value)} inputMode="decimal"/></label><label>{t("Höhe in m (optional)")}<input value={manualAlt} onChange={e=>setManualAlt(e.target.value)} inputMode="decimal"/></label><button className="secondary-button full" onClick={manualSave}>{t("Koordinaten übernehmen")}</button><button className="secondary-button full" onClick={()=>setPlacing(true)}><MapPin size={14}/> {t("Auf Karte setzen")}</button></details>
        <label className="toggle-row"><span>{t("Im Export enthalten")}</span><input type="checkbox" checked={!current.excluded} onChange={e=>updatePhoto({excluded:!e.target.checked})}/></label>
        {!/\.jpe?g$/i.test(current.file.name)&&<p className="warning-text">{t("Dieses Format lässt sich anzeigen und verorten. Metadatenexport benötigt ein JPEG-Original.")}</p>}
        <button className="secondary-button full" disabled={!!busy||!exportable.some(p=>p.id===selected)} onClick={()=>void exportZip(true)}><Download size={15}/> {t("Dieses Foto exportieren")}</button>
        <button className="quiet-button full" onClick={()=>{URL.revokeObjectURL(current.url);setPhotos(old=>old.filter(p=>p.id!==current.id));setSelected(photos.find(p=>p.id!==current.id)?.id||null);}}><Trash2 size={14}/> {t("Foto entfernen")}</button>
        </>:<div className="detail-empty"><Camera size={34}/><h2>{t("Ein Foto auswählen")}</h2><p>{t("Vorschau, Position und RTK-Messwerte erscheinen hier.")}</p><div>EXIF GPS + XMP<br/><span>{t("UTM · Höhen · Messqualität")}</span></div></div>}
      </aside>
      <section className="gallery-panel"><div className="gallery-toolbar"><div><strong>{t("Fotos")}</strong><span>{photos.length}</span></div><div className="filter-buttons">{[['all',t("Alle")],['rtk',t("Mit Messpunkt")],['missing',t("Ohne Position")]].map(([v,label])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{t(label)}</button>)}</div><input aria-label={t("Fotos suchen")} placeholder={t("Dateiname suchen …")} value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="gallery-scroll" ref={gallery}>{visible.length?visible.map(p=>{const m=matchPhoto(p,points,previousPoint),position=effectivePosition(p,points,previousPoint);return <button key={p.id} className={`photo-tile ${selected===p.id?'active':''} ${p.excluded?'excluded':''}`} onClick={()=>selectPhoto(p.id)} onDoubleClick={()=>openPhoto(p.id)}><img src={p.url} alt={p.file.name} loading="lazy"/><span className={`tile-badge ${position?'good':'warning'}`}>{p.override?t("MANUELL"):m.point?`P ${m.point.name} · ${m.point.solution}`:position&&p.original?'GPS':t("OHNE POSITION")}</span><strong>{p.file.name}</strong><small>{p.excluded?t("Vom Export ausgeschlossen"):m.point&&p.override===undefined?t("EXIF + RTK bereit"):position?t("Position verfügbar"):t("Zuordnung erforderlich")}</small></button>}):<div className="gallery-empty"><ImageIcon size={22}/><span>{photos.length?t("Keine Fotos für diesen Filter."):t("Noch keine Fotos. Emlid-Export oder Handyfotos hinzufügen.")}</span></div>}</div>
      </section>
    </main>
    <Footer onInfo={()=>setHelp(true)}/>
    {(busy||notice||error)&&<div className={`notice ${error?'error':''}`} role={error?'alert':'status'}>{busy?<span className="spinner"/>:error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{(busy||error||notice).split('\n').map(line=>line.split(' · ').map(part=>t(part)).join(' · ')).join('\n')}</span>{!busy&&<button aria-label={t("Meldung schließen")} onClick={()=>{setError('');setNotice('');}}><X size={17}/></button>}</div>}
    {help&&<div className="help-backdrop" onClick={()=>setHelp(false)}><section className="help-dialog" role="dialog" aria-modal="true" aria-label={t("Import und Metadaten")} onClick={e=>e.stopPropagation()}><button className="icon-button help-close" aria-label={t("Hilfe schließen")} onClick={()=>setHelp(false)}><X/></button><div className="eyebrow">MEASUREMAP · EMLID</div><h2>{t("Vom Messpunkt zum Foto.")}</h2><ol><li>{t("CSV und Fotos gemeinsam laden – als Ordner, ZIP oder einzelne Dateien.")}</li><li>{t("Zuordnung über „Point photos“ prüfen. Alternativ einen Punkt manuell auswählen.")}</li><li>{t("DXF laden und das richtige Koordinatensystem einstellen; Standard: ETRS89 / UTM 32N.")}</li><li>{t("Fotos als ZIP mit eingebetteten EXIF-/XMP-Daten und Positionsprotokoll exportieren.")}</li></ol><h3>{t("Welche Metadaten werden geschrieben?")}</h3><p>{t("EXIF GPSLatitude/GPSLongitude mit hoher Speicherpräzision, GPSAltitude aus „Elevation“ (NHN) und vorhandene laterale RMS. XMP im MetaLens-Survey-Namensraum enthält originale UTM-Koordinaten, beide Höhenarten, RTK-Status und den vollständigen CSV-Datensatz. Eine manuelle Kartenposition trägt keine RTK-Qualitätsangabe.")}</p><p>{t("Eine Messpunktposition ist keine gemessene Kamerapose. Drohnen-XMP wird nicht erfunden. Im Pointcloudmanager sind die exportierten Fotos über den Handyfoto-/GPS-Import verwendbar; sein Drohnenimport benötigt separate Kameraposen.")}</p><h3>{t("Handyfotos & Google Fotos")}</h3><p>{t("Lokale JPEG-Originale mit GPS werden direkt erkannt. PNG, WebP und HEIC/HEIF können eingelesen werden; Vorschau hängt vom Browser ab. Das Schreiben von Metadaten unterstützt JPEG.")}</p><p>{t("Google Fotos kann mit der Picker API und Google-OAuth angebunden werden. Diese Version hat keine aktive Google-Verknüpfung: Dafür fehlen eine OAuth-Client-ID und eine freigegebene Webadresse. Ein beliebiges Album wird nicht dauerhaft synchronisiert. Google entfernt Standortmetadaten beim API-Download – CSV-Zuordnung oder manuelle Position bleibt daher erforderlich.")}</p><a href="https://developers.google.com/photos/picker/guides/media-items" target="_blank" rel="noreferrer">{t("Google Fotos: offizielle Schnittstellendokumentation ↗")}</a><h3>{t("Karte und Datenschutz")}</h3><p>{t("Fotos und CSV werden im Browser verarbeitet. OSM und ALKIS erhalten Kartenanfragen für den sichtbaren Ausschnitt. ALKIS liefert Daten nur in Bayern. DXF ohne Koordinatensystem kann nicht automatisch korrekt eingeordnet werden. Nicht unterstützte DXF-Elementtypen werden gemeldet.")}</p></section></div>}
  </div>;
}
