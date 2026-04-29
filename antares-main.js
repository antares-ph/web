/* =========================================================
   ANTARES PORTFOLIO — JAVASCRIPT v5 OPTIMIZED
   Cambios de performance:
   - initGlandParticles: ESTÁTICO — sin requestAnimationFrame loop
   - Anime.js: eliminado loop continuo de textShadow
   - ScrollReveal: sin anime en cada gland/vertebra al revelar
   - initCardGigerFrame: inyección de marcos Giger en cards
   - Hamburger menu: menú móvil funcional
   - Three.js: sigue siendo render único (sin cambio)
   ========================================================= */
'use strict';

/* ══════════════════════════════════════════════════════════
   LOOP PRINCIPAL — con visibilidad
   ══════════════════════════════════════════════════════════ */
const MainLoop = (function() {
  const tasks = [];
  let running = false, lastTime = 0, paused = false;
  function tick(now) {
    if (paused) { requestAnimationFrame(tick); return; }
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    for (let i = 0; i < tasks.length; i++) tasks[i](dt, now * 0.001);
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
  return {
    add(fn) {
      tasks.push(fn);
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
  };
})();


/* ══════════════════════════════════════════════════════════
   GIGER TEXTURE ENGINE — solo render estático
   ══════════════════════════════════════════════════════════ */
const GigerTextureEngine = (function() {
  const PAL = {
    bone:[18,14,22], rib:[65,45,90], marrow:[38,26,52], flesh:[50,35,68],
    nerve:[80,60,108], dark:[6,4,10], highlight:[110,82,148],
    tube:[28,18,42], bright:[130,95,170], glow:[160,120,200],
  };

  function drawRib(ctx, x0, y0, x1, y1, x2, y2, w, alpha) {
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.strokeStyle = `rgba(${PAL.rib[0]},${PAL.rib[1]},${PAL.rib[2]},0.65)`;
    ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke(); ctx.restore();
  }

  function drawTube(ctx, pts, radius, alpha) {
    if (pts.length < 2) return;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.strokeStyle = `rgba(${PAL.tube[0]},${PAL.tube[1]},${PAL.tube[2]},0.55)`;
    ctx.lineWidth = radius * 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke(); ctx.restore();
  }

  function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    const a = hash(ix,iy), b = hash(ix+1,iy), c = hash(ix,iy+1), d = hash(ix+1,iy+1);
    return a + (b-a)*ux + (c-a)*uy + (d-a+a-b-c+b)*ux*uy;
  }

  function generateGigerFrame(ctx, w, h, t, intensity) {
    intensity = intensity || 0.80;
    ctx.fillStyle = `rgb(${PAL.bone[0]},${PAL.bone[1]},${PAL.bone[2]})`;
    ctx.fillRect(0, 0, w, h);

    const STEP = 8;
    const img  = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let py = 0; py < h; py += STEP) {
      for (let px = 0; px < w; px += STEP) {
        const n   = Math.sin(px * 0.02) * Math.cos(py * 0.025) * 0.5 + 0.5;
        const val = n * 32;
        const r = PAL.bone[0] + val, g = PAL.bone[1] + val, b = PAL.bone[2] + val;
        for (let dy = 0; dy < STEP && py+dy < h; dy++) {
          for (let dx = 0; dx < STEP && px+dx < w; dx++) {
            const idx = ((py+dy)*w + (px+dx))*4;
            data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 200;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    const rc = Math.floor(h / 55);
    for (let i = 0; i < rc; i++) {
      const y  = (h / rc) * i + 20;
      const rb = -w * 0.15 * (0.8 + noise2(i, 0) * 0.4);
      drawRib(ctx, 0, y, w * 0.45, y + rb, w, y, 2.5 + noise2(i*2, 0), 0.45 * intensity);
    }
    [w*0.15, w*0.38, w*0.62, w*0.85].forEach((tx, ti) => {
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const sy = (h / 8) * s;
        pts.push({ x: tx + Math.sin(sy*0.025 + ti*1.1)*4, y: sy });
      }
      drawTube(ctx, pts, 2, 0.28 * intensity);
    });
  }

  return { generateGigerFrame };
})();


/* Separadores Giger — render estático */
(function initGigerTextures() {
  function initDivCanvas(id, intensity) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width  = canvas.offsetWidth  || 1400;
    const h = canvas.height = canvas.offsetHeight || 180;
    GigerTextureEngine.generateGigerFrame(ctx, w, h, 0, intensity);
  }
  initDivCanvas('giger-div-canvas-1', 0.45);
  initDivCanvas('giger-div-canvas-2', 0.40);
})();


/* ══════════════════════════════════════════════════════════
   THREE.JS — Render único (sin loop)
   ══════════════════════════════════════════════════════════ */
(function initThreeJS() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, powerPreference: 'low-power',
    antialias: false, depth: false, stencil: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(0, 0, 12);

  const boneColor = 0x6a5a8a;
  const tubeColor = 0x4a3d6b;
  const nodeColor = 0x8a7aa0;

  const boneMat = new THREE.LineBasicMaterial({ color: boneColor, transparent: true, opacity: 0.14 });
  const tubeMat = new THREE.LineBasicMaterial({ color: tubeColor, transparent: true, opacity: 0.09 });
  const group   = new THREE.Group();
  scene.add(group);

  function makeLine(pts, mat) {
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  }

  const spinePts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, y = (t - 0.5) * 14;
    spinePts.push(new THREE.Vector3(Math.sin(t * Math.PI * 2) * 0.3, y, 0));
  }
  group.add(makeLine(spinePts, boneMat));

  for (let i = 1; i < 12; i += 2) {
    const t = i / 12, y = (t - 0.5) * 14;
    group.add(makeLine([
      new THREE.Vector3(-1.5, y, 0),
      new THREE.Vector3(0, y, 0),
      new THREE.Vector3(1.5, y, 0)
    ], boneMat));
  }

  const sides = [-1, 1];
  for (let i = 0; i < 6; i++) {
    const y = ((i / 5) - 0.5) * 10;
    sides.forEach(side => {
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const tt = s / 8;
        const x = side * (tt * 4 + 0.2);
        const yy = y + Math.sin(tt * Math.PI) * (1.5 + i * 0.15) * side * 0.5;
        pts.push(new THREE.Vector3(x, yy, 0));
      }
      group.add(makeLine(pts, boneMat));
    });
  }

  const tubeXs = [-3.5, -1.8, 1.8, 3.5];
  tubeXs.forEach((tx, ti) => {
    const pts = [];
    for (let s = 0; s <= 8; s++) {
      const t = s / 8, y = (t - 0.5) * 14;
      pts.push(new THREE.Vector3(tx + Math.sin(t * Math.PI * 3 + ti * 1.2) * 0.4, y, 0));
    }
    group.add(makeLine(pts, tubeMat));
  });

  const nodePositions = [
    {x:-1.5,y:4},{x:1.5,y:4},{x:-1.5,y:0},{x:1.5,y:0},
    {x:-1.5,y:-4},{x:1.5,y:-4},{x:0,y:6},{x:0,y:-6}
  ];
  const nodeGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const nodeMat = new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: 0.25 });
  nodePositions.forEach(pos => {
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.set(pos.x, pos.y, 0);
    group.add(node);
  });

  renderer.render(scene, camera);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
  }, { passive: true });
})();


/* ══════════════════════════════════════
   HERO CANVAS — render estático
   ══════════════════════════════════════ */
(function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas'); if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const w = canvas.width  = Math.min(canvas.offsetWidth  || window.innerWidth,  1920);
  const h = canvas.height = Math.min(canvas.offsetHeight || window.innerHeight, 1080);

  for (let layer = 0; layer < 3; layer++) {
    const alpha = 0.035 + layer * 0.018;
    ctx.strokeStyle = `rgba(${100 + layer*18},${75 + layer*14},${138 + layer*18},${alpha})`;
    ctx.lineWidth   = 0.5 + layer * 0.3;
    const LC = 7 + layer * 2;
    for (let i = 0; i < LC; i++) {
      const y = (h / LC) * i + h * 0.10;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 40) {
        const wave = Math.sin(x * 0.008 + i * 0.6 + layer) * (6 + layer * 2);
        ctx.lineTo(x, y + wave + Math.cos(x * 0.015 - i * 0.3) * (3 + layer));
      }
      ctx.stroke();
    }
  }

  for (let i = 0; i < 7; i++) {
    const cy = (h / 9) * (i + 1) + h * 0.06;
    ctx.strokeStyle = 'rgba(150,110,185,0.12)';
    ctx.lineWidth   = 0.6;
    ctx.beginPath();
    ctx.ellipse(w/2, cy, 18 + Math.sin(i) * 4, 8 + Math.cos(i) * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const glands = [
    {x:w*0.15,y:h*0.3,r:3},{x:w*0.85,y:h*0.25,r:2.5},
    {x:w*0.2,y:h*0.7,r:2.8},{x:w*0.8,y:h*0.75,r:3.2},
    {x:w*0.5,y:h*0.15,r:2.2},{x:w*0.5,y:h*0.85,r:2.6}
  ];
  glands.forEach(g => {
    ctx.strokeStyle = 'rgba(175,135,210,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.stroke();
  });
})();


/* ══════════════════════════════════════
   CARD GIGER FRAMES — inyección de marcos bio-mecánicos
   Vértebras, costillas y nódulos en los bordes de cada card
   ══════════════════════════════════════ */
(function initCardGigerFrames() {
  const FRAME_SVG = `
    <svg viewBox="0 0 300 380" preserveAspectRatio="none"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">

      <!-- ESPINAS LATERALES -->
      <line class="frame-spine" x1="6" y1="28" x2="6" y2="352"/>
      <line class="frame-spine" x1="294" y1="28" x2="294" y2="352"/>

      <!-- COSTILLAS SUPERIORES -->
      <path class="frame-rib" d="M22,6 C80,3 150,9 220,5 C258,3 278,7 294,5"/>
      <path class="frame-rib" d="M22,11 C80,8 150,14 220,10 C258,8 278,12 294,10"
            stroke-opacity="0.5"/>

      <!-- COSTILLAS INFERIORES -->
      <path class="frame-rib" d="M22,374 C80,371 150,377 220,373 C258,371 278,375 294,373"/>
      <path class="frame-rib" d="M22,369 C80,366 150,372 220,368 C258,366 278,370 294,368"
            stroke-opacity="0.5"/>

      <!-- VÉRTEBRA ESQUINA — arriba izquierda -->
      <ellipse class="frame-vertebra" cx="14" cy="14" rx="7" ry="10"/>
      <ellipse class="frame-vertebra-inner" cx="14" cy="14" rx="3.5" ry="5.5"/>
      <!-- Costilla saliente esquina TL -->
      <path class="frame-rib" d="M6,14 C10,12 12,10 14,4"/>
      <path class="frame-rib" d="M14,24 C12,26 10,26 6,26" stroke-opacity="0.4"/>
      <!-- Tubo pequeño TL -->
      <path class="frame-tube" d="M14,4 C14,0 16,0 18,2"/>

      <!-- VÉRTEBRA ESQUINA — arriba derecha -->
      <ellipse class="frame-vertebra" cx="286" cy="14" rx="7" ry="10"/>
      <ellipse class="frame-vertebra-inner" cx="286" cy="14" rx="3.5" ry="5.5"/>
      <path class="frame-rib" d="M294,14 C290,12 288,10 286,4"/>
      <path class="frame-rib" d="M286,24 C288,26 290,26 294,26" stroke-opacity="0.4"/>
      <path class="frame-tube" d="M286,4 C286,0 284,0 282,2"/>

      <!-- VÉRTEBRA ESQUINA — abajo izquierda -->
      <ellipse class="frame-vertebra" cx="14" cy="366" rx="7" ry="10"/>
      <ellipse class="frame-vertebra-inner" cx="14" cy="366" rx="3.5" ry="5.5"/>
      <path class="frame-rib" d="M6,366 C10,368 12,370 14,376"/>
      <path class="frame-rib" d="M14,356 C12,354 10,354 6,354" stroke-opacity="0.4"/>
      <path class="frame-tube" d="M14,376 C14,380 16,380 18,378"/>

      <!-- VÉRTEBRA ESQUINA — abajo derecha -->
      <ellipse class="frame-vertebra" cx="286" cy="366" rx="7" ry="10"/>
      <ellipse class="frame-vertebra-inner" cx="286" cy="366" rx="3.5" ry="5.5"/>
      <path class="frame-rib" d="M294,366 C290,368 288,370 286,376"/>
      <path class="frame-rib" d="M286,356 C288,354 290,354 294,354" stroke-opacity="0.4"/>
      <path class="frame-tube" d="M286,376 C286,380 284,380 282,378"/>

      <!-- NÓDULO LATERAL IZQUIERDO (punto medio) -->
      <circle class="frame-node" cx="6" cy="190" r="3.5"/>
      <!-- Costilla prong lateral izquierdo -->
      <path class="frame-rib" d="M6,185 C10,183 16,185 14,190 C16,195 10,197 6,195"/>

      <!-- NÓDULO LATERAL DERECHO -->
      <circle class="frame-node" cx="294" cy="190" r="3.5"/>
      <path class="frame-rib" d="M294,185 C290,183 284,185 286,190 C284,195 290,197 294,195"/>

      <!-- NÓDULO LATERAL IZQ — 1/3 -->
      <circle class="frame-node" cx="6" cy="110" r="2.5"/>
      <path class="frame-rib" d="M6,107 C9,106 14,107 12,110 C14,113 9,114 6,113"
            stroke-opacity="0.6"/>

      <!-- NÓDULO LATERAL IZQ — 2/3 -->
      <circle class="frame-node" cx="6" cy="270" r="2.5"/>
      <path class="frame-rib" d="M6,267 C9,266 14,267 12,270 C14,273 9,274 6,273"
            stroke-opacity="0.6"/>

      <!-- NÓDULO LATERAL DER — 1/3 -->
      <circle class="frame-node" cx="294" cy="110" r="2.5"/>
      <path class="frame-rib" d="M294,107 C291,106 286,107 288,110 C286,113 291,114 294,113"
            stroke-opacity="0.6"/>

      <!-- NÓDULO LATERAL DER — 2/3 -->
      <circle class="frame-node" cx="294" cy="270" r="2.5"/>
      <path class="frame-rib" d="M294,267 C291,266 286,267 288,270 C286,273 291,274 294,273"
            stroke-opacity="0.6"/>

      <!-- DETALLES TOP: pequeñas vértebras en la línea superior -->
      <ellipse class="frame-vertebra" cx="100" cy="4" rx="5" ry="3" stroke-opacity="0.7"/>
      <ellipse class="frame-vertebra" cx="200" cy="4" rx="5" ry="3" stroke-opacity="0.7"/>
      <ellipse class="frame-vertebra" cx="150" cy="4" rx="4" ry="3" stroke-opacity="0.5"/>

      <!-- DETALLES BOTTOM -->
      <ellipse class="frame-vertebra" cx="100" cy="376" rx="5" ry="3" stroke-opacity="0.7"/>
      <ellipse class="frame-vertebra" cx="200" cy="376" rx="5" ry="3" stroke-opacity="0.7"/>
      <ellipse class="frame-vertebra" cx="150" cy="376" rx="4" ry="3" stroke-opacity="0.5"/>

      <!-- TUBOS ORGÁNICOS LATERALES IZQUIERDO -->
      <path class="frame-tube" d="M6,40 C4,60 5,80 6,100"/>
      <path class="frame-tube" d="M6,220 C4,240 5,260 6,280"/>

      <!-- TUBOS ORGÁNICOS LATERALES DERECHO -->
      <path class="frame-tube" d="M294,40 C296,60 295,80 294,100"/>
      <path class="frame-tube" d="M294,220 C296,240 295,260 294,280"/>
    </svg>`;

  document.querySelectorAll('.gallery-card').forEach(card => {
    const frame = document.createElement('div');
    frame.className = 'card-giger-frame';
    frame.innerHTML = FRAME_SVG;
    card.appendChild(frame);
  });
})();


/* ══════════════════════════════════════
   SCANLINE — elemento DOM
   ══════════════════════════════════════ */
(function initScanline() {
  const hero = document.querySelector('.section--hero'); if (!hero) return;
  const sl = document.createElement('div');
  sl.className = 'hero-scanline';
  hero.appendChild(sl);
})();


/* ══════════════════════════════════════
   ANIME.JS — solo animación de entrada
   Sin loop continuo de textShadow (era el mayor culpable de lag)
   ══════════════════════════════════════ */
(function initAnime() {
  if (!window.anime) return;
  const heroTitle = document.getElementById('heroLine1'); if (!heroTitle) return;

  heroTitle.style.whiteSpace = 'nowrap';
  heroTitle.style.display    = 'block';
  heroTitle.innerHTML = '';
  'ANTARES'.split('').forEach(char => {
    const s = document.createElement('span');
    s.textContent = char;
    s.style.cssText = 'display:inline-block;opacity:0;transform:translateY(36px) scale(0.85);white-space:pre;will-change:transform,opacity;';
    heroTitle.appendChild(s);
  });

  // Solo animación de entrada — sin loops continuos
  anime({
    targets:    '#heroLine1 span',
    opacity:    [0, 1],
    translateY: [36, 0],
    scale:      [0.85, 1],
    easing:     'easeOutExpo',
    duration:   1300,
    delay:      anime.stagger(85, { start: 600 })
  });
})();


/* ══════════════════════════════════════
   SCROLL REVEAL — sin anime en cada elemento
   ══════════════════════════════════════ */
(function initScrollReveal() {
  const selectors = [
    '.gallery-card', '.ig-triptych-cell', '.sobre-content', '.sobre-skeleton',
    '.contacto-content', '.section-header', '.bio-text', '.bio-tag',
    '.organic-divider', '.hero-cta', '.btn-organic'
  ];

  selectors.forEach(sel =>
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--card-index', i);
    })
  );

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');

      // Solo animar costillas de card (SVG path, ligero)
      if (e.target.classList.contains('gallery-card') && window.anime) {
        const ribs = e.target.querySelectorAll('.card-rib');
        if (ribs.length) {
          anime({
            targets: ribs,
            strokeDashoffset: [anime.setDashoffset, 0],
            easing:   'easeInOutSine',
            duration: 1600,
            delay:    anime.stagger(180, {start: 80})
          });
        }
      }

      io.unobserve(e.target);
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();


/* ══════════════════════════════════════
   NAVBAR — scroll state + nav activo
   ══════════════════════════════════════ */
(function initNavbar() {
  const nav = document.getElementById('navbar'); if (!nav) return;

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
      scrollTicking = false;
    });
  }, { passive: true });

  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');

  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + e.target.id);
      });
    });
  }, { threshold: 0.30 });

  sections.forEach(s => sectionObserver.observe(s));
})();


/* ══════════════════════════════════════
   HAMBURGER MENU MÓVIL
   ══════════════════════════════════════ */
(function initHamburger() {
  const hamburger = document.getElementById('navHamburger');
  const overlay   = document.getElementById('navMobileOverlay');
  if (!hamburger || !overlay) return;

  function toggle(open) {
    hamburger.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  hamburger.addEventListener('click', () => toggle(!hamburger.classList.contains('open')));

  // Cerrar al hacer click en enlace
  overlay.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggle(false));
  });

  // Cerrar al hacer click fuera del menú
  overlay.addEventListener('click', e => {
    if (e.target === overlay) toggle(false);
  });

  // Cerrar con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) toggle(false);
  });

  // Cerrar al redimensionar a desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) toggle(false);
  }, { passive: true });
})();


/* ══════════════════════════════════════
   SMOOTH SCROLL
   ══════════════════════════════════════ */
(function initSmoothScroll() {
  function easeInOutQuart(t) {
    return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2;
  }

  function smoothScrollTo(targetId) {
    const target = document.querySelector(targetId); if (!target) return;
    const navH = document.getElementById('navbar')?.offsetHeight || 72;
    const targetY = target.getBoundingClientRect().top + window.pageYOffset - navH;
    const startY = window.pageYOffset;
    const distance = targetY - startY;
    if (Math.abs(distance) < 5) return;

    const duration = Math.min(1200, Math.max(500, Math.abs(distance) * 0.45));
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed  = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + distance * easeInOutQuart(progress));
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  document.querySelectorAll('.nav-link, a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) {
        e.preventDefault();
        smoothScrollTo(href);
      }
    });
  });
})();


/* ══════════════════════════════════════
   BOTONES — Ripple effect
   ══════════════════════════════════════ */
(function initButtonEffects() {
  if (!document.getElementById('ripple-styles')) {
    const style = document.createElement('style');
    style.id = 'ripple-styles';
    style.textContent = `@keyframes rippleExpand { to { transform: scale(1); opacity: 0; } }`;
    document.head.appendChild(style);
  }

  function createRipple(btn, e) {
    const existing = btn.querySelector('.btn-ripple');
    if (existing) existing.remove();
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const x = (e.clientX - rect.left) - size / 2;
    const y = (e.clientY - rect.top)  - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;z-index:0;width:${size}px;height:${size}px;left:${x}px;top:${y}px;background:radial-gradient(circle,rgba(170,128,210,0.22) 0%,transparent 70%);transform:scale(0);animation:rippleExpand 0.55s cubic-bezier(0.16,1,0.3,1) forwards;will-change:transform,opacity;`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  document.querySelectorAll('.btn-organic').forEach(btn => {
    btn.addEventListener('mousedown', e => createRipple(btn, e));
    btn.addEventListener('touchstart', e => {
      if (e.touches[0]) createRipple(btn, e.touches[0]);
    }, { passive: true });
  });
})();


/* ══════════════════════════════════════
   FORMULARIO
   ══════════════════════════════════════ */
(function initForm() {
  const btn = document.querySelector('.btn-organic--submit'); if (!btn) return;
  const form = btn.closest('.contact-form'); if (!form) return;

  const nameInput   = form.querySelector('input[type="text"]');
  const emailInput  = form.querySelector('input[type="email"]');
  const msgTextarea = form.querySelector('textarea');

  function showFieldError(input, show) {
    if (!input) return;
    input.style.borderBottomColor = show ? 'rgba(200,100,120,0.68)' : 'rgba(120,90,155,0.40)';
  }

  btn.addEventListener('click', () => {
    if (btn.classList.contains('sent') || btn.classList.contains('sending')) return;
    let valid = true;

    if (nameInput  && !nameInput.value.trim())  { showFieldError(nameInput, true);  valid = false; } else showFieldError(nameInput, false);
    if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) { showFieldError(emailInput, true); valid = false; } else showFieldError(emailInput, false);
    if (msgTextarea && !msgTextarea.value.trim()) { showFieldError(msgTextarea, true); valid = false; } else showFieldError(msgTextarea, false);

    if (!valid) return;

    const span = btn.querySelector('.btn-organic__text'); if (!span) return;

    /* ── ENVÍO REAL VÍA FORMSPREE ──────────────────────────────
       Pasos para activarlo:
       1. Regístrate gratis en https://formspree.io
       2. Crea un nuevo form → copia tu ID (ej: xpwzgkbd)
       3. Reemplaza 'TU_FORMSPREE_ID' con ese ID aquí abajo
       ─────────────────────────────────────────────────────── */
    const FORMSPREE_ID = 'TU_FORMSPREE_ID'; // ← reemplaza esto

    btn.classList.add('sending');
    span.textContent = 'ENVIANDO…';
    [nameInput, emailInput, msgTextarea].forEach(el => { if (el) el.disabled = true; });

    fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre:  nameInput  ? nameInput.value.trim()   : '',
        correo:  emailInput ? emailInput.value.trim()  : '',
        mensaje: msgTextarea ? msgTextarea.value.trim() : '',
      })
    })
    .then(res => {
      btn.classList.remove('sending');
      if (res.ok) {
        span.textContent = 'ENVIADO ✦';
        btn.classList.add('sent');
      } else {
        span.textContent = 'ERROR — REINTENTA';
        [nameInput, emailInput, msgTextarea].forEach(el => { if (el) el.disabled = false; });
      }
    })
    .catch(() => {
      btn.classList.remove('sending');
      span.textContent = 'ERROR DE RED';
      [nameInput, emailInput, msgTextarea].forEach(el => { if (el) el.disabled = false; });
    });
  });

  [nameInput, emailInput, msgTextarea].forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => showFieldError(el, false));
  });
})();


/* ══════════════════════════════════════
   GLAND PARTICLES — ESTÁTICO (sin rAF loop)
   Antes causaba lag al correr 60fps con gradientes radiales
   ══════════════════════════════════════ */
(function initGlandParticlesStatic() {
  const hero = document.querySelector('.section--hero'); if (!hero) return;
  const cnv  = document.createElement('canvas');
  cnv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;opacity:0.14;transform:translateZ(0);';
  hero.appendChild(cnv);

  const ctx = cnv.getContext('2d');
  const W = cnv.width  = hero.offsetWidth  || window.innerWidth;
  const H = cnv.height = hero.offsetHeight || window.innerHeight;

  const particles = [];
  for (let i = 0; i < 16; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1.2 + Math.random() * 2.2,
      color: `rgba(${138 + Math.floor(Math.random()*28)},${98 + Math.floor(Math.random()*28)},${168 + Math.floor(Math.random()*36)},`
    });
  }

  // UN SOLO FRAME — sin loop
  particles.forEach(p => {
    // Anillo principal
    ctx.strokeStyle = p.color + '0.42)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();

    // Núcleo
    ctx.fillStyle = p.color + '0.55)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
})();


/* ══════════════════════════════════════
   PARALLAX SUAVE EN SCROLL (solo hero ribs)
   ══════════════════════════════════════ */
(function initParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layers = [
    { el: document.querySelector('.rib-structure--left'),  factor: 0.15 },
    { el: document.querySelector('.rib-structure--right'), factor: 0.15 },
    { el: document.querySelector('.rib-bottom'),           factor: 0.06 },
  ].filter(l => l.el);

  if (!layers.length) return;

  let ticking = false;
  let scrollY = window.scrollY;

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    if (!ticking) {
      requestAnimationFrame(() => {
        layers.forEach(({ el, factor }) => {
          el.style.transform = `translateY(${scrollY * factor}px) translateZ(0)`;
        });
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();


/* ══════════════════════════════════════
   FADE-IN STAGGER DE CARDS
   ══════════════════════════════════════ */
(function initStaggerReveal() {
  const cards = document.querySelectorAll('.gallery-card, .ig-triptych-cell');
  if (!cards.length || !('IntersectionObserver' in window)) return;

  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = `opacity 0.70s cubic-bezier(0.19,1,0.22,1) ${i % 3 * 80}ms,
                             transform 0.70s cubic-bezier(0.19,1,0.22,1) ${i % 3 * 80}ms`;
  });

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });

  cards.forEach(c => obs.observe(c));
})();


/* ══════════════════════════════════════
   CURSOR MAGNÉTICO EN BOTONES
   ══════════════════════════════════════ */
(function initMagneticElements() {
  const STRENGTH = 0.24;
  document.querySelectorAll('.btn-organic').forEach(el => {
    let animId = null, tx = 0, ty = 0;
    el.addEventListener('mousemove', e => {
      const r  = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width/2)  * STRENGTH;
      ty = (e.clientY - r.top  - r.height/2) * STRENGTH;
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(() => {
        el.style.transform = `translate(${tx}px, ${ty}px)`;
      });
    });
    el.addEventListener('mouseleave', () => {
      cancelAnimationFrame(animId);
      let x = tx, y = ty;
      function spring() {
        x *= 0.72; y *= 0.72;
        el.style.transform = `translate(${x}px, ${y}px)`;
        if (Math.abs(x) > 0.15 || Math.abs(y) > 0.15) animId = requestAnimationFrame(spring);
        else el.style.transform = '';
      }
      animId = requestAnimationFrame(spring);
    });
  });
})();


/* ══════════════════════════════════════
   TILT 3D EN GALLERY CARDS (suavizado)
   ══════════════════════════════════════ */
(function initCardTilt() {
  const MAX_TILT = 5;
  document.querySelectorAll('.gallery-card').forEach(card => {
    let animId = null;
    let targetRX = 0, targetRY = 0, currentRX = 0, currentRY = 0;

    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      targetRX = -((e.clientY - r.top)  / r.height - 0.5) * MAX_TILT;
      targetRY =  ((e.clientX - r.left) / r.width  - 0.5) * MAX_TILT;
    });

    card.addEventListener('mouseenter', () => {
      cancelAnimationFrame(animId);
      function lerp() {
        currentRX += (targetRX - currentRX) * 0.10;
        currentRY += (targetRY - currentRY) * 0.10;
        card.style.transform = `translateY(-6px) scale(1.01) rotateX(${currentRX}deg) rotateY(${currentRY}deg)`;
        animId = requestAnimationFrame(lerp);
      }
      lerp();
    });

    card.addEventListener('mouseleave', () => {
      cancelAnimationFrame(animId);
      targetRX = 0; targetRY = 0;
      function springBack() {
        currentRX *= 0.75; currentRY *= 0.75;
        card.style.transform = `translateY(${-6*Math.max(Math.abs(currentRX),Math.abs(currentRY))/MAX_TILT}px) scale(1) rotateX(${currentRX}deg) rotateY(${currentRY}deg)`;
        if (Math.abs(currentRX) > 0.05 || Math.abs(currentRY) > 0.05) animId = requestAnimationFrame(springBack);
        else { card.style.transform = ''; currentRX = 0; currentRY = 0; }
      }
      animId = requestAnimationFrame(springBack);
    });
  });
})();


/* ══════════════════════════════════════
   PRELOAD IMÁGENES CRÍTICAS
   ══════════════════════════════════════ */
(function preloadCriticalImages() {
  ['images/obra/obra-001.jpg', 'images/obra/obra-002.jpg', 'images/obra/obra-003.jpg'].forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload'; link.as = 'image'; link.href = src;
    document.head.appendChild(link);
  });
})();


/* ══════════════════════════════════════
   LIMPIAR CELDAS IG
   ══════════════════════════════════════ */
(function cleanInstagramCells() {
  document.querySelectorAll('.ig-img-placeholder span').forEach(el => el.remove());
  document.querySelectorAll('.ig-overlay').forEach(el => el.remove());
})();


/* ══════════════════════════════════════════════════════════
   GLYPH FIELD — Lenguaje alien bio-mecánico
   · Canvas fijo de fondo — z-index 0, no interfiere con contenido
   · Pool de 80 glifos reutilizados (sin GC durante el loop)
   · Solo globalAlpha + translate/rotate — sin filter ni shadow
   · MainLoop centralizado — pausa automática en tab oculta
   · Pulso suave: aparecen, mantienen y desaparecen gradualmente
   · Densidad muy baja (alpha máx 0.13) — decorativo, no invasivo
   ══════════════════════════════════════════════════════════ */
(function initGlyphField() {
  const canvas = document.getElementById('glyph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  let W = 0, H = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* Paleta: dorado tenue + plateado tenue — sin blanco puro */
  const PAL = [
    /* dorados */
    [200, 168,  75],
    [212, 184, 106],
    [184, 148,  58],
    [224, 200, 122],
    [160, 120,  48],
    /* plateados */
    [159, 168, 180],
    [184, 196, 206],
    [200, 212, 222],
    [128, 144, 160],
    /* cálido tenue */
    [212, 200, 154],
    [192, 184, 128],
  ];

  /* ── FAMILIAS DE GLIFOS alien bio-mecánico ── */
  /* Cada función recibe (ctx, s) donde s = radio del glifo */
  const GLYPHS = [
    /* 0 · Cruz astral de 8 brazos */
    function(c,s){ c.moveTo(0,-s);c.lineTo(0,s);c.moveTo(-s,0);c.lineTo(s,0);c.moveTo(-s*.71,-s*.71);c.lineTo(s*.71,s*.71);c.moveTo(s*.71,-s*.71);c.lineTo(-s*.71,s*.71); },
    /* 1 · Triángulo con eje vertebral */
    function(c,s){ c.moveTo(0,-s);c.lineTo(-s*.87,s*.5);c.lineTo(s*.87,s*.5);c.closePath();c.moveTo(0,-s*.3);c.lineTo(0,s*.5); },
    /* 2 · Ankh alien */
    function(c,s){ c.moveTo(0,-s*.1);c.lineTo(0,s);c.moveTo(-s*.55,-s*.15);c.lineTo(s*.55,-s*.15);c.arc(0,-s*.5,s*.38,0,Math.PI*2); },
    /* 3 · Ojo bio-mecánico */
    function(c,s){ c.arc(0,0,s*.55,0,Math.PI*2);c.moveTo(-s,-s*.08);c.lineTo(-s*.55,0);c.lineTo(-s,s*.08);c.moveTo(s,-s*.08);c.lineTo(s*.55,0);c.lineTo(s,s*.08); },
    /* 4 · Diamante nervado */
    function(c,s){ c.moveTo(0,-s);c.lineTo(s*.65,0);c.lineTo(0,s);c.lineTo(-s*.65,0);c.closePath();c.moveTo(0,-s*.45);c.lineTo(0,s*.45);c.moveTo(-s*.32,0);c.lineTo(s*.32,0); },
    /* 5 · Vértebra doble */
    function(c,s){ c.moveTo(-s,s*.28);c.bezierCurveTo(-s*.3,-s*.08,s*.3,-s*.08,s,s*.28);c.moveTo(-s,-s*.28);c.bezierCurveTo(-s*.3,s*.08,s*.3,s*.08,s,-s*.28);c.moveTo(0,-s*.6);c.lineTo(0,s*.6); },
    /* 6 · Nodo celular con antenas */
    function(c,s){ c.arc(0,0,s*.45,0,Math.PI*2);c.moveTo(-s,0);c.lineTo(-s*.45,0);c.moveTo(s*.45,0);c.lineTo(s,0);c.moveTo(0,-s*.45);c.lineTo(0,-s);c.moveTo(0,s*.45);c.lineTo(0,s); },
    /* 7 · Escáner de esquinas (bracket alien) */
    function(c,s){ var h=s*.55;c.moveTo(-s,-h);c.lineTo(-s*.4,-h);c.moveTo(s*.4,-h);c.lineTo(s,-h);c.lineTo(s,-s*.3);c.moveTo(s,s*.3);c.lineTo(s,h);c.lineTo(s*.4,h);c.moveTo(-s*.4,h);c.lineTo(-s,h);c.lineTo(-s,s*.3);c.moveTo(-s,-s*.3);c.lineTo(-s,-h); },
    /* 8 · Runa Ψ / tridente */
    function(c,s){ c.moveTo(-s*.7,0);c.bezierCurveTo(-s*.7,-s,s*.7,-s,s*.7,0);c.moveTo(0,-s*.75);c.lineTo(0,s);c.moveTo(-s*.35,s*.35);c.lineTo(s*.35,s*.35); },
    /* 9 · Doble chevron alien */
    function(c,s){ c.moveTo(-s,s*.1);c.lineTo(0,-s*.7);c.lineTo(s,s*.1);c.moveTo(-s*.6,s*.6);c.lineTo(0,-s*.2);c.lineTo(s*.6,s*.6); },
    /* 10 · Espiral / caracol */
    function(c,s){ var steps=20,a=0;c.moveTo(s*.05,0);for(var i=1;i<=steps;i++){a=i*(Math.PI*2/steps);var r=s*.05+s*.95*(i/steps);c.lineTo(r*Math.cos(a),r*Math.sin(a));} },
    /* 11 · Nervio ramificado */
    function(c,s){ c.moveTo(0,s*.8);c.lineTo(0,0);c.lineTo(-s*.7,-s*.55);c.moveTo(0,0);c.lineTo(s*.7,-s*.55);c.moveTo(0,0);c.lineTo(0,-s*.8);c.moveTo(-s*.7,-s*.55);c.lineTo(-s*.95,-s*.35);c.moveTo(s*.7,-s*.55);c.lineTo(s*.95,-s*.35); },
    /* 12 · Membrana elíptica con eje */
    function(c,s){ c.ellipse(0,0,s*.85,s*.5,0,0,Math.PI*2);c.moveTo(-s*.85,0);c.lineTo(s*.85,0);c.moveTo(0,-s*.5);c.lineTo(0,s*.5); },
    /* 13 · Cruz cuadrada alien */
    function(c,s){ c.rect(-s*.28,-s,s*.56,s*2);c.rect(-s,-s*.28,s*2,s*.56); },
    /* 14 · Constelación / patrón estelar */
    function(c,s){ var pts=[[0,-s],[s*.95,-s*.31],[s*.59,s*.81],[-s*.59,s*.81],[-s*.95,-s*.31]];for(var i=0;i<pts.length;i++){var a=pts[i],b=pts[(i+1)%pts.length];c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.arc(a[0],a[1],s*.08,0,Math.PI*2);} },
    /* 15 · Tubo orgánico doble */
    function(c,s){ c.moveTo(-s,s*.22);c.bezierCurveTo(-s*.28,s*.22,s*.28,-s*.22,s,-s*.22);c.moveTo(-s,-s*.22);c.bezierCurveTo(-s*.28,-s*.22,s*.28,s*.22,s,s*.22);c.moveTo(-s,-s*.22);c.lineTo(-s,s*.22);c.moveTo(s,-s*.22);c.lineTo(s,s*.22); },
  ];

  /* ── POOL DE GLIFOS — datos puros, sin objetos DOM ── */
  const POOL = 80;
  const gx    = new Float32Array(POOL);  // posición x
  const gy    = new Float32Array(POOL);  // posición y
  const gsz   = new Float32Array(POOL);  // tamaño (radio)
  const grot  = new Float32Array(POOL);  // rotación actual
  const grspd = new Float32Array(POOL);  // velocidad rotación
  const gdx   = new Float32Array(POOL);  // deriva x
  const gdy   = new Float32Array(POOL);  // deriva y
  const galph = new Float32Array(POOL);  // alpha actual
  const gatgt = new Float32Array(POOL);  // alpha objetivo (peak)
  const gph   = new Float32Array(POOL);  // fase del pulso
  const gspd  = new Float32Array(POOL);  // velocidad del pulso
  const glife = new Int32Array(POOL);    // vida actual (frames)
  const gmaxl = new Int32Array(POOL);    // vida máxima (frames)
  const ghold = new Int32Array(POOL);    // frame en que pasa a hold
  const gst   = new Uint8Array(POOL);    // estado: 0=in 1=hold 2=out
  const gfn   = new Uint8Array(POOL);    // índice de glifo
  const gcol  = new Uint8Array(POOL);    // índice de color

  function rnd(a,b){ return a + Math.random()*(b-a); }
  function rndInt(n){ return Math.floor(Math.random()*n); }

  function initSlot(i, stagger) {
    gx[i]    = rnd(0, W || window.innerWidth);
    gy[i]    = rnd(0, H || window.innerHeight);
    gsz[i]   = rnd(3.5, 13);
    grot[i]  = rnd(0, Math.PI*2);
    grspd[i] = rnd(-0.0025, 0.0025);
    gdx[i]   = rnd(-0.10, 0.10);
    gdy[i]   = rnd(-0.06, 0.06);
    /* alpha muy bajo — decorativo, no invasivo */
    gatgt[i] = rnd(0.03, 0.11);
    galph[i] = stagger ? gatgt[i] * rnd(0, 1) : 0;
    gph[i]   = rnd(0, Math.PI*2);
    gspd[i]  = rnd(0.25, 0.80);
    gmaxl[i] = 220 + rndInt(380);
    ghold[i] = 35  + rndInt(70);
    glife[i] = stagger ? rndInt(gmaxl[i]) : 0;
    gst[i]   = stagger ? 1 : 0;  // stagger = ya en hold
    gfn[i]   = rndInt(GLYPHS.length);
    gcol[i]  = rndInt(PAL.length);
  }

  for (let i = 0; i < POOL; i++) initSlot(i, true);

  /* ── TICK — integrado en MainLoop ── */
  MainLoop.add(function glyphFieldTick(dt, t) {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < POOL; i++) {
      /* actualizar vida y posición */
      glife[i]++;
      grot[i] += grspd[i];
      gx[i]   += gdx[i];
      gy[i]   += gdy[i];

      /* wrap de bordes */
      if (gx[i] < -16) gx[i] = W + 16;
      else if (gx[i] > W + 16) gx[i] = -16;
      if (gy[i] < -16) gy[i] = H + 16;
      else if (gy[i] > H + 16) gy[i] = -16;

      /* máquina de estados */
      if (gst[i] === 0) {
        /* fade in suave */
        galph[i] += (gatgt[i] - galph[i]) * 0.038;
        if (glife[i] >= ghold[i]) gst[i] = 1;
      } else if (gst[i] === 1) {
        /* pulso sinusoidal — solo modula amplitude un 35% */
        galph[i] = gatgt[i] * (0.65 + 0.35 * Math.sin(t * gspd[i] + gph[i]));
        if (glife[i] >= gmaxl[i] - 55) gst[i] = 2;
      } else {
        /* fade out */
        galph[i] *= 0.960;
        if (galph[i] < 0.003 || glife[i] >= gmaxl[i]) {
          initSlot(i, false);  /* renacer en posición aleatoria */
          continue;
        }
      }

      /* skip si invisible */
      if (galph[i] < 0.003) continue;

      /* dibujar — solo stroke, sin fill, sin sombra */
      const col = PAL[gcol[i]];
      ctx.save();
      ctx.translate(gx[i], gy[i]);
      ctx.rotate(grot[i]);
      ctx.globalAlpha = galph[i];
      ctx.strokeStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
      ctx.lineWidth   = gsz[i] > 9 ? 0.65 : 0.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      GLYPHS[gfn[i]](ctx, gsz[i]);
      ctx.stroke();
      ctx.restore();
    }
  });
})();


/* Branding solo en dev — en producción el security module silencia la consola */
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.includes('.local')) {
  console.log('%c✦ ANTARES ✦','color:#b892d8;font-family:serif;font-size:13px;letter-spacing:4px;background:#050208;padding:8px 16px;border:1px solid rgba(120,80,160,0.30);');
}


/* ══════════════════════════════════════
   LIGHTBOX — nativo sin dependencias
   Abre gallery-card e ig-triptych-cell en overlay
   ══════════════════════════════════════ */
(function initLightbox() {
  /* Crear overlay */
  const lb = document.createElement('div');
  lb.id = 'antares-lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Imagen ampliada');
  lb.style.cssText = [
    'position:fixed;inset:0;z-index:9999',
    'background:rgba(3,2,8,0.96)',
    'display:none;align-items:center;justify-content:center',
    'cursor:zoom-out',
  ].join(';');

  const img = document.createElement('img');
  img.alt = '';
  img.style.cssText = [
    'max-width:90vw;max-height:88vh',
    'object-fit:contain',
    'box-shadow:0 0 60px rgba(120,80,180,0.18)',
    'border:1px solid rgba(120,80,160,0.20)',
    'user-select:none;-webkit-user-select:none',
    'pointer-events:none',
    'transition:opacity 0.22s ease',
  ].join(';');

  const caption = document.createElement('p');
  caption.style.cssText = [
    'position:absolute;bottom:28px;left:0;right:0',
    'text-align:center',
    'font-family:"Cinzel",serif;font-size:11px;letter-spacing:3px',
    'color:rgba(210,190,160,0.55)',
    'pointer-events:none',
  ].join(';');

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.style.cssText = [
    'position:absolute;top:20px;right:24px',
    'background:none;border:none;cursor:pointer',
    'color:rgba(210,190,160,0.55);font-size:22px;line-height:1',
    'padding:8px;transition:color 0.2s',
  ].join(';');
  closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = 'rgba(210,190,160,0.95)');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = 'rgba(210,190,160,0.55)');

  /* Nav arrows */
  const mkArrow = (dir) => {
    const a = document.createElement('button');
    a.setAttribute('aria-label', dir === -1 ? 'Anterior' : 'Siguiente');
    a.style.cssText = [
      'position:absolute;top:50%;transform:translateY(-50%)',
      dir === -1 ? 'left:20px' : 'right:20px',
      'background:none;border:none;cursor:pointer',
      'color:rgba(210,190,160,0.45);font-size:28px;line-height:1',
      'padding:12px;transition:color 0.2s',
    ].join(';');
    a.innerHTML = dir === -1 ? '‹' : '›';
    a.addEventListener('mouseenter', () => a.style.color = 'rgba(210,190,160,0.9)');
    a.addEventListener('mouseleave', () => a.style.color = 'rgba(210,190,160,0.45)');
    return a;
  };
  const prevBtn = mkArrow(-1);
  const nextBtn = mkArrow(1);

  lb.appendChild(img);
  lb.appendChild(caption);
  lb.appendChild(closeBtn);
  lb.appendChild(prevBtn);
  lb.appendChild(nextBtn);
  document.body.appendChild(lb);

  /* State */
  let items = [];
  let current = 0;

  function open(group, index) {
    items = Array.from(document.querySelectorAll(`[data-lightbox="${group}"]`));
    current = index;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadImage(current);
  }

  function close() {
    lb.style.display = 'none';
    document.body.style.overflow = '';
    img.src = '';
    items = [];
  }

  function loadImage(idx) {
    const el = items[idx];
    if (!el) return;
    const src = el.getAttribute('href');
    const label = el.getAttribute('aria-label') || '';
    img.style.opacity = '0';
    img.onload = () => { img.style.opacity = '1'; };
    img.src = src;
    caption.textContent = label;
    prevBtn.style.display = items.length > 1 ? '' : 'none';
    nextBtn.style.display = items.length > 1 ? '' : 'none';
  }

  function navigate(dir) {
    current = (current + dir + items.length) % items.length;
    loadImage(current);
  }

  /* Click on cards */
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-lightbox]');
    if (!card) return;
    e.preventDefault();
    const group = card.getAttribute('data-lightbox');
    const idx   = parseInt(card.getAttribute('data-index') || '0', 10);
    open(group, idx);
  });

  /* Controls */
  closeBtn.addEventListener('click', e => { e.stopPropagation(); close(); });
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  prevBtn.addEventListener('click', e => { e.stopPropagation(); navigate(-1); });
  nextBtn.addEventListener('click', e => { e.stopPropagation(); navigate(1); });

  document.addEventListener('keydown', e => {
    if (lb.style.display === 'none') return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
})();
