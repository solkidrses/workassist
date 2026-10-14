'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Book, MessageSquare } from 'lucide-react';
import { useAccessCheck } from '@/lib/AccessProvider';

export default function BottomNav() {
  const pathname = usePathname();
  const { access, role } = useAccessCheck();

  if (access !== 'ok') {
    return null;
  }

  const items = [
    ...(role === 'admin' ? [{ href: '/admin', label: 'Админка', icon: Settings, match: (p: string) => p.startsWith('/admin') }] : []),
    { href: '/', label: 'База', icon: Book, match: (p: string) => p === '/' || p.startsWith('/instruction') || p.startsWith('/upload') },
    { href: '/chat', label: 'Чат', icon: MessageSquare, match: (p: string) => p.startsWith('/chat') },
  ];

  return (
    <nav className="panel-fixed bottom-nav" aria-label="Основная навигация">
      <div className="bottom-nav-inner">
        {items.map(({ href, label, icon: Icon, match }) => {
          const isActive = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={(e) => {
                if (isActive) {
                  if (href === '/chat') {
                    window.dispatchEvent(new CustomEvent('scroll-chat-to-bottom'));
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                } else if (href === '/chat') {
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('scroll-chat-to-bottom'));
                  }, 100);
                }
              }}
              className={`bottom-nav-link ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={22} style={{ pointerEvents: 'none', flexShrink: 0 }} />
              <span style={{ fontSize: 11, marginTop: 3, fontWeight: isActive ? 600 : 400, pointerEvents: 'none', lineHeight: 1, display: 'block', width: '100%', textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
