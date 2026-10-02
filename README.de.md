# MeasureMap · v2026.10.1.23

[English](README.md) | **Deutsch**

Eigenständige React/TypeScript-SPA zur lokalen Georeferenzierung von Emlid-Fotos. Repository und Netlify-Projekt: `measuremap-viewer-editor-emlid`. Die vorhandene MetaLens-Metadatenansicht bleibt unter „Metadaten-Inspektor“ erreichbar. Beim Wechsel bleibt das geladene Vermessungsprojekt erhalten.

[MeasureMap öffnen](https://measuremap-viewer-editor-emlid.netlify.app/)

## Lokale Geländefolge und Start-Höhenrechenhilfe · v2026.10.1.23

Unter **DJI → Route neu berechnen → Geländefolge · lokales DEM / DSM** das Modell aktivieren und ein georeferenziertes, einbandiges Höhen-GeoTIFF laden. RGB-Orthofotos werden abgelehnt. Bestätigen, dass die Rasterwerte Höhen in Metern sind. Unterstützte horizontale CRS: ETRS89/WGS84 UTM, EPSG:4326 und EPSG:3857; auch gedrehte Raster und PixelIsPoint. Kleine zwischengespeicherte Rasterfenster erhalten die numerischen Höhen samt Nachkommastellen, ohne das gesamte Modell in den Speicher zu laden.

Tatsächliche Startkoordinaten eingeben (`startPositionRef` wird, soweit vorhanden, vorgefüllt), Abstand über dem Modell und Startversatz über der Modelloberfläche setzen; z. B. 2 m bei Handstart vom Boden. DEM/DTM bildet den Boden ab, DSM auch Dächer und Vegetation: die Modelloberfläche am Start berücksichtigen. Abtastabstand (1–50 m, Vorgabe 5 m) und zulässiges Steigen/Sinken (Vorgabe 2 m/s) wählen. **Route neu berechnen** klicken. Der Modellabstand fließt auch in automatische Bahn-/Fotoabstände und die GSD-Schätzung ein.

Die Route verwendet `relativeToStartPoint` und explizite Wegpunkthöhen `executeHeight`: **Modellhöhe an der Route − Modellhöhe am Start + gewünschter Abstand − Startversatz**. Beide Modellhöhen stammen aus derselben Datei; es wird keine unbekannte EGM96-/DHHN-/WGS84-Höhenumrechnung geraten. Absolute Höhenmodi und Echtzeit-Sensormodi werden hier nicht berechnet. Bahnen und Verbindungen werden mit Höhenstützpunkten verdichtet, Fotoaktionsgrenzen passend neu indiziert; zusätzliche Stützpunkte auf Geraden verwenden Durchflug. Anzeige mit Höhenprofil und Höhenbereich, Export mit numerischer Höhenfolge. NoData, fehlende Abdeckung, übermäßige Steig-/Sinkraten und mehr als 2.000 Punkte stoppen die Berechnung; der bisherige Flugplan bleibt bestehen. Gelände-/Schrägflug- und proprietäre Optimierungen werden nicht stillschweigend aktiviert.

Dies ist vorab berechnete Modellfolge, keine Echtzeit-Sensorregelung. Nach Umrissänderungen mit geladenem Modell neu berechnen. Eine Rasterneuberechnung in Pilot 2 kann die exportierte Höhenfolge ersetzen: importierte Wegpunkthöhen und tatsächliche Startreferenz vor der Ausführung prüfen. Modellgenauigkeit, Auflösung und Abtastung begrenzen die Abstandstreue; keine Hindernisgarantie zwischen Stützpunkten oder bei Start, Anflug, Rückkehr und Landung. Sicherheitsstart-/RTH-Einstellungen bleiben unabhängig. Die tatsächliche Controller-Ausführung ist noch nicht validiert. Siehe [DJI-Geländefolge](https://enterprise-insights.dji.com/blog/geospatial-solutions-faq) und [DJI-WPML-Höhenbezüge](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/waylines-wpml.html).

**Rechenhilfe · Handstart / erhöhter Start** für eine feste Boden-/Motivebene: **relative Flughöhe = gewünschter Abstand + Motivniveau gegenüber Startboden − Startversatz über Startboden**. Bei gleich hohem Boden, 30 m gewünschtem Abstand und 2 m erhöhtem Start sind 28 m relativ einzustellen. Unverändert 30 m relativ ergeben etwa 32 m über Boden. Ein 10 m höheres Motivniveau benötigt 38 m relativ. Voraussetzung: die tatsächliche erhöhte Startposition ist die Höhenreferenz des Controllers; den Bezug im jeweiligen Arbeitsablauf prüfen. Übernehmen passt Routen- und separate Aufnahmehöhe gemeinsam an. Für wechselndes Gelände die Modelleinstellungen verwenden.

## Überlappung, Fotodichte, GSD und erhaltene Flughöhe · v2026.10.1.22

Im DJI-Bereich sind Querüberlappung und **Fotodichte / Längsüberlappung** direkt in Prozent (0–95 %) einstellbar. Mehr Längsüberlappung bedeutet kürzere Fotoabstände und mehr Fotos. **Überlappung übernehmen**, anschließend **Route neu berechnen**. Automatische Abstände verwenden das importierte Originalraster mit Fotoauslösern oder bei fehlender Kalibrierung die Geometrie der Mavic 3 Enterprise Weitwinkelkamera. Manuelle Meterabstände bleiben verfügbar und aktualisieren die Überlappungswerte im Export.

**Flughöhe** zeigt die tatsächliche importierte Routenflughöhe, auch bei einem 0-Platzhalter in der Vorlage. Das Verschieben, Einfügen und Löschen von Eckpunkten sowie Rasteränderungen erhalten diese Höhe. **Flughöhe übernehmen** versetzt Routen- und Aufnahmehöhe gemeinsam; Höhenbezug und Differenz zwischen Start- und Motivebene bleiben erhalten. Die Aufnahmehöhe über dem Motiv wird separat angezeigt. Die Sicherheits-/Startflughöhe bleibt unabhängig.

Die GSD wird in cm/Pixel aus dem effektiven Bildfußabdruck geteilt durch die Fotoauflösung geschätzt. Tatsächliche Fotobreite und -höhe angeben; M3E-Vorgabe: 5280 × 3956 Pixel. Ohne Rasterkalibrierung verwendet die M3E-Berechnung 84° diagonalen Bildwinkel und Aufnahmehöhe; siehe [DJI-Kameraspezifikationen](https://enterprise.dji.com/mavic-3-enterprise/specs). Unbekannte Kameras benötigen ein kalibriertes Originalraster und explizite Fotoauflösung; es wird keine Auflösung geraten. Die Schätzung setzt eine ebene Motivfläche voraus; geneigte Kameras und Gelände verursachen unterschiedliche GSD innerhalb des Bildes. Überlappung verändert die Fotodichte, nicht die GSD. Die Aufnahmehöhe beeinflusst Bildfußabdruck und GSD.

## Lokale Routenneuberechnung · v2026.10.1.21

Nach einer Umrissänderung **DJI · Pilot 2 → Route neu berechnen** öffnen. Bahn- und Fotoabstand prüfen, dann **Route neu berechnen** klicken. Die neue Route erscheint direkt auf der Karte. **DJI-KMZ exportieren** enthält anschließend die geänderte Vorlage und eine neu erzeugte ausführbare `waylines.wpml`.

Bei importierten Missionen mit erkennbaren Flugbahnen und Fotointervallen werden die Abstände aus dem Original abgeleitet. Geänderte Quer-/Längsüberlappung und Aufnahmehöhe skalieren diese Kalibrierung. Die Ableitung ist eine Schätzung aus dem Original, keine Hersteller-Kameraspezifikation; Checkbox und Zahlenfelder ermöglichen manuelle Vorgaben. Bei Vorlagen nicht unterstützter Kameras ohne Kalibrierung geeignete Abstände selbst vorgeben. Rückgängig stellt die vorherige Route wieder her.

Unterstützt werden ein `mapping2d`-Polygon mit optionalen Innenaussparungen, konkave Umrisse, Flugrichtung, positiver Rand, konstante relative oder WGS84-Flughöhe sowie zeit-/distanzbasierte Fotoauslösung. Verbindungen zwischen Bahnen bleiben innerhalb der erweiterten Planungsfläche und außerhalb ihrer Aussparungen. Start-Kamera-/Fokusaktionen und Geräteparameter bleiben erhalten; Wegpunktaktionen und Indizes werden für die neuen Bahnen erzeugt. Manuell geänderte Wegpunkte werden bei der Neuberechnung ersetzt. Geländeprofile, variable Höhen, Schrägflug/Quick-Ortho, 3D-Missionen und eigene Wegpunktaktionen benötigen Pilot 2 und werden ausdrücklich zurückgewiesen.

Grenzen: 150 Eingabeeckpunkte, 300 gepufferte Punkte, 600 Bahnen, 2.000 erzeugte Wegpunkte und 10 km Eingabeausdehnung; Bahnabstand 0,25–500 m. Dauer ist eine reine Streckenschätzung ohne Aktionswartezeiten, Start/Rückkehr und Kurvendynamik. Es gibt keine Gelände-, Hindernis- oder Luftraumprüfung; DJI-eigene Optimierung wird nicht identisch nachgebildet. Vor dem Flug das Ergebnis in Pilot 2 importieren und prüfen. Der tatsächliche Controller-Test steht weiterhin aus.

Geometrie und Randberechnung nutzen [clipper-lib](https://github.com/junmer/clipper-lib), Boost Software License 1.0 mit JSBN (freizügige Tom-Wu-Lizenz). [Mitgelieferte Lizenzhinweise](public/third-party/clipper-notices.txt).

## DJI-Pilot-2-Flugpläne

**v2026.10.1.19** ergänzt die Gruppe **DJI · Pilot 2**. KML/KMZ über diese Gruppe, die Projektdateiauswahl oder Drag-and-drop laden. Flächenumriss und ausführbare Routen erscheinen violett auf der vorhandenen Foto-/CAD-/Orthofotokarte.

- Gesamte Mission in Metern verschieben oder im Uhrzeigersinn drehen. Fläche, Route, Startreferenz und gesetzte POI werden gemeinsam geändert. Drehpunkt ist das Mittel der Flächeneckpunkte; die Transformation nutzt einen lokalen metrischen Rahmen.
- Flughöhen um einen Betrag versetzen; Höhenbezug und Geländeprofil bleiben erhalten. Die separate Sicherheits-/Startflughöhe wird nicht geändert.
- Fluggeschwindigkeit setzen. Zeitbasierte Fotoauslöser bleiben unverändert; dadurch verändert eine andere Geschwindigkeit die Überlappung.
- Wegpunkte auswählen und Koordinaten, Höhe oder Geschwindigkeit ändern. Mit **Auf Karte ziehen** direkt verschieben. Indizes, Kameraaktionen, Aktionsgruppen, Kurveneinstellungen und unbekannte DJI-Felder bleiben erhalten.
- **v2026.10.1.20:** **Umriss bearbeiten** in der Kartenleiste oder DJI-Gruppe aktivieren. Nummerierte Eckpunkte ziehen; der Umriss folgt live. **+** auf einer Kante anklicken oder an die neue Position ziehen, um einen Punkt einzufügen. Eckpunkt anklicken und **Eckpunkt löschen** wählen. Mindestens drei Punkte bleiben erhalten; ein doppelter Abschlusskoordinatenpunkt wird nicht separat angezeigt. Auch die numerische Eckpunktansicht bietet Einfügen und Löschen.
- Flächeneckpunkte, Flugrichtung, Kameraüberlappung und Rand ändern. Dafür wird die bisherige ausführbare Route entfernt: Für unterstützte 2D-Missionen **Route neu berechnen** nutzen; alternativ die **Planungsvorlage** in Pilot 2 berechnen. Rückgängig stellt die vorherige Route wieder her.
- Bis zu 29 Änderungen zurücknehmen oder den Importstand wiederherstellen. Ein weiterer Flugplan ersetzt die aktive DJI-Mission; Fotos und Kartenebenen bleiben geladen.
- Als neue KMZ exportieren. WPML-Version, Geräteparameter und Zusatzressourcen bleiben erhalten. Ohne Bearbeitung bleiben beide XML-Dateien exakt erhalten; vor dem Download wird der Export erneut eingelesen. Aktualisierte Distanz-/Dauerfelder sind geometrische Schätzungen ohne Aktionswartezeiten und Kurvendynamik.

Die [DJI-WPML-Dokumentation](https://developer.dji.com/doc/cloud-api-tutorial/en/api-reference/dji-wpml/overview.html) unterscheidet Planungsvorlage (`wpmz/template.kml`) und ausführbare Route (`wpmz/waylines.wpml`). Eine einzelne DJI-Vorlagen-KML wird als Planungsvorlage verpackt. Allgemeine Geometrie-KML ohne DJI-Geräte-/Missionsparameter ist darstellbar und bearbeitbar, aber nicht als ausführbare DJI-Mission exportierbar. Die lokale 2D-Rasterberechnung ist oben beschrieben; Drohnen-/Kameramodelle werden nicht stillschweigend angenommen.

Vor dem Flug in Pilot 2 importieren und Route, Höhenbezug, Startpunkt und Aktionen prüfen. Originaldateien bleiben unverändert. Struktur- und Exporttests einschließlich eines ausschließlich lokal geprüften Pilot-2-Beispiels mit 51 Wegpunkten bestanden; **der Importtest auf einem echten DJI-Controller steht noch aus**. Private Flugpläne werden nicht in GitHub oder die Website aufgenommen.

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

Die sichtbare Version entspricht `vJahr.Monat.Version.Subversion`; die npm-Version `2026.10.1-21` bildet dieselbe Version als gültiges SemVer ab.

## Arbeitsablauf

1. Emlid-Fotoordner, einzelne Dateien oder ZIP laden. CSV und Fotos dürfen gemeinsam oder nacheinander geladen werden.
2. CSV benötigt `Latitude` und `Longitude`; der Emlid-Export wird anhand seiner englischen Spaltenüberschriften eingelesen. Komma, Semikolon, Tab und zitierte Felder werden unterstützt.
3. Zuordnung erfolgt zuerst exakt über `Point photos`, dann über einen eindeutigen Emlid-Punktnamen im Dateinamen. Mehrdeutige Treffer werden nicht automatisch zugeordnet. Alternativ im Fotodetail einen Vermessungspunkt wählen. Die Emlid-Versatzkorrektur ist **standardmäßig aktiv**; ihre Wirkung auf automatische Zuordnungen ist unten beschrieben.
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

`npm test` prüft CSV-Parsing, eindeutige/mehrdeutige Zuordnung, Positionspriorität, EXIF-Präzision, JPEG-Bilddaten-Erhaltung, bestehende EXIF-Felder und XMP-Merging. Zusätzliche Tests prüfen chronologische Sortierung, Foto-Zoom und Verschieben, Emlid-Versatzkorrektur und die Proportionen der Karten-Thumbnails. Der mitgelieferte JPEG-Test ist ein synthetisches 2×2-Bild ohne private Informationen.

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

Maximale Zoomstufe: 26. OSM-Kacheln werden oberhalb von Stufe 19, ALKIS-Kacheln oberhalb von Stufe 22 vergrößert; die zusätzlichen Zoomstufen erzeugen keine neuen Details der Hintergrundkarten. DXF und Messpunkte bleiben georeferenziert. Der Auge-Button entfernt ausschließlich die vollständigen Fotomarker (Bild, Rahmen, Hintergrund und Beschriftung) vorübergehend von der Karte. Schwebende Fotoleiste und Galerie unter der Karte bleiben nutzbar.

Große Fotoansicht: Strg + Mausrad zoomt um die Zeigerposition bis 16×; Ziehen mit der linken Maustaste verschiebt den vergrößerten Ausschnitt. Plus/Minus und Einpassen stehen zusätzlich als Buttons zur Verfügung. Ein Foto-Wechsel setzt den Ausschnitt zurück; Bildränder begrenzen das Verschieben.

Optionale Emlid-Versatzkorrektur: „Emlid: einen Messpunkt zurück“ verschiebt automatisch zugeordnete Fotos auf die unmittelbar vorherige CSV-Zeile. Die CSV-Reihenfolge gilt auch bei nicht numerischen Punktnamen; ungültige Vorgänger und erste Zeilen erhalten keine Ersatzposition. Manuelle Zuordnungen und GPS-Fotos bleiben unverändert. Die Option ist standardmäßig aktiv, bei neuer CSV wieder aktiv und ohne Datenänderung umschaltbar. Anzeige und Export verwenden dieselbe Auflösung; positions.json/positions.csv protokollieren die ursprüngliche Zuordnung und den verwendeten Versatz.

Karten-Thumbnails: Rahmen folgen dem tatsächlichen Bildseitenverhältnis (einschließlich angezeigter EXIF-Orientierung). Beim Hover vergrößert sich die komplette Karte mit Rahmen und Punktlabel; die Mausfläche bleibt unverändert. Vergrößerte Vorschauen fangen keine Mausereignisse benachbarter Marker ab und werden beim Verlassen zurückgesetzt.

## Georeferenzierte Orthofotos (GeoTIFF)

Eine `.tif`- oder `.tiff`-Datei über **Dateien hinzufügen**, Drag-and-drop, einen Ordner oder ZIP laden. Eingebettete Georeferenzierung und CRS sind erforderlich; externe Worldfiles werden nicht gelesen. Unterstützt werden ETRS89 / UTM Zonen 28–38, WGS84 / UTM Nord/Süd, EPSG:4326 und EPSG:3857. Fehlendes oder unbekanntes CRS wird gemeldet und nicht geraten. Affine Rotation und PixelIsPoint werden berücksichtigt.

Das Orthofoto wird in Kartenkacheln umprojiziert und oberhalb von Basiskarte/ALKIS sowie unterhalb von DXF, Messpunkten und Fotos dargestellt. **Alles zeigen** berücksichtigt seine Ausdehnung. Sichtbarkeit, Deckkraft und Entfernen sind einstellbar. RGB/RGBA, Graustufen und Farbpaletten werden unterstützt; Alpha und NoData sind transparent. RGB/RGBA unterstützt ganzzahlige Kanäle mit 8/16 Bit.

Die App verwendet für entfernte Ansichten eine Übersicht und liest beim Hineinzoomen die sichtbaren GeoTIFF-Bereiche in Originalauflösung, auch bei 8K/16K-Dateien. Der Zwischenspeicher für Originalbereiche ist auf 32 MiB begrenzt; maximal zwei Lesevorgänge laufen gleichzeitig. Nicht mehr benötigte Kacheln werden abgebrochen. Bilineare Interpolation berücksichtigt transparente Ränder; hochauflösende Displays werden mit bis zu doppelter Kachelauflösung bedient. Die Originalpixel begrenzen letztlich die Details; darüber hinaus erzeugt Zoomen keine neuen Informationen. Das TIFF bleibt unverändert und gehört nicht zum Foto-Metadatenexport. Ein neues Orthofoto ersetzt die vorhandene Ebene. Dateien bleiben lokal; Neuladen verwirft das Projekt.

## Mehrere DXF-Zeichnungen und CAD-Farben

Weitere DXF-Dateien werden hinzugefügt, auch mehrere Dateien innerhalb eines Imports oder ZIPs. Jede Zeichnung besitzt eigene Schalter für Sichtbarkeit, Entfernen, CRS und Layer; gleichnamige Layer verschiedener Dateien bleiben unabhängig. Der CRS-Wähler für neue Dateien setzt die Importvorgabe; der eigene Wähler einer vorhandenen Zeichnung ändert nur deren Koordinatensystem.

Linien, Punkte und Beschriftungen verwenden DXF-Objektfarben beziehungsweise geerbte Layerfarben. ACI-Farben und 24-Bit-TrueColor werden unterstützt; TrueColor hat Vorrang. Die adaptive CAD-Farbe ACI 7 verwendet für die Lesbarkeit die Vordergrundfarbe des Interfaces. Einzelne BYBLOCK-Objekte verwenden ersatzweise die Layerfarbe; INSERT-Blockgeometrie bleibt nicht unterstützt. Private DXF-Dateien werden nicht ins Repository aufgenommen.

## Leistung der Kartendarstellung

CAD-Geometrie und Messpunkte nutzen einen gemeinsamen Canvas-Renderer. DXF, Messpunkte und Fotomarker sind getrennte Ebenen; die zoomabhängigen Fotostapel bauen die CAD-Geometrie nicht mehr neu auf. Die Rasterumprojektion interpoliert ein geprüftes Koordinatengitter, statt für jeden Bildschirmpixel eine vollständige Projektion auszuführen. Die Genauigkeitsprüfung nutzt eine Toleranz von 0,1 Originalpixeln und unterteilt Zellen bei Bedarf weiter. Originaldetails und bilineare Interpolation transparenter Ränder bleiben erhalten.

Originalbereiche des GeoTIFFs werden in festen 512-Pixel-Blöcken über benachbarte Kacheln und Zoomstufen hinweg wiederverwendet. Der LRU-Cache ist auf 32 MiB begrenzt; maximal zwei Lesevorgänge laufen gleichzeitig. Überlappende Anfragen teilen die Dekodierung. Das Abbrechen einer Kachel beendet keine noch benötigte gemeinsame Anfrage; überholte Warteschlangenaufträge überspringen die Dekodierung. Zwei Browser-Worker dekomprimieren TIFF-Blöcke, und die Pixelberechnung gibt regelmäßig Rechenzeit für die Kartenbedienung frei. Beim ersten Laden muss weiterhin die Übersicht erstellt werden; die Geschwindigkeit hängt auch von Kompression und Speicheraufbau des TIFFs ab.

Der Footer verlinkt zusätzlich den [Geodata Inspector & Cleaner](https://geodata-inspector-cleaner.netlify.app/).

Der Sprachbutton folgt dem Geodata Inspector & Cleaner: Die aktuelle deutsche beziehungsweise britische Flagge mit DE/EN-Kürzel schaltet zwischen Deutsch und Englisch um. Inline-SVGs gewährleisten eine einheitliche Darstellung, auch in Chrome unter Windows. Der Pointcloudmanager-Link im Footer öffnet die öffentliche Website https://pointcloud-manager.com/.
