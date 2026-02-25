import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import {
  FileText, Plus, Edit3, Loader2, Check, X as XIcon, AlertCircle, Trash2,
  Eye, EyeOff, Image as ImageIcon, Calendar, Video, Type, Bold, Italic,
  List, ListOrdered, Link2, Heading, Quote, Code, Minus
} from 'lucide-react';

interface ContentArticle {
  id: string;
  title: string;
  slug?: string;
  body: string;
  content_type?: 'article' | 'image' | 'video';
  media_url?: string;
  category?: string;
  image_url?: string;
  is_published: boolean;
  author?: string;
  created_at?: string;
  updated_at?: string;
}

/* ─── Simple Rich Text Toolbar ─── */
function RichTextToolbar({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const insert = (before: string, after: string = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const replacement = before + (selected || 'teks') + after;
    ta.setRangeText(replacement, start, end, 'select');
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const tools = [
    { icon: Bold, label: 'Bold', action: () => insert('**', '**') },
    { icon: Italic, label: 'Italic', action: () => insert('*', '*') },
    { icon: Heading, label: 'Heading', action: () => insert('\n## ', '\n') },
    { icon: Quote, label: 'Quote', action: () => insert('\n> ', '\n') },
    { icon: Code, label: 'Code', action: () => insert('`', '`') },
    { icon: List, label: 'Bullet List', action: () => insert('\n- ', '') },
    { icon: ListOrdered, label: 'Numbered List', action: () => insert('\n1. ', '') },
    { icon: Link2, label: 'Link', action: () => insert('[', '](url)') },
    { icon: Minus, label: 'Divider', action: () => insert('\n---\n', '') },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-2 bg-slate-100 border-b-2 border-slate-200 rounded-t-xl">
      {tools.map(t => (
        <button
          key={t.label}
          type="button"
          onClick={t.action}
          title={t.label}
          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-lg transition"
        >
          <t.icon size={14} />
        </button>
      ))}
    </div>
  );
}

/* ─── Content Type Icon ─── */
function ContentTypeIcon({ type }: { type?: string }) {
  if (type === 'video') return <Video size={14} className="text-rose-500" />;
  if (type === 'image') return <ImageIcon size={14} className="text-blue-500" />;
  return <Type size={14} className="text-slate-500" />;
}

export default function SalesContent() {
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ContentArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formContentType, setFormContentType] = useState<'article' | 'image' | 'video'>('article');
  const [formMediaUrl, setFormMediaUrl] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadArticles = useCallback(async () => {
    try {
      const data = await api.get('/sales/content');
      const raw = data.articles || data.content || data || [];
      setArticles(Array.isArray(raw) ? raw : []);
    } catch (e) {
      console.warn('[SalesContent] Load error', e);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  const openCreate = () => {
    setEditing(null);
    setFormTitle(''); setFormBody(''); setFormCategory(''); setFormImageUrl('');
    setFormIsPublished(true); setFormContentType('article'); setFormMediaUrl('');
    setModalError(''); setShowModal(true);
  };

  const openEdit = (a: ContentArticle) => {
    setEditing(a);
    setFormTitle(a.title); setFormBody(a.body); setFormCategory(a.category || '');
    setFormImageUrl(a.image_url || ''); setFormIsPublished(a.is_published);
    setFormContentType((a.content_type as any) || 'article');
    setFormMediaUrl(a.media_url || '');
    setModalError(''); setShowModal(true);
  };

  const handleSave = useCallback(async () => {
    if (!formTitle.trim()) { setModalError('Judul wajib diisi.'); return; }
    if (!formBody.trim()) { setModalError('Konten wajib diisi.'); return; }
    if ((formContentType === 'video' || formContentType === 'image') && !formMediaUrl.trim()) {
      setModalError(`URL media wajib diisi untuk tipe ${formContentType}.`);
      return;
    }
    setSaving(true); setModalError('');

    const payload = {
      title: formTitle.trim(),
      body: formBody.trim(),
      category: formCategory.trim() || 'general',
      image_url: formImageUrl.trim(),
      is_published: formIsPublished,
      content_type: formContentType,
      media_url: formMediaUrl.trim() || undefined,
    };

    try {
      if (editing) {
        await api.put(`/sales/content/${editing.id}`, payload);
      } else {
        await api.post('/sales/content', payload);
      }
      await loadArticles();
      setShowModal(false);
      showToast(editing ? 'Konten berhasil diperbarui.' : 'Konten berhasil dibuat.', 'success');
    } catch (e: any) {
      setModalError(e.message || 'Gagal menyimpan konten.');
    } finally {
      setSaving(false);
    }
  }, [editing, formTitle, formBody, formCategory, formImageUrl, formIsPublished, formContentType, formMediaUrl, loadArticles]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Hapus konten ini?')) return;
    try {
      await api.delete(`/sales/content/${id}`);
      await loadArticles();
      showToast('Konten dihapus.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Gagal menghapus konten.', 'error');
    }
  }, [loadArticles]);

  const togglePublish = useCallback(async (a: ContentArticle) => {
    try {
      await api.put(`/sales/content/${a.id}`, { is_published: !a.is_published });
      await loadArticles();
      showToast(a.is_published ? 'Konten di-draft.' : 'Konten dipublish.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Gagal mengubah status.', 'error');
    }
  }, [loadArticles]);

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Content CMS</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Kelola artikel, gambar, dan video untuk halaman publik /blog.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-200/50 active:scale-95 transform"
        >
          <Plus size={16} /> Konten Baru
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        {(() => {
          const safeArticles = Array.isArray(articles) ? articles : [];
          return [
            { label: 'Total Konten', value: safeArticles.length, color: 'bg-slate-100 text-slate-700' },
            { label: 'Published', value: safeArticles.filter(a => a.is_published).length, color: 'bg-green-50 text-green-700' },
            { label: 'Draft', value: safeArticles.filter(a => !a.is_published).length, color: 'bg-amber-50 text-amber-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-2xl px-5 py-4 text-center`}>
              <p className="text-2xl font-black">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{s.label}</p>
            </div>
          ));
        })()}
      </div>

      {/* Article Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Array.isArray(articles) ? articles : []).map(a => (
          <div key={a.id} className={`bg-white border-2 rounded-2xl overflow-hidden transition-all hover:shadow-lg ${a.is_published ? 'border-slate-100' : 'border-slate-100 opacity-60'}`}>
            {(a.image_url || (a.content_type === 'image' && a.media_url)) && (
              <div className="h-40 bg-slate-100 overflow-hidden relative">
                <img src={a.image_url || a.media_url} alt={a.title} className="w-full h-full object-cover" />
                {a.content_type && a.content_type !== 'article' && (
                  <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                    a.content_type === 'video' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                  }`}>
                    {a.content_type}
                  </span>
                )}
              </div>
            )}
            {a.content_type === 'video' && a.media_url && !a.image_url && (
              <div className="h-40 bg-slate-900 flex items-center justify-center relative">
                <Video size={40} className="text-white/30" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-rose-500 text-white">Video</span>
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 text-sm truncate">{a.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {a.category && (
                      <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                        {a.category}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <ContentTypeIcon type={a.content_type} />
                      {a.content_type || 'article'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button onClick={() => togglePublish(a)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title={a.is_published ? 'Unpublish' : 'Publish'}>
                    {a.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 line-clamp-3 mb-3">{a.body}</p>
              <div className="flex items-center justify-between text-[10px]">
                <span className={`flex items-center gap-1 font-bold ${a.is_published ? 'text-green-600' : 'text-slate-400'}`}>
                  {a.is_published ? <Eye size={10} /> : <EyeOff size={10} />}
                  {a.is_published ? 'Published' : 'Draft'}
                </span>
                {a.created_at && (
                  <span className="text-slate-400 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(a.created_at).toLocaleDateString('id-ID')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold text-sm">Belum ada konten. Klik "Konten Baru" untuk memulai.</p>
          </div>
        )}
      </div>

      {/* ═══ MODAL ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">{editing ? 'Edit' : 'Buat'} Konten</p>
                <h3 className="text-lg font-black">{editing ? editing.title : 'Konten Baru'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"><XIcon size={20} /></button>
            </div>
            <div className="p-8 space-y-4 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
                  <AlertCircle size={14} />{modalError}
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Judul</label>
                <input
                  value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm font-bold"
                  placeholder="Judul konten..."
                />
              </div>

              {/* Content Type + Category Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Tipe Konten</label>
                  <select
                    value={formContentType}
                    onChange={e => setFormContentType(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold appearance-none cursor-pointer"
                  >
                    <option value="article">Article</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Kategori</label>
                  <input
                    value={formCategory} onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold"
                    placeholder="tips, promo, tutorial..."
                  />
                </div>
              </div>

              {/* Media URL (for Image/Video types) */}
              {(formContentType === 'image' || formContentType === 'video') && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                    {formContentType === 'video' ? 'Video URL (YouTube/embed)' : 'Image URL'}
                  </label>
                  <input
                    value={formMediaUrl} onChange={e => setFormMediaUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold font-mono"
                    placeholder={formContentType === 'video' ? 'https://youtube.com/embed/...' : 'https://example.com/image.jpg'}
                  />
                  {formMediaUrl && formContentType === 'image' && (
                    <div className="mt-2 h-32 rounded-xl overflow-hidden border border-slate-200">
                      <img src={formMediaUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
              )}

              {/* Thumbnail URL */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Thumbnail URL (opsional)</label>
                <input
                  value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-emerald-500 outline-none text-sm font-bold font-mono"
                  placeholder="https://..."
                />
              </div>

              {/* Rich Text Body */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Konten (Markdown)</label>
                <div className="border-2 border-slate-100 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                  <RichTextToolbar textareaRef={textareaRef} />
                  <textarea
                    ref={textareaRef}
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    rows={10}
                    className="w-full px-4 py-3 bg-slate-50 outline-none text-sm font-medium resize-none font-mono leading-relaxed"
                    placeholder="Tulis konten di sini... (mendukung Markdown: **bold**, *italic*, ## heading, dll.)"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Mendukung syntax Markdown. Gunakan toolbar di atas untuk format cepat.</p>
              </div>

              {/* Publish toggle */}
              <button
                type="button"
                onClick={() => setFormIsPublished(!formIsPublished)}
                className="flex items-center gap-2 text-sm font-bold"
              >
                {formIsPublished ? (
                  <div className="w-10 h-6 bg-emerald-500 rounded-full relative transition-colors">
                    <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" />
                  </div>
                ) : (
                  <div className="w-10 h-6 bg-slate-300 rounded-full relative transition-colors">
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" />
                  </div>
                )}
                <span className={formIsPublished ? 'text-emerald-700' : 'text-slate-400'}>
                  {formIsPublished ? 'Published' : 'Draft'}
                </span>
              </button>
            </div>
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Batal</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95 transform"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-[120] animate-fade-in-up px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
