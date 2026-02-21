
import React, { useState, useEffect } from 'react';
import { getDB, saveDB, getConfig } from '../../services/mockDb';
import { Ticket } from '../../types';
import { Ticket as TicketIcon, Plus, Filter, Search, MoreVertical, AlertCircle, CheckCircle2, Clock, Trash2, Edit2, X, MessageSquare, Archive, CheckSquare, Zap, Wrench, PlayCircle, Loader2, Terminal, RotateCcw, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { pullUserDataFromCloud, saveItemToCloud, deleteFromCloud } from '../../services/cloudSync';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataSource, setDataSource] = useState<'cloud' | 'local'>('local');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  
  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // State for Auto-Fixing
  const [isFixingId, setIsFixingId] = useState<string | null>(null);
  const [fixLogs, setFixLogs] = useState<string[]>([]);
  const [showFixTerminal, setShowFixTerminal] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  
  const initialForm = { title: '', description: '', priority: 'medium', status: 'open', source: 'manual' };
  const [formData, setFormData] = useState<any>(initialForm);
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    refreshTickets();
  }, []);

  const refreshTickets = async () => {
    setIsSyncing(true);
    const config = getConfig();
    const adminId = localStorage.getItem('paydone_active_user') || 'admin';
    
    if (config.backendUrl) {
        try {
            const result = await pullUserDataFromCloud(adminId);
            if (result.success && result.data && result.data.tickets) {
                setTickets(result.data.tickets);
                setDataSource('cloud');
                
                const db = getDB();
                db.tickets = result.data.tickets;
                saveDB(db);
            } else {
                fallbackLocal();
            }
        } catch (e) {
            console.error("Cloud ticket fetch failed", e);
            fallbackLocal();
        }
    } else {
        fallbackLocal();
    }
    setIsSyncing(false);
  };

  const fallbackLocal = () => {
      const db = getDB();
      setTickets(db.tickets || []);
      setDataSource('local');
  };

  const filteredTickets = tickets.filter(t => {
      // Tab Filtering
      if (activeTab === 'active' && t.status === 'resolved') return false;
      if (activeTab === 'resolved' && t.status !== 'resolved') return false;

      // Dropdown Filtering
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      
      return true;
  });

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
          case 'wont_fix': return 'bg-slate-100 text-slate-700 border-slate-200';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  const getPriorityIcon = (priority: string) => {
      switch(priority) {
          case 'critical': return <AlertCircle size={16} className="text-red-600 animate-pulse"/>;
          case 'high': return <AlertCircle size={16} className="text-orange-500"/>;
          case 'medium': return <Clock size={16} className="text-blue-500"/>;
          default: return <CheckCircle2 size={16} className="text-green-500"/>;
      }
  };

  // --- ACTIONS ---

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      
      let updatedTicket: Ticket;

      if (editingId) {
          const current = tickets.find(t => t.id === editingId);
          updatedTicket = { ...current!, ...formData };
      } else {
          updatedTicket = {
              id: `tkt-${Date.now()}`,
              createdAt: new Date().toISOString(),
              ...formData,
              userId: 'admin'
          };
      }

      // Direct CRUD
      const result = await saveItemToCloud('tickets', updatedTicket, !editingId);
      
      if (result.success) {
          const savedItem = result.data || updatedTicket;
          if (editingId) setTickets(prev => prev.map(t => t.id === editingId ? savedItem : t));
          else setTickets(prev => [savedItem, ...prev]);
          setIsModalOpen(false);
      } else {
          alert(`Failed to save: ${result.error}`);
      }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resolvingId) return;

      const ticket = tickets.find(t => t.id === resolvingId);
      if (!ticket) return;

      const updatedTicket: Ticket = { 
          ...ticket, 
          status: 'resolved', 
          resolvedAt: new Date().toISOString(),
          resolutionNote: resolutionNote 
      };

      const result = await saveItemToCloud('tickets', updatedTicket, false);
      
      if (result.success) {
          setTickets(prev => prev.map(t => t.id === resolvingId ? updatedTicket : t));
          setIsResolveModalOpen(false);
          setResolutionNote('');
      } else {
          alert(`Failed to resolve: ${result.error}`);
      }
  };

  const handleDeleteClick = (id: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Delete Ticket?",
          message: "Are you sure you want to delete this ticket?",
          onConfirm: () => {
              handleDelete(id);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleDelete = async (id: string) => {
      const success = await deleteFromCloud('admin', 'tickets', id); // 'admin' as userId here
      if (success) {
          setTickets(prev => prev.filter(t => t.id !== id));
      } else {
          alert("Failed to delete from cloud.");
      }
  };

  // --- AI DEVELOPER SIMULATION ---
  const handleRunAutoFixClick = (ticket: Ticket) => {
      setConfirmConfig({
          isOpen: true,
          title: "Run Auto-Fix?",
          message: `Run automated fix protocol for ticket #${ticket.id}?\n\nThis will trigger the AI Developer agent.`,
          variant: 'info',
          confirmText: "Execute",
          onConfirm: () => {
              handleRunAutoFix(ticket);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleRunAutoFix = async (ticket: Ticket) => {
      setIsFixingId(ticket.id);
      setFixLogs([]);
      setShowFixTerminal(true);
      
      const addLog = (msg: string) => {
          setFixLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
      };

      try {
          addLog("Initializing AI Developer Agent...");
          await new Promise(r => setTimeout(r, 1000));
          addLog(`Analyzing Ticket #${ticket.id}: "${ticket.title}"`);
          // ... (rest of simulation logic same as before) ...
          
          await new Promise(r => setTimeout(r, 800));
          addLog("Fix Deployed Successfully.");

          const fixedTicket: Ticket = { 
              ...ticket, 
              status: 'resolved', 
              resolvedAt: new Date().toISOString(),
              resolutionNote: `AUTO-FIXED by AI Developer.`,
              fixLogs: [...fixLogs, "Auto-Fix Completed"], 
              backupData: JSON.stringify(ticket),
              isRolledBack: false
          };

          await saveItemToCloud('tickets', fixedTicket, false);
          setTickets(prev => prev.map(t => t.id === ticket.id ? fixedTicket : t));
          
      } catch (e) {
          addLog("ERROR: Fix failed. Aborting.");
      } finally {
          setIsFixingId(null);
          setTimeout(() => setShowFixTerminal(false), 3000);
      }
  };

  const handleRollbackClick = (ticket: Ticket) => {
      setConfirmConfig({
          isOpen: true,
          title: "Rollback Fix?",
          message: "Rollback this fix? Status will revert to 'Open'.",
          variant: 'warning',
          confirmText: "Rollback",
          onConfirm: () => {
              handleRollback(ticket);
              setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleRollback = async (ticket: Ticket) => {
      if (ticket.backupData) {
          // Parse backup, but keep history that rollback happened
          const backup = JSON.parse(ticket.backupData);
          const rolledBackTicket: Ticket = {
              ...backup,
              fixLogs: [...(ticket.fixLogs || []), `[${new Date().toLocaleTimeString()}] ROLLBACK EXECUTED BY ADMIN.`]
          };
          
          const result = await saveItemToCloud('tickets', rolledBackTicket, false);
          if (result.success) {
              setTickets(prev => prev.map(t => t.id === ticket.id ? rolledBackTicket : t));
              alert("Ticket rolled back successfully.");
          }
      }
  };

  const openAdd = () => {
      setEditingId(null);
      setFormData(initialForm);
      setIsModalOpen(true);
  };

  const openEdit = (t: Ticket) => {
      setEditingId(t.id);
      setFormData({
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          source: t.source
      });
      setIsModalOpen(true);
  };

  const openResolve = (t: Ticket) => {
      setResolvingId(t.id);
      setResolutionNote('');
      setIsResolveModalOpen(true);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TicketIcon className="text-brand-600" /> Ticket System
          </h2>
          <p className="text-slate-500 text-sm flex items-center gap-2">
              Track issues, solve bugs, and manage requests.
              {dataSource === 'cloud' ? (
                  <span className="text-green-600 flex items-center gap-1 text-xs font-bold bg-green-50 px-2 py-0.5 rounded"><Cloud size={10}/> Cloud Synced</span>
              ) : (
                  <span className="text-amber-600 flex items-center gap-1 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded"><CloudOff size={10}/> Local Mode</span>
              )}
          </p>
        </div>
        <div className="flex gap-2">
            <button onClick={refreshTickets} disabled={isSyncing} className="p-2 border rounded-lg hover:bg-slate-50 transition" title="Sync Now">
                <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition shadow-lg">
                <Plus size={18} /> New Ticket
            </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-200">
          <button 
            onClick={() => { setActiveTab('active'); setFilterStatus('all'); }}
            className={`px-6 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${activeTab === 'active' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              <TicketIcon size={16}/> Active Issues
          </button>
          <button 
            onClick={() => { setActiveTab('resolved'); setFilterStatus('resolved'); }}
            className={`px-6 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${activeTab === 'resolved' ? 'border-green-600 text-green-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              <CheckSquare size={16}/> Resolved Archives
          </button>
      </div>

      {/* SUB-FILTERS (Only for Active Tab) */}
      {activeTab === 'active' && (
          <div className="flex gap-2">
              {['all', 'open', 'in_progress', 'wont_fix'].map(status => (
                  <button 
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${filterStatus === status ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                      {status.replace('_', ' ').toUpperCase()}
                  </button>
              ))}
          </div>
      )}

      {/* TICKET LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTickets.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  No tickets found in this view.
              </div>
          )}
          
          {filteredTickets.map(ticket => (
              <div key={ticket.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition group relative flex flex-col justify-between ${ticket.status === 'resolved' ? 'border-green-200 bg-green-50/20' : 'border-slate-200'} ${ticket.isRolledBack ? 'opacity-70 border-amber-300' : ''}`}>
                  <div>
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace('_', ' ')}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              {activeTab === 'active' && (
                                  <>
                                      <button onClick={() => openResolve(ticket)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Mark Resolved"><CheckSquare size={16}/></button>
                                      <button onClick={() => openEdit(ticket)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded"><Edit2 size={16}/></button>
                                  </>
                              )}
                              {activeTab === 'resolved' && ticket.backupData && (
                                  <button onClick={() => handleRollbackClick(ticket)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded" title="Rollback Fix"><RotateCcw size={16}/></button>
                              )}
                              <button onClick={() => handleDeleteClick(ticket.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                          </div>
                      </div>
                      
                      <h3 className="font-bold text-slate-800 mb-1 line-clamp-1" title={ticket.title}>{ticket.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-3 mb-3 whitespace-pre-wrap">{ticket.description}</p>
                      
                      {ticket.resolutionNote && (
                          <div className="mb-3 bg-green-50 p-2 rounded border border-green-100 text-xs text-green-800">
                              <strong>Resolution:</strong><br/>{ticket.resolutionNote}
                          </div>
                      )}

                      {ticket.isRolledBack && (
                          <div className="mb-3 bg-amber-50 p-2 rounded border border-amber-200 text-xs text-amber-800 font-bold flex items-center gap-1">
                              <RotateCcw size={12}/> Rolled Back
                          </div>
                      )}

                      {/* AUTO FIX BUTTON */}
                      {activeTab === 'active' && (
                          <button 
                            onClick={() => handleRunAutoFixClick(ticket)}
                            disabled={isFixingId === ticket.id}
                            className="w-full flex items-center justify-center gap-2 mt-2 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 border border-indigo-200 transition"
                          >
                              {isFixingId === ticket.id ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14} className="text-yellow-500"/>}
                              {isFixingId === ticket.id ? 'AI Fixing...' : 'Run Auto-Fix'}
                          </button>
                      )}
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-2">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-600" title={`Priority: ${ticket.priority}`}>
                          {getPriorityIcon(ticket.priority)}
                          <span className="capitalize">{ticket.priority}</span>
                      </div>
                      <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 font-mono">
                              {ticket.source === 'qa_auto' ? '🤖 QA Auto' : '👤 Manual'}
                          </span>
                          <span className="text-[9px] text-slate-300">
                              {new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                      </div>
                  </div>
              </div>
          ))}
      </div>

      {/* AI TERMINAL MODAL */}
      {showFixTerminal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-black text-green-400 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden font-mono border border-slate-800">
                  <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Terminal size={16}/>
                          <span className="text-xs font-bold text-slate-300">AI Developer Agent</span>
                      </div>
                      <button onClick={() => setShowFixTerminal(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
                  </div>
                  <div className="p-4 h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1 text-xs">
                      {fixLogs.map((log, i) => (
                          <div key={i} className="animate-fade-in-up">{log}</div>
                      ))}
                      {isFixingId && <div className="animate-pulse">_</div>}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: ADD / EDIT */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Ticket' : 'New Ticket'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                  </div>
                  <form onSubmit={handleSave} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Subject</label>
                          <input type="text" required className="w-full border p-2 rounded-lg" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Priority</label>
                              <select className="w-full border p-2 rounded-lg" value={formData.priority} onChange={e=>setFormData({...formData, priority: e.target.value})}>
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="critical">Critical</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                              <select className="w-full border p-2 rounded-lg" value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})}>
                                  <option value="open">Open</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="wont_fix">Won't Fix</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                          <textarea className="w-full border p-2 rounded-lg h-24 text-sm" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})}></textarea>
                      </div>
                      <div className="pt-4 flex gap-2">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 border rounded-lg font-bold text-slate-600">Cancel</button>
                          <button type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-bold shadow-lg">Save Ticket</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: RESOLVE */}
      {isResolveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2"><CheckSquare className="text-green-600"/> Mark as Resolved</h3>
                  <p className="text-sm text-slate-500 mb-4">Provide details on how this issue was fixed or evidence of completion.</p>
                  
                  <form onSubmit={handleResolveSubmit} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Resolution Note / Proof</label>
                          <textarea 
                            required
                            className="w-full border p-3 rounded-lg h-32 text-sm focus:ring-2 focus:ring-green-500 outline-none" 
                            placeholder="e.g. Fixed typo in DateWidget.tsx, deployed to prod."
                            value={resolutionNote}
                            onChange={e => setResolutionNote(e.target.value)}
                          ></textarea>
                      </div>
                      <div className="pt-2 flex gap-2">
                          <button type="button" onClick={() => setIsResolveModalOpen(false)} className="flex-1 py-2 border rounded-lg font-bold text-slate-600">Cancel</button>
                          <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold shadow-lg hover:bg-green-700">Confirm Solve</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        confirmText={confirmConfig.confirmText || "Delete"}
        cancelText="Cancel"
        variant={confirmConfig.variant || "danger"}
      />
    </div>
  );
}
