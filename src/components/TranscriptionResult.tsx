import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, FileText, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

interface TranscriptionResultProps {
  text: string;
  language?: 'en' | 'ar';
}

export const TranscriptionResult: React.FC<TranscriptionResultProps> = ({ text, language = 'en' }) => {
  const [copied, setCopied] = useState(false);
  const isRtl = language === 'ar';

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "transcription.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 border-bottom border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-600">
          <FileText size={18} />
          <span className="text-sm font-medium uppercase tracking-wider">Transcription</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-zinc-200 transition-all text-zinc-600 flex items-center gap-2 text-sm"
            title="Download as .txt"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-zinc-200 transition-all text-zinc-600 flex items-center gap-2 text-sm"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Check size={16} className="text-emerald-500" />
                  <span className="text-emerald-600 font-medium">Copied!</span>
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Copy size={16} />
                  <span className="hidden sm:inline">Copy Text</span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
      <div className="p-8 prose prose-zinc max-w-none">
        <div className={cn("markdown-body", isRtl && "font-arabic")} dir={isRtl ? 'rtl' : 'ltr'}>
          <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </div>
      </div>
    </motion.div>
  );
};
