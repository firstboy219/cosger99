
import React, { useState, useEffect } from 'react';
import { getDB, DBSchema, getConfig, saveConfig, saveDB } from '../../services/mockDb';
import { saveGlobalConfigToCloud } from '../../services/cloudSync';
import { Database, Download, RefreshCw, CloudLightning, AlertTriangle, ScanLine, CheckCircle2, HardDrive, Wifi, WifiOff, Globe, Terminal, Microscope, Table as TableIcon, FileSearch, ShieldCheck, DatabaseZap, XCircle, Search, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ColumnReport {
    name: string;
    expectedType: string;
    actualType: string | null;
    status: 'match' | 'missing';
}

interface TableReport {
    tableName: string;
    status: 'synced' | 'drift' | 'missing_table' | 'offline';
    columns: ColumnReport[];
    localCount: number;
    cloudCount: number;
}

export default function DatabaseManager() {
  const [dbData, setDbData] = useState<DBSchema | null>(null);
  const [sqlConfig, setSqlConfig] = useState({
    backendUrl: 'https://api.cosger.online',
    gcpSqlInstance: '',
    dbUser: '',
    dbPass: '',
    dbName: '',
    apiCaseConvention: 'snake_case'
  });
  
  const [isCloudAvailable, setIsCloudAvailable] = useState<boolean | null>(null);
  const [connStatus, setConnStatus] = useState<string>('Initializing...');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<{ message: string; type: string } | null>(null);
  const [tableReports, setTableReports] = useState<Record<string, TableReport>>({});
  const [selectedProofTable, setSelectedProofTable] = useState<string | null>(null);
  const [isFetchingSample, setIsFetchingSample] = useState(false);
  const [cloudSample, setCloudSample] = useState<any[] | null>(null);

  const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

  const refreshData = async () => {
    const data = getDB();
    setDbData(data);
    const finalConfig = data.config;
    const url = finalConfig.backendUrl || 'https://api.cosger.online';
    
    setSqlConfig({
      backendUrl: url,
      gcpSqlInstance: finalConfig.gcpSqlInstance || '',
      dbUser: finalConfig.dbUser || 'postgres',
      dbPass: finalConfig.dbPass || '',
      dbName: finalConfig.dbName || 'paydone_db',
      apiCaseConvention: finalConfig.apiCaseConvention || 'snake_case'
    });
    checkConnectivity(url);
  };

  const checkConnectivity = async (url: string) => {
      setConnStatus('Testing Handshake...');
      if (!url) { setIsCloudAvailable(false); setConnStatus('URL Missing'); return; }
      
      const baseUrl = url.replace(/\/$/, '');
      try {
          const res = await fetch(`${baseUrl}/api/health`, { 
              method: 'GET',
              mode: 'cors',
              headers: { 'Accept': 'application/json' }
          });
          
          if (res.ok) {
              setIsCloudAvailable(true);
              setConnStatus('Handshake OK (Cloud Active)');
          } else {
              setIsCloudAvailable(false);
              setConnStatus(`Server Error ${res.status}`);
          }
      } catch (e: any) {
          setIsCloudAvailable(false);
          setConnStatus(e.message === 'Failed to fetch' ? 'CORS or Connection Blocked' : e.message);
      }
  };

  useEffect(() => { refreshData(); }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveConfig(sqlConfig);
    const success = await saveGlobalConfigToCloud('app_settings', sqlConfig);
    if(success) alert("Konfigurasi Disimpan!");
    else alert("Tersimpan secara lokal. Gagal update Cloud.");
    checkConnectivity(sqlConfig.backendUrl);
  };

  const fetchPhysicalProof = async (table: string) => {
      if (!isCloudAvailable) { alert("Backend tidak terdeteksi online."); return; }
      setIsFetchingSample(true);
      setCloudSample(null);
      try {
          const baseUrl = sqlConfig.backendUrl.replace(/\/$/, '');
          // Correct API path for sample data as per server.js template
          const res = await fetch(`${baseUrl}/api/admin/raw-sample/${table}?t=${Date.now()}`);
          if (res.ok) {
              const data = await res.json();
              setCloudSample(data.records);
          } else { throw new Error("Gagal mengambil data riil."); }
      } catch (e: any) {
          alert(`Gagal: ${e.message}`);
      } finally { setIsFetchingSample(false); }
  };

  const handleAuditSchema = async () => {
      setIsAuditing(true);
      setAuditError(null);
      setTableReports({});
      
      try {
          const baseUrl = sqlConfig.backendUrl.replace(/\/$/, '');
          const targetUrl = `${baseUrl}/api/diagnostic`;
          
          const response = await fetch(`${targetUrl}?t=${Date.now()}`, { mode: 'cors' }); 
          if (!response.ok) throw new Error(`Endpoint ${targetUrl} mengembalikan status ${response.status}`);
          
          const responseJson = await response.json();
          
          // MAP DATA TO MATCH NEW BACKEND FORMAT
          // Backend returns { counts: { users: 6, ... }, schema_details: [...] }
          const liveCounts = responseJson.counts || {};
          const liveSchemaDetails = responseJson.schema_details || [];
          
          // Group schema details by table name for easy lookup
          const tableExistence = new Set(liveSchemaDetails.map((col: any) => col.table_name));

          const newReports: Record<string, TableReport> = {};
          const collections: { key: keyof DBSchema, table: string }[] = [
              { key: 'users', table: 'users' }, 
              { key: 'debts', table: 'debts' },
              { key: 'debtInstallments', table: 'debt_installments' }, 
              { key: 'incomes', table: 'incomes' },
              { key: 'dailyExpenses', table: 'daily_expenses' }, 
              { key: 'tasks', table: 'tasks' },
              { key: 'paymentRecords', table: 'payment_records' },
              { key: 'sinkingFunds', table: 'sinking_funds' }
          ];

          collections.forEach(({ key, table }) => {
              const localRows = (dbData?.[key] as any[]) || [];
              const cloudCount = liveCounts[table] || 0;
              
              const tableReport: TableReport = { 
                  tableName: table, 
                  status: 'synced', 
                  columns: [], 
                  localCount: localRows.length, 
                  cloudCount: cloudCount
              };

              if (!tableExistence.has(table)) {
                  tableReport.status = 'missing_table';
              } else if (tableReport.localCount !== tableReport.cloudCount) {
                  tableReport.status = 'drift';
              }
              
              newReports[table] = tableReport;
          });

          setTableReports(newReports);
          setIsCloudAvailable(true);
          setConnStatus('Diagnostic Sync Complete');

      } catch (e: any) {
          setAuditError({ message: e.message, type: 'network' });
          setIsCloudAvailable(false);
          setConnStatus(`Audit Failed: ${e.message}`);
      } finally { setIsAuditing(false); }
  };

  if (!dbData) return <div className="p-8 text-center text-slate-500">Loading Configuration...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
        <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <ShieldCheck className="text-brand-600" size={28}/> Cloud SQL Auditor
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">
                Node: <span className="text-brand-600 font-mono text-xs">{sqlConfig.backendUrl}</span>
            </p>
        </div>
        <div className="flex gap-2">
            <div className={`px-4 py-2 rounded-xl border flex flex-col items-end gap-1 shadow-sm transition-colors ${isCloudAvailable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-700">
                    {isCloudAvailable ? <Wifi size={14} className="text-green-600" /> : <WifiOff size={14} className="text-red-600" />}
                    {isCloudAvailable ? 'Cloud Active' : 'Disconnected'}
                </div>
                <span className="text-[9px] font-mono opacity-60">{connStatus}</span>
            </div>
            <button onClick={refreshData} className="p-2.5 bg-slate-50 border rounded-xl hover:bg-slate-100 transition"><RefreshCw size={20} className="text-slate-600" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><CloudLightning size={120}/></div>
                  <div className="flex items-center gap-3 mb-6 relative z-10">
                      <div className="p-3 bg-brand-600 rounded-2xl shadow-lg shadow-brand-500/20"><HardDrive size={24}/></div>
                      <h3 className="font-bold text-lg">Cloud Infrastructure</h3>
                  </div>
                  <div className="space-y-4 relative z-10">
                      <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                          <CheckCircle2 size={16} className="text-green-400 mt-1 shrink-0" />
                          <p className="text-xs text-slate-300 leading-relaxed">
                            Sinkronisasi aktif ke <span className="text-white font-bold">{sqlConfig.backendUrl}</span>. 
                            Gunakan audit untuk verifikasi record PostgreSQL.
                          </p>
                      </div>
                  </div>
              </div>

              <div className="bg-white rounded-[2rem] border p-8 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                      <Settings size={18} className="text-brand-600"/>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Network Config</h3>
                  </div>
                  <form onSubmit={handleSaveConfig} className="space-y-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Backend URL</label>
                          <input type="text" className="w-full border-2 border-slate-100 p-3.5 rounded-2xl font-mono text-xs focus:border-brand-500 outline-none" value={sqlConfig.backendUrl} onChange={e => setSqlConfig({...sqlConfig, backendUrl: e.target.value})} />
                      </div>
                      <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition transform active:scale-95 shadow-xl">Update Handshake</button>
                  </form>
              </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[2.5rem] border p-8 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                            <ScanLine size={18} className="text-purple-600"/> Audit Logs & Sync Proof
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">Verifikasi jumlah record riil di Cloud database.</p>
                      </div>
                      <button 
                        onClick={handleAuditSchema} 
                        disabled={isAuditing} 
                        className="px-6 py-3 bg-brand-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-brand-700 transition shadow-xl flex items-center gap-2"
                      >
                          {isAuditing ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                          {isAuditing ? 'Audit...' : 'Run Sync Audit'}
                      </button>
                  </div>

                  {isCloudAvailable && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                          <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Database size={14}/> Node Discovery</h4>
                              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 divide-y divide-slate-200/50 overflow-hidden">
                                  {(['users', 'debts', 'debtInstallments', 'incomes', 'dailyExpenses', 'tasks', 'paymentRecords', 'sinkingFunds'] as const).map(key => {
                                      const table_name = camelToSnake(key);
                                      const report = tableReports[table_name];
                                      const isSelected = selectedProofTable === table_name;
                                      return (
                                          <button 
                                            key={key} 
                                            onClick={() => { setSelectedProofTable(table_name); setCloudSample(null); }}
                                            className={`w-full text-left p-5 flex items-center justify-between transition-all group ${isSelected ? 'bg-white shadow-md z-10 border-l-4 border-l-brand-600' : 'hover:bg-white'}`}
                                          >
                                              <div className="flex items-center gap-4">
                                                  <div className={`p-2.5 rounded-xl transition-all ${isSelected ? 'bg-brand-600 text-white shadow-lg' : 'bg-white text-slate-400 border shadow-sm'}`}><TableIcon size={16}/></div>
                                                  <div>
                                                      <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide">{table_name}</p>
                                                      {report && (
                                                          <div className="flex items-center gap-3 mt-1">
                                                              <span className="text-[9px] font-bold text-slate-400">LOC: {report.localCount}</span>
                                                              <span className={`text-[9px] font-bold ${report.cloudCount > 0 ? 'text-green-600' : 'text-red-500'}`}>CLOUD: {report.cloudCount}</span>
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              {report && (
                                                  <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${report.status === 'synced' ? 'bg-green-100 text-green-700' : report.status === 'missing_table' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                      {report.status.replace('_', ' ')}
                                                  </div>
                                              )}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>

                          <div className="flex flex-col gap-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Microscope size={14}/> Physical Records Sample</h4>
                              {selectedProofTable ? (
                                  <div className="flex-1 flex flex-col gap-4">
                                      <button onClick={() => fetchPhysicalProof(selectedProofTable)} disabled={isFetchingSample} className="w-full py-4 bg-white border-2 border-brand-100 rounded-2xl text-brand-600 text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                          {isFetchingSample ? <RefreshCw className="animate-spin" size={14}/> : <FileSearch size={14}/>}
                                          Query Cloud Samples
                                      </button>
                                      <div className="flex-1 bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-[350px]">
                                          <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                                              <span>cloud_console (~/postgresql/sample)</span>
                                          </div>
                                          <div className="flex-1 overflow-auto p-6 font-mono text-[11px] text-green-400 bg-black">
                                              {isFetchingSample ? (
                                                  <div className="h-full flex flex-col items-center justify-center animate-pulse"><Terminal size={32} className="mb-4 text-green-500/50"/><span>Establishing secure tunnel...</span></div>
                                              ) : cloudSample ? (
                                                  <pre>{JSON.stringify(cloudSample, null, 2)}</pre>
                                              ) : (
                                                  <div className="h-full flex flex-col items-center justify-center text-slate-700 text-center px-10">
                                                      <DatabaseZap size={48} className="mb-4 opacity-20"/>
                                                      <p className="font-bold opacity-30 tracking-widest uppercase text-[10px]">Select entity to inspect</p>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 opacity-50">
                                      <ScanLine size={48} className="text-slate-300 mb-4"/>
                                      <p className="text-[11px] font-black text-slate-500 uppercase">Select table for live probe</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {auditError && (
                      <div className="mt-8 p-5 bg-red-50 border-2 border-red-100 rounded-3xl animate-fade-in flex items-start gap-4">
                          <XCircle className="text-red-600 mt-1" size={20}/>
                          <div>
                              <h4 className="font-black text-red-800 text-xs uppercase tracking-widest">Audit Error</h4>
                              <p className="text-[10px] text-red-600 mt-1 font-mono">{auditError.message}</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
}
