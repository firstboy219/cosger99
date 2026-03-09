import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Save, RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2,
  ChevronDown, ChevronUp, Eye, EyeOff, Copy, RotateCcw, Info,
  BookOpen, Hash, ToggleLeft, ToggleRight, Search, Filter,
  Sparkles, Code2, ArrowUpDown, GripVertical, Check, X,
} from 'lucide-react';
import { getAdminHeaders } from '../../services/cloudSync';
import {
  NarrativeTemplate,
  DEFAULT_NARRATIVE_TEMPLATES,
  fetchNarrativeTemplates,
  saveNarrativeTemplates,
} from '../../services/narrativeService';

const myAdminId = () => localStorage.getItem('paydone_active_user') || 'admin';

// ─── AVAILABLE VARIABLES ────────────────────────────────────────────────────

const AVAILABLE_VARS: { key: string; label: string; example: string }[] = [
  { key: 'monthName',              label: 'Nama bulan',            example: 'Maret' },
  { key: 'year',                   label: 'Tahun',                 example: '2026' },
  { key: 'inc',                    label: 'Pendapatan',            example: 'Rp 14,1 juta' },
  { key: 'livingCost',             label: 'Biaya hidup',           example: 'Rp 6,6 juta' },
  { key: 'monthlyDebtObligation',  label: 'Total cicilan',         example: 'Rp 7,5 juta' },
  { key: 'totalExpense',           label: 'Total pengeluaran',     example: 'Rp 14,1 juta' },
  { key: 'surplus',                label: 'Surplus cashflow',      example: 'Rp 71 ribu' },
  { key: 'deficit',                label: 'Defisit cashflow',      example: 'Rp 500 ribu' },
  { key: 'surplusPct',             label: 'Surplus % dari income', example: '5' },
  { key: 'dsr',                    label: 'DSR (%)',               example: '52.9' },
  { key: 'dsrInt',                 label: 'DSR bulat (%)',         example: '53' },
  { key: 'runway',                 label: 'Dana darurat (bulan)',  example: '0.0' },
  { key: 'healthScore',            label: 'Skor kesehatan',        example: '24' },
  { key: 'totalDebt',              label: 'Total sisa hutang',     example: 'Rp 450 juta' },
  { key: 'sfGoal',                 label: 'Target sinking fund',   example: 'Rp 228 juta' },
  { key: 'sfCurrent',              label: 'Saldo sinking fund',    example: 'Rp 150 ribu' },
  { key: 'sfPct',                  label: 'Sinking fund (%)',      example: '0' },
  { key: 'nDebt',                  label: 'Jumlah hutang aktif',   example: '2' },
  { key: 'nearestName',            label: 'Nama hutang terdekat',  example: 'KIA SPORTAGE' },
  { key: 'monthsToNearest',        label: 'Bulan hutang terdekat', example: '47' },
  { key: 'nearestYrs',             label: 'Tahun hutang terdekat', example: '3.9' },
  { key: 'lcRatio',                label: 'Living cost ratio (%)', example: '47' },
  { key: 'trendDelta',             label: 'Tren pengeluaran (%)',  example: '12' },
  { key: 'targetLiving',           label: 'Target living cost',    example: 'Rp 5,0 juta' },
  { key: 'monthlyTarget',          label: 'Target nabung/bln',     example: 'Rp 2,1 juta' },
  { key: 'target3months',          label: 'Target 3bln darurat',   example: 'Rp 42 juta' },
  { key: 'targetRunway',           label: 'Target bulan darurat',  example: '4' },
  // Conditional snippets
  { key: 'sfNote',           label: 'Snippet: sinking fund note',    example: '(teks otomatis)' },
  { key: 'cashflowNote',     label: 'Snippet: cashflow note',        example: '(teks otomatis)' },
  { key: 'runwayNote',       label: 'Snippet: runway note',          example: '(teks otomatis)' },
  { key: 'debtFreeNote',     label: 'Snippet: bebas hutang',         example: '(teks otomatis)' },
  { key: 'nDebtNote',        label: 'Snippet: jumlah hutang',        example: '(teks otomatis)' },
  { key: 'nearestDebtNote',  label: 'Snippet: hutang terdekat',      example: '(teks otomatis)' },
  { key: 'nearestLunas',     label: 'Snippet: hutang hampir lunas',  example: '(teks otomatis)' },
  { key: 'assetNote',        label: 'Snippet: saran lepas aset',     example: '(teks otomatis)' },
  { key: 'nearestFocus',     label: 'Snippet: fokus pelunasan',      example: '(teks otomatis)' },
  { key: 'emergencyFund',    label: 'Snippet: dana darurat mini',    example: '(teks otomatis)' },
  { key: 'surplusAllocation',label: 'Snippet: alokasi surplus',      example: '(teks otomatis)' },
  { key: 'nearestLunasNote', label: 'Snippet: hampir lunas note',    example: '(teks otomatis)' },
  { key: 'sfAfterNote',      label: 'Snippet: sf setelah darurat',   example: '(teks otomatis)' },
  { key: 'investNote',       label: 'Snippet: saran investasi',      example: '(teks otomatis)' },
  { key: 'sfPrima',          label: 'Snippet: sf kondisi prima',     example: '(teks otomatis)' },
  { key: 'surplusNote',      label: 'Snippet: surplus note',         example: '(teks otomatis)' },
  { key: 'trendWarning',     label: 'Snippet: tren naik warning',    example: '(teks otomatis)' },
  { key: 'sfLow',            label: 'Snippet: sf rendah note',       example: '(teks otomatis)' },
  { key: 'cashflowSummary',  label: 'Snippet: cashflow summary',     example: '(teks otomatis)' },
  { key: 'debtNote',         label: 'Snippet: debt note',            example: '(teks otomatis)' },
  // [V50.78 FIX] Removed duplicate 'investNote' entry that caused double-entry in variable picker
];

const PARAGRAPH_COLORS: Record<number, { bg: string; text: string; border: string; dot: string }> = {
  1: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  2: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  3: { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500'},
};

const PARAGRAPH_LABELS: Record<number, string> = {
  1: 'Paragraf 1 — Snapshot Kondisi',
  2: 'Paragraf 2 — Diagnosis Masalah',
  3: 'Paragraf 3 — Rekomendasi Aksi',
};

// ─── HIGHLIGHT VARIABLES IN TEMPLATE PREVIEW ────────────────────────────────

function TemplatePreview({ template }: { template: string }) {
  const parts = template.split(/(\{\{[^}]+\}\})/g);
  return (
    <span className="font-mono text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith('{{') ? (
          <span key={i} className="bg-amber-100 text-amber-700 px-1 rounded font-bold">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── VARIABLE PICKER ─────────────────────────────────────────────────────────

function VarPicker({ onInsert }: { onInsert: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = AVAILABLE_VARS.filter(v =>
    v.key.toLowerCase().includes(q.toLowerCase()) ||
    v.label.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
      >
        <Code2 size={11}/> Sisipkan Variabel
      </button>
      {open && (
        <div className="absolute top-8 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl w-72 p-2 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-xl mb-2">
            <Search size={11} className="text-slate-400"/>
            <input
              autoFocus
              className="flex-1 text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
              placeholder="Cari variabel..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          {filtered.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); setQ(''); }}
              className="w-full flex items-start gap-2 px-2.5 py-2 rounded-xl hover:bg-violet-50 text-left transition-colors"
            >
              <code className="text-[10px] font-black text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded mt-0.5 shrink-0">{`{{${v.key}}}`}</code>
              <div>
                <p className="text-[11px] font-bold text-slate-700">{v.label}</p>
                <p className="text-[9px] text-slate-400">contoh: {v.example}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-4">Tidak ditemukan</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SINGLE TEMPLATE CARD ────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUpdate,
  onDelete,
  isExpanded,
  onToggleExpand,
  isDefault,
}: {
  template: NarrativeTemplate;
  onUpdate: (t: NarrativeTemplate) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  isDefault: boolean;
}) {
  const c = PARAGRAPH_COLORS[template.paragraph] || PARAGRAPH_COLORS[1];
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const insertVar = (v: string) => {
    const ta = textAreaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = template.template.slice(0, start) + v + template.template.slice(end);
    onUpdate({ ...template, template: next });
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + v.length;
    }, 0);
  };

  return (
    <div className={`bg-white border ${template.isActive ? c.border : 'border-slate-100'} rounded-2xl overflow-hidden transition-all ${!template.isActive ? 'opacity-50' : ''}`}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => onToggleExpand(template.id)}
      >
        {/* Active toggle */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onUpdate({ ...template, isActive: !template.isActive }); }}
          className="shrink-0"
        >
          {template.isActive
            ? <ToggleRight size={18} className="text-emerald-500"/>
            : <ToggleLeft size={18} className="text-slate-300"/>}
        </button>

        {/* Para badge */}
        <span className={`shrink-0 w-5 h-5 rounded-full ${c.dot} flex items-center justify-center text-white text-[9px] font-black`}>
          {template.paragraph}
        </span>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 truncate">{template.scenarioKey}</p>
          <p className="text-[9px] text-slate-400 truncate">{template.conditionLabel}</p>
        </div>

        {/* Default badge */}
        {isDefault && (
          <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full">DEFAULT</span>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {!isDefault && (
            <button
              type="button"
              onClick={() => { if (confirm('Hapus template ini?')) onDelete(template.id); }}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={11}/>
            </button>
          )}
          {isExpanded ? <ChevronUp size={13} className="text-slate-400"/> : <ChevronDown size={13} className="text-slate-400"/>}
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {/* Scenario name */}
          <div className="pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Nama Skenario</label>
              <input
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={template.scenarioKey}
                onChange={e => onUpdate({ ...template, scenarioKey: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Paragraf</label>
              <select
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={template.paragraph}
                onChange={e => onUpdate({ ...template, paragraph: Number(e.target.value) as 1|2|3 })}
              >
                <option value={1}>Paragraf 1 — Snapshot</option>
                <option value={2}>Paragraf 2 — Diagnosis</option>
                <option value={3}>Paragraf 3 — Rekomendasi</option>
              </select>
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Label Kondisi (ditampilkan di admin)</label>
            <input
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
              value={template.conditionLabel}
              onChange={e => onUpdate({ ...template, conditionLabel: e.target.value })}
            />
          </div>

          {/* Condition detail */}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Penjelasan Kondisi (opsional)</label>
            <input
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
              value={template.conditionDetail}
              onChange={e => onUpdate({ ...template, conditionDetail: e.target.value })}
            />
          </div>

          {/* Template text editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Teks Template</label>
              <VarPicker onInsert={insertVar}/>
            </div>
            <textarea
              ref={textAreaRef}
              rows={6}
              className="w-full px-3 py-2.5 text-[11px] font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 resize-y leading-relaxed text-slate-700"
              value={template.template}
              onChange={e => onUpdate({ ...template, template: e.target.value })}
              spellCheck={false}
            />
            <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
              <Info size={9}/> Gunakan <code className="bg-amber-100 text-amber-700 px-1 rounded">{'{{namaVariabel}}'}</code> untuk data dinamis. Klik "Sisipkan Variabel" untuk daftar lengkap.
            </p>
          </div>

          {/* Preview */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Eye size={9}/> Preview Template
            </p>
            <div className={`p-3 rounded-xl ${c.bg} border ${c.border}`}>
              <TemplatePreview template={template.template}/>
            </div>
          </div>

          {/* Sort order */}
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Urutan</label>
            <input
              type="number"
              className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-xl"
              value={template.sortOrder}
              onChange={e => onUpdate({ ...template, sortOrder: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function NarrativeAdmin() {
  const [templates, setTemplates]       = useState<NarrativeTemplate[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [isSaving, setIsSaving]         = useState(false);
  const [feedback, setFeedback]         = useState<{ type: 'success'|'error'; msg: string } | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [filterPara, setFilterPara]     = useState<0|1|2|3>(0); // 0 = all
  const [searchQ, setSearchQ]           = useState('');
  const [showVarRef, setShowVarRef]     = useState(false);
  const defaultIds = new Set(DEFAULT_NARRATIVE_TEMPLATES.map(t => t.id));

  // ── Load from cloud on mount ──────────────────────────────────
  useEffect(() => {
    fetchNarrativeTemplates().then(t => {
      setTemplates(t.sort((a, b) => a.sortOrder - b.sortOrder));
      setIsLoading(false);
    });
  }, []);

  // ── Save to cloud ─────────────────────────────────────────────
  const save = async () => {
    setIsSaving(true);
    const ok = await saveNarrativeTemplates(templates, getAdminHeaders(myAdminId()));
    setFeedback(ok
      ? { type: 'success', msg: `${templates.length} template berhasil disimpan ke cloud.` }
      : { type: 'error', msg: 'Gagal menyimpan. Cek koneksi atau admin secret.' }
    );
    setIsSaving(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── Reset to defaults ─────────────────────────────────────────
  const resetDefaults = () => {
    if (!confirm('Reset semua template ke default? Perubahan yang belum disimpan akan hilang.')) return;
    setTemplates(DEFAULT_NARRATIVE_TEMPLATES.map(t => ({ ...t })));
    setFeedback({ type: 'success', msg: 'Reset ke default berhasil. Klik Simpan untuk menyimpan ke cloud.' });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── Add new template ──────────────────────────────────────────
  const addTemplate = () => {
    const t: NarrativeTemplate = {
      id: `custom_${Date.now()}`,
      paragraph: 1,
      scenarioKey: 'Template Baru',
      conditionLabel: '',
      conditionDetail: '',
      template: 'Tulis template naratif di sini. Gunakan {{variable}} untuk data dinamis.',
      isActive: true,
      sortOrder: templates.length + 1,
    };
    setTemplates(prev => [...prev, t]);
    setExpandedId(t.id);
  };

  // ── Update one template ───────────────────────────────────────
  const updateTemplate = (updated: NarrativeTemplate) =>
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));

  // ── Delete template ───────────────────────────────────────────
  const deleteTemplate = (id: string) =>
    setTemplates(prev => prev.filter(t => t.id !== id));

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = templates.filter(t => {
    if (filterPara !== 0 && t.paragraph !== filterPara) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return t.scenarioKey.toLowerCase().includes(q)
        || t.conditionLabel.toLowerCase().includes(q)
        || t.template.toLowerCase().includes(q);
    }
    return true;
  });

  // ── Group by paragraph ────────────────────────────────────────
  const grouped: Record<number, NarrativeTemplate[]> = { 1: [], 2: [], 3: [] };
  filtered.forEach(t => {
    (grouped[t.paragraph] = grouped[t.paragraph] || []).push(t);
  });

  const activeCounts = [1,2,3].map(p =>
    templates.filter(t => t.paragraph === p && t.isActive).length
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-xl">
              <FileText size={16}/>
            </div>
            <h1 className="text-xl font-black text-slate-800">Manajemen Narasi Keuangan</h1>
          </div>
          <p className="text-xs text-slate-500 ml-10">
            Edit teks template narasi yang ditampilkan di dashboard user. Template disimpan di cloud dan aktif real-time.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setIsLoading(true); fetchNarrativeTemplates().then(t => { setTemplates(t); setIsLoading(false); }); }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Reload dari cloud"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/>
          </button>
          <button onClick={resetDefaults} className="px-3 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5">
            <RotateCcw size={11}/> Reset Default
          </button>
          <button onClick={addTemplate} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5">
            <Plus size={12}/> Template Baru
          </button>
          <button
            onClick={save}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            {isSaving ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>}
            Simpan ke Cloud
          </button>
        </div>
      </div>

      {/* ── Feedback banner ────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}
          {feedback.msg}
        </div>
      )}

      {/* ── Stats bar ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(p => {
          const c = PARAGRAPH_COLORS[p];
          const total = templates.filter(t => t.paragraph === p).length;
          const active = templates.filter(t => t.paragraph === p && t.isActive).length;
          return (
            <button
              key={p}
              onClick={() => setFilterPara(filterPara === p ? 0 : p as 1|2|3)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                filterPara === p ? `${c.bg} ${c.border} shadow-sm` : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`}/>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Para {p}</p>
              </div>
              <p className="text-sm font-black text-slate-800">{PARAGRAPH_LABELS[p].split('—')[1]?.trim()}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{active}/{total} template aktif</p>
            </button>
          );
        })}
      </div>

      {/* ── How it works info ───────────────────────────────────── */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-800 space-y-1.5">
        <p className="font-black flex items-center gap-1.5"><BookOpen size={12}/> Cara Kerja:</p>
        <p>• Dashboard user membaca template dari cloud setiap kali halaman dibuka</p>
        <p>• Sistem otomatis memilih <strong>1 template per paragraf</strong> sesuai kondisi keuangan user (DSR, cashflow, hutang, dll.)</p>
        <p>• Teks <code className="bg-indigo-100 px-1 rounded">{'{{variabel}}'}</code> digantikan dengan data real user saat tampil di dashboard</p>
        <p>• Gunakan <strong>Sisipkan Variabel</strong> saat edit template untuk melihat daftar variabel yang tersedia</p>
        <p>• Template yang <strong>dinonaktifkan</strong> tidak akan pernah dipilih — sistem fallback ke template lain dalam paragraf yang sama</p>
      </div>

      {/* ── Search & filter ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
          <Search size={13} className="text-slate-400"/>
          <input
            className="flex-1 text-xs outline-none text-slate-700 placeholder:text-slate-400"
            placeholder="Cari template berdasarkan nama skenario, kondisi, atau teks..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="text-slate-400 hover:text-slate-600">
              <X size={11}/>
            </button>
          )}
        </div>
        <button
          onClick={() => setShowVarRef(v => !v)}
          className="px-3 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
        >
          <Hash size={11}/> Variabel
        </button>
        <button
          onClick={() => setExpandedId(null)}
          className="px-3 py-2 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50"
        >
          Tutup Semua
        </button>
      </div>

      {/* ── Variable reference panel ─────────────────────────────── */}
      {showVarRef && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-black text-slate-600 mb-3 flex items-center gap-1.5">
            <Hash size={12} className="text-violet-500"/> Referensi Variabel Lengkap
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {AVAILABLE_VARS.map(v => (
              <div key={v.key} className="flex flex-col gap-0.5 p-2 bg-slate-50 rounded-xl">
                <code className="text-[9px] font-black text-violet-600">{`{{${v.key}}}`}</code>
                <p className="text-[9px] text-slate-600 font-bold">{v.label}</p>
                <p className="text-[8px] text-slate-400 italic">{v.example}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading state ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <RefreshCw className="animate-spin mr-2" size={18}/> Memuat template dari cloud...
        </div>
      ) : (
        <div className="space-y-6">
          {[1, 2, 3].map(para => {
            const group = grouped[para] || [];
            if (group.length === 0 && filterPara !== 0) return null;
            const c = PARAGRAPH_COLORS[para];
            return (
              <div key={para}>
                {/* Group header */}
                <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl ${c.bg} border ${c.border} mb-3`}>
                  <div className={`w-5 h-5 rounded-full ${c.dot} flex items-center justify-center text-white text-[9px] font-black`}>{para}</div>
                  <p className={`text-xs font-black ${c.text}`}>{PARAGRAPH_LABELS[para]}</p>
                  <span className={`ml-auto text-[9px] font-bold ${c.text} opacity-70`}>
                    {group.filter(t => t.isActive).length}/{group.length} aktif
                  </span>
                </div>
                <div className="space-y-2">
                  {group.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                      Tidak ada template untuk paragraf ini
                    </div>
                  ) : (
                    group.map(t => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onUpdate={updateTemplate}
                        onDelete={deleteTemplate}
                        isExpanded={expandedId === t.id}
                        onToggleExpand={id => setExpandedId(expandedId === id ? null : id)}
                        isDefault={defaultIds.has(t.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom save bar ──────────────────────────────────────── */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={isSaving}
          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-xl shadow-emerald-900/20"
        >
          {isSaving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}
          Simpan {templates.length} Template ke Cloud
        </button>
      </div>
    </div>
  );
}
