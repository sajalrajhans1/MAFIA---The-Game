// Single-player opponents. A BotDirector sits beside the host and plays every bot seat.
// Bots only use what their seat could know: their own card, fellow Jokers (if Mafia),
// their own Sheriff checks, and everything public (chat, votes, claims, revealed cards).
import { CAST, ALIASES, TICS, LINES, PERSONA_LINES } from './botlines.js';
import { cardLabel } from './cards.js';

export const WITS = [
  { name: 'Rookie', noise: 0.55, evidence: 0.7, fakeClaim: 0.12, kingSmart: 0.55, angelSmart: 0.45, focus: 0.6 },
  { name: 'Wiseguy', noise: 0.3, evidence: 1, fakeClaim: 0.4, kingSmart: 0.85, angelSmart: 0.75, focus: 0.82 },
  { name: 'Mastermind', noise: 0.12, evidence: 1.3, fakeClaim: 0.65, kingSmart: 1, angelSmart: 0.92, focus: 0.95 },
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ language
const RX = {
  greet: /\b(hi|hello|hey|heya|evening|howdy|yo|sup|hiya|greetings|good (morning|evening|night))\b/,
  thanks: /\b(thanks|thank you|thx|ty|cheers|appreciate)\b/,
  insult: /\b(idiot|stupid|dumb|moron|shut up|clown|loser|trash|noob|fool|dummy)\b/,
  laugh: /\b(lol|lmao|lmfao|haha+|hehe+|rofl|xd|heh)\b/,
  skip: /\b(skip|no vote|dont vote|don't vote|abstain)\b/,
  agree: /^\s*(yes|yeah|yep|yup|agreed|agree|exactly|true|right|same|ok|okay|sure|indeed)\b/,
  disagree: /^\s*(no|nope|nah|wrong|disagree|never)\b/,
  claimKing: /\b(i ?'?m|i am|im)\b[^.!?]{0,20}\b(sheriff|king|cop|detective|investigator|the law)\b|\b(sheriff|king) here\b/,
  claimAce: /\b(i ?'?m|i am|im)\b[^.!?]{0,20}\b(angel|ace|medic|protector|guardian)\b|\b(angel|ace) here\b/,
  claimCiv: /\b(i ?'?m|i am|im)\b[^.!?]{0,20}\b(civilian|citizen|villager|townie|number card|a number|plain card)\b/,
  plead: /\b((i ?'?m|i am|im) (innocent|not (a |the )?(mafia|joker))|not me|wasn'?t me|i swear|trust me|i'm clean|im clean|i am clean)\b/,
  townWord: /\b(clean|innocent|town|good guy|safe|trust|trustworthy|legit|not mafia|not a joker|not the joker|not joker|green|honest|on our side)\b/,
  mafiaWord: /\b(mafia|joker|jokers|scum|killer|murderer|guilty|sus|suspicious|shady|liar|lying|red|evil|dirty|fishy|fake)\b/,
  voteWord: /\b(vote|kill|lynch|hang|execute|eliminate|get rid of|shoot|take out|off with)\b/,
  checkWord: /\b(checked|check|investigated|investigate|inspected|looked at|saw)\b/,
  think: /\b(i think|i bet|i suspect|my guess|pretty sure|im sure|i'm sure|probably|gotta be|has to be|must be)\b/,
  who: /\b(who|anyone|anybody|any ideas|thoughts|suspects?|whos|who's)\b/,
  why: /\bwhy\b/,
  quiet: /\b(quiet|silent|say something|speak up|talk to us|not talking|havent said|haven't said)\b/,
  skipBad: /\b(skip(ping)? (is|would be|was) (bad|dumb|stupid|a mistake|pointless)|(don'?t|dont|do not|no|not|never) skip)\b/,
};

// verbal tics only go on lines where they fit the mood
const TIC_KEYS = new Set(['accuse', 'accuseStrong', 'agree', 'disagree', 'defendSelf', 'defendSelfMafia', 'counterAccuse', 'question', 'answerWho',
  'answerNone', 'banter', 'firstDay', 'greet', 'voteFor', 'readyVote', 'pressure', 'defendOther', 'humanQuiet', 'mafiaSuggest', 'mafiaChat']);

function wordRx(w) { return new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`); }

// ------------------------------------------------------------------ director
export class BotDirector {
  constructor(server) {
    this.s = server;
    this.minds = new Map();
    this.recent = [];
    this.floorAt = 0;
    this.speaking = null;
    this.intents = [];
    this.humanTypingUntil = 0;
    this.resetMemory();
  }

  // the human is typing: let them finish before somebody else jumps in
  onTyping(p) { if (!p.bot) this.humanTypingUntil = Date.now() + 2500; }

  get wits() { return WITS[clamp(this.s.settings.wits ?? 1, 0, 2)]; }
  human() { return this.s.players.find(p => !p.bot); }
  bots() { return this.s.players.filter(p => p.bot); }
  alive() { return this.s.players.filter(p => p.alive); }
  byId(pid) { return this.s.byId(pid); }
  name(pid) { const p = this.byId(pid); return p ? p.name : 'someone'; }

  resetMemory() {
    this.mem = {
      day: 0,
      claims: new Map(),      // pid -> { role, day, order, results: Map(target -> isMafia) }
      claimOrder: 0,
      accusations: [],        // { from, to, day, strength, t }
      defenses: [],           // { from, to, day }
      executions: [],         // { pid, day, role, voters: [pid] }
      deaths: [],             // { pid, day, cause, role }
      votes: new Map(),       // voter -> target (live, this vote)
      skips: new Map(),       // pid -> count
      spoke: new Map(),       // pid -> messages today
      spokeTotal: new Map(),
      lastAccusedBy: new Map(), // bot pid -> last pid it accused
      humanSpokeToday: false,
      askedHumanToday: false,
      askedHumanAt: 0,
    };
    this.intents = [];
    this.speaking = null;
  }

  // ------------------------------------------------------------ seating
  setTable(n) {
    const s = this.s;
    n = clamp(Math.round(n), 3, CAST.length);
    const bots = this.bots();
    for (let i = bots.length - 1; i >= n; i--) s.removePlayer(bots[i]);
    for (let i = bots.length; i < n; i++) {
      const c = CAST[i];
      const p = s.newPlayer({ name: c.name, look: c.look, bot: true, token: 'cast-' + i });
      p.title = c.title;
    }
    this.syncMinds();
    s.dirty();
  }

  syncMinds() {
    for (const p of this.bots()) {
      if (this.minds.has(p.pid)) continue;
      const c = CAST.find(x => x.name === p.name) || CAST[0];
      this.minds.set(p.pid, { p, c, noise: new Map(), results: new Map(), saves: [], claimed: false, said: 0, nextTalk: 0, voteAt: 0, reAt: 0, readyAt: 0 });
    }
    for (const pid of [...this.minds.keys()]) if (!this.byId(pid)) this.minds.delete(pid);
  }

  mind(p) { return this.minds.get(p.pid); }

  // the card a bot admits to: civilians tell the truth, everyone else borrows a number card nobody holds
  claimCard(m) {
    if (m.p.role === 'civilian' || !m.p.role) return cardLabel(m.p.card);
    if (!m.fakeCard) {
      const held = new Set(this.s.players.map(p => p.card && cardLabel(p.card)));
      const free = [];
      for (const su of ['S', 'H', 'D', 'C']) for (let r = 2; r <= 10; r++) { const c = { rank: String(r), suit: su }; if (!held.has(cardLabel(c))) free.push(c); }
      m.fakeCard = cardLabel(pick(free));
    }
    return m.fakeCard;
  }

  // ------------------------------------------------------------ knowledge
  publicRole(pid) {
    const p = this.byId(pid);
    if (!p || !p.role) return null;
    if (this.s.phase === 'over') return p.role;
    return !p.alive && this.s.settings.reveal ? p.role : null;
  }

  // 1 = known Joker, -1 = known innocent, 0 = unknown (from this bot's seat)
  known(m, pid) {
    const me = m.p;
    if (pid === me.pid) return me.role === 'mafia' ? 1 : -1;
    const q = this.byId(pid);
    if (me.role === 'mafia') return q && q.role === 'mafia' ? 1 : -1; // Jokers know exactly who is who
    if (m.results.has(pid)) return m.results.get(pid) ? 1 : -1;
    const r = this.publicRole(pid);
    if (r) return r === 'mafia' ? 1 : -1;
    return 0;
  }

  noise(m, pid) {
    if (!m.noise.has(pid)) m.noise.set(pid, Math.random() * 2 - 1);
    return m.noise.get(pid);
  }

  // How believable is a King claim, from this seat
  claimCred(m, claimant) {
    const c = this.mem.claims.get(claimant);
    if (!c || c.role !== 'sheriff') return 0;
    if (m && m.p.role === 'sheriff' && claimant !== m.p.pid) return -0.8; // I'm the real King: they're lying
    if (m && m.p.role === 'mafia') {
      const q = this.byId(claimant);
      return q && q.role === 'mafia' ? -0.8 : 1.2;
    }
    if (m && this.known(m, claimant) === 1) return -0.8;
    let cred = 0.85;
    for (const [target, isMafia] of c.results) {
      const r = this.publicRole(target);
      if (!r) continue;
      if ((r === 'mafia') === isMafia) cred += 0.45; else cred -= 1.6;
    }
    const kings = [...this.mem.claims.values()].filter(x => x.role === 'sheriff').length;
    if (kings > 1) cred -= c.order > [...this.mem.claims.values()].filter(x => x.role === 'sheriff').reduce((a, b) => Math.min(a, b.order), 1e9) ? 0.5 : 0.25;
    return clamp(cred, -1, 1.6);
  }

  // Public evidence against pid, with the reasons behind it (neutral seat when m is null)
  evidence(pid, m) {
    const mem = this.mem, day = mem.day;
    const reasons = [];
    let e = 0;
    const add = (w, key, y) => { e += w; if (w > 0.08) reasons.push({ key, w, y }); };
    const trust = from => {
      if (m) {
        const k = this.known(m, from);
        if (k === -1 && from !== m.p.pid) return 1.1;
        if (k === 1) return -0.4;
      }
      const cc = this.claimCred(m, from);
      return cc > 0.8 ? 1.3 : 0.65;
    };
    // one voice per accuser, with a soft ceiling, so a table can't snowball onto one name
    const byAccuser = new Map(), victims = new Set();
    for (const a of mem.accusations) {
      if (a.to !== pid || a.from === pid) continue;
      const age = day - a.day, decay = age <= 0 ? 1 : age === 1 ? 0.6 : 0.35;
      const w = (m && a.from === m.p.pid) ? 0.12 * a.strength * decay : 0.2 * a.strength * decay * trust(a.from) * (m ? 0.6 + m.c.trust * 0.8 : 1);
      byAccuser.set(a.from, Math.max(byAccuser.get(a.from) ?? -9, w));
      // the victims' words carry weight after they die innocent
      const victim = mem.deaths.find(d => d.pid === a.from && d.cause === 'night');
      if (victim && !victims.has(a.from) && this.publicRole(a.from) !== 'mafia') { victims.add(a.from); add(0.35 * decay, 'r_victimAccused', a.from); }
    }
    let heat = 0;
    for (const w of byAccuser.values()) heat += w;
    if (heat > 0) add(0.75 * Math.tanh(heat / 0.75), byAccuser.size >= 3 ? 'r_bandwagon' : 'r_gut');
    else e += heat;
    if (m && m.p.role !== 'mafia') {
      const hits = mem.accusations.filter(a => a.from === pid && a.to === m.p.pid && day - a.day <= 1).length;
      if (hits) add(0.25 * Math.min(2, hits), 'r_accusedMe');
    }
    for (const d of mem.defenses) {
      if (d.from !== pid) continue;
      const r = this.publicRole(d.to);
      if (r === 'mafia') add(0.9, 'r_defendedMafia', d.to);
      else if (r) e -= 0.12;
    }
    for (const [claimant, c] of mem.claims) {
      if (c.role !== 'sheriff' || claimant === pid) continue;
      if (!c.results.has(pid)) continue;
      const cred = this.claimCred(m, claimant);
      if (c.results.get(pid)) add(1.7 * cred, 'r_sheriff', claimant); else e -= 1.2 * Math.max(0, cred);
    }
    const own = mem.claims.get(pid);
    if (own && own.role === 'sheriff') {
      const cred = this.claimCred(m, pid);
      if (cred < 0) add(-cred * 1.8, 'r_counterClaim');
      else e -= cred * 1.1;
    }
    if (own && own.role === 'angel') e -= 0.25;
    for (const ex of mem.executions) {
      if (!ex.voters.includes(pid)) continue;
      if (ex.role && ex.role !== 'mafia') add(0.45, 'r_votedTown', ex.pid);
      else if (ex.role === 'mafia') e -= 0.35;
    }
    const sk = mem.skips.get(pid) || 0;
    if (sk >= 2) add(0.12 * (sk - 1), 'r_skipper');
    if (day >= 1 && this.s.phase !== 'night') {
      const spoke = mem.spoke.get(pid) || 0;
      const avg = [...mem.spoke.values()].reduce((a, b) => a + b, 0) / Math.max(1, this.alive().length);
      // a quiet human gets asked first, and only counts as quiet after ignoring the table
      const q = this.byId(pid);
      const ignored = q && !q.bot ? mem.askedHumanAt && Date.now() - mem.askedHumanAt > 30000 : true;
      if (spoke === 0 && avg >= 1.2 && ignored) add(q && !q.bot ? 0.18 : 0.22, 'r_quiet');
    }
    reasons.sort((a, b) => b.w - a.w);
    return { e, reasons };
  }

  // Suspicion that pid is a Joker, from bot seat m
  sus(m, pid) {
    const q = this.byId(pid);
    if (!q || !q.alive || pid === m.p.pid) return -9;
    const k = this.known(m, pid);
    if (m.p.role === 'mafia') return k === 1 ? -9 : this.evidence(pid, null).e + this.noise(m, pid) * 0.2;
    if (k) return k * 9;
    return this.noise(m, pid) * this.wits.noise + this.wits.evidence * this.evidence(pid, m).e;
  }

  topSuspect(m, exclude = []) {
    let best = null, bv = -1e9;
    for (const q of this.alive()) {
      if (q.pid === m.p.pid || exclude.includes(q.pid)) continue;
      const v = this.sus(m, q.pid);
      if (v > bv) { bv = v; best = q; }
    }
    return best ? { p: best, v: bv } : null;
  }

  reasonFor(m, pid) {
    const known = this.known(m, pid);
    const mm = m.p.role === 'mafia' ? null : m;
    const { reasons } = this.evidence(pid, mm);
    if (m.results.has(pid) && m.results.get(pid)) return { key: m.claimed ? 'r_myCheck' : 'r_gut' };
    const r = reasons.find(x => x.key !== 'r_gut') || reasons[0];
    if (r) return r;
    if (known === 1 && m.p.role !== 'mafia') return { key: 'r_gut' };
    // only call someone quiet if they really have been
    const spoke = this.mem.spoke.get(pid) || 0;
    const avg = [...this.mem.spoke.values()].reduce((x, y) => x + y, 0) / Math.max(1, this.alive().length);
    return { key: spoke < avg * 0.5 && chance(0.6) ? 'r_quiet' : 'r_gut' };
  }

  // ------------------------------------------------------------ lines
  line(m, key, vars = {}) {
    const persona = m ? m.c.persona : 'tough';
    let pool = (LINES[key] || []).slice();
    const extra = PERSONA_LINES[persona] && PERSONA_LINES[persona][key];
    if (extra) pool = pool.concat(extra, extra);
    if (!pool.length) return '';
    const fresh = pool.filter(l => !this.recent.includes(l));
    const tpl = pick(fresh.length ? fresh : pool);
    this.recent.push(tpl);
    if (this.recent.length > 60) this.recent.shift();
    let text = tpl;
    if (text.includes('{reason}')) {
      const r = vars.reason || { key: 'r_gut' };
      const rp = LINES[r.key] && LINES[r.key].length ? LINES[r.key] : LINES.r_gut;
      text = text.replace('{reason}', pick(rp));
      if (r.y && !vars.y) vars = { ...vars, y: this.name(r.y) };
    }
    const h = this.human();
    const fill = { x: vars.x || '', y: vars.y || 'somebody', h: h ? h.name : 'friend', me: m ? m.p.name : '', card: vars.card || (m ? this.claimCard(m) : ''), n: vars.n || '', list: vars.list || '' };
    text = text.replace(/\{(\w+)\}/g, (_, k) => fill[k] ?? '');
    if (m && TICS[persona] && TIC_KEYS.has(key) && chance(0.22) && text.length < 150) {
      const t = TICS[persona];
      const first = w => w.toLowerCase().replace(/[^a-z]/g, ' ').trim().split(' ')[0];
      const pre = pick(t.pre);
      if (chance(0.5) && !/^[A-Z][a-z]+[,!.]/.test(text.slice(0, 8)) && first(pre) !== first(text)) text = pre + text;
      else if (/[.!]$/.test(text) && !/[?]/.test(text.slice(-3))) text = text + pick(t.post);
    }
    return text.replace(/\s+/g, ' ').trim().slice(0, 230);
  }

  // Queue something for a bot to say. `make` builds the text when the bot actually speaks.
  intend(m, { at = 0, until = 20, urg = 1, ch = 'town', make, key, vars, effect } = {}) {
    const now = Date.now();
    this.intents.push({ m, at: now + at * 1000, until: now + (at + until) * 1000, urg, ch, make, key, vars, effect });
  }

  // ------------------------------------------------------------ events from the host
  onLobbyJoin() {
    this.syncMinds();
    const h = this.human();
    if (!h) return;
    const talkers = this.bots().slice(0, 3).sort(() => Math.random() - 0.5).slice(0, 2);
    talkers.forEach((b, i) => this.intend(this.mind(b), { at: 1.5 + i * 2.5, key: 'lobbyGreet', urg: 2 }));
  }

  onStart() {
    this.resetMemory();
    for (const m of this.minds.values()) {
      m.noise = new Map(); m.results = new Map(); m.saves = []; m.claimed = false; m.said = 0; m.voteAt = 0; m.readyAt = 0; m.lastSaveNight = 0;
      m.fakeCard = null; m.saveWorked = null; m.planned = null; m.replies = 0;
    }
    this.syncMinds();
    for (const m of this.minds.values()) m.readyAt = Date.now() + rand(2500, 7000);
    const talkers = [...this.minds.values()].sort(() => Math.random() - 0.5).slice(0, 2);
    talkers.forEach((m, i) => this.intend(m, { at: 2 + i * 3, key: 'greet', urg: 1 }));
  }

  onLobby() { this.resetMemory(); }

  onPhase(phase) {
    const s = this.s, now = Date.now();
    this.intents = this.intents.filter(i => i.keep);
    this.speaking = null;
    this.floorAt = now + 1200;
    const mem = this.mem;
    if (phase === 'night') {
      mem.day = s.day;
      this.planNight();
    } else if (phase === 'dawn') {
      mem.spoke = new Map();
      mem.humanSpokeToday = false;
      mem.askedHumanToday = false;
      mem.askedHumanAt = 0;
      for (const m of this.minds.values()) { m.said = 0; m.replies = 0; }
    } else if (phase === 'day') {
      this.planDay();
    } else if (phase === 'vote') {
      mem.votes = new Map();
      this.planVote();
    } else if (phase === 'lastwords') {
      const q = this.byId(s.accused);
      if (q && q.bot) this.planLastWords(this.mind(q));
    } else if (phase === 'over') {
      this.planGameOver();
    }
  }

  onChat(msg) {
    const mem = this.mem;
    if (!msg.pid) return;
    mem.spoke.set(msg.pid, (mem.spoke.get(msg.pid) || 0) + 1);
    mem.spokeTotal.set(msg.pid, (mem.spokeTotal.get(msg.pid) || 0) + 1);
    const p = this.byId(msg.pid);
    if (!p || p.bot) return;
    if (msg.ch === 'town') mem.humanSpokeToday = true;
    this.hearHuman(p, msg.text, msg.ch);
  }

  onVote(p, target) {
    const mem = this.mem;
    mem.votes.set(p.pid, target);
    if (target === 'skip') { mem.skips.set(p.pid, (mem.skips.get(p.pid) || 0) + 1); return; }
    mem.accusations.push({ from: p.pid, to: target, day: mem.day, strength: 1.2 });
    const q = this.byId(target);
    if (!p.bot && q && q.bot && q.alive) {
      const m = this.mind(q);
      const votesOn = [...mem.votes.values()].filter(v => v === target).length;
      if (votesOn >= 2 || chance(0.45)) this.intend(m, { at: rand(1, 3), urg: 5, key: votesOn >= 2 ? 'voteReactOnMe' : 'replyAccusedByHuman' });
    }
  }

  onInspect(p, q, isMafia) {
    const m = this.mind(p);
    if (m) m.results.set(q.pid, isMafia);
  }

  onNightPick(p, target) {
    // a human Joker picked: bot Jokers fall in line and say so
    if (p.bot || p.role !== 'mafia') return;
    const mates = this.bots().filter(b => b.alive && b.role === 'mafia');
    mates.forEach(b => { if (b.action !== target) this.s.act(b, target); });
    if (mates.length) this.intend(this.mind(pick(mates)), { at: rand(0.8, 2), ch: 'mafia', urg: 6, key: 'mafiaAckHuman', vars: { x: this.name(target) } });
  }

  onDeath(p, cause) {
    this.mem.deaths.push({ pid: p.pid, day: this.mem.day, cause, role: this.s.settings.reveal ? p.role : null });
  }

  onDawn({ victim, saved }) {
    const mem = this.mem;
    const talkers = this.bots().filter(b => b.alive).sort(() => Math.random() - 0.5);
    if (victim) {
      const claimedKing = mem.claims.get(victim.pid)?.role === 'sheriff';
      const accuser = mem.accusations.some(a => a.from === victim.pid && a.day === mem.day - 1);
      talkers.slice(0, 2).forEach((b, i) => {
        const key = i === 0 && claimedKing ? 'deathReactKing' : i === 1 && accuser && chance(0.6) ? 'deathReactAccuser' : 'deathReact';
        this.intend(this.mind(b), { at: 1.5 + i * 2.2, key, vars: { x: victim.name }, urg: 3, until: 12 });
      });
    } else if (saved) {
      talkers.slice(0, 1).forEach(b => this.intend(this.mind(b), { at: 1.5, key: 'savedReact', urg: 3, until: 10 }));
      for (const b of this.bots()) {
        const m = this.mind(b);
        if (b.role === 'angel' && m.lastSaveNight === mem.day) m.saveWorked = { x: m.lastSave, n: mem.day };
      }
    } else if (chance(0.6)) talkers.slice(0, 1).forEach(b => this.intend(this.mind(b), { at: 1.5, key: 'quietReact', urg: 2, until: 10 }));
  }

  onExecute(q, voters) {
    const role = this.s.settings.reveal ? q.role : null;
    this.mem.executions.push({ pid: q.pid, day: this.mem.day, role, voters });
    const talkers = this.bots().filter(b => b.alive).sort(() => Math.random() - 0.5);
    if (!talkers.length) return;
    const m = this.mind(talkers[0]);
    if (role === 'mafia') this.intend(m, { at: 1.2, key: 'execMafia', urg: 3, until: 6 });
    else if (role) {
      this.intend(m, { at: 1.2, key: 'execTown', urg: 3, until: 6, vars: { card: cardLabel(q.card) } });
      const pusher = this.mem.accusations.find(a => a.to === q.pid && a.day === this.mem.day && a.from !== talkers[1]?.pid);
      if (pusher && talkers[1] && chance(0.6)) this.intend(this.mind(talkers[1]), { at: 3.5, key: 'execTownBlame', vars: { x: this.name(pusher.from) }, urg: 2, until: 5 });
    }
  }

  onNoExecution() {
    const b = this.bots().filter(x => x.alive);
    if (b.length && chance(0.5)) this.intend(this.mind(pick(b)), { at: 1.5, key: 'noExec', urg: 2, until: 5 });
  }

  // ------------------------------------------------------------ planning
  planNight() {
    const s = this.s, now = Date.now();
    for (const m of this.minds.values()) {
      const b = m.p;
      if (!b.alive) continue;
      m.nightAt = now + rand(3000, 9000);
    }
    // Joker chatter (visible to Jokers and the dead)
    const jokers = this.bots().filter(b => b.alive && b.role === 'mafia');
    const h = this.human();
    if (jokers.length) {
      const lead = this.mind(jokers[0]);
      const target = this.chooseVictim(lead);
      lead.planned = target && target.pid;
      if (h && h.alive && h.role === 'mafia') {
        this.intend(lead, { at: rand(2, 4), ch: 'mafia', urg: 5, key: target ? 'mafiaSuggestHuman' : 'mafiaAskHuman', vars: { x: target ? target.name : '' } });
      } else if (target) {
        this.intend(lead, { at: rand(2, 5), ch: 'mafia', urg: 4, key: 'mafiaSuggest', vars: { x: target.name } });
        if (jokers[1]) this.intend(this.mind(jokers[1]), { at: rand(6, 9), ch: 'mafia', urg: 3, key: chance(0.7) ? 'mafiaFollow' : 'mafiaChat', vars: { x: target.name } });
      }
      const hunter = this.mem.accusations.filter(a => a.day === this.mem.day && this.byId(a.to)?.role === 'mafia' && this.byId(a.from)?.alive && this.byId(a.from)?.role !== 'mafia').map(a => a.from);
      if (hunter.length && chance(0.6)) this.intend(this.mind(pick(jokers)), { at: rand(9, 14), ch: 'mafia', urg: 2, key: 'mafiaWorried', vars: { x: this.name(pick(hunter)) } });
      else if (chance(0.5)) this.intend(this.mind(pick(jokers)), { at: rand(10, 16), ch: 'mafia', urg: 1, key: 'mafiaChat' });
    }
  }

  chooseVictim(m) {
    const mem = this.mem, W = this.wits;
    let best = null, bv = -1e9;
    for (const q of this.alive()) {
      if (q.role === 'mafia') continue;
      let v = Math.random() * (1.6 - W.focus);
      const claim = mem.claims.get(q.pid);
      if (claim && claim.role === 'sheriff') v += 3;
      if (claim && claim.role === 'angel') v += 1.6;
      const againstUs = mem.accusations.filter(a => a.from === q.pid && this.byId(a.to)?.role === 'mafia' && mem.day - a.day <= 1).length;
      v += 0.9 * againstUs;
      v -= 0.8 * Math.max(0, this.evidence(q.pid, null).e); // let the town hang its own suspects
      v += 0.08 * (mem.spokeTotal.get(q.pid) || 0);
      if (!q.bot) v += mem.day <= 1 ? -0.9 : 0.15; // give the human a real game before they become a target
      if (v > bv) { bv = v; best = q; }
    }
    return best;
  }

  planDay() {
    const s = this.s, now = Date.now(), mem = this.mem;
    const alive = this.bots().filter(b => b.alive);
    const dayLen = s.settings.dayTime;
    alive.forEach((b, i) => {
      const m = this.mind(b);
      m.nextTalk = now + rand(4000, 14000) + i * 1400;
      m.readyAt = now + dayLen * 1000 * rand(0.55, 0.8);
      m.maxSay = Math.round(1.5 + m.c.talk * 3.5);
    });
    // day one: a couple of openers
    if (s.day === 1) alive.sort(() => Math.random() - 0.5).slice(0, 2).forEach((b, i) => this.intend(this.mind(b), { at: 3 + i * 4, key: 'firstDay', urg: 2, until: 25 }));
    // the King speaks up when he has something
    for (const b of alive) {
      const m = this.mind(b);
      if (b.role === 'sheriff' && !m.claimed) this.maybeKingClaim(m, false);
      if (b.role === 'angel' && m.saveWorked && !m.claimed && chance(0.25 * this.wits.angelSmart)) {
        m.claimed = true;
        this.intend(m, { at: rand(8, 20), key: 'angelClaim', vars: { x: this.name(m.saveWorked.x), n: m.saveWorked.n }, urg: 4, effect: () => this.recordClaim(b.pid, 'angel') });
      }
    }
  }

  maybeKingClaim(m, pressed) {
    const b = m.p, W = this.wits;
    const hits = [...m.results].filter(([pid, isM]) => isM && this.byId(pid)?.alive);
    const clean = [...m.results].filter(([, isM]) => !isM);
    let go = false;
    if (hits.length) go = chance(W.kingSmart);
    else if (pressed) go = chance(0.5 + W.kingSmart * 0.4);
    else if (clean.length >= 2 && this.mem.day >= 3) go = chance(0.35);
    if (!go) return;
    m.claimed = true;
    const target = hits.length ? hits[0][0] : clean.length ? clean[clean.length - 1][0] : null;
    const list = [...m.results].map(([pid, isM]) => `${this.name(pid)} ${isM ? 'is a JOKER' : 'is clean'}`).join(', ');
    this.intend(m, {
      at: pressed ? rand(1.2, 3) : rand(4, 12), urg: pressed ? 9 : 8, until: 40,
      make: () => {
        if (!target) return this.line(m, 'kingList', { list });
        const key = m.results.get(target) ? 'kingClaimMafia' : 'kingClaimClean';
        let t = this.line(m, key, { x: this.name(target) });
        if (m.results.size > 1) t += ' ' + this.line(null, 'kingList', { list });
        return t;
      },
      effect: () => {
        this.recordClaim(b.pid, 'sheriff', m.results);
        for (const [pid, isM] of m.results) {
          if (!isM) continue;
          this.mem.accusations.push({ from: b.pid, to: pid, day: this.mem.day, strength: 2 });
          const q = this.byId(pid);
          if (q && q.bot && q.alive) this.accused(this.mind(q), b.pid, true);
        }
        this.reactToKingClaim(b.pid);
      },
    });
  }

  recordClaim(pid, role, results) {
    const mem = this.mem;
    const c = mem.claims.get(pid) || { role, day: mem.day, order: ++mem.claimOrder, results: new Map() };
    c.role = role;
    if (results) for (const [k, v] of results) c.results.set(k, v);
    mem.claims.set(pid, c);
  }

  // someone claimed King: the rest of the table reacts, a real King or a sly Joker may counter
  reactToKingClaim(claimant) {
    const mem = this.mem, W = this.wits;
    const c = mem.claims.get(claimant);
    const kings = [...mem.claims.entries()].filter(([, x]) => x.role === 'sheriff');
    const others = this.bots().filter(b => b.alive && b.pid !== claimant).sort(() => Math.random() - 0.5);
    for (const b of others) {
      const m = this.mind(b);
      // the real King exposes a fake
      if (b.role === 'sheriff' && !mem.claims.has(b.pid)) {
        if (chance(W.kingSmart)) {
          m.results.set(claimant, true);
          m.claimed = false;
          this.maybeKingClaim(m, true);
          if (!m.claimed) { m.claimed = true; this.intend(m, { at: rand(1.5, 3), urg: 9, key: 'fakeClaim', vars: { x: this.name(claimant) }, effect: () => { this.recordClaim(b.pid, 'sheriff', new Map([[claimant, true]])); mem.accusations.push({ from: b.pid, to: claimant, day: mem.day, strength: 2 }); } }); }
        }
        return;
      }
      // a Joker named by the King (or whose partner was named) may fake-claim
      if (b.role === 'mafia' && !mem.claims.has(b.pid) && kings.length === 1) {
        const namesUs = [...c.results].some(([pid, isM]) => isM && this.byId(pid)?.role === 'mafia');
        if (namesUs && chance(W.fakeClaim * (0.5 + m.c.sly * 0.6))) {
          this.intend(m, {
            at: rand(2, 5), urg: 9, key: 'fakeClaim', vars: { x: this.name(claimant) },
            effect: () => { this.recordClaim(b.pid, 'sheriff', new Map([[claimant, true]])); mem.accusations.push({ from: b.pid, to: claimant, day: mem.day, strength: 2 }); },
          });
          return;
        }
      }
    }
    // one or two ordinary reactions (not from anyone the King just named)
    const reactors = others.filter(b => !(c.results.get(b.pid))).slice(0, kings.length > 1 ? 2 : 1);
    reactors.forEach((b, i) => {
      const m = this.mind(b);
      const key = kings.length > 1 ? 'claimDoubt' : (m.c.trust > 0.35 || chance(0.5)) ? 'claimBelieve' : 'claimDoubt';
      this.intend(m, { at: rand(2.5, 5) + i * 2, urg: 4, key, vars: { x: this.name(claimant) }, until: 15 });
    });
  }

  planVote() {
    const now = Date.now(), vt = this.s.settings.voteTime * 1000;
    for (const b of this.bots()) {
      if (!b.alive) continue;
      const m = this.mind(b);
      m.voteAt = now + rand(0.12, 0.5) * vt * (1.2 - m.c.aggro * 0.5);
      m.reAt = now + vt * rand(0.6, 0.78);
      m.voted = null;
      m.revoted = false;
    }
  }

  chooseVote(m) {
    const mem = this.mem, W = this.wits, me = m.p;
    const tally = {};
    for (const [, t] of mem.votes) if (t && t !== 'skip') tally[t] = (tally[t] || 0) + 1;
    const leader = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    const alive = this.alive().length;
    if (me.role === 'mafia') {
      // sell out a doomed partner to look clean
      if (leader && this.byId(leader)?.role === 'mafia' && leader !== me.pid && tally[leader] >= Math.floor(alive / 2) && chance(0.35 + m.c.sly * 0.4)) return leader;
      if (leader && this.byId(leader)?.role !== 'mafia' && tally[leader] >= 2) return leader;
      const t = this.topSuspect(m);
      return t ? t.p.pid : 'skip';
    }
    const t = this.topSuspect(m);
    if (!t) return 'skip';
    if (t.v >= 0.3 * (2 - W.focus)) return t.p.pid;
    if (leader && leader !== me.pid && tally[leader] >= 2 && this.sus(m, leader) > -0.2 && chance(0.4 + m.c.trust * 0.5)) return leader;
    return chance(0.55) ? 'skip' : t.p.pid;
  }

  planLastWords(m) {
    const b = m.p;
    const list = [...m.results].map(([pid, isM]) => `${this.name(pid)} ${isM ? 'is a JOKER' : 'is clean'}`).join(', ');
    const key = b.role === 'mafia' ? 'lastMafia' : b.role === 'sheriff' && m.results.size ? 'lastKing' : b.role === 'angel' ? 'lastAngel' : 'lastTown';
    this.intend(m, { at: rand(1.5, 3.5), urg: 10, key, vars: { list }, until: 12 });
  }

  planGameOver() {
    const w = this.s.winner;
    const bots = this.bots().sort(() => Math.random() - 0.5).slice(0, 3);
    bots.forEach((b, i) => {
      const m = this.mind(b);
      const onWin = (b.role === 'mafia') === (w === 'mafia');
      const key = onWin ? (w === 'mafia' ? 'winMafia' : 'winTown') : (b.role === 'mafia' ? 'loseMafia' : 'loseTown');
      this.intend(m, { at: 2 + i * 2.2, key, urg: 3, until: 20 });
    });
  }

  // ------------------------------------------------------------ the human talks
  mentions(text, speaker) {
    const found = [];
    for (const p of this.s.players) {
      if (p.pid === speaker.pid) continue;
      const keys = new Set([p.name.toLowerCase()]);
      const first = p.name.toLowerCase().split(/\s+/)[0];
      if (first.length >= 3) keys.add(first);
      for (const a of ALIASES[p.name] || []) keys.add(a);
      let at = -1;
      for (const k of keys) {
        const mm = text.match(wordRx(k));
        if (mm && (at < 0 || mm.index < at)) at = mm.index;
      }
      if (at >= 0) found.push({ p, at });
    }
    return found.sort((a, b) => a.at - b.at).map(f => f.p);
  }

  hearHuman(h, raw, ch) {
    const s = this.s, mem = this.mem;
    const text = ' ' + String(raw).toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'?!. ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const ms = this.mentions(text, h);
    const aliveBots = this.bots().filter(b => b.alive);
    const replyFrom = (list, n = 1) => list.slice().sort(() => Math.random() - 0.5).slice(0, n);
    const isQ = /\?/.test(text) || RX.who.test(text) || RX.why.test(text);

    // ---- lobby small talk
    if (s.phase === 'lobby') {
      if (RX.greet.test(text) || ms.length) replyFrom(ms.length ? ms.filter(p => p.bot) : this.bots(), 1).forEach(b => this.intend(this.mind(b), { at: rand(1, 2.5), key: RX.greet.test(text) ? 'replyGreet' : 'lobbyChat', urg: 4 }));
      return;
    }

    // ---- the dead talk among themselves
    if (ch === 'dead') {
      const ghosts = this.bots().filter(b => !b.alive);
      if (ghosts.length) {
        const g = this.mind(pick(ghosts));
        const joker = this.alive().find(p => p.role === 'mafia');
        this.intend(g, { at: rand(1.5, 3), ch: 'dead', urg: 4, key: joker && chance(0.35) ? 'ghostReveal' : 'ghostReply', vars: { x: joker ? joker.name : '' } });
      }
      return;
    }

    // ---- Joker chat at night: the human names a victim
    if (ch === 'mafia') {
      const mates = aliveBots.filter(b => b.role === 'mafia');
      if (!mates.length) return;
      const target = ms.find(p => p.alive && p.role !== 'mafia');
      if (target) {
        mates.forEach(b => s.act(b, target.pid));
        this.intend(this.mind(pick(mates)), { at: rand(1, 2.5), ch: 'mafia', urg: 6, key: 'mafiaAckHuman', vars: { x: target.name } });
      } else if (RX.who.test(text) || isQ) {
        const m = this.mind(pick(mates));
        const v = this.chooseVictim(m);
        if (v) this.intend(m, { at: rand(1, 2.5), ch: 'mafia', urg: 6, key: 'mafiaSuggestHuman', vars: { x: v.name } });
      } else if (chance(0.5)) this.intend(this.mind(pick(mates)), { at: rand(1.5, 3), ch: 'mafia', urg: 3, key: 'mafiaChat' });
      return;
    }
    if (ch !== 'town') return;

    // ---- claims
    if (RX.claimKing.test(text)) {
      const results = new Map();
      for (const p of ms) {
        if (RX.townWord.test(text) && !RX.mafiaWord.test(text.replace(/not (a |the )?(mafia|joker)/g, ''))) results.set(p.pid, false);
        else if (RX.mafiaWord.test(text) || RX.voteWord.test(text)) results.set(p.pid, true);
      }
      const already = [...mem.claims.entries()].find(([pid, c]) => c.role === 'sheriff' && pid !== h.pid);
      this.recordClaim(h.pid, 'sheriff', results);
      for (const [pid, isM] of results) if (isM) mem.accusations.push({ from: h.pid, to: pid, day: mem.day, strength: 2 });
      const r = replyFrom(aliveBots.filter(b => !results.has(b.pid)), 1)[0];
      const named = results.size ? [...results.keys()][0] : null;
      let rkey = already ? 'replyHumanClaimKingDoubt' : named ? (results.get(named) ? 'replyHumanResultMafia' : 'replyHumanResultClean') : 'replyHumanClaimKing';
      if (r && rkey === 'replyHumanResultMafia' && (r.role === 'mafia' ? chance(0.5) : this.known(this.mind(r), named) === -1)) rkey = 'replyHumanResultMafiaDoubt';
      if (r) this.intend(this.mind(r), { at: rand(1.5, 3), urg: 6, key: rkey, vars: { x: already ? this.name(already[0]) : named ? this.name(named) : '' } });
      for (const [pid, isM] of results) { const q = this.byId(pid); if (isM && q?.bot && q.alive) this.accused(this.mind(q), h.pid, true); }
      this.reactToKingClaim(h.pid);
      return;
    }
    if (RX.claimAce.test(text)) {
      this.recordClaim(h.pid, 'angel');
      const r = replyFrom(aliveBots, 1)[0];
      if (r) this.intend(this.mind(r), { at: rand(1.5, 3), urg: 5, key: 'replyHumanClaimAce' });
      return;
    }
    if (RX.claimCiv.test(text)) {
      const r = replyFrom(aliveBots, 1)[0];
      if (r && chance(0.6)) this.intend(this.mind(r), { at: rand(1.5, 3), urg: 4, key: 'replyHumanClaimCiv' });
      return;
    }
    // a King who already claimed reports a new check
    const myClaim = mem.claims.get(h.pid);
    if (myClaim && myClaim.role === 'sheriff' && RX.checkWord.test(text) && ms.length) {
      const p = ms[0];
      const isM = RX.mafiaWord.test(text) && !/not (a |the )?(mafia|joker)/.test(text);
      myClaim.results.set(p.pid, isM);
      if (isM) mem.accusations.push({ from: h.pid, to: p.pid, day: mem.day, strength: 2 });
      const r = replyFrom(aliveBots.filter(b => b.pid !== p.pid), 1)[0];
      if (r) this.intend(this.mind(r), { at: rand(1.5, 3), urg: 5, key: isM ? 'replyHumanResultMafia' : 'replyHumanResultClean', vars: { x: p.name } });
      if (isM && p.bot && p.alive) this.accused(this.mind(p), h.pid, true);
      return;
    }

    // ---- pleading innocence
    if (RX.plead.test(text) && !ms.length) {
      const r = replyFrom(aliveBots, 1)[0];
      if (r) {
        const m = this.mind(r);
        const believe = this.sus(m, h.pid) < 0.3;
        this.intend(m, { at: rand(1.5, 3), urg: 5, key: believe ? 'replyPleaBelieve' : 'replyPleaDoubt' });
      }
      return;
    }

    // ---- talking about someone
    if (ms.length) {
      const first = ms[0];
      const addressed = first.bot && first.alive && (text.trimStart().startsWith(first.name.toLowerCase().split(' ')[0]) || text.trimStart().startsWith((ALIASES[first.name] || [])[0] || '#')) && (isQ || ms.length === 1 && text.length < 60 && !RX.mafiaWord.test(text));
      const about = addressed ? ms.slice(1) : ms;
      if (addressed) {
        const m = this.mind(first);
        if (about.length) {
          // "vinnie, what about rosa?"
          const x = about[0];
          if (!x.alive) {
            const r = this.publicRole(x.pid);
            this.intend(m, { at: rand(1.2, 2.5), urg: 7, key: r === 'mafia' ? 'answerDeadJoker' : r ? 'answerDeadCard' : 'answerDead', vars: { x: x.name, card: cardLabel(x.card) } });
          } else {
            const v = this.sus(m, x.pid);
            this.intend(m, { at: rand(1.2, 2.5), urg: 7, key: v > 0.35 ? 'answerDistrust' : v < -0.2 ? 'answerTrust' : 'answerNone', vars: { x: x.name } });
          }
        } else if (RX.quiet.test(text)) {
          // called out for being quiet: say so, then give a name
          this.intend(m, { at: rand(1.2, 2.5), urg: 7, key: 'replyQuietMe' });
          const t = this.topSuspect(m);
          if (t && t.v > 0.1) this.intend(m, { at: rand(3.5, 5), urg: 6, key: 'answerWho', vars: { x: t.p.name, reason: this.reasonFor(m, t.p.pid) }, effect: () => this.recordAccusation(m, t.p.pid, 0.8) });
        } else if (RX.why.test(text)) {
          const last = mem.lastAccusedBy.get(first.pid);
          if (last) this.intend(m, { at: rand(1.2, 2.5), urg: 7, key: 'replyWhyMe', vars: { reason: this.reasonFor(m, last), x: this.name(last) } });
          else this.intend(m, { at: rand(1.2, 2.5), urg: 7, key: 'answerNone' });
        } else if (RX.who.test(text) || isQ) {
          const t = this.topSuspect(m);
          if (t && t.v > 0.1) this.intend(m, { at: rand(1.2, 2.5), urg: 7, key: 'answerWho', vars: { x: t.p.name, reason: this.reasonFor(m, t.p.pid) }, effect: () => this.recordAccusation(m, t.p.pid, 0.8) });
          else this.intend(m, { at: rand(1.2, 2.5), urg: 7, key: 'answerNone' });
        } else if (RX.greet.test(text)) this.intend(m, { at: rand(1, 2), urg: 5, key: 'replyGreet' });
        else if (RX.insult.test(text)) this.intend(m, { at: rand(1, 2), urg: 5, key: 'replyInsult' });
        else if (RX.thanks.test(text)) this.intend(m, { at: rand(1, 2), urg: 5, key: 'replyThanks' });
        else this.intend(m, { at: rand(1, 2.2), urg: 5, key: text.trim().split(' ').length > 3 && chance(0.4) ? 'replyConfused' : 'replyAskMe' });
        return;
      }
      if (RX.thanks.test(text) || (RX.greet.test(text) && text.trim().split(' ').length <= 4)) {
        const x = about.find(p => p.bot && p.alive);
        if (x) this.intend(this.mind(x), { at: rand(1, 2.2), urg: 5, key: RX.thanks.test(text) ? 'replyThanks' : 'replyGreet' });
        return;
      }
      const deadNamed = about.find(p => !p.alive);
      if (deadNamed && !about.some(p => p.alive) && (RX.mafiaWord.test(text) || RX.voteWord.test(text))) {
        const r = replyFrom(aliveBots, 1)[0];
        const role = this.publicRole(deadNamed.pid);
        if (r) this.intend(this.mind(r), { at: rand(1.5, 3), urg: 5, key: role === 'mafia' ? 'answerDeadJoker' : role ? 'answerDeadCard' : 'answerDead', vars: { x: deadNamed.name, card: cardLabel(deadNamed.card) } });
        return;
      }
      for (const x of about.filter(p => p.alive).slice(0, 2)) {
        const defend = RX.townWord.test(text) && !RX.voteWord.test(text) && !/\b(sus|joker|mafia)\b/.test(text.replace(/not (a |the )?(mafia|joker)/g, ''));
        if (defend) {
          mem.defenses.push({ from: h.pid, to: x.pid, day: mem.day });
          if (x.bot && x.alive && chance(0.55)) this.intend(this.mind(x), { at: rand(1.2, 2.5), urg: 5, key: 'thanksDefend', vars: { x: h.name } });
          continue;
        }
        const bare = text.trim().replace(/[?!.]/g, '').trim().split(' ').length <= 2; // "rosa?" / "it's rosa"
        const accuse = RX.mafiaWord.test(text) || RX.voteWord.test(text) || RX.think.test(text) || (isQ && !RX.why.test(text)) || bare;
        if (!accuse) continue;
        mem.accusations.push({ from: h.pid, to: x.pid, day: mem.day, strength: RX.voteWord.test(text) ? 1.3 : 1 });
        if (x.bot && x.alive) this.accused(this.mind(x), h.pid, false);
        // someone else weighs in
        const other = replyFrom(aliveBots.filter(b => b.pid !== x.pid), 1)[0];
        if (other && chance(0.7)) {
          const m = this.mind(other);
          const v = this.sus(m, x.pid);
          const key = v > 0.25 ? 'replyVoteOtherAgree' : v < -0.25 ? 'replyVoteOtherDisagree' : 'replyVoteOther';
          this.intend(m, { at: rand(2.5, 5), urg: 4, key, vars: { x: x.name }, effect: v > 0.25 ? () => this.recordAccusation(m, x.pid, 0.8) : v < -0.25 ? () => mem.defenses.push({ from: other.pid, to: x.pid, day: mem.day }) : null });
        }
      }
      return;
    }

    // ---- general chatter
    if (RX.skip.test(text) && s.phase !== 'lobby') {
      const r = replyFrom(aliveBots, 1)[0];
      if (r && chance(0.7)) this.intend(this.mind(r), { at: rand(1.5, 3), urg: 3, key: RX.skipBad.test(text) ? 'replyAgree' : 'replySkip' });
    } else if (RX.who.test(text) && isQ) {
      replyFrom(aliveBots, chance(0.5) ? 2 : 1).forEach((b, i) => {
        const m = this.mind(b);
        const t = this.topSuspect(m);
        if (t && t.v > 0.15) this.intend(m, { at: rand(1.5, 3) + i * 2.5, urg: 6, key: 'answerWho', vars: { x: t.p.name, reason: this.reasonFor(m, t.p.pid) }, effect: () => this.recordAccusation(m, t.p.pid, 0.8) });
        else this.intend(m, { at: rand(1.5, 3) + i * 2.5, urg: 5, key: 'answerNone' });
      });
    } else if (RX.greet.test(text)) replyFrom(aliveBots, 1).forEach(b => this.intend(this.mind(b), { at: rand(1, 2.5), urg: 4, key: 'replyGreet' }));
    else if (RX.insult.test(text)) replyFrom(aliveBots, 1).forEach(b => this.intend(this.mind(b), { at: rand(1, 2.5), urg: 4, key: 'replyInsult' }));
    else if (RX.laugh.test(text) && chance(0.5)) replyFrom(aliveBots, 1).forEach(b => this.intend(this.mind(b), { at: rand(1, 2.5), urg: 2, key: 'replyLaugh' }));
    else if (RX.thanks.test(text) && chance(0.6)) replyFrom(aliveBots, 1).forEach(b => this.intend(this.mind(b), { at: rand(1, 2.5), urg: 2, key: 'replyThanks' }));
    else if (RX.agree.test(text) && chance(0.4)) replyFrom(aliveBots, 1).forEach(b => this.intend(this.mind(b), { at: rand(1, 2.5), urg: 2, key: 'replyAgree' }));
  }

  // a bot has been accused by `by`: defend, counter, or (a cornered King) claim
  accused(m, by, serious) {
    const b = m.p;
    const heat = this.mem.accusations.filter(a => a.to === b.pid && a.day === this.mem.day).length;
    // answer a couple of times a day, not every jab; always answer the human more readily
    const fromHuman = !this.byId(by)?.bot;
    if (!serious && m.replies >= (fromHuman ? 4 : 2)) return;
    if (this.intents.some(i => i.m === m && i.urg >= 7)) return;
    m.replies = (m.replies || 0) + 1;
    if (b.role === 'sheriff' && !m.claimed && (serious || heat >= 2)) { this.maybeKingClaim(m, true); if (m.claimed) return; }
    if (b.role === 'angel' && !m.claimed && heat >= 3 && chance(0.5)) {
      m.claimed = true;
      const sw = m.saveWorked;
      this.intend(m, { at: rand(1.2, 2.5), urg: 8, key: sw ? 'angelClaim' : 'angelClaimPlain', vars: sw ? { x: this.name(sw.x), n: sw.n } : {}, effect: () => this.recordClaim(b.pid, 'angel') });
      return;
    }
    const counter = chance(0.2 + m.c.aggro * 0.3);
    const key = counter ? 'counterAccuse' : b.role === 'mafia' ? 'defendSelfMafia' : (chance(0.3) ? 'civClaim' : 'defendSelf');
    this.intend(m, { at: rand(1.4, 3.2), urg: 7, key, vars: { x: this.name(by) }, effect: counter ? () => this.recordAccusation(m, by, 0.7, false) : null });
  }

  recordAccusation(m, pid, strength, provoke = true) {
    this.mem.accusations.push({ from: m.p.pid, to: pid, day: this.mem.day, strength });
    this.mem.lastAccusedBy.set(m.p.pid, pid);
    const q = this.byId(pid);
    if (provoke && q && q.bot && q.alive && chance(0.6)) this.accused(this.mind(q), m.p.pid, strength > 1.5);
  }

  // ------------------------------------------------------------ opinions during the day
  opinion(m) {
    const mem = this.mem, b = m.p, s = this.s;
    const h = this.human();
    // nudge a silent human once a day
    if (h && h.alive && !mem.humanSpokeToday && !mem.askedHumanToday && s.day >= 1 && chance(0.5)) {
      mem.askedHumanToday = true;
      return { key: 'humanQuiet', effect: () => { mem.askedHumanAt = Date.now(); } };
    }
    // react to a fresh accusation from someone else
    const fresh = mem.accusations.filter(a => a.day === mem.day && a.from !== b.pid && a.to !== b.pid && this.byId(a.to)?.alive).slice(-3);
    if (fresh.length && chance(0.45)) {
      const a = pick(fresh);
      const v = this.sus(m, a.to);
      if (b.role === 'mafia' && this.byId(a.to)?.role === 'mafia') {
        if (chance(0.35 + m.c.sly * 0.3)) return { key: 'disagree', vars: { x: this.name(a.to), y: this.name(a.from) }, effect: () => mem.defenses.push({ from: b.pid, to: a.to, day: mem.day }) };
      } else if (v > 0.25) return { key: 'agree', vars: { x: this.name(a.to), y: this.name(a.from) }, effect: () => this.recordAccusation(m, a.to, 0.9) };
      else if (v < -0.4) return { key: chance(0.5) ? 'defendOther' : 'disagree', vars: { x: this.name(a.to), y: this.name(a.from) }, effect: () => mem.defenses.push({ from: b.pid, to: a.to, day: mem.day }) };
    }
    const t = this.topSuspect(m);
    if (t && (t.v > 0.3 || (s.day === 1 && chance(0.45)) || chance(m.c.aggro * 0.5))) {
      const strong = t.v > 1.2 && chance(0.6);
      const reason = this.reasonFor(m, t.p.pid);
      return { key: strong ? 'accuseStrong' : 'accuse', vars: { x: t.p.name, reason }, effect: () => this.recordAccusation(m, t.p.pid, strong ? 1.5 : 1) };
    }
    if (chance(0.4)) {
      const others = this.alive().filter(q => q.pid !== b.pid);
      const q = pick(others);
      if (q && !q.bot) {
        if (mem.askedHumanToday || mem.humanSpokeToday) return { key: 'banter' };
        mem.askedHumanToday = true;
        return { key: 'humanQuiet', effect: () => { mem.askedHumanAt = Date.now(); } };
      }
      return { key: 'question', vars: { x: q ? q.name : '' } };
    }
    return { key: chance(0.5) ? 'banter' : 'answerNone' };
  }

  // ------------------------------------------------------------ the clock
  tick(now) {
    const s = this.s;
    if (!this.minds.size) return;
    const ph = s.phase;
    const h = this.human();
    if (h && !h.alive && ['night', 'day', 'vote'].includes(ph) && now > (this.ghostAt || 0)) {
      this.ghostAt = now + rand(25000, 50000);
      const ghosts = this.bots().filter(b => !b.alive);
      if (ghosts.length && chance(0.7)) {
        const joker = this.alive().find(p => p.role === 'mafia');
        this.intend(this.mind(pick(ghosts)), { at: 0.5, ch: 'dead', urg: 1, until: 20, key: joker && chance(0.3) ? 'ghostReveal' : 'ghostChat', vars: { x: joker ? joker.name : '' } });
      }
    }
    for (const m of this.minds.values()) {
      const b = m.p;
      if (!b.alive && ph !== 'lobby') continue;
      if (ph === 'deal' && !b.ready && now >= m.readyAt) s.setReady(b, true);
      else if (ph === 'night') this.nightAct(m, now);
      else if (ph === 'day') this.dayAct(m, now);
      else if (ph === 'vote') this.voteAct(m, now);
    }
    this.speak(now);
  }

  nightAct(m, now) {
    const s = this.s, b = m.p;
    if (!m.nightAt || now < m.nightAt) return;
    m.nightAt = 0;
    const kind = s.actionKind(b);
    if (!kind) return;
    const valid = s.validTargets(b, kind);
    if (!valid.length) return;
    if (kind === 'kill') {
      const h = this.human();
      if (h && h.alive && h.role === 'mafia' && h.action) { if (b.action !== h.action) s.act(b, h.action); return; }
      const mate = this.bots().find(q => q !== b && q.alive && q.role === 'mafia' && q.action);
      if (mate && valid.includes(mate.action)) { s.act(b, mate.action); return; }
      const lead = this.bots().find(q => q.alive && q.role === 'mafia');
      const planned = this.mind(lead)?.planned;
      const target = planned && valid.includes(planned) ? planned : (this.chooseVictim(m) || {}).pid;
      if (target && valid.includes(target)) s.act(b, target);
      // if a human Joker hasn't picked, give them a few more seconds to override before locking in
    } else if (kind === 'inspect') {
      let best = null, bv = -1e9;
      for (const pid of valid) {
        if (m.results.has(pid)) continue;
        const v = this.sus(m, pid) + Math.random() * 0.5 + (this.mem.claims.get(pid)?.role === 'sheriff' ? 1.5 : 0);
        if (v > bv) { bv = v; best = pid; }
      }
      if (best) s.act(b, best);
    } else if (kind === 'save') {
      const W = this.wits;
      let target = null;
      const king = [...this.mem.claims.entries()].find(([pid, c]) => c.role === 'sheriff' && this.claimCred(m, pid) > 0.5 && valid.includes(pid) && this.byId(pid)?.alive);
      if (king && chance(W.angelSmart)) target = king[0];
      else if (valid.includes(b.pid) && m.claimed && chance(0.6)) target = b.pid;
      else {
        let bv = -1e9;
        for (const pid of valid) {
          if (pid === b.pid) continue;
          const v = -this.sus(m, pid) + 0.15 * (this.mem.spokeTotal.get(pid) || 0) + Math.random() * (1.5 - W.angelSmart);
          if (v > bv) { bv = v; target = pid; }
        }
      }
      if (target) { s.act(b, target); m.lastSave = target; m.lastSaveNight = s.day; }
    }
  }

  dayAct(m, now) {
    const s = this.s, b = m.p;
    // ready to vote: late in the day, sooner if the human is ready
    if (!b.ready) {
      const h = this.human();
      const humanReady = h && h.alive && h.ready;
      const elapsed = s.phaseDur - Math.max(0, s.deadline - now);
      if (now >= m.readyAt || (humanReady && elapsed > 18000 && now >= (m.humanReadyAt ||= now + rand(1500, 5000)))) {
        s.setReady(b, true);
        if (chance(0.3)) this.intend(m, { at: 0.5, key: 'readyVote', urg: 1, until: 6 });
        if (s.phase !== 'day') return;
      }
    }
    if (now < m.nextTalk || m.said >= m.maxSay) return;
    m.nextTalk = now + rand(14000, 30000) / (0.6 + m.c.talk);
    if (this.intents.some(i => i.m === m)) return;
    const o = this.opinion(m);
    this.intend(m, { at: 0, until: 12, urg: 1 + m.c.talk, key: o.key, vars: o.vars, effect: o.effect });
    // pressure near the end of the day
    const left = s.deadline - now;
    if (left < 25000 && left > 8000 && chance(0.15)) this.intend(m, { at: 1, key: 'pressure', urg: 2, until: 6 });
  }

  voteAct(m, now) {
    const s = this.s, b = m.p;
    if (!m.voteAt) return;
    if (!m.voted && now >= m.voteAt) {
      const t = this.chooseVote(m);
      m.voted = t;
      s.act(b, t);
      if (t !== 'skip' && chance(0.3 + m.c.talk * 0.3)) this.intend(m, { at: 0.4, key: 'voteFor', vars: { x: this.name(t) }, urg: 2, until: 5 });
      else if (t === 'skip' && chance(0.4)) this.intend(m, { at: 0.4, key: 'voteSkip', urg: 2, until: 5 });
    } else if (m.voted && !m.revoted && now >= m.reAt) {
      m.revoted = true;
      // join a strong bandwagon rather than splitting the vote
      const tally = {};
      for (const [, t] of this.mem.votes) if (t && t !== 'skip') tally[t] = (tally[t] || 0) + 1;
      const lead = Object.keys(tally).sort((a, c) => tally[c] - tally[a])[0];
      if (!lead || lead === m.voted || lead === b.pid) return;
      const mine = tally[m.voted] || 0;
      const ok = b.role === 'mafia' ? this.byId(lead)?.role !== 'mafia' : this.sus(m, lead) > -0.2;
      if (ok && tally[lead] >= mine + 2 && chance(0.5 + m.c.trust * 0.3)) {
        m.voted = lead;
        s.act(b, lead);
        if (chance(0.4)) this.intend(m, { at: 0.3, key: 'voteSwitch', vars: { x: this.name(lead) }, urg: 2, until: 5 });
      }
    }
  }

  // one voice at a time, with a typing beat first
  speak(now) {
    const s = this.s;
    if (this.speaking) {
      const sp = this.speaking;
      if (now < sp.at) return;
      this.speaking = null;
      const ch = s.channelFor(sp.m.p);
      if (ch === sp.ch || (sp.ch === 'town' && ch === 'town')) {
        s.chat(sp.m.p, sp.text);
        if (sp.effect) sp.effect();
        sp.m.said++;
      }
      this.floorAt = now + rand(1500, 3400) * (s.phase === 'night' ? 0.7 : 1);
      return;
    }
    if (now < this.floorAt) return;
    if (now < this.humanTypingUntil) return;
    this.intents = this.intents.filter(i => now <= i.until && (i.m.p.alive || i.ch === 'dead' || s.phase === 'lobby' || s.phase === 'over'));
    let best = null;
    for (const i of this.intents) {
      if (now < i.at) continue;
      if (s.channelFor(i.m.p) !== i.ch && !(s.phase === 'over' && i.ch === 'town')) continue;
      if (!best || i.urg > best.urg) best = i;
    }
    if (!best) return;
    this.intents.splice(this.intents.indexOf(best), 1);
    const text = best.make ? best.make() : this.line(best.m, best.key, best.vars || {});
    if (!text) return;
    s.typing(best.m.p, true);
    this.speaking = { m: best.m, text, ch: best.ch, effect: best.effect, at: now + clamp(500 + text.length * 22, 700, 2400) };
  }
}
