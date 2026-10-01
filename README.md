# MeasureMap · v2026.10.1.5

Eigenständige React/TypeScript-SPA zur lokalen Georeferenzierung von Emlid-Fotos. Repository und Netlify-Projekt: `measuremap-viewer-editor-emlid`. Die vorhandene MetaLens-Metadatenansicht bleibt unter „Metadaten-Inspektor“ erreichbar. Beim Wechsel bleibt das geladene Vermessungsprojekt erhalten.

## Start und Bereitstellung

Node.js ab 20.19 (oder ab 22.12) verwenden.

```sh
npm ci
npm run dev
```

Für den eigenen Webserver:

```sh
npm run typecheck
npm test
npm run build
```

Den gesamten Inhalt von `dist/` auf einen statischen Webserver kopieren. Unterverzeichnisse sind unterstützt (`base: './'`). Kein Backend und keine Foto-Uploads nötig. Nicht direkt über `file://` öffnen; zum lokalen Prüfen `npm run preview` verwenden.

Die sichtbare Version entspricht `vJahr.Monat.Version.Subversion`; die npm-Version `2026.10.1-1` bildet dieselbe Version als gültiges SemVer ab.

## Arbeitsablauf

1. Emlid-Fotoordner, einzelne Dateien oder ZIP laden. CSV und Fotos dürfen gemeinsam oder nacheinander geladen werden.
2. CSV benötigt `Latitude` und `Longitude`; der Emlid-Export wird anhand seiner englischen Spaltenüberschriften eingelesen. Komma, Semikolon, Tab und zitierte Felder werden unterstützt.
3. Zuordnung erfolgt zuerst exakt über `Point photos`, dann über einen eindeutigen Emlid-Punktnamen im Dateinamen. Mehrdeutige Treffer werden nicht automatisch zugeordnet. Alternativ im Fotodetail einen Vermessungspunkt wählen.
4. DXF importieren. Das Koordinatensystem muss angegeben werden, da DXF in der Regel kein zuverlässiges CRS enthält. Vorgabe: EPSG:25832, ETRS89 / UTM 32N. Außerdem verfügbar: 25833, 32632, 32633 und 4326. Lokale CAD-Koordinaten benötigen eine vorherige Georeferenzierung.
5. OSM und optional ALKIS Bayern einblenden. Fotos, Messpunkte und DXF kontrollieren; einzelne DXF-Layer und Beschriftungen ein-/ausblenden.
6. Fotos einzeln oder gemeinsam als ZIP exportieren. Fotos ohne Position, ausgeschlossene Fotos und Nicht-JPEGs werden ausgelassen; Fehler werden angezeigt und im Protokoll dokumentiert.

Dateien bleiben im Arbeitsspeicher des Browsers. Ein Neuladen verwirft das Projekt; vor dem Schließen exportieren. Die Karte lädt externe OSM- und optionale ALKIS-Kacheln für den sichtbaren Ausschnitt.

## Metadaten und Höhen

Die JPEG-Bilddaten werden **nicht neu komprimiert**. EXIF wird über piexifjs aktualisiert; ICC- und andere JPEG-Segmente bleiben erhalten. Standard-XMP wird zusammengeführt, vorhandene Panorama-, Copyright- und Drohneninformationen bleiben erhalten. Unlesbares EXIF/XMP führt zu einem Exportfehler für die betreffende Datei, nicht zu einem Ersatz durch leere Metadaten. Herstellerspezifische MakerNote-Strukturen können absolute Offsets verwenden; deren interne Gültigkeit ist mit piexifjs nicht für jedes Kameramodell garantiert.

| Bereich | Inhalt |
| --- | --- |
| EXIF GPSLatitude / GPSLongitude | CSV Latitude / Longitude, DMS-Rationale mit 1e-6 Bogensekundenauflösung |
| EXIF GPSAltitude | CSV `Elevation`, bei Neufahrn DHHN2016 / NHN; keine Mischung mit Ellipsoidhöhe |
| EXIF GPSHPositioningError | `Lateral RMS`, sofern vorhanden |
| EXIF GPSProcessingMethod | Herkunft „Emlid RTK FIX; surveyed point“, abhängig vom tatsächlichen CSV-Status |
| MetaLens Survey XMP | UTM Easting/Northing, CRS, Ellipsoid- und orthometrische Höhe, RTK-Status, Messzeit, vollständiger Original-CSV-Datensatz |
| ZIP positions.csv / positions.json | Zuordnung, Position, Datenherkunft, ursprüngliche GPS-Position, Fehlerprotokoll |

XMP-Namensraum: `https://michael-radeck.de/ns/metalens/survey/1.0/`, Präfix `mls`. ExifTool zeigt die Felder unter `XMP-mls` an. Der CSV-Originaldatensatz bewahrt unter anderem RMS-Werte, Antennenhöhe, Empfänger, Korrekturquelle, Datum und Höhenbezug.

**Die Emlid-Position ist der vermessene Punkt, nicht automatisch die Kameraposition.** Kameraversatz, Orientierung und relative Flughöhe werden nicht erfunden. DJI-RTK-Tags werden nicht für Emlid-Aufnahmen erzeugt. Manuell gesetzte Positionen erhalten keine RTK-Qualität und entfernen vorherige MetaLens-UTM-/RTK-Daten. Vorhandene Hersteller-XMP bleibt als Originalinformation erhalten.

Der Pointcloudmanager liest Handyfoto-Positionen über Standard-EXIF (`src/io/phonePhotoImport.ts`). Seine Drohnenposen stammen aus Photogrammetrie-Kameradaten (`src/io/droneCameraImport.ts`), nicht aus einem universellen UTM-EXIF-Tag. Exportierte JPEGs können dort über den Handyfoto-/GPS-Import verwendet werden. Der zusätzliche MetaLens-XMP-Bereich ist gespeichert, wird vom derzeitigen Pointcloudmanager aber nicht automatisch als Kamerapose ausgewertet.

## Formate

- JPEG: Import, Vorschau, GPS lesen und schreiben.
- PNG, WebP, HEIC/HEIF: Import und gegebenenfalls GPS lesen; Vorschau abhängig von Browser/Codec. Metadatenexport unterstützt JPEG-Originale. Es findet keine stillschweigende Konvertierung statt.
- DXF: POINT, LINE, LWPOLYLINE, POLYLINE einschließlich Bulge-Bögen, CIRCLE, ARC, TEXT und MTEXT als Kartenoverlay. Weitere Elementtypen, z. B. INSERT und SPLINE, werden gemeldet und nicht dargestellt. Keine vollständige CAD-Engine.
- Fotos mit vorhandenem GPS und ohne neue Zuordnung werden im ZIP unverändert übernommen.

## ALKIS Bayern

Dienst: <https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte>

WMS 1.1.1 im Karten-CRS EPSG:3857, das laut GetCapabilities unterstützt wird. Vier Darstellungen: Farbe, Grau, Umriss gelb, Umriss schwarz. Deckkraft einstellbar. Daten nur in Bayern. Quellenhinweis direkt in der Karte: Bayerische Vermessungsverwaltung / LDBV, Datenlizenz Deutschland – Namensnennung 2.0. OSM-Quellenhinweis ebenfalls direkt in der Karte.

## Google Fotos

Eine Verbindung ist grundsätzlich über die [Google Photos Picker API](https://developers.google.com/photos/picker/guides/get-started-picker) möglich: Nutzer meldet sich an, wählt Fotos aus, die App liest diese Auswahl. Dafür müssen Google-Cloud-Projekt, aktivierte API, OAuth-Client-ID und freigegebene Webadresse eingerichtet werden. Diese Version enthält **keine aktive Google-Verknüpfung**.

Ein beliebiges vorhandenes Album lässt sich nicht über die Library API dauerhaft auslesen; ihr Lesezugriff beschränkt sich auf app-erstellte Inhalte. [Google API-Änderungen](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/).

Google entfernt beim API-Download mit `=d` die Standortmetadaten. Die Picker-Verknüpfung würde daher nicht zuverlässig die vorhandenen Handy-GPS-Daten liefern. [Offizielle Download-Dokumentation](https://developers.google.com/photos/picker/guides/media-items). Lokale Originaldateien sind für diesen Anwendungsfall die erste Wahl; alternativ ist eine gesonderte Takeout-JSON-Auswertung denkbar.

## Prüfung

`npm test` prüft CSV-Parsing, eindeutige/mehrdeutige Zuordnung, Positionspriorität, EXIF-Präzision, JPEG-Bilddaten-Erhaltung, bestehende EXIF-Felder und XMP-Merging. Der mitgelieferte JPEG-Test ist ein synthetisches 2×2-Bild ohne private Informationen.

Integrationstest mit lokal vorhandenem Neufahrn-Datensatz:

```sh
EMLID_TEST_SOURCE='/Pfad/zum/emlid-app/neufahrn' npm test
```

Die Vermessungsdaten und Fotos werden nicht ins Repository aufgenommen. Geprüft: 107 Punkte, 11 eindeutige Fotozuordnungen und 441 unterstützte DXF-Elemente; Bytegleichheit der JPEG-Bilddaten und ICC-Profile, GPS-/Höhenwerte, manuelle Position ohne alte RTK-Angaben. Browserprüfung: ZIP-/DXF-Import, ALKIS, Export, schmale Ansicht und Erhalt des Projekts beim Wechsel zum Inspektor.

## Bestehender Inspektor

Die bisherigen Funktionen für Panorama-, HDR- und Copyright-Metadaten bleiben erhalten. Für den optionalen JXL-Decoder können `jxl.min.js` und `jxl.wasm` in `public/` abgelegt werden. Der Inspektor nutzt weiterhin das bestehende Tailwind-CDN; die neue Vermessungsansicht hat lokal gebündelte CSS-Dateien.

## Erscheinungsbild, Sprache und Footer

Über die Kopfzeile lassen sich helles/dunkles Interface sowie Deutsch/Englisch umschalten. Das gilt auch für den Metadaten-Inspektor, Hilfe, Fotozuordnung, Zahlenformate und Statusmeldungen. Nur Sprache und Darstellungspräferenz werden in `localStorage` gespeichert; Fotos und Vermessungsdaten bleiben temporär im Arbeitsspeicher. Technische CSV-Spalten, EXIF-/XMP-Schlüssel und exportierte Zahlen werden nicht übersetzt.

Der Footer folgt den Link-Pills von SkyCheck: OpenStreetMap, ALKIS/LDBV und Datenlizenz, Pointcloudmanager, SkyCheck, Impressum, michael-radeck.de, GitHub und Ko-fi. Der Datenschutz-/Formate-Button öffnet die lokalen Verarbeitungshinweise.

## Veröffentlichung

- Website: https://measuremap-viewer-editor-emlid.netlify.app
- Repository: https://github.com/mradeck/measuremap-viewer-editor-emlid
- Netlify-Build: `npm run typecheck && npm test && npm run build`, Ausgabe `dist`, Node.js 22.
- `netlify.toml` enthält SPA-Fallback und Cache-Header. Keine Tokens oder private Fotos im Repository.

Die mittige Fotoleiste zeigt fünf chronologisch benachbarte Fotos. Hover vergrößert die Vorschau und wechselt die Auswahl; Vor-/Zurück-Buttons und Pfeiltasten führen durch die gesamte Serie. Die Karte folgt der Auswahl. Sortierung: EXIF-Aufnahmezeit, Emlid-Zeitstempel im Dateinamen, ersatzweise Dateidatum (sichtbar gekennzeichnet).

Doppelklick auf Thumbnail, Kartenmarker oder Bildvorschau öffnet das Foto anstelle der Karte. Die Leiste lässt sich einklappen, während Pfeiltasten und horizontales Mausrad (auch Shift + Mausrad) weiter funktionieren. Escape oder „Zurück zur Karte“ beendet die Bildansicht. Home/End springen zum Anfang/Ende. An den Grenzen bleibt die Navigation in Gegenrichtung erreichbar; Eingabefelder werden nicht durch Tastenkürzel gestört.

Die Fotogalerie unter der Karte scrollt horizontal mit der Auswahl und hält das aktive Foto mittig, soweit die Ränder der Galerie dies erlauben. Das gilt auch nach Filterwechsel und bei geänderter Fensterbreite.
