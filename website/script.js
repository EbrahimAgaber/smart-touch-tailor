/* ═══════════════════════════════════════════════
   البصمة الذكية — Smart Touch POS Website
   Interactive Script
   ═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initParticles();
  initStatsCounter();
  initScreenTabs();
  initPricingToggle();
  initFAQ();
  initScrollReveal();
  initSmoothScroll();
});

/* ── NAVBAR ── */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const burger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');

  // Sticky scroll effect
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    navbar.classList.toggle('scrolled', y > 60);
    lastScroll = y;
  }, { passive: true });

  // Mobile menu toggle
  burger?.addEventListener('click', () => {
    burger.classList.toggle('active');
    navLinks.classList.toggle('open');
  });

  // Close mobile menu on link click
  navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('active');
      navLinks.classList.remove('open');
    });
  });
}

/* ── PARTICLE CANVAS ── */
function initParticles() {
  // Respect prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.4 + 0.1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
        this.reset();
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96, 165, 250, ${this.opacity})`;
      ctx.fill();
    }
  }

  // Create particles
  const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(96, 165, 250, ${0.06 * (1 - dist / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    animId = requestAnimationFrame(animate);
  }
  animate();

  // Pause when not visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animId);
    } else {
      animate();
    }
  });
}

/* ── ANIMATED STATS COUNTER ── */
function initStatsCounter() {
  const statNumbers = document.querySelectorAll('.stat-number');
  let hasRun = false;

  function animateCount(el) {
    const target = parseInt(el.dataset.target) || 0;
    const suffix = el.dataset.suffix || '';
    const duration = 2000;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      el.textContent = (current > 0 ? '+' : '') + current + suffix;
      if (target === 100) el.textContent = current + suffix;
      if (target === 24) el.textContent = current + suffix;
      if (target === 6) el.textContent = current + suffix;
      if (target === 21) el.textContent = '+' + current + suffix;
      
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasRun) {
        hasRun = true;
        statNumbers.forEach((el, i) => {
          setTimeout(() => animateCount(el), i * 200);
        });
      }
    });
  }, { threshold: 0.5 });

  const statsBar = document.querySelector('.stats-bar');
  if (statsBar) observer.observe(statsBar);
}

/* ── SCREEN TABS ── */
function initScreenTabs() {
  const tabs = document.querySelectorAll('.screen-tab');
  const screenImage = document.getElementById('screenImage');
  
  const images = {
    dashboard: 'assets/img/dashboard.png',
    pos: 'assets/img/pos.png',
    inventory: 'assets/img/inventory.png'
  };

  const altTexts = {
    dashboard: 'شاشة لوحة التحكم — لوحة تحكم تحليلية مع رسوم بيانية للمبيعات والأرباح',
    pos: 'شاشة نقطة البيع — واجهة الكاشير مع سلة المشتريات والباركود',
    inventory: 'شاشة المخزون — إدارة المنتجات والمخزون والباركود'
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab & ARIA
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      // Fade transition for image
      const tabKey = tab.dataset.tab;
      if (screenImage && images[tabKey]) {
        screenImage.style.opacity = '0';
        setTimeout(() => {
          screenImage.src = images[tabKey];
          screenImage.alt = altTexts[tabKey] || 'شاشة التطبيق';
          screenImage.style.opacity = '1';
        }, 300);
      }
    });
  });
}

/* ── PRICING TOGGLE ── */
function initPricingToggle() {
  const toggle = document.getElementById('pricing-toggle');
  const labelMonthly = document.getElementById('label-monthly');
  const labelYearly = document.getElementById('label-yearly');

  if (!toggle) return;

  // Pricing data: { elementId: { monthly, yearly } }
  const prices = {
    'price-growth':  { monthly: '79', yearly: '690' },
    'price-pro':     { monthly: '199', yearly: '1,690' }
  };

  const periods = {
    'period-growth':  { monthly: 'شهرياً', yearly: 'سنوياً' },
    'period-pro':     { monthly: 'شهرياً', yearly: 'سنوياً' }
  };

  toggle.addEventListener('change', () => {
    const isYearly = toggle.checked;

    // Update labels
    if (labelMonthly && labelYearly) {
      labelMonthly.classList.toggle('active', !isYearly);
      labelYearly.classList.toggle('active', isYearly);
    }

    // Update prices with animation
    Object.entries(prices).forEach(([id, vals]) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => {
          el.textContent = isYearly ? vals.yearly : vals.monthly;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 200);
      }
    });

    // Update periods
    Object.entries(periods).forEach(([id, vals]) => {
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.textContent = isYearly ? vals.yearly : vals.monthly;
        }, 200);
      }
    });
  });

  // Make labels clickable
  labelMonthly?.addEventListener('click', () => {
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
  });
  labelYearly?.addEventListener('click', () => {
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
  });
}

/* ── FAQ ACCORDION ── */
function initFAQ() {
  const items = document.querySelectorAll('.faq-item');
  
  items.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      
      // Close all
      items.forEach(i => {
        i.classList.remove('open');
        const btn = i.querySelector('.faq-question');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
      
      // Toggle clicked
      if (!isOpen) {
        item.classList.add('open');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ── SCROLL REVEAL ── */
function initScrollReveal() {
  const elements = document.querySelectorAll('[data-aos]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  elements.forEach(el => observer.observe(el));
}

/* ── SMOOTH SCROLL ── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
