'use client'

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, MessageSquare, Book } from 'lucide-react';
import Link from 'next/link';
import { useTelegramInitData } from '@/lib/useTelegramInitData';

type Instruction = {
  id: string;
  title: string;
  summary: string;
  tag: string;
  createdAt: string;
  similarity?: number;
}

export default function LibraryPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();

  const [selectedTag, setSelectedTag] = useState('all');

  const TAGS = ['all', 'vpn', 'tma', 'cs2', 'clario', 'general'];

  const fetchInstructions = useCallback(async () => {
    if (!isTelegramReady) {
      return;
    }

    setLoading(true);
    setRequestError(null);
    try {
      const url = selectedTag === 'all' 
        ? '/api/instructions' 
        : `/api/instructions?tag=${encodeURIComponent(selectedTag)}`;

      const res = await fetch(url, {
        headers: authHeaders,
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setInstructions(data.data);
      } else {
        setRequestError(data.error || 'Не удалось загрузить базу.');
      }
    } catch (e) {
      console.error(e);
      setRequestError('Ошибка сети при загрузке базы.');
    }
    setLoading(false);
  }, [authHeaders, isTelegramReady, selectedTag]);

  useEffect(() => {
    if (!isTelegramReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchInstructions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchInstructions, isTelegramReady]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTelegramReady) {
      return;
    }

    if (!query.trim()) {
      return fetchInstructions();
    }
    
    setIsSearching(true);
    setLoading(true);
    setRequestError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: authHeaders,
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setInstructions(data.data);
      } else {
        setRequestError(data.error || 'Поиск временно недоступен.');
      }
    } catch (e) {
      console.error(e);
      setRequestError('Ошибка сети при поиске.');
    }
    setLoading(false);
  };

  return (
    <div className="page-shell" style={{ paddingBottom: 80 }}>
      <div className="header">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>База</h1>
      </div>

      {!isTelegramReady && !authError && (
        <div className="status-banner pending">
          <div className="pulse-dot" />
          <div>
            <div className="status-banner-title">Подключаем Telegram</div>
            <div className="status-banner-text">Жду подтверждённую сессию перед загрузкой базы, чтобы не ловить пустые ответы и 401.</div>
          </div>
        </div>
      )}

      {(authError || requestError) && (
        <div className="status-banner error">
          <div>
            <div className="status-banner-title">База пока недоступна</div>
            <div className="status-banner-text">{authError || requestError}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: 12 }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Поиск по базе..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 40 }}
            disabled={!isTelegramReady || !!authError}
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

        {loading && !authError ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>{isTelegramReady ? 'Загрузка...' : 'Подключение...'}</div>
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
      <div className="panel-fixed bottom-nav">
        <Link href="/" className="bottom-nav-link active">
          <Book size={24} />
          <span style={{ fontSize: 10, marginTop: 4, fontWeight: 500 }}>База</span>
        </Link>
        <Link href="/chat" className="bottom-nav-link">
          <MessageSquare size={24} />
          <span style={{ fontSize: 10, marginTop: 4 }}>Чат</span>
        </Link>
      </div>
    </div>
  );
}
