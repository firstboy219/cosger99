
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Badge, BankAccount } from '../types';
import { getAllUsers, updateUser, availableBadges, addUser } from '../services/mockDb';
import { compressImage } from '../services/imageUtils';
import { User as UserIcon, Mail, Lock, Save, Camera, CheckCircle, AlertCircle, Shield, Award, Target, Flag, Loader2, Copy, Plus, Trash2, Landmark, CreditCard, X, Image as ImageIcon, Briefcase, Clock, Zap, Calendar, ArrowUpDown, Upload } from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';
import { saveItemToCloud, deleteFromCloud } from '../services/cloudSync';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FeatureGate from '../components/FeatureGate';
import { useFreemium } from '../services/freemiumStore';
import { Link } from 'react-router-dom';

interface ProfileProps {
  currentUserId: string | null;
  bankAccounts?: BankAccount[];
  setBankAccounts?: React.Dispatch<React.SetStateAction<BankAccount[]>>;
}

// Deterministic gradient cover based on username
const getCoverGradient = (username: string) => {
  const gradients = [
    'from-violet-900 via-purple-800 to-indigo-900',
    'from-slate-900 via-blue-900 to-slate-800',
    'from-emerald-900 via-teal-800 to-cyan-900',
    'from-rose-900 via-pink-800 to-fuchsia-900',
    'from-amber-800 via-orange-700 to-red-800',
    'from-blue-900 via-indigo-800 to-violet-900',
    'from-green-900 via-emerald-800 to-teal-900',
  ];
  const idx = (username.charCodeAt(0) || 0) % gradients.length;
  return gradients[idx];
};

// SVG pattern for cover texture
const CoverPattern = ({ gradient }: { gradient: string }) => (
  <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="cp" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M0 20 L20 0 L40 20 L20 40 Z" fill="none" stroke="white" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#cp)"/>
  </svg>
);

export default function Profile({ currentUserId, bankAccounts = [], setBankAccounts }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const { subscriptionStatus, isFreeTier } = useFreemium();
  
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '', 
    newPassword: '', 
    confirmPassword: '',
    bigWhyUrl: '',
    financialFreedomTarget: 3000000000,
    photoUrl: '',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Bank Form State
  const [isBankFormOpen, setIsBankFormOpen] = useState(false);
  const [bankFormData, setBankFormData] = useState<{
    bankName: string; accountNumber: string; holderName: string; color: string;
  }>({ bankName: '', accountNumber: '', holderName: '', color: 'bg-slate-900' });

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // File input refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUserId) return;
    const loadUser = () => {
      const users = getAllUsers();
      let found = users.find(u => u.id === currentUserId);
      if (!found) {
        found = {
          id: currentUserId, username: 'User', email: '', role: 'user' as const,
          status: 'active' as const, createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(), badges: [], financialFreedomTarget: 3000000000
        };
        addUser(found);
      }
      setUser(found);
      setFormData(prev => ({
        ...prev,
        username: found!.username,
        email: found!.email,
        bigWhyUrl: found!.bigWhyUrl || '',
        financialFreedomTarget: found!.financialFreedomTarget || 3000000000,
        photoUrl: found!.photoUrl || '',
      }));
    };
    loadUser();
    window.addEventListener('PAYDONE_DB_UPDATE', loadUser);
    return () => window.removeEventListener('PAYDONE_DB_UPDATE', loadUser);
  }, [currentUserId]);

  // ── PHOTO UPLOAD ──────────────────────────────────────────────────────────────
  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, isCover = false) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran file maksimal 5MB.'); return; }

    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: isCover ? 1200 : 400, quality: 0.75 });
      
      const field = isCover ? 'bigWhyUrl' : 'photoUrl';
      const updatedUser: User = { ...user, [field]: compressed, updatedAt: new Date().toISOString() };
      
      updateUser(updatedUser);
      setUser(updatedUser);
      setFormData(prev => ({ ...prev, [field]: compressed }));

      // Sync to cloud
      await saveItemToCloud('users', { ...updatedUser }, false);
      setMessage({ type: 'success', text: isCover ? 'Foto cover berhasil diupload.' : 'Foto profil berhasil diupload.' });
    } catch {
      setMessage({ type: 'error', text: 'Gagal mengupload foto.' });
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  }, [user]);

  // ── SAVE PROFILE ──────────────────────────────────────────────────────────────
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setMessage(null);

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
      photoUrl: formData.photoUrl,
      updatedAt: new Date().toISOString()
    };

    const payload: any = { ...updatedUser };
    if (formData.newPassword) payload.password = formData.newPassword;

    updateUser(updatedUser);
    setUser(updatedUser);

    try {
      const result = await saveItemToCloud('users', payload, false);
      if (result.success) {
        const msg = formData.newPassword
          ? 'Password & profil diperbarui. Silakan login kembali.'
          : 'Profil berhasil disimpan.';
        setMessage({ type: 'success', text: msg });
        setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
        if (formData.newPassword) {
          setTimeout(() => {
            localStorage.removeItem('paydone_session_token');
            localStorage.removeItem('paydone_active_user');
            window.location.href = '/#/login';
          }, 2000);
        }
      } else {
        setMessage({ type: 'error', text: 'Gagal sync ke cloud. Tersimpan lokal.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat menyimpan.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    const newBank: BankAccount = {
      id: `bank-${Date.now()}`, userId: currentUserId,
      bankName: bankFormData.bankName, accountNumber: bankFormData.accountNumber,
      holderName: bankFormData.holderName, balance: 0, color: bankFormData.color,
      type: 'Bank', updatedAt: new Date().toISOString()
    };
    if (setBankAccounts) setBankAccounts([...bankAccounts, newBank]);
    setIsBankFormOpen(false);
    setBankFormData({ bankName: '', accountNumber: '', holderName: '', color: 'bg-slate-900' });
    await saveItemToCloud('bankAccounts', newBank, true);
  };

  const handleDeleteBankClick = (id: string) => {
    setConfirmConfig({
      isOpen: true, title: 'Hapus Rekening?',
      message: 'Apakah Anda yakin ingin menghapus rekening ini?',
      onConfirm: () => {
        if (setBankAccounts) setBankAccounts(prev => prev.filter(b => b.id !== id));
        if (currentUserId) deleteFromCloud(currentUserId, 'bankAccounts', id);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCopyId = () => {
    if (user) { navigator.clipboard.writeText(user.id); alert('User ID copied!'); }
  };

  if (!currentUserId) return <div className="p-10 text-center text-slate-500">Session Invalid. Please Login.</div>;
  if (!user) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-brand-600 mb-4" size={32}/>
        <span className="text-slate-500 font-medium">Memuat Profil...</span>
        <button onClick={() => window.location.reload()} className="mt-4 text-xs text-brand-600 hover:underline">Refresh Halaman</button>
      </div>
    );
  }

  const coverGradient = getCoverGradient(user.username);
  const hasCover = !!(formData.bigWhyUrl || user.bigWhyUrl);
  const coverUrl = formData.bigWhyUrl || user.bigWhyUrl;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
      
      {/* Hidden file inputs */}
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, false)} />
      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, true)} />

      {/* ── HERO PROFILE SECTION ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Cover Area */}
        <div className={`h-52 relative bg-gradient-to-r ${coverGradient} group/cover cursor-pointer`}
             onClick={() => coverInputRef.current?.click()}>
          
          {/* Pattern overlay when no custom cover */}
          {!hasCover && <CoverPattern gradient={coverGradient} />}
          
          {/* Decorative elements for dummy cover */}
          {!hasCover && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-2 opacity-20 select-none">
                <div className="text-8xl font-black text-white tracking-tighter">{user.username.charAt(0).toUpperCase()}</div>
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/20">
                <ImageIcon size={12} className="text-white/60" />
                <span className="text-[10px] text-white/60 font-bold">Tambah foto cover</span>
              </div>
            </div>
          )}
          
          {/* Custom cover image */}
          {hasCover && coverUrl && (
            <div className="absolute inset-0">
              <img src={coverUrl} className="w-full h-full object-cover" alt="Cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
            </div>
          )}

          {/* Cover hover overlay */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity backdrop-blur-[1px]">
            {photoUploading ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : (
              <div className="text-center">
                <Camera size={28} className="text-white mx-auto mb-2" />
                <p className="text-white text-xs font-bold">{hasCover ? 'Ganti Foto Cover' : 'Upload Foto Cover'}</p>
                <p className="text-white/60 text-[10px] mt-1">Klik untuk memilih gambar</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-8 pb-8 flex flex-col md:flex-row items-end md:items-center gap-6 -mt-16 relative z-10">
          
          {/* Avatar with upload */}
          <div className="relative group/avatar flex-shrink-0">
            <div className="h-32 w-32 rounded-3xl bg-white p-1.5 shadow-xl rotate-3 transition-transform group-hover/avatar:rotate-0">
              <div className="h-full w-full bg-brand-100 rounded-2xl flex items-center justify-center text-4xl font-black text-brand-600 overflow-hidden relative">
                {(formData.photoUrl || user.photoUrl) ? (
                  <img src={formData.photoUrl || user.photoUrl} alt={user.username} className="w-full h-full object-cover"/>
                ) : (
                  <span>{user.username.charAt(0).toUpperCase()}</span>
                )}
                {/* Avatar upload overlay */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                >
                  {photoUploading ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <>
                      <Camera size={20} className="text-white mb-1" />
                      <span className="text-[9px] text-white font-bold">Ganti Foto</span>
                    </>
                  )}
                </button>
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

        {/* Paket Aktif */}
        <div className="px-8 pb-6">
          <div className={`p-4 rounded-2xl border ${isFreeTier ? 'bg-slate-50 border-slate-200' : 'bg-gradient-to-r from-brand-50 to-indigo-50 border-brand-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${isFreeTier ? 'bg-slate-200' : 'bg-brand-100'}`}>
                  <Zap size={18} className={isFreeTier ? 'text-slate-500' : 'text-brand-600'} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paket Aktif</p>
                  <p className={`text-sm font-black ${isFreeTier ? 'text-slate-700' : 'text-brand-700'}`}>
                    {isFreeTier ? 'Free Plan' : (subscriptionStatus.currentPackage || 'Premium Plan')}
                  </p>
                  {!isFreeTier && subscriptionStatus.expiryDate && (() => {
                    const expiry = new Date(subscriptionStatus.expiryDate);
                    const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysLeft <= 7;
                    return (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        <span className={`text-[11px] font-bold flex items-center gap-1 ${daysLeft <= 0 ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-500'}`}>
                          <Calendar size={11} />
                          {daysLeft <= 0 ? 'Tagihan terlambat' : `Tagihan dalam ${daysLeft} hari (${expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`}
                        </span>
                        {(subscriptionStatus.amountPaid ?? 0) > 0 && (
                          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                            <CreditCard size={11} />
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(subscriptionStatus.amountPaid!)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {subscriptionStatus.inGracePeriod && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1">⚠ Grace period — {subscriptionStatus.daysLeftGrace} hari tersisa</p>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {isFreeTier ? (
                  <Link to="/app/upgrade" className="px-4 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-brand-600 transition shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                    <Zap size={12} /> Upgrade
                  </Link>
                ) : (
                  <Link to="/app/upgrade" className="px-3 py-2 bg-white text-brand-700 text-xs font-black border border-brand-200 rounded-xl hover:bg-brand-50 transition shadow-sm flex items-center gap-1.5 whitespace-nowrap">
                    <ArrowUpDown size={12} /> Ubah Paket
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ALL SETTINGS WRAPPED IN ONE FORM ─────────────────────────────────── */}
      <form onSubmit={handleUpdateProfile}>
        
        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ── LEFT COL: BANK & BADGES ─────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* REKENING BANK */}
            <FeatureGate featureKey="bank_accounts" fallback="lock" title="Dompet & Bank">
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><CreditCard size={18} className="text-blue-600"/> Dompet & Bank</h3>
                  <button type="button" onClick={() => setIsBankFormOpen(true)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition">
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
                          <button type="button" onClick={() => handleDeleteBankClick(acc.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-200 transition p-1 hover:bg-white/10 rounded"><Trash2 size={14}/></button>
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

          {/* ── RIGHT COL: SETTINGS ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* TUJUAN FINANSIAL */}
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
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">The Big Why (Cover Profil)</label>
                  
                  {/* Cover preview thumbnail */}
                  {(formData.bigWhyUrl || user.bigWhyUrl) && (
                    <div className="mb-3 relative rounded-xl overflow-hidden h-20 border border-slate-200 group/prev">
                      <img src={formData.bigWhyUrl || user.bigWhyUrl} alt="Cover" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setFormData(f => ({...f, bigWhyUrl: ''})); }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover/prev:opacity-100 transition"
                        title="Hapus cover"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ImageIcon className="absolute left-3 top-3 text-slate-400" size={14}/>
                      <input
                        type="text"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-medium focus:border-brand-500 outline-none transition truncate"
                        placeholder="https://... atau upload file"
                        value={formData.bigWhyUrl.startsWith('data:') ? '(foto terupload)' : formData.bigWhyUrl}
                        onChange={e => {
                          if (!e.target.value.startsWith('(')) setFormData({...formData, bigWhyUrl: e.target.value});
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={photoUploading}
                      className="px-3 py-2.5 bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap"
                    >
                      {photoUploading ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>}
                      Upload
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Gambar motivasi (Rumah impian, Haji, dll) untuk cover profil.
                  </p>
                </div>
              </div>
            </div>

            {/* AKUN & KEAMANAN */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6"><Briefcase size={18} className="text-slate-600"/> Akun & Keamanan</h3>

              <div className="space-y-6">
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
                    Simpan Semua Perubahan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* BANK ACCOUNT MODAL */}
      {isBankFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl border border-white/20 relative overflow-hidden">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><CreditCard size={20} className="text-brand-600"/> Tambah Rekening</h3>
            
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
                      key={color} type="button"
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


interface ProfileProps {
  currentUserId: string | null;
  bankAccounts?: BankAccount[];
  setBankAccounts?: React.Dispatch<React.SetStateAction<BankAccount[]>>;
}

export default function Profile({ currentUserId, bankAccounts = [], setBankAccounts }: ProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const { subscriptionStatus, isFreeTier } = useFreemium();
  
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
          updatedAt: new Date().toISOString()
      };

      // [V50.70 FIX] Include password in payload if user changed it
      // saveItemToCloud → api.put('/users/:id') → backend now saves all profile fields
      const payload: any = { ...updatedUser };
      if (formData.newPassword) {
          payload.password = formData.newPassword;
      }

      // 1. Update Local
      updateUser(updatedUser);
      setUser(updatedUser);

      // 2. Sync to Cloud
      try {
          const result = await saveItemToCloud('users', payload, false);
          if (result.success) {
              const msg = formData.newPassword
                  ? 'Password & profil diperbarui. Silakan login kembali.'
                  : 'Profil berhasil diperbarui.';
              setMessage({ type: 'success', text: msg });
              // Clear password fields after successful save
              setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
              // If password changed, force logout after short delay
              if (formData.newPassword) {
                  setTimeout(() => {
                      localStorage.removeItem('paydone_session_token');
                      localStorage.removeItem('paydone_active_user');
                      window.location.href = '/#/login';
                  }, 2000);
              }
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

          {/* Paket Aktif — billing info + action buttons */}
          <div className="px-8 pb-6">
            <div className={`p-4 rounded-2xl border ${isFreeTier ? 'bg-slate-50 border-slate-200' : 'bg-gradient-to-r from-brand-50 to-indigo-50 border-brand-200'}`}>
              <div className="flex items-start justify-between gap-3">
                {/* Left: plan info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${isFreeTier ? 'bg-slate-200' : 'bg-brand-100'}`}>
                    <Zap size={18} className={isFreeTier ? 'text-slate-500' : 'text-brand-600'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paket Aktif</p>
                    <p className={`text-sm font-black ${isFreeTier ? 'text-slate-700' : 'text-brand-700'}`}>
                      {isFreeTier ? 'Free Plan' : (subscriptionStatus.currentPackage || 'Premium Plan')}
                    </p>

                    {/* Billing countdown + nominal — only for premium */}
                    {!isFreeTier && subscriptionStatus.expiryDate && (() => {
                      const expiry = new Date(subscriptionStatus.expiryDate);
                      const today = new Date();
                      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isUrgent = daysLeft <= 7;
                      const isExpired = daysLeft <= 0;
                      return (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          <span className={`text-[11px] font-bold flex items-center gap-1 ${isExpired ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-500'}`}>
                            <Calendar size={11} />
                            {isExpired
                              ? 'Tagihan terlambat'
                              : `Tagihan dalam ${daysLeft} hari (${expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})`
                            }
                          </span>
                          {(subscriptionStatus.amountPaid ?? 0) > 0 && (
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                              <CreditCard size={11} />
                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(subscriptionStatus.amountPaid!)}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Grace period warning */}
                    {subscriptionStatus.inGracePeriod && (
                      <p className="text-[10px] text-amber-600 font-bold mt-1">
                        ⚠ Grace period — {subscriptionStatus.daysLeftGrace} hari tersisa
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: action button */}
                <div className="shrink-0">
                  {isFreeTier ? (
                    <Link
                      to="/app/upgrade"
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-brand-600 transition shadow-lg flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Zap size={12} /> Upgrade
                    </Link>
                  ) : (
                    <Link
                      to="/app/upgrade"
                      className="px-3 py-2 bg-white text-brand-700 text-xs font-black border border-brand-200 rounded-xl hover:bg-brand-50 transition shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <ArrowUpDown size={12} /> Ubah Paket
                    </Link>
                  )}
                </div>
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
