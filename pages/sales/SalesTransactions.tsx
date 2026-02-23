import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Subscription } from '../../types';
import { formatCurrency } from '../../services/financeUtils';
import {
  Receipt, Loader2, Check, X as XIcon, Eye, Clock,
  CheckCircle, XCircle, AlertCircle, Search, Filter, Image as ImageIcon
} from 'lucide-react';

export default function SalesTransactions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // Modal states
  const [showProof, setShowProof] = useState(false);
  const [proofImage, setProofImage] = useState('');
  const [proofTxId, setProofTxId] = useState('');

  const [showReject, setShowReject] = useState(false);
  const [rejectId, setRejectId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await api.get('/sales/transactions');
      setSubscriptions(data.subscriptions || data || []);
    } catch (e) {
      console.warn('[SalesTransactions] Load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleApprove = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      const res = await api.post(`/sales/transactions/${id}/approve`, {});
      showToast(res.message || `Transaksi disetujui. Akumulasi ${res.accumulatedDays || 30} Hari.`, 'success');
      loadTransactions();
    } catch (e: any) {
      showToast(e.message || 'Gagal approve transaksi.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [loadTransactions]);

  const handleReject = useCallback(async () => {
    if (!rejectId) return;
    setActionLoading(rejectId);
    try {
      await api.post(`/sales/transactions/${rejectId}/reject`, { reason: rejectReason.trim() || 'Ditolak oleh Sales' });
      showToast('Transaksi ditolak.', 'success');
      setShowReject(false);
      setRejectReason('');
      loadTransactions();
    } catch (e: any) {
      showToast(e.message || 'Gagal reject transaksi.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [rejectId, rejectReason, loadTransactions]);

  const openProof = (tx: Subscription) => {
    setProofImage(tx.proof_of_payment || '');
    setProofTxId(tx.id);
    setShowProof(true);
  };

  const openReject = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setShowReject(true);
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    verifying: 'bg-amber-100 text-amber-700',
    awaiting_payment: 'bg-blue-100 text-blue-700',
    pending: 'bg-slate-100 text-slate-600',
    expired: 'bg-slate-100 text-slate-500',
    rejected: 'bg-red-100 text-red-700',
  };

  const filtered = subscriptions.filter(tx => {
    if (filter !== 'all' && tx.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (tx.user_id?.toLowerCase().includes(q) || tx.package_name?.toLowerCase().includes(q) || tx.id?.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Approval Transaksi</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Verifikasi pembayaran dan kelola subscription user.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold placeholder:text-slate-300"
            placeholder="Cari user ID, paket..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'verifying', 'active', 'awaiting_payment', 'rejected', 'expired'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                filter === s ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200/50' : 'bg-white border-2 border-slate-100 text-slate-500 hover:border-slate-200'
              }`}
            >
              {s === 'all' ? 'Semua' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Paket</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nominal</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 truncate max-w-[120px]">{tx.id}</td>
                  <td className="px-4 py-4 font-bold text-slate-900 truncate max-w-[140px]">{tx.user_id}</td>
                  <td className="px-4 py-4 font-medium text-slate-700">{tx.package_name || tx.package_id}</td>
                  <td className="px-4 py-4 font-black text-slate-900">{formatCurrency(tx.amount_paid || 0)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${statusColors[tx.status] || 'bg-slate-100 text-slate-500'}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">{tx.start_date ? new Date(tx.start_date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {tx.proof_of_payment && (
                        <button onClick={() => openProof(tx)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Lihat Bukti">
                          <Eye size={16} />
                        </button>
                      )}
                      {tx.status === 'verifying' && (
                        <>
                          <button
                            onClick={() => handleApprove(tx.id)}
                            disabled={actionLoading === tx.id}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                            title="Approve"
                          >
                            {actionLoading === tx.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                          </button>
                          <button
                            onClick={() => openReject(tx.id)}
                            disabled={actionLoading === tx.id}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-400 font-medium">
                    Tidak ada transaksi ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-slate-50">
          {filtered.map(tx => (
            <div key={tx.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{tx.package_name || tx.package_id}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{tx.user_id}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${statusColors[tx.status] || 'bg-slate-100 text-slate-500'}`}>
                  {tx.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-slate-900">{formatCurrency(tx.amount_paid || 0)}</span>
                <div className="flex gap-2">
                  {tx.proof_of_payment && (
                    <button onClick={() => openProof(tx)} className="p-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"><Eye size={14} /></button>
                  )}
                  {tx.status === 'verifying' && (
                    <>
                      <button onClick={() => handleApprove(tx.id)} disabled={actionLoading === tx.id} className="p-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold disabled:opacity-50">
                        <CheckCircle size={14} />
                      </button>
                      <button onClick={() => openReject(tx.id)} className="p-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold">
                        <XCircle size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm text-slate-400">Tidak ada transaksi.</div>
          )}
        </div>
      </div>

      {/* ═══ PROOF MODAL ═══ */}
      {showProof && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bukti Pembayaran</p>
                <p className="text-xs font-mono text-slate-500 mt-1">{proofTxId}</p>
              </div>
              <button onClick={() => setShowProof(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition"><XIcon size={20} /></button>
            </div>
            <div className="p-8 flex items-center justify-center bg-slate-50 min-h-[300px]">
              {proofImage ? (
                <img src={proofImage} alt="Bukti Pembayaran" className="max-w-full max-h-[60vh] rounded-xl shadow-lg object-contain" />
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Tidak ada bukti pembayaran.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ REJECT MODAL ═══ */}
      {showReject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Tolak Transaksi</p>
              <p className="text-sm font-bold text-slate-900 mt-1">Berikan alasan penolakan</p>
            </div>
            <div className="p-8 space-y-4">
              <textarea
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none text-sm font-medium resize-none"
                placeholder="Alasan penolakan..."
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowReject(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Batal</button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading === rejectId}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition disabled:opacity-50 active:scale-95 transform"
                >
                  {actionLoading === rejectId ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Tolak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-[120] animate-fade-in-up px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
