
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ChevronRight, CheckCircle2, Wallet, Plus, Trash2, ArrowRight, X, Loader2, AlertCircle, Sparkles, MessageSquare } from 'lucide-react';
import { parseOnboardingResponse } from '../services/geminiService';
import { IncomeItem, DebtItem, LoanType } from '../types';
import { formatCurrency, toLocalISOString } from '../services/financeUtils';
import { useTranslation } from '../services/translationService';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface OnboardingWizardProps {
  onComplete: (incomes: IncomeItem[], debts: DebtItem[]) => void;
}

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
  type?: 'text' | 'income_input' | 'debt_input' | 'summary' | 'error';
}

const steps = [
    { id: 'WELCOME', label: 'Intro' },
    { id: 'INCOME', label: 'Pemasukan' },
    { id: 'DEBT', label: 'Hutang' },
    { id: 'FINISH', label: 'Selesai' }
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'WELCOME' | 'INCOME' | 'DEBT' | 'FINISH'>('WELCOME');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', text: t("wiz.welcome") }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempIncomes, setTempIncomes] = useState<IncomeItem[]>([]);
  const [tempDebts, setTempDebts] = useState<DebtItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'ai' | 'user', text: string, type: Message['type'] = 'text') => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role, text, type }]);
  };

  const handleStart = () => {
    addMessage('user', 'Let\'s go!');
    setTimeout(() => {
        setStep('INCOME');
        addMessage('ai', t("wiz.ask_income"), 'income_input');
    }, 800);
  };

  const handleSkipClick = () => {
      setConfirmConfig({
          isOpen: true,
          title: "Skip Setup?",
          message: "Yakin mau skip setup awal? Kamu bisa mengisinya manual nanti di dashboard.",
          onConfirm: () => {
              onComplete([], []);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleQuickReply = (text: string) => {
      setInputText(text);
  };

  const handleIncomeSubmit = async (overrideText?: string) => {
    const input = overrideText || inputText;
    if (!input) return;
    
    setInputText('');
    addMessage('user', input);
    setIsProcessing(true);

    const result = await parseOnboardingResponse('INCOME', input);
    setIsProcessing(false);

    if (result && result.amount) {
        const newIncome: IncomeItem = {
            id: `inc-${Date.now()}`,
            userId: '',
            source: result.source || 'Pemasukan Utama',
            amount: result.amount,
            type: 'active',
            frequency: 'monthly',
            dateReceived: toLocalISOString(new Date())
        };
        setTempIncomes([newIncome]);
        addMessage('ai', `Oke sip! Masuk ${formatCurrency(result.amount)}.`);
        
        setTimeout(() => {
            setStep('DEBT');
            addMessage('ai', t("wiz.ask_debt"), 'debt_input');
        }, 1000);
    } else {
        addMessage('ai', "Hmm, AI lagi penuh. Ketik angkanya saja, misal '5000000'.", 'error');
        const numb = input.replace(/\D/g,'');
        if (numb.length > 4) {
             const newIncome: IncomeItem = {
                id: `inc-${Date.now()}`,
                userId: '',
                source: 'Manual Input',
                amount: Number(numb),
                type: 'active',
                frequency: 'monthly',
                dateReceived: toLocalISOString(new Date())
            };
            setTempIncomes([newIncome]);
            setTimeout(() => {
                setStep('DEBT');
                addMessage('ai', `Oke manual catat ${formatCurrency(Number(numb))}. Lanjut, ada hutang apa?`, 'debt_input');
            }, 1000);
        }
    }
  };

  const handleDebtSubmit = async (overrideText?: string) => {
    const input = overrideText || inputText;
    if (!input) return;
    
    setInputText('');
    addMessage('user', input);
    
    if (input.toLowerCase().match(/(tidak|enggak|gak|no|skip|lewat|bersih|aman)/)) {
        handleFinish();
        return;
    }

    setIsProcessing(true);
    const result = await parseOnboardingResponse('DEBT', input);
    setIsProcessing(false);

    if (result && (result.principal || result.monthlyPayment)) {
        const principal = result.principal || (result.monthlyPayment * (result.tenorMonths || 12));
        const newDebt: DebtItem = {
            id: `debt-${Date.now()}`,
            userId: '',
            name: result.name || 'Hutang Baru',
            type: LoanType.KTA,
            originalPrincipal: principal,
            totalLiability: principal * 1.2,
            monthlyPayment: result.monthlyPayment || 0,
            remainingPrincipal: principal,
            remainingMonths: result.tenorMonths || 12,
            interestRate: 10,
            startDate: toLocalISOString(new Date()),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // End date can stay ISO for simplicity or also be local
            dueDate: 5,
            bankName: result.bank || 'Lending',
            createdAt: new Date().toISOString()
        };

        setTempDebts(prev => [...prev, newDebt]);
        addMessage('ai', `Oke, ${newDebt.name} dicatat. Ada lagi? Kalau gak ada klik "Selesai" di bawah.`, 'debt_input');
    } else {
        addMessage('ai', 'Maaf AI sibuk. Bisa ketik: "KPR 3juta 10tahun"? Atau klik Selesai jika bingung.', 'error');
    }
  };

  const handleFinish = () => {
      setStep('FINISH');
      addMessage('ai', t("wiz.finish"), 'summary');
  };

  const getCurrentStepIndex = () => steps.findIndex(s => s.id === step);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col h-[650px] overflow-hidden relative animate-fade-in-up border border-slate-800">
        
        <div className="bg-slate-900 p-6 text-white flex flex-col shadow-md z-10 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={100} /></div>
           
           <div className="flex items-center justify-between mb-6 z-10">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-brand-500 rounded-xl shadow-lg shadow-brand-500/50"><Bot size={24} className="text-white" /></div>
                 <div>
                   <h2 className="font-bold text-lg leading-tight">Paydone AI Assistant</h2>
                   <p className="text-slate-400 text-xs">Smart Setup • Powered by Gemini</p>
                 </div>
               </div>
               <button onClick={handleSkipClick} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-300 transition border border-slate-700">
                  {t("btn.skip")}
               </button>
           </div>

           <div className="flex items-center justify-between relative z-10 px-2">
               {steps.map((s, idx) => {
                   const isActive = s.id === step;
                   const isCompleted = getCurrentStepIndex() > idx;
                   return (
                       <div key={s.id} className="flex flex-col items-center gap-2 relative z-10">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${isActive ? 'bg-brand-500 text-white scale-110 shadow-lg shadow-brand-500/50' : isCompleted ? 'bg-green-50 text-white' : 'bg-slate-800 text-slate-500'}`}>
                               {isCompleted ? <CheckCircle2 size={14}/> : idx + 1}
                           </div>
                           <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
                       </div>
                   );
               })}
               <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-800 -z-0">
                   <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${(getCurrentStepIndex() / (steps.length - 1)) * 100}%` }}></div>
               </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
           {messages.map((msg) => (
             <div key={msg.id} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                {msg.role === 'ai' && <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 mt-1 flex-shrink-0 shadow-sm text-brand-600"><Bot size={16} /></div>}
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${msg.role === 'ai' ? (msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-200') : 'bg-brand-600 text-white rounded-tr-none shadow-md shadow-brand-200'}`}>
                    {msg.text}
                    {msg.type === 'summary' && (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-600">
                            <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                                <span className="text-xs font-bold uppercase text-slate-400">Total Income</span>
                                <span className="font-bold text-green-600">{formatCurrency(tempIncomes.reduce((a,b)=>a+b.amount,0))}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase text-slate-400">Total Hutang</span>
                                <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">{tempDebts.length} Item</span>
                            </div>
                            <button onClick={() => onComplete(tempIncomes, tempDebts)} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg transform hover:-translate-y-0.5">
                                Masuk Dashboard <ArrowRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
             </div>
           ))}
           {isProcessing && (
               <div className="flex justify-start ml-10 animate-fade-in">
                   <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl rounded-tl-none text-xs text-slate-500 italic flex items-center gap-2 shadow-sm">
                       <Loader2 size={12} className="animate-spin text-brand-600" />
                       Sedang mengetik...
                   </div>
               </div>
           )}
           <div ref={scrollRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
           <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
               {step === 'INCOME' && !isProcessing && (
                   <>
                       <button onClick={() => handleQuickReply('Gaji 5 Juta')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-slate-600 whitespace-nowrap transition border border-slate-200">💰 Gaji 5 Juta</button>
                       <button onClick={() => handleQuickReply('10.000.000')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-slate-600 whitespace-nowrap transition border border-slate-200">💼 10 Juta</button>
                       <button onClick={() => handleQuickReply('UMR Jakarta')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-slate-600 whitespace-nowrap transition border border-slate-200">🏙️ UMR Jakarta</button>
                   </>
               )}
               {step === 'DEBT' && !isProcessing && (
                   <>
                       <button onClick={() => handleQuickReply('KPR 3jt 15thn')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-slate-600 whitespace-nowrap transition border border-slate-200">🏠 KPR Rumah</button>
                       <button onClick={() => handleQuickReply('Cicilan Mobil 2.5jt')} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-slate-600 whitespace-nowrap transition border border-slate-200">🚗 Kredit Mobil</button>
                   </>
               )}
           </div>

           {step === 'WELCOME' ? (
               <button onClick={handleStart} className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-200 transition flex items-center justify-center gap-2 transform hover:scale-[1.02]">
                   Mulai Sekarang <ChevronRight />
               </button>
           ) : (
               step !== 'FINISH' && (
                   <form onSubmit={(e) => { e.preventDefault(); step === 'INCOME' ? handleIncomeSubmit() : handleDebtSubmit(); }} className="flex gap-2 relative">
                       <input 
                         type="text" 
                         className="flex-1 border border-slate-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm text-sm" 
                         placeholder={step === 'INCOME' ? "Ketik income bulanan..." : "Ketik cicilan (nama, nominal)..."} 
                         value={inputText} 
                         onChange={e => setInputText(e.target.value)} 
                         autoFocus 
                         disabled={isProcessing}
                       />
                       <button type="submit" disabled={isProcessing} className="p-3.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 shadow-md transition disabled:opacity-50">
                           {isProcessing ? <Loader2 size={20} className="animate-spin"/> : <Send size={20} />}
                       </button>
                   </form>
               )
           )}
           
           {step === 'DEBT' && (
               <div className="mt-3 text-center">
                   <button onClick={handleFinish} className="text-xs text-slate-400 hover:text-brand-600 font-medium underline">Selesai, tidak ada hutang lagi</button>
               </div>
           )}
        </div>
      </div>

      {/* CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText="Skip"
        cancelText="Batal"
        variant="warning"
      />
    </div>
  );
}
