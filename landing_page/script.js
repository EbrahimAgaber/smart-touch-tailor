// script.js
document.addEventListener("DOMContentLoaded", () => {
  // Intersection Observer for scroll animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-up');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Apply observation to cards and sections
  const animateElements = document.querySelectorAll('.feature-card, .showcase-item, .kpi-card, .section-header');
  animateElements.forEach((el, index) => {
    // Add base styles for animation
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.6s ease-out ${index * 0.1}s, transform 0.6s ease-out ${index * 0.1}s`;
    
    // Create class dynamically
    if (!document.querySelector('#dynamic-animations')) {
      const style = document.createElement('style');
      style.id = 'dynamic-animations';
      style.innerHTML = `
        .fade-in-up {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
      `;
      document.head.appendChild(style);
    }

    observer.observe(el);
  });

  // Dynamic Chart Bars animation (simple simulation)
  const bars = document.querySelectorAll('.bar');
  bars.forEach((bar, i) => {
    const targetHeight = bar.style.height;
    bar.style.height = '0%';
    setTimeout(() => {
      bar.style.transition = 'height 1s cubic-bezier(0.16, 1, 0.3, 1)';
      bar.style.height = targetHeight;
    }, 500 + (i * 100));
  });

  // Parallax effect on mouse move for mockup
  const mockupWrapper = document.querySelector('.mockup-wrapper');
  const mockup = document.querySelector('.mockup');

  if (mockupWrapper && mockup) {
    mockupWrapper.addEventListener('mousemove', (e) => {
      const rect = mockupWrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * 5; // max 5 deg
      const rotateY = ((x - centerX) / centerX) * -5; // max 5 deg
      
      // Keep the base rotation from CSS and add mouse offset
      mockup.style.transform = `rotateX(${8 + rotateX}deg) rotateY(${-4 + rotateY}deg) scale(0.95)`;
    });

    mockupWrapper.addEventListener('mouseleave', () => {
      mockup.style.transform = 'rotateX(8deg) rotateY(-4deg) scale(0.95)';
      mockup.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    });
    
    mockupWrapper.addEventListener('mouseenter', () => {
      mockup.style.transition = 'transform 0.1s ease-out';
    });
  }
});
