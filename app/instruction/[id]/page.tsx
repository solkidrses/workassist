'use client'

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Save, Calendar } from 'lucide-react';
import { useTelegramInitData } from '@/lib/useTelegramInitData';

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

const TAG_OPTIONS = ['general', 'vpn', 'tma', 'cs2', 'clario'];

export default function InstructionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();

  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editFullText, setEditFullText] = useState('');
  const [editTag, setEditTag] = useState('general');

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
    <div className={`page-shell${fadingOut ? ' fade-out' : ''}`} style={{ paddingBottom: 40 }}>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/')} style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><ArrowLeft size={24} /></button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
            {isEditing ? 'Редактирование' : instruction.title}
          </h1>
        </div>

        {!isEditing && (
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

            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Категория (Тег)</label>
            <select 
              className="input-field" 
              value={editTag}
              onChange={(e) => setEditTag(e.target.value)}
              style={{ marginBottom: 16, backgroundColor: 'var(--bg-user-message)' }}
              disabled={saving || !!authError}
            >
              {TAG_OPTIONS.map(t => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>

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
          <div className="detail-enter">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <span className="zinc-tag">{instruction.tag}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={14} />
                {new Date(instruction.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>

            {instruction.summary && (
              <div className="zinc-card detail-enter" style={{ marginBottom: 16, animationDelay: '0.04s' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Краткая суть
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  {instruction.summary}
                </div>
              </div>
            )}

            {instruction.photoUrl && (
              <div className="detail-enter" style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #27272a', animationDelay: '0.08s' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={instruction.photoUrl} alt="Attached photo" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
              </div>
            )}

            <div className="zinc-card detail-enter" style={{ borderLeft: 'none', animationDelay: '0.12s' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Полная инструкция
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {instruction.fullText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
