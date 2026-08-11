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
  // In Telegram: spinner → fetch /api/auth → cookie set → reload → app loads
  // In browser: blank dark page (no Telegram initData available)
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title></title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #09090b; }
  .spinner {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 32px; height: 32px;
    border: 3px solid #27272a;
    border-top-color: #ff7c3b;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div id="spinner" class="spinner"></div>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script>
    (function() {
      var webApp = window.Telegram && window.Telegram.WebApp;
      if (!webApp || !webApp.initData) {
        document.getElementById('spinner').style.display = 'none';
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
        if (res.ok) window.location.reload();
        else document.getElementById('spinner').style.display = 'none';
      }).catch(function() {
        document.getElementById('spinner').style.display = 'none';
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
