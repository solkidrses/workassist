'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus } from 'lucide-react';
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

const CACHE_KEY = 'instructions_cache';

const readCache = (tag: string): Instruction[] | null => {
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY}_${tag}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCache = (tag: string, data: Instruction[]) => {
  try {
    sessionStorage.setItem(`${CACHE_KEY}_${tag}`, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
};

export default function LibraryPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedTag, setSelectedTag] = useState('all');

  const TAGS = ['all', 'vpn', 'tma', 'cs2', 'clario', 'general'];

  const fetchInstructions = useCallback(async () => {
    if (!isTelegramReady) {
      return;
    }

    // Instant display from cache, then refresh in background
    const cached = readCache(selectedTag);
    if (cached && cached.length > 0) {
      setInstructions(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

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
        writeCache(selectedTag, data.data);
      } else {
        setRequestError(data.error || 'Не удалось загрузить базу.');
      }
    } catch (e) {
      console.error(e);
      if (!cached || cached.length === 0) {
        setRequestError('Ошибка сети при загрузке базы.');
      }
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

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!isTelegramReady) return;

    if (!searchQuery.trim()) {
      setIsSearching(false);
      return fetchInstructions();
    }

    setIsSearching(true);
    setLoading(true);
    setRequestError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
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
  }, [authHeaders, isTelegramReady, fetchInstructions]);

  const handleSearchInput = (value: string) => {
    setQuery(value);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!value.trim()) {
      setIsSearching(false);
      performSearch('');
      return;
    }

    if (value.trim().length < 3) {
      return;
    }

    searchTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, 350);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTelegramReady) return;

    if (query.trim() && query.trim().length < 3) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    performSearch(query);
  };

  const clearSearch = () => {
    setQuery('');
    setIsSearching(false);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    fetchInstructions();
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
            className={`input-field ${shaking ? 'shake' : ''}`}
            placeholder="Поиск по базе..."
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            style={{ paddingLeft: 40 }}
            disabled={!isTelegramReady || !!authError}
          />
          <Search size={18} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)', transition: 'color 0.3s, transform 0.3s' }} />
          {isSearching && query.trim() !== '' && (
            <button
              type="button"
              onClick={clearSearch}
              style={{ position: 'absolute', right: 12, top: 12, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
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
                className={`tag-chip ${isActive ? 'active' : ''}`}
                onClick={() => { setSelectedTag(tag); setQuery(''); setIsSearching(false); }}
              >
                {tag === 'all' ? 'Все' : tag}
              </button>
            );
          })}
        </div>

        {/* Results Count Badge */}
        {isSearching && !loading && !authError && instructions.length > 0 && (
          <div className="results-count">
            <span className="dot" />
            <span>{instructions.length === 1 ? 'Найдена 1 инструкция' : instructions.length < 5 ? `Найдено ${instructions.length} инструкции` : `Найдено ${instructions.length} инструкций`}</span>
          </div>
        )}

        {loading && !authError ? (
          <div>
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.08}s` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="skeleton-line medium" />
                  <div className="skeleton-line tag" />
                </div>
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        ) : instructions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, animation: 'fade-in-up 0.4s ease 0.1s both' }}>
            <Search size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              Ничего не найдено<br />Попробуйте изменить запрос
            </div>
          </div>
        ) : (
          <div>
            {instructions.map((inst, i) => (
              <Link
                key={inst.id}
                href={`/instruction/${inst.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div
                  className="zinc-card card-enter"
                  style={{ animationDelay: `${0.05 + i * 0.06}s` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{inst.title}</h3>
                    <span className="zinc-tag">{inst.tag}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {inst.summary || 'Нажмите, чтобы прочитать полностью...'}
                  </p>
                  {inst.similarity !== undefined && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Совпадение: {(inst.similarity * 100).toFixed(0)}%</span>
                      <div className="match-bar">
                        <div className="match-bar-fill" style={{ width: `${(inst.similarity * 100).toFixed(0)}%` }} />
                      </div>
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
    </div>
  );
}
