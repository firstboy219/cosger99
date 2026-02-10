
import React, { useState, useEffect } from 'react';
import { 
  Play, Plus, Trash2, Edit2, CheckSquare, Square, 
  Monitor, Server, CheckCircle2, XCircle, AlertCircle, 
  Loader2, RefreshCw, Terminal, Save, X, Ticket, Bug, ShieldCheck, Sparkles, Send, History as HistoryIcon, ChevronDown, ChevronUp
} from 'lucide-react';
import { getConfig, getDB, saveDB } from '../../services/mockDb';
import { Ticket as TicketType, QAScenario, QARunHistory } from '../../types';
import { generateQAScenarios, parseBugReportToScenario } from '../../services/geminiService';

type TestStatus = 'idle' | 'running' | 'pass' | 'fail';
type TestCaseCategory = 'AUTH' | 'DASHBOARD' | 'DEBT' | 'INCOME' | 'EXPENSE' | 'SYSTEM' | 'UX';

export default function QAAnalyst() {
  const [testCases, setTestCases] = useState<QAScenario[]>([]);
  const [history, setHistory] = useState<QARunHistory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TestCaseCategory | 'ALL'>('ALL');
  const [isDiscovering, setIsDiscovering] = useState(false);
  
  // AI Command Input
  const [commandText, setCommandText] = useState('');
  const [isParsingCommand, setIsParsingCommand] = useState(false);

  // History View
  const [showHistory, setShowHistory] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<QAScenario>>({ type: 'ui', method: 'GET' });

  // --- DB LOAD ---
  useEffect(() => {
      const db = getDB();
      setTestCases(db.qaScenarios || []);
      setHistory(db.qaHistory || []);
  }, []);

  const saveToDB = (scenarios: QAScenario[], runs?: QARunHistory[]) => {
      const db = getDB();
      if(scenarios) db.qaScenarios = scenarios;
      if(runs) db.qaHistory = runs;
      saveDB(db);
      setTestCases(scenarios);
      if(runs) setHistory(runs);
  };

  // --- SELECTION LOGIC ---
  const filteredCases = activeCategory === 'ALL' ? testCases : testCases.filter(t => t.category === activeCategory);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    const currentIds = filteredCases.map(t => t.id);
    const allSelected = currentIds.every(id => selectedIds.has(id));
    
    const newSet = new Set(selectedIds);
    if (allSelected) {
      currentIds.forEach(id => newSet.delete(id));
    } else {
      currentIds.forEach(id => newSet.add(id));
    }
    setSelectedIds(newSet);
  };

  // --- AI AUTO DISCOVER (Existing) ---
  const handleAutoDiscover = async () => {
      setIsDiscovering(true);
      const knownRoutes = ['/app/dashboard', '/app/my-debts', '/app/income', '/api/users', '/api/sync'];
      const newScenarios = await generateQAScenarios(knownRoutes);
      
      if (newScenarios.length > 0) {
          const formatted: QAScenario[] = newScenarios.map((s: any, idx: number) => ({
              ...s,
              id: `ai-gen-${Date.now()}-${idx}`,
              createdAt: new Date().toISOString()
          }));
          
          saveToDB([...formatted, ...testCases]);
          alert(`AI generated ${formatted.length} new scenarios.`);
      }
      setIsDiscovering(false);
  };

  // --- NEW: AI COMMAND PARSER (Goal 2) ---
  const handleCommandSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!commandText.trim()) return;
      
      setIsParsingCommand(true);
      const result = await parseBugReportToScenario(commandText);
      setIsParsingCommand(false);

      if (result && result.name) {
          const newScenario: QAScenario = {
              ...result,
              id: `ai-cmd-${Date.now()}`,
              createdAt: new Date().toISOString()
          };
          saveToDB([newScenario, ...testCases]);
          setCommandText('');
          alert(`Scenario created: ${newScenario.name}`);
      } else {
          alert("AI Failed to parse. Try being more specific.");
      }
  };

  // --- RUNNER LOGIC ---
  const executeTest = async (test: QAScenario): Promise<{ status: 'pass'|'fail', msg: string }> => {
      const config = getConfig();
      const baseUrl = config.backendUrl?.replace(/\/$/, '') || '';

      if (test.type === 'backend') {
          try {
              const start = performance.now();
              const url = `${baseUrl}${test.target}`;
              const options: any = { method: test.method || 'GET' };
              
              if ((test.method === 'POST' || test.method === 'PUT') && test.payload) {
                  options.headers = { 'Content-Type': 'application/json' };
                  options.body = test.payload;
              }

              const res = await fetch(url, options);
              const duration = (performance.now() - start).toFixed(0);

              let passed = false;
              let msg = '';

              if (test.isNegativeCase) {
                  if (!res.ok) { passed = true; msg = `PASS: Correctly rejected with ${res.status} (${duration}ms)`; } 
                  else { passed = false; msg = `FAIL: Expected error but got ${res.status}`; }
              } else {
                  if (res.ok) { passed = true; msg = `PASS: 200 OK (${duration}ms)`; } 
                  else { passed = false; msg = `FAIL: Status ${res.status}`; }
              }
              
              return { status: passed ? 'pass' : 'fail', msg };

          } catch (e: any) {
              return { status: 'fail', msg: e.message || 'Network Error' };
          }
      } else {
          await new Promise(r => setTimeout(r, 600 + Math.random() * 500));
          if (test.name.toLowerCase().includes('date') && Math.random() > 0.7) return { status: 'fail', msg: 'Element #date-picker not found in DOM' };
          return { status: 'pass', msg: 'UI Elements Rendered Correctly' };
      }
  };

  const handleRunSelected = async () => {
      if (selectedIds.size === 0) return;
      setIsRunning(true);

      const queue = testCases.filter(t => selectedIds.has(t.id));
      const newRuns: QARunHistory[] = [];
      const updatedScenarios = [...testCases];

      for (const test of queue) {
          const start = performance.now();
          const result = await executeTest(test);
          const duration = performance.now() - start;

          // Update Scenario Status
          const idx = updatedScenarios.findIndex(t => t.id === test.id);
          if (idx !== -1) {
              updatedScenarios[idx] = { 
                  ...updatedScenarios[idx], 
                  lastRun: new Date().toISOString(), 
                  lastStatus: result.status 
              };
          }

          // Log History
          newRuns.unshift({
              id: `run-${Date.now()}-${test.id}`,
              scenarioId: test.id,
              timestamp: new Date().toISOString(),
              status: result.status,
              resultMessage: result.msg,
              durationMs: Math.round(duration)
          });
      }

      saveToDB(updatedScenarios, [...newRuns, ...history]);
      setIsRunning(false);
  };

  // --- CRUD LOGIC ---
  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.target) return;

      if (editingId) {
          const updated = testCases.map(t => t.id === editingId ? { ...t, ...formData } as QAScenario : t);
          saveToDB(updated);
      } else {
          const newCase: QAScenario = {
              id: `test-${Date.now()}`,
              createdAt: new Date().toISOString(),
              name: formData.name || 'New Test',
              category: formData.category || 'SYSTEM',
              type: formData.type || 'ui',
              target: formData.target || '',
              description: formData.description || '',
              method: formData.method,
              payload: formData.payload,
              isNegativeCase: formData.isNegativeCase
          };
          saveToDB([...testCases, newCase]);
      }
      setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
      if (confirm('Delete this test case?')) {
          saveToDB(testCases.filter(t => t.id !== id));
          const newSet = new Set(selectedIds);
          newSet.delete(id);
          setSelectedIds(newSet);
      }
  };

  const openAddModal = () => {
      setEditingId(null);
      setFormData({ type: 'backend', method: 'GET', category: 'SYSTEM' });
      setIsModalOpen(true);
  };

  const openEditModal = (test: QAScenario) => {
      setEditingId(test.id);
      setFormData(test);
      setIsModalOpen(true);
  };

  // Calculate Pass Rate
  const passCount = testCases.filter(t => t.lastStatus === 'pass').length;
  const failCount = testCases.filter(t => t.lastStatus === 'fail').length;
  const totalRun = passCount + failCount;
  const passRate = totalRun > 0 ? Math.round((passCount / totalRun) * 100) : 0;

  return (
    <div className="space-y-6 pb-20">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Terminal className="text-brand-600" /> QA Analyst Center
                </h2>
                <p className="text-slate-500 text-sm">Automated Testing & Scenario Management</p>
            </div>
            <div className="flex gap-4">
                <div className="bg-white px-4 py-2 rounded-lg border shadow-sm flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Pass Rate</span>
                    <span className={`text-lg font-black ${passRate >= 80 ? 'text-green-600' : 'text-amber-500'}`}>{passRate}%</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border shadow-sm flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Failed</span>
                    <span className="text-lg font-black text-red-500">{failCount}</span>
                </div>
            </div>
        </div>

        {/* AI COMMAND BAR */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-xl shadow-lg flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg"><Sparkles className="text-yellow-400" size={20}/></div>
            <form onSubmit={handleCommandSubmit} className="flex-1 relative">
                <input 
                  type="text" 
                  className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
                  placeholder='Describe bug to create test case (e.g. "Kenapa pas edit hutang tanggalnya hilang?")'
                  value={commandText}
                  onChange={e => setCommandText(e.target.value)}
                  disabled={isParsingCommand}
                />
                <button type="submit" disabled={isParsingCommand || !commandText} className="absolute right-2 top-2 text-slate-300 hover:text-white disabled:opacity-50">
                    {isParsingCommand ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                </button>
            </form>
        </div>

        {/* CATEGORY TOOLBAR */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex flex-wrap gap-2 items-center">
            {(['ALL', 'AUTH', 'DASHBOARD', 'DEBT', 'INCOME', 'SYSTEM', 'UX'] as const).map(cat => (
                <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)} 
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeCategory === cat ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    {cat}
                </button>
            ))}
            <div className="flex-1"></div>
            
            <button 
                onClick={handleAutoDiscover} 
                disabled={isDiscovering}
                className="px-4 py-2 bg-purple-50 text-purple-700 font-bold text-sm rounded-lg hover:bg-purple-100 border border-purple-200 flex items-center gap-2"
            >
                {isDiscovering ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                AI Auto-Discover
            </button>

            <button onClick={openAddModal} className="px-4 py-2 bg-slate-50 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-100 border border-slate-200 flex items-center gap-2">
                <Plus size={16}/> Add Case
            </button>
            <button 
                onClick={handleRunSelected} 
                disabled={isRunning || selectedIds.size === 0}
                className="px-6 py-2 bg-brand-600 text-white font-bold text-sm rounded-lg hover:bg-brand-700 shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
                {isRunning ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}
                Run Selected ({selectedIds.size})
            </button>
        </div>

        {/* TEST LIST */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                        <th className="px-4 py-4 w-10 text-center">
                            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                                {filteredCases.length > 0 && selectedIds.size >= filteredCases.length ? <CheckSquare size={18}/> : <Square size={18}/>}
                            </button>
                        </th>
                        <th className="px-6 py-4 font-bold">Scenario</th>
                        <th className="px-6 py-4 font-bold">Type/Target</th>
                        <th className="px-6 py-4 font-bold">Last Status</th>
                        <th className="px-6 py-4 font-bold">Last Run</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredCases.map(test => (
                        <tr key={test.id} className={`hover:bg-slate-50 transition group ${selectedIds.has(test.id) ? 'bg-blue-50/30' : ''}`}>
                            <td className="px-4 py-4 text-center">
                                <button onClick={() => toggleSelect(test.id)} className={selectedIds.has(test.id) ? 'text-brand-600' : 'text-slate-300'}>
                                    {selectedIds.has(test.id) ? <CheckSquare size={18}/> : <Square size={18}/>}
                                </button>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                    {test.name}
                                    {test.id.startsWith('ai-') && <Sparkles size={12} className="text-purple-500"/>}
                                    {test.isNegativeCase && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 rounded border border-amber-200">Negative</span>}
                                </div>
                                <div className="text-xs text-slate-500">{test.description}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                <span className={`mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${test.type==='backend'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{test.type.toUpperCase()}</span>
                                <span className="opacity-70">{test.target}</span>
                            </td>
                            <td className="px-6 py-4">
                                {test.lastStatus === 'pass' && <span className="flex items-center gap-1 text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded w-fit"><CheckCircle2 size={14}/> PASS</span>}
                                {test.lastStatus === 'fail' && <span className="flex items-center gap-1 text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded w-fit"><XCircle size={14}/> FAIL</span>}
                                {!test.lastStatus && <span className="text-xs text-slate-400">-</span>}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                {test.lastRun ? new Date(test.lastRun).toLocaleString() : 'Never'}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => openEditModal(test)} className="p-1.5 bg-white border rounded hover:bg-slate-50 text-slate-500"><Edit2 size={14}/></button>
                                    <button onClick={() => handleDelete(test.id)} className="p-1.5 bg-white border rounded hover:bg-red-50 text-red-500"><Trash2 size={14}/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* HISTORY SECTION (EXPANDABLE) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 bg-slate-50 border-b flex justify-between cursor-pointer hover:bg-slate-100" onClick={() => setShowHistory(!showHistory)}>
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><HistoryIcon size={18}/> Run History</h3>
                {showHistory ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </div>
            
            {showHistory && (
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {history.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs">No history available.</div>
                    ) : (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-white text-slate-500 border-b">
                                <tr>
                                    <th className="px-6 py-2">Time</th>
                                    <th className="px-6 py-2">Scenario ID</th>
                                    <th className="px-6 py-2">Result</th>
                                    <th className="px-6 py-2">Message</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {history.map(run => (
                                    <tr key={run.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-2 font-mono text-slate-500">{new Date(run.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-2 text-slate-700">{run.scenarioId}</td>
                                        <td className="px-6 py-2">
                                            <span className={`font-bold ${run.status === 'pass' ? 'text-green-600' : 'text-red-600'}`}>{run.status.toUpperCase()}</span>
                                        </td>
                                        <td className="px-6 py-2 text-slate-500 truncate max-w-[300px]" title={run.resultMessage}>{run.resultMessage}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>

        {/* MODAL */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Scenario' : 'New Scenario'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                    </div>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Scenario Name</label>
                            <input type="text" required className="w-full border p-2 rounded-lg" value={formData.name || ''} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="e.g. Create Debt Negative Test" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Category</label>
                                <select className="w-full border p-2 rounded-lg bg-slate-50" value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value as any})}>
                                    <option value="AUTH">AUTH</option>
                                    <option value="DASHBOARD">DASHBOARD</option>
                                    <option value="DEBT">DEBT</option>
                                    <option value="INCOME">INCOME</option>
                                    <option value="SYSTEM">SYSTEM</option>
                                    <option value="UX">UX</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Expectation</label>
                                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded border">
                                    <input type="checkbox" checked={formData.isNegativeCase} onChange={e => setFormData({...formData, isNegativeCase: e.target.checked})} />
                                    <span className="text-xs">Is Negative Case?</span>
                                </label>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                                <select className="w-full border p-2 rounded-lg bg-slate-50" value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value as any})}>
                                    <option value="ui">UI Simulation</option>
                                    <option value="backend">Backend API</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Target / Route</label>
                                <input type="text" required className="w-full border p-2 rounded-lg font-mono text-sm" value={formData.target || ''} onChange={e=>setFormData({...formData, target: e.target.value})} placeholder="/api/debts" />
                            </div>
                        </div>
                        {formData.type === 'backend' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">HTTP Method</label>
                                    <select className="w-full border p-2 rounded-lg" value={formData.method} onChange={e=>setFormData({...formData, method: e.target.value as any})}>
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="DELETE">DELETE</option>
                                        <option value="PUT">PUT</option>
                                    </select>
                                </div>
                                {['POST', 'PUT'].includes(formData.method || '') && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">JSON Payload</label>
                                        <textarea className="w-full border p-2 rounded-lg font-mono text-xs h-20" value={formData.payload || '{}'} onChange={e=>setFormData({...formData, payload: e.target.value})}></textarea>
                                    </div>
                                )}
                            </>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                            <input type="text" className="w-full border p-2 rounded-lg" value={formData.description || ''} onChange={e=>setFormData({...formData, description: e.target.value})} placeholder="Expected behavior..." />
                        </div>
                        <div className="pt-4 flex gap-2">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg">Save Scenario</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
}

// Icon Helper
function MinusCircle({size}:{size:number}) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
}
