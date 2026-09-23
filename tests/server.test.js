// Headless tests for the authoritative game host (js/server.js).
// Scenario tests for every rule, then a fuzzer that throws random/malicious traffic at it.
// Run: node tests/server.test.js
import { GameServer, DEFAULT_SETTINGS } from '../js/server.js';

// ---------------------------------------------------------------- harness
let clock = 1_000_000;
const realNow = Date.now;
Date.now = () => clock;

let failures = 0, passes = 0;
function ok(cond, msg) {
  if (cond) passes++;
  else { failures++; console.error('  FAIL:', msg); }
}
function section(name) { console.log('\n# ' + name); }

// A room with a fake transport. Messages to each connection are recorded.
function makeRoom({ solo = false } = {}) {
  const inbox = new Map(); // connId -> [msgs]
  const dropped = new Set();
  const server = new GameServer({
    code: 'TESTS', mode: 'local', solo,
    send: (id, msg) => { if (!inbox.has(id)) inbox.set(id, []); inbox.get(id).push(JSON.parse(JSON.stringify(msg))); },
    drop: id => dropped.add(id),
  });
  server.destroy(); // no real timers: tests drive time
  server.dirty = () => server.flush(); // flush synchronously
  const room = {
    server, inbox, dropped,
    join(connId, name, token = connId + '-tok', extra = {}) {
      server.onConnect(connId);
      server.receive(connId, { t: 'hello', name, look: {}, token, ...extra });
      return room.pidOf(connId);
    },
    pidOf(connId) { const c = server.conns.get(connId); return c && c.pid; },
    send(connId, msg) { server.receive(connId, msg); },
    view(connId) { const m = (inbox.get(connId) || []).filter(x => x.t === 'state'); return m.length ? m[m.length - 1].s : null; },
    chats(connId) { return (inbox.get(connId) || []).filter(x => x.t === 'chat').map(x => x.m); },
    clear() { inbox.clear(); },
    advance(ms) { clock += ms; server.tick(); },
    player(pid) { return server.byId(pid); },
    byRole(role) { return server.players.filter(p => p.role === role); },
    connOf(p) { return p.conn; },
  };
  return room;
}

function fill(room, n) {
  const ids = ['local'];
  room.join('local', 'Host');
  for (let i = 1; i < n; i++) { ids.push('c' + i); room.join('c' + i, 'P' + i); }
  return ids;
}

function toPhase(room, phase, max = 40) {
  for (let i = 0; i < max && room.server.phase !== phase; i++) room.server.advance();
  return room.server.phase === phase;
}

// every living, non-mafia viewer must not see other living players' roles
function assertNoLeaks(room, label) {
  const s = room.server;
  for (const viewer of s.players) {
    if (!viewer.conn) continue;
    const v = s.viewFor(viewer);
    if (s.phase === 'lobby' || s.phase === 'over' || !viewer.alive) continue;
    for (const p of v.players) {
      if (p.pid === viewer.pid) continue;
      const real = s.byId(p.pid);
      const allowed = (viewer.role === 'mafia' && real.role === 'mafia') || (!real.alive && s.settings.reveal);
      if (p.role && !allowed) { ok(false, `${label}: ${viewer.name} (${viewer.role}) can see ${real.name}'s role ${p.role}`); return; }
      if (p.nightPick && viewer.role !== 'mafia') { ok(false, `${label}: non-mafia sees night picks`); return; }
    }
  }
  ok(true, label + ': no leaks');
}

// ---------------------------------------------------------------- scenarios
section('lobby: joining, names, capacity');
{
  const r = makeRoom();
  r.join('local', 'Host');
  const a = r.join('c1', 'Vinnie');
  const b = r.join('c2', 'vinnie');
  ok(r.player(b).name !== r.player(a).name, 'duplicate names get a suffix');
  r.join('c3', '<script>alert(1)</script>');
  ok(!/[<>]/.test(r.player(r.pidOf('c3')).name), 'angle brackets stripped from names');
  r.join('c4', '   ');
  ok(r.player(r.pidOf('c4')).name === 'Stranger', 'blank name becomes Stranger');
  r.join('c5', 'x'.repeat(200));
  ok(r.player(r.pidOf('c5')).name.length <= 14, 'long names truncated');
  for (let i = 6; i <= 11; i++) r.join('c' + i, 'N' + i);
  ok(r.server.players.length === 12, '12 players seated');
  r.join('c12', 'TooMany');
  const rej = (r.inbox.get('c12') || []).find(m => m.t === 'reject');
  ok(!!rej && r.server.players.length === 12, '13th player rejected');
  ok(r.server.players.filter(p => p.isHost).length === 1 && r.player(r.pidOf('local')).isHost, 'exactly one host (the local player)');
  // lobby disconnect frees the seat, seats stay contiguous
  r.server.onDisconnect('c3');
  ok(r.server.players.length === 11 && r.server.players.every((p, i) => p.seat === i), 'lobby leave removes the player and reseats');
}

section('settings: only the host, values clamped');
{
  const r = makeRoom();
  fill(r, 6);
  r.send('c1', { t: 'settings', settings: { mafia: 3 } });
  ok(r.server.settings.mafia === DEFAULT_SETTINGS.mafia, 'non-host cannot change settings');
  r.send('local', { t: 'settings', settings: { mafia: 99, dayTime: -5, voteTime: 'abc', nightTime: 1e9, reveal: 0, sheriff: 'yes' } });
  const S = r.server.settings;
  ok(S.mafia === 5 && S.dayTime === 30 && S.voteTime === DEFAULT_SETTINGS.voteTime && S.nightTime === 120, 'numbers clamped / garbage ignored');
  ok(S.reveal === false && S.sheriff === true, 'booleans coerced');
  r.send('local', { t: 'settings', settings: null });
  r.send('local', { t: 'settings', settings: 'x' });
  ok(true, 'null/string settings do not crash');
}

section('start: validation');
{
  const r = makeRoom();
  fill(r, 3);
  r.send('local', { t: 'start' });
  ok(r.server.phase === 'lobby', 'cannot start with 3 players');
  r.join('c3', 'P3');
  r.send('local', { t: 'settings', settings: { mafia: 2 } });
  r.send('local', { t: 'start' });
  ok(r.server.phase === 'lobby', '2 mafia among 4 is refused (must start outnumbered)');
  r.send('local', { t: 'settings', settings: { mafia: 1 } });
  r.send('c1', { t: 'start' });
  ok(r.server.phase === 'lobby', 'non-host cannot start');
  r.send('local', { t: 'start' });
  ok(r.server.phase === 'deal', 'host starts with 4 players, 1 mafia');
  const roles = r.server.players.map(p => p.role);
  ok(roles.filter(x => x === 'mafia').length === 1 && roles.filter(x => x === 'sheriff').length === 1 && roles.filter(x => x === 'angel').length === 1, 'deck has 1 Joker, 1 King, 1 Ace');
  r.join('late', 'Late');
  ok(!!(r.inbox.get('late') || []).find(m => m.t === 'reject'), 'new player rejected mid-game');
  assertNoLeaks(r, 'deal');
}

section('deal: cards match roles, everyone gets their own card only');
{
  for (let trial = 0; trial < 30; trial++) {
    const r = makeRoom();
    fill(r, 4 + (trial % 9));
    const n = r.server.players.length;
    const maf = Math.max(1, Math.floor((n - 1) / 3));
    r.send('local', { t: 'settings', settings: { mafia: maf, sheriff: trial % 2 === 0, angel: trial % 3 !== 0 } });
    r.send('local', { t: 'start' });
    for (const p of r.server.players) {
      const c = p.card;
      const good = p.role === 'mafia' ? c.rank === 'JOKER' : p.role === 'sheriff' ? c.rank === 'K' : p.role === 'angel' ? c.rank === 'A' : /^(10|[2-9])$/.test(c.rank);
      if (!good) { ok(false, `card ${c.rank} does not match role ${p.role}`); break; }
    }
    const cards = r.server.players.filter(p => p.role === 'civilian').map(p => p.card.rank + p.card.suit);
    if (new Set(cards).size !== cards.length) ok(false, 'duplicate number cards dealt');
    assertNoLeaks(r, `deal trial ${trial}`);
  }
}

function startedRoom(n = 7, settings = {}) {
  const r = makeRoom();
  const ids = fill(r, n);
  r.send('local', { t: 'settings', settings: { mafia: 2, ...settings } });
  r.send('local', { t: 'start' });
  return { r, ids };
}

section('night: mafia kill, angel save, sheriff check');
{
  const { r } = startedRoom(7);
  toPhase(r, 'night');
  const [m1, m2] = r.byRole('mafia');
  const angel = r.byRole('angel')[0], sheriff = r.byRole('sheriff')[0];
  const civ = r.byRole('civilian')[0];
  r.send(m1.conn, { t: 'act', target: m2.pid });
  ok(!m1.action, 'mafia cannot target a fellow mafia');
  r.send(m1.conn, { t: 'act', target: civ.pid });
  r.send(m2.conn, { t: 'act', target: civ.pid });
  r.send(angel.conn, { t: 'act', target: civ.pid });
  r.send(sheriff.conn, { t: 'act', target: m1.pid });
  const secret = r.chats(sheriff.conn).find(m => m.ch === 'priv' && /MAFIA/.test(m.text));
  ok(!!secret, 'sheriff learns the mafia result privately');
  ok(!r.chats(m1.conn).some(m => m.ch === 'priv' && m.to === sheriff.pid), 'others do not get the sheriff result');
  r.send(sheriff.conn, { t: 'act', target: civ.pid });
  ok(r.server.sheriffResults.length === 1, 'sheriff cannot investigate twice in a night');
  r.send(civ.conn, { t: 'act', target: m1.pid });
  ok(!civ.action, 'civilians have no night action');
  assertNoLeaks(r, 'night');
  // mafia chat privacy
  r.clear();
  r.send(m1.conn, { t: 'chat', text: 'secret plan' });
  ok(r.chats(m2.conn).some(m => m.text === 'secret plan'), 'mafia chat reaches mafia');
  ok(!r.chats(civ.conn).some(m => m.text === 'secret plan'), 'mafia chat hidden from town');
  r.send(civ.conn, { t: 'chat', text: 'i am awake' });
  ok(!r.chats(m1.conn).some(m => m.text === 'i am awake'), 'sleeping town cannot talk at night');
  r.server.advance();
  ok(r.server.phase === 'dawn' && civ.alive, 'angel saved the target');
  ok(r.server.angelLast === civ.pid, 'angel remembers last save');
  toPhase(r, 'night');
  r.send(angel.conn, { t: 'act', target: civ.pid });
  ok(angel.action !== civ.pid, 'angel cannot save the same person two nights running');
  r.send(m1.conn, { t: 'act', target: civ.pid });
  r.send(m2.conn, { t: 'act', target: civ.pid });
  r.server.advance();
  ok(!civ.alive && r.server.phase === 'dawn', 'mafia kill lands when unprotected');
  ok(r.server.announce && /found dead/.test(r.server.announce.text), 'dawn announces the death');
}

section('angel self-save: once per game');
{
  const { r } = startedRoom(6, { mafia: 1 });
  toPhase(r, 'night');
  const angel = r.byRole('angel')[0];
  ok(r.server.viewFor(angel).me.targets.includes(angel.pid), 'angel may target self first');
  r.send(angel.conn, { t: 'act', target: angel.pid });
  r.server.advance();
  toPhase(r, 'night');
  ok(!r.server.viewFor(angel).me.targets.includes(angel.pid), 'self-save not offered again');
  r.send('local', { t: 'settings', settings: { selfSave: false } });
  ok(r.server.settings.selfSave === true, 'settings frozen once the game started');
}

section('voting: plurality, ties, skips, dead voters');
{
  const { r } = startedRoom(7);
  toPhase(r, 'vote');
  const alive = r.server.alive();
  const target = alive[1];
  r.send(target.conn, { t: 'act', target: target.pid });
  ok(!target.vote, 'cannot vote for yourself');
  for (const p of alive.slice(2, 6)) r.send(p.conn, { t: 'act', target: target.pid });
  r.send(alive[0].conn, { t: 'act', target: 'skip' });
  r.server.advance();
  ok(r.server.phase === 'lastwords' && r.server.accused === target.pid, 'plurality condemns');
  r.clear();
  r.send(alive[0].conn, { t: 'chat', text: 'interrupt' });
  ok(!r.chats('local').some(m => m.text === 'interrupt'), 'only the condemned may speak during last words');
  r.send(target.conn, { t: 'chat', text: 'i was innocent' });
  ok(r.chats('c1').some(m => m.text === 'i was innocent'), 'condemned speaks to everyone');
  r.server.advance();
  ok(!target.alive && r.server.phase === 'verdict', 'executed after last words');

  if (!r.server.winner && toPhase(r, 'vote')) {
    const a2 = r.server.alive();
    r.send(a2[0].conn, { t: 'act', target: a2[1].pid });
    r.send(a2[1].conn, { t: 'act', target: a2[0].pid });
    r.server.advance();
    ok(r.server.phase === 'verdict' && a2.every(p => p.alive), 'a tie spares everyone');
  }
}

section('voting: skip majority and dead votes');
{
  const { r } = startedRoom(8);
  toPhase(r, 'vote');
  const alive = r.server.alive();
  r.send(alive[0].conn, { t: 'act', target: alive[1].pid });
  r.send(alive[2].conn, { t: 'act', target: 'skip' });
  r.send(alive[3].conn, { t: 'act', target: 'skip' });
  r.server.advance();
  ok(r.server.phase === 'verdict' && alive[1].alive, 'more skips than votes spares the target');
  const dead = r.server.players.find(p => !p.alive);
  if (dead) {
    toPhase(r, 'vote');
    r.send(dead.conn, { t: 'act', target: r.server.alive()[0].pid });
    ok(!dead.vote, 'the dead cannot vote');
  }
}

section('ready-to-vote majority starts the vote early');
{
  const { r } = startedRoom(7);
  toPhase(r, 'day');
  const alive = r.server.alive();
  const need = Math.floor(alive.length / 2) + 1;
  for (let i = 0; i < need - 1; i++) r.send(alive[i].conn, { t: 'ready', v: true });
  ok(r.server.phase === 'day', 'not yet with a minority');
  r.send(alive[need - 1].conn, { t: 'ready', v: true });
  ok(r.server.phase === 'vote', 'majority ready starts voting');
}

section('win conditions');
{
  const { r } = startedRoom(6, { mafia: 1 });
  const m = r.byRole('mafia')[0];
  r.server.kill(m);
  ok(r.server.checkWin() && r.server.winner === 'town', 'town wins when all mafia are dead');
  const r2 = startedRoom(6, { mafia: 2 }).r;
  const town = r2.server.players.filter(p => p.role !== 'mafia');
  r2.server.kill(town[0]); r2.server.kill(town[1]);
  ok(r2.server.checkWin() && r2.server.winner === 'mafia', 'mafia wins at parity');
  const v = r2.server.viewFor(town[2]);
  ok(v.players.every(p => p.role), 'everyone sees all cards after the game');
  r2.send('c1', { t: 'lobby' });
  ok(r2.server.phase === 'over', 'non-host cannot return to lobby');
  r2.send('local', { t: 'lobby' });
  ok(r2.server.phase === 'lobby' && r2.server.players.every(p => p.alive && !p.role), 'host returns everyone to a clean lobby');
  r2.send('local', { t: 'start' });
  ok(r2.server.phase === 'deal', 'a second game can be dealt');
}

section('reveal off: dead roles stay hidden from the living');
{
  const { r } = startedRoom(7, { reveal: false });
  toPhase(r, 'night');
  const victim = r.byRole('civilian')[0];
  r.server.kill(victim);
  const viewer = r.server.alive().find(p => p.role !== 'mafia');
  const pv = r.server.viewFor(viewer).players.find(p => p.pid === victim.pid);
  ok(!pv.role && !pv.card, 'living town cannot see the dead card');
  const ghostView = r.server.viewFor(victim);
  ok(ghostView.players.every(p => p.role), 'the dead see everything');
}

section('disconnect, rejoin, kick');
{
  const { r } = startedRoom(6, { mafia: 1 });
  toPhase(r, 'day');
  const p = r.server.players[2];
  const token = p.token, pid = p.pid, role = p.role;
  r.server.onDisconnect(p.conn);
  ok(r.server.players.includes(p) && !p.connected, 'mid-game disconnect keeps the seat');
  r.server.onConnect('re1');
  r.server.receive('re1', { t: 'hello', name: 'Hacker', look: {}, token });
  ok(p.conn === 're1' && p.pid === pid && p.role === role && p.connected, 'rejoin restores seat and card');
  ok(p.name !== 'Hacker', 'name cannot change mid-game');
  // a second tab with the same token takes over, the old one is kicked
  r.server.onConnect('re2');
  r.server.receive('re2', { t: 'hello', name: 'x', look: {}, token });
  ok(p.conn === 're2' && (r.inbox.get('re1') || []).some(m => m.t === 'kicked'), 'duplicate tab replaces the old one');
  // host removes someone who walked out
  const civ = r.server.alive().find(q => q.role !== 'mafia' && !q.isHost);
  r.send('local', { t: 'kick', pid: civ.pid });
  ok(!civ.alive, 'kick mid-game = walked out (dead)');
  r.send('local', { t: 'kick', pid: r.pidOf('local') });
  ok(r.player(r.pidOf('local')), 'host cannot kick themselves');
  const victim3 = r.server.players[3], wasAlive = victim3.alive;
  r.send('c1', { t: 'kick', pid: victim3.pid });
  ok(victim3.alive === wasAlive, 'non-host kick ignored');
  // kicking the last mafia ends the game
  const m = r.byRole('mafia')[0];
  if (!m.isHost) { r.send('local', { t: 'kick', pid: m.pid }); ok(r.server.phase === 'over' && r.server.winner === 'town', 'kicking the last Joker ends the game'); }
}

section('an idle Mafia still strikes (no endless games)');
{
  const { r } = startedRoom(6, { mafia: 1, angel: false });
  toPhase(r, 'night');
  const before = r.server.alive().length;
  r.server.advance();
  ok(r.server.alive().length === before - 1, 'a random victim falls when the Jokers pick nobody');
  const m = r.byRole('mafia')[0];
  ok(r.chats(m.conn).some(x => x.ch === 'priv' && /fate drew a card/.test(x.text)), 'the Jokers are told fate chose');
  const civ = r.server.alive().find(p => p.role !== 'mafia');
  ok(!r.chats(civ.conn).some(x => /fate drew a card/.test(x.text || '')), 'the town is not told');
}

section('heartbeats keep phases moving');
{
  const { r } = startedRoom(5, { mafia: 1 });
  ok(r.server.phase === 'deal', 'in deal');
  clock += 60_000;
  r.send('c1', { t: 'hb' });
  ok(r.server.phase !== 'deal', 'a client heartbeat advances an expired phase');
}

section('garbage input does not crash the host');
{
  const { r } = startedRoom(6, { mafia: 1 });
  const junk = [null, undefined, 42, 'str', [], {}, { t: 'nope' }, { t: 'act' }, { t: 'act', target: {} }, { t: 'act', target: 'skip' },
    { t: 'chat' }, { t: 'chat', text: { a: 1 } }, { t: 'chat', text: 'x'.repeat(100000) }, { t: 'ready', v: 'maybe' },
    { t: 'emote', e: 'dance' }, { t: 'emote', e: 'point', target: 'nobody' }, { t: 'look', look: 'x' }, { t: 'kick', pid: null },
    { t: 'hello' }, { t: 'hello', token: { x: 1 } }, { t: '__proto__' }, { t: 'constructor' }, { t: 'toString' }];
  let crashed = null;
  try { for (const j of junk) for (const id of ['local', 'c1', 'c2', 'ghost-conn']) r.server.receive(id, j); } catch (e) { crashed = e; }
  ok(!crashed, 'no exception from junk: ' + (crashed && crashed.stack));
  const long = r.server.history.filter(m => m.text && m.text.length > 240);
  ok(long.length === 0, 'chat messages capped at 240 chars');
}

section('chat flood is rate limited');
{
  const { r } = startedRoom(5, { mafia: 1 });
  toPhase(r, 'day');
  const p = r.server.alive().find(q => q.conn !== 'local');
  r.clear();
  for (let i = 0; i < 50; i++) r.send(p.conn, { t: 'chat', text: 'spam ' + i });
  ok(r.chats('local').filter(m => /spam/.test(m.text || '')).length <= 2, 'spam burst mostly dropped');
}


// ---------------------------------------------------------------- single player
section('single player: the cast, and no bots in friend rooms');
{
  const r = makeRoom({ solo: true });
  r.join('local', 'Me', 'me-tok', { bots: 7 });
  const s = r.server;
  ok(s.players.length === 8, 'solo table seats 7 bots + you (' + s.players.length + ')');
  ok(s.players[0].name === 'Me' && s.players.slice(1).every(p => p.bot), 'you sit first, bots after');
  const names1 = s.players.filter(p => p.bot).map(p => p.name).join(',');
  const r2 = makeRoom({ solo: true });
  r2.join('local', 'Other', 'o-tok', { bots: 7 });
  ok(r2.server.players.filter(p => p.bot).map(p => p.name).join(',') === names1, 'the same cast every time');
  ok(JSON.stringify(r2.server.players[1].look) === JSON.stringify(s.players[1].look), 'bots keep the same look every time');
  r.send('local', { t: 'bots', n: 11 });
  ok(s.players.length === 12, 'grow to 11 opponents');
  r.send('local', { t: 'bots', n: 1 });
  ok(s.players.length === 4, 'at least 3 opponents');
  r.send('local', { t: 'bots', n: 5 });
  ok(s.players.length === 6, 'shrink to 5 opponents');
  s.onConnect('c9');
  s.receive('c9', { t: 'hello', name: 'Crasher', look: {}, token: 'x' });
  ok(s.players.length === 6 && (r.inbox.get('c9') || []).some(m => m.t === 'reject'), 'strangers cannot join a single player table');
  const v = r.view('local');
  ok(v.solo === true && v.players[1].title, 'solo view carries bot titles');
  r.send('local', { t: 'settings', settings: { wits: 2 } });
  ok(s.settings.wits === 2, 'bot wits setting accepted in solo');

  const m = makeRoom();
  m.join('local', 'Host');
  m.join('c1', 'Friend');
  m.send('local', { t: 'bots', n: 6 });
  m.send('local', { t: 'addbot' });
  ok(m.server.players.length === 2 && !m.server.players.some(p => p.bot), 'friend rooms can never get bots');
  m.send('local', { t: 'settings', settings: { wits: 2 } });
  ok(m.server.settings.wits === undefined, 'no bot settings in friend rooms');
}

section('single player: full games against the cast');
{
  const bad = [];
  let games = 0, finished = 0, crash = null, botChats = 0, townWins = 0;
  const rnd = n => Math.floor(Math.random() * n);
  const says = ['hi all', 'who do you think it is?', 'vinnie is sus', 'I trust rosa', 'I am the sheriff, sal is mafia', 'not me I swear', 'lol', 'skip', 'doc why?', 'mae what about lou?', 'im an angel', 'bugsy you are the joker', 'thanks', 'shut up tommy'];
  for (let g = 0; g < 120 && !crash; g++) {
    const r = makeRoom({ solo: true });
    const nb = 3 + rnd(9);
    r.join('local', 'Me', 'me', { bots: nb });
    const s = r.server;
    const maxM = Math.floor(s.players.length / 2 - 0.5);
    r.send('local', { t: 'settings', settings: { mafia: 1 + rnd(Math.max(1, maxM)), wits: rnd(3), reveal: Math.random() < 0.85 } });
    r.send('local', { t: 'start' });
    if (s.phase !== 'deal') continue;
    games++;
    const active = g % 2 === 0; // half the games the human plays, half they just watch
    try {
      for (let k = 0; k < 6000 && s.phase !== 'over'; k++) {
        if (active && Math.random() < 0.02) {
          const me = s.players[0];
          const v = s.viewFor(me);
          if (v.me.targets.length && Math.random() < 0.5) r.send('local', { t: 'act', target: v.me.targets[rnd(v.me.targets.length)] });
          else if (Math.random() < 0.5) r.send('local', { t: 'chat', text: says[rnd(says.length)] });
          else r.send('local', { t: 'ready', v: true });
        }
        r.advance(250);
      }
      if (s.phase === 'over') { finished++; if (s.winner === 'town') townWins++; }
      for (const c of r.chats('local').concat(s.history)) {
        if (!c.pid) continue;
        botChats++;
        if (!c.text || /[{}]|undefined|null|NaN/.test(c.text)) bad.push(c.text);
      }
      // bots never cheat in the view either
      assertNoLeaks(r, 'solo game ' + g);
      passes--;
    } catch (e) { crash = e; }
  }
  ok(!crash, 'bot games ran without exceptions' + (crash ? ': ' + crash.stack : ''));
  ok(finished === games, `every bot game reached a winner (${finished}/${games}, town won ${townWins})`);
  ok(botChats > games * 5, `the bots talk (${botChats} lines over ${games} games)`);
  ok(bad.length === 0, 'no broken bot lines' + (bad.length ? ': ' + bad.slice(0, 5).join(' | ') : ''));
}

// ---------------------------------------------------------------- fuzzer
section('fuzz: random play and hostile traffic, 300 games');
{
  const phases = new Set(['lobby', 'deal', 'night', 'dawn', 'day', 'vote', 'lastwords', 'verdict', 'over']);
  let games = 0, finished = 0, crash = null, leak = 0, steps = 0;
  const rnd = n => Math.floor(Math.random() * n);
  for (let g = 0; g < 300 && !crash; g++) {
    const r = makeRoom();
    const n = 4 + rnd(9);
    const ids = fill(r, n);
    const maxM = Math.floor((n - 1) / 2);
    r.send('local', { t: 'settings', settings: { mafia: 1 + rnd(maxM), sheriff: Math.random() < 0.8, angel: Math.random() < 0.8, reveal: Math.random() < 0.7, selfSave: Math.random() < 0.5 } });
    r.send('local', { t: 'start' });
    if (r.server.phase !== 'deal') continue;
    games++;
    try {
      for (let s = 0; s < 1500 && r.server.phase !== 'over'; s++) {
        steps++;
        const id = ids[rnd(ids.length)];
        const pids = r.server.players.map(p => p.pid);
        const x = Math.random();
        if (x < 0.35) r.send(id, { t: 'act', target: Math.random() < 0.1 ? 'skip' : Math.random() < 0.05 ? null : pids[rnd(pids.length)] });
        else if (x < 0.45) r.send(id, { t: 'chat', text: 'msg ' + s });
        else if (x < 0.5) r.send(id, { t: 'ready', v: Math.random() < 0.7 });
        else if (x < 0.53) r.send(id, { t: 'emote', e: ['nod', 'shrug', 'point'][rnd(3)], target: pids[rnd(pids.length)] });
        else if (x < 0.545) { r.server.onDisconnect(id); r.server.onConnect(id); r.server.receive(id, { t: 'hello', name: 'back', look: {}, token: id + '-tok' }); }
        else if (x < 0.55) r.send('local', { t: 'skip' });
        else if (x < 0.553) r.send('local', { t: 'kick', pid: pids[rnd(pids.length)] });
        else if (x < 0.56) r.send(id, { t: ['start', 'lobby', 'settings', 'bots', 'kick'][rnd(5)], settings: { mafia: rnd(9) } });
        else r.advance(500 + rnd(15000));
        if (!phases.has(r.server.phase)) throw new Error('bad phase ' + r.server.phase);
        const alive = r.server.alive();
        const m = alive.filter(p => p.role === 'mafia').length;
        if (r.server.phase !== 'over' && r.server.phase !== 'dawn' && r.server.phase !== 'verdict' && (m === 0 || m >= alive.length - m)) {
          throw new Error(`game should have ended: phase ${r.server.phase}, mafia ${m}, alive ${alive.length}`);
        }
        if (s % 50 === 0) {
          const before = failures;
          assertNoLeaks(r, 'fuzz');
          if (failures > before) { leak++; break; }
          passes--; // don't count the periodic check as a separate pass
        }
      }
      if (r.server.phase === 'over') finished++;
      else {
        // let time run out: every phase has a timer, so the game must end
        for (let k = 0; k < 400 && r.server.phase !== 'over'; k++) r.advance(130000);
        if (r.server.phase === 'over') finished++;
        else throw new Error('game never ended, stuck in ' + r.server.phase);
      }
    } catch (e) { crash = e; }
  }
  ok(!crash, 'fuzz ran without exceptions' + (crash ? ': ' + crash.stack : ''));
  ok(leak === 0, 'fuzz found no role leaks');
  ok(finished === games, `every fuzzed game finished (${finished}/${games}, ${steps} steps)`);
}

Date.now = realNow;
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
