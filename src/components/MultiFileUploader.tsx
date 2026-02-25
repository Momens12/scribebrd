import React, { useRef } from 'react';
import { Upload, FileText, X, Paperclip } from 'lucide-react';
import { cn } from '../utils';

interface MultiFileUploaderProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
}

export const MultiFileUploader: React.FC<MultiFileUploaderProps> = ({ 
  onFilesSelect, 
  selectedFiles, 
  onRemoveFile,
  disabled 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelect(files);
    }
    // Reset input so same file can be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-2",
          "border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/30 bg-zinc-50/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          disabled={disabled}
        />
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-zinc-100 flex items-center justify-center text-indigo-600">
          <Paperclip size={20} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-900">Attach sample BRD documents</p>
          <p className="text-xs text-zinc-500 mt-1">PDF, DOCX, or TXT samples</p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white border border-zinc-100 rounded-xl shadow-sm">
              <div className="w-8 h-8 bg-zinc-50 text-zinc-500 rounded-lg flex items-center justify-center">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-900 truncate">{file.name}</p>
                <p className="text-[10px] text-zinc-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={() => onRemoveFile(index)}
                disabled={disabled}
                className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-zinc-400 disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
