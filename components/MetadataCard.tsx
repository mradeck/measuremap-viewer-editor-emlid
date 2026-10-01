import {translate as t} from '../ui/translations';
import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, Pencil, FileCode, Camera, FileJson, Copy, Sun } from 'lucide-react';
import { ParsedMetadata } from '../types';

// --- Status Card Component ---

interface StatusCardProps {
  label: string;
  value: string | boolean;
  status: 'success' | 'warning' | 'error' | 'neutral';
  details?: string;
  onEdit?: () => void;
  editLabel?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({ label, value, status, details, onEdit, editLabel = t("Edit") }) => {
  const getIcon = () => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
     switch (status) {
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'error': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-gray-700/30 border-gray-600/30';
    }
  };

  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : t("No")) : value;

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()} flex flex-col justify-between relative group transition-all hover:bg-opacity-50`}>
      <div className="flex items-start space-x-3">
          <div className="mt-0.5">{getIcon()}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-sm font-bold text-gray-100 mt-0.5 truncate">{displayValue}</p>
            {details && <p className="text-xs text-gray-500 mt-1">{details}</p>}
          </div>
      </div>

      {onEdit && (
        <div className="mt-4 pt-3 border-t border-gray-700/50 w-full flex justify-end">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
            >
                <Pencil className="w-3 h-3" />
                <span>{editLabel}</span>
            </button>
        </div>
      )}
    </div>
  );
};

// --- Metadata Viewer Component (Tabbed) ---

interface MetadataViewerProps {
  metadata: ParsedMetadata | null;
  className?: string;
}

export const MetadataViewer: React.FC<MetadataViewerProps> = ({ metadata, className = "" }) => {
  const [activeTab, setActiveTab] = useState<'xmp' | 'exif' | 'hdr'>('xmp');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  if (!metadata) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(t("Copied!"));
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  // Content Selection
  let content = "";
  if (activeTab === 'xmp') content = metadata.rawXmp || "";
  if (activeTab === 'exif') content = metadata.rawExif ? JSON.stringify(metadata.rawExif, null, 2) : "";
  if (activeTab === 'hdr') content = metadata.hdrData ? JSON.stringify(metadata.hdrData, null, 2) : "";

  const hasContent = content && content.length > 0 && content !== '{}';

  // Only show HDR tab if we actually found something
  const hasHdrData = metadata.hdrData && Object.keys(metadata.hdrData).length > 0;

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col ${className}`}>
      {/* Tabs Header */}
      <div className="flex border-b border-gray-800 bg-gray-900/50 overflow-x-auto">
        <button
          onClick={() => setActiveTab('xmp')}
          className={`flex items-center px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'xmp'
              ? 'border-brand-500 text-brand-400 bg-gray-800/50'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
          }`}
        >
          <FileCode className="w-4 h-4 mr-2" />
          {t("Raw XMP ")}</button>
        <button
          onClick={() => setActiveTab('exif')}
          className={`flex items-center px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'exif'
              ? 'border-brand-500 text-brand-400 bg-gray-800/50'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
          }`}
        >
          <Camera className="w-4 h-4 mr-2" />
          {t("Raw EXIF ")}</button>
        {hasHdrData && (
            <button
            onClick={() => setActiveTab('hdr')}
            className={`flex items-center px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'hdr'
                ? 'border-brand-500 text-brand-400 bg-gray-800/50'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
            }`}
            >
            <Sun className="w-4 h-4 mr-2" />
            {t("HDR Data ")}</button>
        )}
      </div>

      {/* Toolbar / Info */}
      <div className="bg-gray-950 px-4 py-2 flex justify-between items-center border-b border-gray-800">
         <span className="text-xs text-gray-500 font-mono">
           {activeTab === 'xmp' ? 'application/rdf+xml' : 'application/json'}
         </span>
         {hasContent && (
             <button
               onClick={() => handleCopy(content || '')}
               className="text-xs flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
             >
                {copyFeedback ? <span className="text-green-400">{t(copyFeedback)}</span> : (
                    <>
                        <Copy className="w-3 h-3" /> {t("Copy ")}</>
                )}
             </button>
         )}
      </div>

      {/* Content Area */}
      <div className="relative bg-gray-950 min-h-[300px] max-h-[500px] overflow-y-auto p-4 custom-scrollbar">
        {hasContent ? (
           <pre className={`text-xs font-mono whitespace-pre-wrap break-all leading-relaxed ${
               activeTab === 'xmp' ? 'text-green-400' : (activeTab === 'hdr' ? 'text-orange-300' : 'text-blue-400')
           }`}>
             {content}
           </pre>
        ) : (
           <div className="flex flex-col items-center justify-center h-full py-12 text-gray-600">
               <FileJson className="w-12 h-12 mb-3 opacity-20" />
               <p className="text-sm">{t("No ")}{activeTab.toUpperCase()} {t("data found in this file.")}</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default StatusCard;