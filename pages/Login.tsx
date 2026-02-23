
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Loader2, Lock, User, AlertCircle, Eye, EyeOff, ChevronRight, ShieldCheck } from 'lucide-react';
import { getConfig } from '../services/mockDb';
import { decodeJwt, GoogleJwtPayload } from '../services/authUtils';
import { AppConfig } from '../types';
import { api } from '../services/api';
import { handleLoginFlow } from '../services/auth';

declare global {
  interface Window {
    google: any;
  }
}

interface LoginProps {
  onLogin: (role: 'admin' | 'user' | 'sales', userId: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  const [configClientId, setConfigClientId] = useState('');
  const [isGsiInitialized, setIsGsiInitialized] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>(getConfig());

  const navigate = useNavigate();

  useEffect(() => {
      const updateConfig = () => setAppConfig(getConfig());
      window.addEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
      return () => window.removeEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
  }, []);

  useEffect(() => {
    const config = getConfig();
    if (config.googleClientId) {
      setConfigClientId(config.googleClientId);
    }
  }, [appConfig]);

  useEffect(() => {
    const initGsi = () => {
      if (window.google && configClientId && !isGsiInitialized) {
        try {
          window.google.accounts.id.initialize({
            client_id: configClientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin'
          });
          setIsGsiInitialized(true);
        } catch (e: any) {
          setError(`Google Auth Error: ${e.message}`);
        }
      }
    };

    const interval = setInterval(() => {
      if (isGsiInitialized) clearInterval(interval);
      else initGsi();
    }, 1000);

    return () => clearInterval(interval);
  }, [configClientId, isGsiInitialized]);

  const handleGoogleCallback = async (response: any) => {
    try {
      setLoading(true);
      const idToken = response.credential;
      const payload: GoogleJwtPayload | null = decodeJwt(idToken);

      if (!payload) throw new Error("Invalid Google Token");

      // Use the unified auth flow
      // Note: We might need a specific endpoint for Google Login inside auth service, 
      // but strictly following 'handleLoginFlow' which uses /auth/login credentials
      // For Google, we essentially do the same 'post login' steps.
      
      const res = await api.post('/auth/google', {
          token: idToken,
          user: {
              uid: payload.sub,
              email: payload.email,
              displayName: payload.name,
              photoURL: payload.picture
          }
      });
      
      // Manually trigger flow steps since handleLoginFlow takes credentials
      // Or we can refactor. For now, let's keep google manual but use same logic
      const user = res.user;
      localStorage.setItem('paydone_session_token', user.sessionToken);
      localStorage.setItem('paydone_active_user', user.id);
      
      // Hydrate via service call or manually here? 
      // Reuse the logic via explicit import if possible, but simplest is to just call onLogin
      // However, to satisfy "MUST fetch data first":
      const { pullUserDataFromCloud } = await import('../services/cloudSync');
      if (user.role !== 'admin') {
          await pullUserDataFromCloud(user.id, user.sessionToken);
      }

      onLogin(user.role, user.id);
      navigate(user.role === 'admin' ? '/admin' : user.role === 'sales' ? '/sales' : '/app');

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const triggerGoogleLogin = () => {
    if (!configClientId) {
        setError("Google Client ID missing. Contact Admin.");
        return;
    }
    if (window.google && isGsiInitialized) {
        window.google.accounts.id.prompt();
    } else {
        setError("Google SDK not ready.");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        const user = await handleLoginFlow({ email: username, password });
        onLogin(user.role, user.id);
        navigate(user.role === 'admin' ? '/admin' : user.role === 'sales' ? '/sales' : '/app');
    } catch (err: any) {
        setError(err.message || "Login failed");
        setLoading(false);
    }
  };

  const appName = appConfig.appName || 'Paydone.id';
  const appLogo = appConfig.appLogoUrl;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-[1000px] flex bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative z-10 scale-95 md:scale-100 transition-all duration-500">
        
        {/* LEFT PANEL */}
        <div className="hidden lg:flex w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
                <Link to="/" className="flex items-center gap-3 text-white mb-12">
                    {appLogo ? (
                        <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain bg-white rounded-lg p-1" />
                    ) : (
                        <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-500/30">
                            <Wallet className="h-6 w-6" />
                        </div>
                    )}
                    <span className="font-black text-2xl tracking-tighter">{appName}</span>
                </Link>
                <h1 className="text-4xl font-black text-white leading-tight mb-4">
                    Sistem Pelunasan <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">Paling Cerdas.</span>
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs font-medium">
                    Ambil kendali finansial Anda dengan bantuan AI. Pantau, hitung, dan selesaikan semua beban secara otomatis.
                </p>
            </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full lg:w-1/2 p-8 md:p-12 bg-white flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">
                <div className="mb-8">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selamat Datang</h2>
                    <p className="text-slate-500 text-sm mt-2 font-medium">Lanjutkan ke cockpit keuangan Anda.</p>
                </div>

                <div className="mb-8">
                    <button 
                        onClick={triggerGoogleLogin}
                        disabled={loading}
                        className={`w-full group flex items-center justify-center gap-4 py-3.5 border-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-md disabled:opacity-50 ${
                            !configClientId ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-100 text-slate-700 hover:border-brand-500 hover:bg-slate-50'
                        }`}
                    >
                        <img className={`h-5 w-5 transition-transform ${configClientId ? 'group-hover:scale-110' : 'grayscale opacity-50'}`} src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                        {configClientId ? 'Masuk dengan Google' : 'Google Auth Belum Aktif'}
                    </button>
                    
                    <div className="mt-8 relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-slate-400"><span className="px-4 bg-white">Atau Gunakan Akun</span></div>
                    </div>
                </div>

                <form className="space-y-5" onSubmit={handleManualSubmit}>
                    {error && (
                        <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl animate-shake flex items-center gap-3 text-red-600">
                            <AlertCircle size={18} />
                            <span className="text-xs font-black uppercase tracking-tight">{error}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username / Email</label>
                        <div className="group relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-600 transition-colors"><User size={18} /></div>
                            <input 
                                type="text" required 
                                value={username} onChange={(e) => setUsername(e.target.value)} 
                                className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all outline-none text-sm font-bold placeholder:text-slate-300" 
                                placeholder="Email atau username..." 
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                        <div className="group relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-600 transition-colors"><Lock size={18} /></div>
                            <input 
                                type={showPassword ? 'text' : 'password'} required 
                                value={password} onChange={(e) => setPassword(e.target.value)} 
                                className="block w-full pl-11 pr-12 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all outline-none text-sm font-bold placeholder:text-slate-300" 
                                placeholder="••••••••" 
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600">
                                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={loading} className="w-full group flex justify-center items-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition transform active:scale-[0.98] shadow-xl hover:shadow-slate-200 disabled:opacity-50">
                            {loading ? <Loader2 className="animate-spin" size={16} /> : (
                                <>Autentikasi Aman <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-10 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-green-500"/> Data Terenkripsi</div>
                    <Link to="/register" className="text-brand-600 hover:underline">Buat Akun Baru</Link>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
