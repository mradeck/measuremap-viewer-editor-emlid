import {translate as t} from './ui/translations';
import React, { useState, useEffect, useRef } from 'react';
import { ImageFile, ParsedMetadata, AnalysisStatus } from './types';
import { parseImageMetadata } from './services/metadata';
import { injectPanoramaMetadata, injectImageMetadata } from './services/modifier';
import { detectCamera } from './services/droneDetector';
import ImageUploader from './components/ImageUploader';
import StatusCard, { MetadataViewer } from './components/MetadataCard';
import { Scan, Camera, Maximize2, Info, Download, Loader2, X, Wand2, ImageOff, MapPin, Wifi, WifiOff, RefreshCw, HardDriveDownload, Move3d, ArrowDownToLine } from 'lucide-react';

// --- Connectivity Checker ---
const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

// --- JXL Dynamic Loader (Multi-Mirror Strategy) ---

const MIRRORS = [
    {
        name: t("Local (Offline)"),
        js: "./jxl.min.js",
        wasm: "./jxl.wasm"
    },
    {
        name: t("Niutech (Primary)"),
        js: "https://niutech.github.io/jxl.js/jxl.min.js",
        wasm: "https://niutech.github.io/jxl.js/jxl.wasm"
    },
    {
        name: "JSDelivr CDN",
        js: "https://cdn.jsdelivr.net/npm/jxl.js@0.0.3/jxl.min.js",
        wasm: "https://cdn.jsdelivr.net/npm/jxl.js@0.0.3/jxl.wasm"
    }
];

let loadPromise: Promise<void> | null = null;

const loadJxlLibrary = async (setStatus: (msg: string) => void): Promise<void> => {
    if ((window as any).Jxl) return; // Already loaded
    if (loadPromise) return loadPromise;

    loadPromise = new Promise(async (resolve, reject) => {
        // Try mirrors sequentially
        for (const mirror of MIRRORS) {
            try {
                // Skip network mirrors if offline, but always try Local
                if (mirror.name !== t("Local (Offline)") && !navigator.onLine) continue;

                setStatus(`Trying ${mirror.name}...`);

                // Set up the Module configuration specifically for this mirror's WASM location
                (window as any).JxlDecoderModule = {
                    locateFile: (path: string) => {
                        if (path.endsWith('.wasm')) return mirror.wasm;
                        return path;
                    }
                };

                await new Promise<void>((resScript, rejScript) => {
                    // Check if script tag already exists for this mirror
                    const existing = document.querySelector(`script[src="${mirror.js}"]`);
                    if (existing) {
                        resScript();
                        return;
                    }

                    const script = document.createElement('script');
                    script.src = mirror.js;
                    script.crossOrigin = "anonymous";
                    script.onload = () => resScript();
                    script.onerror = () => rejScript(new Error(t("Failed to load script")));
                    document.head.appendChild(script);
                });

                // Wait for Jxl global to initialize
                let attempts = 0;
                while (!(window as any).Jxl && attempts < 20) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                if ((window as any).Jxl) {
                    console.log(`Loaded JXL via ${mirror.name}`);
                    resolve();
                    return; // Success, exit loop
                } else {
                    throw new Error(t("Script loaded but Jxl object missing"));
                }

            } catch (e) {
                console.warn(`Failed to load from ${mirror.name}`, e);
                // Clean up global to try next mirror cleanly
                (window as any).JxlDecoderModule = undefined;
                continue;
            }
        }

        loadPromise = null; // Reset if all failed
        reject(new Error(t("All mirrors failed")));
    });

    return loadPromise;
};

// --- JXL Preview Component ---
const JxlPreview: React.FC<{ file: ImageFile }> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [decodingState, setDecodingState] = useState<'loading' | 'success' | 'error' | 'missing_deps'>('loading');
    const [statusText, setStatusText] = useState<string>("Initializing...");
    const [errorMsg, setErrorMsg] = useState<string>("");
    const isOnline = useOnlineStatus();

    useEffect(() => {
        let active = true;
        setDecodingState('loading');
        setErrorMsg("");

        if (containerRef.current) {
            containerRef.current.innerHTML = '';
        }

        const run = async () => {
            // 1. Try Native Support (Fastest, no network needed)
            const nativeImg = new Image();
            let nativeSupported = false;

            await new Promise<void>((resolve) => {
                nativeImg.onload = () => { nativeSupported = true; resolve(); };
                nativeImg.onerror = () => { nativeSupported = false; resolve(); };
                setTimeout(() => resolve(), 150);
                nativeImg.src = file.previewUrl;
            });

            if (nativeSupported && active) {
                setDecodingState('success');
                nativeImg.style.width = '100%';
                nativeImg.style.height = '100%';
                nativeImg.style.objectFit = 'contain';
                if (containerRef.current) containerRef.current.appendChild(nativeImg);
                return;
            }

            // 2. Load & Decode via WASM
            try {
                if (active) setStatusText(t("Loading Decoder Library..."));
                await loadJxlLibrary((msg) => { if (active) setStatusText(msg); });

                if (active) setStatusText(t("Processing Image..."));

                const img = new Image();
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.style.opacity = '0';
                img.style.transition = 'opacity 0.3s ease';
                img.src = file.previewUrl;
                // Important for WASM to read the blob data
                img.crossOrigin = "anonymous";

                if (containerRef.current) containerRef.current.appendChild(img);

                // Short delay to ensure DOM is ready for the wrapper to find the image
                await new Promise(r => setTimeout(r, 50));

                // Call Niutech Decoder Wrapper
                // This wrapper handles the WASM memory management internally
                await (window as any).Jxl.display(img);

                if (active) {
                    setDecodingState('success');
                    img.style.opacity = '1';
                }

            } catch (e: any) {
                console.error("JXL Process Error:", e);
                if (active) {
                    if (e.message.includes(t("All mirrors failed"))) {
                        setDecodingState('missing_deps');
                    } else {
                        setDecodingState('error');
                        setErrorMsg(e.message || t("Decoder failed."));
                    }
                }
            }
        };

        run();

        return () => { active = false; };
    }, [file, isOnline]);

    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-950 relative overflow-hidden min-h-[300px]">
            {decodingState === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-2" />
                        <p className="text-xs text-gray-400">{statusText}</p>
                    </div>
                </div>
            )}

            {decodingState === 'missing_deps' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 p-6 text-center">
                    <div className="w-12 h-12 mb-3 rounded-xl bg-orange-900/30 flex items-center justify-center border border-orange-500/30">
                        <HardDriveDownload className="w-6 h-6 text-orange-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-200 mb-2">{t("Decoder Files Missing")}</h3>
                    <p className="text-xs text-gray-400 mb-4 max-w-sm mx-auto leading-relaxed">
                        {t("The app needs two files to decode JXL images. Please download them and put them in your ")}<code className="bg-gray-800 px-1 text-white rounded">public</code> {t("folder. ")}</p>

                    <div className="flex gap-2 mb-4">
                        <a href="https://niutech.github.io/jxl.js/jxl.min.js" target="_blank" download className="px-3 py-2 bg-gray-800 border border-gray-700 hover:border-brand-500 rounded text-xs font-mono text-brand-400">
                            jxl.min.js
                        </a>
                        <a href="https://niutech.github.io/jxl.js/jxl.wasm" target="_blank" download className="px-3 py-2 bg-gray-800 border border-gray-700 hover:border-brand-500 rounded text-xs font-mono text-brand-400">
                            jxl.wasm
                        </a>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-3 h-3" /> {t("Retry ")}</button>
                </div>
            )}

            {decodingState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 p-4 text-center">
                    <div className="w-12 h-12 mb-2 rounded-xl bg-red-900/30 flex items-center justify-center border border-red-500/30">
                        <span className="text-xl font-bold text-red-500">ERR</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-200">{t("Decoder Error")}</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-[250px] mb-4">{errorMsg}</p>

                    <div className="flex gap-2">
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors"
                        >
                            <RefreshCw className="w-3 h-3" /> {t("Retry ")}</button>
                        <a
                            href={file.previewUrl}
                            download={file.file.name}
                            className="flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs transition-colors"
                        >
                            <Download className="w-3 h-3" /> {t("Download Raw ")}</a>
                    </div>
                </div>
            )}

            <div
                ref={containerRef}
                className="w-full h-full flex items-center justify-center"
            />
        </div>
    );
};


const App: React.FC = () => {
    const [currentImage, setCurrentImage] = useState<ImageFile | null>(null);
    const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
    const [processingMsg, setProcessingMsg] = useState<string>("");
    const [imageLoadError, setImageLoadError] = useState(false);
    const isOnline = useOnlineStatus();

    // Info Popup State
    const [showInfoPopup, setShowInfoPopup] = useState(false);
    const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleInfoEnter = () => {
        if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
        setShowInfoPopup(true);
    };
    const handleInfoLeave = () => {
        infoTimeoutRef.current = setTimeout(() => setShowInfoPopup(false), 300);
    };

    // Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editMode, setEditMode] = useState<'panorama' | 'hdr' | 'copyright' | null>(null);

    // Pano Settings
    const [panoHeading, setPanoHeading] = useState(0);
    const [panoPitch, setPanoPitch] = useState(0);
    const [panoRoll, setPanoRoll] = useState(0);
    const [resizeTo8k, setResizeTo8k] = useState(false);

    // Copyright Settings
    const [artist, setArtist] = useState("");
    const [copyright, setCopyright] = useState("");
    const [year, setYear] = useState(new Date().getFullYear().toString());

    useEffect(() => {
        if (currentImage) {
            setImageLoadError(false);
        }
    }, [currentImage]);

    const handleFileSelect = async (file: File) => {
        try {
            setStatus(AnalysisStatus.PROCESSING);
            setProcessingMsg(t("Parsing metadata..."));

            const metadata = await parseImageMetadata(file);

            let blobToPreview: Blob = file;
            if (metadata.mimeType === 'image/jxl' || file.name.toLowerCase().endsWith('.jxl')) {
                blobToPreview = new Blob([file], { type: 'image/jxl' });
            }

            const previewUrl = URL.createObjectURL(blobToPreview);

            setCurrentImage({
                file,
                previewUrl,
                metadata
            });
        } catch (error: any) {
            console.error("Error processing file:", error);
            const msg = error instanceof Error ? error.message : t("Unknown error");
            alert(t('Failed to process file: {message}',{message:msg}));
            setProcessingMsg(t('Error: {message}',{message:msg}));
            setStatus(AnalysisStatus.ERROR);
        } finally {
            setStatus(AnalysisStatus.IDLE);
            setProcessingMsg("");
        }
    };

    // Helper to update session with new blob
    const updateSessionImage = async (newBlob: Blob, filename: string) => {
        const newFile = new File([newBlob], filename, { type: newBlob.type });
        const newMetadata = await parseImageMetadata(newFile); // Re-parse to verify tags
        const newUrl = URL.createObjectURL(newBlob);

        setCurrentImage({
            file: newFile,
            previewUrl: newUrl,
            metadata: newMetadata
        });
    };

    const getPanoStatus = (meta: ParsedMetadata) => {
        const w = meta.width || 0;
        const isFacebookRisk = w > 8192; // 8K limit

        if (meta.isPanorama) {
            if (isFacebookRisk) {
                return { status: 'warning' as const, msg: t('Valid Tags, but width ({width}px) > 8K (Facebook Limit)',{width:w}) };
            }
            return { status: 'success' as const, msg: t("Valid 360 Metadata Found") };
        }

        const ratio = meta.width && meta.height ? meta.width / meta.height : 0;
        if (ratio >= 1.9 && ratio <= 2.1) {
            if (isFacebookRisk) {
                return { status: 'warning' as const, msg: t('Likely 360 (Too Big: {width}px), Metadata missing',{width:w}) };
            }
            return { status: 'warning' as const, msg: t("Aspect Ratio looks like 360, but Metadata missing") };
        }
        return { status: 'neutral' as const, msg: t("Not a panorama") };
    };

    const getHdrStatus = (meta: ParsedMetadata) => {
        if (meta.hasHdrFlags) {
            const nits = meta.hdrData?.maxNits;
            if (nits) {
                return { status: 'success' as const, msg: t('HDR Detected (Max: {nits} nits)',{nits:Math.round(nits)}) };
            }
            return { status: 'success' as const, msg: t("HDR Metadata Present") };
        }
        return { status: 'neutral' as const, msg: t("Standard Dynamic Range (SDR)") };
    };

    const handleFixPanorama = async () => {
        if (!currentImage) return;

        try {
            setStatus(AnalysisStatus.PROCESSING);

            if (resizeTo8k) {
                setProcessingMsg(t("Resizing to 8K & Injecting Tags..."));
            } else {
                setProcessingMsg(t("Injecting GPano Metadata..."));
            }

            let w = currentImage.metadata?.width;
            let h = currentImage.metadata?.height;

            if (!w && currentImage.metadata?.rawExif?.['ExifImageWidth']) {
                w = currentImage.metadata.rawExif['ExifImageWidth'];
            }
            if (!h && currentImage.metadata?.rawExif?.['ExifImageHeight']) {
                h = currentImage.metadata.rawExif['ExifImageHeight'];
            }

            const fixedBlob = await injectPanoramaMetadata(currentImage.file, {
                width: w,
                height: h,
                heading: panoHeading,
                pitch: panoPitch,
                roll: panoRoll,
                resizeToMax8k: resizeTo8k // Pass resizing option
            });

            let ext = currentImage.file.name.split('.').pop() || 'jpg';
            if (fixedBlob.type === 'image/jxl') ext = 'jxl';

            const nameWithoutExt = currentImage.file.name.substring(0, currentImage.file.name.lastIndexOf('.')) || currentImage.file.name;
            // Clean previous suffixes to avoid _fixed_fixed_fixed
            const cleanName = nameWithoutExt.replace(/_fixed_360(_8k)?/g, '').replace(/_copyright/g, '');
            const resizeSuffix = resizeTo8k ? '_8k' : '';
            const newFilename = `${cleanName}_fixed_360${resizeSuffix}.${ext}`;

            await updateSessionImage(fixedBlob, newFilename);

            setStatus(AnalysisStatus.COMPLETED);
        } catch (e: any) {
            console.error(e);
            alert(t('Error fixing image: {message}',{message:e.message}));
            setStatus(AnalysisStatus.ERROR);
        } finally {
            setStatus(AnalysisStatus.IDLE);
            setProcessingMsg("");
        }
    };

    const handleSaveCopyright = async () => {
        if (!currentImage) return;

        try {
            setStatus(AnalysisStatus.PROCESSING);
            setProcessingMsg(t("Injecting Copyright Metadata..."));

            const fixedBlob = await injectImageMetadata(currentImage.file, {
                artist,
                copyright,
                year
            });

            // Similar filename logic
            let ext = currentImage.file.name.split('.').pop() || 'jpg';
            if (fixedBlob.type === 'image/jxl') ext = 'jxl';

            const nameWithoutExt = currentImage.file.name.substring(0, currentImage.file.name.lastIndexOf('.')) || currentImage.file.name;
            const cleanName = nameWithoutExt.replace(/_fixed_360(_8k)?/g, '').replace(/_copyright/g, '');
            const newFilename = `${cleanName}_copyright.${ext}`;

            await updateSessionImage(fixedBlob, newFilename);

            setStatus(AnalysisStatus.COMPLETED);
        } catch (e: any) {
            console.error(e);
            alert(t('Error saving copyright: {message}',{message:e.message}));
            setStatus(AnalysisStatus.ERROR);
        } finally {
            setStatus(AnalysisStatus.IDLE);
            setProcessingMsg("");
        }
    };

    const openEditModal = (mode: 'panorama' | 'hdr' | 'copyright') => {
        setEditMode(mode);

        if (mode === 'panorama') {
            // Reset to defaults when opening pano
            setPanoHeading(0);
            setPanoPitch(0);
            setPanoRoll(0);
            setResizeTo8k(false);
        } else if (mode === 'copyright') {
            // Load existing values if available
            setArtist(currentImage?.metadata?.artist || "");
            setCopyright(currentImage?.metadata?.copyright || "");
            setYear(new Date().getFullYear().toString());
        }

        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditMode(null);
    };

    if (!currentImage) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative">
                {/* Connectivity Status (Top Right) */}
                <div className="absolute top-4 right-4 flex items-center space-x-2 bg-gray-900/80 px-3 py-1.5 rounded-full backdrop-blur-sm border border-gray-800">
                    {isOnline ? (
                        <>
                            <Wifi className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-green-500 font-medium">{t("Online")}</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-red-500 font-medium">{t("Offline")}</span>
                        </>
                    )}
                </div>

                <div className="max-w-md w-full text-center space-y-8 relative">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-brand-600/20 rounded-2xl flex items-center justify-center border border-brand-500/30">
                            <Scan className="w-10 h-10 text-brand-500" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Measure<span className="text-brand-500">Map</span></h1>
                        <div className="relative inline-block">
                            <p
                                className="text-xl text-gray-300 font-medium cursor-help"
                                onMouseEnter={handleInfoEnter}
                                onMouseLeave={handleInfoLeave}
                            >
                                {t("Fix Metadata for Panorama Tags & Copyright Info ")}<span className="inline-flex items-center justify-center w-5 h-5 ml-1.5 text-[10px] font-bold text-brand-400 border border-brand-500/40 rounded-full align-super leading-none relative -top-1">i</span>
                            </p>
                            {showInfoPopup && (
                                <div
                                    className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[340px] sm:w-[420px] bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-2xl z-50 text-left"
                                    onMouseEnter={handleInfoEnter}
                                    onMouseLeave={handleInfoLeave}
                                >
                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-800 border-l border-t border-gray-700 rotate-45" />
                                    <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                        <Info className="w-4 h-4 text-brand-500" />
                                        {t("About Meta")}<span className="text-brand-500">Lens</span>
                                    </h4>
                                    <p className="text-xs text-gray-300 leading-relaxed mb-2">
                                        <strong className="text-white">Measure<span className="text-brand-500">Map</span></strong> {t("is a free, browser-based metadata tool built for ")}<strong className="text-white">{t("drone pilots")}</strong>{t(", 360° photographers, and content creators. It reads, inspects, and injects XMP/EXIF metadata — entirely offline and private. ")}</p>
                                    <p className="text-xs text-gray-300 leading-relaxed mb-2">
                                        {t("Designed especially for the ")}<strong className="text-white">Insta360 Antigravity A1</strong> {t("360° drone and the ")}<strong className="text-white">DJI Avata 360</strong>{t(": their panoramic images often lack the GPano metadata tags required by ")}<strong className="text-white">Facebook (Meta)</strong> {t("to activate the interactive 360° viewer. It also works with ")}<strong className="text-white">{t("stitched 360° panoramas")}</strong> {t("from other DJI drones such as the Mavic, Air, or Mini series. Meta")}<span className="text-brand-500">Lens</span> {t("fixes missing tags in one click. ")}</p>
                                    <p className="text-xs text-gray-300 leading-relaxed mb-2">
                                        {t("It also handles ")}<strong className="text-white">{t("copyright injection")}</strong> {t("(artist, rights, year), ")}<strong className="text-white">{t("HDR metadata inspection")}</strong>{t(", automatic ")}<strong className="text-white">{t("8K downscaling")}</strong> {t("for Facebook's size limit, and supports JPEG, PNG, HEIC, WebP, and JPEG XL. ")}</p>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {t("No upload, no server, no account — your images and your privacy stay safe. ")}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <ImageUploader onFileSelect={handleFileSelect} />

                    <div className="flex gap-2 flex-wrap justify-center mt-6">
                        <a href="https://www.multikopterschule.de/Kontakt-Impressum/IMPRESSUM/" target="_blank" rel="noreferrer" className="px-3 py-1 text-xs text-gray-500 bg-gray-900 border border-gray-700 rounded-full hover:text-gray-300 hover:border-gray-500 transition-colors tracking-wide">{t("Impressum")}</a>
                        <a href="https://www.michael-radeck.de" target="_blank" rel="noreferrer" className="px-3 py-1 text-xs text-gray-500 bg-gray-900 border border-gray-700 rounded-full hover:text-gray-300 hover:border-gray-500 transition-colors tracking-wide">michael-radeck.de</a>
                    </div>
                </div>

                {status === AnalysisStatus.PROCESSING && (
                    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 text-brand-500 animate-spin mx-auto mb-4" />
                            <p className="text-xl font-semibold text-white">{t(processingMsg)}</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const panoStatus = currentImage.metadata ? getPanoStatus(currentImage.metadata) : { status: 'neutral' as const, msg: t("Unknown") };
    const hdrStatus = currentImage.metadata ? getHdrStatus(currentImage.metadata) : { status: 'neutral' as const, msg: t("Unknown") };
    const gpsPosition = currentImage.metadata?.rawExif?.['GPSPosition'];

    const isJxl = currentImage.metadata?.mimeType === 'image/jxl' || currentImage.file.name.toLowerCase().endsWith('.jxl');

    const width = currentImage.metadata?.width || 0;
    const isTooBig = width > 8192;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 pb-20 relative">
            <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Scan className="w-6 h-6 text-brand-500" />
                        <div>
                            <span className="font-bold text-lg block leading-tight">Measure<span className="text-brand-500">Map</span></span>
                            <span className="text-xs text-brand-400 hidden sm:block leading-tight relative">
                                <span
                                    className="cursor-help"
                                    onMouseEnter={handleInfoEnter}
                                    onMouseLeave={handleInfoLeave}
                                >
                                    {t("Fix Metadata for Panorama Tags & Copyright Info ")}<span className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 text-[8px] font-bold text-brand-400 border border-brand-500/40 rounded-full align-super leading-none relative -top-0.5">i</span>
                                </span>
                                {showInfoPopup && (
                                    <span
                                        className="absolute left-0 top-full mt-3 w-[340px] sm:w-[420px] bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-2xl z-50 text-left block"
                                        onMouseEnter={handleInfoEnter}
                                        onMouseLeave={handleInfoLeave}
                                    >
                                        <span className="absolute -top-2 left-8 w-4 h-4 bg-gray-800 border-l border-t border-gray-700 rotate-45" />
                                        <span className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                            <Info className="w-4 h-4 text-brand-500" />
                                            {t("About Meta")}<span className="text-brand-500">Lens</span>
                                        </span>
                                        <span className="block text-xs text-gray-300 leading-relaxed mb-2 mt-2">
                                            <strong className="text-white">Measure<span className="text-brand-500">Map</span></strong> {t("is a free, browser-based metadata tool built for ")}<strong className="text-white">{t("drone pilots")}</strong>{t(", 360° photographers, and content creators. It reads, inspects, and injects XMP/EXIF metadata — entirely offline and private. ")}</span>
                                        <span className="block text-xs text-gray-300 leading-relaxed mb-2">
                                            {t("Designed especially for the ")}<strong className="text-white">Insta360 Antigravity A1</strong> {t("360° drone and the ")}<strong className="text-white">DJI Avata 360</strong>{t(": their panoramic images often lack the GPano metadata tags required by ")}<strong className="text-white">Facebook (Meta)</strong> {t("to activate the interactive 360° viewer. It also works with ")}<strong className="text-white">{t("stitched 360° panoramas")}</strong> {t("from other DJI drones such as the Mavic, Air, or Mini series. Meta")}<span className="text-brand-500">Lens</span> {t("fixes missing tags in one click. ")}</span>
                                        <span className="block text-xs text-gray-300 leading-relaxed mb-2">
                                            {t("It also handles ")}<strong className="text-white">{t("copyright injection")}</strong> {t("(artist, rights, year), ")}<strong className="text-white">{t("HDR metadata inspection")}</strong>{t(", automatic ")}<strong className="text-white">{t("8K downscaling")}</strong> {t("for Facebook's size limit, and supports JPEG, PNG, HEIC, WebP, and JPEG XL. ")}</span>
                                        <span className="block text-xs text-gray-400 leading-relaxed">
                                            {t("No upload, no server, no account — your images and your privacy stay safe. ")}</span>
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="hidden md:flex items-center space-x-2" title={isOnline ? t("Server Connection Available") : t("No Internet Connection")}>
                            {isOnline ? <Wifi className="w-4 h-4 text-gray-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                        </div>
                        <button
                            onClick={() => setCurrentImage(null)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700 hover:border-gray-600"
                            title={t("Start new analysis")}
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span className="hidden sm:inline">{t("New Analysis")}</span>
                        </button>
                        <button
                            onClick={() => {
                                if (currentImage) {
                                    const a = document.createElement('a');
                                    a.href = currentImage.previewUrl;
                                    a.download = currentImage.file.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                }
                            }}
                            disabled={!currentImage}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                            title={t("Download current file")}
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden lg:inline">{t("Download")}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Loading Overlay */}
            {
                status === AnalysisStatus.PROCESSING && (
                    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 text-brand-500 animate-spin mx-auto mb-4" />
                            <p className="text-xl font-semibold text-white">{t(processingMsg)}</p>
                        </div>
                    </div>
                )
            }

            {/* Edit Modal */}
            {
                editModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl scale-100 my-auto">
                            <button
                                onClick={closeEditModal}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                                <Wand2 className="w-5 h-5 mr-2 text-brand-500" />
                                {t("Edit ")}{editMode === 'panorama' ? 'Panorama' : (editMode === 'copyright' ? t("Rights & Credits") : 'HDR')} {t("Metadata ")}</h3>

                            <div className="space-y-6">
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    {editMode === 'panorama'
                                        ? t("Configure standard Google Panorama (GPano) & PTGui tags below. Default angles (0, 0, 0) are standard for most equirectangular shots.")
                                        : (editMode === 'copyright'
                                            ? t("Add ownership and credit information. This will be written to both Exif (JPEG) and XMP/Dublin Core (JPEG & JXL) for maximum compatibility.")
                                            : t("HDR metadata editing is currently read-only."))}
                                </p>

                                {editMode === 'copyright' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("Artist / Creator")}</label>
                                            <input
                                                type="text"
                                                value={artist}
                                                onChange={(e) => setArtist(e.target.value)}
                                                placeholder={t("e.g. John Doe")}
                                                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all placeholder:text-gray-600"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-1 space-y-2">
                                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("Year")}</label>
                                                <input
                                                    type="number"
                                                    value={year}
                                                    onChange={(e) => setYear(e.target.value)}
                                                    placeholder="2024"
                                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="col-span-2 space-y-2">
                                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("Copyright Notice")}</label>
                                                <input
                                                    type="text"
                                                    value={copyright}
                                                    onChange={(e) => setCopyright(e.target.value)}
                                                    placeholder={t("e.g. All Rights Reserved")}
                                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all placeholder:text-gray-600"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-gray-950 rounded-lg p-4 border border-gray-800 mt-2">
                                            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{t("Preview")}</h4>
                                            <p className="text-sm text-gray-300 font-mono">
                                                © {year} {copyright || t("All Rights Reserved")}{artist ? ` • ${artist}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                ) : editMode === 'panorama' ? (
                                    <div className="space-y-5">

                                        {/* Resize Option (Conditional) */}
                                        {isTooBig && (
                                            <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-4">
                                                <div className="flex items-start gap-3 mb-2">
                                                    <ArrowDownToLine className="w-5 h-5 text-yellow-500 shrink-0" />
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-gray-200">{t("Image is too large for Facebook")}</h4>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {t("Your image is ")}{width}{t("px wide. Facebook recommends max 8192px (8K) width. ")}</p>
                                                    </div>
                                                </div>
                                                <label className="flex items-center space-x-3 mt-3 p-2 bg-gray-950/50 rounded cursor-pointer hover:bg-gray-950 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={resizeTo8k}
                                                        onChange={(e) => setResizeTo8k(e.target.checked)}
                                                        className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-gray-600 bg-gray-800"
                                                    />
                                                    <span className="text-sm font-medium text-white">{t("Downscale to 8K (High Quality)")}</span>
                                                </label>
                                            </div>
                                        )}

                                        <div className="bg-gray-950 rounded-lg p-4 border border-gray-800">
                                            <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center">
                                                <Move3d className="w-3 h-3 mr-1.5" />
                                                {t("Viewing Angles ")}</h4>

                                            <div className="space-y-4">
                                                {/* Heading */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-gray-300">{t("Initial Heading")}</span>
                                                        <span className="font-mono text-brand-400">{panoHeading}°</span>
                                                    </div>
                                                    <div className="flex gap-3 items-center">
                                                        <input
                                                            type="range" min="0" max="360"
                                                            value={panoHeading}
                                                            onChange={(e) => setPanoHeading(Number(e.target.value))}
                                                            className="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                                        />
                                                        <input
                                                            type="number" min="0" max="360"
                                                            value={panoHeading}
                                                            onChange={(e) => setPanoHeading(Number(e.target.value))}
                                                            className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-center focus:border-brand-500 outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Pitch */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-gray-300">{t("Initial Pitch")}</span>
                                                        <span className="font-mono text-brand-400">{panoPitch}°</span>
                                                    </div>
                                                    <div className="flex gap-3 items-center">
                                                        <input
                                                            type="range" min="-90" max="90"
                                                            value={panoPitch}
                                                            onChange={(e) => setPanoPitch(Number(e.target.value))}
                                                            className="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                                        />
                                                        <input
                                                            type="number" min="-90" max="90"
                                                            value={panoPitch}
                                                            onChange={(e) => setPanoPitch(Number(e.target.value))}
                                                            className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-center focus:border-brand-500 outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Roll */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-gray-300">{t("Initial Roll")}</span>
                                                        <span className="font-mono text-brand-400">{panoRoll}°</span>
                                                    </div>
                                                    <div className="flex gap-3 items-center">
                                                        <input
                                                            type="range" min="-180" max="180"
                                                            value={panoRoll}
                                                            onChange={(e) => setPanoRoll(Number(e.target.value))}
                                                            className="flex-1 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                                        />
                                                        <input
                                                            type="number" min="-180" max="180"
                                                            value={panoRoll}
                                                            onChange={(e) => setPanoRoll(Number(e.target.value))}
                                                            className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-center focus:border-brand-500 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-950 rounded-lg p-4 border border-gray-800">
                                            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{t("Tag Summary")}</h4>
                                            <ul className="text-xs text-gray-500 space-y-1 font-mono">
                                                <li>+ ProjectionType="equirectangular"</li>
                                                <li>+ FullPanoWidthPixels="{resizeTo8k ? '8192' : (currentImage.metadata?.width || 'AUTO')}"</li>
                                                <li>+ InitialViewHeadingDegrees="{panoHeading}"</li>
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-yellow-900/10 border border-yellow-700/20 rounded-lg flex items-start gap-3">
                                        <Info className="w-5 h-5 text-yellow-600 shrink-0" />
                                        <p className="text-sm text-yellow-500">
                                            {t("This feature is currently in read-only mode. ")}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={closeEditModal}
                                        className="flex-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
                                    >
                                        {t("Cancel ")}</button>
                                    {editMode === 'panorama' && (
                                        <button
                                            onClick={() => {
                                                handleFixPanorama();
                                                closeEditModal();
                                            }}
                                            className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Wand2 className="w-4 h-4" />
                                            {resizeTo8k ? t("Resize, Apply & Preview") : t("Apply to Session")}
                                        </button>
                                    )}
                                    {editMode === 'copyright' && (
                                        <button
                                            onClick={() => {
                                                handleSaveCopyright();
                                                closeEditModal();
                                            }}
                                            className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Wand2 className="w-4 h-4" />
                                            {t("Apply to Session ")}</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Col: Preview & Quick Actions */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 shadow-xl relative group min-h-[200px] flex items-center justify-center bg-gray-950">

                        {isJxl ? (
                            <JxlPreview file={currentImage} />
                        ) : !imageLoadError ? (
                            <img
                                src={currentImage.previewUrl}
                                alt={t("Preview")}
                                className="w-full h-auto object-contain"
                                onError={() => setImageLoadError(true)}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
                                <ImageOff className="w-12 h-12 mb-2 opacity-50" />
                                <p className="text-sm font-medium">{t("Preview Unavailable")}</p>
                                <p className="text-xs mt-1">{t("Browser cannot display this format (")}{currentImage.metadata?.mimeType || 'unknown'})</p>
                            </div>
                        )}

                        {!imageLoadError && !isJxl && (
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <a href={currentImage.previewUrl} target="_blank" rel="noreferrer" className="bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-sm">
                                    <Maximize2 className="w-6 h-6 text-white" />
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
                        <h3 className="font-semibold text-gray-300 flex items-center">
                            <Camera className="w-4 h-4 mr-2" /> {t("File Info ")}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t("Dimensions")}</span>
                                <span className="text-gray-300">{currentImage.metadata?.width ? `${currentImage.metadata.width} x ${currentImage.metadata.height}` : t("Unknown")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t("Size")}</span>
                                <span className="text-gray-300">{(currentImage.metadata!.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t("Type")}</span>
                                <span className="text-gray-300">{currentImage.metadata?.mimeType}</span>
                            </div>
                        </div>

                        {gpsPosition && (
                            <div className="pt-3 border-t border-gray-800">
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${gpsPosition}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full flex items-center justify-center px-4 py-2 bg-gray-800 hover:bg-gray-750 text-brand-400 text-sm font-medium rounded-lg transition-colors group"
                                >
                                    <MapPin className="w-4 h-4 mr-2 group-hover:text-brand-300" />
                                    {t("View on Google Maps ")}</a>
                                {(() => {
                                    const cameraName = detectCamera(currentImage.metadata?.rawExif);
                                    return cameraName ? (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">{t("Camera")}</span>
                                            <span className="text-gray-300">{cameraName}</span>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        )}
                    </div>
                </div>


                {/* Right Col: Analysis */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Status Cards */}
                    {/* Status Cards - 2 Column Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left Column: Rights & Panorama */}
                        <div className="space-y-4">
                            <StatusCard
                                label={t("Rights & Credits")}
                                value={currentImage.metadata?.artist ? currentImage.metadata.artist : (currentImage.metadata?.copyright ? t("Copyrighted") : t("No Info"))}
                                status={currentImage.metadata?.artist || currentImage.metadata?.copyright ? 'success' : 'neutral'}
                                details={currentImage.metadata?.copyright || t("Add artist & copyright info")}
                                onEdit={() => openEditModal('copyright')}
                                editLabel={t("Edit Rights")}
                            />
                            <StatusCard
                                label={t("360° Panorama")}
                                value={panoStatus.status === 'success' ? t("Detected") : (panoStatus.status === 'warning' ? t("Likely (Missing Flags)") : t("Not Detected"))}
                                status={panoStatus.status}
                                details={panoStatus.msg}
                                onEdit={() => openEditModal('panorama')}
                                editLabel={t("Edit Tags")}
                            />
                        </div>

                        {/* Right Column: HDR & Color Space */}
                        <div className="space-y-4">
                            <StatusCard
                                label={t("HDR Status")}
                                value={hdrStatus.status === 'success' ? 'HDR' : 'SDR'}
                                status={hdrStatus.status}
                                details={hdrStatus.msg}
                                onEdit={() => openEditModal('hdr')}
                                editLabel={t("Edit HDR")}
                            />
                            <StatusCard
                                label={t("Color Space")} // SDR Info stays here
                                value={currentImage.metadata?.colorSpace || t("Unknown")}
                                status={currentImage.metadata?.colorSpace && currentImage.metadata.colorSpace.includes('Overrides') ? 'warning' : (currentImage.metadata?.colorSpace === 'sRGB' ? 'success' : 'neutral')}
                                details={currentImage.metadata?.colorSpace && currentImage.metadata.colorSpace.includes('Overrides') ? t("XMP HDR data detected") : t("Detected from Exif/ICC")}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-brand-900/10 border border-brand-900/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-gray-400">
                                    <p className="font-semibold text-gray-200 mb-1">{t("How to Fix 360° Images")}</p>
                                    <p>
                                        {t("If your panorama is not being detected by Facebook or Google Photos, click the ")}<strong className="text-white"> {t("Edit Tags ")}</strong>
                                        {t("button above. To save any changes (Tags or Copyright), you must click ")}<strong className="text-white"> {t("Download ")}</strong> {t("to get the fixed file. ")}</p>
                                </div>
                            </div>
                        </div>

                        <MetadataViewer metadata={currentImage.metadata} />

                        <div className="flex gap-2 flex-wrap justify-center pt-6">
                            <a href="https://www.multikopterschule.de/Kontakt-Impressum/IMPRESSUM/" target="_blank" rel="noreferrer" className="px-3 py-1 text-xs text-gray-500 bg-gray-900 border border-gray-700 rounded-full hover:text-gray-300 hover:border-gray-500 transition-colors tracking-wide">{t("Impressum")}</a>
                            <a href="https://www.michael-radeck.de" target="_blank" rel="noreferrer" className="px-3 py-1 text-xs text-gray-500 bg-gray-900 border border-gray-700 rounded-full hover:text-gray-300 hover:border-gray-500 transition-colors tracking-wide">michael-radeck.de</a>
                        </div>
                    </div>

                </div>
            </main>
        </div >
    );
};

export default App;