
import React, { useState, useEffect } from 'react';
import { 
  Play, CheckCircle2, AlertCircle, RefreshCw, 
  Terminal, Activity, Cpu, Database, Zap, Layers, Server
} from 'lucide-react';
import { getDB } from '../../services/mockDb';
import { QAScenario, QARunHistory } from '../../types';
import { pushPartialUpdate } from '../../services/cloudSync';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function QAAnalyst() {
  const [testCases, setTestCases] = useState<QAScenario[]>([]);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [stressLogs, setStressLogs] = useState<string[]>([]);
  const [stressMetrics, setStressMetrics] = useState({ 
      requests: 0, 
      failures: 0, 
      avgLat: 0,
      stability: 100 
  });

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
      const db = getDB();
      setTestCases(db.qaScenarios || []);
  }, []);

  const handleStressTestClick = () => {
      setConfirmConfig({
          isOpen: true,
          title: "Run High Load Simulation?",
          message: "PERINGATAN: Menjalankan 100 transaksi paralel ke Cloud SQL. Lanjutkan simulasi beban tinggi?",
          onConfirm: () => {
              runV50StressTest();
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const runV50StressTest = async () => {
      setIsStressTesting(true);
      setStressMetrics({ requests: 0, failures: 0, avgLat: 0, stability: 100 });
      setStressLogs(["[INIT] Stability Engine v50.4 Activated", "[MODE] Concurrent Burst - 100 TXN", "[TARGET] Distributed Micro-Sync API"]);
      
      const adminId = 'admin';
      let fails = 0;
      let totalLat = 0;
      const totalOps = 100;

      // PARALLEL EXECUTION PROTOCOL
      const operations = Array.from({length: totalOps}).map(async (_, i) => {
          const startTime = performance.now();
          const mockType = i % 2 === 0 ? 'dailyExpenses' : 'incomes';
          
          const payload = {
              [mockType]: [{
                  id: `stress-${Date.now()}-${i}`,
                  title: `Stress Test Log #${i}`,
                  amount: Math.floor(Math.random() * 50000),
                  date: new Date().toISOString().split('T')[0]
              }]
          };

          const success = await pushPartialUpdate(adminId, payload);
          const duration = performance.now() - startTime;
          
          if (!success) fails++;
          totalLat += duration;
          
          setStressMetrics(m => ({
              requests: m.requests + 1,
              failures: fails,
              avgLat: Math.round(totalLat / (i + 1)),
              stability: Math.round(((i + 1 - fails) / (i + 1)) * 100)
          }));

          if (i % 10 === 0) {
            setStressLogs(prev => [...prev.slice(-12), `>> OP[${i}] -> ${success ? 'RESOLVED' : 'FAILED'} in ${Math.round(duration)}ms`]);
          }
      });

      await Promise.all(operations);
      setStressLogs(prev => [...prev, "[COMPLETE] Stress Test Finished.", `[SUMMARY] Final Stability: ${((totalOps-fails)/totalOps*100).toFixed(1)}%`]);
      setIsStressTesting(false);
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-8 rounded-[2.5rem] border shadow-sm">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                    <Terminal className="text-brand-600" /> QA Auditor Studio
                </h2>
                <p className="text-slate-500 font-medium mt-1">Simulasi beban tinggi dan audit integritas Cloud SQL.</p>
            </div>
            <button 
                onClick={handleStressTestClick} 
                disabled={isStressTesting}
                className="px-8 py-4 bg-red-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-red-700 transition shadow-2xl flex items-center gap-3 disabled:opacity-50"
            >
                {isStressTesting ? <RefreshCw className="animate-spin" size={18}/> : <Zap size={18}/>}
                Execute Stress (100 Ops)
            </button>
        </div>

        {/* Live Metrics Monitoring */}
        {isStressTesting && (
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl border-4 border-red-500/20 grid md:grid-cols-2 gap-10">
                <div className="space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-red-500/20 rounded-2xl border border-red-500/30 animate-pulse">
                            <Cpu size={32} className="text-red-400"/>
                        </div>
                        <div>
                            <h3 className="font-black text-xs uppercase tracking-[0.3em] text-red-400">Pressure Monitor</h3>
                            <p className="text-slate-500 text-[10px] font-mono">Real-time API Throughput</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Successful</p>
                            <p className="text-4xl font-black text-green-400">{stressMetrics.requests - stressMetrics.failures}</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Failed</p>
                            <p className="text-4xl font-black text-red-400">{stressMetrics.failures}</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Avg Latency</p>
                            <p className="text-3xl font-black text-blue-400">{stressMetrics.avgLat}ms</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Stability</p>
                            <p className="text-3xl font-black text-yellow-400">{stressMetrics.stability}%</p>
                        </div>
                    </div>
                </div>

                {/* Console Log Area */}
                <div className="bg-black/50 p-8 rounded-[2rem] border border-white/5 font-mono text-[11px] text-green-400 space-y-2 h-72 overflow-y-auto custom-scrollbar shadow-inner">
                    {stressLogs.map((log, i) => (
                        <div key={i} className="animate-fade-in-up flex gap-3">
                            <span className="text-slate-700">[{i}]</span>
                            <span>{log}</span>
                        </div>
                    ))}
                    {isStressTesting && <div className="animate-pulse bg-green-500 w-2 h-4 mt-2"></div>}
                </div>
            </div>
        )}

        {/* Feature List for QA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="p-4 bg-brand-50 text-brand-600 rounded-2xl w-fit mb-6"><Database size={24}/></div>
                <h4 className="font-black text-slate-900 mb-2">Cloud Integrity Check</h4>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">Memastikan integritas relasi tabel SQL antara Debts, Incomes, dan Installments tetap sinkron.</p>
                <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition">Run Integrity Audit</button>
            </div>
            
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl w-fit mb-6"><Server size={24}/></div>
                <h4 className="font-black text-slate-900 mb-2">Node Latency Analysis</h4>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">Tes kecepatan respon backend dari berbagai lokasi virtual untuk optimasi cache.</p>
                <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition">Probe Speed</button>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl w-fit mb-6"><Layers size={24}/></div>
                <h4 className="font-black text-slate-900 mb-2">Regression Suite</h4>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">Kumpulan 40+ skenario pengujian UI otomatis untuk mendeteksi bug visual.</p>
                <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800 transition">Execute Suite</button>
            </div>
        </div>

        {/* CONFIRMATION DIALOG */}
        <ConfirmDialog
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
          confirmText="Start Stress Test"
          cancelText="Abort"
          variant="danger"
        />
    </div>
  );
}
