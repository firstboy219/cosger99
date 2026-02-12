import React, { useState, useEffect } from 'react';
import { getConfig, saveConfig } from '../../services/mockDb';
import { saveGlobalConfigToCloud } from '../../services/cloudSync';
import { Save, Key, Globe, Cloud, Server, Palette, Type, Layout, Smartphone, MessageSquare, Edit3, Megaphone, BrainCircuit, Calculator, ShieldAlert, Percent, Activity, Workflow, ArrowRight, Clock, ToggleLeft, ToggleRight, Scale, Cpu, CheckCircle, Link as LinkIcon, FileCode, Eye, Fingerprint, Image, LayoutPanelLeft, X } from 'lucide-react';
import { themePresets, ThemeConfig } from '../../services/themeService';
import { useTranslation } from '../../services/translationService';
import { SystemRules, AdvancedConfig } from '../../types';

export default function AdminSettings() {
  const { t, updateTranslations, translations } = useTranslation();
  const [activeTab, setActiveTab] = useState('identity'); // Default to Identity
  const [config, setConfig] = useState<any>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Rule Editor State
  const [rules, setRules] = useState<SystemRules>({
      provisionRate: 1, adminFeeKPR: 500000, adminFeeNonKPR: 250000, insuranceRateKPR: 2.5, insuranceRateNonKPR: 1.5,
      notaryFeeKPR: 1, notaryFeeNonKPR: 0.5, benchmarkRateKPR: 7.5, benchmarkRateKKB: 5, benchmarkRateKTA: 11, benchmarkRateCC: 20,
      refinanceGapThreshold: 2, minPrincipalForRefinance: 50000000, dsrSafeLimit: 30, dsrWarningLimit: 45, anomalyPercentThreshold: 40, anomalyMinAmount: 500000
  });

  // Advanced Flow Config
  const [advConfig, setAdvConfig] = useState<AdvancedConfig>({
      syncDebounceMs: 2000, syncRetryAttempts: 3, syncStrategy: 'background',
      defaultRecurringMonths: 12, smartSplitNeeds: 50, smartSplitWants: 30, smartSplitDebt: 20,
      runwayAssumption: 0, healthScoreWeightDSR: 60, healthScoreWeightSavings: 40,
      aiThinkingSpeed: 800, incomeProjectionHorizon: 120
  });

  // Translation Editor State
  const [editLang, setEditLang] = useState<'id'|'en'>('id');
  const [editDict, setEditDict] = useState<any>({});

  useEffect(() => {
    const saved = getConfig();
    setConfig(saved);
    if (saved.systemRules) setRules(saved.systemRules);
    if (saved.advancedConfig) setAdvConfig(saved.advancedConfig);
    setEditDict(translations[editLang] || {});
  }, [editLang, translations]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Merge all possible config keys (preserving existing logic)
    const newConfig = { 
        ...config, 
        systemRules: rules, 
        advancedConfig: advConfig,
        // Ensure Identity fields are saved
        appName: config.appName,
        appDomain: config.appDomain,
        appDescription: config.appDescription,
        appLogoUrl: config.appLogoUrl,
        // Legacy/Direct sync mapping
        geminiApiKey: config.geminiApiKey,
        backendUrl: config.backendUrl,
        sourceCodeUrl: config.sourceCodeUrl,
        enablePayloadPreview: config.enablePayloadPreview
    };
    
    // 1. Local Save
    saveConfig(newConfig);
    
    // 2. Cloud Save
    try {
        await saveGlobalConfigToCloud('app_settings', newConfig);
    } catch (e) {
        console.error("Cloud save failed", e);
    }
    
    setIsSaving(false);
    
    if (config.currentThemePreset && config.currentThemePreset !== getConfig().currentThemePreset) {
       window.location.reload(); 
    }
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSaveDictionary = () => {
      updateTranslations(editLang, editDict);
      alert("Dictionary Updated!");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Global Settings</h2>
          <p className="text-slate-500 text-sm">Pusat kendali seluruh parameter sistem dan tampilan.</p>
        </div>
        <div className="flex items-center gap-4">
            {showSuccess && <span className="text-green-600 text-sm font-bold flex items-center gap-2 animate-fade-in"><CheckCircle size={16}/> Settings Saved!</span>}
            <button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-xl disabled:opacity-70 flex items-center gap-2"
            >
                <Save size={18}/>
                {isSaving ? 'Menyimpan...' : 'Simpan Semua'}
            </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-2">
        <button onClick={() => setActiveTab('identity')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'identity' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Brand Identity</button>
        <button onClick={() => setActiveTab('system')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'system' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>System & API</button>
        <button onClick={() => setActiveTab('flow')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'flow' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Logic & Flows</button>
        <button onClick={() => setActiveTab('rules')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'rules' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Financial Rules</button>
        <button onClick={() => setActiveTab('controls')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'controls' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>App Controls</button>
        <button onClick={() => setActiveTab('appearance')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'appearance' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Theming</button>
        <button onClick={() => setActiveTab('language')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'language' ? 'border-brand-600 text-brand-600 bg-brand-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Language</button>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[500px]">
            
            {/* TAB: BRAND IDENTITY */}
            {activeTab === 'identity' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* INPUTS */}
                        <div className="space-y-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 uppercase tracking-wider text-xs text-slate-400">
                                <Fingerprint size={18} className="text-brand-600"/> Website Identitas
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nama Website (Brand)</label>
                                    <div className="relative">
                                        <input type="text" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-bold focus:border-brand-500 transition outline-none" value={config.appName || ''} onChange={e => setConfig({...config, appName: e.target.value})} placeholder="Paydone.id" />
                                        <LayoutPanelLeft className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Muncul di header dashboard dan halaman login.</p>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Domain Utama</label>
                                    <div className="relative">
                                        <input type="text" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-mono focus:border-brand-500 transition outline-none" value={config.appDomain || ''} onChange={e => setConfig({...config, appDomain: e.target.value})} placeholder="paydone.id" />
                                        <Globe className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Slogan / Deskripsi Singkat</label>
                                    <div className="relative">
                                        <input type="text" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-medium focus:border-brand-500 transition outline-none" value={config.appDescription || ''} onChange={e => setConfig({...config, appDescription: e.target.value})} placeholder="Financial Cockpit" />
                                        <Megaphone className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Logo URL (Icon)</label>
                                    <div className="relative">
                                        <input type="text" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-mono focus:border-brand-500 transition outline-none text-slate-600" value={config.appLogoUrl || ''} onChange={e => setConfig({...config, appLogoUrl: e.target.value})} placeholder="https://example.com/logo.png" />
                                        <Image className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Gunakan URL gambar transparan (PNG/SVG) untuk hasil terbaik.</p>
                                </div>
                            </div>
                        </div>

                        {/* LIVE PREVIEW */}
                        <div className="space-y-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 uppercase tracking-wider text-xs text-slate-400">
                                <Eye size={18} className="text-blue-500"/> Live Preview
                            </h3>
                            
                            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-200">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center">Sidebar View</p>
                                {/* Simulated Sidebar Header */}
                                <div className="bg-slate-900 rounded-xl p-4 shadow-xl max-w-xs mx-auto">
                                    <div className="flex items-center gap-3">
                                        {config.appLogoUrl ? (
                                            <img src={config.appLogoUrl} alt="Logo" className="w-8 h-8 object-contain bg-white rounded-lg p-1"/>
                                        ) : (
                                            <div className="bg-gradient-to-tr from-brand-600 to-indigo-600 text-white p-2 rounded-lg shadow-lg">
                                                <Layout className="h-5 w-5" />
                                            </div>
                                        )}
                                        <div>
                                            <h1 className="font-bold text-lg tracking-tight leading-none text-white">
                                                {config.appName || 'Paydone.id'}
                                            </h1>
                                            <p className="text-[10px] text-slate-400 font-medium mt-0.5 opacity-80">
                                                {config.appDescription || 'Financial Cockpit'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center">Browser Tab Preview</p>
                                    <div className="bg-white border-2 border-slate-200 rounded-t-xl p-2 flex items-center gap-2 max-w-xs mx-auto shadow-sm">
                                        <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                                        <div className="flex-1 bg-slate-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                            {config.appLogoUrl ? (
                                                <img src={config.appLogoUrl} className="w-3 h-3 object-contain"/>
                                            ) : (
                                                <div className="w-3 h-3 bg-brand-500 rounded-full"></div>
                                            )}
                                            <span className="text-xs text-slate-600 font-medium truncate w-32">
                                                {config.appName || 'Paydone.id'} | {config.appDescription || 'Dashboard'}
                                            </span>
                                        </div>
                                        <div className="w-3 h-3 text-slate-300"><X size={12}/></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: SYSTEM & CONNECTION */}
            {activeTab === 'system' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 uppercase tracking-wider text-xs text-slate-400">
                                <Server size={18} className="text-slate-600"/> Backend Node Configuration
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Backend API Endpoint</label>
                                    <div className="relative">
                                        <input type="text" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-mono focus:border-brand-500 transition outline-none" value={config.backendUrl || ''} onChange={e => setConfig({...config, backendUrl: e.target.value})} placeholder="https://api.example.com" />
                                        <Globe className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 italic">URL utama untuk sinkronisasi Cloud SQL dan AI Proxy.</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Source Code Viewer Link</label>
                                    <div className="relative">
                                        <input type="text" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-mono focus:border-brand-500 transition outline-none" value={config.sourceCodeUrl || ''} onChange={e => setConfig({...config, sourceCodeUrl: e.target.value})} placeholder="https://..." />
                                        <FileCode className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 italic">URL API untuk mengambil file server.js (Code Fact Checker).</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3 uppercase tracking-wider text-xs text-slate-400">
                                <Key size={18} className="text-amber-500"/> External Service Keys
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Gemini AI API Key</label>
                                    <div className="relative">
                                        <input type="password" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-mono focus:border-brand-500 transition outline-none" value={config.geminiApiKey || ''} onChange={e => setConfig({...config, geminiApiKey: e.target.value})} placeholder="AIza..." />
                                        <BrainCircuit className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Google OAuth Client ID</label>
                                    <div className="relative">
                                        <input type="text" className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-mono focus:border-brand-500 transition outline-none" value={config.googleClientId || ''} onChange={e => setConfig({...config, googleClientId: e.target.value})} />
                                        <LinkIcon className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* TAB: FLOW & LOGIC */}
            {activeTab === 'flow' && (
                <div className="space-y-8 animate-fade-in">
                    <div>
                        <h3 className="font-black text-slate-800 text-sm mb-6 flex items-center gap-2 uppercase tracking-widest"><Workflow size={20} className="text-blue-600"/> Advanced Execution Strategy</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Sync Strategy</label>
                                <select className="w-full bg-white border-2 border-slate-200 p-3 rounded-xl text-sm font-bold focus:border-brand-500 outline-none" value={advConfig.syncStrategy} onChange={e => setAdvConfig({...advConfig, syncStrategy: e.target.value as any})}>
                                    <option value="background">Background Auto-Sync (Realtime)</option>
                                    <option value="manual_only">Manual Push/Pull Only</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-2 italic">Tentukan bagaimana data user disinkronkan ke Cloud SQL.</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Default Recurring Months</label>
                                <div className="flex items-center gap-4">
                                    <input type="number" className="w-full bg-white border-2 border-slate-200 p-3 rounded-xl text-sm font-bold focus:border-brand-500 outline-none" value={advConfig.defaultRecurringMonths} onChange={e => setAdvConfig({...advConfig, defaultRecurringMonths: Number(e.target.value)})} />
                                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap uppercase">Bulan Ke Depan</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 italic">Jumlah duplikasi otomatis saat membuat pos anggaran rutin.</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-8 border-t border-slate-100">
                        <h4 className="font-black text-slate-800 text-sm mb-6 uppercase tracking-widest">Smart Split Defaults (%)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                <label className="text-[10px] font-black text-blue-400 uppercase">Needs</label>
                                <input type="number" className="w-full bg-transparent text-xl font-black text-blue-900 outline-none" value={advConfig.smartSplitNeeds} onChange={e => setAdvConfig({...advConfig, smartSplitNeeds: Number(e.target.value)})} />
                            </div>
                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                                <label className="text-[10px] font-black text-amber-400 uppercase">Wants</label>
                                <input type="number" className="w-full bg-transparent text-xl font-black text-amber-900 outline-none" value={advConfig.smartSplitWants} onChange={e => setAdvConfig({...advConfig, smartSplitWants: Number(e.target.value)})} />
                            </div>
                            <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                                <label className="text-[10px] font-black text-green-400 uppercase">Debt/Savings</label>
                                <input type="number" className="w-full bg-transparent text-xl font-black text-green-900 outline-none" value={advConfig.smartSplitDebt} onChange={e => setAdvConfig({...advConfig, smartSplitDebt: Number(e.target.value)})} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: RULES */}
            {activeTab === 'rules' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="font-black text-slate-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2"><Percent size={20} className="text-green-600"/> Pricing & Fees</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Provision Rate (%)</label>
                                    <input type="number" step="0.1" className="w-full bg-transparent border-b-2 border-slate-200 focus:border-brand-500 transition py-2 font-bold outline-none" value={rules.provisionRate} onChange={e => setRules({...rules, provisionRate: Number(e.target.value)})} />
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Insurance Rate (%)</label>
                                    <input type="number" step="0.1" className="w-full bg-transparent border-b-2 border-slate-200 focus:border-brand-500 transition py-2 font-bold outline-none" value={rules.insuranceRateKPR} onChange={e => setRules({...rules, insuranceRateKPR: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h3 className="font-black text-slate-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={20} className="text-red-500"/> Risk Thresholds</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-red-50 p-4 rounded-xl">
                                    <label className="block text-[10px] font-black text-red-400 uppercase mb-1">DSR Warning (%)</label>
                                    <input type="number" className="w-full bg-transparent border-b-2 border-red-200 focus:border-red-500 transition py-2 font-bold text-red-900 outline-none" value={rules.dsrWarningLimit} onChange={e => setRules({...rules, dsrWarningLimit: Number(e.target.value)})} />
                                </div>
                                <div className="bg-green-50 p-4 rounded-xl">
                                    <label className="block text-[10px] font-black text-green-400 uppercase mb-1">DSR Safe (%)</label>
                                    <input type="number" className="w-full bg-transparent border-b-2 border-green-200 focus:border-green-500 transition py-2 font-bold text-green-900 outline-none" value={rules.dsrSafeLimit} onChange={e => setRules({...rules, dsrSafeLimit: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: GLOBAL CONTROLS */}
            {activeTab === 'controls' && (
                <div className="space-y-8 animate-fade-in max-w-2xl">
                    <h3 className="font-black text-slate-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2"><Layout size={20} className="text-purple-600"/> Feature Broadcast</h3>
                    <div className="space-y-6">
                        
                        {/* PAYLOAD PREVIEW TOGGLE */}
                        <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 flex items-center justify-between group hover:border-brand-300 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-brand-100 text-brand-600 rounded-2xl group-hover:bg-brand-600 group-hover:text-white transition-colors"><Eye size={24}/></div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm uppercase">Enable Payload Inspector</h4>
                                    <p className="text-xs text-slate-500 mt-1">User dapat mengintip data JSON sebelum klik 'Simpan ke Cloud'.</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setConfig({...config, enablePayloadPreview: !config.enablePayloadPreview})}
                                className={`p-1 rounded-full transition-colors ${config.enablePayloadPreview ? 'text-brand-600' : 'text-slate-300'}`}
                            >
                                {config.enablePayloadPreview ? <ToggleRight size={48}/> : <ToggleLeft size={48}/>}
                            </button>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Global Announcement Message</label>
                            <textarea className="w-full border-2 border-slate-100 p-4 rounded-2xl h-32 focus:border-brand-500 transition outline-none text-sm leading-relaxed" value={config.globalAnnouncement || ''} onChange={e => setConfig({...config, globalAnnouncement: e.target.value})} placeholder="Pesan penting yang akan muncul di dashboard seluruh user..." />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Announcement Banner Style</label>
                            <div className="flex gap-4">
                                {['info', 'warning', 'alert'].map(type => (
                                    <button 
                                        key={type}
                                        type="button"
                                        onClick={() => setConfig({...config, globalAnnouncementType: type})}
                                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all border-2 ${
                                            config.globalAnnouncementType === type 
                                            ? (type === 'info' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : type === 'warning' ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-red-600 border-red-600 text-white shadow-lg')
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: APPEARANCE */}
            {activeTab === 'appearance' && (
                <div className="space-y-8 animate-fade-in">
                    <h3 className="font-black text-slate-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2"><Palette size={20} className="text-pink-600"/> Visual Theme Selection</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {themePresets.map(theme => (
                            <div 
                                key={theme.id} 
                                onClick={() => setConfig({...config, currentThemePreset: theme.id})}
                                className={`p-6 rounded-[2rem] border-4 cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                                    config.currentThemePreset === theme.id 
                                    ? 'border-brand-500 bg-brand-50 shadow-2xl scale-[1.02]' 
                                    : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-xl'
                                }`}
                            >
                                {config.currentThemePreset === theme.id && <div className="absolute top-4 right-4 bg-brand-600 text-white p-1 rounded-full shadow-lg animate-bounce"><CheckCircle size={16}/></div>}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl shadow-inner flex items-center justify-center text-2xl" style={{backgroundColor: theme.primaryColor}}>
                                        <Layout className="text-white/50" size={24}/>
                                    </div>
                                    <div>
                                        <span className="block font-black text-slate-900 text-lg tracking-tight">{theme.name}</span>
                                        <div className="flex gap-1 mt-1">
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: theme.primaryColor}}></div>
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: theme.secondaryColor}}></div>
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: theme.bgColor}}></div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">{theme.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB: LANGUAGE */}
            {activeTab === 'language' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl"><Globe size={24} className="text-blue-400"/></div>
                            <div>
                                <h3 className="font-black tracking-tight text-lg">System Dictionary</h3>
                                <p className="text-blue-200 text-xs font-medium">Ubah istilah dan terjemahan di seluruh aplikasi secara live.</p>
                            </div>
                        </div>
                        <div className="flex bg-white/10 p-1 rounded-xl">
                            <button type="button" onClick={() => setEditLang('id')} className={`px-6 py-2 text-xs font-black rounded-lg transition-all ${editLang === 'id' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>INDONESIAN</button>
                            <button type="button" onClick={() => setEditLang('en')} className={`px-6 py-2 text-xs font-black rounded-lg transition-all ${editLang === 'en' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>ENGLISH</button>
                        </div>
                    </div>
                    
                    <div className="max-h-[500px] overflow-y-auto border-2 border-slate-100 rounded-[2rem] bg-slate-50/50 custom-scrollbar">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 bg-white border-b-2 border-slate-100 z-10">
                                <tr><th className="p-5 font-black uppercase tracking-widest text-slate-400">Translation Key</th><th className="p-5 font-black uppercase tracking-widest text-slate-400">Target Value</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {Object.keys(editDict).map(key => (
                                    <tr key={key} className="hover:bg-white transition-colors group">
                                        <td className="p-5 font-mono text-[10px] text-slate-400 group-hover:text-brand-600 transition-colors">{key}</td>
                                        <td className="p-4">
                                            <input className="w-full bg-transparent p-2 rounded-lg outline-none border-2 border-transparent focus:border-brand-200 focus:bg-white transition-all font-bold text-slate-700" value={editDict[key]} onChange={e => setEditDict({...editDict, [key]: e.target.value})} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="button" onClick={handleSaveDictionary} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl flex items-center gap-2">
                            <CheckCircle size={18}/> Update System Dictionary
                        </button>
                    </div>
                </div>
            )}

      </div>
    </div>
  );
}