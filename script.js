// Premium front-end interactions for Nexora Studio EG

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Scroll animations (IntersectionObserver)
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );

  $$('.reveal').forEach((el) => {
    observer.observe(el);
  });

  // Contact form submit: EmailJS
  const contactForm = $('#contactForm') || document.querySelector('#contact form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        const pkgEl = document.getElementById('selectedPackage');
        const pkg = pkgEl && pkgEl.value ? pkgEl.value : '';

        const name = contactForm.querySelector('input[name="name"]')?.value || '';
        const email = contactForm.querySelector('input[name="email"]')?.value || '';
        const msg = contactForm.querySelector('textarea[name="message"]')?.value || '';

        // EmailJS config (from your account)
        const SERVICE_ID = 'service_mbv7ipq';
        const TEMPLATE_ID = 'template_2pncu0j';
        const PUBLIC_KEY = 'vhVbArFUJf37Ocyzz';

        if (!window.emailjs) {
          throw new Error('EmailJS SDK not loaded. Add the EmailJS script tag in index.html');
        }

        window.emailjs.init(PUBLIC_KEY);

        await window.emailjs.send(SERVICE_ID, TEMPLATE_ID, {
          name,
          email,
          message: msg,
          package: pkg || 'General',
          serviceName: 'Nexora Studio EG'
        });

        alert('تم إرسال الرسالة بنجاح ✅');
        contactForm.reset();
      } catch (err) {
        console.error(err);
        alert('تعذر إرسال الرسالة. تأكد من تكوين EmailJS ثم جرّب مرة أخرى.');
      }

      return false;
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accordion-button]');
    if (!btn) return;

    const item = btn.closest('[data-accordion-item]');
    if (!item) return;

    const content = item.querySelector('[data-accordion-content]');
    if (!content) return;

    const isOpen = item.classList.contains('open');

    // Close others
    $$('# [data-accordion-item].open'.replace(' ', '')).forEach(() => {});
    $$('# [data-accordion-item].open');

    $$('#[data-accordion-item].open').forEach((other) => {
      if (other !== item) other.classList.remove('open');
    });

    item.classList.toggle('open', !isOpen);
  });

  // Mobile menu (optional)
  document.addEventListener('click', (e) => {
    const toggler = e.target.closest('[data-mobile-menu-toggle]');
    if (!toggler) return;

    const menu = document.querySelector('[data-mobile-menu]');
    if (!menu) return;

    menu.classList.toggle('open');
  });

  // Animated counters (only when visible)
  const counterObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const el = entry.target;
        const from = Number(el.dataset.from ?? 0);
        const to = Number(el.dataset.to ?? 0);
        const duration = Number(el.dataset.duration ?? 900);

        let start = null;
        const step = (ts) => {
          if (!start) start = ts;
          const p = Math.min((ts - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const value = Math.floor(from + (to - from) * eased);
          el.textContent = value;
          if (p < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
        counterObserver.unobserve(el);
      }
    },
    { threshold: 0.35 }
  );

  $$('.counter').forEach((el) => counterObserver.observe(el));
})();

