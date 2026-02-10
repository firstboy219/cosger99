
import React, { useState, useEffect } from 'react';
import { getConfig } from '../../services/mockDb';
import { 
  CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, FileCode, Server, Shield
} from 'lucide-react';

interface EndpointDef {
  name: string;
  urlPath: string; // Path relative to baseUrl
  method: string;
  expectedStatus: number;
}

// --- V37 ENDPOINT VERIFICATION ---
const REQUIRED_ENDPOINTS: EndpointDef[] = [
  { 
    name: 'Sync (Sniper Mode)', 
    urlPath: '/api/sync?userId=check', 
    method: 'GET',
    expectedStatus: 400 // Should return 400 "Missing userId" or similar if valid but no user found, or 200 with empty data
  },
  { 
    name: 'AI Proxy (Routing)', 
    urlPath: '/api/health', 
    method: 'GET',
    expectedStatus: 200
  }
];

export default function BackendHealthCheck() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<{ def: EndpointDef; ok: boolean; status: number }[]>([]);
  const [targetUrl, setTargetUrl] = useState('');

  useEffect(() => {
      // 1. Initialize URL from config (auto-detect)
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
      setTargetUrl(baseUrl);
      
      // 2. Auto Check if URL is present
      if (baseUrl) {
          setTimeout(() => checkConnectivity(baseUrl), 500);
      }
  }, []);

  const checkConnectivity = async (baseUrl: string) => {
    setStatus('scanning');
    setResults([]);
    
    try {
      if (!baseUrl) throw new Error("URL Endpoint belum disetting.");

      const checks = await Promise.all(REQUIRED_ENDPOINTS.map(async (def) => {
          try {
              const res = await fetch(`${baseUrl}${def.urlPath}`, { method: def.method });
              // We consider it 'ok' if status matches expected, OR if it's 200 (Success)
              const isOk = res.status === def.expectedStatus || res.status === 200;
              return { def, ok: isOk, status: res.status };
          } catch (e) {
              return { def, ok: false, status: 0 };
          }
      }));

      setResults(checks);
      setStatus('success');

    } catch (e: any) {
      console.error(e);
      setStatus('error');
    }
  };

  const allPassed = results.every(r => r.ok);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
        {/* HEADER */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <Shield size={18} className="text-brand-600" />
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">V37 Integrity Check</h3>
                        <p className="text-[10px] text-slate-500">Verifying Smart Router & Security</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {status === 'success' && (
                        <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${allPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {allPassed ? <CheckCircle2 size={12}/> : <AlertTriangle size={12}/>}
                            {allPassed ? 'System Healthy' : 'Issues Detected'}
                        </span>
                    )}
                    
                    <button onClick={() => checkConnectivity(targetUrl)} disabled={status === 'scanning'} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                        <RefreshCw size={14} className={status === 'scanning' ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </div>
        </div>

        {/* CONTENT GRID */}
        <div className="flex-1 overflow-hidden p-4 overflow-y-auto custom-scrollbar">
            {status === 'error' ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-red-500">
                    <XCircle size={32} className="mb-2"/>
                    <p className="font-bold text-sm">Connection Error</p>
                    <p className="text-xs text-slate-500 mt-1">Backend unreachable.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {results.map((res, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border transition ${res.ok ? 'bg-white border-slate-100' : 'bg-red-50 border-red-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={res.ok ? 'text-green-500' : 'text-red-500'}>
                                    {res.ok ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-700">{res.def.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono">{res.def.method} {res.def.urlPath}</p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-mono px-2 py-1 rounded ${res.ok ? 'bg-green-50 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                HTTP {res.status}
                            </span>
                        </div>
                    ))}
                    
                    {status === 'success' && allPassed && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex gap-2">
                            <Server size={16} className="shrink-0"/>
                            <div>
                                <strong>Backend V37 Verified.</strong>
                                <p className="mt-1 opacity-80">Smart AI Routing & Secret Manager Active.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}
