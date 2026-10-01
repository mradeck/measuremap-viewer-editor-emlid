import {translate as t} from '../ui/translations';
import React, { useRef } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onFileSelect: (file: File) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      className="w-full h-48 sm:h-64 border-2 border-dashed border-gray-600 rounded-xl bg-gray-850 hover:bg-gray-800 transition-colors flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChange}
        className="hidden"
        accept="image/jpeg,image/png,image/heic,image/webp,image/jxl,.jpg,.jpeg,.png,.heic,.webp,.jxl"
      />

      <div className="z-10 flex flex-col items-center text-center p-4">
        <div className="bg-gray-700 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
           <Upload className="w-8 h-8 text-brand-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-200">{t("Tap to Upload Image")}</h3>
        <p className="text-sm text-gray-400 mt-2">{t("or drag and drop here")}</p>
        <p className="text-xs text-gray-500 mt-1">{t("Supports JPEG, PNG, JXL, WEBP, HEIC")}</p>
      </div>

      {/* Decorative background element */}
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

export default ImageUploader;