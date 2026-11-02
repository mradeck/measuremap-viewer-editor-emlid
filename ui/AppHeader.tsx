import React,{useEffect,useRef} from 'react';
import {ScanLine,Info} from 'lucide-react';
import {VERSION} from '../survey/model';
import {translate as t} from './translations';
import {AppearanceControls,usePreferences} from './preferences';
import {useOpenDialog} from './dialogs';

/** Menü „Über“ (Position 1 der festen Kopfleisten-Reihenfolge): Über mich und Copyright. */
function AboutMenu(){
  const open=useOpenDialog(),menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const close=(e:Event)=>{const d=menu.current;if(d?.open&&!(e.target instanceof Node&&d.contains(e.target)))d.open=false;};
    const key=(e:KeyboardEvent)=>{const d=menu.current;if(e.key==='Escape'&&d?.open){d.open=false;d.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};
  },[]);
  const choose=(name:'about'|'licenses')=>{if(menu.current)menu.current.open=false;open(name);};
  return <details ref={menu} className="app-header-menu">
    <summary className="app-button app-button-quiet">{t('Über')}</summary>
    <div className="app-header-menu-panel">
      <button type="button" onClick={()=>choose('about')}>{t('Über mich')}</button>
      <button type="button" onClick={()=>choose('licenses')}>{t('Copyright')}</button>
    </div>
  </details>;
}

/**
 * Kopfleiste wie beim Geodata Inspector & Cleaner: Marke links, rechts zuerst die app-spezifische
 * Aktion, dann fest Über · Hilfe (i) · Interface · Sprache.
 */
export default function AppHeader({action,onHelp}:{action:React.ReactNode;onHelp:()=>void}){
  usePreferences();
  return <header className="app-topbar">
    <a className="app-brand" href="#" aria-label={t('MeasureMap Startseite')}>
      <span className="app-brand-mark" aria-hidden="true"><ScanLine size={17}/></span>
      <span className="app-brand-copy">
        <span className="app-brand-title-line"><strong>MeasureMap</strong><span className="app-brand-version">{VERSION}</span></span>
        <small>Viewer · Editor · Emlid</small>
      </span>
    </a>
    <div className="app-privacy-chip"><span/><span>{t('Lokal im Browser')}</span></div>
    <nav className="app-top-actions" aria-label={t('App-Aktionen')}>
      {action}
      <AboutMenu/>
      <button type="button" className="app-button app-button-quiet app-icon-button" aria-label={t('Hilfe')} title={t('Hilfe')} onClick={onHelp}><Info size={18}/></button>
      <AppearanceControls/>
    </nav>
  </header>;
}
