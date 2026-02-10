
import React, { useState, useEffect } from 'react';
import { getConfig } from '../../services/mockDb';
import { Copy, Check, Server, Database, FileCode, Terminal, Cloud, Container, Settings, Lock, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck, Cpu, Activity, Globe } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GOLDEN_SERVER_JS } from '../../services/serverTemplate';

export default function DeveloperTools() {
  const [activeTab, setActiveTab] = useState<'aws' | 'server_code'>('aws');
  const [copied, setCopied] = useState(false);
  
  // --- SMART SOURCE LOGIC ---
  const [serverContent, setServerContent] = useState(GOLDEN_SERVER_JS);
  const [sourceOrigin, setSourceOrigin] = useState<'local' | 'remote'>('local');
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [configMissing, setConfigMissing] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchLiveSource();
  }, []);

  const fetchLiveSource = async () => {
      setIsFetchingSource(true);
      setConfigMissing(false);
      try {
          const config = getConfig();
          
          // Use dynamic backend URL or fallback
          const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
          // Fix 404: The correct endpoint in server.js is /api/admin/source-code
          const targetUrl = `${baseUrl}/api/admin/source-code`;

          console.log(`[DevTools] Fetching live source from: ${targetUrl}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); 

          const res = await fetch(targetUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
              const text = await res.text();
              if (text && text.length > 500) { 
                  setServerContent(text);
                  setSourceOrigin('remote');
                  console.log("[DevTools] Sync complete. Using Remote Source.");
              } else {
                  throw new Error("Source code empty or invalid");
              }
          } else {
              throw new Error(`HTTP Error ${res.status}`);
          }
      } catch (e) {
          console.warn("[DevTools] Failed to fetch live source. Using Local Golden Master.", e);
          setServerContent(GOLDEN_SERVER_JS);
          setSourceOrigin('local');
      } finally {
          setIsFetchingSource(false);
      }
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const config = getConfig();
  const currentBackendUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';

  const awsStatus = {
      instanceId: 'Lightsail-Paydone-Production',
      region: 'Singapore (ap-southeast-1)',
      platform: 'AWS Lightsail (VPS)',
      status: 'Online',
      backendUrl: currentBackendUrl,
      nodeVersion: 'v20.x'
  };

  const vpsDeployCommands = `
# AWS LIGHTSAIL DEPLOYMENT FLOW (PM2)
# 1. SSH into Instance
ssh ubuntu@${currentBackendUrl.replace(/^https?:\/\//, '')}

# 2. Update Server Code
cat > ~/server/server.js << 'EOF'
${serverContent}
EOF

# 3. Restart Process
pm2 restart all
pm2 logs
`;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Cloud className="text-orange-500" /> AWS Lightsail Deployment
                </h2>
                <p className="text-slate-500 text-sm mt-1">Status infrastruktur backend dan sinkronisasi server.js.</p>
            </div>
            
            {/* SOURCE STATUS INDICATOR */}
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 shadow-sm ${sourceOrigin === 'remote' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                {isFetchingSource ? (
                    <>
                        <RefreshCw size={16} className="animate-spin text-slate-500"/>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600">Scanning VPS...</span>
                            <span className="text-[10px] text-slate-400">Verifikasi kode...</span>
                        </div>
                    </>
                ) : sourceOrigin === 'remote' ? (
                    <>
                        <div className="bg-green-200 p-1.5 rounded-full"><CheckCircle2 size={16} className="text-green-700"/></div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold">Live Source Loaded</span>
                            <span className="text-[10px] opacity-80">Frontend sinkron dengan VPS.</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-amber-200 p-1.5 rounded-full"><AlertTriangle size={16} className="text-amber-700"/></div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold">Using Local Master</span>
                            <span className="text-[10px] opacity-80">Remote Node unreachable.</span>
                        </div>
                        <button onClick={fetchLiveSource} className="ml-2 p-1 hover:bg-amber-200 rounded" title="Retry Fetch"><RefreshCw size={12}/></button>
                    </>
                )}
            </div>
        </div>
      </div>

      <div className="flex border-b bg-white rounded-t-xl px-2">
          <button onClick={() => setActiveTab('aws')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 ${activeTab === 'aws' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500'}`}>
              <Server size={18} /> AWS Infrastructure
          </button>
          <button onClick={() => setActiveTab('server_code')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 ${activeTab === 'server_code' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}>
              <FileCode size={18} /> Server Code (V45.1)
          </button>
      </div>

      <div className="flex-1 bg-white rounded-b-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0 relative">
          {activeTab === 'aws' ? (
              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-6">
                          <div className="h-16 w-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Globe size={32}/>
                          </div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Public Endpoint</p>
                              <h4 className="text-xl font-bold text-slate-900">{awsStatus.backendUrl}</h4>
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600 mt-1 bg-green-50 px-2 py-0.5 rounded">
                                  <Activity size={12}/> {awsStatus.status}
                              </span>
                          </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-6">
                          <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Cpu size={32}/>
                          </div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Environment Info</p>
                              <h4 className="text-xl font-bold text-slate-900">{awsStatus.nodeVersion}</h4>
                              <p className="text-xs text-slate-500 mt-1">{awsStatus.region}</p>
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="flex justify-between items-center">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Terminal size={18} className="text-slate-400"/> VPS Maintenance Commands</h3>
                          <button onClick={() => handleCopy(vpsDeployCommands)} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"><Copy size={12}/> Copy Commands</button>
                      </div>
                      <div className="bg-slate-900 rounded-2xl p-6 border-4 border-slate-800 shadow-xl overflow-x-auto font-mono text-sm leading-relaxed text-green-400">
                          <pre>{vpsDeployCommands}</pre>
                      </div>
                  </div>
              </div>
          ) : (
              <div className="flex flex-col h-full bg-slate-900">
                  <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      <span>Live Server.js Content (${sourceOrigin.toUpperCase()})</span>
                      <button onClick={() => handleCopy(serverContent)} className="text-blue-400 hover:text-white transition flex items-center gap-1"><Copy size={12}/> Copy Code</button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 custom-scrollbar font-mono text-xs leading-relaxed text-blue-100">
                      <pre><code>{serverContent}</code></pre>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
