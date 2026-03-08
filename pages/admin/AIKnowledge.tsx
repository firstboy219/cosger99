import React, { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Save, CheckCircle2, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Tag, Lightbulb, MessageSquare, CheckCheck,
  XCircle, Zap, AlertTriangle, Edit2 } from 'lucide-react';
import { getAdminHeaders, myAdminId } from '../../services/cloudSync';
import {
  AIKnowledgeRule, DEFAULT_RULES, saveKnowledgeRules, fetchKnowledgeRules,
  UnknownPrompt, fetchUnknownPrompts, resolveUnknownPrompt, AIActionType
} from '../../services/localAI';

const ACTION_OPTIONS = [
  { value: 'ADD_EXPENSE',  label: '💸 Catat Pengeluaran',       color: 'bg-red-100 text-red-700' },
  { value: 'ADD_INCOME',   label: '💰 Catat Pemasukan',          color: 'bg-green-100 text-green-700' },
  { value: 'ADD_TASK',     label: '📋 Buat Tugas/Reminder',      color: 'bg-blue-100 text-blue-700' },
  { value: 'CHECK_HEALTH', label: '❤️ Cek Kesehatan',           color: 'bg-purple-100 text-purple-700' },
  { value: 'SHOW_DEBTS',   label: '🏦 Lihat Hutang',             color: 'bg-amber-100 text-amber-700' },
];

function KnowledgeTab() {
  const [rules, setRules] = useState<AIKnowledgeRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{type:'success'|'error';msg:string}|null>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [triggerInput, setTriggerInput] = useState<Record<string,string>>({});
  useEffect(() => { fetchKnowledgeRules().then(r => { setRules(r); setIsLoading(false); }); }, []);
  const save = async () => {
    setIsSaving(true);
    const ok = await saveKnowledgeRules(rules, getAdminHeaders(myAdminId()));
    setFeedback(ok ? {type:'success',msg:`${rules.length} rule tersimpan ke cloud.`} : {type:'error',msg:'Gagal menyimpan.'});
    setIsSaving(false); setTimeout(() => setFeedback(null), 3000);
  };
  const newRule = (): AIKnowledgeRule => ({id:`rule-${Date.now()}`,label:'',action:'ADD_EXPENSE',triggers:[],example:'',defaultFields:{},description:'',priority:5,isActive:true});
  const upd = (id:string, p: Partial<AIKnowledgeRule>) => setRules(prev => prev.map(r => r.id===id ? {...r,...p} : r));
  const addTrigger = (id:string) => {
    const v=(triggerInput[id]||'').trim().toLowerCase(); if(!v) return;
    const rule=rules.find(r=>r.id===id); if(!rule) return;
    upd(id,{triggers:[...rule.triggers,v]}); setTriggerInput(p=>({...p,[id]:''}));
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>{if(!confirm('Reset ke defaults?'))return;setRules(DEFAULT_RULES.map(r=>({...r})));}} className="px-3 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"><RefreshCw size={12}/> Reset Default</button>
        <button onClick={()=>{const r=newRule();setRules(p=>[r,...p]);setExpandedId(r.id);}} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"><Plus size={12}/> Tambah Rule</button>
        <button onClick={save} disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
          {isSaving?<RefreshCw size={12} className="animate-spin"/>:<Save size={12}/>} Simpan ke Cloud
        </button>
      </div>
      {feedback && <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-bold border ${feedback.type==='success'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-red-50 text-red-700 border-red-200'}`}>{feedback.type==='success'?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>} {feedback.msg}</div>}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 text-xs text-blue-800 space-y-1">
        <p className="font-black flex items-center gap-1.5"><Lightbulb size={11}/> Cara kerja:</p>
        <p>1. User ketik di AI Command → engine cocokkan dengan <strong>trigger keywords</strong> tiap rule</p>
        <p>2. Score tertinggi → popup konfirmasi terisi otomatis (user bisa edit)</p>
        <p>3. 2 rule score berdekatan → popup tunjukkan pilihan ke user</p>
        <p>4. Tidak ada match → masuk tab <strong>Prompt Belum Dikenal</strong> untuk direview admin</p>
      </div>
      {isLoading ? <div className="flex justify-center py-10 text-slate-400"><RefreshCw className="animate-spin mr-2" size={16}/> Memuat...</div> : (
        <div className="space-y-2">
          {rules.map(rule => {
            const isExp = expandedId===rule.id;
            const ao = ACTION_OPTIONS.find(a=>a.value===rule.action);
            return (
              <div key={rule.id} className={`bg-white border rounded-2xl overflow-hidden ${rule.isActive?'border-slate-200':'border-slate-100 opacity-55'}`}>
                <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50" onClick={()=>setExpandedId(isExp?null:rule.id)}>
                  <label className="flex items-center cursor-pointer" onClick={e=>e.stopPropagation()}>
                    <input type="checkbox" checked={rule.isActive} onChange={e=>upd(rule.id,{isActive:e.target.checked})} className="w-4 h-4 accent-blue-600"/>
                  </label>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-black text-sm text-slate-800 truncate">{rule.label||<span className="text-slate-400 italic">Untitled</span>}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${ao?.color||'bg-slate-100 text-slate-500'}`}>{ao?.label||rule.action}</span>
                    <span className="text-[9px] text-slate-400 hidden sm:block">{rule.triggers.length} trigger · P{rule.priority}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] text-slate-400 italic hidden md:block">{rule.example}</span>
                    <button onClick={e=>{e.stopPropagation();setRules(p=>p.filter(r=>r.id!==rule.id));}} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={11}/></button>
                    {isExp?<ChevronUp size={13} className="text-slate-400"/>:<ChevronDown size={13} className="text-slate-400"/>}
                  </div>
                </div>
                {isExp && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[{k:'label',l:'Nama Rule',p:'Catat Makan'},{k:'example',l:'Contoh Kalimat',p:'catat makan 25rb'}].map(f=>(
                        <div key={f.k}><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">{f.l}</label>
                        <input value={(rule as any)[f.k]} onChange={e=>upd(rule.id,{[f.k]:e.target.value} as any)} placeholder={f.p} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"/></div>
                      ))}
                      <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Aksi</label>
                        <select value={rule.action} onChange={e=>upd(rule.id,{action:e.target.value as AIActionType})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
                          {ACTION_OPTIONS.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Prioritas (1–10)</label>
                        <input type="number" min={1} max={10} value={rule.priority} onChange={e=>upd(rule.id,{priority:Number(e.target.value)})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"/></div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5"><Tag size={10} className="inline mr-1"/>Trigger Keywords</label>
                      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                        {rule.triggers.map(t=>(
                          <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-bold text-blue-700">
                            {t}<button onClick={()=>upd(rule.id,{triggers:rule.triggers.filter(x=>x!==t)})} className="text-blue-400 hover:text-red-500 ml-0.5">×</button>
                          </span>
                        ))}
                        {rule.triggers.length===0 && <span className="text-[11px] text-slate-400 italic">Belum ada</span>}
                      </div>
                      <div className="flex gap-2">
                        <input value={triggerInput[rule.id]||''} onChange={e=>setTriggerInput(p=>({...p,[rule.id]:e.target.value}))}
                          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTrigger(rule.id);}}}
                          placeholder="ketik keyword lalu Enter" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white"/>
                        <button onClick={()=>addTrigger(rule.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"><Plus size={11}/></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rules.length===0 && <div className="text-center py-10 text-slate-400 text-sm">Belum ada rules.</div>}
        </div>
      )}
    </div>
  );
}

function UnknownPromptsTab() {
  const [prompts, setPrompts] = useState<UnknownPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending'|'resolved'|'ignored'>('pending');
  const [activeId, setActiveId] = useState<string|null>(null);
  const [feedback, setFeedback] = useState<{type:'success'|'error';msg:string}|null>(null);
  const [forms, setForms] = useState<Record<string,{mode:'single'|'ambiguous';a1:AIActionType;l1:string;a2:AIActionType;l2:string;notes:string}>>({});
  const load = async () => { setIsLoading(true); setPrompts(await fetchUnknownPrompts(getAdminHeaders(myAdminId()), statusFilter)); setIsLoading(false); };
  useEffect(() => { load(); }, [statusFilter]);
  const initForm = (id:string) => { if(!forms[id]) setForms(p=>({...p,[id]:{mode:'single',a1:'ADD_EXPENSE',l1:'',a2:'ADD_INCOME',l2:'',notes:''}})); setActiveId(id); };
  const upd = (id:string, p:any) => setForms(prev=>({...prev,[id]:{...prev[id],...p}}));
  const submit = async (prompt:UnknownPrompt, status:'resolved'|'ignored') => {
    const f=forms[prompt.id];
    const actions = status==='ignored' ? [] : f?.mode==='ambiguous'
      ? [{action:f.a1,label:f.l1||ACTION_OPTIONS.find(a=>a.value===f.a1)?.label||f.a1},{action:f.a2,label:f.l2||ACTION_OPTIONS.find(a=>a.value===f.a2)?.label||f.a2}]
      : [{action:f?.a1||'ADD_EXPENSE' as AIActionType,label:f?.l1||ACTION_OPTIONS.find(a=>a.value===f?.a1)?.label||''}];
    const ok = await resolveUnknownPrompt(prompt.id, status, actions, f?.notes||'', getAdminHeaders(myAdminId()));
    if(ok){setFeedback({type:'success',msg:status==='resolved'?`"${prompt.raw_input}" diselesaikan & trigger ditambahkan ke knowledge base.`:'Prompt diabaikan.'});setActiveId(null);load();}
    else setFeedback({type:'error',msg:'Gagal menyimpan.'});
    setTimeout(()=>setFeedback(null),4000);
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {(['pending','resolved','ignored'] as const).map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${statusFilter===s?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
            {s==='pending'?'⏳ Belum Ditinjau':s==='resolved'?'✓ Ditangani':'✗ Diabaikan'}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><RefreshCw size={13}/></button>
      </div>
      {feedback && <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-bold border ${feedback.type==='success'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-red-50 text-red-700 border-red-200'}`}>{feedback.type==='success'?<CheckCircle2 size={15}/>:<AlertCircle size={15}/>} {feedback.msg}</div>}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
        <p>Prompt yang tidak dikenali AI lokal otomatis masuk ke sini. Tangani untuk mengajarkan AI — trigger akan langsung ditambahkan ke knowledge base.</p>
      </div>
      {isLoading ? <div className="flex justify-center py-10 text-slate-400"><RefreshCw className="animate-spin mr-2" size={15}/> Memuat...</div>
      : prompts.length===0 ? <div className="text-center py-12 text-slate-400"><MessageSquare size={32} className="mx-auto mb-3 opacity-30"/><p className="font-bold text-sm">Tidak ada prompt {statusFilter}.</p></div>
      : <div className="space-y-3">
          {prompts.map(p=>{
            const f=forms[p.id]; const isExp=activeId===p.id;
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900">"{p.raw_input}"</span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{p.count}× diketik</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(p.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</p>
                    {p.status==='resolved' && p.resolved_actions?.length>0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {p.resolved_actions.map((ra,i)=><span key={i} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ACTION_OPTIONS.find(a=>a.value===ra.action)?.color||'bg-slate-100 text-slate-500'}`}>{ra.label||ra.action}</span>)}
                      </div>
                    )}
                  </div>
                  {p.status==='pending' && <div className="flex gap-2 shrink-0">
                    <button onClick={()=>{initForm(p.id); if(isExp) setActiveId(null);}} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:bg-blue-700 flex items-center gap-1"><Edit2 size={10}/> Tangani</button>
                    <button onClick={()=>submit(p,'ignored')} className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold hover:bg-slate-50 flex items-center gap-1"><XCircle size={10}/> Abaikan</button>
                  </div>}
                </div>
                {isExp && f && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Apakah prompt ini bisa punya 2 makna?</p>
                      <div className="flex gap-2">
                        {([['single','1 Arti — Langsung eksekusi'],['ambiguous','2 Arti — Tanya user dulu']] as const).map(([m,l])=>(
                          <button key={m} onClick={()=>upd(p.id,{mode:m})} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${f.mode===m?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">{f.mode==='ambiguous'?'Kemungkinan 1 — Aksi':'Aksi yang benar'}</label>
                        <select value={f.a1} onChange={e=>upd(p.id,{a1:e.target.value as AIActionType})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white">
                          {ACTION_OPTIONS.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}</select>
                      </div>
                      {f.mode==='ambiguous' && <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Label untuk user</label>
                        <input value={f.l1} onChange={e=>upd(p.id,{l1:e.target.value})} placeholder="mis: Pengeluaran" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white"/></div>}
                    </div>
                    {f.mode==='ambiguous' && <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Kemungkinan 2 — Aksi</label>
                          <select value={f.a2} onChange={e=>upd(p.id,{a2:e.target.value as AIActionType})} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white">
                            {ACTION_OPTIONS.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}</select>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Label untuk user</label>
                          <input value={f.l2} onChange={e=>upd(p.id,{l2:e.target.value})} placeholder="mis: Pemasukan" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white"/></div>
                      </div>
                      <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-[9px] text-blue-700">
                        💡 Saat user ketik prompt ini lagi, popup akan tunjukkan: <strong>"{f.l1||'Opsi A'}"</strong> vs <strong>"{f.l2||'Opsi B'}"</strong>
                      </div>
                    </>}
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Catatan Admin</label>
                      <input value={f.notes} onChange={e=>upd(p.id,{notes:e.target.value})} placeholder="Opsional..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400 bg-white"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setActiveId(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100">Batal</button>
                      <button onClick={()=>submit(p,'resolved')} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1.5">
                        <CheckCheck size={12}/> Simpan & Tambah ke Knowledge Base
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>}
    </div>
  );
}

export default function AIKnowledge() {
  const [tab, setTab] = useState<'rules'|'unknown'>('rules');
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2"><Bot className="text-blue-600" size={22}/> AI Knowledge Base</h1>
        <p className="text-xs text-slate-400 mt-0.5">Engine Semi AI lokal — tanpa API key. Semakin diisi, semakin pintar.</p>
      </div>
      <div className="flex gap-0 border-b border-slate-200">
        {([['rules','📚 Knowledge Base'],['unknown','🔍 Prompt Belum Dikenal']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all ${tab===id?'border-blue-600 text-blue-600':'border-transparent text-slate-400 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>
      {tab==='rules' ? <KnowledgeTab/> : <UnknownPromptsTab/>}
    </div>
  );
}
