'use client'

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Save, X, Folder, Check, UserCog } from 'lucide-react';
import { useAccessCheck } from '@/lib/AccessProvider';

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  sortOrder: number;
  instructionCount: number;
};

type AppUser = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  role: string;
  status: string;
  createdAt: string;
};

export default function AdminPage() {
  const { authHeaders, isTelegramReady, authError, access, role } = useAccessCheck();
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

  const [metrics, setMetrics] = useState<{ cpu: number; memTotal: number; memUsed: number; memPercent: number; diskTotal: number; diskUsed: number; diskFree: number; diskPercent: number } | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'categories' | 'users'>('categories');

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
    if (!isTelegramReady || access !== 'ok' || role !== 'admin') return;
    fetchCategories();
  }, [isTelegramReady, access, role, JSON.stringify(authHeaders), fetchCategories]);

  useEffect(() => {
    if (!isTelegramReady || access !== 'ok' || role !== 'admin') return;
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/admin/metrics', { headers: authHeaders, cache: 'no-store' });
        const data = await res.json();
        if (data.success) setMetrics(data.data);
      } catch {}
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [isTelegramReady, JSON.stringify(authHeaders)]);

  const fetchUsers = useCallback(async () => {
    if (!isTelegramReady) return;
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users', { headers: authHeaders, cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch {}
    setUsersLoading(false);
  }, [authHeaders, isTelegramReady]);

  useEffect(() => {
    if (!isTelegramReady || access !== 'ok' || role !== 'admin' || activeTab !== 'users') return;
    fetchUsers();
  }, [isTelegramReady, access, role, activeTab, JSON.stringify(authHeaders), fetchUsers]);

  const handleUserAction = async (telegramId: string, action: 'approve' | 'reject' | 'ban' | 'setRole' | 'delete', role?: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ telegramId, action, role }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        setError(data.error || 'Ошибка');
      }
    } catch {
      setError('Ошибка сети');
    }
  };

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

  if (access === 'loading' || (!isTelegramReady && !authError)) {
    return (
      <div className="page-shell">
        <div className="status-banner pending">
          <div className="pulse-dot" />
          <div>
            <div className="status-banner-title">Проверка доступа</div>
            <div className="status-banner-text">Подтверждаю вашу сессию...</div>
          </div>
        </div>
      </div>
    );
  }

  if (authError || (access === 'ok' && role !== 'admin')) {
    return (
      <div className="page-shell">
        <div className="status-banner error">
          <div>
            <div className="status-banner-title">Доступ недоступен</div>
            <div className="status-banner-text">{authError || 'Только для администраторов'}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ paddingBottom: 80 }}>
      <div className="header">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Админка</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '0 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setActiveTab('categories')}
          className="tag-chip"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: activeTab === 'categories' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'categories' ? '#000' : 'var(--text-muted)',
            border: activeTab === 'categories' ? 'none' : '1px solid var(--border-subtle)',
          }}
        >
          <Folder size={14} /> Категории
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className="tag-chip"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: activeTab === 'users' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'users' ? '#000' : 'var(--text-muted)',
            border: activeTab === 'users' ? 'none' : '1px solid var(--border-subtle)',
          }}
        >
          <UserCog size={14} /> Пользователи
          {users.filter(u => u.status === 'pending').length > 0 && (
            <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>
              {users.filter(u => u.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="status-banner error" style={{ margin: '0 16px 16px' }}>
          <div>
            <div className="status-banner-title">Ошибка</div>
            <div className="status-banner-text">{error}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        {metrics && (
          <div className="zinc-card" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Сервер
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>CPU</span>
                  <span style={{ color: 'var(--text-muted)' }}>{metrics.cpu}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#27272a', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${metrics.cpu}%`, background: metrics.cpu > 80 ? 'var(--danger)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>ОЗУ</span>
                  <span style={{ color: 'var(--text-muted)' }}>{metrics.memUsed} / {metrics.memTotal} МБ · {metrics.memPercent}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#27272a', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${metrics.memPercent}%`, background: metrics.memPercent > 85 ? 'var(--danger)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Диск</span>
                  <span style={{ color: 'var(--text-muted)' }}>{(metrics.diskFree / 1073741824).toFixed(1)} ГБ свободно · {metrics.diskPercent}% занято</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#27272a', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${metrics.diskPercent}%`, background: metrics.diskPercent > 85 ? 'var(--danger)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories Section */}
        {activeTab === 'categories' && (
        <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{categories.length} категории</span>
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
                style={{ animationDelay: `${0.02 + i * 0.04}s`, display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}
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
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {cat.instructionCount} {cat.instructionCount === 1 ? 'инструкция' : cat.instructionCount >= 2 && cat.instructionCount <= 4 ? 'инструкции' : 'инструкций'}
                      </div>
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
        </>
        )}

        {/* Users Section */}
        {activeTab === 'users' && (
          <>
            {usersLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>Загрузка...</div>
            ) : (
              <>
                {users.filter(u => u.status === 'pending').length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Заявки</div>
                    {users.filter(u => u.status === 'pending').map((u) => (
                      <div key={u.id} className="zinc-card card-enter" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, borderLeft: '3px solid var(--accent)', overflow: 'hidden' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                          {u.firstName?.[0] || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.firstName || 'Без имени'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username ? `@${u.username}` : `ID: ${u.telegramId}`}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => handleUserAction(u.telegramId, 'approve')}
                            style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#000', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
                          >
                            <Check size={13} /> Одобрить
                          </button>
                          <button
                            onClick={() => handleUserAction(u.telegramId, 'reject')}
                            style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, display: 'flex', alignItems: 'center' }}
                          >
                            <X size={13} />
                          </button>
                          <button
                            onClick={() => handleUserAction(u.telegramId, 'ban')}
                            style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--danger)', fontSize: 12 }}
                            title="Заблокировать навсегда"
                          >
                            🚫
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Пользователи ({users.filter(u => u.status === 'approved').length})
                </div>
                {users.filter(u => u.status === 'approved').map((u) => (
                  <div key={u.id} className="zinc-card card-enter" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, overflow: 'hidden' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-user-message)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      {u.firstName?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.firstName || 'Без имени'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username ? `@${u.username}` : `ID: ${u.telegramId}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handleUserAction(u.telegramId, 'setRole', u.role === 'admin' ? 'viewer' : 'admin')}
                        className="tag-chip"
                        style={{
                          backgroundColor: u.role === 'admin' ? 'var(--accent)' : 'transparent',
                          color: u.role === 'admin' ? '#000' : 'var(--text-muted)',
                          border: u.role === 'admin' ? 'none' : '1px solid var(--border-subtle)',
                          fontSize: 11,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {u.role === 'admin' ? 'Админ' : 'Читатель'}
                      </button>
                      <button
                        onClick={() => handleUserAction(u.telegramId, 'delete')}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {users.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
                    <UserCog size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <div style={{ fontSize: 15 }}>Пользователей пока нет.<br />Заявки появятся здесь.</div>
                  </div>
                )}
              </>
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
