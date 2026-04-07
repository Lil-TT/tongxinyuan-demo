import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { initGlobalNav } from './nav.js';

gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 🌟 0. 状态机定义
// ==========================================
const STATES = {
    LOADING: 0,
    STAGE_1_INTRO: 1,
    STAGE_2_FOCUS: 2,
    STAGE_3_SPECS: 3
};
let currentState = STATES.LOADING;
let selectedWafer = null;
let stage2Timeout = null;

const mouse = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };
const raycaster = new THREE.Raycaster();
const raycastMouse = new THREE.Vector2(-9999, -9999);
const clock = new THREE.Clock();

const introUi = document.getElementById('intro-ui');
const stage2Ui = document.getElementById('stage2-ui');
const mainWrapper = document.getElementById('main-wrapper');
const backBtn = document.getElementById('reset-btn');
const cursorHint = document.getElementById('cursor-hint');

// ==========================================
// 🌟 开场动画 DOM 元素
// ==========================================
const loaderW = document.querySelector('.loader-w');
const tagcloudW = document.querySelector('.tagcloud-w');
const counterEl = document.getElementById('counter');
const webglContainer = document.querySelector('.webgl-container');

initGlobalNav();

// ==========================================
// 🌟 1. Three.js 基础环境与影视级灯光
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('webgl-mount').appendChild(renderer.domElement);

// 灯光系统
const ambientLight = new THREE.AmbientLight(0x354766, 0.5);
scene.add(ambientLight);
const leftMainLight = new THREE.PointLight(0xebf6fc, 2);
leftMainLight.position.set(-4, 2.5, 3);
leftMainLight.castShadow = true;
leftMainLight.shadow.mapSize.width = 1024;
leftMainLight.shadow.mapSize.height = 1024;
leftMainLight.shadow.bias = -0.0001;
scene.add(leftMainLight);
const rightMainLight = new THREE.PointLight(0xebf6fc, 2);
rightMainLight.position.set(4, 2.5, 3);
rightMainLight.castShadow = true;
rightMainLight.shadow.mapSize.width = 1024;
rightMainLight.shadow.mapSize.height = 1024;
rightMainLight.shadow.bias = -0.0001;
scene.add(rightMainLight);
const topFillLight = new THREE.PointLight(0x88aaff, 1.5);
topFillLight.position.set(0, 5, 2);
scene.add(topFillLight);
const bottomFillLight = new THREE.PointLight(0x5588aa, 0.5);
bottomFillLight.position.set(0, -3, 1);
scene.add(bottomFillLight);

// 核心组
const parallaxGroup = new THREE.Group();
scene.add(parallaxGroup);

// 加载器与资源
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const hdrLoader = new HDRLoader().setDataType(THREE.FloatType);

const models = { storage: null, sensor: null };
const projectedPosition = new THREE.Vector3();
let trackingPoints = [];
let isAssetsLoaded = false;

// 配置数据
const config = {
    stage1: {
        "storage": { "x": 2.4, "y": 0.92, "z": -7.8, "rx": -0.703716754404113, "ry": 0.314159265358979, "rz": 1.06814150222053, "scale": 0.32 },
        "sensor": { "x": 1.32, "y": 1.16, "z": 9.4, "rx": -2.04831841014054, "ry": 0.326725635973339, "rz": 0.540353936417445, "scale": 0.256 }
    },
    stage2: {
        "storage": {
            "storage": { "x": -2.54, "y": -4.22, "z": -4.02, "rx": -0.182212373908208, "ry": 2.29336263712055, "rz": 0.515221195188726, "scale": 0.4 },
            "sensor": { "x": 10, "y": -10, "z": 4.34, "rx": -2.04831841014054, "ry": 0.326725635973339, "rz": 0.540353936417445, "scale": 0.3262 }
        },
        "sensor": {
            "storage": { "x": -9.42, "y": 7.06, "z": 0.42, "rx": -0.703716754404113, "ry": 0.314159265358979, "rz": 1.06814150222053, "scale": 0.361 },
            "sensor": { "x": -2.04, "y": 3.12, "z": 5.58, "rx": -2.1865484868985, "ry": -3.141592653589793, "rz": 0.747699051554371, "scale": 0.4335 }
        }
    },
    stage3: {
        "storage": { "x": -2.54, "y": -6.22, "z": -4.02, "rx": -0.182212373908208, "ry": 2.29336263712055, "rz": 0.515221195188726, "scale": 0.5335 },
        "sensor": { "x": -2.04, "y": 3.12, "z": 5.58, "rx": -2.1865484868985, "ry": -3.141592653589793, "rz": 0.747699051554371, "scale": 0.4335 }
    }
};

// ==========================================
// 🌟 模型提取与材质函数
// ==========================================
function extractWafer(gltf, targetName) {
    const wrapper = new THREE.Group();
    const innerGroup = new THREE.Group();
    const wLeft = targetName === 1 ? gltf.scene.getObjectByName('Waferleft') : null;
    const wRight = targetName === 2 ? gltf.scene.getObjectByName('Waferright') : null;
    if (wLeft) innerGroup.add(wLeft);
    if (wRight) innerGroup.add(wRight);
    wrapper.add(innerGroup);
    wrapper.userData.inner = innerGroup;
    return wrapper;
}

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

// ==========================================
// 🌟 开场动画相关变量与函数
// ==========================================
let spinCycleRunning = false;
let spinCycleInterrupted = false;
let animationStartTime = null;
let currentSpinCycleTl = null;

function playSpinCycle() {
    if (spinCycleRunning) return;
    spinCycleRunning = true;
    spinCycleInterrupted = false;

    const circles = document.querySelectorAll('.loader__circle:nth-child(-n+6)');
    currentSpinCycleTl = gsap.to(circles, {
        rotationX: "+=360",
        duration: 3.5,
        ease: 'power3.inOut',
        stagger: 0.12,
        onComplete: () => {
            spinCycleRunning = false;
            if (!spinCycleInterrupted && !isAssetsLoaded) {
                playSpinCycle();
            } else if (isAssetsLoaded) {
                forceEnterMainScene();
            }
        }
    });
}

function forceEnterMainScene() {
    // 如果还未到最短显示时间（0.6秒），则延迟执行
    if (animationStartTime) {
        const elapsed = performance.now() - animationStartTime;
        const minDisplayTime = 2000; // 毫秒
        if (elapsed < minDisplayTime) {
            const delay = minDisplayTime - elapsed;
            setTimeout(() => {
                if (spinCycleRunning) {
                    spinCycleInterrupted = true;
                    if (currentSpinCycleTl) currentSpinCycleTl.kill();
                    spinCycleRunning = false;
                }
                enterMainScene();
            }, delay);
            return;
        }
    }

    // 已满足最小时长，立即中断并进入
    if (spinCycleRunning) {
        spinCycleInterrupted = true;
        if (currentSpinCycleTl) currentSpinCycleTl.kill();
        spinCycleRunning = false;
    }
    enterMainScene();
}

function enterMainScene() {
    const enterTl = gsap.timeline();
    enterTl
        .to(loaderW, { scale: 0.5, opacity: 0, filter: 'blur(10px)', duration: 1.0, ease: 'power3.inOut' }, 0)
        .to(tagcloudW, { opacity: 0, duration: 0.8 }, 0)
        .to(webglContainer, { opacity: 1, duration: 1.0, ease: 'power2.out' }, 0)
        .call(() => {
            if (loaderW) loaderW.style.display = 'none';
            if (tagcloudW) tagcloudW.style.display = 'none';
            if (webglContainer) webglContainer.style.opacity = '1';
            resetToStage1();
        }, null, 0.8);
}

function initLoaderAnimation() {
    gsap.set('.loader__circle', { opacity: 0, filter: 'blur(16px)', rotationZ: -45 });
    gsap.set('.tagcloud--item', { opacity: 0 });

    const introTl = gsap.timeline({ delay: 0.5 });
    introTl
        .to('.loader__circle', { opacity: 1, filter: 'blur(0px)', duration: 2.5, ease: 'expo.out', stagger: { each: 0.15, from: "end" } }, 0)
        .to('.tagcloud--item', { opacity: 1, duration: 1, stagger: 0.2 }, 1)
        .call(() => {
            animationStartTime = performance.now();
            playSpinCycle();
        }, null, 1.0);
}

// ==========================================
// 🌟 加载管理器与进度跟踪
// ==========================================
const counterObj = { val: 0 };
const manager = new THREE.LoadingManager();

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
            if (targetPercent >= 99.9 && !isAssetsLoaded) {
                setTimeout(() => {
                    if (!isAssetsLoaded) {
                        isAssetsLoaded = true;
                        forceEnterMainScene();
                    }
                }, 50);
            }
        }
    });
};

// 让所有 loader 共用同一个 manager
const gltfLoaderWithManager = new GLTFLoader(manager);
const textureLoaderWithManager = new THREE.TextureLoader(manager);
const hdrLoaderWithManager = new HDRLoader(manager).setDataType(THREE.FloatType);

const STORAGE_MODEL_PATH = './box6.glb';

Promise.all([
    new Promise((res, rej) => gltfLoaderWithManager.load(STORAGE_MODEL_PATH, res, undefined, rej)),
    new Promise((res) => hdrLoaderWithManager.load("./studio_small_09_2k.hdr", res)),
    new Promise((res) => textureLoaderWithManager.load("./img/B1.png", res)),
    new Promise((res) => textureLoaderWithManager.load("./img/A1.png", res)),
    new Promise((res) => textureLoaderWithManager.load("./img/B1.png", res))
]).then(([gltf1, hdrTexture, texLeft, texRightTop, texRightBottom]) => {
    // HDR 环境贴图
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const currentEnvMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
    scene.environment = currentEnvMap;
    pmremGenerator.dispose();

    configureTexture(texRightTop, 2, 2);
    configureTexture(texRightBottom, 2, 2);
    configureTexture(texLeft, 2, 2, 0, 1);

    const createWaferMaterial = (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(1, 1);
        texture.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: texture,
            emissiveMap: texture,
            emissive: 0xffffff,
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 1,
            side: THREE.FrontSide,
        });
    };
    const matRightFront = createWaferMaterial(texRightTop);

    models.storage = extractWafer(gltf1, 1);
    models.sensor = extractWafer(gltf1, 2);

    // Storage 晶圆材质 UV 处理
    models.storage.userData.inner.traverse((mesh) => {
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
                for (let i = 0; i < uvArray.length; i += 2) {
                    uvArray[i] = (uvArray[i] - minU) / rangeU;
                    uvArray[i + 1] = (uvArray[i + 1] - minV) / rangeV;
                }
                uvAttribute.needsUpdate = true;
            }
            mesh.material = new THREE.MeshStandardMaterial({
                color: 0x222222, transparent: true, emissive: 0x222222, opacity: 1,
                roughness: 0.5, metalness: 0.5, map: texLeft,
                envMap: currentEnvMap, envMapIntensity: 1.5,
            });
            mesh.castShadow = true; mesh.receiveShadow = true;
        }
    });

    // Sensor 晶圆材质 UV 处理
    models.sensor.userData.inner.traverse((mesh) => {
        if (mesh.isMesh) {
            const geometry = mesh.geometry;
            const positions = geometry.attributes.position.array;
            const newUVs = new Float32Array((positions.length / 3) * 2);
            for (let i = 0; i < positions.length / 3; i++) {
                const x = positions[i * 3];
                const z = positions[i * 3 + 2];
                newUVs[i * 2] = (x + 2) / 4;
                newUVs[i * 2 + 1] = (z + 2) / 4;
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

    parallaxGroup.add(models.storage);
    parallaxGroup.add(models.sensor);

    // 追踪点初始化
    trackingPoints = [
        { elementId: '#track-storage', meshRef: () => models.storage.userData.inner, localPos: new THREE.Vector3(-1.0, 1.5, 0) },
        { elementId: '#track-sensor', meshRef: () => models.sensor.userData.inner, localPos: new THREE.Vector3(-1.5, 1.0, 0) },
        { elementId: '#track-mems', meshRef: () => models.sensor.userData.inner, localPos: new THREE.Vector3(1.5, -2.0, 0) }
    ];
    trackingPoints.forEach(point => {
        point.domElement = document.querySelector(point.elementId);
    });

    isAssetsLoaded = true;
    forceEnterMainScene(); // 确保资源加载完成后立即尝试进入（会检查最小时长）
}).catch(error => { console.error("加载错误:", error); });

// ==========================================
// 🌟 生长动画引擎
// ==========================================
function buildGuideLineAnim(selector) {
    const paths = document.querySelectorAll(`${selector} .guide-line path`);
    paths.forEach(path => {
        const length = path.getTotalLength() || 500;
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    });
    gsap.set(`${selector} .guide-line circle`, { scale: 0, transformOrigin: 'center' });
    gsap.set(`${selector} .param-text`, { opacity: 0, x: 20 });

    const tl = gsap.timeline();
    tl.to(`${selector} .guide-line circle:nth-of-type(1)`, { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.1 }, 0)
        .to(paths, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut', stagger: 0.1 }, "+=0.1")
        .to(`${selector} .guide-line circle:nth-of-type(2)`, { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.1 }, "-=0.2")
        .to(`${selector} .param-text`, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, "-=0.3");
    return tl;
}

// ==========================================
// 🌟 核心流转函数
// ==========================================
function resetToStage1() {
    currentState = STATES.STAGE_1_INTRO;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    if (models.storage) models.storage.visible = true;
    if (models.sensor) models.sensor.visible = true;

    const tl = gsap.timeline();
    tl.to([mainWrapper, backBtn, stage2Ui], { opacity: 0, duration: 0.5, pointerEvents: 'none' })
        .to('.wafer-data-section', { display: 'none' }, 0);

    tl.to(models.storage.position, { ...config.stage1.storage, duration: 1.5, ease: "power3.inOut" }, 0)
        .to(models.storage.rotation, { x: config.stage1.storage.rx, y: config.stage1.storage.ry, z: config.stage1.storage.rz, duration: 1.5 }, 0)
        .to(models.storage.scale, { x: config.stage1.storage.scale, y: config.stage1.storage.scale, z: config.stage1.storage.scale, duration: 1.5 }, 0);

    tl.to(models.sensor.position, { ...config.stage1.sensor, duration: 1.5, ease: "power3.inOut" }, 0)
        .to(models.sensor.rotation, { x: config.stage1.sensor.rx, y: config.stage1.sensor.ry, z: config.stage1.sensor.rz, duration: 1.5 }, 0)
        .to(models.sensor.scale, { x: config.stage1.sensor.scale, y: config.stage1.sensor.scale, z: config.stage1.sensor.scale, duration: 1.5 }, 0);

    tl.to(introUi, { opacity: 1, pointerEvents: 'none', duration: 0.5 }, "-=0.5");
    tl.add(buildGuideLineAnim('#intro-ui'), "-=0.2");
}

function goToStage3() {
    currentState = STATES.STAGE_3_SPECS;
    const activeModel = selectedWafer === 'storage' ? models.storage : models.sensor;
    document.getElementById(`grid-${selectedWafer}`).style.display = 'block';
    const targetConfig = config.stage3[selectedWafer];
    const tl = gsap.timeline();

    tl.to(stage2Ui, { opacity: 0, duration: 0.5 }, 0);
    tl.to(activeModel.position, { x: targetConfig.x, y: targetConfig.y, z: targetConfig.z, duration: 1.5, ease: "power3.inOut" }, 0)
        .to(activeModel.rotation, { x: targetConfig.rx, y: targetConfig.ry, z: targetConfig.rz, duration: 1.5 }, 0)
        .to(activeModel.scale, { x: targetConfig.scale, y: targetConfig.scale, z: targetConfig.scale, duration: 1.5 }, 0);

    tl.to([mainWrapper, backBtn], {
        opacity: 1, duration: 1, pointerEvents: 'auto',
        onStart: () => { document.body.style.overflow = 'auto'; },
        onComplete: () => {
            const specsEl = document.querySelector('.specs-w');
            if (specsEl) {
                void specsEl.offsetHeight;
                specsEl.style.backdropFilter = 'blur(24.9px)';
                requestAnimationFrame(() => { specsEl.style.backdropFilter = ''; });
            }
        }
    }, "-=1");

    ScrollTrigger.getAll().forEach(t => t.kill());
    const scrollTl = gsap.timeline({ scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: 1.5 } });
    let finalLayout = {};
    if (selectedWafer === 'storage') {
        finalLayout = { x: -1.5, y: -5.5, z: -15.0, rotY: "+=" + Math.PI * 2 };
    } else if (selectedWafer === 'sensor') {
        finalLayout = { x: -3.0, y: 1.5, z: 2.5, rotY: "+=" + Math.PI * 1.8 };
    }
    scrollTl.to(activeModel.position, { x: finalLayout.x, y: finalLayout.y, z: finalLayout.z, ease: "power2.inOut" }, 0)
        .to(activeModel.rotation, { y: finalLayout.rotY, ease: "none" }, 0);
}

// ==========================================
// 🌟 事件绑定
// ==========================================
document.querySelectorAll('.wafer-hotspot').forEach(hotspot => {
    hotspot.addEventListener('click', (e) => {
        if (currentState !== STATES.STAGE_1_INTRO) return;
        currentState = STATES.STAGE_2_FOCUS;
        selectedWafer = e.currentTarget.getAttribute('data-target');
        document.querySelectorAll('.stage2-content').forEach(el => el.style.display = 'none');
        document.getElementById(`stage2-content-${selectedWafer}`).style.display = 'block';

        const tl = gsap.timeline();
        tl.to(introUi, { opacity: 0, pointerEvents: 'none', duration: 0.5 });
        const storageTarget = config.stage2[selectedWafer].storage;
        const sensorTarget = config.stage2[selectedWafer].sensor;

        tl.to(models.storage.position, { x: storageTarget.x, y: storageTarget.y, z: storageTarget.z, duration: 1.5, ease: "power3.out" }, 0)
            .to(models.storage.rotation, { x: storageTarget.rx, y: storageTarget.ry, z: storageTarget.rz, duration: 1.5 }, 0)
            .to(models.storage.scale, { x: storageTarget.scale, y: storageTarget.scale, z: storageTarget.scale, duration: 1.5 }, 0);

        tl.to(models.sensor.position, { x: sensorTarget.x, y: sensorTarget.y, z: sensorTarget.z, duration: 1.5, ease: "power3.out" }, 0)
            .to(models.sensor.rotation, { x: sensorTarget.rx, y: sensorTarget.ry, z: sensorTarget.rz, duration: 1.5 }, 0)
            .to(models.sensor.scale, { x: sensorTarget.scale, y: sensorTarget.scale, z: sensorTarget.scale, duration: 1.5 }, 0);

        const stage2Ui = document.getElementById('stage2-ui');
        if (stage2Ui) tl.to(stage2Ui, { opacity: 1, duration: 1, ease: "power2.out" }, 0.5);
        stage2Timeout = setTimeout(() => { if (currentState === STATES.STAGE_2_FOCUS) goToStage3(); }, 10000);
    });
});

window.addEventListener('click', () => {
    if (!models.storage || !models.sensor) return;
    raycaster.setFromCamera(raycastMouse, camera);
    const intersectsStorage = raycaster.intersectObject(models.storage.userData.inner, true);
    const intersectsSensor = raycaster.intersectObject(models.sensor.userData.inner, true);

    if (currentState === STATES.STAGE_1_INTRO) {
        let target = null;
        if (intersectsStorage.length > 0) target = 'storage';
        else if (intersectsSensor.length > 0) target = 'sensor';
        if (!target) return;

        currentState = STATES.STAGE_2_FOCUS;
        selectedWafer = target;
        document.querySelectorAll('.stage2-content').forEach(el => el.style.display = 'none');
        document.getElementById(`stage2-content-${selectedWafer}`).style.display = 'block';

        const tl = gsap.timeline();
        tl.to(introUi, { opacity: 0, pointerEvents: 'none', duration: 0.5 });
        const storageTarget = config.stage2[selectedWafer].storage;
        const sensorTarget = config.stage2[selectedWafer].sensor;

        tl.to(models.storage.position, { x: storageTarget.x, y: storageTarget.y, z: storageTarget.z, duration: 1.5, ease: "power3.out" }, 0)
            .to(models.storage.rotation, { x: storageTarget.rx, y: storageTarget.ry, z: storageTarget.rz, duration: 1.5 }, 0)
            .to(models.storage.scale, { x: storageTarget.scale, y: storageTarget.scale, z: storageTarget.scale, duration: 1.5 }, 0);

        tl.to(models.sensor.position, { x: sensorTarget.x, y: sensorTarget.y, z: sensorTarget.z, duration: 1.5, ease: "power3.out" }, 0)
            .to(models.sensor.rotation, { x: sensorTarget.rx, y: sensorTarget.ry, z: sensorTarget.rz, duration: 1.5 }, 0)
            .to(models.sensor.scale, { x: sensorTarget.scale, y: sensorTarget.scale, z: sensorTarget.scale, duration: 1.5 }, 0);

        const stage2Ui = document.getElementById('stage2-ui');
        if (stage2Ui) tl.to(stage2Ui, { opacity: 1, duration: 1, ease: "power2.out" }, 0.5);
        stage2Timeout = setTimeout(() => { if (currentState === STATES.STAGE_2_FOCUS) goToStage3(); }, 10000);
    } else if (currentState === STATES.STAGE_2_FOCUS) {
        if (selectedWafer === 'storage' && intersectsStorage.length > 0) {
            clearTimeout(stage2Timeout);
            goToStage3();
        } else if (selectedWafer === 'sensor' && intersectsSensor.length > 0) {
            clearTimeout(stage2Timeout);
            goToStage3();
        }
    }
});

window.addEventListener('wheel', (e) => {
    if (currentState === STATES.STAGE_2_FOCUS) {
        clearTimeout(stage2Timeout);
        if (e.deltaY > 0) goToStage3();
        else if (e.deltaY < 0) resetToStage1();
    }
});

backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentState === STATES.STAGE_3_SPECS) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(resetToStage1, 600);
    }
});

// ==========================================
// 🌟 渲染循环与投影追踪
// ==========================================
window.addEventListener('mousemove', (event) => {
    mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = -(event.clientY / window.innerHeight) * 2 + 1;
    raycastMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    raycastMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    if (cursorHint) {
        gsap.to(cursorHint, { x: event.clientX + 15, y: event.clientY + 15, duration: 0.15, ease: "power2.out" });
    }
});

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    mouse.currentX += (mouse.targetX - mouse.currentX) * 0.05;
    mouse.currentY += (mouse.targetY - mouse.currentY) * 0.05;
    parallaxGroup.position.x = -mouse.currentX * 0.5;
    parallaxGroup.position.y = -mouse.currentY * 0.5;

    if ((currentState === STATES.STAGE_1_INTRO || currentState === STATES.STAGE_2_FOCUS) && models.storage && models.sensor) {
        if (models.storage.userData.inner) {
            models.storage.userData.inner.position.y = Math.sin(time * 1.5) * 0.1;
            models.storage.userData.inner.rotation.z = Math.cos(time * 1.2) * 0.02;
        }
        if (models.sensor.userData.inner) {
            models.sensor.userData.inner.position.y = Math.cos(time * 1.8) * 0.12;
            models.sensor.userData.inner.rotation.x = Math.sin(time * 1.1) * 0.02;
        }
    }

    // 悬浮检测与缩放
    if ((currentState === STATES.STAGE_1_INTRO || currentState === STATES.STAGE_2_FOCUS) && models.storage && models.sensor) {
        raycaster.setFromCamera(raycastMouse, camera);
        const intersectsStorage = raycaster.intersectObject(models.storage.userData.inner, true);
        const intersectsSensor = raycaster.intersectObject(models.sensor.userData.inner, true);
        let targetScaleStorage = 1.0, targetScaleSensor = 1.0, isHovering = false, hoveredWafer = null;
        if (intersectsStorage.length > 0) hoveredWafer = 'storage';
        else if (intersectsSensor.length > 0) hoveredWafer = 'sensor';

        if (currentState === STATES.STAGE_1_INTRO) {
            if (hoveredWafer === 'storage') { targetScaleStorage = 1.08; isHovering = true; }
            else if (hoveredWafer === 'sensor') { targetScaleSensor = 1.08; isHovering = true; }
            document.body.style.cursor = isHovering ? 'pointer' : 'default';
            if (cursorHint) {
                cursorHint.classList.add('is-visible');
                if (isHovering) { cursorHint.classList.add('is-hovering'); cursorHint.innerText = "点击进入特写"; }
                else { cursorHint.classList.remove('is-hovering'); cursorHint.innerText = "移动鼠标探索晶圆"; }
            }
        } else if (currentState === STATES.STAGE_2_FOCUS) {
            if (hoveredWafer === selectedWafer) {
                if (selectedWafer === 'storage') targetScaleStorage = 1.05;
                if (selectedWafer === 'sensor') targetScaleSensor = 1.05;
                isHovering = true;
            }
            document.body.style.cursor = isHovering ? 'pointer' : 'default';
            if (cursorHint) {
                cursorHint.classList.add('is-visible');
                if (isHovering) { cursorHint.classList.add('is-hovering'); cursorHint.innerText = "点击或向下滚动看参数"; }
                else { cursorHint.classList.remove('is-hovering'); cursorHint.innerText = "向上滚动可返回"; }
            }
        }
        models.storage.userData.inner.scale.lerp(new THREE.Vector3(targetScaleStorage, targetScaleStorage, targetScaleStorage), 0.1);
        models.sensor.userData.inner.scale.lerp(new THREE.Vector3(targetScaleSensor, targetScaleSensor, targetScaleSensor), 0.1);
    } else if (models.storage && models.sensor) {
        models.storage.userData.inner.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        models.sensor.userData.inner.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        document.body.style.cursor = 'default';
        if (cursorHint) cursorHint.classList.remove('is-visible');
    }

    // 3D 到 2D 投影
    if (isAssetsLoaded && camera) {
        trackingPoints.forEach(point => {
            const parentLayer = point.domElement?.closest('.ui-layer');
            if (point.domElement && parentLayer && window.getComputedStyle(parentLayer).opacity > 0) {
                const targetMesh = point.meshRef();
                if (targetMesh) {
                    projectedPosition.copy(point.localPos);
                    targetMesh.localToWorld(projectedPosition);
                    projectedPosition.project(camera);
                    const x = (projectedPosition.x * window.innerWidth * 0.5);
                    const y = -(projectedPosition.y * window.innerHeight * 0.5);
                    point.domElement.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
                }
            }
        });
    }

    renderer.render(scene, camera);
}
animate();

// 启动开场动画（如果 loader 元素存在）
if (loaderW && tagcloudW && counterEl) {
    initLoaderAnimation();
} else {
    console.warn('Loader DOM elements missing, skipping intro animation');
    if (webglContainer) webglContainer.style.opacity = '1';
    if (isAssetsLoaded) resetToStage1();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});