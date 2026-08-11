'use client'

import { useEffect, useState } from 'react';
import { useTelegramInitData } from '@/lib/useTelegramInitData';

type AccessState = 'loading' | 'ok' | 'no_access' | 'pending' | 'rejected';

export function useAccessCheck(): { access: AccessState; requestAccess: () => Promise<void>; requestStatus: string | null } {
  const { authHeaders, isTelegramReady, authError } = useTelegramInitData();
  const [access, setAccess] = useState<AccessState>('loading');
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isTelegramReady) return;

    const check = async () => {
      try {
        const res = await fetch('/api/instructions', { headers: authHeaders, cache: 'no-store' });
        if (res.ok) {
          setAccess('ok');
        } else if (res.status === 403) {
          const data = await res.json();
          if (data.code === 'PENDING') setAccess('pending');
          else if (data.code === 'REJECTED') setAccess('rejected');
          else setAccess('no_access');
        } else {
          setAccess('no_access');
        }
      } catch {
        setAccess('no_access');
      }
    };

    check();
  }, [isTelegramReady, JSON.stringify(authHeaders)]);

  useEffect(() => {
    if (authError) setAccess('no_access');
  }, [authError]);

  const requestAccess = async () => {
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
  };

  return { access, requestAccess, requestStatus };
}
