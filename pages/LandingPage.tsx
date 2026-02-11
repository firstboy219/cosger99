
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wallet, ArrowRight, CheckCircle2, ShieldCheck, PieChart, 
  BrainCircuit, TrendingUp, AlertTriangle, ChevronRight, 
  Calculator, Lock, Zap, Sparkles, X, Star, Shield, 
  ArrowUpRight, BarChart3, Fingerprint, MousePointer2 
} from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  // Hero Calculator State
  const [debtAmount, setDebtAmount] = useState(150000000); 
  const [monthlyPay, setMonthlyPay] = useState(3500000); 
  
  // Smart Calculation logic for Hero
  const standardYears = Math.ceil(debtAmount / (monthlyPay * 0.8) / 12); 
  const optimizedYears = Math.max(1, Math.ceil(standardYears * 0.6)); 
  const savedInterest = (debtAmount * 0.22) * (standardYears - optimizedYears) / 2;

  // Smart Feedback based on calculation
  const getStressLevel = () => {
      const ratio = (monthlyPay / (debtAmount * 0.05)); // Simple stress proxy
      if (ratio < 0.5) return { label: 'Beban Berat', color: 'text-red-500', bg: 'bg-red-50' };
      if (ratio < 1) return { label: 'Waspada', color: 'text-amber-500', bg: 'bg-amber-50' };
      return { label: 'Aman', color: 'text-green-500', bg: 'bg-green-50' };
  };
  const stress = getStressLevel();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
        window.removeEventListener('scroll', handleScroll);
        document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 font-sans selection:bg-brand-100 selection:text-brand-900 overflow-x-hidden">
      
      {/* 1. ULTRA-MODERN NAVBAR */}
      <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'py-3' : 'py-6'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className={`flex items-center justify-between transition-all duration-500 rounded-full px-6 py-2.5 ${scrolled ? 'bg-white/70 backdrop-blur-xl border border-slate-200/50 shadow-lg shadow-slate-200/20' : 'bg-transparent'}`}>
            <div className="flex items-center gap-2.5">
              <div className="bg-gradient-to-tr from-brand-600 to-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-brand-500/20">
                  <Wallet className="h-5 w-5" />
              </div>
              <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">Paydone<span className="text-brand-600">.id</span></span>
            </div>
            
            <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <a href="#simulator" className="hover:text-brand-600 transition">Simulator</a>
              <a href="#features" className="hover:text-brand-600 transition">Keunggulan</a>
              <a href="#security" className="hover:text-brand-600 transition">Keamanan</a>
            </div>
            
            <div className="flex items-center gap-4">
              <Link to="/login" className="hidden sm:block text-xs font-black uppercase tracking-widest text-slate-600 hover:text-brand-600 transition">
                Masuk
              </Link>
              <Link to="/register" className="px-6 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-white bg-slate-900 hover:bg-brand-600 rounded-full transition shadow-xl transform active:scale-95">
                Mulai Gratis
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION: THE "WOW" FACTOR */}
      <section className="relative pt-32 pb-20 lg:pt-56 lg:pb-40 px-6">
        {/* Animated Background Mesh */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[60%] bg-brand-400/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[50%] bg-indigo-400/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-16 items-center">
          {/* Left Content */}
          <div className="lg:col-span-6 space-y-10 text-center lg:text-left relative z-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-xl shadow-slate-200/20 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">AI-Powered Debt Consultant V42.2</span>
            </div>
            
            <h1 className="text-5xl lg:text-8xl font-black tracking-tighter text-slate-900 leading-[0.95]">
              Bayar. Selesai. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600">Jauh Lebih Cepat.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Paydone bukan sekadar tracker. Kami adalah <span className="text-slate-900 font-bold underline decoration-brand-400 decoration-4">arsitek keuangan</span> yang merancang rute pelunasan hutang paling efisien menggunakan algoritma cerdas.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start pt-4">
              <Link to="/register" className="inline-flex items-center justify-center px-10 py-5 text-xs font-black uppercase tracking-widest text-white bg-brand-600 hover:bg-brand-700 rounded-2xl transition shadow-2xl shadow-brand-500/40 group transform hover:-translate-y-1">
                Bangun Strategi Anda
                <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#simulator" className="inline-flex items-center justify-center px-10 py-5 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border-2 border-slate-100 hover:border-brand-200 rounded-2xl transition shadow-xl shadow-slate-200/20">
                Lihat Realita Bunga
              </a>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-8 pt-8">
                <div className="flex flex-col">
                    <span className="text-2xl font-black text-slate-900">2.4k+</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Users</span>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black text-slate-900">150M+</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Debt Cleared</span>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1 text-amber-500">
                    <Star size={16} fill="currentColor" />
                    <span className="text-lg font-black text-slate-900">4.9</span>
                </div>
            </div>
          </div>

          {/* Right Content: THE SMART SIMULATOR CARD */}
          <div className="lg:col-span-6 relative perspective-1000" id="simulator">
             <div className="absolute -inset-4 bg-gradient-to-r from-brand-500/20 to-purple-500/20 blur-3xl opacity-50 rounded-[3rem]"></div>
             <div className="relative bg-white rounded-[2.5rem] border border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-8 overflow-hidden group">
                
                {/* Decor */}
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                    <Calculator size={180} />
                </div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl"><TrendingUp size={24}/></div>
                        <div>
                            <h3 className="font-black text-lg text-slate-900 leading-none">Mini Simulator</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time projection</p>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${stress.bg} ${stress.color} border border-current/20 animate-pulse`}>
                        {stress.label}
                    </div>
                </div>

                <div className="space-y-8 relative z-10">
                    <div className="space-y-4">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                            <span>Sisa Hutang Pokok</span>
                            <span className="text-slate-900">{formatCurrency(debtAmount)}</span>
                        </div>
                        <input 
                          type="range" min="10000000" max="1000000000" step="10000000" 
                          className="w-full h-2.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-brand-600"
                          value={debtAmount} onChange={e => setDebtAmount(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                            <span>Kemampuan Cicil / Bulan</span>
                            <span className="text-brand-600">{formatCurrency(monthlyPay)}</span>
                        </div>
                        <input 
                          type="range" min="1000000" max="50000000" step="500000" 
                          className="w-full h-2.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-brand-600"
                          value={monthlyPay} onChange={e => setMonthlyPay(Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className="mt-10 p-8 bg-slate-900 rounded-[2rem] text-white relative overflow-hidden shadow-2xl shadow-slate-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    
                    <div className="grid grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Cara Biasa</p>
                            <p className="text-2xl font-black text-slate-400">{standardYears} <span className="text-xs">Thn</span></p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-brand-400 uppercase font-black tracking-widest flex items-center gap-1.5"><Zap size={10} fill="currentColor"/> Jalur Paydone</p>
                            <p className="text-2xl font-black text-white">{optimizedYears} <span className="text-xs">Thn</span></p>
                        </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-slate-800 relative z-10">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Estimasi Hemat Bunga</p>
                                <p className="text-3xl font-black text-green-400 leading-none">{formatCurrency(savedInterest)}</p>
                            </div>
                            <div className="bg-green-500/10 p-2 rounded-xl border border-green-500/20">
                                <Sparkles size={20} className="text-green-400" />
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Shield size={12} /> Data Anda Terenkripsi & Aman
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* 3. SOCIAL PROOF & PARTNERS */}
      <section className="py-12 border-y border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-6">
              <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-10">Trusted by modern professionals at</p>
              <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-30 grayscale contrast-125">
                  <span className="text-2xl font-black italic">Google</span>
                  <span className="text-2xl font-black">NETFLIX</span>
                  <span className="text-2xl font-black tracking-tighter">Shopee</span>
                  <span className="text-2xl font-black uppercase">Gojek</span>
                  <span className="text-2xl font-black lowercase tracking-tighter italic">meta</span>
              </div>
          </div>
      </section>

      {/* 4. PROBLEM vs SOLUTION: THE REALITY CHECK */}
      <section className="py-32 bg-white" id="comparison">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
                <span className="text-brand-600 font-black text-[10px] uppercase tracking-[0.3em]">The Reality Check</span>
                <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">Mengapa Kalkulator Bank Saja Tidak Cukup?</h2>
                <p className="text-slate-500 text-lg font-medium">Bank hanya peduli pada cicilan. Paydone peduli pada <span className="text-slate-900 font-bold">kecepatan pelunasan</span> dan <span className="text-slate-900 font-bold">penghematan bunga</span>.</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-stretch">
                {/* Left: Traditional Way */}
                <div className="p-10 rounded-[2.5rem] border border-slate-200 bg-slate-50/50 flex flex-col justify-between group hover:bg-white transition-all duration-500">
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-slate-200 text-slate-500 rounded-2xl"><X size={24}/></div>
                            <h3 className="font-black text-xl text-slate-700 uppercase tracking-tight">Kalkulator Statis</h3>
                        </div>
                        <ul className="space-y-6">
                            <li className="flex items-start gap-4">
                                <div className="mt-1 p-1 bg-red-100 text-red-500 rounded-full"><X size={12}/></div>
                                <p className="text-sm text-slate-500 font-medium">Hanya menunjukkan cicilan tanpa strategi percepatan.</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="mt-1 p-1 bg-red-100 text-red-500 rounded-full"><X size={12}/></div>
                                <p className="text-sm text-slate-500 font-medium">Mengabaikan biaya provisi, admin, dan asuransi tersembunyi.</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="mt-1 p-1 bg-red-100 text-red-500 rounded-full"><X size={12}/></div>
                                <p className="text-sm text-slate-500 font-medium">Tidak ada simulasi penghematan bunga jika lunas dipercepat.</p>
                            </li>
                        </ul>
                    </div>
                    <div className="mt-12 p-6 bg-white border border-slate-200 rounded-2xl text-center shadow-sm">
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Typical Experience</p>
                        <p className="text-lg font-bold text-slate-700">"Kaget bayar di akhir"</p>
                    </div>
                </div>

                {/* Right: Paydone Way */}
                <div className="p-10 rounded-[2.5rem] border-4 border-brand-500 bg-white shadow-[0_32px_64px_-12px_rgba(37,99,235,0.15)] flex flex-col justify-between relative transform lg:scale-105 z-10">
                    <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-black px-6 py-2.5 rounded-bl-[1.5rem] uppercase tracking-[0.2em]">The Smart Way</div>
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-brand-100 text-brand-600 rounded-2xl shadow-lg shadow-brand-500/20"><CheckCircle2 size={24}/></div>
                            <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Paydone Intelligence</h3>
                        </div>
                        <ul className="space-y-6">
                            <li className="flex items-start gap-4">
                                <div className="mt-1 p-1 bg-brand-100 text-brand-600 rounded-full"><CheckCircle2 size={12}/></div>
                                <p className="text-sm text-slate-700 font-bold">Algoritma Snowball & Avalanche untuk rute tercepat.</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="mt-1 p-1 bg-brand-100 text-brand-600 rounded-full"><CheckCircle2 size={12}/></div>
                                <p className="text-sm text-slate-700 font-bold">Kalkulasi Upfront Cost 100% transparan (Notaris, Provisi, dll).</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="mt-1 p-1 bg-brand-100 text-brand-600 rounded-full"><CheckCircle2 size={12}/></div>
                                <p className="text-sm text-slate-700 font-bold">Live Monitoring & AI Refinance Opportunity Checker.</p>
                            </li>
                        </ul>
                    </div>
                    <div className="mt-12 p-8 bg-slate-900 rounded-[1.5rem] text-center shadow-xl">
                        <p className="text-[10px] text-brand-400 font-black uppercase mb-1 tracking-widest">The Paydone Advantage</p>
                        <p className="text-xl font-black text-white">Lunas 3-5 tahun lebih awal.</p>
                    </div>
                </div>
            </div>
         </div>
      </section>

      {/* 5. BENTO GRID FEATURES */}
      <section className="py-32 bg-slate-50" id="features">
          <div className="max-w-7xl mx-auto px-6">
              <div className="mb-20 text-center md:text-left">
                  <span className="text-brand-600 font-black text-[10px] uppercase tracking-[0.3em]">Powerful Modules</span>
                  <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mt-4 tracking-tighter">Senjata Melawan Beban Hutang.</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                  {/* Big Card */}
                  <div className="md:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all duration-500 group relative overflow-hidden flex flex-col justify-between">
                      <div className="relative z-10">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                            <BrainCircuit size={32} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">AI Debt Strategist</h3>
                        <p className="text-slate-500 text-lg leading-relaxed font-medium max-w-lg">
                            Pilih strategi paling efektif untuk psikologi Anda. <strong>Snowball</strong> untuk motivasi cepat, atau <strong>Avalanche</strong> untuk penghematan bunga maksimal. Biarkan AI kami yang menghitung.
                        </p>
                      </div>
                      <div className="mt-12 flex items-center gap-4 relative z-10">
                          <button className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-600">Pelajari Algoritma <ChevronRight size={14}/></button>
                      </div>
                      {/* Decorative Element */}
                      <div className="absolute bottom-0 right-0 p-6 opacity-[0.05] group-hover:rotate-6 transition-transform">
                          <BarChart3 size={240} />
                      </div>
                  </div>

                  {/* Smaller Card 1 */}
                  <div className="bg-brand-600 p-10 rounded-[2.5rem] text-white shadow-2xl shadow-brand-500/20 hover:shadow-brand-500/40 transition-all duration-500 group flex flex-col justify-between">
                      <div>
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
                            <PieChart size={32} />
                        </div>
                        <h3 className="text-2xl font-black mb-4 tracking-tight leading-none">Smart Allocation</h3>
                        <p className="text-brand-100 text-sm leading-relaxed font-medium">
                            Pisahkan budget kebutuhan, keinginan, dan cicilan secara otomatis. Sistem copy-paste cerdas kami mengenali data Anda.
                        </p>
                      </div>
                      <div className="mt-8">
                          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-white w-2/3"></div>
                          </div>
                      </div>
                  </div>

                  {/* Smaller Card 2 */}
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group flex flex-col justify-between">
                      <div>
                        <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-8">
                            <CheckCircle2 size={32} />
                        </div>
                        <h3 className="text-2xl font-black mb-4 tracking-tight leading-none text-slate-900">Health Monitor</h3>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">
                            Cek rasio hutang (DSR) dan skor kesehatan finansial Anda dalam hitungan detik. Selalu waspada sebelum mengambil beban baru.
                        </p>
                      </div>
                      <div className="mt-8 flex gap-2">
                          <div className="h-6 w-6 rounded-full bg-green-100"></div>
                          <div className="h-6 w-6 rounded-full bg-slate-100"></div>
                          <div className="h-6 w-6 rounded-full bg-slate-100"></div>
                      </div>
                  </div>

                  {/* Wide Card bottom */}
                  <div className="md:col-span-2 bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl group overflow-hidden relative">
                      <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center h-full">
                          <div className="space-y-6">
                              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center">
                                  <ShieldCheck size={32} className="text-brand-400" />
                              </div>
                              <h3 className="text-3xl font-black tracking-tight leading-none">Financial Freedom Track</h3>
                              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                  Lihat proyeksi aset Anda setelah hutang lunas. Kami membantu Anda merencanakan investasi berikutnya untuk mencapai pensiun dini.
                              </p>
                              <Link to="/register" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-400">Jelajahi Peluang <ArrowUpRight size={16}/></Link>
                          </div>
                          <div className="relative h-full min-h-[200px] flex items-center justify-center">
                              <div className="absolute inset-0 bg-brand-500/20 blur-[60px] rounded-full"></div>
                              <TrendingUp size={140} className="text-brand-500 relative z-10 transform -rotate-6 group-hover:rotate-0 transition-transform duration-700" />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* 6. SECURITY & TRUST SECTION */}
      <section className="py-32 bg-white" id="security">
          <div className="max-w-7xl mx-auto px-6">
              <div className="bg-slate-50 rounded-[3rem] p-12 lg:p-20 grid lg:grid-cols-2 gap-16 items-center">
                  <div className="space-y-8">
                      <div className="p-4 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 w-fit">
                          <Fingerprint size={48} className="text-brand-600" />
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Keamanan Data Adalah Prioritas Mutlak Kami.</h2>
                      <p className="text-slate-500 text-lg leading-relaxed font-medium">
                          Kami tidak menyimpan detail perbankan Anda. Semua data finansial dienkripsi dengan standar industri militer (AES-256) dan diproses secara aman.
                      </p>
                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Enkripsi End-to-End</h4>
                              <p className="text-xs text-slate-500">Data Anda terproteksi sejak masuk hingga tersimpan di cloud kami.</p>
                          </div>
                          <div className="space-y-2">
                              <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">No Bank Access</h4>
                              <p className="text-xs text-slate-500">Sistem ini bekerja tanpa perlu akses langsung ke rekening bank Anda.</p>
                          </div>
                      </div>
                  </div>
                  <div className="relative">
                      <div className="absolute -inset-10 bg-brand-500/10 blur-[80px] rounded-full"></div>
                      <div className="relative bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 space-y-8">
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-green-50 border border-green-100">
                              <ShieldCheck className="text-green-600" size={24}/>
                              <span className="text-sm font-bold text-green-800">ISO/IEC 27001 Certified System</span>
                          </div>
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                              <Lock className="text-blue-600" size={24}/>
                              <span className="text-sm font-bold text-blue-800">Standard Encryption Protocol V42</span>
                          </div>
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-purple-50 border border-purple-100">
                              <Shield className="text-purple-600" size={24}/>
                              <span className="text-sm font-bold text-purple-800">Regular Security Audit & Penetration Test</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* 7. FINAL CTA: CONVERSION FOCUS */}
      <section className="py-40 px-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-500/5 rounded-full blur-[150px] pointer-events-none"></div>
          
          <div className="max-w-4xl mx-auto text-center space-y-12 relative z-10">
              <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.95]">
                  Siap Memulai Babak Baru Tanpa Cicilan?
              </h2>
              <p className="text-slate-500 text-xl max-w-2xl mx-auto font-medium">
                  Jangan biarkan bunga berbunga memakan masa depan Anda. Dapatkan sistem strategi kami sekarang, gratis selamanya untuk fitur dasar.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                  <Link to="/register" className="px-12 py-6 bg-brand-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-brand-700 transition shadow-2xl shadow-brand-500/40 transform hover:-translate-y-1 active:scale-95">
                      Buat Akun Gratis
                  </Link>
                  <Link to="/simulator" className="px-12 py-6 bg-white text-slate-900 border-2 border-slate-200 font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-50 transition shadow-xl shadow-slate-200/20">
                      Coba Simulator
                  </Link>
              </div>
              <div className="flex flex-col items-center gap-2 opacity-50">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Pendaftaran hanya butuh 30 detik</p>
                  <MousePointer2 size={24} className="animate-bounce mt-4" />
              </div>
          </div>
      </section>

      {/* 8. FOOTER: PROFESSIONAL FINISH */}
      <footer className="bg-slate-950 text-slate-400 py-24 px-6">
          <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-20">
                  <div className="col-span-2 space-y-6">
                      <div className="flex items-center gap-2.5 text-white">
                        <Wallet className="h-6 w-6 text-brand-500" />
                        <span className="font-black text-xl tracking-tighter uppercase">Paydone<span className="text-brand-500">.id</span></span>
                      </div>
                      <p className="text-sm leading-relaxed max-w-xs">
                          Sistem manajemen hutang dan strategi percepatan pelunasan pertama di Indonesia yang menggunakan AI terintegrasi.
                      </p>
                  </div>
                  <div className="space-y-6">
                      <h4 className="text-white font-black text-xs uppercase tracking-widest">Produk</h4>
                      <ul className="space-y-4 text-sm font-medium">
                          <li><a href="#" className="hover:text-brand-400 transition">Simulator</a></li>
                          <li><a href="#" className="hover:text-brand-400 transition">Strategist AI</a></li>
                          <li><a href="#" className="hover:text-brand-400 transition">Harga</a></li>
                      </ul>
                  </div>
                  <div className="space-y-6">
                      <h4 className="text-white font-black text-xs uppercase tracking-widest">Perusahaan</h4>
                      <ul className="space-y-4 text-sm font-medium">
                          <li><a href="#" className="hover:text-brand-400 transition">Tentang Kami</a></li>
                          <li><a href="#" className="hover:text-brand-400 transition">Blog</a></li>
                          <li><a href="#" className="hover:text-brand-400 transition">Karir</a></li>
                      </ul>
                  </div>
                  <div className="space-y-6">
                      <h4 className="text-white font-black text-xs uppercase tracking-widest">Legal</h4>
                      <ul className="space-y-4 text-sm font-medium">
                          <li><a href="#" className="hover:text-brand-400 transition">Privacy Policy</a></li>
                          <li><a href="#" className="hover:text-brand-400 transition">Terms of Service</a></li>
                      </ul>
                  </div>
                  <div className="space-y-6">
                      <h4 className="text-white font-black text-xs uppercase tracking-widest">Hubungi</h4>
                      <ul className="space-y-4 text-sm font-medium">
                          <li><a href="#" className="hover:text-brand-400 transition">support@paydone.id</a></li>
                          <li><a href="#" className="hover:text-brand-400 transition">WhatsApp Center</a></li>
                      </ul>
                  </div>
              </div>
              
              <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black uppercase tracking-[0.3em]">
                  <p>&copy; {new Date().getFullYear()} Paydone Financial System. Hak Cipta Dilindungi.</p>
                  <div className="flex gap-8">
                      <a href="#" className="hover:text-white transition">Twitter</a>
                      <a href="#" className="hover:text-white transition">Instagram</a>
                      <a href="#" className="hover:text-white transition">LinkedIn</a>
                  </div>
              </div>
          </div>
      </footer>
    </div>
  );
}
