
import React, { useState, useEffect } from 'react';
import { getAllUsers, updateUser, deleteUser, getUserData, getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync';
import { User, Badge, BankData } from '../../types';
import { Search, UserCheck, UserX, Trash2, Edit2, Shield, Eye, Building2, AlertTriangle, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../services/financeUtils';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState<'users' | 'banks'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [banks, setBanks] = useState<BankData[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

  useEffect(() => {
    fetchUsers();
    
    // Load Banks (Mock for now, can be extended to API later)
    setBanks([
        { id: 'bca', name: 'BCA', type: 'KPR', promoRate: 4.5, fixedYear: 3 },
        { id: 'btn', name: 'BTN', type: 'KPR', promoRate: 5.0, fixedYear: 2 },
        { id: 'mandiri', name: 'Mandiri', type: 'KKB', promoRate: 3.5, fixedYear: 1 }
    ]);
  }, []);

  const fetchUsers = async () => {
      setLoading(true);
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';

      // 1. Try Cloud Fetch
      if (baseUrl) {
          try {
              const res = await fetch(`${baseUrl}/api/admin/users`, {
                  headers: getHeaders(adminId)
              });
              
              if (res.ok) {
                  const data = await res.json();
                  // Handle Direct Array Response (as per backend spec)
                  if (Array.isArray(data)) {
                      setUsers(data);
                      setIsCloud(true);
                  } else if (data.data && Array.isArray(data.data)) {
                      // Fallback for wrapped response
                      setUsers(data.data);
                      setIsCloud(true);
                  } else {
                      console.warn("Unexpected API format:", data);
                      loadLocalUsers();
                  }
              } else {
                  console.warn(`API Error ${res.status}: Switching to Local Data`);
                  loadLocalUsers();
              }
          } catch (e) {
              console.error("Connection Error:", e);
              loadLocalUsers();
          }
      } else {
          loadLocalUsers();
      }
      setLoading(false);
  };

  const loadLocalUsers = () => {
      setUsers(getAllUsers());
      setIsCloud(false);
  };

  const handleInspect = (user: User) => {
      // Logic to inspect user details (hybrid: try cloud then local)
      const data = getUserData(user.id);
      
      // Defensive checks for array properties
      const debts = data.debts || [];
      const incomes = data.incomes || [];
      
      const totalDebt = debts.reduce((a,b) => a + (b.remainingPrincipal || 0), 0);
      const income = incomes.reduce((a,b) => a + (b.amount || 0), 0);
      const dsr = income > 0 ? (debts.reduce((a,b) => a + (b.monthlyPayment || 0), 0) / income) * 100 : 0;
      
      setSelectedUser({ ...user, totalDebt, income, dsr });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(filter.toLowerCase()) || 
    u.email.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              Master Data 
              {isCloud ? <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase"><Cloud size={10}/> Cloud</span> : <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase"><CloudOff size={10}/> Local</span>}
          </h2>
          <p className="text-slate-500 text-sm">Manage users, banks, and system entities.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={fetchUsers} className="p-2 border rounded-lg hover:bg-slate-50 transition" title="Refresh Data">
                {loading ? <Loader2 className="animate-spin" size={18}/> : <Cloud size={18}/>}
            </button>
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'users' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>Users</button>
            <button onClick={() => setActiveTab('banks')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'banks' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}>Banks</button>
        </div>
      </div>

      {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex gap-4">
               <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search users..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
               </div>
            </div>

            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                 <tr>
                   <th className="px-6 py-4 font-semibold">User</th>
                   <th className="px-6 py-4 font-semibold">Role</th>
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
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className="capitalize bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{user.role}</span>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                            user.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                            {user.status}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => handleInspect(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16}/></button>
                        </div>
                     </td>
                   </tr>
                 ))}
                 {filteredUsers.length === 0 && (
                     <tr><td colSpan={4} className="p-8 text-center text-slate-400">No users found.</td></tr>
                 )}
              </tbody>
            </table>
          </div>
      )}

      {activeTab === 'banks' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {banks.map(bank => (
                      <div key={bank.id} className="p-4 rounded-xl border border-slate-200 hover:border-brand-300 transition group">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Building2 size={20}/></div>
                              <h3 className="font-bold text-slate-900">{bank.name}</h3>
                          </div>
                          <div className="space-y-2 text-sm text-slate-600">
                              <div className="flex justify-between"><span>Type</span><span className="font-bold">{bank.type}</span></div>
                              <div className="flex justify-between"><span>Promo Rate</span><span className="font-bold text-green-600">{bank.promoRate}%</span></div>
                              <div className="flex justify-between"><span>Fixed Period</span><span className="font-bold">{bank.fixedYear} Years</span></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                  <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><span className="text-xl">×</span></button>
                  
                  <div className="flex items-center gap-4 mb-6">
                      <div className="h-16 w-16 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500">
                          {selectedUser.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-slate-900">{selectedUser.username}</h3>
                          <p className="text-sm text-slate-500">{selectedUser.email}</p>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-500 uppercase font-bold">Total Debt</p>
                              <p className="text-lg font-black text-slate-900">{formatCurrency(selectedUser.totalDebt)}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-500 uppercase font-bold">Income</p>
                              <p className="text-lg font-black text-slate-900">{formatCurrency(selectedUser.income)}</p>
                          </div>
                      </div>
                      
                      <div className={`p-4 rounded-xl border-2 ${selectedUser.dsr > 50 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                          <div className="flex justify-between items-center mb-1">
                              <span className={`font-bold ${selectedUser.dsr > 50 ? 'text-red-700' : 'text-green-700'}`}>DSR Score</span>
                              <span className={`font-black text-xl ${selectedUser.dsr > 50 ? 'text-red-700' : 'text-green-700'}`}>{selectedUser.dsr.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-white/50 h-2 rounded-full overflow-hidden">
                              <div className={`h-full ${selectedUser.dsr > 50 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${Math.min(100, selectedUser.dsr)}%`}}></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
