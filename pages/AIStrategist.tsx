
import React, { useState, useRef, useEffect } from 'react';
import { DebtItem, TaskItem } from '../types';
import { analyzeDebtStrategy, sendChatMessage } from '../services/geminiService';
import { getConfig } from '../services/mockDb';
import { BrainCircuit, Sparkles, Send, Bot, CheckCircle, ListPlus, User, RefreshCw, Zap, Briefcase, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../services/translationService';

interface AIStrategistProps {
  debts: DebtItem[];
  onAddTasks: (tasks: TaskItem[]) => void;
}

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

interface SuggestedAction {
  id: string;
  text: string;
  checked: boolean;
}

export default function AIStrategist({ debts, onAddTasks }: AIStrategistProps) {
  const { language } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [aiConfig, setAiConfig] = useState<any>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const conf = getConfig();
    setAiConfig(conf);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, analysisStep]);

  // --- CONTEXT PREPARATION ---
  const getContextString = () => {
      if (debts.length === 0) return "User has no debts recorded.";
      return `User Debts: ${debts.map(d => `${d.name} (${d.interestRate}% interest, ${d.remainingPrincipal} remaining)`).join(', ')}`;
  };

  const handleInitialAnalyze = async () => {
    setLoading(true);
    setChatStarted(true);
    
    const steps = [
       "Menganalisa Profil Hutang & Bunga...",
       "Cek Peluang Refinancing & Take Over...",
       "Simulasi Strategi Snowball vs Avalanche...",
       "Menghitung Potensi Penghematan...",
       "Menyusun Blueprint Bebas Hutang..."
    ];

    for (const step of steps) {
        setAnalysisStep(step);
        await new Promise(r => setTimeout(r, 1200));
    }
    
    try {
        const result = await analyzeDebtStrategy(debts, language);
        
        setMessages([{ role: 'model', content: result.text, timestamp: new Date() }]);
        
        const actionsWithId = result.actions.map((act, idx) => ({
          id: `ai-act-${idx}`,
          text: act,
          checked: true
        }));
        setSuggestedActions(actionsWithId);
        
        if (result.actions.length > 0) {
          setTimeout(() => setShowPlanForm(true), 1000);
        }
    } catch (e: any) {
        setMessages([{ role: 'model', content: "Maaf, terjadi kesalahan saat menganalisa. " + e.message, timestamp: new Date() }]);
    } finally {
        setLoading(false);
        setAnalysisStep('');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date() }]);
    setLoading(true);
    setAnalysisStep('Sedang mengetik...');

    try {
        // Send with Context
        const context = getContextString();
        const reply = await sendChatMessage(userMsg, language, context);
        setMessages(prev => [...prev, { role: 'model', content: reply, timestamp: new Date() }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', content: "Maaf, koneksi ke AI terputus.", timestamp: new Date() }]);
    } finally {
        setLoading(false);
        setAnalysisStep('');
    }
  };

  const handleActionToggle = (id: string) => {
    setSuggestedActions(prev => prev.map(a => a.id === id ? { ...a, checked: !a.checked } : a));
  };

  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    
    const userId = debts.length > 0 ? debts[0].userId : (localStorage.getItem('paydone_active_user') || 'user');

    const newTasks: TaskItem[] = suggestedActions
      .filter(a => a.checked)
      .map((a, index) => ({
        id: `ai-task-${Date.now()}-${index}`,
        userId: userId,
        title: a.text,
        category: a.text.toLowerCase().includes('bank') ? 'Negotiation' : (index % 2 === 0 ? 'Payment' : 'Administration'), 
        status: 'pending',
        dueDate: new Date(new Date().setDate(new Date().getDate() + 7 * (index + 1))).toISOString().split('T')[0],
        context: 'Debt Acceleration'
      }));

    onAddTasks(newTasks);
    navigate('/app/planning');
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-100px)] flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="flex items-center justify-between py-4 px-2 flex-shrink-0">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <BrainCircuit className="text-brand-600" /> AI Debt Consultant
            </h1>
            <p className="text-sm text-slate-500">Analisa cerdas berbasis data keuangan Anda.</p>
        </div>
        <div className="hidden md:flex gap-2">
           <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm">
             <Zap size={12} className="text-yellow-500 fill-yellow-500" />
             {aiConfig.aiModel || 'Gemini Pro'}
           </span>
           <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm">
             <Briefcase size={12} className="text-blue-500" />
             {aiConfig.aiPersona || 'Balanced'}
           </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1 relative">
        
        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50/50 scroll-smooth">
          
          {!chatStarted && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-fade-in-up">
              <div className="w-24 h-24 bg-gradient-to-tr from-brand-100 to-indigo-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Sparkles className="text-brand-600 h-10 w-10 animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Siap Audit Keuangan?</h3>
              <p className="text-slate-600 text-base mb-8 max-w-md leading-relaxed">
                Saya akan membedah {debts.length} hutang Anda, mencari celah penghematan bunga, dan menyusun strategi pelunasan tercepat.
              </p>
              <button 
                onClick={handleInitialAnalyze}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white font-bold rounded-full hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                    Mulai Audit Sekarang <ChevronDown className="group-hover:rotate-180 transition-transform duration-300"/>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-brand-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          )}

          {chatStarted && (
            <>
              {messages.map((msg, idx) => (
                 <div key={idx} className={`flex items-start gap-4 animate-fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 mt-1 h-10 w-10 rounded-full flex items-center justify-center shadow-sm border ${msg.role === 'user' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-brand-600'}`}>
                       {msg.role === 'user' ? <User size={18} /> : <Bot size={20} />}
                    </div>
                    
                    <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`prose prose-sm p-5 shadow-sm ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-2xl rounded-tr-sm' : 'bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm'}`}>
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap mb-0 text-white leading-relaxed">{msg.content}</p>
                          ) : (
                            <ReactMarkdown 
                                components={{
                                    strong: ({node, ...props}) => <span className="font-bold text-slate-900" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                                    li: ({node, ...props}) => <li className="text-slate-600" {...props} />
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1.5 px-1">
                            {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                 </div>
              ))}
              
              {loading && (
                 <div className="flex items-start gap-4 animate-fade-in">
                    <div className="flex-shrink-0 mt-1 h-10 w-10 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                       <Bot size={20} className="text-brand-600" />
                    </div>
                    <div className="bg-white rounded-2xl rounded-tl-sm p-4 border border-slate-100 shadow-sm flex items-center gap-3">
                       <div className="flex space-x-1">
                           <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                           <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                           <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                       </div>
                       <span className="text-xs font-medium text-slate-500 animate-pulse">{analysisStep}</span>
                    </div>
                 </div>
              )}

              {/* ACTION PLAN CARD */}
              {showPlanForm && messages.length === 1 && !loading && suggestedActions.length > 0 && (
                <div className="flex justify-start ml-14 animate-fade-in-up delay-300">
                  <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-6 max-w-lg shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                        <ListPlus size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Rekomendasi Action Plan</h3>
                        <p className="text-xs text-slate-500">Pilih langkah yang ingin dieksekusi:</p>
                      </div>
                    </div>

                    <form onSubmit={handleSubmitPlan} className="space-y-3">
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {suggestedActions.map((action) => (
                          <label key={action.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${action.checked ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-50 border-transparent hover:bg-white'}`}>
                            <div className="relative flex items-center">
                                <input 
                                type="checkbox" 
                                checked={action.checked}
                                onChange={() => handleActionToggle(action.id)}
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-indigo-500 checked:bg-indigo-500"
                                />
                                <CheckCircle className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" size={12} />
                            </div>
                            <span className={`text-sm leading-snug ${action.checked ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                              {action.text}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="pt-3 flex justify-end">
                        <button 
                          type="submit"
                          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition transform active:scale-95 text-sm"
                        >
                          <CheckCircle size={16} />
                          Konversi ke Task
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* INPUT AREA (FLOATING) */}
        {chatStarted && (
           <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent">
             <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto shadow-2xl rounded-full">
               <input
                 type="text"
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 placeholder="Ketik pertanyaan atau respon Anda..."
                 className="w-full pl-6 pr-14 py-4 rounded-full border border-slate-200 bg-white/80 backdrop-blur-xl focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none text-slate-800 placeholder-slate-400 shadow-sm"
                 disabled={loading}
                 autoFocus
               />
               <button 
                 type="submit" 
                 disabled={!input.trim() || loading}
                 className="absolute right-2 top-2 p-2.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md transform hover:scale-105 active:scale-95"
               >
                 {loading ? <RefreshCw size={20} className="animate-spin"/> : <Send size={20} className="ml-0.5" />}
               </button>
             </form>
             <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
                AI dapat membuat kesalahan. Pastikan cek kembali saran finansial.
             </p>
           </div>
        )}

      </div>
    </div>
  );
}