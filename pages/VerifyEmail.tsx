import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../services/api';

export default function VerifyEmail() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    const token = qIdx !== -1 ? new URLSearchParams(hash.slice(qIdx + 1)).get('token') : null;

    if (!token) {
      setStatus('error');
      setMessage('Token verifikasi tidak ditemukan. Periksa link di email Anda.');
      return;
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then((res: any) => {
        setStatus('success');
        setMessage(res?.message || 'Akun berhasil diverifikasi! Silakan login.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.message || 'Link verifikasi tidak valid atau sudah kadaluarsa.');
      });
  }, []);

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
        </div>
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center space-y-5">
          {status === 'loading' && (
            <>
              <Loader2 size={40} className="animate-spin text-brand-500 mx-auto" />
              <h2 className="text-xl font-black text-slate-800">Memverifikasi Akun...</h2>
              <p className="text-slate-500 text-sm">Mohon tunggu sebentar.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Akun Terverifikasi! 🎉</h2>
              <p className="text-slate-500 text-sm">{message}</p>
              <Link to="/login" className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition shadow-xl">
                Masuk Sekarang →
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <XCircle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Verifikasi Gagal</h2>
              <p className="text-slate-500 text-sm">{message}</p>
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition mt-2">
                Kembali ke Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
