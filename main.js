import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GUI from 'lil-gui';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 0. 内置 Shader 字符串 (原汁原味的流体算法)
// ==========================================
const vertexShader = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const fluidShader = `
uniform float iTime; uniform vec2 iResolution; uniform vec4 iMouse; uniform int iFrame; uniform sampler2D iPreviousFrame;
uniform float uBrushSize; uniform float uBrushStrength; uniform float uFluidDecay; uniform float uTrailLength; uniform float uStopDecay;
varying vec2 vUv; vec2 ur, U;
float In(vec2 p, vec2 a, vec2 b) { return length(p - a - (b - a) * clamp(dot(p - a, b - a) / dot(b - a, b - a), 0., 1.)); }
vec4 t(vec2 v, int a, int b) { return texture2D(iPreviousFrame, fract((v + vec2(float(a), float(b))) / ur)); }
vec4 t(vec2 v) { return texture2D(iPreviousFrame, fract(v / ur)); }
float area(vec2 a, vec2 b, vec2 c) { float A = length(b - c); float B = length(c - a); float C = length(a - b); float s = 0.5 * (A + B + C); return sqrt(s * (s - A) * (s - B) * (s - C)); }
void main() {
    ur = iResolution.xy; U = vUv * ur;
    if(iFrame < 1) { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); return; }
    vec2 v = U; vec2 A = vec2(1.0, 1.0); vec2 B = vec2(1.0, -1.0); vec2 C = vec2(-1.0, 1.0); vec2 D = vec2(-1.0, -1.0);
    for(int i = 0; i < 8; i++) { v -= t(v).xy; A -= t(A).xy; B -= t(B).xy; C -= t(C).xy; D -= t(D).xy; }
    vec4 me = t(v), n = t(v, 0, 1), e = t(v, 1, 0), s = t(v, 0, -1), w = t(v, -1, 0);
    me = mix(me, 0.25 * (n + e + s + w), 0.15);
    me.z -= 0.01 * ((area(A, B, C) + area(B, C, D)) - 4.0);
    vec4 pr = vec4(e.z, w.z, n.z, s.z);
    me.xy += 100.0 * vec2(pr.x - pr.y, pr.z - pr.w) / ur;
    me.xy *= uFluidDecay; me.z *= uTrailLength;
    if(iMouse.z > 0.0) {
        vec2 mousePos = iMouse.xy, mousePrev = iMouse.zw, m = mousePos - mousePrev;
        float velMagnitude = length(m), q = In(U, mousePos, mousePrev), l = length(m);
        if (l > 0.0) m = min(l, 10.0) * m / l;
        float falloff = pow(exp(-q * (1e-4 / uBrushSize) * q * q), 0.5);
        me.xyw += (uBrushStrength * 0.03) * falloff * vec3(m, 10.0);
        if(velMagnitude < 2.0) { float influence = exp(-length(U - mousePos) * 0.01); float cursorDecay = mix(1.0, uStopDecay, influence); me.xy *= cursorDecay; me.z *= cursorDecay; }
    }
    gl_FragColor = clamp(me, -0.4, 0.4);
}`;

const displayShader = `
uniform float iTime; uniform vec2 iResolution; uniform sampler2D iFluid;
uniform float uDistortionAmount; uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3; uniform vec3 uColor4; uniform float uColorIntensity; uniform float uSoftness;
varying vec2 vUv;
void main() {
    vec2 fragCoord = vUv * iResolution; vec4 fluid = texture2D(iFluid, vUv); vec2 fluidVel = fluid.xy;
    vec2 uv = (fragCoord * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y) + fluidVel * uDistortionAmount;
    float d = -iTime + 0.5, a = 0.0;
    for(float i = 0.0; i < 8.0; ++i) { a += cos(i - d - a * uv.x); d += sin(uv.y * i + a); }
    d += iTime * 0.5;
    float smoothAmount = clamp(uSoftness * 0.1, 0.0, 0.9);
    float mixer1 = mix(cos(uv.x * d) * 0.5 + 0.5, 0.5, smoothAmount);
    float mixer2 = mix(cos(uv.y * a) * 0.5 + 0.5, 0.5, smoothAmount);
    float mixer3 = mix(sin(d + a) * 0.5 + 0.5, 0.5, smoothAmount);
    vec3 col = mix(uColor1, uColor2, mixer1); col = mix(col, uColor3, mixer2); col = mix(col, uColor4, mixer3 * 0.4);
    gl_FragColor = vec4(col * uColorIntensity, 1.0);
}`;

// ==========================================
// 1. 初始化背景流体 (Background Fluid)
// ==========================================
const config = {
  brushSize: 25.0, brushStrength: 0.5, distortionAmount: 2.5, fluidDecay: 0.98, trailLength: 0.8, stopDecay: 0.85,
  color1: "#01040a", color2: "#041126", color3: "#0a2458", color4: "#41a5ff", colorIntensity: 1.2, softness: 1.0,
};
const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16)/255, parseInt(hex.slice(3, 5), 16)/255, parseInt(hex.slice(5, 7), 16)/255];

const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const bgRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
document.querySelector(".gradient-canvas").appendChild(bgRenderer.domElement);
bgRenderer.setSize(window.innerWidth, window.innerHeight);

let fluidTarget1 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.FloatType });
let fluidTarget2 = fluidTarget1.clone();
let currentFluidTarget = fluidTarget1, previousFluidTarget = fluidTarget2, frameCount = 0;

const fluidMaterial = new THREE.ShaderMaterial({
  uniforms: {
    iTime: { value: 0 }, iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    iMouse: { value: new THREE.Vector4(0, 0, 0, 0) }, iFrame: { value: 0 }, iPreviousFrame: { value: null },
    uBrushSize: { value: config.brushSize }, uBrushStrength: { value: config.brushStrength }, uFluidDecay: { value: config.fluidDecay }, uTrailLength: { value: config.trailLength }, uStopDecay: { value: config.stopDecay },
  }, vertexShader, fragmentShader: fluidShader,
});

const displayMaterial = new THREE.ShaderMaterial({
  uniforms: {
    iTime: { value: 0 }, iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }, iFluid: { value: null },
    uDistortionAmount: { value: config.distortionAmount },
    uColor1: { value: new THREE.Vector3(...hexToRgb(config.color1)) }, uColor2: { value: new THREE.Vector3(...hexToRgb(config.color2)) },
    uColor3: { value: new THREE.Vector3(...hexToRgb(config.color3)) }, uColor4: { value: new THREE.Vector3(...hexToRgb(config.color4)) },
    uColorIntensity: { value: config.colorIntensity }, uSoftness: { value: config.softness },
  }, vertexShader, fragmentShader: displayShader,
});

const fluidPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fluidMaterial);
const displayPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), displayMaterial);

let mouseX = 0, mouseY = 0, prevX = 0, prevY = 0, lastMove = 0;
document.addEventListener('mousemove', (e) => {
  prevX = mouseX; prevY = mouseY; mouseX = e.clientX; mouseY = window.innerHeight - e.clientY;
  lastMove = performance.now();
  fluidMaterial.uniforms.iMouse.value.set(mouseX, mouseY, prevX, prevY);
});
document.addEventListener('mouseleave', () => fluidMaterial.uniforms.iMouse.value.set(0, 0, 0, 0));


// ==========================================
// 2. 初始化 3D 耳机模型 (加载 GLB)
// ==========================================
const canvas3D = document.querySelector('.webgl-canvas');
const renderer3D = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true, alpha: true });
renderer3D.setSize(window.innerWidth, window.innerHeight);
renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene3D = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera3D.position.z = 12;

// 添加灯光 (真实模型通常需要更好的光照，这里增强了环境光)
scene3D.add(new THREE.AmbientLight(0xffffff, 1.2)); 
const dirLight1 = new THREE.DirectionalLight(0x41a5ff, 3); 
dirLight1.position.set(5, 5, 5); 
scene3D.add(dirLight1);
const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.5); 
dirLight2.position.set(-5, -5, 2); 
scene3D.add(dirLight2);

// 【核心逻辑】创建一个 Group 作为占位符
const modelGroup = new THREE.Group();
scene3D.add(modelGroup);

// 在外部声明一个变量，用来存我们要拿出来的耳机
let leftEarbud = null; 
// 也可以加个右耳机 let rightEarbud = null;

// 实例化加载器并加载模型
const gltfLoader = new GLTFLoader();
gltfLoader.load(
  './box.glb',
  (gltf) => {
    const realModel = gltf.scene;
    
    // 1. 调整大小 (XYZ 同等比例缩放)
    // 如果模型太大，改成 0.1；如果太小，改成 10
    realModel.scale.set(0.07, 0.07, 0.07); 

    // 2. 调整位置 (X左右, Y上下, Z前后)
    // 比如：往下移一点点以居中
    realModel.position.set(0, -1.5, 2.62);

    // 3. 调整初始角度 (弧度制，Math.PI 就是 180度)
    // 比如：让模型初始面向正前方
    realModel.rotation.x = 1.13; 

    modelGroup.add(realModel);


    // 1. 找到耳机
    realModel.traverse((child) => {
      if (child.isMesh && (child.name.includes('柱体') || child.name === '柱体')) {
        leftEarbud = child; 
      }
    });

    // ==========================================
    // 2. 核心剥离操作：真正把耳机从盒子里“拿出来”
    // ==========================================
    if (leftEarbud) {
      // 将耳机从原有的层级树中摘出，直接挂载到我们最外层的容器 modelGroup 上
      modelGroup.attach(leftEarbud);
      
      console.log("左耳机已成功剥离，当前父级:", leftEarbud.parent);
    }
  }
);


// ==========================================
// 3. 全局动画循环 (Render Loop)
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;
  
  // 流体计算与渲染
  fluidMaterial.uniforms.iTime.value = time; displayMaterial.uniforms.iTime.value = time; fluidMaterial.uniforms.iFrame.value = frameCount;
  if (performance.now() - lastMove > 100) fluidMaterial.uniforms.iMouse.value.set(0, 0, 0, 0);
  fluidMaterial.uniforms.iPreviousFrame.value = previousFluidTarget.texture;
  
  bgRenderer.setRenderTarget(currentFluidTarget); bgRenderer.render(fluidPlane, bgCamera);
  displayMaterial.uniforms.iFluid.value = currentFluidTarget.texture;
  bgRenderer.setRenderTarget(null); bgRenderer.render(displayPlane, bgCamera);
  
  [currentFluidTarget, previousFluidTarget] = [previousFluidTarget, currentFluidTarget]; frameCount++;

  // 3D 渲染
  // modelGroup.rotation.y += 0.002; // 修改这里：让容器自转
  renderer3D.render(scene3D, camera3D);
}
animate();

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  bgRenderer.setSize(w, h); renderer3D.setSize(w, h);
  fluidMaterial.uniforms.iResolution.value.set(w, h); displayMaterial.uniforms.iResolution.value.set(w, h);
  fluidTarget1.setSize(w, h); fluidTarget2.setSize(w, h);
  camera3D.aspect = w / h; camera3D.updateProjectionMatrix();
});


// ==========================================
// 4. GSAP 剧本：加载期 -> 交叉淡入 -> 滚动触发
// ==========================================

// 4.1 Loading 动画准备
gsap.set('.loader__circle', { opacity: 0, filter: 'blur(16px)' });
gsap.set('.tagcloud--item', { opacity: 0 });
// 独立自转
gsap.to('.loader__circle:nth-child(1)', { rotationZ: 360, duration: 25, repeat: -1, ease: 'none' });
gsap.to('.loader__circle:nth-child(2)', { rotationZ: -360, duration: 35, repeat: -1, ease: 'none' });
gsap.to('.loader__circle:nth-child(3)', { rotationZ: 360, duration: 20, repeat: -1, ease: 'none' });

const loadingTl = gsap.timeline({ delay: 0.5 });
const counterObj = { val: 0 };

// 展开圆环与数字增长
loadingTl.to('.loader__circle', {
  opacity: 1, filter: 'blur(0px)', duration: 2.5, ease: 'expo.out', stagger: { each: 0.15, from: "end" }
}, 0)
.to('.tagcloud--item', { opacity: 1, duration: 1, stagger: 0.2 }, 1)
.to(counterObj, {
  val: 100, duration: 4.5, ease: "power2.inOut",
  onUpdate: () => document.getElementById('counter').innerText = `[ ${Math.round(counterObj.val).toString().padStart(3, '0')} ]`
}, 0);

// 360度多轴陀螺仪翻转
loadingTl.to('.loader__circle:nth-child(-n+6)', {
  rotationX: (i) => i % 2 === 0 ? 360 : -360,
  rotationY: (i) => i % 2 === 0 ? -360 : 360,
  duration: 3.5, ease: 'power3.inOut', stagger: 0.12
}, "+=0.2"); 

// 4.2 核心转场：淡出 Loading，淡入 Stage 2 并解禁滚动
loadingTl.to('.loader-w', {
  scale: 0.5, opacity: 0, filter: 'blur(10px)', duration: 2, ease: 'power3.inOut'
}, "+=1.5") // 停顿1.5秒后开始退场
.to('.tagcloud-w', { opacity: 0, duration: 1 }, "<")
// **关键交接点：淡入后台流体与 3D，解除 body 滚动锁定**
.to('.stage2-el', { 
  opacity: 1, duration: 2, ease: 'power2.out',
  onStart: () => {
    document.body.style.overflowY = 'auto'; // 恢复系统滚动条
    ScrollTrigger.refresh(); // 强制 GSAP 重新计算高度
  }
}, "<0.5") 
// 标题文字出场
.fromTo('.step:first-child .text-content', 
  { opacity: 0, y: 50 }, 
  { opacity: 1, y: 0, duration: 1.5, ease: 'expo.out' }, 
  "-=1"
);

// 4.3 Stage 2 滚动事件绑定 (ScrollTrigger)
// 只有在转场开始（ScrollTrigger刷新）后，这些动作才有意义
// gsap.to(modelGroup.rotation, {
//   y: Math.PI * 4, x: Math.PI * 1.5, ease: "none",
//   scrollTrigger: {
//     trigger: ".scroll-container",
//     start: "top top", end: "bottom bottom",
//     scrub: 1 
//   }
// });

const steps = gsap.utils.toArray('.step');
steps.forEach((step, index) => {
  // 第一个标题已经在 loadingTl 中入场了，不用重复赋予进场动画
  if (index !== 0) {
    gsap.fromTo(step.querySelector('.text-content'), 
      { opacity: 0, y: 80 }, 
      {
        opacity: 1, y: 0, ease: "power2.out",
        scrollTrigger: {
          trigger: step, start: "top 60%", end: "center center", scrub: true
        }
      }
    );
  }
  // 离场动画 (最后一段话不离场)
  if (index !== steps.length - 1) {
    gsap.to(step.querySelector('.text-content'), {
      opacity: 0, y: -80, ease: "power2.in",
      scrollTrigger: {
        trigger: step, start: "center center", end: "bottom 40%", scrub: true
      }
    });
  }
});

// 等待一小段时间，确保模型加载完毕后再绑定动画 
// 更好的做法是将这段逻辑封装进 loader 的成功回调里，或者使用 Promise
setTimeout(() => {
  console.log(leftEarbud)
  if (leftEarbud) {
    // 记录耳机原始位置，方便计算相对位移
    const startX = leftEarbud.position.x;
    const startY = leftEarbud.position.y;
    const startZ = leftEarbud.position.z;

    // 1. 让耳机往上、往前“飞出来”
    gsap.to(leftEarbud.position, {
      x: startX + 6,
      y: startY + 50, // 往上飞出充电仓 (数值根据你的模型比例调整)
      z: startZ + 6, // 往屏幕外(观众方向)靠一点
      ease: "power1.inOut",
      scrollTrigger: {
        trigger: ".step:nth-child(2)", // 当滚动到第二个 section 时触发
        start: "top 60%",              // 屏幕滚动到触发器顶部 60% 时开始
        end: "center center",          // 滚动到正中央时结束
        scrub: 1                       // 开启平滑滚动跟随
      }
    });

    // 2. 飞出时带一点优雅的旋转
    gsap.to(leftEarbud.rotation, {
      x: leftEarbud.rotation.x - Math.PI / 4, // 抬头
      y: leftEarbud.rotation.y + Math.PI / 2, // 侧转展示侧面
      ease: "power1.inOut",
      scrollTrigger: {
        trigger: ".step:nth-child(2)",
        start: "top 60%",
        end: "center center",
        scrub: 1
      }
    });
  } else {
    console.warn("未找到耳机模型，无法添加飞出动画！请检查 child.name");
  }
}, 2000); // 简单用 2 秒延迟确保模型加载完，生产环境建议放在 loader 的回调中