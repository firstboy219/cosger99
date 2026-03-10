import React, { useState, useEffect } from 'react';
import { getConfig, saveConfig } from '../../services/mockDb';
import { saveGlobalConfigToCloud, loadGlobalConfigFromCloud } from '../../services/cloudSync';
import { Save, Key, Globe, Cloud, Server, Palette, Type, Layout, Smartphone, MessageSquare, Edit3, Megaphone, BrainCircuit, Calculator, ShieldAlert, Shield, Percent, Activity, Workflow, ArrowRight, Clock, ToggleLeft, ToggleRight, Scale, Cpu, CheckCircle, Link as LinkIcon, FileCode, Eye, Fingerprint, Image, LayoutPanelLeft, X } from 'lucide-react';
import { themePresets, ThemeCustom, FONT_OPTIONS, applyTheme, saveCustomTheme, SidebarStyle, ButtonShape, ShadowIntensity, AnimSpeed } from '../../services/themeService';
import { useTranslation, SUPPORTED_LANGUAGES, SupportedLang } from '../../services/translationService';
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
  const [editLang, setEditLang] = useState<'id'|'en'|'zh'|'hi'|'es'|'fr'|'ru'|'ar'>('id');
  const [editDict, setEditDict] = useState<any>({});

  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  useEffect(() => {
    const saved = getConfig();
    setConfig(saved);
    if (saved.systemRules) setRules(saved.systemRules);
    if (saved.advancedConfig) setAdvConfig(saved.advancedConfig);
    setEditDict(translations[editLang] || {});
    
    // Hydrate from Cloud DB (config table)
    const loadFromCloud = async () => {
      setIsLoadingCloud(true);
      try {
        const result = await loadGlobalConfigFromCloud();
        if (result.success && result.data) {
          const cloudConfig = result.data.config || result.data;
          const merged = { ...saved, ...cloudConfig };
          setConfig(merged);
          if (cloudConfig.systemRules) setRules({ ...saved.systemRules, ...cloudConfig.systemRules });
          if (cloudConfig.advancedConfig) setAdvConfig({ ...saved.advancedConfig, ...cloudConfig.advancedConfig });
          // Persist merged config locally so other components pick it up
          saveConfig(merged);
        }
      } catch (e) {
        console.warn("Failed to load config from cloud, using local", e);
      } finally {
        setIsLoadingCloud(false);
      }
    };
    loadFromCloud();
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
        adminSecret: config.adminSecret,
        sourceCodeUrl: config.sourceCodeUrl,
        enablePayloadPreview: config.enablePayloadPreview
    };
    
    // 1. Local Save
    saveConfig(newConfig);
    // Sync adminSecret to localStorage so getAdminHeaders() picks it up immediately
    if (newConfig.adminSecret) {
        localStorage.setItem('paydone_admin_secret', newConfig.adminSecret);
    }
    
    // 2. Cloud Save
    try {
        await saveGlobalConfigToCloud('app_settings', newConfig);
    } catch (e) {
        console.error("Cloud save failed", e);
    }
    
    setIsSaving(false);
    
    // Apply theme immediately without page reload + persist to localStorage
    const themeToApply = config.customTheme || config.currentThemePreset || 'trust';
    if (typeof themeToApply === 'object') {
      applyTheme(themeToApply);
      saveCustomTheme(themeToApply);
    } else {
      applyTheme(themeToApply as string);
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
            {isLoadingCloud && <span className="text-blue-600 text-sm font-bold flex items-center gap-2 animate-pulse"><Cloud size={16}/> Loading from Cloud...</span>}
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
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Admin Secret Key</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            className="w-full border-2 border-slate-100 p-3 pl-10 rounded-xl text-sm font-mono focus:border-brand-500 transition outline-none"
                                            value={config.adminSecret || ''}
                                            onChange={e => {
                                                setConfig({...config, adminSecret: e.target.value});
                                                // Langsung simpan ke localStorage agar getAdminHeaders() langsung pakai nilai baru
                                                localStorage.setItem('paydone_admin_secret', e.target.value);
                                            }}
                                            placeholder="PAYDONE_EMERGENCY_SECURE_KEY..."
                                        />
                                        <Shield className="absolute left-3 top-3.5 text-slate-400" size={16} />
                                    </div>
                                    <p className="text-[10px] text-red-400 mt-1 italic font-bold">⚠️ Harus sama persis dengan env var ADMIN_SECRET di backend. Salah → semua endpoint admin gagal (403).</p>
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

                        {/* V50.21: SHOW DETAILED LOGS TOGGLE */}
                        <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 flex items-center justify-between group hover:border-blue-300 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors"><Activity size={24}/></div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-sm uppercase">Tampilkan Detail Log ke Users</h4>
                                    <p className="text-xs text-slate-500 mt-1">User biasa dapat melihat payload & response di halaman Riwayat Aktivitas.</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setConfig({...config, showDetailedLogsToUsers: !config.showDetailedLogsToUsers})}
                                className={`p-1 rounded-full transition-colors ${config.showDetailedLogsToUsers ? 'text-blue-600' : 'text-slate-300'}`}
                            >
                                {config.showDetailedLogsToUsers ? <ToggleRight size={48}/> : <ToggleLeft size={48}/>}
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

            {/* TAB: APPEARANCE — full theming engine */}
            {activeTab === 'appearance' && <ThemingPanel config={config} setConfig={setConfig} />}

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
                        <div className="flex flex-wrap bg-white/10 p-1 rounded-xl gap-1">
                            {SUPPORTED_LANGUAGES.map(l => (
                              <button key={l.code} type="button" onClick={() => setEditLang(l.code as any)}
                                className={`px-3 py-2 text-[10px] font-black rounded-lg transition-all ${editLang === l.code ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>
                                {l.flag} {l.code.toUpperCase()}
                              </button>
                            ))}
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

// ============================================================================
// THEMING PANEL — Full interactive CSS design system editor
// ============================================================================

const PRESET_META: Record<string, {name:string;desc:string;icon:string}> = {
  trust:     { name:'Trust (Default)', desc:'Profesional, bersih, terpercaya',    icon:'🔵' },
  calm:      { name:'Tenang (Calm)',   desc:'Alam, menenangkan, low-stress',       icon:'🌿' },
  happy:     { name:'Happy (Fun)',     desc:'Energi, semangat, asyik',             icon:'☀️' },
  corporate: { name:'Corporate',       desc:'Tegas, serius, efisien',              icon:'🏢' },
  luxury:    { name:'Mewah (Sultan)',  desc:'Eksklusif, premium, dark-gold',       icon:'👑' },
};

const SIDEBAR_STYLES: {id:SidebarStyle;label:string;icon:string;desc:string}[] = [
  {id:'dark',  label:'Dark',    icon:'🌑', desc:'Sidebar gelap klasik'},
  {id:'light', label:'Light',   icon:'☀️', desc:'Sidebar putih/terang'},
  {id:'brand', label:'Brand',   icon:'🎨', desc:'Warna primary brand'},
  {id:'glass', label:'Glass',   icon:'🪟', desc:'Glassmorphism blur'},
];

const BUTTON_SHAPES: {id:ButtonShape;label:string;preview:string}[] = [
  {id:'square',  label:'Sharp',   preview:'px-4 py-1.5 rounded-sm'},
  {id:'rounded', label:'Rounded', preview:'px-4 py-1.5 rounded-lg'},
  {id:'pill',    label:'Pill',    preview:'px-4 py-1.5 rounded-full'},
];

const SHADOWS: {id:ShadowIntensity;label:string;desc:string}[] = [
  {id:'none',   label:'None',   desc:'Flat design'},
  {id:'soft',   label:'Soft',   desc:'Sangat halus'},
  {id:'medium', label:'Medium', desc:'Standar modern'},
  {id:'strong', label:'Strong', desc:'Bold / lifted'},
];

const ANIM_OPTIONS: {id:AnimSpeed;label:string;ms:string}[] = [
  {id:'off',    label:'Off',    ms:'0ms — Instant'},
  {id:'fast',   label:'Fast',   ms:'100ms'},
  {id:'normal', label:'Normal', ms:'220ms'},
  {id:'slow',   label:'Slow',   ms:'400ms'},
];

interface ThemingPanelProps {
  config: any;
  setConfig: (c: any) => void;
}

function ColorRow({ label, value, onChange, hint }: { label:string; value:string; onChange:(v:string)=>void; hint?:string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-9 h-9 rounded-lg border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
          className="w-24 text-[11px] font-mono border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:border-blue-500 outline-none"
        />
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count }: { icon:React.ReactNode; title:string; count?:string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 pb-2.5 border-b border-slate-100">
      <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">{icon}</div>
      <span className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</span>
      {count && <span className="ml-auto text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{count}</span>}
    </div>
  );
}

function ThemingPanel({ config, setConfig }: ThemingPanelProps) {
  const initTheme = (): ThemeCustom => {
    if (config.customTheme) return config.customTheme;
    const pid = config.currentThemePreset || 'trust';
    return themePresets.find(t=>t.presetId===pid) || themePresets[0];
  };

  const [theme, setTheme] = React.useState<ThemeCustom>(initTheme);
  const [section, setSection] = React.useState<string>('presets');
  const [livePreview, setLivePreview] = React.useState(true);

  // Sync theme state when cloud config loads externally
  React.useEffect(() => {
    if (config.customTheme) {
      const incoming = config.customTheme as ThemeCustom;
      // Only sync if presetId or primaryColor changed (avoid loop from own setConfig calls)
      setTheme(prev => {
        if (prev.presetId !== incoming.presetId || prev.primaryColor !== incoming.primaryColor) {
          return incoming;
        }
        return prev;
      });
    }
  }, [config.customTheme]);

  // Live preview
  React.useEffect(() => {
    if (livePreview) applyTheme(theme);
  }, [theme, livePreview]);

  const updateTheme = (patch: Partial<ThemeCustom>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    setConfig({ ...config, customTheme: next, currentThemePreset: next.presetId });
  };

  const applyPreset = (presetId: string) => {
    const preset = themePresets.find(t=>t.presetId===presetId) || themePresets[0];
    setTheme(preset);
    setConfig({ ...config, customTheme: preset, currentThemePreset: presetId });
    saveCustomTheme(preset);
  };

  const resetToPreset = () => applyPreset(theme.presetId);

  const sections = [
    { id:'presets',    label:'Presets',    icon:'🎨' },
    { id:'colors',     label:'Colors',     icon:'🎭' },
    { id:'typography', label:'Typography', icon:'✏️' },
    { id:'shapes',     label:'Shapes',     icon:'⬜' },
    { id:'sidebar',    label:'Sidebar',    icon:'📐' },
    { id:'motion',     label:'Motion',     icon:'⚡' },
    { id:'custom',     label:'Custom CSS', icon:'💻' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
            <Palette size={20} className="text-violet-600"/> Theme Designer
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Edit CSS design tokens • Perubahan diterapkan secara live ke seluruh halaman</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={()=>setLivePreview(!livePreview)}
              className={`relative w-9 h-5 rounded-full transition-colors ${livePreview?'bg-violet-600':'bg-slate-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${livePreview?'left-4':'left-0.5'}`}/>
            </div>
            <span className="text-xs font-semibold text-slate-600">Live Preview</span>
          </label>
          <button onClick={resetToPreset} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold transition">
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* LEFT: Section Nav + Controls */}
        <div className="w-64 flex-shrink-0 space-y-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                section === s.id
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-sm">{s.icon}</span> {s.label}
            </button>
          ))}

          {/* Mini Preview Card */}
          <div className="mt-4 p-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Preview Aktif</p>
            <div className="h-20 rounded-lg overflow-hidden flex" style={{borderRadius:`${theme.borderRadiusBase}px`}}>
              <div className="w-8 h-full" style={{backgroundColor: theme.bgSidebar}}/>
              <div className="flex-1 flex flex-col" style={{backgroundColor: theme.bgPage}}>
                <div className="h-4" style={{backgroundColor: theme.bgTopbar, borderBottom:`1px solid ${theme.borderColor}`}}/>
                <div className="flex-1 flex gap-1 p-1">
                  <div className="flex-1 rounded" style={{backgroundColor: theme.bgCard, borderRadius:`${Math.max(2,theme.borderRadiusBase*0.5)}px`}}/>
                  <div className="flex-1 rounded" style={{backgroundColor: theme.bgCard, borderRadius:`${Math.max(2,theme.borderRadiusBase*0.5)}px`}}/>
                </div>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {[theme.primaryColor, theme.secondaryColor, theme.accentColor, theme.successColor, theme.dangerColor, theme.warningColor].map((c,i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 border-white shadow" style={{backgroundColor:c}}/>
              ))}
            </div>
            <div className="h-5 rounded flex items-center justify-center text-[9px] text-white font-bold" style={{backgroundColor:theme.primaryColor, borderRadius: theme.buttonShape==='pill'?'9999px':theme.buttonShape==='square'?'2px':`${theme.borderRadiusBase}px`}}>
              Button
            </div>
          </div>
        </div>

        {/* RIGHT: Content */}
        <div className="flex-1 min-w-0">

          {/* PRESETS */}
          {section === 'presets' && (
            <div>
              <SectionHeader icon={<Palette size={14}/>} title="Visual Presets" count="5 themes"/>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themePresets.map(preset => {
                  const meta = PRESET_META[preset.presetId] || {name:preset.presetId, desc:'', icon:'🎨'};
                  const isActive = theme.presetId === preset.presetId;
                  return (
                    <div
                      key={preset.presetId}
                      onClick={() => applyPreset(preset.presetId)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${
                        isActive ? 'border-violet-500 shadow-lg shadow-violet-100' : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      {isActive && <div className="flex justify-end mb-1"><span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-bold">AKTIF</span></div>}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md" style={{backgroundColor: preset.primaryColor}}>
                          {meta.icon}
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-900">{meta.name}</p>
                          <p className="text-[11px] text-slate-500">{meta.desc}</p>
                        </div>
                      </div>
                      {/* Color swatches */}
                      <div className="flex gap-1.5">
                        {[preset.primaryColor, preset.secondaryColor, preset.accentColor, preset.bgPage, preset.bgSidebar].map((c,i) => (
                          <div key={i} className="flex-1 h-3 rounded-full" style={{backgroundColor:c, border:'1px solid rgba(0,0,0,.1)'}}/>
                        ))}
                      </div>
                      {/* Typography preview */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-medium">Aa</span>
                        <span className="text-[10px] text-slate-500">{preset.fontHeading}</span>
                        <span className="text-[10px] text-slate-300 mx-0.5">·</span>
                        <span className="text-[10px] text-slate-400">r={preset.borderRadiusBase}px</span>
                        <span className="text-[10px] text-slate-300 mx-0.5">·</span>
                        <span className="text-[10px] text-slate-400">{preset.buttonShape}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-slate-400 text-center">Pilih preset lalu kustomisasi lebih lanjut di tab lain →</p>
            </div>
          )}

          {/* COLORS */}
          {section === 'colors' && (
            <div>
              <SectionHeader icon={<Type size={14}/>} title="Palette Warna" count="14 tokens"/>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-0">
                {/* Brand */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 mb-1 mt-2">Brand</p>
                  <ColorRow label="Primary" value={theme.primaryColor} onChange={v=>updateTheme({primaryColor:v})} hint="CTA buttons, active nav, links"/>
                  <ColorRow label="Primary Hover" value={theme.primaryHover} onChange={v=>updateTheme({primaryHover:v})} hint="Darker shade of primary"/>
                  <ColorRow label="Secondary" value={theme.secondaryColor} onChange={v=>updateTheme({secondaryColor:v})} hint="Badges, secondary accents"/>
                  <ColorRow label="Accent" value={theme.accentColor} onChange={v=>updateTheme({accentColor:v})} hint="Highlights, sparkle effects"/>
                </div>
                {/* Backgrounds */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 mb-1 mt-2">Backgrounds</p>
                  <ColorRow label="Page Background" value={theme.bgPage} onChange={v=>updateTheme({bgPage:v})} hint="Body / page shell"/>
                  <ColorRow label="Card Background" value={theme.bgCard} onChange={v=>updateTheme({bgCard:v})} hint="Cards, panels, modals"/>
                  <ColorRow label="Sidebar BG" value={theme.bgSidebar} onChange={v=>updateTheme({bgSidebar:v})} hint="Navigation sidebar"/>
                  <ColorRow label="Topbar BG" value={theme.bgTopbar} onChange={v=>updateTheme({bgTopbar:v})} hint="Header / topbar"/>
                </div>
                {/* Text */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 mt-2">Text</p>
                  <ColorRow label="Text Primary" value={theme.textPrimary} onChange={v=>updateTheme({textPrimary:v})} hint="Headings, main body"/>
                  <ColorRow label="Text Secondary" value={theme.textSecondary} onChange={v=>updateTheme({textSecondary:v})} hint="Sub-headings"/>
                  <ColorRow label="Text Muted" value={theme.textMuted} onChange={v=>updateTheme({textMuted:v})} hint="Captions, placeholders"/>
                  <ColorRow label="Border" value={theme.borderColor} onChange={v=>updateTheme({borderColor:v})} hint="Dividers, input borders"/>
                </div>
                {/* Semantic */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-green-600 mb-1 mt-2">Semantic</p>
                  <ColorRow label="Success" value={theme.successColor} onChange={v=>updateTheme({successColor:v})} hint="Positive, paid, approved"/>
                  <ColorRow label="Danger" value={theme.dangerColor} onChange={v=>updateTheme({dangerColor:v})} hint="Errors, delete, overdue"/>
                  <ColorRow label="Warning" value={theme.warningColor} onChange={v=>updateTheme({warningColor:v})} hint="Alerts, pending"/>
                </div>
                {/* Landing */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-1 mt-2">Landing Page</p>
                  <ColorRow label="Landing BG" value={theme.landingBg} onChange={v=>updateTheme({landingBg:v})} hint="Landing page background"/>
                  <ColorRow label="Landing Accent" value={theme.landingAccent} onChange={v=>updateTheme({landingAccent:v})} hint="CTA, highlights di landing"/>
                </div>
              </div>
            </div>
          )}

          {/* TYPOGRAPHY */}
          {section === 'typography' && (
            <div className="space-y-5">
              <SectionHeader icon={<Type size={14}/>} title="Typography" count="5 tokens"/>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Heading font */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Heading Font</label>
                  <select
                    value={theme.fontHeading}
                    onChange={e=>updateTheme({fontHeading:e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white text-slate-800 focus:border-violet-500 outline-none"
                  >
                    {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label} ({f.category})</option>)}
                  </select>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p style={{fontFamily:`'${theme.fontHeading}',sans-serif`,fontWeight:theme.fontWeightHeading as any, fontSize:20}} className="text-slate-900 leading-tight">
                      Heading Contoh
                    </p>
                  </div>
                </div>
                {/* Body font */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Body Font</label>
                  <select
                    value={theme.fontBody}
                    onChange={e=>updateTheme({fontBody:e.target.value})}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-white text-slate-800 focus:border-violet-500 outline-none"
                  >
                    {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label} ({f.category})</option>)}
                  </select>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p style={{fontFamily:`'${theme.fontBody}',sans-serif`, fontSize:13}} className="text-slate-600 leading-relaxed">
                      Body text contoh. Kalimat ini menampilkan font yang dipilih untuk teks paragraf di seluruh halaman.
                    </p>
                  </div>
                </div>
              </div>

              {/* Base font size */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">Base Font Size</label>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{theme.fontSizeBase}px</span>
                </div>
                <input type="range" min="12" max="17" step="1"
                  value={theme.fontSizeBase}
                  onChange={e=>updateTheme({fontSizeBase:Number(e.target.value)})}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>12px (compact)</span><span>14px (default)</span><span>17px (large)</span>
                </div>
              </div>

              {/* Heading weight */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Heading Weight</label>
                <div className="flex gap-2 flex-wrap">
                  {(['400','500','600','700','800','900'] as const).map(w => (
                    <button
                      key={w}
                      onClick={()=>updateTheme({fontWeightHeading:w})}
                      className={`px-4 py-2 rounded-xl text-sm border-2 transition-all ${theme.fontWeightHeading===w?'border-violet-500 bg-violet-50 text-violet-700 font-bold':'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      style={{fontWeight: Number(w)}}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line height */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Line Height</label>
                <div className="flex gap-2">
                  {(['1.4','1.5','1.6','1.7','1.8'] as const).map(lh => (
                    <button
                      key={lh}
                      onClick={()=>updateTheme({lineHeight:lh})}
                      className={`flex-1 py-2 rounded-xl text-xs border-2 transition-all font-semibold ${theme.lineHeight===lh?'border-violet-500 bg-violet-50 text-violet-700':'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {lh}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SHAPES */}
          {section === 'shapes' && (
            <div className="space-y-6">
              <SectionHeader icon={<Layout size={14}/>} title="Shapes & Radius" count="3 tokens"/>

              {/* Border Radius Base */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">Base Border Radius</label>
                  <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{theme.borderRadiusBase}px</span>
                </div>
                <input type="range" min="0" max="24" step="1"
                  value={theme.borderRadiusBase}
                  onChange={e=>updateTheme({borderRadiusBase:Number(e.target.value)})}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0px (sharp)</span><span>12px (default)</span><span>24px (very round)</span>
                </div>
                {/* Radius preview */}
                <div className="mt-4 flex gap-3 flex-wrap">
                  {[
                    {label:'sm',  r: Math.max(2, Math.round(theme.borderRadiusBase*0.5))},
                    {label:'md',  r: theme.borderRadiusBase},
                    {label:'lg',  r: Math.round(theme.borderRadiusBase*1.5)},
                    {label:'xl',  r: Math.round(theme.borderRadiusBase*2)},
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 bg-slate-200 border-2 border-slate-300"
                        style={{borderRadius:`${item.r}px`}}/>
                      <span className="text-[10px] text-slate-500 font-mono">{item.label} ({item.r}px)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Button Shape */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-3">Button Shape</label>
                <div className="flex gap-3">
                  {BUTTON_SHAPES.map(bs => (
                    <button
                      key={bs.id}
                      onClick={()=>updateTheme({buttonShape:bs.id})}
                      className={`flex-1 flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all ${theme.buttonShape===bs.id?'border-violet-500 bg-violet-50':'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <div
                        className="px-4 py-1.5 text-xs font-bold text-white shadow-sm"
                        style={{
                          backgroundColor:theme.primaryColor,
                          borderRadius: bs.id==='pill'?'9999px':bs.id==='square'?'2px':`${theme.borderRadiusBase}px`
                        }}
                      >
                        Button
                      </div>
                      <span className={`text-xs font-semibold ${theme.buttonShape===bs.id?'text-violet-700':'text-slate-500'}`}>{bs.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow intensity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-3">Shadow Intensity</label>
                <div className="grid grid-cols-2 gap-2">
                  {SHADOWS.map(s => (
                    <button
                      key={s.id}
                      onClick={()=>updateTheme({shadowIntensity:s.id})}
                      className={`flex items-center gap-3 p-3 border-2 rounded-xl text-left transition-all ${theme.shadowIntensity===s.id?'border-violet-500 bg-violet-50':'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200"
                        style={{boxShadow: s.id==='none'?'none':s.id==='soft'?'0 1px 3px rgba(0,0,0,.12)':s.id==='medium'?'0 4px 12px rgba(0,0,0,.15)':'0 8px 24px rgba(0,0,0,.2)'}}
                      />
                      <div>
                        <p className={`text-xs font-bold ${theme.shadowIntensity===s.id?'text-violet-700':'text-slate-700'}`}>{s.label}</p>
                        <p className="text-[10px] text-slate-400">{s.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SIDEBAR */}
          {section === 'sidebar' && (
            <div className="space-y-6">
              <SectionHeader icon={<LayoutPanelLeft size={14}/>} title="Sidebar Style" count="4 options"/>
              <div className="grid grid-cols-2 gap-3">
                {SIDEBAR_STYLES.map(ss => {
                  const bgColor = ss.id==='dark'?theme.bgSidebar:ss.id==='light'?theme.bgCard:ss.id==='brand'?theme.primaryColor:'rgba(15,23,42,.65)';
                  return (
                    <button
                      key={ss.id}
                      onClick={()=>updateTheme({sidebarStyle:ss.id})}
                      className={`flex flex-col items-start p-4 border-2 rounded-xl text-left transition-all ${theme.sidebarStyle===ss.id?'border-violet-500 shadow-md':'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      {/* Mini sidebar preview */}
                      <div className="w-full h-20 rounded-lg overflow-hidden mb-3 border border-slate-200 flex"
                        style={{background: ss.id==='glass'?'linear-gradient(135deg,#0f172a88,#1e293b66)':undefined}}>
                        <div className="w-12 h-full flex flex-col items-center py-2 gap-2"
                          style={{backgroundColor:bgColor, backdropFilter:ss.id==='glass'?'blur(20px)':undefined}}>
                          <div className="w-4 h-4 rounded-full" style={{backgroundColor:ss.id==='brand'?'rgba(255,255,255,.3)':theme.primaryColor+'33'}}/>
                          {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-2 rounded" style={{backgroundColor:i===2?(ss.id==='brand'||ss.id==='glass'?'rgba(255,255,255,.8)':theme.primaryColor):'rgba(255,255,255,.2)'}}/>
                          ))}
                        </div>
                        <div className="flex-1 bg-slate-100 p-1.5 flex flex-col gap-1">
                          <div className="h-3 bg-white rounded-sm w-full"/>
                          <div className="flex-1 flex gap-1">
                            <div className="flex-1 bg-white rounded-sm"/>
                            <div className="flex-1 bg-white rounded-sm"/>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{ss.icon}</span>
                        <div>
                          <p className={`text-xs font-bold ${theme.sidebarStyle===ss.id?'text-violet-700':'text-slate-700'}`}>{ss.label}</p>
                          <p className="text-[10px] text-slate-400">{ss.desc}</p>
                        </div>
                        {theme.sidebarStyle===ss.id && <span className="ml-auto text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* MOTION */}
          {section === 'motion' && (
            <div className="space-y-6">
              <SectionHeader icon={<Activity size={14}/>} title="Motion & Animation"/>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-3">Transition Speed</label>
                <div className="space-y-2">
                  {ANIM_OPTIONS.map(ao => (
                    <button
                      key={ao.id}
                      onClick={()=>updateTheme({animSpeed:ao.id})}
                      className={`w-full flex items-center justify-between p-3.5 border-2 rounded-xl text-left transition-all ${theme.animSpeed===ao.id?'border-violet-500 bg-violet-50':'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-all ${theme.animSpeed===ao.id?'border-violet-500 bg-violet-500':'border-slate-300'}`}/>
                        <span className={`text-sm font-bold ${theme.animSpeed===ao.id?'text-violet-700':'text-slate-700'}`}>{ao.label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{ao.ms}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-3">⚡ "Off" menonaktifkan semua transisi untuk performa maksimal.</p>
              </div>
            </div>
          )}

          {/* CUSTOM CSS */}
          {section === 'custom' && (
            <div className="space-y-4">
              <SectionHeader icon={<FileCode size={14}/>} title="Custom CSS"/>
              <div className="bg-slate-900 rounded-xl p-1 border border-slate-700">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
                  <div className="w-3 h-3 rounded-full bg-red-500"/>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"/>
                  <div className="w-3 h-3 rounded-full bg-green-500"/>
                  <span className="ml-2 text-[10px] text-slate-500 font-mono">custom.css — diinjeksi setelah theme variables</span>
                </div>
                <textarea
                  value={theme.customCss}
                  onChange={e=>updateTheme({customCss:e.target.value})}
                  rows={18}
                  placeholder={`/* Contoh: */\n\n/* Override specific component */\n.my-card { border: 2px solid var(--t-primary); }\n\n/* Custom animation */\n@keyframes pulse-brand {\n  0%, 100% { opacity: 1; }\n  50% { opacity: .7; }\n}\n\n/* Force dark mode on specific section */\n#cosger-sidebar .logo-text { font-size: 18px !important; }\n\n/* Available CSS variables: */\n/* --t-primary, --t-bg-card, --t-bg-sidebar */\n/* --t-text-primary, --t-border, --t-radius-md */\n/* --t-font-heading, --t-font-body */\n/* --t-shadow-card, --t-anim */`}
                  className="w-full bg-slate-900 text-green-300 font-mono text-xs p-4 rounded-lg border-0 focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-700 mb-2">📚 Available CSS Variables</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    '--t-primary','--t-primary-h','--t-secondary','--t-accent',
                    '--t-bg-page','--t-bg-card','--t-bg-sidebar','--t-bg-topbar',
                    '--t-text-primary','--t-text-muted','--t-border','--t-border-focus',
                    '--t-success','--t-danger','--t-warning','--t-info',
                    '--t-radius-sm','--t-radius-md','--t-radius-lg','--t-radius-xl',
                    '--t-font-heading','--t-font-body','--t-shadow-card','--t-anim',
                  ].map(v => (
                    <span key={v} className="text-[10px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
