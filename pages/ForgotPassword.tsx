import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Loader2, Mail, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengirim email. Coba lagi.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Wallet size={24} className="text-white" />
            </div>
            <span className="text-2xl font-black text-white">Paydone</span>
          </div>
          <p className="text-slate-400 text-sm">Reset Password Akun Anda</p>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Email Terkirim!</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Jika email <strong>{email}</strong> terdaftar, kami telah mengirimkan link reset password.
                Cek inbox atau folder spam Anda.
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition mt-2">
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-black text-slate-800 mb-2">Lupa Password?</h2>
              <p className="text-slate-500 text-sm mb-6">Masukkan email Anda dan kami akan mengirimkan link reset password.</p>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium mb-4">
                  <AlertCircle size={14} /><span>{error}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-600 transition-colors"><Mail size={18} /></div>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all outline-none text-sm font-bold placeholder:text-slate-300"
                      placeholder="email@contoh.com" />
                  </div>
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={loading}
                    className="w-full group flex justify-center items-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition transform active:scale-[0.98] shadow-xl disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={16} /> : (<>Kirim Link Reset <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></>)}
                  </button>
                </div>
              </form>
              <div className="mt-6 text-center">
                <Link to="/login" className="text-xs font-bold text-slate-400 hover:text-brand-600 transition uppercase tracking-widest">← Kembali ke Login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
