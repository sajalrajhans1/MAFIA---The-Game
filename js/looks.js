// Character customization: every option is independent (nothing is derived from another choice).
// Shared by the host (validation), the wardrobe UI and the 3D characters.

export const LOOK_OPTIONS = [
  { key: 'suit', label: 'SUIT', names: ['Charcoal', 'Navy', 'Burgundy', 'Olive', 'Brown', 'Tan', 'Black', 'Slate', 'Ivory', 'Plum'] },
  { key: 'pattern', label: 'CLOTH', names: ['Plain', 'Pinstripe', 'Chalk stripe', 'Check'] },
  { key: 'tie', label: 'TIE', names: ['Crimson tie', 'Gold tie', 'Black tie', 'Navy tie', 'Emerald tie', 'Black bow tie', 'Red bow tie', 'Open collar'] },
  { key: 'extra', label: 'LAPEL', names: ['Nothing', 'Red carnation', 'White carnation', 'Pocket square', 'Gold pin'] },
  { key: 'hat', label: 'HAT', names: ['Fedora', 'Bowler', 'Flat cap', 'Trilby', 'No hat', 'Top hat'] },
  { key: 'hatColor', label: 'HAT TONE', names: ['Black', 'Charcoal', 'Brown', 'Grey', 'Cream'] },
  { key: 'hair', label: 'HAIR', names: ['Slicked back', 'Side part', 'Buzz cut', 'Pompadour', 'Curly', 'Bald', 'Bob cut'] },
  { key: 'hairColor', label: 'HAIR TONE', names: ['Black', 'Dark brown', 'Chestnut', 'Ginger', 'Blond', 'Silver'] },
  { key: 'skin', label: 'SKIN', names: ['Porcelain', 'Fair', 'Olive', 'Tan', 'Brown', 'Deep'] },
  { key: 'eyes', label: 'EYES', names: ['Classic', 'Narrow', 'Wide', 'Sleepy', 'Beady', 'Shifty'] },
  { key: 'eyeColor', label: 'EYE COLOR', names: ['Brown', 'Hazel', 'Green', 'Blue', 'Grey', 'Amber'] },
  { key: 'facial', label: 'BEARD', names: ['Clean shaven', 'Moustache', 'Pencil moustache', 'Goatee', 'Full beard', 'Stubble'] },
  { key: 'mouth', label: 'MOUTH', names: ['Neutral', 'Smirk', 'Grin', 'Frown', 'Surprised', 'Cigar', 'Red lips', 'Red smile'] },
  { key: 'wear', label: 'EYEWEAR', names: ['None', 'Round specs', 'Dark shades', 'Goggles', 'Monocle', 'Eyepatch'] },
];

export const LOOK_KEYS = LOOK_OPTIONS.map(o => o.key);
export const LOOK_COUNT = Object.fromEntries(LOOK_OPTIONS.map(o => [o.key, o.names.length]));

export function lookName(key, i) {
  const o = LOOK_OPTIONS.find(x => x.key === key);
  return o ? o.names[i] : '';
}

// Anything missing or invalid falls back to the first option, so an old or hostile look is always safe.
export function sanitizeLook(l) {
  l = l && typeof l === 'object' ? l : {};
  const out = {};
  for (const o of LOOK_OPTIONS) {
    const n = o.names.length;
    let v = Math.floor(Number(l[o.key]));
    out[o.key] = Number.isFinite(v) ? ((v % n) + n) % n : 0;
  }
  return out;
}

// A good-looking random outfit (some combinations are rarer so random gangsters look deliberate).
export function randomLook(rand = Math.random) {
  const r = n => Math.floor(rand() * n);
  const look = {};
  for (const o of LOOK_OPTIONS) look[o.key] = r(o.names.length);
  if (rand() < 0.5) look.pattern = 0;
  if (rand() < 0.55) look.extra = 0;
  if (rand() < 0.5) look.wear = 0;
  if (rand() < 0.4) look.facial = 0;
  if (rand() < 0.45) look.mouth = 0;
  if (look.hair === 5 && rand() < 0.5) look.hair = 0;
  if (look.hat === 5 && rand() < 0.6) look.hat = 0;
  return look;
}
