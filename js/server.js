// Authoritative game host. Runs inside the host's browser tab. Every client (including the
// host's own) talks to it through messages; it sends each player a personalised view so
// nobody can peek at hidden roles. In single player it also runs the bot cast.
import { buildDeal, ROLES, cardLabel } from './cards.js';
import { sanitizeLook } from './looks.js';
import { BotDirector } from './bots.js';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
export const DEFAULT_SETTINGS = {
  mafia: 1, sheriff: true, angel: true,
  dayTime: 120, voteTime: 45, nightTime: 40,
  reveal: true, selfSave: true,
};
export const SOLO_SETTINGS = { ...DEFAULT_SETTINGS, mafia: 2, dayTime: 150, voteTime: 40, nightTime: 35, wits: 1 };
const DEAL_TIME = 35, DAWN_TIME = 7, LAST_WORDS_TIME = 16, VERDICT_TIME = 7;

const now = () => Date.now();
const pick = a => a[Math.floor(Math.random() * a.length)];
const rid = () => Math.random().toString(36).slice(2, 9);
const roleName = p => (ROLES[p.role] || ROLES.civilian).name;

function cleanName(s) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Stranger';
}

export class GameServer {
  constructor({ code, mode, solo = false, send, drop }) {
    this.code = code;
    this.mode = mode;
    this.solo = !!solo;
    this.sendRaw = send;
    this.dropRaw = drop;
    this.conns = new Map(); // connId -> { pid, lastSeen }
    this.players = [];
    this.phase = 'lobby';
    this.day = 0;
    this.deadline = 0;
    this.phaseDur = 0;
    this.settings = { ...(this.solo ? SOLO_SETTINGS : DEFAULT_SETTINGS) };
    this.history = [];
    this.seq = 0;
    this.announce = null;
    this.accused = null;
    this.winner = null;
    this.angelLast = null;
    this.selfSaveUsed = false;
    this.sheriffResults = [];
    this._flushQueued = false;
    this.director = this.solo ? new BotDirector(this) : null;
    this._tick = setInterval(() => this.tick(), 250);
    this._ping = setInterval(() => this.ping(), 4000);
  }

  destroy() { clearInterval(this._tick); clearInterval(this._ping); }

  // ----------------------------------------------------------- connections
  onConnect(connId) { this.conns.set(connId, { pid: null, lastSeen: now() }); }

  onDisconnect(connId) {
    const c = this.conns.get(connId);
    this.conns.delete(connId);
    if (!c || !c.pid) return;
    const p = this.byId(c.pid);
    if (!p || p.conn !== connId) return;
    p.conn = null;
    p.connected = false;
    if (this.phase === 'lobby' && !p.isHost) {
      this.removePlayer(p);
      this.sys(`${p.name} left the table.`);
    } else {
      this.sys(`${p.name} lost connection.`, { kind: 'dim' });
    }
    this.dirty();
  }

  receive(connId, msg) {
    if (!msg || typeof msg !== 'object') return;
    let c = this.conns.get(connId);
    if (!c) { this.onConnect(connId); c = this.conns.get(connId); }
    c.lastSeen = now();
    // client heartbeats keep phases moving even if the host's tab is throttled in the background
    if (this.deadline && now() >= this.deadline) this.advance();
    if (msg.t === 'pong') return;
    if (msg.t === 'hb') { this.send(connId, { t: 'hb' }); return; }
    if (msg.t === 'hello') return this.hello(connId, msg);
    const p = c.pid && this.byId(c.pid);
    if (!p || p.conn !== connId) return;
    switch (msg.t) {
      case 'chat': return this.chat(p, msg.text);
      case 'typing': return this.typing(p);
      case 'act': return this.act(p, msg.target);
      case 'ready': return this.setReady(p, !!msg.v);
      case 'look': if (this.phase === 'lobby') { p.look = sanitizeLook(msg.look); this.dirty(); } return;
      case 'settings': if (p.isHost && this.phase === 'lobby') this.updateSettings(msg.settings); return;
      case 'start': if (p.isHost) this.start(connId); return;
      case 'kick': if (p.isHost && !this.solo) this.kick(msg.pid); return;
      case 'skip': if (p.isHost) this.hostSkip(); return;
      case 'lobby': if (p.isHost && this.phase === 'over') this.toLobby(); return;
      case 'bots': if (p.isHost && this.solo && this.phase === 'lobby') this.director.setTable(Number(msg.n) || 0); return;
      case 'emote': return this.emote(p, msg.e, msg.target);
    }
  }

  hello(connId, msg) {
    const token = String(msg.token || '').slice(0, 40);
    let p = token && this.players.find(q => q.token === token && !q.bot);
    if (p) {
      if (p.conn && p.conn !== connId) { this.send(p.conn, { t: 'kicked', reason: 'You opened this room somewhere else.' }); this.dropRaw(p.conn); this.conns.delete(p.conn); }
      p.conn = connId;
      p.connected = true;
      if (this.phase === 'lobby') { p.name = this.uniqueName(cleanName(msg.name), p); p.look = sanitizeLook(msg.look); }
      this.sys(`${p.name} is back at the table.`, { kind: 'dim' });
    } else {
      if (this.phase !== 'lobby') return this.reject(connId, 'A game is already in progress in this room. Wait for it to end.');
      if (this.players.length >= MAX_PLAYERS) return this.reject(connId, 'This table is full (12 players).');
      if (this.solo && this.players.some(q => !q.bot)) return this.reject(connId, 'This is a single player table.');
      p = this.newPlayer({ token, name: msg.name, look: msg.look, conn: connId, isHost: connId === 'local' });
      if (!this.solo) this.sys(`${p.name} pulled up a chair.`);
    }
    this.conns.get(connId).pid = p.pid;
    this.send(connId, { t: 'welcome', pid: p.pid, code: this.code, mode: this.mode, solo: this.solo });
    this.send(connId, { t: 'history', list: this.history.filter(m => this.canSee(p, m)).slice(-80) });
    if (this.solo) {
      if (!this.players.some(q => q.bot)) this.director.setTable(Math.max(3, Math.min(11, Number(msg.bots) || 7)));
      this.director.onLobbyJoin();
    }
    this.dirty();
  }

  newPlayer({ token, name, look, conn, isHost, bot }) {
    const p = {
      pid: rid(), token: token || rid(), name: '', look: sanitizeLook(look),
      conn: conn || null, connected: true, isHost: !!isHost, bot: !!bot,
      alive: true, role: null, card: null, ready: false, vote: null, action: null,
      lastChat: 0, lastTyping: 0,
    };
    p.name = this.uniqueName(cleanName(name), p);
    this.players.push(p);
    this.reseat();
    return p;
  }

  uniqueName(name, self) {
    let n = name, i = 2;
    while (this.players.some(q => q !== self && q.name.toLowerCase() === n.toLowerCase())) n = name.slice(0, 12) + ' ' + i++;
    return n;
  }

  reject(connId, reason) { this.send(connId, { t: 'reject', reason }); setTimeout(() => this.dropRaw(connId), 300); }

  removePlayer(p) {
    this.players = this.players.filter(q => q !== p);
    this.reseat();
  }

  reseat() { this.players.forEach((p, i) => { p.seat = i; }); }

  byId(pid) { return this.players.find(p => p.pid === pid); }
  alive() { return this.players.filter(p => p.alive); }

  send(connId, msg) { if (connId) this.sendRaw(connId, msg); }

  ping() {
    const t = now();
    for (const [id, c] of this.conns) {
      if (id === 'local') continue;
      if (t - c.lastSeen > 30000) { this.dropRaw(id); this.onDisconnect(id); continue; }
      this.send(id, { t: 'ping' });
    }
  }

  // ----------------------------------------------------------------- views
  dirty() {
    if (this._flushQueued) return;
    this._flushQueued = true;
    queueMicrotask(() => { this._flushQueued = false; this.flush(); });
  }

  flush() {
    for (const p of this.players) if (p.conn) this.send(p.conn, { t: 'state', s: this.viewFor(p) });
  }

  seesAll(p) { return this.phase === 'over' || (this.phase !== 'lobby' && !p.alive); }

  viewFor(me) {
    const inGame = this.phase !== 'lobby';
    const seeAll = this.seesAll(me);
    const showVotes = ['vote', 'lastwords', 'verdict'].includes(this.phase);
    const players = this.players.map(q => {
      const o = {
        pid: q.pid, name: q.name, look: q.look, seat: q.seat, alive: q.alive,
        connected: q.connected || q.bot, isHost: q.isHost, bot: q.bot, title: q.title || null,
        ready: (this.phase === 'deal' || this.phase === 'day') ? q.ready : false,
      };
      if (inGame) {
        const visible = q === me || seeAll || (me.role === 'mafia' && q.role === 'mafia') || (!q.alive && this.settings.reveal);
        if (visible) { o.role = q.role; o.card = q.card; }
        if (showVotes) o.vote = q.vote;
        if (this.phase === 'night' && q.action && ((me.role === 'mafia' && q.role === 'mafia') || seeAll)) o.nightPick = q.action;
      }
      return o;
    });
    const kind = this.actionKind(me);
    return {
      code: this.code, mode: this.mode, solo: this.solo,
      phase: this.phase, day: this.day,
      timeLeft: this.deadline ? Math.max(0, this.deadline - now()) : 0,
      duration: this.phaseDur,
      settings: this.settings,
      players,
      accused: this.accused,
      announce: this.announce,
      winner: this.winner,
      readyCount: this.alive().filter(p => p.ready).length,
      readyNeed: this.phase === 'deal' ? this.players.length : Math.floor(this.alive().length / 2) + 1,
      me: {
        pid: me.pid, isHost: me.isHost, alive: me.alive, role: me.role, card: me.card,
        ready: me.ready, vote: me.vote, action: me.action,
        actionKind: kind,
        targets: kind ? this.validTargets(me, kind) : [],
        channel: this.channelFor(me),
        results: me.role === 'sheriff' || seeAll ? this.sheriffResults : [],
        angelLast: me.role === 'angel' ? this.angelLast : null,
        selfSaveUsed: this.selfSaveUsed,
      },
    };
  }

  actionKind(p) {
    if (!p.alive) return null;
    if (this.phase === 'vote') return 'vote';
    if (this.phase !== 'night') return null;
    if (p.role === 'mafia') return 'kill';
    if (p.role === 'sheriff') return p.action ? null : 'inspect';
    if (p.role === 'angel') return 'save';
    return null;
  }

  validTargets(p, kind) {
    return this.alive().filter(q => {
      if (kind === 'kill') return q.role !== 'mafia';
      if (kind === 'inspect') return q !== p;
      if (kind === 'save') {
        if (q.pid === this.angelLast) return false;
        if (q === p) return this.settings.selfSave && !this.selfSaveUsed;
        return true;
      }
      if (kind === 'vote') return q !== p;
      return false;
    }).map(q => q.pid);
  }

  channelFor(p) {
    const ph = this.phase;
    if (ph === 'lobby' || ph === 'over' || ph === 'deal') return 'town';
    if (!p.alive) return 'dead';
    if (ph === 'night') return p.role === 'mafia' ? 'mafia' : null;
    if (ph === 'lastwords') return p.pid === this.accused ? 'town' : null;
    return 'town';
  }

  canSee(p, m) {
    if (m.ch === 'town' || m.ch === 'sys') return true;
    if (m.ch === 'priv') return m.to === p.pid;
    if (m.ch === 'mafia') return p.role === 'mafia' || this.seesAll(p);
    if (m.ch === 'dead') return this.seesAll(p);
    return false;
  }

  deliver(m) {
    this.history.push(m);
    if (this.history.length > 250) this.history.shift();
    for (const p of this.players) if (p.conn && this.canSee(p, m)) this.send(p.conn, { t: 'chat', m });
    if (this.director) this.director.onChat(m);
  }

  sys(text, { to = null, kind = 'info' } = {}) {
    this.deliver({ id: ++this.seq, ch: to ? 'priv' : 'sys', to, kind, text, ts: now() });
  }

  fx(kind, data = {}, filter = null) {
    for (const p of this.players) if (p.conn && (!filter || filter(p))) this.send(p.conn, { t: 'fx', kind, ...data });
  }

  // ------------------------------------------------------------------ chat
  chat(p, text) {
    text = String(text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 240);
    if (!text) return;
    const t = now();
    if (t - p.lastChat < 350) return;
    p.lastChat = t;
    const ch = this.channelFor(p);
    if (!ch) {
      const why = this.phase === 'night' ? 'It is night. You are asleep and cannot speak.' : 'Silence. Only the condemned may speak now.';
      if (p.conn) this.send(p.conn, { t: 'chat', m: { id: ++this.seq, ch: 'priv', to: p.pid, kind: 'dim', text: why, ts: t } });
      return;
    }
    this.deliver({ id: ++this.seq, ch, pid: p.pid, name: p.name, text, ts: t });
  }

  typing(p) {
    if (this.director) this.director.onTyping(p);
    const t = now();
    if (t - p.lastTyping < 1500) return;
    p.lastTyping = t;
    const ch = this.channelFor(p);
    if (!ch) return;
    this.fx('typing', { pid: p.pid }, q => q !== p && this.canSee(q, { ch }));
  }

  emote(p, e, target) {
    const ok = ['point', 'shrug', 'nod', 'shake', 'suspicious'];
    if (!ok.includes(e)) return;
    const ch = this.channelFor(p);
    if (!ch || ch === 'mafia') return;
    const t = now();
    if (t - (p.lastEmote || 0) < 1200) return;
    p.lastEmote = t;
    const tg = this.byId(target);
    this.fx('emote', { pid: p.pid, e, target: tg && tg !== p ? tg.pid : null }, q => this.canSee(q, { ch }));
  }

  // -------------------------------------------------------------- settings
  updateSettings(s) {
    if (!s || typeof s !== 'object') return;
    const S = this.settings;
    const clampI = (v, lo, hi, d) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    if ('mafia' in s) S.mafia = clampI(s.mafia, 1, 5, S.mafia);
    if ('dayTime' in s) S.dayTime = clampI(s.dayTime, 30, 600, S.dayTime);
    if ('voteTime' in s) S.voteTime = clampI(s.voteTime, 15, 180, S.voteTime);
    if ('nightTime' in s) S.nightTime = clampI(s.nightTime, 15, 120, S.nightTime);
    if ('wits' in s && this.solo) S.wits = clampI(s.wits, 0, 2, S.wits);
    for (const k of ['sheriff', 'angel', 'reveal', 'selfSave']) if (k in s) S[k] = !!s[k];
    this.dirty();
  }

  kick(pid) {
    const p = this.byId(pid);
    if (!p || p.isHost) return;
    if (p.conn) { this.send(p.conn, { t: 'kicked', reason: 'The host removed you from the table.' }); const c = p.conn; setTimeout(() => this.dropRaw(c), 200); this.conns.delete(c); p.conn = null; }
    if (this.phase === 'lobby') {
      this.removePlayer(p);
      this.sys(`${p.name} was shown the door.`);
    } else if (p.alive) {
      p.connected = false;
      this.kill(p, 'left');
      this.sys(`${p.name} walked out of the game.${this.settings.reveal ? ` Their card: ${cardLabel(p.card)} (${roleName(p)}).` : ''}`, { kind: 'death' });
      if (this.phase !== 'over') this.checkWin();
    }
    this.dirty();
  }

  // ---------------------------------------------------------------- flow
  start(connId) {
    if (this.phase !== 'lobby') return;
    const n = this.players.length;
    const S = this.settings;
    const err = m => this.send(connId, { t: 'toast', text: m });
    if (n < MIN_PLAYERS) return err(`Need at least ${MIN_PLAYERS} players at the table.`);
    const specials = (S.sheriff ? 1 : 0) + (S.angel ? 1 : 0);
    if (S.mafia >= n - S.mafia) return err(`Too many Jokers: the Mafia must start outnumbered. Max ${Math.floor((n - 1) / 2)} for ${n} players.`);
    if (S.mafia + specials > n) return err('Not enough players for these roles.');
    const deal = buildDeal(n, S);
    this.players.forEach((p, i) => {
      p.role = deal[i].role; p.card = deal[i].card;
      p.alive = true; p.ready = false; p.vote = null; p.action = null;
    });
    this.day = 0;
    this.winner = null;
    this.accused = null;
    this.announce = null;
    this.angelLast = null;
    this.selfSaveUsed = false;
    this.sheriffResults = [];
    this.history = [];
    this.fx('deal');
    this.setPhase('deal', DEAL_TIME);
    this.sys(`The cards are dealt. ${S.mafia} Joker${S.mafia > 1 ? 's' : ''} hide among ${n} players. Look at your card.`, { kind: 'phase' });
    if (this.director) this.director.onStart();
  }

  setPhase(phase, seconds) {
    this.phase = phase;
    this.phaseDur = seconds ? seconds * 1000 : 0;
    this.deadline = seconds ? now() + seconds * 1000 : 0;
    for (const p of this.players) p.ready = false;
    this.dirty();
    if (this.director) this.director.onPhase(phase);
  }

  hostSkip() {
    if (['lobby', 'over'].includes(this.phase)) return;
    if (!this.solo) this.sys('The host moved things along.', { kind: 'dim' });
    this.advance();
  }

  tick() {
    const t = now();
    if (this.director) this.director.tick(t);
    if (this.deadline && t >= this.deadline) this.advance();
  }

  advance() {
    this.deadline = 0;
    switch (this.phase) {
      case 'deal': return this.startNight();
      case 'night': return this.resolveNight();
      case 'dawn': if (!this.checkWin()) this.startDay(); return;
      case 'day': return this.startVote();
      case 'vote': return this.resolveVote();
      case 'lastwords': return this.execute();
      case 'verdict': if (!this.checkWin()) this.startNight(); return;
    }
  }

  setReady(p, v) {
    if (this.phase === 'deal') {
      p.ready = v;
      if (this.players.every(q => q.ready || !q.connected)) this.deadline = Math.min(this.deadline, now() + 1500);
      this.dirty();
    } else if (this.phase === 'day' && p.alive) {
      p.ready = v;
      const alive = this.alive();
      const need = Math.floor(alive.length / 2) + 1;
      const have = alive.filter(q => q.ready).length;
      if (v && !p.bot) this.sys(`${p.name} is ready to vote (${have}/${need}).`, { kind: 'dim' });
      if (have >= need) {
        this.sys('The town is ready. Voting begins.', { kind: 'phase' });
        this.startVote();
        return;
      }
      this.dirty();
    }
  }

  startNight() {
    this.day += 1;
    this.accused = null;
    for (const p of this.players) { p.action = null; p.vote = null; }
    this.announce = { kind: 'night', title: `NIGHT ${this.day}`, text: 'The town falls asleep. The Jokers open their eyes...' };
    this.setPhase('night', this.settings.nightTime);
    this.sys(`Night ${this.day} falls. Everyone closes their eyes.`, { kind: 'phase' });
    this.fx('night');
  }

  act(p, target) {
    const kind = this.actionKind(p);
    if (!kind) return;
    if (kind === 'vote' && target === 'skip') {
      this.castVote(p, 'skip');
      return;
    }
    if (target === null && kind !== 'inspect') {
      if (kind === 'vote') { p.vote = null; this.dirty(); return; }
      p.action = null; this.dirty(); return;
    }
    if (!this.validTargets(p, kind).includes(target)) return;
    const q = this.byId(target);
    if (kind === 'vote') return this.castVote(p, target);
    p.action = target;
    if (kind === 'inspect') {
      const isMafia = q.role === 'mafia';
      this.sheriffResults.push({ day: this.day, pid: q.pid, name: q.name, mafia: isMafia });
      this.sys(isMafia ? `Your investigation is conclusive: ${q.name} is MAFIA.` : `Your investigation: ${q.name} is NOT Mafia.`, { to: p.pid, kind: isMafia ? 'death' : 'save' });
      this.fx('inspect', { pid: q.pid, mafia: isMafia }, x => x === p);
      if (this.director) this.director.onInspect(p, q, isMafia);
    }
    if (kind === 'kill') {
      this.fx('mafiapick', { pid: p.pid, target }, x => x.role === 'mafia' || this.seesAll(x));
      if (this.director) this.director.onNightPick(p, target);
    }
    this.checkNightDone();
    this.dirty();
  }

  castVote(p, target) {
    if (p.vote === target) return;
    const prev = p.vote;
    p.vote = target;
    const tq = target === 'skip' ? null : this.byId(target);
    this.sys(target === 'skip' ? `${p.name} votes to skip.` : `${p.name} ${prev ? 'changes their vote to' : 'votes for'} ${tq.name}.`, { kind: 'vote' });
    this.fx('vote', { pid: p.pid, target });
    const alive = this.alive();
    if (alive.every(q => q.vote)) this.deadline = Math.min(this.deadline, now() + 4000);
    if (this.director) this.director.onVote(p, target);
    this.dirty();
  }

  checkNightDone() {
    const alive = this.alive();
    const done = alive.every(p => {
      if (p.role === 'mafia' || p.role === 'sheriff' || p.role === 'angel') return !!p.action;
      return true;
    });
    if (done) this.deadline = Math.min(this.deadline, now() + 4000);
  }

  resolveNight() {
    const mafia = this.alive().filter(p => p.role === 'mafia');
    const tally = {};
    for (const m of mafia) if (m.action) tally[m.action] = (tally[m.action] || 0) + 1;
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.keys(tally).filter(k => tally[k] === max);
    let target = max > 0 ? pick(top) : null;
    // Jokers who don't choose (away, or out of time) still strike: a random card is drawn.
    // Without this an idle Mafia would stall the game forever.
    if (!target && mafia.length) {
      const pool = this.validTargets(mafia[0], 'kill');
      if (pool.length) {
        target = pick(pool);
        for (const m of mafia) this.sys('No victim was chosen in time, so fate drew a card for you.', { to: m.pid, kind: 'dim' });
      }
    }
    const angel = this.alive().find(p => p.role === 'angel');
    const save = angel ? angel.action : null;
    this.angelLast = save || null;
    if (angel && save === angel.pid) this.selfSaveUsed = true;
    const victim = target && target !== save ? this.byId(target) : null;
    let saved = false;
    if (victim && victim.alive) {
      this.kill(victim, 'night');
      const reveal = this.settings.reveal ? ` Their card: ${cardLabel(victim.card)} (${roleName(victim)}).` : '';
      this.announce = { kind: 'death', title: 'DAWN', text: `${victim.name} was found dead in the morning.${reveal}`, pid: victim.pid };
      this.sys(`☠ ${victim.name} was killed during the night.${reveal}`, { kind: 'death' });
      this.fx('kill', { pid: victim.pid });
    } else if (target && target === save) {
      saved = true;
      this.announce = { kind: 'saved', title: 'DAWN', text: 'Shots rang out in the night... but an Angel was watching. Nobody died.' };
      this.sys('✦ The Mafia struck, but the Angel saved their target. Nobody died.', { kind: 'save' });
      this.fx('saved');
    } else {
      this.announce = { kind: 'quiet', title: 'DAWN', text: 'A quiet night. Nobody died.' };
      this.sys('A quiet night. Nobody died.', { kind: 'phase' });
      this.fx('dawn');
    }
    this.setPhase('dawn', DAWN_TIME);
    if (this.director) this.director.onDawn({ victim: victim && !victim.alive ? victim : null, saved });
  }

  startDay() {
    this.announce = null;
    this.setPhase('day', this.settings.dayTime);
    this.sys(`Day ${this.day}. Talk it out. Who is lying?`, { kind: 'phase' });
    this.fx('day');
  }

  startVote() {
    for (const p of this.players) p.vote = null;
    this.announce = null;
    this.setPhase('vote', this.settings.voteTime);
    this.sys('The vote is open. Click a player to accuse them, or skip.', { kind: 'phase' });
    this.fx('voteopen');
  }

  resolveVote() {
    const alive = this.alive();
    const tally = {};
    let skip = 0;
    for (const p of alive) {
      if (p.vote === 'skip') skip++;
      else if (p.vote && this.byId(p.vote)?.alive) tally[p.vote] = (tally[p.vote] || 0) + 1;
    }
    const max = Math.max(0, ...Object.values(tally));
    const top = Object.keys(tally).filter(k => tally[k] === max);
    if (max > 0 && top.length === 1 && max > skip) {
      const q = this.byId(top[0]);
      this.accused = q.pid;
      this.announce = { kind: 'accused', title: 'CONDEMNED', text: `${q.name} has been voted out with ${max} vote${max > 1 ? 's' : ''}. Any last words?`, pid: q.pid };
      this.sys(`⚖ ${q.name} is condemned (${max} vote${max > 1 ? 's' : ''}). Last words...`, { kind: 'death' });
      this.setPhase('lastwords', LAST_WORDS_TIME);
      this.fx('condemn', { pid: q.pid });
    } else {
      const why = max === 0 && skip === 0 ? 'Nobody voted. The town goes home.' : (top.length > 1 ? 'The vote is tied. Nobody is executed today.' : 'The town chose mercy. Nobody is executed today.');
      this.announce = { kind: 'quiet', title: 'NO VERDICT', text: why };
      this.sys(why, { kind: 'phase' });
      this.setPhase('verdict', VERDICT_TIME - 2);
      if (this.director) this.director.onNoExecution();
    }
  }

  execute() {
    const q = this.byId(this.accused);
    let voters = [];
    if (q && q.alive) {
      voters = this.alive().filter(p => p.vote === q.pid).map(p => p.pid);
      this.kill(q, 'vote');
      const reveal = this.settings.reveal ? ` Their card: ${cardLabel(q.card)} (${roleName(q)}).` : '';
      this.announce = { kind: 'death', title: 'EXECUTED', text: `${q.name} was executed by the town.${reveal}`, pid: q.pid };
      this.sys(`☠ ${q.name} was executed.${reveal}`, { kind: 'death' });
      this.fx('execute', { pid: q.pid });
    }
    this.setPhase('verdict', VERDICT_TIME);
    if (this.director && q) this.director.onExecute(q, voters);
  }

  kill(p, cause = 'night') {
    p.alive = false;
    p.ready = false;
    p.vote = null;
    p.action = null;
    // votes that pointed at a dead player no longer count
    for (const q of this.players) if (q.vote === p.pid) q.vote = null;
    if (this.director) this.director.onDeath(p, cause);
  }

  checkWin() {
    const alive = this.alive();
    const m = alive.filter(p => p.role === 'mafia').length;
    const t = alive.length - m;
    let w = null;
    if (m === 0) w = 'town';
    else if (m >= t) w = 'mafia';
    if (!w) return false;
    this.winner = w;
    this.accused = null;
    this.announce = w === 'town'
      ? { kind: 'win', title: 'THE TOWN WINS', text: 'Every Joker has been dealt with. The streets are safe... for now.' }
      : { kind: 'win', title: 'THE MAFIA WINS', text: 'The Jokers now outnumber the honest folk. This town belongs to them.' };
    this.setPhase('over', 0);
    this.sys(`★ ${this.announce.title}! ${this.players.filter(p => p.role === 'mafia').map(p => p.name).join(', ')} ${this.players.filter(p => p.role === 'mafia').length > 1 ? 'were' : 'was'} the Mafia.`, { kind: 'win' });
    this.fx('win', { winner: w });
    return true;
  }

  toLobby() {
    // drop anyone who left mid-game, reset everybody else
    this.players = this.players.filter(p => p.connected || p.bot || p.isHost);
    this.reseat();
    for (const p of this.players) { p.role = null; p.card = null; p.alive = true; p.ready = false; p.vote = null; p.action = null; }
    this.phase = 'lobby';
    this.deadline = 0;
    this.phaseDur = 0;
    this.day = 0;
    this.winner = null;
    this.announce = null;
    this.accused = null;
    this.history = [];
    this.fx('lobby');
    this.sys(this.solo ? 'Back at the table. Deal again when you\'re ready.' : 'Back in the lobby. The host can deal again.', { kind: 'phase' });
    if (this.director) this.director.onLobby();
    this.dirty();
  }
}
