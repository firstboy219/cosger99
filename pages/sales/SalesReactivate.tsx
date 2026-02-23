import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import {
  Users, Loader2, Settings, Send, AlertCircle, Check, RefreshCw,
  Clock, Calendar, Mail, Save, UserX, Zap, Search, ChevronDown
} from 'lucide-react';

interface IdleUser {
  id: string;
  username?: string;
  email?: string;
  lastLogin?: string;
  last_login?: string;
  created_at?: string;
  status?: string;
  idle_days?: number;
}

export default function SalesReactivate() {
  const [idleUsers, setIdleUsers] = useState<IdleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // Threshold settings
  const [idleThreshold, setIdleThreshold] = useState(30);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdLoaded, setThresholdLoaded] = useState(false);

  // Per-user reactivation
  const [reactivateLoading, setReactivateLoading] = useState<string | null>(null);

  // Bulk blast
  const [bulkBlasting, setBulkBlasting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, settingsRes] = await Promise.allSettled([
        api.get('/sales/users/idle'),
        api.get('/sales/settings/idle-threshold'),
      ]);
      if (usersRes.status === 'fulfilled') {
        setIdleUsers(usersRes.value.users || usersRes.value || []);
      }
      if (settingsRes.status === 'fulfilled') {
        const threshold = settingsRes.value.threshold || settingsRes.value.idle_threshold || 30;
        setIdleThreshold(Number(threshold));
        setThresholdLoaded(true);
      }
    } catch (e) {
      console.warn('[SalesReactivate] Load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveThreshold = useCallback(async () => {
    if (idleThreshold < 1) { showToast('Ambang batas harus minimal 1 hari.', 'error'); return; }
    setThresholdSaving(true);
    try {
      await api.post('/sales/settings/idle-threshold', { threshold: idleThreshold });
      showToast(`Ambang batas idle diperbarui: ${idleThreshold} hari.`, 'success');
      // Reload idle users with new threshold
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Gagal menyimpan setting.', 'error');
    } finally {
      setThresholdSaving(false);
    }
  }, [idleThreshold, loadData]);

  const handleReactivateUser = useCallback(async (userId: string) => {
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

  const handleBulkReactivate = useCallback(async () => {
    const userIds = selectedUsers.size > 0 ? Array.from(selectedUsers) : idleUsers.map(u => u.id);
    if (userIds.length === 0) { showToast('Tidak ada user untuk di-reactivate.', 'error'); return; }
    
    const confirmed = confirm(`Kirim email reactivation ke ${userIds.length} user idle?`);
    if (!confirmed) return;

    setBulkBlasting(true);
    try {
      await api.post('/sales/reactivate', { user_ids: userIds });
      showToast(`Reactivation berhasil dikirim ke ${userIds.length} user.`, 'success');
      setSelectedUsers(new Set());
    } catch (e: any) {
      showToast(e.message || 'Gagal mengirim bulk reactivation.', 'error');
    } finally {
      setBulkBlasting(false);
    }
  }, [selectedUsers, idleUsers]);

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const filteredUsers = idleUsers.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
  });

  const getIdleDays = (u: IdleUser): number => {
    if (u.idle_days) return u.idle_days;
    const lastLogin = u.lastLogin || u.last_login;
    if (!lastLogin) return 999;
    return Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reactivation Center</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Kelola user idle dan kirim kampanye reactivation.</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:border-emerald-200 transition"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Settings Card + Stats */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Idle Threshold Setting */}
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Ambang Batas Idle</h3>
              <p className="text-[10px] text-slate-400">Hari sejak login terakhir</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="number"
                min={1}
                max={365}
                value={idleThreshold}
                onChange={e => setIdleThreshold(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-sm font-black text-center"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">hari</span>
            </div>
            <button
              onClick={handleSaveThreshold}
              disabled={thresholdSaving}
              className="flex items-center gap-2 px-5 py-3 bg-amber-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-700 transition disabled:opacity-50 active:scale-95 transform"
            >
              {thresholdSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center">
          <UserX size={28} className="text-red-400 mb-2" />
          <p className="text-3xl font-black text-slate-900">{idleUsers.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User Idle Terdeteksi</p>
        </div>

        <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center">
          <Clock size={28} className="text-amber-400 mb-2" />
          <p className="text-3xl font-black text-slate-900">{idleThreshold}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ambang Hari Idle</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold placeholder:text-slate-300"
            placeholder="Cari user idle..."
          />
        </div>
        <button
          onClick={handleBulkReactivate}
          disabled={bulkBlasting}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-200/50 active:scale-95 transform disabled:opacity-50"
        >
          {bulkBlasting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {selectedUsers.size > 0 ? `Blast ${selectedUsers.size} User` : `Blast Semua (${idleUsers.length})`}
        </button>
      </div>

      {/* Idle Users Table */}
      <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
        {filteredUsers.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Login Terakhir</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Idle</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map(u => {
                    const idleDays = getIdleDays(u);
                    const severity = idleDays > 90 ? 'text-red-600 bg-red-50' : idleDays > 60 ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-100';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-xs font-black text-red-500">
                              {(u.username?.[0] || 'U').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{u.username || '-'}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600 text-xs truncate max-w-[180px]">{u.email || '-'}</td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {(u.lastLogin || u.last_login) 
                            ? new Date(u.lastLogin || u.last_login!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) 
                            : 'Never'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black ${severity}`}>
                            <Clock size={10} />
                            {idleDays} hari
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleReactivateUser(u.id)}
                            disabled={reactivateLoading === u.id}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition disabled:opacity-50"
                          >
                            {reactivateLoading === u.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Reactivate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-50">
              {filteredUsers.map(u => {
                const idleDays = getIdleDays(u);
                return (
                  <div key={u.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(u.id)}
                          onChange={() => toggleSelectUser(u.id)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                        />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{u.username || u.email}</p>
                          <p className="text-[10px] text-slate-400">Idle: {idleDays} hari</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReactivateUser(u.id)}
                        disabled={reactivateLoading === u.id}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold disabled:opacity-50"
                      >
                        {reactivateLoading === u.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Reactivate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <Users size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-sm">
              {search.trim() ? 'Tidak ada user idle sesuai pencarian.' : 'Tidak ada user idle ditemukan.'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">User dianggap idle jika tidak login selama {idleThreshold}+ hari.</p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-[120] animate-fade-in-up px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
