import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initGlobalNav } from './nav.js';
import Waves from './Waves.js'; // 🌟 引入你的波纹类
import GUI from 'lil-gui';

// 🌟 引入 HDR 环境贴图加载器
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

// 引入 Three.js 官方的粗线 (Fat Lines) 扩展模块
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { Line2 } from 'three/addons/lines/Line2.js'; // 🌟 新增 Line2 引入
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'; // 🌟 新增 GPGPU 渲染器

gsap.registerPlugin(ScrollTrigger);

initGlobalNav();

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
let circlesSystem; // 🌟 替换流星雨的发光虚线系统
let waveSystem;
let globalClock = new THREE.Clock();

const parallaxGroup = new THREE.Group();
scene3D.add(parallaxGroup); // 视差组挂载到场景

const modelGroup = new THREE.Group();
parallaxGroup.add(modelGroup); // 将 modelGroup 装入视差组，完美避开 GSAP 冲突！

let innerWaferL, innerWaferR;  // 内部真实的网格，专用于物理浮动
const floatState = { val: 0 }; // 浮动强度控制器，0=静止，1=最大浮动
let caseLid, earbudLeft, earbudRight;
let magicFollowLight;
let lidInitialRot = 0;
let mesh;

// ==========================================
// 🌟 3D 空间到 2D 屏幕的投影追踪系统
// ==========================================
const projectedPosition = new THREE.Vector3();

// 追踪点配置矩阵
// 注：meshRef 使用函数返回，是因为在初始化阶段 earbudLeft 等变量还未加载完毕
const trackingPoints = [
  // Stage 2 追踪点
  {
    elementId: '.ui-stage-2 .param.left',
    meshRef: () => innerWaferL,
    localPos: new THREE.Vector3(-1.0, 0.5, 0),
    isLeftUI: true
  },
  {
    elementId: '.ui-stage-2 .param.right',
    meshRef: () => innerWaferR,
    localPos: new THREE.Vector3(1.0, 0.5, 0)
  },
  // Stage 3 追踪点 (特写阶段)
  {
    elementId: '.ui-stage-3 .callout-bl',
    meshRef: () => innerWaferR,
    localPos: new THREE.Vector3(-1.2, 0, 0)
  },
  {
    elementId: '.ui-stage-3 .callout-tr',
    meshRef: () => innerWaferR,
    localPos: new THREE.Vector3(1.2, 0, 0)
  },
  // Stage 4 追踪点
  {
    elementId: '.ui-stage-4 .callout-s4-br',
    meshRef: () => innerWaferL,
    localPos: new THREE.Vector3(0, -1.0, 0)
  },
  {
    elementId: '.ui-stage-4 .callout-s4-tr',
    meshRef: () => innerWaferL,
    localPos: new THREE.Vector3(0, 1.0, 0)
  }
];

// 初始化 DOM 元素引用 (在加载完成后调用)
function initTrackingElements() {
  trackingPoints.forEach(point => {
    point.domElement = document.querySelector(point.elementId);
  });
}

// Shader 背景特效专用变量
let time_bg = 0;
const mouseState = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };

// 🌟【新增核心状态】：资源是否加载完成的标识
let isAssetsLoaded = false;

// ==========================================
// 1.2 灯光系统 (影视级三点布光 + 氛围光)
// ==========================================
// 1. 环境光 - 提供基础照明，避免死黑
const ambientLight = new THREE.AmbientLight(0x354766, 0.5); // 💡 原调试代码设为0，这里给0.5保留基础暗部细节
scene3D.add(ambientLight);

// 2. 左侧暖光（主光之一）- 营造温暖质感
const leftMainLight = new THREE.PointLight(0xebf6fc, 2); // 💡 开启亮度
leftMainLight.position.set(-4, 2.5, 3);
leftMainLight.castShadow = true;
leftMainLight.shadow.mapSize.width = 1024;
leftMainLight.shadow.mapSize.height = 1024;
leftMainLight.shadow.bias = -0.0001;
scene3D.add(leftMainLight);

// 3. 右侧冷光（主光之二）- 营造科技冷感
const rightMainLight = new THREE.PointLight(0xebf6fc, 2); // 💡 开启亮度
rightMainLight.position.set(4, 2.5, 3);
rightMainLight.castShadow = true;
rightMainLight.shadow.mapSize.width = 1024;
rightMainLight.shadow.mapSize.height = 1024;
rightMainLight.shadow.bias = -0.0001;
scene3D.add(rightMainLight);

// 4. 背光暖色（轮廓光）
const backRimLight = new THREE.PointLight(0xffaa55, 1);
backRimLight.position.set(0, 1.5, -5);
scene3D.add(backRimLight);

// 5. 顶部补光
const topFillLight = new THREE.PointLight(0x88aaff, 1.5);
topFillLight.position.set(0, 5, 2);
scene3D.add(topFillLight);

// 6. 底部柔光
const bottomFillLight = new THREE.PointLight(0x5588aa, 0.5);
bottomFillLight.position.set(0, -3, 1);
scene3D.add(bottomFillLight);

// 7. 动态跟随光源
magicFollowLight = new THREE.PointLight(0xffaa88, 0); // 暂不开启，留作备用
magicFollowLight.position.set(0, 2, 3);
scene3D.add(magicFollowLight);

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
// 1.4 深空几何引力波与智能粒子 frist_try::#505c61 second_try:: #213245
// ==========================================
let particlesGroup = new THREE.Group();
particlesGroup.visible = false;
particlesGroup.position.z = -20;
scene3D.add(particlesGroup);

// 生成一张程序化噪点贴图 (代替外部加载，不会跨域报错)
function createNoiseTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size * 4; i += 4) {
    const val = Math.random() * 255;
    data[i] = val; data[i + 1] = val; data[i + 2] = val; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

// 🌟 初始化波纹系统
const noiseTex = createNoiseTexture();
waveSystem = new Waves(noiseTex);
waveSystem.instance.scale.set(1.5, 1.5, 1.5);
waveSystem.instance.position.set(0, -8, 0);
waveSystem.instance.rotation.set(
  Math.PI / 2,  // X轴旋转 (点头)
  0,  // Y轴旋转 (摇头)
  0   // Z轴旋转 (侧倾)
);
waveSystem.instance.visible = false; // 先隐藏
scene3D.add(waveSystem.instance);

// ==========================================
// 🌟 替换为 GPGPU Simplex Particles 系统
// ==========================================
const simplexChunk = `
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }
    float permute(float x) { return mod289(((x*34.0)+10.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec4 grad4(float j, vec4 ip) {
        const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
        vec4 p,s;
        p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
        p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
        s = vec4(lessThan(p, vec4(0.0)));
        p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;
        return p;
    }
    float simplexNoise4d(vec4 v) {
        const vec4  C = vec4( 0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
        vec4 i  = floor(v + dot(v, vec4(0.309016994374947)) );
        vec4 x0 = v -   i + dot(i, C.xxxx);
        vec4 i0;
        vec3 isX = step( x0.yzw, x0.xxx );
        vec3 isYZ = step( x0.zww, x0.yyz );
        i0.x = isX.x + isX.y + isX.z;
        i0.yzw = 1.0 - isX;
        i0.y += isYZ.x + isYZ.y;
        i0.zw += 1.0 - isYZ.xy;
        i0.z += isYZ.z;
        i0.w += 1.0 - isYZ.z;
        vec4 i3 = clamp( i0, 0.0, 1.0 );
        vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
        vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );
        vec4 x1 = x0 - i1 + C.xxxx;
        vec4 x2 = x0 - i2 + C.yyyy;
        vec4 x3 = x0 - i3 + C.zzzz;
        vec4 x4 = x0 + C.wwww;
        i = mod289(i);
        float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
        vec4 j1 = permute( permute( permute( permute ( i.w + vec4(i1.w, i2.w, i3.w, 1.0 )) + i.z + vec4(i1.z, i2.z, i3.z, 1.0 )) + i.y + vec4(i1.y, i2.y, i3.y, 1.0 )) + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
        vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;
        vec4 p0 = grad4(j0,   ip);
        vec4 p1 = grad4(j1.x, ip);
        vec4 p2 = grad4(j1.y, ip);
        vec4 p3 = grad4(j1.z, ip);
        vec4 p4 = grad4(j1.w, ip);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w; p4 *= taylorInvSqrt(dot(p4,p4));
        vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
        vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
        m0 = m0 * m0; m1 = m1 * m1;
        return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 ))) + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;
    }
`;

// 构建与 main.js 匹配的模拟运行上下文
const glMock = {
  renderer: { instance: renderer3D },
  sizes: { width: window.innerWidth, height: window.innerHeight, pixelRatio: renderer3D.getPixelRatio() },
  time: { delta: 16 },
  audio: { frequencies: { synthLoop: { current: 0 } } }
};

class GPGPUParticles {
  constructor() {
    this.gl = glMock;
    this.instance = new THREE.Group();
    this.settings = { scale: 0.5 };
    this.globalSpeed = 0.01;

    this.baseGeometry = {};
    this.baseGeometry.instance = new THREE.TorusGeometry(12, this.settings.scale, 64, 10); // 放大尺寸以匹配深空背景
    this.baseGeometry.count = this.baseGeometry.instance.attributes.position.count;

    this.gpgpu = {};
    this.gpgpu.size = Math.ceil(Math.sqrt(this.baseGeometry.count));
    this.gpgpu.computation = new GPUComputationRenderer(this.gpgpu.size, this.gpgpu.size, this.gl.renderer.instance);
    this.baseParticlesTexture = this.gpgpu.computation.createTexture();

    for (let i = 0; i < this.baseGeometry.count; i++) {
      this.baseParticlesTexture.image.data[i * 4 + 0] = this.baseGeometry.instance.attributes.position.array[i * 3 + 0] + (2 * Math.random() - 1) * this.settings.scale;
      this.baseParticlesTexture.image.data[i * 4 + 1] = this.baseGeometry.instance.attributes.position.array[i * 3 + 1] + (2 * Math.random() - 1) * this.settings.scale;
      this.baseParticlesTexture.image.data[i * 4 + 2] = this.baseGeometry.instance.attributes.position.array[i * 3 + 2] + (2 * Math.random() - 1) * this.settings.scale;
      this.baseParticlesTexture.image.data[i * 4 + 3] = Math.random();
    }

    this.shader = `
            ${simplexChunk}
            uniform float uTime;
            uniform float uTransition;
            uniform float uDeltaTime;
            uniform float uFrequency;
            uniform sampler2D uBasePositions;
            const float FLOWFIELD_SIZE = .25;
            const float FLOWFIELD_STRENGTH = 5.;

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 particleTexture = texture2D(uParticles, uv);
                vec4 basePositionTexture = texture2D(uBasePositions, uv);

                if (particleTexture.a >= 1.0) {
                    particleTexture.a = fract(particleTexture.a);
                    particleTexture.xyz = basePositionTexture.xyz;
                } else {
                    vec3 flowField = vec3(
                        simplexNoise4d(vec4(particleTexture.xyz * FLOWFIELD_SIZE + 0.0, uTime * 0.25)),
                        simplexNoise4d(vec4(particleTexture.xyz * FLOWFIELD_SIZE + 1.0, uTime * 0.25)),
                        simplexNoise4d(vec4(particleTexture.xyz * FLOWFIELD_SIZE + 2.0, uTime * 0.25))
                    );

                    flowField = normalize(flowField);
                    particleTexture.xyz += flowField * (FLOWFIELD_STRENGTH + (1.0 - uTransition) * 10.) * uDeltaTime;
                    particleTexture.a += uDeltaTime;
                }
                gl_FragColor = mix(particleTexture, basePositionTexture, pow(uFrequency * 15., 3.0));
            }
        `;

    this.gpgpu.particlesVariable = this.gpgpu.computation.addVariable('uParticles', this.shader, this.baseParticlesTexture);
    this.gpgpu.computation.setVariableDependencies(this.gpgpu.particlesVariable, [this.gpgpu.particlesVariable]);
    this.gpgpu.particlesVariable.material.uniforms.uTime = new THREE.Uniform(0.0);
    this.gpgpu.particlesVariable.material.uniforms.uDeltaTime = new THREE.Uniform(0.0);
    this.gpgpu.particlesVariable.material.uniforms.uBasePositions = new THREE.Uniform(this.baseParticlesTexture);
    this.gpgpu.particlesVariable.material.uniforms.uTransition = new THREE.Uniform(0.0);
    this.gpgpu.particlesVariable.material.uniforms.uFrequency = new THREE.Uniform(0.0);
    this.gpgpu.computation.init();

    this.particles = {};
    this.particlesUvArray = new Float32Array(this.baseGeometry.count * 2);
    this.randomArray = new Float32Array(this.baseGeometry.count);

    for (let y = 0; y < this.gpgpu.size; y++) {
      for (let x = 0; x < this.gpgpu.size; x++) {
        const i = y * this.gpgpu.size + x;
        const i2 = i * 2;
        this.particlesUvArray[i2 + 0] = (x + 0.5) / this.gpgpu.size;
        this.particlesUvArray[i2 + 1] = (y + 0.5) / this.gpgpu.size;
        this.randomArray[i] = Math.random();
      }
    }

    this.particles.geometry = new THREE.BufferGeometry();
    this.particles.geometry.setDrawRange(0, this.baseGeometry.count);
    this.particles.geometry.setAttribute('aParticlesUv', new THREE.BufferAttribute(this.particlesUvArray, 2));
    this.particles.geometry.setAttribute('aRandom', new THREE.BufferAttribute(this.randomArray, 1));

    this.particles.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uSize: new THREE.Uniform(0.115),
        uResolution: new THREE.Uniform(new THREE.Vector2(this.gl.sizes.width * this.gl.sizes.pixelRatio, this.gl.sizes.height * this.gl.sizes.pixelRatio)),
        uParticlesTexture: new THREE.Uniform(null),
        uProgress: new THREE.Uniform(1),
        uTransition: new THREE.Uniform(0.0),
        uCircleSize: new THREE.Uniform(0.025),
        uBokeh: new THREE.Uniform(0.0),
        uFocusDistance: new THREE.Uniform(7.5),
        uFocusRange: new THREE.Uniform(0.25),
        uCloseUpBokeh: new THREE.Uniform(0.0),
        COLOR_HIGHLIGHT: new THREE.Uniform(new THREE.Color(0xb2e0ff)),
      },
      vertexShader: `
                uniform vec2 uResolution;
                uniform float uSize;
                uniform sampler2D uParticlesTexture;
                uniform float uProgress;
                uniform float uTransition;
                uniform float uFocusDistance;
                uniform float uFocusRange;
                uniform float uCloseUpBokeh;
                attribute vec2 aParticlesUv;
                attribute float aRandom;
                
                varying vec4 vColor;
                varying vec2 vParticlesUv;
                varying float vLifeSize;
                varying float vDepth;

                void main() {
                    vec4 particle = texture2D(uParticlesTexture, aParticlesUv);
                    particle.z += 15.0 * smoothstep(0.9, 1.0, aRandom) * smoothstep(0.0, 0.3, uProgress);
                    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectedPosition = projectionMatrix * viewPosition;
                    gl_Position = projectedPosition;

                    float lifeIn = smoothstep(0.0, 0.1, particle.a);
                    float lifeOut = 1.0 - smoothstep(0.9, 1.0, particle.a);
                    float lifeSize = min(lifeIn, lifeOut) * smoothstep(0.2, 1.0, uTransition);
                
                    gl_PointSize = aRandom * lifeSize * uSize * uResolution.y;
                    vColor = vec4(vec3(1.0), particle.a);
                    vParticlesUv = aParticlesUv;
                    vLifeSize = lifeSize;
                    vDepth = pow(min(abs((uFocusDistance + viewPosition.z - uCloseUpBokeh * 5.0) * uFocusRange), 1.0), 2.0);
                }
            `,
      fragmentShader: `
                varying vec4 vColor;
                varying vec2 vParticlesUv;
                varying float vLifeSize;
                varying float vDepth;
                uniform sampler2D uParticlesTexture;
                uniform float uCircleSize;
                uniform float uBokeh;
                uniform float uCloseUpBokeh;
                uniform float uTransition;
                uniform vec3 COLOR_HIGHLIGHT;

                void main() {
                    vec4 particle = texture2D(uParticlesTexture, vParticlesUv);
                    float distanceToCenter = length(gl_PointCoord - 0.5);
                    if(distanceToCenter > 0.5) discard;

                    float mask = 1.0 - distance(distanceToCenter, 0.25 / 8.0) * 8.0;
                    mask = smoothstep(1.0 - uCircleSize - pow(uBokeh, 2.0) * 8.0 * vDepth, 1.0, mask);
                    vec4 color = vec4(COLOR_HIGHLIGHT, max(mask, 0.25 * step(distanceToCenter, 0.25 / 8.0)) * vLifeSize);
                    color.a -= (pow(uBokeh, 0.5) * (0.75 + vDepth * 0.25));
                    color.a = max(color.a, 0.0);

                    gl_FragColor = color;
                }
            `,
    });

    this.particles.material.depthWrite = false;
    this.mesh = new THREE.Points(this.particles.geometry, this.particles.material);
    this.mesh.rotation.x = -Math.PI * 0.425;
    this.mesh.position.set(0, 0, 0);
    this.mesh.renderOrder = 2;
    this.instance.add(this.mesh);
  }

  triggerWave(_direction = 1, _duration = 4.1, _ease = 'power2.inOut', _animateStrength = true, _delay = 0) {
    if (_direction === 1) {
      gsap.fromTo(this.mesh.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, delay: _delay, duration: _duration, ease: _ease });
      gsap.fromTo(this.particles.material.uniforms.uTransition, { value: 0.0 }, { value: 1.0, delay: _delay, duration: _duration, ease: _ease });
      if (_animateStrength) {
        gsap.fromTo(this.gpgpu.particlesVariable.material.uniforms.uTransition, { value: 0.0 }, { value: 1.0, delay: _delay, duration: _duration, ease: _ease });
      }
    } else {
      gsap.fromTo(this.mesh.scale, { x: 1, y: 1, z: 1 }, { x: 0.1, y: 0.1, z: 0.1, duration: 2.75, ease: 'expo.inOut' });
      gsap.fromTo(this.particles.material.uniforms.uTransition, { value: 1.0 }, { value: 0, duration: 2.75, ease: 'expo.inOut' });
      if (_animateStrength) {
        gsap.fromTo(this.gpgpu.particlesVariable.material.uniforms.uTransition, { value: 1.0 }, { value: 0.0, duration: 2.75, ease: 'expo.inOut' });
      }
    }
  }

  resize() {
    this.particles.material.uniforms.uResolution.value.set(this.gl.sizes.width * this.gl.sizes.pixelRatio, this.gl.sizes.height * this.gl.sizes.pixelRatio);
  }

  update(deltaMs) {
    this.gl.time.delta = deltaMs;
    this.gpgpu.particlesVariable.material.uniforms.uTime.value += (this.gl.time.delta * 0.0125 - this.gl.audio.frequencies.synthLoop.current * this.gl.time.delta * 0.0005) * (0.25 + this.globalSpeed * 0.75);
    this.gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = this.gl.time.delta * 0.001 * (0.25 + this.globalSpeed * 0.75);
    this.gpgpu.computation.compute();
    this.particles.material.uniforms.uParticlesTexture.value = this.gpgpu.computation.getCurrentRenderTarget(this.gpgpu.particlesVariable).texture;
    this.mesh.rotation.z += this.gl.time.delta * 0.00075 * this.globalSpeed;
  }
}

let sandParticlesSystem = new GPGPUParticles();
particlesGroup.add(sandParticlesSystem.instance);

// 提前触发展开动画使其待命
sandParticlesSystem.triggerWave(1, 3);

// ==========================================
// 1.5 发光虚线特效系统 (替换原流星雨)
// ==========================================
class Circles {
  constructor() {
    this.count = 6;
    this.curve = new THREE.EllipseCurve(0, 0, 1, 1, 0, 4 * Math.PI, false, 0);
    this.points = this.curve.getPoints(100);
    this.setMaterial();
    this.setInstances();
  }

  setInstances() {
    this.instances = new THREE.Group();
    for (let i = 0; i < this.count; i++) {
      this.instances.add(new Line2(this.createGeometry(), this.material));
    }
    this.instances.children.forEach((_instance, _index) => {
      _instance.computeLineDistances();
      _instance.rotation.set((Math.random() * 2 - 1) * 0.1, 0, (Math.random() * 2 - 1) * 0.1 + Math.PI);
      _instance.scale.set(1 + _index * 0.15, 1 + _index * 0.15, 1 + _index * 0.15);
    });
    // 🌟 将它放到深空背景中，与你的粒子层级 (z: -20) 保持一致
    this.instances.rotation.set(THREE.MathUtils.degToRad(13) - Math.PI * 0.5, THREE.MathUtils.degToRad(15), THREE.MathUtils.degToRad(-32));
    this.instances.position.set(0, 0, -10);
    this.instances.scale.set(16.37, 12.62, 16.37);
    this.instances.visible = false; // 初始隐藏，跟随 deepSpace 阶段一起出现
  }

  createGeometry() {
    const geometry = new LineGeometry();
    const positions = [];
    this.points.forEach(point => { positions.push(point.x, point.y, 0); });
    geometry.setPositions(positions);
    const count = geometry.attributes.instanceStart.count;
    const randomArray = new Float32Array(count);
    const randomValue = Math.random() * 0.2;
    for (let i = 0; i < count; i++) { randomArray[i] = randomValue; }
    geometry.setAttribute('aRandom', new THREE.InstancedBufferAttribute(randomArray, 1));
    return geometry;
  }

  setMaterial() {
    this.material = new LineMaterial({
      color: 0xffffff,
      linewidth: 2,
      dashed: true,
      premultipliedAlpha: true,
      transparent: true,
      opacity: 0.3,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    });

    this.uniforms = {
      uOffset: new THREE.Uniform(0.35),
      uDashSize: new THREE.Uniform(0.175),
      uFadeSize: new THREE.Uniform(0.05),
      uLineLength: new THREE.Uniform(this.curve.getLength()),
      uTime: new THREE.Uniform(0),
      COLOR_HIGHLIGHT: new THREE.Uniform(new THREE.Color(0xffffff)), // #5599ff
      COLOR_DASH: new THREE.Uniform(new THREE.Color(0x5599ff)),
    };

    this.material.onBeforeCompile = (_shader) => {
      _shader.uniforms.uOffset = this.uniforms.uOffset;
      _shader.uniforms.uLineLength = this.uniforms.uLineLength;
      _shader.uniforms.uDashSize = this.uniforms.uDashSize;
      _shader.uniforms.uFadeSize = this.uniforms.uFadeSize;
      _shader.uniforms.uTime = this.uniforms.uTime;
      _shader.uniforms.COLOR_HIGHLIGHT = this.uniforms.COLOR_HIGHLIGHT;
      _shader.uniforms.COLOR_DASH = this.uniforms.COLOR_DASH;

      _shader.vertexShader = _shader.vertexShader.replace('#include <common>', `#include <common>\n attribute float aRandom;\n varying float vRandom;`);
      _shader.vertexShader = _shader.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>\n vRandom = aRandom;`);
      _shader.fragmentShader = _shader.fragmentShader.replace('uniform float linewidth;', `varying float vRandom;\n uniform float linewidth;\n uniform float uOffset;\n uniform float uLineLength;\n uniform float uDashSize;\n uniform float uFadeSize;\n uniform float uTime;\n uniform vec3 COLOR_HIGHLIGHT;\n uniform vec3 COLOR_DASH;`);
      _shader.fragmentShader = _shader.fragmentShader.replace(/if \( mod\( vLineDistance \+ dashOffset, dashSize \+ gapSize \) > dashSize \) discard;/g, `// custom shader logic`);

      _shader.fragmentShader = _shader.fragmentShader.replace(
        'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
        `
          float offset = fract(uOffset - uTime + vRandom);
          float dash = smoothstep(fract(0.0 + uFadeSize + uDashSize + offset), fract(0.0 + uDashSize + offset), vLineDistance / uLineLength) - smoothstep(fract(0.0 + uFadeSize + offset), fract(0.0 + offset), vLineDistance / uLineLength);
          float highlight = pow(dash, 2.0);
          float cutMask = 1.0 - distance(vLineDistance / uLineLength, 0.5) * 2.0;
          gl_FragColor = vec4(COLOR_DASH + highlight * 0.25, dash * alpha * cutMask);
        `
      );
    };
  }

  update(elapsedTime) {
    this.uniforms.uTime.value = elapsedTime * 0.5;
  }
}

circlesSystem = new Circles();
circlesSystem.instances.position.set(0, 0, -5.0);
circlesSystem.instances.scale.set(30, 30, 30);
circlesSystem.instances.rotation.set(THREE.MathUtils.degToRad(13) - Math.PI * 0.5, THREE.MathUtils.degToRad(15), THREE.MathUtils.degToRad(-32));
scene3D.add(circlesSystem.instances);

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
gsap.set('.loader__circle', { opacity: 0, filter: 'blur(16px)', rotationZ: -45 });
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
    rotationX: "+=360",
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
      // 🌟 1. 彻底移除视频，替换为触发 3D 波纹冲击波
      if (waveSystem) {
        waveSystem.instance.visible = true; // 确保波纹网格可见
        waveSystem.triggerWave({
          direction: 1,           // 1 表示向外扩散
          duration: 5,          // 扩散持续时间
          ease: 'power3.out',     // 爆发感极强的缓动函数
          intensity: 1.2,         // 物理高度起伏强度
          lightIntensity: 1.8     // 光环发光强度
        });
      }
    }, "hitGround")
    .to(modelGroup.position, { y: -0.4, duration: 0.15, yoyo: true, repeat: 1 }, "hitGround")
    .to('.ui-stage-1',
      { opacity: 1, y: 30, duration: 1.5, ease: "power2.out" },
      "hitGround+=0.2"
    )
    .addLabel("openLid", "hitGround+=1.5")
    .to(caseLid.rotation, { x: lidInitialRot - Math.PI / 2, duration: 1.5, ease: "power2.out" }, "openLid")
    .addLabel("deepSpace", "openLid+=1.0")
    .set(sphericalGridGroup, { visible: true }, "deepSpace")
    .set(particlesGroup, { visible: true }, "deepSpace")
    .set(circlesSystem.instances, { visible: true }, "deepSpace") // 🌟 揭示发光虚线系统
    .set(earbudLeft, { visible: false }, 0.5)
    .add(() => {
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
      ScrollTrigger.refresh();
      // setupDebugGUI();
      initScrollTimeline();
      // (原有的 scheduleNextMeteor 被删除了)
    }, "deepSpace+=0.5");
}

// ==========================================
// 4. 资产预加载、环境贴图与高级材质重构 (Promise)
// ==========================================
const textureLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader(manager);
const hdrLoader = new HDRLoader(manager).setDataType(THREE.FloatType);

// 🌟 1. 按新路径加载素材
const loadHDR = new Promise((res) => hdrLoader.load("./studio_small_09_2k.hdr", res));
const loadWaferLeftTex = new Promise((res) => textureLoader.load("./img/B1.png", res));
const loadWaferRightTopTex = new Promise((res) => textureLoader.load("./img/A1.png", res));
const loadWaferRightBottomTex = new Promise((res) => textureLoader.load("./img/B1.png", res));
const loadLidTex = new Promise((res) => textureLoader.load("./img/4.png", res));
const loadCaseBottomTex = new Promise((res) => textureLoader.load("./img/7.png", res));
const loadWaferTex = new Promise((res) => textureLoader.load("./img/8.png", res));
const loadModel = new Promise((res) => gltfLoader.load("./box6.glb", res)); // 载入 box6.glb

/**
 * 🌟 2. 配置纹理辅助函数
 */
function configureTexture(texture, repeatX = 1, repeatY = 1, offsetX = 0, offsetY = 0) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.offset.set(offsetX, offsetY);
  texture.rotation = 0;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
}

Promise.all([
  loadHDR, loadLidTex, loadWaferLeftTex, loadWaferRightTopTex, loadWaferRightBottomTex, loadCaseBottomTex, loadWaferTex, loadModel
]).then(([hdrTexture, lidTexture, texLeft, texRightTop, texRightBottom, caseBottomTex, texLoadWafer, gltf]) => {
  
  const pmremGenerator = new THREE.PMREMGenerator(renderer3D);
  const currentEnvMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
  scene3D.environment = currentEnvMap;
  pmremGenerator.dispose();

  const createWaferMaterial = (texture) => {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      color: 0xffffff, map: texture, emissiveMap: texture,
      emissive: 0xffffff, emissiveIntensity: 0.7,
      transparent: true, opacity: 1, side: THREE.FrontSide,
    });
  };

  configureTexture(lidTexture, 1, 1);
  configureTexture(texRightTop, 2, 2);
  configureTexture(texRightBottom, 2, 2);
  configureTexture(texLeft, 2, 2, 0, 1);
  configureTexture(texLoadWafer, 2, 2, 0, 1);

  const matLeft = createWaferMaterial(texLeft);
  const matRightFront = createWaferMaterial(texRightTop);
  const matRightBack = createWaferMaterial(texRightBottom);

  const realModel = gltf.scene;
  realModel.scale.set(0.07, 0.07, 0.07);
  realModel.position.set(0, -1.5, 2.62);
  realModel.rotation.x = 1;
  modelGroup.position.set(0, 12, 0);
  modelGroup.add(realModel);

  let caseBottom = null;

  realModel.traverse((child) => {
    const name = child.name.toLowerCase();
    if (name.includes("case_lid") || name.includes("caselid")) { caseLid = child; } 
    else if (name.includes("case_bottom") || name.includes("casebottom")) { caseBottom = child; } 
    else if (child.name === "Waferright") { earbudRight = child; } 
    else if (child.name === "Waferleft") { earbudLeft = child; }
  });

  realModel.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.roughness = 0.35;
      child.material.metalness = 0.6;
      child.material.envMap = currentEnvMap;
      child.material.envMapIntensity = 0; // 遵循调优代码：底壳环境光设0
      child.material.needsUpdate = true;
    }
  });

  // 🌟 A. 盖子 UV 收缩与材质覆盖
  if (caseLid) {
    caseLid.traverse((mesh) => {
      if (mesh.isMesh) {
        const uvAttribute = mesh.geometry.attributes.uv;
        if (uvAttribute) {
          const uvArray = uvAttribute.array;
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < uvArray.length; i += 2) {
            minU = Math.min(minU, uvArray[i]); maxU = Math.max(maxU, uvArray[i]);
            minV = Math.min(minV, uvArray[i + 1]); maxV = Math.max(maxV, uvArray[i + 1]);
          }
          const rangeU = maxU - minU; const rangeV = maxV - minV;
          const shrink = 0.02;
          for (let i = 0; i < uvArray.length; i += 2) {
            let u = (uvArray[i] - minU) / rangeU;
            let v = (uvArray[i + 1] - minV) / rangeV;
            uvArray[i] = u * (1 - shrink * 2) + shrink;
            uvArray[i + 1] = v * (1 - shrink * 2) + shrink;
          }
          uvAttribute.needsUpdate = true;
        }
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.25, metalness: 1, transparent: true,
          emissive: 0x162b48, side: THREE.DoubleSide, opacity: 0.5,
          map: lidTexture, envMap: currentEnvMap, envMapIntensity: 1.5,
        });
        mesh.castShadow = true; mesh.receiveShadow = true;
      }
    });
  }

  // 🌟 B. 左晶圆 UV 重算与材质覆盖
  if (earbudLeft) {
    earbudLeft.traverse((mesh) => {
      if (mesh.isMesh) {
        const uvAttribute = mesh.geometry.attributes.uv;
        const uvArray = uvAttribute.array;
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < uvArray.length; i += 2) {
          minU = Math.min(minU, uvArray[i]); maxU = Math.max(maxU, uvArray[i]);
          minV = Math.min(minV, uvArray[i + 1]); maxV = Math.max(maxV, uvArray[i + 1]);
        }
        const rangeU = maxU - minU; const rangeV = maxV - minV;
        for (let i = 0; i < uvArray.length; i += 2) {
          uvArray[i] = (uvArray[i] - minU) / rangeU;
          uvArray[i + 1] = (uvArray[i + 1] - minV) / rangeV;
        }
        uvAttribute.needsUpdate = true;
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x222222, transparent: true, emissive: 0x222222, opacity: 1,
          roughness: 0.5, metalness: 0.5, map: texLeft,
          envMap: currentEnvMap, envMapIntensity: 1.5,
        });
        mesh.castShadow = true; mesh.receiveShadow = true;
      }
    });
  }

  // 🌟 C. 右晶圆 世界坐标投影与正反面材质分配
  if (earbudRight) {
    earbudRight.traverse((mesh) => {
      if (mesh.isMesh) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position.array;
        const newUVs = new Float32Array((positions.length / 3) * 2);
        for (let i = 0; i < positions.length / 3; i++) {
          newUVs[i * 2] = (positions[i * 3] + 2) / 4;
          newUVs[i * 2 + 1] = (positions[i * 3 + 2] + 2) / 4;
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(newUVs, 2));
        geometry.attributes.uv.needsUpdate = true;

        const name = mesh.name.toLowerCase();
        if (name === "柱体026") {
          const uvAttribute = mesh.geometry.attributes.uv;
          const uvArray = uvAttribute.array;
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < uvArray.length; i += 2) {
            minU = Math.min(minU, uvArray[i]); maxU = Math.max(maxU, uvArray[i]);
            minV = Math.min(minV, uvArray[i + 1]); maxV = Math.max(maxV, uvArray[i + 1]);
          }
          for (let i = 0; i < uvArray.length; i += 2) {
            uvArray[i] = (uvArray[i] - minU) / (maxU - minU);
            uvArray[i + 1] = (uvArray[i + 1] - minV) / (maxV - minV);
          }
          uvAttribute.needsUpdate = true;
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0x222222, transparent: true, emissive: 0x222222, opacity: 1,
            map: texLeft, envMap: currentEnvMap, envMapIntensity: 1.5,
          });
        }
        if (name === "柱体026_1") {
          const uvAttribute = mesh.geometry.attributes.uv;
          const uvArray = uvAttribute.array;
          let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
          for (let i = 0; i < uvArray.length; i += 2) {
            minU = Math.min(minU, uvArray[i]); maxU = Math.max(maxU, uvArray[i]);
            minV = Math.min(minV, uvArray[i + 1]); maxV = Math.max(maxV, uvArray[i + 1]);
          }
          for (let i = 0; i < uvArray.length; i += 2) {
            uvArray[i] = (uvArray[i] - minU) / (maxU - minU);
            uvArray[i + 1] = (uvArray[i + 1] - minV) / (maxV - minV);
          }
          uvAttribute.needsUpdate = true;
          mesh.material = matRightFront;
        }
        mesh.castShadow = true; mesh.receiveShadow = true;
      }
    });
  }

  // ==================================================
  // 🌟 D. 重点保留：结构挂载与 GSAP 动画解耦包装
  // ==================================================
  if (caseLid) {
    modelGroup.attach(caseLid);
    lidInitialRot = caseLid.rotation.x;
  }

  // 替身包裹：左晶圆
  if (earbudLeft) {
    innerWaferL = earbudLeft;
    modelGroup.attach(innerWaferL);
    earbudLeft = new THREE.Group(); 
    earbudLeft.position.copy(innerWaferL.position);
    earbudLeft.rotation.copy(innerWaferL.rotation);
    earbudLeft.scale.copy(innerWaferL.scale);
    modelGroup.add(earbudLeft);
    innerWaferL.position.set(0, 0, 0);
    innerWaferL.rotation.set(0, 0, 0);
    innerWaferL.scale.set(1, 1, 1);
    earbudLeft.add(innerWaferL);
  }

  // 替身包裹：右晶圆
  if (earbudRight) {
    innerWaferR = earbudRight;
    modelGroup.attach(innerWaferR);
    earbudRight = new THREE.Group();
    earbudRight.position.copy(innerWaferR.position);
    earbudRight.rotation.copy(innerWaferR.rotation);
    earbudRight.scale.copy(innerWaferR.scale);
    modelGroup.add(earbudRight);
    innerWaferR.position.set(0, 0, 0);
    innerWaferR.rotation.set(0, 0, 0);
    innerWaferR.scale.set(1, 1, 1);
    earbudRight.add(innerWaferR);
  }

  initTrackingElements();
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
    const startTime = `${startLabel}+=0.3`;

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
      scrub: 1.5,
      snap: {
        snapTo: (progress, self) => {
          // 1. 🌟 定义“主节点白名单”：只在这里面的节点才会被吸附
          // 故意排除了 stage5_merge 和 stage6_lid，这样它们就只管动画，不管吸附了
          const majorLabels = [
            "stage1", "stage2", "stage3", "stage4", "stage5", "stage6", "stage6_end"
          ];

          // 2. 获取这些主节点在时间轴上的进度百分比 (0 到 1)
          let snaps = majorLabels
            .filter(label => tl.labels[label] !== undefined)
            .map(label => tl.labels[label] / tl.duration());

          // 确保绝对起点和终点存在
          if (!snaps.includes(0)) snaps.unshift(0);
          if (!snaps.includes(1)) snaps.push(1);

          // 从小到大排序
          snaps.sort((a, b) => a - b);

          // 3. 找到用户当前滚动所在的区间 [prev, next]
          let prev = snaps[0];
          let next = snaps[snaps.length - 1];
          for (let i = 0; i < snaps.length - 1; i++) {
            if (progress >= snaps[i] && progress <= snaps[i + 1]) {
              prev = snaps[i];
              next = snaps[i + 1];
              break;
            }
          }

          // 4. 计算当前区间的总跨度
          let gap = next - prev;

          // 5. 🌟 核心逻辑：基于 25% 阈值的方向性意图吸附
          if (self.direction === 1) {
            // ⬇️ 向下滚动：只要超过了当前区间的 25%，就直接吸附到下一个主节点
            if (progress >= prev + gap * 0.25) {
              return next;
            } else {
              return prev; // 意图不强，弹回上一个节点
            }
          } else if (self.direction === -1) {
            // ⬆️ 向上滚动：只要往上划过了区间的 25%，就直接吸附到上一个主节点
            if (progress <= next - gap * 0.25) {
              return prev;
            } else {
              return next;
            }
          }

          // 兜底逻辑
          return gsap.utils.snap(snaps, progress);
        },
        // 🌟 因为有了明确的 25% 阈值作为防误触屏障，我们可以把 delay 调小
        // 让吸附反应更加迅速灵敏
        delay: 0.2,
        duration: { min: 2, max: 3 }, // 吸附动画的耗时，最快不低于0.8秒，最慢1.5秒，拒绝瞬间闪现
        ease: "power2.inOut", // 吸附时的缓动
        directional: false // 吸附时顺着用户的滚动方向找最近的标签
      },
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

  tl.to(".ui-stage-1", { opacity: 0, duration: 0.4 }, "stage2");

  // 1. 盒子微动：时长从 1.5 降到 1.0
  tl.to(modelGroup.position, { x: -1.2, y: -0.65, z: -0.16, duration: 1.0, ease: "power1.inOut" }, "stage1")
    .to(modelGroup.rotation, { x: -0.25159, y: 0.288407, z: 0.568407, duration: 1.0, ease: "power1.inOut" }, "stage1");
    console.log(earbudLeft)
  tl.set(earbudLeft, { visible: true }, "stage1+=0.2")

  // ✅ 2. 🌟 新版波纹无缝绑定滚轮！
  // 在 stage1 触发时，显示波纹，并预设光影强度
  tl.set(waveSystem.instance, { visible: true }, "stage1");
  tl.set(waveSystem.material.uniforms.uLightIntensity, { value: 1.5 }, "stage1");
  tl.set(waveSystem.material.uniforms.uIntensity, { value: 1.2 }, "stage1");
  tl.set(waveSystem.wireframeMaterial.uniforms.uLightIntensity, { value: 1.5 }, "stage1");
  tl.set(waveSystem.wireframeMaterial.uniforms.uIntensity, { value: 1.2 }, "stage1");

  // 🌟 取消了 uWaveTransition 动画，改为用 GSAP 直接控制 3D 网格坐标
  // 配合盒子与晶圆的运动，让波纹海面产生下沉和微倾斜的联动视差
  tl.to(waveSystem.instance.position, {
    x: 0,     // 水平位置保持不变
    y: -2.5,   // 海面随着滚轮缓缓下沉，给晶圆腾出视觉空间
    z: 0,    // 微微向镜头推近
    duration: 1.5,
    ease: "power1.inOut"
  }, "stage1");

  tl.to(waveSystem.instance.rotation, {
    x: -0.15, // 海面微微仰起
    z: 0,     // 配合盒子的 z 轴微扭转，海面也做轻微侧倾
    duration: 1.5,
    ease: "power1.inOut"
  }, "stage1");

  tl.to(waveSystem.instance.scale, {
    x: 2,   // 海面在下沉的同时稍微放大，增强视觉冲击力
    y: 2,
    z: 2,
    duration: 1.5,
    ease: "power1.inOut"
  }, "stage1");

  tl.to(sandParticlesSystem.instance.position, {
    y: -6.5,   // 沙粒系统与海面保持同步下沉，增强整体感
    z: 9.5,    // 微微向镜头推近，但比海面更近一点，制造层次感      
    duration: 4,
    ease: "power1.inOut"
  }, "stage1");

  tl.to(sandParticlesSystem.instance.rotation, {
    x: -Math.PI / 4, // 沙粒系统微微仰起，与海面保持一致的倾斜角度
    z: 0,   // 配合盒子和海面的 z 轴微扭转，沙粒系统也做轻微侧倾
    duration: 4,
    ease: "power1.inOut"
  }, "stage1");


  tl.to(waveSystem.instance.position, {
    y: -7.5,   // 海面随着滚轮缓缓下沉，给晶圆腾出视觉空间
    duration: 1.5,
    ease: "power1.inOut"
  }, "stage1+=1.5");

  tl.to(waveSystem.instance.rotation, {
    x: 0, // 海面微微仰起
    z: 0,     // 配合盒子的 z 轴微扭转，海面也做轻微侧倾
    duration: 1.5,
    ease: "power1.inOut"
  }, "stage1+=1.5");

  tl.set(waveSystem.instance, { visible: false }, "stage1+=3");

  // 3. 晶圆预备上浮：时长从 1.7 降到 1.0
  tl.to(earbudLeft.position, { y: w1Initial.pos.y + 0.5, z: w1Initial.pos.z + 1, duration: 1.0, ease: "power1.inOut" }, "stage1");


  // ------------------------------------------
  // Stage 2: 左晶圆主导升空，右晶圆跟随
  // ------------------------------------------
  tl.addLabel("stage2", 1.0);
  // 假设这是晶圆飞到位的节点，我们准备展示文案
  // 容器本身只控制基础显示
  tl.to(".ui-stage-2", { opacity: 1, duration: 0.4 }, "stage2");
  tl.to(floatState, { val: 1, duration: 1.5, ease: "power2.inOut" }, "stage2");

  // 🔥 一键挂载动画！在 stage2 触发后 0.2s 自动生成所有 SVG 线条动画
  buildGuideLineAnim(tl, ".ui-stage-2", "stage2");

  tl.to(modelGroup.position, { x: -3.5, y: -8.5, z: 1.5, duration: 0.6, ease: "power2.out" }, "stage2")
    .to(modelGroup.rotation, { z: 0.2, duration: 0.6, ease: "power2.out" }, "stage2");

  tl.to(earbudLeft.position, { x: 0.9, y: w1Initial.pos.y + 7, z: w1Initial.pos.z + 8, duration: 0.9, ease: "power2.out" }, "stage2")
    .to(earbudLeft.rotation, { x: Math.PI, y: -Math.PI / 2, z: 0.1, duration: 0.9, ease: "power2.out" }, "stage2");

  tl.to(earbudLeft.position, { x: 1.2, y: w1Initial.pos.y + 8.8, z: w1Initial.pos.z + 6, duration: 0.4, ease: "power2.out" }, "stage2+=0.9")

  tl.to(earbudLeft.position, { x: 0.62, y: 6.11, z: w1Initial.pos.z + 8.8, duration: 0.6, ease: "power2.out" }, "stage2+=1.3")
    .to(earbudLeft.rotation, { x: 2.70, y: -2.42159265358979, duration: 0.5, ease: "power2.out" }, "stage2+=0.9");

  tl.to(earbudRight.position, { x: 1.8, y: 5.22, z: w2Initial.pos.z + 8.8, duration: 1.1, ease: "power2.out" }, "stage2+=0.3")
  tl.to(earbudRight.position, { x: 1.4, y: 5.42, z: w2Initial.pos.z + 8.8, duration: 0.5, ease: "power2.out" }, "stage2+=1.4")
    .to(earbudRight.rotation, {
      x: -1.41159265358979,
      y: 0.588407346410207,
      z: 1.97840734641021,
      duration: 1.3,
      ease: "power2.out"
    }, "stage2+=0.6");

  // ------------------------------------------
  // Stage 3: 传感核心晶圆特写与矩阵排版
  // ------------------------------------------
  tl.addLabel("stage3", 3.0);
  tl.to(".ui-stage-2", { opacity: 0, duration: 0.4 }, "stage3");
  tl.to(".ui-stage-3", { opacity: 1, duration: 0.4 }, "stage3+=0.1");

  // 🔥 一键挂载动画！(只要 ui--stage3 内部有 .param 结构就会自动生效)
  buildGuideLineAnim(tl, ".ui-stage-3", "stage3");

  tl.to(earbudLeft.position, { x: 0.01, y: 6.07, z: w1Initial.pos.z + 6, duration: 1, ease: "power2.out" }, "stage3")
    .to(earbudLeft.rotation, { x: 0.0315926535897932, y: 2.21840734641021, z: 0.561592653589793, duration: 1, ease: "power2.out" }, "stage3+=0.3");

  tl.to(earbudRight.position, { x: 3.0, y: 5.34, duration: 1, ease: "power2.out" }, "stage3")
    .to(earbudRight.rotation, { x: 2.13840734641021, y: -Math.PI, z: -0.931592653589, duration: 1, ease: "power2.out" }, "stage3+=0.3");

  tl.to(earbudLeft.position, { x: 1.28, y: 6, z: w1Initial.pos.z + 8, duration: 0.6, ease: "power2.out" }, "stage3+=1");
  tl.to(earbudRight.position, { x: 1.33, y: 5.34, z: w2Initial.pos.z + 8.9, duration: 0.6, ease: "power2.out" }, "stage3+=1");


  // ------------------------------------------
  // Stage 4: 晶圆横移换位与薄膜晶圆特写
  // ------------------------------------------
  tl.addLabel("stage4", 5.0);
  tl.to(".ui-stage-3", { opacity: 0, duration: 0.4 }, "stage4");
  tl.to(".ui-stage-4", { opacity: 1, duration: 0.4 }, "stage4+=0.4");

  // 🔥 一键挂载动画！
  buildGuideLineAnim(tl, ".ui-stage-4", "stage4");

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

  // ------------------------------------------
  // Stage 5: 无缝连续的分离与防穿模重构合体 (⏱️ 提速一倍版)
  // ------------------------------------------
  tl.addLabel("stage5", 7.0);
  // 🌟 停止漂浮：在合体前 0.5 秒内，强制让模型回正停稳，防止撞击时穿模对不准！
  tl.to(floatState, { val: 0, duration: 0.5, ease: "power2.out" }, "stage5");

  // UI 淡出：duration 0.5 -> 0.25
  tl.to(".ui-stage-4", { opacity: 0, duration: 0.25 }, "stage5");

  const separationPosL = { x: -0.5, y: 5.97, z: 12.0 };
  const separationPosR = { x: 3.0, y: 5.97, z: 12.0 };
  const mergePosL = { x: 1.67 + 0.28, y: 5.97, z: 10.9 };
  const mergePosR = { x: 1.67, y: 5.97, z: 11 + 0.09 };
  const preMergePosL = { x: mergePosL.x - 1.5, y: mergePosL.y, z: mergePosL.z };
  const preMergePosR = { x: mergePosR.x + 1.5, y: mergePosR.y, z: mergePosR.z };

  // 分离动作
  tl.to(earbudLeft.position, { ...separationPosL, duration: 0.5, ease: "power2.out" }, "stage5+=0.25")
    .to(earbudLeft.rotation, { x: Math.PI / 2, y: Math.PI, z: 0.1, duration: 0.5, ease: "power2.out" }, "stage5+=0.25");
  tl.to(earbudRight.position, { ...separationPosR, duration: 0.5, ease: "power2.out" }, "stage5+=0.25")
    .to(earbudRight.rotation, { x: Math.PI / 2, y: -Math.PI, z: 0.1, duration: 0.5, ease: "power2.out" }, "stage5+=0.25");

  // 预合体
  tl.to(earbudLeft.position, { ...preMergePosL, duration: 0.5, ease: "power2.inOut" }, "stage5+=0.75")
    .to(earbudLeft.rotation, { x: 0, y: Math.PI / 2, z: 0.1, duration: 0.5, ease: "power2.inOut" }, "stage5+=0.75");
  tl.to(earbudRight.position, { ...preMergePosR, duration: 0.5, ease: "power2.inOut" }, "stage5+=0.75")
    .to(earbudRight.rotation, { x: Math.PI / 2, y: 0, z: 0.1, duration: 0.5, ease: "power2.inOut" }, "stage5+=0.75");

  // 🌟【新增 Label】：撞击合体的关键瞬间
  const mergeImpactTime = "stage5+=1.25";
  tl.addLabel("stage5_merge", mergeImpactTime);

  // 撞击动作与特效
  tl.to(earbudLeft.position, { x: mergePosL.x, duration: 0.25, ease: "power3.in" }, mergeImpactTime)
    .to(earbudRight.position, { x: mergePosR.x, duration: 0.25, ease: "power3.in" }, mergeImpactTime);

  tl.to(leftMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 0.3, ease: "power2.out" }, mergeImpactTime);
  tl.to(rightMat.color, { r: 0.05, g: 0.05, b: 0.05, duration: 0.3, ease: "power2.out" }, mergeImpactTime);
  tl.to(sphericalGridGroup.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.75, ease: "power3.inOut" }, mergeImpactTime);


  // ------------------------------------------
  // Stage 6: 坠落归仓 (增加 Lid 锚点)
  // ------------------------------------------
  tl.addLabel("stage6", 8.5);

  tl.to(leftMat.color, { r: 1, g: 1, b: 1, duration: 0.3 }, "stage6")
    .to(rightMat.color, { r: 1, g: 1, b: 1, duration: 0.3 }, "stage6");

  tl.to(earbudLeft.position, { x: mergePosL.x - 1.5, duration: 0.3, ease: "power2.out" }, "stage6+=0.1")
    .to(earbudRight.position, { x: mergePosR.x + 1.5, duration: 0.3, ease: "power2.out" }, "stage6+=0.1");

  const finalBoxPos = { x: 0, y: 1.6, z: 2.62 };
  const finalBoxRot = { x: 0.3, y: 0, z: 0 };

  const boxUpStart = "stage6+=0.5";
  tl.to(modelGroup.position, { ...finalBoxPos, duration: 0.6, ease: "power2.inOut" }, boxUpStart)
    .to(modelGroup.rotation, { ...finalBoxRot, duration: 0.6, ease: "power2.inOut" }, boxUpStart);

  const fallStart = "stage6+=0.3";
  const fallActionTime = 0.8;

  tl.to(earbudLeft.position, { x: w1Initial.pos.x, y: w1Initial.pos.y, z: w1Initial.pos.z, duration: fallActionTime, ease: "power2.in" }, fallStart)
    .to(earbudRight.position, { x: w2Initial.pos.x, y: w2Initial.pos.y, z: w2Initial.pos.z, duration: fallActionTime, ease: "power2.in" }, fallStart);

  tl.to(earbudLeft.rotation, { y: "+=" + (Math.PI / 2), duration: 0.5, ease: "power1.inOut" }, fallStart)
    .to(earbudRight.rotation, { y: "-=" + (Math.PI / 2), duration: 0.5, ease: "power1.inOut" }, fallStart)
    

  // 🌟【新增 Label】：晶圆落地、准备关盖
  const lidClosureTime = "stage6+=1.1";
  tl.addLabel("stage6_lid", lidClosureTime);

  tl.to(earbudLeft.rotation, {
    x: w1Initial.rot.x, y: w1Initial.rot.y, z: w1Initial.rot.z, duration: 0.3, ease: "back.out(1.2)"
  }, "stage6+=0.8")
    .to(earbudRight.rotation, {
      x: w2Initial.rot.x, y: w2Initial.rot.y, z: w2Initial.rot.z, duration: 0.3, ease: "back.out(1.2)"
    }, "stage6+=0.8")
    .set(earbudLeft, { visible: false }, "stage6+=1.12")
  tl.to(caseLid.rotation, { x: lidInitialRot, duration: 0.3, ease: "bounce.out" }, lidClosureTime);

  // ==========================================
  // 🌟 2. 核心修改：在盖子触底的瞬间触发爆发波纹
  // ==========================================
  // lidClosureTime 是动作开始，0.3秒的 duration 加上 bounce，真实触底大约在 +0.15s
  const impactTime = "stage6"; 
  tl.add(() => {
    if (waveSystem) {
      waveSystem.instance.visible = true; // 强制显示波浪
      waveSystem.triggerWave({
        direction: 1,
        duration: 2.5,          // 爆发持续 2.5 秒
        ease: 'power2.out',
        intensity: 1.5,         // 强度稍大，彰显关盖的力度
        lightIntensity: 2.0
      });
    }
  }, impactTime);

  tl.to(".ui-stage-1", { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, "stage6+=1.2")

  tl.to({}, { duration: 2.5 }, impactTime); 
  tl.addLabel("stage6_end", "+=0"); // 标签自动贴合到撑长后的末尾

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

    // 盒子在 0.8s 开始往下砸，0.95s 砸到最低点 (0.8 + 0.15)
    loopTl.to(modelGroup.position, { y: -0.4, duration: 0.15, yoyo: true, repeat: 1 }, 0.8);

    loopTl.to(caseLid.rotation, { x: lidInitialRot - Math.PI / 2, duration: 1.2, ease: "power2.out" }, 0.9);
  }
}

// ==========================================
// 6. 渲染循环与功能函数
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  // 获取两帧之间的时间差
  const delta = globalClock.getDelta();

  // ----------------------------------------------------
  // 🌟 核心投影逻辑：遍历更新所有活跃的 UI 指示线
  // ----------------------------------------------------
  if (isAssetsLoaded && camera3D) {
    trackingPoints.forEach(point => {
      // 只有当 DOM 元素存在，且其父级阶段 (.ui-stage-x) 正在显示时才进行运算
      // 这里通过检查最近的 ui-layer 的 opacity 属性来优化性能，避免隐藏状态下乱跑
      const parentStage = point.domElement?.closest('.ui-layer');

      if (point.domElement && parentStage && window.getComputedStyle(parentStage).opacity > 0) {
        const targetMesh = point.meshRef();
        if (targetMesh) {
          // 1. 获取局部锚点的世界坐标
          projectedPosition.copy(point.localPos);
          targetMesh.localToWorld(projectedPosition);

          // 2. 投影到摄像机的屏幕 NDC 坐标 [-1, 1]
          projectedPosition.project(camera3D);

          // 3. 转换为基于屏幕中心的像素偏移量
          const x = (projectedPosition.x * window.innerWidth * 0.5);
          const y = -(projectedPosition.y * window.innerHeight * 0.5);

          // 4. 应用位移 (这里的 translate 就是你参考代码里随处变动的那个)
          // 我们可以叠加一个 -50% 来修正元素自身的中心对齐
          point.domElement.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        }
      }
    });
  }

  // 🌟 驱动新波纹系统
  if (waveSystem) {
    waveSystem.update(delta);
  }

  if (circlesSystem) {
    circlesSystem.update(globalClock.getElapsedTime());
  }

  const time = performance.now() * 0.0001;

  // ----------------------------------------------------
  // 🌟 1. 鼠标视差疏离效果 (Mouse Parallax)
  // ----------------------------------------------------
  // 逻辑：鼠标往左下(-1, -1)，模型整体组就往右上(+, +)躲避。
  // 0.6 是偏移幅度，数字越大躲得越远，你可以自己调整手感
  parallaxGroup.position.x = -mouseState.currentX * 0.2;
  parallaxGroup.position.y = -mouseState.currentY * 0.1;

  // ----------------------------------------------------
  // 🌟 2. 晶圆微重力漂浮效果 (Micro-gravity Float)
  // ----------------------------------------------------
  if (innerWaferL && floatState.val > 0) {
    // 乘以 floatState.val (0~1)，实现随动画阶段平滑开启/关闭
    innerWaferL.position.y = Math.sin(time * 15) * 0.15 * floatState.val;
    innerWaferL.position.x = Math.cos(time * 12) * 0.1 * floatState.val;
    innerWaferL.rotation.z = Math.sin(time * 20) * 0.05 * floatState.val;
  }

  if (innerWaferR && floatState.val > 0) {
    // 右耳的频率(14, 11, 19)和左耳错开，这样看起来不会像双胞胎在同步做广播体操，显得更杂乱自然
    innerWaferR.position.y = Math.cos(time * 14) * 0.15 * floatState.val;
    innerWaferR.position.x = Math.sin(time * 11) * 0.1 * floatState.val;
    innerWaferR.rotation.z = Math.cos(time * 19) * 0.05 * floatState.val;
  }
  time_bg += 0.016;

  mouseState.currentX += (mouseState.targetX - mouseState.currentX) * 0.05;
  mouseState.currentY += (mouseState.targetY - mouseState.currentY) * 0.05;

  particlesGroup.children.forEach(child => {
    if (child.material && child.material.uniforms && child.material.uniforms.uTime && child.isMesh) {
      child.material.uniforms.uTime.value = time_bg;
    }
  });

  // 🌟 驱动新的 GPGPU 粒子系统
  if (typeof sandParticlesSystem !== 'undefined') {
    // GPGPU 的计算强依赖毫秒(ms)，所以需要把 delta(秒) 乘 1000
    sandParticlesSystem.update(delta * 1000);
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

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer3D.setSize(w, h);
  camera3D.aspect = w / h;
  camera3D.updateProjectionMatrix();
  if (window.gridLineMat) window.gridLineMat.resolution.set(w, h);
  if (circlesSystem) circlesSystem.material.resolution.set(w, h);

  // 🌟 同步更新 GPGPU 尺寸与分辨率
  if (typeof glMock !== 'undefined') {
    glMock.sizes.width = w;
    glMock.sizes.height = h;
  }
  if (typeof sandParticlesSystem !== 'undefined') {
    sandParticlesSystem.resize();
  }
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
    if (targetMat.emissiveMap) targetMat.emissiveMap.center.set(0.5, 0.5);

    // 1. 缩放控制 (0.5 到 2.0)
    // 注意：用 onChange 确保底图(map)和发光图(emissiveMap)同步缩放
    texFolder.add({ scale: 1 }, 'scale', 0.5, 2.0).name('缩放大小').onChange(v => {
      targetMat.map.repeat.set(v, v);
      if (targetMat.emissiveMap) targetMat.emissiveMap.repeat.set(v, v);
    });

    // 2. 偏移控制 (X 和 Y)
    texFolder.add(targetMat.map.offset, 'x', -0.5, 0.5, 0.01).name('左右平移 (X)').onChange(v => {
      if (targetMat.emissiveMap) targetMat.emissiveMap.offset.x = v;
    });
    texFolder.add(targetMat.map.offset, 'y', -0.5, 0.5, 0.01).name('上下平移 (Y)').onChange(v => {
      if (targetMat.emissiveMap) targetMat.emissiveMap.offset.y = v;
    });

    // 3. 旋转控制 (-180度 到 180度)
    texFolder.add({ rot: 0 }, 'rot', -Math.PI, Math.PI, 0.01).name('旋转角度').onChange(v => {
      targetMat.map.rotation = v;
      if (targetMat.emissiveMap) targetMat.emissiveMap.rotation = v;
    });
  }

  gui.close();
}