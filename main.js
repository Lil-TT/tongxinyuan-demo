import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

// 🌟 引入 HDR 环境贴图加载器
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

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

// 开启 sRGB 和电影级色调映射
renderer3D.outputColorSpace = THREE.SRGBColorSpace;
renderer3D.toneMapping = THREE.ACESFilmicToneMapping;
renderer3D.toneMappingExposure = 1.2;

const scene3D = new THREE.Scene();
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
let lidInitialRot = 0;
let mesh;

// Shader 背景特效专用变量
let time_bg = 0;
const mouseState = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };
let sandParticles;

// 🌟【新增核心状态】：资源是否加载完成的标识
let isAssetsLoaded = false;

// ==========================================
// 1.2 灯光系统 (影视级三点布光 + 氛围光)
// ==========================================
const ambientLight = new THREE.AmbientLight(0x606080, 0.85);
scene3D.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(3, 5, 2);
directionalLight.castShadow = true;
directionalLight.receiveShadow = false;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 10;
directionalLight.shadow.camera.left = -5;
directionalLight.shadow.camera.right = 5;
directionalLight.shadow.camera.top = 5;
directionalLight.shadow.camera.bottom = -5;
scene3D.add(directionalLight);

const backLight = new THREE.PointLight(0xffaa66, 0.6);
backLight.position.set(-2, 2, -3);
scene3D.add(backLight);

const fillLight = new THREE.PointLight(0x88aaff, 0.4);
fillLight.position.set(1, 1.5, 2);
scene3D.add(fillLight);

const rimLight = new THREE.PointLight(0x88ccff, 0.3);
rimLight.position.set(0, -1, 0);
scene3D.add(rimLight);

const hemiLight = new THREE.HemisphereLight(0x8b9dc3, 0x3c4a5e, 0.45);
scene3D.add(hemiLight);

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
// 1.3 几何球形网格系统
// ==========================================
const sphericalGridGroup = new THREE.Group();
sphericalGridGroup.visible = false;
scene3D.add(sphericalGridGroup);

const baseSphereGeo = new THREE.SphereGeometry(60, 40, 20);
const wireframeGeo = new THREE.WireframeGeometry(baseSphereGeo);
const lineGeo = new LineGeometry();
lineGeo.setPositions(wireframeGeo.attributes.position.array);

window.gridLineMat = new LineMaterial({
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
// 1.4 深空几何引力波与智能粒子
// ==========================================
let particlesGroup = new THREE.Group();
particlesGroup.visible = false;
particlesGroup.position.z = -20;
scene3D.add(particlesGroup);

function createDefinitiveRipple() {
  const geometry = new THREE.PlaneGeometry(30, 30, 1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x505c61) }
    },
    fog: false,
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
                float dist = distance(vUv, vec2(0.5));
                float wave = cos(dist * 80.0 - uTime * 0.5); 
                float pulse = pow((wave + 1.5) / 2.0, 2.5); 
                vec3 finalColor = uColor * (0.1 + pulse * 2.8); 
                float alpha = (0.1 + pulse * 1.3) * smoothstep(0.5, 0.05, dist);
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = 0;
  mesh.rotation.y = 0;
  mesh.position.set(0, 0, 0);
  return mesh;
}
particlesGroup.add(createDefinitiveRipple());

function createSandParticles() {
  const geometry = new THREE.BufferGeometry();
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const sandColors = [
    new THREE.Color(0xf4d03f), new THREE.Color(0xe9c46a),
    new THREE.Color(0xd4a574), new THREE.Color(0xfaf3e0)
  ];

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 200;
    positions[i3 + 1] = (Math.random() - 0.5) * 200;
    positions[i3 + 2] = (Math.random() - 0.5) * 100 - 30;

    const color = sandColors[Math.floor(Math.random() * sandColors.length)];
    const colorVariation = 0.9 + Math.random() * 0.2;
    colors[i3] = color.r * colorVariation;
    colors[i3 + 1] = color.g * colorVariation;
    colors[i3 + 2] = color.b * colorVariation;
    sizes[i] = 0.5 + Math.random() * 1.5;
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
                float distX = pos.x - uMouseX * 50.0;
                float distY = pos.y - uMouseY * 50.0;
                float dist = sqrt(distX * distX + distY * distY);
                float influence = 1.0 - smoothstep(0.0, 40.0, dist);
                float drift = sin(uTime * 0.5 + position.x * 0.1) * 0.5;
                
                pos.x += uMouseX * influence * 15.0 + drift;
                pos.y += uMouseY * influence * 15.0;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * uPixelRatio * (50.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
    fragmentShader: `
            varying vec3 vColor;
            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
                alpha *= 0.7 + 0.3 * (1.0 - dist * 2.0);
                if (alpha < 0.01) discard;
                gl_FragColor = vec4(vColor, alpha * 0.6); 
            }
        `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });

  sandParticles = new THREE.Points(geometry, material);
  return sandParticles;
}
particlesGroup.add(createSandParticles());

// ==========================================
// 1.5 背景流星雨系统 
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
    map: meteorTexture, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(meteorGeo, meteorMat);
  meteorMeshes.push(mesh);
  meteorGroup.add(mesh);
}
meteorGroup.position.set(0, 0, -50);

// ==========================================
// 2. 真实进度加载管理器 (True Progress Loader)
// ==========================================
const manager = new THREE.LoadingManager();
const counterObj = { val: 0 };
const counterEl = document.getElementById('counter');

manager.onProgress = function (url, itemsLoaded, itemsTotal) {
  const targetPercent = (itemsLoaded / itemsTotal) * 100;
  gsap.to(counterObj, {
    val: targetPercent,
    duration: 0.3,
    ease: "power1.out",
    onUpdate: () => {
      if (counterEl) {
        counterEl.innerText = `[ ${Math.round(counterObj.val).toString().padStart(3, '0')} ]`;
      }
    }
  });
};

// ==========================================
// 3. UI 动画重构：无限循环与完美归正
// ==========================================
gsap.set('.loader__circle', { opacity: 0, filter: 'blur(16px)' });
gsap.set('.tagcloud--item', { opacity: 0 });

const introTl = gsap.timeline({ delay: 0.5 });
introTl
  .to('.loader__circle', {
    opacity: 1, filter: 'blur(0px)', duration: 2.5, ease: 'expo.out', stagger: { each: 0.15, from: "end" }
  }, 0)
  .to('.tagcloud--item', { opacity: 1, duration: 1, stagger: 0.2 }, 1)
  .add(() => {
    playSpinCycle(); // 启动循环旋转引擎
  }, 1.0);

function playSpinCycle() {
  gsap.to('.loader__circle:nth-child(-n+6)', {
    rotationX: (i) => i % 2 === 0 ? "+=360" : "-=360",
    rotationY: (i) => i % 2 === 0 ? "-=360" : "+=360",
    duration: 3.5,
    ease: 'power3.inOut',
    stagger: 0.12,
    onComplete: () => {
      if (!isAssetsLoaded) {
        playSpinCycle(); // 没加载完，继续翻转
      } else {
        enterMainScene(); // 加载完且完美归正，进入主界面！
      }
    }
  });
}

function enterMainScene() {
  const enterTl = gsap.timeline();

  enterTl
    .to('.loader-w', { scale: 0.5, opacity: 0, filter: 'blur(10px)', duration: 1.0, ease: 'power3.inOut' }, 0)
    .to('.tagcloud-w', { opacity: 0, duration: 0.8 }, 0)
    .to('.stage2-el', { opacity: 1, duration: 0.2 }, 0.5)
    .to(modelGroup.position, { y: 0, duration: 1.2, ease: "power3.in" }, 0.5)
    .addLabel("hitGround", 1.7)
    .add(() => {
      const vid = document.getElementById('shockwaveVideo');
      if (vid) {
        vid.currentTime = 0;
        vid.play().catch(err => console.warn("冲击波视频警告:", err));
      }
    }, "hitGround")
    .to('#shockwaveVideo', { opacity: 1, duration: 0.2 }, "hitGround")
    .to(modelGroup.position, { y: -0.4, duration: 0.15, yoyo: true, repeat: 1 }, "hitGround")
    .fromTo('.ui-stage-1',
      { opacity: 0, y: 30, filter: 'blur(10px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.5, ease: "power2.out" },
      "hitGround+=0.2"
    )
    .addLabel("openLid", "hitGround+=1.5")
    .to(caseLid.rotation, { x: lidInitialRot - Math.PI / 2, duration: 1.5, ease: "power2.out" }, "openLid")
    .to('#shockwaveVideo', { opacity: 0, duration: 1 }, "openLid")
    .addLabel("deepSpace", "openLid+=1.0")
    .set(sphericalGridGroup, { visible: true }, "deepSpace")
    .set(particlesGroup, { visible: true }, "deepSpace")
    .add(() => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      ScrollTrigger.refresh();
      setupDebugGUI();
      initScrollTimeline();

      // 启动定时流星生成器
      function scheduleNextMeteor() {
        const delay = THREE.MathUtils.randInt(8000, 15000);
        setTimeout(() => { triggerShootingStar(); scheduleNextMeteor(); }, delay);
      }
      setTimeout(scheduleNextMeteor, 3000);
    }, "deepSpace+=0.5");
}

// ==========================================
// 4. 资产预加载、环境贴图与高级材质重构 (Promise)
// ==========================================
const textureLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader(manager);
const hdrLoader = new HDRLoader(manager).setDataType(THREE.FloatType);

const loadHDR = new Promise(res => hdrLoader.load('./studio_small_09_2k.hdr', res));
const loadLidTex = new Promise(res => textureLoader.load('./2.png', res));
const loadWaferLeftTex = new Promise(res => textureLoader.load('./tex_left.png', res));
const loadWaferRightTopTex = new Promise(res => textureLoader.load('./tex_right_top.png', res));
const loadWaferRightBottomTex = new Promise(res => textureLoader.load('./tex_right_bottom.png', res));
const loadModel = new Promise(res => gltfLoader.load('./box1.glb', res));

Promise.all([
  loadHDR, loadLidTex, loadWaferLeftTex, loadWaferRightTopTex, loadWaferRightBottomTex, loadModel
]).then(([hdrTexture, lidTexture, texLeft, texRightTop, texRightBottom, gltf]) => {

  const pmremGenerator = new THREE.PMREMGenerator(renderer3D);
  const currentEnvMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
  scene3D.environment = currentEnvMap;
  pmremGenerator.dispose();

  // B. 配置贴图属性
  lidTexture.wrapS = THREE.RepeatWrapping;
  lidTexture.wrapT = THREE.RepeatWrapping;
  lidTexture.repeat.set(1, 1);
  lidTexture.colorSpace = THREE.SRGBColorSpace;

  // ==================================================
  // 🌟 C. 核心：封装材质流水线，批量制造 3 种高定材质
  // ==================================================
  const createWaferMaterial = (texture) => {
    // 确保贴图边缘不拉伸、色彩空间正确
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    return new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.3, metalness: 0.7,
      map: texture, emissiveMap: texture,
      emissive: 0xffffff, emissiveIntensity: 0.7,
      transparent: true, opacity: 0.95,
      side: THREE.FrontSide // 确保单面网格也能正反面渲染
    });
  };

  const matLeft = createWaferMaterial(texLeft);
  const matRightFront = createWaferMaterial(texRightTop);
  const matRightBack = createWaferMaterial(texRightBottom);

  // D. 处理 GLTF 模型
  const realModel = gltf.scene;
  realModel.scale.set(0.07, 0.07, 0.07);
  realModel.position.set(0, -1.5, 2.62);
  realModel.rotation.x = 1;
  modelGroup.position.set(0, 12, 0);
  modelGroup.add(realModel);

  let caseBottom = null;

  realModel.traverse((child) => {
    const name = child.name.toLowerCase();
    if (name.includes('case_lid') || name.includes('caselid')) { caseLid = child; }
    else if (name.includes('case_bottom') || name.includes('casebottom')) { caseBottom = child; }
    else if (child.name === 'Waferright') {
      earbudRight = child;
      // #63f382
      magicFollowLight = new THREE.PointLight(0x63f382, 365, 8);
      magicFollowLight.position.set(-1.56, 0.66, -0.29);
      child.add(magicFollowLight);
    }
    else if (child.name === 'Waferleft') { earbudLeft = child; }
  });

  realModel.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.roughness = 0.35; child.material.metalness = 0.6;
      child.material.envMap = currentEnvMap; child.material.envMapIntensity = 1.2;
      child.material.needsUpdate = true;
    }
  });

  if (caseLid) {
    caseLid.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.75, metalness: 0.15, transparent: true,
          opacity: 0.83, map: lidTexture, envMap: currentEnvMap, envMapIntensity: 1.2
        });
        mesh.castShadow = true; mesh.receiveShadow = true;
      }
    });
  }

  if (caseBottom) {
    caseBottom.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x00020d, roughness: 0.5, metalness: 0.2, envMap: currentEnvMap, envMapIntensity: 1.2
        });
        mesh.castShadow = true; mesh.receiveShadow = true;
      }
    });
  }

  // ==================================================
  // 🌟 E. 核心：左右晶圆专属材质分发
  // ==================================================

  // 1. 左晶圆：两面一致，无脑贴 matLeft
  if (earbudLeft) {
    earbudLeft.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.material = matLeft;
        mesh.castShadow = true; mesh.receiveShadow = true;
      }
    });
  }

  // 2. 右晶圆：智能区分正反面
  if (earbudRight) {
    earbudRight.traverse((mesh) => {
      if (mesh.isMesh) {
        console.log(mesh)
        const name = mesh.name.toLowerCase();

        // 策略一：如果建模师给正反面网格命名了，优先按名字分配
        if (name.includes('back') || name.includes('bottom')) {
          mesh.material = matRightBack;
        } else if (name.includes('front') || name.includes('top')) {
          mesh.material = matRightFront;
        }
        // 策略二：如果没命名，系统自动计算该网格的“Z轴物理重心”来判断正反面！
        else {
          mesh.geometry.computeBoundingBox();
          const centerZ = (mesh.geometry.boundingBox.max.z + mesh.geometry.boundingBox.min.z) / 2;

          // 💡 关键：通常 Z 轴较大的一侧是正面。
          // 如果你发现正面和背面的贴图贴反了，只需要把这里的大于号 > 改成小于号 < 即可。
          if (centerZ > 0) {
            mesh.material = matRightFront; // 正面贴图
          } else {
            mesh.material = matRightBack;  // 背面贴图
          }
        }

        mesh.castShadow = true; mesh.receiveShadow = true;
      }
    });
  }

  // D. 结构挂载 
  if (caseLid) { modelGroup.attach(caseLid); lidInitialRot = caseLid.rotation.x; }
  if (earbudLeft) modelGroup.attach(earbudLeft);
  if (earbudRight) modelGroup.attach(earbudRight);

  // 🌟 核心：通知系统资产准备就绪
  isAssetsLoaded = true;

}).catch(error => { console.error("加载错误:", error); });


// ==========================================
// 5. 用户交互时间轴 (ScrollTrigger) - 保持原样
// ==========================================
function initScrollTimeline() {

  // ==================================================
  // 🌟 全局 Guide-line SVG 自动初始化引擎
  // ==================================================
  document.querySelectorAll('.param').forEach(param => {
    // 1. 扫描线条并测量真实物理长度
    const path = param.querySelector('.guide-line path');
    if (path) {
      const length = path.getTotalLength();
      // 将间隙和偏移量设为全长，此时线条完全隐藏
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    }
    
    // 2. 将起止圆点缩放到 0，隐藏起来
    gsap.set(param.querySelectorAll('.guide-line circle'), { scale: 0, transformOrigin: 'center' });
    
    // 3. 隐藏文字，并根据是左侧还是右侧设置偏移方向，制造“向外推开”的张力
    const isLeft = param.classList.contains('left');
    gsap.set(param.querySelector('.param-text'), { opacity: 0, x: isLeft ? 20 : -20 });
  });

  // 🌟 定义复用连招：一键在特定阶段触发 4 步丝滑生长动画
  const buildGuideLineAnim = (tl, stageSelector, startLabel) => {
    // 满足你的需求：在阶段动作刚开始的 0.2 秒后立马触发！
    const startTime = `${startLabel}+=0.2`; 
    
    tl
      // Step 1: 靠晶圆的起点圆点 "啵" 地弹出
      .to(`${stageSelector} .param .guide-line circle:nth-of-type(1)`, { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.1 }, startTime)
      
      // Step 2: 线条顺着曲率飞速生长 (stagger可以确保如果同一阶段有多条线，它们会错开 0.1 秒依次生长，极其优雅)
      .to(`${stageSelector} .param .guide-line path`, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut', stagger: 0.1 }, startTime + "+=0.1")
      
      // Step 3: 靠文字的终点圆点弹出
      .to(`${stageSelector} .param .guide-line circle:nth-of-type(2)`, { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.1 }, startTime + "+=0.5")
      
      // Step 4: 文字从内向外顺势滑入并淡入
      .to(`${stageSelector} .param .param-text`, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, startTime + "+=1.4");
  };


  let leftMat, rightMat;
  if (earbudLeft) {
    earbudLeft.traverse((child) => { if (child.isMesh) leftMat = child.material; });
  }
  if (earbudRight) {
    earbudRight.traverse((child) => {
      if (child.isMesh) {
        if (!child.material.isCloned) { child.material = child.material.clone(); child.material.isCloned = true; }
        rightMat = child.material;
      }
    });
  }

  const circle = document.querySelector('.progress-ring__circle');
  const head = document.querySelector('.progress-ring__head');
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
      snap: { snapTo: "labels", delay: 0.1, ease: "power2.inOut", duration: { min: 0.2, max: 0.8 } },
      onUpdate: (self) => {
        if (!isAutoLooping) {
          const offset = circumference - self.progress * circumference;
          gsap.to(circle, { strokeDashoffset: offset, duration: 0.1, ease: "none" });
          gsap.to(bgScrollObj, { offset: self.progress * -Math.PI * 2, duration: 0.8, ease: "power2.out" });

          gsap.to(uiProgress, {
            val: self.progress, duration: 0.1, ease: "none",
            onUpdate: () => {
              const p = uiProgress.val;
              const angle = p * Math.PI * 2;
              if (head) {
                head.setAttribute('cx', 400 + radius * Math.cos(angle));
                head.setAttribute('cy', 400 + radius * Math.sin(angle));
              }
              const p100 = Math.max(p * 100, 0.01);
              const p40 = p100 * 0.4;
              if (conicBg) conicBg.style.background = `conic-gradient(from 90deg, rgba(2, 6, 17, 0) 0%, rgba(26, 85, 153, 0.5) ${p40}%, #41a5ff ${p100}%, transparent ${p100}%)`;
            }
          });
        }
        if (self.progress > 0.99 && !isAutoLooping) playCinematicLoop();
      }
    }
  });

  const w1Initial = { pos: earbudLeft.position.clone(), rot: earbudLeft.rotation.clone() };
  const w2Initial = { pos: earbudRight.position.clone(), rot: earbudRight.rotation.clone() };

  // ------------------------------------------
  // Stage 1: 预备动作 - 盒子微扭转 (提速压缩版)
  // ------------------------------------------
  tl.addLabel("stage1", 0);

  tl.to(".ui-stage-1", { opacity: 0, duration: 0.5 }, "stage1");

  // 1. 盒子微动：时长从 1.5 降到 1.0
  tl.to(modelGroup.position, { x: -1.2, y: -0.65, z: -0.16, duration: 1.0, ease: "power1.inOut" }, "stage1")
    .to(modelGroup.rotation, { x: -0.25159, y: 0.288407, z: 0.568407, duration: 1.0, ease: "power1.inOut" }, "stage1");

  // 2. 引力波网格(mesh)沉降：时长从 2.6 降到 1.5，并大幅提前触发时间
  tl.to(mesh.position, { y: -16, duration: 1.2, ease: "power1.inOut" }, "stage1+=0.2")
    .to(mesh.rotation, { x: -Math.PI / 2, y: Math.PI / 8, duration: 1.5, ease: "power1.inOut" }, "stage1+=0.2");

  // 3. 晶圆预备上浮：时长从 1.7 降到 1.0
  tl.to(earbudLeft.position, { y: w1Initial.pos.y + 0.5, z: w1Initial.pos.z + 1, duration: 1.0, ease: "power1.inOut" }, "stage1");


  // ------------------------------------------
  // Stage 2: 左晶圆主导升空，右晶圆跟随
  // ------------------------------------------
  tl.addLabel("stage2", 2.0);
  // 假设这是晶圆飞到位的节点，我们准备展示文案
  // 容器本身只控制基础显示
  tl.to(".ui-stage-2", { opacity: 1, duration: 0.4 }, "stage2");
  
  // 🔥 一键挂载动画！在 stage2 触发后 0.2s 自动生成所有 SVG 线条动画
  buildGuideLineAnim(tl, ".ui-stage-2", "stage2");

  tl.to(modelGroup.position, { x: -3.5, y: -8.5, z: 1.5, duration: 0.6, ease: "power2.out" }, "stage2")
    .to(modelGroup.rotation, { z: 0.2, duration: 0.6, ease: "power2.out" }, "stage2");

  tl.to(earbudLeft.position, { x: 1.4, y: w1Initial.pos.y + 7, z: w1Initial.pos.z + 8, duration: 0.9, ease: "power2.out" }, "stage2")
    .to(earbudLeft.rotation, { x: Math.PI, y: -Math.PI, z: 0.1, duration: 0.9, ease: "power2.out" }, "stage2");

  tl.to(earbudLeft.position, { x: 2, y: w1Initial.pos.y + 8.5, z: w1Initial.pos.z + 4, duration: 0.4, ease: "power2.out" }, "stage2+=0.9")

  tl.to(earbudLeft.position, { x: 0.62, y: 5.88, z: w1Initial.pos.z + 8.8, duration: 0.6, ease: "power2.out" }, "stage2+=1.3")
    .to(earbudLeft.rotation, { x: 2.70, y: -2.42159265358979, duration: 0.4, ease: "power2.out" }, "stage2+=1");

  tl.to(earbudRight.position, { x: 1.4, y: 5.42, z: w2Initial.pos.z + 8.8, duration: 1.6, ease: "power2.out" }, "stage2+=0.3")
    .to(earbudRight.rotation, {
      x: -0.181592653589793,
      y: 0.438407346410207 - Math.PI,
      z: 1.97840734641021,
      duration: 1.3,
      ease: "power2.out"
    }, "stage2+=0.6");

  // ------------------------------------------
  // Stage 3: 传感核心晶圆特写与矩阵排版
  // ------------------------------------------
  tl.addLabel("stage3", 4.0);
  tl.to(".ui-stage-2", { opacity: 0, duration: 0.4 }, "stage3");
  tl.set(".ui-stage-3", { opacity: 1 }, "stage3+=0.1");
  
  // 🔥 一键挂载动画！(只要 ui--stage3 内部有 .param 结构就会自动生效)
  buildGuideLineAnim(tl, ".ui-stage-3", "stage3");
  tl.fromTo([".stage3-title", ".callout"], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "stage3+=0.2");
  tl.fromTo(".spec-item", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.6, ease: "power2.out", stagger: 0.15 }, "stage3+=0.4");

  tl.to(earbudLeft.position, { x: 0.01, y: 6.07, z: w1Initial.pos.z + 6, duration: 1, ease: "power2.out" }, "stage3")
    .to(earbudLeft.rotation, { x: 0, y: 0.438, z: -0.2, duration: 1, ease: "power2.out" }, "stage3+=0.3");

  tl.to(earbudRight.position, { x: 3.0, y: 5.34, duration: 1, ease: "power2.out" }, "stage3")
    .to(earbudRight.rotation, { x: 2.13840734641021, y: -Math.PI, z: -0.931592653589, duration: 1, ease: "power2.out" }, "stage3+=0.3");

  tl.to(earbudLeft.position, { x: 0.98, y: 6.22, z: w1Initial.pos.z + 8, duration: 0.6, ease: "power2.out" }, "stage3+=1");
  tl.to(earbudRight.position, { x: 1.33, y: 5.34, z: w2Initial.pos.z + 8.9, duration: 0.4, ease: "power2.out" }, "stage3+=1");


  // ------------------------------------------
  // Stage 4: 晶圆横移换位与薄膜晶圆特写
  // ------------------------------------------
  tl.addLabel("stage4", 6.0);
  tl.to(".ui-stage-3", { opacity: 0, duration: 0.4 }, "stage4");

  tl.to(earbudLeft.position, { x: -0.32, z: w1Initial.pos.z + 6, duration: 0.5, ease: "power2.out" }, "stage4")
    // 🌟【优化 2】：删去了导致大陀螺的 Math.PI * 2，只留下 0.9 的精确角度。
    .to(earbudLeft.rotation, { x: 0, y: 0.9, z: 0, duration: 0.5, ease: "power2.out" }, "stage4");

  tl.to(earbudRight.position, { x: 2.5, duration: 0.4, ease: "power2.out" }, "stage4")
    .to(earbudRight.rotation, { z: -1.32159265358979, duration: 0.4, ease: "power2.out" }, "stage4+=0.1");

  tl.to(earbudLeft.position, { x: 0.68, y: 5.17, z: w1Initial.pos.z + 10.5, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.5")
    // 🌟【优化 3】：同样删去 Math.PI * 2
    .to(earbudLeft.rotation, { x: -0.12159, y: 0.5184, z: -0.411, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.5");

  tl.to(earbudRight.position, { x: 0.61, y: 5.93, z: w2Initial.pos.z + 8.6, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.7")
    .to(earbudRight.rotation, { y: -2.93, duration: 0.8, ease: "power2.inOut" }, "stage4+=0.7");

  tl.set(".ui-stage-4", { opacity: 1 }, "stage4+=0.4");
  
  // 🔥 一键挂载动画！
  buildGuideLineAnim(tl, ".ui-stage-4", "stage4");

  tl.fromTo([".stage4-title", ".ui-stage-4 .callout"],
    { opacity: 0, x: (i) => i === 0 ? -30 : 30 },
    { opacity: 1, x: 0, duration: 0.8, ease: "power2.out", stagger: 0.2 }, "stage4+=1.2");


  // ------------------------------------------
  // Stage 5: 无缝连续的分离与防穿模重构合体
  // ------------------------------------------
  // （此阶段的角度转换非常完美，且严格控制在 Math.PI 之内，无需修改，保持原状）
  tl.addLabel("stage5", 8.0);
  tl.to(".ui-stage-4", { opacity: 0, duration: 0.5 }, "stage5");
  const separationPosL = { x: -0.5, y: 5.97, z: 12.0 };
  const separationPosR = { x: 3.0, y: 5.97, z: 12.0 };
  const mergePosL = { x: 1.67 + 0.28, y: 5.97, z: 10.9 };
  const mergePosR = { x: 1.67, y: 5.97, z: 11 + 0.09 };
  const preMergePosL = { x: mergePosL.x - 1.5, y: mergePosL.y, z: mergePosL.z };
  const preMergePosR = { x: mergePosR.x + 1.5, y: mergePosR.y, z: mergePosR.z };

  tl.to(earbudLeft.position, { ...separationPosL, duration: 1.0, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudLeft.rotation, { x: Math.PI / 2, y: Math.PI, z: 0.1, duration: 1.0, ease: "power2.out" }, "stage5+=0.5");
  tl.to(earbudRight.position, { ...separationPosR, duration: 1.0, ease: "power2.out" }, "stage5+=0.5")
    .to(earbudRight.rotation, { x: Math.PI / 2, y: -Math.PI, z: 0.1, duration: 1.0, ease: "power2.out" }, "stage5+=0.5");

  tl.to(earbudLeft.position, { ...preMergePosL, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5")
    .to(earbudLeft.rotation, { x: 0, y: Math.PI / 2, z: 0.1, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5");
  tl.to(earbudRight.position, { ...preMergePosR, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5")
    .to(earbudRight.rotation, { x: Math.PI / 2, y: 0, z: 0.1, duration: 1.0, ease: "power2.inOut" }, "stage5+=1.5");

  tl.to(earbudLeft.position, { x: mergePosL.x, duration: 0.5, ease: "power3.in" }, "stage5+=2.5")
    .to(earbudRight.position, { x: mergePosR.x, duration: 0.5, ease: "power3.in" }, "stage5+=2.5");

  const mergeImpactTime = "stage5+=2.5";
  tl.to(leftMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 0.6, ease: "power2.out" }, mergeImpactTime);
  tl.to(rightMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 0.6, ease: "power2.out" }, mergeImpactTime);
  tl.to(rightMat.emissive, { r: 0, g: 0, b: 0, duration: 0.6, ease: "power2.out" }, mergeImpactTime);

  tl.to(sphericalGridGroup.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 1.5, ease: "power3.inOut" }, mergeImpactTime);
  tl.to(sphericalGridGroup.children[0].material, { duration: 1.5, ease: "power2.inOut" }, mergeImpactTime);


  // ------------------------------------------
  // Stage 6: 坠落归仓
  // ------------------------------------------
  tl.addLabel("stage6", 11.0);
  tl.to(leftMat.color, { r: 1, g: 1, b: 1, duration: 0.6 }, "stage6")
    .to(rightMat.color, { r: 1, g: 1, b: 1, duration: 0.6 }, "stage6");

  tl.to(earbudLeft.position, { x: mergePosL.x - 1.5, duration: 0.6, ease: "power2.out" }, "stage6+=0.2")
    .to(earbudRight.position, { x: mergePosR.x + 1.5, duration: 0.6, ease: "power2.out" }, "stage6+=0.2");

  const finalBoxPos = { x: 0, y: 1.6, z: 2.62 };
  const finalBoxRot = { x: 0.3, y: 0, z: 0 };
  const boxUpStart = "stage6+=1.0";

  tl.to(modelGroup.position, { ...finalBoxPos, duration: 1.2, ease: "power2.inOut" }, boxUpStart)
    .to(modelGroup.rotation, { ...finalBoxRot, duration: 1.2, ease: "power2.inOut" }, boxUpStart);

  const fallStart = "stage6+=0.6";
  const fallActionTime = 1.6;

  tl.to(earbudLeft.position, {
    x: w1Initial.pos.x, y: w1Initial.pos.y, z: w1Initial.pos.z, duration: fallActionTime, ease: "power2.in"
  }, fallStart)
    .to(earbudRight.position, {
      x: w2Initial.pos.x, y: w2Initial.pos.y, z: w2Initial.pos.z, duration: fallActionTime, ease: "power2.in"
    }, fallStart);

  // 🌟【优化 4】：原先使用 Math.PI 导致在最后归仓“回正”时，因为角度差过大
  // 会产生一个高达 270 度的“反抽陀螺”效果。
  // 我们将空翻滚转角限制在 Math.PI / 2 (90度)。
  // 这既保留了下坠时重心翻转的自然感，又彻底消灭了入仓前的鬼畜旋转！
  tl.to(earbudLeft.rotation, { y: "+=" + (Math.PI / 2), duration: 1.0, ease: "power1.inOut" }, fallStart)
    .to(earbudRight.rotation, { y: "-=" + (Math.PI / 2), duration: 1.0, ease: "power1.inOut" }, fallStart);

  tl.to(earbudLeft.rotation, {
    x: w1Initial.rot.x, y: w1Initial.rot.y, z: w1Initial.rot.z, duration: 0.6, ease: "back.out(1.2)"
  }, "stage6+=1.6")
    .to(earbudRight.rotation, {
      x: w2Initial.rot.x, y: w2Initial.rot.y, z: w2Initial.rot.z, duration: 0.6, ease: "back.out(1.2)"
    }, "stage6+=1.6");

  const lidClosureTime = "stage6+=2.2";
  tl.to(caseLid.rotation, { x: lidInitialRot, duration: 0.6, ease: "bounce.out" }, lidClosureTime);

  tl.fromTo(".ui-stage-1",
    { opacity: 0, filter: 'blur(10px)', scale: 1.1 },
    { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 1.2, ease: "power2.out" },
    "stage6+=2.4"
  );

  tl.addLabel("stage6_end", 14.6);

  function playCinematicLoop() {
    isAutoLooping = true;
    const st = ScrollTrigger.getById("mainScroll");
    if (st) st.disable(false);

    const circleEl = document.querySelector('.progress-ring__circle');
    const radius = circleEl.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;

    const loopTl = gsap.timeline({
      onComplete: () => {
        window.scrollTo(0, 0);
        tl.progress(0);
        if (st) { st.enable(); st.update(); }
        isAutoLooping = false;
      }
    });

    loopTl.to(circleEl, { strokeDashoffset: -circumference, duration: 1.5, ease: "power2.inOut" }, 0);

    const dummyObj = { p: 1 };
    loopTl.to(dummyObj, {
      p: 2, duration: 1.5, ease: "power2.inOut",
      onUpdate: () => {
        const angle = dummyObj.p * Math.PI * 2;
        if (head) {
          head.setAttribute('cx', 400 + radius * Math.cos(angle));
          head.setAttribute('cy', 400 + radius * Math.sin(angle));
        }
      }
    }, 0);

    loopTl.to(modelGroup.position, { x: 0, y: 0, z: 0, duration: 0.8, ease: "power3.in" }, 0)
      .to(modelGroup.rotation, { x: 0, y: 0, z: 0, duration: 0.8, ease: "power3.in" }, 0);
    loopTl.to(modelGroup.position, { y: -0.4, duration: 0.15, yoyo: true, repeat: 1 }, 0.8);

    loopTl.add(() => {
      const vid = document.getElementById('shockwaveVideo');
      if (vid) { vid.currentTime = 0; vid.play().catch(e => console.warn(e)); }
    }, 0.65);

    loopTl.to('#shockwaveVideo', { opacity: 1, duration: 0.2 }, 0.65)
      .to('#shockwaveVideo', { opacity: 0, duration: 1.0 }, 0.9);
    loopTl.to(caseLid.rotation, { x: lidInitialRot - Math.PI / 2, duration: 1.2, ease: "power2.out" }, 0.9);
  }
}

// ==========================================
// 6. 渲染循环与功能函数
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  const time = performance.now() * 0.0001;
  time_bg += 0.016;

  mouseState.currentX += (mouseState.targetX - mouseState.currentX) * 0.05;
  mouseState.currentY += (mouseState.targetY - mouseState.currentY) * 0.05;

  particlesGroup.children.forEach(child => {
    if (child.material && child.material.uniforms && child.material.uniforms.uTime && child.isMesh) {
      child.material.uniforms.uTime.value = time_bg;
    }
  });

  if (sandParticles && sandParticles.material.uniforms) {
    sandParticles.material.uniforms.uTime.value = time_bg;
    sandParticles.material.uniforms.uMouseX.value = mouseState.currentX;
    sandParticles.material.uniforms.uMouseY.value = mouseState.currentY;
  }

  if (typeof sphericalGridGroup !== 'undefined' && sphericalGridGroup) {
    sphericalGridGroup.rotation.y = (time * 1) + bgScrollObj.offset;
    sphericalGridGroup.position.y = Math.sin(time * 2) * 15;
  }

  if (controls3D) controls3D.update();
  renderer3D.render(scene3D, camera3D);
}
animate();

window.addEventListener('mousemove', (event) => {
  mouseState.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
  mouseState.targetY = -(event.clientY / window.innerHeight - 0.5) * 2;
});

function triggerShootingStar() {
  if (meteorMeshes.length === 0) return;

  const startX = -70; const endX = 80;
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
        x: endX + offsetX, y: groupBaseY + offsetY - (individualDuration * 5),
        duration: individualDuration, ease: "linear"
      }, 0)
      .to(mesh.material, { opacity: 1, duration: individualDuration * 0.2 }, 0)
      .to(mesh.material, { opacity: 0, duration: individualDuration * 0.2 }, `-=${individualDuration * 0.2}`);
  });
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer3D.setSize(w, h);
  camera3D.aspect = w / h;
  camera3D.updateProjectionMatrix();
  if (window.gridLineMat) window.gridLineMat.resolution.set(w, h);
});

// ==========================================
// 调试工具：Figma 视觉还原面板
// ==========================================
function setupDebugGUI() {
  const gui = new GUI({ title: '🎬 动画关键帧调试' });

  const groupFolder = gui.addFolder('📦 模型总组 (modelGroup)');
  groupFolder.add(modelGroup.position, 'x', -10, 10, 0.01).name('Pos X');
  groupFolder.add(modelGroup.position, 'y', -10, 10, 0.01).name('Pos Y');
  groupFolder.add(modelGroup.position, 'z', -20, 20, 0.01).name('Pos Z');
  groupFolder.add(modelGroup.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X');
  groupFolder.add(modelGroup.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y');
  groupFolder.add(modelGroup.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z');

  if (earbudLeft) {
    const leftFolder = gui.addFolder('🎧 左晶圆 (earbudLeft)');
    leftFolder.add(earbudLeft.position, 'x', -10, 10, 0.01).name('Pos X');
    leftFolder.add(earbudLeft.position, 'y', -10, 10, 0.01).name('Pos Y');
    leftFolder.add(earbudLeft.position, 'z', -10, 10, 0.01).name('Pos Z');
    leftFolder.add(earbudLeft.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X');
    leftFolder.add(earbudLeft.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y');
    leftFolder.add(earbudLeft.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z');
  }

  if (earbudRight) {
    const rightFolder = gui.addFolder('🎧 右晶圆 (earbudRight)');
    rightFolder.add(earbudRight.position, 'x', -10, 10, 0.01).name('Pos X');
    rightFolder.add(earbudRight.position, 'y', -10, 10, 0.01).name('Pos Y');
    rightFolder.add(earbudRight.position, 'z', -10, 10, 0.01).name('Pos Z');
    rightFolder.add(earbudRight.rotation, 'x', -Math.PI, Math.PI, 0.01).name('Rot X');
    rightFolder.add(earbudRight.rotation, 'y', -Math.PI, Math.PI, 0.01).name('Rot Y');
    rightFolder.add(earbudRight.rotation, 'z', -Math.PI, Math.PI, 0.01).name('Rot Z');
  }

  let targetMat = null;
  if (earbudRight) {
    earbudRight.traverse((child) => { if (child.isMesh) targetMat = child.material; });
  }

  if (magicFollowLight && targetMat) {
    const debugFolder = gui.addFolder('晶圆特写光影调试');
    debugFolder.add(magicFollowLight.position, 'x', -10, 10).name('灯光左右(X)');
    debugFolder.add(magicFollowLight.position, 'y', -10, 10).name('灯光上下(Y)');
    debugFolder.add(magicFollowLight.position, 'z', -5, 5).name('灯光前后(Z)');
    debugFolder.add(magicFollowLight, 'intensity', 0, 500).name('灯光亮度');
    debugFolder.add(targetMat, 'roughness', 0, 1).name('表面粗糙度');
  }

  // ==========================================
  // 💡 影视级灯光系统调试面板
  // ==========================================
  // const lightFolder = gui.addFolder('💡 影视级灯光系统');

  // // 1. 全局环境光 (Ambient)
  // const ambientFolder = lightFolder.addFolder('全局环境光 (Ambient)');
  // ambientFolder.add(ambientLight, 'intensity', 0, 3, 0.01).name('光强 (Intensity)');
  // ambientFolder.addColor({ color: ambientLight.color.getHex() }, 'color').name('颜色').onChange(v => ambientLight.color.setHex(v));

  // // 2. 主光源 (Directional)
  // const dirFolder = lightFolder.addFolder('主光源 (Directional)');
  // dirFolder.add(directionalLight, 'intensity', 0, 5, 0.01).name('光强');
  // dirFolder.add(directionalLight.position, 'x', -10, 10, 0.1).name('Pos X');
  // dirFolder.add(directionalLight.position, 'y', -10, 10, 0.1).name('Pos Y');
  // dirFolder.add(directionalLight.position, 'z', -10, 10, 0.1).name('Pos Z');
  // dirFolder.addColor({ color: directionalLight.color.getHex() }, 'color').name('颜色').onChange(v => directionalLight.color.setHex(v));

  // // 3. 背光/暖光 (Back)
  // const backFolder = lightFolder.addFolder('背光 (暖橘色)');
  // backFolder.add(backLight, 'intensity', 0, 5, 0.01).name('光强');
  // backFolder.add(backLight.position, 'x', -10, 10, 0.1).name('Pos X');
  // backFolder.add(backLight.position, 'y', -10, 10, 0.1).name('Pos Y');
  // backFolder.add(backLight.position, 'z', -10, 10, 0.1).name('Pos Z');
  // backFolder.addColor({ color: backLight.color.getHex() }, 'color').name('颜色').onChange(v => backLight.color.setHex(v));

  // // 4. 填充光/冷光 (Fill)
  // const fillFolder = lightFolder.addFolder('填充光 (冷蓝色)');
  // fillFolder.add(fillLight, 'intensity', 0, 5, 0.01).name('光强');
  // fillFolder.add(fillLight.position, 'x', -10, 10, 0.1).name('Pos X');
  // fillFolder.add(fillLight.position, 'y', -10, 10, 0.1).name('Pos Y');
  // fillFolder.add(fillLight.position, 'z', -10, 10, 0.1).name('Pos Z');
  // fillFolder.addColor({ color: fillLight.color.getHex() }, 'color').name('颜色').onChange(v => fillLight.color.setHex(v));

  // // 5. 底部轮廓光 (Rim)
  // const rimFolder = lightFolder.addFolder('底部轮廓光 (Rim)');
  // rimFolder.add(rimLight, 'intensity', 0, 5, 0.01).name('光强');
  // rimFolder.add(rimLight.position, 'x', -10, 10, 0.1).name('Pos X');
  // rimFolder.add(rimLight.position, 'y', -10, 10, 0.1).name('Pos Y');
  // rimFolder.add(rimLight.position, 'z', -10, 10, 0.1).name('Pos Z');
  // rimFolder.addColor({ color: rimLight.color.getHex() }, 'color').name('颜色').onChange(v => rimLight.color.setHex(v));

  // // 6. 半球漫反射光 (Hemisphere)
  // const hemiFolder = lightFolder.addFolder('半球漫反射光 (Hemisphere)');
  // hemiFolder.add(hemiLight, 'intensity', 0, 3, 0.01).name('光强');
  // hemiFolder.addColor({ color: hemiLight.color.getHex() }, 'color').name('天空颜色 (Sky)').onChange(v => hemiLight.color.setHex(v));
  // hemiFolder.addColor({ color: hemiLight.groundColor.getHex() }, 'color').name('地面颜色 (Ground)').onChange(v => hemiLight.groundColor.setHex(v));

  // // 默认把灯光文件夹收起，保持面板整洁
  // lightFolder.close();

  // ==========================================
  // 🎨 贴纸/贴图细节微调面板
  // ==========================================
  // 假设 targetMat 是我们在前面遍历时提取到的材质
  if (targetMat && targetMat.map) {
    const texFolder = gui.addFolder('🎨 贴纸 UV 微调 (正面)');
    
    // ⚠️ 极其关键：先把操作中心点设置到图片的绝对正中心！
    targetMat.map.center.set(0.5, 0.5); 
    // 发光贴图也要同步设置，不然亮光和底图就错位了
    if(targetMat.emissiveMap) targetMat.emissiveMap.center.set(0.5, 0.5);

    // 1. 缩放控制 (0.5 到 2.0)
    // 注意：用 onChange 确保底图(map)和发光图(emissiveMap)同步缩放
    texFolder.add({ scale: 1 }, 'scale', 0.5, 2.0).name('缩放大小').onChange(v => {
      targetMat.map.repeat.set(v, v);
      if(targetMat.emissiveMap) targetMat.emissiveMap.repeat.set(v, v);
    });

    // 2. 偏移控制 (X 和 Y)
    texFolder.add(targetMat.map.offset, 'x', -0.5, 0.5, 0.01).name('左右平移 (X)').onChange(v => {
      if(targetMat.emissiveMap) targetMat.emissiveMap.offset.x = v;
    });
    texFolder.add(targetMat.map.offset, 'y', -0.5, 0.5, 0.01).name('上下平移 (Y)').onChange(v => {
      if(targetMat.emissiveMap) targetMat.emissiveMap.offset.y = v;
    });

    // 3. 旋转控制 (-180度 到 180度)
    texFolder.add({ rot: 0 }, 'rot', -Math.PI, Math.PI, 0.01).name('旋转角度').onChange(v => {
      targetMat.map.rotation = v;
      if(targetMat.emissiveMap) targetMat.emissiveMap.rotation = v;
    });
  }

  gui.close();
}