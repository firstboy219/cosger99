import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { PaymentMethod } from '../../types';
import {
  CreditCard, Plus, Edit3, Loader2, Check, X as XIcon, ToggleLeft, ToggleRight, AlertCircle, Trash2
} from 'lucide-react';

export default function SalesPaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formAccountName, setFormAccountName] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const loadMethods = useCallback(async () => {
    try {
      const data = await api.get('/sales/payment-methods');
      const list = Array.isArray(data) ? data : (data.paymentMethods || data.payment_methods || []);
      setMethods(list);
    } catch (e) { console.warn('[SalesPaymentMethods] Load error', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMethods(); }, [loadMethods]);

  const openCreate = () => {
    setEditing(null);
    setFormBankName(''); setFormAccountNumber(''); setFormAccountName(''); setFormLogoUrl(''); setFormIsActive(true);
    setModalError(''); setShowModal(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    // Handle both camelCase and snake_case from backend
    setFormBankName((m as any).bankName || m.bank_name || '');
    setFormAccountNumber((m as any).accountNumber || m.account_number || '');
    setFormAccountName((m as any).accountName || m.account_name || '');
    setFormLogoUrl((m as any).logoUrl || m.logo_url || '');
    setFormIsActive((m as any).isActive ?? m.is_active ?? true);
    setModalError(''); setShowModal(true);
  };

  const handleSave = useCallback(async () => {
    if (!formBankName.trim() || !formAccountNumber.trim()) { setModalError('Nama bank dan nomor rekening wajib diisi.'); return; }
    setSaving(true); setModalError('');
    // V50.36: Use camelCase keys & explicitly send boolean true for isActive
    const payload = {
      bankName: formBankName.trim(),
      accountNumber: formAccountNumber.trim(),
      accountName: formAccountName.trim(),
      logoUrl: formLogoUrl.trim(),
      isActive: Boolean(formIsActive),
    };
    try {
      // V50.36: Always use POST for UPSERT. Include id when editing.
      const upsertPayload = editing ? { id: editing.id, ...payload } : payload;
      await api.post('/sales/payment-methods', upsertPayload);
      await loadMethods();
      setShowModal(false);
    } catch (e: any) { setModalError(e.message || 'Gagal menyimpan.'); }
    finally { setSaving(false); }
  }, [editing, formBankName, formAccountNumber, formAccountName, formLogoUrl, formIsActive]);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Metode Pembayaran</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Kelola rekening tujuan transfer.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-200/50 active:scale-95 transform">
          <Plus size={16} /> Tambah
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {methods.map(m => {
          // Normalize camelCase/snake_case from backend
          const bankName = (m as any).bankName || m.bank_name || '';
          const accountNumber = (m as any).accountNumber || m.account_number || '';
          const accountName = (m as any).accountName || m.account_name || '';
          const logoUrl = (m as any).logoUrl || m.logo_url || '';
          const isActive = (m as any).isActive ?? m.is_active ?? false;

          return (
          <div key={m.id} className={`bg-white border-2 rounded-2xl p-6 transition-all hover:shadow-lg ${isActive ? 'border-slate-100' : 'border-slate-100 opacity-50'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {logoUrl ? <img src={logoUrl} alt="" className="w-10 h-10 object-contain rounded-lg bg-slate-50 p-1" /> :
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><CreditCard size={20} className="text-emerald-600" /></div>}
                <div>
                  <h3 className="font-black text-slate-900 text-sm">{bankName}</h3>
                  <p className="text-xs text-slate-500">{accountName}</p>
                </div>
              </div>
              <button onClick={() => openEdit(m)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Edit3 size={14} /></button>
            </div>
            <p className="font-mono text-sm font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{accountNumber}</p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {isActive ? <span className="text-green-600 font-bold flex items-center gap-1"><Check size={12} /> Aktif</span> :
                <span className="text-slate-400 font-bold">Nonaktif</span>}
            </div>
          </div>
          );
        })}
        {methods.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">
            <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-sm">Belum ada metode pembayaran.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">{editing ? 'Edit' : 'Tambah'} Metode</p>
                <h3 className="text-lg font-black">{editing ? ((editing as any).bankName || editing.bank_name || 'Edit') : 'Rekening Baru'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"><XIcon size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
              {modalError && <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold"><AlertCircle size={14} />{modalError}</div>}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nama Bank</label>
                <input value={formBankName} onChange={e => setFormBankName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold" placeholder="BCA, Mandiri, dll..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">No. Rekening</label>
                <input value={formAccountNumber} onChange={e => setFormAccountNumber(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Atas Nama</label>
                <input value={formAccountName} onChange={e => setFormAccountName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Logo URL (opsional)</label>
                <input value={formLogoUrl} onChange={e => setFormLogoUrl(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold font-mono" placeholder="https://..." />
              </div>
              <button type="button" onClick={() => setFormIsActive(!formIsActive)} className="flex items-center gap-2 text-sm font-bold">
                {formIsActive ? <ToggleRight size={28} className="text-emerald-500" /> : <ToggleLeft size={28} className="text-slate-300" />}
                <span className={formIsActive ? 'text-emerald-700' : 'text-slate-400'}>Aktif</span>
              </button>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500">Batal</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95 transform">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
