'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X, Check, FileText, Image as ImageIcon, FileUp, Sparkles, Loader2 } from 'lucide-react';
import { useTelegramInitData } from '@/lib/useTelegramInitData';

type UploadResult = {
  id: string;
  title: string;
  tag: string;
  summary: string;
};

type ConflictMatch = {
  id: string;
  title: string;
  distance: number;
};

type ConflictState = {
  structuredData: {
    title: string;
    summary: string;
  };
  matches: ConflictMatch[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

export default function UploadPage() {
  const router = useRouter();
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();

  const [text, setText] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [title, setTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState('general');
  const [categories, setCategories] = useState<Category[]>([{ id: 'general', name: 'Общее', slug: 'general' }]);

  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTelegramReady) return;
    fetch('/api/categories', { headers: authHeaders, cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (data.success && data.data.length > 0) setCategories(data.data); })
      .catch(() => {});
  }, [isTelegramReady, JSON.stringify(authHeaders)]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoBase64(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setRequestError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setRequestError(data.error || 'Не удалось извлечь текст');
      } else {
        setText(data.text);
        if (data.suggestedTitle) setTitle(data.suggestedTitle);
      }
    } catch {
      setRequestError('Ошибка сети при извлечении текста');
    }
    setExtracting(false);
    e.target.value = '';
  };

  const handleUpload = async (forceSave = false, skipAI = false) => {
    if (!text && !photoBase64) return;
    if (!isTelegramReady) return;

    setLoading(true);
    setResult(null);
    setConflict(null);
    setRequestError(null);

    try {
      const payload = {
        text,
        photoBase64: photoBase64 || undefined,
        source: 'tma_text',
        forceSave,
        skipAI,
        title: skipAI ? title : undefined,
        tag: skipAI ? selectedTag : undefined,
      };

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.conflict) {
        setConflict(data as ConflictState);
      } else if (!res.ok) {
        setRequestError(data.error || 'Ошибка при загрузке');
      } else {
        setResult(data.data[0] as UploadResult);
        setText('');
        setPhotoBase64('');
        setTitle('');
      }
      if (data.photoError) {
        setRequestError(data.photoError);
      }
    } catch (e) {
      console.error(e);
      setRequestError('Ошибка сети при загрузке.');
    }
    setLoading(false);
  };

  const canSubmit = isTelegramReady && !authError && (text || photoBase64) && !loading;

  return (
    <div className="page-shell" style={{ paddingBottom: 80 }}>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--text-main)' }}><ArrowLeft size={24} /></Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Новая инструкция</h1>
        </div>
      </div>

      {!isTelegramReady && !authError && (
        <div className="status-banner pending">
          <div className="pulse-dot" />
          <div>
            <div className="status-banner-title">Подключаем Telegram</div>
            <div className="status-banner-text">Жду подтверждённую сессию перед загрузкой, чтобы сохранение прошло с первого раза.</div>
          </div>
        </div>
      )}

      {(authError || requestError) && (
        <div className="status-banner error">
          <div>
            <div className="status-banner-title">Загрузка недоступна</div>
            <div className="status-banner-text">{authError || requestError}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        {!result && !conflict ? (
          <>
            <div className="zinc-card" style={{ marginBottom: 16, borderLeft: 'none' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
                Текст инструкции
              </label>
              <textarea
                className="input-field"
                rows={6}
                placeholder="Вставьте текст вручную или загрузите файл ниже..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ resize: 'none', marginBottom: 16 }}
                disabled={!isTelegramReady || !!authError || extracting}
              />

              {extracting && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                  <Loader2 size={16} className="spin" />
                  Извлечение текста из файла...
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', border: '1px dashed #27272a', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
                  <span>Загрузить файл</span>
                  <input type="file" accept=".docx,.txt" onChange={handleDocChange} style={{ display: 'none' }} disabled={!isTelegramReady || !!authError || extracting} />
                </label>
                {photoBase64 ? (
                  <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', width: 80, height: 80, flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoBase64} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={() => setPhotoBase64('')}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', border: '1px dashed #27272a', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
                    <span>Скриншот</span>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} disabled={!isTelegramReady || !!authError} />
                  </label>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Название</label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="Авто из текста или файла"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!isTelegramReady || !!authError}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Категория</label>
                  <select
                    className="input-field"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-user-message)' }}
                    disabled={!isTelegramReady || !!authError}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-primary"
                onClick={() => handleUpload(false, false)}
                disabled={!canSubmit}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flex: 1 }}
              >
                {loading ? 'Обработка...' : 'Сохранить с ИИ'}
              </button>
              <button
                onClick={() => handleUpload(false, true)}
                disabled={!canSubmit}
                style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flex: 1,
                  padding: '12px 16px', borderRadius: 12, fontSize: 15, fontWeight: 600,
                  border: '1px solid var(--border-subtle)', background: 'transparent',
                  color: 'var(--text-main)', cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.5,
                }}
              >
                {loading ? '...' : 'Сохранить'}
              </button>
            </div>
          </>
        ) : result ? (
          <div className="zinc-card" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(46, 213, 115, 0.1)', color: '#2ed573', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={32} />
            </div>
            <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Успешно сохранено</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 24px' }}>
              Инструкция добавлена: <br/><strong style={{ color: '#fff' }}>{result.title}</strong>
            </p>
            <button className="btn-primary" style={{ backgroundColor: '#27272a', color: '#fff' }} onClick={() => router.push('/')}>
                Вернуться в базу
              </button>
          </div>
        ) : conflict ? (
          <div className="zinc-card" style={{ borderLeftColor: '#ff4757' }}>
            <h2 style={{ color: '#ff4757', marginTop: 0, fontSize: 18 }}>Найдены дубликаты!</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Мы нашли похожие инструкции. Возможно, это уже есть в базе?
            </p>
            
            <div style={{ margin: '16px 0', padding: 12, backgroundColor: '#1c1d21', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 14, color: '#fff' }}>Ваш новый вариант (обработан ИИ):</h4>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{conflict.structuredData.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{conflict.structuredData.summary}</div>
            </div>

            <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#fff' }}>Существующие в базе:</h4>
            {conflict.matches.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #27272a', alignItems: 'flex-start' }}>
                <FileText size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Совпадение: {(m.distance * 100).toFixed(0)}%</div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn-primary" style={{ flex: 1, backgroundColor: '#27272a', color: '#fff' }} onClick={() => setConflict(null)}>
                Отмена
              </button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleUpload(true, false)}>
                Всё равно сохранить
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
