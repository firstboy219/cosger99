import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { FreemiumPackage } from '../../types';
import { formatCurrency } from '../../services/financeUtils';
import {
  Package, Plus, Edit3, Loader2, Check, X as XIcon, Zap,
  ToggleLeft, ToggleRight, AlertCircle, Shield, Crown, Star, Trash2
} from 'lucide-react';

interface FeatureItem {
  key: string;
  label: string;
}

export default function SalesPackages() {
  const [packages, setPackages] = useState<FreemiumPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuresList, setFeaturesList] = useState<FeatureItem[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<FreemiumPackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form fields
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formAiLimit, setFormAiLimit] = useState(10);
  const [formDescription, setFormDescription] = useState('');
  const [formBadgeColor, setFormBadgeColor] = useState('#3b82f6');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefaultFree, setFormIsDefaultFree] = useState(false);
  const [formFeatures, setFormFeatures] = useState<Record<string, boolean>>({});

  // Load packages and feature master list
  useEffect(() => {
    const load = async () => {
      try {
        const [pkgRes, featRes] = await Promise.allSettled([
          api.get('/packages'),
          api.get('/features/list'),
        ]);

        if (pkgRes.status === 'fulfilled') {
          setPackages(pkgRes.value.packages || pkgRes.value || []);
        }
        if (featRes.status === 'fulfilled') {
          const raw = featRes.value.features || featRes.value || [];
          // Features can be array of strings or array of objects
          const mapped = raw.map((f: any) =>
            typeof f === 'string' ? { key: f, label: f } : { key: f.key || f.id, label: f.label || f.name || f.key || f.id }
          );
          setFeaturesList(mapped);
        }
      } catch (e) {
        console.warn('[SalesPackages] Load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openCreateModal = () => {
    setEditingPkg(null);
    setFormName('');
    setFormPrice(0);
    setFormAiLimit(10);
    setFormDescription('');
    setFormBadgeColor('#3b82f6');
    setFormIsActive(true);
    setFormIsDefaultFree(false);
    // Initialize all features as unchecked
    const defaultFeats: Record<string, boolean> = {};
    featuresList.forEach(f => { defaultFeats[f.key] = false; });
    setFormFeatures(defaultFeats);
    setModalError('');
    setShowModal(true);
  };

  const openEditModal = (pkg: FreemiumPackage) => {
    setEditingPkg(pkg);
    setFormName(pkg.name);
    setFormPrice(pkg.price);
    setFormAiLimit(pkg.ai_limit);
    setFormDescription(pkg.description || '');
    setFormBadgeColor(pkg.badge_color || '#3b82f6');
    setFormIsActive(pkg.is_active);
    setFormIsDefaultFree(pkg.is_default_free);
    // Merge existing features with master list
    const feats: Record<string, boolean> = {};
    featuresList.forEach(f => { feats[f.key] = pkg.features?.[f.key] === true; });
    setFormFeatures(feats);
    setModalError('');
    setShowModal(true);
  };

  const handleSave = useCallback(async () => {
    if (!formName.trim()) { setModalError('Nama paket wajib diisi.'); return; }
    setSaving(true);
    setModalError('');

    const payload = {
      name: formName.trim(),
      price: Number(formPrice),
      ai_limit: Number(formAiLimit),
      description: formDescription.trim(),
      badge_color: formBadgeColor,
      is_active: formIsActive,
      is_default_free: formIsDefaultFree,
      features: formFeatures,
    };

    try {
      // PENTING: Backend menggunakan teknik UPSERT.
      // Untuk Create dan Edit, SELALU gunakan POST /api/sales/packages.
      // Jika edit, sertakan id di dalam body payload.
      const upsertPayload = editingPkg ? { id: editingPkg.id, ...payload } : payload;
      await api.post('/sales/packages', upsertPayload);

      // Reload packages AND features list
      const [pkgRes, featRes] = await Promise.allSettled([
        api.get('/packages'),
        api.get('/features/list'),
      ]);
      if (pkgRes.status === 'fulfilled') {
        setPackages(pkgRes.value.packages || pkgRes.value || []);
      }
      if (featRes.status === 'fulfilled') {
        const raw = featRes.value.features || featRes.value || [];
        const mapped = raw.map((f: any) =>
          typeof f === 'string' ? { key: f, label: f } : { key: f.key || f.id, label: f.label || f.name || f.key || f.id }
        );
        setFeaturesList(mapped);
      }
      setShowModal(false);
    } catch (e: any) {
      setModalError(e.message || 'Gagal menyimpan paket.');
    } finally {
      setSaving(false);
    }
  }, [editingPkg, formName, formPrice, formAiLimit, formDescription, formBadgeColor, formIsActive, formIsDefaultFree, formFeatures]);

  const toggleFeature = (key: string) => {
    setFormFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manajemen Paket</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Kelola paket subscription dan fitur gating.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-200/50 active:scale-95 transform"
        >
          <Plus size={16} /> Paket Baru
        </button>
      </div>

      {/* Package Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map(pkg => {
          const enabledCount = Object.values(pkg.features || {}).filter(Boolean).length;
          const totalCount = Object.keys(pkg.features || {}).length;

          return (
            <div
              key={pkg.id}
              className={`relative rounded-2xl border-2 p-6 bg-white transition-all hover:shadow-lg ${
                !pkg.is_active ? 'opacity-50 border-slate-200' : pkg.is_default_free ? 'border-slate-200' : 'border-emerald-200'
              }`}
            >
              {pkg.is_default_free && (
                <div className="absolute -top-3 left-4 bg-slate-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Default Free
                </div>
              )}
              {!pkg.is_active && (
                <div className="absolute -top-3 right-4 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Nonaktif
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    pkg.is_default_free ? 'bg-slate-100' : 'bg-emerald-50'
                  }`}>
                    {pkg.is_default_free ? <Shield size={20} className="text-slate-400" /> : <Crown size={20} className="text-emerald-600" />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">{pkg.name}</h3>
                    <p className="text-xs text-slate-500">{pkg.description || '-'}</p>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(pkg)}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                >
                  <Edit3 size={16} />
                </button>
              </div>

              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-black text-slate-900">
                  {pkg.price === 0 ? 'Gratis' : formatCurrency(pkg.price)}
                </span>
                {pkg.price > 0 && <span className="text-xs text-slate-500 font-medium">/bulan</span>}
              </div>

              <div className="flex items-center gap-2 mb-4 text-xs">
                <Zap size={14} className="text-amber-500" />
                <span className="font-bold text-slate-600">
                  {pkg.ai_limit === -1 || pkg.ai_limit >= 99999 ? 'Unlimited AI' : `${pkg.ai_limit} AI hits/bulan`}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Check size={14} className="text-green-500" />
                <span className="font-medium">{enabledCount}/{totalCount} fitur aktif</span>
              </div>
            </div>
          );
        })}
      </div>

      {packages.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold text-sm">Belum ada paket. Klik "Paket Baru" untuk memulai.</p>
        </div>
      )}

      {/* ═══════════════════════ MODAL ═══════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">
                    {editingPkg ? 'Edit Paket' : 'Buat Paket Baru'}
                  </p>
                  <h3 className="text-xl font-black tracking-tight">{editingPkg ? editingPkg.name : 'Paket Baru'}</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition">
                  <XIcon size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              {modalError && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                  <AlertCircle size={18} />
                  <span className="text-xs font-bold">{modalError}</span>
                </div>
              )}

              {/* Row 1: Name + Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nama Paket</label>
                  <input
                    value={formName} onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold"
                    placeholder="Premium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Harga (IDR)</label>
                  <input
                    type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold"
                  />
                </div>
              </div>

              {/* Row 2: AI Limit + Badge Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">AI Limit / bulan</label>
                  <input
                    type="number" value={formAiLimit} onChange={e => setFormAiLimit(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold"
                    placeholder="-1 = unlimited"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 ml-1">-1 untuk unlimited</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Badge Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={formBadgeColor} onChange={e => setFormBadgeColor(e.target.value)} className="w-10 h-10 rounded-lg border-2 border-slate-100 cursor-pointer" />
                    <input value={formBadgeColor} onChange={e => setFormBadgeColor(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold font-mono" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Deskripsi</label>
                <textarea
                  value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-medium resize-none"
                  placeholder="Deskripsi singkat paket..."
                />
              </div>

              {/* Toggles: Active + Default Free */}
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  {formIsActive ? <ToggleRight size={28} className="text-emerald-500" /> : <ToggleLeft size={28} className="text-slate-300" />}
                  <span className={formIsActive ? 'text-emerald-700' : 'text-slate-400'}>Aktif</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsDefaultFree(!formIsDefaultFree)}
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  {formIsDefaultFree ? <ToggleRight size={28} className="text-blue-500" /> : <ToggleLeft size={28} className="text-slate-300" />}
                  <span className={formIsDefaultFree ? 'text-blue-700' : 'text-slate-400'}>Jadikan Default Free</span>
                </button>
              </div>

              {/* Feature Checkboxes */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Fitur Yang Diaktifkan</label>
                {featuresList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Tidak ada master fitur dari backend. Pastikan GET /api/features/list tersedia.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {featuresList.map(feat => (
                      <button
                        key={feat.key}
                        type="button"
                        onClick={() => toggleFeature(feat.key)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all text-xs font-bold ${
                          formFeatures[feat.key]
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                          formFeatures[feat.key] ? 'bg-emerald-500 text-white' : 'bg-slate-200'
                        }`}>
                          {formFeatures[feat.key] && <Check size={12} />}
                        </div>
                        <span className="truncate">{feat.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition">
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 shadow-lg shadow-emerald-200/50 active:scale-95 transform"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editingPkg ? 'Update Paket' : 'Buat Paket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
