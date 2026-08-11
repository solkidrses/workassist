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
};

const AccessContext = createContext<AccessContextValue>({
  access: 'loading',
  role: null,
  requestAccess: async () => {},
  requestStatus: null,
});

export function useAccessCheck(): AccessContextValue {
  return useContext(AccessContext);
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();
  const [access, setAccess] = useState<AccessState>('loading');
  const [role, setRole] = useState<UserRole>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isTelegramReady) return;

    const check = async () => {
      try {
        const res = await fetch('/api/users?me=1', { headers: authHeaders, cache: 'no-store' });
        const data = await res.json().catch(() => null);

        if (res.ok && data?.success) {
          setRole(data.data.role === 'admin' ? 'admin' : 'viewer');
          setAccess('ok');
          return;
        }

        if (data?.code === 'PENDING') setAccess('pending');
        else if (data?.code === 'REJECTED') setAccess('rejected');
        else setAccess('no_access');
      } catch {
        setAccess('no_access');
      }
    };

    check();
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
    <AccessContext.Provider value={{ access, role, requestAccess, requestStatus }}>
      {children}
    </AccessContext.Provider>
  );
}
