import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Download, Edit3, Eye, FileDown, Save, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

interface BRDEditorProps {
  initialText: string;
  language?: 'en' | 'ar';
  onSave?: (text: string) => void;
}

export const BRDEditor: React.FC<BRDEditorProps> = ({ initialText, language = 'en', onSave }) => {
  const [text, setText] = useState(initialText);
  const isRtl = language === 'ar';
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = "Business_Requirements_Document.md";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    onSave?.(text);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm sticky top-20 z-40">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
          <button
            onClick={() => setIsEditing(false)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              !isEditing ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <Eye size={16} />
            Preview
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              isEditing ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <Edit3 size={16} />
            Edit
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          {isEditing ? (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
            >
              <Save size={16} />
              Save Changes
            </button>
          ) : (
            <>
              <button
                onClick={handlePrint}
                className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-500 transition-colors"
                title="Print Document"
              >
                <Printer size={18} />
              </button>
              <button
                onClick={handleCopy}
                className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-500 transition-colors"
                title="Copy Markdown"
              >
                {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 hover:bg-zinc-100 rounded-xl text-zinc-600 text-sm font-medium transition-all flex items-center gap-2"
              >
                <FileDown size={18} />
                Export .md
              </button>
            </>
          )}
        </div>
      </div>

      {/* Document Container */}
      <div className="relative min-h-[800px] bg-zinc-200/50 p-4 sm:p-8 rounded-[2rem] border border-zinc-300/50 shadow-inner">
        <motion.div
          layout
          className={cn(
            "mx-auto bg-white shadow-2xl transition-all duration-300 min-h-[1056px]", // A4-ish ratio
            isEditing ? "max-w-4xl" : "max-w-[850px]"
          )}
        >
          <div className="p-12 sm:p-20">
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className={cn(
                      "w-full h-[800px] p-0 border-none focus:ring-0 resize-none font-mono text-sm leading-relaxed text-zinc-800 outline-none",
                      isRtl && "font-arabic"
                    )}
                    placeholder={isRtl ? "اكتب وثيقة متطلبات العمل هنا باستخدام markdown..." : "Write your BRD here using markdown..."}
                    spellCheck={false}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className={cn("brd-document", isRtl && "font-arabic")}
                >
                  <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
