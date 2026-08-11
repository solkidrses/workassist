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
    <div className="panel-fixed bottom-nav">
      {items.map(({ href, label, icon: Icon, match }) => {
        const isActive = match(pathname);
        return (
          <Link key={href} href={href} className={`bottom-nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={22} />
            <span style={{ fontSize: 10, marginTop: 4, fontWeight: isActive ? 500 : 400 }}>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
