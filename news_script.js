import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initGlobalNav } from './nav.js';
import { applyDataI18n } from './i18n.js';

initGlobalNav();

gsap.registerPlugin(ScrollTrigger, SplitText);

const lenis = new Lenis({ autoRaf: false });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// ---------- 新闻 API（对齐服务端 /api/news?pageIndex=&pageSize=） ----------
const NEWS_FETCH_TIMEOUT_MS = 10_000;
const NEWS_PAGE_DEFAULT = { pageIndex: 1, pageSize: 10 };

/** 与后端 Model.newsList 对齐 */
/** @returns {string} */
function getNewsApiBase() {
  const meta = document.querySelector('meta[name="news-api-host"]');
  const fromMeta = meta?.getAttribute('content')?.trim();
  if (fromMeta) return fromMeta.replace(/\/$/, '');
  const w = typeof window !== 'undefined' ? window.__NEWS_API_HOST__ : '';
  if (typeof w === 'string' && w.trim()) return w.trim().replace(/\/$/, '');
  return '';
}

/**
 * 开发环境（Vite）下若配置的 API 与当前页面不同源，则改为空基址走同源 /api，由 vite proxy 转发，避免 CORS。
 * @returns {string}
 */
function getEffectiveNewsApiBase() {
  const configured = getNewsApiBase();
  if (!configured) return '';
  const isViteDev = Boolean(import.meta.env?.DEV);
  if (!isViteDev) return configured;
  try {
    const apiOrigin = new URL(configured).origin;
    if (apiOrigin !== window.location.origin) return '';
  } catch {
    return configured;
  }
  return configured;
}

function buildNewsListUrl(base, params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) q.append(key, String(value));
  });
  const path = `/api/news${q.toString() ? `?${q}` : ''}`;
  if (!base) return path;
  return `${base}${path}`;
}

/**
 * 解析接口 JSON，兼容 { data, total }、{ result: { data } }、{ succeeded, result }
 * @param {unknown} json
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeNewsListPayload(json) {
  if (!json || typeof json !== 'object') return [];
  const o = /** @type {Record<string, unknown>} */ (json);
  if (Array.isArray(o.data)) return /** @type {Array<Record<string, unknown>>} */ (o.data);
  const result = o.result;
  if (result && typeof result === 'object') {
    const r = /** @type {Record<string, unknown>} */ (result);
    if (Array.isArray(r.data)) return /** @type {Array<Record<string, unknown>>} */ (r.data);
    if (Array.isArray(r)) return /** @type {Array<Record<string, unknown>>} */ (r);
  }
  return [];
}

/**
 * @param {{ pageIndex: number; pageSize: number }} params
 */
async function fetchNewsList(params) {
  const base = getEffectiveNewsApiBase();
  const urlPath = buildNewsListUrl(base, params);
  const url = urlPath.startsWith('http') ? urlPath : new URL(urlPath, window.location.origin).toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return normalizeNewsListPayload(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('News request timed out');
    }
    throw err;
  }
}

function getFallbackNews() {
  return [
    {
      id: 1,
      title: '湖北元臻微电科技有限责任公司（董事长：张彪）荣获省政府专项津贴专家人选',
      summary:
        '根据省人力资源和社会保障厅《关于开展2025年度省有突出贡献中青年专家和享受省政府专项津贴专家推荐选拔工作的通知》(鄂人社函〔2025〕136号)要求,孝感市人力资源和社会保障局在全市范围内开展选拔推荐工作。经个人申报、单位审核、主管部门和县(市、区)推荐、专家评议等程序,拟推荐1位同志为省有突出贡献中青年专家,5位同志为享受省政府专项津贴专家人选,现予以公示。',
      cover: '/news-img-1.png',
      link: 'https://rsj.xiaogan.gov.cn/zwdt/gsgg/202509/t20250925_474812.shtml',
    },
    {
      id: 2,
      title: '现场直击 | 惊艳乍现 元臻微电首条量子材料生产线成功试产',
      summary:
        '随着高科技的迅猛发展，对底层设备要求也随之攀升。湖北元臻微电科技有限责任公司洁净车间内，XMR生产线首次运行，高真空退火炉、磁控溅射等设备正在进行全流程试生产。严格的可靠性和产品的极高平铺面积等要求，不断考验着材料的极限性能，元臻微电突破量子黑科技技术壁垒...',
      cover: '/news-img-2.png',
      link: 'https://mp.weixin.qq.com/s/mmMf3nrb8XX1Ko-cOhW24w',
    },
    {
      id: 3,
      title: '元臻微电首条量子材料生产线试产',
      summary:
        '近日，湖北元臻微电科技有限责任公司洁净厂房内，第一条XMR生产线已架设完毕，高真空退火炉、磁控溅射等设备正在接受全流程试生产，确保9月中旬交付产品。“xMR技术是一种高性能量子磁传感技术，它就像感知物理世界的精密‘触角’，从工业自动化到智能驾驶，从医疗成像到量子计算，都离不开它。”该公司副总经理顾晓青介绍。',
      cover: '/news-img-3.png',
      link: 'https://mp.weixin.qq.com/s/LbMMbrGVloHyhe-98uoUnw',
    },
  ];
}

/** @param {unknown} cover */
function resolveCoverUrl(cover) {
  if (cover == null || cover === '') return '/news-img-1.png';
  const c = String(cover).trim();
  if (c.startsWith('http://') || c.startsWith('https://')) return c;
  if (c.startsWith('//')) return `${window.location.protocol}${c}`;
  if (c.startsWith('/')) return c;
  return `/${c.replace(/^\/+/, '')}`;
}

/**
 * @param {Array<Record<string, unknown>>} items
 */
function renderNewsList(items) {
  const root = document.getElementById('news-root');
  if (!root) return;

  root.replaceChildren();

  const list = items.length ? items : getFallbackNews();

  list.forEach((raw, i) => {
    const title = typeof raw.title === 'string' ? raw.title : '';
    const summary = typeof raw.summary === 'string' ? raw.summary : '';
    const link = typeof raw.link === 'string' && raw.link ? raw.link : '#';
    const cover = resolveCoverUrl(raw.cover);

    const section = document.createElement('section');
    section.className = `news-item${i % 2 === 1 ? ' reverse' : ''}`;

    const content = document.createElement('div');
    content.className = 'news-content';

    const num = document.createElement('div');
    num.className = 'news-number';
    num.textContent = `/ ${String(i + 1).padStart(2, '0')}`;

    const wrapTitle = document.createElement('div');
    wrapTitle.setAttribute('data-copy-wrapper', 'true');
    wrapTitle.dataset.colorInit = '#334155';
    wrapTitle.dataset.colorAccent = '#eab308';
    wrapTitle.dataset.colorFinal = '#ffffff';
    const h3 = document.createElement('h3');
    h3.className = 'news-title';
    h3.textContent = title;
    wrapTitle.appendChild(h3);

    const wrapDesc = document.createElement('div');
    wrapDesc.setAttribute('data-copy-wrapper', 'true');
    wrapDesc.dataset.colorInit = '#334155';
    wrapDesc.dataset.colorAccent = '#eab308';
    wrapDesc.dataset.colorFinal = '#9ca3af';
    const p = document.createElement('p');
    p.className = 'news-desc';
    p.textContent = summary;
    wrapDesc.appendChild(p);

    const a = document.createElement('a');
    a.className = 'read-more';
    a.href = link;
    if (link.startsWith('http')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    const readSpan = document.createElement('span');
    readSpan.dataset.i18nKey = 'news.readMore';
    readSpan.textContent = '查看详情';
    const line = document.createElement('span');
    line.className = 'line';
    a.append(readSpan, ' ', line);

    content.append(num, wrapTitle, wrapDesc, a);

    const imgWrap = document.createElement('div');
    imgWrap.className = `news-image ${i % 2 === 1 ? 'ni-left' : 'ni-right'}`;
    const img = document.createElement('img');
    img.src = cover;
    img.alt = title || 'News';
    if (i % 2 === 1) img.className = 'ni-left';
    imgWrap.appendChild(img);

    section.append(content, imgWrap);
    root.appendChild(section);
  });
}

function syncNewsMediaSize() {
  const rows = document.querySelectorAll('.news-item');
  rows.forEach((row) => {
    const content = row.querySelector('.news-content');
    const media = row.querySelector('.news-image');
    if (!content || !media) return;

    const styles = getComputedStyle(media);
    const fixedWidth = parseFloat(styles.getPropertyValue('--news-image-width')) || 600;
    const ratioRaw = styles.getPropertyValue('--news-image-ratio').trim();
    const [rw, rh] = ratioRaw.split('/').map((v) => parseFloat(v.trim()));
    const ratio = rw > 0 && rh > 0 ? rw / rh : 16 / 10;

    const contentHeight = content.getBoundingClientRect().height;
    const fixedHeight = fixedWidth / ratio;
    const finalWidth = contentHeight > 0 && fixedHeight > contentHeight ? contentHeight * ratio : fixedWidth;

    media.style.flexBasis = `${finalWidth}px`;
    media.style.width = `${finalWidth}px`;
    media.style.maxWidth = `${finalWidth}px`;
  });
}

function initCopyWrapperAnimations() {
  const copyWrappers = document.querySelectorAll('[data-copy-wrapper="true"]');

  copyWrappers.forEach((wrapper) => {
    const colorInitial = wrapper.dataset.colorInit || '#334155';
    const colorAccent = wrapper.dataset.colorAccent || '#eab308';
    const colorFinal = wrapper.dataset.colorFinal || '#ffffff';

    const splitRefs = [];
    let lastScrollProgress = 0;
    const colorTransitionTimers = new Map();
    const completedChars = new Set();

    const elements = wrapper.children.length > 0 ? Array.from(wrapper.children) : [wrapper];

    elements.forEach((element) => {
      const wordSplit = new SplitText(element, {
        type: 'words',
        wordsClass: 'word',
      });
      const charSplit = new SplitText(wordSplit.words, {
        type: 'chars',
        charsClass: 'char',
      });
      splitRefs.push({ wordSplit, charSplit });
    });

    const allChars = splitRefs.flatMap(({ charSplit }) => charSplit.chars);

    gsap.set(allChars, { color: colorInitial });

    const scheduleFinalTransition = (char, index) => {
      if (colorTransitionTimers.has(index)) {
        clearTimeout(colorTransitionTimers.get(index));
      }
      const timer = setTimeout(() => {
        if (!completedChars.has(index)) {
          gsap.to(char, {
            duration: 0.1,
            ease: 'none',
            color: colorFinal,
            onComplete: () => {
              completedChars.add(index);
            },
          });
        }
        colorTransitionTimers.delete(index);
      }, 100);
      colorTransitionTimers.set(index, timer);
    };

    ScrollTrigger.create({
      trigger: wrapper,
      start: 'clamp(top 85%)',
      end: 'clamp(bottom 40%)',
      scrub: 1,
      onUpdate: (self) => {
        const progress = self.progress;
        const totalChars = allChars.length;
        const isScrollingDown = progress >= lastScrollProgress;
        const currentCharIndex = Math.floor(progress * totalChars);

        allChars.forEach((char, index) => {
          if (!isScrollingDown && index >= currentCharIndex) {
            if (colorTransitionTimers.has(index)) {
              clearTimeout(colorTransitionTimers.get(index));
              colorTransitionTimers.delete(index);
            }
            completedChars.delete(index);
            gsap.set(char, { color: colorInitial });
            return;
          }

          if (completedChars.has(index)) return;

          if (index <= currentCharIndex) {
            gsap.set(char, { color: colorAccent });
            if (!colorTransitionTimers.has(index)) {
              scheduleFinalTransition(char, index);
            }
          } else {
            gsap.set(char, { color: colorInitial });
          }
        });
        lastScrollProgress = progress;
      },
    });
  });
}

async function loadNewsItems() {
  const base = getNewsApiBase();
  if (!base) {
    console.info('[news] 未配置 news-api-host / __NEWS_API_HOST__，使用内置示例数据');
    return getFallbackNews();
  }
  try {
    const list = await fetchNewsList(NEWS_PAGE_DEFAULT);
    if (list.length) return list;
    console.warn('[news] 接口返回空列表，使用内置示例数据');
  } catch (e) {
    console.warn('[news] 拉取新闻失败，使用内置示例数据:', e);
  }
  return getFallbackNews();
}

async function bootstrap() {
  const items = await loadNewsItems();
  renderNewsList(items);
  syncNewsMediaSize();
  applyDataI18n(document);
  initCopyWrapperAnimations();
  ScrollTrigger.refresh();
  if (typeof lenis.resize === 'function') lenis.resize();
}

window.addEventListener('resize', () => {
  syncNewsMediaSize();
  ScrollTrigger.refresh();
  if (typeof lenis.resize === 'function') lenis.resize();
});

bootstrap().catch((e) => console.error('[news] bootstrap error:', e));
