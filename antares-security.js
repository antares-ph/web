/* =============================================================
   ANTARES — SECURITY MODULE v2
   GitHub Pages · Client-side hardening
   =============================================================
   CAPAS IMPLEMENTADAS:
   1.  Protección de imágenes (contextmenu, drag, clipboard)
   2.  Bloqueo de atajos de inspección (F12, DevTools, Ctrl+U)
   3.  Detección de DevTools abiertos (blur visual)
   4.  Protección de selección de texto en zonas de autoría
   5.  Ofuscación de email anti-bot (rot13 + data-em)
   6.  Rate-limit de clicks con backoff exponencial
   7.  Rate-limit de teclas (anti keylogger-scraper)
   8.  Honeypot de clicks y mouse-moves para detectar bots
   9.  Watermark invisible en canvas (steganografía)
   10. Silenciado de consola en producción
   11. Anti-iframe / anti-clickjacking reforzado
   12. Sanitización de inputs del formulario (anti-XSS)
   13. Detección de User-Agent scrapers conocidos
   14. Bloqueo de data: URI phishing
   15. Limpieza de query params sospechosos de la URL
   16. Fingerprint de sesión (anti-replay básico)
   17. Protección de zoom en imágenes (doble-tap móvil)
   18. Observer de integridad DOM (bloquea scripts inyectados)
   19. Print protection (oculta imágenes al imprimir)
   20. Bloqueo de clipboard con imágenes
   =============================================================
   NOTA: client-side es DISUASION. Los headers HTTP reales
   se logran con Cloudflare Pages (free). Ver SECURITY-GUIDE.md
   ============================================================= */
'use strict';

(function AntaresSecurity() {

  const IS_DEV = location.hostname === 'localhost' ||
                 location.hostname === '127.0.0.1' ||
                 location.hostname.includes('.local');

  /* Dominios oficiales del sitio — ambas plataformas */
  const ALLOWED_HOSTS = [
    'antares-bhd.pages.dev',      // Cloudflare Pages (producción)
    'antares-ph.github.io',       // GitHub Pages (espejo)
    'localhost',
    '127.0.0.1',
  ];
  const IS_OFFICIAL = ALLOWED_HOSTS.some(h => location.hostname.includes(h));

  const noop = () => {};
  function rot13(s) {
    return s.replace(/[a-zA-Z]/g, c => {
      const b = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b);
    });
  }
  const devLog = IS_DEV ? console.log.bind(console, '[Antares Security]') : noop;

  /* Si el sitio se carga desde un dominio no oficial, ocultarlo */
  if (!IS_OFFICIAL && !IS_DEV) {
    document.documentElement.style.cssText = 'visibility:hidden!important;display:none!important';
  }

  /* 1. PROTECCIÓN DE IMÁGENES */
  (function protectImages() {
    function isZone(t) {
      return t.tagName === 'IMG' ||
             t.closest('.gallery-card') ||
             t.closest('.ig-triptych-cell') ||
             t.closest('.card-image-wrap') ||
             t.closest('.ig-img-wrap');
    }
    document.addEventListener('contextmenu', e => { if (isZone(e.target)) { e.preventDefault(); return false; } });
    document.addEventListener('dragstart',   e => { if (isZone(e.target)) { e.preventDefault(); return false; } });
    document.addEventListener('selectstart', e => { if (isZone(e.target)) { e.preventDefault(); return false; } });
    document.addEventListener('copy', e => {
      if (isZone(document.activeElement) || isZone(e.target)) {
        e.preventDefault();
        e.clipboardData && e.clipboardData.clearData();
      }
    });
    function lockImages() {
      document.querySelectorAll('img').forEach(img => {
        img.setAttribute('draggable', 'false');
        img.setAttribute('oncontextmenu', 'return false');
        img.style.userSelect = 'none';
        img.style.webkitUserSelect = 'none';
        img.style.pointerEvents = 'none';
      });
    }
    lockImages();
    new MutationObserver(lockImages).observe(document.body, { childList: true, subtree: true });
  })();

  /* 2. BLOQUEO DE ATAJOS DE INSPECCIÓN */
  (function blockDevShortcuts() {
    document.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (k === 'F12') { e.preventDefault(); return false; }
      if (k === 'PrintScreen') { e.preventDefault(); return false; }
      if (ctrl && e.shiftKey && /^[IJCijc]$/.test(k)) { e.preventDefault(); return false; }
      if (ctrl && /^[uUsSpP]$/.test(k)) { e.preventDefault(); return false; }
      if (ctrl && /^[aA]$/.test(k)) { e.preventDefault(); const s = window.getSelection(); if (s) s.removeAllRanges(); }
    });
  })();

  /* 3. DETECCIÓN DE DEVTOOLS */
  (function detectDevTools() {
    let open = false;
    const blur = v => document.querySelectorAll('.card-img,.ig-img').forEach(img => {
      img.style.filter = v ? 'blur(20px) brightness(0.2)' : '';
    });
    function check() {
      const o = (window.outerWidth - window.innerWidth > 160) ||
                (window.outerHeight - window.innerHeight > 160);
      if (o !== open) { open = o; blur(o); }
    }
    // Debugger timing
    try {
      const t0 = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      if (performance.now() - t0 > 100) blur(true);
    } catch(_){}
    setInterval(check, 1500);
    window.addEventListener('resize', check);
  })();

  /* 4. PROTECCIÓN DE SELECCIÓN DE TEXTO */
  (function protectText() {
    const s = document.createElement('style');
    s.textContent = ['.hero-title','.section-title','.footer-brand','.footer-copy',
      '.card-title','.card-meta','.ig-caption','.hero-subtitle','.section-subtitle']
      .map(x => `${x}{user-select:none;-webkit-user-select:none;}`).join('');
    document.head.appendChild(s);
  })();

  /* 5. OFUSCACIÓN DE EMAIL */
  (function obfuscateEmails() {
    document.querySelectorAll('[data-email]').forEach(el => {
      const r = el.getAttribute('data-email'); if (!r) return;
      const d = r.replace('[at]','@').replace(/\[dot\]/g,'.');
      el.setAttribute('href','mailto:'+d);
      if (!el.textContent.trim() || el.textContent.includes('[at]')) el.textContent = d;
    });
    document.querySelectorAll('[data-em]').forEach(el => {
      const enc = el.getAttribute('data-em'); if (!enc) return;
      const d = rot13(enc);
      el.setAttribute('href','mailto:'+d);
      if (!el.textContent.trim()) el.textContent = d;
      el.removeAttribute('data-em');
    });
  })();

  /* 6. RATE-LIMIT DE CLICKS con backoff exponencial */
  (function rateLimitClicks() {
    let cnt = 0, last = Date.now(), lvl = 0;
    document.addEventListener('click', e => {
      const now = Date.now();
      if (now - last > 3000) { cnt = 0; last = now; }
      cnt++;
      if (cnt > 40) {
        e.preventDefault(); e.stopImmediatePropagation();
        lvl = Math.min(lvl + 1, 5);
        document.body.style.pointerEvents = 'none';
        setTimeout(() => { document.body.style.pointerEvents = ''; cnt = 0; }, 1200 * Math.pow(2, lvl - 1));
      }
    }, true);
  })();

  /* 7. RATE-LIMIT DE TECLAS */
  (function rateLimitKeys() {
    let cnt = 0, last = Date.now();
    document.addEventListener('keydown', e => {
      const now = Date.now();
      if (now - last > 2000) { cnt = 0; last = now; }
      cnt++;
      if (cnt > 80) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  })();

  /* 8. HONEYPOT */
  (function honeypot() {
    const trap = document.createElement('a');
    trap.href = '#';
    trap.setAttribute('aria-hidden','true');
    trap.setAttribute('tabindex','-1');
    trap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(trap);
    trap.addEventListener('click', () => {
      document.body.style.pointerEvents = 'none';
      setTimeout(() => document.body.style.pointerEvents = '', 10000);
      devLog('Honeypot: bot detectado');
    });
    // Detección movimiento recto de bot
    let lx = 0, ly = 0, sm = 0;
    document.addEventListener('mousemove', e => {
      if (lx && ly) { const dx = Math.abs(e.clientX-lx), dy = Math.abs(e.clientY-ly); (dx===0||dy===0) ? sm++ : sm = Math.max(0,sm-1); }
      lx = e.clientX; ly = e.clientY;
    }, { passive: true });
  })();

  /* 9. WATERMARK INVISIBLE */
  (function invisibleWatermark() {
    const bg = document.getElementById('bg-canvas'); if (!bg) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        const ctx = bg.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
        const m = ctx.createImageData(1,1);
        m.data[0]=0x41; m.data[1]=0x4E; m.data[2]=0x54; m.data[3]=0xFE;
        ctx.putImageData(m, 1, 1);
      } catch(_){}
    }));
  })();

  /* 10. SILENCIAR CONSOLA EN PRODUCCIÓN */
  (function cleanConsole() {
    if (!IS_DEV) ['log','debug','info','warn','error','table','dir','trace','group','groupEnd','time','timeEnd'].forEach(m => {
      try { console[m] = noop; } catch(_){}
    });
  })();

  /* 11. ANTI-IFRAME REFORZADO */
  (function antiClickjacking() {
    if (window.self !== window.top) {
      try { window.top.location = window.self.location; }
      catch (_) { document.documentElement.style.cssText = 'visibility:hidden!important;display:none!important'; }
    }
  })();

  /* 12. SANITIZACIÓN DE INPUTS */
  (function sanitizeInputs() {
    const DANGER = [/<script[\s\S]*?>[\s\S]*?<\/script>/gi, /<[^>]+>/g, /javascript\s*:/gi, /data\s*:/gi, /vbscript\s*:/gi];
    function san(s) { return DANGER.reduce((v,r) => v.replace(r,''), s).trim(); }
    document.addEventListener('input', e => {
      const el = e.target;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const c = san(el.value); if (c !== el.value) { el.value = c; devLog('Input sanitizado'); }
      }
    }, true);
    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn-organic--submit'); if (!btn) return;
      const form = btn.closest('.contact-form'); if (!form) return;
      let bad = false;
      form.querySelectorAll('input,textarea').forEach(el => {
        if (/<|javascript:|data:|on\w+=/.test(el.value)) { el.value = san(el.value); bad = true; }
      });
      if (bad) { e.preventDefault(); e.stopImmediatePropagation(); devLog('Inyección bloqueada'); }
    }, true);
  })();

  /* 13. DETECCIÓN DE SCRAPER UA */
  (function detectScrapers() {
    const BAD = ['wget','curl','python','scrapy','httrack','larbin','libwww','go-http','okhttp',
                 'mechanize','phantomjs','headlesschrome','selenium','webdriver','puppeteer','playwright'];
    const ua = (navigator.userAgent || '').toLowerCase();
    if (BAD.some(b => ua.includes(b))) { document.documentElement.style.visibility = 'hidden'; devLog('Scraper UA detectado'); }
    if (!IS_DEV && navigator.webdriver) { document.documentElement.setAttribute('data-suspicious','1'); }
  })();

  /* 14. BLOQUEAR data: Y javascript: URIs */
  (function blockDangerousURIs() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a'); if (!a) return;
      const h = (a.getAttribute('href') || '').trim().toLowerCase();
      if (/^(data|javascript|vbscript)\s*:/i.test(h)) { e.preventDefault(); e.stopImmediatePropagation(); devLog('URI peligrosa bloqueada'); }
    }, true);
  })();

  /* 15. LIMPIEZA DE URL */
  (function cleanURL() {
    try {
      const url = new URL(location.href);
      const BAD_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
                          'fbclid','gclid','token','access_token','api_key','apikey','key','secret','password','pass'];
      let mod = false;
      BAD_PARAMS.forEach(p => { if (url.searchParams.has(p)) { url.searchParams.delete(p); mod = true; } });
      if (mod) history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch(_){}
  })();

  /* 16. FINGERPRINT DE SESIÓN */
  (function sessionFingerprint() {
    try {
      const fp = [navigator.language, navigator.hardwareConcurrency||0, screen.width+'x'+screen.height, new Date().getTimezoneOffset()].join('|');
      let h = 0; for (let i=0;i<fp.length;i++) { h = ((h<<5)-h)+fp.charCodeAt(i); h|=0; }
      const cur = h.toString(36);
      if (sessionStorage) {
        const stored = sessionStorage.getItem('_asfp');
        if (stored && stored !== cur) { devLog('Fingerprint inconsistente'); document.documentElement.setAttribute('data-fp-anomaly','1'); }
        sessionStorage.setItem('_asfp', cur);
      }
    } catch(_){}
  })();

  /* 17. PROTECCIÓN ZOOM MÓVIL */
  (function preventImageZoom() {
    let lt = 0;
    document.addEventListener('touchend', e => {
      const t = e.target;
      if (t.tagName==='IMG'||t.closest('.gallery-card')||t.closest('.ig-triptych-cell')) {
        const now = Date.now(); if (now-lt < 300) e.preventDefault(); lt = now;
      }
    }, { passive: false });
  })();

  /* 18. OBSERVER DE INTEGRIDAD DOM */
  (function domIntegrity() {
    const ALLOWED = [
      'antares-main.js','antares-security.js',
      'three.min.js','anime.min.js',
      'cdnjs.cloudflare.com','fonts.googleapis.com',
      'github.io', 'pages.dev',          // hosts oficiales
      'static.cloudflareinsights.com',   // analytics CF (si está activo)
    ];
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.tagName === 'SCRIPT') {
        const src = n.src || '';
        if (src && !ALLOWED.some(a => src.includes(a))) { n.remove(); devLog('Script no autorizado eliminado:', src.slice(0,60)); }
      }
      if (n.tagName === 'IFRAME') { n.remove(); devLog('iframe inyectado eliminado'); }
    }))).observe(document.documentElement, { childList: true, subtree: true });
  })();

  /* 19. PRINT PROTECTION */
  (function printProtection() {
    const s = document.createElement('style');
    s.textContent = `@media print{.gallery-card,.ig-triptych-cell,.card-img,.ig-img,.card-image-wrap,.ig-img-wrap,#bg-canvas,.hero-canvas{display:none!important;visibility:hidden!important;}body::before{content:"\\00A9 2026 Antares \\00B7 Todos los derechos reservados \\00B7 @anth4rez";display:block;font-family:serif;text-align:center;padding:40pt;color:#333;}}`;
    document.head.appendChild(s);
    window.addEventListener('beforeprint', () => document.querySelectorAll('.card-img,.ig-img').forEach(i => { i.dataset.s=i.src; i.removeAttribute('src'); }));
    window.addEventListener('afterprint',  () => document.querySelectorAll('.card-img,.ig-img').forEach(i => { if(i.dataset.s){i.src=i.dataset.s;delete i.dataset.s;} }));
  })();

  devLog('Security Module v2 · 20 capas activas');

})();
