import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import {
  Mail, Send, Loader2, Check, AlertCircle, Users, Clock,
  CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface BlastHistory {
  id: string;
  subject: string;
  sent_to: number;
  delivered: number;
  failed: number;
  created_at: string;
  status: 'sent' | 'sending' | 'failed';
}

export default function SalesEmailBlast() {
  const [tab, setTab] = useState<'compose' | 'history'>('compose');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // Compose form
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'leads' | 'free' | 'premium' | 'idle' | 'custom'>('all');
  const [customUserIds, setCustomUserIds] = useState('');

  // History
  const [history, setHistory] = useState<BlastHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([
    { id: 'welcome', name: 'Welcome Email', subject: 'Selamat Datang di Paydone!', body: 'Hai {{name}},\n\nSelamat datang di Paydone! Mulai atur keuangan Anda hari ini.\n\nSalam,\nTim Paydone' },
    { id: 'promo', name: 'Promo Premium', subject: 'Promo Spesial Premium untuk Anda!', body: 'Hai {{name}},\n\nDapatkan akses Premium dengan diskon spesial! Gunakan kode promo: {{promo_code}}\n\nPenawaran terbatas, segera upgrade!\n\nSalam,\nTim Paydone' },
    { id: 'reactivate', name: 'Reactivation', subject: 'Kami Merindukanmu!', body: 'Hai {{name}},\n\nSudah lama kami tidak melihat Anda. Banyak fitur baru yang menanti!\n\nLogin sekarang dan nikmati update terbaru.\n\nSalam,\nTim Paydone' },
  ]);
  const [showTemplates, setShowTemplates] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get('/sales/email-blast/history');
      setHistory(data.history || data || []);
    } catch (e) {
      console.warn('[SalesEmailBlast] History load error', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  const applyTemplate = (t: EmailTemplate) => {
    setSubject(t.subject);
    setBody(t.body);
    setShowTemplates(false);
  };

  const handleSend = useCallback(async () => {
    if (!subject.trim()) { showToast('Subject wajib diisi.', 'error'); return; }
    if (!body.trim()) { showToast('Body email wajib diisi.', 'error'); return; }

    const confirmed = confirm(`Kirim email blast ke target: "${targetAudience}"?\nSubject: ${subject}`);
    if (!confirmed) return;

    setSending(true);
    try {
      const payload: any = {
        subject: subject.trim(),
        body: body.trim(),
        target: targetAudience,
      };
      if (targetAudience === 'custom' && customUserIds.trim()) {
        payload.user_ids = customUserIds.split(',').map(id => id.trim()).filter(Boolean);
      }
      const res = await api.post('/sales/email-blast', payload);
      showToast(res.message || `Email blast berhasil dikirim ke ${res.sent_count || 'N/A'} user.`, 'success');
      setSubject(''); setBody(''); setCustomUserIds('');
    } catch (e: any) {
      showToast(e.message || 'Gagal mengirim email blast.', 'error');
    } finally {
      setSending(false);
    }
  }, [subject, body, targetAudience, customUserIds]);

  const audienceOptions = [
    { value: 'all', label: 'Semua User', desc: 'Kirim ke seluruh pengguna terdaftar' },
    { value: 'leads', label: 'Leads (Newsletter)', desc: 'Kirim ke email leads dari landing page' },
    { value: 'free', label: 'User Free', desc: 'Hanya user tier gratis' },
    { value: 'premium', label: 'User Premium', desc: 'Hanya user premium aktif' },
    { value: 'idle', label: 'Idle User', desc: 'User yang sudah lama tidak login' },
    { value: 'custom', label: 'Custom', desc: 'Pilih user ID secara manual' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Email Blast</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">Kirim email massal ke pengguna.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('compose')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            tab === 'compose' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border-2 border-slate-100 text-slate-500'
          }`}
        >
          <Mail size={14} className="inline mr-2" />Compose
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            tab === 'history' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border-2 border-slate-100 text-slate-500'
          }`}
        >
          <Clock size={14} className="inline mr-2" />Riwayat
        </button>
      </div>

      {/* COMPOSE TAB */}
      {tab === 'compose' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white border-2 border-slate-100 rounded-2xl p-6 space-y-5">
              {/* Templates */}
              <div>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
                >
                  {showTemplates ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Gunakan Template
                </button>
                {showTemplates && (
                  <div className="mt-3 grid gap-2">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className="text-left px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl hover:border-emerald-200 hover:bg-emerald-50 transition"
                      >
                        <p className="text-xs font-bold text-slate-900">{t.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{t.subject}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Subject</label>
                <input
                  value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold"
                  placeholder="Subject email..."
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Body Email</label>
                <textarea
                  value={body} onChange={e => setBody(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-medium resize-none font-mono leading-relaxed"
                  placeholder={'Hai {{name}},\n\nTulis pesan email di sini...\n\nSalam,\nTim Paydone'}
                />
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">{'Gunakan {{name}}, {{email}}, {{promo_code}} sebagai variabel.'}</p>
              </div>

              {/* Custom user IDs */}
              {targetAudience === 'custom' && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">User IDs (pisahkan koma)</label>
                  <textarea
                    value={customUserIds} onChange={e => setCustomUserIds(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-mono resize-none"
                    placeholder="user_id_1, user_id_2, user_id_3"
                  />
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-700 transition transform active:scale-[0.98] shadow-xl shadow-emerald-200/50 disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Kirim Email Blast
              </button>
            </div>
          </div>

          {/* Audience Selector */}
          <div className="space-y-4">
            <div className="bg-white border-2 border-slate-100 rounded-2xl p-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Target Audience</h3>
              <div className="space-y-2">
                {audienceOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTargetAudience(opt.value as any)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      targetAudience === opt.value
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Catatan</p>
                  <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                    Email blast membutuhkan konfigurasi SMTP/mailer di backend. Pastikan sudah dikonfigurasi sebelum mengirim.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-sm">Riwayat Email Blast</h3>
            <button onClick={loadHistory} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg transition">
              <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-emerald-600" /></div>
          ) : history.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {history.map(h => (
                <div key={h.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{h.subject}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] text-slate-400">
                        {h.created_at ? new Date(h.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                      <span className="text-[10px] text-slate-400">Sent: {h.sent_to}</span>
                      <span className="text-[10px] text-green-500 font-bold">OK: {h.delivered}</span>
                      {h.failed > 0 && <span className="text-[10px] text-red-500 font-bold">Fail: {h.failed}</span>}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                    h.status === 'sent' ? 'bg-green-100 text-green-700' :
                    h.status === 'sending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400">
              <Mail size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-bold text-sm">Belum ada riwayat email blast.</p>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-[120] animate-fade-in-up px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
