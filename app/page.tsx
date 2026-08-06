'use client'

import { useState, useEffect } from 'react';
import { Search, Plus, MessageSquare, Book } from 'lucide-react';
import Link from 'next/link';

type Instruction = {
  id: string;
  title: string;
  summary: string;
  tag: string;
  createdAt: string;
  similarity?: number;
}

export default function LibraryPage() {
  const [initDataRaw, setInitDataRaw] = useState('');
  
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      setInitDataRaw(tg.initData || '');
    }
  }, []);

  const [selectedTag, setSelectedTag] = useState('all');

  const TAGS = ['all', 'vpn', 'tma', 'cs2', 'clario', 'general'];

  useEffect(() => {
    fetchInstructions();
  }, [initDataRaw, selectedTag]);

  const fetchInstructions = async () => {
    setLoading(true);
    try {
      const url = selectedTag === 'all' 
        ? '/api/instructions' 
        : `/api/instructions?tag=${encodeURIComponent(selectedTag)}`;

      const res = await fetch(url, {
        headers: { 'x-telegram-init-data': initDataRaw }
      });
      const data = await res.json();
      if (data.success) {
        setInstructions(data.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      return fetchInstructions();
    }
    
    setIsSearching(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: { 'x-telegram-init-data': initDataRaw }
      });
      const data = await res.json();
      if (data.success) {
        setInstructions(data.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="header">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Библиотека</h1>
      </div>

      <div style={{ padding: 16 }}>
        <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: 12 }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Поиск по базе..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
          <Search size={18} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
          {isSearching && query.trim() !== '' && (
            <button 
              type="button" 
              onClick={() => { setQuery(''); fetchInstructions(); setIsSearching(false); }}
              style={{ position: 'absolute', right: 12, top: 12, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
            >
              Сброс
            </button>
          )}
        </form>

        {/* Tag Filters */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4, scrollbarWidth: 'none' }}>
          {TAGS.map(tag => {
            const isActive = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => { setSelectedTag(tag); setQuery(''); setIsSearching(false); }}
                style={{
                  backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-user-message)',
                  color: isActive ? '#000' : 'var(--text-muted)',
                  border: isActive ? 'none' : '1px solid #27272a',
                  borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s ease'
                }}
              >
                {tag === 'all' ? 'Все' : tag}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>Загрузка...</div>
        ) : instructions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            Ничего не найдено
          </div>
        ) : (
          <div>
            {instructions.map(inst => (
              <Link 
                key={inst.id} 
                href={`/instruction/${inst.id}`} 
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="zinc-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{inst.title}</h3>
                    <span className="zinc-tag">{inst.tag}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {inst.summary || 'Нажмите, чтобы прочитать полностью...'}
                  </p>
                  {inst.similarity !== undefined && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>
                      Совпадение: {(inst.similarity * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <Link href="/upload" style={{
        position: 'fixed',
        bottom: 80,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'var(--accent)',
        color: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(255, 124, 59, 0.4)',
        zIndex: 20
      }}>
        <Plus size={24} />
      </Link>

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'var(--bg-main)',
        borderTop: '1px solid #27272a',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 10
      }}>
        <a href="/" style={{ color: 'var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
          <Book size={24} />
          <span style={{ fontSize: 10, marginTop: 4, fontWeight: 500 }}>База</span>
        </a>
        <a href="/chat" style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
          <MessageSquare size={24} />
          <span style={{ fontSize: 10, marginTop: 4 }}>Чат ИИ</span>
        </a>
      </div>
    </div>
  );
}
