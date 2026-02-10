
import React, { useState, useEffect } from 'react';
import { User, Badge } from '../types';
import { getAllUsers, updateUser, availableBadges } from '../services/mockDb';
import { User as UserIcon, Mail, Lock, Save, Camera, CheckCircle, AlertCircle, Shield, Award, Target, Flag, Loader2, Copy } from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';

interface ProfileProps {
  currentUserId: string | null;
}

export default function Profile({ currentUserId }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ username: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [magicNumber, setMagicNumber] = useState(3000000000); // 3M default
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    if (currentUserId) {
      const users = getAllUsers();
      const found = users.find(u => u.id === currentUserId);
      if (found) {
        setUser(found);
        setFormData(prev => ({ ...prev, username: found.username, email: found.email }));
      }
    }
  }, [currentUserId]);

  const handleUpdateProfile = (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      setIsSaving(true);
      setMessage(null);

      // Simple Password Validation logic
      if (formData.newPassword) {
          if (formData.newPassword !== formData.confirmPassword) {
              setMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' });
              setIsSaving(false);
              return;
          }
          if (formData.newPassword.length < 6) {
              setMessage({ type: 'error', text: 'Password minimal 6 karakter.' });
              setIsSaving(false);
              return;
          }
          // In real app, verify currentPassword here against DB hash
      }

      setTimeout(() => {
          const updatedUser: User = {
              ...user,
              username: formData.username,
              email: formData.email,
              password: formData.newPassword ? formData.newPassword : user.password // Update if changed
          };
          
          updateUser(updatedUser);
          setUser(updatedUser);
          
          // Clear password fields
          setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
          
          setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' });
          setIsSaving(false);
      }, 1000);
  };

  const handleCopyId = () => {
      if (user?.id) {
          navigator.clipboard.writeText(user.id);
          alert("ID Copied!");
      }
  };

  if (!user) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-600"/> Memuat Profil...</div>;

  const earnedBadges = availableBadges.filter(b => user.badges?.includes(b.id));

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      
      {/* Header Profile & Big Why */}
      <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center h-fit">
             <div className="relative inline-block mb-4 group cursor-pointer">
                <div className="h-24 w-24 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-3xl font-bold mx-auto border-4 border-white shadow-lg overflow-hidden">
                    {user.photoUrl ? (
                        <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        user.username.charAt(0).toUpperCase()
                    )}
                </div>
                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white" size={24} />
                </div>
             </div>
             <h3 className="font-bold text-lg text-slate-900">{user.username}</h3>
             <p className="text-sm text-slate-500 mb-4">{user.email}</p>
             
             {/* User ID Display */}
             <div className="flex justify-center mb-4">
                 <button onClick={handleCopyId} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-200 transition group" title="Copy User ID">
                     <Shield size={12} className="text-slate-400"/> 
                     <span className="font-mono">{user.id}</span>
                     <Copy size={12} className="opacity-0 group-hover:opacity-100"/>
                 </button>
             </div>

             <div className="flex justify-center gap-2">
                 <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 uppercase">{user.status}</span>
                 <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 uppercase">{user.role}</span>
             </div>
          </div>

          {/* The Big Why (Vision) */}
          <div className="md:col-span-2 bg-slate-900 rounded-xl shadow-lg relative overflow-hidden group">
             {user.bigWhyUrl ? (
                 <img src={user.bigWhyUrl} alt="Big Why" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition duration-500" />
             ) : (
                 <div className="w-full h-full bg-gradient-to-r from-indigo-900 to-slate-900 opacity-80"></div>
             )}
             <div className="absolute inset-0 flex flex-col justify-center items-center p-8 text-center z-10">
                 <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">"The Big Why"</h2>
                 <p className="text-slate-200 text-lg max-w-lg mx-auto drop-shadow-md italic">
                    "Alasan utama saya berjuang bebas finansial adalah untuk memberikan pendidikan terbaik bagi anak-anak dan pergi Haji bersama orang tua."
                 </p>
                 <button className="mt-6 px-6 py-2 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-full text-sm hover:bg-white/30 transition">
                    Ganti Foto Impian
                 </button>
             </div>
          </div>
      </div>

      {/* Gamification & Goals */}
      <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Award className="text-yellow-500"/> Badge Koleksi</h3>
              <div className="grid grid-cols-4 gap-4">
                  {availableBadges.map(badge => {
                      const isEarned = user.badges?.includes(badge.id);
                      return (
                          <div key={badge.id} className={`flex flex-col items-center text-center p-3 rounded-xl border ${isEarned ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100 grayscale opacity-50'}`}>
                              <div className={`text-2xl mb-2 ${badge.color}`}>
                                  {badge.icon === 'trophy' ? '🏆' : badge.icon === 'shield' ? '🛡️' : '⏰'}
                              </div>
                              <p className="text-xs font-bold text-slate-700">{badge.name}</p>
                          </div>
                      );
                  })}
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Target className="text-red-500"/> Financial Freedom Calculator</h3>
              <div className="space-y-4">
                  <div>
                      <label className="text-xs text-slate-500 uppercase font-bold">Magic Number (Target Aset)</label>
                      <input 
                        type="number" 
                        value={magicNumber} 
                        onChange={e => setMagicNumber(Number(e.target.value))}
                        className="w-full text-2xl font-bold text-slate-900 border-b border-slate-300 focus:border-brand-600 outline-none py-2"
                      />
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                      <p>Untuk pensiun tenang dengan gaya hidup saat ini, Anda memerlukan aset produktif senilai <strong>{formatCurrency(magicNumber)}</strong> yang menghasilkan <strong>{formatCurrency(magicNumber * 0.05 / 12)}/bulan</strong> (Asumsi return 5%).</p>
                  </div>
              </div>
          </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><Shield size={20} className="text-brand-600"/> Edit Profil & Keamanan</h3>
          
          {message && (
              <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {message.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                  {message.text}
              </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
                      <div className="relative">
                          <UserIcon size={18} className="absolute left-3 top-2.5 text-slate-400" />
                          <input 
                            type="text" required
                            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none" 
                            value={formData.username} 
                            onChange={e => setFormData({...formData, username: e.target.value})}
                          />
                      </div>
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                      <div className="relative">
                          <Mail size={18} className="absolute left-3 top-2.5 text-slate-400" />
                          <input 
                            type="email" required
                            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none" 
                            value={formData.email} 
                            onChange={e => setFormData({...formData, email: e.target.value})}
                          />
                      </div>
                  </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                  <h4 className="font-bold text-slate-900 mb-4 text-sm">Ganti Password (Opsional)</h4>
                  <div className="grid md:grid-cols-3 gap-6">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Password Saat Ini</label>
                          <input 
                            type="password" 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="********"
                            value={formData.currentPassword}
                            onChange={e => setFormData({...formData, currentPassword: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Password Baru</label>
                          <input 
                            type="password" 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="Minimal 6 karakter"
                            value={formData.newPassword}
                            onChange={e => setFormData({...formData, newPassword: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Konfirmasi Password</label>
                          <input 
                            type="password" 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" 
                            placeholder="Ulangi password baru"
                            value={formData.confirmPassword}
                            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                          />
                      </div>
                  </div>
              </div>

              <div className="mt-4 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex items-center gap-2 disabled:opacity-70 transition shadow-lg"
                  >
                      {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Simpan Perubahan
                  </button>
              </div>
          </form>
      </div>

    </div>
  );
}
