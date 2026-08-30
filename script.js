/* ==========================================================================
   PORTFOLIO SITE — MAIN SCRIPT
   Organized into clearly separated modules. Each one is self-contained and
   only runs if its required DOM elements exist, so nothing throws errors
   if you delete a section while re-using this script elsewhere.
   ========================================================================== */

/* Bail out early on touch devices — there's no mouse to track, so the
   cursor and tilt effects would just get in the way. */
const IS_TOUCH_DEVICE = window.matchMedia('(hover: none), (pointer: coarse)').matches;

document.addEventListener('DOMContentLoaded', () => {
  initCustomCursor();
  initParticleBackground();
  initNavbar();
  initCardTilt();
  initScrollReveal();
  initStatCounters();
  initContactForm();
});


/* ==========================================================================
   MODULE 1 — CUSTOM CURSOR (dot + lagging outline)
   --------------------------------------------------------------------------
   Strategy:
   - `mouse`  : the real, instantaneous cursor position (updated every
                mousemove event).
   - `outline`: a position that chases `mouse` every animation frame using
                linear interpolation (lerp). A small lerp factor (e.g. 0.15)
                means the outline only closes 15% of the remaining distance
                each frame — that's what produces the smooth "spring/lag"
                trailing effect, entirely without a physics library.
   ========================================================================== */
function initCustomCursor() {
  if (IS_TOUCH_DEVICE) return;

  const dot = document.getElementById('cursorDot');
  const outline = document.getElementById('cursorOutline');
  if (!dot || !outline) return;

  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const outlinePos = { x: mouse.x, y: mouse.y };

  // Lower = laggier/springier. Higher = tighter/faster follow.
  const LERP_FACTOR = 0.15;

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    // The dot has no lag — it should feel glued to the real pointer.
    dot.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
  });

  // Linear interpolation helper: moves `start` a fraction `amt` of the
  // way towards `end`. Called every frame, this produces easing/spring
  // motion without needing velocity, mass, or any real physics math.
  function lerp(start, end, amt) {
    return start + (end - start) * amt;
  }

  function animateOutline() {
    outlinePos.x = lerp(outlinePos.x, mouse.x, LERP_FACTOR);
    outlinePos.y = lerp(outlinePos.y, mouse.y, LERP_FACTOR);

    outline.style.transform = `translate(${outlinePos.x}px, ${outlinePos.y}px) translate(-50%, -50%)`;

    requestAnimationFrame(animateOutline);
  }
  animateOutline();

  // Grow + glow the outline whenever the pointer crosses any interactive
  // element tagged with [data-hover] (nav links, buttons, project links...).
  const hoverTargets = document.querySelectorAll('[data-hover]');
  hoverTargets.forEach((el) => {
    el.addEventListener('mouseenter', () => outline.classList.add('is-active'));
    el.addEventListener('mouseleave', () => outline.classList.remove('is-active'));
  });
}


/* ==========================================================================
   MODULE 2 — 3D PARTICLE BACKGROUND (hero canvas)
   --------------------------------------------------------------------------
   Pure 2D canvas, no WebGL/Three.js. The "3D" illusion comes from giving
   every particle a `z` depth value between 0 (far) and 1 (near):
   - size and opacity scale with z (near particles are bigger & brighter)
   - particles drift slowly in x/y AND slowly oscillate in z, so some
     particles seem to float toward/away from the camera over time
   - a subtle parallax shift is applied based on the mouse position, moving
     "near" particles more than "far" ones — the classic depth-parallax trick
   ========================================================================== */
function initParticleBackground() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width, height;
  let particles = [];
  const PARTICLE_COUNT = 110;
  const MAX_LINK_DISTANCE = 130; // particles closer than this get a connecting line

  // Mouse position normalized to -1..1 relative to canvas center, used for
  // the parallax offset. Defaults to center so nothing jumps before the
  // first mousemove event fires.
  const parallax = { x: 0, y: 0 };

  function resize() {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random(),                          // depth: 0 = far, 1 = near
      vx: (Math.random() - 0.5) * 0.25,           // slow horizontal drift
      vy: (Math.random() - 0.5) * 0.25,           // slow vertical drift
      vz: (Math.random() - 0.5) * 0.002,          // slow depth oscillation
    }));
  }

  function updateParticle(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;

    // Bounce depth back and forth between 0.05 and 1 instead of clamping,
    // so particles keep gently drifting toward/away from camera forever.
    if (p.z <= 0.05 || p.z >= 1) p.vz *= -1;

    // Wrap around screen edges so the field feels infinite.
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw connecting lines first (so particles render on top of them).
    // Only link particles that are near each other AND reasonably close
    // in depth, which keeps the web looking like a 3D point cloud rather
    // than a flat 2D mesh.
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MAX_LINK_DISTANCE) {
          const avgDepth = (a.z + b.z) / 2;
          const opacity = (1 - dist / MAX_LINK_DISTANCE) * avgDepth * 0.35;
          ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw particles. Parallax offset is stronger for "near" (high z)
    // particles, weaker for "far" ones — this is what sells the depth.
    particles.forEach((p) => {
      updateParticle(p);

      const parallaxStrength = 18 * p.z;
      const drawX = p.x + parallax.x * parallaxStrength;
      const drawY = p.y + parallax.y * parallaxStrength;

      const radius = p.z * 2.2 + 0.4;
      const isCyan = p.x % 2 > 1; // arbitrary deterministic-ish color split
      const color = isCyan ? '34, 211, 238' : '139, 92, 246';

      ctx.beginPath();
      ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, ${0.25 + p.z * 0.6})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  // Only wire up mouse parallax on non-touch devices.
  if (!IS_TOUCH_DEVICE) {
    window.addEventListener('mousemove', (e) => {
      parallax.x = (e.clientX / window.innerWidth - 0.5) * 2;  // -1 .. 1
      parallax.y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 .. 1
    });
  }
}


/* ==========================================================================
   MODULE 3 — NAVBAR (scroll state + mobile menu toggle)
   ========================================================================== */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (!navbar) return;

  const SCROLL_THRESHOLD = 40;

  function onScroll() {
    navbar.classList.toggle('scrolled', window.scrollY > SCROLL_THRESHOLD);
  }
  onScroll(); // set initial state in case the page loads pre-scrolled
  window.addEventListener('scroll', onScroll, { passive: true });

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the mobile menu automatically once a link is tapped.
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        navToggle.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
}


/* ==========================================================================
   MODULE 4 — 3D TILT ON PROJECT CARDS
   --------------------------------------------------------------------------
   On every mousemove over a [data-tilt] card, we work out how far the
   cursor is from the card's center as a -1..1 ratio on each axis, then map
   that ratio to a rotation angle. Moving the mouse to the right edge
   rotates the card around the Y axis (as if pushing its right side back);
   moving to the top edge rotates around the X axis. We also update two
   CSS custom properties (--mx/--my) so the radial `.card-glow` in the CSS
   can track the cursor position for a synced lighting effect.
   ========================================================================== */
function initCardTilt() {
  if (IS_TOUCH_DEVICE) return;

  const cards = document.querySelectorAll('[data-tilt]');
  const MAX_ROTATE = 10; // degrees — keep this subtle for a premium feel

  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();

      // Cursor position relative to the card, normalized to -0.5..0.5
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;

      // Y-axis rotation follows horizontal movement; X-axis rotation is
      // inverted so moving the mouse UP tilts the TOP of the card toward you.
      const rotateY = relX * MAX_ROTATE * 2;
      const rotateX = relY * -MAX_ROTATE * 2;

      card.style.transform =
        `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

      // Feed the glow position (in percentages) to the CSS custom properties
      // consumed by .card-glow's radial-gradient.
      card.style.setProperty('--mx', `${(relX + 0.5) * 100}%`);
      card.style.setProperty('--my', `${(relY + 0.5) * 100}%`);
    });

    // Smoothly reset to neutral when the cursor leaves — the CSS transition
    // on .project-card's `transform` property handles the easing back.
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1200px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    });
  });
}


/* ==========================================================================
   MODULE 5 — SCROLL REVEAL + SKILL BAR ANIMATION
   --------------------------------------------------------------------------
   A single IntersectionObserver drives two things at once:
   1. Adds `.in-view` to any `.reveal` element once it's ~15% visible,
      which triggers the fade/slide-up transition defined in CSS.
   2. If the revealed element contains `.skill-fill` bars, it also adds
      `.animate` to each bar so its width transitions from 0 to --level.
   We only need each element to reveal once, so we unobserve it after.
   ========================================================================== */
function initScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('in-view');

        // Bonus: if this revealed block contains skill bars, animate them.
        entry.target.querySelectorAll('.skill-fill').forEach((fill) => {
          fill.classList.add('animate');
        });

        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );

  revealEls.forEach((el) => observer.observe(el));
}


/* ==========================================================================
   MODULE 6 — ANIMATED STAT COUNTERS (About section)
   --------------------------------------------------------------------------
   Counts each `[data-count]` number up from 0 to its target value once it
   scrolls into view, using requestAnimationFrame for a smooth ease-out
   rather than jumping through integers on a setInterval tick.
   ========================================================================== */
function initStatCounters() {
  const counters = document.querySelectorAll('.stat-num[data-count]');
  if (!counters.length) return;

  const DURATION = 1400; // ms

  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / DURATION, 1);
      // Ease-out cubic for a natural deceleration toward the target number.
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);

      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => observer.observe(el));
}


/* ==========================================================================
   MODULE 7 — CONTACT FORM (client-side only demo submission)
   --------------------------------------------------------------------------
   This is a static front-end demo with no backend, so we simulate a submit:
   validate required fields, show a "sending" state, then a success message.
   Wire this up to your real endpoint (fetch/EmailJS/Formspree/etc.) by
   replacing the `setTimeout` block with an actual network request.
   ========================================================================== */
function initContactForm() {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  const submitLabel = document.getElementById('submitLabel');
  if (!form || !status || !submitLabel) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      status.textContent = 'Please fill in every field before sending.';
      status.style.color = '#f26d6d';
      return;
    }

    submitLabel.textContent = 'Sending...';
    status.textContent = '';

    // Simulated network delay — swap this for a real fetch() call to your
    // backend or a form service, and resolve/reject based on its response.
    setTimeout(() => {
      submitLabel.textContent = 'Send Message';
      status.style.color = 'var(--color-cyan)';
      status.textContent = "Message sent — I'll get back to you shortly.";
      form.reset();
    }, 1200);
  });
}