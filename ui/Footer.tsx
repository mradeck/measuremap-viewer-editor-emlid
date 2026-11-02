import React,{useRef} from 'react';
import {VERSION} from '../survey/model';
import {translate as t} from './translations';
import {usePreferences} from './preferences';

/** Gemeinsame Fußleisten der öffentlichen Apps von Michael Radeck: erst „Weitere Apps“, darunter Autor, Version und Links. */
export const RELATED_APPS:ReadonlyArray<readonly [string,string]>=[
  ['Geodata Inspector & Cleaner','https://geodata-inspector-cleaner.netlify.app/'],
  ['GeoTIFF Inspector','https://mradeck.github.io/geotiff-inspector/'],
  ['Geoid Forge','https://geoid-forge.netlify.app/'],
  ['DXF Coordinate Forge','https://dxf-coordinate-forge.netlify.app/'],
  ['PointCloud Manager','https://www.pointcloud-manager.com'],
  ['GPS / UTM Converter','https://mradeck.github.io/gps-utm-coordinate-converter/'],
  ['SkyCheck','https://skycheck-de.netlify.app/'],
  ['michael-radeck.de','https://www.michael-radeck.de'],
];
const MAIL='michael.radeck@email.de';
const REPO='https://github.com/mradeck/measuremap-viewer-editor-emlid';
const external={target:'_blank',rel:'noopener noreferrer'} as const;

export default function Footer({onInfo}:{onInfo?:()=>void}){
  usePreferences();
  const support=useRef<HTMLDialogElement>(null),licenses=useRef<HTMLDialogElement>(null);
  const open=(dialog:React.RefObject<HTMLDialogElement>)=>{const d=dialog.current;if(!d)return;if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');};
  const subject=(kind:'bug'|'contact')=>`MeasureMap ${VERSION} – ${kind==='bug'?t('Bugreport'):t('Kontakt / Hilfe')}`;
  const bugHref=`mailto:${MAIL}?subject=${encodeURIComponent(subject('bug'))}&body=${encodeURIComponent(['Schritte zum Fehler:','Erwartetes Ergebnis:','Tatsächliches Ergebnis / Fehlermeldung:','Browser und Betriebssystem:','Bitte keine Fotos oder vertraulichen Projektdaten anhängen.'].map(line=>t(line)).join('\n\n'))}`;
  const contactHref=`mailto:${MAIL}?subject=${encodeURIComponent(subject('contact'))}`;
  const year=new Date().getFullYear();
  const close=<form method="dialog"><button type="submit" aria-label={t('Schließen')}>×</button></form>;
  return <footer className="app-footer">
    <nav className="related-apps" aria-label={t('Weitere Apps')}>
      <strong>{t('Weitere Apps')}</strong>
      {RELATED_APPS.map(([label,url])=><a key={url} href={url} {...external}>{label} <span aria-hidden="true">↗</span></a>)}
    </nav>
    <div className="footer-meta">
      <span>{t('Ein Werkzeug von Michael Radeck')} · © {year} · {t('Version')} {VERSION}</span>
      <nav className="footer-links" aria-label={t('Hilfe und rechtliche Hinweise')}>
        <a href="https://www.openstreetmap.org/copyright" {...external}>OpenStreetMap ↗</a>
        <a href="https://www.ldbv.bayern.de/produkte/weitere/opendata.html" {...external}>ALKIS · LDBV ↗</a>
        <a href="https://www.govdata.de/dl-de/by-2-0" {...external}>{t('Datenlizenz Deutschland 2.0')} ↗</a>
        {onInfo&&<button type="button" onClick={onInfo}>{t('Formate, Datenschutz & Google Fotos')}</button>}
        <a href={REPO} {...external}>{t('Quellcode')} ↗</a>
        <button type="button" onClick={()=>open(support)}>{t('Hilfe / Bugreport / Kontakt')}</button>
        <button type="button" onClick={()=>open(licenses)}>{t('Lizenzen / Copyright')}</button>
        <a href="https://www.multikopterschule.de/Kontakt-Impressum/IMPRESSUM/" {...external}>{t('Impressum')} ↗</a>
        <a href="https://ko-fi.com/mradeck/tip" {...external} aria-label={t('Michael Radeck auf Ko-fi unterstützen')}><span aria-hidden="true">☕</span> Ko-fi</a>
      </nav>
    </div>
    <dialog ref={support} className="footer-dialog" aria-labelledby="footer-support-title">
      <div className="dlg-head"><h2 id="footer-support-title">{t('Hilfe / Bugreport / Kontakt')}</h2>{close}</div>
      <div className="dlg-body">
        <p>{t('Fragen zur Bedienung, einen Fehler gefunden oder eine Idee für die App?')}</p>
        <div className="actions">
          <a className="btn" href={`${REPO}#readme`} {...external}>{t('Anleitung (README) öffnen')}</a>
          <a className="btn" href={bugHref}>{t('Bugreport per E-Mail')}</a>
          <a className="btn" href={contactHref}>{t('Kontakt per E-Mail')}</a>
        </div>
        <p className="addr">{MAIL}</p>
        <p>{t('Für einen Bugreport helfen die Schritte zum Fehler, die erwartete und tatsächliche Reaktion sowie Browser und Betriebssystem. Die App-Version steht bereits im E-Mail-Betreff.')}</p>
        <p className="muted">{t('Öffnet dein E-Mail-Programm. Die App versendet nichts selbst und hängt keine Fotos, Messdaten oder Koordinaten an. Bitte sensible Projektdaten vor dem freiwilligen Teilen entfernen.')}</p>
      </div>
    </dialog>
    <dialog ref={licenses} className="footer-dialog" aria-labelledby="footer-licenses-title">
      <div className="dlg-head"><h2 id="footer-licenses-title">{t('Lizenzen / Copyright')}</h2>{close}</div>
      <div className="dlg-body">
        <p>MeasureMap © {year} Michael Radeck. {t('Verwendete Bibliotheken, Daten und Dienste:')}</p>
        <table><tbody>
          <tr><th>{t('Komponente')}</th><td><b>{t('Lizenz')}</b> · {t('Verwendung')}</td></tr>
          <tr><th>React, React DOM</th><td>MIT · {t('Oberfläche')}</td></tr>
          <tr><th>Leaflet</th><td>BSD-2-Clause · {t('Karte')}</td></tr>
          <tr><th>proj4js</th><td>MIT · {t('Koordinatenumrechnung')}</td></tr>
          <tr><th>geotiff.js</th><td>MIT · {t('Orthofotos (GeoTIFF)')}</td></tr>
          <tr><th>dxf-parser</th><td>MIT · {t('DXF-Zeichnungen')}</td></tr>
          <tr><th>exifr, piexifjs</th><td>MIT · {t('EXIF lesen und schreiben')}</td></tr>
          <tr><th>JSZip</th><td>MIT / GPLv3 ({t('MIT gewählt')}) · {t('ZIP-Import und -Export')}</td></tr>
          <tr><th>Papa Parse</th><td>MIT · {t('CSV-Import')}</td></tr>
          <tr><th>clipper-lib</th><td>Boost 1.0 · JSBN ({t('eigene freie Lizenz')}) · {t('Polygon-Berechnung')} · <a href="./third-party/clipper-notices.txt" {...external}>{t('Hinweise')}</a></td></tr>
          <tr><th>lucide-react</th><td>ISC · {t('Symbole')}</td></tr>
          <tr><th>OpenStreetMap</th><td>ODbL · © {t('OpenStreetMap-Mitwirkende')} · {t('Kartenkacheln')}</td></tr>
          <tr><th>ALKIS · LDBV</th><td>{t('Datenlizenz Deutschland 2.0')} · © {t('Bayerische Vermessungsverwaltung')} · {t('Flurkarte Bayern (optional)')}</td></tr>
        </tbody></table>
      </div>
    </dialog>
  </footer>;
}
