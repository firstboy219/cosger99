
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Loader2, Lock, User, Mail, CheckCircle, ArrowRight, Shield } from 'lucide-react';
import { addUser, getConfig } from '../services/mockDb';
import { User as UserType } from '../types';
import { setFreemiumData } from '../services/freemiumStore';
import { api } from '../services/api';
import { pullUserDataFromCloud } from '../services/cloudSync';
import { recordActivityLog } from '../services/activityLogger';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isPendingVerification, setIsPendingVerification] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const config = getConfig();
  const appName = config.appName || 'Paydone.id';
  const appLogo = config.appLogoUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    setLoading(true);

    try {
      // Call backend /api/auth/signup
      const res = await api.post('/auth/signup', {
        email: formData.email.trim(),
        password: formData.password,
        username: formData.username.trim() || formData.email.split('@')[0],
      });

      if (res.isPendingVerification) {
        // SMTP active — user needs to verify email
        setIsPendingVerification(true);
        setSuccess(true);
      } else if (res.user) {
        // SMTP not configured — auto login (user is immediately active)
        const user = res.user;
        const token = user.sessionToken || user.session_token;

        // Save session
        localStorage.setItem('paydone_session_token', token);
        localStorage.setItem('paydone_active_user', user.id);
        localStorage.setItem('paydone_user_role', user.role || 'user');

        // Save user to local DB
        const normalizedUser: UserType = {
          id: user.id,
          username: user.username || formData.username || formData.email.split('@')[0],
          email: user.email || formData.email,
          role: user.role || 'user',
          status: user.status || 'active',
          createdAt: user.createdAt || user.created_at || new Date().toISOString(),
          sessionToken: token,
        };
        addUser(normalizedUser);

        // Set default free plan
        setFreemiumData({
          subscriptionStatus: {
            inGracePeriod: false,
            daysLeftGrace: 0,
            isFreeTier: true,
            currentPackage: 'Free',
          }
        });

        // Record activity
        recordActivityLog(
          'Registrasi Berhasil',
          `User ${normalizedUser.username} berhasil mendaftar.`,
          { email: normalizedUser.email },
          { userId: normalizedUser.id },
          'success'
        );

        // Pull data from cloud
        try {
          await pullUserDataFromCloud(user.id, token);
        } catch { /* ignore hydration errors */ }

        setSuccess(true);
        setTimeout(() => navigate('/app'), 1500);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      // Fallback to local-only mode if backend is unavailable
      const errMsg = err.message || '';
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('404')) {
        // Backend not reachable — local demo mode
        console.warn('[Register] Backend unavailable, using local demo mode.');
        const newUser: UserType = {
          id: `u-${Date.now()}`,
          username: formData.username || formData.email.split('@')[0],
          email: formData.email,
          password: formData.password,
          role: 'user',
          status: 'active',
          createdAt: new Date().toISOString(),
          subscription_id: 'pkg-free-default'
        };
        addUser(newUser);
        setFreemiumData({
          subscriptionStatus: { inGracePeriod: false, daysLeftGrace: 0, isFreeTier: true, currentPackage: 'Free' }
        });
        setSuccess(true);
        setIsPendingVerification(false);
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(errMsg || 'Pendaftaran gagal. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
      return (
          <div className="min-h-screen bg-white flex items-center justify-center p-4">
              <div className="w-full max-w-md text-center space-y-6">
                  <div className="bg-green-100 h-20 w-20 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {isPendingVerification ? 'Cek Email Anda!' : 'Akun Berhasil Dibuat!'}
                  </h2>
                  <p className="text-slate-500">
                    {isPendingVerification
                      ? <>Kami telah mengirimkan link verifikasi ke <strong>{formData.email}</strong>. Silakan klik link tersebut untuk mengaktifkan akun Anda.</>
                      : 'Selamat datang! Akun Anda telah aktif. Anda akan diarahkan ke dashboard...'
                    }
                  </p>
                  {isPendingVerification && (
                    <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition">
                        Kembali ke Login <ArrowRight size={18} />
                    </Link>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-brand-700 mb-6">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <Wallet className="h-10 w-10" />
            )}
            <span className="font-bold text-2xl tracking-tight">{appName}</span>
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
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                  placeholder="nama_pengguna"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                  placeholder="email@contoh.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                  placeholder="Minimal 6 karakter"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Shield className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                  placeholder="Ulangi password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-lg transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700 transition">
            Masuk sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
