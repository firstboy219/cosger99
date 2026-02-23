import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import {
  Users, Loader2, Search, Shield, ShieldOff, Crown, MoreHorizontal,
  XCircle, CheckCircle, AlertCircle, X as XIcon, Calendar, UserX, UserCheck
} from 'lucide-react';

export default function SalesUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // Action menu
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Manual sub modal
  const [showManualSub, setShowManualSub] = useState(false);
  const [manualSubUserId, setManualSubUserId] = useState('');
  const [manualSubMonths, setManualSubMonths] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get('/sales/users');
      setUsers(data.users || data || []);
    } catch (e) {
      console.warn('[SalesUsers] Load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleBan = useCallback(async (userId: string) => {
    setActionLoading(userId);
    setActiveMenu(null);
    try {
      await api.put(`/sales/users/${userId}/status`, { status: 'banned' });
      showToast('User berhasil di-banned.', 'success');
      loadUsers();
    } catch (e: any) {
      showToast(e.message || 'Gagal ban user.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [loadUsers]);

  const handleUnban = useCallback(async (userId: string) => {
    setActionLoading(userId);
    setActiveMenu(null);
    try {
      await api.put(`/sales/users/${userId}/status`, { status: 'active' });
      showToast('User berhasil diaktifkan kembali.', 'success');
      loadUsers();
    } catch (e: any) {
      showToast(e.message || 'Gagal unban user.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [loadUsers]);

  const openManualSub = (userId: string) => {
    setManualSubUserId(userId);
    setManualSubMonths(1);
    setActiveMenu(null);
    setShowManualSub(true);
  };

  const handleManualSub = useCallback(async () => {
    if (!manualSubUserId) return;
    setActionLoading(manualSubUserId);
    try {
      const res = await api.post(`/sales/users/${manualSubUserId}/manual-sub`, { months: manualSubMonths });
      showToast(res.message || `Akses Premium ${manualSubMonths} bulan berhasil diberikan.`, 'success');
      setShowManualSub(false);
      loadUsers();
    } catch (e: any) {
      showToast(e.message || 'Gagal memberikan akses manual.', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [manualSubUserId, manualSubMonths, loadUsers]);

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.id?.toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kelola User</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Ban, unban, atau berikan akses premium manual.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold placeholder:text-slate-300"
          placeholder="Cari username, email, ID..."
        />
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Login</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                        {u.photoUrl ? <img src={u.photoUrl} alt="" className="w-9 h-9 rounded-xl object-cover" /> : (u.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{u.username}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600 text-xs truncate max-w-[180px]">{u.email}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                      u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                      u.role === 'sales' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role === 'admin' ? <Shield size={10} /> : u.role === 'sales' ? <Crown size={10} /> : null}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' :
                      u.status === 'inactive' || (u.status as string) === 'banned' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                      >
                        {actionLoading === u.id ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={16} />}
                      </button>

                      {activeMenu === u.id && (
                        <div className="absolute right-0 top-10 z-20 bg-white border-2 border-slate-100 rounded-xl shadow-2xl py-2 w-56 animate-fade-in">
                          {(u.status as string) !== 'banned' ? (
                            <button
                              onClick={() => handleBan(u.id)}
                              className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition"
                            >
                              <UserX size={14} /> Banned User
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnban(u.id)}
                              className="w-full px-4 py-2.5 text-left text-xs font-bold text-green-600 hover:bg-green-50 flex items-center gap-3 transition"
                            >
                              <UserCheck size={14} /> Aktifkan Kembali
                            </button>
                          )}
                          <button
                            onClick={() => openManualSub(u.id)}
                            className="w-full px-4 py-2.5 text-left text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition"
                          >
                            <Crown size={14} /> Beri Akses Premium Manual
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-400">Tidak ada user ditemukan.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-slate-50">
          {filteredUsers.map(u => (
            <div key={u.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                    {(u.username?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{u.username}</p>
                    <p className="text-[10px] text-slate-400">{u.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
              {activeMenu === u.id && (
                <div className="flex gap-2">
                  {(u.status as string) !== 'banned' ? (
                    <button onClick={() => handleBan(u.id)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold text-center">Ban</button>
                  ) : (
                    <button onClick={() => handleUnban(u.id)} className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold text-center">Unban</button>
                  )}
                  <button onClick={() => openManualSub(u.id)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold text-center">Premium Manual</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ MANUAL SUB MODAL ═══ */}
      {showManualSub && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">Manual Subscription</p>
                  <h3 className="text-lg font-black tracking-tight">Beri Akses Premium</h3>
                </div>
                <button onClick={() => setShowManualSub(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"><XIcon size={20} /></button>
              </div>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">User ID</label>
                <input
                  value={manualSubUserId} disabled
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-mono text-slate-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Durasi (Bulan)</label>
                <input
                  type="number" min={1} max={36} value={manualSubMonths} onChange={e => setManualSubMonths(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowManualSub(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Batal</button>
                <button
                  onClick={handleManualSub}
                  disabled={actionLoading === manualSubUserId}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 shadow-lg shadow-emerald-200/50 active:scale-95 transform"
                >
                  {actionLoading === manualSubUserId ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
                  Berikan Akses
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
