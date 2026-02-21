
import React, { useState, useEffect } from 'react';
import { 
    GitBranch, UploadCloud, RefreshCw, Archive, RotateCcw, 
    AlertTriangle, CheckCircle2, Terminal, Play, Server, 
    ShieldAlert, Activity, Stethoscope, Zap, Trash2, Skull, 
    Microscope, Lock, Eye, FileSearch, ArrowRight, Radiation,
    LifeBuoy, Wrench, DownloadCloud, FolderDown, X
} from 'lucide-react';
import { getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync';

interface AuditLog {
    command: string;
    output: string;
    status: 'success' | 'error' | 'warning';
}

export default function GitDeployment() {
    const [phase, setPhase] = useState<1 | 2 | 3>(1);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isAuditing, setIsAuditing] = useState(false);
    const [isRescuing, setIsRescuing] = useState(false);
    const [rescueLog, setRescueLog] = useState<string>('');
    
    // CLONE STATE
    const [repoUrl, setRepoUrl] = useState('https://github.com/firstboy219/cosger99.git');
    const [isCloning, setIsCloning] = useState(false);
    const [cloneLog, setCloneLog] = useState('');

    // CONFIRMATION MODAL STATE
    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant: 'danger' | 'warning';
    } | null>(null);

    const getConfigData = () => {
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';
        return { baseUrl, adminId };
    };

    // --- SHELL COMMAND EXECUTOR ---
    const executeShell = async (cmd: string) => {
        const { baseUrl, adminId } = getConfigData();
        try {
            const res = await fetch(`${baseUrl}/api/admin/shell`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({ 
                    cmd,
                    secret: 'gen-lang-client-066244752' 
                })
            });
            
            const text = await res.text();
            let output = text;
            try {
                const json = JSON.parse(text);
                output = json.output || json.error || text;
            } catch(e) {} 

            return { success: res.ok, output };
        } catch (e: any) {
            return { success: false, output: e.message };
        }
    };

    // --- PHASE 1: FIELD AUDIT ---
    const runFieldAudit = async () => {
        setIsAuditing(true);
        setAuditLogs([]);
        setPhase(1);

        const checks = [
            { name: "Check Project Folder", cmd: "ls -d ~/cosger99 || echo 'MISSING'" },
            { name: "Check Dist Folder", cmd: "ls -F dist/ || echo 'MISSING'" },
            { name: "Check Index Routing", cmd: "cat index.html | head -n 20" },
            { name: "Check Package JSON", cmd: "cat package.json | head -n 20" },
            { name: "Check Environment", cmd: "ls -la .env" }
        ];

        for (const check of checks) {
            const res = await executeShell(check.cmd);
            setAuditLogs(prev => [...prev, {
                command: check.name,
                output: res.output,
                status: res.output.includes('MISSING') || res.output.includes('No') ? 'warning' : 'success'
            }]);
            await new Promise(r => setTimeout(r, 500));
        }

        setIsAuditing(false);
    };

    // --- PHASE 2: RESCUE EXECUTION (LOGIC) ---
    const runRescueLogic = async () => {
        setConfirmModal(null); // Close modal
        setIsRescuing(true);
        setPhase(2);
        setRescueLog("Initializing Rescue & Recover Protocol...\n");

        // The EXACT rescue command chain requested (Surgical Fix)
        const rescueCmd = `
cd ~ && \\
cd cosger99 || cd ~/cosger99 || echo "Using current dir" && \\

echo ">>> PHASE 1: REPAIRING CONFIGURATION..." && \\
# Fix bad escapes in package.json
sed -i 's/\\\\&/&/g' package.json && \\

echo ">>> PHASE 2: ENSURE BUILD ARTIFACTS..." && \\
# 1. Sanitize JSX (Targeted Fixes for known syntax errors)
sed -i 's/remainingPrincipal \\\\&gt;/remainingPrincipal >/g' pages/Dashboard.tsx && \\
sed -i 's/window.scrollY \\\\&gt;/window.scrollY >/g' pages/LandingPage.tsx && \\

# 2. FIX DATABASE SCHEMA QUERY (Critical for Diagnostics)
# Replace 'dist' schema with 'public' to correctly find Postgres tables
echo ">>> FIXING SERVER SCHEMA QUERY..." && \\
sed -i "s/table_schema='dist'/table_schema='public'/g" server.cjs && \\
sed -i "s/table_schema = 'dist'/table_schema = 'public'/g" server.cjs && \\

# 3. Force Build
echo ">>> INSTALLING & BUILDING..." && \\
npm install && \\
npm run build && \\

echo ">>> PHASE 3: VERIFY & START..." && \\
if [ -f "dist/index.html" ]; then
  echo ">>> BUILD VERIFIED. RESTARTING SERVER..."
  pm2 restart paydone-api --update-env
  echo ">>> SUCCESS: Server restarted with valid build."
else
  echo ">>> CRITICAL FAILURE: Build failed. Dist folder missing. Aborting restart."
  exit 1
fi
        `;

        setRescueLog(prev => prev + "Sending Rescue Payload to Server...\n");
        
        executeShell(rescueCmd).then(res => {
            setRescueLog(prev => prev + (res.output || "Command Sent. Connection closed (Expected if server restarted)."));
            if (res.output.includes("CRITICAL FAILURE")) {
                alert("❌ RESCUE FAILED: Build artifacts missing.");
            } else if (res.output.includes("SUCCESS") || !res.output) {
                alert("✅ RESCUE SUCCESS: Server should be restarting.");
            }
        }).catch(e => {
            setRescueLog(prev => prev + "\n[NETWORK] Connection drop detected (Good sign for restart).");
        });

        // Simulate progress for UX
        setTimeout(() => setIsRescuing(false), 15000);
    };

    const triggerRescue = () => {
        setConfirmModal({
            title: "⚠️ EXECUTE RESCUE PROTOCOL",
            message: "This will attempt to surgically fix JSX errors, rebuild the app, and restart the server if successful. Continue?",
            onConfirm: runRescueLogic,
            variant: 'warning'
        });
    };

    // --- PHASE 3: FRESH CLONE (LOGIC) ---
    const runCloneLogic = async () => {
        if (!repoUrl) return alert("Repository URL required");
        setConfirmModal(null); // Close modal
        
        setIsCloning(true);
        setPhase(3);
        setCloneLog("Initializing Fresh Clone Sequence...\n");

        const cloneCmd = `
cd ~ && \\
echo ">>> STEP 1: BACKING UP ENV..." && \\
cp cosger99/.env .env.backup || echo "No existing env found" && \\

echo ">>> STEP 2: WIPING OLD FOLDER..." && \\
rm -rf cosger99 && \\

echo ">>> STEP 3: CLONING REPO..." && \\
git clone ${repoUrl} cosger99 && \\
cd cosger99 && \\

echo ">>> STEP 4: RESTORING ENV..." && \\
mv ~/.env.backup .env || echo "No backup env to restore" && \\

echo ">>> STEP 5: INSTALLING..." && \\
npm install && \\
echo ">>> CLONE COMPLETE. READY FOR BUILD."
        `;

        setCloneLog(prev => prev + `Target: ${repoUrl}\nExecuting...\n`);

        const res = await executeShell(cloneCmd);
        setCloneLog(prev => prev + (res.output || "No output returned."));
        
        if (res.success) {
            alert("✅ Repository Cloned Successfully!\nNow you MUST run 'Rescue & Build' to start the server.");
        } else {
            alert("❌ Clone Failed: " + res.output);
        }
        setIsCloning(false);
    };

    const triggerClone = () => {
        setConfirmModal({
            title: "⚠️ DANGER: FRESH CLONE",
            message: "This will DELETE the existing 'cosger99' folder and clone fresh from GitHub. .env file will be backed up and restored. This is irreversible. Continue?",
            onConfirm: runCloneLogic,
            variant: 'danger'
        });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20 relative">
            
            {/* HEADER */}
            <div className="flex justify-between items-center bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><LifeBuoy size={150} /></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg">
                            <GitBranch size={32} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">DEPLOYMENT CENTER</h2>
                            <p className="text-indigo-200 text-sm font-medium">Git Operations & Recovery Protocols</p>
                        </div>
                    </div>
                </div>
                <div className="relative z-10 flex gap-4">
                    <div className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center ${phase === 1 ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        <span className="text-[10px] font-black uppercase">Phase 1</span>
                        <span className="font-bold text-sm">AUDIT</span>
                    </div>
                    <ArrowRight size={24} className="text-slate-600" />
                    <div className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center ${phase === 3 ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        <span className="text-[10px] font-black uppercase">Phase 2</span>
                        <span className="font-bold text-sm">CLONE</span>
                    </div>
                    <ArrowRight size={24} className="text-slate-600" />
                    <div className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center ${phase === 2 ? 'bg-amber-500 text-white border-amber-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        <span className="text-[10px] font-black uppercase">Phase 3</span>
                        <span className="font-bold text-sm">BUILD</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COL 1: AUDIT */}
                <div className={`lg:col-span-1 bg-white rounded-[2.5rem] border-4 p-6 transition-all flex flex-col ${phase === 1 ? 'border-brand-500 shadow-xl' : 'border-slate-100 opacity-80'}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-slate-100 rounded-lg"><FileSearch size={20} className="text-slate-600"/></div>
                        <h3 className="font-black text-slate-900">1. System Audit</h3>
                    </div>
                    
                    <button 
                        onClick={runFieldAudit}
                        disabled={isAuditing}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2 mb-4"
                    >
                        {isAuditing ? <RefreshCw className="animate-spin" size={14}/> : <Microscope size={14}/>} Run Scan
                    </button>

                    <div className="bg-slate-950 rounded-2xl p-4 font-mono text-xs flex-1 overflow-y-auto custom-scrollbar border border-slate-800 min-h-[200px]">
                        {auditLogs.length === 0 ? (
                            <span className="text-slate-600 italic">// Ready to scan...</span>
                        ) : (
                            auditLogs.map((log, i) => (
                                <div key={i} className="mb-2 border-b border-slate-800 pb-2 last:border-0">
                                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                                        <span className="text-brand-400">$</span> {log.command}
                                    </div>
                                    <pre className={`whitespace-pre-wrap ${log.status === 'error' ? 'text-red-400' : log.status === 'warning' ? 'text-amber-400' : 'text-green-400'}`}>
                                        {log.output || '(No Output)'}
                                    </pre>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* COL 2: CLONE (NEW) */}
                <div className={`lg:col-span-1 bg-indigo-50 rounded-[2.5rem] border-4 p-6 transition-all flex flex-col ${phase === 3 ? 'border-indigo-500 shadow-xl' : 'border-indigo-100 opacity-80'}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-indigo-200 rounded-lg"><DownloadCloud size={20} className="text-indigo-700"/></div>
                        <div>
                            <h3 className="font-black text-indigo-900">2. Fresh Clone</h3>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase">Reset & Re-Download</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-4">
                        <div>
                            <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Repository URL</label>
                            <input 
                                type="text" 
                                value={repoUrl} 
                                onChange={e => setRepoUrl(e.target.value)}
                                className="w-full p-3 rounded-xl border-2 border-indigo-200 bg-white text-xs font-mono focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="bg-white/50 p-3 rounded-xl border border-indigo-100 text-[10px] text-indigo-700 leading-relaxed">
                            <strong>Action:</strong> Wipes <code>~/cosger99</code>, clones repo, restores <code>.env</code>, runs <code>npm install</code>.
                        </div>
                    </div>

                    <button 
                        onClick={triggerClone}
                        disabled={isCloning}
                        className="w-full py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
                    >
                        {isCloning ? <RefreshCw className="animate-spin" size={16}/> : <FolderDown size={16}/>}
                        {isCloning ? 'CLONING...' : 'START FRESH CLONE'}
                    </button>

                    {isCloning && (
                        <div className="mt-4 bg-black rounded-xl p-3 font-mono text-[10px] text-indigo-300 h-32 overflow-y-auto">
                            <pre>{cloneLog}</pre>
                        </div>
                    )}
                </div>

                {/* COL 3: RESCUE & BUILD */}
                <div className={`lg:col-span-1 bg-white rounded-[2.5rem] border-4 p-6 transition-all flex flex-col ${phase === 2 ? 'border-amber-500 shadow-xl' : 'border-slate-100 opacity-80'}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 rounded-lg"><LifeBuoy size={20} className="text-amber-600"/></div>
                        <div>
                            <h3 className="font-black text-slate-900">3. Rescue & Build</h3>
                            <p className="text-[10px] text-amber-600 font-bold uppercase">Fix Config & Restart</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-4 flex-1">
                        <h4 className="font-bold text-amber-800 text-xs flex items-center gap-2 mb-2"><Wrench size={12}/> Auto-Fix Sequence</h4>
                        <ul className="text-[10px] text-amber-800 space-y-1 list-disc list-inside">
                            <li>Sanitize <code>package.json</code> (JSON Syntax)</li>
                            <li>Fix JSX Syntax (<code>&gt;</code> chars)</li>
                            <li><strong>Patch Server Schema</strong> (public vs dist)</li>
                            <li>Force <code>npm run build</code></li>
                            <li>Verify <code>dist/</code> & Restart PM2</li>
                        </ul>
                    </div>

                    <button 
                        onClick={triggerRescue}
                        disabled={isRescuing}
                        className="w-full py-4 bg-amber-500 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition flex items-center justify-center gap-2"
                    >
                        {isRescuing ? <RefreshCw className="animate-spin" size={16}/> : <Zap size={16}/>}
                        {isRescuing ? 'RESCUING...' : 'RUN BUILD & RESTART'}
                    </button>

                    {isRescuing && (
                        <div className="mt-4 bg-black rounded-xl p-3 font-mono text-[10px] text-green-400 h-32 overflow-y-auto">
                            <pre>{rescueLog}</pre>
                        </div>
                    )}
                </div>

            </div>

            {/* CUSTOM CONFIRMATION MODAL */}
            {confirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-6 animate-fade-in">
                    <div className={`bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl border-4 ${confirmModal.variant === 'danger' ? 'border-red-500' : 'border-amber-500'}`}>
                        <div className="flex justify-between items-start mb-6">
                            <div className={`p-4 rounded-2xl ${confirmModal.variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                <AlertTriangle size={32}/>
                            </div>
                            <button onClick={() => setConfirmModal(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition"><X size={24}/></button>
                        </div>
                        
                        <h3 className={`text-2xl font-black mb-3 ${confirmModal.variant === 'danger' ? 'text-red-700' : 'text-amber-700'}`}>
                            {confirmModal.title}
                        </h3>
                        <p className="text-slate-600 text-sm font-medium leading-relaxed mb-8">
                            {confirmModal.message}
                        </p>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmModal(null)} 
                                className="flex-1 py-4 border-2 border-slate-200 rounded-2xl font-bold text-slate-500 text-xs uppercase tracking-widest hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmModal.onConfirm} 
                                className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition transform active:scale-95 ${confirmModal.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
                            >
                                Confirm Action
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
