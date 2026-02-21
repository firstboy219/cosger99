
import React, { useState, useEffect } from 'react';
import { getAllUsers, updateUser, getUserData, getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync'; // Import centralized headers
import { User, DebtItem } from '../../types';
import { Search, UserCheck, UserX, Shield, Eye, TrendingDown, X, AlertTriangle, RefreshCcw, Loader2, Skull, Edit, Trash2, LogOut } from 'lucide-react';

import { formatCurrency } from '../../services/financeUtils';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function UserManagement() {
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ username: '', email: '', role: 'user', password: '' });

  const handleEditClick = (user: any) => {
      setEditingUser(user);
      setEditForm({ username: user.username, email: user.email, role: user.role, password: '' });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;

      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';

      if (baseUrl) {
          try {
              const payload: any = {
                  username: editForm.username,
                  email: editForm.email,
                  role: editForm.role
              };
              if (editForm.password) payload.password = editForm.password;

              const res = await fetch(`${baseUrl}/api/admin/users/${editingUser.id}`, {
                  method: 'PUT',
                  headers: getHeaders(adminId),
                  body: JSON.stringify(payload)
              });

              if (res.ok) {
                  alert("User updated successfully");
                  setEditingUser(null);
                  loadData();
              } else {
                  const err = await res.json();
                  alert("Failed to update: " + err.error);
              }
          } catch (e: any) {
              alert("Error: " + e.message);
          }
      } else {
          // Local Fallback
          updateUser({ ...editingUser, ...editForm });
          setEditingUser(null);
          loadData();
      }
  };

  const handleDeleteCascadeClick = (user: User) => {
      setConfirmConfig({
          isOpen: true,
          title: "DELETE CASCADE USER?",
          message: `PERINGATAN: Ini akan menghapus user ${user.username} DAN SEMUA DATA TERKAIT (Hutang, Transaksi, dll) secara permanen.`,
          onConfirm: () => {
              executeDeleteCascade(user.id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeDeleteCascade = async (userId: string) => {
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';

      if (baseUrl) {
          try {
              const res = await fetch(`${baseUrl}/api/admin/users/${userId}?cascade=true`, {
                  method: 'DELETE',
                  headers: getHeaders(adminId)
              });

              if (res.ok) {
                  alert("User and all data deleted successfully.");
                  loadData();
              } else {
                  const err = await res.json();
                  alert("Failed to delete: " + err.error);
              }
          } catch (e: any) {
              alert("Error: " + e.message);
          }
      } else {
          alert("Delete Cascade only available in Cloud Mode.");
      }
  };

  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Inspection Modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDebts, setUserDebts] = useState<DebtItem[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
      setLoading(true);
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';

      if (baseUrl) {
          // CLOUD MODE
          try {
              const res = await fetch(`${baseUrl}/api/admin/users`, {
                  headers: getHeaders(adminId) // Correctly use shared headers
              });
              if (res.ok) {
                  const data = await res.json();
                  
                  // FIXED PARSING LOGIC: Handle Direct Array Response
                  const rawList = Array.isArray(data) ? data : (data.users || data.data || []);
                  
                  const enriched = rawList.map((u: any) => ({
                      ...u,
                      // Safety Check: Ensure numbers
                      dsr: (Number(u.totalIncome) || 0) > 0 ? (Number(u.monthlyObligation) / Number(u.totalIncome)) * 100 : 0,
                      totalDebt: Number(u.totalDebt) || 0,
                      totalIncome: Number(u.totalIncome) || 0
                  }));
                  setUsers(enriched);
              } else {
                  console.error("Failed to fetch users from cloud, status:", res.status);
                  fallbackToLocal();
              }
          } catch (e) {
              console.error("API Error fetching users:", e);
              fallbackToLocal();
          }
      } else {
          fallbackToLocal();
      }
      setLoading(false);
  };

  const fallbackToLocal = () => {
      const allUsers = getAllUsers();
      const enriched = allUsers.map(u => {
          const data = getUserData(u.id);
          // Defensive check: use [] if debts/incomes undefined
          const debts = data.debts || [];
          const incomes = data.incomes || [];
          
          const totalDebt = debts.reduce((a, b) => a + Number(b.remainingPrincipal || 0), 0);
          const totalIncome = incomes.reduce((a, b) => a + Number(b.amount || 0), 0);
          const monthlyObligation = debts.reduce((a, b) => a + Number(b.monthlyPayment || 0), 0);
          const dsr = totalIncome > 0 ? (monthlyObligation / totalIncome) * 100 : 0;
          
          return { ...u, totalDebt, totalIncome, monthlyObligation, dsr };
      });
      setUsers(enriched);
  };

  const toggleStatus = async (user: any) => {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';

      if (baseUrl) {
          try {
              await fetch(`${baseUrl}/api/admin/users/${user.id}/status`, {
                  method: 'PATCH',
                  headers: getHeaders(adminId),
                  body: JSON.stringify({ status: newStatus })
              });
              loadData(); // Reload from cloud
          } catch (e) {
              alert("Failed to update status on server.");
          }
      } else {
          // Local Fallback
          updateUser({ ...user, status: newStatus });
          loadData();
      }
  };

  const handleInspect = async (user: any) => {
      setSelectedUser(user);
      setInspectLoading(true);
      setUserDebts([]);

      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';

      if (baseUrl) {
          try {
              const res = await fetch(`${baseUrl}/api/admin/users/${user.id}/financials`, {
                  headers: getHeaders(adminId)
              });
              if (res.ok) {
                  const data = await res.json();
                  setUserDebts(data.debts || []);
              } else {
                  // Fallback for inspect too
                  const data = getUserData(user.id);
                  setUserDebts(data.debts || []);
              }
          } catch (e) {
              console.error("Failed to inspect");
              const data = getUserData(user.id);
              setUserDebts(data.debts || []);
          }
      } else {
          const data = getUserData(user.id);
          setUserDebts(data.debts || []);
      }
      setInspectLoading(false);
  };

  const handleResetUserClick = (user: User) => {
      setConfirmConfig({
          isOpen: true,
          title: "Reset Data User?",
          message: `Hapus SEMUA data transaksi untuk user ${user.username}? Tindakan ini tidak dapat dibatalkan.`,
          onConfirm: () => {
              handleResetUser(user);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleResetUser = async (user: User) => {
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';

      if (!baseUrl) {
          alert("Backend URL not configured.");
          return;
      }

      try {
          const res = await fetch(`${baseUrl}/api/admin/reset-user-data`, {
              method: 'POST',
              headers: getHeaders(adminId),
              body: JSON.stringify({ targetUserId: user.id })
          });

          if (res.ok) {
              alert("Data user berhasil direset!");
              loadData();
          } else {
              const err = await res.json();
              alert("Gagal reset: " + err.error);
          }
      } catch (e: any) {
          alert("Error connecting to server: " + e.message);
      }
  };

  // --- NEW: KILL SESSION LOGIC ---
  const handleKillSession = async (user: User) => {
      const adminKey = prompt(`Enter Project ID to confirm KILL SESSION for ${user.username}:`);
      if (!adminKey) return;

      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';
      
      if (!baseUrl) {
          alert("Backend URL not configured. Cannot kill session.");
          return;
      }

      try {
          const res = await fetch(`${baseUrl}/api/admin/kill-session`, {
              method: 'POST',
              headers: getHeaders(adminId),
              body: JSON.stringify({ targetUserId: user.id, adminKey })
          });

          if (res.ok) {
              alert("Session KILLED. User will be logged out immediately.");
          } else {
              const err = await res.json();
              alert("Failed to kill session: " + err.error);
          }
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(filter.toLowerCase()) || 
    u.email.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-500 text-sm">Smart Monitoring & Control Panel (Cloud Sync Active).</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari username atau email..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
           </div>
        </div>

        {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>Loading users from cloud...</p>
            </div>
        ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                 <tr>
                   <th className="px-6 py-4 font-semibold">User</th>
                   <th className="px-6 py-4 font-semibold">Role</th>
                   <th className="px-6 py-4 font-semibold">Debt Load</th>
                   <th className="px-6 py-4 font-semibold">DSR Score</th>
                   <th className="px-6 py-4 font-semibold">Status</th>
                   <th className="px-6 py-4 font-semibold text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {filteredUsers.map(user => (
                   <tr key={user.id} className="hover:bg-slate-50 transition">
                     <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-900">{user.username}</span>
                           <span className="text-xs text-slate-500">{user.email}</span>
                           {user.parentUserId && <span className="text-[10px] text-brand-600 bg-brand-50 w-fit px-1 rounded mt-1">Sub-User</span>}
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className="flex items-center gap-1">
                           {user.role === 'admin' && <Shield size={14} className="text-purple-600" />}
                           <span className="capitalize">{user.role}</span>
                        </span>
                     </td>
                     <td className="px-6 py-4">
                        <div className="font-mono font-medium text-slate-700">{formatCurrency(user.totalDebt)}</div>
                        <div className="text-[10px] text-slate-400">Income: {formatCurrency(user.totalIncome)}</div>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.dsr > 50 ? 'bg-red-100 text-red-700' : (user.dsr > 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}`}>
                            {user.dsr.toFixed(1)}%
                        </span>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                            user.status === 'active' ? 'bg-green-50 text-green-600' : 
                            user.status === 'inactive' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                            {user.status.replace('_', ' ')}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                            {user.role !== 'admin' && (
                                <>
                                    <button 
                                       onClick={() => handleEditClick(user)}
                                       className="p-2 rounded-lg text-slate-600 hover:bg-slate-50 transition border border-slate-200"
                                       title="Edit User"
                                    >
                                       <Edit size={16} />
                                    </button>

                                    <button 
                                       onClick={() => handleInspect(user)}
                                       className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition border border-blue-100"
                                       title="Inspect Financials"
                                    >
                                       <Eye size={16} />
                                    </button>
                                    
                                    <button 
                                       onClick={() => handleKillSession(user)}
                                       className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition border border-amber-100"
                                       title="Reset Session"
                                    >
                                       <LogOut size={16} />
                                    </button>

                                    <button 
                                       onClick={() => handleResetUserClick(user)}
                                       className="p-2 rounded-lg text-cyan-600 hover:bg-cyan-50 transition border border-cyan-100"
                                       title="Reset Data Only"
                                    >
                                       <RefreshCcw size={16} />
                                    </button>

                                    <button 
                                       onClick={() => toggleStatus(user)}
                                       className={`p-2 rounded-lg transition border ${
                                           user.status === 'active' ? 'text-orange-600 hover:bg-orange-50 border-orange-100' : 'text-green-600 hover:bg-green-50 border-green-100'
                                       }`}
                                       title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                                    >
                                       {user.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                                    </button>

                                    <button 
                                       onClick={() => handleDeleteCascadeClick(user)}
                                       className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition border border-red-100"
                                       title="Delete Cascade"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                     </td>
                   </tr>
                 ))}
                 {filteredUsers.length === 0 && (
                     <tr><td colSpan={6} className="p-8 text-center text-slate-400">No users found.</td></tr>
                 )}
              </tbody>
            </table>
        )}
      </div>

      {/* EDIT USER MODAL */}
      {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                  <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                          <Edit size={20} className="text-brand-400"/> Edit User
                      </h3>
                      <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white"><X size={24}/></button>
                  </div>
                  <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                          <input type="text" required className="w-full border p-3 rounded-xl text-sm font-bold" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                          <input type="email" required className="w-full border p-3 rounded-xl text-sm font-bold" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                          <select className="w-full border p-3 rounded-xl text-sm font-bold" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}>
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password (Optional)</label>
                          <input type="password" className="w-full border p-3 rounded-xl text-sm font-bold" placeholder="Leave empty to keep current" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} />
                      </div>
                      <div className="pt-4 flex gap-3">
                          <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 border rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancel</button>
                          <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800">Save Changes</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* INSPECTION MODAL */}
      {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                  <div className="bg-slate-900 p-6 flex justify-between items-start text-white">
                      <div>
                          <h3 className="text-xl font-bold flex items-center gap-2">
                              <Shield size={20} className="text-brand-400"/> Inspector: {selectedUser.username}
                          </h3>
                          <p className="text-slate-400 text-sm">{selectedUser.email} • ID: {selectedUser.id}</p>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white"><X size={24}/></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                              <p className="text-xs text-red-600 font-bold uppercase">Total Hutang</p>
                              <p className="text-lg font-black text-slate-900">{formatCurrency(selectedUser.totalDebt)}</p>
                          </div>
                          <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                              <p className="text-xs text-green-600 font-bold uppercase">Income</p>
                              <p className="text-lg font-black text-slate-900">{formatCurrency(selectedUser.totalIncome)}</p>
                          </div>
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                              <p className="text-xs text-blue-600 font-bold uppercase">DSR Status</p>
                              <p className={`text-lg font-black ${selectedUser.dsr > 50 ? 'text-red-600' : 'text-slate-900'}`}>{selectedUser.dsr.toFixed(1)}%</p>
                          </div>
                      </div>

                      <div>
                          <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><TrendingDown size={18}/> Detail Hutang (Realtime)</h4>
                          {inspectLoading ? (
                              <div className="text-center py-8"><Loader2 className="animate-spin mx-auto"/> Fetching data...</div>
                          ) : userDebts.length === 0 ? (
                              <p className="text-sm text-slate-400 italic">User ini tidak memiliki data hutang.</p>
                          ) : (
                              <div className="space-y-2">
                                  {userDebts.map(debt => (
                                      <div key={debt.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg">
                                          <div>
                                              <p className="font-bold text-slate-900 text-sm">{debt.name}</p>
                                              <p className="text-xs text-slate-500">{debt.bankName || 'Lending'} • {debt.type}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className="font-mono font-bold text-sm text-red-600">{formatCurrency(debt.remainingPrincipal)}</p>
                                              <p className="text-[10px] text-slate-400">Cicilan: {formatCurrency(debt.monthlyPayment)}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      {selectedUser.dsr > 50 && (
                          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
                              <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                              <div>
                                  <h5 className="font-bold text-amber-800 text-sm">Rekomendasi Admin</h5>
                                  <p className="text-xs text-amber-700 mt-1">User ini memiliki rasio hutang tinggi. Disarankan untuk tidak memberikan akses fitur premium atau pinjaman tambahan sampai DSR turun di bawah 40%.</p>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText="Hapus Data"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
