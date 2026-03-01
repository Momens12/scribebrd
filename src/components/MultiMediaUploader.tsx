import React, { useRef, useState } from 'react';
import { Upload, FileAudio, FileVideo, X, Plus } from 'lucide-react';
import { cn } from '../utils';

interface MultiMediaUploaderProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
}

export const MultiMediaUploader: React.FC<MultiMediaUploaderProps> = ({ 
  onFilesSelect, 
  selectedFiles, 
  onRemoveFile,
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
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('audio/') || file.type.startsWith('video/')
    );
    if (files.length > 0) {
      onFilesSelect(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelect(files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
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
          multiple
          className="hidden"
          disabled={disabled}
        />
        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-zinc-100 flex items-center justify-center text-zinc-400">
          <Upload size={32} />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-zinc-900">Click or drag to upload multiple records</p>
          <p className="text-sm text-zinc-500 mt-1">Audio or Video files (MP3, WAV, MP4, etc.)</p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {selectedFiles.map((file, index) => {
            const isVideo = file.type.startsWith('video/');
            return (
              <div key={index} className="relative p-4 border border-zinc-200 rounded-2xl bg-white shadow-sm flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isVideo ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  {isVideo ? <FileVideo size={20} /> : <FileAudio size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{file.name}</p>
                  <p className="text-xs text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(index);
                  }}
                  disabled={disabled}
                  className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors text-zinc-400 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
