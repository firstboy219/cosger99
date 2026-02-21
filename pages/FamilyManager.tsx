
import React, { useState, useEffect } from 'react';
import { getAllUsers, addUser, deleteUser } from '../services/mockDb';
import { User } from '../types';
import { Users, Plus, Trash2, Mail, UserPlus, Shield, Crown, Heart, Copy, Check } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function FamilyManager() {
  const [subUsers, setSubUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'Member' });
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Get current user ID (Mocked as 'u2' for user role in this demo context)
  const currentUserId = 'u2'; 

  useEffect(() => {
    const all = getAllUsers();
    setSubUsers(all.filter(u => u.parentUserId === currentUserId));
  }, []);

  const handleAddSubUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
        id: `sub-${Date.now()}`,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: 'user', // System role
        status: 'active',
        parentUserId: currentUserId,
        createdAt: new Date().toISOString()
    };
    addUser(newUser);
    setSubUsers(prev => [...prev, newUser]);
    setIsModalOpen(false);
    setFormData({ username: '', email: '', password: '', role: 'Member' });
  };

  const handleDeleteClick = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Hapus Anggota?",
          message: "Apakah Anda yakin ingin menghapus anggota keluarga ini?",
          onConfirm: () => {
              handleDelete(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleDelete = (id: string) => {
      deleteUser(id);
      setSubUsers(prev => prev.filter(u => u.id !== id));
  };

  const generateInvite = () => {
      setInviteLink(`https://paydone.id/join-family/${Math.random().toString(36).substr(2, 8)}`);
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-10">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold flex items-center gap-3">
              <Users className="text-yellow-400" /> Pasukan Keluarga
          </h2>
          <p className="text-slate-300 mt-2 max-w-lg">
              Kelola keuangan bersama pasangan atau anak. Satu visi, satu tujuan bebas finansial.
          </p>
        </div>
        <div className="relative z-10 flex gap-3">
            <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition shadow-lg transform hover:-translate-y-0.5"
            >
            <UserPlus size={18} />
            Tambah Anggota
            </button>
        </div>
        
        {/* Background Decorations */}
        <div className="absolute right-0 top-0 p-8 opacity-5"><Crown size={200} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         
         {/* INVITE CARD */}
         <div className="lg:col-span-1 bg-white rounded-2xl border border-dashed border-slate-300 p-6 flex flex-col items-center justify-center text-center space-y-4">
             <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                 <Mail size={32} className="text-blue-500" />
             </div>
             <h3 className="font-bold text-slate-900">Undang Pasangan</h3>
             <p className="text-sm text-slate-500">Kirim link undangan untuk bergabung tanpa ribet.</p>
             
             {!inviteLink ? (
                 <button onClick={generateInvite} className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg text-sm hover:bg-blue-200">
                     Generate Link
                 </button>
             ) : (
                 <div className="w-full">
                     <div className="bg-slate-100 p-2 rounded text-xs font-mono text-slate-600 break-all mb-2">
                         {inviteLink}
                     </div>
                     <button onClick={handleCopy} className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-slate-900 text-white font-bold rounded-lg text-sm hover:bg-slate-800">
                         {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Tersalin' : 'Salin Link'}
                     </button>
                 </div>
             )}
         </div>

         {/* ROSTER GRID */}
         <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Captain Card (You) */}
            <div className="bg-white p-5 rounded-2xl border-2 border-yellow-400/50 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                    <Crown size={12}/> Captain
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-2xl border-4 border-white shadow-lg">
                        U
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-lg">Anda</h4>
                        <p className="text-xs text-slate-500">Owner • Full Access</p>
                    </div>
                </div>
            </div>

            {/* Sub Users */}
            {subUsers.map(user => (
                <div key={user.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-brand-200 transition">
                    <button 
                    onClick={() => handleDeleteClick(user.id)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                    >
                        <Trash2 size={16} />
                    </button>
                    
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-lg">{user.username}</h4>
                            <p className="text-xs text-slate-500 flex items-center gap-1"><Shield size={10} /> Member • {user.email}</p>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase">Active</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold uppercase">Can Edit Expenses</span>
                    </div>
                </div>
            ))}
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Tambah Anggota Tim</h3>
              <form onSubmit={handleAddSubUser} className="space-y-4">
                 <input 
                   type="text" placeholder="Nama Panggilan" required 
                   className="w-full border p-3 rounded-xl bg-slate-50"
                   value={formData.username}
                   onChange={e => setFormData({...formData, username: e.target.value})}
                 />
                 <input 
                   type="email" placeholder="Email Login" required 
                   className="w-full border p-3 rounded-xl bg-slate-50"
                   value={formData.email}
                   onChange={e => setFormData({...formData, email: e.target.value})}
                 />
                 <input 
                   type="password" placeholder="Password Sementara" required 
                   className="w-full border p-3 rounded-xl bg-slate-50"
                   value={formData.password}
                   onChange={e => setFormData({...formData, password: e.target.value})}
                 />
                 <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border rounded-xl hover:bg-slate-50 font-bold text-slate-600">Batal</button>
                    <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-bold">Simpan</button>
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
