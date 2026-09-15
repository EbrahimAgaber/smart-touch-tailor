/* ═══════════════════════════════════════════════════════════
   SMART TOUCH POS — SCRIPT
   - Three.js subtle particle background
   - GSAP word intro → reveal hero content
   - Scroll-driven 3D device tilt + parallax
   - Feature card 3D mouse-tilt
   - Infinite gallery drag scroll
   - Counter animation on stats
   - Micro-interactions
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════
   1. THREE.JS PARTICLE FIELD
   ══════════════════════════════════════════════════ */
(function initThree() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 4;

  const COUNT = 700;
  const positions = new Float32Array(COUNT * 3);
  const colors    = new Float32Array(COUNT * 3);
  const sizes     = new Float32Array(COUNT);

  const palette = [
    new THREE.Color('#3D52D5'),
    new THREE.Color('#6478E8'),
    new THREE.Color('#0891B2'),
    new THREE.Color('#B8C4DE'),
    new THREE.Color('#8BA3C9'),
  ];

  for (let i = 0; i < COUNT; i++) {
    positions[i*3]   = (Math.random() - 0.5) * 10;
    positions[i*3+1] = (Math.random() - 0.5) * 10;
    positions[i*3+2] = (Math.random() - 0.5) * 8;
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    sizes[i] = Math.random() * 0.03 + 0.008;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  // Soft circle texture
  const cc = document.createElement('canvas');
  cc.width = cc.height = 32;
  const cx = cc.getContext('2d');
  const grd = cx.createRadialGradient(16,16,0,16,16,16);
  grd.addColorStop(0,'rgba(255,255,255,1)');
  grd.addColorStop(1,'rgba(255,255,255,0)');
  cx.fillStyle = grd;
  cx.fillRect(0,0,32,32);
  const tex = new THREE.CanvasTexture(cc);

  const mat = new THREE.PointsMaterial({
    size: 0.03,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    map: tex,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // Connecting lines (very sparse)
  const lineVerts = [];
  const step = 12;
  for (let i = 0; i < COUNT - step; i += step) {
    lineVerts.push(positions[i*3], positions[i*3+1], positions[i*3+2]);
    lineVerts.push(positions[(i+step)*3], positions[(i+step)*3+1], positions[(i+step)*3+2]);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x3D52D5, transparent: true, opacity: 0.04,
    blending: THREE.NormalBlending,
  });
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', e => {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 0.3;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 0.15;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.0007;
    points.rotation.y = t * 0.035 + mouse.x;
    points.rotation.x = t * 0.012 + mouse.y;
    const b = 1 + Math.sin(t * 1.2) * 0.006;
    points.scale.set(b, b, b);
    renderer.render(scene, camera);
  }
  animate();
})();

/* ══════════════════════════════════════════════════
   2. GSAP + SCROLLTRIGGER REGISTRATION
   ══════════════════════════════════════════════════ */
gsap.registerPlugin(ScrollTrigger);

/* ══════════════════════════════════════════════════
   3. WORD INTRO → HERO REVEAL
   ══════════════════════════════════════════════════ */
(function wordIntro() {
  const overlay      = document.getElementById('words-overlay');
  const heroContent  = document.getElementById('hero-content');
  const badge        = document.getElementById('zatca-badge');
  const heroLeft     = document.getElementById('hero-left');
  const heroRight    = document.getElementById('hero-right');
  const scrollInvite = document.getElementById('scroll-invite');

  if (!overlay || !heroContent) return;

  const tl = gsap.timeline({
    onComplete() {
      // Hide overlay so it no longer blocks interaction
      overlay.style.display = 'none';
    }
  });

  const words = ['#word-1', '#word-2', '#word-3'];

  words.forEach((id, i) => {
    tl.to(id, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, i * 0.85)
      .to(id, { opacity: 0, y: -16, duration: 0.4, ease: 'power2.in' }, i * 0.85 + 0.5);
  });

  // After words: reveal hero content
  tl.to(heroContent, { opacity: 1, duration: 0.5, ease: 'power2.out' }, '+=0.1')
    .to(badge,       { opacity: 1, y: 0, duration: 0.55, ease: 'back.out(1.4)' }, '<')
    .from('.ht-line', { opacity: 0, y: 28, stagger: 0.12, duration: 0.6, ease: 'power3.out' }, '<+0.1')
    .from('#hero-left .hero-sub',     { opacity: 0, y: 18, duration: 0.5 }, '<+0.2')
    .from('#hero-left .hero-actions', { opacity: 0, y: 18, duration: 0.5 }, '<+0.12')
    .from('#hero-left .hero-stats',   { opacity: 0, y: 14, duration: 0.5 }, '<+0.12')
    .from(heroRight, { opacity: 0, x: 40, duration: 0.7, ease: 'power3.out' }, '<-0.3')
    .from(['#fc1','#fc2','#fc3','#fc4'], {
      opacity: 0, scale: 0.8, y: 10,
      stagger: 0.12, duration: 0.45, ease: 'back.out(1.5)'
    }, '<+0.2')
    .from(scrollInvite, { opacity: 0, y: 10, duration: 0.4 }, '<+0.3');
})();

/* ══════════════════════════════════════════════════
   4. 3D DEVICE TILT — Mouse parallax
   ══════════════════════════════════════════════════ */
(function deviceTilt() {
  const frame = document.getElementById('device-frame');
  if (!frame) return;

  const wrap = frame.closest('.hero-right');
  if (!wrap) return;

  wrap.addEventListener('mousemove', e => {
    const r   = wrap.getBoundingClientRect();
    const cx  = r.left + r.width  / 2;
    const cy  = r.top  + r.height / 2;
    const dx  = (e.clientX - cx) / (r.width  / 2);
    const dy  = (e.clientY - cy) / (r.height / 2);
    const rotX = -dy * 10;
    const rotY =  dx * 12;
    gsap.to(frame, {
      duration: 0.5, ease: 'power2.out',
      transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
    });
  });

  wrap.addEventListener('mouseleave', () => {
    gsap.to(frame, {
      duration: 0.8, ease: 'power3.out',
      transform: 'perspective(1000px) rotateX(8deg) rotateY(-14deg)',
    });
  });
})();

/* ══════════════════════════════════════════════════
   5. SCROLL-DRIVEN DEVICE PARALLAX
   ══════════════════════════════════════════════════ */
(function deviceParallax() {
  const wrap = document.getElementById('device-wrap');
  if (!wrap) return;
  gsap.to(wrap, {
    y: -40,
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.5,
    }
  });
})();

/* ══════════════════════════════════════════════════
   6. FEATURE CARD 3D TILT
   ══════════════════════════════════════════════════ */
(function featureTilt() {
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width  - 0.5;
      const dy = (e.clientY - r.top)  / r.height - 0.5;
      gsap.to(card, {
        duration: 0.3, ease: 'power1.out',
        rotateX: -dy * 8,
        rotateY:  dx * 8,
        transformPerspective: 800,
        z: 10,
      });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { duration: 0.5, ease: 'power3.out', rotateX: 0, rotateY: 0, z: 0 });
    });
  });
})();

/* ══════════════════════════════════════════════════
   7. SCROLL REVEAL — Feature cards, Testimonials, Section headers
   ══════════════════════════════════════════════════ */
(function scrollReveal() {
  // Section headers
  document.querySelectorAll('.reveal-up').forEach(el => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      onEnter: () => el.classList.add('revealed'),
    });
  });

  // Feature cards with stagger
  document.querySelectorAll('.feature-card').forEach(card => {
    const delay = parseFloat(card.dataset.delay || 0) / 1000;
    ScrollTrigger.create({
      trigger: card,
      start: 'top 88%',
      onEnter: () => {
        gsap.to(card, {
          opacity: 1, y: 0,
          delay, duration: 0.6,
          ease: 'power3.out',
        });
        card.classList.add('revealed');
      },
    });
  });

  // Testimonial cards
  document.querySelectorAll('.testi-card').forEach(card => {
    const delay = parseFloat(card.dataset.delay || 0) / 1000;
    ScrollTrigger.create({
      trigger: card,
      start: 'top 90%',
      onEnter: () => {
        gsap.to(card, {
          opacity: 1, y: 0,
          delay, duration: 0.6,
          ease: 'power3.out',
        });
        card.classList.add('revealed');
      },
    });
  });
})();

/* ══════════════════════════════════════════════════
   8. STATS COUNTER ANIMATION
   ══════════════════════════════════════════════════ */
(function statsCounter() {
  document.querySelectorAll('.stat-block').forEach(block => {
    const el      = block.querySelector('.sb-num');
    const target  = parseFloat(block.dataset.count);
    const suffix  = block.dataset.suffix  || '';
    const decimal = parseInt(block.dataset.decimal || 0);

    ScrollTrigger.create({
      trigger: block,
      start: 'top 85%',
      once: true,
      onEnter() {
        gsap.fromTo({ v: 0 }, { v: target }, {
          duration: 1.8, ease: 'power2.out',
          onUpdate() {
            const val = this.targets()[0].v;
            el.textContent = decimal
              ? val.toFixed(decimal) + suffix
              : Math.round(val).toLocaleString('ar-SA') + suffix;
          },
        });
      },
    });
  });
})();

/* ══════════════════════════════════════════════════
   9. INFINITE GALLERY CAROUSEL (drag + auto-scroll)
   ══════════════════════════════════════════════════ */
(function gallery() {
  const wrap  = document.getElementById('gallery-wrap');
  const track = document.getElementById('gallery-track');
  if (!wrap || !track) return;

  // Clone slides for seamless loop
  const slides = [...track.children];
  slides.forEach(s => track.appendChild(s.cloneNode(true)));

  let x         = 0;
  let vel       = 0;
  let dragging  = false;
  let startX    = 0;
  let startPos  = 0;
  const AUTO    = 0.6; // px per frame auto-scroll

  function setX(val) {
    const half = track.scrollWidth / 2;
    if (val <= -half) val += half;
    if (val >= 0)     val -= half;
    x = val;
    track.style.transform = `translateX(${x}px)`;
  }

  let raf;
  function loop() {
    if (!dragging) {
      vel *= 0.93;
      setX(x - AUTO - vel);
    }
    raf = requestAnimationFrame(loop);
  }
  loop();

  // Drag
  wrap.addEventListener('pointerdown', e => {
    dragging = true;
    startX   = e.clientX;
    startPos = x;
    wrap.style.cursor = 'grabbing';
    cancelAnimationFrame(raf);
  });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    vel = 0;
    setX(startPos + (e.clientX - startX));
  });
  window.addEventListener('pointerup', e => {
    if (!dragging) return;
    vel = -(e.clientX - startX) * 0.15;
    dragging = false;
    wrap.style.cursor = 'grab';
    raf = requestAnimationFrame(loop);
  });
})();

/* ══════════════════════════════════════════════════
   10. NAVIGATION — scroll class + progress bar
   ══════════════════════════════════════════════════ */
(function navBehavior() {
  const nav      = document.getElementById('main-nav');
  const progress = document.getElementById('nav-progress');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (window.scrollY / max * 100) + '%';
    }
  }, { passive: true });
})();

/* ══════════════════════════════════════════════════
   11. LIVE CLOCK in app mockup
   ══════════════════════════════════════════════════ */
(function liveClock() {
  const el = document.getElementById('app-clock');
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent =
      String(now.getHours()).padStart(2,'0') + ':' +
      String(now.getMinutes()).padStart(2,'0');
  }
  tick();
  setInterval(tick, 10000);
})();

/* ══════════════════════════════════════════════════
   12. CTA FORM — saves leads to localStorage
   ══════════════════════════════════════════════════ */
(function ctaForm() {
  const btn   = document.getElementById('form-submit');
  const nameI = document.getElementById('form-name');
  const phoneI= document.getElementById('form-phone');
  const form  = document.getElementById('cta-form');
  if (!btn || !nameI || !phoneI || !form) return;

  btn.addEventListener('click', e => {
    e.preventDefault();
    const name  = nameI.value.trim();
    const phone = phoneI.value.trim();

    // Validation shake
    if (!name || !phone) {
      gsap.fromTo(form,
        { x: -8 },
        { x: 8, repeat: 5, yoyo: true, duration: 0.07, ease: 'none', clearProps: 'x' }
      );
      if (!name)  gsap.to(nameI,  { borderColor: '#EF4444', duration: .2, yoyo: true, repeat: 1 });
      if (!phone) gsap.to(phoneI, { borderColor: '#EF4444', duration: .2, yoyo: true, repeat: 1 });
      return;
    }

    // Save to localStorage
    const leads = JSON.parse(localStorage.getItem('pos_leads') || '[]');
    leads.unshift({
      id:    Date.now(),
      name,
      phone,
      date:  new Date().toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }),
      status: 'new',
    });
    localStorage.setItem('pos_leads', JSON.stringify(leads));

    // Success animation
    gsap.timeline()
      .to(form, { scale: 0.97, opacity: 0, duration: 0.25, ease: 'power2.in' })
      .set(form, { display: 'none' })
      .from('.success-msg', { opacity: 0, y: 20, duration: 0.5, ease: 'back.out(1.4)',
        onStart() {
          let msg = document.querySelector('.success-msg');
          if (!msg) {
            msg = document.createElement('div');
            msg.className = 'success-msg';
            msg.innerHTML = `
              <div class="success-icon">✓</div>
              <div class="success-title">تم الاستلام بنجاح!</div>
              <div class="success-sub">سيتواصل معك فريقنا خلال 24 ساعة على رقم <strong dir="ltr">${phone}</strong></div>
            `;
            form.parentNode.insertBefore(msg, form.nextSibling);
          }
        }
      });
  });
})();

/* ══════════════════════════════════════════════════
   13. CTA BUTTON — shimmer hover
   ══════════════════════════════════════════════════ */
(function ctaShimmer() {
  document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      gsap.fromTo(btn.querySelector('.btn-glow'),
        { opacity: 0, x: '-60%' },
        { opacity: 1, x: '60%', duration: 0.55, ease: 'power2.inOut',
          onComplete() { gsap.set(this.targets()[0], { opacity: 0 }); }
        });
    });
  });
})();
