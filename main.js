import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// 引入 Three.js 官方的粗线 (Fat Lines) 扩展模块
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 1. 全局变量声明与 3D 场景初始化
// ==========================================
const canvas3D = document.querySelector('.webgl-canvas');
const renderer3D = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true, alpha: true });
renderer3D.setSize(window.innerWidth, window.innerHeight);
renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 开启 sRGB 和电影级色调映射，瞬间提升高级感
renderer3D.outputColorSpace = THREE.SRGBColorSpace;
renderer3D.toneMapping = THREE.ACESFilmicToneMapping;
renderer3D.toneMappingExposure = 1.2;

const scene3D = new THREE.Scene();
// 纯黑背景 + 全局雾化
scene3D.background = null;
scene3D.fog = new THREE.FogExp2(0x050b1a, 0.02);

const camera3D = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
camera3D.position.z = 18;

// 全局变量：用于交互和动画
const bgScrollObj = { offset: 0 };
let meteorGroup;
let meteorMeshes = [];
const modelGroup = new THREE.Group();
scene3D.add(modelGroup);
let caseLid, earbudLeft, earbudRight;
let lidInitialRot = 0; // 记录盖子初始角度

// ==========================================
// 1.2 灯光系统 (戏剧性光影)
// ==========================================
// 极暗环境光 (保留15%基础亮度，避免死黑)
scene3D.add(new THREE.AmbientLight(0xffffff, 0.15));

// 主光源
const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 5, 5);
scene3D.add(mainLight);

// 核心轮廓光（侧后方冷蓝光，塑造边缘）
const rimLight = new THREE.DirectionalLight(0x41a5ff, 5);
rimLight.position.set(-5, 5, -5);
scene3D.add(rimLight);

// 补光（底部微弱蓝光）
const fillLight = new THREE.DirectionalLight(0x112244, 2);
fillLight.position.set(0, -5, 2);
scene3D.add(fillLight);

// 镜头控制器
const controls3D = new OrbitControls(camera3D, renderer3D.domElement);
controls3D.enableDamping = true;
controls3D.dampingFactor = 0.05;
controls3D.enablePan = false;
controls3D.minDistance = 8;
controls3D.maxDistance = 35;


// ==========================================
// 1.3 几何球形网格系统 (纯净蓝图网格)
// ==========================================
const sphericalGridGroup = new THREE.Group();
sphericalGridGroup.visible = false; // 【新增】：初始隐藏网格
scene3D.add(sphericalGridGroup);

const baseSphereGeo = new THREE.SphereGeometry(60, 40, 20);
const wireframeGeo = new THREE.WireframeGeometry(baseSphereGeo);

const lineGeo = new LineGeometry();
lineGeo.setPositions(wireframeGeo.attributes.position.array);

// 设置粗线材质 (关闭透明度防止交叉过曝)
window.gridLineMat = new LineMaterial({
  opacity: 0.3,
  color: 0x0e223c, // 暗夜蓝
  linewidth: 2.5,
  transparent: false, // 杜绝颜色叠加
  resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
});

const sphericalGridMesh = new LineSegments2(lineGeo, window.gridLineMat);
sphericalGridMesh.computeLineDistances();
sphericalGridGroup.add(sphericalGridMesh);


// ==========================================
// 1.4 深空浮动粒子系统 (Plexus / Stars)
// ==========================================
let particlesGroup = new THREE.Group();
particlesGroup.visible = false; // 【新增】：初始隐藏粒子（为了极致干爽，建议一起隐藏）
scene3D.add(particlesGroup);

const particleCount = 50000;
const boxSize = 500;
const pointsGeometry = new THREE.BufferGeometry();
const positionsArray = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i++) {
  positionsArray[i] = (Math.random() - 0.5) * boxSize;
}
pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));

// 动态发光软边圆点
const dotCanvas = document.createElement('canvas');
dotCanvas.width = dotCanvas.height = 32;
const ctx = dotCanvas.getContext('2d');
const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
gradient.addColorStop(0.3, 'rgba(65, 165, 255, 0.8)');
gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 32, 32);
const dotTexture = new THREE.CanvasTexture(dotCanvas);

const pointsMaterial = new THREE.PointsMaterial({
  size: 1.2,
  map: dotTexture,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  color: 0xaaccff
});

const floatingParticles = new THREE.Points(pointsGeometry, pointsMaterial);
particlesGroup.add(floatingParticles);


// ==========================================
// 1.5 背景流星雨系统 (6颗蓝色群组)
// ==========================================
meteorGroup = new THREE.Group();
scene3D.add(meteorGroup);

const meteorCanvas = document.createElement('canvas');
meteorCanvas.width = 512;
meteorCanvas.height = 32;
const meteorCtx = meteorCanvas.getContext('2d');

const meteorGradient = meteorCtx.createLinearGradient(0, 16, 512, 16);
meteorGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
meteorGradient.addColorStop(0.6, 'rgba(0, 80, 255, 0.1)');
meteorGradient.addColorStop(0.9, 'rgba(65, 165, 255, 0.9)');
meteorGradient.addColorStop(1, 'rgba(200, 240, 255, 1)');
meteorCtx.fillStyle = meteorGradient;
meteorCtx.fillRect(0, 0, 512, 32);
const meteorTexture = new THREE.CanvasTexture(meteorCanvas);

const meteorGeo = new THREE.PlaneGeometry(15, 0.3);

for (let i = 0; i < 6; i++) {
  const meteorMat = new THREE.MeshBasicMaterial({
    map: meteorTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(meteorGeo, meteorMat);
  meteorMeshes.push(mesh);
  meteorGroup.add(mesh);
}
meteorGroup.position.set(0, 0, -50);


// ==========================================
// 2. 外部 UI 动画组装 (剥离模型依赖)
// ==========================================
gsap.set('.loader__circle', { opacity: 0, filter: 'blur(16px)' });
gsap.set('.tagcloud--item', { opacity: 0 });

gsap.to('.loader__circle:nth-child(1)', { rotationZ: 360, duration: 25, repeat: -1, ease: 'none' });
gsap.to('.loader__circle:nth-child(2)', { rotationZ: -360, duration: 35, repeat: -1, ease: 'none' });
gsap.to('.loader__circle:nth-child(3)', { rotationZ: 360, duration: 20, repeat: -1, ease: 'none' });

// 初始设为暂停，等模型加载完毕再 play
const loadingTl = gsap.timeline({ paused: true, delay: 0.5 });
const counterObj = { val: 0 };

loadingTl.to('.loader__circle', {
  opacity: 1, filter: 'blur(0px)', duration: 2.5, ease: 'expo.out', stagger: { each: 0.15, from: "end" }
}, 0)
  .to('.tagcloud--item', { opacity: 1, duration: 1, stagger: 0.2 }, 1)
  .to(counterObj, {
    val: 100, duration: 4.5, ease: "power2.inOut",
    onUpdate: () => document.getElementById('counter').innerText = `[ ${Math.round(counterObj.val).toString().padStart(3, '0')} ]`
  }, 0)
  .to('.loader__circle:nth-child(-n+6)', {
    rotationX: (i) => i % 2 === 0 ? 360 : -360,
    rotationY: (i) => i % 2 === 0 ? -360 : 360,
    duration: 3.5, ease: 'power3.inOut', stagger: 0.12
  }, "+=0.2")
  .to('.loader-w', {
    scale: 0.5, opacity: 0, filter: 'blur(10px)', duration: 1.5, ease: 'power3.inOut'
  }, "+=1.5")
  .to('.tagcloud-w', { opacity: 0, duration: 1 }, "<");


// ==========================================
// 3. 模型加载与开场动画挂载
// ==========================================
const gltfLoader = new GLTFLoader();
gltfLoader.load(
  './box1.glb',
  (gltf) => {
    const realModel = gltf.scene;

    // 1. 调整大小
    realModel.scale.set(0.07, 0.07, 0.07);
    // 2. 调整位置
    realModel.position.set(0, -1.5, 2.62);
    // 3. 调整初始角度
    realModel.rotation.x = 1;

    // 【核心新增】让包裹模型的总组初始悬浮在半空 (Y=12)
    modelGroup.position.set(0, 12, 0);
    modelGroup.add(realModel);

    // 遍历寻找我们需要的部件 (更新为新命名)
    realModel.traverse((child) => {
      if (child.name === 'Case_Lid') caseLid = child;
      if (child.name === 'Waferright') {
        earbudRight = child;
        // 【核心新增】：克隆材质，让右晶圆拥有独立的材质，以便后续用 GSAP 单独给它变色！
        if (child.material) {
          child.material = child.material.clone();
        }
      }
      if (child.name === 'Waferleft') earbudLeft = child;

      if (child.isMesh && child.material) {
        child.material.roughness = 0.35;
        child.material.metalness = 0.6;
        child.material.envMapIntensity = 1.5;
      }
    });

    if (caseLid) {
      modelGroup.attach(caseLid);
      lidInitialRot = caseLid.rotation.x; // 记录铰链初始角度
    }
    if (earbudLeft) modelGroup.attach(earbudLeft);
    if (earbudRight) modelGroup.attach(earbudRight);

    // 将 3D 动作追加进 loadingTl
    loadingTl
      // 【修改 1】在 Loading 圆环退场后，提前把 stage2-el（包含导航栏、底栏、空UI容器）淡入进来。
      // 注意：此时 .ui-stage-1 本身还是 opacity: 0 的，所以文字此时依然看不见，保持干爽。
      .to('.stage2-el', { opacity: 1, duration: 1 }, "<0.5")

      // 瞬间显示网格与粒子
      .set(sphericalGridGroup, { visible: true }, "<")
      .set(particlesGroup, { visible: true }, "<")

      // A. 下沉砸向画面中心
      .to(modelGroup.position, { y: 0, duration: 1.2, ease: "power3.in" }, "<")

      // B. 砸地瞬间：冲击波与震动
      .add(() => {
        const vid = document.getElementById('shockwaveVideo');
        if (vid) {
          vid.currentTime = 0;
          vid.play().catch(err => console.warn("冲击波视频警告:", err));
        }
      })
      .to('#shockwaveVideo', { opacity: 1, duration: 0.2 }, "<")
      .to(modelGroup.position, { y: -0.4, duration: 0.15, yoyo: true, repeat: 1 }, "<") // 注意这里加了 "<" 同步

      // ==========================================================
      // 【核心新增：方案 A】砸地的同一瞬间，两侧文字伴随冲击波“爆”出来！
      // ==========================================================
      .fromTo('.ui-stage-1',
        { opacity: 0, y: 30, filter: 'blur(10px)' }, // 初始状态：下沉、透明、模糊
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.5, ease: "power2.out" }, // 弹入状态
        "<" // 这个 "<" 就是灵魂，意味着它和砸地/冲击波在同一毫秒发生！
      )

      // C. 自动开盖展示 (延迟 0.3 秒)
      .to(caseLid.rotation, { x: lidInitialRot - Math.PI / 2, duration: 1.5, ease: "power2.out" }, "+=0.3")
      .to('#shockwaveVideo', {
        opacity: 0,
        duration: 1
        // ⚠️【关键修改】：删掉这里的 onComplete: () => { vid.remove() }，把视频留着给结尾循环用！
      }, "<")

      // D. 交互解锁：恢复滚动条，绑定下拉动画
      .add(() => {
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto'; // 【新增】：确保 html 层级也被彻底解锁

        ScrollTrigger.refresh();
        setupDebugGUI();
        initScrollTimeline(); // 激活鼠标滚轮的时间轴
      });

    // 播放组装完毕的开场动画
    loadingTl.play();

    // 启动定时流星生成器
    function scheduleNextMeteor() {
      const delay = THREE.MathUtils.randInt(8000, 15000);
      setTimeout(() => {
        triggerShootingStar();
        scheduleNextMeteor();
      }, delay);
    }
    setTimeout(scheduleNextMeteor, 3000);
  }
);


// ==========================================
// 4. 用户交互时间轴 (ScrollTrigger) - 全局匀速重构版
// ==========================================
function initScrollTimeline() {
  // 🌟 安全提取内部 Mesh 的材质，避免 undefined 报错
  let leftMat, rightMat;
  if (earbudLeft) {
    earbudLeft.traverse((child) => {
      if (child.isMesh) leftMat = child.material;
    });
  }
  if (earbudRight) {
    earbudRight.traverse((child) => {
      if (child.isMesh) {
        if (!child.material.isCloned) {
          child.material = child.material.clone();
          child.material.isCloned = true;
        }
        rightMat = child.material;
      }
    });
  }

  const circle = document.querySelector('.progress-ring__circle');
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;

  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  let isAutoLooping = false; // 锁定状态

  const tl = gsap.timeline({
    scrollTrigger: {
      id: "mainScroll",
      trigger: ".scroll-container",
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      snap: {
        snapTo: "labels",
        delay: 0.1,
        ease: "power2.inOut",
        duration: { min: 0.2, max: 0.8 } 
      },
      onUpdate: (self) => {
        // 1. 常规的圆环进度更新 (只在非自动播放时执行)
        if (!isAutoLooping) {
          const offset = circumference - self.progress * circumference;
          gsap.to(circle, { strokeDashoffset: offset, duration: 0.1, ease: "none" });
          gsap.to(bgScrollObj, { offset: self.progress * -Math.PI * 2, duration: 0.8, ease: "power2.out" });
        }

        // 2. 🌟【核心修复】：不再使用 setTimeout！
        // 当用户滚到底部，或者被 Snap 自动吸附到底部 (progress > 0.99) 时，立刻触发大片！
        if (self.progress > 0.99 && !isAutoLooping) {
          playCinematicLoop();
        }
      }
    }
  });

  const w1Initial = { pos: earbudLeft.position.clone(), rot: earbudLeft.rotation.clone() };
  const w2Initial = { pos: earbudRight.position.clone(), rot: earbudRight.rotation.clone() };

  // ------------------------------------------
  // Stage 1: 预备动作 - 盒子微扭转
  // ------------------------------------------
  tl.addLabel("stage1", 0); // 从 0 开始

  tl.to(".ui-stage-1", { opacity: 0, duration: 0.8 }, "stage1");

  // ⚠️ 增加 duration，把这一段的时长撑起来，防止一滚就没
  tl.to(modelGroup.position, { x: -1.2, y: -0.65, z: -0.16, duration: 1.5, ease: "power1.inOut" }, "stage1")
    .to(modelGroup.rotation, { x: -0.25159, y: 0.288407, z: 0.568407, duration: 1.5, ease: "power1.inOut" }, "stage1");

  tl.to(earbudLeft.position, {
    y: w1Initial.pos.y + 0.5,
    z: w1Initial.pos.z + 1,
    duration: 1.2, ease: "power1.inOut"
  }, "stage1+=0.3");


  // ------------------------------------------
  // Stage 2: 左晶圆主导升空，右晶圆跟随
  // ------------------------------------------
  tl.addLabel("stage2", 2.0); // 间隔 2 秒

  tl.to(".ui-stage-2", { opacity: 1, duration: 0.8 }, "stage2");

  tl.to(modelGroup.position, { x: -3.5, y: -8.5, z: 1.5, duration: 0.6, ease: "power2.out" }, "stage2")
    .to(modelGroup.rotation, { z: 0.2, duration: 0.6, ease: "power2.out" }, "stage2");

  tl.to(earbudLeft.position, { x: 1.5, y: w1Initial.pos.y + 8, z: w1Initial.pos.z + 4, duration: 1, ease: "power2.out" }, "stage2")
    .to(earbudLeft.rotation, { x: Math.PI / 2, y: 0, z: 0.1, duration: 1, ease: "power2.out" }, "stage2");

  tl.to(earbudLeft.position, { x: 2, y: w1Initial.pos.y + 6.9, z: w1Initial.pos.z + 7, duration: 0.9, ease: "power2.out" }, "stage2+=1")
    .to(earbudLeft.rotation, { x: Math.PI / 2, y: Math.PI / 2, z: 0.1, duration: 0.9, ease: "power2.out" }, "stage2+=1");

  tl.to(earbudRight.position, { x: 1.5, y: w2Initial.pos.y + 7.0, z: w2Initial.pos.z + 7, duration: 1.6, ease: "power2.out" }, "stage2+=0.3")
    .to(earbudRight.rotation, { x: 12.2, y: -9.63, z: -0.2, duration: 1.6, ease: "power2.out" }, "stage2+=0.3");


  // ------------------------------------------
  // Stage 3: 传感核心晶圆特写与矩阵排版
  // ------------------------------------------
  tl.addLabel("stage3", 4.0); // 间隔 2 秒

  tl.to(".ui-stage-2", { opacity: 0, duration: 0.4 }, "stage3");
  tl.set(".ui-stage-3", { opacity: 1 }, "stage3");

  tl.fromTo([".stage3-title", ".callout"], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "stage3+=0.2");
  tl.fromTo(".spec-item", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.6, ease: "power2.out", stagger: 0.15 }, "stage3+=0.4");

  tl.to(earbudLeft.rotation, { x: 0, y: 0, z: -0.2, duration: 1.3, ease: "power2.out" }, "stage3");
  tl.to(earbudRight.rotation, { x: 0, y: 0, z: -0.2, duration: 1.3, ease: "power2.out" }, "stage3");


  // ------------------------------------------
  // Stage 4: 晶圆横移换位与薄膜晶圆特写
  // ------------------------------------------
  tl.addLabel("stage4", 6.0); // 间隔 2 秒

  tl.to(".ui-stage-3", { opacity: 0, duration: 0.4 }, "stage4");

  tl.to(earbudLeft.position, { x: 0.9, z: w1Initial.pos.z + 8, duration: 1.5, ease: "power2.inOut" }, "stage4")
    .to(earbudLeft.rotation, { x: Math.PI / 2, y: 0, z: 0, duration: 1.5, ease: "power2.inOut" }, "stage4");

  tl.to(earbudRight.position, { x: 0.9, y: 5.3, z: w2Initial.pos.z + 10, duration: 1.5, ease: "power2.inOut" }, "stage4")
    .to(earbudRight.rotation, { x: 0.748, y: 0.12, z: 0.97, duration: 1.5, ease: "power2.inOut" }, "stage4");

  tl.set(".ui-stage-4", { opacity: 1 }, "stage4");
  tl.fromTo([".stage4-title", ".ui-stage-4 .callout"],
    { opacity: 0, x: (i) => i === 0 ? -30 : 30 },
    { opacity: 1, x: 0, duration: 0.8, ease: "power2.out", stagger: 0.2 }, "stage4+=0.8");


  // ------------------------------------------
  // Stage 5: 无缝连续的分离与重构合体
  // ------------------------------------------
  tl.addLabel("stage5", 8.0); // 间隔 2 秒

  tl.to(".ui-stage-4", { opacity: 0, duration: 0.5 }, "stage5");

  // 坐标定义
  const separationPosL = { x: -0.5, y: 5.97, z: 12.0 };
  const separationPosR = { x: 3.0, y: 5.97, z: 12.0 };
  const mergePosL = { x: 1.67 + 0.28, y: 5.97, z: 11 };
  const mergePosR = { x: 1.67, y: 5.97, z: 11 + 0.09 };

  // 🚀 【魔法实现】：左晶圆分离后无缝衔接合体
  // 使用 ">" 符号，告诉 GSAP 紧跟着上一个动作直接执行
  tl.to(earbudLeft.position, { ...separationPosL, duration: 1.2, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudLeft.position, { ...mergePosL, duration: 1.6, ease: "power2.inOut" }, ">");

  tl.to(earbudLeft.rotation, { x: Math.PI / 2, y: Math.PI, z: 0.1, duration: 1.2, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudLeft.rotation, { x: 0, y: Math.PI / 2, z: 0.1, duration: 1.6, ease: "power2.inOut" }, ">");

  // 🚀 右晶圆也是一气呵成
  tl.to(earbudRight.position, { ...separationPosR, duration: 1.2, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudRight.position, { ...mergePosR, duration: 1.6, ease: "power2.inOut" }, ">");

  tl.to(earbudRight.rotation, { x: Math.PI / 2, y: -Math.PI, z: 0.1, duration: 1.2, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudRight.rotation, { x: Math.PI / 2, y: 0, z: 0.1, duration: 1.6, ease: "power2.inOut" }, ">");

  // 材质渐暗与网格拉近 (配合合体阶段开始：分离1.2秒，所以在 0.5+1.2 = stage5+=1.7 开始融合)
  const mergeImpactTime = "stage5+=1.7";
  tl.to(leftMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 1.0, ease: "power2.out" }, mergeImpactTime);
  tl.to(rightMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 1.0, ease: "power2.out" }, mergeImpactTime);
  tl.to(rightMat.emissive, { r: 0, g: 0, b: 0, duration: 1.0, ease: "power2.out" }, mergeImpactTime);

  tl.to(sphericalGridGroup.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 2.0, ease: "power3.inOut" }, mergeImpactTime);
  tl.to(sphericalGridGroup.children[0].material, { opacity: 1.0, duration: 1.5, ease: "power2.inOut" }, mergeImpactTime);


  // ==========================================================
  // Stage 6: [终极精细版] 坠落归仓，机械闭环
  // ==========================================================
  tl.addLabel("stage6", 11.0); 

  // 1. 材质变亮与盒子升起接应
  tl.to(leftMat.color, { r: 1, g: 1, b: 1, duration: 0.8 }, "stage6")
    .to(rightMat.color, { r: 1, g: 1, b: 1, duration: 0.8 }, "stage6");

  const finalBoxPos = { x: 0, y: 1.6, z: 2.62 }; 
  const finalBoxRot = { x: 0.3, y: 0, z: 0 }; 
  tl.to(modelGroup.position, { ...finalBoxPos, duration: 2.2, ease: "power2.inOut" }, "stage6")
    .to(modelGroup.rotation, { ...finalBoxRot, duration: 2.2, ease: "power2.inOut" }, "stage6");

  tl.addLabel("stage6_falling", 12.2);

  // 2. 晶圆坠落
  const fallActionTime = 2.0; 
  const mainSpinTime = 1.4;  
  const settleTime = 0.6;    

  tl.to(earbudLeft.position, { 
      x: w1Initial.pos.x, y: w1Initial.pos.y, z: w1Initial.pos.z,
      duration: fallActionTime, ease: "power2.in" 
  }, "stage6")
  .to(earbudRight.position, { 
      x: w2Initial.pos.x, y: w2Initial.pos.y, z: w2Initial.pos.z,
      duration: fallActionTime, ease: "power2.in" 
  }, "stage6");

  // 3. 坠落中的疯狂自转
  tl.addLabel("spin_start", "stage6+=0.2"); 
  tl.to(earbudLeft.rotation, { 
      y: "+=" + (Math.PI * 4), duration: mainSpinTime, ease: "power3.out" 
  }, "spin_start")
  .to(earbudRight.rotation, { 
      y: "-=" + (Math.PI * 4), duration: mainSpinTime, ease: "power3.out" 
  }, "spin_start+=0.15");

  // 4. 精准对齐卡槽
  const settleRotStart = `spin_start+=${mainSpinTime}`;
  tl.addLabel("settle_rot", settleRotStart);
  tl.to(earbudLeft.rotation, { 
      x: w1Initial.rot.x, y: w1Initial.rot.y, z: w1Initial.rot.z,
      duration: settleTime, ease: "back.out(1.7)" 
  }, "settle_rot")
  .to(earbudRight.rotation, { 
      x: w2Initial.rot.x, y: w2Initial.rot.y, z: w2Initial.rot.z,
      duration: settleTime, ease: "back.out(1.7)" 
  }, "settle_rot");

  // 5. 灵魂关盖与开场 UI 重现 (真正执行关盖动作的地方！)
  const lidClosureTime = "stage6+=2.2";
  tl.to(caseLid.rotation, {
      x: lidInitialRot, 
      duration: 0.6,
      ease: "bounce.out" 
  }, lidClosureTime); 

  tl.fromTo(".ui-stage-1", 
      { opacity: 0, filter: 'blur(10px)', scale: 1.1 }, 
      { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 1.2, ease: "power2.out" }, 
      "stage6+=2.4" 
  );
  tl.addLabel("stage_final", 14.6);

  // ==========================================================
  // 🌟 独立的电影级自动过场 (脱离鼠标滚轮控制)
  // ==========================================================
  function playCinematicLoop() {
      isAutoLooping = true; 
      
      const st = ScrollTrigger.getById("mainScroll");
      if (st) st.disable(false); // 接管滚轮

      const circleEl = document.querySelector('.progress-ring__circle');
      const radius = circleEl.r.baseVal.value;
      const circumference = radius * 2 * Math.PI;

      const loopTl = gsap.timeline({
          onComplete: () => {
              // 时空跃迁：无痕跳回顶部
              window.scrollTo(0, 0); 
              tl.progress(0);        
              
              if (st) {
                  st.enable();       
                  st.update();
              }
              isAutoLooping = false; 
          }
      });

      // 🌟【高级 UI 闭环】：顺时针清空圆环！
      // 将 offset 动画到 -circumference（负号是核心），它就会顺着原来的方向继续追着尾巴清空！
      loopTl.to(circleEl, { 
          strokeDashoffset: -circumference, 
          duration: 1.5, 
          ease: "power2.inOut" 
      }, 0);

      // 1. 盒子恢复水平，猛砸向深空原点
      loopTl.to(modelGroup.position, { x: 0, y: 0, z: 0, duration: 0.8, ease: "power3.in" }, 0)
            .to(modelGroup.rotation, { x: 0, y: 0, z: 0, duration: 0.8, ease: "power3.in" }, 0);

      // 2. 砸地瞬间物理回弹
      loopTl.to(modelGroup.position, { y: -0.4, duration: 0.15, yoyo: true, repeat: 1 }, 0.8);

      // 3. 同步触发冲击波视频
      loopTl.add(() => {
          const vid = document.getElementById('shockwaveVideo');
          if (vid) {
              vid.currentTime = 0;
              vid.play().catch(e => console.warn(e));
          }
      }, 0.65); 

      loopTl.to('#shockwaveVideo', { opacity: 1, duration: 0.2 }, 0.65)
            .to('#shockwaveVideo', { opacity: 0, duration: 1.0 }, 0.9);

      // 4. 气流轰开盖子
      loopTl.to(caseLid.rotation, { 
          x: lidInitialRot - Math.PI / 2, 
          duration: 1.2, 
          ease: "power2.out" 
      }, 0.9); 
  }
}

// ==========================================
// 5. 渲染循环与功能函数
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  const time = performance.now() * 0.0001;

  // 网格滚动视差
  if (sphericalGridGroup) {
    sphericalGridGroup.rotation.y = (time * 1) + bgScrollObj.offset;
    sphericalGridGroup.position.y = Math.sin(time * 2) * 15;
  }

  // 粒子滚动视差 (速度略慢于网格)
  if (typeof particlesGroup !== 'undefined' && particlesGroup) {
    particlesGroup.rotation.y = (time * 0.7) + (bgScrollObj.offset * 0.8);
    particlesGroup.position.y = Math.sin(time * 1.2) * 8;
    particlesGroup.rotation.x = Math.sin(time * 0.5) * 0.1;
  }

  if (controls3D) {
    controls3D.update();
  }

  renderer3D.render(scene3D, camera3D);
}
animate();

// 触发流星群
function triggerShootingStar() {
  if (meteorMeshes.length === 0) return;

  const startX = -70;
  const endX = 80;
  const groupBaseY = THREE.MathUtils.randFloat(5, 25);
  const groupBaseDuration = THREE.MathUtils.randFloat(1.2, 1.8);
  const groupAngle = THREE.MathUtils.randFloat(-0.2, 0.1);

  meteorMeshes.forEach((mesh) => {
    const offsetX = THREE.MathUtils.randFloat(-20, 10);
    const offsetY = THREE.MathUtils.randFloat(-4, 4);
    const individualDuration = groupBaseDuration + THREE.MathUtils.randFloat(-0.1, 0.2);

    mesh.rotation.z = groupAngle;

    const meteorTl = gsap.timeline();
    meteorTl
      .set(mesh.position, { x: startX + offsetX, y: groupBaseY + offsetY })
      .set(mesh.material, { opacity: 0 })
      .to(mesh.position, {
        x: endX + offsetX,
        y: groupBaseY + offsetY - (individualDuration * 5),
        duration: individualDuration,
        ease: "linear"
      }, 0)
      .to(mesh.material, { opacity: 1, duration: individualDuration * 0.2 }, 0)
      .to(mesh.material, { opacity: 0, duration: individualDuration * 0.2 }, `-=${individualDuration * 0.2}`);
  });
}

// ==========================================
// 7. 无缝无限滚动闭环逻辑 (Infinite Scroll)
// ==========================================
window.addEventListener('scroll', () => {
});

// 窗口自适应适配
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer3D.setSize(w, h);
  camera3D.aspect = w / h;
  camera3D.updateProjectionMatrix();

  if (window.gridLineMat) {
    window.gridLineMat.resolution.set(w, h);
  }
});

// ==========================================
// 调试工具：Figma 视觉还原面板
// ==========================================
function setupDebugGUI() {
  const gui = new GUI({ title: '🎬 动画关键帧调试' });

  // 1. 整体模型组 (控制总体位置和视角)
  const groupFolder = gui.addFolder('📦 模型总组 (modelGroup)');
  groupFolder.add(modelGroup.position, 'x', -10, 10, 0.01).name('Pos X');
  groupFolder.add(modelGroup.position, 'y', -10, 10, 0.01).name('Pos Y');
  groupFolder.add(modelGroup.position, 'z', -20, 20, 0.01).name('Pos Z');
  groupFolder.add(modelGroup.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X');
  groupFolder.add(modelGroup.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y');
  groupFolder.add(modelGroup.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z');

  // 2. 左耳机 (Waferleft)
  if (earbudLeft) {
    const leftFolder = gui.addFolder('🎧 左晶圆 (earbudLeft)');
    leftFolder.add(earbudLeft.position, 'x', -10, 10, 0.01).name('Pos X');
    leftFolder.add(earbudLeft.position, 'y', -10, 10, 0.01).name('Pos Y');
    leftFolder.add(earbudLeft.position, 'z', -10, 10, 0.01).name('Pos Z');
    leftFolder.add(earbudLeft.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X');
    leftFolder.add(earbudLeft.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y');
    leftFolder.add(earbudLeft.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z');
  }

  // 3. 右耳机 (Waferright)
  if (earbudRight) {
    const rightFolder = gui.addFolder('🎧 右晶圆 (earbudRight)');
    rightFolder.add(earbudRight.position, 'x', -10, 10, 0.01).name('Pos X');
    rightFolder.add(earbudRight.position, 'y', -10, 10, 0.01).name('Pos Y');
    rightFolder.add(earbudRight.position, 'z', -10, 10, 0.01).name('Pos Z');
    rightFolder.add(earbudRight.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X');
    rightFolder.add(earbudRight.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y');
    rightFolder.add(earbudRight.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z');
  }

  gui.close(); // 默认折叠起来
}