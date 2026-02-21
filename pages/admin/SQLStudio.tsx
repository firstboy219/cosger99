
import React, { useState, useRef, useEffect } from 'react';
import { Database, Play, Trash2, AlertCircle, Code, Terminal, Sparkles, Loader2, Save, Clock, ChevronRight, FileJson, Download, Table as TableIcon, History, Search } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { getConfig } from '../../services/mockDb';

export default function SQLStudio() {
  const [sql, setSql] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [execTime, setExecTime] = useState<number>(0);

  const executeQuery = async () => {
    if (!sql.trim()) return;
    setIsExecuting(true);
    setResults([]);
    setError(null);
    const start = performance.now();

    try {
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || 'https://api.cosger.online';
      const adminId = localStorage.getItem('paydone_active_user') || 'admin';
      
      const res = await fetch(`${baseUrl}/api/admin/execute-sql`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'x-user-id': adminId,
              'x-session-token': localStorage.getItem('paydone_session_token') || ''
          },
          body: JSON.stringify({ sql })
      });

      const data = await res.json();
      
      if (!res.ok) {
          throw new Error(data.error || 'Execution failed');
      }

      // CRITICAL FIX: Prioritize data.rows as requested
      const rows = data.rows || data.records || [];
      
      if (Array.isArray(rows)) {
          setResults(rows);
      } else if (data.message) {
          // Handle non-select queries
          setResults([{ Result: 'Success', Message: data.message, AffectedRows: data.rowCount }]);
      } else {
          setResults([]);
      }

      if (!history.includes(sql)) {
          setHistory(prev => [sql, ...prev].slice(0, 20));
      }

    } catch (e: any) {
      setError(e.message);
    } finally {
      setExecTime(Math.round(performance.now() - start));
      setIsExecuting(false);
    }
  };

  const handleAiGenerate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!aiPrompt.trim()) return;
      
      setIsGeneratingAi(true);
      const config = getConfig();
      
      try {
          const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
          const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
          const prompt = `
            You are a PostgreSQL expert. Write a SQL query based on this request: "${aiPrompt}".
            The database has tables: users, debts, incomes, daily_expenses, tasks, allocations, debt_installments.
            Return ONLY the SQL query string, no markdown, no explanations.
          `;
          
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text().replace(/```sql|```/g, '').trim();
          setSql(text);
      } catch (err: any) {
          setError(`AI Error: ${err.message}`);
      } finally {
          setIsGeneratingAi(false);
      }
  };

  const downloadCSV = () => {
      if (results.length === 0) return;
      const headers = Object.keys(results[0]).join(',');
      const rows = results.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `query_result_${Date.now()}.csv`;
      a.click();
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6 font-sans">
        {/* LEFT SIDEBAR: TOOLS */}
        <div className="w-80 flex flex-col gap-6 shrink-0">
            {/* AI Assistant */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                        <Sparkles size={16} className="text-purple-600"/> AI Query Builder
                    </h3>
                </div>
                <div className="p-5">
                    <form onSubmit={handleAiGenerate} className="relative">
                        <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none resize-none h-32 transition-all placeholder:text-slate-400"
                            placeholder="Describe your query... e.g. 'Show active users with debt > 100jt'"
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                        />
                        <button 
                            type="submit" 
                            disabled={isGeneratingAi || !aiPrompt}
                            className="mt-3 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-lg shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGeneratingAi ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>}
                            Generate SQL
                        </button>
                    </form>
                </div>
            </div>

            {/* History */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                        <History size={16} className="text-slate-500"/> Query History
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {history.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 text-xs italic">No history yet.</div>
                    ) : (
                        history.map((q, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => setSql(q)}
                                className="w-full text-left p-3 hover:bg-slate-50 rounded-xl text-xs font-mono text-slate-600 truncate border border-transparent hover:border-slate-100 transition-all mb-1 group"
                            >
                                <span className="font-bold text-slate-400 mr-2 group-hover:text-brand-600">#{history.length - idx}</span>
                                {q}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* MAIN WORKBENCH */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
            
            {/* EDITOR SECTION */}
            <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl flex flex-col border-4 border-slate-800 overflow-hidden shrink-0">
                <div className="flex justify-between items-center p-4 bg-[#0f172a] border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Database size={12}/> PostgreSQL Console
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setSql('')} className="p-2 text-slate-500 hover:text-white transition"><Trash2 size={16}/></button>
                    </div>
                </div>
                
                <div className="relative h-48">
                    <textarea 
                        className="w-full h-full bg-[#0d1117] text-green-400 font-mono text-sm p-6 outline-none resize-none leading-relaxed custom-scrollbar"
                        placeholder="SELECT * FROM users LIMIT 10;"
                        value={sql}
                        onChange={e => setSql(e.target.value)}
                        spellCheck={false}
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                        <button 
                            onClick={executeQuery} 
                            disabled={isExecuting || !sql}
                            className="px-6 py-2.5 bg-brand-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-brand-500 transition shadow-lg shadow-brand-900/50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExecuting ? <Loader2 className="animate-spin" size={16}/> : <Play size={16}/>}
                            Execute
                        </button>
                    </div>
                </div>
            </div>

            {/* RESULTS SECTION */}
            <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wider">
                            <TableIcon size={16} className="text-slate-400"/> Query Results
                        </h3>
                        {results.length > 0 && (
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg border border-green-200">
                                {results.length} Rows • {execTime}ms
                            </span>
                        )}
                        {error && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-lg border border-red-200 flex items-center gap-1">
                                <AlertCircle size={10}/> Error
                            </span>
                        )}
                    </div>
                    {results.length > 0 && (
                        <button onClick={downloadCSV} className="text-xs font-bold text-slate-500 hover:text-brand-600 flex items-center gap-1 transition">
                            <Download size={14}/> CSV
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/30">
                    {error ? (
                        <div className="p-8 text-center">
                            <div className="inline-flex p-4 bg-red-50 rounded-full mb-4 border border-red-100">
                                <AlertCircle size={32} className="text-red-500"/>
                            </div>
                            <h4 className="text-red-900 font-bold mb-2">Execution Error</h4>
                            <code className="text-xs bg-red-50 text-red-600 px-3 py-2 rounded-lg font-mono block max-w-2xl mx-auto border border-red-100">{error}</code>
                        </div>
                    ) : results.length > 0 ? (
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {Object.keys(results[0]).map((key) => (
                                        <th key={key} className="p-4 font-black text-slate-600 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap bg-white">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-white transition-colors bg-slate-50/50 group">
                                        {Object.values(row).map((val: any, i) => (
                                            <td key={i} className="p-4 text-slate-600 font-mono whitespace-nowrap border-r border-transparent group-hover:border-slate-100 last:border-r-0">
                                                {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <Terminal size={64} className="mb-4 opacity-20"/>
                            <p className="font-bold text-sm uppercase tracking-widest opacity-60">Ready for Query</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}
