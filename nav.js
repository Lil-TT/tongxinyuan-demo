import gsap from 'gsap';
import { getLocale, setLocale, applyDataI18n, t } from './i18n.js';

// ==========================================
// 1. 导航栏的 HTML 模板 (Template)
// 注意：去掉了写死的 w--current，交给后面的 JS 动态判断
// ==========================================
const navHTML = `
<header class="navigation-w fixed-ui" id="global-header">
  <a href="./index.html" class="nav__logo-w" id="nav-logo-home" data-i18n-aria-label="nav.logoAria">
    <img src="./logo.png" alt="" class="nav-logo-img" width="121" height="32">
  </a>
  <nav id="main-nav" aria-label="Main navigation" class="navigation">
    <button id="menu-toggle" data-i18n-aria-label="nav.menuOpen" aria-expanded="false" aria-controls="main-nav" type="button" class="nav__header">
      <div class="menu__label" data-i18n-key="nav.menu"></div>
      <svg xmlns="http://www.w3.org/2000/svg" width="23" height="16" viewBox="0 0 23 16" fill="none" class="nav__burger">
        <circle cx="1.59766" cy="1.6709" r="1.25" fill="currentColor"></circle>
        <circle cx="11.6719" cy="1.6709" r="1.25" fill="currentColor"></circle>
        <circle cx="21.75" cy="1.6709" r="1.25" fill="currentColor"></circle>
        <circle cx="1.59766" cy="14.3301" r="1.25" fill="currentColor"></circle>
        <circle cx="11.6719" cy="14.3301" r="1.25" fill="currentColor"></circle>
        <circle cx="21.75" cy="14.3301" r="1.25" fill="currentColor"></circle>
      </svg>
      <div class="nav__line"></div>
    </button>
    <ul role="list" class="nav__list" style="margin-top:0.55rem">
      <li class="nav__item"><a href="./" class="nav__link" data-nav-home data-i18n-key="nav.home"></a></li>
      <li class="nav__item"><a href="./products.html" class="nav__link" data-i18n-key="nav.products"></a></li>
      <li class="nav__item"><a href="./careers.html" class="nav__link" data-i18n-key="nav.careers"></a></li>
      <li class="nav__item"><a href="./news.html" class="nav__link" data-i18n-key="nav.news"></a></li>
      <li class="nav__item"><a href="./contact.html" class="nav__link" data-i18n-key="nav.contact"></a></li>
    </ul>
  </nav>
</header>
`;

// ==========================================
// 2. 初始化与注入函数 (相当于 React 的 Render)
// ==========================================
export function initGlobalNav() {
  // 1. 将 HTML 动态插入到 <body> 的最前面
  document.body.insertAdjacentHTML('afterbegin', navHTML);

  // 2. 针对主页 3D 动画的特殊处理：
  // 如果是主页，需要加上 stage2-el 让它等待 3D 动画完成后才显示；
  // 如果是子页面（如新闻页），直接显示，不需要等。
  const currentPath = window.location.pathname;
  const isHome = currentPath === '/' || currentPath.includes('index.html');
  if (isHome) {
    document.getElementById('global-header').classList.add('stage2-el');
  } else {
    // 子页面直接给透明度为 1
    gsap.set('#global-header', { opacity: 1 });
  }

  // 3. 执行动画和路由事件绑定
  bindMenuAnimation();
  bindRoutingEvents();
  bindLogoHomeNavigation();
  initLocaleSwitcher();
}

function updateLocaleSwitcherUI(btn) {
  const loc = getLocale();
  const codeEl = btn.querySelector('.locale-switcher__code');
  if (codeEl) codeEl.textContent = loc === 'en' ? 'EN' : 'CN';
  btn.setAttribute('aria-label', loc === 'zh' ? t('nav.switchToEn') : t('nav.switchToZh'));
}

/** 右下角 [ LANGUAGE  CN ] */
function initLocaleSwitcher() {
  const currentPath = window.location.pathname;
  const isHome = currentPath === '/' || currentPath.includes('index.html');
  const homeRevealClass = isHome ? ' stage1-reveal-bar' : '';
  document.body.insertAdjacentHTML(
    'beforeend',
    `
<button type="button" id="locale-switcher" class="locale-switcher${homeRevealClass}${isHome ? ' locale-switcher--hero-left' : ''}" aria-live="polite">
  <span class="locale-switcher__inner">
    <span class="locale-switcher__bracket" aria-hidden="true">[</span>
    <span class="locale-switcher__word" aria-hidden="true">LANGUAGE</span>
    <span class="locale-switcher__code">CN</span>
    <span class="locale-switcher__bracket" aria-hidden="true">]</span>
  </span>
</button>
`.trim()
  );

  const btn = document.getElementById('locale-switcher');
  if (!btn) return;

  function syncHtmlLangFromStorage() {
    const loc = getLocale();
    document.documentElement.setAttribute('lang', loc === 'en' ? 'en' : 'zh');
    applyDataI18n(document);
  }

  syncHtmlLangFromStorage();
  updateLocaleSwitcherUI(btn);

  btn.addEventListener('click', () => {
    const next = getLocale() === 'zh' ? 'en' : 'zh';
    setLocale(next);
    applyDataI18n(document);
    updateLocaleSwitcherUI(btn);
  });

  if (isHome) bindLocaleSwitcherHeroLeftAlign(btn);
}

/** 首页：语言按钮左缘与 .hero-right 对齐，bottom 仍由 CSS 控制 */
function bindLocaleSwitcherHeroLeftAlign(btn) {
  const hero = document.querySelector('.hero-right');
  if (!hero) return;

  let rafPending = false;
  const apply = () => {
    const { left } = hero.getBoundingClientRect();
    btn.style.left = `${left}px`;
    btn.style.right = 'auto';
  };

  const scheduleApply = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      apply();
    });
  };

  apply();
  scheduleApply();
  window.addEventListener('resize', scheduleApply, { passive: true });
  window.addEventListener('scroll', scheduleApply, { passive: true, capture: true });

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(scheduleApply);
    ro.observe(hero);
  }
}

// ==========================================
// 3. 展开/收起面板动画逻辑
// ==========================================
function bindMenuAnimation() {
  const navContainer = document.getElementById('main-nav');
  const toggleBtn = document.getElementById('menu-toggle');
  const navItems = document.querySelectorAll('.nav__item');
  const burgerDots = document.querySelectorAll('.nav__burger circle');
  const navLine = document.querySelector('.nav__line'); 
  let isMenuOpen = false;

  const menuTl = gsap.timeline({ paused: true, reversed: true });

  menuTl
    .to(navContainer, { height: 'auto', duration: 0.8, ease: 'power3.inOut' }, 0)
    .to(navLine, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, 0)
    .to(burgerDots, { opacity: 0.5, scale: 0.8, stagger: 0.05, duration: 0.3, transformOrigin: "center" }, 0)
    .to(navItems, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' }, 0.3); 

  function setMenuExpanded(open) {
    isMenuOpen = open;
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', open ? t('nav.menuClose') : t('nav.menuOpen'));
  }

  function detachOutsideClose() {
    document.removeEventListener('click', onDocumentClickClose);
  }

  function onDocumentClickClose(e) {
    if (!isMenuOpen) return;
    const tgt = e.target;
    if (navContainer.contains(tgt)) return;
    setMenuExpanded(false);
    menuTl.reverse();
    detachOutsideClose();
    document.removeEventListener('keydown', onEscapeClose);
  }

  function onEscapeClose(e) {
    if (e.key !== 'Escape' || !isMenuOpen) return;
    setMenuExpanded(false);
    menuTl.reverse();
    detachOutsideClose();
    document.removeEventListener('keydown', onEscapeClose);
    toggleBtn.focus();
  }

  toggleBtn.addEventListener('click', () => {
    const willOpen = !isMenuOpen;
    setMenuExpanded(willOpen);
    menuTl.reversed() ? menuTl.play() : menuTl.reverse();

    if (willOpen) {
      /* 本次点击冒泡结束后再监听，避免同一击被当成「点外部」 */
      setTimeout(() => document.addEventListener('click', onDocumentClickClose), 0);
      document.addEventListener('keydown', onEscapeClose);
    } else {
      detachOutsideClose();
      document.removeEventListener('keydown', onEscapeClose);
    }
  });

  window.addEventListener('eutron:locale', () => {
    toggleBtn.setAttribute('aria-label', isMenuOpen ? t('nav.menuClose') : t('nav.menuOpen'));
  });
}

function pathnameIsHome(pathname) {
  if (!pathname) return false;
  const p = pathname.replace(/\/+$/, '') || '/';
  return p === '' || p === '/' || p.endsWith('/index.html') || p.endsWith('index.html');
}

function navigateWithFade(targetHref) {
  gsap.to('body', {
    opacity: 0,
    duration: 0.5,
    ease: 'power2.inOut',
    onComplete: () => { window.location.href = targetHref; },
  });
}

/** 仅 Logo 使用 ./index.html；菜单「首页」用 ./ ，避免整站多处硬编码同一首页路径 */
function bindLogoHomeNavigation() {
  const logo = document.getElementById('nav-logo-home');
  if (!logo) return;

  const homeHref = logo.getAttribute('href') || './index.html';

  logo.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    if (pathnameIsHome(window.location.pathname)) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    navigateWithFade(homeHref);
  });
}

// ==========================================
// 4. 路由高亮与丝滑跳转逻辑
// ==========================================
function bindRoutingEvents() {
  const navLinks = document.querySelectorAll('.nav__link');
  const currentPath = window.location.pathname;
  const onHome = pathnameIsHome(currentPath);

  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    const linkPointsHome = link.hasAttribute('data-nav-home');

    if (linkPointsHome && onHome) {
      link.classList.add('w--current');
    } else if (!linkPointsHome && currentPath === linkPath) {
      link.classList.add('w--current');
    }

    // 丝滑退场跳转
    link.addEventListener('click', function (e) {
      if (this.classList.contains('w--current')) {
        e.preventDefault();
        return;
      }
      const targetUrl = this.href;
      if (targetUrl && targetUrl.indexOf('#') === -1) {
        e.preventDefault();
        navigateWithFade(targetUrl);
      }
    });
  });
}