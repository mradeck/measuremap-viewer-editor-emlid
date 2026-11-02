import React from 'react';
import {VERSION_NUMBER} from '../survey/model';
import {useOpenDialog,REPO} from './dialogs';
import {translate as t} from './translations';
import {usePreferences} from './preferences';

/** Gemeinsame Fußleisten der öffentlichen Apps von Michael Radeck: erst „Weitere Apps“, darunter Autor, Version und Links. */
export const RELATED_APPS:ReadonlyArray<readonly [string,string]>=[
  ['Geodata Inspector & Cleaner','https://geodata-inspector-cleaner.netlify.app/'],
  ['GeoTIFF Inspector','https://mradeck.github.io/geotiff-inspector/'],
  ['Geoid-TIFF 2 PGM Converter','https://geoid-tiff2pgm-converter.netlify.app/'],
  ['DXF Coordinate Forge','https://dxf-coordinate-forge.netlify.app/'],
  ['PointCloud Manager','https://www.pointcloud-manager.com'],
  ['GPS / UTM Converter','https://mradeck.github.io/gps-utm-coordinate-converter/'],
  ['SkyCheck','https://skycheck-de.netlify.app/'],
  ['michael-radeck.de','https://www.michael-radeck.de'],
];
const external={target:'_blank',rel:'noopener noreferrer'} as const;

export default function Footer({onInfo}:{onInfo?:()=>void}){
  usePreferences();
  const open=useOpenDialog();
  const year=new Date().getFullYear();
  return <footer className="app-footer">
    <nav className="related-apps" aria-label={t('Weitere Apps')}>
      <strong>{t('Weitere Apps')}</strong>
      {RELATED_APPS.map(([label,url])=><a key={url} href={url} {...external}>{label} <span aria-hidden="true">↗</span></a>)}
    </nav>
    <div className="footer-meta">
      <span>{t('Ein Werkzeug von Michael Radeck')} · © {year} · {t('Version')} {VERSION_NUMBER}</span>
      <nav className="footer-links" aria-label={t('Hilfe und rechtliche Hinweise')}>
        <a href="https://www.openstreetmap.org/copyright" {...external}>OpenStreetMap ↗</a>
        <a href="https://www.ldbv.bayern.de/produkte/weitere/opendata.html" {...external}>ALKIS · LDBV ↗</a>
        <a href="https://www.govdata.de/dl-de/by-2-0" {...external}>{t('Datenlizenz Deutschland 2.0')} ↗</a>
        {onInfo&&<button type="button" onClick={onInfo}>{t('Formate, Datenschutz & Google Fotos')}</button>}
        <a href={REPO} {...external}>{t('Quellcode')} ↗</a>
        <button type="button" onClick={()=>open('support')}>{t('Hilfe / Bugreport / Kontakt')}</button>
        <button type="button" onClick={()=>open('licenses')}>{t('Lizenzen / Copyright')}</button>
        <a href="https://www.multikopterschule.de/Kontakt-Impressum/IMPRESSUM/" {...external}>{t('Impressum')} ↗</a>
        <a href="https://ko-fi.com/mradeck/tip" {...external} aria-label={t('Michael Radeck auf Ko-fi unterstützen')}><span aria-hidden="true">☕</span> Ko-fi</a>
      </nav>
    </div>
  </footer>;
}
