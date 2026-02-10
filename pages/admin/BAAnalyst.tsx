
import React, { useState, useEffect } from 'react';
import { 
  Workflow, Settings, Save, AlertTriangle, Info, 
  ArrowRight, CheckCircle2, TrendingUp, ShieldAlert,
  FileText, Activity, MousePointer2, ClipboardList, ToggleLeft, ToggleRight, LayoutTemplate
} from 'lucide-react';
import { getConfig, saveConfig, getDB, saveDB } from '../../services/mockDb';
import { SystemRules, FeatureFlags } from '../../types';

export default function BAAnalyst() {
  const [activeTab, setActiveTab] = useState<'flow' | 'rules' | 'specs' | 'workbench'>('workbench');
  const [rules, setRules] = useState<SystemRules>({
      provisionRate: 1, adminFeeKPR: 500000, adminFeeNonKPR: 250000, insuranceRateKPR: 2.5, insuranceRateNonKPR: 1.5,
      notaryFeeKPR: 1, notaryFeeNonKPR: 0.5, benchmarkRateKPR: 7.5, benchmarkRateKKB: 5, benchmarkRateKTA: 11, benchmarkRateCC: 20,
      refinanceGapThreshold: 2, minPrincipalForRefinance: 50000000, dsrSafeLimit: 30, dsrWarningLimit: 45, anomalyPercentThreshold: 40, anomalyMinAmount: 500000
  });
  
  // NEW: Feature Flags
  const [features, setFeatures] = useState<FeatureFlags>({
      enableGamification: true,
      enableFamilyMode: true,
      enableCryptoWallet: false,
      enableStrictBudgeting: false,
      betaDashboard: false
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const db = getDB();
    // 1. Try load from persisted 'baConfigurations' collection first
    const savedRules = db.baConfigurations?.find(c => c.type === 'system_rules');
    if (savedRules) {
        setRules(savedRules.data);
        if (savedRules.data.features) setFeatures(savedRules.data.features);
    } else {
        // Fallback to legacy config
        if (db.config.systemRules) {
            setRules(db.config.systemRules);
            if (db.config.systemRules.features) setFeatures(db.config.systemRules.features);
        }
    }
  }, []);

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Combine standard rules with feature flags
    const updatedRules: SystemRules = { ...rules, features };
    
    // 1. Save to Legacy Config (for compatibility)
    saveConfig({ systemRules: updatedRules });

    // 2. Save to DB Collection (Persistence Table Tree)
    const db = getDB();
    const newConfigEntry = {
        id: 'ba-rules-v1',
        type: 'system_rules',
        data: updatedRules,
        updatedAt: new Date().toISOString()
    };
    
    // Upsert logic
    const existingIdx = db.baConfigurations.findIndex(c => c.type === 'system_rules');
    if (existingIdx !== -1) {
        db.baConfigurations[existingIdx] = newConfigEntry;
    } else {
        db.baConfigurations.push(newConfigEntry);
    }
    saveDB(db);

    setTimeout(() => {
        setIsSaving(false);
        alert("Business Logic & Features Saved to Database!");
    }, 800);
  };

  const toggleFeature = (key: keyof FeatureFlags) => {
      setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Workflow className="text-brand-600" /> BA Analyst Center
          </h2>
          <p className="text-slate-500 text-sm">Business Process Modeling & Logic Configuration.</p>
        </div>
        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button 
                onClick={() => setActiveTab('workbench')} 
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition ${activeTab === 'workbench' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <LayoutTemplate size={16}/> Workbench
            </button>
            <button 
                onClick={() => setActiveTab('flow')} 
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition ${activeTab === 'flow' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Workflow size={16}/> Process Flow
            </button>
            <button 
                onClick={() => setActiveTab('rules')} 
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition ${activeTab === 'rules' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Settings size={16}/> Rule Engine
            </button>
            <button 
                onClick={() => setActiveTab('specs')} 
                className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition ${activeTab === 'specs' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <ClipboardList size={16}/> Functional Specs
            </button>
        </div>
      </div>

      {/* TAB 0: SMART WORKBENCH */}
      {activeTab === 'workbench' && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <div>
                      <h3 className="font-bold text-lg text-slate-800">Feature Toggle Matrix</h3>
                      <p className="text-sm text-slate-500">Enable/Disable system modules instantly without code deployment.</p>
                  </div>
                  <button onClick={handleSaveRules} disabled={isSaving} className="px-6 py-2 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition flex items-center gap-2 disabled:opacity-70 shadow-lg">
                      <Save size={18}/>
                      {isSaving ? 'Applying...' : 'Apply Changes'}
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* FEATURE CARD 1 */}
                  <div className={`p-4 rounded-xl border-2 transition cursor-pointer ${features.enableGamification ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50'}`} onClick={() => toggleFeature('enableGamification')}>
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${features.enableGamification ? 'bg-brand-200 text-brand-800' : 'bg-slate-200 text-slate-500'}`}>
                              {features.enableGamification ? 'Enabled' : 'Disabled'}
                          </span>
                          {features.enableGamification ? <ToggleRight className="text-brand-600" size={24}/> : <ToggleLeft className="text-slate-400" size={24}/>}
                      </div>
                      <h4 className="font-bold text-slate-900">Gamification System</h4>
                      <p className="text-xs text-slate-500 mt-1">Badges, Levels, and Achievement tracking for users.</p>
                  </div>

                  {/* FEATURE CARD 2 */}
                  <div className={`p-4 rounded-xl border-2 transition cursor-pointer ${features.enableFamilyMode ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50'}`} onClick={() => toggleFeature('enableFamilyMode')}>
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${features.enableFamilyMode ? 'bg-green-200 text-green-800' : 'bg-slate-200 text-slate-500'}`}>
                              {features.enableFamilyMode ? 'Enabled' : 'Disabled'}
                          </span>
                          {features.enableFamilyMode ? <ToggleRight className="text-green-600" size={24}/> : <ToggleLeft className="text-slate-400" size={24}/>}
                      </div>
                      <h4 className="font-bold text-slate-900">Family Management</h4>
                      <p className="text-xs text-slate-500 mt-1">Allow users to add sub-members and share budget views.</p>
                  </div>

                  {/* FEATURE CARD 3 */}
                  <div className={`p-4 rounded-xl border-2 transition cursor-pointer ${features.enableCryptoWallet ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-slate-50'}`} onClick={() => toggleFeature('enableCryptoWallet')}>
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${features.enableCryptoWallet ? 'bg-purple-200 text-purple-800' : 'bg-slate-200 text-slate-500'}`}>
                              {features.enableCryptoWallet ? 'Enabled' : 'Disabled'}
                          </span>
                          {features.enableCryptoWallet ? <ToggleRight className="text-purple-600" size={24}/> : <ToggleLeft className="text-slate-400" size={24}/>}
                      </div>
                      <h4 className="font-bold text-slate-900">Crypto Wallet Integration</h4>
                      <p className="text-xs text-slate-500 mt-1">Experimental feature to track crypto assets alongside debts.</p>
                  </div>

                  {/* FEATURE CARD 4 */}
                  <div className={`p-4 rounded-xl border-2 transition cursor-pointer ${features.enableStrictBudgeting ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50'}`} onClick={() => toggleFeature('enableStrictBudgeting')}>
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${features.enableStrictBudgeting ? 'bg-red-200 text-red-800' : 'bg-slate-200 text-slate-500'}`}>
                              {features.enableStrictBudgeting ? 'Strict Mode' : 'Relaxed'}
                          </span>
                          {features.enableStrictBudgeting ? <ToggleRight className="text-red-600" size={24}/> : <ToggleLeft className="text-slate-400" size={24}/>}
                      </div>
                      <h4 className="font-bold text-slate-900">Strict Budget Enforcement</h4>
                      <p className="text-xs text-slate-500 mt-1">Prevent users from adding expenses if budget is exceeded.</p>
                  </div>

                  {/* FEATURE CARD 5 */}
                  <div className={`p-4 rounded-xl border-2 transition cursor-pointer ${features.betaDashboard ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'}`} onClick={() => toggleFeature('betaDashboard')}>
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${features.betaDashboard ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-500'}`}>
                              {features.betaDashboard ? 'Beta V2' : 'Stable V1'}
                          </span>
                          {features.betaDashboard ? <ToggleRight className="text-blue-600" size={24}/> : <ToggleLeft className="text-slate-400" size={24}/>}
                      </div>
                      <h4 className="font-bold text-slate-900">Beta Dashboard UI</h4>
                      <p className="text-xs text-slate-500 mt-1">Switch global user dashboard to V2 layout.</p>
                  </div>
              </div>
          </div>
      )}

      {/* TAB 1: FLOWCHART VISUALIZER */}
      {activeTab === 'flow' && (
          <div className="space-y-6">
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                  <h3 className="font-bold text-lg mb-6 text-slate-800">System Logic: Debt Strategy Determination</h3>
                  
                  {/* CSS GRID FLOWCHART */}
                  <div className="min-w-[800px] flex flex-col gap-8 items-center relative">
                      
                      {/* START NODE */}
                      <div className="flex flex-col items-center group relative cursor-pointer">
                          <div className="w-48 p-4 bg-slate-900 text-white rounded-xl shadow-lg text-center font-bold z-10 hover:scale-105 transition">
                              User Input Data
                          </div>
                          <div className="absolute left-[110%] top-0 w-64 p-3 bg-white border border-slate-200 shadow-xl rounded-lg text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20">
                              <strong>Data Points:</strong><br/>
                              - Loan Details (Principal, Rate, Tenor)<br/>
                              - Monthly Income<br/>
                              - Living Expenses
                          </div>
                          <ArrowRight className="rotate-90 text-slate-300 mt-2" size={24} />
                      </div>

                      {/* LOGIC LAYER 1 */}
                      <div className="grid grid-cols-2 gap-16 w-full max-w-4xl">
                          <div className="flex flex-col items-center group relative">
                              <div className="w-full p-4 bg-blue-50 border-2 border-blue-200 text-blue-800 rounded-xl text-center font-bold hover:bg-blue-100 transition cursor-help">
                                  Health Check (DSR)
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2">Rule: DSR &lt; {rules.dsrSafeLimit}%</p>
                              <div className="mt-4"><ArrowRight className="rotate-90 text-slate-300" size={24} /></div>
                          </div>
                          <div className="flex flex-col items-center group relative">
                              <div className="w-full p-4 bg-purple-50 border-2 border-purple-200 text-purple-800 rounded-xl text-center font-bold hover:bg-purple-100 transition cursor-help">
                                  Market Comparison
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2">Rule: Gap &gt; {rules.refinanceGapThreshold}%</p>
                              <div className="mt-4"><ArrowRight className="rotate-90 text-slate-300" size={24} /></div>
                          </div>
                      </div>

                      {/* DECISION LAYER */}
                      <div className="w-full max-w-2xl border-t-2 border-dashed border-slate-200 my-2"></div>

                      <div className="grid grid-cols-3 gap-8 w-full max-w-5xl">
                          {/* Path A */}
                          <div className="flex flex-col items-center p-4 bg-green-50 rounded-xl border border-green-100">
                              <span className="bg-green-200 text-green-800 text-[10px] font-bold px-2 py-1 rounded mb-2">SAFE PROFILE</span>
                              <h4 className="font-bold text-green-900 mb-2">Snowball Strategy</h4>
                              <p className="text-xs text-slate-600 text-center">Focus on psychological wins. Pay smallest debt first.</p>
                          </div>

                          {/* Path B */}
                          <div className="flex flex-col items-center p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                              <span className="bg-yellow-200 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded mb-2">OPPORTUNITY</span>
                              <h4 className="font-bold text-yellow-900 mb-2">Refinancing / Take Over</h4>
                              <p className="text-xs text-slate-600 text-center">Market rate is lower. Suggest switching bank to save interest.</p>
                          </div>

                          {/* Path C */}
                          <div className="flex flex-col items-center p-4 bg-red-50 rounded-xl border border-red-100">
                              <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-1 rounded mb-2">CRITICAL</span>
                              <h4 className="font-bold text-red-900 mb-2">Asset Liquidation</h4>
                              <p className="text-xs text-slate-600 text-center">DSR &gt; {rules.dsrWarningLimit}%. Emergency protocol initiated. Sell assets.</p>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <Info className="text-blue-600 mt-0.5" size={20}/>
                  <div>
                      <h4 className="font-bold text-blue-900 text-sm">Analyst Note</h4>
                      <p className="text-xs text-blue-700 mt-1">
                          Flowchart ini adalah representasi visual dari logika backend. Mengubah parameter di tab "Rule Engine" akan mempengaruhi threshold keputusan di diagram ini secara real-time.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {/* TAB 2: RULES ENGINE */}
      {activeTab === 'rules' && (
          <form onSubmit={handleSaveRules} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* CARD 1: RISK & HEALTH */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
                      <ShieldAlert size={18} className="text-red-500"/> Risk Parameters
                  </h3>
                  <div className="space-y-4">
                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-xs font-bold text-slate-500">Batas DSR Aman (%)</label>
                              <span className="text-xs font-bold text-slate-900">{rules.dsrSafeLimit}%</span>
                          </div>
                          <input type="range" min="10" max="50" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600" 
                              value={rules.dsrSafeLimit} 
                              onChange={e => setRules({...rules, dsrSafeLimit: Number(e.target.value)})} 
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Debt Service Ratio di bawah ini dianggap "Sehat".</p>
                      </div>
                      
                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="text-xs font-bold text-slate-500">Batas DSR Kritis (%)</label>
                              <span className="text-xs font-bold text-slate-900">{rules.dsrWarningLimit}%</span>
                          </div>
                          <input type="range" min="30" max="80" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600" 
                              value={rules.dsrWarningLimit} 
                              onChange={e => setRules({...rules, dsrWarningLimit: Number(e.target.value)})} 
                          />
                          <p className="text-[10px] text-slate-400 mt-1">DSR di atas ini memicu saran "Jual Aset".</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Anomaly Threshold (%)</label>
                              <input type="number" className="w-full border p-2 rounded text-sm" 
                                  value={rules.anomalyPercentThreshold} 
                                  onChange={e => setRules({...rules, anomalyPercentThreshold: Number(e.target.value)})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Refinance Gap (%)</label>
                              <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" 
                                  value={rules.refinanceGapThreshold} 
                                  onChange={e => setRules({...rules, refinanceGapThreshold: Number(e.target.value)})}
                              />
                          </div>
                      </div>
                  </div>
              </div>

              {/* CARD 2: MARKET BENCHMARKS */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
                      <TrendingUp size={18} className="text-blue-500"/> Market Benchmarks (BI Rate Based)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Bunga KPR (Promo)</label>
                          <div className="flex items-center gap-1">
                              <input type="number" step="0.1" className="w-full bg-white border p-1 rounded text-sm font-bold text-blue-700" 
                                  value={rules.benchmarkRateKPR} 
                                  onChange={e => setRules({...rules, benchmarkRateKPR: Number(e.target.value)})}
                              />
                              <span className="text-xs text-slate-400">%</span>
                          </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Bunga KKB (Flat)</label>
                          <div className="flex items-center gap-1">
                              <input type="number" step="0.1" className="w-full bg-white border p-1 rounded text-sm font-bold text-blue-700" 
                                  value={rules.benchmarkRateKKB} 
                                  onChange={e => setRules({...rules, benchmarkRateKKB: Number(e.target.value)})}
                              />
                              <span className="text-xs text-slate-400">%</span>
                          </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Bunga KTA</label>
                          <div className="flex items-center gap-1">
                              <input type="number" step="0.1" className="w-full bg-white border p-1 rounded text-sm font-bold text-blue-700" 
                                  value={rules.benchmarkRateKTA} 
                                  onChange={e => setRules({...rules, benchmarkRateKTA: Number(e.target.value)})}
                              />
                              <span className="text-xs text-slate-400">%</span>
                          </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 mb-1">Bunga Kartu Kredit</label>
                          <div className="flex items-center gap-1">
                              <input type="number" step="0.1" className="w-full bg-white border p-1 rounded text-sm font-bold text-blue-700" 
                                  value={rules.benchmarkRateCC} 
                                  onChange={e => setRules({...rules, benchmarkRateCC: Number(e.target.value)})}
                              />
                              <span className="text-xs text-slate-400">%</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* CARD 3: FEE STRUCTURE */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-2">
                      <FileText size={18} className="text-green-500"/> Fee Structure & Assumptions
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Biaya Provisi (%)</label>
                          <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" 
                              value={rules.provisionRate} 
                              onChange={e => setRules({...rules, provisionRate: Number(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Asuransi KPR (%)</label>
                          <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" 
                              value={rules.insuranceRateKPR} 
                              onChange={e => setRules({...rules, insuranceRateKPR: Number(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Notaris KPR (%)</label>
                          <input type="number" step="0.1" className="w-full border p-2 rounded text-sm" 
                              value={rules.notaryFeeKPR} 
                              onChange={e => setRules({...rules, notaryFeeKPR: Number(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Admin Fee (IDR)</label>
                          <input type="number" className="w-full border p-2 rounded text-sm" 
                              value={rules.adminFeeKPR} 
                              onChange={e => setRules({...rules, adminFeeKPR: Number(e.target.value)})}
                          />
                      </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                      <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-70">
                          <Save size={18}/>
                          {isSaving ? 'Updating Logic...' : 'Update Business Logic'}
                      </button>
                  </div>
              </div>

          </form>
      )}

      {/* TAB 3: FUNCTIONAL SPECS */}
      {activeTab === 'specs' && (
          <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                  {/* SPEC: DEBT SIMULATION */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><CheckCircle2 size={18} className="text-blue-500"/> Module: Debt Simulator</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 pl-2">
                          <li>System MUST calculate provision fee (1% default) on top of principal.</li>
                          <li>System MUST separate insurance costs for KPR (Property) vs KKB (Vehicle).</li>
                          <li>If Loan Type is KPR, Admin Fee defaults to IDR 500,000.</li>
                          <li>Result table MUST show amortization schedule (Principal vs Interest breakdown).</li>
                      </ul>
                  </div>

                  {/* SPEC: DASHBOARD & AI */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><CheckCircle2 size={18} className="text-purple-500"/> Module: AI & Dashboard</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 pl-2">
                          <li>AI must identify "Refinancing Opportunity" if user rate > market rate + threshold (2%).</li>
                          <li>DSR calculation = (Total Monthly Obligations / Total Income) * 100.</li>
                          <li>If DSR > Safe Limit, dashboard MUST show a warning banner.</li>
                          <li>Snowball strategy sorts debts by Remaining Principal (ASC). Avalanche sorts by Interest Rate (DESC).</li>
                      </ul>
                  </div>

                  {/* SPEC: SYNC & BACKEND */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><CheckCircle2 size={18} className="text-green-500"/> Module: Data Sync</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 pl-2">
                          <li>Offline Mode: Data must persist in LocalStorage when API is unreachable.</li>
                          <li>Sync Strategy: 'Upsert' logic based on ID. Newer timestamp wins.</li>
                          <li>Critical: API Keys must be stored encrypted or via ENV variables in the backend.</li>
                          <li>Audit Log: Every CREATE/UPDATE/DELETE action must record a log entry.</li>
                      </ul>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
