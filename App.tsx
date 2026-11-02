import React,{useState,useEffect} from 'react';
import {ArrowLeft} from 'lucide-react';
import InspectorApp from './InspectorApp';
import SurveyApp from './survey/SurveyApp';
import HelpDialog from './survey/HelpDialog';
import {PreferencesProvider,usePreferences} from './ui/preferences';
import {DialogsProvider} from './ui/dialogs';
import AppHeader from './ui/AppHeader';
import Footer from './ui/Footer';
import {translate as t} from './ui/translations';
import './ui/theme.css';
function Workspace(){
  usePreferences();
  const [inspector,setInspector]=useState(location.hash==='#inspector'),[help,setHelp]=useState(false);
  useEffect(()=>{const update=()=>setInspector(location.hash==='#inspector');window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  const back=()=>{location.hash='';setInspector(false);};
  return <><div style={{display:inspector?'none':undefined}}><SurveyApp openInspector={()=>{location.hash='inspector';setInspector(true);}}/></div>{inspector&&<><div className="inspector-topbar"><AppHeader onHelp={()=>setHelp(true)} action={<button type="button" className="app-button app-button-quiet app-action-button" onClick={back}><ArrowLeft size={14}/>{t('Zurück zur Fotokarte')}</button>}/></div><div className="legacy-inspector"><InspectorApp/></div><div className="inspector-footer"><Footer onInfo={()=>setHelp(true)}/></div>{help&&<HelpDialog onClose={()=>setHelp(false)}/>}</>}</>;
}
export default function App(){return <PreferencesProvider><DialogsProvider><Workspace/></DialogsProvider></PreferencesProvider>;}
