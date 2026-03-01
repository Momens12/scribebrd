import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Loader2, Share2, Download, ExternalLink, GitBranch } from 'lucide-react';
import { extractWorkflowsFromBRD, generateWorkflowXML } from '../services/gemini';
import { cn } from '../utils';

interface BRDWorkflowsProps {
  brdContent: string;
  language: 'en' | 'ar';
}

interface WorkflowDiagram {
  steps: string;
  xml: string | null;
  isGenerating: boolean;
  error: string | null;
  isInitialized: boolean;
}

export const BRDWorkflows: React.FC<BRDWorkflowsProps> = ({ brdContent, language }) => {
  const [workflows, setWorkflows] = useState<WorkflowDiagram[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWorkflows = async () => {
      setIsExtracting(true);
      setError(null);
      try {
        const extracted = await extractWorkflowsFromBRD(brdContent, language);
        setWorkflows(extracted.map(steps => ({
          steps,
          xml: null,
          isGenerating: false,
          error: null,
          isInitialized: false
        })));
      } catch (err) {
        console.error(err);
        setError('Failed to extract workflows from BRD.');
      } finally {
        setIsExtracting(false);
      }
    };

    loadWorkflows();
  }, [brdContent, language]);

  const generateDiagram = async (index: number) => {
    const wf = workflows[index];
    if (wf.isGenerating) return;

    setWorkflows(prev => prev.map((w, i) => i === index ? { ...w, isGenerating: true, error: null } : w));

    try {
      const xml = await generateWorkflowXML(wf.steps, language);
      setWorkflows(prev => prev.map((w, i) => i === index ? { ...w, xml, isGenerating: false } : w));
    } catch (err) {
      console.error(err);
      setWorkflows(prev => prev.map((w, i) => i === index ? { ...w, isGenerating: false, error: 'Failed to generate diagram.' } : w));
    }
  };

  if (isExtracting) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 size={32} className="text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-zinc-500">Detecting workflows in BRD...</p>
      </div>
    );
  }

  if (workflows.length === 0) return null;

  return (
    <div className="space-y-8 mt-12 pt-12 border-t border-zinc-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
          <GitBranch size={20} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900">
            {language === 'ar' ? 'مخططات سير العمل المكتشفة' : 'Detected Workflow Diagrams'}
          </h3>
          <p className="text-sm text-zinc-500">
            {language === 'ar' 
              ? 'تم اكتشاف مسارات العمل التالية في الوثيقة. انقر لإنشاء المخططات.' 
              : 'The following workflows were detected in the document. Click to generate diagrams.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {workflows.map((wf, index) => (
          <WorkflowItem 
            key={index} 
            workflow={wf} 
            language={language} 
            onGenerate={() => generateDiagram(index)} 
          />
        ))}
      </div>
    </div>
  );
};

interface WorkflowItemProps {
  workflow: WorkflowDiagram;
  language: 'en' | 'ar';
  onGenerate: () => void;
}

const WorkflowItem: React.FC<WorkflowItemProps> = ({ workflow, language, onGenerate }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') {
          setIsInitialized(true);
          if (workflow.xml && iframeRef.current) {
            const cleanXml = workflow.xml
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
        } else if (msg.event === 'export') {
          setIsExporting(false);
          const a = document.createElement("a");
          a.href = msg.data;
          a.download = `workflow-${Date.now()}.png`;
          a.click();
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [workflow.xml]);

  useEffect(() => {
    if (isInitialized && workflow.xml && iframeRef.current) {
      const cleanXml = workflow.xml
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
  }, [workflow.xml, isInitialized]);

  const handleDownloadPNG = () => {
    if (!iframeRef.current) return;
    setIsExporting(true);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({
      action: 'export',
      format: 'png',
      spin: 'Generating PNG...'
    }), '*');
  };

  const getDrawioUrl = (xmlData: string) => {
    let fullXml = xmlData;
    if (!xmlData.startsWith('<mxfile')) {
      fullXml = `<mxfile host="app.diagrams.net"><diagram id="workflow" name="Workflow">${xmlData}</diagram></mxfile>`;
    }
    const encoded = encodeURIComponent(fullXml);
    return `https://app.diagrams.net/#R${encoded}`;
  };

  const embedUrl = "https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json&save=1";

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <h4 className="font-bold text-zinc-900">Workflow {workflow.steps.split('\n')[0].substring(0, 50)}...</h4>
          <p className="text-sm text-zinc-500 line-clamp-2">{workflow.steps}</p>
        </div>
        {!workflow.xml && !workflow.isGenerating && (
          <button
            onClick={onGenerate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            Generate Diagram
          </button>
        )}
      </div>

      {workflow.isGenerating && (
        <div className="flex items-center justify-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-zinc-500">Architecting diagram...</p>
          </div>
        </div>
      )}

      {workflow.error && (
        <p className="text-sm text-red-500 text-center">{workflow.error}</p>
      )}

      {workflow.xml && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-all disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              PNG
            </button>
            <a
              href={getDrawioUrl(workflow.xml)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-lg text-xs font-medium hover:bg-zinc-200 transition-all"
            >
              <ExternalLink size={14} />
              Open in Draw.io
            </a>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm h-[400px] relative">
            <iframe
              ref={iframeRef}
              src={embedUrl}
              className="w-full h-full border-0"
              title="Workflow Diagram"
            />
          </div>
        </motion.div>
      )}
    </div>
  );
};
