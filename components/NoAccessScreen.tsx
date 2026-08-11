'use client'

import { Lock, Clock, XCircle, Loader2 } from 'lucide-react';

type Props = {
  access: 'loading' | 'no_access' | 'pending' | 'rejected';
  requestAccess: () => Promise<void>;
  requestStatus: string | null;
};

export function NoAccessScreen({ access, requestAccess, requestStatus }: Props) {
  if (access === 'loading') {
    return (
      <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  let icon = <Lock size={48} style={{ opacity: 0.3, marginBottom: 16 }} />;
  let title = 'Нет доступа';
  let message = 'У вас нет доступа к этому приложению. Запросите доступ у администратора.';
  let showButton = true;
  let buttonText = 'Запросить доступ';

  if (access === 'pending') {
    icon = <Clock size={48} style={{ opacity: 0.3, marginBottom: 16 }} />;
    title = 'Заявка на рассмотрении';
    message = 'Ваша заявка отправлена. Ожидайте одобрения от администратора.';
    showButton = false;
  } else if (access === 'rejected') {
    icon = <XCircle size={48} style={{ opacity: 0.3, marginBottom: 16 }} />;
    title = 'Доступ отклонён';
    message = 'Администратор отклонил вашу заявку. Вы можете отправить её повторно.';
    buttonText = 'Запросить снова';
  }

  return (
    <div className="page-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
          {icon}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
          {message}
        </p>
        {showButton && (
          <button
            onClick={requestAccess}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              backgroundColor: 'var(--accent)', color: '#000', fontWeight: 600,
              cursor: 'pointer', fontSize: 14,
            }}
          >
            {buttonText}
          </button>
        )}
        {requestStatus && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
            {requestStatus}
          </p>
        )}
      </div>
    </div>
  );
}
