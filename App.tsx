import React,{useState,useEffect} from 'react';
import {ArrowLeft} from 'lucide-react';
import InspectorApp from './InspectorApp';
import SurveyApp from './survey/SurveyApp';
import {PreferencesProvider,AppearanceControls,usePreferences} from './ui/preferences';
import Footer from './ui/Footer';
import {translate as t} from './ui/translations';
import './ui/theme.css';
function Workspace(){
  usePreferences();
  const [inspector,setInspector]=useState(location.hash==='#inspector');
  useEffect(()=>{const update=()=>setInspector(location.hash==='#inspector');window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  return <><div style={{display:inspector?'none':undefined}}><SurveyApp openInspector={()=>{location.hash='inspector';setInspector(true);}}/></div>{inspector&&<><div className="inspector-toolbar"><button className="inspector-back" onClick={()=>{location.hash='';setInspector(false);}}><ArrowLeft size={16}/>{t('Zurück zur Fotokarte')}</button><AppearanceControls/></div><div className="legacy-inspector"><InspectorApp/></div><div className="inspector-footer"><Footer/></div></>}</>;
}
export default function App(){return <PreferencesProvider><Workspace/></PreferencesProvider>;}
