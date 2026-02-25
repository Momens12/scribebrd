import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from "@google/genai";

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface BRDChatProps {
  brdId: string;
  brdContent: string;
  language?: 'en' | 'ar';
}

export const BRDChat: React.FC<BRDChatProps> = ({ brdId, brdContent, language = 'en' }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const isRtl = language === 'ar';
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, [brdId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/brds/${brdId}/chat`);
      const data = await res.json();
      setMessages(data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content
      })));
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Save user message to DB
    try {
      await fetch(`/api/brds/${brdId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: userMessage })
      });
      
      // Update local state
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);

      // Get AI response
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `Context: This is a chat about a Business Requirements Document (BRD). Here is the BRD content:\n\n${brdContent}` }] },
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: language === 'ar' 
            ? "أنت مساعد محلل أعمال مفيد. أجب عن الأسئلة المتعلقة بمحتوى وثيقة متطلبات العمل (BRD) المقدمة. كن موجزاً ومهنياً. أجب باللغة العربية."
            : "You are a helpful Business Analyst assistant. Answer questions about the provided BRD content. Be concise and professional. Respond in English."
        }
      });

      const response = await model;
      const aiContent = response.text || "I'm sorry, I couldn't generate a response.";

      // Save AI message to DB
      await fetch(`/api/brds/${brdId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'model', content: aiContent })
      });

      setMessages(prev => [...prev, { id: Date.now().toString() + 'ai', role: 'model', content: aiContent }]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
        <Bot size={20} className="text-indigo-600" />
        <h3 className="font-bold text-zinc-900">BRD Assistant</h3>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/30"
      >
        {messages.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <Bot size={48} className="mx-auto mb-4 opacity-20" />
            <p>{isRtl ? 'اطرح أسئلة حول هذه الوثيقة...' : 'Ask questions about this BRD...'}</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-4",
              m.role === 'user' ? (isRtl ? 'flex-row' : 'flex-row-reverse') : (isRtl ? 'flex-row-reverse' : 'flex-row')
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              m.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-600'
            )}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div 
              dir={isRtl ? 'rtl' : 'ltr'}
              className={cn(
                "max-w-[80%] p-4 rounded-2xl shadow-sm",
                isRtl && "font-arabic",
                m.role === 'user' 
                  ? "bg-indigo-600 text-white" 
                  : "bg-white border border-zinc-200 text-zinc-800",
                m.role === 'user' 
                  ? (isRtl ? 'rounded-tl-none' : 'rounded-tr-none')
                  : (isRtl ? 'rounded-tr-none' : 'rounded-tl-none')
              )}
            >
              <div className={cn("prose prose-sm max-w-none", m.role === 'user' ? "prose-invert" : "")}>
                <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-zinc-200 p-4 rounded-2xl rounded-tl-none shadow-sm">
              <Loader2 size={16} className="animate-spin text-zinc-400" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-100 bg-white">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder={isRtl ? "اسأل سؤالاً..." : "Ask a question..."}
            className={cn(
              "w-full py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all",
              isRtl ? "pl-12 pr-4 font-arabic" : "pl-4 pr-12"
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50",
              isRtl ? "left-2" : "right-2"
            )}
          >
            <Send size={18} className={isRtl ? "rotate-180" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
};
