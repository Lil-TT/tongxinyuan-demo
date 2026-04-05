import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initGlobalNav } from './nav';

initGlobalNav();

gsap.registerPlugin(ScrollTrigger, SplitText);

// 1. Lenis 平滑滚动初始化
const lenis = new Lenis({
  autoRaf: false,
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);


// 2. 文字滚动渐变动画核心逻辑
const copyWrappers = document.querySelectorAll('[data-copy-wrapper="true"]');

copyWrappers.forEach((wrapper) => {
  // 从 HTML 标签动态获取所需颜色，如果没有则使用默认值
  const colorInitial = wrapper.dataset.colorInit || "#334155";
  const colorAccent  = wrapper.dataset.colorAccent || "#eab308";
  const colorFinal   = wrapper.dataset.colorFinal || "#ffffff";

  const splitRefs = [];
  let lastScrollProgress = 0;
  const colorTransitionTimers = new Map();
  const completedChars = new Set();

  const elements = wrapper.children.length > 0 ? Array.from(wrapper.children) : [wrapper];

  elements.forEach((element) => {
    const wordSplit = new SplitText(element, {
      type: "words",
      wordsClass: "word",
    });
    const charSplit = new SplitText(wordSplit.words, {
      type: "chars",
      charsClass: "char",
    });
    splitRefs.push({ wordSplit, charSplit });
  });

  const allChars = splitRefs.flatMap(({ charSplit }) => charSplit.chars);
  
  // 设置所有字体的初始颜色（极暗的灰色）
  gsap.set(allChars, { color: colorInitial });

  const scheduleFinalTransition = (char, index) => {
    if (colorTransitionTimers.has(index)) {
      clearTimeout(colorTransitionTimers.get(index));
    }
    const timer = setTimeout(() => {
      if (!completedChars.has(index)) {
        gsap.to(char, {
          duration: 0.1,
          ease: "none",
          color: colorFinal, // 变为指定的最终颜色 (标题变白，段落变灰)
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
    // 稍微调整触发区域，让它在屏幕中间时发生动画
    start: "clamp(top 85%)",
    end: "clamp(bottom 40%)",
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
          // 当前滚到的字变为亮黄色
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