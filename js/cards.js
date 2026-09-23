// Roles, the deck, and procedural card art (canvas). Role cards use generated art when available.

export const ROLES = {
  mafia: {
    key: 'mafia', team: 'mafia', name: 'Mafia', card: 'The Joker', icon: '🃏', glyph: 'J',
    color: '#e0323c',
    blurb: 'You drew the JOKER. You are the Mafia. Each night, agree with your fellow Jokers on someone to eliminate. By day, lie. You win when the Mafia equals or outnumbers everyone else.',
    night: 'Choose tonight\'s victim',
  },
  sheriff: {
    key: 'sheriff', team: 'town', name: 'Sheriff', card: 'The King', icon: '♚', glyph: 'K',
    color: '#f2c14e',
    blurb: 'You drew the KING. You are the Sheriff. Each night, investigate one player and learn whether they are Mafia. Steer the town, but careful: the Jokers want you dead.',
    night: 'Choose someone to investigate',
  },
  angel: {
    key: 'angel', team: 'town', name: 'Angel', card: 'The Ace', icon: '✦', glyph: 'A',
    color: '#8fd0ff',
    blurb: 'You drew the ACE. You are the Angel. Each night, choose one player to protect. If the Mafia strikes them, they survive. You can\'t protect the same person two nights running.',
    night: 'Choose someone to protect',
  },
  civilian: {
    key: 'civilian', team: 'town', name: 'Civilian', card: 'A number card', icon: '♣', glyph: '#',
    color: '#e8dcc0',
    blurb: 'You drew a NUMBER card. You are a Civilian. No night powers, only your wits and your vote. Find the Jokers and vote them out before they take the town.',
    night: null,
  },
};

export const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_RED = { H: true, D: true };

export function cardLabel(card) {
  if (!card) return '?';
  if (card.rank === 'JOKER') return 'JOKER';
  return card.rank + SUIT_GLYPH[card.suit];
}

// Deal: returns [{role, card}] shuffled, length n.
export function buildDeal(n, { mafia, sheriff, angel }) {
  const out = [];
  for (let i = 0; i < mafia; i++) out.push({ role: 'mafia', card: { rank: 'JOKER', suit: null } });
  if (sheriff) out.push({ role: 'sheriff', card: { rank: 'K', suit: 'S' } });
  if (angel) out.push({ role: 'angel', card: { rank: 'A', suit: 'S' } });
  const numbers = [];
  for (const s of ['S', 'H', 'D', 'C']) for (let r = 2; r <= 10; r++) numbers.push({ rank: String(r), suit: s });
  shuffle(numbers);
  while (out.length < n) out.push({ role: 'civilian', card: numbers.pop() });
  return shuffle(out);
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ art
export const CARD_W = 500, CARD_H = 700;
const IMAGES = {};

export function loadCardArt() {
  const files = { K: 'assets/img/king.jpg', JOKER: 'assets/img/joker.jpg', A: 'assets/img/ace.jpg' };
  return Promise.all(Object.entries(files).map(([k, src]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMAGES[k] = im; res(); };
    im.onerror = () => res();
    im.src = src;
  })));
}

function suitPath(ctx, suit, x, y, s) {
  // draws a suit symbol centred at x,y with size s (height)
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 2, s / 2);
  ctx.beginPath();
  if (suit === 'H') {
    ctx.moveTo(0, 0.95);
    ctx.bezierCurveTo(-0.35, 0.6, -1, 0.2, -1, -0.35);
    ctx.bezierCurveTo(-1, -0.85, -0.45, -1.05, 0, -0.55);
    ctx.bezierCurveTo(0.45, -1.05, 1, -0.85, 1, -0.35);
    ctx.bezierCurveTo(1, 0.2, 0.35, 0.6, 0, 0.95);
  } else if (suit === 'D') {
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(0.35, -0.4, 0.75, 0);
    ctx.quadraticCurveTo(0.35, 0.4, 0, 1);
    ctx.quadraticCurveTo(-0.35, 0.4, -0.75, 0);
    ctx.quadraticCurveTo(-0.35, -0.4, 0, -1);
  } else if (suit === 'S') {
    ctx.moveTo(0, -1);
    ctx.bezierCurveTo(-0.35, -0.55, -1, -0.2, -1, 0.25);
    ctx.bezierCurveTo(-1, 0.7, -0.45, 0.85, -0.08, 0.45);
    ctx.quadraticCurveTo(-0.15, 0.8, -0.45, 1);
    ctx.lineTo(0.45, 1);
    ctx.quadraticCurveTo(0.15, 0.8, 0.08, 0.45);
    ctx.bezierCurveTo(0.45, 0.85, 1, 0.7, 1, 0.25);
    ctx.bezierCurveTo(1, -0.2, 0.35, -0.55, 0, -1);
  } else if (suit === 'C') {
    ctx.arc(0, -0.5, 0.42, 0, Math.PI * 2);
    ctx.moveTo(-0.08, 0.1);
    ctx.arc(-0.5, 0.12, 0.42, 0, Math.PI * 2);
    ctx.moveTo(0.92, 0.12);
    ctx.arc(0.5, 0.12, 0.42, 0, Math.PI * 2);
    ctx.moveTo(-0.1, 0.1);
    ctx.quadraticCurveTo(-0.12, 0.75, -0.45, 1);
    ctx.lineTo(0.45, 1);
    ctx.quadraticCurveTo(0.12, 0.75, 0.1, 0.1);
  }
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paper(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, h * 0.75);
  g.addColorStop(0, '#f3ead3');
  g.addColorStop(1, '#d8c7a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // fibres & speckle
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 30 + Math.random() * 90;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, 'rgba(122,90,42,0.07)');
    sg.addColorStop(1, 'rgba(122,90,42,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function goldBorder(ctx, w, h) {
  ctx.strokeStyle = '#a8822f';
  ctx.lineWidth = 6;
  roundRect(ctx, 18, 18, w - 36, h - 36, 18);
  ctx.stroke();
  ctx.lineWidth = 2;
  roundRect(ctx, 30, 30, w - 60, h - 60, 12);
  ctx.stroke();
}

function cornerIndex(ctx, w, h, rank, suit, color) {
  for (const flip of [false, true]) {
    ctx.save();
    if (flip) { ctx.translate(w, h); ctx.rotate(Math.PI); }
    ctx.fillStyle = color;
    ctx.font = `bold ${rank.length > 1 ? 50 : 60}px "Times New Roman", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(rank, 72, 44);
    if (suit) suitPath(ctx, suit, 72, 136, 40);
    ctx.restore();
  }
}

const cache = new Map();

export function drawCardFace(card) {
  const key = card ? card.rank + (card.suit || '') + (IMAGES[card.rank] ? '+img' : '') : 'none';
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = CARD_W; cv.height = CARD_H;
  const ctx = cv.getContext('2d');
  const w = CARD_W, h = CARD_H;
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 28);
  ctx.clip();
  paper(ctx, w, h);

  const img = card && IMAGES[card.rank];
  if (img) {
    // cover-fit the generated art
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.strokeStyle = 'rgba(40,20,5,0.7)';
    ctx.lineWidth = 10;
    roundRect(ctx, 0, 0, w, h, 28);
    ctx.stroke();
  } else if (card && card.rank === 'JOKER') {
    goldBorder(ctx, w, h);
    ctx.fillStyle = '#1b1210';
    ctx.textAlign = 'center';
    ctx.font = 'bold 220px Georgia, serif';
    ctx.fillStyle = '#8c1016';
    ctx.fillText('☠', w / 2, h / 2 + 70);
    for (const flip of [false, true]) {
      ctx.save();
      if (flip) { ctx.translate(w, h); ctx.rotate(Math.PI); }
      ctx.fillStyle = '#b3161e';
      ctx.font = 'bold 38px Georgia, serif';
      'JOKER'.split('').forEach((c, i) => ctx.fillText(c, 66, 88 + i * 40));
      ctx.restore();
    }
  } else if (card && (card.rank === 'K' || card.rank === 'A')) {
    goldBorder(ctx, w, h);
    cornerIndex(ctx, w, h, card.rank, card.suit, '#15100c');
    ctx.fillStyle = '#15100c';
    if (card.rank === 'A') {
      suitPath(ctx, 'S', w / 2, h / 2, 260);
      ctx.strokeStyle = '#b8902f'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2 - 190, 80, 22, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.textAlign = 'center';
      ctx.font = 'bold 260px Georgia, serif';
      ctx.fillText('♚', w / 2, h / 2 + 90);
    }
  } else if (card) {
    goldBorder(ctx, w, h);
    const red = SUIT_RED[card.suit];
    const col = red ? '#a3121b' : '#15100c';
    cornerIndex(ctx, w, h, card.rank, card.suit, col);
    ctx.fillStyle = col;
    const L = PIPS[card.rank] || [];
    const x0 = 150, x1 = w - 150, y0 = 130, y1 = h - 130;
    for (const [px, py] of L) {
      const x = x0 + (x1 - x0) * px, y = y0 + (y1 - y0) * py;
      ctx.save();
      ctx.translate(x, y);
      if (py > 0.5) ctx.rotate(Math.PI);
      suitPath(ctx, card.suit, 0, 0, card.rank === '10' || card.rank === '9' ? 74 : 86);
      ctx.restore();
    }
  }
  ctx.restore();
  cache.set(key, cv);
  return cv;
}

const PIPS = {
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
};

let backCanvas = null;
export function drawCardBack() {
  if (backCanvas) return backCanvas;
  const cv = document.createElement('canvas');
  cv.width = CARD_W; cv.height = CARD_H;
  const ctx = cv.getContext('2d');
  const w = CARD_W, h = CARD_H;
  roundRect(ctx, 0, 0, w, h, 28);
  ctx.clip();
  const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, h * 0.7);
  g.addColorStop(0, '#7a0f16');
  g.addColorStop(1, '#2a0508');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // art-deco lattice
  ctx.strokeStyle = 'rgba(214,170,80,0.35)';
  ctx.lineWidth = 2;
  for (let i = -h; i < w + h; i += 34) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,3,5,0.55)';
  roundRect(ctx, 44, 44, w - 88, h - 88, 16);
  ctx.fill();
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 5;
  roundRect(ctx, 26, 26, w - 52, h - 52, 20); ctx.stroke();
  ctx.lineWidth = 2;
  roundRect(ctx, 44, 44, w - 88, h - 88, 16); ctx.stroke();
  // sunburst
  ctx.save();
  ctx.translate(w / 2, h / 2);
  for (let i = 0; i < 36; i++) {
    ctx.rotate(Math.PI * 2 / 36);
    ctx.strokeStyle = i % 2 ? 'rgba(201,162,74,0.55)' : 'rgba(201,162,74,0.25)';
    ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, i % 2 ? 190 : 150); ctx.stroke();
  }
  ctx.fillStyle = '#1a0406';
  ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();
  // fedora emblem
  ctx.fillStyle = '#c9a24a';
  ctx.beginPath(); ctx.ellipse(0, 18, 52, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, 14); ctx.bezierCurveTo(-32, -30, -18, -38, 0, -30);
  ctx.bezierCurveTo(18, -38, 32, -30, 30, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a0f16';
  ctx.fillRect(-30, 0, 60, 9);
  ctx.restore();
  // corner diamonds
  ctx.fillStyle = '#c9a24a';
  for (const [x, y] of [[70, 70], [w - 70, 70], [70, h - 70], [w - 70, h - 70]]) suitPath(ctx, 'D', x, y, 28);
  backCanvas = cv;
  return cv;
}
