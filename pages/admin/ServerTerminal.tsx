
import React, { useState, useEffect, useRef } from 'react';
import { 
    Terminal, Play, RefreshCw, Trash2, Command, Server, 
    ShieldAlert, Cpu, Activity, GitBranch, FileText, 
    Zap, RotateCcw, Power, Clock, HardDrive, Code, 
    Save, Wand2, DownloadCloud, UploadCloud, CheckCircle2, X,
    FolderOpen, AlertTriangle, Layers, ListChecks, History, FilePlus, Plus, Info, Star, Archive, Calendar, Tag
} from 'lucide-react';
import { getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync';
import { GoogleGenAI } from "@google/genai";

interface TerminalLine {
    id: string;
    type: 'command' | 'output' | 'error';
    content: string;
    timestamp: Date;
}

interface ServerVersion {
    filename: string;
    isActive: boolean;
    features: string[];
    // New Backend v47.72 Data
    deepScan?: {
        percentage: number;
        missing: string[];
        score: number;
    };
}

interface Snapshot {
    filename: string;
    size: string;
    created: string;
}

export default function ServerTerminal() {
    const [mode, setMode] = useState<'terminal' | 'editor' | 'versions' | 'snapshots'>('terminal');
    
    // TERMINAL STATE
    const [history, setHistory] = useState<TerminalLine[]>([
        { id: 'init', type: 'output', content: 'Paydone Remote Shell v1.0. Connected via Secure Handshake.', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // EDITOR STATE
    const [editorFileName, setEditorFileName] = useState('server.js');
    const [editorCode, setEditorCode] = useState('// Click "Load from Server" to fetch live code...');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiWorking, setIsAiWorking] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // VERSIONS STATE
    const [versions, setVersions] = useState<ServerVersion[]>([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
    
    // NEW: MANUAL SAVE STATE
    const [saveLabel, setSaveLabel] = useState('');
    const [isSavingVersion, setIsSavingVersion] = useState(false);
    
    // SNAPSHOT STATE
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
    const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);
    
    // NEW: CREATE SNAPSHOT STATE
    const [showSnapshotModal, setShowSnapshotModal] = useState(false);
    const [snapshotLabel, setSnapshotLabel] = useState('');
    const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

    // DELETE STATE
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // CREATE VERSION MODAL STATE
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newVersionName, setNewVersionName] = useState('');
    const [newVersionContent, setNewVersionContent] = useState('');
    const [isCreatingVersion, setIsCreatingVersion] = useState(false);

    // NOTIFICATION STATE (Sandbox Friendly)
    const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);

    // CONFIRMATION MODAL STATE
    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant: 'danger' | 'warning';
    } | null>(null);

    const showToast = (type: 'success' | 'error' | 'info', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    // Calculate Max Score for Badge
    const maxRobustness = Math.max(...versions.map(v => v.deepScan?.percentage || 0));

    // --- TERMINAL LOGIC ---
    useEffect(() => {
        if (mode === 'terminal') {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            inputRef.current?.focus();
        }
    }, [history, mode]);

    // --- VERSION LOGIC ---
    useEffect(() => {
        if (mode === 'versions') {
            fetchVersions();
        }
        if (mode === 'snapshots') {
            fetchSnapshots();
        }
    }, [mode]);

    const fetchVersions = async () => {
        setIsLoadingVersions(true);
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        
        try {
            // Call new intelligent endpoint
            const res = await fetch(`${baseUrl}/api/admin/versions?secret=gen-lang-client-066244752`);
            if (res.ok) {
                const data = await res.json();
                setVersions(data.versions || []);
            } else {
                setHistory(prev => [...prev, { id: `err-${Date.now()}`, type: 'error', content: `Failed to fetch versions: HTTP ${res.status}`, timestamp: new Date() }]);
            }
        } catch (e: any) {
            setHistory(prev => [...prev, { id: `err-${Date.now()}`, type: 'error', content: `Network error fetching versions: ${e.message}`, timestamp: new Date() }]);
        } finally {
            setIsLoadingVersions(false);
        }
    };

    const fetchSnapshots = async () => {
        setIsLoadingSnapshots(true);
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        
        try {
            const res = await fetch(`${baseUrl}/api/admin/snapshots?secret=gen-lang-client-066244752`);
            if (res.ok) {
                const data = await res.json();
                setSnapshots(data.snapshots || []);
            } else {
                const err = await res.json();
                showToast('error', `Failed to fetch snapshots: ${err.error || res.status}`);
            }
        } catch (e: any) {
            showToast('error', `Network error: ${e.message}`);
        } finally {
            setIsLoadingSnapshots(false);
        }
    };

    const handleSaveCurrentVersion = async () => {
        setIsSavingVersion(true);
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        try {
            const res = await fetch(`${baseUrl}/api/admin/versions/save`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    label: saveLabel,
                    secret: 'gen-lang-client-066244752'
                })
            });

            const data = await res.json();

            if (res.ok) {
                showToast('success', data.message || "Current version saved successfully!");
                setSaveLabel('');
                fetchVersions(); // Refresh list
            } else {
                showToast('error', `Save failed: ${data.error || res.statusText}`);
            }
        } catch (e: any) {
            showToast('error', `Network error: ${e.message}`);
        } finally {
            setIsSavingVersion(false);
        }
    };

    const handleCreateVersion = async () => {
        if (!newVersionName.trim()) {
            showToast('error', "Please enter a filename.");
            return;
        }
        if (!newVersionName.endsWith('.cjs')) {
            showToast('error', "Filename must end with .cjs extension.");
            return;
        }
        if (newVersionName === 'server.cjs' || newVersionName === 'server.js') {
            showToast('error', "Safety Protocol: You cannot name a file 'server.cjs' directly here.");
            return;
        }
        if (!newVersionContent.trim()) {
            showToast('error', "Please paste the server code content.");
            return;
        }

        setIsCreatingVersion(true);
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        try {
            const res = await fetch(`${baseUrl}/api/admin/files/create`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    filename: newVersionName,
                    content: newVersionContent,
                    secret: 'gen-lang-client-066244752'
                })
            });

            if (res.ok) {
                showToast('success', `Success! File '${newVersionName}' created.`);
                setShowCreateModal(false);
                setNewVersionName('');
                setNewVersionContent('');
                fetchVersions(); // Refresh list
            } else {
                const err = await res.json();
                showToast('error', `Failed to create file: ${err.error || res.statusText}`);
            }
        } catch (e: any) {
            showToast('error', `Network Error: ${e.message}`);
        } finally {
            setIsCreatingVersion(false);
        }
    };

    const handleRestoreVersion = async (version: ServerVersion) => {
        setRestoringVersion(version.filename);
        
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        try {
            // Using NEW RESTORE API (Handles Auto-Backup)
            const resPromise = fetch(`${baseUrl}/api/admin/versions/restore`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    filename: version.filename,
                    secret: 'gen-lang-client-066244752'
                })
            });

            // Race against server restart (network cutoff)
            const timeoutPromise = new Promise<{ok:boolean, forced?:boolean, data?:any}>((resolve) => {
                setTimeout(() => resolve({ ok: true, forced: true }), 8000);
            });

            const result: any = await Promise.race([resPromise, timeoutPromise]);

            if (result.forced) {
                 showToast('success', "✅ Restore Triggered! Server is restarting...");
                 setTimeout(fetchVersions, 4000);
            } else if (result.ok) {
                 const data = await result.json();
                 showToast('success', `✅ Restore Success! ${data.message || 'Server Restarting...'}`);
                 setTimeout(fetchVersions, 4000);
            } else {
                 try {
                    const err = await result.json();
                    showToast('error', `❌ Restore Failed: ${err.error}`);
                 } catch {
                    showToast('error', "Restore endpoint failed.");
                 }
            }
        } catch (error: any) {
            // Check if error is network related due to server restart
            if (error.message && (error.message.includes('Network') || error.message.includes('fetch'))) {
                 showToast('success', "✅ Server Restored & Restarting! (Connection closed)");
                 setTimeout(fetchVersions, 4000);
            } else {
                 showToast('error', `❌ Restore Connection Failed: ${error.message}`);
            }
        } finally {
            setRestoringVersion(null);
        }
    };

    const handleCreateSnapshot = async () => {
        setIsCreatingSnapshot(true);
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        try {
            const res = await fetch(`${baseUrl}/api/admin/snapshots/create`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    label: snapshotLabel,
                    secret: 'gen-lang-client-066244752'
                })
            });

            if (res.ok) {
                showToast('success', "Full System Snapshot Created Successfully!");
                setShowSnapshotModal(false);
                setSnapshotLabel('');
                fetchSnapshots();
            } else {
                const err = await res.json();
                showToast('error', `Creation Failed: ${err.error}`);
            }
        } catch (e: any) {
            showToast('error', `Network Error: ${e.message}`);
        } finally {
            setIsCreatingSnapshot(false);
        }
    };

    const triggerSnapshotRestore = (filename: string) => {
        setConfirmModal({
            title: "⚠️ CRITICAL RESTORE",
            message: `Are you sure you want to restore '${filename}'? This will WIPE the current project folder, Extract the backup, and RESTART the server immediately. This cannot be undone.`,
            onConfirm: () => executeRestoreSnapshot(filename),
            variant: 'danger'
        });
    };

    const executeRestoreSnapshot = async (filename: string) => {
        setConfirmModal(null);
        setIsRestoringSnapshot(true);
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        try {
            // We assume server restart will break connection, so we race
            const resPromise = fetch(`${baseUrl}/api/admin/snapshots/restore`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    filename,
                    secret: 'gen-lang-client-066244752'
                })
            });

            // If it takes more than 5s, we assume server is restarting
            const timeoutPromise = new Promise<{ok:boolean, forced?:boolean}>((resolve) => {
                setTimeout(() => resolve({ ok: true, forced: true }), 8000);
            });

            const res = await Promise.race([resPromise, timeoutPromise]);

            if (res.ok) {
                showToast('success', "Restore Sequence Initiated. Server is restarting...");
            } else {
                // Try to parse error if response came back
                try {
                    const data = await (res as Response).json();
                    showToast('error', `Restore Failed: ${data.error}`);
                } catch {
                    showToast('error', "Restore Failed: Unknown Error");
                }
            }
        } catch (e: any) {
            // Network error is actually a good sign here
            showToast('success', "Restore Command Sent (Connection Closed). Server is restarting...");
        } finally {
            setIsRestoringSnapshot(false);
        }
    };

    const handleRequestDelete = (filename: string) => {
        if (filename === 'server.cjs') return;
        setConfirmDelete(filename);
    };

    // UPDATED DELETE LOGIC USING API
    const executeDelete = async () => {
        if (!confirmDelete) return;
        setIsDeleting(true);
        
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        try {
            const res = await fetch(`${baseUrl}/api/admin/versions/delete`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    filename: confirmDelete,
                    secret: 'gen-lang-client-066244752'
                })
            });

            if (res.ok) {
                showToast('success', `Version ${confirmDelete} deleted successfully.`);
                fetchVersions(); // Refresh list
            } else {
                const data = await res.json();
                showToast('error', `Failed to delete: ${data.error || res.statusText}`);
            }
        } catch (e: any) {
            showToast('error', `Delete Error: ${e.message}`);
        } finally {
            setIsDeleting(false);
            setConfirmDelete(null);
        }
    };

    const runRawCommand = async (cmd: string): Promise<{ success: boolean, output: string, status?: number }> => {
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        try {
            const res = await fetch(`${baseUrl}/api/admin/shell`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({ 
                    cmd: cmd,
                    secret: 'gen-lang-client-066244752' 
                })
            });

            const contentType = res.headers.get("content-type");
            let outputText = "";

            if (contentType && contentType.includes("application/json")) {
                const data = await res.json();
                outputText = res.ok ? (data.output || '') : (data.error || 'Unknown Error');
                return { success: res.ok, output: outputText, status: res.status };
            } else {
                outputText = await res.text();
                return { success: res.ok, output: outputText, status: res.status };
            }
        } catch (e: any) {
            // IMPORTANT: If fetch fails with network error, it might be due to server restarting
            return { success: false, output: e.message, status: 0 };
        }
    };

    const executeCommand = async (cmd: string) => {
        if (!cmd.trim()) return;
        
        setIsExecuting(true);
        const cmdId = `cmd-${Date.now()}`;
        setHistory(prev => [...prev, { id: cmdId, type: 'command', content: `root@paydone-server:~$ ${cmd}`, timestamp: new Date() }]);
        
        const result = await runRawCommand(cmd);

        // Special handling for restart command results which might fail fetch but succeed in action
        let displayOutput = result.output;
        if (cmd.includes('restart') && (result.output.includes('fetch') || result.output.includes('Network'))) {
            displayOutput = "Server is restarting (Connection reset as expected). Please wait 10s...";
        } else if (result.status === 404) {
            displayOutput = 'Endpoint /api/admin/shell Not Found. Update Server Code.';
        } else if (!displayOutput) {
            displayOutput = '(No output)';
        }

        setHistory(prev => [...prev, { 
            id: `out-${Date.now()}`, 
            type: result.success || cmd.includes('restart') ? 'output' : 'error', 
            content: displayOutput, 
            timestamp: new Date() 
        }]);
        
        setIsExecuting(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeCommand(input);
        setInput('');
    };

    const handleClear = () => {
        setHistory([{ id: `reset-${Date.now()}`, type: 'output', content: 'Console cleared.', timestamp: new Date() }]);
    };

    // --- EDITOR LOGIC ---
    const handleLoadFromServer = async () => {
        setIsExecuting(true); 
        const result = await runRawCommand(`cat "${editorFileName}"`);
        if (result.success) {
            setEditorCode(result.output);
        } else {
            if (result.status === 404) {
                showToast('error', "Fitur Shell tidak tersedia. Update server.js manual.");
            } else {
                showToast('error', `Gagal membaca file: ${result.output}`);
            }
        }
        setIsExecuting(false);
    };

    // --- REFINED DEPLOY LOGIC (SAFE SAVE) ---
    const handleDeploy = async () => {
        if (!editorFileName.trim()) {
            showToast('error', "Nama file target tidak boleh kosong.");
            return;
        }

        setIsDeploying(true);
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';
        
        try {
            // STEP 1: SAFETY BACKUP (Crucial for server.js/cjs)
            if (editorFileName === 'server.js' || editorFileName === 'server.cjs') {
                showToast('info', "⏳ Creating safety backup...");
                
                const backupRes = await fetch(`${baseUrl}/api/admin/versions/save`, {
                    method: 'POST',
                    headers: getHeaders(adminId),
                    body: JSON.stringify({
                        label: 'pre-edit-backup',
                        secret: 'gen-lang-client-066244752'
                    })
                });

                if (!backupRes.ok) {
                    const err = await backupRes.json();
                    throw new Error(`Safety Backup Failed: ${err.error || backupRes.statusText}. Aborting save.`);
                }
                showToast('success', "✅ Backup secured. Proceeding to save...");
                // Refresh versions immediately so user sees the backup
                fetchVersions();
            }

            // STEP 2: WRITE FILE (Overwriting)
            const writeRes = await fetch(`${baseUrl}/api/admin/files/create`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({
                    filename: editorFileName,
                    content: editorCode,
                    secret: 'gen-lang-client-066244752'
                })
            });
            
            if (!writeRes.ok) {
                const err = await writeRes.json();
                throw new Error(`Write failed: ${err.error || writeRes.statusText}`);
            }

            // STEP 3: RESTART (If server file)
            if (editorFileName === 'server.js' || editorFileName === 'server.cjs') {
                const restartCmd = `pm2 restart paydone-api --update-env`;
                const restartPromise = runRawCommand(restartCmd); // Reuse runRawCommand for shell
                
                // Timeout logic for restart
                const timeoutPromise = new Promise<{success:boolean, output:string}>((resolve) => {
                    setTimeout(() => resolve({ success: true, output: "Server is restarting..." }), 5000);
                });

                await Promise.race([restartPromise, timeoutPromise]);
                showToast('success', "🚀 File Saved & Server Restarting!");
            } else {
                showToast('success', "File saved successfully.");
            }
            
            setHistory(prev => [...prev, { 
                id: `deploy-${Date.now()}`, 
                type: 'output', 
                content: `[SYSTEM] Successfully saved ${editorFileName} (with backup).`, 
                timestamp: new Date() 
            }]);

        } catch (e: any) {
            showToast('error', `Save Failed: ${e.message}`);
            setHistory(prev => [...prev, { 
                id: `err-${Date.now()}`, 
                type: 'error', 
                content: `[SAVE ERROR] ${e.message}`, 
                timestamp: new Date() 
            }]);
        } finally {
            setIsDeploying(false);
        }
    };

    const handleAiEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiPrompt.trim()) return;
        
        setIsAiWorking(true);
        const config = getConfig();
        
        try {
            const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
            const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
            
            const prompt = `
                ROLE: Senior Node.js Backend Developer.
                TASK: Modify the following code based on the user request.
                
                USER REQUEST: "${aiPrompt}"
                
                CURRENT CODE:
                ${editorCode}
                
                RULES:
                1. Return ONLY the complete, updated code. 
                2. Do NOT use Markdown code blocks (like \`\`\`javascript). Just raw code.
                3. Ensure the code is valid Node.js/Express.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const newCode = response.text().replace(/```javascript|```js|```/g, '').trim();
            
            setEditorCode(newCode);
            setAiPrompt('');
        } catch (err: any) {
            showToast('error', `AI Error: ${err.message}`);
        } finally {
            setIsAiWorking(false);
        }
    };

    const quickActions = [
        { label: 'Check Logs', cmd: 'tail -n 20 ~/.pm2/logs/paydone-api-out.log', icon: FileText, color: 'text-blue-400 border-blue-900/50 bg-blue-900/20' },
        { label: 'Git Pull', cmd: 'git pull', icon: GitBranch, color: 'text-orange-400 border-orange-900/50 bg-orange-900/20' },
        { label: 'Restart Server', cmd: 'pm2 restart paydone-api', icon: RotateCcw, color: 'text-red-400 border-red-900/50 bg-red-900/20' },
        { label: 'Disk Usage', cmd: 'df -h', icon: HardDrive, color: 'text-green-400 border-green-900/50 bg-green-900/20' },
        { label: 'Memory', cmd: 'free -m', icon: Cpu, color: 'text-purple-400 border-purple-900/50 bg-purple-900/20' },
        { label: 'Uptime', cmd: 'uptime', icon: Clock, color: 'text-cyan-400 border-cyan-900/50 bg-cyan-900/20' }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] space-y-6 animate-fade-in relative">
            
            {/* TOAST NOTIFICATION */}
            {notification && (
                <div className={`fixed top-24 right-6 z-[100] p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in-up ${
                    notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
                    notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                    {notification.type === 'success' ? <CheckCircle2 size={20}/> : notification.type === 'error' ? <AlertTriangle size={20}/> : <Info size={20}/>}
                    <div>
                        <p className="font-bold text-sm uppercase">{notification.type}</p>
                        <p className="text-xs font-medium">{notification.message}</p>
                    </div>
                    <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-black/5 rounded"><X size={14}/></button>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl shadow-lg border transition-colors ${mode === 'terminal' ? 'bg-slate-900 text-green-400 border-slate-700' : mode === 'versions' ? 'bg-green-600 text-white border-green-500' : mode === 'snapshots' ? 'bg-orange-600 text-white border-orange-500' : 'bg-indigo-600 text-white border-indigo-500'}`}>
                        {mode === 'terminal' ? <Terminal size={24} /> : mode === 'versions' ? <Layers size={24} /> : mode === 'snapshots' ? <Archive size={24} /> : <Code size={24} />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            {mode === 'terminal' ? 'Server Command Center' : mode === 'versions' ? 'Version Control' : mode === 'snapshots' ? 'Snapshot Manager' : 'Smart Code Editor'} 
                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-widest font-black flex items-center gap-1"><ShieldAlert size={10}/> Root Access</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <Activity size={12} className="text-green-500 animate-pulse"/> Live Session
                            </span>
                            <span className="text-xs text-slate-300">|</span>
                            <span className="text-[10px] font-mono text-slate-400">backend-node-v1</span>
                        </div>
                    </div>
                </div>
                
                {/* MODE SWITCHER */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => setMode('terminal')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${mode === 'terminal' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Terminal size={16}/> Terminal
                    </button>
                    <button 
                        onClick={() => setMode('editor')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${mode === 'editor' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Code size={16}/> Editor
                    </button>
                    <button 
                        onClick={() => setMode('versions')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${mode === 'versions' ? 'bg-white text-green-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layers size={16}/> Versions
                    </button>
                    <button 
                        onClick={() => setMode('snapshots')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${mode === 'snapshots' ? 'bg-white text-orange-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Archive size={16}/> Snapshots
                    </button>
                </div>
            </div>

            {/* Quick Actions Grid (Terminal Only) */}
            {mode === 'terminal' && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                    {quickActions.map((action, idx) => (
                        <button 
                            key={idx}
                            onClick={() => executeCommand(action.cmd)}
                            disabled={isExecuting}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all hover:bg-opacity-30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${action.color}`}
                        >
                            <action.icon size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{action.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* TERMINAL VIEW */}
            {mode === 'terminal' && (
                <div className="flex-1 bg-[#0d1117] rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-0 relative">
                    <div className="flex items-center justify-between p-4 bg-[#161b22] border-b border-slate-800 shrink-0">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            <span className="ml-2 text-[10px] text-slate-500 font-mono">ssh root@api.paydone.id</span>
                        </div>
                        <button onClick={handleClear} className="text-slate-500 hover:text-white" title="Clear"><Trash2 size={16}/></button>
                    </div>

                    <div 
                        className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-2 custom-scrollbar scroll-smooth" 
                        style={{ fontFamily: '"Fira Code", "JetBrains Mono", monospace' }}
                        onClick={() => inputRef.current?.focus()}
                    >
                        {history.map((line) => (
                            <div key={line.id} className="break-words whitespace-pre-wrap">
                                {line.type === 'command' && <span className="text-yellow-400 font-bold">{line.content}</span>}
                                {line.type === 'output' && <span className="text-green-400 leading-relaxed">{line.content}</span>}
                                {line.type === 'error' && <span className="text-red-400 font-bold bg-red-900/20 px-1 rounded">{line.content}</span>}
                            </div>
                        ))}
                        
                        <div className="flex items-center gap-2 text-white mt-2">
                            <span className="text-green-500 font-bold shrink-0">root@server:~$</span>
                            <form onSubmit={handleSubmit} className="flex-1">
                                <input 
                                    ref={inputRef}
                                    type="text" 
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-white focus:ring-0 p-0"
                                    autoFocus
                                    disabled={isExecuting}
                                />
                            </form>
                        </div>
                        {isExecuting && <div className="text-slate-500 animate-pulse">Processing remote command...</div>}
                        <div ref={bottomRef} />
                    </div>
                </div>
            )}

            {/* EDITOR VIEW */}
            {mode === 'editor' && (
                <div className="flex-1 bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl flex flex-col min-h-0 overflow-hidden relative">
                    
                    {/* Editor Toolbar */}
                    <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex-1 max-w-sm">
                                <div className="px-3 py-2 bg-slate-800 text-slate-500 border-r border-slate-700">
                                    <FolderOpen size={14}/>
                                </div>
                                <input 
                                    className="bg-transparent text-slate-300 text-xs font-mono px-3 py-2 outline-none w-full placeholder-slate-600" 
                                    value={editorFileName}
                                    onChange={e => setEditorFileName(e.target.value)}
                                    placeholder="path/to/file.js"
                                />
                            </div>
                            <button 
                                onClick={handleLoadFromServer} 
                                disabled={isExecuting}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-bold transition whitespace-nowrap"
                            >
                                {isExecuting ? <RefreshCw className="animate-spin" size={14}/> : <DownloadCloud size={14}/>} Load
                            </button>
                        </div>

                        <button 
                            onClick={handleDeploy} 
                            disabled={isDeploying || !editorFileName.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isDeploying ? <RefreshCw className="animate-spin" size={14}/> : <UploadCloud size={14}/>} 
                            {isDeploying ? 'Deploying...' : 'Deploy & Restart'}
                        </button>
                    </div>

                    {/* AI Prompt Bar */}
                    <div className="p-3 bg-indigo-900/20 border-b border-indigo-500/30 flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <Wand2 size={18}/>
                        </div>
                        <form onSubmit={handleAiEdit} className="flex-1 flex gap-2">
                            <input 
                                type="text"
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                placeholder="Ask AI to edit code (e.g., 'Add a GET endpoint for /api/status that returns uptime')"
                                className="flex-1 bg-slate-900 border border-slate-700 text-indigo-200 placeholder-indigo-400/50 rounded-lg px-4 py-2 text-xs focus:border-indigo-500 outline-none transition"
                                disabled={isAiWorking}
                            />
                            <button 
                                type="submit"
                                disabled={isAiWorking || !aiPrompt}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                            >
                                {isAiWorking ? 'Generating...' : 'Magic Edit'}
                            </button>
                        </form>
                    </div>

                    {/* Text Area */}
                    <div className="flex-1 relative">
                        <textarea 
                            ref={textareaRef}
                            value={editorCode}
                            onChange={(e) => setEditorCode(e.target.value)}
                            className="w-full h-full bg-[#0d1117] text-[#c9d1d9] font-mono text-xs p-6 outline-none resize-none leading-relaxed custom-scrollbar"
                            spellCheck={false}
                        />
                        <div className="absolute bottom-4 right-4 text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                            Lines: {editorCode.split('\n').length} | Length: {editorCode.length} chars
                        </div>
                    </div>
                </div>
            )}

            {/* VERSIONS VIEW */}
            {mode === 'versions' && (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50 rounded-[2rem] border-2 border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                            <History size={18} className="text-green-600"/> Available Backups
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => { 
                                    setNewVersionName(''); 
                                    setNewVersionContent(''); 
                                    setShowCreateModal(true); 
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow-sm"
                            >
                                <FilePlus size={14} /> Create New Version
                            </button>
                            <button onClick={fetchVersions} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition border border-slate-200" title="Refresh">
                                <RefreshCw size={16} className={isLoadingVersions ? 'animate-spin text-green-600' : 'text-slate-500'}/>
                            </button>
                        </div>
                    </div>
                    
                    {/* MANUAL SAVE BAR */}
                    <div className="p-4 bg-white border-b border-slate-100 flex gap-4 items-center">
                        <div className="flex-1 relative">
                            <Tag size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                            <input 
                                type="text" 
                                placeholder="Optional Tag (e.g. pre-refactor-v2)" 
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:border-green-500 outline-none"
                                value={saveLabel}
                                onChange={(e) => setSaveLabel(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleSaveCurrentVersion}
                            disabled={isSavingVersion}
                            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition shadow-md disabled:opacity-70"
                        >
                            {isSavingVersion ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}
                            Freeze Current Version
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 custom-scrollbar">
                        {versions.length === 0 && !isLoadingVersions && (
                            <div className="col-span-full py-20 text-center text-slate-400">
                                <AlertTriangle size={48} className="mx-auto mb-2 opacity-20"/>
                                <p>No version history found on server.</p>
                            </div>
                        )}
                        
                        {versions.map((ver, idx) => {
                            const pct = ver.deepScan?.percentage || 0;
                            const isMostRobust = ver.deepScan?.percentage === maxRobustness && maxRobustness > 0;
                            
                            return (
                                <div key={idx} className={`rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${ver.isActive ? 'bg-green-50 border-green-200 shadow-md' : 'bg-white border-slate-200 hover:shadow-lg'} ${isMostRobust && !ver.isActive ? 'border-yellow-200 ring-2 ring-yellow-100' : ''}`}>
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <FileText size={20} className={ver.isActive ? 'text-green-600' : 'text-slate-400'}/>
                                                <span className="font-mono font-bold text-sm text-slate-900 truncate" title={ver.filename}>{ver.filename}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isMostRobust && (
                                                    <span className="bg-yellow-100 text-yellow-700 text-[9px] font-black uppercase px-2 py-1 rounded flex items-center gap-1 border border-yellow-200" title="Highest Completeness Score">
                                                        <Star size={10} className="fill-yellow-500"/> ROBUST
                                                    </span>
                                                )}
                                                {ver.isActive && <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded border border-green-200">Active</span>}
                                            </div>
                                        </div>
                                        
                                        {/* DEEP SCAN BAR */}
                                        <div className="mb-4">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                                                <span>Code Completeness</span>
                                                <span className={pct > 90 ? 'text-green-600' : pct > 50 ? 'text-yellow-600' : 'text-red-600'}>{pct}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ${pct > 90 ? 'bg-green-500' : pct > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                                    style={{ width: `${pct}%` }}
                                                ></div>
                                            </div>
                                            {ver.deepScan?.missing && ver.deepScan.missing.length > 0 && (
                                                <div className="mt-2 text-[9px] text-red-500 bg-red-50 p-2 rounded border border-red-100">
                                                    <strong>⚠️ Missing:</strong> {ver.deepScan.missing.slice(0, 3).join(', ')} {ver.deepScan.missing.length > 3 && `+${ver.deepScan.missing.length - 3} more`}
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4">
                                            <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                <ListChecks size={12}/> Features
                                            </div>
                                            <ul className="space-y-1.5">
                                                {ver.features && ver.features.slice(0, 3).map((feat, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                                                        <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5"/>
                                                        {feat.replace(/^[✅\-\*]\s*/, '')}
                                                    </li>
                                                ))}
                                                {ver.features && ver.features.length > 3 && (
                                                    <li className="text-[10px] text-slate-400 italic">+{ver.features.length - 3} features hidden</li>
                                                )}
                                                {(!ver.features || ver.features.length === 0) && (
                                                    <li className="text-[10px] text-slate-400 italic">No feature metadata</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {!ver.isActive && (
                                            <>
                                                <button 
                                                    onClick={() => handleRestoreVersion(ver)}
                                                    disabled={restoringVersion === ver.filename}
                                                    className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                                                >
                                                    {restoringVersion === ver.filename ? <RefreshCw size={14} className="animate-spin"/> : <RotateCcw size={14}/>} 
                                                    Restore
                                                </button>
                                                {ver.filename !== 'server.cjs' && (
                                                     <button 
                                                         onClick={() => handleRequestDelete(ver.filename)}
                                                         className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition border border-slate-200"
                                                         title="Delete Backup"
                                                     >
                                                         <Trash2 size={16}/>
                                                     </button>
                                                )}
                                            </>
                                        )}
                                        {ver.isActive && (
                                            <div className="w-full py-2 text-center text-xs font-bold text-green-700 bg-green-100/50 rounded-lg border border-green-100 cursor-default">
                                                Currently Running
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SNAPSHOTS VIEW (NEW) */}
            {mode === 'snapshots' && (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50 rounded-[2rem] border-2 border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                            <Archive size={18} className="text-orange-600"/> Full System Snapshots
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => { 
                                    setSnapshotLabel(''); 
                                    setShowSnapshotModal(true); 
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow-sm"
                            >
                                <Plus size={14} /> Create Snapshot
                            </button>
                            <button onClick={fetchSnapshots} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition border border-slate-200" title="Refresh Snapshots">
                                <RefreshCw size={16} className={isLoadingSnapshots ? 'animate-spin text-orange-600' : 'text-slate-500'}/>
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-orange-50 border-b border-orange-100">
                        <p className="text-xs text-orange-800 flex items-center gap-2">
                            <Info size={14} /> Snapshots are automatically created before every Deployment.
                        </p>
                    </div>

                    <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                        {isLoadingSnapshots ? (
                            <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-slate-400"/></div>
                        ) : snapshots.length === 0 ? (
                            <div className="py-20 text-center text-slate-400">
                                <Archive size={48} className="mx-auto mb-2 opacity-20"/>
                                <p>No snapshots found.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold text-xs uppercase">
                                        <tr>
                                            <th className="px-6 py-4">Filename</th>
                                            <th className="px-6 py-4">Created At</th>
                                            <th className="px-6 py-4">Size</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {snapshots.map((snap, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition">
                                                <td className="px-6 py-4 font-mono text-slate-700">{snap.filename}</td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={14} className="text-slate-400"/>
                                                        {new Date(snap.created).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 font-medium">{snap.size}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => triggerSnapshotRestore(snap.filename)}
                                                        disabled={isRestoringSnapshot}
                                                        className="px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-600 hover:text-white transition flex items-center gap-2 ml-auto disabled:opacity-50"
                                                    >
                                                        {isRestoringSnapshot ? <RefreshCw size={14} className="animate-spin"/> : <RotateCcw size={14}/>}
                                                        Restore
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-white/20">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black text-slate-900">Delete Backup?</h3>
                            <button onClick={() => setConfirmDelete(null)} disabled={isDeleting} className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                            Are you sure you want to PERMANENTLY delete <span className="font-mono font-bold text-red-600 bg-red-50 px-1 rounded">{confirmDelete}</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmDelete(null)} 
                                disabled={isDeleting} 
                                className="flex-1 py-3 border-2 border-slate-100 rounded-xl font-bold text-slate-500 text-xs uppercase tracking-widest hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeDelete} 
                                disabled={isDeleting} 
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 transition"
                            >
                                {isDeleting ? <RefreshCw className="animate-spin" size={14}/> : <Trash2 size={14}/>}
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE VERSION MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-[2rem]">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <FilePlus size={20} className="text-green-600"/> Create New Version
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Upload new server code as a safely versioned backup.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Filename (Must end in .cjs)</label>
                                <input 
                                    type="text" 
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-green-500 focus:outline-none"
                                    placeholder="e.g. v48.00-release.cjs"
                                    value={newVersionName}
                                    onChange={e => setNewVersionName(e.target.value)}
                                />
                                <p className="text-[10px] text-slate-400 mt-1 italic">
                                    ⚠️ Safety: Do not name it 'server.cjs'. Create a version first, then restore it.
                                </p>
                            </div>
                            <div className="flex-1 flex flex-col h-64">
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Server Code Content</label>
                                <textarea 
                                    className="flex-1 w-full bg-slate-900 text-green-400 font-mono text-xs p-4 rounded-xl border border-slate-700 focus:border-green-500 outline-none resize-none leading-relaxed custom-scrollbar"
                                    placeholder="// Paste complete server.cjs code here..."
                                    value={newVersionContent}
                                    onChange={e => setNewVersionContent(e.target.value)}
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-[2rem]">
                            <button 
                                onClick={() => setShowCreateModal(false)} 
                                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreateVersion}
                                disabled={isCreatingVersion || !newVersionName || !newVersionContent}
                                className="px-8 py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 shadow-xl flex items-center gap-2 disabled:opacity-70 transition"
                            >
                                {isCreatingVersion ? <RefreshCw size={16} className="animate-spin"/> : <Save size={16}/>}
                                Save Version
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE SNAPSHOT MODAL */}
            {showSnapshotModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-md border border-white/10 shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-[2rem]">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <Archive size={20} className="text-orange-600"/> Create Snapshot
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Backup entire project state.</p>
                            </div>
                            <button onClick={() => setShowSnapshotModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase text-slate-500 mb-1">Snapshot Label (Optional)</label>
                                <input 
                                    type="text" 
                                    className="w-full border-2 border-slate-200 rounded-xl p-3 font-mono text-sm focus:border-orange-500 focus:outline-none"
                                    placeholder="e.g. pre-major-update"
                                    value={snapshotLabel}
                                    onChange={e => setSnapshotLabel(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-[2rem]">
                            <button 
                                onClick={() => setShowSnapshotModal(false)} 
                                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleCreateSnapshot}
                                disabled={isCreatingSnapshot}
                                className="px-8 py-3 bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 shadow-xl flex items-center gap-2 disabled:opacity-70 transition"
                            >
                                {isCreatingSnapshot ? <RefreshCw size={16} className="animate-spin"/> : <Save size={16}/>}
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
