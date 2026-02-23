import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Promo } from '../../types';
import {
  Megaphone, Plus, Edit3, Loader2, Check, X as XIcon, AlertCircle, Tag, Clock,
  Users, Send, RefreshCw, ToggleLeft, ToggleRight, Percent, DollarSign,
  ImageIcon, Zap
} from 'lucide-react';
import { formatCurrency } from '../../services/financeUtils';

export default function SalesPromos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [idleUsers, setIdleUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'promos' | 'idle'>('promos');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // Promo Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDiscountPct, setFormDiscountPct] = useState(0);
  const [formDiscountNom, setFormDiscountNom] = useState(0);
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formQuota, setFormQuota] = useState(100);
  const [formDescription, setFormDescription] = useState('');
  const [formTargetUserId, setFormTargetUserId] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');

  const [reactivateLoading, setReactivateLoading] = useState<string | null>(null);

  // Blast Promo to Idle Users Modal
  const [showBlastModal, setShowBlastModal] = useState(false);
  const [blastPromoId, setBlastPromoId] = useState('');
  const [blastCustomMessage, setBlastCustomMessage] = useState('');
  const [blastLoading, setBlastLoading] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [promoRes, idleRes] = await Promise.allSettled([
          api.get('/sales/promos'),
          api.get('/sales/idle-users'),
        ]);
        if (promoRes.status === 'fulfilled') setPromos(promoRes.value.promos || promoRes.value || []);
        if (idleRes.status === 'fulfilled') setIdleUsers(idleRes.value.users || idleRes.value || []);
      } catch (e) { console.warn('[SalesPromos] Load error', e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const openCreatePromo = () => {
    setEditing(null);
    setFormCode(''); setFormDiscountPct(0); setFormDiscountNom(0); setFormValidUntil('');
    setFormQuota(100); setFormDescription(''); setFormTargetUserId(''); setFormImageUrl('');
    setModalError(''); setShowModal(true);
  };

  const openEditPromo = (p: Promo) => {
    setEditing(p);
    setFormCode(p.code); setFormDiscountPct(p.discount_percentage); setFormDiscountNom(p.discount_nominal);
    setFormValidUntil(p.valid_until?.split('T')[0] || ''); setFormQuota(p.quota);
    setFormDescription(p.description || ''); setFormTargetUserId(p.target_user_id || '');
    setFormImageUrl(p.image_url || '');
    setModalError(''); setShowModal(true);
  };

  const handleSavePromo = useCallback(async () => {
    if (!formCode.trim()) { setModalError('Kode promo wajib diisi.'); return; }
    setSaving(true); setModalError('');
    const payload = {
      code: formCode.trim().toUpperCase(),
      discount_percentage: Number(formDiscountPct),
      discount_nominal: Number(formDiscountNom),
      valid_until: formValidUntil,
      quota: Number(formQuota),
      description: formDescription.trim(),
      target_user_id: formTargetUserId.trim() || undefined,
      image_url: formImageUrl.trim() || undefined,
    };
    try {
      if (editing) { await api.put(`/sales/promos/${editing.id}`, payload); }
      else { await api.post('/sales/promos', payload); }
      const data = await api.get('/sales/promos');
      setPromos(data.promos || data || []);
      setShowModal(false);
      showToast('Promo berhasil disimpan.', 'success');
    } catch (e: any) { setModalError(e.message || 'Gagal menyimpan promo.'); }
    finally { setSaving(false); }
  }, [editing, formCode, formDiscountPct, formDiscountNom, formValidUntil, formQuota, formDescription, formTargetUserId, formImageUrl]);

  const handleReactivate = useCallback(async (userId: string) => {
    setReactivateLoading(userId);
    try {
      await api.post(`/sales/users/${userId}/reactivate`, {});
      showToast('Email reactivation berhasil dikirim.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Gagal mengirim reactivation.', 'error');
    } finally {
      setReactivateLoading(null);
    }
  }, []);

  // Blast promo to all idle users
  const openBlastPromo = (promoId: string) => {
    setBlastPromoId(promoId);
    setBlastCustomMessage('');
    setShowBlastModal(true);
  };

  const handleBlastPromo = useCallback(async () => {
    if (!blastPromoId) return;
    setBlastLoading(true);
    try {
      const res = await api.post('/sales/reactivate', {
        promoId: blastPromoId,
        customMessage: blastCustomMessage.trim() || undefined,
      });
      showToast(res.message || 'Promo berhasil dikirim ke user idle via In-App Notif & Email.', 'success');
      setShowBlastModal(false);
    } catch (e: any) {
      showToast(e.message || 'Gagal mengirim blast promo.', 'error');
    } finally {
      setBlastLoading(false);
    }
  }, [blastPromoId, blastCustomMessage]);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Promo & Idle User</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Kelola kode promo dan reaktivasi user yang idle.</p>
        </div>
        {tab === 'promos' && (
          <button onClick={openCreatePromo} className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-200/50 active:scale-95 transform">
            <Plus size={16} /> Promo Baru
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('promos')} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${tab === 'promos' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border-2 border-slate-100 text-slate-500'}`}>
          <Tag size={14} className="inline mr-2" />Kode Promo ({promos.length})
        </button>
        <button onClick={() => setTab('idle')} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${tab === 'idle' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border-2 border-slate-100 text-slate-500'}`}>
          <Users size={14} className="inline mr-2" />Idle Users ({idleUsers.length})
        </button>
      </div>

      {/* PROMOS TAB */}
      {tab === 'promos' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promos.map(p => (
            <div key={p.id} className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
              {p.image_url && (
                <div className="h-32 bg-slate-100 overflow-hidden">
                  <img src={p.image_url} alt={p.code} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-emerald-50 px-3 py-1.5 rounded-lg">
                  <span className="font-black text-emerald-700 text-sm tracking-wider">{p.code}</span>
                </div>
                <button onClick={() => openEditPromo(p)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg transition"><Edit3 size={14} /></button>
              </div>
              {p.description && <p className="text-xs text-slate-500 mb-3">{p.description}</p>}
              <div className="space-y-1.5">
                {p.discount_percentage > 0 && (
                  <div className="flex items-center gap-2 text-xs"><Percent size={12} className="text-amber-500" /><span className="font-bold text-slate-700">Diskon {p.discount_percentage}%</span></div>
                )}
                {p.discount_nominal > 0 && (
                  <div className="flex items-center gap-2 text-xs"><DollarSign size={12} className="text-green-500" /><span className="font-bold text-slate-700">Potongan {formatCurrency(p.discount_nominal)}</span></div>
                )}
                <div className="flex items-center gap-2 text-xs"><Clock size={12} className="text-slate-400" /><span className="text-slate-500">s/d {p.valid_until ? new Date(p.valid_until).toLocaleDateString('id-ID') : '-'}</span></div>
                <div className="flex items-center gap-2 text-xs"><Tag size={12} className="text-slate-400" /><span className="text-slate-500">Kuota: {p.quota}</span></div>
              </div>
              {/* Blast to Idle Users button */}
              <button
                onClick={() => openBlastPromo(p.id)}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 transition active:scale-[0.98]"
              >
                <Zap size={14} /> Blast ke User Idle
              </button>
              </div>
            </div>
          ))}
          {promos.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400">
              <Megaphone size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-bold text-sm">Belum ada promo.</p>
            </div>
          )}
        </div>
      )}

      {/* IDLE USERS TAB */}
      {tab === 'idle' && (
        <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
          {idleUsers.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {idleUsers.map((u: any) => (
                <div key={u.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{u.username || u.email}</p>
                    <p className="text-[10px] text-slate-400">Last login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('id-ID') : 'Never'}</p>
                  </div>
                  <button
                    onClick={() => handleReactivate(u.id)}
                    disabled={reactivateLoading === u.id}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition disabled:opacity-50"
                  >
                    {reactivateLoading === u.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Reactivate
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400">
              <Users size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-bold text-sm">Tidak ada idle user ditemukan.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ PROMO MODAL ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">{editing ? 'Edit' : 'Buat'} Promo</p>
                <h3 className="text-lg font-black">{editing ? editing.code : 'Promo Baru'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"><XIcon size={20} /></button>
            </div>
            <div className="p-8 space-y-4 overflow-y-auto flex-1">
              {modalError && <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold"><AlertCircle size={14} />{modalError}</div>}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Kode Promo</label>
                <input value={formCode} onChange={e => setFormCode(e.target.value.toUpperCase())} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-black tracking-wider" placeholder="NEWYEAR50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Diskon %</label>
                  <input type="number" value={formDiscountPct} onChange={e => setFormDiscountPct(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Diskon Nominal</label>
                  <input type="number" value={formDiscountNom} onChange={e => setFormDiscountNom(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Valid Until</label>
                  <input type="date" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Kuota</label>
                  <input type="number" value={formQuota} onChange={e => setFormQuota(Number(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Target User ID (opsional)</label>
                <input value={formTargetUserId} onChange={e => setFormTargetUserId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold font-mono" placeholder="Kosongkan = semua user" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Image URL (opsional)</label>
                <input value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold font-mono" placeholder="https://example.com/promo-banner.jpg" />
                {formImageUrl && (
                  <div className="mt-2 h-24 rounded-xl overflow-hidden border border-slate-200">
                    <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Deskripsi</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-medium resize-none" />
              </div>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500">Batal</button>
              <button onClick={handleSavePromo} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95 transform">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BLAST PROMO MODAL ═══ */}
      {showBlastModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-white flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-200 uppercase tracking-widest mb-1">Blast Promo</p>
                <h3 className="text-lg font-black tracking-tight">Kirim ke User Idle</h3>
              </div>
              <button onClick={() => setShowBlastModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"><XIcon size={20} /></button>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Promo ID</label>
                <input value={blastPromoId} disabled className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-mono text-slate-500" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Custom Message (opsional)</label>
                <textarea
                  value={blastCustomMessage}
                  onChange={e => setBlastCustomMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-sm font-medium resize-none"
                  placeholder="Pesan custom untuk user idle... (Kosongkan = pesan default)"
                />
              </div>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Aksi ini akan mengirimkan In-App Notification dan Email ke semua user idle yang terdeteksi oleh sistem. Pastikan promo masih valid.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowBlastModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Batal</button>
                <button
                  onClick={handleBlastPromo}
                  disabled={blastLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-700 transition disabled:opacity-50 shadow-lg shadow-amber-200/50 active:scale-95 transform"
                >
                  {blastLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  Kirim Blast
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-[120] animate-fade-in-up px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          <Check size={18} />{toast.message}
        </div>
      )}
    </div>
  );
}
