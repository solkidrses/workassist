'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTelegramInitData } from '@/lib/useTelegramInitData';

type AccessState = 'loading' | 'ok' | 'no_access' | 'pending' | 'rejected';
type UserRole = 'admin' | 'viewer' | null;

type AccessContextValue = {
  access: AccessState;
  role: UserRole;
  requestAccess: () => Promise<void>;
  requestStatus: string | null;
  authHeaders: Record<string, string>;
  isTelegramReady: boolean;
  authError: string | null;
};

const AccessContext = createContext<AccessContextValue>({
  access: 'loading',
  role: null,
  requestAccess: async () => {},
  requestStatus: null,
  authHeaders: {},
  isTelegramReady: false,
  authError: null,
});

export function useAccessCheck(): AccessContextValue {
  return useContext(AccessContext);
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();
  const [access, setAccess] = useState<AccessState>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('wa_cached_access');
      if (cached === 'ok') return 'ok';
    }
    return process.env.NODE_ENV !== 'production' ? 'ok' : 'loading';
  });
  const [role, setRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('wa_cached_role');
      if (cached === 'admin' || cached === 'viewer') return cached;
    }
    return process.env.NODE_ENV !== 'production' ? 'admin' : null;
  });
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isTelegramReady) return;

    const check = async () => {
      try {
        const res = await fetch('/api/users?me=1', { headers: authHeaders, cache: 'no-store' });
        const data = await res.json().catch(() => null);

        if (res.ok && data?.success) {
          const newRole: UserRole = data.data.role === 'admin' ? 'admin' : 'viewer';
          setRole(newRole);
          setAccess('ok');
          try {
            sessionStorage.setItem('wa_cached_role', newRole);
            sessionStorage.setItem('wa_cached_access', 'ok');
          } catch {}
          return;
        }

        if (data?.code === 'PENDING') setAccess('pending');
        else if (data?.code === 'REJECTED') setAccess('rejected');
        else if (data?.code === 'BANNED') setAccess('no_access');
        else setAccess('no_access');

        try {
          sessionStorage.removeItem('wa_cached_role');
          sessionStorage.removeItem('wa_cached_access');
        } catch {}
      } catch {
        try {
          if (sessionStorage.getItem('wa_cached_access') !== 'ok') {
            setAccess('no_access');
          }
        } catch {
          setAccess('no_access');
        }
      }
    };

    check();
    const refreshInterval = setInterval(check, 90 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [isTelegramReady, JSON.stringify(authHeaders)]);

  useEffect(() => {
    if (authError) setAccess('no_access');
  }, [authError]);

  const requestAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/access-request', {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        setRequestStatus(data.data?.message || 'Заявка отправлена');
        if (data.data?.status === 'pending') setAccess('pending');
      } else {
        setRequestStatus(data.error || 'Ошибка');
      }
    } catch {
      setRequestStatus('Ошибка сети');
    }
  }, [JSON.stringify(authHeaders)]);

  return (
    <AccessContext.Provider value={{ access, role, requestAccess, requestStatus, authHeaders, isTelegramReady, authError }}>
      {children}
    </AccessContext.Provider>
  );
}
