'use client'

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Save, X, Tag as TagIcon, Calendar } from 'lucide-react';

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
  const [initDataRaw, setInitDataRaw] = useState('');

  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editFullText, setEditFullText] = useState('');
  const [editTag, setEditTag] = useState('general');

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      setInitDataRaw(tg.initData || '');
    }
  }, []);

  useEffect(() => {
    fetchInstruction();
  }, [id, initDataRaw]);

  const fetchInstruction = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/instructions/${id}`, {
        headers: { 'x-telegram-init-data': initDataRaw }
      });
      const data = await res.json();
      if (data.success) {
        setInstruction(data.data);
        setEditTitle(data.data.title);
        setEditSummary(data.data.summary);
        setEditFullText(data.data.fullText);
        setEditTag(data.data.tag);
      } else {
        alert(data.error || 'Инструкция не найдена');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/instructions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initDataRaw
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
        alert(data.error || 'Ошибка при сохранении');
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка сети');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту инструкцию?')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/instructions/${id}`, {
        method: 'DELETE',
        headers: { 'x-telegram-init-data': initDataRaw }
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = '/';
      } else {
        alert(data.error || 'Ошибка при удалении');
        setDeleting(false);
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка сети');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
        Загрузка инструкции...
      </div>
    );
  }

  if (!instruction) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
        Инструкция не найдена.
        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={() => window.location.href = '/'}>
            Вернуться в базу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}><ArrowLeft size={24} /></a>
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

      <div style={{ padding: 16, flex: 1 }}>
        {isEditing ? (
          /* Edit Mode */
          <div className="zinc-card" style={{ borderLeft: 'none' }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Заголовок</label>
            <input 
              type="text" 
              className="input-field" 
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{ marginBottom: 16 }}
            />

            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Категория (Тег)</label>
            <select 
              className="input-field" 
              value={editTag}
              onChange={(e) => setEditTag(e.target.value)}
              style={{ marginBottom: 16, backgroundColor: 'var(--bg-user-message)' }}
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
            />

            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Полный текст инструкции</label>
            <textarea 
              className="input-field" 
              rows={10}
              value={editFullText}
              onChange={(e) => setEditFullText(e.target.value)}
              style={{ resize: 'vertical', marginBottom: 20 }}
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
                disabled={saving}
              >
                <Save size={18} />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Краткая суть
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  {instruction.summary}
                </div>
              </div>
            )}

            {instruction.photoUrl && (
              <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #27272a' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={instruction.photoUrl} alt="Attached photo" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
              </div>
            )}

            <div className="zinc-card" style={{ borderLeft: 'none' }}>
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
