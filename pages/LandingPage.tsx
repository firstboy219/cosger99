
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wallet, ArrowRight, CheckCircle2, ShieldCheck, PieChart, BrainCircuit, 
  TrendingUp, AlertTriangle, ChevronRight, Calculator, Lock, Zap, Sparkles, X,
  BarChart3, Calendar, Target, Users, ArrowDown, Star, Clock, DollarSign,
  ChevronDown, Play, Shield, Eye, Percent, Banknote, LineChart, Flame,
  Award, Heart, Menu, ArrowUpRight, MousePointer, RefreshCw,
  Smartphone, Wifi, WifiOff, Layers, FileText, Receipt, Landmark, 
  CircleDollarSign, ArrowDownUp, GitCompare, Lightbulb, BookOpen,
  CreditCard, Home, Car, BadgePercent, Megaphone
} from 'lucide-react';
import { formatCurrency } from '../services/financeUtils';
import { getConfig } from '../services/mockDb';
import { AppConfig } from '../types';

/* ─── Animated Counter Hook ─── */
function useCountUp(target: number, duration = 1500, trigger = true) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>();
  
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const startTime = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, trigger]);
  
  return count;
}

/* ─── Intersection Observer Hook ─── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  
  return { ref, inView };
}

/* ─── Typewriter Effect ─── */
function Typewriter({ words, className }: { words: string[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const word = words[idx];
    const speed = isDeleting ? 40 : 80;
    
    const timer = setTimeout(() => {
      if (!isDeleting) {
        setText(word.slice(0, text.length + 1));
        if (text.length + 1 === word.length) {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        setText(word.slice(0, text.length - 1));
        if (text.length === 0) {
          setIsDeleting(false);
          setIdx((idx + 1) % words.length);
        }
      }
    }, speed);
    
    return () => clearTimeout(timer);
  }, [text, isDeleting, idx, words]);
  
  return (
    <span className={className}>
      {text}
      <span className="animate-pulse">|</span>
    </span>
  );
}

/* ─── Floating Particles Background ─── */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20"
          style={{
            width: `${Math.random() * 6 + 2}px`,
            height: `${Math.random() * 6 + 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            backgroundColor: i % 3 === 0 ? '#3b82f6' : i % 3 === 1 ? '#6366f1' : '#14b8a6',
            animation: `float-particle ${Math.random() * 8 + 6}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, value, label, suffix, color, delay }: {
  icon: any; value: number; label: string; suffix?: string; color: string; delay: number;
}) {
  const { ref, inView } = useInView();
  const count = useCountUp(value, 1800, inView);
  
  return (
    <div
      ref={ref}
      className={`text-center transform transition-all duration-700 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
        <Icon size={24} />
      </div>
      <p className="text-4xl font-black text-slate-900 mb-1">
        {count.toLocaleString('id-ID')}{suffix}
      </p>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
    </div>
  );
}

/* ─── Feature Card with Hover Animation ─── */
function FeatureCard({ icon: Icon, title, desc, color, bgColor, idx }: {
  icon: any; title: string; desc: string; color: string; bgColor: string; idx: number;
}) {
  const { ref, inView } = useInView(0.15);
  const [hovered, setHovered] = useState(false);
  
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 group cursor-default overflow-hidden ${inView ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
      style={{ transitionDelay: `${idx * 100}ms` }}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${bgColor} rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
      <div className={`relative w-14 h-14 ${bgColor} ${color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
        <Icon size={26} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      <div className={`mt-6 flex items-center gap-2 text-sm font-bold ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
        <span>Pelajari lebih lanjut</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}

/* ─── Step Card (How it Works) ─── */
function StepCard({ num, title, desc, icon: Icon, delay }: {
  num: number; title: string; desc: string; icon: any; delay: number;
}) {
  const { ref, inView } = useInView();
  
  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center text-center transition-all duration-700 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center border-2 border-brand-100">
          <Icon size={32} className="text-brand-600" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center text-sm font-black shadow-lg">
          {num}
        </div>
      </div>
      <h4 className="text-lg font-bold text-slate-900 mb-2">{title}</h4>
      <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{desc}</p>
    </div>
  );
}

/* ─── Testimonial Card ─── */
function TestimonialCard({ name, role, text, avatar, rating, delay }: {
  name: string; role: string; text: string; avatar: number; rating: number; delay: number;
}) {
  const { ref, inView } = useInView();
  
  return (
    <div
      ref={ref}
      className={`bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-slate-600 text-sm leading-relaxed mb-6 italic">"{text}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar}`} alt={name} className="w-full h-full" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">{name}</p>
          <p className="text-slate-400 text-xs">{role}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── FAQ Accordion Item ─── */
function FAQItem({ q, a, open, onClick }: { q: string; a: string; open: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="font-bold text-slate-900 group-hover:text-brand-600 transition pr-4">{q}</span>
        <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${open ? 'rotate-180 text-brand-600' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-48 pb-5' : 'max-h-0'}`}>
        <p className="text-slate-500 text-sm leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ─── Strategy Comparison Card ─── */
function StrategyCard({ title, subtitle, desc, icon: Icon, color, pros, cons, example }: {
  title: string; subtitle: string; desc: string; icon: any; color: 'amber' | 'blue';
  pros: string[]; cons: string[]; example: { debts: string[]; saved: string };
}) {
  const { ref, inView } = useInView(0.15);
  const colorMap = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', ring: 'bg-amber-100', accent: 'bg-amber-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', ring: 'bg-blue-100', accent: 'bg-blue-600' },
  };
  const c = colorMap[color];

  return (
    <div
      ref={ref}
      className={`bg-white p-8 rounded-3xl border ${c.border} shadow-sm hover:shadow-xl transition-all duration-500 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-12 h-12 ${c.bg} ${c.text} rounded-2xl flex items-center justify-center`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">{title}</h3>
          <p className={`text-xs font-bold ${c.text}`}>{subtitle}</p>
        </div>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed mb-6">{desc}</p>

      <div className="space-y-2 mb-5">
        {pros.map((p, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <span className="text-slate-600">{p}</span>
          </div>
        ))}
        {cons.map((c2, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <AlertTriangle size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-400">{c2}</span>
          </div>
        ))}
      </div>

      <div className={`p-4 ${c.bg} rounded-xl border ${c.border}`}>
        <p className={`text-[10px] font-bold ${c.text} uppercase tracking-wider mb-2`}>Contoh Urutan Pelunasan</p>
        <div className="space-y-1.5">
          {example.debts.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
              <span className={`w-5 h-5 ${c.accent} text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>{i + 1}</span>
              {d}
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-dashed border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Estimasi Hemat Bunga</p>
          <p className={`text-xl font-black ${c.text}`}>{example.saved}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Tool Showcase Card ─── */
function ToolShowcase({ icon: Icon, title, desc, tags, color, visual }: {
  icon: any; title: string; desc: string; tags: string[]; color: string; visual: string;
}) {
  const { ref, inView } = useInView(0.1);
  const colorMap: Record<string, { bg: string; text: string; tagBg: string; tagText: string; barColor: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', tagBg: 'bg-blue-50', tagText: 'text-blue-600', barColor: '#3b82f6' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', tagBg: 'bg-emerald-50', tagText: 'text-emerald-600', barColor: '#10b981' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', tagBg: 'bg-amber-50', tagText: 'text-amber-600', barColor: '#f59e0b' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', tagBg: 'bg-rose-50', tagText: 'text-rose-600', barColor: '#f43f5e' },
  };
  const c = colorMap[color] || colorMap.blue;

  const renderVisual = () => {
    if (visual === 'chart') return (
      <div className="flex items-end gap-1.5 h-16">
        {[40, 65, 50, 80, 70, 90, 55, 75].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md transition-all duration-500" style={{ height: `${h}%`, background: i === 5 ? c.barColor : `${c.barColor}33`, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
    if (visual === 'calc') return (
      <div className="space-y-2">
        {['DP Bank: Rp 100jt', '+ Notaris: Rp 7.5jt', '+ Asuransi: Rp 5.2jt'].map((line, i) => (
          <div key={i} className={`text-[10px] font-mono px-2.5 py-1.5 rounded-md ${i === 0 ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
            {line}
          </div>
        ))}
        <div className="text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-md bg-slate-900 text-white">= Total: Rp 120.2jt</div>
      </div>
    );
    if (visual === 'receipt') return (
      <div className="space-y-1.5">
        {['Makan Siang - Rp 35.000', 'Bensin - Rp 50.000', 'Kopi - Rp 28.000'].map((line, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${i === 2 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="text-slate-500 font-mono">{line}</span>
            <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${i === 2 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {i === 2 ? 'Keinginan' : 'Kebutuhan'}
            </span>
          </div>
        ))}
      </div>
    );
    if (visual === 'calendar') return (
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: 28 }).map((_, i) => {
          const isPayday = [4, 11, 18, 25].includes(i);
          const isPaid = [4, 11].includes(i);
          return (
            <div key={i} className={`w-full aspect-square rounded-md text-[8px] flex items-center justify-center font-bold ${
              isPayday ? (isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700') : 'bg-slate-50 text-slate-300'
            }`}>
              {i + 1}
            </div>
          );
        })}
      </div>
    );
    return null;
  };

  return (
    <div
      ref={ref}
      className={`bg-white p-6 md:p-8 rounded-3xl border border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group ${inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
    >
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className={`inline-flex items-center gap-2 w-12 h-12 ${c.bg} ${c.text} rounded-2xl justify-center mb-4 group-hover:scale-110 transition-transform`}>
            <Icon size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">{desc}</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <span key={i} className={`px-3 py-1 ${c.tagBg} ${c.tagText} text-[10px] font-bold rounded-full uppercase tracking-wider`}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="w-full md:w-48 flex-shrink-0 bg-slate-50 rounded-xl p-4 border border-slate-100">
          {renderVisual()}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState(0);

  // Hero Calculator State
  const [debtAmount, setDebtAmount] = useState(100000000);
  const [monthlyPay, setMonthlyPay] = useState(2500000);
  const [interestRate, setInterestRate] = useState(12);
  
  // Calculations
  const monthlyRate = interestRate / 100 / 12;
  const standardMonths = monthlyRate > 0 
    ? Math.ceil(-Math.log(1 - (debtAmount * monthlyRate / monthlyPay)) / Math.log(1 + monthlyRate))
    : Math.ceil(debtAmount / monthlyPay);
  const safeStandardMonths = isFinite(standardMonths) && standardMonths > 0 ? standardMonths : Math.ceil(debtAmount / monthlyPay * 1.5);
  const standardYears = (safeStandardMonths / 12).toFixed(1);
  const optimizedMonths = Math.ceil(safeStandardMonths * 0.65);
  const optimizedYears = (optimizedMonths / 12).toFixed(1);
  const totalInterestStandard = (monthlyPay * safeStandardMonths) - debtAmount;
  const totalInterestOptimized = (monthlyPay * optimizedMonths) - debtAmount;
  const savedInterest = Math.max(0, totalInterestStandard - totalInterestOptimized);
  const savedMonths = safeStandardMonths - optimizedMonths;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    const updateConfig = () => setConfig(getConfig());
    window.addEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
    document.documentElement.style.scrollBehavior = 'smooth';
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('PAYDONE_CONFIG_UPDATE', updateConfig);
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const appName = config.appName || 'Paydone.id';
  const appLogo = config.appLogoUrl;

  const features = [
    { icon: BrainCircuit, title: 'AI Debt Strategist', desc: 'Kecerdasan buatan menganalisa profil hutang Anda. Pilih strategi Snowball (psikologis) atau Avalanche (matematis) secara otomatis berdasarkan data riil.', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { icon: PieChart, title: 'Smart Allocation', desc: 'Input cepat pengeluaran harian. Sistem otomatis memilah Kebutuhan, Keinginan, dan Kewajiban Hutang dengan rasio optimal.', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { icon: ShieldCheck, title: 'Financial Freedom Track', desc: 'Simulator masa depan lengkap. Hitung aset pensiun yang dibutuhkan dan jalur mencapainya setelah hutang lunas.', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { icon: Calendar, title: 'Payment Calendar', desc: 'Kalender cicilan terintegrasi. Notifikasi jatuh tempo otomatis dan tracking pembayaran per hutang dengan visual timeline.', color: 'text-rose-600', bgColor: 'bg-rose-50' },
    { icon: BarChart3, title: 'Realtime Dashboard', desc: 'Dashboard interaktif dengan grafik proyeksi, DSR ratio, health score, dan progress pelunasan yang update secara real-time.', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { icon: Target, title: 'Sinking Fund Manager', desc: 'Kelola dana cadangan dengan target visual. Siapkan DP rumah, dana darurat, atau liburan dengan auto-allocation cerdas.', color: 'text-teal-600', bgColor: 'bg-teal-50' },
  ];

  const howItWorks = [
    { icon: Users, title: 'Daftar Gratis', desc: 'Buat akun dalam 30 detik. Tidak perlu kartu kredit atau data sensitif perbankan.' },
    { icon: Banknote, title: 'Input Data Hutang', desc: 'Masukkan detail hutang: KPR, KKB, KTA, atau Kartu Kredit. AI akan mendeteksi biaya tersembunyi.' },
    { icon: BrainCircuit, title: 'AI Analisis', desc: 'Sistem menganalisa dan merekomendasikan strategi pelunasan tercepat sesuai profil keuangan Anda.' },
    { icon: TrendingUp, title: 'Eksekusi & Monitor', desc: 'Ikuti roadmap harian. Track progress, terima notifikasi, dan lihat hutang berkurang setiap hari.' },
  ];

  const testimonials = [
    { name: 'Budi Santoso', role: 'Karyawan Swasta, Jakarta', text: 'Dulu saya bayar cicilan asal-asalan. Setelah pakai Paydone, saya sadar bisa hemat Rp 47 juta bunga KPR dengan strategi Avalanche. Luar biasa!', avatar: 100, rating: 5 },
    { name: 'Sari Dewi', role: 'Freelancer, Bandung', text: 'Fitur allocation-nya bikin saya disiplin. Sekarang gaji langsung ter-split otomatis ke kebutuhan, keinginan, dan cicilan. Stress berkurang drastis.', avatar: 200, rating: 5 },
    { name: 'Andi Pratama', role: 'Pengusaha UMKM, Surabaya', text: 'Simulator realita-nya eye-opening banget. Ternyata DP rumah bukan cuma 20%, ada biaya tersembunyi hampir Rp 20 juta yang tidak pernah dibilang bank.', avatar: 300, rating: 5 },
    { name: 'Rina Kusuma', role: 'Dokter, Yogyakarta', text: 'Kalender saktinya sangat membantu. Dulu sering lupa tanggal jatuh tempo, sekarang semua terjadwal rapi. Auto-marking fiturnya brilliant.', avatar: 400, rating: 5 },
    { name: 'Hendra Wijaya', role: 'PNS, Medan', text: 'Family mode-nya game changer. Istri dan saya sekarang punya visibility yang sama soal keuangan keluarga. Tidak ada lagi yang disembunyikan.', avatar: 500, rating: 5 },
    { name: 'Maya Putri', role: 'Content Creator, Bali', text: 'Sebagai freelancer dengan income tidak tetap, fitur multi-income dan smart allocation sangat membantu. Akhirnya bisa nabung konsisten tiap bulan.', avatar: 600, rating: 5 },
  ];

  const faqs = [
    { q: 'Apakah Paydone gratis?', a: 'Ya, Paydone sepenuhnya gratis untuk pengguna personal. Fitur dasar seperti tracking hutang, simulator, dan AI strategist dapat diakses tanpa biaya apapun. Kami berencana menawarkan fitur premium di masa depan.' },
    { q: 'Apakah data keuangan saya aman?', a: 'Sangat aman. Data Anda terenkripsi end-to-end dan disimpan secara lokal terlebih dahulu. Sync ke cloud bersifat opsional dan menggunakan enkripsi standar industri. Kami tidak pernah menjual data pengguna.' },
    { q: 'Hutang apa saja yang bisa ditrack?', a: 'Semua jenis hutang: KPR (Kredit Pemilikan Rumah), KKB (Kredit Kendaraan Bermotor), KTA (Kredit Tanpa Agunan), Kartu Kredit, pinjaman online, dan hutang personal. Masing-masing memiliki kalkulasi bunga yang sesuai.' },
    { q: 'Bagaimana AI Strategist bekerja?', a: 'AI kami menganalisa total hutang, suku bunga, sisa tenor, dan profil penghasilan Anda. Kemudian merekomendasikan urutan pelunasan optimal - apakah Snowball (dari terkecil) atau Avalanche (dari bunga tertinggi) - beserta proyeksi waktu dan penghematan.' },
    { q: 'Bisa digunakan untuk keluarga?', a: 'Ya! Fitur Family Mode memungkinkan Anda mengelola keuangan bersama pasangan atau anggota keluarga. Setiap orang memiliki akun terpisah namun bisa melihat gambaran finansial keluarga secara keseluruhan.' },
    { q: 'Apakah perlu koneksi internet?', a: 'Tidak selalu. Paydone bekerja secara offline-first. Data disimpan lokal dan akan sync otomatis saat koneksi tersedia. Anda tetap bisa input pengeluaran dan melihat dashboard tanpa internet.' },
    { q: 'Apa bedanya Snowball dan Avalanche?', a: 'Snowball melunasi hutang dari nominal terkecil dulu untuk membangun momentum psikologis. Avalanche melunasi dari bunga tertinggi dulu untuk menghemat uang secara matematis. AI kami menganalisa profil Anda dan merekomendasikan yang paling cocok.' },
    { q: 'Berapa banyak hutang yang bisa ditrack?', a: 'Unlimited. Tidak ada batasan jumlah hutang, transaksi harian, atau rekening yang bisa Anda masukkan. Pakai sepuasnya tanpa khawatir limit.' },
    { q: 'Bisa lihat proyeksi kapan hutang lunas?', a: 'Ya! Financial Freedom Calculator menghitung proyeksi waktu pelunasan semua hutang, berapa bunga yang bisa dihemat, dan kapan Anda mencapai financial freedom berdasarkan data riil Anda.' },
  ];

  const comparisonTabs = [
    {
      label: 'KPR Rp 500 Juta',
      bankTotal: 'Rp 100.000.000',
      bankLabel: 'DP yang bank bilang',
      items: [
        { label: 'DP (20%)', amount: 'Rp 100.000.000', isHidden: false },
        { label: 'Provisi Bank (1%)', amount: '+ Rp 4.000.000', isHidden: true },
        { label: 'Admin & Notaris', amount: '+ Rp 7.500.000', isHidden: true },
        { label: 'Asuransi Jiwa + Kebakaran', amount: '+ Rp 5.200.000', isHidden: true },
        { label: 'Appraisal & SKMHT', amount: '+ Rp 3.500.000', isHidden: true },
      ],
      realTotal: 'Rp 120.2 Juta',
      diff: 'Rp 20.2 Juta',
    },
    {
      label: 'KKB Rp 250 Juta',
      bankTotal: 'Rp 62.500.000',
      bankLabel: 'DP yang dealer bilang',
      items: [
        { label: 'DP (25%)', amount: 'Rp 62.500.000', isHidden: false },
        { label: 'Asuransi All Risk', amount: '+ Rp 8.750.000', isHidden: true },
        { label: 'Admin & Provisi', amount: '+ Rp 3.000.000', isHidden: true },
        { label: 'GPS Tracker', amount: '+ Rp 1.500.000', isHidden: true },
      ],
      realTotal: 'Rp 75.75 Juta',
      diff: 'Rp 13.25 Juta',
    },
    {
      label: 'KTA Rp 50 Juta',
      bankTotal: 'Rp 0',
      bankLabel: 'Biaya yang diiklankan',
      items: [
        { label: 'Tanpa Jaminan', amount: 'Rp 0', isHidden: false },
        { label: 'Provisi (3-6%)', amount: '+ Rp 2.500.000', isHidden: true },
        { label: 'Asuransi Kredit', amount: '+ Rp 1.500.000', isHidden: true },
        { label: 'Biaya Materai & Admin', amount: '+ Rp 500.000', isHidden: true },
      ],
      realTotal: 'Rp 4.5 Juta',
      diff: 'Rp 4.5 Juta',
    },
  ];

  const currentTab = comparisonTabs[activeTab];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-15px); }
          75% { transform: translateY(-30px) translateX(5px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
        .animate-slide-up-d1 { animation: slide-up 0.8s ease-out 0.1s forwards; opacity: 0; }
        .animate-slide-up-d2 { animation: slide-up 0.8s ease-out 0.2s forwards; opacity: 0; }
        .animate-slide-up-d3 { animation: slide-up 0.8s ease-out 0.3s forwards; opacity: 0; }
        .animate-slide-up-d4 { animation: slide-up 0.8s ease-out 0.4s forwards; opacity: 0; }
        .animate-pulse-ring { animation: pulse-ring 2s infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #2563eb, #6366f1, #2563eb);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient-x 3s ease infinite;
        }
        .range-styled::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
          border: 3px solid white;
        }
        .range-styled::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
          border: 3px solid white;
        }
        .range-styled {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          outline: none;
        }
      `}</style>
      
      {/* ═══ 1. NAVBAR ═══ */}
      <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-sm py-3' : 'bg-white/0 py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="w-9 h-9 object-contain bg-white rounded-xl p-1 shadow-sm" />
            ) : (
              <div className="bg-brand-600 text-white p-2 rounded-xl shadow-lg shadow-brand-600/30">
                <Wallet className="h-5 w-5" />
              </div>
            )}
            <span className="font-black text-xl tracking-tight text-slate-900">{appName}</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-500">
            <a href="#simulator" className="hover:text-brand-600 transition">Simulator</a>
            <a href="#features" className="hover:text-brand-600 transition">Fitur</a>
            <a href="#comparison" className="hover:text-brand-600 transition">Perbandingan</a>
            <a href="#strategy" className="hover:text-brand-600 transition">Strategi AI</a>
            <a href="#tools" className="hover:text-brand-600 transition">Tools</a>
            <a href="#faq" className="hover:text-brand-600 transition">FAQ</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:inline-flex px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition">
              Masuk
            </Link>
            <Link to="/register" className="px-5 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-full transition shadow-lg shadow-brand-600/25 animate-pulse-ring">
              Daftar Gratis
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition">
              <Menu size={22} />
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 shadow-xl">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-1">
              {[
                { href: '#simulator', label: 'Simulator' },
                { href: '#features', label: 'Fitur' },
                { href: '#comparison', label: 'Perbandingan' },
                { href: '#strategy', label: 'Strategi AI' },
                { href: '#tools', label: 'Tools' },
                { href: '#faq', label: 'FAQ' },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand-600 rounded-xl transition"
                >
                  {item.label}
                </a>
              ))}
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition">
                Masuk
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ 2. HERO SECTION ═══ */}
      <section className="relative pt-28 pb-16 lg:pt-44 lg:pb-28 px-6 overflow-hidden">
        <FloatingParticles />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-brand-500/8 rounded-full blur-[150px] -z-10 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="lg:col-span-6 space-y-7 text-center lg:text-left">
            <div className="animate-slide-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-brand-100 text-brand-700 text-xs font-bold tracking-wide shadow-sm">
              <Sparkles size={14} className="text-amber-500" />
              AI Personal Finance Consultant #1 di Indonesia
            </div>
            
            <h1 className="animate-slide-up-d1 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight text-slate-900 leading-[1.08]">
              Lunasi Hutang{' '}
              <br className="hidden sm:block" />
              <span className="shimmer-text">
                <Typewriter words={['Lebih Cerdas.', 'Lebih Cepat.', 'Tanpa Stress.']} />
              </span>
            </h1>
            
            <p className="animate-slide-up-d2 text-base lg:text-lg text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Bukan sekadar kalkulator. Kami adalah{' '}
              <span className="text-slate-900 font-bold">sistem strategi berbasis AI</span>{' '}
              yang mengungkap biaya terselubung bank, mengatur cashflow, dan memberikan{' '}
              <span className="text-brand-600 font-bold">rute tercepat</span> menuju bebas finansial.
            </p>
            
            <div className="animate-slide-up-d3 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/register" className="inline-flex items-center justify-center px-8 py-4 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-full transition-all shadow-xl shadow-brand-600/25 hover:shadow-brand-600/40 hover:scale-[1.02] active:scale-[0.98] group">
                Mulai Strategi Sekarang
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#simulator" className="inline-flex items-center justify-center px-8 py-4 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-brand-200 hover:bg-brand-50 rounded-full transition-all shadow-sm group">
                <Play className="mr-2 h-4 w-4 text-brand-600 group-hover:scale-110 transition-transform" />
                Coba Simulator
              </a>
            </div>
            
            <div className="animate-slide-up-d4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 pt-2">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-9 w-9 rounded-full border-[3px] border-white bg-slate-100 overflow-hidden shadow-sm">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 132}`} alt="user" className="w-full h-full" />
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                <span className="text-slate-900 font-black text-sm">2,847+</span> pengguna aktif
                <div className="flex items-center gap-1 mt-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={10} className="fill-amber-400 text-amber-400" />)}
                  <span className="ml-1 font-bold">4.9/5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: Interactive Calculator */}
          <div className="lg:col-span-6 relative" id="simulator" style={{ scrollMarginTop: '100px' }}>
            <div className="absolute inset-0 bg-brand-600 rounded-[2rem] rotate-2 opacity-10 blur-2xl scale-105" />
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-400 rounded-full blur-3xl opacity-20" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-15" />
            
            <div className="relative bg-white rounded-[2rem] border border-slate-200/80 shadow-2xl shadow-slate-200/50 p-6 md:p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Simulasi Cepat</h3>
                    <p className="text-xs text-slate-400">Geser slider untuk melihat proyeksi</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Live
                </div>
              </div>

              <div className="space-y-7">
                {/* Debt Amount Slider */}
                <div>
                  <div className="flex justify-between items-baseline mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Hutang</span>
                    <span className="text-lg font-black text-slate-900">{formatCurrency(debtAmount)}</span>
                  </div>
                  <input 
                    type="range" min="10000000" max="2000000000" step="5000000"
                    className="range-styled w-full cursor-pointer"
                    style={{ background: `linear-gradient(to right, #2563eb ${((debtAmount - 10000000) / (2000000000 - 10000000)) * 100}%, #e2e8f0 ${((debtAmount - 10000000) / (2000000000 - 10000000)) * 100}%)` }}
                    value={debtAmount} onChange={e => setDebtAmount(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Rp 10 Jt</span><span>Rp 2 Miliar</span>
                  </div>
                </div>
                
                {/* Monthly Payment Slider */}
                <div>
                  <div className="flex justify-between items-baseline mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cicilan / Bulan</span>
                    <span className="text-lg font-black text-slate-900">{formatCurrency(monthlyPay)}</span>
                  </div>
                  <input 
                    type="range" min="500000" max="50000000" step="500000"
                    className="range-styled w-full cursor-pointer"
                    style={{ background: `linear-gradient(to right, #2563eb ${((monthlyPay - 500000) / (50000000 - 500000)) * 100}%, #e2e8f0 ${((monthlyPay - 500000) / (50000000 - 500000)) * 100}%)` }}
                    value={monthlyPay} onChange={e => setMonthlyPay(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Rp 500 Rb</span><span>Rp 50 Jt</span>
                  </div>
                </div>

                {/* Interest Rate Slider */}
                <div>
                  <div className="flex justify-between items-baseline mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Suku Bunga / Tahun</span>
                    <span className="text-lg font-black text-slate-900">{interestRate}%</span>
                  </div>
                  <input 
                    type="range" min="1" max="36" step="0.5"
                    className="range-styled w-full cursor-pointer"
                    style={{ background: `linear-gradient(to right, #2563eb ${((interestRate - 1) / (36 - 1)) * 100}%, #e2e8f0 ${((interestRate - 1) / (36 - 1)) * 100}%)` }}
                    value={interestRate} onChange={e => setInterestRate(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>1%</span><span>36%</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="mt-8 p-6 bg-slate-900 rounded-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Wallet size={140} /></div>
                <div className="relative z-10">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="py-3 px-2 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Cara Biasa</p>
                      <p className="text-2xl font-black text-slate-300">{standardYears}</p>
                      <p className="text-[10px] text-slate-500">tahun</p>
                    </div>
                    <div className="py-3 px-2 bg-brand-600/20 rounded-xl border border-brand-400/30">
                      <p className="text-[10px] text-brand-300 uppercase font-bold flex items-center justify-center gap-1 tracking-wider mb-1">
                        <Zap size={10} /> {appName}
                      </p>
                      <p className="text-2xl font-black text-white">{optimizedYears}</p>
                      <p className="text-[10px] text-brand-200">tahun</p>
                    </div>
                  </div>
                  
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="text-center py-3 border-t border-slate-700/50">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Hemat Waktu</p>
                      <p className="text-lg font-black text-amber-400">{savedMonths} Bulan</p>
                    </div>
                    <div className="text-center py-3 border-t border-slate-700/50">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Hemat Bunga</p>
                      <p className="text-lg font-black text-emerald-400">{formatCurrency(savedInterest)}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <Link to="/register" className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-600/30 active:scale-[0.98]">
                <Calculator size={16} />
                Hitung Lebih Detail dengan AI
                <ArrowRight size={14} />
              </Link>

              <p className="text-center text-[10px] text-slate-400 mt-3">
                *Estimasi dengan metode anuitas. Login untuk perhitungan detail + strategi AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 3. SOCIAL PROOF STATS ═══ */}
      <section className="py-16 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard icon={Users} value={2847} label="Pengguna Aktif" suffix="+" color="bg-blue-50 text-blue-600" delay={0} />
            <StatCard icon={DollarSign} value={157} label="Miliar Hutang Dikelola" suffix="M" color="bg-emerald-50 text-emerald-600" delay={100} />
            <StatCard icon={Clock} value={23} label="Bulan Rata-rata Dihemat" suffix="" color="bg-amber-50 text-amber-600" delay={200} />
            <StatCard icon={Heart} value={98} label="Persen Kepuasan User" suffix="%" color="bg-rose-50 text-rose-600" delay={300} />
          </div>
        </div>
      </section>

      {/* ═══ 4. PROBLEM & SOLUTION (Tabbed Comparison) ═══ */}
      <section className="py-24 bg-white" id="comparison" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Transparansi Penuh</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              Mengapa Kalkulator Bank{' '}
              <span className="text-red-500">Tidak Cukup?</span>
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Bank & dealer menyembunyikan biaya awal (Upfront Cost). {appName} mengungkap semuanya agar Anda tidak "kaget bayar."
            </p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-10">
            {comparisonTabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-5 py-2.5 text-sm font-bold rounded-full transition-all ${activeTab === i ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto">
            {/* Bank Way */}
            <div className="p-8 rounded-3xl border border-slate-100 bg-slate-50/80 relative overflow-hidden group hover:border-slate-200 transition-all">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-slate-200 text-slate-400 rounded-xl"><X size={20}/></div>
                <div>
                  <h3 className="font-bold text-lg text-slate-600">Kalkulator Biasa</h3>
                  <p className="text-xs text-slate-400">Apa yang bank/dealer katakan</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3.5 bg-white rounded-xl border border-slate-200/80 text-sm">
                  <span className="text-slate-500">{currentTab.items[0]?.label}</span>
                  <span className="font-bold">{currentTab.items[0]?.amount}</span>
                </div>
              </div>
              <div className="mt-6 p-5 border-2 border-dashed border-red-200 rounded-2xl bg-red-50/80 text-center">
                <p className="text-xs text-red-500 font-bold uppercase tracking-wider mb-1">{currentTab.bankLabel}</p>
                <p className="text-3xl font-black text-red-600">{currentTab.bankTotal}</p>
                <p className="text-xs text-red-400 mt-1.5 flex items-center justify-center gap-1">
                  <AlertTriangle size={12} />
                  Informasi tidak lengkap
                </p>
              </div>
            </div>

            {/* Paydone Way */}
            <div className="p-8 rounded-3xl border-2 border-brand-100 bg-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1">
                <Eye size={10} /> Full Transparency
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl"><CheckCircle2 size={20}/></div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{appName} Realita</h3>
                  <p className="text-xs text-slate-400">Biaya yang sebenarnya</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {currentTab.items.map((item, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center p-3 text-sm rounded-xl transition-all ${item.isHidden ? 'bg-amber-50/80 border border-amber-100' : 'border border-slate-100'}`}
                  >
                    <span className={`flex items-center gap-1.5 ${item.isHidden ? 'text-amber-700' : 'text-slate-500'}`}>
                      {item.isHidden && <AlertTriangle size={12} />}
                      {item.label}
                    </span>
                    <span className={`font-bold ${item.isHidden ? 'text-amber-700' : 'text-slate-900'}`}>
                      {item.amount}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-5 bg-slate-900 rounded-2xl text-center text-white">
                <p className="text-[10px] text-brand-300 font-bold uppercase tracking-wider mb-1">Total Realita yang Harus Disiapkan</p>
                <p className="text-3xl font-black">{currentTab.realTotal}</p>
                <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-bold">
                  <AlertTriangle size={10} />
                  Selisih {currentTab.diff} yang tidak diinfokan
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 5. FEATURES GRID ═══ */}
      <section className="py-24 bg-slate-50" id="features" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Fitur Unggulan</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              Senjata Lengkap Melawan Hutang
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Bukan hanya satu tool, tapi ekosistem lengkap yang bekerja bersama untuk membebaskan Anda dari jeratan hutang secara sistematis.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5B. SNOWBALL vs AVALANCHE STRATEGY ═══ */}
      <section className="py-24 bg-white" id="strategy" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">AI Strategy Engine</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              2 Strategi Pelunasan, <span className="text-brand-600">1 Rekomendasi AI</span>
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Tidak ada solusi satu ukuran untuk semua. AI kami menganalisa profil Anda dan merekomendasikan strategi yang paling cocok.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Snowball */}
            <StrategyCard
              title="Snowball Method"
              subtitle="Kemenangan Psikologis"
              desc="Lunasi hutang terkecil dulu. Setiap hutang yang lunas memberikan momentum dan motivasi untuk melanjutkan ke hutang berikutnya."
              icon={Flame}
              color="amber"
              pros={['Motivasi tinggi dari quick wins', 'Cocok untuk yang butuh dorongan psikologis', 'Jumlah tagihan berkurang cepat']}
              cons={['Total bunga bisa lebih besar', 'Secara matematis bukan yang terhemat']}
              example={{ debts: ['KTA Rp 5jt (lunas bulan ke-3)', 'Kartu Kredit Rp 15jt (lunas bulan ke-9)', 'KKB Rp 120jt (lunas bulan ke-48)'], saved: 'Rp 8.2 Juta' }}
            />
            {/* Avalanche */}
            <StrategyCard
              title="Avalanche Method"
              subtitle="Optimasi Matematis"
              desc="Lunasi hutang dengan bunga tertinggi dulu. Secara matematis, ini menghemat total uang paling banyak dalam jangka panjang."
              icon={TrendingUp}
              color="blue"
              pros={['Total bunga yang dibayar paling kecil', 'Secara matematis paling efisien', 'Hemat jutaan rupiah jangka panjang']}
              cons={['Butuh disiplin tinggi di awal', 'Quick wins lebih lambat terasa']}
              example={{ debts: ['Kartu Kredit 2.5%/bln (lunas bulan ke-6)', 'KTA 1.8%/bln (lunas bulan ke-18)', 'KPR 0.9%/bln (lunas bulan ke-60)'], saved: 'Rp 23.7 Juta' }}
            />
          </div>

          <div className="mt-12 max-w-3xl mx-auto">
            <div className="bg-slate-900 rounded-2xl p-8 md:p-10 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-brand-500 rounded-full blur-[100px] opacity-20" />
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500 rounded-full blur-[100px] opacity-15" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-500/20 border border-brand-400/30 rounded-full text-xs font-bold text-brand-300 mb-5">
                  <BrainCircuit size={14} />
                  Powered by AI
                </div>
                <h3 className="text-xl md:text-2xl font-black text-white mb-3">Bingung Pilih yang Mana?</h3>
                <p className="text-slate-400 text-sm mb-6 max-w-lg mx-auto leading-relaxed">
                  Cukup input data hutang Anda, AI kami akan menganalisa dan merekomendasikan strategi terbaik beserta proyeksi waktu dan penghematan bunga secara detail.
                </p>
                <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full transition-all shadow-lg shadow-brand-600/25 hover:scale-[1.02] active:scale-[0.98]">
                  <BrainCircuit size={16} />
                  Coba AI Strategist Gratis
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 5C. COMPLETE TOOLS SHOWCASE ═══ */}
      <section className="py-24 bg-slate-50" id="tools" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">All-in-One Platform</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              10+ Tools Keuangan dalam <span className="text-brand-600">Satu Aplikasi</span>
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Tidak perlu spreadsheet terpisah, tidak perlu 5 aplikasi berbeda. Semua yang Anda butuhkan untuk mengelola keuangan ada di sini.
            </p>
          </div>

          {/* Tool Grid - 2 column layout with visual previews */}
          <div className="grid lg:grid-cols-2 gap-6 mb-12">
            <ToolShowcase
              icon={BarChart3}
              title="Dashboard Interaktif"
              desc="Grafik DSR, crossing analysis income vs expense, health score, dan progress pelunasan. Semua data real-time dalam satu layar."
              tags={['Real-time', 'Grafik', 'Health Score']}
              color="blue"
              visual="chart"
            />
            <ToolShowcase
              icon={Calculator}
              title="Simulator Realita"
              desc="Hitung biaya tersembunyi KPR, KKB, KTA lengkap. Bandingkan bank A vs bank B. Lihat total cost of ownership yang sebenarnya."
              tags={['Perbandingan', 'Hidden Cost', 'Multi-Bank']}
              color="emerald"
              visual="calc"
            />
            <ToolShowcase
              icon={Receipt}
              title="Catatan Harian Cerdas"
              desc="Input pengeluaran harian secepat chat. Auto-kategorisasi Kebutuhan vs Keinginan. Lihat pola pengeluaran mingguan & bulanan."
              tags={['Quick Input', 'Auto-Kategori', 'Pola']}
              color="amber"
              visual="receipt"
            />
            <ToolShowcase
              icon={Calendar}
              title="Kalender Sakti"
              desc="Kalender visual 3 bulan ke depan. Lihat semua jatuh tempo cicilan. Auto-marking pembayaran dan tabel cicilan dengan filter lengkap."
              tags={['Visual', '3 Bulan', 'Auto-Mark']}
              color="rose"
              visual="calendar"
            />
          </div>

          {/* Mini tool cards - the rest */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: PieChart, title: 'Smart Allocation', desc: 'Split otomatis gaji ke kebutuhan, keinginan, cicilan, dan tabungan', color: 'text-indigo-600 bg-indigo-50' },
              { icon: Target, title: 'Sinking Fund', desc: 'Dana cadangan visual untuk DP rumah, liburan, atau dana darurat', color: 'text-teal-600 bg-teal-50' },
              { icon: LineChart, title: 'Financial Freedom', desc: 'Hitung kapan Anda bisa pensiun dan berapa yang dibutuhkan', color: 'text-emerald-600 bg-emerald-50' },
              { icon: Users, title: 'Family Mode', desc: 'Kelola keuangan bersama pasangan dengan dashboard gabungan', color: 'text-rose-600 bg-rose-50' },
              { icon: CircleDollarSign, title: 'Income Manager', desc: 'Multi-income support: gaji, freelance, bisnis, investasi', color: 'text-blue-600 bg-blue-50' },
              { icon: FileText, title: 'Activity Log', desc: 'Riwayat lengkap semua transaksi dan perubahan data', color: 'text-slate-600 bg-slate-100' },
              { icon: Landmark, title: 'Multi Bank Account', desc: 'Hubungkan beberapa rekening untuk tracking saldo terintegrasi', color: 'text-amber-600 bg-amber-50' },
              { icon: BookOpen, title: 'Planning Board', desc: 'Buat rencana keuangan jangka pendek dan panjang dengan milestone', color: 'text-cyan-600 bg-cyan-50' },
            ].map((tool, i) => {
              const toolView = useInView(0.1);
              return (
                <div
                  key={i}
                  ref={toolView.ref}
                  className={`flex gap-4 items-start p-5 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-500 cursor-default ${toolView.inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${tool.color}`}>
                    <tool.icon size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">{tool.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{tool.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-full transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]">
              Akses Semua Tools Gratis
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ 5D. SECURITY & TRUST ═══ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Keamanan Data</span>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-6">
                Data Anda, <span className="text-brand-600">Kendali Anda</span>
              </h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                Kami membangun {appName} dengan prinsip privacy-first. Data keuangan Anda tidak pernah dijual, dibagikan, atau digunakan untuk keperluan pihak ketiga.
              </p>

              <div className="space-y-5">
                {[
                  { icon: Lock, title: 'Offline-First Architecture', desc: 'Data disimpan lokal di perangkat Anda terlebih dahulu. Aplikasi berfungsi penuh tanpa internet.' },
                  { icon: Shield, title: 'Enkripsi End-to-End', desc: 'Sync ke cloud menggunakan enkripsi standar industri. Hanya Anda yang bisa membaca data Anda.' },
                  { icon: Eye, title: 'Tanpa Akses Perbankan', desc: 'Kami tidak pernah meminta akses ke rekening bank Anda. Input data secara manual, kontrol penuh di tangan Anda.' },
                  { icon: RefreshCw, title: 'Export & Delete Kapanpun', desc: 'Anda bisa mengexport atau menghapus semua data Anda kapan saja. Tidak ada lock-in.' },
                ].map((item, i) => {
                  const secView = useInView(0.1);
                  return (
                    <div
                      key={i}
                      ref={secView.ref}
                      className={`flex gap-4 transition-all duration-500 ${secView.inView ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}
                      style={{ transitionDelay: `${i * 100}ms` }}
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <item.icon size={22} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Visual Trust Badges */}
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/5 rounded-[2rem] rotate-2 blur-xl" />
              <div className="relative bg-white border border-slate-100 rounded-[2rem] p-8 md:p-10 shadow-xl">
                <div className="grid grid-cols-2 gap-5">
                  {[
                    { icon: WifiOff, label: 'Offline First', value: '100%', desc: 'Bekerja tanpa internet' },
                    { icon: Lock, label: 'Data Encrypted', value: 'AES-256', desc: 'Standar industri' },
                    { icon: Smartphone, label: 'Device Storage', value: 'Local', desc: 'Data di perangkat Anda' },
                    { icon: Shield, label: 'Zero Bank Access', value: '0', desc: 'Tidak ada akses rekening' },
                  ].map((badge, i) => (
                    <div key={i} className="text-center p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all duration-300 group">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:shadow-md transition-all">
                        <badge.icon size={22} className="text-emerald-600" />
                      </div>
                      <p className="text-2xl font-black text-slate-900 mb-0.5">{badge.value}</p>
                      <p className="text-xs font-bold text-slate-600 mb-1">{badge.label}</p>
                      <p className="text-[10px] text-slate-400">{badge.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    <span className="font-bold">Komitmen Kami:</span> {appName} tidak akan pernah menjual, membagikan, atau menggunakan data keuangan Anda untuk keperluan iklan atau pihak ketiga.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 5E. PRICING / FREE FOREVER ═══ */}
      <section className="py-24 bg-slate-50" id="pricing" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Pricing</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              Gratis. Titik.
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Tidak ada paywall, tidak ada trial 14 hari, tidak ada fitur yang disembunyikan. Semua tools di atas bisa Anda akses tanpa bayar sepeser pun.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="relative bg-white p-8 md:p-10 rounded-3xl border-2 border-brand-200 shadow-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-lg">
                Selamanya Gratis
              </div>
              <div className="text-center mb-8 pt-4">
                <p className="text-5xl font-black text-slate-900">Rp 0</p>
                <p className="text-sm text-slate-400 mt-1">per bulan, selamanya</p>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  'Dashboard interaktif & analisis',
                  'AI Debt Strategist',
                  'Simulator biaya tersembunyi',
                  'Kalender cicilan visual',
                  'Smart allocation & budgeting',
                  'Catatan pengeluaran harian',
                  'Financial freedom calculator',
                  'Sinking fund manager',
                  'Family mode (multi-user)',
                  'Cloud sync terenkripsi',
                  'Unlimited hutang & transaksi',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-brand-600 flex-shrink-0" />
                    <span className="text-sm text-slate-600">{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/register" className="w-full flex items-center justify-center gap-2 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-600/30 active:scale-[0.98]">
                Daftar Gratis Sekarang
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* Why Free */}
            <div className="flex flex-col gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Lightbulb size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900">Kenapa Gratis?</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Misi kami adalah membantu sebanyak mungkin orang Indonesia terbebas dari jeratan hutang. Akses ke tools keuangan berkualitas seharusnya bukan privilege golongan tertentu.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Shield size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900">Tanpa Iklan, Tanpa Data Selling</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Kami tidak memasang iklan dan tidak menjual data Anda. Revenue kami di masa depan akan berasal dari fitur premium opsional yang tidak mengurangi fitur gratis.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Megaphone size={20} />
                  </div>
                  <h4 className="font-bold text-slate-900">Roadmap Terbuka</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Fitur baru dikembangkan berdasarkan masukan pengguna. Anda bisa request fitur dan vote prioritas pengembangan melalui sistem tiket built-in.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 6. HOW IT WORKS ═══ */}
      <section className="py-24 bg-white" id="how-it-works" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Cara Kerja</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              4 Langkah Menuju Bebas Hutang
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Prosesnya simple, hasilnya powerful. Mulai dari nol sampai punya strategi lengkap dalam hitungan menit.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {/* Connector Lines (Desktop) */}
            <div className="hidden lg:block absolute top-10 left-[15%] right-[15%] h-0.5 bg-brand-100" />
            
            {howItWorks.map((step, i) => (
              <StepCard key={i} num={i + 1} {...step} delay={i * 150} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. DEBT TYPE SHOWCASE ═══ */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Semua Jenis Hutang</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              Satu Platform, Semua Hutang Terkelola
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Dari KPR hingga pinjaman online, setiap jenis hutang memiliki strategi dan kalkulasi bunga yang berbeda.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '🏠', type: 'KPR', desc: 'Kredit Pemilikan Rumah', detail: 'Bunga floating, biaya notaris, asuransi jiwa & kebakaran', color: 'border-blue-200 bg-blue-50/50' },
              { icon: '🚗', type: 'KKB', desc: 'Kredit Kendaraan Bermotor', detail: 'Asuransi all-risk, GPS tracker, DP tersembunyi', color: 'border-emerald-200 bg-emerald-50/50' },
              { icon: '💳', type: 'Kartu Kredit', desc: 'Credit Card Debt', detail: 'Bunga revolving, minimum payment trap, annual fee', color: 'border-amber-200 bg-amber-50/50' },
              { icon: '💰', type: 'KTA', desc: 'Kredit Tanpa Agunan', detail: 'Provisi tinggi, bunga flat vs efektif, asuransi kredit', color: 'border-rose-200 bg-rose-50/50' },
            ].map((item, i) => {
              const cardView = useInView();
              return (
                <div
                  key={i}
                  ref={cardView.ref}
                  className={`p-6 rounded-2xl border ${item.color} hover:shadow-xl transition-all duration-500 cursor-default group ${cardView.inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform">{item.icon}</span>
                  <h4 className="font-bold text-slate-900 text-lg mb-1">{item.type}</h4>
                  <p className="text-xs text-slate-400 mb-3">{item.desc}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ 8. TESTIMONIALS ═══ */}
      <section className="py-24 bg-white" id="testimonials" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">Testimoni</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              Cerita Mereka yang Sudah Berubah
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Ribuan orang Indonesia telah mengambil kendali keuangan mereka dengan {appName}.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <TestimonialCard key={i} {...t} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 9. FAQ ═══ */}
      <section className="py-24 bg-slate-50" id="faq" style={{ scrollMarginTop: '100px' }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-brand-600 font-bold text-sm uppercase tracking-wider">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 mb-4">
              Pertanyaan yang Sering Ditanyakan
            </h2>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                q={faq.q}
                a={faq.a}
                open={openFAQ === i}
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 10. CTA SECTION ═══ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-slate-900 rounded-[2.5rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="absolute top-[-80px] left-[-80px] w-80 h-80 bg-brand-500 rounded-full blur-[120px] opacity-25" />
          <div className="absolute bottom-[-80px] right-[-80px] w-80 h-80 bg-indigo-500 rounded-full blur-[120px] opacity-20" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-bold text-white/80 mb-8">
              <Flame size={14} className="text-amber-400" />
              Gratis selamanya untuk fitur dasar
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
              Siap Mengambil{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-indigo-300">
                Kendali Finansial?
              </span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Jangan biarkan bunga berbunga memakan masa depan Anda. Mulai atur strategi pelunasan hari ini. Bergabung dengan 2,847+ pengguna yang sudah selangkah lebih maju.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="px-10 py-5 bg-white text-slate-900 font-black text-sm rounded-full hover:bg-slate-100 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                Buat Akun Gratis
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="px-10 py-5 bg-transparent border-2 border-white/20 text-white font-bold text-sm rounded-full hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                Sudah Punya Akun
              </Link>
            </div>
            
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Lock size={12} /> Enkripsi End-to-End</span>
              <span className="flex items-center gap-1.5"><Shield size={12} /> Data Aman & Privat</span>
              <span className="flex items-center gap-1.5"><RefreshCw size={12} /> Sync Cloud Opsional</span>
              <span className="flex items-center gap-1.5"><Zap size={12} /> Offline-First</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 11. FOOTER ═══ */}
      <footer className="bg-white border-t border-slate-100 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                {appLogo ? (
                  <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain" />
                ) : (
                  <div className="bg-brand-600 text-white p-1.5 rounded-lg">
                    <Wallet className="h-5 w-5" />
                  </div>
                )}
                <span className="font-black text-lg text-slate-900">{appName}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Platform strategi pelunasan hutang berbasis AI pertama di Indonesia. Gratis, aman, dan transparan.
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                {[1,2,3,4,5].map(i => <Star key={i} size={12} className="fill-amber-400 text-amber-400" />)}
                <span className="ml-1 font-bold">4.9 / 5 rating</span>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-bold text-slate-900 text-sm mb-4 uppercase tracking-wider">Produk</h4>
              <div className="flex flex-col gap-2.5">
                <a href="#simulator" className="text-sm text-slate-500 hover:text-brand-600 transition">Debt Simulator</a>
                <a href="#features" className="text-sm text-slate-500 hover:text-brand-600 transition">AI Strategist</a>
                <a href="#features" className="text-sm text-slate-500 hover:text-brand-600 transition">Smart Allocation</a>
                <a href="#features" className="text-sm text-slate-500 hover:text-brand-600 transition">Financial Freedom</a>
              </div>
            </div>

            {/* Perusahaan */}
            <div>
              <h4 className="font-bold text-slate-900 text-sm mb-4 uppercase tracking-wider">Perusahaan</h4>
              <div className="flex flex-col gap-2.5">
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Tentang Kami</a>
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Karir</a>
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Blog</a>
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Kontak</a>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold text-slate-900 text-sm mb-4 uppercase tracking-wider">Legal</h4>
              <div className="flex flex-col gap-2.5">
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Kebijakan Privasi</a>
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Syarat & Ketentuan</a>
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Keamanan Data</a>
                <a href="#" className="text-sm text-slate-500 hover:text-brand-600 transition">Disclaimer</a>
              </div>
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} {appName}. All rights reserved.
            </p>
            <p className="text-xs text-slate-300">
              Dibuat dengan dedikasi di Indonesia 🇮🇩
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
