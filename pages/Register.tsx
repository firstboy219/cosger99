
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Loader2, Lock, User, Mail, CheckCircle, ArrowRight } from 'lucide-react';
import { addUser } from '../services/mockDb';
import { User as UserType } from '../types';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok.');
      return;
    }

    setLoading(true);

    // Simulate API Call & Email Sending
    setTimeout(() => {
      // Create User in DB
      const newUser: UserType = {
        id: `u-${Date.now()}`,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: 'user',
        status: 'pending_verification',
        createdAt: new Date().toISOString()
      };
      
      addUser(newUser);
      setLoading(false);
      setSuccess(true);
      
      // Simulate sending email
      console.log(`[EMAIL SERVICE] Sending verification email to ${formData.email}...`);
      alert(`Email verifikasi telah dikirim ke ${formData.email}. (Simulasi: Silakan Login, akun otomatis aktif di demo ini)`);
      
    }, 1500);
  };

  if (success) {
      return (
          <div className="min-h-screen bg-white flex items-center justify-center p-4">
              <div className="w-full max-w-md text-center space-y-6">
                  <div className="bg-green-100 h-20 w-20 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">Cek Email Anda!</h2>
                  <p className="text-slate-500">
                      Kami telah mengirimkan link verifikasi ke <strong>{formData.email}</strong>. 
                      Silakan klik link tersebut untuk mengaktifkan akun Anda.
                  </p>
                  <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition">
                      Kembali ke Login <ArrowRight size={18} />
                  </Link>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-brand-700 mb-6">
            <Wallet className="h-10 w-10" />
            <span className="font-bold text-2xl tracking-tight">Paydone.id</span>
          </Link>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Buat Akun Baru</h2>
          <p className="mt-2 text-slate-500">Bergabunglah dan mulai perjalanan bebas hutang.</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text" required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="block w-full pl-10 rounded-lg border border-slate-300 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm outline-none"
                  placeholder="johndoe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email" required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="block w-full pl-10 rounded-lg border border-slate-300 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm outline-none"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password" required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="block w-full pl-10 rounded-lg border border-slate-300 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <CheckCircle size={18} />
                </div>
                <input
                  type="password" required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="block w-full pl-10 rounded-lg border border-slate-300 py-2.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Daftar Sekarang'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-500">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
