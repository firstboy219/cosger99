
import React, { useState, useEffect } from 'react';
import { getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync';
import { Copy, Check, Server, Database, FileCode, Terminal, Cloud, Container, Settings, Lock, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, ShieldCheck, Cpu, Activity, Globe, DownloadCloud, UploadCloud, Save, History } from 'lucide-react';
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
  
  // V50.00 Versioning State
  const [versions, setVersions] = useState<any[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  
  const navigate = useNavigate();

  // Load config to display correct DB details
  const config = getConfig();
  const currentBackendUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
  const adminId = localStorage.getItem('paydone_active_user') || 'admin';

  // DB Connection String Construction
  const dbConnectionName = config.gcpSqlInstance || 'gen-lang-client-0662447520:asia-southeast2:paydone201190';
  const dbUser = config.dbUser || 'postgres';
  const dbPass = config.dbPass || 'Abasmallah_12';
  const dbName = config.dbName || 'paydone_db';

  useEffect(() => {
    setServerContent(GOLDEN_SERVER_JS);
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
      try {
          const res = await fetch(`${currentBackendUrl}/api/admin/versions?secret=gen-lang-client-0662447520`, {
              headers: getHeaders(adminId)
          });
          if (res.ok) {
              const data = await res.json();
              setVersions(data.versions || []);
          }
      } catch (e) {
          console.error("Failed to fetch versions", e);
      }
  };

  const saveDraft = async () => {
      if (!draftLabel) return alert("Please enter a label for this draft.");
      setIsSavingDraft(true);
      try {
          const res = await fetch(`${currentBackendUrl}/api/admin/versions/save`, {
              method: 'POST',
              headers: getHeaders(adminId),
              body: JSON.stringify({
                  label: draftLabel,
                  content: serverContent,
                  secret: 'gen-lang-client-0662447520'
              })
          });
          if (res.ok) {
              alert("Draft saved successfully!");
              setDraftLabel('');
              fetchVersions();
          } else {
              alert("Failed to save draft.");
          }
      } catch (e) {
          alert("Error saving draft.");
      } finally {
          setIsSavingDraft(false);
      }
  };

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
              <div className="flex h-full bg-slate-900 overflow-hidden">
                  <div className="flex-1 flex flex-col min-w-0">
                      <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-2">
                              <FileCode size={14}/> 
                              {sourceOrigin === 'local' ? 'Generated from Template' : 'Fetched & Patched from Remote'}
                          </span>
                          <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700">
                                  <input 
                                      value={draftLabel}
                                      onChange={e => setDraftLabel(e.target.value)}
                                      placeholder="Label (e.g. v50-fix)"
                                      className="bg-transparent border-none text-xs text-white px-2 py-1 w-32 focus:outline-none"
                                  />
                                  <button 
                                      onClick={saveDraft} 
                                      disabled={isSavingDraft}
                                      className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition"
                                  >
                                      <Save size={12}/> {isSavingDraft ? '...' : 'SAVE'}
                                  </button>
                              </div>
                              <button onClick={() => handleCopy(serverContent)} className="text-blue-400 hover:text-white transition flex items-center gap-1"><Copy size={12}/> Copy</button>
                          </div>
                      </div>
                      <div className="flex-1 overflow-auto p-6 custom-scrollbar font-mono text-xs leading-relaxed text-blue-100">
                          <pre><code>{serverContent}</code></pre>
                      </div>
                  </div>
                  
                  {/* VERSION SIDEBAR */}
                  <div className="w-72 bg-slate-950 border-l border-slate-800 flex flex-col">
                      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                          <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                              <History size={14} className="text-brand-500"/> Version History
                          </h4>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                          {versions.length === 0 && <div className="text-slate-600 text-xs italic">No versions found.</div>}
                          {versions.map((v, i) => (
                              <div key={i} className={`p-3 rounded-xl border transition-all ${v.isActive ? 'bg-green-900/10 border-green-500/30' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                      <span className="text-xs font-bold text-slate-200 truncate w-40" title={v.filename}>
                                          {v.filename.replace('server.', '').replace('.cjs', '')}
                                      </span>
                                      {v.isActive && <span className="text-[9px] bg-green-500 text-slate-900 px-1.5 py-0.5 rounded font-black">ACTIVE</span>}
                                  </div>
                                  <div className="space-y-1.5">
                                      {v.features?.length > 0 ? v.features.map((f: string, j: number) => (
                                          <div key={j} className="text-[10px] text-slate-500 flex items-start gap-1.5 leading-tight">
                                              <CheckCircle2 size={10} className="text-brand-500 shrink-0 mt-0.5"/> 
                                              <span>{f}</span>
                                          </div>
                                      )) : (
                                          <span className="text-[10px] text-slate-600 italic">No features detected</span>
                                      )}
                                  </div>
                                  {v.deepScan && (
                                      <div className="mt-3 flex items-center gap-2">
                                          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                              <div className="h-full bg-brand-500" style={{width: `${v.deepScan.percentage}%`}}></div>
                                          </div>
                                          <span className="text-[9px] text-slate-500 font-mono">{v.deepScan.percentage}% Match</span>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
