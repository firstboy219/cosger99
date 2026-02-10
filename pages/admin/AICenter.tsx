
import React, { useState, useEffect, useRef } from 'react';
import { getDB, saveAgentConfig, getConfig } from '../../services/mockDb';
import { pushPartialUpdate } from '../../services/cloudSync';
import { AIAgent } from '../../types';
import { Bot, Save, BrainCircuit, RefreshCw, Terminal, CheckCircle2, MessageSquare, AlertTriangle, Wifi, WifiOff, Activity, ShieldAlert, Zap, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AGENT_LIST = [
    { id: 'dashboard_summary', label: 'Dashboard Summary' },
    { id: 'command_center', label: 'Command Center (Omni)' },
    { id: 'new_user_wizard', label: 'New User Wizard' },
    { id: 'debt_strategist', label: 'Debt Strategist' },
    { id: 'financial_freedom', label: 'Financial Freedom' },
    { id: 'qa_specialist', label: 'QA Specialist' },
    { id: 'dev_auditor', label: 'Dev Auditor' },
    { id: 'system_utility', label: 'System Utility' }
];

interface LogEntry {
    time: string;
    type: 'info' | 'success' | 'error' | 'warning';
    msg: string;
}

export default function AICenter() {
    const navigate = useNavigate();
    const [selectedAgentId, setSelectedAgentId] = useState('dashboard_summary');
    const [config, setConfig] = useState<AIAgent | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- DIAGNOSTICS STATE ---
    const [neuroStatus, setNeuroStatus] = useState<'idle' | 'checking' | 'online' | 'offline' | 'config_error'>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [healthMetric, setHealthMetric] = useState(100);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadConfig(selectedAgentId);
    }, [selectedAgentId]);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), type, msg }]);
    };

    const loadConfig = (agentId: string) => {
        setIsLoading(true);
        const db = getDB();
        const agent = db.aiAgents?.find(a => a.id === agentId);
        
        if (agent) {
            setConfig(agent);
        } else {
            setConfig({
                id: agentId,
                name: AGENT_LIST.find(a => a.id === agentId)?.label || 'Unknown Agent',
                description: 'System generated agent.',
                model: 'gemini-3-flash-preview',
                systemInstruction: 'You are a helpful financial assistant.',
                updatedAt: new Date().toISOString()
            });
        }
        setNeuroStatus('idle'); // Reset status on switch
        setLogs([]);
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!config) return;
        setIsSaving(true);
        
        // 1. Save Locally
        saveAgentConfig(config);
        
        // 2. Push to Cloud (Immediate Sync)
        try {
            const adminId = localStorage.getItem('paydone_active_user') || 'admin';
            addLog("Syncing configuration to cloud database...", 'info');
            
            const success = await pushPartialUpdate(adminId, { aiAgents: [config] });
            
            if (success) {
                addLog("Cloud Sync Successful. All clients updated.", 'success');
            } else {
                addLog("Cloud Sync Failed. Config saved locally only.", 'warning');
            }
        } catch (e) {
            addLog("Network Error during Sync.", 'error');
        }

        setTimeout(() => {
            setIsSaving(false);
        }, 500);
    };

    // --- SMART DIAGNOSTICS ENGINE ---
    const runDiagnostics = async () => {
        if (!config) return;
        setNeuroStatus('checking');
        setLogs([]);
        setHealthMetric(100);
        addLog(`Initializing diagnostic sequence for [${config.name}]...`);

        // 1. CHECK SYSTEM CONFIG (API KEY)
        addLog("Checking Neural Link (API Key)...");
        const sysConfig = getConfig();
        const backendUrl = sysConfig.backendUrl?.replace(/\/$/, '') || '';
        const apiKey = sysConfig.geminiApiKey;

        if (!apiKey) {
            setHealthMetric(0);
            setNeuroStatus('config_error');
            addLog("CRITICAL: Gemini API Key is missing in System Settings.", 'error');
            return;
        }
        addLog("API Key present. Verifying integrity...");

        // 2. CHECK BACKEND CONNECTION
        try {
            if (!backendUrl) throw new Error("Backend URL not configured");
            addLog(`Pinging Backend Node (${backendUrl})...`);
            
            const healthRes = await fetch(`${backendUrl}/api/health`);
            if (!healthRes.ok) throw new Error("Backend Unreachable");
            addLog("Backend Node: ONLINE", 'success');

        } catch (e) {
            setHealthMetric(20);
            setNeuroStatus('offline');
            addLog("Backend Connection FAILED. Check your server.", 'error');
            return;
        }

        // 3. CHECK MODEL VIABILITY (REAL PING)
        addLog(`Testing Model Compatibility: ${config.model}...`);
        try {
            const payload = {
                prompt: "Ping. Reply with 'Pong' only.",
                model: config.model,
                systemInstruction: "You are a ping bot."
            };

            // We use the proxy endpoint to test the full chain
            const aiRes = await fetch(`${backendUrl}/api/ai/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await aiRes.json();

            if (!aiRes.ok) {
                // SMART ERROR PARSING
                const errStr = JSON.stringify(data).toLowerCase();
                
                if (errStr.includes("api key") || errStr.includes("403") || errStr.includes("unauthenticated")) {
                    setNeuroStatus('config_error');
                    setHealthMetric(10);
                    addLog("AUTH ERROR: API Key ditolak oleh Google. Cek billing/validitas key.", 'error');
                } else if (errStr.includes("not found") || errStr.includes("404") || errStr.includes("supported")) {
                    setNeuroStatus('config_error');
                    setHealthMetric(40);
                    addLog(`MODEL ERROR: Model '${config.model}' tidak tersedia atau deprecated.`, 'warning');
                    addLog("Suggestion: Gunakan Auto-Fix untuk downgrade ke model stabil.", 'info');
                } else {
                    setNeuroStatus('offline');
                    setHealthMetric(30);
                    addLog(`UNKNOWN ERROR: ${data.error || 'Server Error'}`, 'error');
                }
            } else {
                // SUCCESS
                if (data.text && data.text.toLowerCase().includes("pong")) {
                    setNeuroStatus('online');
                    setHealthMetric(100);
                    addLog(`Response received: "${data.text.trim()}"`, 'success');
                    addLog("Neural Link Stable. Agent is ready.", 'success');
                } else {
                    setNeuroStatus('online'); // Technically online but dumb
                    setHealthMetric(80);
                    addLog(`Warning: Unexpected response "${data.text}". Model might be hallucinating.`, 'warning');
                }
            }

        } catch (e: any) {
            setNeuroStatus('offline');
            setHealthMetric(0);
            addLog(`Connection Dropped: ${e.message}`, 'error');
        }
    };

    // --- AUTO HEALER ---
    const handleAutoFix = () => {
        if (!config) return;
        
        // Scenario A: Model Issue -> Switch to recommended gemini-3-flash-preview
        if (logs.some(l => l.msg.includes("MODEL ERROR"))) {
            addLog("Auto-Fix: Switching to stable model 'gemini-3-flash-preview'...", 'warning');
            const newConfig = { ...config, model: 'gemini-3-flash-preview' };
            setConfig(newConfig);
            saveAgentConfig(newConfig);
            setTimeout(() => runDiagnostics(), 1000); // Re-run
            return;
        }

        // Scenario B: API Key Issue -> Redirect
        if (logs.some(l => l.msg.includes("API Key") || l.msg.includes("AUTH ERROR"))) {
            if (confirm("API Key bermasalah. Pergi ke halaman Settings untuk memperbarui?")) {
                navigate('/admin/settings');
            }
            return;
        }

        addLog("No auto-fix strategy available for this error.", 'info');
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Bot className="text-brand-600" /> AI Neural Center
                    </h2>
                    <p className="text-slate-500 text-sm">Manage agent brains and diagnose neural connections.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. AGENT SELECTOR */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-xs uppercase tracking-wider">
                        Active Agents
                    </div>
                    <div className="p-2 space-y-1">
                        {AGENT_LIST.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => setSelectedAgentId(agent.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-3 transition ${
                                    selectedAgentId === agent.id 
                                    ? 'bg-brand-50 text-brand-700 shadow-sm' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <BrainCircuit size={16} className={selectedAgentId === agent.id ? "text-brand-600" : "text-slate-400"}/>
                                {agent.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. MAIN CONFIGURATION */}
                <div className="lg:col-span-6">
                    {isLoading ? (
                        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-slate-400"/></div>
                    ) : config ? (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{config.name}</h3>
                                    <p className="text-sm text-slate-500">{config.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        className="border p-2 rounded-lg text-sm bg-slate-50 max-w-[150px]"
                                        value={config.model}
                                        onChange={(e) => setConfig({...config, model: e.target.value})}
                                    >
                                        <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                                        <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                                    </select>
                                    <button 
                                        onClick={handleSave} 
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-brand-600 text-white font-bold rounded-lg shadow-lg hover:bg-brand-700 transition flex items-center gap-2 disabled:opacity-70 text-sm"
                                    >
                                        <Save size={16}/> {isSaving ? 'Syncing...' : 'Save & Sync'}
                                    </button>
                                </div>
                            </div>

                            {/* System Instruction Editor */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <Terminal size={16} className="text-purple-600"/> System Instruction (The Prompt)
                                </label>
                                <div className="relative group">
                                    <textarea 
                                        className="w-full h-80 p-4 bg-slate-900 text-green-400 font-mono text-sm rounded-xl border border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none leading-relaxed resize-none custom-scrollbar"
                                        value={config.systemInstruction}
                                        onChange={(e) => setConfig({...config, systemInstruction: e.target.value})}
                                        spellCheck={false}
                                    />
                                    <div className="absolute top-2 right-2 text-[10px] bg-white/10 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">
                                        Markdown Supported
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <CheckCircle2 size={12} className="text-green-500"/>
                                    Instructions update in real-time on next API call.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div>Error loading config.</div>
                    )}
                </div>

                {/* 3. DIAGNOSTICS PANEL (SMART) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    
                    {/* Status Card */}
                    <div className={`rounded-xl border p-5 shadow-sm transition-all ${
                        neuroStatus === 'online' ? 'bg-green-50 border-green-200' :
                        neuroStatus === 'offline' ? 'bg-red-50 border-red-200' :
                        neuroStatus === 'config_error' ? 'bg-amber-50 border-amber-200' :
                        'bg-white border-slate-200'
                    }`}>
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                <Activity size={16}/> Health Monitor
                            </h4>
                            {neuroStatus === 'checking' ? <RefreshCw className="animate-spin text-blue-500" size={16}/> : 
                             neuroStatus === 'online' ? <Wifi className="text-green-600" size={16}/> : 
                             <WifiOff className="text-red-500" size={16}/>}
                        </div>
                        
                        <div className="relative pt-2">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-2xl font-black text-slate-800">{healthMetric}%</span>
                                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                                    neuroStatus === 'online' ? 'bg-green-200 text-green-800' : 'bg-slate-200 text-slate-600'
                                }`}>{neuroStatus.replace('_', ' ')}</span>
                            </div>
                            <div className="w-full bg-black/10 rounded-full h-1.5">
                                <div 
                                    className={`h-1.5 rounded-full transition-all duration-1000 ${
                                        healthMetric > 80 ? 'bg-green-500' : healthMetric > 40 ? 'bg-amber-500' : 'bg-red-500'
                                    }`} 
                                    style={{width: `${healthMetric}%`}}
                                ></div>
                            </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <button 
                                onClick={runDiagnostics}
                                disabled={neuroStatus === 'checking'}
                                className="flex-1 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 transition shadow-sm flex justify-center gap-1"
                            >
                                {neuroStatus === 'checking' ? '...' : 'Check'}
                            </button>
                            {(neuroStatus === 'config_error' || neuroStatus === 'offline') && (
                                <button 
                                    onClick={handleAutoFix}
                                    className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition shadow-sm flex justify-center items-center gap-1 animate-pulse"
                                >
                                    <Wrench size={12}/> Auto-Fix
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Console Log */}
                    <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-inner flex flex-col h-full min-h-[300px] overflow-hidden">
                        <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Terminal size={12}/> System Logs
                            </span>
                            {neuroStatus === 'config_error' && <ShieldAlert size={14} className="text-amber-500 animate-bounce"/>}
                        </div>
                        <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar">
                            {logs.length === 0 && <span className="text-slate-600 italic">Ready to scan...</span>}
                            {logs.map((log, i) => (
                                <div key={i} className={`flex gap-2 ${
                                    log.type === 'error' ? 'text-red-400' : 
                                    log.type === 'success' ? 'text-green-400' : 
                                    log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'
                                }`}>
                                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                    <span>{log.msg}</span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
