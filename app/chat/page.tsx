'use client'

import Link from 'next/link';
import { Book, MessageSquare, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [initDataRaw, setInitDataRaw] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      setInitDataRaw(tg.initData || '');
    }
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

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
          'x-telegram-init-data': initDataRaw,
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

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
        const chunkValue = decoder.decode(value, { stream: true });
        
        // Very basic parsing for toTextStreamResponse format which often sends chunks like `0:"text"`
        const lines = chunkValue.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2));
              assistantContent += text;
            } catch (e) {
              // fallback
            }
          }
        }

        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  return (
    <div style={{ paddingBottom: 130, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="header">
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Чат ИИ</h1>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            Задайте вопрос по вашей базе инструкций.
          </div>
        )}
        
        {messages.map(m => (
          <div key={m.id} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div className={m.role === 'user' ? 'zinc-user-message' : 'zinc-card'} style={{ 
              maxWidth: '85%', 
              margin: 0, 
              borderLeft: m.role === 'user' ? 'none' : '3px solid var(--accent)',
              borderBottomRightRadius: m.role === 'user' ? 4 : 'var(--border-radius)',
              borderBottomLeftRadius: m.role === 'assistant' ? 4 : 'var(--border-radius)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                {m.role === 'user' ? 'Вы' : 'ИИ-Ассистент'}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="zinc-card" style={{ padding: '12px 16px', borderBottomLeftRadius: 4 }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>печатает...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{
        position: 'fixed',
        bottom: 60,
        left: 0,
        right: 0,
        padding: 16,
        backgroundColor: 'var(--bg-main)',
        borderTop: '1px solid #27272a',
        zIndex: 10
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <input 
            type="text" 
            className="input-field" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Спросите что-нибудь..." 
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-primary" style={{ width: 48, height: 48, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={isLoading || !input.trim()}>
            <Send size={20} />
          </button>
        </form>
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'var(--bg-main)',
        borderTop: '1px solid #27272a',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 10
      }}>
        <Link href="/" style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
          <Book size={24} />
          <span style={{ fontSize: 10, marginTop: 4 }}>База</span>
        </Link>
        <Link href="/chat" style={{ color: 'var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
          <MessageSquare size={24} />
          <span style={{ fontSize: 10, marginTop: 4, fontWeight: 500 }}>Чат ИИ</span>
        </Link>
      </div>
    </div>
  );
}
