'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UploadCloud, X, Check, FileText, Image as ImageIcon } from 'lucide-react';

export default function UploadPage() {
  const [initDataRaw, setInitDataRaw] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      setInitDataRaw(tg.initData || '');
    }
  }, []);

  const [text, setText] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [conflict, setConflict] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoBase64(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async (forceSave = false) => {
    if (!text && !photoBase64) return;
    
    setLoading(true);
    setResult(null);
    setConflict(null);
    
    try {
      const payload = {
        text,
        photoBase64: photoBase64 || undefined,
        source: 'tma_text',
        forceSave
      };

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initDataRaw,
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.conflict) {
          setConflict(data);
        } else {
          alert(data.error || 'Ошибка при загрузке');
        }
      } else {
        setResult(data.data[0]);
        // Reset form
        setText('');
        setPhotoBase64('');
      }
    } catch (e) {
      console.error(e);
      alert('Network error');
    }
    setLoading(false);
  };

  return (
    <div style={{ paddingBottom: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--text-main)' }}><ArrowLeft size={24} /></Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Новая инструкция</h1>
        </div>
      </div>

      <div style={{ padding: 16, flex: 1 }}>
        {!result && !conflict ? (
          <>
            <div className="zinc-card" style={{ marginBottom: 16, borderLeft: 'none' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
                Текст инструкции (или фото)
              </label>
              <textarea 
                className="input-field" 
                rows={6}
                placeholder="Вставьте текст или опишите своими словами..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ resize: 'none', marginBottom: 16 }}
              />

              {photoBase64 ? (
                <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', height: 160, marginBottom: 16 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoBase64} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    onClick={() => setPhotoBase64('')}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, border: '1px dashed #27272a', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <ImageIcon size={20} />
                  <span>Прикрепить скриншот</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            <button 
              className="btn-primary" 
              onClick={() => handleUpload(false)}
              disabled={loading || (!text && !photoBase64)}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: (loading || (!text && !photoBase64)) ? 0.5 : 1 }}
            >
              {loading ? 'Обработка ИИ...' : (
                <>
                  <UploadCloud size={20} />
                  Анализ и Сохранение
                </>
              )}
            </button>
          </>
        ) : result ? (
          <div className="zinc-card" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(46, 213, 115, 0.1)', color: '#2ed573', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={32} />
            </div>
            <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Успешно сохранено</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 24px' }}>
              ИИ структурировал инструкцию: <br/><strong style={{ color: '#fff' }}>{result.title}</strong>
            </p>
            <button className="btn-primary" style={{ backgroundColor: '#27272a', color: '#fff' }} onClick={() => window.location.href = '/'}>
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
            {conflict.matches.map((m: any) => (
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
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleUpload(true)}>
                Всё равно сохранить
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
