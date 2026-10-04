import React from 'react';
import {ExternalLink,Coffee,Github,Info} from 'lucide-react';
import {VERSION} from '../survey/model';
import {translate as t} from './translations';
import {usePreferences} from './preferences';

export default function Footer({onInfo}:{onInfo?:()=>void}){
  usePreferences();
  const apps=[
    ['Pointcloudmanager','https://pointcloud-manager.com/'],
    ['SkyCheck','https://skycheck-de.netlify.app/'],
    ['Geoid Forge','https://geoid-forge.netlify.app/'],
    ['DXF Coordinate Forge','https://dxf-coordinate-forge.netlify.app/'],
    ['GPS / UTM Converter','https://mradeck.github.io/gps-utm-coordinate-converter/'],
    ['Geodata Inspector & Cleaner','https://geodata-inspector-cleaner.netlify.app/'],
  ];
  const resources=[
    ['OpenStreetMap','https://www.openstreetmap.org/copyright'],
    ['ALKIS · LDBV','https://www.ldbv.bayern.de/produkte/weitere/opendata.html'],
    [t('Datenlizenz Deutschland 2.0'),'https://www.govdata.de/dl-de/by-2-0'],
    [t('Impressum'),'https://www.multikopterschule.de/Kontakt-Impressum/IMPRESSUM/'],
    ['michael-radeck.de','https://www.michael-radeck.de'],
  ];
  const link=([label,url]:string[])=><a key={url} href={url} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={11}/></a>;
  return <footer className="app-footer">
    <nav className="footer-links footer-apps" aria-label={t('Weitere Apps')}>
      <strong className="footer-group-label">{t('Weitere Apps')}</strong>
      {apps.map(link)}
    </nav>
    <div className="footer-local">
      <div className="footer-intro"><strong>MeasureMap <span>{VERSION}</span></strong><span>{t('JPEG-Export ohne Neukompression · Originaldateien bleiben erhalten')}</span></div>
      <nav className="footer-links" aria-label={t('Quellen und Links')}>
        {resources.map(link)}
        <a href="https://github.com/mradeck/measuremap-viewer-editor-emlid" target="_blank" rel="noopener noreferrer"><Github size={13}/> GitHub</a>
        <a href="https://ko-fi.com/mradeck/tip" target="_blank" rel="noopener noreferrer"><Coffee size={13}/> Ko-fi</a>
        {onInfo&&<button onClick={onInfo}><Info size={13}/>{t('Formate, Datenschutz & Google Fotos')}</button>}
      </nav>
      <div className="footer-bottom"><span>© 2026 Michael Radeck · measuremap-viewer-editor-emlid</span><span>{t('Fotos lokal · Karten von OpenStreetMap und Bayerischer Vermessungsverwaltung')}</span></div>
    </div>
  </footer>;
}
