'use client'

import { useEffect, useMemo, useState } from 'react';

type TelegramWebApp = {
  initData?: string;
  ready: () => void;
  expand?: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const INIT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 150;

export function useTelegramInitData() {
  const [initDataRaw, setInitDataRaw] = useState('');
  const [isTelegramReady, setIsTelegramReady] = useState(process.env.NODE_ENV !== 'production');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let isDisposed = false;
    const startedAt = Date.now();

    const syncTelegramState = () => {
      const webApp = window.Telegram?.WebApp;
      if (!webApp) {
        if (process.env.NODE_ENV !== 'production') {
          setIsTelegramReady(true);
        }
        return false;
      }

      webApp.ready();
      webApp.expand?.();

      const nextInitData = webApp.initData?.trim() ?? '';
      if (nextInitData) {
        if (!isDisposed) {
          setInitDataRaw((current) => current || nextInitData);
          setIsTelegramReady(true);
          setAuthError(null);
        }
        return true;
      }

      if (process.env.NODE_ENV !== 'production') {
        setIsTelegramReady(true);
        return true;
      }

      return false;
    };

    if (syncTelegramState()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (syncTelegramState()) {
        window.clearInterval(intervalId);
        return;
      }

      if (Date.now() - startedAt >= INIT_TIMEOUT_MS) {
        window.clearInterval(intervalId);
        if (!isDisposed) {
          setAuthError('Не удалось получить Telegram-сессию. Откройте Mini App через кнопку в боте.');
          setIsTelegramReady(false);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (initDataRaw) {
      headers['x-telegram-init-data'] = initDataRaw;
    }
    return headers;
  }, [initDataRaw]);

  return {
    initDataRaw,
    authHeaders,
    isTelegramReady,
    authError,
  };
}
