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

      // C. 自动开盖展示 (延迟 0.3 秒，让用户先消化一下刚刚的视觉冲击)
      .to(caseLid.rotation, { x: lidInitialRot - Math.PI / 2, duration: 1.5, ease: "power2.out" }, "+=0.3")
      .to('#shockwaveVideo', {
        opacity: 0,
        duration: 1,
        onComplete: () => {
          const vid = document.getElementById('shockwaveVideo');
          if (vid) vid.remove();
        }
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
// 4. 用户交互时间轴 (ScrollTrigger)
// ==========================================
function initScrollTimeline() {
  const circle = document.querySelector('.progress-ring__circle');
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;

  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".scroll-container",
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      snap: {
        snapTo: [0, 0.25, 0.5, 0.75, 1],
        delay: 2,
        ease: "power2.inOut",
        duration: { min: 0.5, max: 1.5 }
      },
      onUpdate: (self) => {
        // 圆环进度
        const offset = circumference - self.progress * circumference;
        gsap.to(circle, { strokeDashoffset: offset, duration: 0.1, ease: "none" });

        // 背景视差偏移代理
        gsap.to(bgScrollObj, {
          offset: self.progress * -Math.PI * 2,
          duration: 0.8,
          ease: "power2.out"
        });
      }
    }
  });

  const w1Initial = { pos: earbudLeft.position.clone(), rot: earbudLeft.rotation.clone() };
  const w2Initial = { pos: earbudRight.position.clone(), rot: earbudRight.rotation.clone() };

  // ------------------------------------------
  // Stage 1 (0 -> 25%): 预备动作 - 盒子微扭转
  // ------------------------------------------
  tl.addLabel("stage1", 0);

  // 1. 开场英雄文字平滑淡出
  tl.to(".ui-stage-1", { opacity: 0, duration: 0.5 }, "stage1+=0.25");

  // 2. 盒子微移与扭转 (完美应用你的 GUI 参数)
  tl.to(modelGroup.position, {
    x: -1.2,
    y: -0.65,
    z: -0.16,
    ease: "power1.inOut"
  }, "stage1")
    .to(modelGroup.rotation, {
      x: -0.25159,
      y: 0.288407,
      z: 0.568407,
      ease: "power1.inOut"
    }, "stage1");

  tl.to(earbudLeft.position, {
    y: w1Initial.pos.y + 0.5, // Sublte 垂直上升的一点点 (用户可根据 GUI 调优此数值)
    z: w1Initial.pos.z + 1,
    ease: "power1.inOut"
  }, "stage1"); // 延迟开始，形成错落节奏

  // ==========================================================
  // Stage 2 (25% -> 50%): 左晶圆主导升空，右晶圆滞后跟随，镜头推近
  // ==========================================================
  tl.addLabel("stage2", 0.25);

  // 1. 盒子总组：持续下沉，同时向屏幕外侧(左下方)移动，退出视觉中心
  // 结合推镜头的效果，我们在 Z 轴上也稍微拉近一点点
  tl.to(modelGroup.position, {
    x: -3.5,
    y: -8.5,
    z: 1.5, // 稍微拉近
    duration: 0.75,
    ease: "power2.inOut"
  }, "stage2")
    .to(modelGroup.rotation, {
      z: 0.2,
      duration: 0.75,
      ease: "power2.inOut"
    }, "stage2");

  // 2. 左晶圆主导升空与旋转
  // 注意：因为老爸(modelGroup)在 Y 轴下沉了约 8，在 Z 轴拉近了 1.5
  // 所以左晶圆要停在屏幕中央偏上的位置，它自身的 Y 和 Z 需要大幅增加
  tl.to(earbudLeft.position, {
    x: 3.5, // 移动到大致居中偏左的位置
    y: w1Initial.pos.y + 9, // 抵消盒子的下沉，飞向高处
    z: w1Initial.pos.z + 5, // 飞向镜头
    duration: 1.5,
    ease: "power2.out"
  }, "stage2")
    .to(earbudLeft.rotation, {
      // 达到图中的倾斜姿态
      x: 3.3,
      y: 3.8,
      z: 0.1,
      duration: 1.5,
      ease: "power2.out"
    }, "stage2");

  // 3. 右晶圆滞后跟随与旋转
  // 使用 "stage2+=0.4" 让右晶圆比左晶圆晚起飞 0.4 秒，形成你要求的错落感
  tl.to(earbudRight.position, {
    x: 1.5, // 偏右
    y: w2Initial.pos.y + 10.5, // 飞向稍低一点的位置
    z: w2Initial.pos.z + 5.5, // 稍微比左晶圆更靠近镜头一点
    duration: 1.3, // 稍微缩短飞行时间，显得更有冲劲
    ease: "power2.out"
  }, "stage2+=0.4")
    .to(earbudRight.rotation, {
      // 达到图中的倾斜姿态
      x: 0.2,
      y: -0.5,
      z: -0.2,
      duration: 1.3,
      ease: "power2.out"
    }, "stage2+=0.4");

  // 接下来的 stage3 暂时保留你原来的，等后续再调
  tl.addLabel("stage3", 0.5);
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

// 无缝无限滚动闭环
// window.addEventListener('scroll', () => {
//   const scrollTop = document.documentElement.scrollTop;
//   const scrollHeight = document.documentElement.scrollHeight;
//   const clientHeight = document.documentElement.clientHeight;

//   if (scrollTop + clientHeight >= scrollHeight - 2) {
//     window.scrollTo(0, 0);
//   }
//   if (scrollTop <= 0) {
//     window.scrollTo(0, scrollHeight - clientHeight - 2);
//   }
// });

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