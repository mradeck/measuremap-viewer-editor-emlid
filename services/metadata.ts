import { ParsedMetadata } from '../types';

/**
 * A specialized lightweight parser to extract XMP (for Panorama flags)
 * and basic Exif directly from binary data.
 */

const EXIF_TAGS: Record<number, string> = {
    0x010F: 'Make',
    0x0110: 'Model',
    0x0112: 'Orientation',
    0x0131: 'Software',
    0x0132: 'ModifyDate',
    0x013B: 'Artist',
    0x8298: 'Copyright',
    0x8769: 'ExifOffset',
    0x8825: 'GPSInfo',
    0x829a: 'ExposureTime',
    0x829d: 'FNumber',
    0x8822: 'ExposureProgram',
    0x8827: 'ISO',
    0x8830: 'SensitivityType',
    0x8832: 'RecommendedExposureIndex',
    0x9000: 'ExifVersion',
    0x9003: 'DateTimeOriginal',
    0x9004: 'CreateDate',
    0x9010: 'OffsetTime',
    0x9011: 'OffsetTimeOriginal',
    0x9012: 'OffsetTimeDigitized',
    0x9201: 'ShutterSpeedValue',
    0x9202: 'ApertureValue',
    0x9203: 'BrightnessValue',
    0x9204: 'ExposureBiasValue',
    0x9205: 'MaxApertureValue',
    0x9206: 'SubjectDistance',
    0x9207: 'MeteringMode',
    0x9208: 'LightSource',
    0x9209: 'Flash',
    0x920a: 'FocalLength',
    0x9214: 'SubjectArea',
    0xA001: 'ColorSpace',
    0xA002: 'ExifImageWidth',
    0xA003: 'ExifImageHeight',
    0xA217: 'SensingMethod',
    0xA300: 'FileSource',
    0xA301: 'SceneType',
    0xA401: 'CustomRendered',
    0xA402: 'ExposureMode',
    0xA403: 'WhiteBalance',
    0xA404: 'DigitalZoomRatio',
    0xA405: 'FocalLengthIn35mmFormat',
    0xA406: 'SceneCaptureType',
    0xA407: 'GainControl',
    0xA408: 'Contrast',
    0xA409: 'Saturation',
    0xA40A: 'Sharpness',
    0xA40C: 'SubjectDistanceRange',
    0xA431: 'BodySerialNumber',
    0xA432: 'LensSpecification',
    0xA433: 'LensMake',
    0xA434: 'LensModel',
    0xA435: 'LensSerialNumber',
};

const GPS_TAGS: Record<number, string> = {
    0x0000: 'GPSVersionID',
    0x0001: 'GPSLatitudeRef',
    0x0002: 'GPSLatitude',
    0x0003: 'GPSLongitudeRef',
    0x0004: 'GPSLongitude',
    0x0005: 'GPSAltitudeRef',
    0x0006: 'GPSAltitude',
    0x0007: 'GPSTimeStamp',
    0x0012: 'GPSMapDatum',
    0x001D: 'GPSDateStamp',
};

export const parseImageMetadata = async (file: File): Promise<ParsedMetadata> => {
    if (file.size === 0) {
        throw new Error("File is empty (0 bytes).");
    }

    let arrayBuffer: ArrayBuffer | null = null;
    let errorStack = "";

    // Strategy 1: Standard .arrayBuffer()
    try {
        arrayBuffer = await file.arrayBuffer();
    } catch (e: any) {
        errorStack += `Standard Limit: ${e.message}; `;
    }

    // Strategy 2: FileReader (Fallback)
    if (!arrayBuffer) {
        try {
            console.warn("Strategy 1 failed, trying FileReader...");
            arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                // Enhanced error handling for FileReader
                reader.onerror = () => reject(new Error(reader.error?.message || "Unknown FileReader error"));
                reader.readAsArrayBuffer(file);
            });
        } catch (e: any) {
            errorStack += `FileReader: ${e.message}; `;
        }
    }

    // Strategy 3: Slice Trick (Creates new Blob reference)
    if (!arrayBuffer) {
        try {
            console.warn("Strategy 2 failed, trying Blob.slice()...");
            const blob = file.slice(0, file.size);
            arrayBuffer = await blob.arrayBuffer();
        } catch (e: any) {
            errorStack += `Slice: ${e.message}; `;
        }
    }

    // Strategy 4: Fetch via Object URL (Bypasses some File object restrictions)
    if (!arrayBuffer) {
        try {
            console.warn("Strategy 3 failed, trying fetch(objectURL)...");
            const url = URL.createObjectURL(file);
            const response = await fetch(url);
            arrayBuffer = await response.arrayBuffer();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            errorStack += `Fetch: ${e.message}; `;
        }
    }

    if (!arrayBuffer) {
        // Helpful error hint for the specific "permission" error
        if (errorStack.includes("permission") || errorStack.includes("could not be read")) {
            throw new Error(`Permission Error. The browser cannot read this file. \n\nSOLUTION: Please move the file to a local folder (like 'Downloads' or 'Desktop') and try again. Cloud files (iCloud/Drive) often cause this. (Debug: ${errorStack})`);
        }
        throw new Error(`Failed to read file after 4 attempts. ${errorStack}`);
    }

    const data = new DataView(arrayBuffer);

    // Robust MIME type detection
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
        if (file.name.toLowerCase().endsWith('.jxl')) mimeType = 'image/jxl';
        else if (file.name.toLowerCase().endsWith('.heic')) mimeType = 'image/heic';
    }

    // Check JXL Magic Bytes (Container or Codestream)
    // 00 00 00 0C 4A 58 4C 20 (Container) or FF 0A (Codestream)
    if (data.byteLength > 12) {
        const magic = data.getUint32(0, false); // First 4 bytes
        const magic2 = data.getUint32(4, false); // Next 4 bytes
        if ((magic === 0x0000000C && magic2 === 0x4A584C20) || (data.getUint16(0) === 0xFF0A)) {
            mimeType = 'image/jxl';
        }
    }

    const result: ParsedMetadata = {
        isPanorama: false,
        colorSpace: 'Unknown',
        mimeType: mimeType,
        fileSize: file.size,
        hasHdrFlags: false,
        rawExif: {},
        hdrData: {}
    };

    try {
        const dims = await getImageDimensions(file);
        result.width = dims.width;
        result.height = dims.height;

        // Logic specific for JPEG structure
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            parseJpegMarkers(data, result);
        } else {
            // For JXL, PNG, etc., scan binary.
            scanBinaryForMetadata(data, result);
        }

        if (result.projectionType === 'equirectangular' || result.usePanoramaViewer) {
            result.isPanorama = true;
        }

        // --- CONFLICT RESOLUTION LOGIC ---
        const exifSaysSrgb = result.colorSpace === 'sRGB' || result.colorSpace === 'sRGB (Default)';
        const hasHighNits = (result.hdrData?.maxNits || 0) > 250;
        const hasWidePrimaries = !!result.hdrData?.primaries;

        if (hasHighNits || hasWidePrimaries) {
            result.hasHdrFlags = true;
            let spaceName = "HDR (Rec.2020/P3)";
            if (result.hdrData?.primaries?.startsWith("0.7")) {
                spaceName = "Rec.2020 (HDR)";
            } else if (result.hdrData?.primaries) {
                spaceName = "Wide Gamut (HDR)";
            }

            if (exifSaysSrgb) {
                result.colorSpace = `${spaceName} (Overrides Exif sRGB)`;
            } else {
                result.colorSpace = spaceName;
            }
        }
        else if (result.colorSpace === 'Unknown' || result.colorSpace === 'sRGB (Default)') {
            if (result.hasHdrFlags) {
                result.colorSpace = 'HDR (Format Flag)';
            } else if (mimeType === 'image/heic') {
                result.colorSpace = 'Display P3 (Likely)';
            } else if (mimeType === 'image/jxl') {
                result.colorSpace = 'Unknown (Likely Wide Gamut)';
            } else {
                result.colorSpace = 'sRGB (Standard)';
            }
        }

        // --- POPULATE COPYRIGHT INFO ---
        if (result.rawExif) {
            if (result.rawExif['Artist']) result.artist = result.rawExif['Artist'];
            if (result.rawExif['Copyright']) result.copyright = result.rawExif['Copyright'];
            if (result.rawExif['Software']) result.software = result.rawExif['Software'];
        }

        // Fallback to XMP if Exif is missing
        if (!result.artist && result.rawXmp) {
            const creatorMatch = result.rawXmp.match(/dc:creator>([^<]+)<\/dc:creator>/i) ||
                result.rawXmp.match(/dc:creator="([^"]+)"/i);
            if (creatorMatch && creatorMatch[1]) result.artist = creatorMatch[1];
        }
        if (!result.copyright && result.rawXmp) {
            const rightsMatch = result.rawXmp.match(/dc:rights>([^<]+)<\/dc:rights>/i) ||
                result.rawXmp.match(/dc:rights>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]+)<\/rdf:li>/i) ||
                result.rawXmp.match(/dc:rights="([^"]+)"/i);
            if (rightsMatch && rightsMatch[1]) result.copyright = rightsMatch[1];
        }

    } catch (error) {
        console.error("Metadata parsing failed:", error);
    }

    return result;
};

const getImageDimensions = (file: File): Promise<{ width?: number, height?: number }> => {
    return new Promise((resolve) => {
        // Standard Image Object (works for JPG, PNG, WEBP)
        const img = new Image();
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            URL.revokeObjectURL(img.src);
            resolve({ width: w, height: h });
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            resolve({ width: undefined, height: undefined });
        };
        img.src = URL.createObjectURL(file);
    });
};

const analyzeXmpContent = (xmpStr: string, result: ParsedMetadata) => {
    // Check for "GPano:UsePanoramaViewer" in both Attribute style (old Adobe) and Element style (DOM/XML)
    // Attribute: GPano:UsePanoramaViewer="True"
    // Element: <GPano:UsePanoramaViewer>True</GPano:UsePanoramaViewer>

    const usePanoRegex = /GPano:UsePanoramaViewer(="True"|="true"|>True<|>true<)/i;
    if (usePanoRegex.test(xmpStr)) {
        result.usePanoramaViewer = true;
        result.isPanorama = true;
    }

    const projTypeRegex = /GPano:ProjectionType(="equirectangular"|>equirectangular<)/i;
    if (projTypeRegex.test(xmpStr)) {
        result.projectionType = 'equirectangular';
        result.isPanorama = true;
    }

    if (xmpStr.includes('GImage:Mime') || xmpStr.includes('hdrgm:Version')) {
        result.hasHdrFlags = true;
    }

    const maxNitsMatch = xmpStr.match(/ccv_max_luminance_nits\s*=\s*["']?([\d\.]+)["']?/i);
    if (maxNitsMatch && maxNitsMatch[1]) {
        result.hasHdrFlags = true;
        if (!result.hdrData) result.hdrData = {};
        result.hdrData.maxNits = parseFloat(maxNitsMatch[1]);
    }

    const minNitsMatch = xmpStr.match(/ccv_min_luminance_nits\s*=\s*["']?([\d\.]+)["']?/i);
    if (minNitsMatch && minNitsMatch[1]) {
        if (!result.hdrData) result.hdrData = {};
        result.hdrData.minNits = parseFloat(minNitsMatch[1]);
    }

    const avgNitsMatch = xmpStr.match(/ccv_avg_luminance_nits\s*=\s*["']?([\d\.]+)["']?/i);
    if (avgNitsMatch && avgNitsMatch[1]) {
        if (!result.hdrData) result.hdrData = {};
        result.hdrData.avgNits = parseFloat(avgNitsMatch[1]);
    }

    const primariesMatch = xmpStr.match(/ccv_primaries_xy\s*=\s*["']?([\d\.,\s]+)["']?/i);
    if (primariesMatch && primariesMatch[1]) {
        if (!result.hdrData) result.hdrData = {};
        result.hdrData.primaries = primariesMatch[1];
        result.hasHdrFlags = true;
    }

    if (xmpStr.includes('hdr_metadata:')) {
        result.hasHdrFlags = true;
    }
};

const scanBinaryForMetadata = (view: DataView, result: ParsedMetadata) => {
    // If file is < 50MB, scan the whole thing to ensure we find XMP at the end (typical in some JXL edits)
    // Otherwise scan first 10MB.
    const scanSize = view.byteLength < 50 * 1024 * 1024 ? view.byteLength : 10 * 1024 * 1024;
    const bytes = new Uint8Array(view.buffer, 0, scanSize);

    // 1. Text Scan for XMP
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

    analyzeXmpContent(text, result);

    // Find ALL XMP packets, not just the first one
    const xmpRegex = /<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g;
    const matches = text.match(xmpRegex);

    if (matches && matches.length > 0) {
        if (matches.length === 1) {
            result.rawXmp = matches[0];
        } else {
            result.rawXmp = `<!-- FOUND ${matches.length} XMP PACKETS -->\n\n` + matches.map((m, i) => `<!-- PACKET ${i + 1} -->\n${m}`).join("\n\n");
        }
    } else if (result.isPanorama || result.hasHdrFlags) {
        // Create partial view
        let debugInfo = "Parsed Partial XMP/Metadata Flags:\n";
        if (result.hdrData?.maxNits) debugInfo += `Max Nits: ${result.hdrData.maxNits}\n`;
        if (result.hdrData?.minNits) debugInfo += `Min Nits: ${result.hdrData.minNits}\n`;
        if (result.hdrData?.primaries) debugInfo += `Primaries: ${result.hdrData.primaries}\n`;
        if (text.includes('GPano:')) debugInfo += "Google Panorama Flags detected.\n";
        result.rawXmp = result.rawXmp ? result.rawXmp + "\n\n" + debugInfo : debugInfo;
    }

    // 2. Binary Scan for TIFF Headers
    // Scan first 5MB for Exif headers
    const binaryScanLimit = Math.min(bytes.length, 5 * 1024 * 1024);

    for (let i = 0; i < binaryScanLimit - 16; i++) {
        // Look for TIFF header marks II or MM
        if (bytes[i] !== 0x49 && bytes[i] !== 0x4D) continue;

        let found = false;

        // Check Little Endian
        if (bytes[i] === 0x49 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0x2A && bytes[i + 3] === 0x00) {
            found = tryParseTiff(view, i, true, result);
        }
        // Check Big Endian
        else if (bytes[i] === 0x4D && bytes[i + 1] === 0x4D && bytes[i + 2] === 0x00 && bytes[i + 3] === 0x2A) {
            found = tryParseTiff(view, i, false, result);
        }

        if (found) break;
    }
};

const tryParseTiff = (view: DataView, tiffStart: number, isLittle: boolean, result: ParsedMetadata): boolean => {
    try {
        if (view.byteLength < tiffStart + 8) return false;

        const ifdOffset = view.getUint32(tiffStart + 4, isLittle);
        if (ifdOffset < 8 || ifdOffset > 0xFFFF) return false;

        const tags: Record<string, any> = {};

        // 1. Read IFD0 (Main Image)
        const nextIfd = readIfd(view, tiffStart, ifdOffset, isLittle, tags, EXIF_TAGS);

        // 2. Look for Exif SubIFD (Usually tag 0x8769 in IFD0)
        if (tags['ExifOffset']) {
            readIfd(view, tiffStart, tags['ExifOffset'], isLittle, tags, EXIF_TAGS);
        }

        // 3. Look for GPS IFD (Usually tag 0x8825 in IFD0)
        if (tags['GPSInfo']) {
            const gpsTags: Record<string, any> = {};
            readIfd(view, tiffStart, tags['GPSInfo'], isLittle, gpsTags, GPS_TAGS);

            // Merge formatted GPS into main tags
            if (gpsTags['GPSLatitude'] && gpsTags['GPSLatitudeRef'] &&
                gpsTags['GPSLongitude'] && gpsTags['GPSLongitudeRef']) {

                const lat = convertDMSToDeg(gpsTags['GPSLatitude'], gpsTags['GPSLatitudeRef']);
                const lng = convertDMSToDeg(gpsTags['GPSLongitude'], gpsTags['GPSLongitudeRef']);

                tags['GPSPosition'] = `${lat}, ${lng}`;
                tags['GPSLatitude'] = formatDMS(gpsTags['GPSLatitude'], gpsTags['GPSLatitudeRef']);
                tags['GPSLongitude'] = formatDMS(gpsTags['GPSLongitude'], gpsTags['GPSLongitudeRef']);
            }

            // Copy other GPS tags
            Object.assign(tags, gpsTags);
        }

        if (Object.keys(tags).length > 0) {
            result.rawExif = tags;
            if (tags['ColorSpace'] === 1) result.colorSpace = 'sRGB';
            else if (tags['ColorSpace'] === 65535) result.colorSpace = 'Uncalibrated';
            else if (tags['ColorSpace']) result.colorSpace = `ColorSpace:${tags['ColorSpace']}`;
            return true;
        }
    } catch (e) {
        // console.error(e);
        return false;
    }
    return false;
};

const convertDMSToDeg = (dms: number[], ref: string) => {
    let deg = dms[0] + dms[1] / 60 + dms[2] / 3600;
    if (ref === 'S' || ref === 'W') deg = -deg;
    return deg.toFixed(6);
};

const formatDMS = (dms: number[], ref: string) => {
    return `${dms[0]}° ${dms[1]}' ${dms[2].toFixed(2)}" ${ref}`;
};

const parseJpegMarkers = (view: DataView, result: ParsedMetadata) => {
    let offset = 2;
    const length = view.byteLength;
    const foundXmps: string[] = [];

    while (offset < length - 2) {
        const marker = view.getUint16(offset, false);
        offset += 2;

        if (marker === 0xFFDA) break;

        const blockSize = view.getUint16(offset, false);

        if (marker === 0xFFE1) {
            const xmpPart = parseApp1(view, offset + 2, blockSize - 2, result);
            if (xmpPart) foundXmps.push(xmpPart);
        }

        offset += blockSize;
    }

    // Combine multiple XMPs if found in APP1 segments
    if (foundXmps.length > 0) {
        if (foundXmps.length === 1) {
            result.rawXmp = foundXmps[0];
        } else {
            result.rawXmp = `<!-- FOUND ${foundXmps.length} XMP SEGMENTS -->\n\n` + foundXmps.map((m, i) => `<!-- SEGMENT ${i + 1} -->\n${m}`).join("\n\n");
        }
        // Re-run analysis on the combined/last found to ensure flags are set
        analyzeXmpContent(result.rawXmp || "", result);
    }
};

const parseApp1 = (view: DataView, start: number, length: number, result: ParsedMetadata): string | null => {
    const textDecoder = new TextDecoder('utf-8');
    const headerBytes = new Uint8Array(view.buffer, start, 29);
    const headerStr = String.fromCharCode(...headerBytes);

    if (headerStr.startsWith("Exif")) {
        const tiffStart = start + 6;
        const endian = view.getUint16(tiffStart, false);
        const isLittle = endian === 0x4949;

        if (view.getUint16(tiffStart + 2, isLittle) !== 0x002A) return null;

        const ifdOffset = view.getUint32(tiffStart + 4, isLittle);

        // Use the same robust parsing logic as standard TIFF
        tryParseTiff(view, tiffStart, isLittle, result);
        return null;

    } else if (headerStr.startsWith("http://ns.adobe.com/xap/1.0/")) {
        const xmpBytes = new Uint8Array(view.buffer, start + 29, length - 29);
        const xmpStr = textDecoder.decode(xmpBytes);
        return xmpStr;
    }
    return null;
};

const readIfd = (view: DataView, tiffStart: number, offset: number, isLittle: boolean, tags: Record<string, any>, tagDict: Record<number, string>): number | null => {
    if (offset + tiffStart >= view.byteLength) return null;

    const numEntries = view.getUint16(tiffStart + offset, isLittle);
    let currentEntryOffset = tiffStart + offset + 2;
    let nextIfdOffset = null;

    for (let i = 0; i < numEntries; i++) {
        if (currentEntryOffset + 12 > view.byteLength) break;

        const tag = view.getUint16(currentEntryOffset, isLittle);
        const type = view.getUint16(currentEntryOffset + 2, isLittle);
        const count = view.getUint32(currentEntryOffset + 4, isLittle);
        const valueOffset = currentEntryOffset + 8;

        const tagName = tagDict[tag];

        if (tagName) {
            const val = readTagValue(view, tiffStart, valueOffset, type, count, isLittle);
            if (val !== undefined && val !== null) {
                tags[tagName] = val;
            }
        }

        // Capture offsets even if they aren't in the standard dict, if we know them specifically
        if (tag === 0x8769) {
            const val = readTagValue(view, tiffStart, valueOffset, type, count, isLittle);
            if (val) tags['ExifOffset'] = val;
        }
        if (tag === 0x8825) {
            const val = readTagValue(view, tiffStart, valueOffset, type, count, isLittle);
            if (val) tags['GPSInfo'] = val;
        }

        currentEntryOffset += 12;
    }

    return nextIfdOffset;
};

const readTagValue = (view: DataView, tiffStart: number, offsetPtr: number, type: number, count: number, isLittle: boolean) => {
    const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const size = typeSizes[type] || 0;
    const totalSize = size * count;

    let dataOffset = offsetPtr;

    if (totalSize > 4) {
        dataOffset = tiffStart + view.getUint32(offsetPtr, isLittle);
    }

    if (dataOffset + totalSize > view.byteLength) return undefined;

    switch (type) {
        case 2: // ASCII
            const bytes = new Uint8Array(view.buffer, dataOffset, count - 1);
            // Handle null termination safely
            let str = new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
            return str;
        case 3: // SHORT
            if (count === 1) return view.getUint16(dataOffset, isLittle);
            const shorts = [];
            for (let i = 0; i < count; i++) shorts.push(view.getUint16(dataOffset + i * 2, isLittle));
            return shorts;
        case 4: // LONG
        case 9: // SLONG
            if (count === 1) return view.getUint32(dataOffset, isLittle);
            const longs = [];
            for (let i = 0; i < count; i++) longs.push(view.getUint32(dataOffset + i * 4, isLittle));
            return longs;
        case 5: // RATIONAL
        case 10: // SRATIONAL
            const rationals = [];
            for (let i = 0; i < count; i++) {
                const n = view.getUint32(dataOffset + i * 8, isLittle);
                const d = view.getUint32(dataOffset + i * 8 + 4, isLittle);
                rationals.push(d === 0 ? 0 : n / d);
            }
            if (count === 1) return rationals[0];
            return rationals;
        default:
            return undefined;
    }
};