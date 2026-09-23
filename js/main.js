// App controller: identity, rooms (host / client), message handling, and wiring the
// 3D world + UI to the authoritative game state.
import { World } from './scene.js';
import { UI, clearCardURLs } from './ui.js';
import { audio } from './audio.js';
import { GameServer } from './server.js';
import { sanitizeLook, randomLook, LOOK_COUNT } from './looks.js';
import { makeHostTransport, makeClientTransport, makeRoomCode, cleanCode } from './net.js';
import { loadCardArt, ROLES } from './cards.js';
import { LookPreview } from './preview.js';
import { cleanMessage } from './guard.js';

const params = new URLSearchParams(location.search);

const local = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const session = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

// ------------------------------------------------------------------ identity
const NAMES = ['Vito', 'Rocco', 'Lefty', 'Dixie', 'Marlowe', 'Velma', 'Duke', 'Ruby', 'Slim', 'Frankie', 'Mickey', 'Stella'];
let myName = local.get('mafia.name', '') || NAMES[Math.floor(Math.random() * NAMES.length)];
let myLook = sanitizeLook(local.get('mafia.look', null) || randomLook());
local.set('mafia.look', myLook);
// per-tab token so several tabs on one machine are separate players; survives reloads
let token = session.get('mafia.token', null);
if (!token) { token = Math.random().toString(36).slice(2) + Date.now().toString(36); session.set('mafia.token', token); }

// ------------------------------------------------------------------ world + ui
const world = new World(document.getElementById('gl'));
world.setQuality(local.get('mafia.quality', 'auto'));
if (local.get('mafia.crt', 'on') === 'off') document.body.classList.add('no-crt');
world.paused = true;

let net = null;
let view = null;
let lastMsgAt = 0;
let pendingInspect = null;
let dealRevealTimer = null;
let wasSleeping = false;
let pendingHistory = null;

const send = msg => { if (net) net.send(msg); };

const actions = {
  solo: () => startSolo(),
  friends: (prefill = '') => ui.showFriends(prefill, err => createRoom('online', err), (code, err) => joinRoom(code, 'online', err)),
  rejoin: () => {
    const last = session.get('mafia.last', null);
    if (last) joinRoom(last.code, 'online', msg => { ui.message('COULD NOT REJOIN', msg); session.del('mafia.last'); ui.setRejoin(null); });
  },
  leave: () => teardown(null, true),
  copyInvite: () => {
    if (!net) return;
    const url = `${location.origin}${location.pathname}?room=${net.code}`;
    const done = () => ui.toast('Invite link copied. Send it to your friends!');
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this invite link:', url));
    else window.prompt('Copy this invite link:', url);
  },
  start: () => send({ t: 'start' }),
  playAgain: () => { send({ t: 'lobby' }); setTimeout(() => send({ t: 'start' }), 60); },
  setBots: n => { n = Math.max(3, Math.min(11, n)); send({ t: 'bots', n }); local.set('mafia.soloBots', n); },
  skip: () => send({ t: 'skip' }),
  ready: v => send({ t: 'ready', v }),
  settings: s => { send({ t: 'settings', settings: s }); const k = net?.solo ? 'mafia.soloRules' : 'mafia.rules'; local.set(k, { ...local.get(k, {}), ...s }); },
  kick: pid => send({ t: 'kick', pid }),
  toLobby: () => send({ t: 'lobby' }),
  chat: text => send({ t: 'chat', text }),
  typing: () => send({ t: 'typing' }),
  emote: e => send({ t: 'emote', e, target: e === 'point' ? world.facingPlayer() : null }),
  lookAt: pid => world.lookAtPlayer(pid),
  pick: pid => pick(pid),
  confirmInspect: () => { if (pendingInspect) { send({ t: 'act', target: pendingInspect }); pendingInspect = null; } },
  cancelInspect: () => { pendingInspect = null; rerender(); },
  viewCard: () => {
    if (!view || !view.me.card) return;
    const mates = view.players.filter(p => p.role === 'mafia' && p.pid !== view.me.pid).map(p => p.name);
    world.peek = true;
    ui.openReveal({ card: view.me.card, role: view.me.role, mode: view.phase === 'deal' ? 'deal' : 'view', mates });
  },
  revealClosed: () => { world.peek = false; },
  rerender: () => rerender(false),
  lookStep: (key, d) => { const n = LOOK_COUNT[key]; setLook({ ...myLook, [key]: (myLook[key] + d + n) % n }); },
  lookSet: (key, i) => setLook({ ...myLook, [key]: i }),
  lookRandom: () => setLook(randomLook()),
  lookUndo: () => { if (lookHistory.length) setLook(lookHistory.pop(), false); },
  wardrobe: () => {
    if (ui.wardrobeOpen()) return;
    lookHistory = [];
    const frame = local.get('mafia.wdFrame', 'bust');
    preview.attach(document.getElementById('wdStage'), frame, true);
    ui.openWardrobe(() => myLook, myName, frame);
  },
  wardrobeFrame: f => { preview.setFrame(f); local.set('mafia.wdFrame', f); },
  wardrobeClosed: () => {
    preview.attach(document.getElementById('lookSlot'), 'slot', false);
    // in a lobby, everyone at the table sees the new outfit
    if (net && view && view.phase === 'lobby') send({ t: 'look', look: myLook });
  },
  setName: n => { myName = n.trim().slice(0, 14); local.set('mafia.name', myName); },
  quality: q => { world.setQuality(q); local.set('mafia.quality', q); },
  qualityInfo: () => ({ mode: world.qualityMode, tier: world.tier }),
  crt: on => { document.body.classList.toggle('no-crt', !on); local.set('mafia.crt', on ? 'on' : 'off'); },
};

const ui = new UI(actions);
ui.renderIdentity(myName, myLook);
const preview = new LookPreview(document.getElementById('lookPreview'));
preview.onFrame = f => { ui.markFrame(f); local.set('mafia.wdFrame', f); };
preview.setFrame('slot');
preview.setLook(myLook);
preview.start();
ui.setRejoin(session.get('mafia.last', null));

let lookHistory = [];
function setLook(look, remember = true) {
  look = sanitizeLook(look);
  if (remember) { lookHistory.push(myLook); if (lookHistory.length > 40) lookHistory.shift(); }
  myLook = look;
  local.set('mafia.look', myLook);
  ui.renderIdentity(myName, myLook);
  preview.setLook(myLook);
}

// the sheriff's pick is instant and final, so it needs a confirm step
function pick(pid) {
  if (!view) return;
  const k = view.me.actionKind;
  if (!k) return;
  if (pid === null || pid === 'skip') { send({ t: 'act', target: pid }); return; }
  if (!view.me.targets.includes(pid)) return;
  audio.sfx('select');
  if (k === 'inspect') { pendingInspect = pid; rerender(); return; }
  send({ t: 'act', target: pid });
}

function rerender(fresh = false) {
  if (!view) return;
  const v = pendingInspect && view.me.actionKind === 'inspect' ? { ...view, me: { ...view.me, action: pendingInspect } } : view;
  if (fresh) world.sync(v); else world.sync({ ...v, timeLeft: Math.max(0, ui.deadline - performance.now()) });
  ui.render(v, view, fresh);
  if (pendingInspect && view.me.actionKind === 'inspect') {
    const p = view.players.find(q => q.pid === pendingInspect);
    document.getElementById('actionText').innerHTML = `Investigate <span class="inspect">${p ? p.name.replace(/</g, '&lt;') : '?'}</span>? You only get one per night.`;
    const btns = document.getElementById('actionBtns');
    btns.innerHTML = '';
    const b1 = document.createElement('button'); b1.className = 'btn primary'; b1.textContent = 'INVESTIGATE';
    b1.onclick = () => { audio.sfx('click'); actions.confirmInspect(); };
    const b2 = document.createElement('button'); b2.className = 'btn'; b2.textContent = 'CANCEL';
    b2.onclick = () => { audio.sfx('click'); actions.cancelInspect(); };
    btns.append(b1, b2);
  }
}

// world hooks
world.onPlayerClick = pid => {
  if (view && view.me.targets && view.me.targets.includes(pid)) pick(pid);
  else audio.sfx('hover');
};
world.onCardClick = () => { audio.sfx('flip'); actions.viewCard(); };
world.onPlayerMark = pid => ui.cycleMark(pid);
world.onHover = pid => { if (pid && view && view.me.targets?.includes(pid)) audio.sfx('hover'); };
world.onThunder = () => audio.sfx('thunder');
world.onDealCard = () => audio.sfx('deal');
const proj = {};
world.onFrame = () => {
  if (!view) return;
  ui.positionTags(world.project(proj));
  ui.frame();
};

// ------------------------------------------------------------------ rooms
function startSolo() {
  if (connecting || net) return;
  audio.init();
  const server = new GameServer({
    code: 'SOLO', mode: 'solo', solo: true,
    send: (id, msg) => { if (id === 'local') queueMicrotask(() => onMessage(msg)); },
    drop: () => {},
  });
  net = { role: 'host', transport: null, server, code: 'SOLO', mode: 'solo', solo: true, send: msg => server.receive('local', msg) };
  server.onConnect('local');
  send({ t: 'hello', name: myName || 'Stranger', look: myLook, token, bots: local.get('mafia.soloBots', 7) });
  send({ t: 'settings', settings: { ...SOLO_DEFAULTS, ...local.get('mafia.soloRules', {}) } });
}
const SOLO_DEFAULTS = { mafia: 2, wits: 1 };

let connecting = false;
async function createRoom(mode, setErr) {
  if (connecting || net) return;
  connecting = true;
  try { await openRoom(mode, setErr); } finally { connecting = false; }
}

async function openRoom(mode, setErr) {
  audio.init();
  ui.loading(true, 'OPENING THE BACK ROOM...');
  let code, transport;
  for (let tries = 0; ; tries++) {
    code = makeRoomCode();
    transport = makeHostTransport(mode);
    try { await transport.open(code); break; } catch (e) {
      try { transport.close(); } catch { /* ignore */ }
      if (e.taken && tries < 6) continue;
      ui.loading(false);
      setErr(e.message || 'Could not open a room.');
      audio.sfx('error');
      return;
    }
  }
  const server = new GameServer({
    code, mode,
    send: (id, msg) => { if (id === 'local') queueMicrotask(() => onMessage(msg)); else transport.send(id, msg); },
    drop: id => { if (id !== 'local') transport.drop(id); },
  });
  transport.on('join', id => server.onConnect(id));
  transport.on('message', (id, msg) => server.receive(id, msg));
  transport.on('leave', id => server.onDisconnect(id));
  net = { role: 'host', transport, server, code, mode, send: msg => server.receive('local', msg) };
  server.onConnect('local');
  hello();
  // the host's house rules from last time
  const rules = local.get('mafia.rules', null);
  if (rules) send({ t: 'settings', settings: rules });
}

async function joinRoom(code, mode, setErr) {
  if (connecting || net) return;
  connecting = true;
  try { await enterRoom(code, mode, setErr); } finally { connecting = false; }
}

async function enterRoom(code, mode, setErr) {
  audio.init();
  code = cleanCode(code);
  ui.loading(true, 'FINDING YOUR TABLE...');
  const transport = makeClientTransport(mode);
  try { await transport.connect(code); } catch (e) {
    ui.loading(false);
    setErr(e.message || 'Could not connect.');
    audio.sfx('error');
    return;
  }
  net = { role: 'client', transport, code, mode, send: msg => transport.send(msg) };
  transport.on('message', onMessage);
  transport.on('close', () => { if (net && net.transport === transport) teardown('The connection to the host was lost. The host may have left, or the network dropped. You can try to rejoin.'); });
  lastMsgAt = Date.now();
  hello();
  setTimeout(() => { if (net && net.transport === transport && !view) teardown('The host did not answer. Try again.'); }, 10000);
}

function hello() {
  send({ t: 'hello', name: myName || 'Stranger', look: myLook, token });
}

function teardown(message, voluntary = false, title = 'THE ROOM IS GONE') {
  const n = net;
  net = null;
  if (n) {
    try { if (n.role === 'host') { n.server.destroy(); if (n.transport) n.transport.close(); } else n.transport.close(); } catch { /* ignore */ }
  }
  view = null;
  pendingInspect = null;
  pendingHistory = null;
  wasSleeping = false;
  clearTimeout(dealRevealTimer);
  if (voluntary) { session.del('mafia.last'); }
  ui.setRejoin(voluntary ? null : session.get('mafia.last', null));
  ui.loading(false);
  ui.closeModal();
  ui.closeWardrobe();
  ui.clearTags();
  ui.clearChat();
  ui.sleep(false);
  ui.hideAnnounce();
  ui.hideGameOver();
  document.getElementById('reveal').classList.add('hidden');
  ui.screen('title');
  world.reset();
  world.paused = true;
  audio.setMood('lobby');
  history.replaceState(null, '', location.pathname);
  if (message) ui.message(title, message);
}

setInterval(() => {
  if (net && net.role === 'client' && view && Date.now() - lastMsgAt > 25000) teardown('Lost contact with the host.');
}, 5000);
setInterval(() => { if (net && net.role === 'client') send({ t: 'hb' }); }, 2500);

window.addEventListener('beforeunload', e => {
  if (net && ((net.role === 'host' && !net.solo) || (view && view.phase !== 'lobby'))) { e.preventDefault(); e.returnValue = ''; }
});

// ------------------------------------------------------------------ messages
function onMessage(raw) {
  // everything from the host is rebuilt with strict types first (see guard.js)
  const msg = cleanMessage(raw);
  if (!msg) return;
  lastMsgAt = Date.now();
  switch (msg.t) {
    case 'ping': send({ t: 'pong' }); break;
    case 'welcome':
      ui.loading(false);
      ui.closeModal();
      if (!msg.solo) {
        session.set('mafia.last', { code: msg.code, mode: msg.mode });
        history.replaceState(null, '', `${location.pathname}?room=${msg.code}`);
      }
      world.paused = false;
      audio.sfx('join');
      break;
    case 'reject': teardown(msg.reason, false, "CAN'T SIT DOWN"); break;
    case 'kicked': teardown(msg.reason || 'You were removed from the table.', false, 'SHOWN THE DOOR'); break;
    case 'toast': ui.toast(msg.text, true); audio.sfx('error'); break;
    case 'state': applyState(msg.s); break;
    case 'history':
      if (view) { ui.clearChat(); for (const m of msg.list) ui.addChat(m, view); } else pendingHistory = msg.list;
      break;
    case 'chat': onChat(msg.m); break;
    case 'fx': onFx(msg); break;
  }
}

function onChat(m) {
  ui.addChat(m, view);
  if (m.pid) {
    if (m.pid !== view?.me?.pid) { audio.sfx('chat'); ui.bubble(m.pid, m.text, m.ch); }
    world.speak(m.pid, m.text);
  } else if (m.ch === 'priv') audio.sfx('select');
}

function onFx(msg) {
  const k = msg.kind;
  switch (k) {
    case 'deal': audio.sfx('deal-start'); world.fx('deal'); break;
    case 'night': world.fx('night'); break;
    case 'kill': audio.sfx('gunshot'); world.fx('kill', msg); setTimeout(() => audio.sfx('bell'), 1600); break;
    case 'saved': audio.sfx('saved'); world.fx('saved'); setTimeout(() => audio.sfx('bell'), 900); break;
    case 'dawn': audio.sfx('bell'); break;
    case 'voteopen': audio.sfx('gavel'); break;
    case 'vote': audio.sfx('chip'); break;
    case 'condemn': audio.sfx('guilty'); break;
    case 'execute': audio.sfx('gavel'); setTimeout(() => { audio.sfx('gunshot'); world.fx('execute', msg); }, 450); break;
    case 'mafiapick': audio.sfx('select'); break;
    case 'inspect': audio.sfx('inspect'); world.fx('inspect', msg); break;
    case 'typing': ui.typing(msg.pid); break;
    case 'emote': world.emote(msg.pid, msg.e, msg.target); ui.emoteTag(msg.pid, msg.e, view?.players.find(p => p.pid === msg.target)?.name); break;
    case 'win': {
      const mine = view?.me?.role ? ROLES[view.me.role].team : null;
      const won = mine && ((mine === 'mafia') === (msg.winner === 'mafia'));
      setTimeout(() => audio.sfx(won ? 'win' : 'lose'), 400);
      world.fx('win', msg);
      break;
    }
    case 'lobby': world.fx('lobby'); ui.clearChat(); break;
  }
}

const MOODS = { lobby: 'lobby', deal: 'lobby', night: 'night', dawn: 'day', day: 'day', vote: 'vote', lastwords: 'lastwords', verdict: 'day', over: 'over' };
const SLEEP_LINES = ['The Jokers are choosing a victim...', 'Somewhere, a revolver is being loaded...', 'Footsteps in the hallway...', 'You dream of a card game you can\'t win...', 'Rain taps on the window. Something moves in the dark...'];

function applyState(v) {
  const prev = view;
  view = v;
  if (pendingHistory) {
    ui.clearChat();
    for (const m of pendingHistory) ui.addChat(m, v);
    pendingHistory = null;
  }
  if (pendingInspect && (v.me.actionKind !== 'inspect' || !v.me.targets.includes(pendingInspect))) pendingInspect = null;
  const scr = v.phase === 'lobby' ? 'lobby' : 'hud';
  if (ui.current !== scr) ui.screen(scr);
  world.paused = false;
  rerender(true);

  const changed = !prev || prev.phase !== v.phase;
  if (changed) {
    audio.setMood(MOODS[v.phase] || 'lobby');
    onPhase(prev, v);
  }
  if (prev && prev.me.alive && !v.me.alive && v.phase !== 'lobby' && prev.phase !== 'lobby') {
    setTimeout(() => { ui.youDied(); audio.sfx('death'); }, v.phase === 'dawn' ? 1200 : 400);
  }
  const sleeping = v.phase === 'night' && v.me.alive && v.me.role === 'civilian';
  if (sleeping !== wasSleeping) {
    ui.sleep(sleeping, SLEEP_LINES[Math.floor(Math.random() * SLEEP_LINES.length)]);
    wasSleeping = sleeping;
  }
}

function onPhase(prev, v) {
  clearTimeout(dealRevealTimer);
  if (v.phase !== 'deal' && ui.revealOpen() && document.getElementById('btnReady') && !document.getElementById('btnReady').classList.contains('hidden')) ui.closeReveal();
  switch (v.phase) {
    case 'lobby':
      ui.hideGameOver();
      ui.hideAnnounce();
      break;
    case 'deal':
      ui.hideGameOver();
      ui.hideAnnounce();
      ui.clearChat();
      ui.marks.clear();
      dealRevealTimer = setTimeout(() => { if (view && view.phase === 'deal' && !view.me.ready) actions.viewCard(); }, 1500 + v.players.length * 140);
      break;
    case 'night':
      if (ui.revealOpen()) ui.closeReveal();
      audio.sfx('night');
      ui.announce(v.announce, 3200);
      world.look.ty = 0;
      break;
    case 'dawn':
      ui.announce(v.announce, 6500);
      break;
    case 'day':
      ui.hideAnnounce();
      break;
    case 'vote':
      ui.announce({ kind: 'accused', title: 'THE VOTE', text: v.me.alive ? 'Click the player you accuse. Most votes is condemned.' : 'The living cast their votes.' }, 2800);
      break;
    case 'lastwords':
      ui.announce(v.announce, 4000);
      break;
    case 'verdict':
      ui.announce(v.announce, 5500);
      break;
    case 'over':
      ui.announce(v.announce, 3000);
      setTimeout(() => { if (view && view.phase === 'over') ui.showGameOver(view); }, 3200);
      break;
  }
}

// ------------------------------------------------------------------ boot
loadCardArt().then(() => clearCardURLs()); // re-render any card drawn before the art arrived

// invite link: open the friends dialog with the code filled in (a click also unlocks audio)
if (params.get('room')) setTimeout(() => actions.friends(cleanCode(params.get('room')) || ''), 300);
