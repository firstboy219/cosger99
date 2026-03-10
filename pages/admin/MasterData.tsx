
import React, { useState, useEffect, useCallback } from 'react';
import { getAllUsers, getConfig , getApiBaseUrl } from '../../services/mockDb';
import { getAdminHeaders } from '../../services/cloudSync';
import { User, BankData } from '../../types';
import { formatCurrency } from '../../services/financeUtils';
import {
  Search, Eye, Edit2, Trash2, Shield, ShieldOff, LogOut, RotateCcw,
  Cloud, CloudOff, Loader2, Building2, X, Save, CheckCircle, AlertTriangle,
  UserCheck, UserX, Skull, DollarSign, TrendingDown, Receipt, CreditCard, RefreshCw,
  Plus, UserPlus, Pencil
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FinancialSummary {
  totalDebt: number; debtCount: number;
  totalIncome: number; incomeCount: number;
  totalExpense: number; expenseCount: number;
  subscription: { status: string; packageName: string; amountPaid: number; endDate: string } | null;
}
interface ConfirmState {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MasterData() {
  const [activeTab, setActiveTab] = useState<'users' | 'banks'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [banks, setBanks] = useState<BankData[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Modals
  const [inspectUser, setInspectUser] = useState<User | null>(null);
  const [financials, setFinancials] = useState<FinancialSummary | null>(null);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ username: '', email: '', role: 'user', password: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Create User Modal ────────────────────────────────────────────────────
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ username: '', email: '', password: '', role: 'user' });
  const [createUserSaving, setCreateUserSaving] = useState(false);

  // ─── Banks CRUD State ─────────────────────────────────────────────────────
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<BankData | null>(null);
  const [bankForm, setBankForm] = useState({ name: '', type: 'KPR', promoRate: 0, fixedYear: 0 });
  const [bankSaving, setBankSaving] = useState(false);

  const getBaseUrl = () => getApiBaseUrl();
  const myAdminId = () => localStorage.getItem('paydone_active_user') || 'admin';

  // ─── Fetch Users ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/users`, {
        headers: getAdminHeaders(myAdminId())
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : (data.data || []));
        setIsCloud(true);
      } else throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setUsers(getAllUsers());
      setIsCloud(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
    setBanks([
      { id: 'bca', name: 'BCA', type: 'KPR', promoRate: 4.5, fixedYear: 3 },
      { id: 'btn', name: 'BTN', type: 'KPR', promoRate: 5.0, fixedYear: 2 },
      { id: 'mandiri', name: 'Mandiri', type: 'KKB', promoRate: 3.5, fixedYear: 1 },
      { id: 'bni', name: 'BNI', type: 'KPR', promoRate: 5.2, fixedYear: 3 },
      { id: 'cimb', name: 'CIMB Niaga', type: 'KTA', promoRate: 11.0, fixedYear: 0 },
    ]);
  }, []);

  // ─── Action: View Financials ──────────────────────────────────────────────
  const handleInspect = async (user: User) => {
    setInspectUser(user);
    setFinancials(null);
    setFinancialsLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/users/${user.id}/financials`, {
        headers: getAdminHeaders(myAdminId())
      });
      if (res.ok) setFinancials(await res.json());
    } catch { /* null stays */ }
    setFinancialsLoading(false);
  };

  // ─── Action: Edit User ────────────────────────────────────────────────────
  const handleEditOpen = (user: User) => {
    setEditUser(user);
    setEditForm({ username: user.username || '', email: user.email || '', role: user.role || 'user', password: '' });
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const payload: any = { username: editForm.username, email: editForm.email, role: editForm.role };
      if (editForm.password.trim()) payload.password = editForm.password;
      const res = await fetch(`${getBaseUrl()}/api/admin/users-crud/${editUser.id}`, {
        method: 'PUT',
        headers: getAdminHeaders(myAdminId()),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('success', `User "${editForm.username}" berhasil diupdate.`);
        setEditUser(null);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.error || 'Update gagal');
      }
    } catch (e: any) { showToast('error', 'Network error: ' + e.message); }
    setEditSaving(false);
  };

  // ─── Action: Change Status ────────────────────────────────────────────────
  const handleStatusChange = (user: User, newStatus: string) => {
    const labelMap: Record<string, string> = {
      active: 'Aktifkan', inactive: 'Nonaktifkan', banned: 'BAN User'
    };
    setConfirm({
      title: labelMap[newStatus] || newStatus,
      message: `Set status "${user.username}" menjadi "${newStatus}"?${newStatus === 'banned' ? '\n\nPeringatan: Session aktif akan dimatikan paksa via WebSocket.' : ''}`,
      confirmLabel: labelMap[newStatus] || newStatus,
      danger: newStatus === 'banned',
      onConfirm: async () => {
        setConfirm(null);
        setActionLoading(user.id);
        try {
          const res = await fetch(`${getBaseUrl()}/api/admin/users/${user.id}/status`, {
            method: 'PUT',
            headers: getAdminHeaders(myAdminId()),
            body: JSON.stringify({ status: newStatus })
          });
          if (res.ok) { showToast('success', `Status "${user.username}" → "${newStatus}".`); fetchUsers(); }
          else { const e = await res.json().catch(() => ({})); showToast('error', e.error || 'Gagal'); }
        } catch (e: any) { showToast('error', e.message); }
        setActionLoading(null);
      }
    });
  };

  // ─── Action: Kill Session ─────────────────────────────────────────────────
  const handleKillSession = (user: User) => {
    setConfirm({
      title: 'Kill Session',
      message: `Force logout "${user.username}" dari semua device?\n\nSemua session token akan dihapus dan user harus login ulang. Backend akan broadcast FORCE_LOGOUT via WebSocket.`,
      confirmLabel: 'Kill Session',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        setActionLoading(user.id);
        try {
          const res = await fetch(`${getBaseUrl()}/api/admin/kill-session`, {
            method: 'POST',
            headers: getAdminHeaders(myAdminId()),
            body: JSON.stringify({ targetUserId: user.id })
          });
          if (res.ok) showToast('success', `Session "${user.username}" berhasil dimatikan.`);
          else showToast('error', 'Kill session gagal');
        } catch (e: any) { showToast('error', e.message); }
        setActionLoading(null);
      }
    });
  };

  // ─── Action: Reset Financial Data ─────────────────────────────────────────
  const handleResetData = (user: User) => {
    setConfirm({
      title: '⚠️ Reset Data Finansial',
      message: `Ini akan MENGHAPUS SEMUA data finansial "${user.username}":\n• Hutang, Income, Pengeluaran\n• Alokasi, Sinking Fund, Tugas\n• Bank Accounts, Installments\n\nAkun tetap ada. TIDAK BISA DIBATALKAN.`,
      confirmLabel: 'Reset Data',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        setActionLoading(user.id);
        try {
          const res = await fetch(`${getBaseUrl()}/api/admin/reset-user-data`, {
            method: 'POST',
            headers: getAdminHeaders(myAdminId()),
            body: JSON.stringify({ targetUserId: user.id })
          });
          if (res.ok) showToast('success', `Data finansial "${user.username}" direset.`);
          else showToast('error', 'Reset data gagal');
        } catch (e: any) { showToast('error', e.message); }
        setActionLoading(null);
      }
    });
  };

  // ─── Action: Create User ──────────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!createUserForm.email || !createUserForm.password) {
      showToast('error', 'Email dan password wajib diisi.');
      return;
    }
    setCreateUserSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/create-user`, {
        method: 'POST',
        headers: getAdminHeaders(myAdminId()),
        body: JSON.stringify(createUserForm)
      });
      const json = await res.json();
      if (res.ok) {
        showToast('success', json.message || 'User berhasil dibuat.');
        setShowCreateUser(false);
        setCreateUserForm({ username: '', email: '', password: '', role: 'user' });
        fetchUsers();
      } else {
        showToast('error', json.error || 'Gagal membuat user.');
      }
    } catch (e: any) {
      showToast('error', 'Network error: ' + e.message);
    }
    setCreateUserSaving(false);
  };

  // ─── Banks: Open Add Modal ────────────────────────────────────────────────
  const openAddBank = () => {
    setEditingBank(null);
    setBankForm({ name: '', type: 'KPR', promoRate: 0, fixedYear: 0 });
    setShowBankModal(true);
  };

  // ─── Banks: Open Edit Modal ───────────────────────────────────────────────
  const openEditBank = (bank: BankData) => {
    setEditingBank(bank);
    setBankForm({ name: bank.name, type: bank.type, promoRate: bank.promoRate, fixedYear: bank.fixedYear });
    setShowBankModal(true);
  };

  // ─── Banks: Save (Create / Update) ───────────────────────────────────────
  const handleSaveBank = async () => {
    if (!bankForm.name.trim()) { showToast('error', 'Nama bank wajib diisi.'); return; }
    setBankSaving(true);
    try {
      const payload = {
        id: editingBank?.id || `bank-${bankForm.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: bankForm.name.trim(),
        type: bankForm.type,
        promoRate: Number(bankForm.promoRate),
        fixedYear: Number(bankForm.fixedYear),
      };
      const url = editingBank
        ? `${getBaseUrl()}/api/admin/banks/${editingBank.id}`
        : `${getBaseUrl()}/api/admin/banks`;
      const method = editingBank ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getAdminHeaders(myAdminId()),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('success', editingBank ? 'Bank diperbarui.' : 'Bank ditambahkan.');
        setShowBankModal(false);
        fetchBanks();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.error || 'Gagal menyimpan bank.');
      }
    } catch (e: any) { showToast('error', 'Network error: ' + e.message); }
    setBankSaving(false);
  };

  // ─── Banks: Delete ────────────────────────────────────────────────────────
  const handleDeleteBank = (bank: BankData) => {
    setConfirm({
      title: `Hapus Bank "${bank.name}"?`,
      message: `Data bank "${bank.name}" akan dihapus dari database. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const res = await fetch(`${getBaseUrl()}/api/admin/banks/${bank.id}`, {
            method: 'DELETE',
            headers: getAdminHeaders(myAdminId())
          });
          if (res.ok) { showToast('success', `Bank "${bank.name}" dihapus.`); fetchBanks(); }
          else showToast('error', 'Gagal menghapus bank.');
        } catch (e: any) { showToast('error', e.message); }
      }
    });
  };

  // ─── Action: Delete User Permanently ─────────────────────────────────────
  const handleDeleteUser = (user: User) => {
    setConfirm({
      title: '🚨 HAPUS USER PERMANEN',
      message: `DELETE CASCADE "${user.username}" dari database.\n\nIni menghapus akun + seluruh data dari 13 tabel sekaligus. Backend akan broadcast FORCE_LOGOUT.\n\n⚠️ TIDAK BISA DIKEMBALIKAN SAMA SEKALI.`,
      confirmLabel: 'Hapus Permanen',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        setActionLoading(user.id);
        try {
          const res = await fetch(`${getBaseUrl()}/api/admin/users/${user.id}`, {
            method: 'DELETE',
            headers: getAdminHeaders(myAdminId())
          });
          if (res.ok) { showToast('success', `User "${user.username}" dihapus permanen.`); fetchUsers(); }
          else showToast('error', 'Hapus user gagal');
        } catch (e: any) { showToast('error', e.message); }
        setActionLoading(null);
      }
    });
  };

  const filteredUsers = users.filter(u =>
    (u.username || '').toLowerCase().includes(filter.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(filter.toLowerCase())
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      active: 'bg-green-50 text-green-700 border-green-200',
      inactive: 'bg-slate-100 text-slate-500 border-slate-200',
      banned: 'bg-red-50 text-red-700 border-red-200',
      pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase border ${styles[status] || styles.inactive}`}>
        {(status || 'unknown').replace('_', ' ')}
      </span>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[80] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-bold animate-fade-in transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Master Data
            {isCloud
              ? <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase"><Cloud size={10}/> Cloud</span>
              : <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase"><CloudOff size={10}/> Local</span>}
          </h2>
          <p className="text-slate-500 text-sm">Manage users, banks, and system entities.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={fetchUsers} disabled={loading} className="p-2 border rounded-lg hover:bg-slate-50 transition" title="Refresh">
            {loading ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'users' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>Users</button>
          <button onClick={() => setActiveTab('banks')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'banks' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>Banks</button>
          {activeTab === 'users' && (
            <button onClick={() => setShowCreateUser(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 transition">
              <UserPlus size={15}/> Add User
            </button>
          )}
          {activeTab === 'banks' && (
            <button onClick={openAddBank} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">
              <Plus size={15}/> Add Bank
            </button>
          )}
        </div>
      </div>

      {/* ── USERS TAB ───────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
              <input
                type="text" placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                value={filter} onChange={e => setFilter(e.target.value)}
              />
            </div>
            <span className="text-xs text-slate-400 font-semibold ml-auto">{filteredUsers.length} users</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => {
                  const busy = actionLoading === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-900">{user.username}</div>
                        <div className="text-xs text-slate-400">{user.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="capitalize bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{user.role}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={user.status}/>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {busy ? (
                            <Loader2 size={16} className="animate-spin text-slate-400"/>
                          ) : (<>
                            {/* 👁 Financial Inspect */}
                            <ActionBtn icon={<Eye size={14}/>} label="Lihat Finansial" color="blue" onClick={() => handleInspect(user)}/>
                            {/* ✏️ Edit */}
                            <ActionBtn icon={<Edit2 size={14}/>} label="Edit User" color="slate" onClick={() => handleEditOpen(user)}/>
                            {/* ✅ Aktifkan */}
                            {user.status !== 'active' && (
                              <ActionBtn icon={<UserCheck size={14}/>} label="Aktifkan" color="green" onClick={() => handleStatusChange(user, 'active')}/>
                            )}
                            {/* ⏸ Nonaktifkan */}
                            {user.status === 'active' && (
                              <ActionBtn icon={<UserX size={14}/>} label="Nonaktifkan" color="amber" onClick={() => handleStatusChange(user, 'inactive')}/>
                            )}
                            {/* 🚫 BAN */}
                            {user.status !== 'banned' && (
                              <ActionBtn icon={<ShieldOff size={14}/>} label="BAN user" color="orange" onClick={() => handleStatusChange(user, 'banned')}/>
                            )}
                            {/* 💀 Kill Session */}
                            <ActionBtn icon={<LogOut size={14}/>} label="Kill Session (force logout)" color="purple" onClick={() => handleKillSession(user)}/>
                            {/* 🔄 Reset Data */}
                            <ActionBtn icon={<RotateCcw size={14}/>} label="Reset Data Finansial" color="rose" onClick={() => handleResetData(user)}/>
                            {/* ❌ Delete Permanent */}
                            <ActionBtn icon={<Skull size={14}/>} label="Hapus Permanen" color="red" onClick={() => handleDeleteUser(user)}/>
                          </>)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={4} className="p-10 text-center text-slate-400">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Eye size={10} className="text-blue-400"/> Finansial</span>
            <span className="flex items-center gap-1"><Edit2 size={10} className="text-slate-400"/> Edit</span>
            <span className="flex items-center gap-1"><UserCheck size={10} className="text-green-500"/> Aktifkan</span>
            <span className="flex items-center gap-1"><UserX size={10} className="text-amber-500"/> Nonaktif</span>
            <span className="flex items-center gap-1"><ShieldOff size={10} className="text-orange-400"/> BAN</span>
            <span className="flex items-center gap-1"><LogOut size={10} className="text-purple-500"/> Kill Session</span>
            <span className="flex items-center gap-1"><RotateCcw size={10} className="text-rose-400"/> Reset Data</span>
            <span className="flex items-center gap-1"><Skull size={10} className="text-red-600"/> Hapus Permanen</span>
          </div>
        </div>
      )}

      {/* ── BANKS TAB ───────────────────────────────────────────────────────── */}
      {activeTab === 'banks' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {banks.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Building2 size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="font-bold">Belum ada data bank</p>
              <p className="text-sm mt-1">Klik "Add Bank" untuk menambahkan bank pertama.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {banks.map(bank => (
                <div key={bank.id} className="p-4 rounded-xl border border-slate-200 hover:border-brand-300 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Building2 size={20}/></div>
                      <h3 className="font-bold text-slate-900">{bank.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditBank(bank)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                      ><Pencil size={13}/></button>
                      <button
                        onClick={() => handleDeleteBank(bank)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus"
                      ><Trash2 size={13}/></button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Type</span><span className="font-bold">{bank.type}</span></div>
                    <div className="flex justify-between"><span>Promo Rate</span><span className="font-bold text-green-600">{bank.promoRate}%</span></div>
                    <div className="flex justify-between"><span>Fixed Period</span><span className="font-bold">{bank.fixedYear} Yr</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: CREATE USER ────────────────────────────────────────────────── */}
      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setShowCreateUser(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20}/></button>
            <h3 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2"><UserPlus size={20} className="text-brand-600"/> Buat User Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username (opsional)</label>
                <input
                  type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  value={createUserForm.username} onChange={e => setCreateUserForm(p => ({...p, username: e.target.value}))}
                  placeholder="Otomatis dari email jika kosong"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email *</label>
                <input
                  type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  value={createUserForm.email} onChange={e => setCreateUserForm(p => ({...p, email: e.target.value}))}
                  placeholder="user@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password *</label>
                <input
                  type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  value={createUserForm.password} onChange={e => setCreateUserForm(p => ({...p, password: e.target.value}))}
                  placeholder="Min. 6 karakter"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  value={createUserForm.role} onChange={e => setCreateUserForm(p => ({...p, role: e.target.value}))}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreateUser(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                <button
                  onClick={handleCreateUser}
                  disabled={createUserSaving}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {createUserSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  Buat User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT BANK ────────────────────────────────────────────── */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setShowBankModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20}/></button>
            <h3 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2">
              <Building2 size={20} className="text-blue-600"/>
              {editingBank ? `Edit Bank — ${editingBank.name}` : 'Tambah Bank'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Bank *</label>
                <input
                  type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  value={bankForm.name} onChange={e => setBankForm(p => ({...p, name: e.target.value}))}
                  placeholder="BCA, Mandiri, BNI..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipe</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  value={bankForm.type} onChange={e => setBankForm(p => ({...p, type: e.target.value}))}
                >
                  <option value="KPR">KPR</option>
                  <option value="KKB">KKB</option>
                  <option value="KTA">KTA</option>
                  <option value="CC">Kartu Kredit</option>
                  <option value="Other">Lainnya</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Promo Rate (%)</label>
                  <input
                    type="number" step="0.1" min="0"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={bankForm.promoRate} onChange={e => setBankForm(p => ({...p, promoRate: Number(e.target.value)}))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fixed Period (Tahun)</label>
                  <input
                    type="number" min="0"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    value={bankForm.fixedYear} onChange={e => setBankForm(p => ({...p, fixedYear: Number(e.target.value)}))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBankModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                <button
                  onClick={handleSaveBank}
                  disabled={bankSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {bankSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
                  {editingBank ? 'Update Bank' : 'Simpan Bank'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FINANCIALS ─────────────────────────────────────────────────── */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button onClick={() => setInspectUser(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20}/></button>

            <div className="flex items-center gap-4 mb-5">
              <div className="h-14 w-14 bg-gradient-to-br from-brand-500 to-indigo-500 rounded-full flex items-center justify-center text-xl font-black text-white">
                {(inspectUser.username || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">{inspectUser.username}</h3>
                <p className="text-xs text-slate-400 mb-1">{inspectUser.email}</p>
                <StatusBadge status={inspectUser.status}/>
              </div>
            </div>

            {financialsLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-sm">
                <Loader2 className="animate-spin" size={20}/> Memuat data finansial...
              </div>
            ) : financials ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FinCard icon={<TrendingDown size={13}/>} label="Total Hutang" value={formatCurrency(financials.totalDebt)} sub={`${financials.debtCount} hutang aktif`} color="red"/>
                  <FinCard icon={<DollarSign size={13}/>} label="Total Income" value={formatCurrency(financials.totalIncome)} sub={`${financials.incomeCount} sumber`} color="green"/>
                  <FinCard icon={<Receipt size={13}/>} label="Total Pengeluaran" value={formatCurrency(financials.totalExpense)} sub={`${financials.expenseCount} transaksi`} color="amber"/>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-1.5 text-blue-500 mb-1"><CreditCard size={13}/><span className="text-[10px] font-black uppercase">Subscription</span></div>
                    {financials.subscription ? (<>
                      <p className="text-sm font-black text-blue-700">{financials.subscription.packageName}</p>
                      <p className="text-[10px] text-blue-400 capitalize">{financials.subscription.status}</p>
                    </>) : <p className="text-sm font-bold text-slate-400">Free / None</p>}
                  </div>
                </div>
                {financials.totalIncome > 0 && (() => {
                  const dti = (financials.totalDebt / financials.totalIncome) * 100;
                  const danger = dti > 50;
                  return (
                    <div className={`p-3 rounded-xl border-2 ${danger ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Debt-to-Income Ratio</p>
                      <p className={`text-2xl font-black ${danger ? 'text-red-600' : 'text-green-600'}`}>{dti.toFixed(1)}%</p>
                      <p className={`text-[10px] mt-0.5 ${danger ? 'text-red-400' : 'text-green-400'}`}>{danger ? '⚠️ Berisiko tinggi' : '✓ Sehat'}</p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                <CloudOff size={32} className="mx-auto mb-2 opacity-30"/>
                Tidak bisa memuat data. Periksa koneksi backend & admin secret.
              </div>
            )}

            {/* Quick actions from modal */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
              <button onClick={() => { setInspectUser(null); handleEditOpen(inspectUser); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition"><Edit2 size={12}/> Edit</button>
              <button onClick={() => { setInspectUser(null); handleKillSession(inspectUser); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 transition"><LogOut size={12}/> Kill Session</button>
              <button onClick={() => { setInspectUser(null); handleResetData(inspectUser); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 transition"><RotateCcw size={12}/> Reset Data</button>
              <button onClick={() => { setInspectUser(null); handleDeleteUser(inspectUser); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition"><Skull size={12}/> Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT USER ──────────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setEditUser(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X size={20}/></button>
            <h3 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2"><Edit2 size={18}/> Edit User</h3>
            <div className="space-y-4">
              {[
                { label: 'Username', field: 'username', type: 'text' },
                { label: 'Email', field: 'email', type: 'email' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">{label}</label>
                  <input
                    type={type}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-brand-500 outline-none transition"
                    value={(editForm as any)[field]}
                    onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Role</label>
                <select
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-medium focus:border-brand-500 outline-none transition"
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="sales">Sales</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Password Baru <span className="text-slate-300 normal-case font-normal">(kosongkan jika tidak diubah)</span></label>
                <input
                  type="password" placeholder="••••••••"
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-brand-500 outline-none transition"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition">Batal</button>
              <button
                onClick={handleEditSave} disabled={editSaving}
                className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {editSaving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DIALOG ────────────────────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className={`flex items-center gap-3 mb-4 ${confirm.danger ? 'text-red-600' : 'text-amber-600'}`}>
              <AlertTriangle size={22}/>
              <h3 className="text-lg font-black">{confirm.title}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 whitespace-pre-line leading-relaxed">{confirm.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition">Batal</button>
              <button
                onClick={confirm.onConfirm}
                className={`px-5 py-2 text-sm font-bold text-white rounded-xl transition ${confirm.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 hover:bg-blue-50',
    slate: 'text-slate-600 hover:bg-slate-100',
    green: 'text-green-600 hover:bg-green-50',
    amber: 'text-amber-500 hover:bg-amber-50',
    orange: 'text-orange-500 hover:bg-orange-50',
    purple: 'text-purple-600 hover:bg-purple-50',
    rose: 'text-rose-500 hover:bg-rose-50',
    red: 'text-red-700 hover:bg-red-50',
  };
  return (
    <button onClick={onClick} title={label} className={`p-1.5 rounded-lg transition ${colors[color] || colors.slate}`}>
      {icon}
    </button>
  );
}

function FinCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 border-red-100 text-red-500 val-red-700 sub-red-400',
    green: 'bg-green-50 border-green-100 text-green-500',
    amber: 'bg-amber-50 border-amber-100 text-amber-500',
  };
  const valColor = color === 'red' ? 'text-red-700' : color === 'green' ? 'text-green-700' : 'text-amber-700';
  const subColor = color === 'red' ? 'text-red-400' : color === 'green' ? 'text-green-400' : 'text-amber-400';
  return (
    <div className={`p-3 rounded-xl border ${colors[color] || colors.green}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] font-black uppercase">{label}</span></div>
      <p className={`text-base font-black ${valColor}`}>{value}</p>
      <p className={`text-[10px] ${subColor}`}>{sub}</p>
    </div>
  );
}
