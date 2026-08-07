'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Book, MessageSquare } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const showNav = pathname === '/' || pathname === '/chat';
  if (!showNav) return null;

  return (
    <div className="panel-fixed bottom-nav">
      <Link href="/" className={`bottom-nav-link ${pathname === '/' ? 'active' : ''}`}>
        <Book size={24} />
        <span style={{ fontSize: 10, marginTop: 4, fontWeight: pathname === '/' ? 500 : 400 }}>База</span>
      </Link>
      <Link href="/chat" className={`bottom-nav-link ${pathname === '/chat' ? 'active' : ''}`}>
        <MessageSquare size={24} />
        <span style={{ fontSize: 10, marginTop: 4, fontWeight: pathname === '/chat' ? 500 : 400 }}>Чат</span>
      </Link>
    </div>
  );
}
