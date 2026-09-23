// Everything that arrives over the network is untrusted: a friend could be running a modified
// client. Each message is rebuilt here with only the fields the game uses, in the types it expects,
// so nothing odd (markup, huge strings, bad ids) ever reaches the page.
import { sanitizeLook } from './looks.js';

const PHASES = new Set(['lobby', 'deal', 'night', 'dawn', 'day', 'vote', 'lastwords', 'verdict', 'over']);
const ROLE_KEYS = new Set(['mafia', 'sheriff', 'angel', 'civilian']);
const CHANNELS = new Set(['town', 'mafia', 'dead', 'sys', 'priv']);
const MSG_KINDS = new Set(['info', 'dim', 'phase', 'death', 'save', 'vote', 'win']);
const ANNOUNCE_KINDS = new Set(['night', 'death', 'saved', 'quiet', 'accused', 'win']);
const ACTIONS = new Set(['kill', 'inspect', 'save', 'vote']);
const FX = new Set(['deal', 'night', 'kill', 'saved', 'dawn', 'voteopen', 'vote', 'condemn', 'execute', 'mafiapick', 'inspect', 'typing', 'emote', 'win', 'lobby', 'day']);
const EMOTES = new Set(['point', 'shrug', 'nod', 'shake', 'suspicious']);
const RANKS = new Set(['JOKER', 'K', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
const SUITS = new Set(['S', 'H', 'D', 'C']);

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
const bool = v => v === true;
const list = v => (Array.isArray(v) ? v : []);
export const pidOk = v => (typeof v === 'string' && /^[a-z0-9]{1,16}$/i.test(v) ? v : null);
const target = v => (v === 'skip' ? 'skip' : pidOk(v));
const role = r => (ROLE_KEYS.has(r) ? r : undefined);
const code = v => str(v, 8).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

function card(c) {
  if (!c || typeof c !== 'object' || !RANKS.has(c.rank)) return undefined;
  return { rank: c.rank, suit: c.rank === 'JOKER' ? null : SUITS.has(c.suit) ? c.suit : 'S' };
}

function announce(a) {
  if (!a || typeof a !== 'object') return null;
  return { kind: ANNOUNCE_KINDS.has(a.kind) ? a.kind : 'quiet', title: str(a.title, 60), text: str(a.text, 400), pid: pidOk(a.pid) };
}

function player(p) {
  if (!p || typeof p !== 'object' || !pidOk(p.pid)) return null;
  return {
    pid: p.pid, name: str(p.name, 16) || 'Stranger', look: sanitizeLook(p.look), seat: num(p.seat, 0, 11),
    alive: bool(p.alive), connected: bool(p.connected), isHost: bool(p.isHost), bot: bool(p.bot),
    title: p.title ? str(p.title, 24) : null, ready: bool(p.ready),
    role: role(p.role), card: card(p.card), vote: target(p.vote), nightPick: pidOk(p.nightPick),
  };
}

export function cleanView(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.players)) return null;
  const S = v.settings && typeof v.settings === 'object' ? v.settings : {};
  const me = v.me && typeof v.me === 'object' ? v.me : {};
  if (!pidOk(me.pid)) return null;
  return {
    code: code(v.code), mode: ['solo', 'online', 'local'].includes(v.mode) ? v.mode : 'online', solo: bool(v.solo),
    phase: PHASES.has(v.phase) ? v.phase : 'lobby', day: num(v.day, 0, 999),
    timeLeft: num(v.timeLeft, 0, 3600e3), duration: num(v.duration, 0, 3600e3),
    settings: {
      mafia: num(S.mafia, 1, 5), sheriff: bool(S.sheriff), angel: bool(S.angel),
      dayTime: num(S.dayTime, 15, 3600), voteTime: num(S.voteTime, 15, 3600), nightTime: num(S.nightTime, 15, 3600), wits: num(S.wits, 0, 2),
    },
    players: list(v.players).slice(0, 12).map(player).filter(Boolean),
    accused: pidOk(v.accused), announce: announce(v.announce),
    winner: v.winner === 'town' || v.winner === 'mafia' ? v.winner : null,
    readyCount: num(v.readyCount, 0, 12), readyNeed: num(v.readyNeed, 0, 12),
    me: {
      pid: me.pid, isHost: bool(me.isHost), alive: bool(me.alive), role: role(me.role) || null, card: card(me.card) || null,
      ready: bool(me.ready), vote: target(me.vote), action: pidOk(me.action),
      actionKind: ACTIONS.has(me.actionKind) ? me.actionKind : null,
      targets: list(me.targets).slice(0, 12).map(pidOk).filter(Boolean),
      channel: ['town', 'mafia', 'dead'].includes(me.channel) ? me.channel : null,
      results: list(me.results).slice(0, 30).map(r => (r && pidOk(r.pid) ? { day: num(r.day, 0, 999), pid: r.pid, name: str(r.name, 16), mafia: bool(r.mafia) } : null)).filter(Boolean),
      angelLast: pidOk(me.angelLast),
    },
  };
}

export function cleanChat(m) {
  if (!m || typeof m !== 'object' || !CHANNELS.has(m.ch)) return null;
  return {
    id: num(m.id, 0, 1e12), ch: m.ch, to: pidOk(m.to), kind: MSG_KINDS.has(m.kind) ? m.kind : undefined,
    pid: pidOk(m.pid), name: str(m.name, 16), text: str(m.text, 400), ts: num(m.ts, 0, 1e15),
  };
}

// returns a clean copy of a message from the host, or null to drop it
export function cleanMessage(msg) {
  if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return null;
  switch (msg.t) {
    case 'ping': case 'pong': case 'hb': return { t: msg.t };
    case 'welcome': return pidOk(msg.pid) ? { t: 'welcome', pid: msg.pid, code: code(msg.code), mode: msg.mode === 'solo' ? 'solo' : 'online', solo: bool(msg.solo) } : null;
    case 'reject': case 'kicked': return { t: msg.t, reason: str(msg.reason, 200) };
    case 'toast': return { t: 'toast', text: str(msg.text, 200) };
    case 'state': { const s = cleanView(msg.s); return s ? { t: 'state', s } : null; }
    case 'history': return { t: 'history', list: list(msg.list).slice(-120).map(cleanChat).filter(Boolean) };
    case 'chat': { const m = cleanChat(msg.m); return m ? { t: 'chat', m } : null; }
    case 'fx':
      if (!FX.has(msg.kind)) return null;
      return {
        t: 'fx', kind: msg.kind, pid: pidOk(msg.pid), target: target(msg.target), mafia: bool(msg.mafia),
        winner: msg.winner === 'town' || msg.winner === 'mafia' ? msg.winner : null, e: EMOTES.has(msg.e) ? msg.e : null,
      };
    default: return null;
  }
}
