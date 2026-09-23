// Procedural canvas textures, so the whole room ships without texture files.
import * as THREE from 'three';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  // several of these are read back (normal maps are derived from them), so keep them CPU-side
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function toTex(c, { repeat = 1, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat !== 1) t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  return t;
}

// seeded random so textures look the same for everyone
let seed = 1337;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function noise(ctx, w, h, amt) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function grain(ctx, x, y, w, h, base, dark, lines = 28) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = 0; i < lines; i++) {
    const yy = y + rnd() * h;
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.15 + rnd() * 0.3;
    ctx.lineWidth = 0.6 + rnd() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    const amp = 1 + rnd() * 4, f = 0.005 + rnd() * 0.02, ph = rnd() * 6;
    for (let xx = 0; xx <= w; xx += 8) ctx.lineTo(x + xx, yy + Math.sin(xx * f + ph) * amp);
    ctx.stroke();
  }
  // knots
  if (rnd() < 0.5) {
    const kx = x + rnd() * w, ky = y + rnd() * h;
    for (let r = 2; r < 14; r += 3) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.ellipse(kx, ky, r * 2.2, r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function woodFloor() {
  seed = 11;
  const [c, ctx] = canvas(1024);
  const rows = 8, rh = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300;
    while (x < 1024) {
      const w = 260 + rnd() * 300;
      const v = rnd();
      const base = `hsl(${20 + v * 8}, ${35 + v * 15}%, ${10 + v * 7}%)`;
      grain(ctx, x, r * rh, w, rh, base, '#0b0503', 22);
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(x, r * rh, 3, rh);
      x += w;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, r * rh, 1024, 3);
  }
  noise(ctx, 1024, 1024, 10);
  return toTex(c, { repeat: 3 });
}

export function darkWood(hue = 14) {
  seed = 23 + hue;
  const [c, ctx] = canvas(512);
  grain(ctx, 0, 0, 512, 512, `hsl(${hue}, 45%, 16%)`, '#140603', 70);
  noise(ctx, 512, 512, 8);
  return toTex(c);
}

export function wallpaper() {
  seed = 42;
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#2c0d12';
  ctx.fillRect(0, 0, 512, 512);
  // vertical stripes
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, 0, 6, 512);
    ctx.fillStyle = 'rgba(160,110,60,0.08)';
    ctx.fillRect(x + 8, 0, 2, 512);
  }
  // damask motifs
  const motif = (cx, cy, s) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(120,40,40,0.45)';
    ctx.strokeStyle = 'rgba(190,140,80,0.16)';
    ctx.lineWidth = 2;
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.scale(sx, 1);
      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.bezierCurveTo(30, -40, 40, -10, 12, 0);
      ctx.bezierCurveTo(40, 10, 34, 46, 0, 60);
      ctx.bezierCurveTo(8, 30, 6, 12, 0, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(22, -30, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(20, 32, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  for (let y = 0; y <= 512; y += 256) for (let x = 0; x <= 512; x += 256) motif(x, y, 1);
  for (let y = 128; y < 512; y += 256) for (let x = 128; x < 512; x += 256) motif(x, y, 0.7);
  noise(ctx, 512, 512, 12);
  // age stains
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  return toTex(c);
}

export function panels() {
  seed = 77;
  const [c, ctx] = canvas(512, 256);
  grain(ctx, 0, 0, 512, 256, '#2a130a', '#0d0502', 50);
  for (let x = 0; x < 512; x += 256) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 8;
    ctx.strokeRect(x + 26, 30, 204, 196);
    ctx.strokeStyle = 'rgba(200,140,80,0.12)'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 34, 38, 188, 180);
  }
  noise(ctx, 512, 256, 8);
  return toTex(c);
}

export function felt() {
  seed = 5;
  const S = 1024;
  const [c, ctx] = canvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#1d6b43');
  g.addColorStop(0.7, '#12502f');
  g.addColorStop(1, '#0a341e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  noise(ctx, S, S, 22);
  // wear marks
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '120,160,120'},0.04)`;
    ctx.beginPath(); ctx.arc(rnd() * S, rnd() * S, 20 + rnd() * 90, 0, Math.PI * 2); ctx.fill();
  }
  // gold rings
  ctx.strokeStyle = 'rgba(214,176,90,0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.385, 0, Math.PI * 2); ctx.stroke();
  // suit ring
  const suits = ['♠', '♥', '♦', '♣'];
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.save();
    ctx.translate(S / 2 + Math.cos(a) * S * 0.44, S / 2 + Math.sin(a) * S * 0.44);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = 'rgba(214,176,90,0.35)';
    ctx.fillText(suits[i % 4], 0, 0);
    ctx.restore();
  }
  // centre crest
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.strokeStyle = 'rgba(214,176,90,0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 118, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 150px Georgia, serif';
  ctx.fillStyle = 'rgba(214,176,90,0.28)';
  ctx.fillText('M', 0, 8);
  ctx.restore();
  return toTex(c, { aniso: 16 });
}

export function rug() {
  seed = 91;
  const S = 1024;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  const rings = [['#3b0c10', 1], ['#c9a24a', 0.94], ['#3b0c10', 0.92], ['#1e0507', 0.8], ['#8a6a2a', 0.79], ['#2e080b', 0.775]];
  for (const [col, r] of rings) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, (S / 2) * r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save();
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 32; i++) {
    ctx.rotate(Math.PI * 2 / 32);
    ctx.fillStyle = i % 2 ? 'rgba(201,162,74,0.35)' : 'rgba(120,20,26,0.8)';
    ctx.beginPath(); ctx.moveTo(0, S * 0.4); ctx.lineTo(18, S * 0.44); ctx.lineTo(0, S * 0.48); ctx.lineTo(-18, S * 0.44); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  noise(ctx, S, S, 26);
  return toTex(c);
}

export function softSprite(size = 128, hard = 0) {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * hard * 0.5, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function smokeSprite() {
  seed = 3;
  const S = 128;
  const [c, ctx] = canvas(S);
  for (let i = 0; i < 26; i++) {
    const x = S / 2 + (rnd() - 0.5) * S * 0.45, y = S / 2 + (rnd() - 0.5) * S * 0.45, r = S * (0.12 + rnd() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  return new THREE.CanvasTexture(c);
}

export function skyline() {
  seed = 8;
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#02040b');
  g.addColorStop(0.6, '#0b1631');
  g.addColorStop(1, '#16223f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // moon
  const mg = ctx.createRadialGradient(360, 120, 4, 360, 120, 120);
  mg.addColorStop(0, 'rgba(220,230,255,0.9)');
  mg.addColorStop(0.18, 'rgba(200,215,255,0.55)');
  mg.addColorStop(0.2, 'rgba(120,150,220,0.2)');
  mg.addColorStop(1, 'rgba(60,80,140,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8eeff';
  ctx.beginPath(); ctx.arc(360, 120, 22, 0, Math.PI * 2); ctx.fill();
  // clouds
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(20,30,60,${0.2 + rnd() * 0.3})`;
    ctx.beginPath(); ctx.ellipse(rnd() * W, 60 + rnd() * 160, 60 + rnd() * 90, 8 + rnd() * 12, 0, 0, Math.PI * 2); ctx.fill();
  }
  // buildings (two layers)
  for (const [layer, col, minH, maxH] of [[0, '#070a14', 120, 260], [1, '#020308', 60, 200]]) {
    let x = -20;
    while (x < W) {
      const w = 30 + rnd() * 70, h = minH + rnd() * (maxH - minH);
      ctx.fillStyle = col;
      ctx.fillRect(x, H - h, w, h);
      if (rnd() < 0.3) ctx.fillRect(x + w * 0.4, H - h - 30, 4, 30);
      for (let wy = H - h + 10; wy < H - 6; wy += 12) {
        for (let wx = x + 5; wx < x + w - 6; wx += 9) {
          if (rnd() < (layer ? 0.06 : 0.04)) {
            ctx.fillStyle = rnd() < 0.8 ? 'rgba(255,190,90,0.85)' : 'rgba(180,200,255,0.7)';
            ctx.fillRect(wx, wy, 4, 6);
          }
        }
      }
      x += w + rnd() * 8;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function clockFace() {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#e6dcc2';
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1208'; ctx.fillStyle = '#1a1208';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 28px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(S / 2 + Math.cos(a) * 92, S / 2 + Math.sin(a) * 92);
    ctx.font = `bold ${i % 3 === 0 ? 24 : 16}px Georgia, serif`;
    ctx.fillText(R[i], 0, 0);
    ctx.restore();
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    ctx.lineWidth = i % 5 ? 1 : 3;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(a) * 112, S / 2 + Math.sin(a) * 112);
    ctx.lineTo(S / 2 + Math.cos(a) * (i % 5 ? 106 : 100), S / 2 + Math.sin(a) * (i % 5 ? 106 : 100));
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------ surface detail
// Turn a canvas (luminance = height) into a tangent-space normal map.
export function normalFromCanvas(src, strength = 2, repeat = 1) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const d = sctx.getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const [c, ctx] = canvas(w, h);
  const out = ctx.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)];
      const u = H[((y - 1 + h) % h) * w + x], dn = H[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const k = (y * w + x) * 4;
      o[k] = (nx / len * 0.5 + 0.5) * 255;
      o[k + 1] = (ny / len * 0.5 + 0.5) * 255;
      o[k + 2] = (nz / len * 0.5 + 0.5) * 255;
      o[k + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return toTex(c, { repeat, srgb: false });
}

export function fibreHeight(size = 256, fibres = 2600, seedV = 7) {
  seed = seedV;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < fibres; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI, l = 2 + rnd() * 7;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  return c;
}

export function leatherHeight(size = 256) {
  seed = 61;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size, y = rnd() * size, r = 1.5 + rnd() * 4;
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},0.12)`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); ctx.fill();
  }
  // tufted stitching seams
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  for (let x = 0; x < size; x += size / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
  return c;
}

// Suit cloth used as a detail map (multiplied by the suit colour).
// kind 0: plain worsted, 1: pinstripe, 2: chalk stripe, 3: faint check
export function fabric(kind) {
  seed = 100 + kind;
  const S = 128;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = '#d4d4d4';
  ctx.fillRect(0, 0, S, S);
  // twill weave
  for (let y = 0; y < S; y += 2) {
    for (let x = 0; x < S; x += 2) {
      const v = ((x + y) % 8 < 4 ? 222 : 196) + (rnd() - 0.5) * 18;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  if (kind === 1 || kind === 2) {
    for (let x = 0; x < S; x += 32) {
      ctx.fillStyle = kind === 1 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 15, 0, kind === 1 ? 1.5 : 3, S);
    }
  } else if (kind === 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 0; x < S; x += 32) ctx.fillRect(x, 0, 1, S);
    for (let y = 0; y < S; y += 32) ctx.fillRect(0, y, S, 1);
  }
  return c;
}

export function blobTexture(size = 256, inner = 0.2, alpha = 1) {
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export function flameTexture() {
  const W = 64, H = 128;
  const [c, ctx] = canvas(W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.68, 1, W / 2, H * 0.6, H * 0.5);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.18, 'rgba(255,220,140,0.95)');
  g.addColorStop(0.45, 'rgba(255,140,40,0.55)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(W / 2, 2);
  ctx.bezierCurveTo(W * 0.62, H * 0.35, W * 0.95, H * 0.62, W / 2, H * 0.98);
  ctx.bezierCurveTo(W * 0.05, H * 0.62, W * 0.38, H * 0.35, W / 2, 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function labelTexture(text, { w = 256, h = 64, bg = '#1a0c06', fg = '#d9b25a', font = 'bold 30px Georgia, serif' } = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
