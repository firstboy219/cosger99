
import React, { useState, useEffect } from 'react';
import { getConfig } from '../../services/mockDb';
import { SystemRules } from '../../types';
import { Workflow, ArrowRight, ShieldCheck, AlertTriangle, TrendingUp, DollarSign, Activity } from 'lucide-react';

export default function BAAnalyst() {
  const [rules, setRules] = useState<SystemRules | undefined>(undefined);

  useEffect(() => {
    const config = getConfig();
    setRules(config.systemRules);
  }, []);

  if (!rules) return <div className="p-8 text-center">Loading Rules...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Workflow className="text-brand-600" /> Business Logic Analyst
          </h2>
          <p className="text-slate-500 text-sm">Visualisasi aturan bisnis dan threshold sistem.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: THRESHOLDS */}
          <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-blue-600"/> Risk Guardrails</h3>
                  <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-green-700 uppercase">Safe DSR Limit</span>
                              <span className="text-xl font-black text-green-900">{rules.dsrSafeLimit}%</span>
                          </div>
                          <p className="text-[10px] text-green-600">Users below this are considered healthy.</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-red-700 uppercase">Critical DSR Limit</span>
                              <span className="text-xl font-black text-red-900">{rules.dsrWarningLimit}%</span>
                          </div>
                          <p className="text-[10px] text-red-600">Triggers admin alert & limits feature access.</p>
                      </div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><DollarSign size={20} className="text-green-600"/> Fee Structure</h3>
                  <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                          <span className="text-slate-500">Provision Rate</span>
                          <span className="font-mono font-bold">{rules.provisionRate}%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                          <span className="text-slate-500">Admin Fee (KPR)</span>
                          <span className="font-mono font-bold">{rules.adminFeeKPR.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                          <span className="text-slate-500">Insurance (KPR)</span>
                          <span className="font-mono font-bold">{rules.insuranceRateKPR}%</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT: LOGIC FLOW */}
          <div className="lg:col-span-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-lg min-h-[600px] flex flex-col items-center">
                  <h3 className="font-black text-slate-900 mb-10 text-lg uppercase tracking-widest flex items-center gap-3">
                      <Activity className="text-brand-600"/> Decision Engine Flow
                  </h3>
                  
                  <div className="flex flex-col items-center w-full space-y-8 relative">
                      
                      {/* INPUT NODE */}
                      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl w-64 text-center z-10">
                          <span className="text-xs font-bold text-slate-400 uppercase">Input</span>
                          <h4 className="font-black text-lg">User Financial Data</h4>
                      </div>
                      <div className="h-8 w-0.5 bg-slate-300"></div>

                      {/* LOGIC LAYER 1 */}
                      <div className="grid grid-cols-2 gap-16 w-full max-w-4xl">
                          <div className="flex flex-col items-center group relative">
                              <div className="w-full p-4 bg-blue-50 border-2 border-blue-200 text-blue-800 rounded-xl text-center font-bold hover:bg-blue-100 transition cursor-help">
                                  Health Check (DSR)
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2">Rule: DSR &lt; {rules.dsrSafeLimit}%</p>
                              <div className="mt-4"><ArrowRight className="rotate-90 text-slate-300" size={24} /></div>
                          </div>
                          <div className="flex flex-col items-center group relative">
                              <div className="w-full p-4 bg-purple-50 border-2 border-purple-200 text-purple-800 rounded-xl text-center font-bold hover:bg-purple-100 transition cursor-help">
                                  Market Comparison
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2">Rule: Gap lebih dari {rules.refinanceGapThreshold}%</p>
                              <div className="mt-4"><ArrowRight className="rotate-90 text-slate-300" size={24} /></div>
                          </div>
                      </div>

                      {/* DECISION LAYER */}
                      <div className="w-full max-w-2xl border-t-2 border-dashed border-slate-200 my-2"></div>

                      <div className="grid grid-cols-3 gap-8 w-full max-w-5xl">
                          {/* Path A */}
                          <div className="flex flex-col items-center p-4 bg-green-50 rounded-xl border border-green-100">
                              <span className="bg-green-200 text-green-800 text-[10px] font-bold px-2 py-1 rounded mb-2">SAFE PROFILE</span>
                              <h4 className="font-bold text-green-900 mb-2">Snowball Strategy</h4>
                              <p className="text-xs text-slate-600 text-center">Focus on psychological wins. Pay smallest debt first.</p>
                          </div>

                          {/* Path B */}
                          <div className="flex flex-col items-center p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                              <span className="bg-yellow-200 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded mb-2">OPPORTUNITY</span>
                              <h4 className="font-bold text-yellow-900 mb-2">Refinancing / Take Over</h4>
                              <p className="text-xs text-slate-600 text-center">Market rate is lower. Suggest switching bank to save interest.</p>
                          </div>

                          {/* Path C */}
                          <div className="flex flex-col items-center p-4 bg-red-50 rounded-xl border border-red-100">
                              <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-1 rounded mb-2">CRITICAL</span>
                              <h4 className="font-bold text-red-900 mb-2">Asset Liquidation</h4>
                              <p className="text-xs text-slate-600 text-center">DSR lebih dari {rules.dsrWarningLimit}%. Emergency protocol initiated. Sell assets.</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
