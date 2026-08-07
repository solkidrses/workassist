'use client'

import { Send, Trash2 } from 'lucide-react';
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const HISTORY_CACHE_KEY = 'chat_history_cache';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    if (!isTelegramReady) return;

    // Try cache first for instant display
    try {
      const cached = sessionStorage.getItem(HISTORY_CACHE_KEY);
      if (cached) {
        const cachedMessages: Message[] = JSON.parse(cached);
        if (cachedMessages.length > 0) {
          setMessages(cachedMessages);
          setHistoryLoaded(true);
        }
      }
    } catch {}

    // Fetch fresh from server
    (async () => {
      try {
        const res = await fetch('/api/chat/history', {
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
          sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(historyMessages));
        } else {
          setMessages([]);
          sessionStorage.removeItem(HISTORY_CACHE_KEY);
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [authHeaders, isTelegramReady]);

  const handleClearHistory = async () => {
    if (!confirm('Очистить всю историю чата?')) return;
    setClearing(true);
    try {
      await fetch('/api/chat/history', {
        method: 'DELETE',
        headers: authHeaders,
      });
      setMessages([]);
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
        body: JSON.stringify({ messages: updatedMessages }),
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

      // Update cache with final messages
      setMessages(prev => {
        const updated = [...prev];
        sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(updated));
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
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <Trash2 size={18} />
          </button>
        )}
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
    </div>
  );
}
