'use client'

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Save, X, Folder, RefreshCw, Activity } from 'lucide-react';
import { useTelegramInitData } from '@/lib/useTelegramInitData';

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  sortOrder: number;
};

export default function AdminPage() {
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newColor, setNewColor] = useState('');
  const [adding, setAdding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [health, setHealth] = useState<{ totalInstructions: number; withoutEmbedding: number; embeddingsEnabled: boolean; totalSessions: number; totalMessages: number; totalCategories: number } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenResult, setRegenResult] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!isTelegramReady) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/categories', { headers: authHeaders, cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      } else {
        setError(data.error || 'Ошибка загрузки категорий');
      }
    } catch {
      setError('Ошибка сети');
    }
    setLoading(false);
  }, [authHeaders, isTelegramReady]);

  useEffect(() => {
    if (!isTelegramReady) return;
    fetchCategories();
    fetch('/api/admin/health', { headers: authHeaders, cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (data.success) setHealth(data.data); })
      .catch(() => {});
  }, [isTelegramReady, JSON.stringify(authHeaders), fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() || undefined, color: newColor.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => [...prev, data.data]);
        setNewName('');
        setNewIcon('');
        setNewColor('');
        setShowAddForm(false);
      } else {
        setError(data.error || 'Ошибка создания');
      }
    } catch {
      setError('Ошибка сети');
    }
    setAdding(false);
  };

  const handleSave = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ name: editName.trim(), icon: editIcon.trim() || null, color: editColor.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim(), icon: editIcon.trim() || null, color: editColor.trim() || null } : c));
        setEditingId(null);
      } else {
        setError(data.error || 'Ошибка сохранения');
      }
    } catch {
      setError('Ошибка сети');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const url = reassignTo
        ? `/api/categories/${deleteTarget.id}?reassignTo=${encodeURIComponent(reassignTo)}`
        : `/api/categories/${deleteTarget.id}`;
      const res = await fetch(url, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => prev.filter(c => c.id !== deleteTarget.id));
        setDeleteTarget(null);
        setReassignTo('');
      } else {
        setError(data.error || 'Ошибка удаления');
      }
    } catch {
      setError('Ошибка сети');
    }
    setDeleting(false);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || '');
    setEditColor(cat.color || '');
  };

  const handleRegenerate = async (onlyMissing: boolean) => {
    setRegenerating(true);
    setRegenResult(null);
    setError(null);
    try {
      const url = onlyMissing ? '/api/admin/health?onlyMissing=true' : '/api/admin/health';
      const res = await fetch(url, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        const { total, updated, failed } = data.data;
        setRegenResult(`Готово: обновлено ${updated} из ${total}${failed > 0 ? `, ошибок: ${failed}` : ''}`);
        const hres = await fetch('/api/admin/health', { headers: authHeaders, cache: 'no-store' });
        const hdata = await hres.json();
        if (hdata.success) setHealth(hdata.data);
      } else {
        setError(data.error || 'Ошибка перегенерации');
      }
    } catch {
      setError('Ошибка сети');
    }
    setRegenerating(false);
  };

  if (!isTelegramReady && !authError) {
    return (
      <div className="page-shell">
        <div className="status-banner pending">
          <div className="pulse-dot" />
          <div>
            <div className="status-banner-title">Подключаем Telegram</div>
            <div className="status-banner-text">Жду подтверждённую сессию...</div>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page-shell">
        <div className="status-banner error">
          <div>
            <div className="status-banner-title">Доступ недоступен</div>
            <div className="status-banner-text">{authError}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ paddingBottom: 80 }}>
      <div className="header">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Админка · Категории</h1>
      </div>

      {error && (
        <div className="status-banner error">
          <div>
            <div className="status-banner-title">Ошибка</div>
            <div className="status-banner-text">{error}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        {/* Health Panel */}
        {health && (
          <div className="zinc-card" style={{ marginBottom: 20, borderLeftColor: 'var(--success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Activity size={18} style={{ color: 'var(--success)' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Состояние базы</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Инструкций: </span>
                <span style={{ fontWeight: 600 }}>{health.totalInstructions}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Без эмбеддинга: </span>
                <span style={{ fontWeight: 600, color: health.withoutEmbedding > 0 ? 'var(--danger)' : 'var(--success)' }}>{health.withoutEmbedding}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Категорий: </span>
                <span style={{ fontWeight: 600 }}>{health.totalCategories}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Чатов: </span>
                <span style={{ fontWeight: 600 }}>{health.totalSessions}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Сообщений: </span>
                <span style={{ fontWeight: 600 }}>{health.totalMessages}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Поиск: </span>
                <span style={{ fontWeight: 600, color: health.embeddingsEnabled ? 'var(--success)' : 'var(--danger)' }}>
                  {health.embeddingsEnabled ? 'семантический' : 'текстовый'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleRegenerate(true)}
                  disabled={regenerating || health.withoutEmbedding === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    border: '1px solid var(--border-subtle)', background: 'transparent',
                    color: health.withoutEmbedding > 0 ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: regenerating || health.withoutEmbedding === 0 ? 'not-allowed' : 'pointer',
                    opacity: regenerating ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={14} className={regenerating ? 'spin' : ''} />
                  {health.withoutEmbedding > 0 ? `Догенерировать (${health.withoutEmbedding})` : 'Все имеют эмбеддинги'}
                </button>
                <button
                  onClick={() => handleRegenerate(false)}
                  disabled={regenerating || health.totalInstructions === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    border: '1px solid var(--border-subtle)', background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: regenerating || health.totalInstructions === 0 ? 'not-allowed' : 'pointer',
                    opacity: regenerating ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={14} className={regenerating ? 'spin' : ''} />
                  Перегенерировать все
                </button>
              </div>
              {regenResult && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)', animation: 'fade-in-up 0.3s ease both' }}>
                  {regenResult}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{categories.length} категорий</span>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="tag-chip active"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Добавить
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>Загрузка...</div>
        ) : (
          <>
            {showAddForm && (
              <div className="zinc-card" style={{ marginBottom: 16, animation: 'fade-in-up 0.3s var(--ease-out) both' }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Название</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Например: Docker"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Иконка (эмодзи, опционально)</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="🐳"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Цвет (HEX, опционально)</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="#ff7c3b"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  style={{ marginBottom: 16 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleAdd}
                    disabled={!newName.trim() || adding}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                      backgroundColor: 'var(--accent)', color: '#000', fontWeight: 600,
                      cursor: !newName.trim() || adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.6 : 1,
                      fontSize: 14,
                    }}
                  >
                    {adding ? 'Создание...' : 'Создать'}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewName(''); setNewIcon(''); setNewColor(''); }}
                    style={{
                      padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)',
                      backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {categories.map((cat, i) => (
              <div
                key={cat.id}
                className="zinc-card card-enter"
                style={{ animationDelay: `${0.02 + i * 0.04}s`, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                {editingId === cat.id ? (
                  <div style={{ flex: 1 }}>
                    <input
                      className="input-field"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        className="input-field"
                        type="text"
                        placeholder="Иконка"
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        className="input-field"
                        type="text"
                        placeholder="Цвет"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleSave(cat.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#000', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Save size={14} /> Сохранить
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <X size={14} /> Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: cat.color ? `${cat.color}22` : 'var(--accent-transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {cat.icon || <Folder size={18} style={{ color: cat.color || 'var(--accent)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{cat.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{cat.slug}</div>
                    </div>
                    <button
                      onClick={() => startEdit(cat)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6 }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(cat); setReassignTo(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 6 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}

            {categories.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
                <Folder size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <div style={{ fontSize: 15 }}>Категорий пока нет.<br />Создайте первую!</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          onClick={() => { setDeleteTarget(null); setReassignTo(''); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="zinc-card"
            style={{ maxWidth: 400, width: '100%', borderLeft: '3px solid var(--danger)', animation: 'fade-in-up 0.2s var(--ease-out) both' }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>Удалить «{deleteTarget.name}»?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Инструкции в этой категории нужно куда-то перенести. Выберите категорию для переноса или удалите без переноса.
            </p>
            <select
              className="input-field"
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              style={{ marginBottom: 16, backgroundColor: 'var(--bg-user-message)' }}
            >
              <option value="">Удалить без переноса</option>
              {categories.filter(c => c.id !== deleteTarget.id).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                  backgroundColor: 'var(--danger)', color: '#fff', fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1, fontSize: 14,
                }}
              >
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
              <button
                onClick={() => { setDeleteTarget(null); setReassignTo(''); }}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
