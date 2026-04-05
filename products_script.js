import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import GUI from 'lil-gui'; // 🌟 引入 lil-gui
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

// 鼠标状态 (用于视差排斥)
const mouse = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };
// 🌟 新增：用于 3D 射线检测的变量
const raycaster = new THREE.Raycaster();
const raycastMouse = new THREE.Vector2(-9999, -9999);
const clock = new THREE.Clock();

// UI DOM 引用
const introUi = document.getElementById('intro-ui');
const stage2Ui = document.getElementById('stage2-ui');
const mainWrapper = document.getElementById('main-wrapper');
const backBtn = document.getElementById('reset-btn');
const cursorHint = document.getElementById('cursor-hint');
initGlobalNav(); // 初始化全局导航

// ==========================================
// 🌟 1. Three.js 基础环境
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('webgl-mount').appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// ==========================================
// 🌟 2. 核心架构：包裹组 (解耦动画)
// ==========================================
// A. 视差包裹组：专门接收鼠标排斥效果
const parallaxGroup = new THREE.Group();
scene.add(parallaxGroup);

// B. 模型存放组
const gltfLoader = new GLTFLoader();
const models = { storage: null, sensor: null };

const projectedPosition = new THREE.Vector3();
let trackingPoints = []; // 声明为空数组，稍后在模型加载后填充
let isAssetsLoaded = false;

// ==========================================
// 🌟 2. 定义 GUI 控制参数 (Debug Config)
// ==========================================
// 这组数据是你通过面板调出来的“理想状态”，记录在这里
const config = {
    // 阶段 1 (初始全屏) 的理想位置
    stage1: {
        "storage": {
            "x": 2.4,
            "y": 0.92,
            "z": -7.8,
            "rx": -0.703716754404113,
            "ry": 0.314159265358979,
            "rz": 1.06814150222053,
            "scale": 0.361
        },
        "sensor": {
            "x": 1.32,
            "y": 1.16,
            "z": 9.4,
            "rx": -2.04831841014054,
            "ry": 0.326725635973339,
            "rz": 0.540353936417445,
            "scale": 0.2856
        }
    },
    // 阶段 2 (居中聚焦) 的理想位置
    stage2: {
        "storage": {
            "storage": {
                "x": -2.54,
                "y": -6.22,
                "z": -4.02,
                "rx": -0.182212373908208,
                "ry": 2.29336263712055,
                "rz": 0.515221195188726,
                "scale": 0.4335
            },
            "sensor": {
                "x": 10,
                "y": -10,
                "z": 4.34,
                "rx": -2.04831841014054,
                "ry": 0.326725635973339,
                "rz": 0.540353936417445,
                "scale": 0.3262
            }
        },
        "sensor": {
            "storage": {
                "x": -9.42,
                "y": 7.06,
                "z": 0.42,
                "rx": -0.703716754404113,
                "ry": 0.314159265358979,
                "rz": 1.06814150222053,
                "scale": 0.361
            },
            "sensor": {
                "x": -2.04,
                "y": 3.12,
                "z": 5.58,
                "rx": -2.1865484868985,
                "ry": -3.141592653589793,
                "rz": 0.747699051554371,
                "scale": 0.4335
            }
        }
    },
    // 阶段 3 (展开参数) 的理想位置
    stage3: {
        "storage": {
            "x": -2.54,
            "y": -6.22,
            "z": -4.02,
            "rx": -0.182212373908208,
            "ry": 2.29336263712055,
            "rz": 0.515221195188726,
            "scale": 0.5335
        },
        "sensor": {
            "x": -2.04,
            "y": 3.12,
            "z": 5.58,
            "rx": -2.1865484868985,
            "ry": -3.141592653589793,
            "rz": 0.747699051554371,
            "scale": 0.4335
        }
    }
};

// ==========================================
// 🌟 3. 初始化 lil-gui 面板
// ==========================================
function setupGUI() {
    const gui = new GUI({ title: '晶圆位置调试器 (Debug)' });

    // 如果不在第一阶段，提示用户返回，防止坐标冲突
    gui.add({ msg: '请在 Stage 1 调试初始位置' }, 'msg').name('⚠️ 注意');

    const folderStorage = gui.addFolder('Storage 晶圆 (Stage 1)');
    folderStorage.add(config.stage1.storage, 'x', -10, 10).onChange(updateModelTransforms);
    folderStorage.add(config.stage1.storage, 'y', -10, 10).onChange(updateModelTransforms);
    folderStorage.add(config.stage1.storage, 'z', -10, 10).onChange(updateModelTransforms);
    folderStorage.add(config.stage1.storage, 'rx', -Math.PI, Math.PI).name('rot X').onChange(updateModelTransforms);
    folderStorage.add(config.stage1.storage, 'ry', -Math.PI, Math.PI).name('rot Y').onChange(updateModelTransforms);
    folderStorage.add(config.stage1.storage, 'rz', -Math.PI, Math.PI).name('rot Z').onChange(updateModelTransforms);
    folderStorage.add(config.stage1.storage, 'scale', 0.1, 3).onChange(updateModelTransforms);

    const folderSensor = gui.addFolder('Sensor 晶圆 (Stage 1)');
    folderSensor.add(config.stage1.sensor, 'x', -10, 10).onChange(updateModelTransforms);
    folderSensor.add(config.stage1.sensor, 'y', -10, 10).onChange(updateModelTransforms);
    folderSensor.add(config.stage1.sensor, 'z', -10, 10).onChange(updateModelTransforms);
    folderSensor.add(config.stage1.sensor, 'rx', -Math.PI, Math.PI).name('rot X').onChange(updateModelTransforms);
    folderSensor.add(config.stage1.sensor, 'ry', -Math.PI, Math.PI).name('rot Y').onChange(updateModelTransforms);
    folderSensor.add(config.stage1.sensor, 'rz', -Math.PI, Math.PI).name('rot Z').onChange(updateModelTransforms);
    folderSensor.add(config.stage1.sensor, 'scale', 0.1, 3).onChange(updateModelTransforms);

    // 一键导出按钮：在控制台打印出调好的 JSON 坐标，方便你复制回代码
    gui.add({
        exportConfig: () => {
            console.log("=== 当前调好的晶圆坐标 ===");
            console.log(JSON.stringify(config.stage1, null, 2));
            alert("已打印到浏览器 Console (F12)！");
        }
    }, 'exportConfig').name('📥 一键打印当前坐标');
}

// GUI 拖动时实时更新模型
function updateModelTransforms() {
    if (currentState !== STATES.STAGE_1_INTRO || !models.storage || !models.sensor) return;

    // 应用 Storage
    models.storage.position.set(config.stage1.storage.x, config.stage1.storage.y, config.stage1.storage.z);
    models.storage.rotation.set(config.stage1.storage.rx, config.stage1.storage.ry, config.stage1.storage.rz);
    models.storage.scale.setScalar(config.stage1.storage.scale);

    // 应用 Sensor
    models.sensor.position.set(config.stage1.sensor.x, config.stage1.sensor.y, config.stage1.sensor.z);
    models.sensor.rotation.set(config.stage1.sensor.rx, config.stage1.sensor.ry, config.stage1.sensor.rz);
    models.sensor.scale.setScalar(config.stage1.sensor.scale);
}

// ==========================================
// 🌟 4. 加载模型与动画解耦 (替身模式)
// ==========================================
const STORAGE_MODEL_PATH = './box1.glb';
const SENSOR_MODEL_PATH = './box1.glb';

function extractWafer(gltf, targetName) {
    const wrapper = new THREE.Group();     // 外层包裹组 (交给 GSAP 控制位移和宏观旋转)
    const innerGroup = new THREE.Group();  // 内层组 (交给 requestAnimationFrame 控制微重力浮动)

    const wLeft = targetName === 1 ? gltf.scene.getObjectByName('Waferleft') : null;
    const wRight = targetName === 2 ? gltf.scene.getObjectByName('Waferright') : null;
    if (wLeft) innerGroup.add(wLeft);
    if (wRight) innerGroup.add(wRight);

    wrapper.add(innerGroup);
    wrapper.userData.inner = innerGroup; // 存储内部组引用
    return wrapper;
}

Promise.all([
    new Promise((res, rej) => gltfLoader.load(STORAGE_MODEL_PATH, res, undefined, rej)),
    new Promise((res, rej) => gltfLoader.load(SENSOR_MODEL_PATH, res, undefined, rej))
]).then(([gltf1, gltf2]) => {

    models.storage = extractWafer(gltf1, 1);
    parallaxGroup.add(models.storage);

    models.sensor = extractWafer(gltf2, 2);
    parallaxGroup.add(models.sensor);

    // 🌟 初始化追踪点矩阵
    trackingPoints = [
        {
            elementId: '#track-storage',
            meshRef: () => models.storage.userData.inner,
            localPos: new THREE.Vector3(-1.0, 1.5, 0) // Storage 晶圆边缘锚点 (可微调)
        },
        {
            elementId: '#track-sensor',
            meshRef: () => models.sensor.userData.inner,
            localPos: new THREE.Vector3(-1.5, 1.0, 0) // Sensor 晶圆边缘锚点 (可微调)
        },
        {
            elementId: '#track-mems',
            meshRef: () => models.sensor.userData.inner,
            localPos: new THREE.Vector3(1.5, -2.0, 0) // Mems 悬臂梁边缘锚点 (可微调)
        }
    ];

    trackingPoints.forEach(point => {
        point.domElement = document.querySelector(point.elementId);
    });

    isAssetsLoaded = true;

    setupGUI(); // 调试用
    resetToStage1();
});

// ==========================================
// 🌟 5. 生长动画引擎
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
// 🌟 6. 核心流转 (保持之前逻辑不变，绑定点击事件)
// ==========================================
function resetToStage1() {
    currentState = STATES.STAGE_1_INTRO;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    const tl = gsap.timeline();
    // 🌟 增加隐藏 stage2Ui
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

// ▶️ 监听用户点击：进入阶段 2 (拉近聚焦)
document.querySelectorAll('.wafer-hotspot').forEach(hotspot => {
    hotspot.addEventListener('click', (e) => {
        if (currentState !== STATES.STAGE_1_INTRO) return;

        currentState = STATES.STAGE_2_FOCUS;
        selectedWafer = e.currentTarget.getAttribute('data-target');

        // 🌟 1. 动态切换 Stage 2 的文案内容
        document.querySelectorAll('.stage2-content').forEach(el => el.style.display = 'none');
        document.getElementById(`stage2-content-${selectedWafer}`).style.display = 'block';

        const tl = gsap.timeline();

        // 2. 隐藏 Stage 1 选型 UI
        tl.to(introUi, { opacity: 0, pointerEvents: 'none', duration: 0.5 });

        // 🌟 3. 核心：根据当前选中的晶圆，获取两片晶圆专属的 stage2 目标坐标
        const storageTarget = config.stage2[selectedWafer].storage;
        const sensorTarget = config.stage2[selectedWafer].sensor;

        // 🌟 4. 3D 模型镜头推演：各自飞向指定坐标，不再粗暴隐藏
        // 控制 Storage 晶圆
        tl.to(models.storage.position, { x: storageTarget.x, y: storageTarget.y, z: storageTarget.z, duration: 1.5, ease: "power3.out" }, 0)
            .to(models.storage.rotation, { x: storageTarget.rx, y: storageTarget.ry, z: storageTarget.rz, duration: 1.5 }, 0)
            .to(models.storage.scale, { x: storageTarget.scale, y: storageTarget.scale, z: storageTarget.scale, duration: 1.5 }, 0);

        // 控制 Sensor 晶圆
        tl.to(models.sensor.position, { x: sensorTarget.x, y: sensorTarget.y, z: sensorTarget.z, duration: 1.5, ease: "power3.out" }, 0)
            .to(models.sensor.rotation, { x: sensorTarget.rx, y: sensorTarget.ry, z: sensorTarget.rz, duration: 1.5 }, 0)
            .to(models.sensor.scale, { x: sensorTarget.scale, y: sensorTarget.scale, z: sensorTarget.scale, duration: 1.5 }, 0);

        // 5. 淡入 Stage 2 的特写文字 UI
        const stage2Ui = document.getElementById('stage2-ui');
        if (stage2Ui) {
            tl.to(stage2Ui, { opacity: 1, duration: 1, ease: "power2.out" }, 0.5);
        }

        // 6. 定时进入阶段 3 (可以调长一点时间让用户看清双晶圆的伴飞排版)
        stage2Timeout = setTimeout(() => {
            if (currentState === STATES.STAGE_2_FOCUS) goToStage3();
        }, 10000);
    });
});

window.addEventListener('click', () => {
    if (currentState !== STATES.STAGE_1_INTRO || !models.storage || !models.sensor) return;

    // 发射射线检测
    raycaster.setFromCamera(raycastMouse, camera);
    const intersectsStorage = raycaster.intersectObject(models.storage.userData.inner, true);
    const intersectsSensor = raycaster.intersectObject(models.sensor.userData.inner, true);

    let target = null;
    if (intersectsStorage.length > 0) target = 'storage';
    else if (intersectsSensor.length > 0) target = 'sensor';

    if (!target) return; // 没点中就退出

    currentState = STATES.STAGE_2_FOCUS;
    selectedWafer = target; // 记录当前点中的是 'storage' 还是 'sensor'

    // 🌟 1. 动态切换 Stage 2 的文案内容
    document.querySelectorAll('.stage2-content').forEach(el => el.style.display = 'none');
    document.getElementById(`stage2-content-${selectedWafer}`).style.display = 'block';

    const tl = gsap.timeline();

    // 2. 隐藏 Stage 1 选型 UI
    tl.to(introUi, { opacity: 0, pointerEvents: 'none', duration: 0.5 });

    // 🌟 3. 核心：根据当前选中的晶圆，获取两片晶圆专属的 stage2 目标坐标
    const storageTarget = config.stage2[selectedWafer].storage;
    const sensorTarget = config.stage2[selectedWafer].sensor;

    // 🌟 4. 3D 模型镜头推演：各自飞向指定坐标，不再粗暴隐藏
    // 控制 Storage 晶圆
    tl.to(models.storage.position, { x: storageTarget.x, y: storageTarget.y, z: storageTarget.z, duration: 1.5, ease: "power3.out" }, 0)
        .to(models.storage.rotation, { x: storageTarget.rx, y: storageTarget.ry, z: storageTarget.rz, duration: 1.5 }, 0)
        .to(models.storage.scale, { x: storageTarget.scale, y: storageTarget.scale, z: storageTarget.scale, duration: 1.5 }, 0);

    // 控制 Sensor 晶圆
    tl.to(models.sensor.position, { x: sensorTarget.x, y: sensorTarget.y, z: sensorTarget.z, duration: 1.5, ease: "power3.out" }, 0)
        .to(models.sensor.rotation, { x: sensorTarget.rx, y: sensorTarget.ry, z: sensorTarget.rz, duration: 1.5 }, 0)
        .to(models.sensor.scale, { x: sensorTarget.scale, y: sensorTarget.scale, z: sensorTarget.scale, duration: 1.5 }, 0);

    // 5. 淡入 Stage 2 的特写文字 UI
    const stage2Ui = document.getElementById('stage2-ui');
    if (stage2Ui) {
        tl.to(stage2Ui, { opacity: 1, duration: 1, ease: "power2.out" }, 0.5);
    }

    // 6. 定时进入阶段 3 (可以调长一点时间让用户看清双晶圆的伴飞排版)
    stage2Timeout = setTimeout(() => {
        if (currentState === STATES.STAGE_2_FOCUS) goToStage3();
    }, 10000);
});

window.addEventListener('wheel', (e) => {
    if (currentState === STATES.STAGE_2_FOCUS) {
        clearTimeout(stage2Timeout);
        if (e.deltaY > 0) goToStage3();
        else if (e.deltaY < 0) resetToStage1();
    }
});

function goToStage3() {
    currentState = STATES.STAGE_3_SPECS;
    const activeModel = selectedWafer === 'storage' ? models.storage : models.sensor;

    document.getElementById(`grid-${selectedWafer}`).style.display = 'block';

    // 🌟 获取进入 Stage 3 时主角晶圆的专属配置
    const targetConfig = config.stage3[selectedWafer];

    const tl = gsap.timeline();

    // 🌟 1. 淡出 Stage 2 聚焦 UI
    tl.to(stage2Ui, { opacity: 0, duration: 0.5 }, 0);

    // 2. 3D 模型偏左
    tl.to(activeModel.position, { x: targetConfig.x, y: targetConfig.y, z: targetConfig.z, duration: 1.5, ease: "power3.inOut" }, 0)
        .to(activeModel.rotation, { x: targetConfig.rx, y: targetConfig.ry, z: targetConfig.rz, duration: 1.5 }, 0)
        .to(activeModel.scale, { x: targetConfig.scale, y: targetConfig.scale, z: targetConfig.scale, duration: 1.5 }, 0);

    // 3. 呼出 Stage 3 的参数网格
    tl.to([mainWrapper, backBtn], {
        opacity: 1,
        duration: 1,
        pointerEvents: 'auto', // GSAP 会自动把两个元素的 pointer-events 改为 auto
        onStart: () => {
            document.body.style.overflow = 'auto';
        }
    }, "-=1");

    ScrollTrigger.getAll().forEach(t => t.kill());
    gsap.to(activeModel.rotation, {
        scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: 1.5 },
        y: "+=" + Math.PI,
        ease: "none"
    });
}

backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentState === STATES.STAGE_3_SPECS) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(resetToStage1, 600);
    }
});

window.addEventListener('mousemove', (event) => {
    mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = -(event.clientY / window.innerHeight) * 2 + 1;
});

// ==========================================
// 🌟 7. 渲染循环 (投影追踪与物理排斥)
// ==========================================
function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // 1. 鼠标排斥视差
    mouse.currentX += (mouse.targetX - mouse.currentX) * 0.05;
    mouse.currentY += (mouse.targetY - mouse.currentY) * 0.05;
    parallaxGroup.position.x = -mouse.currentX * 0.5;
    parallaxGroup.position.y = -mouse.currentY * 0.5;

    // 2. 微重力漂浮 (解耦控制内部)
    if (currentState === STATES.STAGE_1_INTRO || currentState === STATES.STAGE_2_FOCUS) {
        if (models.storage && models.storage.userData.inner) {
            models.storage.userData.inner.position.y = Math.sin(time * 1.5) * 0.1;
            models.storage.userData.inner.rotation.z = Math.cos(time * 1.2) * 0.02;
        }
        if (models.sensor && models.sensor.userData.inner) {
            models.sensor.userData.inner.position.y = Math.cos(time * 1.8) * 0.12;
            models.sensor.userData.inner.rotation.x = Math.sin(time * 1.1) * 0.02;
        }
    }

    // ----------------------------------------------------
    // 🌟 新增：3D 射线悬浮检测与平滑缩放
    // ----------------------------------------------------
    if (currentState === STATES.STAGE_1_INTRO && models.storage && models.sensor) {
        raycaster.setFromCamera(raycastMouse, camera);

        const intersectsStorage = raycaster.intersectObject(models.storage.userData.inner, true);
        const intersectsSensor = raycaster.intersectObject(models.sensor.userData.inner, true);

        let targetScaleStorage = 1.0;
        let targetScaleSensor = 1.0;
        let isHovering = false;

        if (intersectsStorage.length > 0) {
            targetScaleStorage = 1.08;
            isHovering = true;
        } else if (intersectsSensor.length > 0) {
            targetScaleSensor = 1.08;
            isHovering = true;
        }

        document.body.style.cursor = isHovering ? 'pointer' : 'default';

        // 🌟 控制鼠标跟随提示的显示与高亮状态
        if (cursorHint) {
            cursorHint.classList.add('is-visible'); // 在 Stage 1 保持显示
            if (isHovering) {
                cursorHint.classList.add('is-hovering');
                cursorHint.innerText = "点击进入特写";
            } else {
                cursorHint.classList.remove('is-hovering');
                cursorHint.innerText = "点击晶圆探索";
            }
        }

        models.storage.userData.inner.scale.lerp(new THREE.Vector3(targetScaleStorage, targetScaleStorage, targetScaleStorage), 0.1);
        models.sensor.userData.inner.scale.lerp(new THREE.Vector3(targetScaleSensor, targetScaleSensor, targetScaleSensor), 0.1);

    } else if (models.storage && models.sensor) {
        models.storage.userData.inner.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        models.sensor.userData.inner.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        document.body.style.cursor = 'default';

        // 🌟 不在 Stage 1 时，彻底隐藏提示框
        if (cursorHint) cursorHint.classList.remove('is-visible');
    }

    // ----------------------------------------------------
    // 🌟 3. 核心 3D->2D 投影引擎
    // ----------------------------------------------------
    if (isAssetsLoaded && camera) {
        trackingPoints.forEach(point => {
            const parentLayer = point.domElement?.closest('.ui-layer');
            // 只运算可见阶段，极大节省性能
            if (point.domElement && parentLayer && window.getComputedStyle(parentLayer).opacity > 0) {
                const targetMesh = point.meshRef();
                if (targetMesh) {
                    projectedPosition.copy(point.localPos);
                    targetMesh.localToWorld(projectedPosition);
                    projectedPosition.project(camera);

                    // 映射到屏幕中心偏移坐标系
                    const x = (projectedPosition.x * window.innerWidth * 0.5);
                    const y = -(projectedPosition.y * window.innerHeight * 0.5);

                    // 应用硬件加速的位移，死死黏在模型表面
                    point.domElement.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
                }
            }
        });
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('mousemove', (event) => {
    // 视差排斥用 (0.05 缓动)
    mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = -(event.clientY / window.innerHeight) * 2 - 1;

    // 3D 射线检测用 (实时坐标)
    raycastMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    raycastMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 🌟 控制鼠标跟随提示的位置 (利用 GSAP 实现极度丝滑的微延迟跟随)
    if (cursorHint) {
        gsap.to(cursorHint, {
            x: event.clientX + 15, // 偏移鼠标右侧 15px
            y: event.clientY + 15, // 偏移鼠标下方 15px
            duration: 0.15,
            ease: "power2.out"
        });
    }
});
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});