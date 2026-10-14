'use client'

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Save, Calendar, X, Search as SearchIcon, ArrowUp } from 'lucide-react';
import { useAccessCheck } from '@/lib/AccessProvider';
import { CategorySelect } from '@/components/CategorySelect';
import { NoAccessScreen } from '@/components/NoAccessScreen';
import MarkdownText from '@/components/MarkdownText';

type Instruction = {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  tag: string;
  sourceType: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function InstructionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { authHeaders, isTelegramReady, authError, access, role, requestAccess, requestStatus } = useAccessCheck();

  const [tagOptions, setTagOptions] = useState<{ id: string; name: string; slug: string }[]>([{ id: 'general', name: 'Общее', slug: 'general' }]);
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [intraSearch, setIntraSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [matchedBlocksCount, setMatchedBlocksCount] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const fullTextRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editFullText, setEditFullText] = useState('');
  const [editTag, setEditTag] = useState('general');

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 250) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleIntraSearchChange = useCallback((value: string) => {
    setIntraSearch(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (value.trim().length < 2) {
      setDebouncedSearch('');
      setMatchedBlocksCount(null);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 150);
  }, []);

  const handleClearSearch = useCallback(() => {
    setIntraSearch('');
    setDebouncedSearch('');
    setMatchedBlocksCount(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isTelegramReady) return;
    fetch('/api/categories', { headers: authHeaders, cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (data.success && data.data.length > 0) setTagOptions(data.data); })
      .catch(() => {});
  }, [isTelegramReady, authHeaders]);

  const fetchInstruction = useCallback(async () => {
    if (!isTelegramReady) {
      return;
    }

    setLoading(true);
    setRequestError(null);
    try {
      const res = await fetch(`/api/instructions/${id}`, {
        headers: authHeaders,
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setInstruction(data.data);
        setEditTitle(data.data.title);
        setEditSummary(data.data.summary);
        setEditFullText(data.data.fullText);
        setEditTag(data.data.tag);
      } else {
        setRequestError(data.error || 'Инструкция не найдена');
      }
    } catch (e) {
      console.error(e);
      setRequestError('Ошибка сети при загрузке инструкции.');
    }
    setLoading(false);
  }, [authHeaders, id, isTelegramReady]);

  useEffect(() => {
    if (!isTelegramReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchInstruction();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchInstruction, isTelegramReady]);

  const handleSave = async () => {
    setSaving(true);
    setRequestError(null);
    try {
      const res = await fetch(`/api/instructions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          title: editTitle,
          summary: editSummary,
          fullText: editFullText,
          tag: editTag
        })
      });
      const data = await res.json();
      if (data.success) {
        setInstruction(prev => prev ? { ...prev, ...data.data } : null);
        setIsEditing(false);
      } else {
        setRequestError(data.error || 'Ошибка при сохранении');
      }
    } catch (e) {
      console.error(e);
      setRequestError('Ошибка сети при сохранении.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту инструкцию?')) return;

    setDeleting(true);
    setRequestError(null);
    try {
      const res = await fetch(`/api/instructions/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setFadingOut(true);
        setTimeout(() => router.push('/'), 200);
      } else {
        setRequestError(data.error || 'Ошибка при удалении');
        setDeleting(false);
      }
    } catch (e) {
      console.error(e);
      setRequestError('Ошибка сети при удалении.');
      setDeleting(false);
    }
  };

  if (access !== 'ok') {
    if (access === 'loading') {
      return (
        <div className="page-shell">
          <div className="status-banner pending" style={{ marginTop: 16 }}>
            <div className="pulse-dot" />
            <div>
              <div className="status-banner-title">Проверка доступа</div>
              <div className="status-banner-text">Подтверждаю вашу сессию...</div>
            </div>
          </div>
        </div>
      );
    }
    return <NoAccessScreen access={access} requestAccess={requestAccess} requestStatus={requestStatus} />;
  }

  if (loading) {
    if (!isTelegramReady && !authError) {
      return (
        <div className="page-shell">
          <div className="status-banner pending" style={{ marginTop: 16 }}>
            <div className="pulse-dot" />
            <div>
              <div className="status-banner-title">Подключаем Telegram</div>
              <div className="status-banner-text">Готовлю защищённую сессию перед загрузкой инструкции.</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="detail-enter" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
        Загрузка инструкции...
      </div>
    );
  }

  if (!instruction && !loading) {
    return (
      <div className="page-shell">
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
          {authError || requestError || 'Инструкция не найдена.'}
          <div style={{ marginTop: 16 }}>
            <button className="btn-primary" onClick={() => router.push('/')}>
              Вернуться в базу
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!instruction) {
    return null;
  }

  return (
    <div className={`page-shell${fadingOut ? ' fade-out' : ''}`} style={{ paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/')} style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><ArrowLeft size={24} /></button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
            {isEditing ? 'Редактирование' : instruction.title}
          </h1>
        </div>

        {!isEditing && role === 'admin' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setIsEditing(true)} 
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4 }}
            >
              <Edit2 size={20} />
            </button>
            <button 
              onClick={handleDelete} 
              disabled={deleting}
              style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', padding: 4 }}
            >
              <Trash2 size={20} />
            </button>
          </div>
        )}
      </div>

      {!isTelegramReady && !authError && (
        <div className="status-banner pending">
          <div className="pulse-dot" />
          <div>
            <div className="status-banner-title">Подключаем Telegram</div>
            <div className="status-banner-text">Жду подтверждённую сессию, чтобы открыть и редактировать инструкцию без повторной загрузки.</div>
          </div>
        </div>
      )}

      {(authError || requestError) && (
        <div className="status-banner error">
          <div>
            <div className="status-banner-title">Данные пока недоступны</div>
            <div className="status-banner-text">{authError || requestError}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        {isEditing ? (
          <div className="zinc-card edit-enter" style={{ borderLeft: 'none' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Заголовок</label>
            <input 
              type="text" 
              className="input-field" 
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ marginBottom: 16 }}
              disabled={saving || !!authError}
            />

            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Категория</label>
            <div style={{ marginBottom: 16 }}>
              <CategorySelect
                categories={tagOptions.map((t: { id: string; name: string; slug: string }) => ({ id: t.id, name: t.name, slug: t.slug, color: null, icon: null }))}
                value={editTag}
                onChange={setEditTag}
                disabled={saving || !!authError}
              />
            </div>

            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Краткое содержание</label>
            <textarea 
              className="input-field" 
              rows={3}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              style={{ resize: 'none', marginBottom: 16 }}
              disabled={saving || !!authError}
            />

            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Полный текст инструкции</label>
            <textarea 
              className="input-field" 
              rows={10}
              value={editFullText}
              onChange={(e) => setEditFullText(e.target.value)}
              style={{ resize: 'vertical', marginBottom: 20 }}
              disabled={saving || !!authError}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn-primary" 
                style={{ backgroundColor: '#27272a', color: '#fff', flex: 1 }}
                onClick={() => setIsEditing(false)}
              >
                Отмена
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                onClick={handleSave}
                disabled={saving || !!authError}
              >
                <Save size={18} />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <span className="zinc-tag">{instruction.tag}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={14} />
                {new Date(instruction.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>

            {instruction.summary && (
              <div className="zinc-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 0.3 }}>
                  Краткая суть
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  {instruction.summary}
                </div>
              </div>
            )}

            {instruction.photoUrl && (
              <div style={{ marginBottom: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={instruction.photoUrl}
                  alt="Attached photo"
                  onClick={() => setPhotoViewer(instruction.photoUrl!)}
                  style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', border: '1px solid #27272a' }}
                />
              </div>
            )}

            <div ref={searchContainerRef} className="zinc-card" style={{ borderLeft: 'none', scrollMarginTop: 72, touchAction: 'pan-y' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: 0.3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 16 }}>
                <span>{debouncedSearch.trim().length >= 2 ? 'Результаты поиска' : 'Полная инструкция'}</span>
                {debouncedSearch.trim().length >= 2 && (
                  <span
                    key={`count-${matchedBlocksCount}`}
                    style={{
                      fontSize: 12,
                      color: (matchedBlocksCount ?? 0) > 0 ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 500,
                      animation: 'count-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
                    }}
                  >
                    {(matchedBlocksCount ?? 0) > 0
                      ? (matchedBlocksCount === 1
                          ? 'Найдена 1 запись'
                          : ((matchedBlocksCount! % 10 >= 2 && matchedBlocksCount! % 10 <= 4) && (matchedBlocksCount! % 100 < 10 || matchedBlocksCount! % 100 >= 20)
                              ? `Найдено ${matchedBlocksCount} записи`
                              : `Найдено записей: ${matchedBlocksCount}`))
                      : 'Нет совпадений'}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Поиск внутри инструкции..."
                    value={intraSearch}
                    onChange={(e) => handleIntraSearchChange(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{ paddingLeft: 36, paddingRight: intraSearch ? 32 : 12, fontSize: 16, height: 40, marginBottom: 0 }}
                  />
                  <SearchIcon size={16} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  {intraSearch && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onTouchStart={(e) => e.preventDefault()}
                      onClick={handleClearSearch}
                      title="Очистить поиск"
                      style={{ position: 'absolute', right: 8, top: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div ref={fullTextRef} style={{ fontSize: 14, lineHeight: 1.6, touchAction: 'pan-y' }}>
                <MarkdownText
                  content={instruction.fullText}
                  imageSize="full"
                  highlightQuery={debouncedSearch}
                  onClearSearch={handleClearSearch}
                  onMatchesCountChange={setMatchedBlocksCount}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {showScrollTop && (
        <button
          type="button"
          onClick={() => {
            const elem = searchContainerRef.current;
            if (elem) {
              const top = elem.getBoundingClientRect().top + window.scrollY - 70;
              window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          style={{
            position: 'fixed',
            bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
            right: 16,
            zIndex: 85,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            boxShadow: '0 2px 14px rgba(0, 0, 0, 0.4)',
            animation: 'fade-in-up 0.25s ease both',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <ArrowUp size={14} />
          <span>К поиску</span>
        </button>
      )}

      {photoViewer && createPortal(
        <div
          onClick={() => setPhotoViewer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'page-enter 0.2s ease both',
          }}
        >
          <button
            onClick={() => setPhotoViewer(null)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoViewer} alt="Full photo" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>,
        document.body
      )}
    </div>
  );
}
