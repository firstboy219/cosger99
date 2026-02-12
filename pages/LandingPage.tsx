
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ArrowRight, CheckCircle2, ShieldCheck, PieChart, BrainCircuit, TrendingUp, AlertTriangle, ChevronRight, Calculator, Lock, Zap, Sparkles, X } from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';
import { getConfig } from '../services/mockDb';
import { AppConfig } from '../types';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [config, setConfig] = useState<AppConfig>(getConfig());

  // Hero Calculator State
  const [debtAmount, setDebtAmount] = useState(100000000); // 100jt
  const [monthlyPay, setMonthlyPay] = useState(2500000); // 2.5jt
  
  // Smart Calculation for Hero
  const standardYears = Math.ceil(debtAmount / monthlyPay / 12 * 1.5); // Mock Interest drag
  const optimizedYears = Math.ceil(standardYears * 0.7); // 30% faster
  const savedInterest = (debtAmount * 0.15) * (standardYears - optimizedYears); // Mock saving

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    
    // Live Config Update
    const updateConfig = () => setConfig(getConfig());
    window.addEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
    
    // Add smooth scrolling globally
    document.documentElement.style.scrollBehavior = 'smooth';
    
    return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
        document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const appName = config.appName || 'Paydone.id';
  const appLogo = config.appLogoUrl;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-100">
      
      {/* 1. SMART NAVBAR */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-700">
            {appLogo ? (
                <img src={appLogo} alt="Logo" className="w-9 h-9 object-contain bg-white rounded-lg p-1 shadow-sm" />
            ) : (
                <div className="bg-gradient-to-tr from-brand-600 to-indigo-600 text-white p-1.5 rounded-lg shadow-lg">
                    <Wallet className="h-6 w-6" />
                </div>
            )}
            <span className="font-bold text-xl tracking-tight text-slate-900">{appName}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#simulator" className="hover:text-brand-600 transition cursor-pointer">Mini Simulator</a>
            <a href="#features" className="hover:text-brand-600 transition cursor-pointer">Fitur Cerdas</a>
            <a href="#comparison" className="hover:text-brand-600 transition cursor-pointer">Realita vs Bank</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/login" className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-full transition">
              Masuk
            </Link>
            <Link to="/register" className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition shadow-lg ring-2 ring-slate-900 ring-offset-2">
              Daftar Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION WITH INTERACTIVE CALCULATOR */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Content */}
          <div className="lg:col-span-6 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-brand-100 text-brand-700 text-[10px] font-bold tracking-wide uppercase shadow-sm animate-fade-in">
              <Sparkles size={12} className="text-yellow-500" />
              AI Personal Finance Consultant #1
            </div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.1]">
              Lunasi Hutang <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Lebih Cerdas.</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
              Bukan sekadar kalkulator. Kami adalah <span className="text-slate-900 font-bold">sistem strategi</span> yang membantu Anda menghitung biaya terselubung, mengatur cashflow, dan memberikan rute tercepat menuju bebas finansial.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/register" className="inline-flex items-center justify-center px-8 py-4 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-full transition shadow-xl shadow-brand-200 group">
                Mulai Strategi Sekarang
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#simulator" className="inline-flex items-center justify-center px-8 py-4 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-full transition shadow-sm">
                <Calculator className="mr-2 h-4 w-4 text-slate-400" />
                Cek Simulator Realita
              </a>
            </div>
            <div className="pt-4 flex items-center justify-center lg:justify-start gap-4 text-xs font-bold text-slate-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i*132}`} alt="user" />
                  </div>
                ))}
              </div>
              <p>Bergabung dengan <span className="text-slate-900">2,000+</span> pejuang bebas finansial.</p>
            </div>
          </div>

          {/* Right Content: Interactive Card (Smart Hook) */}
          <div className="lg:col-span-6 relative">
             <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-[2rem] rotate-3 opacity-20 blur-xl"></div>
             <div className="relative bg-white rounded-[2rem] border border-slate-200 shadow-2xl p-6 md:p-8" id="simulator" style={{ scrollMarginTop: '100px' }}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-100 text-brand-600 rounded-xl"><TrendingUp size={20}/></div>
                        <div>
                            <h3 className="font-bold text-slate-900">Simulasi Cepat</h3>
                            <p className="text-xs text-slate-500">Lihat potensi penghematan Anda</p>
                        </div>
                    </div>
                    <div className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-lg uppercase">Live Demo</div>
                </div>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                            <span>Total Hutang</span>
                            <span>{formatCurrency(debtAmount)}</span>
                        </div>
                        <input 
                          type="range" min="10000000" max="1000000000" step="5000000" 
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-600"
                          value={debtAmount} onChange={e => setDebtAmount(Number(e.target.value))}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
                            <span>Kemampuan Bayar / Bulan</span>
                            <span>{formatCurrency(monthlyPay)}</span>
                        </div>
                        <input 
                          type="range" min="1000000" max="50000000" step="500000" 
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-600"
                          value={monthlyPay} onChange={e => setMonthlyPay(Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className="mt-8 p-6 bg-slate-900 rounded-2xl text-white relative overflow-hidden">
                    <div className="relative z-10 grid grid-cols-2 gap-4 text-center">
                        <div className="border-r border-slate-700">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Cara Biasa</p>
                            <p className="text-xl font-bold text-slate-300">{standardYears} Tahun</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-brand-400 uppercase font-bold flex items-center justify-center gap-1"><Zap size={10}/> Cara {appName}</p>
                            <p className="text-xl font-bold text-white">{optimizedYears} Tahun</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800 text-center">
                        <p className="text-xs text-slate-400 mb-1">Potensi Hemat Bunga</p>
                        <p className="text-2xl font-black text-green-400">{formatCurrency(savedInterest)}</p>
                    </div>
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={120} /></div>
                </div>
                
                <p className="text-center text-[10px] text-slate-400 mt-4 italic">
                    *Estimasi kasar. Login untuk perhitungan akurat dengan AI.
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* 3. PROBLEM & SOLUTION (VISUAL COMPARISON) */}
      <section className="py-24 bg-white" id="comparison" style={{ scrollMarginTop: '100px' }}>
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Mengapa Kalkulator Bank Saja Tidak Cukup?</h2>
                <p className="text-slate-500">Bank sering menyembunyikan biaya awal (Upfront Cost) dan risiko bunga floating. {appName} membukanya secara transparan.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* Bank Way */}
                <div className="p-8 rounded-3xl border border-slate-100 bg-slate-50 opacity-80 hover:opacity-100 transition relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-6 opacity-50">
                        <div className="p-2 bg-slate-200 rounded-lg"><X size={20}/></div>
                        <h3 className="font-bold text-xl text-slate-700">Kalkulator Biasa</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 text-sm">
                            <span className="text-slate-500">Harga Aset</span>
                            <span className="font-bold">Rp 500.000.000</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 text-sm">
                            <span className="text-slate-500">DP (20%)</span>
                            <span className="font-bold">Rp 100.000.000</span>
                        </div>
                        <div className="p-4 border-2 border-dashed border-red-200 rounded-xl bg-red-50 text-center">
                            <p className="text-xs text-red-500 font-bold uppercase mb-1">Yang Anda Siapkan</p>
                            <p className="text-2xl font-bold text-red-700">Rp 100 Juta</p>
                            <p className="text-[10px] text-red-400 mt-1">(Padahal kurang!)</p>
                        </div>
                    </div>
                </div>

                {/* Paydone Way */}
                <div className="p-8 rounded-3xl border-2 border-brand-100 bg-white shadow-xl relative overflow-hidden transform md:scale-105 z-10">
                    <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Recommended</div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-brand-100 text-brand-600 rounded-lg"><CheckCircle2 size={20}/></div>
                        <h3 className="font-bold text-xl text-slate-900">{appName} Realita</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 text-sm border-b border-slate-50">
                            <span className="text-slate-500">DP (20%)</span>
                            <span className="font-bold">Rp 100.000.000</span>
                        </div>
                        <div className="flex justify-between items-center p-2 text-sm border-b border-slate-50 bg-amber-50/50 rounded">
                            <span className="text-amber-700 flex items-center gap-1"><AlertTriangle size={12}/> Provisi (1%)</span>
                            <span className="font-bold text-amber-700">+ Rp 4.000.000</span>
                        </div>
                        <div className="flex justify-between items-center p-2 text-sm border-b border-slate-50 bg-amber-50/50 rounded">
                            <span className="text-amber-700 flex items-center gap-1"><AlertTriangle size={12}/> Biaya Admin & Notaris</span>
                            <span className="font-bold text-amber-700">+ Rp 7.500.000</span>
                        </div>
                        <div className="flex justify-between items-center p-2 text-sm border-b border-slate-50 bg-amber-50/50 rounded">
                            <span className="text-amber-700 flex items-center gap-1"><AlertTriangle size={12}/> Asuransi Jiwa/Kebakaran</span>
                            <span className="font-bold text-amber-700">+ Rp 5.000.000</span>
                        </div>
                        
                        <div className="mt-4 p-4 bg-slate-900 rounded-xl text-center text-white">
                            <p className="text-xs text-brand-400 font-bold uppercase mb-1">Total Realita "Uang Muka"</p>
                            <p className="text-3xl font-black">Rp 116.5 Juta</p>
                            <p className="text-[10px] text-slate-400 mt-1">Kami menghindarkan Anda dari "Kaget Bayar"</p>
                        </div>
                    </div>
                </div>
            </div>
         </div>
      </section>

      {/* 4. FEATURES GRID */}
      <section className="py-24 bg-slate-50" id="features" style={{ scrollMarginTop: '100px' }}>
          <div className="max-w-7xl mx-auto px-6">
              <div className="mb-12">
                  <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Fitur Unggulan</span>
                  <h2 className="text-3xl font-bold text-slate-900 mt-2">Senjata Melawan Hutang</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                  {/* Card 1 */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition group">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
                          <BrainCircuit size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">AI Debt Strategist</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                          Kecerdasan buatan yang menganalisa profil hutangmu. Pilih strategi <strong>Snowball</strong> (psikologis) atau <strong>Avalanche</strong> (matematis) secara otomatis.
                      </p>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition group">
                      <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
                          <PieChart size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Smart Allocation</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                          Fitur input cepat "Copy-Paste" pengeluaran. Sistem otomatis memilah mana Kebutuhan, Keinginan, dan Kewajiban Hutang.
                      </p>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition group">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition">
                          <ShieldCheck size={24} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Financial Freedom Track</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                          Simulator masa depan. Hitung berapa aset yang dibutuhkan untuk pensiun, dan bagaimana mencapainya setelah hutang lunas.
                      </p>
                  </div>
              </div>
          </div>
      </section>

      {/* 5. CTA SECTION */}
      <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto bg-slate-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-brand-500 rounded-full blur-[150px] opacity-30"></div>
              
              <div className="relative z-10">
                  <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
                      Siap Mengambil Kendali?
                  </h2>
                  <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10">
                      Jangan biarkan bunga berbunga memakan masa depan Anda. Mulai atur strategi pelunasan hari ini, gratis.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Link to="/register" className="px-8 py-4 bg-white text-slate-900 font-bold rounded-full hover:bg-slate-100 transition shadow-lg flex items-center justify-center gap-2">
                          Buat Akun Gratis <ChevronRight size={18} />
                      </Link>
                      <Link to="/login" className="px-8 py-4 bg-transparent border border-slate-700 text-white font-bold rounded-full hover:bg-slate-800 transition">
                          Masuk Akun
                      </Link>
                  </div>
                  <p className="mt-8 text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Lock size={12} /> Data Anda terenkripsi dan aman.
                  </p>
              </div>
          </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2 text-slate-900">
                  {appLogo ? (
                      <img src={appLogo} alt="Logo" className="w-6 h-6 object-contain" />
                  ) : (
                      <Wallet className="h-6 w-6 text-brand-600" />
                  )}
                  <span className="font-bold text-lg">{appName}</span>
              </div>
              <div className="text-sm text-slate-500">
                  &copy; {new Date().getFullYear()} {appName}. All rights reserved.
              </div>
              <div className="flex gap-6 text-sm font-medium text-slate-600">
                  <a href="#" className="hover:text-brand-600">Privacy</a>
                  <a href="#" className="hover:text-brand-600">Terms</a>
                  <a href="#" className="hover:text-brand-600">Contact</a>
              </div>
          </div>
      </footer>
    </div>
  );
}
