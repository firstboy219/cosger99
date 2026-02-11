
import React, { useState, useEffect, useRef } from 'react';
import { 
    Terminal, Play, Database, RefreshCw, X, ChevronRight, AlertCircle, 
    CheckCircle2, HardDrive, Table as TableIcon, Info, Wrench, Wifi, WifiOff,
    Download, Copy, Trash2, Search, Zap, Code, DatabaseZap, ShieldCheck, 
    Settings, AlertTriangle, Cpu, Globe, Key
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getConfig } from '../../services/mockDb';
import { getHeaders } from '../../services/cloudSync';

interface TableInfo {
    name: string;
    columns: { name: string, type: string }[];
}

interface DiagnosticRequirement {
    id: string;
    label: string;
    status: 'fulfilled' | 'missing' | 'warning';
    description: string;
    actionLabel?: string;
    actionPath?: string;
}

export default function SQLStudio() {
    const navigate = useNavigate();
    const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 10;');
    const [results, setResults] = useState<any[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [schema, setSchema] = useState<TableInfo[]>([]);
    const [isLoadingSchema, setIsLoadingSchema] = useState(false);
    const [connStatus, setConnStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    
    // Intelligence & Diagnostics State
    const [requirements, setRequirements] = useState<DiagnosticRequirement[]>([]);
    const [systemAnalysis, setSystemAnalysis] = useState<string>('Initializing system scan...');
    const [backendMetaData, setBackendMetaData] = useState<any>(null);
    
    const resultsEndRef = useRef<HTMLDivElement>(null);

    const performSystemAnalysis = async (config: any, backendRes?: any) => {
        const reqs: DiagnosticRequirement[] = [];
        
        // 1. Backend URL Check
        const hasUrl = !!config.backendUrl;
        reqs.push({
            id: 'url',
            label: 'Backend Endpoint',
            status: hasUrl ? 'fulfilled' : 'missing',
            description: hasUrl ? `Targeting ${config.backendUrl}` : 'API URL is empty. Connection impossible.',
            actionLabel: 'Set URL',
            actionPath: '/admin/settings'
        });

        // 2. DB Connectivity (Deep Probe)
        const dbLinked = backendRes?.db_connected === true;
        reqs.push({
            id: 'db',
            label: 'PostgreSQL Link',
            status: dbLinked ? 'fulfilled' : 'missing',
            description: dbLinked ? 'Database session is active.' : 'Backend online but DB connection refused.',
            actionLabel: 'Check DB Creds',
            actionPath: '/admin/database'
        });

        // 3. AWS Environment Verification
        const isAWS = backendRes?.environment?.includes('AWS');
        reqs.push({
            id: 'env',
            label: 'Cloud Environment',
            status: isAWS ? 'fulfilled' : 'warning',
            description: isAWS ? `Running on ${backendRes.environment}` : 'Environment signature mismatch or unknown node.',
            actionLabel: 'Infrastructure'
        });

        // 4. Schema Integrity
        const tableCount = backendRes?.total_tables || 0;
        reqs.push({
            id: 'schema',
            label: 'Schema Mapping',
            status: tableCount > 0 ? 'fulfilled' : 'warning',
            description: tableCount > 0 ? `${tableCount} tables mapped in studio.` : 'No schema details received.',
            actionLabel: 'Refresh Schema'
        });

        // 5. Auth Token
        const hasToken = !!localStorage.getItem('paydone_session_token');
        reqs.push({
            id: 'auth',
            label: 'Admin Authorization',
            status: hasToken ? 'fulfilled' : 'missing',
            description: hasToken ? 'Session token active.' : 'Security token missing. Raw SQL might be rejected.',
            actionLabel: 'Re-login',
            actionPath: '/login'
        });

        setRequirements(reqs);

        // Intelligence Commentary
        if (!hasUrl) setSystemAnalysis("CRITICAL: Backend URL tidak terdeteksi. Tanpa ini, SQL Studio hanyalah editor teks kosong. Pergi ke Settings sekarang.");
        else if (!dbLinked) setSystemAnalysis("Sistem mendeteksi Backend aktif namun gagal login ke PostgreSQL. Kemungkinan password salah atau IP belum di-whitelist di AWS Lightsail.");
        else if (tableCount < 10) setSystemAnalysis("Warning: Beberapa tabel utama (users, debts, etc) mungkin belum di-migrate. Jalankan query CREATE TABLE atau refresh database sync.");
        else setSystemAnalysis("Intelligence Report: Semua requirement terpenuhi. Sistem siap menerima perintah SQL kompleks.");
    };

    const checkHealth = async () => {
        setConnStatus('checking');
        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';

        if (!baseUrl) {
            setConnStatus('offline');
            performSystemAnalysis(config);
            return;
        }

        try {
            const res = await fetch(`${baseUrl}/api/diagnostic`, { mode: 'cors' });
            if (res.ok) {
                const data = await res.json();
                setBackendMetaData(data);
                setConnStatus('online');
                
                // Map schema
                const tableData: TableInfo[] = Object.keys(data.schema || {}).map(name => ({
                    name,
                    columns: data.schema[name]
                }));
                setSchema(tableData);
                performSystemAnalysis(config, data);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (e: any) {
            setConnStatus('offline');
            performSystemAnalysis(config);
        }
    };

    useEffect(() => {
        checkHealth();
    }, []);

    const handleExecute = async () => {
        if (!sqlQuery.trim() || isExecuting) return;
        
        setIsExecuting(true);
        setError(null);
        setResults(null);

        const config = getConfig();
        const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';
        const adminId = localStorage.getItem('paydone_active_user') || 'admin';

        // SELF-HEALING: Simple Formatting Fixes
        let cleanedQuery = sqlQuery.trim();
        if (!cleanedQuery.endsWith(';')) cleanedQuery += ';';

        // SMART CHECK: Detect if table names match schema
        const queryLower = cleanedQuery.toLowerCase();
        schema.forEach(table => {
            const camelName = table.name.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            if (queryLower.includes(camelName.toLowerCase()) && !queryLower.includes(table.name)) {
                cleanedQuery = cleanedQuery.replace(new RegExp(camelName, 'gi'), table.name);
            }
        });

        try {
            const res = await fetch(`${baseUrl}/api/admin/execute-sql`, {
                method: 'POST',
                headers: getHeaders(adminId),
                body: JSON.stringify({ sql: cleanedQuery })
            });

            const data = await res.json();

            if (res.ok) {
                if (cleanedQuery.toLowerCase().startsWith('select')) {
                   setResults(data.records || []);
                   if (!data.records) setError("Query success, but no rows returned.");
                } else {
                   setResults([{ message: data.message || "SQL Executed Successfully" }]);
                }
            } else {
                throw new Error(data.error || "Execution Error");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsExecuting(false);
            setTimeout(() => resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] space-y-6 animate-fade-in">
            
            {/* Header Area */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 text-brand-400 rounded-2xl shadow-lg">
                        <DatabaseZap size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Internal SQL Studio <span className="text-[10px] bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Enterprise Console</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            {connStatus === 'online' ? (
                                <span className="flex items-center gap-1 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded">
                                    <Wifi size={12}/> Connection Active
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded">
                                    <WifiOff size={12}/> Link Severed
                                </span>
                            )}
                            <span className="text-xs text-slate-400 font-medium">• AWS Lightsail Infrastructure V46</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={checkHealth} className="p-2.5 bg-slate-50 border rounded-xl hover:bg-slate-100 transition" title="Refresh Connection">
                        <RefreshCw size={20} className={connStatus === 'checking' ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={handleExecute} disabled={isExecuting || connStatus !== 'online'} className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-brand-700 shadow-xl shadow-brand-100 transition transform active:scale-95 disabled:opacity-50">
                        {isExecuting ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                        Run Raw Query
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                
                {/* COLUMN 1: Schema Browser */}
                <div className="w-64 bg-white rounded-[2rem] border shadow-sm flex flex-col shrink-0 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-black text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <TableIcon size={14}/> Node Schema
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {schema.length === 0 && !isLoadingSchema && (
                            <div className="p-8 text-center text-slate-400">
                                <Info size={24} className="mx-auto mb-2 opacity-20"/>
                                <p className="text-[10px] font-bold uppercase tracking-tight">No tables found.</p>
                            </div>
                        )}
                        {schema.map(table => (
                            <div key={table.name} className="group">
                                <button 
                                    onClick={() => setSqlQuery(`SELECT * FROM ${table.name} LIMIT 10;`)}
                                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition flex items-center justify-between group"
                                >
                                    <span className="text-[11px] font-black text-slate-700 truncate uppercase tracking-wide">{table.name}</span>
                                    <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-600 transition-transform group-hover:translate-x-1"/>
                                </button>
                                <div className="hidden group-hover:block pl-6 pb-2">
                                    {table.columns.map(col => (
                                        <div key={col.name} className="flex items-center gap-2 text-[9px] text-slate-400 py-0.5">
                                            <span className="font-mono text-slate-500">{col.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* COLUMN 2: Editor & Results */}
                <div className="flex-1 flex flex-col space-y-6 min-w-0">
                    <div className="bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col shrink-0 h-72">
                        <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500/40"></div>
                                    <div className="w-2 h-2 rounded-full bg-amber-500/40"></div>
                                    <div className="w-2 h-2 rounded-full bg-green-500/40"></div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">interactive_cli.sql</span>
                            </div>
                            <button onClick={() => setSqlQuery('')} className="text-slate-500 hover:text-red-400 transition">
                                <Trash2 size={14}/>
                            </button>
                        </div>
                        <textarea 
                            className="flex-1 bg-black text-green-400 p-6 font-mono text-sm outline-none resize-none custom-scrollbar"
                            spellCheck={false}
                            value={sqlQuery}
                            onChange={(e) => setSqlQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 bg-white rounded-[2rem] border shadow-sm overflow-hidden flex flex-col min-h-0 relative">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div className="flex items-center gap-3">
                                <Terminal size={16} className="text-slate-400"/>
                                <h3 className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Query Output</h3>
                            </div>
                            {results && (
                                <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(results, null, 2)); alert("Copied!"); }} className="p-1.5 hover:bg-slate-200 rounded text-slate-500 transition">
                                    <Copy size={16}/>
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-6">
                            {error && (
                                <div className="p-5 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-4 animate-shake">
                                    <AlertCircle className="text-red-600 mt-1 shrink-0" size={20}/>
                                    <div>
                                        <h4 className="font-black text-red-800 text-xs uppercase tracking-widest">Syntax Error</h4>
                                        <p className="text-[10px] text-red-600 mt-1 font-mono">{error}</p>
                                    </div>
                                </div>
                            )}

                            {results && (
                                <div className="animate-fade-in">
                                    {results.length === 0 ? (
                                        <div className="p-10 text-center text-slate-400 italic text-sm">Execution success. Empty set returned.</div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                                            <table className="w-full text-[10px] text-left border-collapse">
                                                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest border-b">
                                                    <tr>
                                                        {Object.keys(results[0]).map(key => (
                                                            <th key={key} className="px-4 py-3 border-r last:border-r-0">{key}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y font-mono">
                                                    {results.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                            {Object.values(row).map((val: any, i) => (
                                                                <td key={i} className="px-4 py-3 border-r last:border-r-0 text-slate-600 whitespace-nowrap">
                                                                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!results && !error && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                                    <Code size={64} className="mb-4 text-slate-400"/>
                                    <p className="font-black uppercase tracking-[0.3em] text-slate-500">Standby for SQL Commands...</p>
                                </div>
                            )}
                            <div ref={resultsEndRef} />
                        </div>
                    </div>
                </div>

                {/* COLUMN 3: SYSTEM INTELLIGENCE & HEALTH (Requirement Fixer) */}
                <div className="w-80 space-y-6 flex flex-col shrink-0">
                    <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl flex-1 flex flex-col border border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-brand-600 rounded-xl"><ShieldCheck size={20}/></div>
                            <div>
                                <h3 className="font-bold text-sm">System Intelligence</h3>
                                <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Diagnostic Engine</p>
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                <p className="text-xs text-brand-300 font-bold mb-2 flex items-center gap-2">
                                    <Zap size={14}/> AI Insight
                                </p>
                                <p className="text-[11px] text-slate-300 leading-relaxed italic">
                                    "{systemAnalysis}"
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Connectivity Stack</h4>
                                {requirements.map(req => (
                                    <div key={req.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {req.status === 'fulfilled' ? <CheckCircle2 size={14} className="text-green-400"/> : req.status === 'warning' ? <AlertTriangle size={14} className="text-amber-400"/> : <X size={14} className="text-red-400"/>}
                                                <span className="text-[11px] font-bold text-slate-200">{req.label}</span>
                                            </div>
                                            {req.actionLabel && (
                                                <button 
                                                    onClick={() => req.actionPath ? navigate(req.actionPath) : checkHealth()}
                                                    className="text-[9px] font-black uppercase text-brand-400 hover:text-brand-300 underline underline-offset-4"
                                                >
                                                    {req.actionLabel}
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-normal">{req.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {backendMetaData && (
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Node Stat</p>
                                        <p className="text-lg font-black text-green-400">{backendMetaData.status || 'OFF'}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Entities</p>
                                        <p className="text-lg font-black text-blue-400">{backendMetaData.total_tables || 0}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-[2rem] border p-6 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Wrench size={14} className="text-slate-400"/> Quick Fix Ops
                        </h4>
                        <div className="space-y-2">
                            <button onClick={() => setSqlQuery("CREATE TABLE IF NOT EXISTS config (id VARCHAR(255) PRIMARY KEY, data JSONB, updated_at TIMESTAMP);")} className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-brand-300 transition group flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-600">Patch System Config Table</span>
                                <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-600"/>
                            </button>
                            <button onClick={() => setSqlQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;")} className="w-full text-left p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-brand-300 transition group flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-600">Fix Missing Schema Props</span>
                                <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-600"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
