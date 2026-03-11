import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Users, Loader2, Mail, RefreshCw, Search, Calendar, TrendingUp } from 'lucide-react';

interface Lead {
  id: string;
  email: string;
  created_at?: string;
  createdAt?: string;
  source?: string;
  status?: string;
}

export default function SalesLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data: any = await api.get('/sales/leads');
      setLeads(Array.isArray(data) ? data : data?.leads || []);
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat leads');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter(l =>
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d?: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
              <Users size={20} className="text-white" />
            </div>
            Leads
          </h1>
          <p className="text-slate-500 text-sm mt-1">Email yang mendaftar dari landing page.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><TrendingUp size={20} /></div>
          <div>
            <p className="text-2xl font-black text-slate-900">{leads.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Leads</p>
          </div>
        </div>
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Calendar size={20} /></div>
          <div>
            <p className="text-2xl font-black text-slate-900">
              {leads.filter(l => {
                const d = l.createdAt || l.created_at;
                if (!d) return false;
                const then = new Date(d);
                const now = new Date();
                return (now.getTime() - then.getTime()) < 7 * 24 * 60 * 60 * 1000;
              }).length}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">7 Hari Terakhir</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-medium"
              placeholder="Cari email..." />
          </div>
          <span className="text-xs text-slate-400 font-bold">{filtered.length} lead</span>
        </div>

        {error && <div className="p-6 text-center text-red-500 text-sm">{error}</div>}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Mail size={32} className="mb-3 opacity-30" />
            <p className="font-bold">Belum ada leads</p>
            <p className="text-xs mt-1">Lead akan muncul ketika ada yang submit email di landing page</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">#</th>
                  <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Daftar</th>
                  <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sumber</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">
                          {lead.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="font-bold text-slate-800">{lead.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{formatDate(lead.createdAt || lead.created_at)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                        {lead.source || 'landing_page'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
