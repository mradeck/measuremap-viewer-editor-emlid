/**
 * Service to modify image binary data (JPEG & JXL) to inject XMP metadata.
 */
// @ts-ignore
import piexif from 'piexifjs';
import { PanoOptions, CopyrightOptions } from '../types';

const XMP_NAMESPACE = "http://ns.adobe.com/xap/1.0/\x00";

// --- JXL Signatures ---
const JXL_SIG_BOX = new Uint8Array([0x00, 0x00, 0x00, 0x0C, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A]);
const JXL_RAW_SIG = new Uint8Array([0xFF, 0x0A]);

export interface InjectionOptions extends PanoOptions, CopyrightOptions { }

// --- Helpers ---

// Robustly extract XMP packet from JPEG binary, sanitizing nulls
const extractXmpFromJpegBytes = (data: Uint8Array): string | null => {
    let pos = 2;
    const headerSig = new TextEncoder().encode(XMP_NAMESPACE);

    while (pos < data.length - 1) {
        if (data[pos] !== 0xFF) { pos++; continue; }
        const marker = data[pos + 1];

        // Stop at SOS (Start of Scan) - image data follows
        if (marker === 0xDA) break;

        // Safety check for length reading
        if (pos + 4 > data.length) break;
        const segLen = (data[pos + 2] << 8) | data[pos + 3];
        const segEnd = pos + 2 + segLen;

        if (marker === 0xE1) {
            // Check for XMP Namespace
            if (segLen > 29) {
                let match = true;
                for (let k = 0; k < headerSig.length; k++) {
                    if (data[pos + 4 + k] !== headerSig[k]) {
                        match = false; break;
                    }
                }
                if (match) {
                    const xmlBytes = data.slice(pos + 4 + headerSig.length, segEnd);
                    const raw = new TextDecoder().decode(xmlBytes);
                    // CRITICAL FIX: Remove null bytes and padding that choke DOMParser
                    return raw.replace(/\0/g, '').trim();
                }
            }
        }
        pos = segEnd;
    }
    return null;
};

// --- Image Resizing Logic ---
const resizeImageToLimit = async (file: File, maxWidth: number): Promise<{ blob: Blob, width: number, height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let w = img.width;
            let h = img.height;

            if (w <= maxWidth) {
                resolve({ blob: file, width: w, height: h });
                return;
            }

            const ratio = h / w;
            w = maxWidth;
            h = Math.round(w * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error("Could not create canvas context for resizing"));
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, w, h);

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve({ blob, width: w, height: h });
                } else {
                    reject(new Error("Canvas to Blob failed"));
                }
            }, 'image/jpeg', 0.95);
        };

        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };

        img.src = url;
    });
};

const createXmpPacket = (opts: InjectionOptions): string => {
    const w = Math.round(opts.width || 0);
    const h = Math.round(opts.height || 0);
    const heading = opts.heading ?? 0; // Default to 0
    const pitch = opts.pitch ?? 0;
    const roll = opts.roll ?? 0;

    // Basic GPano Shell
    let xmpContent = `    <rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/">
      <GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>
      <GPano:ProjectionType>equirectangular</GPano:ProjectionType>
      <GPano:CroppedAreaImageWidthPixels>${w}</GPano:CroppedAreaImageWidthPixels>
      <GPano:CroppedAreaImageHeightPixels>${h}</GPano:CroppedAreaImageHeightPixels>
      <GPano:FullPanoWidthPixels>${w}</GPano:FullPanoWidthPixels>
      <GPano:FullPanoHeightPixels>${h}</GPano:FullPanoHeightPixels>
      <GPano:CroppedAreaLeftPixels>0</GPano:CroppedAreaLeftPixels>
      <GPano:CroppedAreaTopPixels>0</GPano:CroppedAreaTopPixels>
      <GPano:InitialViewHeadingDegrees>${heading}</GPano:InitialViewHeadingDegrees>
      <GPano:InitialViewPitchDegrees>${pitch}</GPano:InitialViewPitchDegrees>
      <GPano:InitialViewRollDegrees>${roll}</GPano:InitialViewRollDegrees>
      <GPano:StitchingSoftware>MetaLens (based on PTGui standards)</GPano:StitchingSoftware>
    </rdf:Description>`;

    // Add Dublin Core for Copyright if provided
    if (opts.artist || opts.copyright) {
        let rights = opts.copyright || "";
        if (opts.year && rights) rights = `© ${opts.year} ${rights}`;
        else if (opts.year) rights = `© ${opts.year}`;

        xmpContent += `
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">`;

        if (opts.artist) {
            xmpContent += `
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${opts.artist}</rdf:li>
        </rdf:Seq>
      </dc:creator>`;
        }

        if (rights) {
            xmpContent += `
      <dc:rights>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${rights}</rdf:li>
        </rdf:Alt>
      </dc:rights>`;
        }

        xmpContent += `
    </rdf:Description>`;
    }

    return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
${xmpContent}
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

// Robust XML Pretty Printer to ensure readability
const prettifyXml = (sourceXml: string) => {
    const PADDING = '  ';
    let xml = sourceXml.replace(/>\s*</g, '><');
    xml = xml.replace(/(>)(<)(\/*)/g, '$1\n$2$3');

    let formatted = '';
    let pad = 0;

    const lines = xml.split('\n');

    lines.forEach((line) => {
        const isClosing = line.match(/^<\//);
        const isSelfClosing = line.match(/\/>$/);
        const isOpening = line.match(/^<[\w\?]/) && !isClosing && !isSelfClosing;

        if (isOpening && line.includes('rdf:Description')) {
            const attrIndent = '\n' + PADDING.repeat(pad + 2);
            line = line.replace(/\s+([a-zA-Z0-9_\-\.]+:[a-zA-Z0-9_\-\.]+)=/g, attrIndent + '$1=');
        }

        if (isClosing) {
            if (pad > 0) pad -= 1;
        }

        formatted += PADDING.repeat(pad) + line + '\n';

        if (isOpening) {
            if (!line.match(/<\/[\w\d:]+>$/)) {
                pad += 1;
            }
        }
    });

    return formatted.trim();
};

const mergeXmp = (originalXml: string | null, opts: InjectionOptions): string => {
    if (!originalXml || !originalXml.trim()) {
        return createXmpPacket(opts);
    }

    try {
        const parser = new DOMParser();
        // Remove null bytes again just to be safe
        const safeXml = originalXml.replace(/\0/g, '').trim();
        const doc = parser.parseFromString(safeXml, "application/xml");

        const parserError = doc.getElementsByTagName("parsererror");
        if (parserError.length > 0) {
            console.warn("XML Parse Error in existing metadata, creating fresh packet.", parserError[0].textContent);
            return createXmpPacket(opts);
        }

        let rdf = doc.getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "RDF")[0];
        if (!rdf) {
            // Retry case-insensitive search if NS fails (some parsers are picky)
            const allTags = doc.getElementsByTagName("*");
            for (let i = 0; i < allTags.length; i++) {
                if (allTags[i].localName === "RDF") {
                    rdf = allTags[i];
                    break;
                }
            }
        }

        if (!rdf) {
            console.warn("No RDF root found, creating fresh XMP.");
            return createXmpPacket(opts);
        }

        // --- Helper to get/create Description node ---
        const getOrCreateDescription = (ns?: string) => {
            // 1. Try to find existing Description that has this namespace defined
            // This is tricky in DOMParser. Simplest is to find ANY rdf:Description and add the NS to it,
            // OR create a new rdf:Description if we want cleanly separated blocks.
            // We'll create separate descriptions for cleaner merging.

            let desc = doc.createElementNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:Description");
            desc.setAttributeNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:about", "");
            if (ns) {
                // e.g. xmlns:GPano="..."
                const [prefix, uri] = ns.split('=');
                desc.setAttribute(prefix, uri.replace(/"/g, ''));
            }
            rdf.appendChild(desc);
            return desc;
        }

        // --- MERGE GPANO ---
        // We only touch GPano if we are actively setting pano options (width/height > 0)
        if (opts.width || opts.height) {
            // Find existing GPano description or create new
            // Easier to just remove old GPano tags from everywhere and insert fresh block
            const allDesc = doc.getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "Description");

            // Clean old GPano tags
            const gpanoTags = ["UsePanoramaViewer", "ProjectionType", "CroppedAreaImageWidthPixels", "CroppedAreaImageHeightPixels",
                "FullPanoWidthPixels", "FullPanoHeightPixels", "CroppedAreaLeftPixels", "CroppedAreaTopPixels",
                "InitialViewHeadingDegrees", "InitialViewPitchDegrees", "InitialViewRollDegrees", "StitchingSoftware"];

            // This is a bit destructive but safer to ensure consistency
            // We iterate backwards to safely remove
            /*
               Strategy:
               1. Search for any Description containing GPano attributes or children.
               2. Update them in place OR remove and re-add.

               Let's do "Remove and Re-Add" for GPano to ensure clean state.
            */

            // Actually, let's reuse the logic from before but be more specific
            let gpanoDesc: Element | null = null;

            // Try to find description with GPano namespace
            for (let i = 0; i < allDesc.length; i++) {
                if (allDesc[i].hasAttribute("xmlns:GPano")) {
                    gpanoDesc = allDesc[i];
                    break;
                }
            }

            if (!gpanoDesc) {
                gpanoDesc = getOrCreateDescription('xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"');
            }

            const setTag = (tag: string, val: string) => {
                const children = Array.from(gpanoDesc!.children);
                children.forEach(child => {
                    if (child.nodeName === "GPano:" + tag || child.localName === tag) {
                        gpanoDesc!.removeChild(child);
                    }
                });
                // Check attributes too
                if (gpanoDesc!.hasAttribute("GPano:" + tag)) {
                    gpanoDesc!.removeAttribute("GPano:" + tag);
                }

                const el = doc.createElement("GPano:" + tag);
                el.textContent = val;
                gpanoDesc!.appendChild(el);
            };

            const w = Math.round(opts.width || 0).toString();
            const h = Math.round(opts.height || 0).toString();

            setTag("UsePanoramaViewer", "True");
            setTag("ProjectionType", "equirectangular");
            setTag("CroppedAreaImageWidthPixels", w);
            setTag("CroppedAreaImageHeightPixels", h);
            setTag("FullPanoWidthPixels", w);
            setTag("FullPanoHeightPixels", h);
            setTag("CroppedAreaLeftPixels", "0");
            setTag("CroppedAreaTopPixels", "0");
            setTag("InitialViewHeadingDegrees", (opts.heading ?? 0).toString());
            setTag("InitialViewPitchDegrees", (opts.pitch ?? 0).toString());
            setTag("InitialViewRollDegrees", (opts.roll ?? 0).toString());
            setTag("StitchingSoftware", "MetaLens");
        }

        // --- MERGE DUBLIN CORE (Copyright) ---
        if (opts.artist || opts.copyright) {
            let dcDesc: Element | null = null;
            for (let i = 0; i < doc.getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "Description").length; i++) {
                const el = doc.getElementsByTagNameNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "Description")[i];
                if (el.hasAttribute("xmlns:dc")) {
                    dcDesc = el;
                    break;
                }
            }

            if (!dcDesc) {
                dcDesc = getOrCreateDescription('xmlns:dc="http://purl.org/dc/elements/1.1/"');
            }

            // Update Creator
            if (opts.artist) {
                // Remove existing creator
                Array.from(dcDesc.children).forEach(c => {
                    if (c.localName === 'creator') dcDesc!.removeChild(c);
                });

                const creator = doc.createElement("dc:creator");
                const seq = doc.createElement("rdf:Seq");
                const li = doc.createElement("rdf:li");
                li.textContent = opts.artist;
                seq.appendChild(li);
                creator.appendChild(seq);
                dcDesc.appendChild(creator);
            }

            // Update Rights
            if (opts.copyright || opts.year) {
                let rightsText = opts.copyright || "";
                if (opts.year && rightsText) rightsText = `© ${opts.year} ${rightsText}`;
                else if (opts.year) rightsText = `© ${opts.year}`;

                if (rightsText) {
                    // Remove existing rights
                    Array.from(dcDesc.children).forEach(c => {
                        if (c.localName === 'rights') dcDesc!.removeChild(c);
                    });

                    const rights = doc.createElement("dc:rights");
                    const alt = doc.createElement("rdf:Alt");
                    const li = doc.createElement("rdf:li");
                    li.setAttribute("xml:lang", "x-default");
                    li.textContent = rightsText;
                    alt.appendChild(li);
                    rights.appendChild(alt);
                    dcDesc.appendChild(rights);
                }
            }
        }

        const serializer = new XMLSerializer();
        let str = serializer.serializeToString(doc);

        if (!str.includes("<?xpacket")) {
            str = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n${str}\n<?xpacket end="w"?>`;
        }

        return prettifyXml(str);

    } catch (e) {
        console.error("XML Merge failed", e);
        return createXmpPacket(opts);
    }
};

/**
 * Main Entry Point
 */
export const injectImageMetadata = async (file: File, options: InjectionOptions): Promise<Blob> => {
    const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
    const isJxl = file.type === 'image/jxl' || file.name.toLowerCase().endsWith('.jxl');

    // 1. EXTRACT EXISTING METADATA FROM ORIGINAL FILE
    // This ensures that if we resize (which strips metadata), we can re-inject the original data.
    let originalXmp: string | null = null;
    let originalExifObj: any = null;

    if (isJpeg) {
        try {
            // Read XMP
            const buf = await file.arrayBuffer();
            originalXmp = extractXmpFromJpegBytes(new Uint8Array(buf));

            // Read Exif
            const binaryStr = await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = e => resolve(e.target?.result as string);
                r.onerror = reject;
                r.readAsBinaryString(file);
            });
            originalExifObj = piexif.load(binaryStr);
        } catch (e) {
            console.warn("Failed to extract original metadata", e);
        }
    }

    // Determine initial dimensions
    let width = options.width;
    let height = options.height;

    if (!width || !height) {
        if (isJpeg) {
            try {
                const dims = await getImageDimensions(file);
                width = dims.width;
                height = dims.height;
            } catch (e) { }
        }
    }

    // If we are just editing copyright, width/height might be 0/undefined, which is fine,
    // we just won't update the pano tags in mergeXmp unless they are provided.

    // However, for injectJpegMetadata to work correctly with Exif resize, we need valid numbers if we ARE resizing.
    // But injectJpegMetadata uses "options" which maps "InjectionOptions"

    let processingFile = file;

    // HANDLE RESIZING
    if (options.resizeToMax8k && width && width > 8192) {
        try {
            const resized = await resizeImageToLimit(file, 8192);
            processingFile = new File([resized.blob], file.name, { type: resized.blob.type });
            width = resized.width;
            height = resized.height;
        } catch (e) {
            console.error("Resize failed, proceeding with original size", e);
        }
    }

    const finalOpts = { ...options, width, height };

    if (processingFile.type === 'image/jpeg' || processingFile.name.toLowerCase().endsWith('.jpg')) {
        return injectJpegMetadata(processingFile, finalOpts, originalXmp, originalExifObj);
    } else if (processingFile.type === 'image/jxl' || processingFile.name.toLowerCase().endsWith('.jxl')) {
        return injectJxlMetadata(processingFile, finalOpts, originalXmp);
    }

    throw new Error("Unsupported file type. Only JPEG and JXL supported.");
};

// Backwards compatibility alias
export const injectPanoramaMetadata = injectImageMetadata;

// --- JPEG Implementation ---

const injectJpegMetadata = async (file: File, opts: InjectionOptions, existingXmp: string | null, existingExif: any): Promise<Blob> => {
    // 1. Read File
    let fileBinaryStr: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });

    // 2. EXIF Injection
    try {
        let exifObj = existingExif;

        // If we didn't have passed-in exif (e.g. no resize), load from current file
        if (!exifObj) {
            exifObj = piexif.load(fileBinaryStr);
        }

        const firstIfd = exifObj["0th"] || {};

        // Update basic Exif tags
        if (!firstIfd[piexif.ImageIFD.Make]) firstIfd[piexif.ImageIFD.Make] = "Equirectangular";
        if (!firstIfd[piexif.ImageIFD.Model]) firstIfd[piexif.ImageIFD.Model] = "Equirectangular";
        firstIfd[piexif.ImageIFD.Software] = "MetaLens";

        // IMPORTANT: Update dimensions in Exif if resized
        if (opts.width && opts.height) {
            firstIfd[piexif.ImageIFD.ImageWidth] = opts.width;
            firstIfd[piexif.ImageIFD.ImageLength] = opts.height;
            // Also update Exif SubIFD dimensions
            const exifIfd = exifObj["Exif"] || {};
            exifIfd[piexif.ExifIFD.PixelXDimension] = opts.width;
            exifIfd[piexif.ExifIFD.PixelYDimension] = opts.height;
            exifObj["Exif"] = exifIfd;
        }

        // Helper to encode UTF-8 to binary string for piexif (which writes raw bytes)
        const toUtf8Binary = (str: string): string => {
            const bytes = new TextEncoder().encode(str);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return binary;
        };

        // --- NEW: Inject Copyright/Artist into Exif ---
        if (opts.artist) {
            firstIfd[piexif.ImageIFD.Artist] = toUtf8Binary(opts.artist);
        }
        if (opts.copyright || opts.year) {
            let cText = opts.copyright || "";
            if (opts.year && cText) cText = `© ${opts.year} ${cText}`;
            else if (opts.year) cText = `© ${opts.year}`;

            if (cText) firstIfd[piexif.ImageIFD.Copyright] = toUtf8Binary(cText);
        }

        exifObj["0th"] = firstIfd;
        const exifBytes = piexif.dump(exifObj);

        // Insert (replaces existing Exif segment)
        fileBinaryStr = piexif.insert(exifBytes, fileBinaryStr);
    } catch (e) {
        console.warn("EXIF injection failed, proceeding...", e);
    }

    // 3. Convert to Uint8Array for Segment manipulation
    const len = fileBinaryStr.length;
    let data = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        data[i] = fileBinaryStr.charCodeAt(i);
    }

    // 4. Handle XMP
    // If we weren't given an XMP string (from original file), try to extract from current data
    if (existingXmp === null) {
        existingXmp = extractXmpFromJpegBytes(data);
    }

    // Merge XMP
    const newXmpString = mergeXmp(existingXmp, opts);

    // 5. Rebuild JPEG Segments (Removing OLD XMP segments)
    const segments: Uint8Array[] = [];

    // Add SOI (FF D8)
    segments.push(data.slice(0, 2));

    let pos = 2;
    const headerSig = new TextEncoder().encode(XMP_NAMESPACE);

    while (pos < data.length - 1) {
        if (data[pos] !== 0xFF) { pos++; continue; }
        const marker = data[pos + 1];
        if (marker === 0xDA) {
            segments.push(data.slice(pos)); // SOS to end
            break;
        }

        if (pos + 4 > data.length) break;
        const segLen = (data[pos + 2] << 8) | data[pos + 3];
        const segEnd = pos + 2 + segLen;

        let isXmpSegment = false;
        if (marker === 0xE1 && segLen > 29) {
            let match = true;
            for (let k = 0; k < headerSig.length; k++) {
                if (data[pos + 4 + k] !== headerSig[k]) {
                    match = false; break;
                }
            }
            if (match) isXmpSegment = true;
        }

        // Keep non-XMP segments (Exif is already handled/embedded in 'data' via piexif)
        if (!isXmpSegment) {
            segments.push(data.slice(pos, segEnd));
        }

        pos = segEnd;
    }

    // 6. Create New XMP Segment
    const encoder = new TextEncoder();
    const xmpBytes = encoder.encode(newXmpString);
    const headerBytes = encoder.encode(XMP_NAMESPACE);

    const totalSegmentSize = 2 + headerBytes.length + xmpBytes.length;
    if (totalSegmentSize > 65535) throw new Error("Merged XMP Metadata too large for JPEG segment.");

    const newSegment = new Uint8Array(2 + totalSegmentSize);
    let p = 0;
    newSegment[p++] = 0xFF;
    newSegment[p++] = 0xE1;
    newSegment[p++] = (totalSegmentSize >> 8) & 0xFF;
    newSegment[p++] = totalSegmentSize & 0xFF;
    newSegment.set(headerBytes, p);
    p += headerBytes.length;
    newSegment.set(xmpBytes, p);

    // 7. Insert New XMP immediately after SOI
    // segments[0] is SOI
    const finalSegments = [segments[0], newSegment, ...segments.slice(1)];

    // Flatten array
    const totalLen = finalSegments.reduce((acc, s) => acc + s.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const s of finalSegments) {
        result.set(s, offset);
        offset += s.length;
    }

    return new Blob([result], { type: 'image/jpeg' });
};

// --- JXL Implementation (ISO BMFF) ---

const injectJxlMetadata = async (file: File, opts: InjectionOptions, existingXmp: string | null): Promise<Blob> => {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const dataView = new DataView(arrayBuffer);

    // 1. Raw Codestream Check
    if (data[0] === 0xFF && data[1] === 0x0A) {
        // ... (Codestream wrapping logic same as before) ...
        const xmpString = createXmpPacket(opts); // JXL raw won't have existing XMP usually
        const encoder = new TextEncoder();
        const xmpBytes = encoder.encode(xmpString);

        const boxSize = 8 + xmpBytes.length;
        const xmlBox = new Uint8Array(boxSize);
        const xmlView = new DataView(xmlBox.buffer);
        xmlView.setUint32(0, boxSize);
        xmlBox.set([0x78, 0x6D, 0x6C, 0x20], 4);
        xmlBox.set(xmpBytes, 8);

        const sigBox = JXL_SIG_BOX;
        const ftypBox = new Uint8Array([
            0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x6A, 0x78, 0x6C, 0x20, 0x00, 0x00, 0x00, 0x01, 0x6A, 0x78, 0x6C, 0x20
        ]);
        const jxlcHeader = new Uint8Array(8);
        const jxlcView = new DataView(jxlcHeader.buffer);
        jxlcView.setUint32(0, 8 + data.length);
        jxlcHeader.set([0x6A, 0x78, 0x6C, 0x63], 4);

        return new Blob([sigBox, ftypBox, xmlBox, jxlcHeader, data], { type: 'image/jxl' });
    }

    // 2. Container Logic
    const parts: BlobPart[] = [];
    let isContainer = true;
    for (let i = 0; i < 12; i++) {
        if (data[i] !== JXL_SIG_BOX[i]) { isContainer = false; break; }
    }
    if (!isContainer) throw new Error("Invalid JXL format");

    parts.push(data.slice(0, 12));

    let offset = 12;
    let ftypFound = false;
    let xmlInserted = false;

    // First Pass: Extract existing XML if not provided
    if (existingXmp === null) {
        let tempOffset = 12;
        while (tempOffset < data.length) {
            if (tempOffset + 8 > data.length) break;
            let size = dataView.getUint32(tempOffset, false);
            const typeArr = data.slice(tempOffset + 4, tempOffset + 8);
            const type = String.fromCharCode(...typeArr);
            let effectiveSize = size;
            let headerSize = 8;
            if (size === 1) {
                headerSize = 16;
                effectiveSize = dataView.getUint32(tempOffset + 12, false);
            }
            if (effectiveSize === 0) effectiveSize = data.length - tempOffset;

            if (type === 'xml ') {
                const content = data.slice(tempOffset + headerSize, tempOffset + effectiveSize);
                const decoder = new TextDecoder('utf-8');
                const raw = decoder.decode(content);
                // Sanitize
                existingXmp = raw.replace(/\0/g, '').trim();
                break;
            }
            tempOffset += effectiveSize;
        }
    }

    const newXmpStr = mergeXmp(existingXmp, opts);
    const encoder = new TextEncoder();
    const newXmpBytes = encoder.encode(newXmpStr);

    const newBoxSize = 8 + newXmpBytes.length;
    const newXmlBox = new Uint8Array(newBoxSize);
    const newXmlView = new DataView(newXmlBox.buffer);
    newXmlView.setUint32(0, newBoxSize);
    newXmlBox.set([0x78, 0x6D, 0x6C, 0x20], 4);
    newXmlBox.set(newXmpBytes, 8);


    // Second Pass: Rebuild
    while (offset < data.length) {
        if (offset + 8 > data.length) break;

        let size = dataView.getUint32(offset, false);
        const typeArr = data.slice(offset + 4, offset + 8);
        const type = String.fromCharCode(...typeArr);

        let headerSize = 8;
        let effectiveSize = size;

        if (size === 1) {
            headerSize = 16;
            effectiveSize = dataView.getUint32(offset + 12, false);
        }
        if (effectiveSize === 0) effectiveSize = data.length - offset;

        const boxData = data.slice(offset, offset + effectiveSize);

        if (type === 'ftyp') {
            parts.push(boxData);
            ftypFound = true;
            parts.push(newXmlBox);
            xmlInserted = true;
        } else if (type === 'xml ') {
            // SKIP existing XML
            if (!xmlInserted) {
                parts.push(newXmlBox);
                xmlInserted = true;
            }
        } else {
            if (!xmlInserted && (type === 'jxlc' || type === 'jxlp')) {
                parts.push(newXmlBox);
                xmlInserted = true;
            }
            parts.push(boxData);
        }

        offset += effectiveSize;
    }

    if (!xmlInserted) parts.push(newXmlBox);

    return new Blob(parts, { type: 'image/jxl' });
};

const getImageDimensions = (file: File): Promise<{ width: number, height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};