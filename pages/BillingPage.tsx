
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Subscription, FreemiumPackage, PaymentMethod } from '../types';
import { getDB, saveDB } from '../services/mockDb';
import { formatCurrency } from '../services/financeUtils';
import { compressImage } from '../services/imageUtils';
import {
  Receipt, Loader2, AlertCircle, Clock, CheckCircle, XCircle,
  Eye, ArrowLeft, ChevronRight, Search, Filter, Package,
  CreditCard, Sparkles, FileText, Ban, Shield,
  RefreshCw, ArrowRight, RefreshCcw, Upload, Image as ImageIcon,
  Copy, CheckCircle2
} from 'lucide-react';

// V50.35 TAHAP 4: Status map including cancelled status
const STATUS_MAP: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  active:           { label: 'Aktif',               color: 'text-green-700',  icon: CheckCircle, bg: 'bg-green-50 border-green-200' },
  pending:          { label: 'Menunggu',             color: 'text-amber-700',  icon: Clock,       bg: 'bg-amber-50 border-amber-200' },
  awaiting_payment: { label: 'Menunggu Pembayaran',  color: 'text-blue-700',   icon: CreditCard,  bg: 'bg-blue-50 border-blue-200' },
  verifying:        { label: 'Sedang Diverifikasi',  color: 'text-indigo-700', icon: Eye,         bg: 'bg-indigo-50 border-indigo-200' },
  expired:          { label: 'Kadaluarsa',           color: 'text-slate-600',  icon: Clock,       bg: 'bg-slate-50 border-slate-200' },
  rejected:         { label: 'Ditolak',              color: 'text-red-700',    icon: XCircle,     bg: 'bg-red-50 border-red-200' },
  cancelled:        { label: 'Dibatalkan',           color: 'text-slate-700',  icon: Ban,         bg: 'bg-slate-50 border-slate-200' },
};

// Statuses that allow renewal
const RENEWABLE_STATUSES = ['expired', 'cancelled', 'rejected', 'active'];

interface CheckoutResult { invoiceId: string; amountToPay: number; isFree: boolean; }

export default function BillingPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [packages, setPackages] = useState<FreemiumPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [detailSub, setDetailSub] = useState<Subscription | null>(null);

  // ── RENEW MODAL STATE ───────────────────────────────────────────────────────
  const [renewSub, setRenewSub] = useState<Subscription | null>(null);
  const [renewStep, setRenewStep] = useState<1 | 2 | 3 | 4>(1); // 1=pilih metode, 2=instruksi, 3=upload, 4=sukses
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [billingData, pkgData] = await Promise.all([
        api.get('/user/billing').catch(() => null),
        api.get('/packages').catch(() => null),
      ]);
      const subs: Subscription[] = Array.isArray(billingData) ? billingData : [];
      const pkgs: FreemiumPackage[] = Array.isArray(pkgData) ? pkgData : [];
      setSubscriptions(subs);
      setPackages(pkgs);
      const db = getDB();
      if (subs.length > 0) db.subscriptions = subs;
      if (pkgs.length > 0) db.packages = pkgs;
      saveDB(db);
    } catch {
      const db = getDB();
      const userId = localStorage.getItem('paydone_active_user') || '';
      const localSubs = Array.isArray(db.subscriptions)
        ? db.subscriptions.filter((s: Subscription) => s.user_id === userId) : [];
      setSubscriptions(localSubs);
      setPackages(Array.isArray(db.packages) ? db.packages : []);
      if (localSubs.length === 0) setError('Gagal memuat data langganan. Periksa koneksi internet Anda.');
    } finally { setLoading(false); }
  };

  const getPackageName = (pkgId: string, sub: Subscription) => {
    if (sub.package_name) return sub.package_name;
    return packages.find(p => p.id === pkgId)?.name || pkgId;
  };

  const getPackageById = (pkgId: string) => packages.find(p => p.id === pkgId) || null;

  const filtered = useMemo(() => {
    let list = [...subscriptions];
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.package_name || '').toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) || s.status.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }, [subscriptions, filterStatus, searchQuery]);

  // ── OPEN RENEW MODAL ────────────────────────────────────────────────────────
  const openRenew = useCallback(async (sub: Subscription) => {
    setRenewSub(sub);
    setRenewStep(1);
    setSelectedMethod(null);
    setCheckoutResult(null);
    setRenewError(null);
    setProofBase64(null);
    setProofFileName('');

    setLoadingMethods(true);
    const db = getDB();
    const cached = db.paymentMethods || [];
    if (cached.length > 0) setPaymentMethods(cached);
    try {
      const data = await api.get('/payment-methods');
      const raw: any[] = Array.isArray(data) ? data : (data.paymentMethods || data.payment_methods || []);
      const methods = raw.filter((m: any) => {
        const active = m.isActive ?? m.is_active;
        return active === true || active === undefined;
      });
      setPaymentMethods(methods);
      db.paymentMethods = methods;
      saveDB(db);
    } catch { setPaymentMethods(cached); }
    finally { setLoadingMethods(false); }
  }, []);

  // ── CHECKOUT / RENEW ────────────────────────────────────────────────────────
  const handleRenewCheckout = useCallback(async () => {
    if (!renewSub || !selectedMethod) return;
    setCheckoutLoading(true);
    setRenewError(null);
    const userId = localStorage.getItem('paydone_active_user') || '';
    try {
      const data = await api.post('/payment/checkout', {
        userId,
        packageId: renewSub.package_id,
        paymentMethodId: selectedMethod,
      });
      if (data.error) { setRenewError(data.error); return; }
      setCheckoutResult(data);
      if (data.isFree) { setRenewStep(4); await loadData(); }
      else setRenewStep(2);
    } catch (e: any) {
      setRenewError(e.message || 'Gagal memproses pembayaran.');
    } finally { setCheckoutLoading(false); }
  }, [renewSub, selectedMethod]);

  // ── FILE SELECT ──────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran file maksimal 5MB.'); return; }
    setProofFileName(file.name);
    try {
      const compressed = await compressImage(file, { maxWidth: 800, quality: 0.7 });
      setProofBase64(compressed);
    } catch { alert('Gagal memproses gambar. Silakan coba lagi.'); }
  }, []);

  // ── SUBMIT PROOF ─────────────────────────────────────────────────────────────
  const handleSubmitProof = useCallback(async () => {
    if (!checkoutResult?.invoiceId || !proofBase64) return;
    setSubmitting(true);
    setRenewError(null);
    try {
      await api.post('/payment/submit', { invoiceId: checkoutResult.invoiceId, proofOfPayment: proofBase64 });
      setRenewStep(4);
      await loadData();
    } catch (e: any) {
      setRenewError(e.message || 'Gagal mengirim bukti pembayaran.');
    } finally { setSubmitting(false); }
  }, [checkoutResult, proofBase64]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const selectedMethodData = paymentMethods.find(m => m.id === selectedMethod);
  const statusOptions = ['all', 'active', 'pending', 'awaiting_payment', 'verifying', 'expired', 'rejected', 'cancelled'];

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link to="/app/upgrade" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Riwayat Langganan</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-12">Kelola dan pantau semua transaksi subscription Anda.</p>
        </div>
        <Link
          to="/app/upgrade"
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all transform active:scale-95 shadow-lg"
        >
          <Sparkles size={14} /> Upgrade Paket
        </Link>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari invoice, paket..."
            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-brand-500 outline-none transition"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {statusOptions.map(s => {
            const info = STATUS_MAP[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                  filterStatus === s
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                    : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s === 'all' ? <Filter size={12} /> : info && <info.icon size={12} />}
                {s === 'all' ? 'Semua' : info?.label || s}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="text-center py-20">
          <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Memuat riwayat...</p>
        </div>
      )}

      {error && !loading && (
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle size={24} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 text-sm font-bold">{error}</p>
          <button onClick={loadData} className="mt-3 text-xs text-brand-600 font-bold hover:underline flex items-center justify-center gap-1 mx-auto">
            <RefreshCw size={12} /> Coba Lagi
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2rem] bg-white">
          <Receipt size={48} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-black text-slate-900">Belum Ada Langganan</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
            {filterStatus !== 'all' ? 'Tidak ada langganan dengan status ini.' : 'Mulai dengan memilih paket yang sesuai untuk Anda.'}
          </p>
          <Link
            to="/app/upgrade"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all transform active:scale-95 shadow-xl"
          >
            <Sparkles size={14} /> Lihat Paket
          </Link>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Paket</th>
                  <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Periode</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nominal</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="text-center px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sub => {
                  const statusInfo = STATUS_MAP[sub.status] || STATUS_MAP.pending;
                  const StatusIcon = statusInfo.icon;
                  const canRenew = RENEWABLE_STATUSES.includes(sub.status);
                  return (
                    <tr key={sub.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-brand-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{getPackageName(sub.package_id, sub)}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{sub.id.substring(0, 16)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-medium text-slate-700">
                          {new Date(sub.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          s/d {new Date(sub.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-black text-slate-900">{formatCurrency(sub.amount_paid)}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                          <StatusIcon size={12} />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* Detail button */}
                          <button
                            onClick={() => setDetailSub(sub)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                            title="Lihat Detail"
                          >
                            <Eye size={14} />
                          </button>
                          {/* Renew button */}
                          {canRenew && (
                            <button
                              onClick={() => openRenew(sub)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[10px] font-black transition-all transform active:scale-95 shadow-sm"
                              title="Perpanjang / Bayar Ulang"
                            >
                              <RefreshCcw size={11} />
                              Perpanjang
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-50">
            {filtered.map(sub => {
              const statusInfo = STATUS_MAP[sub.status] || STATUS_MAP.pending;
              const StatusIcon = statusInfo.icon;
              const canRenew = RENEWABLE_STATUSES.includes(sub.status);
              return (
                <div key={sub.id} className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <Package size={18} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => setDetailSub(sub)}>
                      <p className="font-bold text-sm text-slate-900 truncate">{getPackageName(sub.package_id, sub)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${statusInfo.color}`}>
                          <StatusIcon size={10} /> {statusInfo.label}
                        </span>
                        <span className="text-slate-300">-</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(sub.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-black text-sm text-slate-900">{formatCurrency(sub.amount_paid)}</p>
                      {canRenew && (
                        <button
                          onClick={() => openRenew(sub)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-[10px] font-black transition ml-auto"
                        >
                          <RefreshCcw size={10} /> Perpanjang
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ────────────────────────────────────────────────────────── */}
      {detailSub && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 text-white relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Detail Langganan</p>
                  <h3 className="text-xl font-black tracking-tight">{getPackageName(detailSub.package_id, detailSub)}</h3>
                </div>
                <button onClick={() => setDetailSub(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-slate-400 hover:text-white">
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <div className="p-8 space-y-4">
              <DetailRow label="Invoice ID" value={detailSub.id} mono />
              <DetailRow label="Status">
                {(() => {
                  const info = STATUS_MAP[detailSub.status] || STATUS_MAP.pending;
                  const Icon = info.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${info.bg} ${info.color}`}>
                      <Icon size={12} /> {info.label}
                    </span>
                  );
                })()}
              </DetailRow>
              <DetailRow label="Nominal" value={formatCurrency(detailSub.amount_paid)} bold />
              <DetailRow label="Mulai" value={new Date(detailSub.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailRow label="Berakhir" value={new Date(detailSub.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
              {detailSub.promo_id && <DetailRow label="Promo" value={detailSub.promo_id} mono />}
              {detailSub.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Alasan Penolakan</p>
                  <p className="text-xs text-red-700 font-medium">{detailSub.rejection_reason}</p>
                </div>
              )}
              {detailSub.proof_of_payment && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Bukti Transfer</p>
                  <img src={detailSub.proof_of_payment} alt="Bukti" className="w-full rounded-xl border border-slate-200 shadow-sm" />
                </div>
              )}
            </div>
            <div className="px-8 pb-8 flex gap-3">
              {RENEWABLE_STATUSES.includes(detailSub.status) && (
                <button
                  onClick={() => { setDetailSub(null); openRenew(detailSub); }}
                  className="flex-1 py-3.5 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={14} /> Perpanjang
                </button>
              )}
              <button
                onClick={() => setDetailSub(null)}
                className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RENEW MODAL ─────────────────────────────────────────────────────────── */}
      {renewSub && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-8 py-6 text-white flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-brand-200 uppercase tracking-widest mb-1">
                    {renewStep === 1 && 'Perpanjang Langganan'}
                    {renewStep === 2 && 'Instruksi Pembayaran'}
                    {renewStep === 3 && 'Upload Bukti Bayar'}
                    {renewStep === 4 && 'Pembayaran Terkirim'}
                  </p>
                  <h3 className="text-xl font-black tracking-tight">{getPackageName(renewSub.package_id, renewSub)}</h3>
                  {/* Step indicator */}
                  <div className="flex items-center gap-1.5 mt-3">
                    {[1,2,3,4].map(s => (
                      <div key={s} className={`h-1 rounded-full transition-all ${s <= renewStep ? 'bg-white' : 'bg-white/30'} ${s === renewStep ? 'w-6' : 'w-3'}`} />
                    ))}
                  </div>
                </div>
                <button onClick={() => setRenewSub(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition">
                  <XCircle size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">

              {/* ─ STEP 1: Pilih Metode ─ */}
              {renewStep === 1 && (
                <div className="p-8 space-y-6">
                  <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-brand-500 uppercase mb-1">Paket</p>
                    <p className="font-black text-slate-900">{getPackageName(renewSub.package_id, renewSub)}</p>
                    {(() => {
                      const pkg = getPackageById(renewSub.package_id);
                      return pkg ? (
                        <p className="text-sm font-bold text-brand-700 mt-1">{formatCurrency(pkg.price_monthly || 0)} <span className="font-medium text-slate-500">/bulan</span></p>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <p className="text-xs font-black text-slate-900 mb-3">Pilih Metode Pembayaran</p>
                    {loadingMethods && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={20} className="animate-spin text-brand-500" />
                      </div>
                    )}
                    {!loadingMethods && paymentMethods.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">Tidak ada metode pembayaran tersedia.</p>
                    )}
                    {!loadingMethods && paymentMethods.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMethod(m.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 mb-2 text-left transition-all ${
                          selectedMethod === m.id
                            ? 'border-brand-500 bg-brand-50 shadow-md'
                            : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedMethod === m.id ? 'bg-brand-100' : 'bg-slate-100'}`}>
                          <CreditCard size={18} className={selectedMethod === m.id ? 'text-brand-600' : 'text-slate-500'} />
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-sm text-slate-900">{m.bank_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{m.account_number}</p>
                          <p className="text-[10px] text-slate-400">{m.account_name}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedMethod === m.id ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`}>
                          {selectedMethod === m.id && <div className="w-full h-full rounded-full bg-white scale-[0.4] block" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {renewError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700 font-medium">{renewError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─ STEP 2: Instruksi Pembayaran ─ */}
              {renewStep === 2 && checkoutResult && (
                <div className="p-8 space-y-5">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Total yang harus dibayar</p>
                    <p className="text-3xl font-black text-amber-700">{formatCurrency(checkoutResult.amountToPay)}</p>
                    <p className="text-[10px] text-amber-500 mt-1">Transfer tepat sesuai nominal di atas</p>
                  </div>

                  {selectedMethodData && (
                    <div className="space-y-3">
                      <p className="text-xs font-black text-slate-700">Transfer ke:</p>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Bank</p>
                            <p className="font-black text-slate-900">{selectedMethodData.bank_name}</p>
                          </div>
                          <CreditCard size={20} className="text-slate-400" />
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Nomor Rekening</p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-black text-lg text-slate-900 font-mono tracking-wide">{selectedMethodData.account_number}</p>
                            <button
                              onClick={() => copyToClipboard(selectedMethodData.account_number)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'}`}
                            >
                              {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                              {copied ? 'Disalin!' : 'Salin'}
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Penerima</p>
                          <p className="font-bold text-slate-700">{selectedMethodData.account_name}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                    <Shield size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-blue-700 font-medium">Setelah transfer, klik "Sudah Transfer" dan upload bukti pembayaran untuk verifikasi.</p>
                  </div>
                </div>
              )}

              {/* ─ STEP 3: Upload Bukti ─ */}
              {renewStep === 3 && (
                <div className="p-8 space-y-5">
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
                    {proofBase64 ? (
                      <div className="space-y-3">
                        <img src={proofBase64} alt="Bukti" className="w-full max-h-48 object-contain rounded-xl border border-slate-200" />
                        <p className="text-xs font-bold text-slate-600">{proofFileName}</p>
                        <button
                          onClick={() => { setProofBase64(null); setProofFileName(''); }}
                          className="text-[11px] text-red-500 font-bold hover:underline"
                        >
                          Hapus & Pilih Ulang
                        </button>
                      </div>
                    ) : (
                      <div>
                        <ImageIcon size={32} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-700 mb-1">Upload Bukti Transfer</p>
                        <p className="text-[11px] text-slate-400 mb-4">JPG, PNG, atau WEBP. Maks 5MB.</p>
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black hover:bg-brand-700 transition flex items-center gap-2 mx-auto"
                        >
                          <Upload size={14} /> Pilih File
                        </button>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  </div>

                  {renewError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700 font-medium">{renewError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─ STEP 4: Sukses ─ */}
              {renewStep === 4 && (
                <div className="p-8 text-center space-y-4">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={40} className="text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Pembayaran Terkirim!</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                      Bukti pembayaran kamu sudah kami terima. Tim kami akan memverifikasi dalam 1×24 jam.
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Invoice</p>
                    <p className="text-xs font-mono text-green-800 break-all">{checkoutResult?.invoiceId}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="px-8 pb-8 pt-4 flex-shrink-0 border-t border-slate-100">
              {renewStep === 1 && (
                <button
                  onClick={handleRenewCheckout}
                  disabled={!selectedMethod || checkoutLoading}
                  className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {checkoutLoading ? 'Memproses...' : 'Lanjut ke Pembayaran'}
                </button>
              )}
              {renewStep === 2 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setRenewStep(1)}
                    className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={() => setRenewStep(3)}
                    className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition flex items-center justify-center gap-2"
                  >
                    <Upload size={14} /> Sudah Transfer
                  </button>
                </div>
              )}
              {renewStep === 3 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setRenewStep(2)}
                    className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={handleSubmitProof}
                    disabled={!proofBase64 || submitting}
                    className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    {submitting ? 'Mengirim...' : 'Kirim Bukti'}
                  </button>
                </div>
              )}
              {renewStep === 4 && (
                <button
                  onClick={() => setRenewSub(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition"
                >
                  Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- HELPER COMPONENT ---
function DetailRow({ label, value, mono, bold, children }: { label: string; value?: string; mono?: boolean; bold?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-shrink-0 pt-0.5">{label}</p>
      {children || (
        <p className={`text-sm text-right ${bold ? 'font-black text-slate-900' : 'font-medium text-slate-700'} ${mono ? 'font-mono text-xs' : ''} break-all`}>
          {value}
        </p>
      )}
    </div>
  );
}

