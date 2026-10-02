import {VERSION} from '../survey/model';
import React,{createContext,useContext,useState,useEffect} from 'react';
import {Sun,Moon} from 'lucide-react';
import LanguageFlag from './LanguageFlag';
import {setActiveLanguage,translate as t,type Language} from './translations';
export type Theme='dark'|'light';
const storageKey='measuremap.preferences';
function readPreferences():{language:Language;theme:Theme}{
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');return {language:saved.language==='en'?'en':'de',theme:saved.theme==='light'?'light':'dark'};}
  catch{return {language:'de',theme:'dark'};}
}
const Context=createContext<{language:Language;theme:Theme;toggleLanguage:()=>void;toggleTheme:()=>void}>({language:'de',theme:'dark',toggleLanguage:()=>{},toggleTheme:()=>{}});
export function PreferencesProvider({children}:{children:React.ReactNode}){
  const [preferences,setPreferences]=useState(readPreferences);
  setActiveLanguage(preferences.language);
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch{} document.documentElement.lang=preferences.language;document.documentElement.dataset.theme=preferences.theme;document.documentElement.classList.toggle('dark',preferences.theme==='dark');document.title=`MeasureMap · ${VERSION}`;},[preferences]);
  const value={...preferences,toggleLanguage:()=>setPreferences(p=>({...p,language:p.language==='de'?'en':'de'})),toggleTheme:()=>setPreferences(p=>({...p,theme:p.theme==='dark'?'light':'dark'}))};
  return <Context.Provider value={value}><div className="theme-root" data-theme={preferences.theme}>{children}</div></Context.Provider>;
}
export const usePreferences=()=>useContext(Context);
export function AppearanceControls(){
  const {theme,language,toggleTheme,toggleLanguage}=usePreferences();
  return <div className="appearance-controls"><button type="button" className="appearance-button" aria-label={theme==='dark'?t('Helles Interface aktivieren'):t('Dunkles Interface aktivieren')} title={theme==='dark'?t('Helles Interface aktivieren'):t('Dunkles Interface aktivieren')} onClick={toggleTheme}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button><button type="button" className="appearance-button language-button" aria-label={t('Sprache wechseln')} title={language==='de'?'Switch to English':'Auf Deutsch wechseln'} onClick={toggleLanguage}><LanguageFlag language={language}/><span className="language-code">{language.toUpperCase()}</span></button></div>;
}
