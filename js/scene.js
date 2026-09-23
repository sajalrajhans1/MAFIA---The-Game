// The 3D back room: table, lamp, characters, cards, lighting moods, post-processing,
// first-person camera and picking.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { Character } from './characters.js';
import { LOOK_KEYS } from './looks.js';
import { drawCardFace, drawCardBack } from './cards.js';

const TABLE_H = 0.78;
const ROOM = 5.6, CEIL = 3.7;
const ACTION_COLORS = { kill: 0xff2630, inspect: 0xffc44a, save: 0x7fd4ff, vote: 0xff8a2a };

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, night: { value: 0 }, red: { value: 0 },
    fade: { value: 0 }, flash: { value: 0 }, grain: { value: 0.055 }, ca: { value: 0.0022 },
    scan: { value: 0.0 }, res: { value: new THREE.Vector2(1, 1) }, gold: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, night, red, fade, flash, grain, ca, scan, gold; uniform vec2 res;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 c = uv - 0.5; float d = length(c);
      vec2 off = c * ca * (1.0 + d * 2.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      // film grade: cool shadows, warm highlights, a soft S-curve and lifted blacks
      col = mix(col * vec3(0.93, 1.0, 1.08), col * vec3(1.07, 1.0, 0.9), smoothstep(0.04, 0.55, l));
      col = clamp(col, 0.0, 1.0);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
      col += vec3(0.010, 0.013, 0.018) * (1.0 - smoothstep(0.0, 0.25, l));
      l = dot(col, vec3(0.299, 0.587, 0.114));
      // night grade, but let strong reds survive (glowing Joker eyes, neon, embers)
      float keepRed = smoothstep(0.12, 0.4, col.r - max(col.g, col.b));
      col = mix(col, vec3(l * 0.55, l * 0.75, l * 1.25), night * 0.7 * (1.0 - keepRed));
      col = mix(col, vec3(l * 1.3, l * 0.25, l * 0.2), red * 0.45);
      col += vec3(1.0, 0.8, 0.45) * gold * 0.18 * (1.0 - d);
      float vig = smoothstep(0.95, 0.25, d);
      col *= mix(0.25, 1.0, vig);
      float n = hash(uv * res + fract(time * 13.7) * 91.0);
      col += (n - 0.5) * grain;
      if (scan > 0.0) col *= 1.0 - scan * 0.18 * step(0.5, fract(uv.y * res.y * 0.5));
      col += vec3(1.0, 0.95, 0.9) * flash;
      col *= 1.0 - fade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// Quality tiers. "auto" starts from a hardware guess and moves between low..high by frame time.
export const TIERS = {
  low: { pr: 0.72, msaa: 0, shadows: false, shadowSize: 512, soft: false, bloom: false, fx: 0.35 },
  medium: { pr: 1, msaa: 2, shadows: true, shadowSize: 1024, soft: false, bloom: true, fx: 0.7 },
  high: { pr: 1.35, msaa: 4, shadows: true, shadowSize: 2048, soft: true, bloom: true, fx: 1 },
  ultra: { pr: 2, msaa: 4, shadows: true, shadowSize: 2048, soft: true, bloom: true, fx: 1 },
};
const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    // MSAA happens in the post-processing target, so the canvas itself needs none
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(1);
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.08;
    r.outputColorSpace = THREE.SRGBColorSpace;

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030204);
    scene.fog = new THREE.FogExp2(0x050306, 0.05);
    this.buildEnvironment();

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.04, 60);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, 3, 5);

    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);

    this.chars = new Map();
    this.seats = new Map();
    this.myPid = null;
    this.N = 0;
    this.layoutKey = '';
    this.tweens = [];
    this.hover = null;
    this.targets = new Set();
    this.actionKind = null;
    this.selected = null;
    this.mood = { night: 0, red: 0, fade: 0, flash: 0, gold: 0, lamp: 1, accused: 0 };
    this.moodGoal = { night: 0, red: 0, fade: 0, lamp: 1, accused: 0 };
    this.camMode = 'orbit';
    this.camBlend = 1;
    this.look = { yaw: 0, pitch: -0.1, ty: 0, tp: -0.1, px: 0, py: 0 };
    this.fovGoal = 72;
    this.lampSwing = { a: 0, v: 0, b: 0, vb: 0 };
    this.nextLightning = 12 + Math.random() * 20;
    this.lightning = 0;
    this.clockProgress = 0;
    this.onPlayerClick = null;
    this.onCardClick = null;
    this.onHover = null;
    this.onThunder = null;
    this.sleepers = true;
    this.phase = 'lobby';

    this.buildRoom();
    this.buildTable(8);
    this.buildLamp();
    this.buildProps();
    this.buildParticles();
    this.bindInput();

    this.clock = new THREE.Clock();
    this.perf = { acc: 0, n: 0, good: 0, last: 0, dir: '', skip: 2, blockUp: {} };
    this.qualityMode = 'auto';
    this.tier = null;
    this.applyTier(this.guessTier());
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // a reflection environment built from this room's own lights (warm lamp, blue window, red neon)
  buildEnvironment() {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), new THREE.MeshBasicMaterial({ color: 0x120a07, side: THREE.BackSide })));
    const panel = (w, h, color, pos, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.rotation.set(...rot);
      env.add(m);
    };
    panel(1.1, 1.1, new THREE.Color(9, 5.5, 2.6), [0, 1.7, 0], [Math.PI / 2, 0, 0]);
    panel(1.7, 1.9, new THREE.Color(0.35, 0.5, 1.1), [0, 0.3, -5.9], [0, 0, 0]);
    panel(1.8, 0.45, new THREE.Color(3.5, 0.5, 0.7), [5.9, 1.1, 0.3], [0, -Math.PI / 2, 0]);
    for (const [x, z, ry] of [[-5.9, -3.2, Math.PI / 2], [-5.9, 2.8, Math.PI / 2], [-2.4, -5.9, 0], [2.4, -5.9, 0]]) panel(0.25, 0.25, new THREE.Color(2.4, 1.5, 0.7), [x, 0.3, z], [0, ry, 0]);
    panel(12, 12, new THREE.Color(0.05, 0.03, 0.02), [0, -2.4, 0], [-Math.PI / 2, 0, 0]);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(env, 0.035).texture;
    this.scene.environmentIntensity = 0.6;
    pm.dispose();
  }

  guessTier() {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(r)) return 'low';
      const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
      if (mobile || /intel|mali|adreno|powervr|videocore|apple gpu/i.test(r) || (navigator.hardwareConcurrency || 8) <= 4) return 'medium';
    } catch { /* ignore */ }
    return 'high';
  }

  // mode: 'auto' | 'low' | 'medium' | 'high' | 'ultra'
  setQuality(mode) {
    if (!TIERS[mode] && mode !== 'auto') mode = 'auto';
    this.qualityMode = mode;
    this.perf.blockUp = {};
    this.applyTier(mode === 'auto' ? this.guessTier() : mode);
  }

  applyTier(name) {
    if (this.tier === name) return;
    const T = TIERS[name], prev = this.tier && TIERS[this.tier];
    this.tier = name;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(T.pr < 1 ? T.pr : Math.min(T.pr, Math.max(1, dpr)));
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples !== T.msaa) { rt.samples = T.msaa; rt.dispose(); }
    }
    this.renderer.shadowMap.type = T.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.spot) {
      this.spot.castShadow = T.shadows;
      if (this.spot.shadow.mapSize.x !== T.shadowSize) {
        this.spot.shadow.mapSize.set(T.shadowSize, T.shadowSize);
        if (this.spot.shadow.map) { this.spot.shadow.map.dispose(); this.spot.shadow.map = null; }
      }
    }
    this.bloom.enabled = T.bloom;
    if (this.dust) this.dust.geometry.setDrawRange(0, Math.floor(this.dustCount * T.fx));
    // on LOW, drop the decorative lights: every light costs per pixel in a forward renderer
    const decor = T.fx >= 0.7;
    for (const l of [...(this.sconces || []), this.pictureLight, this.upLight, this.neonLight]) if (l) l.visible = decor;
    if (prev && (prev.shadows !== T.shadows || prev.soft !== T.soft || (prev.fx >= 0.7) !== decor)) {
      this.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
    }
    this.perf.skip = 2;
    this.resize();
    this.onTier && this.onTier(name, this.qualityMode);
  }

  // watch frame times and step the tier down (or carefully back up) in auto mode
  adaptQuality(rawDt) {
    const P = this.perf;
    if (this.qualityMode !== 'auto' || document.hidden || rawDt > 0.5) return;
    P.acc += rawDt; P.n++;
    if (P.acc < 2) return;
    const avg = P.acc / P.n;
    P.acc = 0; P.n = 0;
    if (P.skip > 0) { P.skip--; return; } // shader compiles right after a change
    const i = TIER_ORDER.indexOf(this.tier), t = performance.now() / 1000;
    if (avg > 1 / 40 && i > 0) {
      if (P.dir === 'up' && t - P.last < 12) P.blockUp[this.tier] = t + 180;
      P.last = t; P.dir = 'down'; P.good = 0;
      this.applyTier(TIER_ORDER[i - 1]);
    } else if (avg < 1 / 56) {
      P.good++;
      const next = TIER_ORDER[i + 1];
      if (P.good >= 4 && i < 2 && !(P.blockUp[next] > t)) { P.last = t; P.dir = 'up'; P.good = 0; this.applyTier(next); }
    } else P.good = 0;
  }

  setCRT(on) { this.final.uniforms.scan.value = on ? 1 : 0; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.final.uniforms.res.value.set(w * pr, h * pr);
  }

  // ------------------------------------------------------------------ room
  buildRoom() {
    const s = this.scene;
    const floorTex = TX.woodFloor();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), new THREE.MeshStandardMaterial({
      map: floorTex, normalMap: TX.normalFromCanvas(floorTex.image, 3, 3), normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.38, metalness: 0.0,
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.3, 64), new THREE.MeshStandardMaterial({
      map: TX.rug(), normalMap: TX.normalFromCanvas(TX.fibreHeight(256, 3000, 31), 2.5, 8), roughness: 0.97,
    }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.005;
    rug.receiveShadow = true;
    s.add(rug);

    const wallTex = TX.wallpaper();
    wallTex.repeat.set(5, 2);
    const wallN = TX.normalFromCanvas(wallTex.image, 4);
    wallN.repeat.set(5, 2);
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex, normalMap: wallN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.82 });
    const panelTex = TX.panels();
    panelTex.repeat.set(5, 1);
    const panelN = TX.normalFromCanvas(panelTex.image, 5);
    panelN.repeat.set(5, 1);
    const panelM = new THREE.MeshStandardMaterial({ map: panelTex, normalMap: panelN, roughness: 0.45 });
    const trimM = new THREE.MeshStandardMaterial({ color: 0x1c0d06, roughness: 0.35 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.rotation.y = i * Math.PI / 2;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, CEIL), wallM);
      w.position.set(0, CEIL / 2, -ROOM);
      w.receiveShadow = true;
      g.add(w);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, 1.15), panelM);
      p.position.set(0, 0.575, -ROOM + 0.02);
      g.add(p);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.07, 0.06), trimM);
      rail.position.set(0, 1.17, -ROOM + 0.03);
      g.add(rail);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.14, 0.1), trimM);
      crown.position.set(0, CEIL - 0.07, -ROOM + 0.05);
      g.add(crown);
      mergeStatic(g);
      s.add(g);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2, ROOM * 2), new THREE.MeshStandardMaterial({ color: 0x0f0a08, roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = CEIL;
    s.add(ceil);
    for (const x of [-1.6, 1.6]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, ROOM * 2), new THREE.MeshStandardMaterial({ map: TX.darkWood(18), roughness: 0.7 }));
      beam.position.set(x, CEIL - 0.1, 0);
      s.add(beam);
    }

    this.buildWindow();
    this.buildPainting();
    this.buildBar();
    this.buildSconces();
    this.buildClock();

    // moonlight: a spot from just outside the window, so only what the window "sees" is lit
    const moon = this.moon = new THREE.SpotLight(0x8aa6e8, 6, 16, 0.66, 0.75, 1.3);
    moon.position.set(0.25, 2.6, -6.7);
    moon.target.position.set(0, 0.4, -0.2);
    s.add(moon, moon.target);
    this.ambient = new THREE.HemisphereLight(0x3a2a30, 0x0a0606, 0.35);
    s.add(this.ambient);
    this.buildMoonbeam();
  }

  // soft volumetric-looking shaft falling from the window
  buildMoonbeam() {
    const from = new THREE.Vector3(0.1, 1.95, -ROOM + 0.05), to = new THREE.Vector3(0, 0.35, -1.0);
    const len = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(1.05, 1.35, len, 4, 1, true);
    geo.rotateY(Math.PI / 4);
    geo.translate(0, -len / 2, 0);
    this.beamMat = beamMaterial(new THREE.Color(0.55, 0.68, 1.0), 0.05, len);
    const beam = new THREE.Mesh(geo, this.beamMat);
    beam.position.copy(from);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
    beam.scale.set(1, 1, 0.8);
    beam.renderOrder = 2;
    this.scene.add(beam);
  }

  buildWindow() {
    const s = this.scene;
    const g = new THREE.Group();
    g.position.set(0, 0, -ROOM + 0.01);
    const W = 1.7, H = 1.9, Y = 1.05;
    this.windowMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: TX.skyline() }, time: { value: 0 }, flash: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform sampler2D map; uniform float time, flash; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          float cols = 70.0; float cx = floor(uv.x * cols);
          float sp = 0.35 + h(vec2(cx, 1.0)) * 0.5;
          float y = fract(uv.y * 1.5 + time * sp + h(vec2(cx, 2.0)));
          float fx = abs(fract(uv.x * cols) - 0.5);
          float streak = smoothstep(0.18, 0.0, fx) * smoothstep(0.0, 0.04, y) * smoothstep(0.35, 0.05, y) * step(0.5, h(vec2(cx, 3.0)));
          vec2 g = uv * vec2(26.0, 34.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
          float hh = h(id); vec2 o = vec2(hh - 0.5, fract(hh * 13.0) - 0.5) * 0.5;
          float drop = smoothstep(0.16, 0.06, length(f - o)) * step(0.62, hh);
          vec2 dist = vec2(drop * 0.012 + streak * 0.004, drop * 0.02);
          vec3 col = texture2D(map, uv + dist).rgb;
          col = pow(col, vec3(2.2));
          col += vec3(0.35, 0.45, 0.7) * (streak * 0.03 + drop * 0.07);
          col *= 1.0 + flash * 6.0;
          col += vec3(0.5, 0.6, 0.9) * flash * 0.4;
          gl_FragColor = vec4(col * 1.4, 1.0);
        }`,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.windowMat);
    glass.position.set(0, Y + H / 2, 0.02);
    g.add(glass);
    const fm = new THREE.MeshStandardMaterial({ map: TX.darkWood(22), roughness: 0.6 });
    const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), fm); m.position.set(x, y, 0.06); m.castShadow = true; g.add(m); };
    bar(W + 0.2, 0.1, 0, Y - 0.05); bar(W + 0.2, 0.1, 0, Y + H + 0.05);
    bar(0.1, H + 0.2, -W / 2 - 0.05, Y + H / 2); bar(0.1, H + 0.2, W / 2 + 0.05, Y + H / 2);
    bar(0.05, H, 0, Y + H / 2); bar(W, 0.05, 0, Y + H * 0.55);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.05, 0.25), fm);
    sill.position.set(0, Y - 0.1, 0.12);
    g.add(sill);
    // curtains
    const cm = new THREE.MeshStandardMaterial({ color: 0x3d0a10, roughness: 0.9, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.75, 3.3, 24, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 26) * 0.045);
      geo.computeVertexNormals();
      const c = new THREE.Mesh(geo, cm);
      c.position.set(side * (W / 2 + 0.3), 1.75, 0.16);
      c.castShadow = true;
      g.add(c);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, W + 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.8, roughness: 0.35 }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 3.42, 0.18);
    g.add(rod);
    mergeStatic(g);
    this.scene.add(g);
  }

  buildPainting() {
    const g = new THREE.Group();
    g.position.set(-ROOM + 0.02, 1.95, -0.2);
    g.rotation.y = Math.PI / 2;
    const tex = new THREE.TextureLoader().load('assets/img/title.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.07), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    pic.position.z = 0.05;
    g.add(pic);
    const gold = new THREE.MeshStandardMaterial({ color: 0x9a7430, metalness: 0.85, roughness: 0.35 });
    const fb = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), gold); m.position.set(x, y, 0.04); g.add(m); };
    fb(2.08, 0.09, 0, 0.58); fb(2.08, 0.09, 0, -0.58); fb(0.09, 1.25, -0.995, 0); fb(0.09, 1.25, 0.995, 0);
    // picture light
    const lampBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 10), gold);
    lampBar.rotation.z = Math.PI / 2;
    lampBar.position.set(0, 0.72, 0.16);
    g.add(lampBar);
    const pl = new THREE.SpotLight(0xffc27a, 3, 3, 0.9, 0.8, 2);
    pl.position.set(0, 0.7, 0.25);
    pl.target.position.set(0, -0.1, 0);
    g.add(pl, pl.target);
    this.pictureLight = pl;
    mergeStatic(g);
    this.scene.add(g);
  }

  buildBar() {
    const g = new THREE.Group();
    g.position.set(ROOM - 0.35, 0, 0.3);
    g.rotation.y = -Math.PI / 2;
    const wood = new THREE.MeshStandardMaterial({ map: TX.darkWood(10), roughness: 0.5 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.6), wood);
    cab.position.set(0, 0.5, 0);
    cab.castShadow = cab.receiveShadow = true;
    g.add(cab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.05, 0.66), new THREE.MeshStandardMaterial({ color: 0x160905, roughness: 0.25, metalness: 0.1 }));
    top.position.set(0, 1.02, 0);
    g.add(top);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.2), new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 1, roughness: 0.15 }));
    mirror.position.set(0, 1.85, -0.28);
    g.add(mirror);
    const bottleMats = [];
    for (const y of [1.45, 2.0]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.04, 0.25), wood);
      sh.position.set(0, y, -0.16);
      g.add(sh);
      for (let i = 0; i < 9; i++) {
        const cols = [0x6b3b0a, 0x1e3d1a, 0x8a8a90, 0x5a0a10, 0x7a4a10];
        const ci = (i * 3 + y * 10) % cols.length | 0;
        const bm = bottleMats[ci] ||= new THREE.MeshStandardMaterial({ color: cols[ci], roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82 });
        const h = 0.24 + ((i * 7 + y * 3) % 5) * 0.03;
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, h, 14), bm);
        b.position.set(-1.35 + i * 0.33 + Math.sin(i * 9) * 0.04, y + 0.02 + h / 2, -0.15);
        const n = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 0.1, 10), bm);
        n.position.copy(b.position).y += h / 2 + 0.05;
        g.add(n);
        g.add(b);
      }
    }
    // neon sign
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 150px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2040'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#ff5a6e';
    ctx.fillText('LAST CALL', 512, 128);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffd0d6';
    ctx.font = 'bold 146px Georgia, serif';
    ctx.globalAlpha = 0.7; ctx.fillText('LAST CALL', 512, 128);
    const nt = new THREE.CanvasTexture(cv);
    nt.colorSpace = THREE.SRGBColorSpace;
    this.neonMat = new THREE.MeshBasicMaterial({ map: nt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(2.2, 1.6, 1.7) });
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), this.neonMat);
    neon.position.set(0, 2.85, -0.25);
    g.add(neon);
    const nl = this.neonLight = new THREE.PointLight(0xff3050, 1.6, 4.5, 2);
    nl.position.set(0, 2.8, 0.3);
    g.add(nl);
    mergeStatic(g);
    this.scene.add(g);
  }

  buildSconces() {
    this.sconces = [];
    const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.8, roughness: 0.35 });
    this.sconceGlass = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.7), toneMapped: false });
    const spots = [[-ROOM + 0.05, 2.1, -3.2, Math.PI / 2], [-ROOM + 0.05, 2.1, 2.8, Math.PI / 2], [-2.4, 2.1, -ROOM + 0.05, 0], [2.4, 2.1, -ROOM + 0.05, 0], [0, 2.1, ROOM - 0.05, Math.PI]];
    spots.forEach(([x, y, z, ry], i) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = ry;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), brass);
      plate.rotation.x = Math.PI / 2;
      g.add(plate);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), brass);
      arm.rotation.x = Math.PI / 2; arm.position.z = 0.08;
      g.add(arm);
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.sconceGlass);
      shade.position.set(0, 0.02, 0.16);
      g.add(shade);
      if (i < 3) {
        const l = new THREE.PointLight(0xffa35a, 1.3, 5, 2);
        l.position.set(0, 0.15, 0.22);
        g.add(l);
        this.sconces.push(l);
      }
      mergeStatic(g);
      this.scene.add(g);
    });
  }

  buildClock() {
    const g = new THREE.Group();
    g.position.set(0, 3.25, -ROOM + 0.04);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.26, 48), new THREE.MeshStandardMaterial({ map: TX.clockFace(), roughness: 0.6, emissive: 0x2a2010, emissiveIntensity: 0.4 }));
    face.position.z = 0.03;
    g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 10, 48), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.8, roughness: 0.3 }));
    rim.position.z = 0.03;
    g.add(rim);
    const hm = new THREE.MeshStandardMaterial({ color: 0x0a0806 });
    const mk = (len, w) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.01), hm); m.position.y = len / 2 - 0.02; p.add(m); p.position.z = 0.045; g.add(p); return p; };
    this.hourHand = mk(0.14, 0.022);
    this.minHand = mk(0.21, 0.014);
    const sec = new THREE.MeshBasicMaterial({ color: 0xaa1010 });
    this.secHand = new THREE.Group();
    const sm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.23, 0.005), sec);
    sm.position.y = 0.09;
    this.secHand.add(sm);
    this.secHand.position.z = 0.05;
    g.add(this.secHand);
    mergeStatic(g);
    this.scene.add(g);
  }

  // ----------------------------------------------------------------- table
  buildTable(n) {
    if (this.table) { this.scene.remove(this.table); this.table.traverse(o => o.geometry && o.geometry.dispose()); }
    this.N = n;
    const R = this.R = THREE.MathUtils.clamp(0.95 + n * 0.075, 1.25, 1.9);
    this.RS = R + 0.5;
    const t = this.table = new THREE.Group();
    if (!this.feltMat) {
      this.feltMat = new THREE.MeshPhysicalMaterial({
        map: TX.felt(), normalMap: TX.normalFromCanvas(TX.fibreHeight(256, 2600, 7), 3, 7), normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 0.95, sheen: 1, sheenRoughness: 0.75, sheenColor: new THREE.Color(0x3f8f5c),
      });
      const leather = TX.normalFromCanvas(TX.leatherHeight(256), 4, 1);
      leather.repeat.set(48, 1);
      this.rimMat = new THREE.MeshPhysicalMaterial({
        color: 0x2c0e08, roughness: 0.42, normalMap: leather, normalScale: new THREE.Vector2(0.8, 0.8),
        clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color(0x6a2a1a),
      });
      const woodTex = TX.darkWood(12);
      this.woodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, normalMap: TX.normalFromCanvas(woodTex.image, 2), roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.12 });
      const chairTex = TX.darkWood(16);
      this.chairMat = new THREE.MeshStandardMaterial({ map: chairTex, normalMap: TX.normalFromCanvas(chairTex.image, 2), roughness: 0.42 });
      this.aoTex = TX.blobTexture(256, 0.3, 0.9);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.06, 96), [this.woodMat, this.feltMat, this.woodMat]);
    top.position.y = TABLE_H - 0.03;
    top.receiveShadow = true;
    top.castShadow = true;
    t.add(top);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.065, 16, 128), this.rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = TABLE_H + 0.005;
    rim.castShadow = rim.receiveShadow = true;
    t.add(rim);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.08, 0.12, 64, 1, true), this.woodMat);
    skirt.position.y = TABLE_H - 0.1;
    t.add(skirt);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, TABLE_H - 0.12, 24), this.woodMat);
    ped.position.y = (TABLE_H - 0.12) / 2;
    ped.castShadow = true;
    t.add(ped);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.08, 32), this.woodMat);
    foot.position.y = 0.04;
    foot.receiveShadow = true;
    t.add(foot);
    // soft contact shadow grounding the table and chairs
    const ao = new THREE.Mesh(new THREE.CircleGeometry(this.RS + 0.55, 48), new THREE.MeshBasicMaterial({ map: this.aoTex, transparent: true, opacity: 0.75, depthWrite: false, color: 0x000000 }));
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.009;
    ao.renderOrder = 1;
    t.add(ao);
    this.scene.add(t);
  }

  buildLamp() {
    const s = this.scene;
    const lamp = this.lamp = new THREE.Group();
    lamp.position.set(0, CEIL, 0);
    s.add(lamp);
    const cordLen = CEIL - 2.5;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, cordLen, 6), new THREE.MeshStandardMaterial({ color: 0x080808 }));
    cord.position.y = -cordLen / 2;
    lamp.add(cord);
    const head = this.lampHead = new THREE.Group();
    head.position.y = -cordLen;
    lamp.add(head);
    const brass = new THREE.MeshStandardMaterial({ color: 0x8f6d2c, metalness: 0.85, roughness: 0.3 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.08, 16), brass);
    cap.position.y = -0.04;
    head.add(cap);
    const shadeOut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.46, 0.3, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x173c26, metalness: 0.5, roughness: 0.35, side: THREE.FrontSide }));
    shadeOut.position.y = -0.2;
    shadeOut.castShadow = true;
    head.add(shadeOut);
    this.shadeInMat = new THREE.MeshStandardMaterial({ color: 0x8a7a60, emissive: 0xff9a40, emissiveIntensity: 0.32, roughness: 0.6, side: THREE.BackSide });
    const shadeIn = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.455, 0.295, 48, 1, true), this.shadeInMat);
    shadeIn.position.y = -0.2;
    head.add(shadeIn);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 8, 64), brass);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.35;
    head.add(lip);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.2, 2.4), toneMapped: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), this.bulbMat);
    bulb.position.y = -0.22;
    head.add(bulb);

    const spot = this.spot = new THREE.SpotLight(0xffb36a, 34, 0, 1.3, 0.5, 2);
    spot.position.set(0, -0.2, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.025;
    spot.shadow.camera.near = 0.2;
    spot.shadow.camera.far = 6;
    head.add(spot);
    this.spotTarget = new THREE.Object3D();
    this.spotTarget.position.set(0, TABLE_H, 0);
    s.add(this.spotTarget);
    spot.target = this.spotTarget;
    this.upLight = new THREE.PointLight(0xffa860, 0.6, 3, 2);
    this.upLight.position.y = 0.15;
    head.add(this.upLight);
    // green bounce off the felt: the classic under-lit poker-table faces
    // (an upward cone from the felt, so it lights faces without blowing out the table)
    this.bounce = new THREE.SpotLight(0xa7c486, 9, 0, 1.52, 0.35, 1.5);
    this.bounce.position.set(0, TABLE_H + 0.02, 0);
    this.bounce.target.position.set(0, 6, 0);
    s.add(this.bounce, this.bounce.target);

    // fake volumetric cone
    const coneH = 2.5 - 0.35 - TABLE_H + 0.02;
    const coneGeo = new THREE.CylinderGeometry(0.4, 1.9, coneH, 48, 1, true);
    coneGeo.translate(0, -coneH / 2, 0);
    this.coneMat = beamMaterial(new THREE.Color(1.0, 0.72, 0.42), 0.06, coneH);
    const cone = new THREE.Mesh(coneGeo, this.coneMat);
    cone.position.y = -0.33;
    head.add(cone);

    // red accusation spotlight
    const red = this.redSpot = new THREE.SpotLight(0xff1a1a, 0, 0, 0.32, 0.5, 2);
    red.position.set(0, CEIL - 0.1, 0);
    this.redTarget = new THREE.Object3D();
    s.add(red, this.redTarget);
    red.target = this.redTarget;
  }

  buildProps() {
    const s = this.scene;
    const props = this.props = new THREE.Group();
    s.add(props);
    const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.85, roughness: 0.3 });
    // deck
    const backTex = new THREE.CanvasTexture(drawCardBack());
    backTex.colorSpace = THREE.SRGBColorSpace;
    backTex.anisotropy = 8;
    this.backTex = backTex;
    this.cardEdge = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 });
    this.cardBackMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.55 });
    const deck = this.deck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.168), [this.cardEdge, this.cardEdge, this.cardBackMat, this.cardEdge, this.cardEdge, this.cardEdge]);
    deck.position.set(0.05, TABLE_H + 0.015, 0.02);
    deck.rotation.y = 0.4;
    deck.castShadow = true;
    props.add(deck);

    // candles
    this.candles = [];
    const wax = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.6, emissive: 0x331a05, emissiveIntensity: 0.4 });
    const flameTex = TX.flameTexture(), glowTex = TX.softSprite(64);
    for (const [x, z] of [[-0.55, -0.35], [0.5, 0.42]]) {
      const g = new THREE.Group();
      g.position.set(x, TABLE_H, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.02, 20), brass);
      base.position.y = 0.01;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.12, 12), brass);
      stem.position.y = 0.08;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.022, 0.03, 16), brass);
      cup.position.y = 0.15;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.15, 14), wax);
      c.position.y = 0.24;
      const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.012, 4), new THREE.MeshBasicMaterial({ color: 0x120a06 }));
      wick.position.y = 0.321;
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color(2.4, 1.8, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      flame.position.y = 0.346;
      flame.scale.set(0.026, 0.058, 1);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.3, 0.62, 0.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.22, toneMapped: false }));
      glow.position.y = 0.345;
      glow.scale.set(0.34, 0.34, 1);
      [base, stem, cup, c].forEach(m => { m.castShadow = true; g.add(m); });
      g.add(wick, flame, glow);
      const l = new THREE.PointLight(0xff9a40, 0.9, 3.2, 2);
      l.position.y = 0.38;
      g.add(l);
      mergeStatic(g);
      props.add(g);
      this.candles.push({ light: l, flame, glow, seed: Math.random() * 10 });
    }
    // ashtray + cigar
    const ash = new THREE.Group();
    ash.position.set(-0.45, TABLE_H, 0.4);
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0x3a3226, metalness: 0.7, roughness: 0.35 }));
    tray.position.y = 0.015;
    tray.castShadow = true;
    ash.add(tray);
    const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.8 }));
    cigar.rotation.z = Math.PI / 2 - 0.12;
    cigar.position.set(0.05, 0.04, 0);
    ash.add(cigar);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 1.2, 0.2), toneMapped: false }));
    ember.position.set(0.12, 0.048, 0);
    ash.add(ember);
    this.ember = ember;
    props.add(ash);
    this.smokeOrigin = new THREE.Vector3(-0.33, TABLE_H + 0.06, 0.4);
    // bottle & chips
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 16), new THREE.MeshStandardMaterial({ color: 0x5a2a06, roughness: 0.06, transparent: true, opacity: 0.85 }));
    bottle.position.set(0.3, TABLE_H + 0.13, -0.5);
    bottle.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.035, 0.12, 12), bottle.material);
    neck.position.y = 0.19;
    bottle.add(neck);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0505, 0.0505, 0.09, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 0.8 }));
    bottle.add(label);
    props.add(bottle);
    this.chipGeo = new THREE.CylinderGeometry(0.023, 0.023, 0.009, 20);
    this.chipMats = [0x8c1016, 0x14141a, 0xd9ccb0, 0x1d3f7a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
    const chipBuckets = this.chipMats.map(() => []);
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3 + 0.4, rr = 0.32 + (k % 2) * 0.12;
      const h = 3 + (k * 5) % 6;
      for (let i = 0; i < h; i++) {
        const g = this.chipGeo.clone();
        g.translate(Math.cos(a) * rr + Math.sin(i) * 0.002, TABLE_H + 0.005 + i * 0.0092, Math.sin(a) * rr);
        chipBuckets[(k + (i > h / 2 ? 1 : 0)) % 4].push(g);
      }
    }
    chipBuckets.forEach((list, i) => {
      if (!list.length) return;
      const m = new THREE.Mesh(mergeGeometries(list, false), this.chipMats[i]);
      m.castShadow = true;
      props.add(m);
    });
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.32 });
    this.whiskyMat = new THREE.MeshStandardMaterial({ color: 0xb8680e, roughness: 0.1, transparent: true, opacity: 0.8, emissive: 0x401800, emissiveIntensity: 0.3 });
  }

  buildParticles() {
    // dust, only inside the lamp's cone of light (outside it, specks read as stars)
    const n = this.dustCount = 170;
    const pos = new Float32Array(n * 3);
    this.dustSeed = new Float32Array(n);
    this.dustPolar = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] = TABLE_H + 0.1 + Math.random() * 1.3;
      this.dustPolar[i * 2] = Math.random() * Math.PI * 2;
      this.dustPolar[i * 2 + 1] = Math.sqrt(Math.random());
      this.dustSeed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustMat = new THREE.PointsMaterial({ size: 0.009, map: TX.softSprite(32), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 });
    this.dust = new THREE.Points(g, this.dustMat);
    this.scene.add(this.dust);

    // cigar smoke
    this.smoke = [];
    const tex = TX.smokeSprite();
    for (let i = 0; i < 20; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0x9a948c });
      const sp = new THREE.Sprite(m);
      sp.userData = { life: Math.random() * 6, max: 6 + Math.random() * 2, rot: (Math.random() - 0.5) * 0.6, dx: (Math.random() - 0.5) * 0.05 };
      this.scene.add(sp);
      this.smoke.push(sp);
    }
  }

  // ------------------------------------------------------------ characters
  // players: [{pid, seat, look}], myPid
  layout(players, myPid) {
    const key = players.map(p => `${p.pid}:${p.seat}:${lookKey(p.look)}`).join('|') + '#' + myPid;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.myPid = myPid;
    const n = Math.max(players.length, 4);
    if (n !== this.N) this.buildTable(n);
    const me = players.find(p => p.pid === myPid);
    const mySeat = me ? me.seat : 0;
    const keep = new Set(players.map(p => p.pid));
    for (const [pid, rec] of this.chars) {
      if (!keep.has(pid) || rec.lookKey !== lookKey(players.find(p => p.pid === pid).look)) this.removeChar(pid);
    }
    for (const p of players) {
      let rec = this.chars.get(p.pid);
      if (!rec) rec = this.addChar(p);
      const a = ((p.seat - mySeat) / n) * Math.PI * 2;
      rec.angle = a;
      rec.char.root.position.set(Math.sin(a) * this.RS, 0, Math.cos(a) * this.RS);
      rec.char.root.rotation.set(0, a + Math.PI, 0); // +Z faces the table centre
      rec.char.setSelf(p.pid === myPid && this.camMode === 'seat');
      rec.char.placeRest(this.RS - this.R);
      rec.char.arms.forEach(arm => { arm.cur.copy(arm.rest); });
      const local = (x, y, z) => rec.char.root.localToWorld(new THREE.Vector3(x, y, z));
      rec.cardHome = local(0, TABLE_H + 0.004, this.RS - this.R + 0.3);
      rec.cardYaw = rec.char.root.rotation.y;
      if (!rec.cardAnim) rec.card.position.copy(rec.cardHome);
      rec.card.rotation.set(0, rec.cardYaw, rec.card.rotation.z);
      rec.ring.position.copy(local(0, TABLE_H + 0.003, this.RS - this.R + 0.3));
      rec.chipBase = local(0.17, TABLE_H + 0.005, this.RS - this.R + 0.3);
      rec.glass && rec.glass.position.copy(local(-0.3, TABLE_H, this.RS - this.R + 0.14));
    }
    this.placeCamera(true);
  }

  addChar(p) {
    const c = new Character(p.look, { chairMat: this.chairMat });
    this.scene.add(c.root);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.0025, 0.168), [this.cardEdge, this.cardEdge, this.cardBackMat, this.cardBackMat, this.cardEdge, this.cardEdge]);
    card.castShadow = true;
    card.receiveShadow = true;
    card.visible = false;
    card.userData.pid = p.pid;
    this.scene.add(card);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    const chips = [];
    for (let i = 0; i < 12; i++) {
      const ch = new THREE.Mesh(this.chipGeo, this.chipMats[i % 3 === 2 ? 2 : 0]);
      ch.visible = false;
      ch.castShadow = true;
      this.scene.add(ch);
      chips.push({ mesh: ch, y: 0, on: false });
    }
    let glass = null;
    if (Math.random() < 0.6) {
      glass = new THREE.Group();
      const gm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.085, 18, 1, true), this.glassMat);
      gm.position.y = 0.0425;
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.029, 0.03, 18), this.whiskyMat);
      liq.position.y = 0.017;
      const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.006, 18), this.glassMat);
      bottom.position.y = 0.003;
      glass.add(gm, liq, bottom);
      this.scene.add(glass);
    }
    const rec = { pid: p.pid, char: c, card, ring, chips, glass, lookKey: lookKey(p.look), faceKey: null, faceUp: false, flip: 0, angle: 0 };
    this.chars.set(p.pid, rec);
    return rec;
  }

  removeChar(pid) {
    const rec = this.chars.get(pid);
    if (!rec) return;
    this.scene.remove(rec.char.root, rec.card, rec.ring);
    rec.chips.forEach(c => this.scene.remove(c.mesh));
    if (rec.glass) this.scene.remove(rec.glass);
    rec.char.dispose();
    this.chars.delete(pid);
  }

  setCardFace(rec, card) {
    const cv = card ? drawCardFace(card) : null; // cached per card, and redrawn once the art loads
    if (cv === rec.faceKey) return;
    rec.faceKey = cv;
    if (!card) { rec.card.material[3] = this.cardBackMat; return; }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI;
    if (rec.faceMat) { rec.faceMat.map.dispose(); rec.faceMat.dispose(); }
    rec.faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    rec.card.material = rec.card.material.slice();
    rec.card.material[3] = rec.faceMat;
  }

  // ------------------------------------------------------------------ sync
  sync(view, ui = {}) {
    this.phase = view.phase;
    const inGame = view.phase !== 'lobby';
    this.layout(view.players, view.me.pid);
    const me = view.me;
    const night = view.phase === 'night';
    const awake = pid => {
      const p = view.players.find(q => q.pid === pid);
      if (!p || !p.alive) return false;
      if (!night) return true;
      if (pid === me.pid) return true;
      // mafia see fellow mafia awake; the dead see who acts
      if (p.role === 'mafia' && (me.role === 'mafia' || !me.alive)) return true;
      return false;
    };
    this.actionKind = me.actionKind;
    this.targets = new Set(me.targets || []);
    this.selected = me.actionKind === 'vote' ? me.vote : me.action;
    const accusedRec = view.accused && this.chars.get(view.accused);

    // vote tallies
    const tally = {};
    for (const p of view.players) if (p.vote && p.vote !== 'skip') tally[p.vote] = (tally[p.vote] || 0) + 1;

    for (const p of view.players) {
      const rec = this.chars.get(p.pid);
      if (!rec) continue;
      const c = rec.char;
      const dead = inGame && !p.alive;
      if (!dead) c.setGhost(false);
      else if (!c.ghost && !c.dying) {
        // someone we saw alive dies now: play the slump; otherwise (rejoin, reload) snap to ghost
        if (rec.wasAlive) c.die(); else c.setGhost(true);
      }
      rec.wasAlive = !dead;
      c.sleeping = inGame && p.alive && !awake(p.pid);
      c.setEyeGlow(night && p.role === 'mafia' && p.alive && (me.role === 'mafia' || !me.alive));
      // pointing: votes are public; mafia see each other's picks at night
      let pt = null;
      if (p.alive && p.vote && p.vote !== 'skip' && ['vote', 'lastwords', 'verdict'].includes(view.phase)) pt = p.vote;
      if (night && p.nightPick && p.role === 'mafia' && p.alive) pt = p.nightPick;
      const tr = pt && this.chars.get(pt);
      c.point = tr && p.pid !== me.pid ? tr.char.chestWorld(new THREE.Vector3()) : null;
      // cards
      rec.card.visible = inGame;
      const reveal = inGame && p.card && (!p.alive || view.phase === 'over');
      this.setCardFace(rec, p.card || null);
      rec.faceUp = !!reveal;
      // chips
      const votes = tally[p.pid] || 0;
      rec.chips.forEach((ch, i) => {
        const on = i < votes;
        if (on && !ch.on) { ch.y = 0.35 + i * 0.02; ch.mesh.visible = true; }
        ch.on = on;
        if (!on) ch.mesh.visible = false;
      });
      rec.voteCount = votes;
    }

    // mood
    const g = this.moodGoal;
    g.night = night ? 1 : 0;
    g.lamp = night ? 0 : (view.phase === 'lastwords' ? 0.35 : 1);
    g.red = view.phase === 'lastwords' ? 0.55 : (view.phase === 'vote' ? 0.12 : 0);
    g.accused = view.phase === 'lastwords' && accusedRec ? 1 : 0;
    if (accusedRec) accusedRec.char.chestWorld(this.redTarget.position);
    if (view.phase === 'lastwords' && accusedRec) {
      this.redSpot.position.set(this.redTarget.position.x * 0.7, CEIL - 0.1, this.redTarget.position.z * 0.7);
    }
    this.accusedPid = view.accused;
    this.clockProgress = view.duration ? 1 - view.timeLeft / view.duration : 0;
    this.clockDeadline = performance.now() + (view.timeLeft || 0);
    this.clockDur = view.duration || 1;
    this.day = view.day;

    // camera
    const want = inGame ? 'seat' : 'orbit';
    if (want !== this.camMode) { this.camMode = want; this.camBlend = 0; this.look.ty = 0; this.look.tp = -0.1; }
    this.myAlive = me.alive;
    this.sleeping = inGame && night && me.alive && !me.actionKind && me.role !== 'mafia' && me.role !== 'sheriff';
  }

  // one-off effects
  fx(kind, data = {}) {
    if (kind === 'deal') this.dealAnim();
    if (kind === 'kill' || kind === 'execute') {
      this.mood.flash = kind === 'kill' ? 0.9 : 0.55;
      if (kind === 'execute') this.mood.red = 1;
      this.shake = 1;
      this.lampSwing.v += 0.5; this.lampSwing.vb += 0.35;
      const v = data.pid && this.chars.get(data.pid);
      if (v) {
        const head = v.char.headWorld(new THREE.Vector3());
        for (const [pid, o] of this.chars) if (pid !== data.pid && !o.char.ghost) o.char.glanceAt(head, 3.5);
      }
    }
    if (kind === 'night') this.flickerT = 1.1;
    if (kind === 'win') { if (data.winner === 'town') this.mood.gold = 1.4; else this.mood.red = 1.2; this.lampSwing.v += 0.3; }
    if (kind === 'saved') { this.mood.gold = 1; }
    if (kind === 'inspect') { this.mood.gold = data.mafia ? 0 : 0.8; if (data.mafia) this.mood.red = 0.9; }
    if (kind === 'lobby') { for (const rec of this.chars.values()) { rec.card.visible = false; rec.faceKey = '?'; rec.card.material = [this.cardEdge, this.cardEdge, this.cardBackMat, this.cardBackMat, this.cardEdge, this.cardEdge]; } }
  }

  speak(pid, text) {
    const rec = this.chars.get(pid);
    if (!rec) return;
    rec.char.talk(900 + Math.min(4000, text.length * 45));
    const head = rec.char.headWorld(new THREE.Vector3());
    for (const [opid, o] of this.chars) if (opid !== pid && !o.char.ghost && !o.char.sleeping && Math.random() < 0.8) o.char.glanceAt(head, 2 + Math.random() * 2);
  }

  emote(pid, e, target) {
    const rec = this.chars.get(pid);
    if (!rec) return;
    if (e === 'point') {
      let tr = target && this.chars.get(target);
      if (!tr) {
        const others = [...this.chars.values()].filter(o => o !== rec && !o.char.ghost);
        tr = others[Math.floor(Math.random() * others.length)];
      }
      if (tr) {
        rec.char.gestureTarget = tr.char.chestWorld(new THREE.Vector3());
        rec.char.glanceAt(tr.char.headWorld(new THREE.Vector3()), 2.2);
      }
    }
    rec.char.emote(e);
  }

  // the living player closest to the centre of the view
  facingPlayer() {
    let best = null, bestA = 0.5;
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    const v = new THREE.Vector3();
    for (const [pid, rec] of this.chars) {
      if (pid === this.myPid || rec.char.ghost) continue;
      rec.char.headWorld(v).sub(this.camera.position).normalize();
      const a = Math.acos(THREE.MathUtils.clamp(v.dot(fwd), -1, 1));
      if (a < bestA) { bestA = a; best = pid; }
    }
    return best;
  }

  dealAnim() {
    let i = 0;
    const recs = [...this.chars.values()].sort((a, b) => a.angle - b.angle);
    for (const rec of recs) {
      rec.card.visible = true;
      rec.faceUp = false;
      rec.flip = 0;
      const from = new THREE.Vector3(0.05, TABLE_H + 0.04, 0.02);
      rec.card.position.copy(from);
      rec.cardAnim = { from, t: -i * 0.14, dur: 0.55 };
      i++;
    }
    this.dealPending = recs.length;
  }

  // --------------------------------------------------------------- camera
  placeCamera(snap) {
    const rec = this.myPid && this.chars.get(this.myPid);
    if (!rec) return;
    const p = rec.char.root.localToWorld(new THREE.Vector3(0, 1.22, 0.1));
    this.seatPos = p;
    this.seatYaw = rec.angle; // camera yaw that faces the centre from this seat
    if (snap && this.camMode === 'seat') this.camBlend = Math.min(this.camBlend, 1);
  }

  bindInput() {
    const el = this.canvas;
    let down = null;
    const ndc = new THREE.Vector2();
    this.ray = new THREE.Raycaster();
    const pickAt = (x, y) => {
      ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      const objs = [];
      for (const rec of this.chars.values()) {
        if (rec.pid !== this.myPid) objs.push(rec.char.hit);
        else if (rec.card.visible) objs.push(rec.card);
      }
      const hit = this.ray.intersectObjects(objs, false)[0];
      if (!hit) return null;
      if (hit.object.userData.pid === this.myPid && hit.object === this.chars.get(this.myPid)?.card) return { card: true };
      for (const rec of this.chars.values()) if (rec.char.hit === hit.object) return { pid: rec.pid };
      return null;
    };
    el.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, drag: false, id: e.pointerId, btn: e.button };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      this.look.px = (e.clientX / window.innerWidth) * 2 - 1;
      this.look.py = (e.clientY / window.innerHeight) * 2 - 1;
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.drag && Math.hypot(dx, dy) > 6) down.drag = true;
        if (down.drag && this.camMode === 'seat') {
          this.look.ty = THREE.MathUtils.clamp(this.look.ty - e.movementX * 0.0045, -1.9, 1.9);
          this.look.tp = THREE.MathUtils.clamp(this.look.tp - e.movementY * 0.0035, -0.85, 0.5);
        }
        if (down.drag) { this.setHover(null); return; }
      }
      const h = pickAt(e.clientX, e.clientY);
      this.setHover(h);
    });
    let dragged = false;
    el.addEventListener('pointerup', e => {
      dragged = !!(down && down.drag);
      if (down && !down.drag && down.btn === 0) {
        const h = pickAt(e.clientX, e.clientY);
        if (h && h.card) this.onCardClick && this.onCardClick();
        else if (h && h.pid) this.onPlayerClick && this.onPlayerClick(h.pid);
      }
      down = null;
    });
    el.addEventListener('pointercancel', () => { down = null; });
    el.addEventListener('pointerleave', () => { this.look.px *= 0.5; this.look.py *= 0.5; });
    el.addEventListener('dblclick', () => { this.look.ty = 0; this.look.tp = -0.1; });
    el.addEventListener('wheel', e => {
      this.fovGoal = THREE.MathUtils.clamp(this.fovGoal + Math.sign(e.deltaY) * 4, 38, 80);
    }, { passive: true });
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      if ((down && down.drag) || dragged) { dragged = false; return; } // it was a right-drag to look
      const h = pickAt(e.clientX, e.clientY);
      if (h && h.pid) this.onPlayerMark && this.onPlayerMark(h.pid);
    });
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') this.look.ty = Math.min(1.9, this.look.ty + 0.35);
      if (k === 'd' || k === 'arrowright') this.look.ty = Math.max(-1.9, this.look.ty - 0.35);
      if (k === 'w' || k === 'arrowup') this.look.tp = Math.min(0.5, this.look.tp + 0.15);
      if (k === 's' || k === 'arrowdown') this.look.tp = Math.max(-0.85, this.look.tp - 0.15);
      if (k === ' ' || k === 'c') { this.look.ty = 0; this.look.tp = -0.1; }
    });
  }

  lookAtPlayer(pid) {
    const rec = this.chars.get(pid);
    if (!rec || !this.seatPos) return;
    const h = rec.char.headWorld(new THREE.Vector3());
    const dx = h.x - this.seatPos.x, dz = h.z - this.seatPos.z;
    const yawWorld = Math.atan2(-dx, -dz);
    let rel = yawWorld - this.seatYaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.look.ty = THREE.MathUtils.clamp(rel, -1.9, 1.9);
    this.look.tp = -0.12;
  }

  setHover(h) {
    const pid = h && h.pid ? h.pid : null;
    const card = !!(h && h.card);
    if (pid === this.hover && card === this.hoverCard) return;
    this.hover = pid;
    this.hoverCard = card;
    this.canvas.style.cursor = (pid && (this.targets.has(pid))) || card ? 'pointer' : (pid ? 'help' : 'default');
    this.onHover && this.onHover(pid);
  }

  // screen positions for name tags
  project(out) {
    const v = new THREE.Vector3(), c = new THREE.Vector3();
    const w = window.innerWidth, h = window.innerHeight;
    const cam = this.camera;
    cam.updateMatrixWorld();
    for (const [pid, rec] of this.chars) {
      if (pid === this.myPid) { out[pid] = null; continue; }
      rec.char.headWorld(v);
      v.y += rec.char.ghost ? 0.42 : 0.36;
      const dist = v.distanceTo(cam.position);
      c.copy(v).applyMatrix4(cam.matrixWorldInverse);
      const ang = Math.atan2(c.x, -c.z); // + is to the right of where we look
      v.project(cam);
      const behind = c.z > -0.05;
      const edge = behind || v.x < -1 || v.x > 1 ? (ang < 0 ? 'l' : 'r') : null;
      out[pid] = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, d: dist, edge, ang };
    }
    return out;
  }

  reset() {
    for (const pid of [...this.chars.keys()]) this.removeChar(pid);
    this.layoutKey = '';
    this.myPid = null;
    this.camMode = 'orbit';
    this.camBlend = 1;
    this.targets = new Set();
    this.actionKind = null;
    this.selected = null;
    this.sleeping = false;
    this.peek = false;
    this.accusedPid = null;
    this.phase = 'lobby';
    Object.assign(this.moodGoal, { night: 0, red: 0, fade: 0, lamp: 1, accused: 0 });
  }

  // ------------------------------------------------------------------ loop
  frame() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    if (this.paused) return;
    this.adaptQuality(rawDt);
    const t = this.clock.elapsedTime;
    const now = performance.now();
    const M = this.mood, G = this.moodGoal;
    const ease = (a, b, k) => a + (b - a) * Math.min(1, dt * k);
    M.night = ease(M.night, G.night, 1.2);
    M.lamp = ease(M.lamp, G.lamp, G.lamp > M.lamp ? 1.6 : 1.0);
    M.red = ease(M.red, G.red, 2.5);
    M.accused = ease(M.accused, G.accused, 2);
    M.flash = ease(M.flash, 0, 5);
    M.gold = ease(M.gold, 0, 1.2);
    M.fade = ease(M.fade, this.sleeping ? 0.86 : 0, 1.5);
    // the lamp sputters before it goes out at nightfall
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      M.lamp = Math.random() < 0.45 ? 0.1 : 0.9;
      if (this.flickerT <= 0) M.lamp = 0.4;
    }
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.2);

    // lamp swing (damped pendulum)
    const S = this.lampSwing;
    S.v += (-S.a * 9 - S.v * 0.35) * dt; S.a += S.v * dt;
    S.vb += (-S.b * 9 - S.vb * 0.35) * dt; S.b += S.vb * dt;
    this.lamp.rotation.z = S.a * 0.12 + Math.sin(t * 0.6) * 0.012;
    this.lamp.rotation.x = S.b * 0.12 + Math.sin(t * 0.47 + 1) * 0.01;

    // lights
    const flick = 0.93 + Math.sin(t * 23) * 0.02 + Math.sin(t * 7.3) * 0.03 + (Math.random() < 0.004 ? -0.4 : 0);
    this.spot.intensity = 22 * M.lamp * flick;
    this.bulbMat.color.setRGB(4.5 * M.lamp * flick + 0.05, 3.2 * M.lamp * flick + 0.03, 1.8 * M.lamp * flick + 0.02);
    this.shadeInMat.emissiveIntensity = 0.32 * M.lamp;
    this.upLight.intensity = 0.6 * M.lamp;
    this.bounce.intensity = 9 * M.lamp * flick + 0.8;
    this.coneMat.uniforms.intensity.value = 0.06 * M.lamp;
    this.dustMat.opacity = 0.3 * M.lamp + 0.02;
    for (const c of this.candles) {
      const f = 0.8 + Math.sin(t * 11 + c.seed) * 0.1 + Math.sin(t * 17.3 + c.seed * 2) * 0.08 + Math.random() * 0.06;
      c.light.intensity = f * (0.9 - 0.45 * M.night);
      const fy = 1 + Math.sin(t * 13 + c.seed) * 0.12 + (Math.random() - 0.5) * 0.08;
      c.flame.scale.set(0.026 * (1.08 - 0.08 * fy), 0.058 * fy, 1);
      c.flame.position.x = Math.sin(t * 3 + c.seed) * 0.0015;
      c.glow.material.opacity = 0.22 * f;
    }
    for (const l of this.sconces) l.intensity = 1.3 * (1 - 0.8 * M.night);
    this.sconceGlass.color.setRGB(2.2 * (1 - 0.8 * M.night), 1.4 * (1 - 0.8 * M.night), 0.7 * (1 - 0.8 * M.night));
    this.pictureLight.intensity = 3 * (1 - 0.7 * M.night);
    const neonF = Math.random() < 0.006 ? 0.2 : 1;
    this.neonLight.intensity = 1.6 * neonF;
    this.neonMat.opacity = neonF;
    this.ambient.intensity = 0.35 - 0.2 * M.night;
    this.ambient.color.setRGB(0.23 - 0.12 * M.night, 0.16 - 0.04 * M.night, 0.19 + 0.1 * M.night);
    this.redSpot.intensity = 45 * M.accused;
    this.ember.material.color.setRGB(4 + Math.sin(t * 3) * 1.5, 1.1, 0.2);

    // lightning
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = 18 + Math.random() * 40;
      this.lightning = 1;
      this.lightningT = 0;
      setTimeout(() => this.onThunder && this.onThunder(), 600 + Math.random() * 1400);
    }
    let lf = 0;
    if (this.lightning) {
      this.lightningT += dt;
      const lt = this.lightningT;
      lf = (lt < 0.08 ? 1 : lt < 0.16 ? 0.2 : lt < 0.26 ? 0.8 : Math.max(0, 1 - (lt - 0.26) * 4));
      if (lt > 0.6) this.lightning = 0;
    }
    this.moon.intensity = 6 + 9 * M.night + lf * 45;
    this.beamMat.uniforms.intensity.value = 0.045 + 0.05 * M.night + lf * 0.25;
    this.scene.environmentIntensity = 0.6 * (0.3 + 0.7 * M.lamp);
    this.windowMat.uniforms.flash.value = lf;
    this.windowMat.uniforms.time.value = t;

    // clock: minute hand sweeps the phase, second hand ticks
    const prog = this.clockDur ? THREE.MathUtils.clamp(1 - (this.clockDeadline - now) / this.clockDur, 0, 1) : 0;
    this.minHand.rotation.z = -prog * Math.PI * 2;
    this.hourHand.rotation.z = -((this.day || 0) % 12) / 12 * Math.PI * 2 - prog * Math.PI / 6;
    this.secHand.rotation.z = -Math.floor(t) / 60 * Math.PI * 2;

    // dust drift
    if (this.dust.visible) {
      const dp = this.dust.geometry.attributes.position;
      const pol = this.dustPolar;
      const count = this.dust.geometry.drawRange.count === Infinity ? dp.count : Math.min(dp.count, this.dust.geometry.drawRange.count);
      for (let i = 0; i < count; i++) {
        const s = this.dustSeed[i];
        let y = dp.getY(i) + dt * (0.012 + Math.sin(t * 0.3 + s) * 0.01);
        if (y > 2.1) y = TABLE_H + 0.1;
        pol[i * 2] += dt * 0.02 * Math.sin(s);
        const k = 1 - (y - TABLE_H) / (2.15 - TABLE_H);
        const r = pol[i * 2 + 1] * (0.35 + 1.25 * k);
        dp.setXYZ(i, Math.cos(pol[i * 2]) * r, y, Math.sin(pol[i * 2]) * r);
      }
      dp.needsUpdate = true;
    }

    // smoke
    for (const sp of this.smoke) {
      const u = sp.userData;
      u.life += dt;
      if (u.life > u.max) { u.life = 0; sp.position.copy(this.smokeOrigin); u.dx = (Math.random() - 0.5) * 0.05; }
      const k = u.life / u.max;
      sp.position.y += dt * 0.12;
      sp.position.x += (u.dx + Math.sin(t * 0.8 + u.max) * 0.03) * dt;
      sp.position.z += Math.cos(t * 0.6 + u.max) * 0.02 * dt;
      const sc = 0.04 + k * 0.42;
      sp.scale.set(sc, sc, sc);
      sp.material.rotation += u.rot * dt;
      sp.material.opacity = Math.sin(k * Math.PI) * 0.075 * (0.4 + 0.6 * M.lamp);
    }

    // characters
    const center = new THREE.Vector3(0, 0.9, 0);
    for (const [pid, rec] of this.chars) {
      const c = rec.char;
      if (c.sleeping) c.lookGoal.copy(c.root.position).multiplyScalar(0.72).setY(0.2);
      else if (this.phase === 'lastwords' && this.accusedPid && pid !== this.accusedPid) {
        const a = this.chars.get(this.accusedPid);
        if (a) a.char.headWorld(c.lookGoal);
      } else if (c.point) c.lookGoal.copy(c.point);
      else {
        c._lookT = (c._lookT || 0) - dt;
        if (c._lookT <= 0) {
          c._lookT = 3 + Math.random() * 6;
          const r = Math.random();
          const others = [...this.chars.values()].filter(o => o !== rec);
          if (r < 0.3 || !others.length) c.lookGoal.copy(center).add(new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)));
          else if (r < 0.45) c.lookGoal.copy(this.camera.position);
          else others[Math.floor(Math.random() * others.length)].char.headWorld(c.lookGoal);
        }
      }
      // your own head is hidden only while the camera sits in it (the lobby's orbit camera shows it)
      if (pid === this.myPid) c.setSelf(this.camMode === 'seat' && this.camBlend > 0.7);
      c.update(dt, now);
      // highlight
      let hl = 0, col = 0xffffff;
      const selectable = this.targets.has(pid);
      if (selectable && this.actionKind) {
        col = ACTION_COLORS[this.actionKind] || 0xffffff;
        hl = pid === this.selected ? 1 : (pid === this.hover ? 0.6 : 0.07);
      } else if (pid === this.hover && pid !== this.myPid) { col = 0xd8c8a0; hl = 0.3; }
      if (pid === this.accusedPid && this.phase === 'lastwords') { col = 0xff2020; hl = 0.8; }
      c.setHighlight(col, hl);
      const rm = rec.ring.material;
      rm.color.setHex(col);
      rm.opacity += ((selectable && this.actionKind ? (pid === this.selected ? 0.95 : pid === this.hover ? 0.55 : 0.1) : 0) - rm.opacity) * Math.min(1, dt * 8);
      rec.ring.visible = rm.opacity > 0.01;
      // card
      this.updateCard(rec, dt, now);
      // chips fall
      rec.chips.forEach((ch, i) => {
        if (!ch.on) return;
        ch.y = Math.max(0, ch.y - dt * 1.6);
        ch.mesh.position.copy(rec.chipBase);
        ch.mesh.position.y += i * 0.0092 + ch.y;
      });
      if (rec.glass) rec.glass.visible = !c.ghost;
    }

    // camera
    this.updateCamera(dt, t, Math.min(0.25, rawDt));

    const U = this.final.uniforms;
    U.time.value = t;
    U.night.value = M.night;
    U.red.value = M.red;
    U.flash.value = M.flash;
    U.gold.value = M.gold;
    U.fade.value = M.fade;
    this.composer.render(dt);
    this.onFrame && this.onFrame();
  }

  updateCard(rec, dt, now) {
    const card = rec.card;
    if (rec.cardAnim) {
      const a = rec.cardAnim;
      a.t += dt;
      const k = THREE.MathUtils.clamp(a.t / a.dur, 0, 1);
      if (a.t < 0) { card.position.copy(a.from); return; }
      const e = 1 - Math.pow(1 - k, 3);
      card.position.lerpVectors(a.from, rec.cardHome, e);
      card.position.y += Math.sin(k * Math.PI) * 0.18;
      card.rotation.set(0, rec.cardYaw + (1 - e) * 6, 0);
      if (!a.sounded && a.t >= 0) { a.sounded = true; this.onDealCard && this.onDealCard(); }
      if (k >= 1) rec.cardAnim = null;
      return;
    }
    const goal = rec.faceUp ? 1 : 0;
    rec.flip += (goal - rec.flip) * Math.min(1, dt * 4);
    const peek = rec.pid === this.myPid && this.peek ? 1 : 0;
    rec.peekT = (rec.peekT || 0) + (peek - (rec.peekT || 0)) * Math.min(1, dt * 6);
    card.position.copy(rec.cardHome);
    card.position.y += Math.sin(rec.flip * Math.PI) * 0.12 + rec.peekT * 0.02;
    card.rotation.set(0, rec.cardYaw, 0);
    card.rotateZ(rec.flip * Math.PI);
    if (rec.peekT > 0.001) card.rotateX(-rec.peekT * 0.5);
    if (rec.pid === this.myPid && this.hoverCard && !rec.faceUp) card.position.y += 0.012 + Math.sin(now * 0.006) * 0.004;
  }

  updateCamera(dt, t, realDt = dt) {
    const cam = this.camera;
    const L = this.look;
    L.yaw += (L.ty - L.yaw) * Math.min(1, dt * 6);
    L.pitch += (L.tp - L.pitch) * Math.min(1, dt * 6);
    cam.fov += (this.fovGoal - cam.fov) * Math.min(1, dt * 6);
    cam.updateProjectionMatrix();
    // orbit pose
    const oa = t * 0.06;
    const orbitPos = new THREE.Vector3(Math.sin(oa) * 4.6, 2.9, Math.cos(oa) * 4.6);
    const orbitQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(orbitPos, new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, 1, 0)));
    let pos = orbitPos, q = orbitQ;
    if (this.camMode === 'seat' && this.seatPos) {
      const breathe = Math.sin(t * 1.6) * 0.006;
      const sp = this.seatPos.clone();
      sp.y += breathe;
      if (!this.myAlive) sp.y += 0.08 + Math.sin(t * 1.3) * 0.03;
      const par = 0.06;
      const e = new THREE.Euler(L.pitch - L.py * par * 0.6, this.seatYaw + L.yaw - L.px * par, 0, 'YXZ');
      const sq = new THREE.Quaternion().setFromEuler(e);
      this.camBlend = Math.min(1, this.camBlend + realDt * 0.45);
      const k = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);
      pos = orbitPos.clone().lerp(sp, k);
      q = orbitQ.clone().slerp(sq, k);
    }
    cam.position.copy(pos);
    cam.quaternion.copy(q);
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.03;
      cam.rotateX((Math.random() - 0.5) * s);
      cam.rotateY((Math.random() - 0.5) * s);
    }
  }
}

// additive light-shaft material: bright near the source, soft at glancing edges
function beamMaterial(color, intensity, h) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: color }, intensity: { value: intensity }, h: { value: h } },
    vertexShader: `uniform float h; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = -position.y / h; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float intensity; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float a = e * (1.0 - vY) * smoothstep(0.0, 0.08, vY) * intensity; gl_FragColor = vec4(color * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

function mergeStatic(group) {
  const buckets = new Map();
  for (const m of group.children) {
    if (!m.isMesh || m.children.length) continue;
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(m);
  }
  for (const [mat, list] of buckets) {
    if (list.length < 2) continue;
    const geos = list.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    geos.forEach(g => g.dispose());
    merged.castShadow = list.some(m => m.castShadow);
    merged.receiveShadow = list.some(m => m.receiveShadow);
    for (const m of list) group.remove(m);
    group.add(merged);
  }
}

function lookKey(l) { return LOOK_KEYS.map(k => l[k]).join('.'); }
