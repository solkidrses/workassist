import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionEdge } from '@/lib/sessionCookieEdge'

const PUBLIC_PATHS = ['/api/auth', '/api/access-request']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow API auth endpoint and access requests
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  // Check session cookie
  const cookieHeader = request.headers.get('cookie')
  const hasSession = await verifySessionEdge(cookieHeader)

  if (hasSession) {
    return NextResponse.next()
  }

  // No valid session — return a bootstrap page
  // This page tries to get Telegram initData, sends it to /api/auth,
  // then reloads. If no Telegram (direct browser access), shows a message.
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Загрузка...</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #09090b;
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
  }
  .center {
    text-align: center;
    padding: 24px;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #27272a;
    border-top-color: #ff7c3b;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }
  .msg {
    font-size: 15px;
    color: #a1a1aa;
    line-height: 1.5;
  }
  .msg strong { color: #fafafa; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hidden { display: none; }
</style>
</head>
<body>
  <div class="center">
    <div id="loading">
      <div class="spinner"></div>
      <div class="msg">Загрузка...</div>
    </div>
    <div id="error" class="hidden">
      <div class="msg">
        <strong>Откройте приложение через бота в Telegram</strong><br><br>
        Это приложение доступно только внутри Telegram.
      </div>
    </div>
  </div>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script>
    (function() {
      var webApp = window.Telegram && window.Telegram.WebApp;
      if (!webApp || !webApp.initData) {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
        return;
      }
      webApp.ready();
      webApp.expand && webApp.expand();
      webApp.setBackgroundColor && webApp.setBackgroundColor('#09090b');
      webApp.setBottomBarColor && webApp.setBottomBarColor('#09090b');
      webApp.setHeaderColor && webApp.setHeaderColor('#09090b');

      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: webApp.initData })
      }).then(function(res) {
        if (res.ok) {
          window.location.reload();
        } else {
          document.getElementById('loading').classList.add('hidden');
          document.getElementById('error').classList.remove('hidden');
        }
      }).catch(function() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
      });
    })();
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
