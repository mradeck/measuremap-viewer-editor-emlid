import React,{createContext,useContext,useRef} from 'react';
import {VERSION} from '../survey/model';
import {translate as t} from './translations';
import {usePreferences} from './preferences';

/**
 * Gemeinsame Dialoge der Kopf- und Fußleiste (Über mich, Copyright/Lizenzen, Hilfe/Kontakt).
 * Einmal oben im Baum gerendert, damit Kopfleiste und Fußleiste dieselben Dialoge öffnen.
 */
export type DialogName='about'|'licenses'|'support';
const Context=createContext<(name:DialogName)=>void>(()=>{});
export const useOpenDialog=()=>useContext(Context);

export const MAIL='michael.radeck@email.de';
export const REPO='https://github.com/mradeck/measuremap-viewer-editor-emlid';
export const APP_URL='https://measuremap-viewer-editor.netlify.app/';
const external={target:'_blank',rel:'noopener noreferrer'} as const;

function Panel({id,eyebrow,title,subtitle,closeLabel,children,innerRef}:{id:string;eyebrow:string;title:string;subtitle?:string;closeLabel:string;children:React.ReactNode;innerRef:React.RefObject<HTMLDialogElement>}){
  return <dialog ref={innerRef} className="app-dialog" aria-labelledby={`${id}-title`}>
    <header className="app-dialog-header">
      <div><p className="app-eyebrow">{eyebrow}</p><h2 id={`${id}-title`}>{title}</h2>{subtitle&&<p className="app-dialog-subtitle">{subtitle}</p>}</div>
      <form method="dialog"><button className="app-button app-dialog-close" type="submit" aria-label={closeLabel}>×</button></form>
    </header>
    <div className="app-dialog-body">{children}</div>
    <footer className="app-dialog-footer"><form method="dialog"><button className="app-button app-button-accent" type="submit">{t('OK')}</button></form></footer>
  </dialog>;
}

export function DialogsProvider({children}:{children:React.ReactNode}){
  usePreferences();
  const about=useRef<HTMLDialogElement>(null),licenses=useRef<HTMLDialogElement>(null),support=useRef<HTMLDialogElement>(null);
  const refs={about,licenses,support};
  const open=(name:DialogName)=>{const d=refs[name].current;if(!d)return;if(typeof d.showModal==='function'){if(!d.open)d.showModal();}else d.setAttribute('open','');};
  const subject=(kind:'bug'|'contact')=>`MeasureMap ${VERSION} – ${kind==='bug'?t('Bugreport'):t('Kontakt / Hilfe')}`;
  const bugHref=`mailto:${MAIL}?subject=${encodeURIComponent(subject('bug'))}&body=${encodeURIComponent(['Schritte zum Fehler:','Erwartetes Ergebnis:','Tatsächliches Ergebnis / Fehlermeldung:','Browser und Betriebssystem:','Bitte keine Fotos oder vertraulichen Projektdaten anhängen.'].map(line=>t(line)).join('\n\n'))}`;
  const contactHref=`mailto:${MAIL}?subject=${encodeURIComponent(subject('contact'))}`;
  const year=new Date().getFullYear();
  return <Context.Provider value={open}>
    {children}
    <Panel id="about" innerRef={about} eyebrow={t('Über den Entwickler')} title={t('Über Michael Radeck')} subtitle={t('DroneMediaMunich, Multikopterschule XMS, Pointcloud Manager und MeasureMap.')} closeLabel={t('Über-mich-Fenster schließen')}>
      <p>{t('Michael Radeck arbeitet seit vielen Jahren an der Schnittstelle von Medienproduktion, Drohnentechnik, Vermessung und Ausbildung. Als Inhaber von DroneMediaMunich, eXpert Media Solutions und der Multikopterschule XMS verbindet er praktische Flugerfahrung mit Postproduktion, Colorgrading, Photogrammetrie, GNSS-/Vermessungsworkflows und technischer Schulung.')}</p>
      <p>{t('Mit DroneMediaMunich realisiert er Luftaufnahmen, Drohnenvideos, Inspektions- und Vermessungsflüge sowie photogrammetrische Auswertungen bis hin zu 3D-Modellen und CAD-nahen Aufmaßen. Die Multikopterschule XMS bietet Schulungen und Fachkunde für private und gewerbliche Drohnenpiloten, unter anderem zu Luftrecht, sicherem Flugbetrieb, Praxisnachweisen, BOS-Anwendungen, Photogrammetrie und professionellen Film-/TV-Einsätzen.')}</p>
      <p>{t('Der Pointcloud Manager entsteht aus diesem praktischen Arbeitsumfeld: als lokales Werkzeug für Punktwolken, Drohnenvermessung, Photogrammetrie, LiDAR-Daten, Shape-Analyse und dokumentierbare Auswertungen, ohne Cloud-Zwang und mit Fokus auf nachvollziehbare Workflows.')} {t('Eine reduzierte Online-Version mit Funktionslimits und Upgrade-/Upsell-Hinweisen ist hier verfügbar:')} <a className="app-inline-link" href="https://stable-v53--pointcloud-manager.netlify.app/" {...external}>{t('Pointcloud Manager – reduzierte Online-Version')}</a>.</p>
      <p>{t('MeasureMap überträgt diesen Ansatz auf Messfotos und Feldaufnahmen: Fotos werden lokal den Emlid-Messpunkten zugeordnet, mit DXF, Orthofoto und Flurkarte geprüft und mit nachvollziehbaren GPS-/RTK-Metadaten exportiert.')}</p>
      <nav className="app-about-links" aria-label={t('Profile und Projekte')}>
        <a href="https://multikopterschule.de/" {...external}>multikopterschule.de</a>
        <a href="https://www.dronemedia-munich.de/" {...external}>dronemedia-munich.de</a>
        <a href="https://www.xing.com/profile/Michael_Radeck" {...external}>{t('XING-Profil')}</a>
        <a href="https://www.crew-united.com/de/Michael-Radeck_71557.html" {...external}>Crew United</a>
      </nav>
    </Panel>
    <Panel id="licenses" innerRef={licenses} eyebrow="Copyright" title={t('Lizenzen / Copyright')} subtitle={`MeasureMap © ${year} Michael Radeck · ${VERSION}`} closeLabel={t('Copyright- und Lizenzfenster schließen')}>
      <p>{t('Verwendete Bibliotheken, Daten und Dienste:')}</p>
      <table><tbody>
        <tr><th>{t('Komponente')}</th><td><b>{t('Lizenz')}</b> · {t('Verwendung')}</td></tr>
        <tr><th>React, React DOM</th><td>MIT · {t('Oberfläche')}</td></tr>
        <tr><th>Tailwind CSS</th><td>MIT · {t('Gestaltung des Metadaten-Inspektors (lokal gebündelt)')}</td></tr>
        <tr><th>Inter ({t('Schrift')})</th><td>SIL OFL 1.1 · © The Inter Project Authors · {t('selbst gehostet über @fontsource-variable/inter')}</td></tr>
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
    </Panel>
    <Panel id="support" innerRef={support} eyebrow={t('Kontakt')} title={t('Hilfe / Bugreport / Kontakt')} closeLabel={t('Kontaktfenster schließen')}>
      <p>{t('Fragen zur Bedienung, einen Fehler gefunden oder eine Idee für die App?')}</p>
      <div className="app-dialog-actions">
        <a className="app-button" href={`${REPO}#readme`} {...external}>{t('Anleitung (README) öffnen')}</a>
        <a className="app-button" href={bugHref}>{t('Bugreport per E-Mail')}</a>
        <a className="app-button" href={contactHref}>{t('Kontakt per E-Mail')}</a>
      </div>
      <p className="app-dialog-address">{MAIL}</p>
      <p>{t('Für einen Bugreport helfen die Schritte zum Fehler, die erwartete und tatsächliche Reaktion sowie Browser und Betriebssystem. Die App-Version steht bereits im E-Mail-Betreff.')}</p>
      <p>{t('Öffnet dein E-Mail-Programm. Die App versendet nichts selbst und hängt keine Fotos, Messdaten oder Koordinaten an. Bitte sensible Projektdaten vor dem freiwilligen Teilen entfernen.')}</p>
    </Panel>
  </Context.Provider>;
}
