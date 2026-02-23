import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, ArrowLeft, Calendar, Tag, User, Video, Image as ImageIcon,
  FileText, Loader2, Search, ArrowRight, BookOpen, Eye
} from 'lucide-react';
import { getConfig } from '../services/mockDb';
import { api } from '../services/api';

interface BlogPost {
  id: string;
  title: string;
  body: string;
  content_type?: 'article' | 'image' | 'video';
  media_url?: string;
  category?: string;
  image_url?: string;
  author?: string;
  created_at?: string;
}

/* ─── Simple Markdown to HTML ─── */
function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-slate-900 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-slate-900 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-slate-900 mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-brand-300 pl-4 py-1 text-slate-500 italic my-2">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="my-6 border-slate-200">')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-slate-600">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-600">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-brand-600 underline hover:text-brand-700" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>');
  return html;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const config = getConfig();
  const appName = config.appName || 'Paydone.id';
  const appLogo = config.appLogoUrl;

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const data = await api.get('/public/content');
        const all = data.articles || data.content || data || [];
        setPosts(all.filter((p: any) => p.is_published !== false));
      } catch (e) {
        console.warn('[BlogPage] Load error, trying fallback', e);
        try {
          const data2 = await api.get('/sales/content');
          const all2 = data2.articles || data2.content || data2 || [];
          setPosts(all2.filter((p: any) => p.is_published));
        } catch {
          setPosts([]);
        }
      } finally {
        setLoading(false);
      }
    };
    loadPosts();
  }, []);

  const categories = ['all', ...Array.from(new Set(posts.map(p => p.category || 'general').filter(Boolean)))];

  const filtered = posts.filter(p => {
    const matchSearch = !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()) || p.body.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || (p.category || 'general') === filterCategory;
    return matchSearch && matchCat;
  });

  if (selectedPost) {
    return (
      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/blog" onClick={(e) => { e.preventDefault(); setSelectedPost(null); }} className="flex items-center gap-2 text-slate-600 hover:text-brand-600 transition text-sm font-bold">
              <ArrowLeft size={16} /> Kembali ke Blog
            </Link>
            <Link to="/" className="flex items-center gap-2">
              {appLogo ? <img src={appLogo} alt="Logo" className="w-7 h-7 object-contain" /> : <Wallet size={20} className="text-brand-600" />}
              <span className="font-bold text-sm text-slate-900">{appName}</span>
            </Link>
          </div>
        </nav>

        {/* Article */}
        <article className="max-w-4xl mx-auto px-6 py-12">
          {/* Hero Image */}
          {(selectedPost.image_url || (selectedPost.content_type === 'image' && selectedPost.media_url)) && (
            <div className="rounded-2xl overflow-hidden mb-8 shadow-xl border border-slate-100">
              <img src={selectedPost.image_url || selectedPost.media_url} alt={selectedPost.title} className="w-full max-h-[500px] object-cover" />
            </div>
          )}

          {/* Video Embed */}
          {selectedPost.content_type === 'video' && selectedPost.media_url && (
            <div className="rounded-2xl overflow-hidden mb-8 shadow-xl border border-slate-100 aspect-video">
              <iframe
                src={selectedPost.media_url}
                title={selectedPost.title}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {selectedPost.content_type && selectedPost.content_type !== 'article' && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                selectedPost.content_type === 'video' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {selectedPost.content_type === 'video' ? <Video size={12} /> : <ImageIcon size={12} />}
                {selectedPost.content_type}
              </span>
            )}
            {selectedPost.category && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold uppercase">
                <Tag size={12} />{selectedPost.category}
              </span>
            )}
            {selectedPost.created_at && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <Calendar size={12} />{new Date(selectedPost.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
            {selectedPost.author && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <User size={12} />{selectedPost.author}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-8 leading-tight text-balance">{selectedPost.title}</h1>
          <div
            className="prose prose-slate prose-sm md:prose-base max-w-none leading-relaxed text-slate-600"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedPost.body) }}
          />

          {/* Bottom CTA */}
          <div className="mt-16 pt-8 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 mb-4">Ingin mengelola keuangan lebih baik?</p>
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition shadow-lg">
              Daftar Gratis Sekarang <ArrowRight size={16} />
            </Link>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {appLogo ? <img src={appLogo} alt="Logo" className="w-8 h-8 object-contain" /> : <Wallet size={22} className="text-brand-600" />}
            <span className="font-black text-lg text-slate-900">{appName}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-lg transition">Masuk</Link>
            <Link to="/register" className="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition shadow-lg shadow-brand-600/20">Daftar</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-white border-b border-slate-200 py-16 md:py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-14 h-14 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BookOpen size={28} />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 text-balance">Blog & Insights</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            Tips keuangan, strategi pelunasan hutang, dan panduan mengelola uang dari tim {appName}.
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto mt-8">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari artikel..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none text-sm font-medium transition"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  filterCategory === cat
                    ? 'bg-brand-600 text-white shadow-lg'
                    : 'bg-white border border-slate-200 text-slate-500 hover:border-brand-300'
                }`}
              >
                {cat === 'all' ? 'Semua' : cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Posts */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-brand-600" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((post, i) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                {/* Thumbnail */}
                <div className="h-48 bg-slate-100 overflow-hidden relative">
                  {(post.image_url || (post.content_type === 'image' && post.media_url)) ? (
                    <img src={post.image_url || post.media_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : post.content_type === 'video' ? (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                      <Video size={40} className="text-white/30" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
                      <FileText size={40} className="text-brand-300" />
                    </div>
                  )}
                  {post.content_type && post.content_type !== 'article' && (
                    <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                      post.content_type === 'video' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                      {post.content_type}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    {post.category && (
                      <span className="px-2.5 py-0.5 bg-brand-50 text-brand-600 text-[10px] font-bold uppercase rounded-md tracking-wider">
                        {post.category}
                      </span>
                    )}
                    {post.created_at && (
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(post.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-brand-600 transition">{post.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{post.body.replace(/[*#>`\-\[\]()]/g, '').slice(0, 200)}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-brand-600 opacity-0 group-hover:opacity-100 transition">
                    Baca selengkapnya <ArrowRight size={12} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <FileText size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="font-bold text-slate-400">Belum ada artikel yang tersedia.</p>
            <p className="text-sm text-slate-400 mt-1">Silakan kembali lagi nanti.</p>
          </div>
        )}
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-6 bg-white border-t border-slate-200">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-black text-slate-900 mb-3">Siap Mengelola Keuangan?</h2>
          <p className="text-sm text-slate-500 mb-6">Daftar gratis dan mulai perjalanan bebas hutang Anda hari ini.</p>
          <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl transition shadow-lg">
            Daftar Gratis <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
