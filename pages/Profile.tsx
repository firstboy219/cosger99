
import React, { useState, useEffect } from 'react';
import { User, Badge, BankAccount } from '../types';
import { getAllUsers, updateUser, availableBadges } from '../services/mockDb';
import { User as UserIcon, Mail, Lock, Save, Camera, CheckCircle, AlertCircle, Shield, Award, Target, Flag, Loader2, Copy, Plus, Trash2, Landmark, CreditCard, X, Image as ImageIcon, Briefcase, Clock } from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';
import { saveItemToCloud, deleteFromCloud } from '../services/cloudSync';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FeatureGate from '../components/FeatureGate';

interface ProfileProps {
  currentUserId: string | null;
  bankAccounts?: BankAccount[];
  setBankAccounts?: React.Dispatch<React.SetStateAction<BankAccount[]>>;
}

export default function Profile({ currentUserId, bankAccounts = [], setBankAccounts }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  
  // Unified Form State
  const [formData, setFormData] = useState({ 
      username: '', 
      email: '', 
      currentPassword: '', 
      newPassword: '', 
      confirmPassword: '',
      bigWhyUrl: '',
      financialFreedomTarget: 0
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Bank Form State
  const [isBankFormOpen, setIsBankFormOpen] = useState(false);
  const [bankFormData, setBankFormData] = useState<{
      bankName: string;
      accountNumber: string;
      holderName: string;
      color: string;
  }>({ bankName: '', accountNumber: '', holderName: '', color: 'bg-slate-900' });

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (currentUserId) {
      const loadUser = () => {
          const users = getAllUsers();
          let found = users.find(u => u.id === currentUserId);
          
          // Fallback: If user not found in local DB, create a minimal entry
          // This can happen if the sync response didn't include users array
          if (!found) {
              found = {
                  id: currentUserId,
                  username: 'User',
                  email: '',
                  role: 'user' as const,
                  status: 'active' as const,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  badges: [],
                  financialFreedomTarget: 3000000000
              };
              // Persist this fallback user so subsequent lookups work
              const { addUser } = require('../services/mockDb');
              addUser(found);
          }
          
          setUser(found);
          setFormData(prev => ({ 
              ...prev, 
              username: found!.username, 
              email: found!.email,
              bigWhyUrl: found!.bigWhyUrl || '',
              financialFreedomTarget: found!.financialFreedomTarget || 3000000000
          }));
      };

      loadUser();
      
      // Listen for DB updates to retry/refresh
      const handleDbUpdate = () => loadUser();
      window.addEventListener('PAYDONE_DB_UPDATE', handleDbUpdate);
      return () => window.removeEventListener('PAYDONE_DB_UPDATE', handleDbUpdate);
    }
  }, [currentUserId]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      setIsSaving(true);
      setMessage(null);

      // Password Validation
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
          setMessage({ type: 'error', text: 'Password baru tidak cocok.' });
          setIsSaving(false);
          return;
      }

      const updatedUser: User = {
          ...user,
          username: formData.username,
          email: formData.email,
          bigWhyUrl: formData.bigWhyUrl,
          financialFreedomTarget: formData.financialFreedomTarget,
          updatedAt: new Date().toISOString() // Explicitly update timestamp
      };

      // 1. Update Local
      updateUser(updatedUser);
      setUser(updatedUser);

      // 2. Sync to Cloud
      try {
          const result = await saveItemToCloud('users', updatedUser, false);
          if (result.success) {
              setMessage({ type: 'success', text: 'Profil berhasil diperbarui.' });
          } else {
              setMessage({ type: 'error', text: 'Gagal sync ke cloud. Tersimpan lokal.' });
          }
      } catch (err) {
          setMessage({ type: 'error', text: 'Terjadi kesalahan saat menyimpan.' });
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUserId) return;

      const newBank: BankAccount = {
          id: `bank-${Date.now()}`,
          userId: currentUserId,
          bankName: bankFormData.bankName,
          accountNumber: bankFormData.accountNumber,
          holderName: bankFormData.holderName,
          balance: 0,
          color: bankFormData.color,
          type: 'Bank',
          updatedAt: new Date().toISOString()
      };

      // Optimistic Update
      const updatedBanks = [...bankAccounts, newBank];
      if (setBankAccounts) setBankAccounts(updatedBanks);
      setIsBankFormOpen(false);
      setBankFormData({ bankName: '', accountNumber: '', holderName: '', color: 'bg-slate-900' });

      // Cloud Sync
      await saveItemToCloud('bankAccounts', newBank, true);
  };

  const handleDeleteBankClick = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Hapus Rekening?",
          message: "Apakah Anda yakin ingin menghapus rekening ini?",
          onConfirm: () => {
              executeDeleteBank(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const executeDeleteBank = async (id: string) => {
      if (setBankAccounts) setBankAccounts(prev => prev.filter(b => b.id !== id));
      if (currentUserId) await deleteFromCloud(currentUserId, 'bankAccounts', id);
  };

  const handleCopyId = () => {
      if (user) {
          navigator.clipboard.writeText(user.id);
          alert("User ID copied to clipboard!");
      }
  };

  if (!currentUserId) return <div className="p-10 text-center text-slate-500">Session Invalid. Please Login.</div>;
  
  // If user is null but we have currentUserId, it might be loading or failed.
  // We'll show a timeout-based fallback if it takes too long, but for now let's just
  // render a "Profile Not Found" if user is null after a short delay, or just render the form with empty values if we want to be resilient.
  // Actually, let's just check if we have user. If not, show a "Reloading..." or "Syncing..." message.
  
  if (!user) {
      return (
          <div className="p-20 text-center flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-brand-600 mb-4" size={32}/> 
              <span className="text-slate-500 font-medium">Memuat Profil...</span>
              <button onClick={() => window.location.reload()} className="mt-4 text-xs text-brand-600 hover:underline">Refresh Halaman</button>
          </div>
      );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
      
      {/* 1. HERO PROFILE SECTION */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          {/* Cover Area */}
          <div className="h-48 bg-gradient-to-r from-slate-900 to-slate-800 relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              {user.bigWhyUrl && (
                  <div className="absolute inset-0">
                      <img src={user.bigWhyUrl} className="w-full h-full object-cover opacity-30 mix-blend-overlay" alt="Cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                  </div>
              )}
          </div>
          
          <div className="px-8 pb-8 flex flex-col md:flex-row items-end md:items-center gap-6 -mt-16 relative z-10">
              {/* Avatar */}
              <div className="relative group">
                  <div className="h-32 w-32 rounded-3xl bg-white p-1.5 shadow-xl rotate-3 transition-transform group-hover:rotate-0">
                      <div className="h-full w-full bg-brand-100 rounded-2xl flex items-center justify-center text-4xl font-black text-brand-600 overflow-hidden relative">
                          {user.photoUrl ? (
                              <img src={user.photoUrl} alt={user.username} className="w-full h-full object-cover"/>
                          ) : (
                              user.username.charAt(0).toUpperCase()
                          )}
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                              <Camera className="text-white" size={24}/>
                          </div>
                      </div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-green-500 w-5 h-5 rounded-full border-4 border-white"></div>
              </div>

              {/* Info */}
              <div className="flex-1 mb-2">
                  <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
                      {user.username} 
                      {user.role === 'admin' && <Shield className="text-purple-600 fill-purple-100" size={24}/>}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-slate-500 font-medium mt-1">
                      <span className="flex items-center gap-1"><Mail size={14}/> {user.email}</span>
                      <span className="text-slate-300">•</span>
                      <button onClick={handleCopyId} className="flex items-center gap-1 hover:text-brand-600 transition group">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs group-hover:bg-brand-50">ID: {user.id.substring(0, 8)}...</span>
                          <Copy size={12}/>
                      </button>
                  </div>
                  {user.updatedAt && (
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                          <Clock size={10}/> Last Updated: {new Date(user.updatedAt).toLocaleString()}
                      </p>
                  )}
              </div>

              {/* Stats */}
              <div className="flex gap-4">
                  <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Badge</p>
                      <p className="text-xl font-black text-slate-900">{user.badges?.length || 0}</p>
                  </div>
                  <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                      <p className="text-xl font-black text-green-600 capitalize">{user.status}</p>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COL: BANK ACCOUNTS & BADGES */}
          <div className="lg:col-span-1 space-y-8">
              
              {/* REKENING BANK */}
              <FeatureGate featureKey="bank_accounts" fallback="lock" title="Dompet & Bank">
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2"><CreditCard size={18} className="text-blue-600"/> Dompet & Bank</h3>
                      <button onClick={() => setIsBankFormOpen(true)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition">
                          <Plus size={16}/>
                      </button>
                  </div>

                  <div className="space-y-3">
                      {bankAccounts.length === 0 ? (
                          <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                              <Landmark size={32} className="mx-auto text-slate-300 mb-2"/>
                              <p className="text-xs text-slate-400 font-medium">Belum ada rekening.</p>
                          </div>
                      ) : (
                          bankAccounts.map(acc => (
                              <div key={acc.id} className={`p-4 rounded-2xl border relative group text-white shadow-md transition-all hover:scale-[1.02] ${acc.color || 'bg-slate-900'}`}>
                                  <div className="flex justify-between items-start mb-4">
                                      <span className="text-xs font-black uppercase tracking-widest opacity-80">{acc.bankName}</span>
                                      <button onClick={() => handleDeleteBankClick(acc.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-200 transition p-1 hover:bg-white/10 rounded"><Trash2 size={14}/></button>
                                  </div>
                                  <p className="font-mono text-lg tracking-wider mb-1">{acc.accountNumber || '****'}</p>
                                  <p className="text-[10px] font-bold uppercase opacity-70">{acc.holderName}</p>
                              </div>
                          ))
                      )}
                  </div>
              </div>
              </FeatureGate>

              {/* BADGES */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6"><Award size={18} className="text-yellow-500"/> Pencapaian</h3>
                  <div className="grid grid-cols-3 gap-3">
                      {availableBadges.map(badge => {
                          const isEarned = user.badges?.includes(badge.id);
                          return (
                              <div key={badge.id} className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 text-center border transition-all ${isEarned ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-slate-50 border-slate-100 grayscale opacity-40'}`}>
                                  <div className={`text-2xl mb-1 ${badge.color}`}>
                                      {badge.icon === 'trophy' ? '🏆' : badge.icon === 'shield' ? '🛡️' : '⏰'}
                                  </div>
                                  <p className="text-[9px] font-bold text-slate-700 leading-tight">{badge.name}</p>
                              </div>
                          );
                      })}
                  </div>
              </div>

          </div>

          {/* RIGHT COL: SETTINGS FORM */}
          <div className="lg:col-span-2 space-y-8">
              
              {/* BIG WHY & TARGET */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition duration-700"><Target size={150}/></div>
                  
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6 relative z-10"><Flag size={18} className="text-red-500"/> Tujuan Finansial</h3>
                  
                  <div className="grid md:grid-cols-2 gap-8 relative z-10">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Financial Freedom Number</label>
                          <div className="relative">
                              <span className="absolute left-4 top-3.5 font-bold text-slate-400 text-sm">Rp</span>
                              <input 
                                type="number" 
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-black text-xl text-slate-900 focus:border-brand-500 outline-none transition"
                                value={formData.financialFreedomTarget}
                                onChange={e => setFormData({...formData, financialFreedomTarget: Number(e.target.value)})}
                              />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                              Target aset produktif agar bisa pensiun dini dengan gaya hidup saat ini.
                          </p>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">The Big Why (Image URL)</label>
                          <div className="relative">
                              <ImageIcon className="absolute left-4 top-3.5 text-slate-400" size={16}/>
                              <input 
                                type="text" 
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-brand-500 outline-none transition truncate"
                                placeholder="https://..."
                                value={formData.bigWhyUrl}
                                onChange={e => setFormData({...formData, bigWhyUrl: e.target.value})}
                              />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                              Link gambar motivasi (Rumah impian, Haji, Pendidikan anak) untuk cover profil.
                          </p>
                      </div>
                  </div>
              </div>

              {/* ACCOUNT SETTINGS */}
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6"><Briefcase size={18} className="text-slate-600"/> Akun & Keamanan</h3>
                  
                  {message && (
                      <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                          {message.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
                          {message.text}
                      </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Username</label>
                              <div className="relative">
                                  <UserIcon size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                                  <input 
                                    type="text" required
                                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-brand-500 outline-none transition"
                                    value={formData.username}
                                    onChange={e => setFormData({...formData, username: e.target.value})}
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Email Address</label>
                              <div className="relative">
                                  <Mail size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                                  <input 
                                    type="email" required
                                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-brand-500 outline-none transition"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                  />
                              </div>
                          </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100">
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-4">Ganti Password (Opsional)</label>
                          <div className="grid md:grid-cols-2 gap-6">
                              <div className="relative">
                                  <Lock size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                                  <input 
                                    type="password" 
                                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-brand-500 outline-none transition"
                                    placeholder="Password Baru"
                                    value={formData.newPassword}
                                    onChange={e => setFormData({...formData, newPassword: e.target.value})}
                                  />
                              </div>
                              <div className="relative">
                                  <CheckCircle size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                                  <input 
                                    type="password" 
                                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-brand-500 outline-none transition"
                                    placeholder="Konfirmasi Password"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                  />
                              </div>
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end">
                          <button 
                            type="submit" 
                            disabled={isSaving}
                            className="px-8 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-brand-600 transition shadow-xl hover:shadow-brand-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                          >
                              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                              Simpan Perubahan
                          </button>
                      </div>
                  </form>
              </div>

          </div>
      </div>

      {/* BANK ACCOUNT MODAL */}
      {isBankFormOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
               <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl border border-white/20 relative overflow-hidden">
                   <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><CreditCard size={20} className="text-brand-600"/> Tambah Rekening</h3>
                   
                   {/* CARD PREVIEW */}
                   <div className={`w-full aspect-video rounded-2xl p-6 text-white shadow-xl mb-6 relative overflow-hidden transition-colors duration-500 ${bankFormData.color}`}>
                       <div className="absolute top-0 right-0 p-4 opacity-20"><Landmark size={80}/></div>
                       <div className="relative z-10 flex flex-col justify-between h-full">
                           <div className="flex justify-between items-start">
                               <span className="font-bold tracking-widest uppercase text-sm">{bankFormData.bankName || 'BANK NAME'}</span>
                               <Target size={20}/>
                           </div>
                           <div>
                               <p className="font-mono text-lg tracking-widest mb-1">{bankFormData.accountNumber || '0000 0000 0000'}</p>
                               <div className="flex justify-between items-end">
                                   <p className="text-[10px] uppercase opacity-80">{bankFormData.holderName || 'HOLDER NAME'}</p>
                                   <p className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded">SOURCE ID</p>
                               </div>
                           </div>
                       </div>
                   </div>

                   <form onSubmit={handleSaveBank} className="space-y-4">
                       <input className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-500" placeholder="Nama Bank (BCA, Mandiri...)" value={bankFormData.bankName} onChange={e => setBankFormData({...bankFormData, bankName: e.target.value})} required />
                       <input className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-mono outline-none focus:border-brand-500" placeholder="Nomor Rekening (Optional)" value={bankFormData.accountNumber} onChange={e => setBankFormData({...bankFormData, accountNumber: e.target.value})} />
                       <input className="w-full border-2 border-slate-100 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-500" placeholder="Nama Pemilik" value={bankFormData.holderName} onChange={e => setBankFormData({...bankFormData, holderName: e.target.value})} required />
                       
                       <div>
                           <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Warna Kartu</label>
                           <div className="flex gap-2 justify-center">
                               {['bg-slate-900', 'bg-blue-600', 'bg-green-600', 'bg-red-600', 'bg-purple-600', 'bg-amber-500', 'bg-indigo-600'].map(color => (
                                   <button 
                                     key={color}
                                     type="button" 
                                     className={`w-6 h-6 rounded-full ${color} ${bankFormData.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                                     onClick={() => setBankFormData({...bankFormData, color})}
                                   />
                               ))}
                           </div>
                       </div>

                       <div className="flex gap-3 pt-2">
                           <button type="button" onClick={() => setIsBankFormOpen(false)} className="flex-1 py-3 border-2 border-slate-100 rounded-xl font-bold text-slate-500 hover:bg-slate-50 text-xs uppercase tracking-widest">Batal</button>
                           <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg text-xs uppercase tracking-widest">Simpan</button>
                       </div>
                   </form>
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
         confirmText="Hapus"
         cancelText="Batal"
         variant="danger"
       />
    </div>
  );
}
