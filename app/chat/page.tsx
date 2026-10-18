'use client'

import { Send, Trash2, Plus, MessageSquare, X, Trash, Paperclip, Camera } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAccessCheck } from '@/lib/AccessProvider';
import { NoAccessScreen } from '@/components/NoAccessScreen';
import MarkdownText from '@/components/MarkdownText';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Не удалось получить ответ';
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
}

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
};

function optimizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1400;
        let { width, height } = img;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const { authHeaders, isTelegramReady, authError, access, requestAccess, requestStatus } = useAccessCheck();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const HISTORY_CACHE_KEY = 'chat_history_cache';
  const SESSIONS_CACHE_KEY = 'chat_sessions_cache';

  const scrollRafRef = useRef<number | null>(null);
  
  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  useEffect(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      scrollRafRef.current = null;
    });
    return () => { if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current); };
  }, [messages]);

  useEffect(() => {
    const handleScrollToBottom = () => {
      scrollToBottom(true);
    };
    window.addEventListener('scroll-chat-to-bottom', handleScrollToBottom);
    return () => window.removeEventListener('scroll-chat-to-bottom', handleScrollToBottom);
  }, [scrollToBottom]);

  // Paste image from clipboard (Ctrl+V / mobile paste) with auto-optimization
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          if (file.size > 20 * 1024 * 1024) {
            alert('Фото слишком большое (макс. 20 МБ)');
            return;
          }
          e.preventDefault();
          const optimized = await optimizeImage(file);
          if (optimized) {
            setPendingImage(optimized);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const loadSessionMessages = async (sessionId: string) => {
    setHistoryLoaded(false);
    try {
      const res = await fetch(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: authHeaders,
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        const historyMessages: Message[] = data.data.map((m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        setMessages(historyMessages);
        sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ sessionId, messages: historyMessages }));
      } else {
        setMessages([]);
        sessionStorage.removeItem(HISTORY_CACHE_KEY);
      }
    } catch (e) {
      console.error('Failed to load session messages:', e);
    } finally {
      setHistoryLoaded(true);
    }
  };

  // Load sessions and latest session messages on mount
  useEffect(() => {
    if (loadedRef.current || !isTelegramReady) return;
    if (!authHeaders || Object.keys(authHeaders).length === 0) return;
    loadedRef.current = true;

    // Try cache first for instant display
    let cachedSessionId: string | null = null;
    try {
      const cached = sessionStorage.getItem(HISTORY_CACHE_KEY);
      if (cached) {
        const cache = JSON.parse(cached) as { sessionId: string; messages: Message[] };
        if (cache.messages.length > 0) {
          setMessages(cache.messages);
          setCurrentSessionId(cache.sessionId);
          cachedSessionId = cache.sessionId;
          setHistoryLoaded(true);
        }
      }
    } catch {}

    (async () => {
      try {
        // Load sessions list
        const sessionsRes = await fetch('/api/chat/sessions', {
          headers: authHeaders,
          cache: 'no-store',
        });
        const sessionsData = await sessionsRes.json();
        if (sessionsData.success) {
          setSessions(sessionsData.data);
          sessionStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sessionsData.data));

          if (sessionsData.data.length > 0) {
            // Prefer the cached session; otherwise load latest
            const latest = sessionsData.data[0].id;
            const targetSessionId = cachedSessionId && sessionsData.data.find((s: ChatSession) => s.id === cachedSessionId)
              ? cachedSessionId
              : latest;
            setCurrentSessionId(targetSessionId);
            await loadSessionMessages(targetSessionId);
          } else {
            setHistoryLoaded(true);
          }
        } else {
          setHistoryLoaded(true);
        }
      } catch (e) {
        console.error('Failed to load sessions:', e);
        setHistoryLoaded(true);
      }
    })();
  }, [isTelegramReady, JSON.stringify(authHeaders)]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setSessionsOpen(false);
    sessionStorage.removeItem(HISTORY_CACHE_KEY);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setSessionsOpen(false);
    void loadSessionMessages(sessionId);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Удалить этот чат?')) return;
    try {
      await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      setSessions(prev => {
        const updated = prev.filter(s => s.id !== sessionId);
        sessionStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(updated));
        return updated;
      });
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        sessionStorage.removeItem(HISTORY_CACHE_KEY);
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const handleClearHistory = async () => {
    if (!currentSessionId) return;
    if (!confirm('Очистить текущий чат?')) return;
    setClearing(true);
    try {
      await fetch(`/api/chat/history?sessionId=${encodeURIComponent(currentSessionId)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      setMessages([]);
      setSessions(prev => prev.filter(s => s.id !== currentSessionId));
      setCurrentSessionId(null);
      sessionStorage.removeItem(HISTORY_CACHE_KEY);
    } catch (e) {
      console.error('Failed to clear history:', e);
    } finally {
      setClearing(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('Фото слишком большое (макс. 20 МБ)');
      return;
    }
    const optimized = await optimizeImage(file);
    if (optimized) {
      setPendingImage(optimized);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pendingImage) || isLoading) return;
    if (!isTelegramReady) return;

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input || '📷 Фото',
      imagePreview: pendingImage || undefined,
    };
    setMessages(prev => [...prev, userMessage]);
    const imageToSend = pendingImage;
    setInput('');
    setPendingImage(null);
    setIsLoading(true);

    const updatedMessages = [...messages, userMessage];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ 
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })), 
          sessionId: currentSessionId,
          imageBase64: imageToSend || undefined,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Ошибка HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) errorMsg = errData.error;
        } catch {
          if (response.status === 504) {
            errorMsg = 'Время ожидания ответа истекло (таймаут сервера). Попробуйте отправить фото ещё раз.';
          } else if (response.status === 413) {
            errorMsg = 'Изображение слишком большое для сервера.';
          } else if (response.status === 429) {
            errorMsg = 'Слишком много запросов. Пожалуйста, подождите минуту.';
          } else if (response.status === 502) {
            errorMsg = 'Сервер временно недоступен (502 Bad Gateway).';
          }
        }
        throw new Error(errorMsg);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantContent = '';
      
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value, { stream: true });
          assistantContent += chunkValue;
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
        }
      }

      // Read session id from response header
      const newSessionId = response.headers.get('X-Session-Id') || currentSessionId;
      if (newSessionId && newSessionId !== currentSessionId) {
        const cleanContent = userMessage.content.split('[Текст со скриншота]:')[0].trim();
        const title = cleanContent.split(' ').slice(0, 5).join(' ').substring(0, 60) || 'Новый чат';
        const newSession: ChatSession = { id: newSessionId, title, createdAt: new Date().toISOString() };
        setSessions(prev => {
          const updated = prev.find(s => s.id === newSessionId)
            ? prev
            : [newSession, ...prev];
          sessionStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(updated));
          return updated;
        });
        setCurrentSessionId(newSessionId);
      }

      // Update cache with final messages
      const finalMessages: Message[] = [...messages, userMessage, { id: assistantId, role: 'assistant', content: assistantContent }];
      if (newSessionId) {
        sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ sessionId: newSessionId, messages: finalMessages }));
      }
    } catch (e) {
      console.error(e);
      const errorId = (Date.now() + 2).toString();
      setMessages(prev => [...prev.filter(m => m.content !== ''), { id: errorId, role: 'assistant', content: `⚠️ Ошибка: ${getErrorMessage(e)}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (access !== 'ok') {
    if (access === 'loading') {
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
    return <NoAccessScreen access={access} requestAccess={requestAccess} requestStatus={requestStatus} />;
  }

  return (
    <div className="page-shell" style={{ paddingBottom: 'calc(130px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="header">
        <h1
          onClick={() => scrollToBottom(true)}
          style={{ margin: 0, fontSize: 20, fontWeight: 600, cursor: 'pointer' }}
          title="Прокрутить в самый низ"
        >
          Чат
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {currentSessionId && (
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={() => setSessionsOpen(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <MessageSquare size={18} />
            {sessions.length > 0 && (
              <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--accent)' }}>{sessions.length}</span>
            )}
          </button>
          <button
            onClick={handleNewChat}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {!isTelegramReady && !authError && (
        <div className="status-banner pending">
          <div className="pulse-dot" />
          <div>
            <div className="status-banner-title">Подключаем Telegram</div>
            <div className="status-banner-text">Жду подтверждённую Telegram-сессию, чтобы сообщения отправлялись без ошибок и перезагрузок.</div>
          </div>
        </div>
      )}

      {authError && (
        <div className="status-banner error">
          <div>
            <div className="status-banner-title">Сессия не подтверждена</div>
            <div className="status-banner-text">{authError}</div>
          </div>
        </div>
      )}

      <div className="message-stack">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            {!historyLoaded && isTelegramReady ? 'Загрузка истории...' : isTelegramReady ? 'Задайте вопрос по вашей базе инструкций.' : 'Подготавливаю защищённую сессию для чата.'}
          </div>
        )}
        
        {messages.map((m, idx) => (
          <div key={m.id} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div className={`${m.role === 'user' ? 'zinc-user-message' : 'zinc-card'} message-bubble ${m.role === 'user' ? 'user' : 'assistant'}`} style={{ 
              borderLeft: m.role === 'user' ? 'none' : '3px solid var(--accent)',
            }}>
              {m.role === 'user' && (
                <div className="message-meta">Вы</div>
              )}
              {m.imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={m.imagePreview} 
                  alt="Фото" 
                  style={{ width: '100%', maxWidth: 240, borderRadius: 8, marginBottom: 8, display: 'block' }}
                />
              )}
              <div className="message-text" style={{ whiteSpace: m.role === 'assistant' ? 'normal' : 'pre-wrap' }}>
                {m.role === 'assistant' ? (
                  isLoading && idx === messages.length - 1 ? (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  ) : (
                    <MarkdownText content={m.content} imageSize="full" />
                  )
                ) : (
                  (() => {
                    const ocrMarker = '[Текст со скриншота]:';
                    const markerIndex = m.content.indexOf(ocrMarker);
                    const userText = markerIndex > 0 ? m.content.slice(0, markerIndex).trim() : (m.content.includes(ocrMarker) ? '' : m.content);
                    const ocrText = markerIndex >= 0 ? m.content.slice(markerIndex + ocrMarker.length).trim() : '';
                    return (
                      <>
                        {userText && userText !== '📷 Фото' && <div>{userText}</div>}
                        {ocrText && (
                          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                            <div style={{ marginBottom: 4, fontWeight: 500 }}>📝 Распознанный текст:</div>
                            {ocrText}
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="zinc-card message-bubble assistant" style={{ padding: '12px 16px' }}>
              <div className="typing-dots"><span></span><span></span><span></span></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="panel-fixed composer-bar">
        {pendingImage && (
          <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={pendingImage} 
              alt="Preview" 
              style={{ height: 80, borderRadius: 8, objectFit: 'cover' }}
            />
            <button
              onClick={() => setPendingImage(null)}
              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isTelegramReady || !!authError || isLoading}
            style={{ width: 48, height: 48, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <Paperclip size={20} />
          </button>
          <input 
            type="text" 
            className="input-field" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={isTelegramReady ? (pendingImage ? 'Опишите проблему (необязательно)...' : 'Спросите что-нибудь...') : 'Подключаю Telegram...'} 
            style={{ flex: 1 }}
            disabled={!isTelegramReady || !!authError}
          />
          <button type="submit" className="btn-primary" style={{ width: 48, height: 48, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} disabled={isLoading || (!input.trim() && !pendingImage) || !isTelegramReady || !!authError}>
            <Send size={20} />
          </button>
        </form>
      </div>

      {sessionsOpen && (
        <div
          onClick={() => setSessionsOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 90, animation: 'page-enter 0.2s ease both' }}
        />
      )}

      {sessionsOpen && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '75vh',
          maxHeight: 'min(80dvh, 80vh)',
          minHeight: 320,
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border-subtle)',
          borderRadius: '16px 16px 0 0',
          zIndex: 95,
          display: 'flex',
          flexDirection: 'column',
          animation: 'edit-slide-in 0.25s var(--ease-out) both',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>История чатов</h2>
            <button onClick={() => setSessionsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={22} />
            </button>
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 24px))',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}>
            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                Нет сохранённых чатов
              </div>
            ) : (
              sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    borderRadius: 10,
                    marginBottom: 8,
                    background: currentSessionId === s.id ? 'rgba(251,146,60,0.15)' : 'transparent',
                    border: `1px solid ${currentSessionId === s.id ? 'var(--accent)' : '#27272a'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title.split('[Текст со скриншота]:')[0].trim()}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(s.createdAt).toLocaleDateString('ru-RU')}</div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', padding: 4, flexShrink: 0 }}
                  >
                    <Trash size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
