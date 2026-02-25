import React, { useState, useRef } from 'react';
import { Upload, FileAudio, FileVideo, X } from 'lucide-react';
import { cn } from '../utils';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileSelect, 
  selectedFile, 
  onClear,
  disabled 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const triggerFileInput = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  if (selectedFile) {
    const isVideo = selectedFile.type.startsWith('video/');
    return (
      <div className="relative p-6 border-2 border-zinc-200 rounded-2xl bg-white shadow-sm flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          isVideo ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
        )}>
          {isVideo ? <FileVideo size={24} /> : <FileAudio size={24} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 truncate">{selectedFile.name}</p>
          <p className="text-xs text-zinc-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
        </div>
        <button
          onClick={onClear}
          disabled={disabled}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      className={cn(
        "relative p-12 border-2 border-dashed rounded-3xl transition-all cursor-pointer flex flex-col items-center justify-center gap-4",
        isDragging 
          ? "border-indigo-500 bg-indigo-50/50" 
          : "border-zinc-200 hover:border-zinc-300 bg-zinc-50/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,video/*"
        className="hidden"
        disabled={disabled}
      />
      <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-zinc-100 flex items-center justify-center text-zinc-400">
        <Upload size={32} />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-zinc-900">Click or drag to upload</p>
        <p className="text-sm text-zinc-500 mt-1">Audio or Video files (MP3, WAV, MP4, etc.)</p>
      </div>
    </div>
  );
};
