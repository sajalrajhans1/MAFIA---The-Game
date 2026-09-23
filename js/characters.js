// Seated noir characters: sculpted heads, tailored suits, every look option independent.
// Each figure is baked into a few SkinnedMeshes (parts rigidly bound to bones) so a full
// table costs only ~3 draw calls per character. Two-bone arm IK, head look-at, idle
// gestures, emotes, pointing, talking, dying and a ghost state.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fabric, normalFromCanvas } from './textures.js';
import { sanitizeLook } from './looks.js';

export const SUIT_COLORS = [0x2a2a31, 0x1b2438, 0x4f1a21, 0x3b3b2a, 0x4c3522, 0x6e5f44, 0x121214, 0x4d5058, 0xcdc4ab, 0x3a2236];
export const SKIN_COLORS = [0xf0c7a6, 0xdcab86, 0xc28a62, 0x9b6645, 0x74492f, 0x55341f];
export const HAIR_COLORS = [0x141010, 0x2e1d12, 0x5a3218, 0x93522a, 0xc9a466, 0xb4b0aa];
export const HAT_COLORS = [0x141416, 0x2b2b30, 0x3d2b1e, 0x5c5c61, 0xcfc2a0];
const TIE_COLORS = [0x8c1016, 0xc9a24a, 0x121212, 0x1d2f5a, 0x1d5a3a, 0x121212, 0x9a1018, null];

const UA = 0.28, FA = 0.27; // upper arm, forearm
const DOWN = new THREE.Vector3(0, -1, 0);
const HEAD_SCALE = [0.88, 1.1, 1];

// ------------------------------------------------------------------ head sculpt
// Deform a point near a radius-0.1 sphere into a head: jaw, chin, cheekbones, temples,
// brow ridge, eye sockets, the fullness around the mouth. Shells (hair, beards) use it too.
const gauss = (a, s2) => Math.exp(-(a * a) / s2);
function sculptPoint(v) {
  let { x, y, z } = v;
  const ny = y / 0.1, front = Math.max(0, z / 0.1), ax = Math.abs(x);
  if (ny < 0) {
    const t = -ny;
    x *= 1 - 0.33 * t * t + 0.05 * gauss(ny + 0.5, 0.035) * (1 - front * 0.5); // tapering jaw, squarer corners
    z *= 1 - 0.08 * t;
    z += 0.012 * t * t * front; // chin forward
  }
  if (z < 0) z *= 1.07; // fuller skull at the back
  x *= 1 + 0.06 * gauss(ny + 0.12, 0.02) * front; // cheekbones
  x *= 1 - 0.03 * gauss(ny - 0.32, 0.03) * front * Math.min(1, ax / 0.05); // temples
  if (front > 0.2) {
    z += 0.0075 * gauss(ny - 0.37, 0.009) * front; // brow ridge
    z += 0.0045 * gauss(x, 0.0008) * gauss(ny + 0.56, 0.03) * front; // around the mouth
    z += 0.005 * gauss(x, 0.0005) * gauss(ny + 0.92, 0.012) * front; // point of the chin
    z += 0.0025 * gauss(ax - 0.046, 0.0005) * gauss(ny + 0.28, 0.02) * front; // cheeks
    const dx = ax - 0.037, dy = y - 0.018;
    z -= 0.0105 * Math.exp(-(dx * dx + dy * dy * 1.5) / 0.00028) * front; // eye sockets
  }
  v.set(x, y, z);
}

// head-bone z of the face surface at (x, y), for sitting features on the skin
function faceZ(x, y) {
  const v = new THREE.Vector3(x / HEAD_SCALE[0], y / HEAD_SCALE[1], 0);
  v.z = Math.sqrt(Math.max(0, 0.01 - v.x * v.x - v.y * v.y));
  sculptPoint(v);
  return v.z * HEAD_SCALE[2];
}

// a tube along a smooth curve whose radius follows a profile [[t, r], ...]; flat squashes it in z
function taperTube(pts, prof, { seg = 20, radial = 8, flat = 1, wide = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)), false, 'centripetal');
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  const rAt = t => {
    for (let i = 1; i < prof.length; i++) if (t <= prof[i][0]) { const [t0, r0] = prof[i - 1], [t1, r1] = prof[i]; return r0 + (r1 - r0) * (t - t0) / (t1 - t0); }
    return prof[prof.length - 1][1];
  };
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c);
    const r = rAt(i / seg);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r);
      v.z *= flat;
      v.x *= wide;
      v.add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

// per-vertex colour multiplier baked into the skin (see finalize): socket shadow, blush, jaw shade
function headTint(geo) {
  const p = geo.attributes.position, t = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(x);
    const front = Math.max(0, z / 0.1);
    const dx = ax - 0.037, dy = y - 0.017;
    let ao = 1 - 0.3 * Math.exp(-(dx * dx + dy * dy * 1.3) / 0.0002) * front; // eye sockets
    ao *= 1 - 0.1 * gauss(ax - 0.03, 0.0008) * gauss(y - 0.034, 0.00006) * front; // under the brow
    ao *= 1 - 0.28 * Math.max(0, Math.min(1, (-y - 0.075) / 0.03)); // under the jaw
    const blush = 0.55 * gauss(ax - 0.05, 0.0005) * gauss(y + 0.022, 0.0005) * front;
    const lipsArea = 0.25 * gauss(x, 0.0006) * gauss(y + 0.06, 0.0002) * front;
    const warm = blush + lipsArea;
    t[i * 3] = ao;
    t[i * 3 + 1] = ao * (1 - 0.12 * warm);
    t[i * 3 + 2] = ao * (1 - 0.13 * warm);
  }
  geo.setAttribute('tint', new THREE.Float32BufferAttribute(t, 3));
  return geo;
}

// the nose: a sphere pulled into a bridge, a rounded tip and flared wings; warmer at the tip
function noseGeo() {
  const g = new THREE.SphereGeometry(1, 22, 18);
  const p = g.attributes.position, tint = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = (1 - y) / 2; // 0 at the bridge, 1 under the tip
    const tip = gauss(s - 0.8, 0.012);
    const k = Math.min(1, s / 0.8);
    const round = s > 0.8 ? Math.sqrt(Math.max(0, 1 - ((s - 0.8) / 0.2) ** 2)) : 1;
    const proj = (0.0035 + 0.0158 * Math.pow(k, 1.25)) * round;
    const wing = gauss(s - 0.86, 0.006) * (1 - Math.max(0, z) * 0.8);
    const W = 0.0048 + 0.0036 * s + 0.0042 * tip + 0.0062 * wing;
    p.setXYZ(i, x * W, 0.012 - s * 0.044, z > 0 ? z * proj : z * 0.0025);
    const under = Math.max(0, (s - 0.88) / 0.12) * (1 - Math.max(0, z) * 0.6);
    const warm = tip * Math.max(0, z);
    tint[i * 3] = 1 - 0.4 * under;
    tint[i * 3 + 1] = (1 - 0.4 * under) * (1 - 0.1 * warm);
    tint[i * 3 + 2] = (1 - 0.4 * under) * (1 - 0.12 * warm);
  }
  g.setAttribute('tint', new THREE.Float32BufferAttribute(tint, 3));
  g.computeVertexNormals();
  return g;
}

// eyes: the white and the iris share one glossy material; the iris cap maps onto a painted iris
const ER = 0.0124; // eyeball radius
function eyeballGeo(r) {
  const g = new THREE.SphereGeometry(r, 18, 14);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.75, 0.5);
  return g;
}
function irisGeo(r, ang) {
  const g = new THREE.SphereGeometry(r * 1.006, 24, 5, 0, Math.PI * 2, 0, ang);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv, R = r * 1.006 * Math.sin(ang);
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.25 + (p.getX(i) / R) * 0.242, 0.5 + (p.getY(i) / R) * 0.484);
  return g;
}
const IRIS = [['#6b3d1c', '#2a1408'], ['#7d6a32', '#3b2a10'], ['#5b8a45', '#1f3d18'], ['#5b8ccc', '#1a3866'], ['#8d979e', '#353f47'], ['#c08a2c', '#5a360a']];
const eyeMaps = {};
let eyeGlowTex = null;
function eyeMap(ci) {
  if (eyeMaps[ci]) return eyeMaps[ci];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#ebe5d8';
  x.fillRect(0, 0, 128, 64);
  const [lite, dark] = IRIS[ci] || IRIS[0];
  const cx = 32, cy = 32, R = 31;
  const gr = x.createRadialGradient(cx, cy, 8, cx, cy, R);
  gr.addColorStop(0, dark); gr.addColorStop(0.3, lite); gr.addColorStop(0.78, lite); gr.addColorStop(1, dark);
  x.fillStyle = gr;
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  let seed = 7 + ci * 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120; i++) {
    const a = rnd() * Math.PI * 2, r0 = 11 + rnd() * 5, r1 = 18 + rnd() * 12;
    x.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.28)' : 'rgba(255,236,200,0.2)';
    x.lineWidth = 0.7 + rnd() * 1.1;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.stroke();
  }
  x.strokeStyle = 'rgba(8,4,2,0.8)'; x.lineWidth = 4;
  x.beginPath(); x.arc(cx, cy, R - 2, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#040202';
  x.beginPath(); x.arc(cx, cy, 11.5, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.95)';
  x.beginPath(); x.arc(cx - 9, cy - 10, 5, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.45)';
  x.beginPath(); x.arc(cx + 8, cy + 9, 2.2, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (!eyeGlowTex) {
    const e = document.createElement('canvas');
    e.width = 128; e.height = 64;
    const ex = e.getContext('2d');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 128, 64);
    ex.fillStyle = '#fff'; ex.beginPath(); ex.arc(cx, cy, R, 0, Math.PI * 2); ex.fill();
    eyeGlowTex = new THREE.CanvasTexture(e);
  }
  return (eyeMaps[ci] = t);
}

// geometry that depends on a look option, built once per variant
const variantCache = new Map();
function variant(key, make) {
  if (!variantCache.has(key)) variantCache.set(key, make());
  return variantCache.get(key);
}

function sculpt(geo, R) {
  const p = geo.attributes.position, v = new THREE.Vector3(), k = 0.1 / R;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(k);
    sculptPoint(v);
    v.multiplyScalar(1 / k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// a sphere segment around the head, shaped like it (hair, beards)
function shell(R, thetaStart, thetaLength, tilt = 0, phiStart = 0, phiLength = Math.PI * 2, w = 36, h = 14) {
  const g = new THREE.SphereGeometry(R, w, h, phiStart, phiLength, thetaStart, thetaLength);
  if (tilt) g.rotateX(tilt);
  return sculpt(g, R);
}

// Hair that follows a real hairline: `low` and `high` are [angle-from-front, height] curves
// (unit-sphere heights). The shell thins out toward the hairline so it blends into the scalp.
function hairline(pts, a) {
  for (let i = 1; i < pts.length; i++) {
    if (a <= pts[i][0]) {
      const [a0, h0] = pts[i - 1], [a1, h1] = pts[i];
      const t = (a - a0) / (a1 - a0), k = t * t * (3 - 2 * t);
      return h0 + (h1 - h0) * k;
    }
  }
  return pts[pts.length - 1][1];
}
// A grid whose rows run from the top boundary (the crown, or under a hat) down to the hairline,
// so the edge is clean. Columns span the azimuths from `from` (angle off the front) round the back.
// An 'edge' attribute (1 at the hairline) lets finalize() soften the colour into the skin.
function hairCap(R, low, { high = null, puff = 0, edge = 0.22, from = 0, w = 64, h = 22, front = false, fadeTop = false } = {}) {
  const pos = [], uv = [], ed = [], idx = [];
  const v = new THREE.Vector3();
  // columns sweep round the back (hair) or, with `front`, across the face from ear to ear (beards)
  const span = front ? from * 2 : Math.PI * 2 - from * 2;
  for (let i = 0; i <= w; i++) {
    const phi = front ? -from + (i / w) * span : from + (i / w) * span; // 0 = front, pi = back
    const a = Math.abs(phi > Math.PI ? Math.PI * 2 - phi : phi);
    const th1 = Math.acos(THREE.MathUtils.clamp(hairline(low, a), -1, 1));
    const th0 = high ? Math.acos(THREE.MathUtils.clamp(hairline(high, a), -1, 1)) : 0;
    for (let j = 0; j <= h; j++) {
      const t = j / h;
      const th = th0 + (th1 - th0) * t;
      const fade = Math.min(1, (fadeTop ? t : 1 - t) / edge);
      const rr = (0.1008 + (R - 0.1008) * fade * fade * (3 - 2 * fade)) * (1 + puff * Math.max(0, Math.cos(th)));
      v.set(Math.sin(th) * Math.sin(phi) * 0.1, Math.cos(th) * 0.1, Math.sin(th) * Math.cos(phi) * 0.1);
      sculptPoint(v);
      v.multiplyScalar(rr / 0.1);
      pos.push(v.x, v.y, v.z);
      uv.push(i / w, 1 - t);
      ed.push(Math.max(0, 1 - (fadeTop ? t : 1 - t) / 0.2) ** 2);
    }
  }
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      const a = i * (h + 1) + j, b = a + h + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('edge', new THREE.Float32BufferAttribute(ed, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// front, temples, sideburns, around the ears, the nape
const HAIRLINE = [[0, 0.6], [0.42, 0.64], [0.9, 0.52], [1.18, 0.2], [1.34, 0.04], [1.48, 0.3], [1.95, 0.3], [2.35, -0.1], [3.15, -0.44]];
const UNDER_HAT = [[0, 0.5], [0.9, 0.52], [1.3, 0.58], [3.15, 0.62]];
// beards: from the cheek line (under the lower lip at the front, up to the sideburns) down under the jaw
const BEARD_TOP = [[0, -0.64], [0.2, -0.6], [0.34, -0.42], [0.55, -0.2], [0.85, -0.02], [1.15, 0.1], [1.4, 0.12]];
const BEARD_LOW = [[0, -1.02], [0.6, -0.98], [1.1, -0.84], [1.4, -0.5]];
const FRINGE_TOP = [[0, 0.3], [1.3, 0.3], [1.7, 0.42], [3.15, 0.34]];

// fine strands for the hair material's normal map
let strandTex = null;
function strandNormal() {
  if (strandTex) return strandTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 128; i++) {
    const b = 90 + rnd() * 110;
    x.fillStyle = `rgb(${b},${b},${b})`;
    x.fillRect(i, 0, 1, 128);
  }
  for (let i = 0; i < 260; i++) {
    const b = rnd() < 0.5 ? 40 : 220;
    x.strokeStyle = `rgba(${b},${b},${b},0.35)`;
    x.lineWidth = 1;
    const sx = rnd() * 128, sy = rnd() * 128;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (rnd() - 0.5) * 3, sy + 20 + rnd() * 50); x.stroke();
  }
  strandTex = normalFromCanvas(c, 2.4);
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.repeat.set(18, 1.5);
  return strandTex;
}

// curls scattered over the crown (golden spiral)
function curlsGeo() {
  // tight curls packed over the hair region (inside the hairline), each a small squashed ball
  const parts = [];
  const n = 150;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const y = 1 - t * 1.5; // unit height, from the crown down
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * 2.39996;
    const a = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
    if (y < hairline(HAIRLINE, a) + 0.04) continue;
    v.set(Math.sin(phi) * r * 0.1, y * 0.1, Math.cos(phi) * r * 0.1);
    sculptPoint(v);
    v.multiplyScalar(1.075 + rnd() * 0.012);
    const size = 0.0115 + rnd() * 0.004;
    const b = new THREE.SphereGeometry(size, 7, 5);
    b.scale(1, 0.8, 1);
    b.rotateY(rnd() * 3);
    b.translate(v.x, v.y, v.z);
    parts.push(b);
  }
  return mergeGeometries(parts, false);
}

// the torso is a lathe (radius profile below) squashed front-to-back; this is its front surface
const TORSO = [[0.001, 0], [0.15, 0], [0.165, 0.1], [0.182, 0.25], [0.205, 0.42], [0.216, 0.5], [0.208, 0.56], [0.16, 0.606], [0.075, 0.632], [0.001, 0.638]];
const TORSO_Z = 0.68;
function torsoR(y) {
  for (let i = 1; i < TORSO.length; i++) {
    if (y <= TORSO[i][1]) { const [r0, y0] = TORSO[i - 1], [r1, y1] = TORSO[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
  }
  return 0.001;
}
function torsoZ(x, y) { const r = torsoR(y); return TORSO_Z * Math.sqrt(Math.max(0, r * r - x * x)); }

// a panel laid on the chest: rows from y0 to y1, each spanning xl(t)..xr(t), lifted off the cloth
function drape(y0, y1, xl, xr, lift, rows = 14, cols = 6) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, y = y0 + (y1 - y0) * t;
    const a = xl(t), b = xr(t);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, x = a + (b - a) * u;
      pos.push(x, y, torsoZ(x, y) + lift);
      uv.push(u, t);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j, b = a + cols + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// the V of the jacket opening, and a notched lapel on each side of it
const V_BOT = 0.33, V_TOP = 0.615, V_HALF = 0.068;
const vEdge = y => Math.max(0.002, V_HALF * (y - V_BOT) / (V_TOP - V_BOT));
function lapelGeo(side) {
  const y0 = 0.3, y1 = 0.605;
  const width = y => {
    if (y < 0.53) return 0.012 + 0.04 * Math.pow((y - y0) / (0.53 - y0), 0.9); // widening up to the peak
    if (y < 0.548) return 0.052;
    if (y < 0.566) return 0.028; // the notch
    return 0.034 - 0.01 * (y - 0.566) / (y1 - 0.566);
  };
  const inner = t => vEdge(y0 + (y1 - y0) * t) - 0.002;
  const outer = t => { const y = y0 + (y1 - y0) * t; return vEdge(y) - 0.002 + width(y); };
  const g = side > 0 ? drape(y0, y1, inner, outer, 0.0045, 30, 5) : drape(y0, y1, t => -outer(t), t => -inner(t), 0.0045, 30, 5);
  return g;
}
function tieGeo() {
  const half = t => t < 0.07 ? 0.0175 * (t / 0.07) : 0.0175 - 0.005 * (t - 0.07) / 0.93;
  return drape(0.345, 0.588, t => -half(t), t => half(t), 0.006, 16, 3);
}

let G = null;
function geos() {
  if (G) return G;
  const torsoPts = [[0.001, 0], [0.15, 0], [0.165, 0.1], [0.182, 0.25], [0.205, 0.42], [0.216, 0.5], [0.208, 0.56], [0.16, 0.606], [0.075, 0.632], [0.001, 0.638]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cap = (r, len) => { const g = new THREE.CapsuleGeometry(r, len - 2 * r, 4, 12); g.translate(0, -len / 2, 0); return g; };
  const tri = (pts) => { const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); return new THREE.ShapeGeometry(s); };
  const quiff = new THREE.SphereGeometry(0.05, 20, 12);
  G = {
    torso: new THREE.LatheGeometry(torsoPts, 28),
    shoulder: new THREE.SphereGeometry(0.078, 16, 12),
    shirtV: drape(V_BOT, V_TOP, t => -V_HALF * t - 0.004, t => V_HALF * t + 0.004, 0.0025, 12, 6),
    openV: drape(0.53, 0.62, t => -0.036 * t, t => 0.036 * t, 0.0045, 6, 4),
    tie: tieGeo(),
    lapelL: lapelGeo(-1),
    lapelR: lapelGeo(1),
    knot: new THREE.BoxGeometry(0.036, 0.03, 0.02),
    bowWing: new THREE.ConeGeometry(0.02, 0.036, 4),
    bowKnot: new THREE.BoxGeometry(0.014, 0.018, 0.014),
    welt: new THREE.BoxGeometry(0.05, 0.006, 0.005),
    square: tri([[-0.022, 0], [-0.012, 0.02], [-0.002, 0.004], [0.008, 0.022], [0.02, 0]]),
    petal: new THREE.SphereGeometry(0.0105, 8, 6),
    leaf: new THREE.ConeGeometry(0.006, 0.03, 4),
    pin: new THREE.SphereGeometry(0.0075, 10, 8),
    collar: new THREE.TorusGeometry(0.058, 0.013, 6, 18, Math.PI * 1.25),
    shirtCollar: new THREE.TorusGeometry(0.056, 0.011, 6, 18, Math.PI * 1.55),
    button: new THREE.SphereGeometry(0.0085, 8, 6),
    neck: new THREE.CylinderGeometry(0.053, 0.06, 0.1, 16),
    head: headTint(sculpt(new THREE.SphereGeometry(0.1, 56, 42), 0.1)),
    ear: new THREE.SphereGeometry(0.024, 12, 10),
    nose: noseGeo(),
    eyeball: eyeballGeo(ER),
    eyeballSmall: eyeballGeo(ER * 0.8),
    iris: irisGeo(ER, 0.68),
    irisBeady: irisGeo(ER * 0.8, 0.95),
    finger: cap(0.0088, 0.05),
    // hair styles (shaped like the head)
    hairSlick: hairCap(0.1062, HAIRLINE, { puff: 0.03 }),
    hairSide: hairCap(0.1068, HAIRLINE.map(([a, y]) => [a, a < 0.8 ? y - 0.03 : y]), { puff: 0.04 }),
    hairBuzz: hairCap(0.1026, HAIRLINE, { edge: 0.12 }),
    hairUnderHat: hairCap(0.1046, HAIRLINE, { high: UNDER_HAT, from: 0.95, edge: 0.3 }),
    hairFringe: hairCap(0.1046, HAIRLINE, { high: FRINGE_TOP, from: 1.25, edge: 0.3 }),
    hairSwoop: new THREE.SphereGeometry(0.05, 18, 10),
    // bob: a crown with bangs plus a curtain over the sides and back, open at the face
    bobTop: shell(0.108, 0, 0.4 * Math.PI, -0.18),
    bobSides: shell(0.11, 0.28 * Math.PI, 0.38 * Math.PI, 0.1, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9),
    quiff,
    curls: curlsGeo(),
    // facial hair
    chinTuft: new THREE.SphereGeometry(0.02, 12, 8),
    beard: hairCap(0.1085, BEARD_LOW, { high: BEARD_TOP, front: true, from: 1.4, fadeTop: true, edge: 0.3, w: 48, h: 16 }),
    stubble: hairCap(0.1013, BEARD_LOW, { high: BEARD_TOP, front: true, from: 1.4, fadeTop: true, edge: 0.3, w: 48, h: 16 }),
    // mouths
    mouthIn: new THREE.CircleGeometry(1, 20),
    oLip: new THREE.TorusGeometry(0.0078, 0.0029, 8, 24),
    cigar: new THREE.CylinderGeometry(0.0062, 0.0068, 0.075, 10),
    emberTip: new THREE.SphereGeometry(0.0066, 8, 6),
    // eyewear
    rim: new THREE.TorusGeometry(0.021, 0.0022, 6, 28),
    lens: new THREE.CircleGeometry(0.0205, 24),
    bridge: new THREE.BoxGeometry(0.024, 0.003, 0.003),
    temple: new THREE.BoxGeometry(0.003, 0.003, 0.11),
    shade: new THREE.SphereGeometry(0.023, 18, 12),
    browBar: new THREE.BoxGeometry(0.108, 0.005, 0.006),
    cup: new THREE.CylinderGeometry(0.023, 0.027, 0.026, 20, 1, true),
    gogRim: new THREE.TorusGeometry(0.024, 0.0035, 6, 28),
    gogLens: new THREE.CircleGeometry(0.023, 24),
    strap: new THREE.TorusGeometry(0.1, 0.006, 6, 40, Math.PI + 1.5),
    chain: new THREE.CylinderGeometry(0.0013, 0.0013, 0.1, 5),
    patch: new THREE.CircleGeometry(0.024, 20),
    patchStrap: new THREE.TorusGeometry(0.101, 0.0032, 5, 48),
    // hats
    brim: new THREE.CylinderGeometry(0.176, 0.176, 0.01, 40),
    brimS: new THREE.CylinderGeometry(0.142, 0.142, 0.01, 40),
    brimTop: new THREE.CylinderGeometry(0.152, 0.152, 0.009, 40),
    crown: new THREE.CylinderGeometry(0.084, 0.104, 0.115, 32),
    crownT: new THREE.CylinderGeometry(0.072, 0.098, 0.108, 32),
    crownTop: new THREE.CylinderGeometry(0.09, 0.087, 0.2, 32),
    dent: new THREE.BoxGeometry(0.012, 0.012, 0.13),
    band: new THREE.CylinderGeometry(0.1055, 0.1055, 0.028, 32),
    bandTop: new THREE.CylinderGeometry(0.0915, 0.0915, 0.034, 32),
    dome: new THREE.SphereGeometry(0.106, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    capCrown: new THREE.SphereGeometry(0.118, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    capBill: new THREE.CylinderGeometry(0.085, 0.085, 0.008, 28, 1, false, -Math.PI / 2, Math.PI),
    capButton: new THREE.SphereGeometry(0.012, 10, 6),
    // arms, hands, legs
    upper: cap(0.05, UA),
    fore: cap(0.043, FA),
    cuff: new THREE.CylinderGeometry(0.045, 0.045, 0.024, 14),
    palm: new THREE.SphereGeometry(0.045, 16, 10),
    thumb: new THREE.CapsuleGeometry(0.0115, 0.028, 3, 8),
    thigh: new THREE.CapsuleGeometry(0.072, 0.3, 4, 12),
    shin: new THREE.CapsuleGeometry(0.056, 0.34, 4, 12),
    shoe: new THREE.BoxGeometry(0.095, 0.075, 0.2),
    // chair and picking
    seat: new THREE.BoxGeometry(0.5, 0.055, 0.47),
    leg: new THREE.CylinderGeometry(0.022, 0.018, 0.44, 8),
    post: new THREE.CylinderGeometry(0.022, 0.024, 0.62, 8),
    rail: new THREE.BoxGeometry(0.48, 0.085, 0.045),
    slat: new THREE.BoxGeometry(0.045, 0.4, 0.02),
    hit: new THREE.CylinderGeometry(0.3, 0.3, 1.25, 10),
  };
  return G;
}

// shared suit cloth maps: 0 plain worsted, 1 pinstripe, 2 chalk stripe, 3 check
const fabricMaps = {};
let weaveNormal = null;
function fabricMap(kind) {
  if (!fabricMaps[kind]) {
    const t = new THREE.CanvasTexture(fabric(kind));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 5);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    fabricMaps[kind] = t;
  }
  if (!weaveNormal) { weaveNormal = normalFromCanvas(fabric(0), 1.6); weaveNormal.repeat.set(10, 5); }
  return fabricMaps[kind];
}

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpQ3 = new THREE.Quaternion(), tmpQ4 = new THREE.Quaternion();
const tmpC = new THREE.Color();
const tmpM = new THREE.Matrix4();
const bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

function mergeByMaterial(group) {
  const buckets = new Map();
  for (const m of group.children) {
    if (!m.isMesh) continue;
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(m);
  }
  for (const [mat, list] of buckets) {
    if (list.length < 2) continue;
    const geos = list.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    geos.forEach(g => g.dispose());
    merged.castShadow = true;
    merged.receiveShadow = true;
    for (const m of list) group.remove(m);
    group.add(merged);
  }
}

export class Character {
  constructor(lookIn, { chairMat, self = false } = {}) {
    const g = geos();
    const look = this.look = sanitizeLook(lookIn);
    this.self = self;
    this.root = new THREE.Group();
    this.meshes = [];
    this.mats = [];
    this.glowMats = [];
    const std = (color, rough = 0.7, extra = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
      this.mats.push(m);
      return m;
    };
    const phys = params => {
      const m = new THREE.MeshPhysicalMaterial({ metalness: 0, ...params });
      this.mats.push(m);
      return m;
    };

    // two shared materials carry per-part colour in vertex colours
    const suitHex = SUIT_COLORS[look.suit];
    const suitCol = new THREE.Color(suitHex).multiplyScalar(look.suit === 8 ? 1 : 1.15);
    this.clothMat = phys({
      vertexColors: true, map: fabricMap(look.pattern), normalMap: weaveNormal, normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.82, sheen: 0.55, sheenRoughness: 0.7, sheenColor: suitCol.clone().lerp(new THREE.Color(1, 1, 1), 0.25),
    });
    const hairHex0 = HAIR_COLORS[look.hairColor];
    this.hairMat = phys({
      vertexColors: true, normalMap: strandNormal(), normalScale: new THREE.Vector2(0.4, 0.4),
      roughness: 0.5, sheen: 0.45, sheenRoughness: 0.35, sheenColor: new THREE.Color(hairHex0).multiplyScalar(1.6).lerp(new THREE.Color(0.55, 0.5, 0.45), 0.25),
    });
    // skin, shirt, hat...: a soft warm sheen at grazing angles stands in for subsurface scattering
    this.plainMat = phys({ vertexColors: true, roughness: 0.56, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.62, 0.4, 0.34) });
    const C = this.C = (kind, color) => ({ kind, color: new THREE.Color(color) });
    const skinHex = SKIN_COLORS[look.skin], hairHex = HAIR_COLORS[look.hairColor];
    this.skinColor = new THREE.Color(skinHex);
    const suit = C('cloth', suitCol);
    const lapelM = C('cloth', new THREE.Color(suitHex).multiplyScalar(look.suit === 8 ? 0.86 : 0.78));
    const pants = C('cloth', suitCol.clone().multiplyScalar(0.85));
    const shirtM = C('plain', 0xd9d2c0);
    const skin = C('plain', skinHex);
    const hairM = C('hair', hairHex);
    const shoeM = C('plain', 0x0b0806);
    // wet, glossy eyes; the iris can glow (Jokers see each other at night)
    this.eyeMat = phys({ map: eyeMap(look.eyeColor), emissiveMap: eyeGlowTex, emissive: 0x000000, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 });
    this.glowMats.push(this.eyeMat);

    // parts are placeholders (transform holders) until finalize() bakes them into skinned meshes
    const parts = this.parts = [];
    const add = this.add = (bone, geo, spec, pos, rot, scale) => {
      const o = new THREE.Object3D();
      if (pos) o.position.set(...pos);
      if (rot) o.rotation.set(...rot);
      if (scale) o.scale.set(...scale);
      bone.add(o);
      parts.push({ o, geo, spec, bone });
      return o;
    };

    // chair: static, shared material, merged into one mesh
    this.chair = new THREE.Group();
    const addC = (geo, pos, rot) => { const m = new THREE.Mesh(geo, chairMat); m.position.set(...pos); if (rot) m.rotation.set(...rot); this.chair.add(m); };
    addC(g.seat, [0, 0.455, -0.02]);
    for (const [x, z] of [[-0.21, 0.19], [0.21, 0.19], [-0.21, -0.22], [0.21, -0.22]]) addC(g.leg, [x, 0.22, z]);
    for (const x of [-0.21, 0.21]) addC(g.post, [x, 0.78, -0.235], [-0.08, 0, 0]);
    addC(g.rail, [0, 1.06, -0.26], [-0.08, 0, 0]);
    for (const x of [-0.1, 0, 0.1]) addC(g.slat, [x, 0.78, -0.24], [-0.08, 0, 0]);
    mergeByMaterial(this.chair);
    this.root.add(this.chair);

    // legs
    this.body = new THREE.Bone();
    this.root.add(this.body);
    for (const s of [-1, 1]) {
      add(this.body, g.thigh, pants, [s * 0.1, 0.53, 0.17], [Math.PI / 2, 0, 0]);
      add(this.body, g.shin, pants, [s * 0.1, 0.3, 0.38]);
      add(this.body, g.shoe, shoeM, [s * 0.1, 0.04, 0.43]);
    }

    // torso, pivoting at the hips
    this.wf = 0.97 + ((look.suit * 7 + look.skin * 3) % 4) * 0.02; // a little build variety
    this.spine = new THREE.Bone();
    this.spine.position.set(0, 0.5, -0.02);
    this.spine.scale.set(this.wf, 1, 1);
    this.body.add(this.spine);
    add(this.spine, g.torso, suit, [0, 0, 0], null, [1, 1, 0.68]);
    add(this.spine, g.shirtV, shirtM);
    this.buildTie(look.tie, skin);
    add(this.spine, g.lapelL, lapelM);
    add(this.spine, g.lapelR, lapelM);
    for (const s of [-1, 1]) add(this.spine, g.shoulder, suit, [s * 0.158, 0.532, -0.006], [0, 0, s * -0.2], [0.92, 0.42, 0.88]);
    add(this.spine, g.collar, lapelM, [0, 0.598, -0.004], [Math.PI / 2 + 0.25, 0, 0.875 * Math.PI], [1, 1.05, 1]);
    add(this.spine, g.shirtCollar, shirtM, [0, 0.63, 0.006], [Math.PI / 2 + 0.18, 0, Math.PI / 2 + 0.225 * Math.PI], [1, 1.05, 1.5]);
    for (const y of [0.29, 0.2]) add(this.spine, g.button, shoeM, [0.004, y, torsoZ(0.004, y) + 0.002], null, [1, 1, 0.6]);
    add(this.spine, g.welt, lapelM, [0.112, 0.43, torsoZ(0.112, 0.43) + 0.001], [0, 0.55, 0]);
    this.buildExtra(look.extra);

    // head
    this.head = new THREE.Bone();
    this.head.position.set(0, 0.757, 0.012);
    this.spine.add(this.head);
    add(this.head, g.neck, skin, [0, -0.1, -0.007]); // on the head bone, so first person hides it too
    add(this.head, g.head, skin, [0, 0, 0], null, HEAD_SCALE);
    for (const s of [-1, 1]) add(this.head, g.ear, skin, [s * 0.085, -0.006, -0.008], [0, s * 0.3, 0], [0.34, 0.95, 0.72]);
    add(this.head, g.nose, skin, [0, 0.006, faceZ(0, -0.01) - 0.0035], [-0.06, 0, 0]);
    this.buildEyes(look.eyes, skin, hairM);
    this.buildHair(look.hair, look.hat !== 4, hairM);
    this.buildFacialHair(look.facial, hairM, skinHex, hairHex);
    this.buildMouth(look.mouth);
    this.buildEyewear(look.wear);
    this.buildHat(look.hat, look.hatColor);

    // arms
    this.arms = [-1, 1].map(side => {
      const shoulder = new THREE.Bone();
      shoulder.position.set(side * 0.2, 0.47, 0.0);
      this.spine.add(shoulder);
      add(shoulder, g.upper, suit);
      const elbow = new THREE.Bone();
      elbow.position.set(0, -UA, 0);
      shoulder.add(elbow);
      add(elbow, g.fore, suit);
      add(elbow, g.cuff, shirtM, [0, -FA + 0.02, 0]);
      // hand: palm-down with the thumb tucked toward the body (the forearm twist is controlled in solveArm)
      add(elbow, g.palm, skin, [0, -FA - 0.03, 0.004], null, [0.84, 1.08, 0.46]);
      add(elbow, g.thumb, skin, [-side * 0.03, -FA - 0.024, -0.004], [0.2, 0, -side * 0.55]);
      // four fingers, resting slightly curled
      [[0.0165, 0.046], [0.0055, 0.051], [-0.0055, 0.048], [-0.0162, 0.04]].forEach(([fx, len], i) => {
        add(elbow, g.finger, skin, [side * fx, -FA - 0.068, 0.002 - Math.abs(fx) * 0.08], [0.32 + i * 0.03, 0, side * fx * 1.4], [0.95 - Math.abs(fx) * 4, len / 0.05, 0.9]);
      });
      return { side, shoulder, elbow, cur: new THREE.Vector3(), goal: new THREE.Vector3(), rest: new THREE.Vector3(), init: false };
    });

    // picking hitbox
    this.hit = new THREE.Mesh(g.hit, new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.set(0, 0.95, 0.05);
    this.root.add(this.hit);

    this.finalize();
    this.ghostMat = new THREE.MeshStandardMaterial({
      color: 0x9fc4ff, emissive: 0x3a66c4, emissiveIntensity: 0.5, roughness: 0.4,
      transparent: true, opacity: 0.22, depthWrite: false,
    });
    this.mats.push(this.ghostMat);

    // animation state
    this.t = Math.random() * 100;
    this.lookGoal = new THREE.Vector3(0, 1, 0);
    this.lookOverride = null;
    this.lookUntil = 0;
    this.yaw = 0; this.pitch = 0;
    this.point = null;
    this.talkUntil = 0;
    this.gesture = null;
    this.nextIdle = 2 + Math.random() * 5;
    this.ghost = false;
    this.hl = { color: new THREE.Color(0), amt: 0, goal: 0 };
    this.eyeGlow = 0;
    this.eyeGlowGoal = 0;
    this.lean = 0.06;
    this.blinkIn = 1 + Math.random() * 3;
    this.blink = 0;
    this.gaze = { yaw: 0, pitch: 0, dartYaw: 0, dartPitch: 0, next: 0.5 };
    this.brow = 0;
  }

  // ------------------------------------------------------------- outfit parts
  buildTie(t, skin) {
    const g = geos(), C = this.C, S = this.spine;
    const col = TIE_COLORS[t];
    const kz = torsoZ(0, 0.592);
    if (t <= 4) {
      const m = C('plain', col);
      this.add(S, g.tie, m);
      this.add(S, g.knot, m, [0, 0.592, kz + 0.006], [-0.35, 0, 0], [0.8, 1, 0.8]);
    } else if (t <= 6) {
      const m = C('plain', col);
      for (const s of [-1, 1]) this.add(S, g.bowWing, m, [s * 0.019, 0.594, kz + 0.01], [0, 0, s * Math.PI / 2], [1, 1, 0.55]);
      this.add(S, g.bowKnot, m, [0, 0.594, kz + 0.013]);
    } else {
      this.add(S, g.openV, skin);
    }
  }

  buildExtra(e) {
    const g = geos(), C = this.C, S = this.spine;
    if (e === 1 || e === 2) {
      const petal = C('plain', e === 1 ? 0xb3121c : 0xece6da);
      const cx = 0.084, cy = 0.51, cz = torsoZ(0.084, 0.51) + 0.012;
      for (const [dx, dy] of [[0, 0], [0.008, 0.006], [-0.008, 0.005], [0.006, -0.007], [-0.006, -0.007]]) this.add(S, g.petal, petal, [cx + dx, cy + dy, cz]);
      this.add(S, g.leaf, C('plain', 0x2c5a24), [cx + 0.004, cy - 0.022, cz - 0.004], [0, 0, 2.7]);
    } else if (e === 3) {
      this.add(S, g.square, C('plain', 0xe9e3d6), [0.112, 0.431, torsoZ(0.112, 0.43) + 0.002], [0, 0.55, 0]);
    } else if (e === 4) {
      this.add(S, g.pin, C('plain', 0xd4a73a), [0.082, 0.5, torsoZ(0.082, 0.5) + 0.009]);
    }
  }

  // 0 classic, 1 narrow, 2 wide, 3 sleepy, 4 beady, 5 shifty
  // Eyeballs sit in the sockets on their own bones (they look around); upper lids blink.
  buildEyes(es, skin, hairM) {
    const g = geos(), H = this.head, C = this.C;
    const EY = 0.0175, EX = 0.037 * HEAD_SCALE[0];
    const small = es === 4;
    const r = small ? ER * 0.8 : ER;
    // how open the lids are (edge height as a fraction of the lid radius), and the tilt of the eye
    const up = [0.44, 0.14, 0.72, 0.0, 0.4, 0.42][es];
    const low = [-0.4, -0.26, -0.6, -0.46, -0.42, -0.4][es];
    const tilt = [0.06, 0.16, 0.02, -0.08, 0.04, 0.06][es];
    const lash = C('plain', new THREE.Color(HAIR_COLORS[this.look.hairColor]).multiplyScalar(0.35).lerp(new THREE.Color(0x0a0605), 0.6));
    const LR = r * 1.12, LT = 1.92; // lid radius and cap size (from the top pole)
    const lidGeo = variant('lidUp' + small, () => new THREE.SphereGeometry(LR, 22, 10, 0, Math.PI * 2, 0, LT));
    const lashGeo = variant('lash' + small, () => {
      const t = new THREE.TorusGeometry(LR * Math.sin(LT), 0.00085, 5, 22, Math.PI);
      t.rotateX(Math.PI / 2);
      t.translate(0, LR * Math.cos(LT), 0);
      return t;
    });
    this.eyes = [];
    this.lids = [];
    this.lidOpen = Math.acos(up) - LT;
    this.lidShut = Math.acos(-0.25) - LT;
    this.eyeBias = es === 5 ? 0.3 : 0;
    for (const s of [-1, 1]) {
      const ex = s * EX, ez = faceZ(ex, EY) - r * 0.42;
      const eye = new THREE.Bone();
      eye.position.set(ex, EY, ez);
      H.add(eye);
      this.add(eye, small ? g.eyeballSmall : g.eyeball, this.eyeMat);
      this.add(eye, small ? g.irisBeady : g.iris, this.eyeMat);
      this.eyes.push(eye);
      const lid = new THREE.Bone();
      lid.position.set(ex, EY, ez);
      lid.rotation.set(this.lidOpen, 0, s * tilt);
      H.add(lid);
      this.add(lid, lidGeo, skin);
      this.add(lid, lashGeo, lash);
      this.lids.push(lid);
      // the lower lid is tilted back so its edge rises toward the middle of the eye (an almond shape)
      const lowGeo = variant('lidLow' + small + low, () => { const th = Math.acos(low) + 0.3; return new THREE.SphereGeometry(r * 1.08, 22, 6, 0, Math.PI * 2, th, Math.PI - th); });
      this.add(H, lowGeo, skin, [ex, EY, ez], [-0.3, 0, s * tilt]);
    }
    // brows: tapered strokes laid on the brow ridge, shaped by the eye style
    const B = this.browBone = new THREE.Bone();
    B.position.set(0, 0, 0);
    H.add(B);
    const shapes = [
      [0.041, 0.047, 0.043], // classic
      [0.036, 0.042, 0.045], // narrow: knitted, angled
      [0.046, 0.053, 0.047], // wide: raised
      [0.042, 0.045, 0.038], // sleepy: drooping ends
      [0.039, 0.045, 0.041], // beady
      [0.04, 0.046, 0.043],  // shifty (right brow raised below)
    ][es];
    const thick = [1, 1.1, 0.9, 0.95, 1.15, 1][es];
    for (const s of [-1, 1]) {
      let [yi, ym, yo] = shapes;
      if (es === 5 && s > 0) { yi += 0.006; ym += 0.008; yo += 0.004; }
      const key = `brow${es}${s}`;
      const geo = variant(key, () => {
        const pt = (x, y) => [s * x, y, faceZ(s * x, y) + 0.0022];
        return taperTube([pt(0.012, yi), pt(0.024, ym - 0.001), pt(0.036, ym), pt(0.05, yo)],
          [[0, 0.0036 * thick], [0.35, 0.0034 * thick], [0.75, 0.0026 * thick], [1, 0.0009]], { seg: 16, radial: 6, flat: 0.45 });
      });
      this.add(B, geo, hairM);
    }
  }

  // 0 slicked back, 1 side part, 2 buzz, 3 pompadour, 4 curly, 5 bald
  buildHair(style, hatOn, hairM) {
    const g = geos(), H = this.head;
    if (style === 5) { this.add(H, g.hairFringe, hairM, null, null, HEAD_SCALE); return; }
    if (style === 6) { // the bob shows under a hat too
      if (!hatOn) this.add(H, g.bobTop, hairM, null, null, HEAD_SCALE);
      this.add(H, g.bobSides, hairM, null, null, HEAD_SCALE);
      return;
    }
    if (hatOn) { this.add(H, g.hairUnderHat, hairM, null, null, HEAD_SCALE); return; }
    if (style === 2) { this.add(H, g.hairBuzz, hairM, null, null, HEAD_SCALE); return; }
    this.add(H, style === 1 ? g.hairSide : g.hairSlick, hairM, null, null, HEAD_SCALE);
    if (style === 1) this.add(H, g.hairSwoop, hairM, [-0.03, 0.098, 0.03], [0.1, 0, 0.35], [1.1, 0.34, 1.25]);
    if (style === 3) {
      // a pompadour: a roll rising off the hairline and swept back over the crown
      const roll = variant('pomp', () => taperTube(
        [[0, 0.07, 0.083], [0, 0.1, 0.066], [0, 0.119, 0.03], [0, 0.121, -0.012], [0, 0.109, -0.05]],
        [[0, 0.012], [0.2, 0.024], [0.45, 0.024], [0.75, 0.017], [1, 0.006]], { seg: 24, radial: 12, wide: 2.3 }));
      this.add(H, roll, hairM);
    }
    if (style === 4) this.add(H, g.curls, hairM, null, null, HEAD_SCALE);
  }

  // 0 clean, 1 moustache, 2 pencil moustache, 3 goatee, 4 full beard, 5 stubble
  buildFacialHair(f, hairM, skinHex, hairHex) {
    const g = geos(), H = this.head;
    const MY = -0.0565;
    const on = (x, y, lift) => [x, y, faceZ(x, y) + lift];
    // a full moustache: thick in the middle, tapering down past the corners of the mouth
    if (f === 1 || f === 3 || f === 4) {
      const thin = f === 3 ? 0.75 : 1;
      const geo = variant('stache' + f, () => taperTube(
        [on(-0.026, MY - 0.004, 0.0015), on(-0.017, MY + 0.0075, 0.004), on(0, MY + 0.0105, 0.0055), on(0.017, MY + 0.0075, 0.004), on(0.026, MY - 0.004, 0.0015)],
        [[0, 0.0012], [0.18, 0.0042 * thin], [0.5, 0.0058 * thin], [0.82, 0.0042 * thin], [1, 0.0012]], { seg: 24, radial: 8, flat: 0.62 }));
      this.add(H, geo, hairM);
    }
    // a pencil moustache: two thin strokes with a gap under the nose
    if (f === 2) {
      for (const s of [-1, 1]) {
        const geo = variant('pencil' + s, () => taperTube(
          [on(s * 0.0022, MY + 0.0085, 0.0028), on(s * 0.011, MY + 0.0078, 0.0028), on(s * 0.021, MY + 0.0035, 0.0018)],
          [[0, 0.0011], [0.5, 0.0015], [1, 0.0006]], { seg: 10, radial: 5, flat: 0.6 }));
        this.add(H, geo, hairM);
      }
    }
    if (f === 3) this.add(H, g.chinTuft, hairM, [0, -0.104, faceZ(0, -0.104) - 0.012], [0.4, 0, 0], [0.95, 1.35, 0.72]);
    if (f === 4) this.add(H, g.beard, hairM, null, null, HEAD_SCALE);
    if (f === 5) this.add(H, g.stubble, this.C('plain', new THREE.Color(skinHex).lerp(new THREE.Color(hairHex), 0.45)), null, null, HEAD_SCALE);
  }

  // 0 neutral, 1 smirk, 2 grin, 3 frown, 4 surprised, 5 cigar, 6 red lips, 7 red smile
  // Upper and lower lips ride their own bones so they part when the character talks.
  buildMouth(ms) {
    const g = geos(), C = this.C, H = this.head;
    const MY = -0.0565, MZ = faceZ(0, MY) - 0.0008;
    const MW = ms === 2 ? 0.0215 : 0.0185;
    const red = ms >= 6;
    const skinC = new THREE.Color(SKIN_COLORS[this.look.skin]);
    const lipC = red ? new THREE.Color(0x9a1420) : skinC.clone().multiply(new THREE.Color(0.8, 0.56, 0.52)).lerp(new THREE.Color(0x5a2420), 0.15);
    const lip = C('plain', lipC);
    const dark = C('plain', 0x1c0806);
    if (ms === 6) ms = 0;
    if (ms === 7) ms = 1.5;
    const shape = ms === 1 ? 'smirk' : ms === 1.5 ? 'smile' : ms === 2 ? 'grin' : ms === 3 ? 'frown' : ms === 4 ? 'o' : 'flat';
    // corner heights (left, right) and how far the lips sit apart
    const [cl, cr] = { flat: [0, 0], smirk: [0.0005, 0.0068], smile: [0.0045, 0.0045], grin: [0.0062, 0.0062], frown: [-0.0058, -0.0058], o: [0, 0] }[shape];
    const gap = shape === 'grin' ? 0.005 : 0;
    const zAt = x => faceZ(x, MY) - 0.0008 - MZ;
    const mk = (x, y, dz = 0) => [x, y, zAt(x) + dz];
    this.lipU = new THREE.Bone(); this.lipU.position.set(0, MY, MZ); H.add(this.lipU);
    this.lipL = new THREE.Bone(); this.lipL.position.set(0, MY, MZ); H.add(this.lipL);
    this.mouthIn = new THREE.Bone(); this.mouthIn.position.set(0, MY - 0.001, MZ - 0.0045); H.add(this.mouthIn);
    this.lipBase = { u: MY, l: MY };
    this.mouthOpen = shape === 'o' ? 1 : gap ? 0.7 : 0;
    const full = red ? 1.12 : 1;
    if (shape === 'o') {
      this.add(this.lipU, g.oLip, lip, [0, -0.001, 0.0005], null, [1, 1.3, 0.8]);
      this.add(this.mouthIn, g.mouthIn, dark, null, null, [0.0074, 0.0098, 1]);
      return;
    }
    const mid = (a, b) => (a + b) * 0.36;
    const upper = variant(`lipU${shape}${full}`, () => taperTube(
      [mk(-MW, cl + 0.0004), mk(-MW * 0.55, mid(cl, 0) + 0.0022 + gap * 0.5), mk(-0.004, 0.0029 + gap * 0.5, 0.0012), mk(0, 0.0024 + gap * 0.5, 0.0014), mk(0.004, 0.0029 + gap * 0.5, 0.0012), mk(MW * 0.55, mid(cr, 0) + 0.0022 + gap * 0.5), mk(MW, cr + 0.0004)],
      [[0, 0.0007], [0.2, 0.0022 * full], [0.5, 0.0027 * full], [0.8, 0.0022 * full], [1, 0.0007]], { seg: 28, radial: 8, flat: 0.72 }));
    const lower = variant(`lipL${shape}${full}`, () => taperTube(
      [mk(-MW * 0.94, cl - 0.0006), mk(-MW * 0.45, mid(cl, 0) - 0.0042 - gap), mk(0, -0.0051 - gap, 0.0012), mk(MW * 0.45, mid(cr, 0) - 0.0042 - gap), mk(MW * 0.94, cr - 0.0006)],
      [[0, 0.0007], [0.25, 0.0031 * full], [0.5, 0.0038 * full], [0.75, 0.0031 * full], [1, 0.0007]], { seg: 24, radial: 8, flat: 0.75 }));
    const line = variant(`lipLine${shape}`, () => taperTube(
      [mk(-MW * 1.02, cl, -0.001), mk(-MW * 0.5, mid(cl, 0) - gap * 0.2), mk(0, -gap * 0.25, 0.0008), mk(MW * 0.5, mid(cr, 0) - gap * 0.2), mk(MW * 1.02, cr, -0.001)],
      [[0, 0.0005], [0.2, 0.001], [0.8, 0.001], [1, 0.0005]], { seg: 20, radial: 5, flat: 0.8 }));
    this.add(this.lipU, upper, lip);
    this.add(this.lipL, lower, lip);
    this.add(this.lipU, line, dark);
    this.add(this.mouthIn, g.mouthIn, dark, [0, gap ? -gap * 0.3 : 0, 0], null, [MW * 0.86, gap ? 0.0062 : 0.0045, 1]);
    if (shape === 'grin') {
      const teeth = variant('teeth', () => taperTube(
        [mk(-MW * 0.74, 0.0016, -0.0024), mk(0, -0.0006, -0.0009), mk(MW * 0.74, 0.0016, -0.0024)],
        [[0, 0.0018], [0.5, 0.0031], [1, 0.0018]], { seg: 16, radial: 6, flat: 0.5 }));
      this.add(this.lipU, teeth, C('plain', 0xeee6d2), [0, -0.0004, 0]);
    }
    if (ms === 5) {
      // the cigar hangs off the head, so it doesn't bob when the lips move
      this.add(H, g.cigar, C('plain', 0x5a3418), [0.011, MY - 0.004, MZ + 0.034], [Math.PI / 2 + 0.3, 0, 0]);
      this.emberM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.1, 0.2), toneMapped: false });
      this.mats.push(this.emberM);
      this.add(H, g.emberTip, this.emberM, [0.011, MY - 0.0152, MZ + 0.0703]);
    }
  }

  // 0 none, 1 round specs, 2 dark shades, 3 aviator goggles, 4 monocle, 5 eyepatch
  buildEyewear(w) {
    if (!w) return;
    const g = geos(), H = this.head, C = this.C;
    const std = (color, rough, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra }); this.mats.push(m); return m; };
    const EY = 0.018, Z = 0.106;
    const glass = () => std(0xcfe0ea, 0.05, { metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
    const temples = mat => { for (const s of [-1, 1]) this.add(H, g.temple, mat, [s * 0.079, EY + 0.002, 0.053], [0, -s * 0.31, 0]); };
    if (w === 1) {
      const wire = std(0xb8952f, 0.3, { metalness: 0.9 });
      const lens = glass();
      for (const s of [-1, 1]) { this.add(H, g.rim, wire, [s * 0.035, EY, Z]); this.add(H, g.lens, lens, [s * 0.035, EY, Z - 0.001]); }
      this.add(H, g.bridge, wire, [0, EY + 0.004, Z + 0.001]);
      temples(wire);
    } else if (w === 2) {
      const frame = std(0x0c0a09, 0.35, { metalness: 0.3 });
      const dark = std(0x050608, 0.08, { metalness: 0.6, emissive: 0x000000 });
      for (const s of [-1, 1]) this.add(H, g.shade, dark, [s * 0.036, EY, Z - 0.002], [0, s * 0.12, 0], [1.12, 0.78, 0.3]);
      this.add(H, g.browBar, frame, [0, EY + 0.019, Z]);
      this.add(H, g.bridge, frame, [0, EY + 0.006, Z + 0.002]);
      temples(frame);
      this.glowMats.push(dark);
    } else if (w === 3) {
      const leather = C('plain', 0x3b2414);
      const brass = std(0x9a7430, 0.3, { metalness: 0.85 });
      const amber = std(0xd08a2a, 0.06, { metalness: 0.3, transparent: true, opacity: 0.72, emissive: 0x000000 });
      for (const s of [-1, 1]) {
        this.add(H, g.cup, leather, [s * 0.037, EY, Z - 0.004], [Math.PI / 2, 0, 0]);
        this.add(H, g.gogRim, brass, [s * 0.037, EY, Z + 0.009]);
        this.add(H, g.gogLens, amber, [s * 0.037, EY, Z + 0.008]);
      }
      this.add(H, g.bridge, brass, [0, EY, Z + 0.004], null, [1.4, 2, 2]);
      this.add(H, g.strap, leather, [0, EY, -0.004], [-Math.PI / 2, 0, -0.75], [0.97, 1.08, 1.6]);
      this.glowMats.push(amber);
    } else if (w === 4) {
      const gold = std(0xc9a24a, 0.25, { metalness: 0.95 });
      this.add(H, g.rim, gold, [0.035, EY, Z], null, [1.08, 1.08, 1.4]);
      this.add(H, g.lens, glass(), [0.035, EY, Z - 0.001], null, [1.08, 1.08, 1]);
      this.add(H, g.chain, gold, [0.056, EY - 0.055, Z - 0.012], [0.12, 0, 0.22]);
    } else if (w === 5) {
      const black = C('plain', 0x0b0908);
      this.add(H, g.patch, black, [-0.035, EY + 0.001, 0.1], [0, -0.28, 0], [1, 0.86, 1]);
      this.add(H, g.patchStrap, black, [0, 0.028, -0.004], [Math.PI / 2, 0.42, 0], [0.96, 1.07, 1]);
    }
  }

  // 0 fedora, 1 bowler, 2 flat cap, 3 trilby, 4 none, 5 top hat
  buildHat(hs, tone) {
    const g = geos(), C = this.C;
    const hatCol = HAT_COLORS[tone];
    const hatM = C('plain', hatCol);
    const bandM = C('plain', tone === 0 ? 0x5a0f14 : tone === 4 ? 0x2a1a12 : 0x0c0b0a);
    const shade = C('plain', new THREE.Color(hatCol).multiplyScalar(0.7));
    const H = this.hat = new THREE.Bone();
    H.position.set(0, hs === 2 ? 0.079 : 0.07, hs === 2 ? -0.006 : -0.004);
    H.rotation.set(hs === 0 || hs === 3 ? 0.1 : hs === 2 ? 0.1 : hs === 5 ? -0.03 : -0.04, 0, 0.04);
    this.head.add(H);
    if (hs === 0 || hs === 3) {
      this.add(H, hs === 0 ? g.brim : g.brimS, hatM, [0, 0, 0]);
      this.add(H, hs === 0 ? g.crown : g.crownT, hatM, [0, hs === 0 ? 0.058 : 0.055, 0], null, [1, 1, 0.88]);
      this.add(H, g.dent, shade, [0, hs === 0 ? 0.113 : 0.108, 0], null, [1, 0.5, hs === 0 ? 1 : 0.85]); // the pinched crease on top
      this.add(H, g.band, bandM, [0, 0.02, 0]);
    } else if (hs === 1) {
      this.add(H, g.brimS, hatM, [0, 0, 0], null, [1, 1, 1.05]);
      this.add(H, g.dome, hatM, [0, 0.004, 0], null, [1, 1.05, 1.02]);
      this.add(H, g.band, bandM, [0, 0.016, 0], null, [1.004, 1, 1.004]);
    } else if (hs === 2) {
      // newsboy flat cap: puffed flat crown pulled forward, short bill over the brow, button on top
      this.add(H, g.capCrown, hatM, [0, -0.012, 0.012], null, [0.97, 0.44, 1.1]);
      this.add(H, g.capBill, hatM, [0, -0.01, 0.1], [0.22, 0, 0], [1.02, 1, 0.78]);
      this.add(H, g.capButton, hatM, [0, 0.038, 0.016], null, [1, 0.45, 1]);
    } else if (hs === 5) {
      this.add(H, g.brimTop, hatM, [0, 0, 0], null, [1, 1, 1.08]);
      this.add(H, g.crownTop, hatM, [0, 0.104, 0], null, [1, 1, 0.92]);
      this.add(H, g.bandTop, bandM, [0, 0.022, 0], null, [1, 1, 0.92]);
    }
  }

  // Bake every placeholder part into bone-bound geometry, one SkinnedMesh per material.
  finalize() {
    this.root.updateMatrixWorld(true);
    const bones = [];
    this.root.traverse(o => { if (o.isBone) bones.push(o); });
    const skeleton = this.skeleton = new THREE.Skeleton(bones);
    const toRoot = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const m = new THREE.Matrix4();
    const buckets = new Map();
    for (const p of this.parts) {
      const geo = p.geo.clone().applyMatrix4(m.multiplyMatrices(toRoot, p.o.matrixWorld));
      const n = geo.attributes.position.count;
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const bi = bones.indexOf(p.bone);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      const key = p.spec.isMaterial ? p.spec : p.spec.kind;
      const tint = geo.attributes.tint; // baked shading (sockets, blush) multiplies the part colour
      const edge = geo.attributes.edge; // hairlines fade toward the skin colour
      if (!p.spec.isMaterial) {
        const c = p.spec.color, col = new Float32Array(n * 3), sk = this.skinColor;
        for (let i = 0; i < n; i++) {
          let r = c.r, gg = c.g, b = c.b;
          if (edge) { const e = edge.getX(i) * 0.4; r += (sk.r * 0.85 - r) * e; gg += (sk.g * 0.85 - gg) * e; b += (sk.b * 0.85 - b) * e; }
          col[i * 3] = r * (tint ? tint.getX(i) : 1);
          col[i * 3 + 1] = gg * (tint ? tint.getY(i) : 1);
          col[i * 3 + 2] = b * (tint ? tint.getZ(i) : 1);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      }
      if (tint) geo.deleteAttribute('tint');
      if (edge) geo.deleteAttribute('edge');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(geo);
      p.bone.remove(p.o);
    }
    this.meshes = [];
    for (const [key, geos] of buckets) {
      const mat = key === 'cloth' ? this.clothMat : key === 'plain' ? this.plainMat : key === 'hair' ? this.hairMat : key;
      const geo = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
      if (geos.length > 1) geos.forEach(x => x.dispose());
      const mesh = new THREE.SkinnedMesh(geo, mat);
      mesh.frustumCulled = false;
      // tiny glossy parts (eyes) and glass don't need to be in the shadow maps
      mesh.userData.cast = !mat.transparent && !mat.isMeshBasicMaterial && mat !== this.eyeMat;
      mesh.castShadow = mesh.userData.cast;
      mesh.receiveShadow = true;
      mesh.userData.mat = mat;
      this.root.add(mesh);
      mesh.bind(skeleton);
      this.meshes.push(mesh);
      if (mat === this.emberM) this.emberMesh = mesh;
    }
    this.parts = null;
  }

  // ------------------------------------------------------------------ state
  // world-space rest positions for the hands, set after the character is placed
  placeRest(edgeZ) {
    this.root.updateMatrixWorld(true);
    for (const a of this.arms) {
      a.rest.set(a.side * 0.15, 0.81, edgeZ + 0.1);
      this.root.localToWorld(a.rest);
      if (!a.init) { a.cur.copy(a.rest); a.goal.copy(a.rest); a.init = true; }
    }
  }

  setSelf(isSelf) {
    this.self = isSelf;
    // skinned parts can't be hidden one by one: collapse the head bone (neck, hat, face) instead
    this.head.scale.setScalar(isSelf ? 1e-4 : 1);
    this.hit.visible = !isSelf;
  }

  setGhost(on) {
    if (!on) this.dying = 0;
    if (this.ghost === on) return;
    this.ghost = on;
    if (this.emberMesh) this.emberMesh.visible = !on;
    for (const m of this.meshes) {
      m.material = on ? this.ghostMat : m.userData.mat;
      m.castShadow = !on && m.userData.cast;
    }
    this.point = null;
  }

  // slump forward, then become a ghost
  die() { if (!this.ghost && !this.dying) this.dying = 0.0001; }

  setHighlight(color, amt) {
    if (color != null) this.hl.color.set(color);
    this.hl.goal = amt;
  }

  setEyeGlow(on) { this.eyeGlowGoal = on ? 1 : 0; }

  talk(ms) { this.talkUntil = performance.now() + ms; }

  emote(e) {
    const dur = { nod: 1.2, shake: 1.3, shrug: 1.6, suspicious: 2.6, point: 2.2 }[e] || 1.5;
    this.gesture = { kind: e, t: 0, dur };
  }

  glanceAt(v, sec = 2.5) { this.lookOverride = v.clone(); this.lookUntil = performance.now() + sec * 1000; }

  headWorld(out = new THREE.Vector3()) { return this.head.getWorldPosition(out); }
  chestWorld(out = new THREE.Vector3()) { out.set(0, 0.35, 0.05); return this.spine.localToWorld(out); }

  update(dt, now) {
    this.t += dt;
    const t = this.t;
    const g = this.gesture;
    if (g) { g.t += dt; if (g.t > g.dur) this.gesture = null; }
    const gk = this.gesture && this.gesture.kind;
    const gp = this.gesture ? this.gesture.t / this.gesture.dur : 0;
    const env = this.gesture ? Math.sin(Math.min(1, gp) * Math.PI) : 0;
    const talking = now < this.talkUntil;

    // idle behaviour
    if (!this.self && !this.ghost) {
      this.nextIdle -= dt;
      if (this.nextIdle <= 0 && !this.gesture) {
        this.nextIdle = 4 + Math.random() * 8;
        const r = Math.random();
        if (r < 0.22) this.gesture = { kind: 'chin', t: 0, dur: 3 + Math.random() * 2 };
        else if (r < 0.4) this.gesture = { kind: 'tap', t: 0, dur: 2 + Math.random() };
        else if (r < 0.5) this.gesture = { kind: 'lean', t: 0, dur: 3 };
      }
    }

    // body
    const breathe = Math.sin(t * 1.7) * 0.008;
    this.spine.scale.set(this.wf * (1 + breathe * 0.4), 1 + breathe, 1 + breathe * 0.6);
    let lean = this.lean + (talking ? 0.06 : 0) + (gk === 'suspicious' ? 0.2 * env : 0) - (gk === 'lean' ? 0.1 * env : 0);
    if (this.ghost) lean = 0.02;
    let dk = 0;
    if (this.dying) {
      this.dying += dt;
      dk = Math.min(1, this.dying / 1.1);
      lean = 0.06 + dk * dk * 0.75;
      if (this.dying > 2.2) { this.dying = 0; this.setGhost(true); }
    }
    this.spine.rotation.x += (lean - this.spine.rotation.x) * Math.min(1, dt * (this.dying ? 9 : 4));
    this.body.position.y = this.ghost ? 0.06 + Math.sin(t * 1.3) * 0.04 : 0;

    // head look
    const look = (this.lookOverride && now < this.lookUntil) ? this.lookOverride : this.lookGoal;
    this.spine.updateMatrixWorld(true);
    tmpV.copy(look);
    this.spine.worldToLocal(tmpV);
    tmpV.sub(this.head.position);
    let yaw = Math.atan2(tmpV.x, tmpV.z);
    let pitch = -Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z));
    yaw = THREE.MathUtils.clamp(yaw, -1.2, 1.2);
    pitch = THREE.MathUtils.clamp(pitch, -0.45, 0.55);
    if (gk === 'nod') pitch += Math.sin(gp * Math.PI * 6) * 0.22 * env;
    if (gk === 'shake') yaw += Math.sin(gp * Math.PI * 7) * 0.35 * env;
    if (gk === 'shrug') this.head.rotation.z = Math.sin(gp * Math.PI) * 0.18;
    else this.head.rotation.z *= 0.9;
    if (talking) pitch += Math.sin(t * 13) * 0.035;
    if (dk) { pitch = 0.5 * dk; yaw *= 1 - dk; }
    this.updateFace(dt, t, talking, gk, env, dk);
    if (this.emberM) {
      const puff = 0.75 + 0.25 * Math.sin(t * 0.9 + this.t) + (Math.sin(t * 0.23) > 0.93 ? 0.8 : 0);
      this.emberM.color.setRGB(4 * puff, 1.1 * puff, 0.2 * puff);
    }
    pitch += Math.sin(t * 0.7) * 0.02;
    const k = Math.min(1, dt * 5);
    this.yaw += (yaw - this.yaw) * k;
    this.pitch += (pitch - this.pitch) * k;
    this.head.rotation.y = this.yaw;
    this.head.rotation.x = this.pitch;

    // eye glow (mafia seeing mafia at night) - tinted lenses glow too
    this.eyeGlow += (this.eyeGlowGoal - this.eyeGlow) * Math.min(1, dt * 3);
    for (const m of this.glowMats) m.emissive.setRGB(3 * this.eyeGlow, 0.05 * this.eyeGlow, 0.02 * this.eyeGlow);

    // highlight
    this.hl.amt += (this.hl.goal - this.hl.amt) * Math.min(1, dt * 10);
    const pulse = this.hl.amt * (0.75 + Math.sin(now * 0.008) * 0.25);
    for (const m of this.mats) {
      if (!m.emissive || this.glowMats.includes(m)) continue;
      m.emissive.copy(this.hl.color).multiplyScalar(pulse * 0.35);
      if (m === this.ghostMat) m.emissive.setHex(0x3a66c4).multiplyScalar(0.5).add(tmpC.copy(this.hl.color).multiplyScalar(pulse * 0.6));
    }
    if (this.ghost) this.ghostMat.opacity = 0.2 + Math.sin(t * 2) * 0.04 + this.hl.amt * 0.15;

    // arms
    this.root.updateMatrixWorld(true);
    for (const a of this.arms) {
      a.goal.copy(a.rest);
      const right = a.side > 0;
      if (this.point && right && !this.ghost) {
        a.shoulder.getWorldPosition(tmpV2);
        tmpV.copy(this.point).sub(tmpV2).normalize().multiplyScalar(UA + FA - 0.04);
        a.goal.copy(tmpV2).add(tmpV);
      } else if (gk === 'point' && right && this.gestureTarget) {
        a.shoulder.getWorldPosition(tmpV2);
        tmpV.copy(this.gestureTarget).sub(tmpV2).normalize().multiplyScalar(UA + FA - 0.05);
        tmpV2.add(tmpV);
        a.goal.lerp(tmpV2, env);
      } else if (gk === 'chin' && right) {
        tmpV.set(0.02, -0.12, 0.08);
        this.head.localToWorld(tmpV);
        a.goal.lerp(tmpV, Math.min(1, env * 1.6));
      } else if (gk === 'shrug') {
        tmpV.set(a.side * 0.34, 0.42, 0.28);
        this.spine.localToWorld(tmpV);
        a.goal.lerp(tmpV, env);
      } else if (gk === 'tap' && right) {
        a.goal.y += Math.max(0, Math.sin(t * 16)) * 0.03 * env;
      } else if (talking && right) {
        tmpV.set(0.24, 0.3 + Math.sin(t * 5) * 0.05, 0.32 + Math.sin(t * 3.3) * 0.05);
        this.spine.localToWorld(tmpV);
        a.goal.lerp(tmpV, 0.8);
      }
      a.cur.lerp(a.goal, Math.min(1, dt * (this.point ? 7 : 4.5)));
      this.solveArm(a);
    }
  }

  // eyes lead the head, lids blink, lips part while talking, brows move with the mood
  updateFace(dt, t, talking, gk, env, dk) {
    // gaze: where the head is still turning, the eyes are already looking
    const look = this.gazeTarget || (this.lookOverride && performance.now() < this.lookUntil ? this.lookOverride : this.lookGoal);
    this.head.updateMatrixWorld(true);
    tmpV.copy(look);
    this.head.worldToLocal(tmpV);
    const G = this.gaze;
    G.next -= dt;
    if (G.next <= 0) {
      // small saccades, and now and then a glance away
      const away = Math.random() < 0.12;
      G.dartYaw = away ? (Math.random() - 0.5) * 0.7 : (Math.random() - 0.5) * 0.08;
      G.dartPitch = away ? (Math.random() - 0.3) * 0.25 : (Math.random() - 0.5) * 0.05;
      G.next = away ? 0.6 + Math.random() * 0.6 : 0.4 + Math.random() * 1.8;
    }
    let gy = THREE.MathUtils.clamp(Math.atan2(tmpV.x - 0, tmpV.z) + G.dartYaw + this.eyeBias, -0.42, 0.42);
    let gp = THREE.MathUtils.clamp(-Math.atan2(tmpV.y - 0.018, Math.hypot(tmpV.x, tmpV.z)) + G.dartPitch, -0.3, 0.3);
    if (this.ghost || dk) { gy *= 0.2; gp = dk ? 0.2 : gp; }
    const kg = Math.min(1, dt * 22);
    G.yaw += (gy - G.yaw) * kg;
    G.pitch += (gp - G.pitch) * kg;
    for (const e of this.eyes) e.rotation.set(G.pitch, G.yaw, 0);

    // blinking, plus a blink whenever the eyes jump far
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blink = 0.0001; this.blinkIn = 2.2 + Math.random() * 4.5; if (Math.random() < 0.15) this.blinkIn = 0.25; }
    let shut = 0;
    if (this.blink) {
      this.blink += dt / 0.16;
      shut = Math.sin(Math.min(1, this.blink) * Math.PI);
      if (this.blink >= 1) this.blink = 0;
    }
    if (dk) shut = Math.max(shut, dk);
    if (this.ghost) shut = Math.max(shut, 0.35);
    // lids follow the gaze a little (looking down drops the lids)
    const follow = Math.max(0, G.pitch) * 0.5;
    const a = this.lidOpen + (this.lidShut - this.lidOpen) * shut + follow;
    for (const l of this.lids) l.rotation.x = Math.min(this.lidShut, a);

    // lips: jaw-like opening while talking
    const open = talking ? (0.35 + 0.65 * Math.abs(Math.sin(t * 17))) * (0.6 + 0.4 * Math.abs(Math.sin(t * 5.3))) : 0;
    const o = Math.max(this.mouthOpen, open);
    this.lipU.position.y = this.lipBase.u + o * 0.0016;
    this.lipL.position.y = this.lipBase.l - o * 0.0068;
    this.mouthIn.scale.y = 0.25 + o * 1.35;
    this.mouthIn.position.y = this.lipBase.l - 0.001 - o * 0.0026;

    // brows: up while talking, knitted when suspicious
    let bg = talking ? 0.0015 + Math.max(0, Math.sin(t * 3.1)) * 0.0022 : 0;
    if (gk === 'suspicious') bg = -0.0035 * env;
    if (gk === 'shrug') bg = 0.004 * env;
    this.brow += (bg - this.brow) * Math.min(1, dt * 10);
    this.browBone.position.y = this.brow;
  }

  solveArm(a) {
    const S = a.shoulder.getWorldPosition(tmpV2);
    const dir = tmpV.copy(a.cur).sub(S);
    let len = dir.length();
    dir.normalize();
    len = THREE.MathUtils.clamp(len, Math.abs(UA - FA) + 0.02, UA + FA - 0.002);
    const cosA = (UA * UA + len * len - FA * FA) / (2 * UA * len);
    const A = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    // pole: elbows out and down
    const rootQ = this.root.getWorldQuaternion(tmpQ3);
    const pole = tmpV3.set(a.side * 0.9, -0.8, -0.25).applyQuaternion(rootQ);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const upperDir = by.copy(dir).multiplyScalar(Math.cos(A)).addScaledVector(pole, Math.sin(A)).normalize();
    const foreDir = bz.copy(S).addScaledVector(dir, len).sub(bx.copy(S).addScaledVector(upperDir, UA)).normalize();
    const parentQ = this.spine.getWorldQuaternion(tmpQ);
    const upperQ = tmpQ2.setFromUnitVectors(DOWN, upperDir);
    a.shoulder.quaternion.copy(parentQ).invert().multiply(upperQ);
    // forearm: build the full frame so the hand lies palm-down with the thumb inward
    const y = tmpV3.copy(foreDir).negate();
    const z = bx.copy(UP).addScaledVector(y, -UP.dot(y));
    if (z.lengthSq() < 1e-4) { z.set(0, 0, 1).applyQuaternion(rootQ); z.addScaledVector(y, -z.dot(y)); }
    z.normalize();
    const x = by.crossVectors(y, z).normalize();
    const foreQ = tmpQ4.setFromRotationMatrix(tmpM.makeBasis(x, y, z));
    a.elbow.quaternion.copy(upperQ).invert().multiply(foreQ);
  }

  dispose() {
    for (const m of this.mats) m.dispose();
    for (const m of this.meshes) m.geometry.dispose();
    this.chair.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    this.skeleton.dispose();
    this.hit.material.dispose();
  }
}
