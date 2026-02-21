import React, { useState, useEffect, useRef } from 'react';
import { getDB, saveAgentConfig, getConfig } from '../../services/mockDb';
import { pushPartialUpdate } from '../../services/cloudSync';
import { AIAgent } from '../../types';
import { Bot, Save, BrainCircuit, RefreshCw, Terminal, CheckCircle2, MessageSquare, AlertTriangle, Wifi, WifiOff, Activity, ShieldAlert, Zap, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

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

    // Confirmation Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

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
            setConfirmConfig({
                isOpen: true,
                title: "API Key Error",
                message: "API Key bermasalah. Pergi ke halaman Settings untuk memperbarui?",
                onConfirm: () => {
                    navigate('/admin/settings');
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                }
            });
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
                <div className="lg:col-span-6 space-y-6">
                    {config ? (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{config.name}</h3>
                                    <p className="text-xs text-slate-400 font-mono">{config.id}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                                    neuroStatus === 'online' ? 'bg-green-100 text-green-700' :
                                    neuroStatus === 'offline' || neuroStatus === 'config_error' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    {neuroStatus === 'online' && <Wifi size={12}/>}
                                    {neuroStatus === 'offline' && <WifiOff size={12}/>}
                                    {neuroStatus === 'checking' && <RefreshCw size={12} className="animate-spin"/>}
                                    {neuroStatus.toUpperCase()}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model Engine</label>
                                    <select 
                                        value={config.model}
                                        onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                    >
                                        <option value="gemini-3-flash-preview">Gemini 3 Flash (Recommended)</option>
                                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Reasoning)</option>
                                        <option value="gemini-2.5-flash-latest">Gemini 2.5 Flash</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System Instruction (Prompt)</label>
                                    <textarea 
                                        value={config.systemInstruction}
                                        onChange={(e) => setConfig({ ...config, systemInstruction: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono h-48 focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
                                        placeholder="Define how this agent should behave..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Temperature ({config.temperature || 0.7})</label>
                                        <input 
                                            type="range" 
                                            min="0" max="1" step="0.1"
                                            value={config.temperature || 0.7}
                                            onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                                            className="w-full accent-brand-600"
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-400">
                                            <span>Precise</span>
                                            <span>Creative</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button 
                                    onClick={runDiagnostics}
                                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition flex items-center gap-2"
                                >
                                    <Activity size={16}/> Diagnostics
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>}
                                    Save Config
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            Select an agent to configure
                        </div>
                    )}
                </div>

                {/* 3. NEURO DIAGNOSTICS TERMINAL */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden flex flex-col h-[500px]">
                        <div className="bg-slate-800 p-3 flex items-center justify-between border-b border-slate-700">
                            <div className="flex items-center gap-2 text-slate-300 text-xs font-mono">
                                <Terminal size={14} className="text-green-400"/>
                                <span>NEURO_DIAGNOSTICS_V1</span>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                            </div>
                        </div>
                        
                        {/* Terminal Body */}
                        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 custom-scrollbar">
                            {logs.length === 0 && (
                                <div className="text-slate-600 italic">System ready. Awaiting diagnostic command...</div>
                            )}
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-2 animate-fade-in">
                                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                    <span className={`${
                                        log.type === 'error' ? 'text-red-400' :
                                        log.type === 'warning' ? 'text-yellow-400' :
                                        log.type === 'success' ? 'text-green-400' :
                                        'text-slate-300'
                                    }`}>
                                        {log.type === 'error' && '✖ '}
                                        {log.type === 'success' && '✔ '}
                                        {log.type === 'warning' && '⚠ '}
                                        {log.msg}
                                    </span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>

                        {/* Health Metric Bar */}
                        <div className="p-3 bg-slate-800/50 border-t border-slate-700">
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-bold">
                                <span>System Integrity</span>
                                <span>{healthMetric}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${
                                        healthMetric > 80 ? 'bg-green-500' :
                                        healthMetric > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${healthMetric}%` }}
                                ></div>
                            </div>
                            
                            {/* Auto Fix Button */}
                            {(neuroStatus === 'config_error' || neuroStatus === 'offline') && (
                                <button 
                                    onClick={handleAutoFix}
                                    className="mt-3 w-full py-2 bg-brand-600/20 text-brand-400 border border-brand-500/30 rounded hover:bg-brand-600/30 transition text-xs font-bold flex items-center justify-center gap-2"
                                >
                                    <Wrench size={12}/> AUTO-FIX DETECTED ISSUES
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog 
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
