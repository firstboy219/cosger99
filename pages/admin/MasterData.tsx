
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Building2, Percent, Settings, Key, Lock, Loader2, Link as LinkIcon, Globe, FileCode, Users, Search, Shield, Eye, Skull, RefreshCcw, UserX, UserCheck, TrendingDown, AlertTriangle, Cloud, CloudOff, Target } from 'lucide-react';
import { getConfig, saveConfig, getAllUsers, getUserData, updateUser } from '../../services/mockDb';
import { User, DebtItem } from '../../types';
import { formatCurrency } from '../../services/financeUtils';

interface BankData {
  id: string;
  name: string;
  promoRate: number;
  fixedYear: number;
  type: 'KPR' | 'KKB' | 'KTA';
}

export default function MasterData() {
  const [activeTab, setActiveTab] = useState<'users' | 'banks'>('users');
  const [isLoading, setIsLoading] = useState(false);

  // BANK DATA STATE
  const [banks, setBanks] = useState<BankData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<BankData>>({});

  // USER DATA STATE
  const [users, setUsers] = useState<any[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'local'>('local');
  const [selectedUser, setSelectedUser] = useState<any>(null); // For Inspect
  const [userDebts, setUserDebts] = useState<DebtItem[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  useEffect(() => {
      // Initial Fetch based on Tab
      if (activeTab === 'banks') fetchBanks();
      if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  // HELPERS
  const getHeaders = () => {
      const token = localStorage.getItem('paydone_session_token') || '';
      return {
          'Content-Type': 'application/json',
          'x-session-token': token
      };
  };

  // USER MANAGEMENT LOGIC
  const fetchUsers = async () => {
      setUserLoading(true);
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';

      if (baseUrl) {
          try {
              const res = await fetch(`${baseUrl}/api/admin/users`, {
                  headers: getHeaders()
              });
              
              if (res.ok) {
                  const data = await res.json();
                  const enriched = data.map((u: any) => ({
                      ...u,
                      dsr: u.totalIncome > 0 ? (u.monthlyObligation / u.totalIncome) * 100 : 0
                  }));
                  setUsers(enriched);
                  setDataSource('cloud');
              } else {
                  fetchUsersLocal();
              }
          } catch (e) {
              fetchUsersLocal();
          }
      } else {
          fetchUsersLocal();
      }
      setUserLoading(false);
  };

  const fetchUsersLocal = () => {
      const allUsers = getAllUsers();
      const enriched = allUsers.map(u => {
          const data = getUserData(u.id);
          const totalDebt = data.debts.reduce((a, b) => a + b.remainingPrincipal, 0);
          const totalIncome = data.incomes.reduce((a, b) => a + b.amount, 0);
          const monthlyObligation = data.debts.reduce((a, b) => a + b.monthlyPayment, 0);
          const dsr = totalIncome > 0 ? (monthlyObligation / totalIncome) * 100 : 0;
          
          return { ...u, totalDebt, totalIncome, monthlyObligation, dsr };
      });
      setUsers(enriched);
      setDataSource('local');
  };

  const toggleUserStatus = async (user: any) => {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';

      if (baseUrl) {
          try {
              await fetch(`${baseUrl}/api/admin/users/${user.id}/status`, {
                  method: 'PATCH',
                  headers: getHeaders(),
                  body: JSON.stringify({ status: newStatus })
              });
              fetchUsers();
          } catch (e) {
              alert("Failed to update status on server.");
          }
      } else {
          updateUser({ ...user, status: newStatus });
          fetchUsersLocal();
      }
  };

  const handleInspectUser = async (user: any) => {
      setSelectedUser(user);
      setInspectLoading(true);
      setUserDebts([]);

      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';

      if (baseUrl && dataSource === 'cloud') {
          try {
              const res = await fetch(`${baseUrl}/api/admin/users/${user.id}/financials`, {
                  headers: getHeaders()
              });
              if (res.ok) {
                  const data = await res.json();
                  setUserDebts(data.debts || []);
              } else {
                  const data = getUserData(user.id);
                  setUserDebts(data.debts);
              }
          } catch (e) {
              const data = getUserData(user.id);
              setUserDebts(data.debts);
          }
      } else {
          const data = getUserData(user.id);
          setUserDebts(data.debts);
      }
      setInspectLoading(false);
  };

  const handleKillSession = async (user: User) => {
      const adminKey = prompt(`Enter Project ID to confirm KILL SESSION for ${user.username}:`);
      if (!adminKey) return;

      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      
      if (!baseUrl) {
          alert("Backend URL not configured.");
          return;
      }

      try {
          const res = await fetch(`${baseUrl}/api/admin/kill-session`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ targetUserId: user.id, adminKey })
          });

          if (res.ok) {
              alert("Session KILLED.");
          } else {
              const err = await res.json();
              alert("Failed: " + err.error);
          }
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  const handleResetUser = async (user: User) => {
      if (!confirm(`Hapus SEMUA data transaksi untuk user ${user.username}?`)) return;
      
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      if (!baseUrl) {
          alert("Backend URL not configured.");
          return;
      }

      try {
          const res = await fetch(`${baseUrl}/api/admin/reset-user-data`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ targetUserId: user.id })
          });

          if (res.ok) {
              alert("Data user berhasil direset!");
              fetchUsers();
          } else {
              const err = await res.json();
              alert("Gagal reset: " + err.error);
          }
      } catch (e: any) {
          alert("Error connecting to server: " + e.message);
      }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(userFilter.toLowerCase()) || 
    u.email.toLowerCase().includes(userFilter.toLowerCase())
  );

  // BANK LOGIC
  const fetchBanks = async () => {
      setIsLoading(true);
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      
      const fallbackBanks: BankData[] = [
        { id: '1', name: 'Bank Mandiri (Local)', promoRate: 6.5, fixedYear: 3, type: 'KPR' },
        { id: '2', name: 'BCA (Local)', promoRate: 5.5, fixedYear: 2, type: 'KPR' }
      ];

      if (!baseUrl) {
          setBanks(fallbackBanks);
          setIsLoading(false);
          return;
      }

      try {
          const res = await fetch(`${baseUrl}/api/admin/banks`);
          if (res.ok) {
              const data = await res.json();
              setBanks(data);
          } else {
              setBanks(fallbackBanks);
          }
      } catch (e) {
          setBanks(fallbackBanks);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const config = getConfig();
    const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';

    const payload = { ...formData, id: formData.id || `bank-${Date.now()}` };

    try {
        if (baseUrl) {
            await fetch(`${baseUrl}/api/admin/banks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await fetchBanks();
        } else {
            if (formData.id) setBanks(banks.map(b => b.id === formData.id ? { ...b, ...formData as BankData } : b));
            else setBanks([...banks, { ...formData as BankData, id: Date.now().toString() }]);
        }
        setIsFormOpen(false);
    } catch (e) { alert("Gagal menyimpan."); } finally { setIsLoading(false); }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm("Hapus bank ini?")) return;
    setIsLoading(true);
    const config = getConfig();
    const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';

    try {
        if (baseUrl) {
            await fetch(`${baseUrl}/api/admin/banks/${id}`, { method: 'DELETE' });
            await fetchBanks();
        } else {
            setBanks(banks.filter(b => b.id !== id));
        }
    } catch (e) { alert("Gagal menghapus."); } finally { setIsLoading(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Users className="text-brand-600" size={28}/> Resources Management
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">Kelola akun pengguna dan mitra perbankan sistem.</p>
        </div>
        <div className="flex gap-3">
             <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider ${dataSource === 'cloud' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {dataSource === 'cloud' ? <Cloud size={16}/> : <CloudOff size={16}/>}
                Source: {dataSource === 'cloud' ? 'Cloud SQL' : 'Local Mock'}
            </div>
            {activeTab === 'banks' && (
                <button onClick={() => { setFormData({ name: '', promoRate: 0, fixedYear: 1, type: 'KPR' }); setIsFormOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-xl transform active:scale-95">
                    <Plus size={18} /> Partner
                </button>
            )}
        </div>
      </div>

      {/* Tabs Professional UI */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 w-fit">
        <button onClick={() => setActiveTab('users')} className={`px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>User Base</button>
        <button onClick={() => setActiveTab('banks')} className={`px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'banks' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Bank Partners</button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        
        {/* USERS TAB */}
        {activeTab === 'users' && (
            <div>
                <div className="p-6 border-b border-slate-100 flex gap-4 bg-slate-50/50">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Cari user berdasarkan nama atau email..." 
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-100 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-all font-medium"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                        />
                    </div>
                </div>

                {userLoading ? (
                    <div className="p-20 text-center text-slate-400 flex flex-col items-center"><Loader2 className="animate-spin mb-4 text-brand-600" size={40} /><p className="font-bold">Syncing user database...</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-slate-400 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">User Profile</th>
                                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Access Role</th>
                                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Financial Load</th>
                                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">DSR Score</th>
                                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Status</th>
                                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors">{user.username}</span>
                                                    <span className="text-[10px] font-mono text-slate-400">{user.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1.5 w-fit ${user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                {user.role === 'admin' ? <Shield size={12} /> : <Users size={12} />}
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="font-black text-slate-700">{formatCurrency(user.totalDebt)}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase">Inc: {formatCurrency(user.totalIncome)}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-xs font-black ${user.dsr > 50 ? 'text-red-600' : 'text-green-600'}`}>{user.dsr.toFixed(1)}%</span>
                                                <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full transition-all duration-1000 ${user.dsr > 50 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${Math.min(100, user.dsr)}%`}}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${user.status === 'active' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>{user.status}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {user.role !== 'admin' && (
                                                    <>
                                                        <button onClick={() => handleInspectUser(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition-all" title="Inspect"><Eye size={16}/></button>
                                                        <button onClick={() => handleKillSession(user)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all" title="Kill Session"><Skull size={16}/></button>
                                                        <button onClick={() => handleResetUser(user)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg border border-transparent hover:border-amber-100 transition-all" title="Reset Data"><RefreshCcw size={16}/></button>
                                                        <button onClick={() => toggleUserStatus(user)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg border border-transparent hover:border-slate-300 transition-all" title="Toggle Status">{user.status === 'active' ? <UserX size={16}/> : <UserCheck size={16}/>}</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {/* BANKS TAB */}
        {activeTab === 'banks' && (
          <div className="relative">
              {isLoading && <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-brand-600" size={40}/></div>}
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Lending Institution</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Product Category</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Promo Rate</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Fixed Tenure</th>
                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {banks.map((bank) => (
                    <tr key={bank.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5 font-bold text-slate-900 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 group-hover:bg-brand-600 group-hover:text-white transition-all"><Building2 size={18} /></div>
                        {bank.name}
                      </td>
                      <td className="px-6 py-5">
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                              {bank.type}
                          </span>
                      </td>
                      <td className="px-6 py-5"><div className="flex items-center gap-1.5 font-black text-brand-700 text-lg"><Percent size={14}/>{bank.promoRate}<span className="text-[10px] font-bold text-slate-400">P.A</span></div></td>
                      <td className="px-6 py-5 text-slate-600 font-bold">{bank.fixedYear} Tahun</td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setFormData(bank); setIsFormOpen(true); }} className="p-2 text-slate-400 hover:text-brand-600 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition-all"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteBank(bank.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-100 rounded-lg hover:shadow-sm transition-all"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {banks.length === 0 && !isLoading && (
                  <div className="p-20 text-center text-slate-400 italic">No bank partners registered.</div>
              )}
          </div>
        )}
      </div>

      {/* INSPECTION MODAL (STAYS SAME LOGIC) */}
      {selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col border border-white/20">
                  <div className="bg-slate-950 p-8 flex justify-between items-start text-white relative">
                      <div className="absolute top-0 right-0 p-8 opacity-5"><Target size={120}/></div>
                      <div className="relative z-10">
                          <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                              <Shield size={24} className="text-brand-400"/> Financial Inspector
                          </h3>
                          <div className="mt-2 flex flex-col">
                              <span className="text-lg font-bold">{selectedUser.username}</span>
                              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{selectedUser.email}</span>
                          </div>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="p-2 bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white rounded-full transition-all"><X size={24}/></button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                      <div className="grid grid-cols-3 gap-6">
                          <div className="p-5 bg-red-50/50 rounded-3xl border-2 border-red-100 text-center group hover:bg-red-50 transition-colors">
                              <p className="text-[10px] text-red-400 font-black uppercase mb-1 tracking-widest">Liability</p>
                              <p className="text-xl font-black text-red-600">{formatCurrency(selectedUser.totalDebt)}</p>
                          </div>
                          <div className="p-5 bg-green-50/50 rounded-3xl border-2 border-green-100 text-center group hover:bg-green-50 transition-colors">
                              <p className="text-[10px] text-green-400 font-black uppercase mb-1 tracking-widest">Income</p>
                              <p className="text-xl font-black text-green-600">{formatCurrency(selectedUser.totalIncome)}</p>
                          </div>
                          <div className="p-5 bg-blue-50/50 rounded-3xl border-2 border-blue-100 text-center group hover:bg-blue-50 transition-colors">
                              <p className="text-[10px] text-blue-400 font-black uppercase mb-1 tracking-widest">Health Score</p>
                              <p className={`text-xl font-black ${selectedUser.dsr > 50 ? 'text-red-600' : 'text-blue-900'}`}>{selectedUser.dsr.toFixed(1)}%</p>
                          </div>
                      </div>

                      <div>
                          <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs border-b pb-2 border-slate-100"><TrendingDown size={18} className="text-slate-400"/> Active Debt Contracts</h4>
                          {inspectLoading ? (
                              <div className="text-center py-12 flex flex-col items-center gap-4"><Loader2 className="animate-spin text-brand-600" size={32}/><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Scanning Cloud Records...</p></div>
                          ) : userDebts.length === 0 ? (
                              <div className="p-8 bg-slate-50 rounded-2xl text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 font-bold uppercase tracking-widest">Clean Profile: No Debts</div>
                          ) : (
                              <div className="space-y-3">
                                  {userDebts.map(debt => (
                                      <div key={debt.id} className="flex justify-between items-center p-5 bg-white border-2 border-slate-50 hover:border-brand-100 rounded-2xl shadow-sm transition-all group">
                                          <div>
                                              <p className="font-black text-slate-900 group-hover:text-brand-700 transition-colors">{debt.name}</p>
                                              <div className="flex gap-2 mt-1">
                                                  <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{debt.bankName || 'Private'}</span>
                                                  <span className="text-[9px] font-black uppercase bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded">{debt.type}</span>
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <p className="font-mono font-black text-red-600">{formatCurrency(debt.remainingPrincipal)}</p>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-tight">Setoran: {formatCurrency(debt.monthlyPayment)}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      {selectedUser.dsr > 50 && (
                          <div className="bg-amber-950 p-6 rounded-3xl border border-amber-900 flex items-start gap-4 shadow-xl">
                              <div className="p-2 bg-amber-500 rounded-xl animate-pulse"><AlertTriangle className="text-white" size={24} /></div>
                              <div>
                                  <h5 className="font-black text-amber-50 text-sm uppercase tracking-widest mb-1">Administrative Alert</h5>
                                  <p className="text-xs text-amber-200/70 leading-relaxed">Rasio hutang sangat tinggi (DSR > 50%). Batasi akses ke penambahan hutang baru atau fitur leverage lainnya untuk melindungi ekosistem.</p>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* BANK MODAL (STAYS SAME LOGIC) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formData.id ? 'Edit Partner' : 'New Bank Partner'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveBank} className="space-y-6">
              <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Partner Name</label><input type="text" required className="w-full border-2 border-slate-100 focus:border-brand-500 p-3.5 rounded-2xl outline-none font-bold transition-all" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Category</label><select className="w-full border-2 border-slate-100 focus:border-brand-500 p-3.5 rounded-2xl outline-none font-bold bg-white transition-all" value={formData.type || 'KPR'} onChange={e => setFormData({...formData, type: e.target.value as any})}><option value="KPR">KPR (Home)</option><option value="KKB">KKB (Auto)</option><option value="KTA">KTA (Cash)</option></select></div>
                 <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Promo Rate (%)</label><input type="number" step="0.1" className="w-full border-2 border-slate-100 focus:border-brand-500 p-3.5 rounded-2xl outline-none font-bold transition-all" value={formData.promoRate || ''} onChange={e => setFormData({...formData, promoRate: Number(e.target.value)})} /></div>
              </div>
              <div><label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Fixed Tenure (Years)</label><input type="number" className="w-full border-2 border-slate-100 focus:border-brand-500 p-3.5 rounded-2xl outline-none font-bold transition-all" value={formData.fixedYear || ''} onChange={e => setFormData({...formData, fixedYear: Number(e.target.value)})} /></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 px-4 py-4 bg-slate-50 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 transition-all text-sm uppercase tracking-widest">Cancel</button><button type="submit" disabled={isLoading} className="flex-1 px-4 py-4 bg-brand-600 text-white font-bold rounded-2xl hover:bg-brand-700 shadow-xl shadow-brand-100 transition-all transform active:scale-95 text-sm uppercase tracking-widest disabled:opacity-70">{isLoading ? 'Wait...' : 'Confirm'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
