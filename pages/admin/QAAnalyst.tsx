
import React, { useState, useEffect } from 'react';
import { 
  Play, CheckCircle2, AlertCircle, RefreshCw, 
  Terminal, Activity, Cpu, Database, Zap, Layers, Server,
  Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { getDB, saveDB, getConfig } from '../../services/mockDb';
import { getAdminHeaders } from '../../services/cloudSync';
import { QAScenario } from '../../types';
import { pushPartialUpdate } from '../../services/cloudSync';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const CATEGORIES: QAScenario['category'][] = ['AUTH','DASHBOARD','DEBT','INCOME','EXPENSE','SYSTEM','UX'];
const METHODS = ['GET','POST','PUT','DELETE','PATCH'];

const EMPTY_FORM = {
  name: '', category: 'SYSTEM' as QAScenario['category'],
  type: 'backend' as 'ui' | 'backend',
  target: '', method: 'GET' as string,
  payload: '', description: '', expectedStatus: 200,
  isNegativeCase: false,
};

export default function QAAnalyst() {
  const [testCases, setTestCases] = useState<QAScenario[]>([]);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [stressLogs, setStressLogs] = useState<string[]>([]);
  const [stressMetrics, setStressMetrics] = useState({ requests: 0, failures: 0, avgLat: 0, stability: 100 });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'scenarios' | 'stress'>('scenarios');

  // ── CRUD State ─────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<QAScenario | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Confirmation Modal
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; variant?: 'danger' | 'warning' | 'info'; confirmText?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => { fetchScenarios(); }, []);

  const fetchScenarios = async () => {
    setIsLoading(true);
    const config = getConfig();
    if (config.backendUrl) {
      try {
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';
        const res = await fetch(`${config.backendUrl}/api/qa-scenarios`, {
          headers: getAdminHeaders(adminId)
        });
        if (res.ok) {
          const data = await res.json();
          const rows: QAScenario[] = Array.isArray(data) ? data : (data.data || []);
          setTestCases(rows);
          const db = getDB(); db.qaScenarios = rows; saveDB(db);
          setIsLoading(false); return;
        }
      } catch { /* fallback */ }
    }
    const db = getDB();
    setTestCases(db.qaScenarios || []);
    setIsLoading(false);
  };

  const openCreate = () => {
    setEditing(null); setForm({ ...EMPTY_FORM }); setFormError(''); setShowModal(true);
  };

  const openEdit = (sc: QAScenario) => {
    setEditing(sc);
    setForm({
      name: sc.name, category: sc.category, type: sc.type,
      target: sc.target, method: sc.method || 'GET',
      payload: typeof sc.payload === 'object' ? JSON.stringify(sc.payload, null, 2) : (sc.payload || ''),
      description: sc.description, expectedStatus: sc.expectedStatus ?? 200,
      isNegativeCase: sc.isNegativeCase ?? false,
    });
    setFormError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Nama skenario wajib diisi.'); return; }
    if (!form.target.trim()) { setFormError('Target endpoint wajib diisi.'); return; }
    setSaving(true); setFormError('');
    const config = getConfig();
    const adminId = localStorage.getItem('paydone_active_user') || 'admin';
    try {
      const payload: Partial<QAScenario> = {
        name: form.name.trim(), category: form.category, type: form.type,
        target: form.target.trim(), method: form.method as any,
        payload: form.payload.trim() || undefined,
        description: form.description.trim(), expectedStatus: Number(form.expectedStatus),
        isNegativeCase: form.isNegativeCase,
      };
      if (editing) {
        const res = await fetch(`${config.backendUrl}/api/qa-scenarios/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders(adminId) },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Gagal update skenario.');
        setTestCases(prev => prev.map(s => s.id === editing.id ? { ...s, ...payload } : s));
      } else {
        const newId = `qa-${Date.now()}`;
        const res = await fetch(`${config.backendUrl}/api/qa-scenarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders(adminId) },
          body: JSON.stringify({ ...payload, id: newId, createdAt: new Date().toISOString() })
        });
        if (!res.ok) throw new Error('Gagal membuat skenario.');
        const data = await res.json();
        const saved = data.data || { ...payload, id: newId, createdAt: new Date().toISOString() };
        setTestCases(prev => [saved as QAScenario, ...prev]);
      }
      setShowModal(false);
    } catch (e: any) { setFormError(e.message || 'Gagal menyimpan.'); }
    setSaving(false);
  };

  const handleDeleteClick = (sc: QAScenario) => {
    setConfirmConfig({
      isOpen: true, title: 'Hapus Skenario?',
      message: `Hapus skenario "${sc.name}"? Tindakan ini tidak bisa dibatalkan.`,
      variant: 'danger', confirmText: 'Hapus',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        const config = getConfig();
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';
        try {
          await fetch(`${config.backendUrl}/api/qa-scenarios/${sc.id}`, {
            method: 'DELETE', headers: getAdminHeaders(adminId)
          });
          setTestCases(prev => prev.filter(s => s.id !== sc.id));
        } catch { /* silent */ }
      }
    });
  };

  const handleStressTestClick = () => {
    setConfirmConfig({
      isOpen: true, title: "Run High Load Simulation?",
      message: "PERINGATAN: Menjalankan 100 transaksi paralel ke Cloud SQL. Lanjutkan simulasi beban tinggi?",
      onConfirm: () => { runV50StressTest(); setConfirmConfig(prev => ({ ...prev, isOpen: false })); }
    });
  };

  const runV50StressTest = async () => {
    setIsStressTesting(true);
    setStressMetrics({ requests: 0, failures: 0, avgLat: 0, stability: 100 });
    setStressLogs(["[INIT] Stability Engine v50.4 Activated","[MODE] Concurrent Burst - 100 TXN","[TARGET] Distributed Micro-Sync API"]);
    const adminId = 'admin'; let fails = 0; let totalLat = 0; const totalOps = 100;
    const operations = Array.from({length: totalOps}).map(async (_, i) => {
      const startTime = performance.now();
      const mockType = i % 2 === 0 ? 'dailyExpenses' : 'incomes';
      const payload = { [mockType]: [{ id: `stress-${Date.now()}-${i}`, title: `Stress Test Log #${i}`, amount: Math.floor(Math.random() * 50000), date: new Date().toISOString().split('T')[0] }] };
      const success = await pushPartialUpdate(adminId, payload);
      const duration = performance.now() - startTime;
      if (!success) fails++;
      totalLat += duration;
      setStressMetrics(m => ({ requests: m.requests + 1, failures: fails, avgLat: Math.round(totalLat / (i + 1)), stability: Math.round(((i + 1 - fails) / (i + 1)) * 100) }));
      if (i % 10 === 0) setStressLogs(prev => [...prev.slice(-12), `>> OP[${i}] -> ${success ? 'RESOLVED' : 'FAILED'} in ${Math.round(duration)}ms`]);
    });
    await Promise.all(operations);
    setStressLogs(prev => [...prev, "[COMPLETE] Stress Test Finished.", `[SUMMARY] Final Stability: ${((totalOps-fails)/totalOps*100).toFixed(1)}%`]);
    setIsStressTesting(false);
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string,string> = { AUTH:'bg-purple-100 text-purple-700',DASHBOARD:'bg-blue-100 text-blue-700',DEBT:'bg-red-100 text-red-700',INCOME:'bg-green-100 text-green-700',EXPENSE:'bg-orange-100 text-orange-700',SYSTEM:'bg-slate-100 text-slate-700',UX:'bg-pink-100 text-pink-700' };
    return map[cat] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <Terminal className="text-brand-600" /> QA Auditor Studio
          </h2>
          <p className="text-slate-500 font-medium mt-1">Kelola skenario QA dan jalankan simulasi beban tinggi.</p>
        </div>
        <button onClick={handleStressTestClick} disabled={isStressTesting}
          className="px-6 py-3 bg-red-600 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl hover:bg-red-700 transition shadow-lg flex items-center gap-2 disabled:opacity-50">
          {isStressTesting ? <RefreshCw className="animate-spin" size={16}/> : <Zap size={16}/>} Stress Test (100 Ops)
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {([['scenarios','📋 Skenario QA'],['stress','⚡ Stress Monitor']] as const).map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition ${activeTab===id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
            {label}{id==='scenarios' ? ` (${testCases.length})` : ''}
          </button>
        ))}
      </div>

      {/* SCENARIOS TAB */}
      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{testCases.length} skenario di cloud</p>
            <div className="flex gap-2">
              <button onClick={fetchScenarios} disabled={isLoading} className="p-2 border rounded-lg hover:bg-slate-50 transition">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/>
              </button>
              <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 transition">
                <Plus size={15}/> Tambah Skenario
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="animate-spin mr-2" size={18}/> Memuat...</div>
          ) : testCases.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <Database size={40} className="mx-auto mb-3 text-slate-300"/>
              <p className="font-bold text-slate-500">Belum ada skenario QA</p>
              <p className="text-sm text-slate-400 mt-1">Klik "Tambah Skenario" untuk memulai</p>
            </div>
          ) : (
            <div className="space-y-2">
              {testCases.map(sc => {
                const isExp = expandedId === sc.id;
                return (
                  <div key={sc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(isExp ? null : sc.id)}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${getCategoryColor(sc.category)}`}>{sc.category}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{sc.name}</p>
                        <p className="text-xs text-slate-400 truncate font-mono">{sc.method} {sc.target}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sc.lastStatus && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.lastStatus==='pass'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                            {sc.lastStatus==='pass'?'✓ PASS':'✗ FAIL'}
                          </span>
                        )}
                        <button onClick={e=>{e.stopPropagation();openEdit(sc);}} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"><Edit2 size={13}/></button>
                        <button onClick={e=>{e.stopPropagation();handleDeleteClick(sc);}} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={13}/></button>
                        {isExp ? <ChevronUp size={13} className="text-slate-400"/> : <ChevronDown size={13} className="text-slate-400"/>}
                      </div>
                    </div>
                    {isExp && (
                      <div className="border-t border-slate-100 p-4 bg-slate-50 text-xs space-y-2">
                        <p className="text-slate-600">{sc.description || 'Tidak ada deskripsi.'}</p>
                        {sc.payload && <pre className="bg-slate-800 text-green-400 p-3 rounded-lg text-[10px] overflow-x-auto font-mono">{typeof sc.payload==='object' ? JSON.stringify(sc.payload,null,2) : sc.payload}</pre>}
                        <div className="flex gap-4 text-slate-500">
                          <span>Expected: <strong>{sc.expectedStatus}</strong></span>
                          <span>Negative: <strong>{sc.isNegativeCase?'Ya':'Tidak'}</strong></span>
                          <span>Type: <strong>{sc.type}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STRESS MONITOR TAB */}
      {activeTab === 'stress' && (
        <div className="space-y-6">
          {isStressTesting && (
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl border-4 border-red-500/20 grid md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-red-500/20 rounded-2xl border border-red-500/30 animate-pulse"><Cpu size={32} className="text-red-400"/></div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-[0.3em] text-red-400">Pressure Monitor</h3>
                    <p className="text-slate-500 text-[10px] font-mono">Real-time API Throughput</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[['Successful','text-green-400',stressMetrics.requests-stressMetrics.failures],['Failed','text-red-400',stressMetrics.failures],['Avg Latency','text-blue-400',`${stressMetrics.avgLat}ms`],['Stability','text-yellow-400',`${stressMetrics.stability}%`]].map(([label,color,val]) => (
                    <div key={label as string} className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                      <p className="text-[10px] text-slate-500 font-black uppercase mb-1">{label}</p>
                      <p className={`text-3xl font-black ${color}`}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-black/50 p-8 rounded-[2rem] border border-white/5 font-mono text-[11px] text-green-400 space-y-2 h-72 overflow-y-auto custom-scrollbar shadow-inner">
                {stressLogs.map((log,i) => <div key={i} className="flex gap-3"><span className="text-slate-700">[{i}]</span><span>{log}</span></div>)}
                {isStressTesting && <div className="animate-pulse bg-green-500 w-2 h-4 mt-2"></div>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="p-4 bg-brand-50 text-brand-600 rounded-2xl w-fit mb-6"><Database size={24}/></div>
              <h4 className="font-black text-slate-900 mb-2">Cloud Integrity Check</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">Memastikan integritas relasi tabel SQL antara Debts, Incomes, dan Installments tetap sinkron.</p>
              <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition">Run Integrity Audit</button>
            </div>
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl w-fit mb-6"><Server size={24}/></div>
              <h4 className="font-black text-slate-900 mb-2">Node Latency Analysis</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">Tes kecepatan respon backend dari berbagai lokasi virtual untuk optimasi cache.</p>
              <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition">Probe Speed</button>
            </div>
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl w-fit mb-6"><Layers size={24}/></div>
              <h4 className="font-black text-slate-900 mb-2">Regression Suite</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">Kumpulan 40+ skenario pengujian UI otomatis untuk mendeteksi bug visual.</p>
              <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition">Execute Suite</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20}/></button>
            <h3 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2">
              <Activity size={20} className="text-brand-600"/> {editing ? 'Edit Skenario' : 'Tambah Skenario QA'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Skenario *</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="mis: Login dengan email valid"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kategori</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value as any}))}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipe</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value as any}))}>
                    <option value="backend">Backend (API)</option><option value="ui">UI (Frontend)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target *</label>
                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-500" value={form.target} onChange={e=>setForm(p=>({...p,target:e.target.value}))} placeholder="/api/auth/login"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" value={form.method} onChange={e=>setForm(p=>({...p,method:e.target.value}))}>
                    {METHODS.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payload JSON (opsional)</label>
                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono h-20 resize-none focus:outline-none focus:border-brand-500" value={form.payload} onChange={e=>setForm(p=>({...p,payload:e.target.value}))} placeholder='{"email":"test@mail.com"}'/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Apa yang diuji..."/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expected HTTP Status</label>
                  <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" value={form.expectedStatus} onChange={e=>setForm(p=>({...p,expectedStatus:Number(e.target.value)}))}/>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="negCase" checked={form.isNegativeCase} onChange={e=>setForm(p=>({...p,isNegativeCase:e.target.checked}))} className="w-4 h-4 accent-brand-600"/>
                  <label htmlFor="negCase" className="text-sm font-bold text-slate-600">Negative Case</label>
                </div>
              </div>
              {formError && <p className="text-xs text-red-600 font-bold">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={()=>setShowModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
                  {saving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>} {editing ? 'Update' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm} onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText={confirmConfig.confirmText || "Confirm"} cancelText="Batal"
        variant={confirmConfig.variant || "danger"}
      />
    </div>
  );
}
