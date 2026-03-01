import React, { useState } from 'react';
import { Mic, Video, Sparkles, Loader2, AlertCircle, History, ArrowRight, FileText, StickyNote, ChevronLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MultiMediaUploader } from './components/MultiMediaUploader';
import { MultiFileUploader } from './components/MultiFileUploader';
import { TranscriptionResult } from './components/TranscriptionResult';
import { BRDEditor } from './components/BRDEditor';
import { BRDChat } from './components/BRDChat';
import { transcribeMedia, generateBRD, refineBRD } from './services/gemini';
import { cn } from './utils';
import { Upload, MessageSquare, CheckCircle2, Wand2, Send } from 'lucide-react';

// Declare mammoth for TypeScript
declare global {
  interface Window {
    mammoth: any;
  }
}

interface BRDHistory {
  id: string;
  title: string;
  content: string;
  transcription: string;
  extra_notes: string;
  final_doc_path: string | null;
  language: 'en' | 'ar';
  created_at: string;
}

type AppStep = 'transcribe' | 'brd-setup' | 'brd-result';

export default function App() {
  const [step, setStep] = useState<AppStep>('transcribe');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BRDHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ar'>('en');

  // BRD specific state
  const [currentBrdId, setCurrentBrdId] = useState<string | null>(null);
  const [extraNotes, setExtraNotes] = useState('');
  const [sampleFiles, setSampleFiles] = useState<File[]>([]);
  const [brdResult, setBrdResult] = useState<string | null>(null);
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [isUploadingFinal, setIsUploadingFinal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [aiCommand, setAiCommand] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  React.useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/brds');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleTranscribe = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setTranscription(null);

    try {
      const transcriptions = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          const result = await transcribeMedia(base64, file.type, language);
          return `### Transcription for: ${file.name}\n\n${result}`;
        })
      );
      
      setTranscription(transcriptions.join('\n\n---\n\n'));
    } catch (err) {
      console.error(err);
      setError('Failed to transcribe media. Please try again with smaller files or different formats.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateBRD = async () => {
    if (!transcription) return;

    setIsProcessing(true);
    setError(null);

    try {
      const processedSamples = await Promise.all(
        sampleFiles.map(async (f) => {
          if (f.type === 'application/pdf') {
            return {
              data: await fileToBase64(f),
              mimeType: f.type,
              name: f.name
            };
          } else if (f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const arrayBuffer = await f.arrayBuffer();
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            return {
              text: result.value,
              mimeType: f.type,
              name: f.name
            };
          } else if (f.type === 'text/plain' || f.name.endsWith('.txt')) {
            const text = await f.text();
            return {
              text: text,
              mimeType: f.type || 'text/plain',
              name: f.name
            };
          } else {
            // Fallback for other text-like files
            try {
              const text = await f.text();
              return {
                text: text,
                mimeType: f.type || 'text/plain',
                name: f.name
              };
            } catch {
              return null;
            }
          }
        })
      );

      const validSamples = processedSamples.filter(s => s !== null) as any[];

      const result = await generateBRD(transcription, extraNotes, validSamples, language);
      setBrdResult(result);
      
      // Save to DB
      const saveRes = await fetch('/api/brds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        title: files[0]?.name.replace(/\.[^/.]+$/, "") || "Untitled BRD",
        content: result,
        transcription: transcription,
        extraNotes: extraNotes,
        language: language
      })
      });
      const { id } = await saveRes.json();
      setCurrentBrdId(id);
      fetchHistory();
      
      setStep('brd-result');
    } catch (err) {
      console.error(err);
      setError('Failed to generate BRD. Please check your inputs and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalUpload = async () => {
    if (!finalFile || !currentBrdId) return;
    setIsUploadingFinal(true);
    const formData = new FormData();
    formData.append('file', finalFile);
    try {
      await fetch(`/api/brds/${currentBrdId}/final`, {
        method: 'POST',
        body: formData
      });
      fetchHistory();
      setFinalFile(null);
    } catch (err) {
      console.error('Failed to upload final doc:', err);
    } finally {
      setIsUploadingFinal(false);
    }
  };

  const handleRefineBRD = async () => {
    if (!aiCommand.trim() || !brdResult || isRefining) return;

    setIsRefining(true);
    setError(null);

    try {
      const result = await refineBRD(brdResult, aiCommand, language);
      setBrdResult(result);
      setAiCommand('');
      
      // Update DB
      if (currentBrdId) {
        await fetch(`/api/brds/${currentBrdId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: result })
        });
      }
    } catch (err) {
      console.error(err);
      setError('Failed to refine BRD. Please try again.');
    } finally {
      setIsRefining(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setTranscription(null);
    setError(null);
    setStep('transcribe');
    setExtraNotes('');
    setSampleFiles([]);
    setBrdResult(null);
    setCurrentBrdId(null);
    setShowChat(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
            <img 
              src="http://www.experts.ps/wp-content/uploads/2014/05/logo1.png" 
              alt="Experts Logo" 
              className="h-8 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-zinc-100 p-1 rounded-lg flex items-center gap-1">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  language === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('ar')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  language === 'ar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                AR
              </button>
            </div>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-zinc-100 transition-colors text-zinc-600 text-sm font-medium"
            >
              <History size={18} />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto space-y-12">
          
          <AnimatePresence mode="wait">
            {step === 'transcribe' && (
              <motion.div
                key="transcribe-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-12"
              >
                {/* Hero Section */}
                <div className="text-center space-y-4">
                  <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900">
                    {language === 'ar' ? 'حول أي شيء إلى نص.' : 'Transcribe anything.'}
                  </h1>
                  <p className="text-lg text-zinc-500 max-w-lg mx-auto leading-relaxed">
                    {language === 'ar' 
                      ? 'قم بتحميل ملفات الصوت أو الفيديو واحصل على نسخ دقيقة مدعومة بالذكاء الاصطناعي في ثوانٍ.' 
                      : 'Upload audio or video files and get accurate, AI-powered transcriptions in seconds.'}
                  </p>
                </div>

                {/* Upload Section */}
                <div className="space-y-6">
                  <MultiMediaUploader 
                    onFilesSelect={(newFiles) => setFiles(prev => [...prev, ...newFiles])} 
                    selectedFiles={files} 
                    onRemoveFile={(index) => setFiles(prev => prev.filter((_, i) => i !== index))}
                    disabled={isProcessing}
                  />

                  {files.length > 0 && !transcription && !isProcessing && (
                    <div className="flex justify-center">
                      <button
                        onClick={handleTranscribe}
                        className="group relative px-8 py-4 bg-indigo-600 text-white rounded-2xl font-semibold shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3"
                      >
                        <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                        {language === 'ar' ? 'بدء النسخ لجميع الملفات' : 'Start Transcription for all files'}
                      </button>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 size={48} className="text-indigo-600 animate-spin" />
                      <p className="text-lg font-medium text-zinc-900">Analyzing your media...</p>
                    </div>
                  )}

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700">
                      <AlertCircle className="shrink-0 mt-0.5" size={20} />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  {transcription && (
                    <div className="space-y-8">
                      <TranscriptionResult text={transcription} language={language} />
                      
                      <div className="flex flex-col items-center gap-4 pt-8 border-t border-zinc-200">
                        <div className="text-center">
                          <h3 className="text-xl font-bold text-zinc-900">Need a BRD?</h3>
                          <p className="text-zinc-500 text-sm mt-1">Generate a Business Requirements Document from this transcription.</p>
                        </div>
                        <button
                          onClick={() => setStep('brd-setup')}
                          className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-lg"
                        >
                          Next: Generate BRD
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!transcription && !isProcessing && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 border-t border-zinc-200">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <Mic size={20} />
                      </div>
                      <h3 className="font-bold text-zinc-900">Audio Support</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">Transcribe podcasts, interviews, and voice notes with high accuracy.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Video size={20} />
                      </div>
                      <h3 className="font-bold text-zinc-900">Video Support</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">Extract text from lectures, meetings, and presentations effortlessly.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Sparkles size={20} />
                      </div>
                      <h3 className="font-bold text-zinc-900">AI Powered</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">Powered by Gemini 3 Flash for fast and intelligent processing.</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'brd-setup' && (
              <motion.div
                key="brd-setup-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setStep('transcribe')}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">BRD Configuration</h2>
                    <p className="text-zinc-500 text-sm">Add context and samples to guide the AI.</p>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-8">
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                      <StickyNote size={18} className="text-amber-500" />
                      Additional Notes
                    </label>
                    <textarea
                      value={extraNotes}
                      onChange={(e) => setExtraNotes(e.target.value)}
                      placeholder="Add any specific requirements, context, or details not mentioned in the transcription..."
                      className="w-full h-32 p-4 rounded-2xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none text-sm"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                      <FileText size={18} className="text-indigo-500" />
                      Sample BRD Documents
                    </label>
                    <p className="text-xs text-zinc-400">The system will match the structure and style of these samples.</p>
                    <MultiFileUploader
                      selectedFiles={sampleFiles}
                      onFilesSelect={(files) => setSampleFiles(prev => [...prev, ...files])}
                      onRemoveFile={(index) => setSampleFiles(prev => prev.filter((_, i) => i !== index))}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleGenerateBRD}
                      disabled={isProcessing}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Generating BRD...
                        </>
                      ) : (
                        <>
                          <Sparkles size={20} />
                          Generate BRD
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'brd-result' && (
              <motion.div
                key="brd-result-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setStep('brd-setup')}
                      className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold text-zinc-900">Generated BRD</h2>
                      <p className="text-zinc-500 text-sm">Based on your transcription, notes, and samples.</p>
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Start New
                  </button>
                </div>

                {brdResult && (
                  <div className="space-y-12">
                    {/* AI Commands Section */}
                    <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-zinc-900">
                        <Wand2 size={20} className="text-indigo-600" />
                        <h3 className="font-bold">{language === 'ar' ? 'أوامر الذكاء الاصطناعي' : 'AI Commands'}</h3>
                      </div>
                      <p className="text-sm text-zinc-500">
                        {language === 'ar' 
                          ? 'اطلب من الذكاء الاصطناعي تعديل الوثيقة (مثال: "أضف قسمًا للمخاطر" أو "اجعل النبرة أكثر رسمية")' 
                          : 'Ask AI to modify the document (e.g., "Add a risks section" or "Make the tone more formal")'}
                      </p>
                      <div className="relative">
                        <input
                          type="text"
                          value={aiCommand}
                          onChange={(e) => setAiCommand(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRefineBRD()}
                          dir={language === 'ar' ? 'rtl' : 'ltr'}
                          placeholder={language === 'ar' ? 'أدخل أمرك هنا...' : 'Enter your command here...'}
                          className={cn(
                            "w-full py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all",
                            language === 'ar' ? "pl-12 pr-4 font-arabic" : "pl-4 pr-12"
                          )}
                        />
                        <button
                          onClick={handleRefineBRD}
                          disabled={!aiCommand.trim() || isRefining}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50",
                            language === 'ar' ? "left-2" : "right-2"
                          )}
                        >
                          {isRefining ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={language === 'ar' ? "rotate-180" : ""} />}
                        </button>
                      </div>
                    </div>

                    <BRDEditor 
                      initialText={brdResult} 
                      language={language}
                      onSave={(newText) => setBrdResult(newText)} 
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Final Upload Section */}
                      <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Upload size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-zinc-900">Final Document</h3>
                            <p className="text-xs text-zinc-500">Upload the approved version</p>
                          </div>
                        </div>

                        {history.find(h => h.id === currentBrdId)?.final_doc_path ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700">
                              <CheckCircle2 size={20} />
                              <span className="text-sm font-medium">Final document uploaded</span>
                            </div>
                            <a 
                              href={`/${history.find(h => h.id === currentBrdId)?.final_doc_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                            >
                              <FileText size={16} />
                              View Uploaded Document
                            </a>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <input
                              type="file"
                              onChange={(e) => setFinalFile(e.target.files?.[0] || null)}
                              className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                            {finalFile && (
                              <button
                                onClick={handleFinalUpload}
                                disabled={isUploadingFinal}
                                className="w-full py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                              >
                                {isUploadingFinal ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                Upload Final Version
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Chat Toggle Section */}
                      <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <MessageSquare size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-zinc-900">BRD Chat</h3>
                            <p className="text-xs text-zinc-500">Discuss this document with AI</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowChat(!showChat)}
                          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare size={18} />
                          {showChat ? 'Hide Chat' : 'Open Chat Assistant'}
                        </button>
                      </div>
                    </div>

                    {showChat && currentBrdId && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <BRDChat brdId={currentBrdId} brdContent={brdResult} language={language} />
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl border-l border-zinc-200 flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History size={20} className="text-zinc-400" />
                  Recent Activity
                </h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History size={48} className="mx-auto text-zinc-200 mb-4" />
                    <p className="text-zinc-500">No transcriptions yet</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setBrdResult(item.content);
                        setTranscription(item.transcription);
                        setCurrentBrdId(item.id);
                        setLanguage(item.language);
                        setStep('brd-result');
                        setShowHistory(false);
                        setShowChat(false);
                      }}
                      className="w-full text-left p-4 rounded-2xl border border-zinc-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-zinc-900 truncate group-hover:text-indigo-600 transition-colors">
                          {item.title}
                        </p>
                        {item.final_doc_path && (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-zinc-400">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 uppercase">
                          {item.language}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-zinc-200 mt-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <p>© {new Date().getFullYear()} Experts. Powered by Gemini AI.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-zinc-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-600 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
