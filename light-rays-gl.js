/**
 * 原生 WebGL 光束背景（由 React + ogl 版移植），关闭弹窗时须调用 destroy()。
 */

const DEFAULT_COLOR = '#ffffff';

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1];
}

function getAnchorAndDir(origin, w, h) {
  const outside = 0.2;
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case 'top-right':
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case 'left':
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case 'right':
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case 'bottom-left':
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-center':
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-right':
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default:
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
}

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);

  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

function compileShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[LightRays]', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[LightRays]', gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

export class LightRaysGL {
  /**
   * @param {HTMLElement} container
   * @param {object} [opts]
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = {
      raysOrigin: opts.raysOrigin || 'top-center',
      raysColor: opts.raysColor || DEFAULT_COLOR,
      raysSpeed: opts.raysSpeed ?? 1,
      lightSpread: opts.lightSpread ?? 0.5,
      rayLength: opts.rayLength ?? 3,
      pulsating: !!opts.pulsating,
      fadeDistance: opts.fadeDistance ?? 1,
      saturation: opts.saturation ?? 1,
      followMouse: opts.followMouse !== false,
      mouseInfluence: opts.mouseInfluence ?? 0.1,
      noiseAmount: opts.noiseAmount ?? 0,
      distortion: opts.distortion ?? 0,
    };

    this._gl = null;
    this._program = null;
    this._uniforms = {};
    this._attribPos = -1;
    this._buf = null;
    this._raf = null;
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.mouseRaw = { x: 0.5, y: 0.5 };
    this.mouseSmooth = { x: 0.5, y: 0.5 };

    this._onResize = () => this._resize();
    this._onMouseMove = (e) => this._mouse(e);

    this._initGL();
  }

  _initGL() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) {
      console.warn('[LightRays] WebGL not available');
      return;
    }
    this._gl = gl;
    this._canvas = canvas;

    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
    this.container.appendChild(canvas);

    this._program = createProgram(gl, VERT, FRAG);
    if (!this._program) return;

    const p = this._program;
    this._attribPos = gl.getAttribLocation(p, 'position');

    const u = (name) => {
      const loc = gl.getUniformLocation(p, name);
      this._uniforms[name] = loc;
      return loc;
    };

    u('iTime');
    u('iResolution');
    u('rayPos');
    u('rayDir');
    u('raysColor');
    u('raysSpeed');
    u('lightSpread');
    u('rayLength');
    u('pulsating');
    u('fadeDistance');
    u('saturation');
    u('mousePos');
    u('mouseInfluence');
    u('noiseAmount');
    u('distortion');

    this._buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this._applyOptsUniforms();
    window.addEventListener('resize', this._onResize);
    if (this.opts.followMouse) window.addEventListener('mousemove', this._onMouseMove);

    this._resize();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  _mouse(e) {
    if (!this.container || !this._gl) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.mouseRaw.x = (e.clientX - rect.left) / rect.width;
    this.mouseRaw.y = (e.clientY - rect.top) / rect.height;
  }

  _applyOptsUniforms() {
    const gl = this._gl;
    const p = this._program;
    if (!gl || !p) return;
    gl.useProgram(p);
    const o = this.opts;
    const rgb = hexToRgb(o.raysColor);
    gl.uniform3f(this._uniforms.raysColor, rgb[0], rgb[1], rgb[2]);
    gl.uniform1f(this._uniforms.raysSpeed, o.raysSpeed);
    gl.uniform1f(this._uniforms.lightSpread, o.lightSpread);
    gl.uniform1f(this._uniforms.rayLength, o.rayLength);
    gl.uniform1f(this._uniforms.pulsating, o.pulsating ? 1 : 0);
    gl.uniform1f(this._uniforms.fadeDistance, o.fadeDistance);
    gl.uniform1f(this._uniforms.saturation, o.saturation);
    gl.uniform1f(this._uniforms.mouseInfluence, o.mouseInfluence);
    gl.uniform1f(this._uniforms.noiseAmount, o.noiseAmount);
    gl.uniform1f(this._uniforms.distortion, o.distortion);
  }

  _resize() {
    const gl = this._gl;
    const canvas = this._canvas;
    if (!gl || !canvas || !this.container) return;
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wCSS = this.container.clientWidth;
    const hCSS = this.container.clientHeight;
    const w = Math.max(1, Math.floor(wCSS * this._dpr));
    const h = Math.max(1, Math.floor(hCSS * this._dpr));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.useProgram(this._program);
    gl.uniform2f(this._uniforms.iResolution, w, h);
    const { anchor, dir } = getAnchorAndDir(this.opts.raysOrigin, w, h);
    gl.uniform2f(this._uniforms.rayPos, anchor[0], anchor[1]);
    gl.uniform2f(this._uniforms.rayDir, dir[0], dir[1]);
  }

  _loop(t) {
    const gl = this._gl;
    const p = this._program;
    if (!gl || !p || !this._buf) return;

    gl.useProgram(p);
    gl.uniform1f(this._uniforms.iTime, t * 0.001);

    if (this.opts.followMouse && this.opts.mouseInfluence > 0) {
      const s = 0.92;
      this.mouseSmooth.x = this.mouseSmooth.x * s + this.mouseRaw.x * (1 - s);
      this.mouseSmooth.y = this.mouseSmooth.y * s + this.mouseRaw.y * (1 - s);
      gl.uniform2f(this._uniforms.mousePos, this.mouseSmooth.x, this.mouseSmooth.y);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buf);
    gl.enableVertexAttribArray(this._attribPos);
    gl.vertexAttribPointer(this._attribPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this._raf = requestAnimationFrame(this._loop);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onMouseMove);

    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    const gl = this._gl;
    if (gl) {
      try {
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (_) {
        /* ignore */
      }
      const canvas = gl.canvas;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    if (this._buf) {
      try {
        this._gl?.deleteBuffer(this._buf);
      } catch (_) {
        /* ignore */
      }
    }
    if (this._program && this._gl) {
      try {
        this._gl.deleteProgram(this._program);
      } catch (_) {
        /* ignore */
      }
    }

    this._gl = null;
    this._program = null;
    this._buf = null;
    this._canvas = null;
  }
}
