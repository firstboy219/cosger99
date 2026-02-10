
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wallet, Loader2, Lock, User, AlertCircle, X, CheckCircle2, RefreshCw, Database, AlertTriangle, Mail, Send, Globe, ShieldCheck } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-brand-700 mb-4">
            <Wallet className="h-10 w-10" />
            <span className="font-bold text-2xl tracking-tight text-slate-900">Paydone.id</span>
          </Link>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Login Portal</h2>
          <p className="mt-2 text-slate-500 font-medium italic">"Bayar, Selesai."</p>
        </div>

        {googleSyncStatus !== 'idle' && (
           <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
              <div className="text-center p-8 max-w-sm w-full bg-white rounded-3xl shadow-2xl border border-slate-100">
                 <div className="relative mb-6 mx-auto w-fit">
                    {googleSyncStatus === 'success' ? (
                       <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                          <CheckCircle2 size={40} />
                       </div>
                    ) : (
                       <div className="h-20 w-20 bg-white border-2 border-slate-100 rounded-full flex items-center justify-center relative z-10 shadow-lg">
                          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="h-10 w-10 animate-pulse" alt="Google" />
                          <div className="absolute inset-0 rounded-full border-4 border-t-brand-600 border-transparent animate-spin"></div>
                       </div>
                    )}
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-2">{syncMessage}</h3>
                 <p className="text-slate-400 text-xs font-mono uppercase tracking-widest animate-pulse">V42 Protocol Active</p>
              </div>
           </div>
        )}

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><ShieldCheck size={120}/></div>
          
          <form className="space-y-6 relative z-10" onSubmit={handleManualSubmit}>
            {error && (
              <div className="p-4 text-xs font-bold text-red-600 bg-red-50 border-2 border-red-100 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center gap-2"><AlertCircle size={14} /> <span>{error}</span></div>
                <button type="button" onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-red-400 underline text-left">
                  {showDebug ? 'Hide Technical Logs' : 'Show Technical Logs'}
                </button>
                {showDebug && (
                    <div className="mt-2 p-2 bg-black/5 rounded-lg font-mono text-[9px] text-slate-500 overflow-auto max-h-32">
                        {authDebug.map((log, i) => <div key={i}>{log}</div>)}
                    </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase mb-1.5 tracking-widest">Username / Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><User size={18} /></div>
                <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none text-sm font-bold" placeholder="admin atau user" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5"><label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Password</label></div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Lock size={18} /></div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none text-sm font-bold" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition transform active:scale-95 shadow-xl disabled:opacity-50">
              {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Authenticate Access'}
            </button>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest text-slate-400"><span className="px-3 bg-white">Trusted Identity</span></div>
          </div>

          <div className="mt-6">
            <button 
                type="button" 
                onClick={triggerGoogleLogin}
                disabled={!isGsiInitialized}
                className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-slate-100 rounded-2xl bg-white text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
            >
              <img className="h-5 w-5" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
              Continue with Google
            </button>
          </div>
        </div>

        <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
          No account? <Link to="/register" className="text-brand-600 hover:text-brand-700 underline">Register Free</Link>
        </p>
      </div>
    </div>
  );
}
