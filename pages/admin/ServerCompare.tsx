
import React, { useState, useEffect, useRef } from 'react';
import { GOLDEN_SERVER_JS } from '../../services/serverTemplate';
import { getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync';
import { runDevDebate } from '../../services/geminiService';
import { 
  ArrowLeftRight, RefreshCw, Copy, Check, Terminal, FileCode, Server, 
  ArrowRight, ArrowLeft, AlertTriangle, Cloud, Monitor, MessageSquare, Bot, User, Send, BrainCircuit, Clipboard, PlayCircle, PauseCircle, RotateCcw, Crown,
  CheckCircle2, X, ShieldCheck, Database, FileSearch, ScanSearch
} from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'FRONTEND_AI' | 'BACKEND_AI' | 'OWNER';
    text: string;
    timestamp: Date;
}

export default function ServerCompare() {
  const [localScript, setLocalScript] = useState(GOLDEN_SERVER_JS.trim());
  const [remoteScript, setRemoteScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'forbidden'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [diffMode, setDiffMode] = useState(true);

  // Deployment Script Modal
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployScript, setDeployScript] = useState('');

  // --- NEW NEGOTIATION CONSOLE STATE ---
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [ownerInput, setOwnerInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const fetchRemote = async () => {
    setIsLoading(true);
    setStatus('idle');
    setErrorMsg('');
    const config = getConfig();
    const adminId = localStorage.getItem('paydone_active_user') || 'admin';
    
    // Prioritize Source Code URL
    let url = config.sourceCodeUrl || 'https://api.cosger.online/api/view-source?kunci=gen-lang-client-0662447520';

    try {
      const fetchOptions: RequestInit = {};
      // Add auth headers if connecting to internal API
      if (url.includes('/api/admin')) {
          fetchOptions.headers = getHeaders(adminId);
      }

      const res = await fetch(url, fetchOptions);
      
      if (res.status === 403) {
          throw new Error("Access Denied (403)");
      }
      if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText || 'Unknown Error'}`);
      }
      const text = await res.text();
      setRemoteScript(text.trim());
      setStatus('success');
    } catch (e: any) {
      console.error(e);
      if (e.message.includes('403')) {
          setStatus('forbidden');
          setRemoteScript('// ACCESS DENIED (403)\n// The server blocked access to source code.\n// Please check the Source Code URL in Settings.');
      } else {
          setStatus('error');
          setErrorMsg(e.message);
          setRemoteScript(''); 
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRemote();
  }, []);

  useEffect(() => {
      if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
  }, [chatHistory, isThinking]);

  const handleCopyRemote = () => {
    navigator.clipboard.writeText(remoteScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    alert("Source from Backend copied! Paste this into services/serverTemplate.ts to sync Frontend.");
  };

  const handlePushToBackend = () => {
      const PROJECT_ID = 'gen-lang-client-0662447520';
      const REGION = 'asia-southeast2';
      const SERVICE_NAME = 'copy-of-finalpaydone-id-debt-consultant';
      const config = getConfig();
      const CONNECTION_NAME = config.gcpSqlInstance || 'gen-lang-client-0662447520:asia-southeast2:paydone201190';
      
      const script = `
# OVERWRITE SERVER.JS ON CLOUD RUN
export PROJECT_ID="${PROJECT_ID}"
export REGION="${REGION}"
export SERVICE_NAME="${SERVICE_NAME}"

gcloud config set project $PROJECT_ID

echo "Writing local version to server.js..."
cat > server.js << 'EOF'
${localScript}
EOF

echo "Deploying update..."
gcloud run deploy $SERVICE_NAME \\
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \\
  --platform managed \\
  --region $REGION \\
  --add-cloudsql-instances=${CONNECTION_NAME} \\
  --project $PROJECT_ID
`;
      setDeployScript(script);
      setShowDeployModal(true);
  };

  const handleCopyDeployScript = () => {
      navigator.clipboard.writeText(deployScript);
      alert("Deployment Script Copied!");
  };

  // --- REBUILT AUDITOR LOGIC ---
  const handleStartAnalysis = async () => {
      setChatHistory([]);
      setIsThinking(true);
      
      // 1. Frontend AI Starts (Deep Analysis)
      const response = await runDevDebate(
          [], // No history yet
          localScript, 
          remoteScript || '// Remote unreachable', 
          'FRONTEND_AI'
      );

      const msg: ChatMessage = {
          id: `ai-fe-${Date.now()}`,
          role: 'FRONTEND_AI',
          text: response,
          timestamp: new Date()
      };
      
      setChatHistory([msg]);
      setIsThinking(false);
  };

  const handleOwnerSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!ownerInput.trim() || isThinking) return;

      // 1. Add Owner Message
      const userMsg: ChatMessage = {
          id: `owner-${Date.now()}`,
          role: 'OWNER',
          text: ownerInput,
          timestamp: new Date()
      };
      const updatedHistory = [...chatHistory, userMsg];
      setChatHistory(updatedHistory);
      setOwnerInput('');
      setIsThinking(true);

      // 2. Trigger Frontend Response (As Architect)
      const response = await runDevDebate(
          updatedHistory.map(m => ({ role: m.role, text: m.text })),
          localScript,
          remoteScript || '// Remote unreachable',
          'FRONTEND_AI'
      );

      const botMsg: ChatMessage = {
          id: `ai-fe-${Date.now()}`,
          role: 'FRONTEND_AI',
          text: response,
          timestamp: new Date()
      };
      setChatHistory(prev => [...prev, botMsg]);
      setIsThinking(false);
  };

  const handleAskBackend = async () => {
      if (isThinking) return;
      setIsThinking(true);

      const response = await runDevDebate(
          chatHistory.map(m => ({ role: m.role, text: m.text })),
          localScript,
          remoteScript || '// Remote unreachable',
          'BACKEND_AI'
      );

      const botMsg: ChatMessage = {
          id: `ai-be-${Date.now()}`,
          role: 'BACKEND_AI',
          text: response,
          timestamp: new Date()
      };
      setChatHistory(prev => [...prev, botMsg]);
      setIsThinking(false);
  };

  // Simple Line Diff Renderer
  const renderDiff = () => {
      const localLines = localScript.split('\n');
      const remoteLines = remoteScript.split('\n');
      const maxLines = Math.max(localLines.length, remoteLines.length);
      
      const rows = [];
      let diffCount = 0;

      for (let i = 0; i < maxLines; i++) {
          const l = localLines[i] || '';
          const r = remoteLines[i] || '';
          const isDiff = l.trim() !== r.trim();
          
          if (isDiff) diffCount++;

          if (diffMode && !isDiff) continue; 

          rows.push(
              <div key={i} className={`grid grid-cols-2 text-xs font-mono border-b border-slate-800 ${isDiff ? 'bg-red-900/20' : ''}`}>
                  <div className={`p-1 overflow-x-auto whitespace-pre ${isDiff ? 'bg-green-900/20 text-green-300' : 'text-slate-400'}`}>
                      {i+1}  {l}
                  </div>
                  <div className={`p-1 overflow-x-auto whitespace-pre border-l border-slate-700 ${isDiff ? 'bg-red-900/20 text-red-300' : 'text-slate-400'}`}>
                      {r}
                  </div>
              </div>
          );
      }
      
      return { rows, diffCount };
  };

  const { rows, diffCount } = renderDiff();

  return (
    <div className="flex flex-col space-y-4 h-[calc(100vh-100px)]">
      
      {/* 1. Header (Static) */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <ScanSearch className="text-brand-600" /> AI Code Fact Checker
              </h2>
              <p className="text-slate-500 text-sm">Deep Scan Live Source Code untuk verifikasi fitur (Anti-Halusinasi).</p>
          </div>
          <div className="flex gap-3">
              <div className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2 border ${status === 'forbidden' ? 'bg-red-50 text-red-700 border-red-200' : diffCount === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {status === 'forbidden' ? <AlertTriangle size={14}/> : diffCount === 0 ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}
                  {status === 'forbidden' ? 'Access Denied' : diffCount === 0 ? 'Synced' : `${diffCount} Discrepancies`}
              </div>
              <button onClick={fetchRemote} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/>
              </button>
          </div>
      </div>

      {/* 2. Compare Control Bar (Static) */}
      <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 bg-slate-200 p-1 rounded-lg">
             <button onClick={() => setDiffMode(false)} className={`px-3 py-1 text-xs font-bold rounded ${!diffMode ? 'bg-white shadow text-black' : 'text-slate-500'}`}>Full File</button>
             <button onClick={() => setDiffMode(true)} className={`px-3 py-1 text-xs font-bold rounded ${diffMode ? 'bg-white shadow text-black' : 'text-slate-500'}`}>Highlight Diffs</button>
          </div>
          <div className="flex gap-4">
              <button onClick={handleCopyRemote} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 text-slate-700">
                  <ArrowLeft size={14}/> Pull (Copy Remote)
              </button>
              <button onClick={handlePushToBackend} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 shadow-lg">
                  Push (Deploy Local) <ArrowRight size={14}/> 
              </button>
          </div>
      </div>

      {/* 3. Comparison View (Scrollable) */}
      <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-0">
          <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-900 text-slate-400 text-xs font-bold uppercase tracking-wider shrink-0">
              <div className="p-3 flex items-center gap-2"><Monitor size={14}/> Frontend (Source of Truth)</div>
              <div className="p-3 border-l border-slate-800 flex items-center gap-2"><Server size={14}/> Live Backend Source (Target Audit)</div>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar relative">
              {isLoading && (
                  <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 backdrop-blur-sm">
                      <RefreshCw className="animate-spin text-brand-500" size={32}/>
                  </div>
              )}
              
              {!isLoading && status === 'error' && (
                  <div className="p-8 text-center text-red-400">
                      <AlertTriangle size={32} className="mx-auto mb-2"/>
                      <p>Failed to fetch remote source.</p>
                      <p className="text-xs font-mono bg-red-900/20 p-2 mt-2 rounded inline-block">{errorMsg}</p>
                  </div>
              )}

              {rows}
          </div>
      </div>

      {/* 4. AUDITOR CONSOLE (REBUILT) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden h-[450px] shrink-0">
          {/* Header */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <ShieldCheck size={18} className="text-purple-600"/> Intelligent Auditor Console
              </h3>
              <div className="flex gap-2">
                  <button onClick={() => setChatHistory([])} className="p-1.5 hover:bg-slate-200 rounded text-slate-500" title="Reset Audit">
                      <RotateCcw size={16}/>
                  </button>
              </div>
          </div>
          
          {/* Chat Window */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50" ref={chatScrollRef}>
              {chatHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-70">
                      <Bot size={48} className="text-slate-300 mb-4"/>
                      <h4 className="text-slate-700 font-bold mb-2">Siap Melakukan Fact-Checking</h4>
                      <p className="text-xs text-slate-500 max-w-sm mb-6">
                          Mulai pemindaian otomatis pada Source Code Backend yang telah diambil. 
                          Auditor akan memverifikasi fungsi initDB, interest_rate, dan header Auth.
                      </p>
                      <button 
                        onClick={handleStartAnalysis}
                        disabled={isThinking || status === 'forbidden'}
                        className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
                      >
                          {isThinking ? <RefreshCw className="animate-spin"/> : <PlayCircle size={18}/>}
                          Jalankan Audit Fakta
                      </button>
                      {status === 'forbidden' && (
                          <p className="text-xs text-red-500 mt-2 font-bold">Audit Disabled: Source Code blocked by server.</p>
                      )}
                  </div>
              )}

              {chatHistory.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'OWNER' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-4 border shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'OWNER' ? 'bg-slate-800 text-white border-slate-700 rounded-tr-none' : 
                          msg.role === 'FRONTEND_AI' ? 'bg-white text-slate-800 border-slate-200 rounded-tl-none font-mono text-xs' :
                          'bg-purple-50 text-purple-900 border-purple-200 rounded-tl-none font-mono text-xs'
                      }`}>
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10 opacity-80 text-xs font-bold uppercase tracking-wider">
                              {msg.role === 'FRONTEND_AI' && <><ShieldCheck size={12}/> LEAD AUDITOR</>}
                              {msg.role === 'BACKEND_AI' && <><Database size={12}/> COMPLIANCE BOT</>}
                              {msg.role === 'OWNER' && <><Crown size={12}/> Super Admin</>}
                          </div>
                          {msg.text}
                      </div>
                  </div>
              ))}

              {isThinking && (
                  <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl rounded-tl-none text-xs text-slate-500 flex items-center gap-2 shadow-sm">
                          <RefreshCw size={14} className="animate-spin text-brand-600"/>
                          Scanning Live Code...
                      </div>
                  </div>
              )}
          </div>

          {/* Action Bar */}
          <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex gap-2">
                  <form onSubmit={handleOwnerSubmit} className="flex-1 flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
                        placeholder="Perintah manual ke Auditor..."
                        value={ownerInput}
                        onChange={e => setOwnerInput(e.target.value)}
                        disabled={isThinking}
                      />
                      <button type="submit" disabled={!ownerInput || isThinking} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50">
                          <Send size={18}/>
                      </button>
                  </form>
                  <div className="w-px bg-slate-200 mx-1"></div>
                  <button 
                    onClick={handleAskBackend}
                    disabled={isThinking || chatHistory.length === 0}
                    className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold hover:bg-purple-100 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                  >
                      <Database size={16}/> Minta Fix Code
                  </button>
              </div>
          </div>
      </div>

      {/* Deploy Modal */}
      {showDeployModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-white font-bold flex items-center gap-2"><Terminal size={18}/> Deploy to Backend</h3>
                      <button onClick={() => setShowDeployModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-4 flex-1 overflow-auto bg-black">
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{deployScript}</pre>
                  </div>
                  <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
                      <button onClick={() => setShowDeployModal(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800">Cancel</button>
                      <button onClick={handleCopyDeployScript} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 flex items-center gap-2">
                          <Copy size={14}/> Copy & Run in Cloud Shell
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}