
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoanType, SimulationInput, SimulationResult } from '../types';
import { runSimulation, formatCurrency } from '../services/financeUtils';
import { getConfig } from '../services/mockDb';
import { Calculator, Info, AlertTriangle, Gauge, ArrowLeft, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Simulator() {
  const [input, setInput] = useState<SimulationInput>({
    assetPrice: 500000000,
    downPaymentPercent: 20,
    interestRate: 8.5,
    tenorYears: 15,
    loanType: LoanType.KPR,
  });

  const [result, setResult] = useState<SimulationResult | null>(null);
  const [eligibilityScore, setEligibilityScore] = useState<{score: number, status: string, color: string} | null>(null);

  const calculateEligibility = (sim: SimulationResult) => {
    // Dynamic Rules from Config
    const rules = getConfig().systemRules;
    const SAFE_LIMIT = rules?.dsrSafeLimit || 30;
    const WARN_LIMIT = rules?.dsrWarningLimit || 40;

    // Mock Logic for "Sophistication" - Debt Service Ratio Analysis
    const mockMonthlyIncome = 15000000;
    const dsr = (sim.monthlyPayment / mockMonthlyIncome) * 100;
    
    let score = 0;
    let status = "";
    let color = "";

    if (dsr < SAFE_LIMIT) {
      score = 85;
      status = "Sangat Disarankan";
      color = "text-green-600";
    } else if (dsr < WARN_LIMIT) {
      score = 65;
      status = "Perlu Pertimbangan";
      color = "text-yellow-600";
    } else {
      score = 40;
      status = "Berisiko Tinggi";
      color = "text-red-600";
    }
    return { score, status, color };
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const simResult = runSimulation(input);
    setResult(simResult);
    setEligibilityScore(calculateEligibility(simResult));
  };

  const handleInputChange = (field: keyof SimulationInput, value: any) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Public Header */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-brand-600 transition">
             <ArrowLeft size={20} />
             <span className="font-semibold">Kembali ke Beranda</span>
          </Link>
          <div className="flex items-center gap-2 text-brand-700">
             <Wallet className="h-6 w-6" />
             <span className="font-bold text-lg tracking-tight">Paydone.id</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-start gap-4 mb-8">
          <div className="p-3 bg-brand-600 text-white rounded-xl shadow-lg shadow-brand-200">
            <Calculator size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Simulator "Realita"</h1>
            <p className="text-slate-500 mt-1">Cek estimasi biaya tersembunyi (Provisi, Admin, Notaris) sebelum Anda mengajukan hutang.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form Section */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xl p-6 h-fit sticky top-6">
            <form onSubmit={handleCalculate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Pinjaman</label>
                <select 
                  className="w-full rounded-lg border-slate-300 border bg-slate-50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition"
                  value={input.loanType}
                  onChange={(e) => handleInputChange('loanType', e.target.value as LoanType)}
                >
                  <option value={LoanType.KPR}>KPR (Rumah)</option>
                  <option value={LoanType.KKB}>KKB (Kendaraan)</option>
                  <option value={LoanType.KTA}>KTA (Cash)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Harga Aset (Rp)</label>
                <input 
                  type="number" 
                  className="w-full rounded-lg border-slate-300 border bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  value={input.assetPrice}
                  onChange={(e) => handleInputChange('assetPrice', Number(e.target.value))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">DP (%)</label>
                  <input 
                    type="number" 
                    className="w-full rounded-lg border-slate-300 border bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    value={input.downPaymentPercent}
                    onChange={(e) => handleInputChange('downPaymentPercent', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bunga (p.a %)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full rounded-lg border-slate-300 border bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    value={input.interestRate}
                    onChange={(e) => handleInputChange('interestRate', Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tenor (Tahun)</label>
                <input 
                  type="range" 
                  min="1" 
                  max="25" 
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                  value={input.tenorYears}
                  onChange={(e) => handleInputChange('tenorYears', Number(e.target.value))}
                />
                <div className="text-right text-xs text-brand-600 font-bold mt-2">{input.tenorYears} Tahun</div>
              </div>

              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition shadow-lg shadow-brand-200">
                Hitung Sekarang
              </button>
            </form>
          </div>

          {/* Result Section */}
          <div className="lg:col-span-8 space-y-6">
            {!result ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400 p-8 text-center">
                <Calculator size={48} className="mb-4 opacity-50 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-600">Belum ada simulasi</h3>
                <p>Masukkan data harga aset dan DP di formulir sebelah kiri untuk melihat estimasi biaya.</p>
              </div>
            ) : (
              <>
                {/* AI Score Card */}
                {eligibilityScore && (
                  <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                     
                     <div className="relative z-10">
                       <div className="flex items-center gap-2 mb-2 text-slate-300">
                         <Gauge size={20} />
                         <span className="text-sm font-medium uppercase tracking-wider">AI Approval Prediction</span>
                       </div>
                       <h3 className={`text-2xl font-bold ${eligibilityScore.score > 70 ? 'text-green-400' : (eligibilityScore.score > 50 ? 'text-yellow-400' : 'text-red-400')}`}>
                         {eligibilityScore.status}
                       </h3>
                       <p className="text-slate-400 text-sm mt-1 max-w-sm">
                         {eligibilityScore.score > 70 
                           ? "Rasio cicilan aman. Kemungkinan besar disetujui bank."
                           : "Rasio cicilan mendekati batas wajar (30% Gaji). Pertimbangkan DP lebih besar."}
                       </p>
                     </div>
                     
                     <div className="relative z-10 flex flex-col items-center">
                        <div className={`text-4xl font-bold ${eligibilityScore.score > 70 ? 'text-green-400' : (eligibilityScore.score > 50 ? 'text-yellow-400' : 'text-red-400')}`}>
                          {eligibilityScore.score}/100
                        </div>
                     </div>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-brand-600 text-white p-6 rounded-xl shadow-lg shadow-brand-200">
                    <p className="text-brand-100 text-sm font-medium mb-1">Cicilan per Bulan</p>
                    <h3 className="text-3xl font-bold">{formatCurrency(result.monthlyPayment)}</h3>
                    <p className="text-xs text-brand-200 mt-2 flex items-center gap-1">
                      <Info size={12} />
                      Fixed selama periode bunga
                    </p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium mb-1">Total Uang Muka "Bersih"</p>
                    <h3 className="text-3xl font-bold text-slate-900">{formatCurrency(result.upfrontCosts.totalUpfront)}</h3>
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 bg-amber-50 w-fit px-2 py-1 rounded">
                      <AlertTriangle size={12} />
                      Jauh lebih besar dari sekadar DP!
                    </p>
                  </div>
                </div>

                {/* Breakdown Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Rincian Biaya Awal (Estimasi)</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-600">Down Payment (DP)</span>
                      <span className="font-medium text-slate-900">{formatCurrency(result.upfrontCosts.downPayment)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-600">Biaya Provisi ({(getConfig().systemRules?.provisionRate || 1)}%)</span>
                      <span className="font-medium text-slate-900">{formatCurrency(result.upfrontCosts.provision)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-600">Biaya Admin</span>
                      <span className="font-medium text-slate-900">{formatCurrency(result.upfrontCosts.adminFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-600">Asuransi Jiwa & Kebakaran (Est.)</span>
                      <span className="font-medium text-slate-900">{formatCurrency(result.upfrontCosts.insurance)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1">
                      <span className="text-slate-600">Biaya Notaris & Akta</span>
                      <span className="font-medium text-slate-900">{formatCurrency(result.upfrontCosts.notary)}</span>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Jadwal Amortisasi (5 Tahun Pertama)</h3>
                  <div className="h-64">
                     <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={result.schedule.slice(0, 60)}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" hide />
                        <YAxis tickFormatter={(val) => `${val/1000000}jt`} style={{fontSize: 12}} />
                        <Tooltip formatter={(val: number) => formatCurrency(val)} />
                        <Area type="monotone" dataKey="balance" stroke="#3b82f6" fillOpacity={1} fill="url(#colorBalance)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
