
import React, { useState, useEffect } from 'react';
import { getDB, DBSchema, getConfig, saveConfig, saveDB } from '../../services/mockDb';
import { saveGlobalConfigToCloud } from '../../services/cloudSync';
import { Database, Download, RefreshCw, CloudLightning, AlertTriangle, ScanLine, CheckCircle2, HardDrive, Wifi, WifiOff, Globe, Terminal, Microscope, Table as TableIcon, FileSearch, ShieldCheck, DatabaseZap, XCircle, Search, Settings, Wrench, ArrowRight, Code, LayoutList, Columns, FileCode, Server, PlusCircle } from 'lucide-react';
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
    missingColumns: string[]; // Snake_case (Missing in DB)
    
    // THE 3 VERSIONS
    localColumns: string[];      // Frontend Spec (CamelCase)
    dbColumnsCamel: string[];    // DB Actual (Converted to CamelCase)
    backendColumnsRaw: string[]; // DB Actual (SnakeCase)
}

// DEFINISI SCHEMA EKSPEKTASI FRONTEND (CAMEL CASE)
const FRONTEND_SCHEMA_REQUIREMENTS: Record<string, string[]> = {
    users: ['id', 'username', 'email', 'password', 'role', 'status', 'createdAt', 'lastLogin', 'photoUrl', 'parentUserId', 'sessionToken', 'badges', 'riskProfile', 'bigWhyUrl', 'financialFreedomTarget'],
    debts: ['id', 'userId', 'name', 'type', 'originalPrincipal', 'remainingPrincipal', 'interestRate', 'monthlyPayment', 'startDate', 'endDate', 'dueDate', 'bankName', 'interestStrategy', 'stepUpSchedule', 'totalLiability', 'remainingMonths', 'updatedAt'],
    debt_installments: ['id', 'debtId', 'userId', 'period', 'dueDate', 'amount', 'principalPart', 'interestPart', 'remainingBalance', 'status', 'notes', 'updatedAt'],
    incomes: ['id', 'userId', 'source', 'amount', 'type', 'frequency', 'dateReceived', 'notes', 'updatedAt'],
    daily_expenses: ['id', 'userId', 'date', 'title', 'amount', 'category', 'notes', 'receiptImage', 'allocationId', 'updatedAt'],
    tasks: ['id', 'userId', 'title', 'category', 'status', 'dueDate', 'context', 'updatedAt'],
    payment_records: ['id', 'debtId', 'userId', 'amount', 'paidDate', 'sourceBank', 'status', 'updatedAt'],
    sinking_funds: ['id', 'userId', 'name', 'targetAmount', 'currentAmount', 'deadline', 'icon', 'color', 'updatedAt'],
    tickets: ['id', 'userId', 'title', 'description', 'priority', 'status', 'source', 'assignedTo', 'createdAt', 'resolvedAt', 'resolutionNote', 'fixLogs', 'backupData', 'isRolledBack', 'updatedAt'],
    ai_agents: ['id', 'name', 'description', 'systemInstruction', 'model', 'temperature', 'updatedAt'],
    qa_scenarios: ['id', 'name', 'category', 'type', 'target', 'method', 'payload', 'description', 'expectedStatus', 'isNegativeCase', 'createdAt', 'lastRun', 'lastStatus', 'updatedAt'],
    ba_configurations: ['id', 'type', 'data', 'updatedAt'],
    allocations: ['id', 'userId', 'monthKey', 'name', 'amount', 'category', 'priority', 'isTransferred', 'assignedAccountId', 'isRecurring', 'updatedAt'],
    banks: ['id', 'name', 'type', 'promoRate', 'fixedYear', 'updatedAt'] // Added
};

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
  
  // Quick Fix State
  const [generatedFixSQL, setGeneratedFixSQL] = useState<string>('');

  // UTILITY: Format Converters
  const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

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
      setGeneratedFixSQL('');
      
      try {
          const baseUrl = sqlConfig.backendUrl.replace(/\/$/, '');
          
          // 1. Fetch Counts (Legacy Endpoint for now, as schema debug doesn't return counts)
          let liveCounts: any = {};
          try {
              const countRes = await fetch(`${baseUrl}/api/diagnostic?t=${Date.now()}`, { mode: 'cors' });
              if (countRes.ok) {
                  const countJson = await countRes.json();
                  liveCounts = countJson.counts || {};
              }
          } catch (e) {
              console.warn("Could not fetch counts, proceeding with schema check only.");
          }

          // 2. Fetch Schema Details (New Debug Endpoint)
          const targetUrl = `${baseUrl}/api/debug/schema`;
          
          const response = await fetch(`${targetUrl}?t=${Date.now()}`, { mode: 'cors' }); 
          if (!response.ok) throw new Error(`Endpoint ${targetUrl} mengembalikan status ${response.status}`);
          
          const responseJson = await response.json();
          const liveTables = responseJson.tables || {};
          
          const newReports: Record<string, TableReport> = {};
          
          const collections: { key: keyof DBSchema, table: string }[] = [
              { key: 'users', table: 'users' }, 
              { key: 'debts', table: 'debts' },
              { key: 'debtInstallments', table: 'debt_installments' }, 
              { key: 'incomes', table: 'incomes' },
              { key: 'dailyExpenses', table: 'daily_expenses' }, 
              { key: 'tasks', table: 'tasks' },
              { key: 'paymentRecords', table: 'payment_records' },
              { key: 'sinkingFunds', table: 'sinking_funds' },
              { key: 'tickets', table: 'tickets' },
              { key: 'aiAgents', table: 'ai_agents' },
              { key: 'qaScenarios', table: 'qa_scenarios' },
              { key: 'baConfigurations', table: 'ba_configurations' },
              { key: 'allocations', table: 'allocations' },
              { key: 'banks', table: 'banks' } // Added to audit
          ];

          collections.forEach(({ key, table }) => {
              const localRows = (dbData?.[key] as any[]) || [];
              const cloudCount = liveCounts[table] || 0;
              
              // Get Columns from New API structure
              const tableInfo = liveTables[table] || [];
              const liveColumnsRaw = tableInfo.map((c: any) => c.db_column); // SnakeCase (DB)
              const liveColumnsCamel = tableInfo.map((c: any) => c.backend_field || snakeToCamel(c.db_column)); // CamelCase (Backend Representation)
              
              // Frontend Spec
              const expectedColumnsCamel = FRONTEND_SCHEMA_REQUIREMENTS[table] || [];
              
              const missingCols: string[] = [];

              // CHECK MISSING
              expectedColumnsCamel.forEach(feCol => {
                  const dbCol = camelToSnake(feCol);
                  if (!liveColumnsRaw.includes(dbCol)) {
                      missingCols.push(dbCol); // Push snake_case because that's what DB needs
                  }
              });

              const tableReport: TableReport = { 
                  tableName: table, 
                  status: 'synced', 
                  columns: [], 
                  localCount: localRows.length, 
                  cloudCount: cloudCount,
                  missingColumns: missingCols,
                  
                  // THE 3 VERSIONS POPULATION
                  localColumns: expectedColumnsCamel,
                  dbColumnsCamel: liveColumnsCamel,
                  backendColumnsRaw: liveColumnsRaw
              };

              // Determine Status
              if (liveColumnsRaw.length === 0) {
                  tableReport.status = 'missing_table';
              } else if (missingCols.length > 0) {
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

  const getDataTypeForColumn = (col: string): string => {
      if (col === 'id') return 'VARCHAR(255) PRIMARY KEY';
      if (col.includes('amount') || col.includes('rate') || col.includes('target') || col.includes('liability') || col.includes('principal') || col.includes('payment') || col.includes('balance') || col.includes('year')) return 'NUMERIC';
      if (col.includes('is_') || col === 'deleted' || col === 'is_transferred' || col === 'is_recurring') return 'BOOLEAN';
      if (col.includes('json') || col === 'badges' || col === 'step_up_schedule' || col === 'fix_logs' || col === 'data') return 'JSONB';
      if (col.includes('date') || col.includes('_at') || col === 'last_login') return 'TIMESTAMP';
      if (col === 'description' || col === 'notes' || col === 'system_instruction' || col === 'resolution_note' || col === 'photo_url' || col === 'big_why_url') return 'TEXT';
      return 'VARCHAR(255)';
  };

  const generateFixSQL = (tableName: string, missingCols: string[], isMissingTable: boolean) => {
      let script = '';

      if (isMissingTable) {
          // Generate CREATE TABLE
          const frontendCols = FRONTEND_SCHEMA_REQUIREMENTS[tableName] || [];
          if (frontendCols.length === 0) {
              alert("No schema definition found for this table.");
              return;
          }

          const columnDefs = frontendCols.map(col => {
              const dbCol = camelToSnake(col);
              const type = getDataTypeForColumn(dbCol);
              return `    ${dbCol} ${type}`;
          }).join(',\n');

          script = `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columnDefs}\n);`;

      } else {
          // Generate ALTER TABLE
          const alters = missingCols.map(col => {
              const type = getDataTypeForColumn(col).replace(' PRIMARY KEY', ''); // Don't add PK on alter usually
              return `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col} ${type};`;
          });
          script = alters.join('\n');
      }
      
      setGeneratedFixSQL(script);
      navigator.clipboard.writeText(script);
      alert(`SQL Copied to Clipboard:\n\n${script}\n\nPaste this in SQL Studio to execute.`);
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
                            Gunakan audit untuk deteksi <strong>Schema Drift</strong>.
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
                            <ScanLine size={18} className="text-purple-600"/> Deep Schema Audit
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                              Membandingkan requirement Frontend (CamelCase) vs Schema Database riil (snake_case).
                          </p>
                      </div>
                      <button 
                        onClick={handleAuditSchema} 
                        disabled={isAuditing} 
                        className="px-6 py-3 bg-brand-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-brand-700 transition shadow-xl flex items-center gap-2"
                      >
                          {isAuditing ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                          {isAuditing ? 'Scanning...' : 'Run Audit'}
                      </button>
                  </div>

                  {isCloudAvailable && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                          <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Database size={14}/> Table Health Check</h4>
                              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 divide-y divide-slate-200/50 overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                                  {Object.keys(tableReports).map(key => {
                                      const report = tableReports[key];
                                      const isSelected = selectedProofTable === report.tableName;
                                      const hasError = report.status === 'drift' || report.status === 'missing_table';
                                      
                                      return (
                                          <button 
                                            key={key} 
                                            onClick={() => { setSelectedProofTable(report.tableName); setCloudSample(null); }}
                                            className={`w-full text-left p-5 flex items-center justify-between transition-all group ${isSelected ? 'bg-white shadow-md z-10 border-l-4 border-l-brand-600' : 'hover:bg-white'} ${hasError ? 'bg-red-50/50' : ''}`}
                                          >
                                              <div className="flex items-center gap-4">
                                                  <div className={`p-2.5 rounded-xl transition-all ${hasError ? 'bg-red-100 text-red-600' : isSelected ? 'bg-brand-600 text-white shadow-lg' : 'bg-white text-slate-400 border shadow-sm'}`}>
                                                      {hasError ? <AlertTriangle size={16}/> : <TableIcon size={16}/>}
                                                  </div>
                                                  <div>
                                                      <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide">{report.tableName}</p>
                                                      
                                                      {report.status === 'missing_table' ? (
                                                          <div className="mt-1 text-[9px] text-red-600 font-bold animate-pulse">
                                                              MISSING TABLE
                                                          </div>
                                                      ) : report.missingColumns.length > 0 ? (
                                                          <div className="mt-1 text-[9px] text-red-600 font-bold">
                                                              MISSING: {report.missingColumns.length} fields
                                                          </div>
                                                      ) : (
                                                          <div className="flex items-center gap-3 mt-1">
                                                              <span className="text-[9px] font-bold text-slate-400">LOC: {report.localCount}</span>
                                                              <span className={`text-[9px] font-bold ${report.cloudCount > 0 ? 'text-green-600' : 'text-red-500'}`}>CLOUD: {report.cloudCount}</span>
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${report.status === 'synced' ? 'bg-green-100 text-green-700' : report.status === 'missing_table' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                  {report.status === 'drift' ? 'DRIFT' : report.status.replace('_', ' ')}
                                              </div>
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>

                          <div className="flex flex-col gap-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Microscope size={14}/> Inspector & Repair</h4>
                              
                              {selectedProofTable ? (
                                  <div className="flex flex-col gap-4">
                                      
                                      {/* THE 3 VERSIONS COMPARISON */}
                                      <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-5 overflow-hidden">
                                          <h5 className="font-black text-slate-700 text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><Columns size={14}/> Schema Versioning</h5>
                                          <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                              
                                              {/* 1. LOCAL (Spec) */}
                                              <div className="bg-white rounded-xl border border-slate-200 p-3">
                                                  <div className="flex justify-between items-center mb-2">
                                                      <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Code size={10}/> Versi Lokal (Spec)</span>
                                                      <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 rounded">CamelCase</span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1">
                                                      {tableReports[selectedProofTable]?.localColumns.map(col => (
                                                          <span key={col} className="text-[9px] bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">{col}</span>
                                                      ))}
                                                  </div>
                                              </div>

                                              {/* 2. DB (Camel) */}
                                              <div className="bg-white rounded-xl border border-slate-200 p-3 relative overflow-hidden">
                                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
                                                  <div className="flex justify-between items-center mb-2">
                                                      <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Database size={10}/> Versi DB (Camel)</span>
                                                      <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-1.5 rounded">Converted</span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1">
                                                      {tableReports[selectedProofTable]?.dbColumnsCamel.map(col => (
                                                          <span key={col} className="text-[9px] bg-purple-50/50 border border-purple-100 px-1.5 py-0.5 rounded text-purple-700 font-mono">{col}</span>
                                                      ))}
                                                  </div>
                                              </div>

                                              {/* 3. BACKEND (Raw) */}
                                              <div className="bg-white rounded-xl border border-slate-200 p-3 relative overflow-hidden">
                                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900"></div>
                                                  <div className="flex justify-between items-center mb-2">
                                                      <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Server size={10}/> Versi Backend (Raw)</span>
                                                      <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 rounded">SnakeCase</span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-1">
                                                      {tableReports[selectedProofTable]?.backendColumnsRaw.map(col => (
                                                          <span key={col} className="text-[9px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-mono">{col}</span>
                                                      ))}
                                                  </div>
                                              </div>

                                          </div>
                                      </div>

                                      {/* REPAIR BUTTON (If Drift or Missing) */}
                                      {(tableReports[selectedProofTable]?.status === 'drift' || tableReports[selectedProofTable]?.status === 'missing_table') && (
                                          <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100">
                                              <div className="flex items-center gap-2 text-red-700 mb-2">
                                                  <AlertTriangle size={16}/>
                                                  <span className="text-xs font-bold uppercase">
                                                      {tableReports[selectedProofTable]?.status === 'missing_table' ? 'Table Missing in DB' : 'Schema Mismatch Detected'}
                                                  </span>
                                              </div>
                                              <button 
                                                onClick={() => generateFixSQL(selectedProofTable, tableReports[selectedProofTable].missingColumns, tableReports[selectedProofTable]?.status === 'missing_table')}
                                                className="w-full py-2 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                                              >
                                                  {tableReports[selectedProofTable]?.status === 'missing_table' ? <PlusCircle size={14}/> : <Wrench size={14}/>}
                                                  {tableReports[selectedProofTable]?.status === 'missing_table' ? 'Generate Create Table SQL' : 'Generate Fix SQL'}
                                              </button>
                                              {generatedFixSQL && <p className="text-[9px] text-center text-red-500 font-bold mt-2 animate-pulse">SQL Copied to Clipboard!</p>}
                                          </div>
                                      )}

                                      <div className="flex-1 bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-[150px]">
                                          <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                                              <span>cloud_console (~/postgresql/sample)</span>
                                              <button onClick={() => fetchPhysicalProof(selectedProofTable)} disabled={isFetchingSample} className="text-green-500 hover:text-green-400"><RefreshCw size={12}/></button>
                                          </div>
                                          <div className="flex-1 overflow-auto p-4 font-mono text-[10px] text-green-400 bg-black">
                                              {isFetchingSample ? (
                                                  <div className="h-full flex flex-col items-center justify-center animate-pulse"><Terminal size={24} className="mb-2 text-green-500/50"/><span>Scanning...</span></div>
                                              ) : cloudSample ? (
                                                  <pre>{JSON.stringify(cloudSample, null, 2)}</pre>
                                              ) : (
                                                  <div className="h-full flex flex-col items-center justify-center text-slate-700 text-center">
                                                      <FileCode size={32} className="mb-2 opacity-20 text-green-500"/>
                                                      <p className="opacity-50 tracking-widest uppercase text-[9px] text-green-500">Ready to Query</p>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 opacity-50">
                                      <ScanLine size={48} className="text-slate-300 mb-4"/>
                                      <p className="text-[11px] font-black text-slate-500 uppercase">Select table to inspect schema versions</p>
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
