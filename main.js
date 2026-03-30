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
let magicFollowLight;
let lidInitialRot = 0; // 记录盖子初始角度
let mesh;

// 🌟【新增】：Shader 背景特效专用变量 (用于原汁原味还原粒子避让逻辑)
let time_bg = 0;
const mouseState = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };
let sandParticles;


// ==========================================
// 1.2 灯光系统 (8灯无死角影棚矩阵)
// ==========================================

// 1. 基础全局环境光：强行提升整个场景的暗部底色，确保绝对没有“死黑”
scene3D.add(new THREE.AmbientLight(0x717577bb, 0.8));

// 2. 8点矩阵光源配置 (按照甲方要求，全部使用 #6baac7)
const lightColor = [
  0xFF8800,
  0xFFA600,
  0xFFA600,
  0x00E4E4,
  0x8C00FF,
  0xFF0000,
  0x0000F5,
  0x41FF44
];
const baseIntensity = 1; // 基础光强，可根据实际明暗微调

// 我们建立一个 8 盏灯的包围矩阵，分别位于模型的 8 个斜角
// 为了打破死板，同侧的灯光角度（高低、远近）特意做了一些随机错开
const lightPositions = [
  { x: 8, y: 8, z: 8, intensity: baseIntensity * 0.5 }, // 前上右 (主光，稍微亮一点)
  { x: -7, y: 9, z: 6, intensity: baseIntensity * 0.5 },       // 前上左 (略高)
  { x: 6, y: -6, z: 7, intensity: baseIntensity * 0.5 }, // 前下右 (底光稍弱)
  { x: -8, y: -7, z: 5, intensity: baseIntensity * 0.5 }, // 前下左

  { x: 7, y: 6, z: -8, intensity: baseIntensity * 0.5 },       // 后上右 (勾勒边缘)
  { x: -9, y: 8, z: -7, intensity: baseIntensity * 0.5 },       // 后上左
  { x: 5, y: -8, z: -6, intensity: baseIntensity * 0.5 }, // 后下右
  { x: -6, y: -5, z: -9, intensity: baseIntensity * 0.5 }  // 后下左
];

lightPositions.forEach((config, index) => {
  const dirLight = new THREE.DirectionalLight(lightColor[index], config.intensity);
  dirLight.position.set(config.x, config.y, config.z);
  scene3D.add(dirLight);
});

// ==========================================
// 镜头控制器 (OrbitControls)
// ==========================================
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
  // 颜色稍微提亮一点点，因为加了透明度后整体视觉会变暗
  color: 0x1a457b,
  linewidth: 20,
  transparent: true,
  opacity: 0.03,
  depthWrite: false,
  resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
});

const sphericalGridMesh = new LineSegments2(lineGeo, window.gridLineMat);
sphericalGridMesh.computeLineDistances();
sphericalGridGroup.add(sphericalGridMesh);


// ==========================================
// 1.4 深空几何引力波与智能粒子 (重构版)
// ==========================================
let particlesGroup = new THREE.Group();
particlesGroup.visible = false; // 初始隐藏，等 loading 结束
scene3D.add(particlesGroup);

// --- A. 创建极致柔和且清晰可辨的光晕波纹 (完美复刻 Group 76) ---
function createDefinitiveRipple() {
    // 🌟【核心修复 1】：大幅度放大画布尺寸到 300，填满深空视野 #505c61
    const geometry = new THREE.PlaneGeometry(30, 30, 1, 1);
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            // 🌟 颜色提取：采用图 76 中的深邃宝蓝色
            uColor: { value: new THREE.Color(0x505c61) } 
        },
        fog: false, // 依然免疫迷雾，防止边缘被切断
        
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uColor;
            varying vec2 vUv;

            void main() {
                // 计算中心点距离
                float dist = distance(vUv, vec2(0.5));
                
                // 1. 🌟【核心修复 1：拉近间距】暴增频率！
                // 将距离乘数从 25.0 大幅度提高到 48.0。
                // 乘数越大，同心圆环之间的物理间距就越小，显得更紧密。
                float wave = cos(dist * 80.0 - uTime * 0.5); 

                // 将cosine波形归一化到 [0,1] 区间
                float pulse = (wave + 1.5) / 2.0;

                // 2. 🌟【核心魔法：变宽光带】降低指数，让波峰“流出来”。
                // 我们不再用 6.0 分离窄脉冲，而是改用 2.5 左右的低指数。
                // 这会让波峰变得极其宽广、厚实，形成一条条发光的“圆环光带”。
                pulse = pow(pulse, 2.5); 

                // 3. 🌟【发光与透明度】：配合宽广光带进行微调
                // 降低基础颜色倍率 (pulse * 2.8)，因为光带变宽了，亮度需要稍微收敛以防止整体过曝。
                vec3 finalColor = uColor * (0.1 + pulse * 2.8); 
                
                // 透明度消散控制：边缘羽化
                float alpha = (0.1 + pulse * 1.3) * smoothstep(0.5, 0.05, dist);
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        wireframe: false, 
        depthWrite: false, 
        side: THREE.DoubleSide
    });

    mesh = new THREE.Mesh(geometry, material);
    
    // 🌟【核心修复 6：站位调整】：彻底对准镜头，展现正圆波纹
    mesh.rotation.x = 0;
    mesh.rotation.y = 0; 
    // 将波纹放在背景组 particlesGroup 的正中心位置
    mesh.position.x = 0;
    mesh.position.z = 0; 
    
    return mesh;
}

// ⚠️ 注意：为了保持深空背景的纵深感，我调整了 particlesGroup 的整体站位
// 在 main.js 的顶部或者 particlesGroup 初始化处找到 particlesGroup.position.z = -25;
// 改为 particlesGroup.position.z = -20; 让背景特效稍微靠前一点，占满屏幕画面。
// particlesGroup.position.z = -20; // 🌟【新增/修改】
particlesGroup.add(createDefinitiveRipple());


// --- B. 创建避让沙粒粒子 (沙粒模式，保留交互事件) ---
function createSandParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = 2000; // 粒子数量，可根据性能微调
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    // 沙粒颜色调色板 (偏黄暖色调)
    const sandColors = [
        new THREE.Color(0xf4d03f), new THREE.Color(0xe9c46a), 
        new THREE.Color(0xd4a574), new THREE.Color(0xfaf3e0)
    ];
    
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // 拉大分布范围填满背景
        positions[i3] = (Math.random() - 0.5) * 200;
        positions[i3 + 1] = (Math.random() - 0.5) * 200;
        positions[i3 + 2] = (Math.random() - 0.5) * 100 - 30; // Z 轴往后放
        
        const color = sandColors[Math.floor(Math.random() * sandColors.length)];
        const colorVariation = 0.9 + Math.random() * 0.2;
        colors[i3] = color.r * colorVariation;
        colors[i3 + 1] = color.g * colorVariation;
        colors[i3 + 2] = color.b * colorVariation;
        
        sizes[i] = 0.5 + Math.random() * 1.5; // 粒子大小
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uMouseX: { value: 0 },
            uMouseY: { value: 0 },
            uPixelRatio: { value: renderer3D.getPixelRatio() }
        },
        fog: false,
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float uTime;
            uniform float uMouseX;
            uniform float uMouseY;
            uniform float uPixelRatio;
            
            void main() {
                vColor = color;
                vec3 pos = position;
                
                // 🌟【保留逻辑】：智能鼠标排斥逻辑
                float distX = pos.x - uMouseX * 50.0;
                float distY = pos.y - uMouseY * 50.0;
                float dist = sqrt(distX * distX + distY * distY);
                // 排斥排斥衰减 (距离越近偏移越大)
                float influence = 1.0 - smoothstep(0.0, 40.0, dist);
                // 随时间缓慢漂移
                float drift = sin(uTime * 0.5 + position.x * 0.1) * 0.5;
                
                pos.x += uMouseX * influence * 15.0 + drift;
                pos.y += uMouseY * influence * 15.0;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                // 增加粒子在 Z 轴上的体积感
                gl_PointSize = size * uPixelRatio * (50.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                // 圆形粒子，不规则边缘质感
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                alpha *= 0.7 + 0.3 * (1.0 - dist * 2.0);
                if (alpha < 0.01) discard;
                gl_FragColor = vec4(vColor, alpha * 0.6); // 降低透明度显得深邃
            }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    
    sandParticles = new THREE.Points(geometry, material);
    return sandParticles;
}
particlesGroup.add(createSandParticles());


// 🌟【保留监听器】：监听鼠标坐标 (-1 到 1)
window.addEventListener('mousemove', (event) => {
    mouseState.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    mouseState.targetY = -(event.clientY / window.innerHeight - 0.5) * 2; // Three Y轴向上
});


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
meteorGradient.addColorStop(1, 'rgb(255, 229, 200)');
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

// 🌟【新增】：在外部加载 AO 贴图 (请确保 image_860002.png 在你的正确目录下)
const textureLoader = new THREE.TextureLoader();
const aoMapTexture = textureLoader.load('./AO.png');
aoMapTexture.flipY = false;
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

      // 🌟【新增】：为所有模型挂载 AO 贴图提升厚重感
      if (child.isMesh && child.material) {
        // 确保模型有第二套 UV 用于 AO 贴图
        if (!child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
          child.geometry.setAttribute('uv2', new THREE.BufferAttribute(child.geometry.attributes.uv.array, 2));
        }
        child.material.aoMap = aoMapTexture;
        child.material.aoMapIntensity = 1.0;
        child.material.envMapIntensity = 1.5;
      }
      // 🎧 右晶圆 (薄膜晶圆) - 注入专属参数与灯光
      if (child.name === 'Waferright') {
        earbudRight = child;
        // 【核心新增】：克隆材质，让右晶圆拥有独立的材质，以便后续用 GSAP 单独给它变色！
        if (child.material) {
          child.material = child.material.clone();
        }

        // 参数：颜色(科技深蓝), 亮度(极高，因为要压过环境光), 衰减距离(8，只照亮自己)
        magicFollowLight = new THREE.PointLight(0x0055ff, 365, 8);

        // 核心站位：x设为负数(放在晶圆左侧), z微微凸出(贴着表面扫光，照出网格颗粒)
        magicFollowLight.position.set(-1.56, 0.66, -0.29);

        // 绑定父子关系：让灯光成为晶圆的子元素！晶圆飞到哪、怎么转，灯就死死跟到哪！
        child.add(magicFollowLight);

        // 🌟 直接在这里添加 GUI！因为此时模型 100% 加载完成了
        // 注意：确保外面已经初始化了 gui 变量 (比如 const gui = new GUI();)
        if (typeof gui !== 'undefined') {
          const debugFolder = gui.addFolder('晶圆特写光影调试');
          debugFolder.add(magicFollowLight.position, 'x', -10, 10).name('灯光左右(X)');
          debugFolder.add(magicFollowLight.position, 'z', -5, 5).name('灯光前后(Z)');
          debugFolder.add(magicFollowLight, 'intensity', 0, 500).name('灯光亮度');
          debugFolder.add(earbudRight.material, 'roughness', 0, 1).name('表面粗糙度');
        }
      }
      // 🎧 左晶圆 (核心晶圆) - 注入专属参数
      if (child.name === 'Waferleft') {
        earbudLeft = child;
        if (child.material) {
          // 注入 3D 老师的精确参数：金属度 0.8，粗糙度 0.3
          child.material.metalness = 0.8;
          child.material.roughness = 0.3;
        }
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
      // 注意：此时 .ui-stage-1 本身还是 opacity: 0 的，所以文字此时依然看不见，保持干爽。原值为1
      .to('.stage2-el', { opacity: 1, duration: 0.2 }, "<0.5")

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

  // 补充获取新加的彗星头元素
  const circle = document.querySelector('.progress-ring__circle');
  const head = document.querySelector('.progress-ring__head'); // 🌟 新增
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  const conicBg = document.querySelector('.conic-bg');
  const uiProgress = { val: 0 };

  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  let isAutoLooping = false;

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
        if (!isAutoLooping) {
          // 1. 原有的线圈清空控制
          const offset = circumference - self.progress * circumference;
          gsap.to(circle, { strokeDashoffset: offset, duration: 0.1, ease: "none" });
          gsap.to(bgScrollObj, { offset: self.progress * -Math.PI * 2, duration: 0.8, ease: "power2.out" });

          // 2. 🌟 核心魔法：动态计算发光头与渐变尾巴
          gsap.to(uiProgress, {
              val: self.progress,
              duration: 0.1, // 这里的 0.1 必须和线圈动画同步，保证头咬着线
              ease: "none",
              onUpdate: () => {
                  const p = uiProgress.val;

                  // A. 更新发光头坐标
                  const angle = p * Math.PI * 2;
                  head.setAttribute('cx', 400 + radius * Math.cos(angle));
                  head.setAttribute('cy', 400 + radius * Math.sin(angle));

                  // B. 🌟 动态压缩渐变！
                  // 将 0-100% 的渐变强行挤压到当前 p 的长度里！
                  const p100 = Math.max(p * 100, 0.01); // 算出当前总长度 (避免 0% 报错)
                  const p40 = p100 * 0.4;               // 算出幽蓝色转折点
                  
                  if(conicBg) {
                      conicBg.style.background = `conic-gradient(from 90deg, rgba(2, 6, 17, 0) 0%, rgba(26, 85, 153, 0.5) ${p40}%, #41a5ff ${p100}%, transparent ${p100}%)`;
                  }
              }
          });
        }

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

  tl.to(mesh.position, { y: -16, duration: 2, ease: "power1.inOut" }, "stage1+=1.3")
    .to(mesh.rotation, { x: -Math.PI / 2, y: Math.PI / 8,duration: 2.6, ease: "power1.inOut" }, "stage1+=1.1");

  tl.to(earbudLeft.position, {
    y: w1Initial.pos.y + 0.5,
    z: w1Initial.pos.z + 1,
    duration: 1.7, ease: "power1.inOut"
  }, "stage1+=0.3");


  // ------------------------------------------
  // Stage 2: 左晶圆主导升空，右晶圆跟随
  // ------------------------------------------
  tl.addLabel("stage2", 2.0); // 间隔 2 秒

  tl.to(".ui-stage-2", { opacity: 1, duration: 0.8 }, "stage2");

  tl.to(modelGroup.position, { x: -3.5, y: -8.5, z: 1.5, duration: 0.6, ease: "power2.out" }, "stage2")
    .to(modelGroup.rotation, { z: 0.2, duration: 0.6, ease: "power2.out" }, "stage2");

  // 上升加旋转
  tl.to(earbudLeft.position, { x: 1.4, y: w1Initial.pos.y + 7, z: w1Initial.pos.z + 8, duration: 0.9, ease: "power2.out" }, "stage2")
    .to(earbudLeft.rotation, { x: Math.PI, y: Math.PI, z: 0.1, duration: 0.9, ease: "power2.out" }, "stage2");

  // 向下移动 角度不变 
  tl.to(earbudLeft.position, { x: 2, y: w1Initial.pos.y + 8.5, z: w1Initial.pos.z + 4, duration: 0.1, ease: "power2.out" }, "stage2+=0.9")

  // 到图片阶段的最终状态
  tl.to(earbudLeft.position, { x: 0.62, y: 5.88, z: w1Initial.pos.z + 8.8, duration: 0.9, ease: "power2.out" }, "stage2+=1")
    .to(earbudLeft.rotation, { x: 2.70, y: -2.42159265358979, duration: 0.4, ease: "power2.out" }, "stage2+=1");

  tl.to(earbudRight.position, { x: 1.4, y: 5.42, z: w2Initial.pos.z + 8.8, duration: 1.6, ease: "power2.out" }, "stage2+=0.3")
    .to(earbudRight.rotation, { x: -0.181592653589793, y: Math.PI + 0.438407346410207, z: 1.97840734641021, duration: 1.3, ease: "power2.out" }, "stage2+=0.6");


  // ------------------------------------------
  // Stage 3: 传感核心晶圆特写与矩阵排版
  // ------------------------------------------
  tl.addLabel("stage3", 4.0); // 间隔 2 秒

  tl.to(".ui-stage-2", { opacity: 0, duration: 0.4 }, "stage3");
  tl.set(".ui-stage-3", { opacity: 1 }, "stage3+=0.1");

  tl.fromTo([".stage3-title", ".callout"], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "stage3+=0.2");
  tl.fromTo(".spec-item", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.6, ease: "power2.out", stagger: 0.15 }, "stage3+=0.4");

  tl.to(earbudLeft.position, { x: 0.01, y: 6.07,z: w1Initial.pos.z + 6, duration: 1, ease: "power2.out" }, "stage3")
    .to(earbudLeft.rotation, { x: 0, y: 0.438, z: -0.2, duration: 1, ease: "power2.out" }, "stage3+=0.3");
  tl.to(earbudRight.position, { x: 3.0, y: 5.34, duration: 1, ease: "power2.out" }, "stage3")
    .to(earbudRight.rotation, { x: 2.13840734641021, y: -Math.PI, z: -0.931592653589, duration: 1, ease: "power2.out" }, "stage3+=0.3");

  tl.to(earbudLeft.position, { x: 0.98, y: 6.22, z: w1Initial.pos.z + 8, duration: 0.6, ease: "power2.out" }, "stage3+=1")

  tl.to(earbudRight.position, { x: 1.33, y: 5.34, z: w2Initial.pos.z + 8.9, duration: 0.4, ease: "power2.out" }, "stage3+=1")

  // ------------------------------------------
  // Stage 4: 晶圆横移换位与薄膜晶圆特写
  // ------------------------------------------
  tl.addLabel("stage4", 6.0); // 间隔 2 秒

  tl.to(".ui-stage-3", { opacity: 0, duration: 0.4 }, "stage4");

  // 分离阶段
  tl.to(earbudLeft.position, { x: -0.32,z: w1Initial.pos.z + 6, duration: 0.5, ease: "power2.out" }, "stage4")
    .to(earbudLeft.rotation, { x: 0, y: Math.PI * 2 + 0.9, z: 0, duration: 0.5, ease: "power2.out" }, "stage4");

  tl.to(earbudRight.position, { x: 2.5, duration: 0.4, ease: "power2.out" }, "stage4")
    .to(earbudRight.rotation, { z: -1.32159265358979, duration: 0.4, ease: "power2.out" }, "stage4+=0.1")

  tl.to(earbudLeft.position, { x: 0.68, y: 5.17, z: w1Initial.pos.z + 10.5, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.5")
    .to(earbudLeft.rotation, { x: -0.12159, y: Math.PI * 2 + 0.5184, z: -0.411, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.5");

  tl.to(earbudRight.position, { x: 0.61, y: 5.93, z: w2Initial.pos.z + 8.6, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.7")
    .to(earbudRight.rotation, { y: -2.93, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.7");

  tl.set(".ui-stage-4", { opacity: 1 }, "stage4+=0.4");
  tl.fromTo([".stage4-title", ".ui-stage-4 .callout"],
    { opacity: 0, x: (i) => i === 0 ? -30 : 30 },
    { opacity: 1, x: 0, duration: 0.8, ease: "power2.out", stagger: 0.2 }, "stage4+=1.2");


  // ------------------------------------------
  // Stage 5: 无缝连续的分离与防穿模重构合体
  // ------------------------------------------
  tl.addLabel("stage5", 8.0); // 间隔 2 秒

  tl.to(".ui-stage-4", { opacity: 0, duration: 0.5 }, "stage5");

  // 坐标定义
  const separationPosL = { x: -0.5, y: 5.97, z: 12.0 };
  const separationPosR = { x: 3.0, y: 5.97, z: 12.0 };
  const mergePosL = { x: 1.67 + 0.28, y: 5.97, z: 10.9 };
  const mergePosR = { x: 1.67, y: 5.97, z: 11 + 0.09 };

  // 🌟【新增】：防穿模“预备对齐位” (Y和Z已经到位，但X轴拉开距离)
  const preMergePosL = { x: mergePosL.x - 1.5, y: mergePosL.y, z: mergePosL.z };
  const preMergePosR = { x: mergePosR.x + 1.5, y: mergePosR.y, z: mergePosR.z };

  // 1. 分离阶段：向两侧散开并进行 180度翻转
  tl.to(earbudLeft.position, { ...separationPosL, duration: 1.0, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudLeft.rotation, { x: Math.PI / 2, y: Math.PI, z: 0.1, duration: 1.0, ease: "power2.out" }, "stage5+=0.5");

  tl.to(earbudRight.position, { ...separationPosR, duration: 1.0, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudRight.rotation, { x: Math.PI / 2, y: -Math.PI, z: 0.1, duration: 1.0, ease: "power2.out" }, "stage5+=0.5");

  // 2. 预备对齐阶段：飞到结合点两侧，完成所有旋转动作 (不再穿模)
  tl.to(earbudLeft.position, { ...preMergePosL, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5")
    .to(earbudLeft.rotation, { x: 0, y: Math.PI / 2, z: 0.1, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5");

  tl.to(earbudRight.position, { ...preMergePosR, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5")
    .to(earbudRight.rotation, { x: Math.PI / 2, y: 0, z: 0.1, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5");

  // 3. 最终结合阶段：姿态已定，只移动 X 轴，像磁铁一样“啪”地吸附！
  tl.to(earbudLeft.position, { x: mergePosL.x, duration: 0.5, ease: "power3.in" }, "stage5+=2.5")
    .to(earbudRight.position, { x: mergePosR.x, duration: 0.5, ease: "power3.in" }, "stage5+=2.5");

  // 4. 材质变色与网格拉近 (配合最后 X 轴贴合的瞬间触发)
  const mergeImpactTime = "stage5+=2.5";
  tl.to(leftMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 0.6, ease: "power2.out" }, mergeImpactTime);
  tl.to(rightMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 0.6, ease: "power2.out" }, mergeImpactTime);
  tl.to(rightMat.emissive, { r: 0, g: 0, b: 0, duration: 0.6, ease: "power2.out" }, mergeImpactTime);

  tl.to(sphericalGridGroup.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 1.5, ease: "power3.inOut" }, mergeImpactTime);
  tl.to(sphericalGridGroup.children[0].material, { duration: 1.5, ease: "power2.inOut" }, mergeImpactTime);

  // ==========================================================
  // Stage 6: [完美防出画 + 优雅翻转] 坠落归仓，命运闭环
  // ==========================================================
  tl.addLabel("stage6", 11.0);

  // 1. 材质变亮 (耗时 0.6 秒)
  tl.to(leftMat.color, { r: 1, g: 1, b: 1, duration: 0.6 }, "stage6")
    .to(rightMat.color, { r: 1, g: 1, b: 1, duration: 0.6 }, "stage6");

  // 2. 高空预分离 (耗时 0.6 秒，为后续的安全翻转腾出空间)
  tl.to(earbudLeft.position, { x: mergePosL.x - 1.5, duration: 0.6, ease: "power2.out" }, "stage6+=0.2")
    .to(earbudRight.position, { x: mergePosR.x + 1.5, duration: 0.6, ease: "power2.out" }, "stage6+=0.2");

  // ==========================================
  // 🌟【核心优化 1】：盒子推迟升空 (接应动作)
  // 让晶圆先掉，盒子在 stage6+=1.0 (晶圆下落中途) 才开始猛烈升起“接住”它们
  // 这样能确保晶圆绝对不会被顶出屏幕画面！
  // ==========================================
  const finalBoxPos = { x: 0, y: 1.6, z: 2.62 };
  const finalBoxRot = { x: 0.3, y: 0, z: 0 };
  const boxUpStart = "stage6+=1.0"; // 延迟升空时间

  tl.to(modelGroup.position, { ...finalBoxPos, duration: 1.2, ease: "power2.inOut" }, boxUpStart)
    .to(modelGroup.rotation, { ...finalBoxRot, duration: 1.2, ease: "power2.inOut" }, boxUpStart);

  // ==========================================
  // 🌟【核心优化 2】：下坠与优雅翻滚
  // ==========================================
  const fallStart = "stage6+=0.6";
  const fallActionTime = 1.6; // 下坠总时长依然是 1.6s

  // A. 位置：带有重力加速度的下落 (直接落入卡槽)
  tl.to(earbudLeft.position, {
    x: w1Initial.pos.x, y: w1Initial.pos.y, z: w1Initial.pos.z,
    duration: fallActionTime, ease: "power2.in"
  }, fallStart)
    .to(earbudRight.position, {
      x: w2Initial.pos.x, y: w2Initial.pos.y, z: w2Initial.pos.z,
      duration: fallActionTime, ease: "power2.in"
    }, fallStart);

  // B. 角度动作 1：下落前段的“优雅翻滚” (耗时 1.0s)
  // 因为它们已经左右分开了，这时候绕 Y 轴翻转 180 度，就像硬币翻滚，绝不穿模
  tl.to(earbudLeft.rotation, {
    y: "+=" + Math.PI, // 翻转 180度
    duration: 1.0, ease: "power1.inOut"
  }, fallStart)
    .to(earbudRight.rotation, {
      y: "-=" + Math.PI, // 反向翻转 180度，增加对称美感
      duration: 1.0, ease: "power1.inOut"
    }, fallStart);

  // C. 角度动作 2：下落后段的“精准回正” (耗时 0.6s)
  // 在即将落入卡槽的最后瞬间，强制干脆地吸附到初始角度
  tl.to(earbudLeft.rotation, {
    x: w1Initial.rot.x, y: w1Initial.rot.y, z: w1Initial.rot.z,
    duration: 0.6, ease: "back.out(1.2)" // 带有微弱机械反弹感的回正
  }, "stage6+=1.6")
    .to(earbudRight.rotation, {
      x: w2Initial.rot.x, y: w2Initial.rot.y, z: w2Initial.rot.z,
      duration: 0.6, ease: "back.out(1.2)"
    }, "stage6+=1.6");

  // 4. 灵魂关盖
  const lidClosureTime = "stage6+=2.2";
  tl.to(caseLid.rotation, {
    x: lidInitialRot,
    duration: 0.6,
    ease: "bounce.out"
  }, lidClosureTime);

  // 5. 开场 UI 重现
  tl.fromTo(".ui-stage-1",
    { opacity: 0, filter: 'blur(10px)', scale: 1.1 },
    { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 1.2, ease: "power2.out" },
    "stage6+=2.4"
  );

  // 【界碑】：Stage 6 结束点，用于无缝闭环判定
  tl.addLabel("stage6_end", 14.6);

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

    // 🌟【高级 UI 闭环】：顺时针清空圆环的线条
    loopTl.to(circleEl, {
      strokeDashoffset: -circumference,
      duration: 1.5,
      ease: "power2.inOut"
    }, 0);

    // 🌟【新增】：让发光点跟着一起“跑完最后的清空圈”，回到 12 点钟起点
    const dummyObj = { p: 1 }; // progress 已经满了，我们模拟它从 1 继续跑到 2
    loopTl.to(dummyObj, {
      p: 2, 
      duration: 1.5,
      ease: "power2.inOut",
      onUpdate: () => {
        const angle = dummyObj.p * Math.PI * 2;
        head.setAttribute('cx', 400 + radius * Math.cos(angle));
        head.setAttribute('cy', 400 + radius * Math.sin(angle));
      }
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
  // 🌟【新增】：Shader 专用计时器，独立驱动背景动效，防止和 GSAP 冲突
  time_bg += 0.016; 

  // 🌟【新增】：鼠标平滑插值 (让避让效果丝滑)
  mouseState.currentX += (mouseState.targetX - mouseState.currentX) * 0.05;
  mouseState.currentY += (mouseState.targetY - mouseState.currentY) * 0.05;

  // 🌟【新增】：更新引力波 Shader 时间
  particlesGroup.children.forEach(child => {
      // 遍历找到那个几何网格
      if (child.material && child.material.uniforms && child.material.uniforms.uTime && child.isMesh) {
          child.material.uniforms.uTime.value = time_bg;
      }
  });

  // 🌟【新增】：更新智能粒子 Shader (时间与鼠标坐标)
  if (sandParticles && sandParticles.material.uniforms) {
      sandParticles.material.uniforms.uTime.value = time_bg;
      sandParticles.material.uniforms.uMouseX.value = mouseState.currentX;
      sandParticles.material.uniforms.uMouseY.value = mouseState.currentY;
  }

  // 网格滚动视差
  if (typeof sphericalGridGroup !== 'undefined' && sphericalGridGroup) {
      sphericalGridGroup.rotation.y = (time * 1) + bgScrollObj.offset;
      sphericalGridGroup.position.y = Math.sin(time * 2) * 15;
  }

  if (controls3D) controls3D.update();
  renderer3D.render(scene3D, camera3D);
}
animate();

// 🌟【新增】：捕获鼠标在屏幕上的归一化坐标 (-1 到 1)
window.addEventListener('mousemove', (event) => {
  mouseState.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
  // Three.js 的 Y 轴是向上的，所以屏幕 Y 坐标需要取反
  mouseState.targetY = -(event.clientY / window.innerHeight - 0.5) * 2;
});

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

  // 1. 穿透寻找真正的材质
  let targetMat = null;
  if (earbudRight) {
    earbudRight.traverse((child) => {
      // 只要找到网格，就提取它的材质
      if (child.isMesh) targetMat = child.material;
    });
  }

  // 2. 绑定 GUI (确保灯光和材质都真正存在)
  if (magicFollowLight && targetMat) {
    const debugFolder = gui.addFolder('晶圆特写光影调试');

    // 控制那盏蓝色的专属跟拍灯
    debugFolder.add(magicFollowLight.position, 'x', -10, 10).name('灯光左右(X)');
    debugFolder.add(magicFollowLight.position, 'y', -10, 10).name('灯光上下(Y)');
    debugFolder.add(magicFollowLight.position, 'z', -5, 5).name('灯光前后(Z)'); // 极其关键：越贴近表面，网格越清晰
    debugFolder.add(magicFollowLight, 'intensity', 0, 500).name('灯光亮度');

    // 控制真正的模型材质
    debugFolder.add(targetMat, 'roughness', 0, 1).name('表面粗糙度');
  } else {
    console.warn('⚠️ 警告：找不到跟拍灯或目标材质，光影调试面板未加载');
  }

  gui.close(); // 默认折叠起来
}