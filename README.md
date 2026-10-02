# MeasureMap · v2026.10.1.15

**English** | [Deutsch](README.de.md)

A standalone React/TypeScript SPA for locally georeferencing Emlid survey photos. Repository and Netlify project: `measuremap-viewer-editor-emlid`. The existing MetaLens metadata inspector remains available through **Metadata inspector**. Switching views preserves the loaded survey project.

[Open MeasureMap](https://measuremap-viewer-editor-emlid.netlify.app/)

## Getting started and deployment

Use Node.js 20.19 or later, or 22.12 or later.

```sh
npm ci
npm run dev
```

To build for your own web server:

```sh
npm run typecheck
npm test
npm run build
```

Copy the entire contents of `dist/` to a static web server. Subdirectory hosting is supported (`base: './'`). No backend or photo uploads are required. Do not open the app directly through `file://`; use `npm run preview` for local testing.

The displayed version follows `vYear.Month.Version.Subversion`; the npm version `2026.10.1-15` represents the same version as valid SemVer.

## Workflow

1. Load an Emlid photo folder, individual files or a ZIP archive. CSV and photos can be loaded together or separately.
2. The CSV must contain `Latitude` and `Longitude`. Emlid exports are parsed using their English column headers. Comma, semicolon and tab delimiters, as well as quoted fields, are supported.
3. Photos are matched first by exact filenames in `Point photos`, then by an unambiguous Emlid point name in the filename. Ambiguous matches are not assigned automatically. You can also select a survey point in the photo detail panel. The Emlid offset correction is **enabled by default**; see below for its effect on automatic assignments.
4. Import a DXF drawing. Specify its coordinate reference system, since DXF generally does not contain a reliable CRS. The default is EPSG:25832, ETRS89 / UTM 32N. Also supported: 25833, 32632, 32633 and 4326. Local CAD coordinates require prior georeferencing.
5. Display OSM and optional Bavarian ALKIS layers. Check photos, survey points and DXF geometry; toggle individual DXF layers and labels.
6. Export individual photos or a ZIP archive. Photos without a position, excluded photos and non-JPEG files are omitted. Errors are displayed and recorded in the export report.

Files remain in browser memory. Reloading discards the project; export before closing. The map loads external OSM and optional ALKIS tiles for the visible area.

## Metadata and elevations

JPEG image data is **not recompressed**. EXIF is updated with piexifjs; ICC profiles and other JPEG segments are preserved. Standard XMP is merged, preserving existing panorama, copyright and drone information. Unreadable EXIF/XMP causes an export error for that file rather than replacement with empty metadata. Manufacturer-specific MakerNote structures can use absolute offsets; piexifjs cannot guarantee their internal validity for every camera model.

| Field | Contents |
| --- | --- |
| EXIF GPSLatitude / GPSLongitude | CSV Latitude / Longitude, DMS rationals with 1e-6 arcsecond resolution |
| EXIF GPSAltitude | CSV `Elevation`, DHHN2016 / NHN for the Neufahrn dataset; not mixed with ellipsoidal height |
| EXIF GPSHPositioningError | `Lateral RMS`, when available |
| EXIF GPSProcessingMethod | Origin such as “Emlid RTK FIX; surveyed point”, based on the actual CSV status |
| MetaLens Survey XMP | UTM Easting/Northing, CRS, ellipsoidal and orthometric heights, RTK status, measurement time and the complete original CSV record |
| ZIP positions.csv / positions.json | Assignment, position, data source, original GPS position and error report |

XMP namespace: `https://michael-radeck.de/ns/metalens/survey/1.0/`, prefix `mls`. ExifTool displays these fields under `XMP-mls`. The original CSV record preserves RMS values, antenna height, receiver, correction source, date and height reference, among other fields.

**The Emlid position is the surveyed point, not automatically the camera position.** Camera offsets, orientation and relative flight altitude are not invented. DJI RTK tags are not generated for Emlid photos. Manually assigned positions receive no RTK quality information and remove previous MetaLens UTM/RTK data. Existing manufacturer XMP remains as original information.

Pointcloudmanager reads phone photo positions from standard EXIF (`src/io/phonePhotoImport.ts`). Its drone poses come from photogrammetry camera data (`src/io/droneCameraImport.ts`), not a universal UTM EXIF tag. Exported JPEGs can be used there through the phone photo/GPS import. The additional MetaLens XMP section is stored, but the current Pointcloudmanager does not automatically interpret it as a camera pose.

## Formats

- JPEG: import, preview, GPS reading and writing.
- PNG, WebP, HEIC/HEIF: import and GPS reading when available; preview depends on browser/codec support. Metadata export supports original JPEG files. No silent format conversion takes place.
- DXF: POINT, LINE, LWPOLYLINE, POLYLINE including bulge arcs, CIRCLE, ARC, TEXT and MTEXT as map overlays. Other entity types, such as INSERT and SPLINE, are reported and not displayed. This is not a full CAD engine.
- Photos with existing GPS and no new assignment are included unchanged in the ZIP archive.

## Bavarian ALKIS

Service: <https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte>

WMS 1.1.1 in map CRS EPSG:3857, supported according to GetCapabilities. Four styles: color, gray, yellow outlines and black outlines. Adjustable opacity. Data coverage is limited to Bavaria. Attribution appears directly on the map: Bayerische Vermessungsverwaltung / LDBV, Datenlizenz Deutschland – Namensnennung 2.0. OSM attribution also appears directly on the map.

## Google Photos

A connection is possible in principle through the [Google Photos Picker API](https://developers.google.com/photos/picker/guides/get-started-picker): the user signs in and selects photos, which the app can then read. This requires a Google Cloud project, an enabled API, an OAuth client ID and an authorized web origin. This version contains **no active Google integration**.

The Library API cannot continuously read arbitrary existing albums; its read access is limited to app-created content. See [Google API changes](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/).

Google removes location metadata from API downloads using `=d`. A Picker integration would therefore not reliably provide existing phone GPS data. See the [official download documentation](https://developers.google.com/photos/picker/guides/media-items). Local original files are the preferred option for this use case; separate processing of Takeout JSON is another possible approach.

## Verification

`npm test` checks CSV parsing, unambiguous/ambiguous assignments, position precedence, EXIF precision, JPEG image data preservation, existing EXIF fields and XMP merging. Additional tests cover chronological ordering, image zoom/pan, Emlid offset correction and map thumbnail proportions. The included JPEG fixture is a synthetic 2×2 image without private information.

Integration testing with a locally available Neufahrn dataset:

```sh
EMLID_TEST_SOURCE='/path/to/emlid-app/neufahrn' npm test
```

Survey data and photos are not included in the repository. Verified: 107 points, 11 unambiguous photo matches and 441 supported DXF entities; byte-identical JPEG image data and ICC profiles, GPS/elevation values and manual positions without stale RTK information. Browser checks include ZIP/DXF import, ALKIS, export, narrow layouts and project preservation when switching to the inspector.

## Existing inspector

The existing panorama, HDR and copyright metadata features remain available. For the optional JXL decoder, place `jxl.min.js` and `jxl.wasm` in `public/`. The inspector still uses the existing Tailwind CDN; the survey view uses locally bundled CSS.

## Appearance, language and footer

The header lets you switch between light/dark mode and German/English. These settings also apply to the metadata inspector, help, photo assignments, number formatting and status messages. Only language and appearance preferences are stored in `localStorage`; photos and survey data remain temporarily in memory. Technical CSV column names, EXIF/XMP keys and exported numbers are not translated.

The footer follows SkyCheck's link pills: OpenStreetMap, ALKIS/LDBV and the data license, Pointcloudmanager, SkyCheck, legal notice, michael-radeck.de, GitHub and Ko-fi. The privacy/formats button opens the local processing information.

## Photo navigation and map controls

The centered photo strip displays five chronologically adjacent photos. Hover enlarges the preview and changes the selection; previous/next buttons and arrow keys navigate the entire series. The map follows the selection. Sorting uses EXIF capture time, then an Emlid timestamp in the filename, falling back to the file date (visibly identified).

Double-clicking a thumbnail, map marker or image preview opens the photo in place of the map. The strip can be collapsed while arrow keys and horizontal mouse-wheel navigation (including Shift + wheel) remain available. Escape or **Back to map** exits photo view. Home/End jump to the beginning/end. At either boundary, navigation in the opposite direction remains available; keyboard shortcuts do not interfere with input fields.

The gallery below the map scrolls horizontally with the selection and keeps the active photo centered where the gallery boundaries allow. This also works after changing filters or resizing the window.

Maximum map zoom: 26. OSM tiles are enlarged above level 19, and ALKIS tiles above level 22; extra zoom levels do not add background map detail. DXF geometry and survey points remain georeferenced. The eye button temporarily removes complete photo markers (image, frame, background and label) from the map. The floating photo strip and gallery below the map remain usable.

In large photo view, Ctrl + wheel zooms around the pointer up to 16×; dragging with the left mouse button pans the enlarged image. Plus/minus and fit buttons are also available. Changing photos resets the view; image boundaries limit panning.

Map thumbnail frames follow the actual image aspect ratio, including displayed EXIF orientation. Hover enlarges the whole thumbnail together with its frame and point label, while the pointer target remains unchanged. Enlarged previews do not intercept pointer events intended for neighboring markers and reset when the pointer leaves.

## Emlid assignment offset correction

**Enabled by default**, including after loading a new CSV. The **Emlid: one survey point back** button shifts automatically assigned photos to the immediately preceding CSV row. This addresses the observed case where a photo of the point just saved appears under the next point in the Emlid export.

CSV row order is used, including for nonnumeric point names; this is not point number minus one. First rows and invalid predecessors receive no substitute position. Manual assignments and GPS-only photos remain unchanged. The option can be turned off without changing the input data, restoring the original automatic assignments.

Display and export use the same assignment resolution. `positions.json`/`positions.csv` record the original assignment and applied offset.

## Published project

- Website: <https://measuremap-viewer-editor-emlid.netlify.app>
- Repository: <https://github.com/mradeck/measuremap-viewer-editor-emlid>
- Netlify build: `npm run typecheck && npm test && npm run build`, output `dist`, Node.js 22.
- `netlify.toml` contains the SPA fallback and cache headers. No tokens or private photos are included in the repository.

## Georeferenced orthophotos (GeoTIFF)

Load one `.tif` or `.tiff` through **Add files**, drag and drop, a folder, or a ZIP archive. Embedded georeferencing and CRS are required; external world files are not read. Supported coordinate systems include ETRS89 / UTM zones 28–38, WGS84 / UTM north/south, EPSG:4326 and EPSG:3857. Unsupported or missing CRS is reported instead of guessing. Affine rotation and PixelIsPoint are handled.

The orthophoto is reprojected into map tiles above the basemap/ALKIS and below DXF, survey points and photos. **Show all** includes its extent. The layer has visibility, opacity and removal controls. RGB/RGBA, grayscale and palette TIFFs are supported; alpha and NoData are transparent. RGB/RGBA supports 8/16-bit integer channels.

The app uses an overview for distant views and reads the visible GeoTIFF windows at native resolution when zoomed in, including 8K/16K images. Native windows are cached with a 32 MiB limit and at most two concurrent reads. Obsolete tile reads are cancelled when changing views. Bilinear interpolation preserves transparent edges, and high-DPI displays render up to twice the tile resolution. Original pixel resolution is the final detail limit; further zoom cannot add information. The TIFF stays unchanged and is not part of the photo metadata export. Loading another orthophoto replaces the current layer. Files remain local; reload discards the project.
