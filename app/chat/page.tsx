'use client'

import { Send, Trash2, Plus, MessageSquare, X, Trash } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTelegramInitData } from '@/lib/useTelegramInitData';
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
}

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
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
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const HISTORY_CACHE_KEY = 'chat_history_cache';
  const SESSIONS_CACHE_KEY = 'chat_sessions_cache';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    if (!isTelegramReady) return;

    // Try cache first for instant display
    try {
      const cached = sessionStorage.getItem(HISTORY_CACHE_KEY);
      if (cached) {
        const cache = JSON.parse(cached) as { sessionId: string; messages: Message[] };
        if (cache.messages.length > 0) {
          setMessages(cache.messages);
          setCurrentSessionId(cache.sessionId);
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

          // If no cached session, load latest
          if (sessionsData.data.length > 0) {
            const latest = sessionsData.data[0].id;
            setCurrentSessionId(latest);
            await loadSessionMessages(latest);
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
  }, [authHeaders, isTelegramReady]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
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
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        sessionStorage.removeItem(HISTORY_CACHE_KEY);
      }
      const updated = sessions.filter(s => s.id !== sessionId);
      sessionStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(updated));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (!isTelegramReady) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const updatedMessages = [...messages, userMessage];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ messages: updatedMessages, sessionId: currentSessionId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
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
        setCurrentSessionId(newSessionId);
      }

      // Refresh sessions list
      try {
        const sessionsRes = await fetch('/api/chat/sessions', {
          headers: authHeaders,
          cache: 'no-store',
        });
        const sessionsData = await sessionsRes.json();
        if (sessionsData.success) {
          setSessions(sessionsData.data);
          sessionStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sessionsData.data));
        }
      } catch {}

      // Update cache with final messages
      setMessages(prev => {
        const updated = [...prev];
        if (newSessionId) {
          sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ sessionId: newSessionId, messages: updated }));
        }
        return updated;
      });
    } catch (e) {
      console.error(e);
      const errorId = (Date.now() + 2).toString();
      setMessages(prev => [...prev.filter(m => m.content !== ''), { id: errorId, role: 'assistant', content: `⚠️ Ошибка: ${getErrorMessage(e)}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-shell" style={{ paddingBottom: 130 }}>
      <div className="header">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Чат</h1>
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
        
        {messages.map(m => (
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
              <div className="message-text">
                {m.role === 'assistant' ? <MarkdownText content={m.content} /> : m.content}
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <input 
            type="text" 
            className="input-field" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={isTelegramReady ? 'Спросите что-нибудь...' : 'Подключаю Telegram...'} 
            style={{ flex: 1 }}
            disabled={!isTelegramReady || !!authError}
          />
          <button type="submit" className="btn-primary" style={{ width: 48, height: 48, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} disabled={isLoading || !input.trim() || !isTelegramReady || !!authError}>
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', borderRadius: '16px 16px 0 0', zIndex: 95, maxHeight: '70vh', display: 'flex', flexDirection: 'column', animation: 'edit-slide-in 0.25s var(--ease-out) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>История чатов</h2>
            <button onClick={() => setSessionsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={22} />
            </button>
          </div>
          <div style={{ overflowY: 'auto', padding: '8px 16px 16px' }}>
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
                    <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
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
