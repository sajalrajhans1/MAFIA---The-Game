// A small stage for your character: the bust on the title screen and the big wardrobe view.
// One WebGL context; the canvas moves between the two slots.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from './characters.js';

// size = the half-extent that must stay in view (vertically and horizontally)
const FRAMES = {
  face: { target: [0, 1.285, 0.02], size: 0.15, lift: 0.02, fov: 22 },
  bust: { target: [0, 1.2, 0.02], size: 0.26, lift: 0.07, fov: 24 },
  full: { target: [0, 1.0, 0.12], size: 0.58, lift: 0.38, fov: 28 },
};

export class LookPreview {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.05, 20);

    // a portrait setup: warm key from the lamp side, cool moonlit rim behind, soft bounce from the felt
    const key = new THREE.SpotLight(0xffe2c4, 9, 0, 0.6, 0.7, 2);
    key.position.set(0.75, 2.2, 1.35);
    key.target.position.set(0, 1.1, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0x8fb0ff, 2.2);
    rim.position.set(-1.3, 1.9, -1.3);
    const rim2 = new THREE.DirectionalLight(0xffb48a, 0.8);
    rim2.position.set(1.5, 1.4, -1.1);
    const fill = new THREE.PointLight(0xc8d4ff, 0.7, 4, 1.5);
    fill.position.set(-0.9, 1.3, 1.2);
    const bounce = new THREE.PointLight(0x9fd0a8, 0.35, 2, 1.5);
    bounce.position.set(0, 0.85, 0.7);
    this.scene.add(key, key.target, rim, rim2, fill, bounce, new THREE.HemisphereLight(0x2e2630, 0x140a08, 0.7));
    // a soft studio reflection so eyes, hat bands and shoes catch a highlight
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.22;
    pm.dispose();

    this.chairMat = new THREE.MeshStandardMaterial({ color: 0x2a140a, roughness: 0.55 });
    this.buildTable();

    this.char = null;
    this.clock = new THREE.Clock();
    this.running = false;
    this.frame = 'bust';
    this.yaw = 0; this.yawGoal = 0; this.pitch = 0; this.pitchGoal = 0;
    this.drag = null;
    this.idle = 0;
    this.bindDrag();
    this.resize();
  }

  // the near edge of a card table, so a seated character's hands have something to rest on
  buildTable() {
    const g = new THREE.Group();
    const felt = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: 0x0f3a24, roughness: 0.95 }));
    felt.position.set(0, 0.76, 0.87);
    felt.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a1a0c, roughness: 0.4, metalness: 0.1 }));
    rim.position.set(0, 0.765, 0.5);
    rim.receiveShadow = true;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 16), new THREE.MeshPhysicalMaterial({ color: 0xc88a3a, roughness: 0.1, transmission: 0.4, transparent: true, opacity: 0.75 }));
    glass.position.set(0.32, 0.82, 0.68);
    const cards = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.1), new THREE.MeshStandardMaterial({ color: 0x7a1016, roughness: 0.6 }));
    cards.position.set(-0.28, 0.786, 0.7);
    cards.rotation.y = 0.3;
    g.add(felt, rim, glass, cards);
    this.table = g;
    this.scene.add(g);
  }

  bindDrag() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => {
      if (!this.interactive) return;
      this.drag = { x: e.clientX, y: e.clientY, yaw: this.yawGoal, pitch: this.pitchGoal };
      c.setPointerCapture(e.pointerId);
      c.classList.add('grabbing');
    });
    c.addEventListener('pointermove', e => {
      if (!this.drag) return;
      this.yawGoal = this.drag.yaw - (e.clientX - this.drag.x) * 0.012;
      this.pitchGoal = Math.max(-0.25, Math.min(0.35, this.drag.pitch + (e.clientY - this.drag.y) * 0.004));
      this.idle = 0;
    });
    const up = () => { this.drag = null; c.classList.remove('grabbing'); };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => {
      if (!this.interactive) return;
      e.preventDefault();
      const order = ['face', 'bust', 'full'];
      const i = order.indexOf(this.frame);
      const j = Math.max(0, Math.min(order.length - 1, i + (e.deltaY > 0 ? 1 : -1)));
      if (j !== i) { this.setFrame(order[j]); if (this.onFrame) this.onFrame(order[j]); }
    }, { passive: false });
  }

  // move the canvas into a slot; interactive slots can be dragged to turn the character
  attach(slot, frame = 'bust', interactive = false) {
    if (this.canvas.parentElement !== slot) slot.prepend(this.canvas);
    this.interactive = interactive;
    this.canvas.classList.toggle('grab', interactive);
    this.setFrame(frame);
    this.yaw = this.yawGoal = 0;
    this.pitch = this.pitchGoal = 0;
    requestAnimationFrame(() => this.resize());
  }

  setFrame(f) {
    this.frame = FRAMES[f] ? f : 'bust';
    this.table.visible = this.frame === 'full';
    this.camera.fov = FRAMES[this.frame].fov;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const w = this.canvas.clientWidth || 110, h = this.canvas.clientHeight || 140;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setLook(look) {
    const old = this.char;
    this.char = new Character(look, { chairMat: this.chairMat });
    this.char.root.position.set(0, 0, 0);
    this.char.placeRest(0.5);
    this.char.nextIdle = 1e9; // no idle gestures, just breathing and looking at you
    this.char.root.traverse(o => { if (o.isMesh) { o.castShadow = o.userData.cast !== false; o.receiveShadow = true; } });
    this.scene.add(this.char.root);
    if (old) {
      // carry the pose over so a change of clothes doesn't restart the animation
      this.char.t = old.t;
      this.scene.remove(old.root);
      old.dispose();
    } else this.char.emote('nod');
  }

  placeCamera(dt) {
    const F = FRAMES[this.frame];
    const k = 1 - Math.exp(-dt * 9);
    // after a while untouched, drift back to face the viewer with a gentle sway
    this.idle += dt;
    if (!this.drag && this.idle > 4) {
      const home = Math.round(this.yawGoal / (Math.PI * 2)) * Math.PI * 2;
      this.yawGoal += (home + Math.sin(this.clock.elapsedTime * 0.4) * 0.35 - this.yawGoal) * (1 - Math.exp(-dt * 0.8));
      this.pitchGoal += (0 - this.pitchGoal) * (1 - Math.exp(-dt * 0.8));
    }
    this.yaw += (this.yawGoal - this.yaw) * k;
    this.pitch += (this.pitchGoal - this.pitch) * k;
    const [tx, ty, tz] = F.target;
    // fit the subject both ways: a tall, narrow canvas needs to stand further back
    const d = F.size / Math.tan(THREE.MathUtils.degToRad(F.fov) / 2) / Math.min(1, this.camera.aspect);
    const cp = Math.cos(this.pitch);
    this.camera.position.set(tx + Math.sin(this.yaw) * d * cp, ty + F.lift + Math.sin(this.pitch) * d, tz + Math.cos(this.yaw) * d * cp);
    this.camera.lookAt(tx, ty, tz);
    if (this.char) {
      // eye contact while you're in front; otherwise look ahead
      const front = Math.cos(this.yaw) > 0.35;
      if (front) this.char.lookGoal.copy(this.camera.position);
      else this.char.lookGoal.set(0, 1.25, 2);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      const dt = Math.min(0.05, this.clock.getDelta());
      if (this.char && this.canvas.offsetParent !== null) {
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        if (w && h && (Math.abs(w / h - this.camera.aspect) > 0.001 || this.renderer.domElement.width < w)) this.resize();
        this.placeCamera(dt);
        this.char.update(dt, performance.now());
        this.renderer.render(this.scene, this.camera);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
}
