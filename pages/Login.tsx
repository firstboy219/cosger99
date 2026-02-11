
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Loader2, Lock, User, AlertCircle, X, CheckCircle2, RefreshCw, Database, AlertTriangle, Mail, Send, Globe, ShieldCheck, Eye, EyeOff, ChevronRight, Fingerprint, KeyRound } from 'lucide-react';
import { getConfig, getAllUsers, updateUser, addUser, migrateUserData } from '../services/mockDb';
import { addLogEntry } from '../services/activityLogger';
import { decodeJwt, GoogleJwtPayload } from '../services/authUtils';
import { User as UserType } from '../types';
import { pushUserDataToCloud, pullUserDataFromCloud } from '../services/cloudSync';

declare global {
  interface Window {
    google: any;
  }
}

interface LoginProps {
  onLogin: (role: 'admin' | 'user', userId: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Auth Troubleshooting State
  const [authDebug, setAuthDebug] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  
  const [googleSyncStatus, setGoogleSyncStatus] = useState<'idle' | 'verifying' | 'checking_db' | 'registering' | 'success'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [configClientId, setConfigClientId] = useState('');
  const [isGsiInitialized, setIsGsiInitialized] = useState(false);

  const navigate = useNavigate();

  const addDebug = (msg: string) => setAuthDebug(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Load Config
  useEffect(() => {
    const config = getConfig();
    if (config.googleClientId) {
      setConfigClientId(config.googleClientId);
      addDebug(`Client ID Loaded: ${config.googleClientId.substring(0, 10)}...`);
    } else {
      addDebug("WARNING: Google Client ID is missing in system config.");
    }
  }, []);

  // Initialize Google SDK
  useEffect(() => {
    const initGsi = () => {
      if (window.google && configClientId && !isGsiInitialized) {
        try {
          addDebug("Initializing Google Identity Services...");
          window.google.accounts.id.initialize({
            client_id: configClientId,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true,
            context: 'signin'
          });
          setIsGsiInitialized(true);
          addDebug("Google Sign-In ready.");
        } catch (e: any) {
          addDebug(`GSI Init Error: ${e.message}`);
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
      setGoogleSyncStatus('verifying');
      setSyncMessage('Menerima Token dari Google...');
      addDebug("JWT Received from Google. Decoding...");

      const idToken = response.credential;
      const payload: GoogleJwtPayload | null = decodeJwt(idToken);

      if (!payload) throw new Error("Gagal membaca payload token Google.");

      addDebug(`User Identified: ${payload.email}`);
      
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';

      addDebug(`Attempting server-side handshake: ${baseUrl}/api/auth/google`);
      
      try {
          const res = await fetch(`${baseUrl}/api/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  token: idToken,
                  user: {
                      uid: payload.sub,
                      email: payload.email,
                      displayName: payload.name,
                      photoURL: payload.picture
                  }
              })
          });

          if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status}`);
          }

          const data = await res.json();
          const serverUser = data.user;
          addDebug("Backend Handshake Success. Session created.");
          
          if (serverUser.sessionToken) {
              localStorage.setItem('paydone_session_token', serverUser.sessionToken);
          }

          setGoogleSyncStatus('checking_db');
          setSyncMessage('Menyinkronkan data cloud...');
          await pullUserDataFromCloud(serverUser.id, true);

          setGoogleSyncStatus('success');
          setSyncMessage('Login Berhasil!');
          addDebug("Login complete. Redirecting...");
          
          setTimeout(() => {
              onLogin(serverUser.role, serverUser.id);
              navigate(serverUser.role === 'admin' ? '/admin' : '/app');
          }, 800);

      } catch (serverErr: any) {
          addDebug(`SERVER REJECTED: ${serverErr.message}`);
          if (confirm(`Gagal terhubung ke Backend (${serverErr.message}). Gunakan mode Offline untuk sementara?`)) {
              // Fallback to local
              const dummyToken = `local-${Date.now()}`;
              localStorage.setItem('paydone_session_token', dummyToken);
              onLogin('user', payload.sub);
              navigate('/app');
          } else {
              throw serverErr;
          }
      }

    } catch (err: any) {
      addDebug(`AUTH FATAL: ${err.message}`);
      setGoogleSyncStatus('idle');
      setError(err.message);
      setLoading(false);
    }
  };

  const triggerGoogleLogin = () => {
    if (!configClientId) {
        setError("Google Client ID belum diatur. Masuk sebagai admin untuk setting.");
        return;
    }
    if (window.google) {
        window.google.accounts.id.prompt();
    } else {
        setError("Google Identity SDK belum termuat.");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    addDebug(`Manual Login Attempt: ${username}`);

    // Dummy bypass accounts
    if ((username === 'admin' && password === '123') || (username === 'user' && password === '123')) {
        addDebug("Using system bypass account.");
        localStorage.setItem('paydone_session_token', `bypass-${Date.now()}`);
        onLogin(username === 'admin' ? 'admin' : 'user', username === 'admin' ? 'u1' : 'u2');
        navigate(username === 'admin' ? '/admin' : '/app');
        return;
    }

    const config = getConfig();
    const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';

    try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: username, password })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Login Gagal");
        }

        const data = await res.json();
        localStorage.setItem('paydone_session_token', data.user.sessionToken);
        await pullUserDataFromCloud(data.user.id, true);
        
        onLogin(data.user.role, data.user.id);
        navigate(data.user.role === 'admin' ? '/admin' : '/app');

    } catch (err: any) {
        addDebug(`Manual Error: ${err.message}`);
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Dynamic Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-[1000px] flex bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative z-10 scale-95 md:scale-100 transition-all duration-500">
        
        {/* LEFT PANEL: Branding & Visual */}
        <div className="hidden lg:flex w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-brand-600/20 rounded-full blur-[80px]"></div>
            
            <div className="relative z-10">
                <Link to="/" className="flex items-center gap-3 text-white mb-12">
                    <div className="bg-brand-600 p-2 rounded-xl shadow-lg shadow-brand-500/30">
                        <Wallet className="h-6 w-6" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter">Paydone<span className="text-brand-500">.id</span></span>
                </Link>
                <h1 className="text-4xl font-black text-white leading-tight mb-4">
                    Sistem Pelunasan <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">Paling Cerdas.</span>
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs font-medium">
                    Ambil kendali finansial Anda dengan bantuan AI. Pantau, hitung, dan selesaikan semua beban secara otomatis.
                </p>
            </div>

            <div className="relative z-10">
                <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Status</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-white font-bold text-sm">Mainnet Node Singapore</p>
                            <p className="text-slate-500 text-[10px] font-mono mt-1 uppercase">v42.22 Secure Protocol</p>
                        </div>
                        <Globe size={24} className="text-slate-700"/>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT PANEL: Form */}
        <div className="w-full lg:w-1/2 p-8 md:p-12 bg-white flex flex-col justify-center">
            <div className="mb-10 lg:hidden text-center">
                 <Link to="/" className="inline-flex items-center gap-2 text-slate-900">
                    <Wallet className="h-8 w-8 text-brand-600" />
                    <span className="font-black text-xl tracking-tighter">Paydone.id</span>
                </Link>
            </div>

            <div className="max-w-sm mx-auto w-full">
                <div className="mb-8">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selamat Datang</h2>
                    <p className="text-slate-500 text-sm mt-2 font-medium">Lanjutkan ke cockpit keuangan Anda.</p>
                </div>

                {/* GOOGLE SOCIAL LOGIN - HIGHLIGHTED */}
                <div className="mb-8">
                    <button 
                        onClick={triggerGoogleLogin}
                        disabled={!isGsiInitialized || loading}
                        className="w-full group flex items-center justify-center gap-4 py-3.5 border-2 border-slate-100 rounded-2xl bg-white text-xs font-black uppercase tracking-widest text-slate-700 hover:border-brand-500 hover:bg-slate-50 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                    >
                        <img className="h-5 w-5 group-hover:scale-110 transition-transform" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                        Masuk dengan Google
                    </button>
                    
                    <div className="mt-8 relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-slate-400"><span className="px-4 bg-white">Atau Gunakan Akun</span></div>
                    </div>
                </div>

                <form className="space-y-5" onSubmit={handleManualSubmit}>
                    {error && (
                        <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl animate-shake">
                            <div className="flex items-center gap-3 text-red-600 mb-2">
                                <AlertCircle size={18} />
                                <span className="text-xs font-black uppercase tracking-tight">{error}</span>
                            </div>
                            <button type="button" onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-red-400 underline font-bold">
                                {showDebug ? 'Sembunyikan Log Teknis' : 'Lihat Detail Masalah'}
                            </button>
                            {showDebug && (
                                <div className="mt-3 p-3 bg-black/5 rounded-xl font-mono text-[9px] text-slate-500 overflow-auto max-h-24 custom-scrollbar leading-relaxed">
                                    {authDebug.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username / Email</label>
                        <div className="group relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-600 transition-colors"><User size={18} /></div>
                            <input 
                                type="text" 
                                required 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all outline-none text-sm font-bold placeholder:text-slate-300" 
                                placeholder="Email atau username..." 
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sandi Rahasia</label>
                            <button type="button" className="text-[10px] font-black text-brand-600 hover:text-brand-700 uppercase tracking-widest">Lupa?</button>
                        </div>
                        <div className="group relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-600 transition-colors"><Lock size={18} /></div>
                            <input 
                                type={showPassword ? 'text' : 'password'} 
                                required 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                className="block w-full pl-11 pr-12 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white transition-all outline-none text-sm font-bold placeholder:text-slate-300" 
                                placeholder="••••••••" 
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="w-full group flex justify-center items-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition transform active:scale-[0.98] shadow-xl hover:shadow-slate-200 disabled:opacity-50"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={16} /> : (
                                <>
                                    Autentikasi Aman 
                                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-10 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-green-500"/>
                        Data Terenkripsi
                    </div>
                    <Link to="/register" className="text-brand-600 hover:underline">Buat Akun Baru</Link>
                </div>
            </div>
        </div>
      </div>

      {/* SYNC OVERLAY: SMART & PRETTY */}
      {googleSyncStatus !== 'idle' && (
           <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex flex-col items-center justify-center animate-fade-in">
              <div className="text-center p-12 max-w-md w-full relative">
                 
                 {/* Visual Background Glow for Loader */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand-500/20 rounded-full blur-[60px] animate-pulse"></div>

                 <div className="relative mb-10 mx-auto w-fit">
                    {googleSyncStatus === 'success' ? (
                       <div className="h-24 w-24 bg-green-500 text-white rounded-[2rem] flex items-center justify-center animate-bounce shadow-2xl shadow-green-500/50">
                          <CheckCircle2 size={48} />
                       </div>
                    ) : (
                       <div className="h-24 w-24 bg-white/10 border-2 border-white/20 rounded-[2rem] flex items-center justify-center relative z-10 shadow-2xl backdrop-blur-md">
                          {googleSyncStatus === 'verifying' && <Fingerprint size={48} className="text-brand-400 animate-pulse" />}
                          {googleSyncStatus === 'checking_db' && <Database size={40} className="text-indigo-400 animate-bounce" />}
                          <div className="absolute inset-[-8px] rounded-[2.5rem] border-4 border-t-brand-500 border-white/5 animate-spin"></div>
                       </div>
                    )}
                 </div>

                 <h3 className="text-2xl font-black text-white mb-3 tracking-tight">{syncMessage}</h3>
                 <div className="flex flex-col items-center gap-3">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">V42 Secure Handshake Active</p>
                    <div className="flex gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${googleSyncStatus === 'verifying' ? 'bg-brand-500' : 'bg-white/20'}`}></div>
                        <div className={`h-1.5 w-1.5 rounded-full ${googleSyncStatus === 'checking_db' ? 'bg-brand-500' : 'bg-white/20'}`}></div>
                        <div className={`h-1.5 w-1.5 rounded-full ${googleSyncStatus === 'success' ? 'bg-brand-500' : 'bg-white/20'}`}></div>
                    </div>
                 </div>
              </div>
           </div>
      )}

      {/* Footer Branding for Public View */}
      <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none opacity-40">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Paydone Personal Finance &copy; 2024</p>
      </div>

    </div>
  );
}
