
import React, { useState, useEffect } from 'react';
import { getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync';
import { Copy, Check, Server, Database, FileCode, Terminal, Cloud, Container, Settings, Lock, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck, Cpu, Activity, Globe, DownloadCloud, UploadCloud } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GOLDEN_SERVER_JS } from '../../services/serverTemplate';

export default function DeveloperTools() {
  const [activeTab, setActiveTab] = useState<'aws' | 'server_code'>('aws');
  const [copied, setCopied] = useState(false);
  
  // --- SMART SOURCE LOGIC ---
  const [serverContent, setServerContent] = useState(GOLDEN_SERVER_JS);
  const [sourceOrigin, setSourceOrigin] = useState<'local' | 'remote' | 'patched'>('local');
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [patchNote, setPatchNote] = useState<string | null>(null);
  
  const navigate = useNavigate();

  // Load config to display correct DB details
  const config = getConfig();
  const currentBackendUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
  
  // DB Connection String Construction
  const dbConnectionName = config.gcpSqlInstance || 'gen-lang-client-0662447520:asia-southeast2:paydone201190';
  const dbUser = config.dbUser || 'postgres';
  const dbPass = config.dbPass || 'Abasmallah_12';
  const dbName = config.dbName || 'paydone_db';

  useEffect(() => {
    setServerContent(GOLDEN_SERVER_JS);
  }, []);

  const smartPatch = (rawSource: string): string => {
      let patched = rawSource;
      const missingTables = [];
      
      // 1. CHECK FOR NEW TABLES (Frontend Requirements)
      if (!patched.includes('CREATE TABLE IF NOT EXISTS tickets')) {
          missingTables.push('tickets');
      }
      if (!patched.includes('CREATE TABLE IF NOT EXISTS ai_agents')) {
          missingTables.push('ai_agents');
      }
      if (!patched.includes('CREATE TABLE IF NOT EXISTS qa_scenarios')) {
          missingTables.push('qa_scenarios');
      }
      if (!patched.includes('CREATE TABLE IF NOT EXISTS ba_configurations')) {
          missingTables.push('ba_configurations');
      }

      if (missingTables.length > 0) {
          // Inject missing tables into initDB
          const injection = `
    // [AUTO-PATCH] Frontend V45 Requirements
    ${missingTables.map(t => {
        // Simple heuristic map to known schemas (simplified)
        if(t==='tickets') return `await client.query(\`CREATE TABLE IF NOT EXISTS tickets (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), title TEXT, description TEXT, priority VARCHAR(20), status VARCHAR(20), source VARCHAR(50), assigned_to VARCHAR(255), created_at TIMESTAMP, resolved_at TIMESTAMP, resolution_note TEXT, fix_logs JSONB, backup_data TEXT, is_rolled_back BOOLEAN, updated_at TIMESTAMP);\`);`;
        if(t==='ai_agents') return `await client.query(\`CREATE TABLE IF NOT EXISTS ai_agents (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), description TEXT, system_instruction TEXT, model VARCHAR(100), temperature NUMERIC, updated_at TIMESTAMP);\`);`;
        if(t==='qa_scenarios') return `await client.query(\`CREATE TABLE IF NOT EXISTS qa_scenarios (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), type VARCHAR(20), target TEXT, method VARCHAR(10), payload TEXT, description TEXT, expected_status INT, is_negative_case BOOLEAN, created_at TIMESTAMP, last_run TIMESTAMP, last_status VARCHAR(20), updated_at TIMESTAMP);\`);`;
        return `// Missing table: ${t}`;
    }).join('\n    ')}
    console.log("✅ Auto-Patched Missing Schemas: ${missingTables.join(', ')}");
          `;
          
          // Try to find a good insertion point
          if (patched.includes('const initDB = async () => {')) {
              patched = patched.replace('const initDB = async () => {', 'const initDB = async () => {' + injection);
              setPatchNote(`Patched ${missingTables.length} missing tables into live source.`);
          } else {
              setPatchNote("Could not auto-patch (structure mismatch). Using raw remote.");
          }
      } else {
          setPatchNote("Live source is already up-to-date.");
      }
      
      return patched;
  };

  const fetchLiveSource = async () => {
      setIsFetchingSource(true);
      setPatchNote(null);
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';
      
      // USE NEW ENDPOINT
      const url = config.sourceCodeUrl || 'https://api.cosger.online/api/view-source?kunci=gen-lang-client-0662447520';
      
      try {
          console.log(`[DevTools] Fetching live source from: ${url}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); 

          const res = await fetch(url, { 
              signal: controller.signal,
              headers: getHeaders(adminId)
          });
          clearTimeout(timeoutId);

          if (res.ok) {
              const text = await res.text();
              const finalCode = smartPatch(text);
              setServerContent(finalCode);
              setSourceOrigin('patched');
          } else {
              throw new Error(`HTTP Error ${res.status}`);
          }
      } catch (e: any) {
          alert(`Gagal mengambil source code dari server: ${e.message}. \n\nPastikan server aktif. Kembali ke versi lokal.`);
          setServerContent(GOLDEN_SERVER_JS);
          setSourceOrigin('local');
      } finally {
          setIsFetchingSource(false);
      }
  };

  const resetToTemplate = () => {
      setServerContent(GOLDEN_SERVER_JS);
      setSourceOrigin('local');
      setPatchNote(null);
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const awsStatus = {
      instanceId: 'Lightsail-Paydone-Production',
      region: 'Singapore (ap-southeast-1)',
      platform: 'AWS Lightsail (VPS)',
      status: 'Online',
      backendUrl: currentBackendUrl,
      nodeVersion: 'v20.x'
  };

  const vpsDeployCommands = `
# ==========================================
# PAYDONE.ID HYBRID DEPLOYMENT PROTOCOL
# ==========================================

# 1. SSH into Instance
ssh ubuntu@${currentBackendUrl.replace(/^https?:\/\//, '')}

# 2. Setup Environment (If New)
cat > .env << 'EOF'
PORT=8080
DB_USER=${dbUser}
DB_PASS=${dbPass}
DB_NAME=${dbName}
INSTANCE_UNIX_SOCKET=${config.gcpSqlInstance ? `/cloudsql/${config.gcpSqlInstance}` : '127.0.0.1'}
GEMINI_API_KEY=${config.geminiApiKey || 'AIza...'}
EOF

# 3. Deploy Server Code
# Source: ${sourceOrigin === 'local' ? 'Clean Template (Recommended)' : sourceOrigin === 'patched' ? 'Live Source + Auto-Patches' : 'Raw Remote'}
cat > server.js << 'EOF'
${serverContent}
EOF

# 4. Install Dependencies (If needed)
npm install express pg cors dotenv @google/genai

# 5. Restart Service
pm2 restart all || node server.js
pm2 save
`;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Cloud className="text-orange-500" /> Cloud Deployment Center
                </h2>
                <p className="text-slate-500 text-sm mt-1">Deploy logika backend yang sinkron dengan fitur frontend terbaru.</p>
            </div>
            
            {/* SOURCE STATUS INDICATOR */}
            <div className="flex gap-2">
                <button 
                    onClick={resetToTemplate}
                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${sourceOrigin === 'local' ? 'bg-brand-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                    <UploadCloud size={16}/> Use Local Template (Clean)
                </button>
                <button 
                    onClick={fetchLiveSource}
                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${sourceOrigin === 'patched' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                    {isFetchingSource ? <RefreshCw className="animate-spin" size={16}/> : <DownloadCloud size={16}/>}
                    Fetch & Patch Live
                </button>
            </div>
        </div>
      </div>

      <div className="flex border-b bg-white rounded-t-xl px-2">
          <button onClick={() => setActiveTab('aws')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 ${activeTab === 'aws' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500'}`}>
              <Server size={18} /> AWS / VPS Script
          </button>
          <button onClick={() => setActiveTab('server_code')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 ${activeTab === 'server_code' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}>
              <FileCode size={18} /> Code Viewer ({sourceOrigin === 'local' ? 'Template v45.5' : 'Patched Remote'})
          </button>
      </div>

      <div className="flex-1 bg-white rounded-b-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0 relative">
          {activeTab === 'aws' ? (
              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 items-start">
                      <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" size={20}/>
                      <div>
                          <h4 className="font-bold text-blue-900 text-sm">Deployment Ready</h4>
                          <p className="text-xs text-blue-700 mt-1">
                              Script di bawah ini menggunakan <strong>{sourceOrigin === 'local' ? 'Template Terbaru' : 'Live Code (Patched)'}</strong>.
                              {patchNote && <span className="block mt-1 font-bold text-orange-600">Note: {patchNote}</span>}
                          </p>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-6">
                          <div className="h-16 w-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Globe size={32}/>
                          </div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Endpoint</p>
                              <h4 className="text-xl font-bold text-slate-900">{awsStatus.backendUrl}</h4>
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600 mt-1 bg-green-50 px-2 py-0.5 rounded">
                                  <Activity size={12}/> {awsStatus.status}
                              </span>
                          </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-6">
                          <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Database size={32}/>
                          </div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DB Configuration</p>
                              <h4 className="text-sm font-bold text-slate-900 truncate w-48" title={dbConnectionName}>{dbConnectionName}</h4>
                              <p className="text-xs text-slate-500 mt-1">User: {dbUser}</p>
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="flex justify-between items-center">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Terminal size={18} className="text-slate-400"/> Auto-Deploy Script</h3>
                          <button onClick={() => handleCopy(vpsDeployCommands)} className="text-xs font-bold text-white bg-slate-900 px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2 shadow-lg"><Copy size={14}/> Copy Script</button>
                      </div>
                      <div className="bg-slate-900 rounded-2xl p-6 border-4 border-slate-800 shadow-xl overflow-x-auto font-mono text-sm leading-relaxed text-green-400">
                          <pre>{vpsDeployCommands}</pre>
                      </div>
                  </div>
              </div>
          ) : (
              <div className="flex flex-col h-full bg-slate-900">
                  <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-2">
                          <FileCode size={14}/> 
                          {sourceOrigin === 'local' ? 'Generated from Template' : 'Fetched & Patched from Remote'}
                      </span>
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
