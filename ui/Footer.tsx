import React from 'react';
import {ExternalLink,Coffee,Github,Info} from 'lucide-react';
import {VERSION} from '../survey/model';
import {translate as t} from './translations';
import {usePreferences} from './preferences';
export default function Footer({onInfo}:{onInfo?:()=>void}){
  usePreferences();
  const links=[['OpenStreetMap','https://www.openstreetmap.org/copyright'],['ALKIS · LDBV','https://www.ldbv.bayern.de/produkte/weitere/opendata.html'],[t('Datenlizenz Deutschland 2.0'),'https://www.govdata.de/dl-de/by-2-0'],['Pointcloudmanager','https://pointcloud-manager.com/'],['SkyCheck','https://skycheck-de.netlify.app/'],['Geodata Inspector & Cleaner','https://geodata-inspector-cleaner.netlify.app/'],[t('Impressum'),'https://www.multikopterschule.de/Kontakt-Impressum/IMPRESSUM/'],['michael-radeck.de','https://www.michael-radeck.de']];
  return <footer className="app-footer"><div className="footer-intro"><strong>MeasureMap <span>{VERSION}</span></strong><span>{t('JPEG-Export ohne Neukompression · Originaldateien bleiben erhalten')}</span></div><nav className="footer-links" aria-label={t('Quellen und Links')}>{links.map(([label,url])=><a key={url} href={url} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={11}/></a>)}<a href="https://github.com/mradeck/measuremap-viewer-editor-emlid" target="_blank" rel="noopener noreferrer"><Github size={13}/> GitHub</a><a href="https://ko-fi.com/mradeck/tip" target="_blank" rel="noopener noreferrer"><Coffee size={13}/> Ko-fi</a>{onInfo&&<button onClick={onInfo}><Info size={13}/>{t('Formate, Datenschutz & Google Fotos')}</button>}</nav><div className="footer-bottom"><span>© 2026 Michael Radeck · measuremap-viewer-editor-emlid</span><span>{t('Fotos lokal · Karten von OpenStreetMap und Bayerischer Vermessungsverwaltung')}</span></div></footer>;
}
