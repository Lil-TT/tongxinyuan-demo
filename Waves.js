import * as THREE from 'three';
import gsap from 'gsap'; // 如果 Waves 里用到了 gsap，别忘了在顶部引入

// ==========================================
// 🌟 纯净重构版 Waves 系统 (移除了 gl 与 audio 依赖，补齐了 Shader 算法)
// ==========================================
export default class Waves {
  constructor(noiseTexture) {
    this.instance = new THREE.Group();
    this.isAnimating = false;
    this.globalSpeed = 1.0;

    this.geometry = new THREE.PlaneGeometry(30, 30, 256, 256);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0.0 },
        uWaveTransition: { value: 0.0 },
        uLightIntensity: { value: 1.0 },
        uIntensity: { value: 1.0 },
        uFrequency: { value: 1.0 },
        uLightDirection: { value: new THREE.Vector3(3.0, 3.0, -1.0) },
        tNoise: { value: noiseTexture }, // 传入生成的噪点贴图
        COLOR_BASE: { value: new THREE.Color(0x133153) },
        COLOR_HIGHLIGHT: { value: new THREE.Color(0x32526f) },
        COLOR_LIGHT: { value: new THREE.Color(0x60b2ff) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec2 vUvn;
        varying vec3 vNormal;
        varying float vLight;
        varying float vTransitionLight;
        varying float vTransitionMask;
        varying float vWave;
        varying float vBigWave;

        uniform float uTime;
        uniform float uWaveTransition;
        uniform float uIntensity;
        uniform float uFrequency;
        uniform vec3 uLightDirection;
        uniform sampler2D tNoise;

        const float TRANSITION_SIZE = 2.;
        const float WAVE_STRENGTH = 6.;
        const float LIGHT_WIDTH = 2.0;

        // 🌟 补齐原本缺失的 getSmallWaves 算法
        float getSmallWaves(vec3 pos, float noise) {
            float waveX = sin(pos.x * 2.0 + uTime * uFrequency) * 0.1;
            float waveY = cos(pos.y * 2.0 + uTime * uFrequency) * 0.1;
            return (waveX + waveY) + noise * 0.2;
        }

        // 🌟 补齐原本缺失的 getBigWave 算法
        float getBigWave(vec3 pos) {
            float dist = length(pos.xy);
            return sin(dist * 0.5 - uTime * 2.0) * 1.2;
        }

        void main() {
          vec2 uvN = uv * 2.0 - 1.0;
          float textureNoise = 1.0 - texture2D(tNoise, uvN * 2.0).r * 2.0;

          vec3 center = position;
          vec3 neighbourX = position + vec3(0.01, 0.0, 0.0);
          vec3 neighbourY = position + vec3(0.0, -0.01, 0.0);

          float bigWave = getBigWave(position) * uIntensity;

          center.z += getSmallWaves(position, textureNoise) + bigWave;
          neighbourX.z += getSmallWaves(neighbourX, textureNoise) + getBigWave(neighbourX) * uIntensity;
          neighbourY.z += getSmallWaves(neighbourY, textureNoise) + getBigWave(neighbourY) * uIntensity;

          vec3 dx = neighbourX - center;
          vec3 dy = neighbourY - center;

          float localPosition = length(position) * 0.5;
          float transitionMask = length(position.x + position.y * 0.25);
          float transitionLight = max(1.0 - distance(localPosition, smoothstep(0.2, 1.0, uWaveTransition) * 5.5) * (LIGHT_WIDTH + (1.0 - smoothstep(0.2, 1.0, uWaveTransition))), 0.0);

          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(center, 1.0);

          vTransitionMask = transitionMask;
          vNormal = 1.0 - normalize(cross(dx, dy));
          vUv = uv;
          vUvn = uvN;
          vLight = max(dot(vNormal, uLightDirection), 0.0);
          vTransitionLight = transitionLight;
          vWave = center.z;
          vBigWave = bigWave;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec2 vUvn;
        varying vec3 vNormal;
        varying float vLight;
        varying float vTransitionLight;
        varying float vTransitionMask;
        varying float vWave;
        varying float vBigWave;

        uniform float uWaveTransition;
        uniform float uLightIntensity;
        uniform vec3 COLOR_BASE;
        uniform vec3 COLOR_HIGHLIGHT;
        uniform vec3 COLOR_LIGHT;

        void main() {
          float alpha = smoothstep(1.0, 0.5, length(vUvn));
          float centerShadow = smoothstep(0.0, 0.5, length(vUvn));
          float vignette = smoothstep(0.25, 0.75, length(vUvn));
          float centerHighlight = smoothstep(0.0, 0.25, length(vUvn));

          vec3 color = mix(COLOR_BASE, COLOR_HIGHLIGHT, vLight);
          color += vec3(0.5, 0.75, 1.0) * pow(max(1.0 - distance(vUv, vec2(0.85, 1.0)), 0.0) * 4.0, 4.0) * 0.01;
          color *= min(pow(distance(vUv, vec2(0.0)) * 1.5, 6.0), 1.0); 
          color *= centerShadow; 
          color = mix(color, COLOR_BASE, vignette); 
          color *= clamp(vLight * 0.3, 0.0, 1.0); 
          color *= 1.0 - clamp(vBigWave, 0.0, 1.0) * 0.25; 
          color = mix(color, COLOR_LIGHT, vTransitionLight * smoothstep(1.0, 0.75, uWaveTransition) * smoothstep(0.0, 0.05, uWaveTransition) * uLightIntensity); 
          color += smoothstep(0.5, 1.0,vTransitionLight) * 1.25 * smoothstep(1.0, 0.75, uWaveTransition) * smoothstep(0.0, 0.05, uWaveTransition) * smoothstep(3.0, 6., vTransitionMask) * uLightIntensity; 
          color = min(color, vec3(0.65)); 
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI * 0.425;
    // 调整了一下初始位置，让他适应你的场景中心
    this.mesh.position.set(0, -6, -5); 
    this.mesh.renderOrder = 1;
    this.instance.add(this.mesh);

    // 复制材质用于线框
    this.wireframeMaterial = this.material.clone();
    this.wireframeMaterial.wireframe = true;
    this.wireframeMaterial.depthTest = false;
    
    // 线框特效的片段着色器
    this.wireframeMaterial.fragmentShader = /* glsl */ `
        varying float vTransitionLight;
        uniform float uWaveTransition;
        uniform float uLightIntensity;
        uniform vec3 COLOR_LIGHT;
          
        void main() {        
          gl_FragColor = vec4(COLOR_LIGHT * 1.75, vTransitionLight * sin(smoothstep(0.4, 0.75, uWaveTransition) * 3.14) * uLightIntensity);
          gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(0.65));
        }
    `;

    this.wireframeMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30, 54, 54), this.wireframeMaterial);
    this.wireframeMesh.rotation.copy(this.mesh.rotation);
    this.wireframeMesh.position.copy(this.mesh.position);
    this.wireframeMesh.renderOrder = 2;

    this.instance.add(this.wireframeMesh);
  }

  triggerWave(_params = {}) {
    const params = {
      direction: _params.direction !== undefined ? _params.direction : 1,
      duration: _params.duration !== undefined ? _params.duration : 4.25,
      ease: _params.ease !== undefined ? _params.ease : 'power2.inOut',
      delay: _params.delay !== undefined ? _params.delay : 0,
      intensity: _params.intensity !== undefined ? _params.intensity : 1.0,
      lightIntensity: _params.lightIntensity !== undefined ? _params.lightIntensity : 1.0,
    };

    this.material.uniforms.uLightIntensity.value = params.lightIntensity;
    this.material.uniforms.uIntensity.value = params.intensity;
    // 同步线框材质的参数
    this.wireframeMaterial.uniforms.uLightIntensity.value = params.lightIntensity;
    this.wireframeMaterial.uniforms.uIntensity.value = params.intensity;

    if (params.direction === 1) {
      gsap.fromTo(
        this.material.uniforms.uWaveTransition,
        { value: 0.0 },
        {
          value: 1, delay: params.delay, duration: params.duration, ease: params.ease,
          onStart: () => { this.isAnimating = true; },
          onUpdate: () => {
            const val = this.material.uniforms.uWaveTransition.value;
            this.wireframeMaterial.uniforms.uWaveTransition.value = val;
            this.material.uniforms.uTime.value += Math.sin(val * Math.PI) * 0.016 * 0.075;
          },
          onComplete: () => { this.isAnimating = false; },
        }
      );
    } else {
      gsap.fromTo(
        this.material.uniforms.uWaveTransition,
        { value: 1 },
        {
          value: 0, duration: 2.75, ease: 'expo.inOut',
          onStart: () => { this.isAnimating = true; },
          onUpdate: () => {
             this.wireframeMaterial.uniforms.uWaveTransition.value = this.material.uniforms.uWaveTransition.value;
          },
          onComplete: () => { this.isAnimating = false; },
        }
      );
    }
  }

  update(delta) {
    // 使用标准的 delta time 替代原作者复杂的音频逻辑
    const timeIncrement = (0.25 + this.globalSpeed * 0.75) * delta;
    this.material.uniforms.uTime.value += timeIncrement;
    this.wireframeMaterial.uniforms.uTime.value += timeIncrement;
    
    // 固定一个舒缓的频率
    this.material.uniforms.uFrequency.value = 1.0;
    this.wireframeMaterial.uniforms.uFrequency.value = 1.0;
  }
}