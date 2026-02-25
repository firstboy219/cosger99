
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { FreemiumPackage, PaymentMethod, Subscription } from '../types';
import { useFreemium } from '../services/freemiumStore';
import { getDB, saveDB } from '../services/mockDb';
import { formatCurrency } from '../services/financeUtils';
import { compressImage, formatFileSize } from '../services/imageUtils';
import {
  Zap, Check, X as XIcon, Loader2, ArrowRight, ArrowLeft,
  CreditCard, Tag, Upload, Image as ImageIcon, CheckCircle,
  AlertCircle, Star, Shield, Crown, Sparkles, Clock, Copy,
  ChevronRight, FileText, Receipt
} from 'lucide-react';

// --- TYPES ---
interface CheckoutResponse {
  invoiceId: string;
  amountToPay: number;
  isFree: boolean;
  subscription?: Subscription;
  message?: string;
}

// --- MAIN COMPONENT ---
export default function UpgradePage() {
  const { subscriptionStatus, isFreeTier } = useFreemium();
  const [packages, setPackages] = useState<FreemiumPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Checkout Modal State
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<FreemiumPackage | null>(null);

  // Step 1
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [loadingMethods, setLoadingMethods] = useState(false);

  // Step 2-3
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResponse | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Step 4
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 5 (success)
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // --- LOAD PACKAGES ---
  useEffect(() => {
    const loadPackages = async () => {
      setLoading(true);
      setError(null);
      try {
        // V50.35 TAHAP 3: Backend returns plain Array<FreemiumPackage>, already filtered by is_active
        const data = await api.get('/packages');
        // data is directly an array, no need to access .packages property or filter locally
        const pkgs = Array.isArray(data) ? data : [];
        setPackages(pkgs);
        // Persist to local DB
        const db = getDB();
        db.packages = pkgs;
        saveDB(db);
      } catch {
        // Fallback to local DB
        const db = getDB();
        const localPkgs = db.packages || [];
        if (localPkgs.length > 0) {
          setPackages(localPkgs);
        } else {
          setError('Gagal memuat daftar paket. Periksa koneksi internet Anda.');
        }
      } finally {
        setLoading(false);
      }
    };
    loadPackages();
  }, []);

  // --- OPEN CHECKOUT ---
  const openCheckout = useCallback(async (pkg: FreemiumPackage) => {
    setSelectedPackage(pkg);
    setCheckoutStep(1);
    setCheckoutResult(null);
    setCheckoutError(null);
    setProofBase64(null);
    setProofFileName('');
    setSubmitSuccess(false);
    setSelectedMethod(null);
    setPromoCode('');
    setShowCheckout(true);

    // Load payment methods
    setLoadingMethods(true);
    try {
      const data = await api.get('/payment-methods');
      const methods = (data.paymentMethods || data.payment_methods || data || []).filter((m: any) => m.is_active || m.isActive);
      setPaymentMethods(methods);
      const db = getDB();
      db.paymentMethods = methods;
      saveDB(db);
    } catch {
      const db = getDB();
      setPaymentMethods((db.paymentMethods || []).filter((m: any) => m.is_active || m.isActive));
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  // --- STEP 2: POST CHECKOUT ---
  const handleCheckout = useCallback(async () => {
    if (!selectedPackage || !selectedMethod) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    const userId = localStorage.getItem('paydone_active_user') || '';
    try {
      // V50.35 TAHAP 3: Include promo code in checkout request
      const data = await api.post('/payment/checkout', {
        userId,
        packageId: selectedPackage.id,
        paymentMethodId: selectedMethod,
        promoCode: promoCode.trim() || undefined,
      });
      setCheckoutResult(data);

      // V50.35 TAHAP 3: Check for error messages (e.g., promo already used)
      if (data.error) {
        setCheckoutError(data.error);
        return;
      }

      if (data.isFree) {
        // 100% discount - subscription activated immediately
        setCheckoutStep(5);
        setSubmitSuccess(true);
        // Refresh local subscription data
        refreshSubscriptions();
      } else {
        setCheckoutStep(3);
      }
    } catch (e: any) {
      // V50.35 TAHAP 3: Catch promo-specific errors
      const errorMsg = e.message || 'Gagal memproses checkout.';
      setCheckoutError(errorMsg);
    } finally {
      setCheckoutLoading(false);
    }
  }, [selectedPackage, selectedMethod, promoCode]);

  // --- STEP 4: FILE TO BASE64 WITH COMPRESSION ---
  // V50.35 TAHAP 3: Compress image using Canvas before Base64 conversion
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.');
      return;
    }
    
    setProofFileName(file.name);
    
    try {
      // V50.35 TAHAP 3: Canvas compression with 0.7 quality, max 800px width
      const compressedBase64 = await compressImage(file, {
        maxWidth: 800,
        quality: 0.7,
      });
      setProofBase64(compressedBase64);
    } catch (error) {
      console.error('[v0] Image compression error:', error);
      alert('Gagal memproses gambar. Silakan coba gambar lain.');
    }
  }, []);

  // --- STEP 5: SUBMIT PROOF ---
  const handleSubmitProof = useCallback(async () => {
    if (!checkoutResult?.invoiceId || !proofBase64) return;
    setSubmitting(true);
    try {
      await api.post('/payment/submit', {
        invoiceId: checkoutResult.invoiceId,
        proofOfPayment: proofBase64,
      });
      setSubmitSuccess(true);
      setCheckoutStep(5);
      refreshSubscriptions();
    } catch (e: any) {
      setCheckoutError(e.message || 'Gagal mengirim bukti pembayaran.');
    } finally {
      setSubmitting(false);
    }
  }, [checkoutResult, proofBase64]);

  const refreshSubscriptions = async () => {
    try {
      const userId = localStorage.getItem('paydone_active_user') || '';
      const data = await api.get(`/subscriptions?userId=${userId}`);
      const db = getDB();
      db.subscriptions = data.subscriptions || data || [];
      saveDB(db);
      window.dispatchEvent(new Event('PAYDONE_DB_UPDATE'));
    } catch { /* silent */ }
  };

  // Highlight last 3 digits of payment amount
  const formatAmountHighlight = (amount: number) => {
    const str = amount.toString();
    if (str.length <= 3) return { main: '', tail: str };
    return { main: str.slice(0, -3), tail: str.slice(-3) };
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setSelectedPackage(null);
  };

  // Feature label mapping for display
  const featureLabels: Record<string, string> = {
    ai_chat: 'AI Financial Strategist',
    sinking_fund: 'Dana Cadangan (Sinking Fund)',
    bank_accounts: 'Manajemen Rekening Bank',
    freedom_matrix: 'Freedom Matrix Dashboard',
    crossing_analysis: 'Crossing Analysis Chart',
    family_mode: 'Mode Keluarga',
    export_pdf: 'Export PDF Report',
    priority_support: 'Prioritas Support',
    advanced_simulator: 'Advanced Loan Simulator',
    unlimited_debts: 'Unlimited Debt Tracking',
  };

  // Sort packages: free first, then by price
  const sortedPackages = [...packages].sort((a, b) => {
    if (a.is_default_free && !b.is_default_free) return -1;
    if (!a.is_default_free && b.is_default_free) return 1;
    return a.price - b.price;
  });

  // All feature keys across all packages
  const allFeatureKeys = Array.from(
    new Set(packages.flatMap(p => Object.keys(p.features || {})))
  );

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-fade-in">
      {/* HEADER */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-brand-100">
          <Sparkles size={14} /> Pilih Paket Terbaik
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight text-balance">
          Upgrade Pengalaman Finansial Anda
        </h1>
        <p className="text-slate-500 mt-3 text-sm font-medium max-w-lg mx-auto leading-relaxed">
          Akses fitur premium untuk mengoptimalkan keuangan Anda. Mulai dari AI konsultan pribadi hingga advanced analytics.
        </p>
        {!isFreeTier && subscriptionStatus.currentPackage && (
          <div className="inline-flex items-center gap-2 mt-4 bg-green-50 text-green-700 px-4 py-2 rounded-xl text-xs font-bold border border-green-200">
            <CheckCircle size={14} />
            Paket Aktif: {subscriptionStatus.currentPackage}
            {subscriptionStatus.expiryDate && (
              <span className="text-green-500 ml-1">
                (berlaku s/d {new Date(subscriptionStatus.expiryDate).toLocaleDateString('id-ID')})
              </span>
            )}
          </div>
        )}
      </div>

      {/* LOADING / ERROR */}
      {loading && (
        <div className="text-center py-20">
          <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Memuat paket...</p>
        </div>
      )}

      {error && (
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle size={24} className="text-red-500 mx-auto mb-3" />
          <p className="text-red-700 text-sm font-bold">{error}</p>
        </div>
      )}

      {/* PRICING CARDS */}
      {!loading && !error && sortedPackages.length > 0 && (
        <div className={`grid gap-6 ${sortedPackages.length === 1 ? 'max-w-md mx-auto' : sortedPackages.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-3'}`}>
          {sortedPackages.map((pkg, idx) => {
            const isPremium = !pkg.is_default_free && idx === sortedPackages.length - 1;
            const isMiddle = !pkg.is_default_free && !isPremium && sortedPackages.length >= 3;
            const isCurrentPlan = subscriptionStatus.currentPackage?.toLowerCase() === pkg.name.toLowerCase();

            return (
              <div
                key={pkg.id}
                className={`relative rounded-[2rem] border-2 p-8 flex flex-col transition-all duration-300 hover:shadow-xl ${
                  isPremium
                    ? 'bg-gradient-to-b from-slate-900 to-slate-800 border-brand-500 text-white shadow-2xl shadow-brand-900/20 scale-[1.03]'
                    : isMiddle
                    ? 'bg-white border-brand-200 shadow-lg'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                {/* Popular badge */}
                {isPremium && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg">
                    Paling Populer
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 right-6 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                    <CheckCircle size={12} /> Aktif
                  </div>
                )}

                {/* Icon */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${
                  isPremium ? 'bg-brand-500/20' : pkg.is_default_free ? 'bg-slate-100' : 'bg-brand-50'
                }`}>
                  {isPremium ? <Crown size={24} className="text-brand-400" /> :
                   pkg.is_default_free ? <Shield size={24} className="text-slate-400" /> :
                   <Star size={24} className="text-brand-600" />}
                </div>

                {/* Name + desc */}
                <h3 className={`text-2xl font-black tracking-tight ${isPremium ? 'text-white' : 'text-slate-900'}`}>
                  {pkg.name}
                </h3>
                {pkg.description && (
                  <p className={`text-xs mt-1 ${isPremium ? 'text-slate-400' : 'text-slate-500'}`}>
                    {pkg.description}
                  </p>
                )}

                {/* Price */}
                <div className="mt-5 mb-6">
                  {/* V50.35 TAHAP 3: Convert price from String to Number */}
                  {Number(pkg.price) === 0 ? (
                    <div className={`text-3xl font-black ${isPremium ? 'text-white' : 'text-slate-900'}`}>Gratis</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-black ${isPremium ? 'text-white' : 'text-slate-900'}`}>
                        {formatCurrency(Number(pkg.price))}
                      </span>
                      <span className={`text-sm font-medium ${isPremium ? 'text-slate-400' : 'text-slate-500'}`}>/bulan</span>
                    </div>
                  )}
                </div>

                {/* AI Limit */}
                <div className={`text-xs font-bold mb-4 flex items-center gap-2 px-3 py-2 rounded-xl ${
                  isPremium ? 'bg-white/10 text-brand-300' : 'bg-slate-50 text-slate-600 border border-slate-100'
                }`}>
                  <Zap size={14} />
                  {pkg.ai_limit === -1 || pkg.ai_limit >= 99999
                    ? 'AI Chat Unlimited'
                    : `AI Chat: ${pkg.ai_limit} pesan/bulan`}
                </div>

                {/* Feature list */}
                <div className="flex-1 space-y-2.5 mb-8">
                  {allFeatureKeys.map(key => {
                    const enabled = pkg.features?.[key] === true;
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        {enabled ? (
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isPremium ? 'bg-green-500/20' : 'bg-green-50'
                          }`}>
                            <Check size={12} className="text-green-500" />
                          </div>
                        ) : (
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isPremium ? 'bg-white/5' : 'bg-slate-50'
                          }`}>
                            <XIcon size={12} className={isPremium ? 'text-slate-600' : 'text-slate-300'} />
                          </div>
                        )}
                        <span className={`text-xs font-medium ${
                          enabled
                            ? (isPremium ? 'text-slate-200' : 'text-slate-700')
                            : (isPremium ? 'text-slate-600 line-through' : 'text-slate-400 line-through')
                        }`}>
                          {featureLabels[key] || key}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* CTA */}
                {isCurrentPlan ? (
                  <button
                    disabled
                    className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide cursor-default ${
                      isPremium ? 'bg-white/10 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    Paket Saat Ini
                  </button>
                ) : pkg.is_default_free ? (
                  <div className={`w-full py-4 rounded-2xl font-bold text-sm text-center ${
                    isPremium ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Paket Default
                  </div>
                ) : (
                  <button
                    onClick={() => openCheckout(pkg)}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg ${
                      isPremium
                        ? 'bg-gradient-to-r from-brand-500 to-indigo-500 text-white hover:from-brand-600 hover:to-indigo-600 shadow-brand-900/30'
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                    }`}
                  >
                    Pilih Paket <ArrowRight size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BILLING LINK */}
      <div className="text-center mt-10">
        <Link
          to="/app/billing"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-600 transition group"
        >
          <Receipt size={16} />
          Lihat Riwayat Langganan
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* CHECKOUT MODAL */}
      {/* ═══════════════════════════════════════════ */}
      {showCheckout && selectedPackage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 text-white relative flex-shrink-0">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Checkout</p>
                    <h3 className="text-xl font-black tracking-tight">{selectedPackage.name}</h3>
                    <p className="text-slate-400 text-xs mt-1">
                      {selectedPackage.price === 0 ? 'Gratis' : formatCurrency(selectedPackage.price) + '/bulan'}
                    </p>
                  </div>
                  <button
                    onClick={closeCheckout}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-slate-400 hover:text-white"
                  >
                    <XIcon size={20} />
                  </button>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 mt-5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                        s < checkoutStep ? 'bg-green-500 text-white' :
                        s === checkoutStep ? 'bg-brand-500 text-white ring-2 ring-brand-400/50 ring-offset-2 ring-offset-slate-900' :
                        'bg-white/10 text-slate-500'
                      }`}>
                        {s < checkoutStep ? <Check size={12} /> : s}
                      </div>
                      {s < 5 && <div className={`w-6 h-0.5 ${s < checkoutStep ? 'bg-green-500' : 'bg-white/10'}`} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto flex-1">
              {/* STEP 1: Payment Method Selection */}
              {checkoutStep === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm mb-1">Pilih Metode Pembayaran</h4>
                    <p className="text-xs text-slate-500">Transfer ke salah satu rekening berikut.</p>
                  </div>

                  {loadingMethods ? (
                    <div className="text-center py-8">
                      <Loader2 className="animate-spin text-brand-600 mx-auto" size={24} />
                    </div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                      <CreditCard size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs text-slate-400 font-medium">Belum ada metode pembayaran tersedia.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {paymentMethods.map(m => {
                        // Normalize camelCase/snake_case from backend
                        const bankName = (m as any).bankName || m.bank_name || '';
                        const accountNumber = (m as any).accountNumber || m.account_number || '';
                        const accountName = (m as any).accountName || m.account_name || '';
                        const logoUrl = (m as any).logoUrl || m.logo_url || '';
                        return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedMethod(m.id)}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                            selectedMethod === m.id
                              ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-100'
                              : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            selectedMethod === m.id ? 'bg-brand-100' : 'bg-slate-100'
                          }`}>
                            {logoUrl ? (
                              <img src={logoUrl} alt={bankName} className="w-8 h-8 object-contain" />
                            ) : (
                              <CreditCard size={20} className={selectedMethod === m.id ? 'text-brand-600' : 'text-slate-400'} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900">{bankName}</p>
                            <p className="text-xs text-slate-500 font-mono">{accountNumber}</p>
                            <p className="text-[10px] text-slate-400">{accountName}</p>
                          </div>
                          {selectedMethod === m.id && (
                            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                              <Check size={14} className="text-white" />
                            </div>
                          )}
                        </button>
                        );
                      })}
                    </div>
                  )}

                  {/* V50.35 TAHAP 3: Promo Code with Error Display */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-2">Kode Promo (Opsional)</label>
                    <div className="relative">
                      <Tag size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="Masukkan kode promo"
                        className={`w-full pl-10 pr-4 py-3 bg-slate-50 border-2 rounded-xl text-sm font-bold focus:bg-white outline-none transition ${
                          checkoutError && promoCode 
                            ? 'border-red-300 focus:border-red-500' 
                            : 'border-slate-100 focus:border-brand-500'
                        }`}
                      />
                    </div>
                    {checkoutError && promoCode && (
                      <div className="flex items-start gap-2 mt-2 p-2.5 bg-red-50 rounded-lg border border-red-200">
                        <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-red-700 font-medium">{checkoutError}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => { setCheckoutStep(2); handleCheckout(); }}
                    disabled={!selectedMethod || checkoutLoading}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-xl"
                  >
                    {checkoutLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    Lanjutkan
                  </button>
                </div>
              )}

              {/* STEP 2: Processing */}
              {checkoutStep === 2 && (
                <div className="text-center py-12 animate-fade-in">
                  <Loader2 size={40} className="animate-spin text-brand-600 mx-auto mb-4" />
                  <p className="text-slate-700 font-bold">Memproses checkout...</p>
                  <p className="text-xs text-slate-400 mt-2">Menghubungi server pembayaran.</p>
                  {checkoutError && (
                    <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
                      <AlertCircle size={18} className="text-red-500 mx-auto mb-2" />
                      <p className="text-red-700 text-sm font-bold">{checkoutError}</p>
                      <button onClick={() => { setCheckoutStep(1); setCheckoutError(null); }} className="mt-3 text-xs text-brand-600 font-bold hover:underline">
                        Kembali
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Payment Instructions */}
              {checkoutStep === 3 && checkoutResult && (
                <div className="space-y-6 animate-fade-in">
                  {/* V50.35 TAHAP 3: Zero-Rupiah Flow Check */}
                  {checkoutResult.isFree || checkoutResult.amountToPay === 0 ? (
                    // Zero-Rupiah: Promo diterapkan, paket otomatis aktif
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <CheckCircle size={28} className="text-green-500" />
                        </div>
                        <h4 className="font-black text-slate-900 text-lg">Promo Diterapkan!</h4>
                        <p className="text-xs text-slate-500 mt-1">Paket akan otomatis aktif.</p>
                      </div>

                      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
                        <p className="text-sm font-bold text-green-700 flex items-center justify-center gap-2">
                          <CheckCircle size={16} />
                          Promo diterapkan, paket akan otomatis aktif.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setCheckoutStep(5);
                          setSubmitSuccess(true);
                          refreshSubscriptions();
                        }}
                        className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-xl"
                      >
                        <CheckCircle size={16} /> Selesai
                      </button>
                    </div>
                  ) : (
                    // Normal payment flow
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Clock size={28} className="text-amber-600" />
                        </div>
                        <h4 className="font-black text-slate-900 text-lg">Transfer Pembayaran</h4>
                        <p className="text-xs text-slate-500 mt-1">Silakan transfer sesuai nominal di bawah ini.</p>
                      </div>

                      {/* Amount Display */}
                      <div className="bg-slate-50 rounded-2xl border-2 border-slate-100 p-6 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Transfer</p>
                        <div className="text-4xl font-black text-slate-900">
                          Rp {formatAmountHighlight(checkoutResult.amountToPay).main}
                          <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-lg ml-0.5 border border-brand-200">
                            {formatAmountHighlight(checkoutResult.amountToPay).tail}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-600 font-bold mt-3 flex items-center justify-center gap-1">
                          <AlertCircle size={12} />
                          3 digit terakhir adalah kode unik. Transfer HARUS tepat sesuai nominal.
                        </p>
                      </div>

                      {/* Invoice ID */}
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-100 p-3">
                        <FileText size={16} className="text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Invoice ID</p>
                          <p className="text-xs font-mono font-bold text-slate-700 truncate">{checkoutResult.invoiceId}</p>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(checkoutResult.invoiceId)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-slate-600"
                        >
                          <Copy size={14} />
                        </button>
                      </div>

                      {/* Accumulation notice */}
                      {!isFreeTier && (
                        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <Sparkles size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-blue-700 font-medium leading-relaxed">
                            Sisa masa aktif Anda saat ini akan diakumulasikan ke paket baru.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => setCheckoutStep(4)}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-xl"
                      >
                        <Upload size={16} /> Sudah Transfer, Upload Bukti
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Upload Proof */}
              {checkoutStep === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Upload size={28} className="text-blue-600" />
                    </div>
                    <h4 className="font-black text-slate-900 text-lg">Upload Bukti Transfer</h4>
                    <p className="text-xs text-slate-500 mt-1">Foto atau screenshot bukti transfer Anda.</p>
                  </div>

                  {/* Upload Area */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      proofBase64
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50'
                    }`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {proofBase64 ? (
                      <div>
                        <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
                        <p className="text-green-700 font-bold text-sm">{proofFileName}</p>
                        <img src={proofBase64} alt="Preview" className="mt-4 max-h-48 mx-auto rounded-xl border border-green-200 shadow-sm" />
                        <p className="text-[10px] text-green-500 mt-3">Klik untuk mengganti gambar</p>
                      </div>
                    ) : (
                      <div>
                        <ImageIcon size={36} className="text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-bold text-sm">Klik untuk memilih gambar</p>
                        <p className="text-[10px] text-slate-400 mt-1">JPG, PNG, max 5MB</p>
                      </div>
                    )}
                  </div>

                  {checkoutError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                      <p className="text-red-700 text-xs font-bold">{checkoutError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setCheckoutStep(3)}
                      className="px-6 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-50 transition flex items-center gap-2"
                    >
                      <ArrowLeft size={14} /> Kembali
                    </button>
                    <button
                      onClick={handleSubmitProof}
                      disabled={!proofBase64 || submitting}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-xl"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                      Kirim Bukti
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: Success */}
              {checkoutStep === 5 && (
                <div className="text-center py-8 animate-fade-in">
                  <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-100">
                    <CheckCircle size={40} className="text-green-500" />
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 mb-2">
                    {checkoutResult?.isFree ? 'Paket Aktif!' : 'Bukti Terkirim!'}
                  </h4>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                    {checkoutResult?.isFree
                      ? `Paket ${selectedPackage?.name} telah aktif secara otomatis. Nikmati fitur premium Anda!`
                      : 'Bukti transfer Anda sedang diverifikasi oleh admin. Anda akan menerima notifikasi setelah dikonfirmasi.'
                    }
                  </p>
                  <div className="mt-8 flex flex-col gap-3 max-w-xs mx-auto">
                    <button
                      onClick={closeCheckout}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all transform active:scale-95 shadow-xl"
                    >
                      Kembali ke Upgrade
                    </button>
                    <Link
                      to="/app/billing"
                      className="text-xs text-brand-600 font-bold hover:underline flex items-center justify-center gap-1"
                    >
                      Lihat Riwayat Langganan <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
