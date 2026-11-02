import {VERSION} from '../survey/model';
import React,{createContext,useContext,useState,useEffect} from 'react';
import LanguageFlag from './LanguageFlag';
import {setActiveLanguage,translate as t,type Language} from './translations';
/** Gewählter Interface-Modus; „auto“ folgt prefers-color-scheme. */
export type ThemeMode='auto'|'light'|'dark';
/** Tatsächlich dargestellte Farbe. */
export type Theme='dark'|'light';
export const storageKey='measuremap.preferences';
const darkQuery=()=>typeof matchMedia==='function'?matchMedia('(prefers-color-scheme: dark)'):null;
const browserLanguage=():Language=>/^de\b/i.test(typeof navigator!=='undefined'?navigator.language||'':'')?'de':'en';
const systemTheme=():Theme=>darkQuery()?.matches?'dark':'light';
function readPreferences():{language:Language;themeMode:ThemeMode}{
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');return {language:saved.language==='en'||saved.language==='de'?saved.language:browserLanguage(),themeMode:saved.theme==='dark'||saved.theme==='light'?saved.theme:'auto'};}
  catch{return {language:browserLanguage(),themeMode:'auto'};}
}
function savePreferences(preferences:{language:Language;themeMode:ThemeMode}){
  try{localStorage.setItem(storageKey,JSON.stringify({language:preferences.language,theme:preferences.themeMode}));}catch{/* nur für diese Sitzung */}
}
const Context=createContext<{language:Language;theme:Theme;themeMode:ThemeMode;toggleLanguage:()=>void;toggleTheme:()=>void}>({language:'de',theme:'light',themeMode:'auto',toggleLanguage:()=>{},toggleTheme:()=>{}});
export function PreferencesProvider({children}:{children:React.ReactNode}){
  const [preferences,setPreferences]=useState(readPreferences);
  const [system,setSystem]=useState<Theme>(systemTheme);
  useEffect(()=>{const query=darkQuery();if(!query)return;const update=()=>setSystem(query.matches?'dark':'light');query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  const theme:Theme=preferences.themeMode==='auto'?system:preferences.themeMode;
  setActiveLanguage(preferences.language);
  useEffect(()=>{const root=document.documentElement;root.lang=preferences.language;root.dataset.theme=theme;root.classList.toggle('dark',theme==='dark');document.title=`MeasureMap · ${VERSION}`;},[preferences,theme]);
  const update=(change:(p:typeof preferences)=>typeof preferences)=>setPreferences(p=>{const next=change(p);savePreferences(next);return next;});
  const value={language:preferences.language,theme,themeMode:preferences.themeMode,
    toggleLanguage:()=>update(p=>({...p,language:p.language==='de'?'en':'de'})),
    toggleTheme:()=>update(p=>({...p,themeMode:p.themeMode==='auto'?'light':p.themeMode==='light'?'dark':'auto'}))};
  return <Context.Provider value={value}><div className="theme-root" data-theme={theme}>{children}</div></Context.Provider>;
}
export const usePreferences=()=>useContext(Context);
/** Icons wie in den übrigen öffentlichen Apps: Halbkreis (automatisch), Sonne (hell), Mond (dunkel). */
function ThemeIcon({mode}:{mode:ThemeMode}){
  if(mode==='auto')return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>;
  if(mode==='light')return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>;
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" fill="currentColor"/></svg>;
}
const themeLabel=(mode:ThemeMode)=>mode==='auto'?t('Interface: automatisch (Systemeinstellung) — klicken für hell'):mode==='light'?t('Interface: hell — klicken für dunkel'):t('Interface: dunkel — klicken für automatisch');
export function AppearanceControls(){
  const {themeMode,language,toggleTheme,toggleLanguage}=usePreferences();
  const languageLabel=t('Sprache: Deutsch — zu Englisch wechseln');
  return <div className="appearance-controls">
    <button type="button" className="app-button app-button-quiet appearance-button theme-button" data-theme-mode={themeMode} aria-label={themeLabel(themeMode)} title={themeLabel(themeMode)} onClick={toggleTheme}><ThemeIcon mode={themeMode}/></button>
    <button type="button" className="app-button app-button-quiet appearance-button language-button" aria-label={languageLabel} title={languageLabel} onClick={toggleLanguage}><LanguageFlag language={language}/><span className="language-code">{language.toUpperCase()}</span></button>
  </div>;
}
