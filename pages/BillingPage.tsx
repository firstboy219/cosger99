
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Subscription, FreemiumPackage } from '../types';
import { getDB, saveDB } from '../services/mockDb';
import { formatCurrency } from '../services/financeUtils';
import {
  Receipt, Loader2, AlertCircle, Clock, CheckCircle, XCircle,
  Eye, ArrowLeft, ChevronRight, Search, Filter, Package,
  Calendar, CreditCard, Shield, Sparkles, FileText, Ban,
  RefreshCw, ArrowRight
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

export default function BillingPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [packages, setPackages] = useState<FreemiumPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [detailSub, setDetailSub] = useState<Subscription | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // V50.35 TAHAP 4: Fix billing fetch endpoint and array safety
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // V50.35 TAHAP 4: Use /user/billing endpoint instead of /subscriptions
      const [billingData, pkgData] = await Promise.all([
        api.get('/user/billing').catch(() => null),
        api.get('/packages').catch(() => null),
      ]);

      // V50.35 TAHAP 4: Array safety - check Array.isArray before processing
      const subs: Subscription[] = Array.isArray(billingData) ? billingData : [];
      const pkgs: FreemiumPackage[] = Array.isArray(pkgData) ? pkgData : [];

      setSubscriptions(subs);
      setPackages(pkgs);

      // Persist locally
      const db = getDB();
      if (Array.isArray(subs) && subs.length > 0) db.subscriptions = subs;
      if (Array.isArray(pkgs) && pkgs.length > 0) db.packages = pkgs;
      saveDB(db);
    } catch {
      // Fallback to local DB
      const db = getDB();
      const userId = localStorage.getItem('paydone_active_user') || '';
      const localSubs = Array.isArray(db.subscriptions)
        ? db.subscriptions.filter((s: Subscription) => s.user_id === userId)
        : [];
      const localPkgs = Array.isArray(db.packages) ? db.packages : [];
      
      setSubscriptions(localSubs);
      setPackages(localPkgs);
      if (localSubs.length === 0) {
        setError('Gagal memuat data langganan. Periksa koneksi internet Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getPackageName = (pkgId: string, sub: Subscription) => {
    if (sub.package_name) return sub.package_name;
    const found = packages.find(p => p.id === pkgId);
    return found?.name || pkgId;
  };

  const filtered = useMemo(() => {
    let list = [...subscriptions];
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.package_name || '').toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }, [subscriptions, filterStatus, searchQuery]);

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

      {/* LOADING */}
      {loading && (
        <div className="text-center py-20">
          <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Memuat riwayat...</p>
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle size={24} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 text-sm font-bold">{error}</p>
          <button onClick={loadData} className="mt-3 text-xs text-brand-600 font-bold hover:underline flex items-center justify-center gap-1 mx-auto">
            <RefreshCw size={12} /> Coba Lagi
          </button>
        </div>
      )}

      {/* EMPTY */}
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

      {/* V50.35 TAHAP 6: TABLE with smooth animations */}
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
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setDetailSub(sub)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                        >
                          <Eye size={14} />
                        </button>
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
              return (
                <button
                  key={sub.id}
                  onClick={() => setDetailSub(sub)}
                  className="w-full p-5 flex items-center gap-4 text-left hover:bg-slate-50 transition"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
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
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-sm text-slate-900">{formatCurrency(sub.amount_paid)}</p>
                    <ChevronRight size={14} className="text-slate-300 ml-auto mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
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
            <div className="px-8 pb-8">
              <button
                onClick={() => setDetailSub(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all transform active:scale-95 shadow-xl"
              >
                Tutup
              </button>
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
