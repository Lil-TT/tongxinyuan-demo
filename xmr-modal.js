import gsap from 'gsap';
import { getLocale, applyDataI18n, messages } from './i18n.js';
import { LightRaysGL } from './light-rays-gl.js';

let lightRays = null;
let growlineObserver = null;
let currentSlide = 0;
let isOpen = false;

/** @type {HTMLElement | null} */
let root;
/** @type {HTMLElement | null} */
let backdrop;
/** @type {HTMLElement | null} */
let panel;
/** @type {HTMLElement | null} */
let raysMount;
/** @type {HTMLImageElement | null} */
let slideImg;
/** @type {HTMLElement | null} */
let descEl;
/** @type {HTMLElement | null} */
let titleEl;
/** @type {HTMLElement | null} */
let subtitleEl;

function disconnectGrowlineObserver() {
  if (growlineObserver) {
    growlineObserver.disconnect();
    growlineObserver = null;
  }
}

function setupGrowlineObserver(host, bar) {
  disconnectGrowlineObserver();
  if (!host || !bar) return;
  bar.classList.remove('is-grown');
  growlineObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) bar.classList.add('is-grown');
        else bar.classList.remove('is-grown');
      });
    },
    { threshold: 0.1, rootMargin: '0px' }
  );
  growlineObserver.observe(host);
}

function buildDescription(description, line) {
  if (!descEl) return;
  descEl.innerHTML = '';
  disconnectGrowlineObserver();

  if (!line || !description.includes(line)) {
    descEl.textContent = description;
    return;
  }

  const parts = description.split(line);
  const frag = document.createDocumentFragment();
  frag.appendChild(document.createTextNode(parts[0]));

  const host = document.createElement('span');
  host.className = 'xmr-growline-host';
  const lineText = document.createElement('span');
  lineText.className = 'xmr-line-text';
  lineText.textContent = line;
  const bar = document.createElement('span');
  bar.className = 'xmr-growline';
  bar.setAttribute('aria-hidden', 'true');
  host.appendChild(lineText);
  host.appendChild(bar);
  frag.appendChild(host);

  for (let i = 1; i < parts.length; i++) {
    frag.appendChild(document.createTextNode(parts[i]));
  }
  descEl.appendChild(frag);
  setupGrowlineObserver(host, bar);
}

function renderSlide() {
  const locale = getLocale();
  const slides = messages[locale]?.xmrSlides;
  if (!slides || !titleEl || !subtitleEl || !slideImg) return;
  const s = slides[currentSlide];
  if (!s) return;

  titleEl.textContent = s.title;
  subtitleEl.textContent = s.subtitle;
  buildDescription(s.description, s.line);
  slideImg.src = s.image;
  slideImg.alt = s.title;

  document.querySelectorAll('.xmr-modal__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === currentSlide);
    dot.setAttribute('aria-current', i === currentSlide ? 'true' : 'false');
  });
}

function destroyLightRays() {
  if (lightRays) {
    lightRays.destroy();
    lightRays = null;
  }
}

function startLightRays() {
  destroyLightRays();
  if (!raysMount) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!raysMount || !isOpen) return;
      lightRays = new LightRaysGL(raysMount, {
        raysOrigin: 'top-center',
        raysColor: '#fff',
        raysSpeed: 1,
        lightSpread: 0.5,
        rayLength: 3,
        fadeDistance: 1,
        saturation: 1,
        followMouse: true,
        mouseInfluence: 0.1,
        noiseAmount: 0,
        distortion: 0,
      });
    });
  });
}

function openModal() {
  if (!root || !backdrop || !panel || isOpen) return;
  isOpen = true;
  root.hidden = false;
  root.classList.add('is-open');
  root.setAttribute('aria-hidden', 'false');

  gsap.killTweensOf([backdrop, panel]);
  gsap.set(backdrop, { opacity: 0 });
  gsap.set(panel, { opacity: 0, scale: 0.95 });

  gsap
    .timeline({
      onComplete: () => startLightRays(),
    })
    .to(backdrop, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
    .to(panel, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }, 0);

  renderSlide();
}

function closeModal() {
  if (!root || !backdrop || !panel || !isOpen) return;
  isOpen = false;

  gsap.killTweensOf([backdrop, panel]);
  const tl = gsap.timeline({
    onComplete: () => {
      destroyLightRays();
      disconnectGrowlineObserver();
      root.classList.remove('is-open');
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
    },
  });
  tl.to(panel, { opacity: 0, scale: 0.95, duration: 0.25, ease: 'power2.in' }, 0).to(
    backdrop,
    { opacity: 0, duration: 0.25, ease: 'power2.in' },
    0
  );
}

function goSlide(delta) {
  const locale = getLocale();
  const n = messages[locale]?.xmrSlides?.length || 0;
  if (!n) return;
  currentSlide = (currentSlide + delta + n) % n;
  renderSlide();
}

function goSlideIndex(i) {
  const locale = getLocale();
  const n = messages[locale]?.xmrSlides?.length || 0;
  if (!n || i < 0 || i >= n) return;
  currentSlide = i;
  renderSlide();
}

export function initXMRModal() {
  root = document.getElementById('xmr-modal');
  backdrop = document.getElementById('xmr-modal-backdrop');
  panel = document.getElementById('xmr-modal-panel');
  raysMount = document.getElementById('xmr-modal-rays');
  slideImg = document.getElementById('xmr-slide-img');
  descEl = document.getElementById('xmr-slide-desc');
  titleEl = document.getElementById('xmr-slide-title');
  subtitleEl = document.getElementById('xmr-slide-subtitle');

  const exploreBtn = document.getElementById('explore-xmr-btn');
  const closeBtn = document.getElementById('xmr-modal-close');

  applyDataI18n(document);
  if (closeBtn) {
    const loc = getLocale();
    closeBtn.setAttribute('aria-label', messages[loc]?.xmr?.closeLabel || 'Close');
  }

  exploreBtn?.addEventListener('click', () => openModal());
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });
  backdrop?.addEventListener('click', () => closeModal());

  document.getElementById('xmr-slide-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goSlide(-1);
  });
  document.getElementById('xmr-slide-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goSlide(1);
  });

  document.querySelectorAll('.xmr-modal__dot').forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(dot.getAttribute('data-slide-index') || '0', 10);
      goSlideIndex(idx);
    });
  });

  window.addEventListener('eutron:locale', () => {
    applyDataI18n(document);
    const loc = getLocale();
    if (closeBtn) closeBtn.setAttribute('aria-label', messages[loc]?.xmr?.closeLabel || 'Close');
    if (isOpen) renderSlide();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeModal();
  });
}
