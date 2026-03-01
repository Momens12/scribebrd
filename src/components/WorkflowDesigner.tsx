import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Share2, ExternalLink, Loader2, Wand2, FileText, Play, Download, Save } from 'lucide-react';
import { generateWorkflowXML } from '../services/gemini';
import { cn } from '../utils';

interface WorkflowDesignerProps {
  language: 'en' | 'ar';
}

export const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({ language }) => {
  const [steps, setSteps] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [xml, setXml] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadBase64 = (base64Data: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = base64Data;
    a.download = fileName;
    a.click();
  };

  React.useEffect(() => {
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') {
          setIsInitialized(true);
          setIsIframeLoading(false);
          if (xml && typeof xml === 'string' && xml.length > 0 && iframeRef.current) {
            const cleanXml = xml
              .replace(/<Array[^>]*>/g, '')
              .replace(/<\/Array>/g, '')
              .replace(/<mxPoint[^>]*>/g, '')
              .replace(/<\/mxPoint>/g, '');
            iframeRef.current.contentWindow?.postMessage(JSON.stringify({
              action: 'load',
              xml: cleanXml,
              fit: true
            }), '*');
          }
        } else if (msg.event === 'save') {
          // Update internal state
          setXml(msg.xml);
          // Download to system as requested
          downloadFile(msg.xml, `workflow-${Date.now()}.drawio`, "text/xml");
        } else if (msg.event === 'export') {
          setIsExporting(false);
          downloadBase64(msg.data, `workflow-${Date.now()}.png`);
        } else if (msg.event === 'error') {
          console.error('Draw.io error:', msg);
          setIsIframeLoading(false);
          setIsExporting(false);
          setError('Draw.io could not load the diagram. The generated XML might be invalid.');
        }
      } catch (e) {
        // Not a JSON message or not from Draw.io
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [xml]);

  // Handle XML updates after initialization
  React.useEffect(() => {
    if (isInitialized && xml && typeof xml === 'string' && xml.length > 0 && iframeRef.current) {
      // Final safety check to remove any <Array> or <mxPoint> tags
      const cleanXml = xml
        .replace(/<Array[^>]*>/g, '')
        .replace(/<\/Array>/g, '')
        .replace(/<mxPoint[^>]*>/g, '')
        .replace(/<\/mxPoint>/g, '');
      
      iframeRef.current.contentWindow?.postMessage(JSON.stringify({
        action: 'load',
        xml: cleanXml,
        fit: true
      }), '*');
    }
  }, [xml, isInitialized]);

  const handleGenerate = async () => {
    if (!steps.trim()) return;
    setIsGenerating(true);
    setError(null);
    setIsIframeLoading(true);
    // Don't clear XML here to avoid flickering, just update it
    try {
      const generatedXml = await generateWorkflowXML(steps, language);
      setXml(generatedXml);
    } catch (err) {
      console.error(err);
      setIsIframeLoading(false);
      setError('Failed to generate diagram. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getDrawioUrl = (xmlData: string) => {
    // If it's just mxGraphModel, wrap it for the external link
    let fullXml = xmlData;
    if (!xmlData.startsWith('<mxfile')) {
      fullXml = `<mxfile host="app.diagrams.net"><diagram id="workflow" name="Workflow">${xmlData}</diagram></mxfile>`;
    }
    const encoded = encodeURIComponent(fullXml);
    return `https://app.diagrams.net/#R${encoded}`;
  };

  const handleDownloadPNG = () => {
    if (!iframeRef.current) return;
    setIsExporting(true);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({
      action: 'export',
      format: 'png',
      spin: 'Generating PNG...'
    }), '*');
  };

  const embedUrl = "https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json&save=1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">
          {language === 'ar' ? 'مصمم سير العمل' : 'Workflow Designer'}
        </h1>
        <p className="text-lg text-zinc-500 max-w-lg mx-auto leading-relaxed">
          {language === 'ar' 
            ? 'اكتب خطوات سير العمل وسيقوم الذكاء الاصطناعي بإنشاء مخطط Draw.io لك.' 
            : 'Write your workflow steps and AI will generate a Draw.io diagram for you.'}
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm space-y-6">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <FileText size={18} className="text-indigo-500" />
            {language === 'ar' ? 'خطوات سير العمل' : 'Workflow Steps'}
          </label>
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            placeholder={language === 'ar' 
              ? "مثال:\n1. يبدأ العميل الطلب\n2. يراجع الموظف الطلب\n3. إذا تمت الموافقة، يتم إرسال الفاتورة\n4. إذا تم الرفض، يتم إرسال بريد إلكتروني" 
              : "Example:\n1. Customer starts request\n2. Employee reviews request\n3. If approved, send invoice\n4. If rejected, send email"}
            className={cn(
              "w-full h-48 p-4 rounded-2xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none text-sm",
              language === 'ar' && "font-arabic"
            )}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !steps.trim()}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              {language === 'ar' ? 'جاري إنشاء المخطط...' : 'Generating Diagram...'}
            </>
          ) : (
            <>
              <Wand2 size={20} />
              {language === 'ar' ? 'إنشاء المخطط' : 'Generate Diagram'}
            </>
          )}
        </button>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}
      </div>

      {xml && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-zinc-900">
              {language === 'ar' ? 'المخطط الناتج' : 'Generated Diagram'}
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadPNG}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-all disabled:opacity-50"
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {language === 'ar' ? 'تحميل PNG' : 'Download PNG'}
              </button>
              <a
                href={getDrawioUrl(xml)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-all"
              >
                <ExternalLink size={16} />
                {language === 'ar' ? 'تعديل في Draw.io' : 'Edit in Draw.io'}
              </a>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm h-[600px] relative group">
            {isIframeLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-4">
                <Loader2 size={48} className="text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-zinc-900">Loading diagram...</p>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={embedUrl}
              className="w-full h-full border-0"
              title="Draw.io Diagram"
            />
          </div>
          <p className="text-xs text-zinc-400 text-center">
            {language === 'ar' 
              ? 'نصيحة: انقر على "حفظ" داخل المحرر لتحميل نسخة .drawio إلى جهازك.' 
              : 'Tip: Click "Save" inside the editor to download a .drawio copy to your system.'}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};
