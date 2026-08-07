'use client'

import Link from 'next/link';
import { Book, MessageSquare, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTelegramInitData } from '@/lib/useTelegramInitData';

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
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            {isTelegramReady ? 'Задайте вопрос по вашей базе инструкций.' : 'Подготавливаю защищённую сессию для чата.'}
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
              <div className="message-meta">
                {m.role === 'user' ? 'Вы' : 'ИИ-Ассистент'}
              </div>
              <div className="message-text">
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="zinc-card message-bubble assistant" style={{ padding: '12px 16px' }}>
              <div className="message-meta">ИИ-Ассистент</div>
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

      <div className="panel-fixed bottom-nav">
        <Link href="/" className="bottom-nav-link">
          <Book size={24} />
          <span style={{ fontSize: 10, marginTop: 4 }}>База</span>
        </Link>
        <Link href="/chat" className="bottom-nav-link active">
          <MessageSquare size={24} />
          <span style={{ fontSize: 10, marginTop: 4, fontWeight: 500 }}>Чат</span>
        </Link>
      </div>
    </div>
  );
}
