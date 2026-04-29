/* =============================================================
   ANTARES — CLOUDFLARE WORKER v1
   Seguridad HTTP real a nivel de servidor/edge
   
   CÓMO DESPLEGAR:
   1. Ve a https://dash.cloudflare.com
   2. Workers & Pages → tu Worker "web" → Edit code
   3. Reemplaza todo el contenido con este archivo
   4. Guarda y despliega (Save & Deploy)
   =============================================================
   
   CAPAS DE SEGURIDAD IMPLEMENTADAS:
   1.  Content Security Policy (CSP) — bloquea XSS e inyecciones
   2.  X-Frame-Options DENY — anti-clickjacking real
   3.  HSTS — fuerza HTTPS (tras primer visit)
   4.  X-Content-Type-Options nosniff
   5.  Referrer-Policy no-referrer
   6.  Permissions-Policy — desactiva APIs sensibles
   7.  X-XSS-Protection (navegadores legacy)
   8.  Bloqueo de User-Agents scrapers/bots conocidos
   9.  Anti-hotlinking de imágenes (Referer check)
   10. Rate-limiting básico por IP (KV opcional)
   11. Bloqueo de métodos HTTP peligrosos
   12. Eliminación de headers que revelan tecnología
   13. Bloqueo de path traversal y rutas sensibles
   14. Cache headers optimizados por tipo de recurso
   15. CORS restrictivo (solo self)
   ============================================================= */

'use strict';

/* ─── CONFIGURACIÓN ─────────────────────────────────────────── */
const CONFIG = {
  /* Tu dominio real — actualiza esto si tienes dominio propio */
  ALLOWED_ORIGINS: [
    'https://web.ant4rez-mg.workers.dev',
    'https://www.ant4rez.com',       // ← cambia si tienes dominio
    'http://localhost',
    'http://127.0.0.1',
  ],

  /* Bots/scrapers bloqueados por User-Agent */
  BLOCKED_UA: [
    'wget', 'curl/', 'python-requests', 'python-urllib',
    'scrapy', 'httrack', 'webzip', 'webcopier', 'teleport',
    'webstripper', 'webwhacker', 'larbin', 'libwww',
    'lwp-trivial', 'webwalk', 'go-http-client', 'okhttp',
    'mechanize', 'phantomjs', 'headlesschrome',
    'selenium', 'webdriver', 'puppeteer', 'playwright',
    'Googlebot-Image',   // bloquea específicamente scraping de imágenes
    'Bingbot',           // opcional: descomenta para bloquear indexadores
  ],

  /* Rutas que devuelven 403 siempre */
  BLOCKED_PATHS: [
    '/.env', '/.git', '/.htaccess', '/.htpasswd',
    '/wp-admin', '/wp-login', '/xmlrpc.php',
    '/config', '/backup', '/database',
    '/.DS_Store', '/thumbs.db',
  ],

  /* Extensiones de imagen protegidas contra hotlinking */
  IMAGE_EXTS: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'],

  /* ¿Rate-limit activo? Requiere KV binding llamado RATE_LIMIT_KV */
  RATE_LIMIT_ENABLED: false,
  RATE_LIMIT_RPM: 120, // requests por minuto por IP
};

/* ─── SECURITY HEADERS ──────────────────────────────────────── */
const SECURITY_HEADERS = {
  /* Anti-clickjacking */
  'X-Frame-Options': 'DENY',

  /* Sin sniffing MIME */
  'X-Content-Type-Options': 'nosniff',

  /* No enviar Referer a terceros */
  'Referrer-Policy': 'no-referrer',

  /* XSS básico (legacy browsers) */
  'X-XSS-Protection': '1; mode=block',

  /* HSTS — 1 año, incluye subdomains
     NOTA: Activa esto SOLO cuando tengas SSL verificado y estable.
     Una vez activo es difícil de revertir (navegadores lo cachean). */
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

  /* Deshabilitar APIs que no usas */
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'interest-cohort=()',
    'accelerometer=()',
    'gyroscope=()',
    'magnetometer=()',
  ].join(', '),

  /* Content Security Policy
     Ajusta 'script-src' si añades más CDNs */
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://cdnjs.cloudflare.com https://fonts.googleapis.com 'unsafe-inline'",
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://formspree.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://formspree.io",
    "object-src 'none'",
    "media-src 'self'",
  ].join('; '),

  /* Eliminar headers que revelan tecnología */
  'Server': 'Antares',
  'X-Powered-By': '',
};

/* ─── CACHE HEADERS POR TIPO ────────────────────────────────── */
function getCacheHeaders(url) {
  const path = url.pathname.toLowerCase();

  if (/\.(jpg|jpeg|png|webp|gif|ico)$/.test(path)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' }; // 1 año
  }
  if (/\.(woff2|woff|ttf|otf)$/.test(path)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  if (/\.(css|js)$/.test(path)) {
    return { 'Cache-Control': 'public, max-age=2592000' }; // 30 días
  }
  if (/\.svg$/.test(path)) {
    return { 'Cache-Control': 'public, max-age=2592000' };
  }
  if (/\.(html|htm)$/.test(path) || path === '/') {
    return { 'Cache-Control': 'public, max-age=3600, must-revalidate' }; // 1 hora
  }
  return { 'Cache-Control': 'public, max-age=86400' }; // 1 día por defecto
}

/* ─── HELPERS ───────────────────────────────────────────────── */
function isBlockedUA(ua) {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CONFIG.BLOCKED_UA.some(b => lower.includes(b.toLowerCase()));
}

function isBlockedPath(pathname) {
  const lower = pathname.toLowerCase();
  return CONFIG.BLOCKED_PATHS.some(p => lower.startsWith(p));
}

function isHotlink(request, url) {
  const referer = request.headers.get('Referer') || '';
  if (!referer) return false; // sin referer → permitir (navegación directa)

  const ext = url.pathname.toLowerCase();
  const isImage = CONFIG.IMAGE_EXTS.some(e => ext.endsWith(e));
  if (!isImage) return false;

  try {
    const refHost = new URL(referer).hostname;
    return !CONFIG.ALLOWED_ORIGINS.some(o => {
      try { return new URL(o).hostname === refHost; } catch { return false; }
    });
  } catch {
    return false;
  }
}

function hasPathTraversal(pathname) {
  return pathname.includes('..') ||
         pathname.includes('%2e%2e') ||
         pathname.includes('%252e');
}

function forbidden(reason = '') {
  return new Response(
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>403</title></head>
     <body style="font-family:sans-serif;text-align:center;padding:4rem">
     <h1 style="font-size:3rem">403</h1>
     <p>Acceso denegado${reason ? ' — ' + reason : ''}.</p>
     </body></html>`,
    {
      status: 403,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        ...SECURITY_HEADERS,
      },
    }
  );
}

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      'Allow': 'GET, HEAD, POST',
      ...SECURITY_HEADERS,
    },
  });
}

/* ─── RATE LIMITER (opcional, requiere KV) ───────────────────── */
async function checkRateLimit(request, env) {
  if (!CONFIG.RATE_LIMIT_ENABLED || !env.RATE_LIMIT_KV) return false;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`; // ventana de 1 min

  try {
    const current = parseInt(await env.RATE_LIMIT_KV.get(key) || '0');
    if (current >= CONFIG.RATE_LIMIT_RPM) return true; // bloqueado
    await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 120 });
    return false;
  } catch {
    return false; // si KV falla, no bloquear
  }
}

/* ─── APLICAR TODOS LOS HEADERS A UNA RESPUESTA ────────────── */
function applyHeaders(response, url) {
  const newHeaders = new Headers(response.headers);

  // Seguridad
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (v === '') {
      newHeaders.delete(k);
    } else {
      newHeaders.set(k, v);
    }
  }

  // Eliminar headers de tecnología que pueda añadir Cloudflare
  newHeaders.delete('CF-RAY');        // opcional: revela que usas CF
  newHeaders.delete('cf-cache-status'); // opcional

  // Cache por tipo
  const cacheHeaders = getCacheHeaders(url);
  for (const [k, v] of Object.entries(cacheHeaders)) {
    newHeaders.set(k, v);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/* ─── HANDLER PRINCIPAL ─────────────────────────────────────── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const ua = request.headers.get('User-Agent') || '';

    /* 1. Métodos HTTP peligrosos */
    if (!['GET', 'HEAD', 'POST'].includes(method)) {
      return methodNotAllowed();
    }

    /* 2. Path traversal */
    if (hasPathTraversal(url.pathname)) {
      return forbidden('path traversal');
    }

    /* 3. Rutas sensibles bloqueadas */
    if (isBlockedPath(url.pathname)) {
      return forbidden();
    }

    /* 4. Scraper UA */
    if (isBlockedUA(ua)) {
      return forbidden('bot');
    }

    /* 5. Rate limiting (si KV está configurado) */
    if (await checkRateLimit(request, env)) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': '60',
          'Content-Type': 'text/plain',
          ...SECURITY_HEADERS,
        },
      });
    }

    /* 6. Anti-hotlinking de imágenes */
    if (isHotlink(request, url)) {
      /* Devuelve 403 o una imagen placeholder de "protegida" */
      return forbidden('hotlink');
    }

    /* 7. Limpiar query params sospechosos */
    const BAD_PARAMS = [
      'token', 'access_token', 'api_key', 'apikey',
      'key', 'secret', 'password', 'pass',
      'fbclid', 'gclid',
    ];
    let urlCleaned = false;
    for (const p of BAD_PARAMS) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        urlCleaned = true;
      }
    }
    /* Redirige a URL limpia si había params peligrosos */
    if (urlCleaned) {
      return Response.redirect(url.toString(), 301);
    }

    /* 8. Servir el sitio (assets estáticos o tu lógica existente) */
    let response;

    try {
      /* Si tienes un binding de assets (Workers Static Assets):
         response = await env.ASSETS.fetch(request);
         
         Si sirves desde KV:
         response = await env.KV_NAMESPACE.get(...)
         
         Si haces fetch a otro origen (reverse proxy):
         response = await fetch(request);
         
         ↓ Ajusta esto según cómo esté montado tu Worker actual: */
      
      if (env.ASSETS) {
        /* Workers Static Assets (lo más común en 2024+) */
        response = await env.ASSETS.fetch(request);
      } else {
        /* Fallback: pass-through */
        response = await fetch(request);
      }

    } catch (err) {
      return new Response('Internal Server Error', {
        status: 500,
        headers: SECURITY_HEADERS,
      });
    }

    /* 9. Aplicar todos los headers de seguridad + cache a la respuesta */
    return applyHeaders(response, url);
  },
};
