import gsap from 'gsap';

// ==========================================
// 1. 导航栏的 HTML 模板 (Template)
// 注意：去掉了写死的 w--current，交给后面的 JS 动态判断
// ==========================================
const navHTML = `
<header class="navigation-w fixed-ui" id="global-header">
  <a href="./index.html" class="nav__logo-w">
    <img src="./logo.png" alt="Logo" class="nav-logo-img">
  </a>
  <nav id="main-nav" aria-label="Main navigation" class="navigation">
    <button id="menu-toggle" aria-label="Open main menu" type="button" class="nav__header">
      <div class="menu__label">菜单</div>
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
    <ul role="list" class="nav__list" style="margin-top:30px">
      <li class="nav__item"><a href="./index.html" class="nav__link">首 页</a></li>
      <li class="nav__item"><a href="./products.html" class="nav__link">产品参数</a></li>
      <li class="nav__item"><a href="./careers.html" class="nav__link">招聘信息</a></li>
      <li class="nav__item"><a href="./news.html" class="nav__link">新闻资讯</a></li>
      <li class="nav__item"><a href="./contact.html" class="nav__link">联系我们</a></li>
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
    .to(navContainer, { height: '440px', duration: 0.8, ease: 'power3.inOut' }, 0)
    .to(navLine, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, 0)
    .to(burgerDots, { opacity: 0.5, scale: 0.8, stagger: 0.05, duration: 0.3, transformOrigin: "center" }, 0)
    .to(navItems, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' }, 0.3); 

  toggleBtn.addEventListener('click', () => {
    isMenuOpen = !isMenuOpen;
    menuTl.reversed() ? menuTl.play() : menuTl.reverse();
  });
}

// ==========================================
// 4. 路由高亮与丝滑跳转逻辑
// ==========================================
function bindRoutingEvents() {
  const navLinks = document.querySelectorAll('.nav__link');
  const currentPath = window.location.pathname;

  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    
    // 智能高亮：判断当前 URL 是否匹配该链接
    if (currentPath === linkPath || (currentPath === '/' && linkPath.includes('index.html'))) {
      link.classList.add('w--current');
    }

    // 丝滑退场跳转
    link.addEventListener('click', function(e) {
      if (this.classList.contains('w--current')) {
        e.preventDefault();
        return;
      }
      const targetUrl = this.href;
      if (targetUrl && targetUrl.indexOf('#') === -1) {
        e.preventDefault(); 
        gsap.to('body', {
          opacity: 0,
          duration: 0.5,
          ease: 'power2.inOut',
          onComplete: () => { window.location.href = targetUrl; }
        });
      }
    });
  });
}