export interface ParsedMetadata {
  isPanorama: boolean;
  projectionType?: string;
  usePanoramaViewer?: boolean;
  colorSpace: string;
  width?: number;
  height?: number;
  mimeType: string;
  fileSize: number;
  rawXmp?: string;
  rawExif?: Record<string, any>;
  hasHdrFlags: boolean;
  bitDepth?: number;
  hdrData?: {
    maxNits?: number;
    avgNits?: number;
    minNits?: number;
    primaries?: string;
  };
  // Copyright / Credits
  artist?: string;
  copyright?: string;
  software?: string;
}

export interface CopyrightOptions {
  artist?: string;
  copyright?: string;
  year?: string;
}

export interface PanoOptions {
  width?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  resizeToMax8k?: boolean;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ImageFile {
  file: File;
  previewUrl: string;
  metadata: ParsedMetadata | null;
}
