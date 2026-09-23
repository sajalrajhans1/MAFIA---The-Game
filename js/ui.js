// DOM side of the game: screens, lobby, HUD, chat, 3D name tags, overlays and modals.
import { ROLES, cardLabel, drawCardFace, drawCardBack } from './cards.js';
import { SUIT_COLORS, SKIN_COLORS, HAIR_COLORS, HAT_COLORS } from './characters.js';
import { LOOK_OPTIONS, lookName } from './looks.js';
import { audio } from './audio.js';

const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = n => '#' + n.toString(16).padStart(6, '0');

export const SEAT_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f78fb3', '#c77dff', '#9bd770', '#f9844a', '#e9c46a', '#a8dadc', '#ff99c8', '#b8b8ff'];
export const colorOf = p => SEAT_COLORS[(p?.seat ?? 0) % SEAT_COLORS.length];

const urlCache = new Map();
export function cardURL(card) {
  const k = card ? card.rank + (card.suit || '') : 'back';
  if (!urlCache.has(k)) urlCache.set(k, (card ? drawCardFace(card) : drawCardBack()).toDataURL('image/jpeg', 0.88));
  return urlCache.get(k);
}
export function clearCardURLs() { urlCache.clear(); }

// swatches for the colour rows of the wardrobe
const LOOK_SWATCH = { suit: SUIT_COLORS, hatColor: HAT_COLORS, hairColor: HAIR_COLORS, skin: SKIN_COLORS };
const WARDROBE_TABS = {
  suit: ['suit', 'pattern', 'tie', 'extra'],
  head: ['hat', 'hatColor', 'hair', 'hairColor'],
  face: ['skin', 'eyes', 'eyeColor', 'facial', 'mouth', 'wear'],
};
const WITS_HINT = [
  'Rookies: trusting, chatty, easy to fool. A gentle night out.',
  'Wiseguys: they read the votes and remember who lied. A fair fight.',
  'Masterminds: sharp Kings, bold bluffs, cold Jokers. Bring your best.',
];

const PHASE_TITLES = {
  lobby: ['LOBBY', ''], deal: ['THE DEAL', 'Look at your card. Keep it secret.'],
  night: ['NIGHT', ''], dawn: ['DAWN', 'The sun comes up over the city...'],
  day: ['DAY', 'Talk it out. Find the Jokers.'], vote: ['THE VOTE', 'Click a player to accuse them, or skip.'],
  lastwords: ['LAST WORDS', ''], verdict: ['VERDICT', ''], over: ['GAME OVER', ''],
};

export class UI {
  constructor(actions) {
    this.a = actions;
    this.tags = new Map();
    this.marks = new Map(); // private suspicion marks: pid -> 'sus' | 'ok'
    this.view = null;
    this.deadline = 0;
    this.lastTickSec = -1;
    this.announceTimer = null;
    this.revealState = null;
    this.uiScale = 1;
    this.bindStatic();
    this.applyScale();
    window.addEventListener('resize', () => this.applyScale());
  }

  // Big screens: scale the whole interface up (the layout is designed around ~1700x950 and
  // smaller windows are handled by CSS media queries). Name tags scale with it.
  applyScale() {
    let z = 1;
    if (window.CSS && CSS.supports && CSS.supports('zoom', '1.5')) {
      z = Math.min(1.8, Math.max(1, Math.min(window.innerWidth / 1700, window.innerHeight / 950)));
      z = Math.round(z * 20) / 20;
    }
    if (z === this.uiScale) return;
    this.uiScale = z;
    document.documentElement.style.setProperty('--z', String(z));
    for (const id of ['app', 'tags']) $(id).style.zoom = z === 1 ? '' : String(z);
    this._bounds = null;
  }

  // ------------------------------------------------------------ plumbing
  bindStatic() {
    const a = this.a;
    const click = (id, fn) => $(id).addEventListener('click', e => { audio.init(); audio.sfx('click'); fn(e); });
    click('btnSolo', () => a.solo());
    click('btnFriends', () => a.friends());
    click('btnRejoin', () => a.rejoin());
    click('btnWardrobe', () => a.wardrobe());
    click('btnWardrobe2', () => a.wardrobe());
    click('lookSlot', () => a.wardrobe());
    click('btnHow', () => { this.showHow(); $('btnHow').classList.remove('pulse'); try { localStorage.setItem('mafia.readHow', '1'); } catch { /* ignore */ } });
    try { if (!localStorage.getItem('mafia.readHow')) $('btnHow').classList.add('pulse'); } catch { /* ignore */ }
    click('btnHow2', () => this.showHow());
    click('btnOpts', () => this.showOptions());
    click('btnOpts2', () => this.showOptions());
    click('btnLeave', () => {
      const v = this.view;
      const text = v?.solo ? (v.phase === 'lobby' ? 'Back to the title screen.' : 'This game will be lost.') : v?.me?.isHost ? 'You are the host. Leaving closes the room for everyone.' : 'You can rejoin with the same code while the game lasts.';
      this.confirm('LEAVE THE TABLE?', text, 'LEAVE', () => a.leave());
    });
    click('btnMute', () => { const m = audio.toggleMute(); $('btnMute').classList.toggle('off', m); });
    $('btnMute').classList.toggle('off', audio.settings.muted);
    click('btnCopy', () => a.copyInvite());
    click('btnStart', () => a.start());
    click('btnSkip', () => a.skip());
    click('btnReady', () => { a.ready(true); this.closeReveal(); });
    click('btnCloseReveal', () => this.closeReveal());
    click('btnAgain', () => (this.view?.solo ? a.playAgain() : a.toLobby()));
    click('btnGoView', () => $('gameover').classList.add('hidden'));
    click('btnGoLeave', () => a.leave());
    $('myCardImg').addEventListener('click', () => { audio.sfx('flip'); a.viewCard(); });
    $('flipCard').addEventListener('click', () => this.flipReveal());
    document.querySelectorAll('#soloCard [data-bots]').forEach(b => b.addEventListener('click', () => { audio.sfx('hover'); a.setBots(this.view.players.filter(p => p.bot).length + +b.dataset.bots); }));
    document.querySelectorAll('#wits [data-wits]').forEach(b => b.addEventListener('click', () => { audio.sfx('select'); a.settings({ wits: +b.dataset.wits }); }));
    this.bindWardrobe();
    document.querySelectorAll('#settingsPanel .arrow').forEach(b => b.addEventListener('click', () => { audio.sfx('hover'); this.stepSetting(b.dataset.set, +b.dataset.d); }));
    document.querySelectorAll('#settingsPanel .toggle').forEach(b => b.addEventListener('click', () => { audio.sfx('select'); const k = b.dataset.set; a.settings({ [k]: !this.view.settings[k] }); }));
    document.querySelectorAll('#emotes .emote').forEach(b => b.addEventListener('click', () => { audio.sfx('hover'); a.emote(b.dataset.e); }));
    $('nameIn').addEventListener('input', () => a.setName($('nameIn').value));
    $('chatForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('chatIn').value.trim();
      if (!v) return;
      a.chat(v);
      $('chatIn').value = '';
    });
    let lastType = 0;
    $('chatIn').addEventListener('input', () => { const t = Date.now(); if (t - lastType > 1200) { lastType = t; a.typing(); } });
    $('chatMin').addEventListener('click', () => $('chat').classList.toggle('min'));
    document.addEventListener('keydown', e => {
      const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if (e.key === 'Escape') {
        if (!$('modal').classList.contains('hidden')) this.closeModal();
        else if (this.wd) this.closeWardrobe();
        else if (!$('reveal').classList.contains('hidden') && !$('btnCloseReveal').classList.contains('hidden')) this.closeReveal();
        if (typing) document.activeElement.blur();
        return;
      }
      if (typing) return;
      if ((e.key === 'Enter' || e.key === 't' || e.key === 'T') && !$('chat').classList.contains('hidden') && !$('chatIn').disabled) {
        e.preventDefault();
        $('chat').classList.remove('min');
        $('chatIn').focus();
      }
      if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('hud-hidden');
    });
    document.addEventListener('pointerdown', () => audio.init(), { once: false, passive: true });
  }

  screen(name) {
    for (const s of ['title', 'lobby', 'hud']) $(s).classList.toggle('active', s === name);
    document.body.classList.toggle('in-game', name === 'hud');
    document.body.classList.toggle('in-lobby', name === 'lobby');
    $('topbar').classList.toggle('hidden', name === 'title');
    $('chat').classList.toggle('hidden', name === 'title');
    $('tags').classList.toggle('hidden', name === 'title');
    this.current = name;
  }

  loading(on, text = 'CONNECTING...') { $('loading').classList.toggle('hidden', !on); $('loadingText').textContent = text; }

  toast(text, bad = false) {
    const d = document.createElement('div');
    d.className = 'toast' + (bad ? ' bad' : '');
    d.textContent = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), 3500);
  }

  // --------------------------------------------------------------- title
  renderIdentity(name, look) {
    if (document.activeElement !== $('nameIn')) $('nameIn').value = name;
    $('lookSum').innerHTML = describeLook(look).map(t => `<div>${esc(t)}</div>`).join('');
    if (this.wd) this.renderWardrobe();
  }

  setRejoin(info) {
    $('btnRejoin').classList.toggle('hidden', !info);
    if (info) $('btnRejoin').textContent = `REJOIN ROOM ${info.code}`;
  }

  // ------------------------------------------------------------- wardrobe
  bindWardrobe() {
    this.wdTab = 'suit';
    $('wdTabs').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { audio.sfx('hover'); this.wdTab = b.dataset.tab; this.renderWardrobe(); }));
    $('wdStage').querySelectorAll('[data-frame]').forEach(b => b.addEventListener('click', () => { audio.sfx('hover'); this.a.wardrobeFrame(b.dataset.frame); this.markFrame(b.dataset.frame); }));
    $('wdRandom').addEventListener('click', () => { audio.sfx('deal'); this.a.lookRandom(); });
    $('wdUndo').addEventListener('click', () => { audio.sfx('click'); this.a.lookUndo(); });
    $('wdDone').addEventListener('click', () => { audio.sfx('click'); this.closeWardrobe(); });
    $('wardrobe').addEventListener('pointerdown', e => { if (e.target === $('wardrobe')) this.closeWardrobe(); });
  }

  openWardrobe(getLook, name, frame) {
    this.wd = { getLook, name };
    $('wdName').textContent = name ? `Dressing ${name}` : '';
    $('wardrobe').classList.remove('hidden');
    this.markFrame(frame);
    this.renderWardrobe();
  }

  markFrame(f) { $('wdStage').querySelectorAll('[data-frame]').forEach(b => b.classList.toggle('on', b.dataset.frame === f)); }

  wardrobeOpen() { return !!this.wd; }

  closeWardrobe() {
    if (!this.wd) return;
    this.wd = null;
    $('wardrobe').classList.add('hidden');
    this.a.wardrobeClosed();
  }

  renderWardrobe() {
    if (!this.wd) return;
    const look = this.wd.getLook();
    $('wdTabs').querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === this.wdTab));
    const rows = $('wdRows');
    rows.innerHTML = '';
    for (const key of WARDROBE_TABS[this.wdTab]) {
      const o = LOOK_OPTIONS.find(x => x.key === key);
      const row = document.createElement('div');
      row.className = 'wd-row';
      const off = key === 'hatColor' && look.hat === 4;
      if (off) row.classList.add('off');
      const sw = LOOK_SWATCH[key];
      row.innerHTML = `<div class="wd-label">${o.label}</div>
        <div class="wd-pick"><button class="arrow" data-d="-1" aria-label="Previous ${o.label}">◀</button><span class="wd-val">${sw ? `<i class="swatch" style="background:${hex(sw[look[key]])}"></i>` : ''}${esc(o.names[look[key]])}</span><button class="arrow" data-d="1" aria-label="Next ${o.label}">▶</button></div>
        ${sw ? `<div class="wd-swatches">${sw.map((c, i) => `<button class="${i === look[key] ? 'on' : ''}" data-i="${i}" title="${esc(o.names[i])}" style="background:${hex(c)}"></button>`).join('')}</div>` : `<div class="wd-dots">${o.names.map((n, i) => `<button class="${i === look[key] ? 'on' : ''}" data-i="${i}" title="${esc(n)}"></button>`).join('')}</div>`}`;
      row.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { audio.sfx('hover'); this.a.lookStep(key, +b.dataset.d); }));
      row.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { audio.sfx('hover'); this.a.lookSet(key, +b.dataset.i); }));
      rows.appendChild(row);
    }
  }

  // ---------------------------------------------------------------- render
  // fresh = a new state from the host; local re-renders must not rewind the clock
  render(v, prev, fresh = true) {
    if (fresh) this.deadline = performance.now() + (v.timeLeft || 0);
    this.view = v;
    if (v.phase === 'lobby') this.renderLobby(v);
    else this.renderGame(v, prev);
    this.renderChatChannel(v);
    this.syncTags(v);
    $('btnSkip').classList.toggle('hidden', !(v.me.isHost && !['lobby', 'over'].includes(v.phase)));
    $('btnSkip').title = v.solo ? 'Skip to the next phase' : 'Host: skip to the next phase';
    $('roomTag').textContent = v.solo ? '' : `ROOM ${v.code}`;
  }

  renderLobby(v) {
    const me = v.me;
    $('soloCard').classList.toggle('hidden', !v.solo);
    $('roomCard').classList.toggle('hidden', !!v.solo);
    if (v.solo) {
      const nb = v.players.filter(p => p.bot).length;
      $('setBots').textContent = nb;
      $('soloCard').querySelector('[data-bots="-1"]').disabled = nb <= 3;
      $('soloCard').querySelector('[data-bots="1"]').disabled = nb >= 11;
      const w = v.settings.wits ?? 1;
      $('wits').querySelectorAll('[data-wits]').forEach(b => b.classList.toggle('on', +b.dataset.wits === w));
      $('witsHint').textContent = WITS_HINT[w];
    } else {
      $('roomCode').textContent = v.code;
      $('roomMode').textContent = 'Share the code or the link with friends';
    }
    $('lobbyCount').textContent = v.solo ? `${v.players.length}` : `${v.players.length}/12`;
    const ul = $('lobbyRoster');
    ul.innerHTML = '';
    for (const p of v.players) {
      const li = document.createElement('li');
      if (p.pid === me.pid) li.classList.add('me');
      if (!p.connected) li.classList.add('off');
      li.innerHTML = `<i class="dot" style="background:${colorOf(p)}"></i>
        <span class="nm">${p.isHost && !v.solo ? '<span class="crown">♛</span> ' : ''}${esc(p.name)}${p.pid === me.pid ? '<span class="tagx">YOU</span>' : ''}${p.title ? `<span class="ttl">${esc(p.title)}</span>` : ''}${!p.connected ? '<span class="tagx">AWAY</span>' : ''}</span>
        <span class="right">${me.isHost && !p.isHost && !v.solo ? `<button class="kick" data-kick="${p.pid}">KICK</button>` : ''}</span>`;
      ul.appendChild(li);
    }
    ul.querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', () => { audio.sfx('click'); this.a.kick(b.dataset.kick); }));

    // settings
    const S = v.settings, n = v.players.length;
    const panel = $('settingsPanel');
    panel.classList.toggle('readonly', !me.isHost);
    $('settingsWho').textContent = v.solo ? '' : me.isHost ? 'you set the rules' : 'set by the host';
    $('setMafia').textContent = S.mafia;
    $('setDay').textContent = fmtTime(S.dayTime);
    $('setVote').textContent = fmtTime(S.voteTime);
    $('setNight').textContent = fmtTime(S.nightTime);
    panel.querySelectorAll('.toggle').forEach(b => b.classList.toggle('on', !!S[b.dataset.set]));
    const max = Math.max(1, Math.floor((Math.max(n, 4) - 1) / 2));
    const rec = Math.max(1, Math.round((Math.max(n, 4) - 1) / 4));
    const bal = $('balance');
    bal.className = 'balance';
    if (n < 4) bal.textContent = `Waiting for ${4 - n} more player${4 - n > 1 ? 's' : ''} (4 needed to deal).`;
    else if (S.mafia > max) { bal.textContent = `Too many Jokers for ${n} players (max ${max}).`; bal.classList.add('warn'); }
    else if (S.mafia === rec) { bal.textContent = `Balanced for ${n} players.`; bal.classList.add('good'); }
    else if (S.mafia > rec) { bal.textContent = `Mafia-favoured. ${rec} recommended for ${n}.`; bal.classList.add('warn'); }
    else bal.textContent = `Town-favoured. ${rec} recommended for ${n}.`;
    const civ = Math.max(0, n - S.mafia - (S.sheriff ? 1 : 0) - (S.angel ? 1 : 0));
    $('deckLine').innerHTML = `Deck: <span class="j">${S.mafia} Joker${S.mafia > 1 ? 's' : ''}</span>${S.sheriff ? ', <span class="k">1 King</span>' : ''}${S.angel ? ', <span class="a">1 Ace</span>' : ''}, ${civ} number card${civ === 1 ? '' : 's'}`;
    $('btnStart').classList.toggle('hidden', !me.isHost);
    $('lobbyWait').classList.toggle('hidden', me.isHost);
    $('btnStart').disabled = n < 4 || S.mafia > max;
    $('btnStart').classList.toggle('pulse', n >= 4 && S.mafia <= max);
  }

  stepSetting(key, d) {
    const S = this.view.settings;
    const steps = { dayTime: [45, 60, 90, 120, 150, 180, 240, 300, 420, 600], voteTime: [20, 30, 45, 60, 90, 120], nightTime: [20, 30, 40, 60, 90, 120] };
    if (key === 'mafia') return this.a.settings({ mafia: Math.max(1, Math.min(5, S.mafia + d)) });
    const arr = steps[key];
    let i = arr.findIndex(x => x >= S[key]);
    if (i < 0) i = arr.length - 1;
    i = Math.max(0, Math.min(arr.length - 1, i + d));
    this.a.settings({ [key]: arr[i] });
  }

  renderGame(v, prev) {
    const me = v.me;
    const byId = pid => v.players.find(p => p.pid === pid);
    // banner
    const [t0, s0] = PHASE_TITLES[v.phase] || ['', ''];
    let title = t0, sub = s0;
    if (v.phase === 'night') { title = `NIGHT ${v.day}`; sub = !me.alive ? 'You watch from beyond. Who will they choose?' : me.role === 'mafia' ? 'Jokers, open your eyes. Choose a victim together.' : me.role === 'sheriff' ? 'King, open your eyes. Investigate someone.' : me.role === 'angel' ? 'Ace, open your eyes. Protect someone.' : 'The town sleeps...'; }
    if (v.phase === 'day') title = `DAY ${v.day}`;
    if (v.phase === 'lastwords') { const a = byId(v.accused); sub = a ? `${a.name} has been condemned. Last words...` : ''; }
    if (v.phase === 'verdict' || v.phase === 'dawn') sub = v.announce ? v.announce.text : sub;
    if (v.phase === 'over') sub = v.announce ? v.announce.title : '';
    $('phaseName').textContent = title;
    $('phaseSub').textContent = sub;
    $('phaseBanner').className = 'phase-banner ' + v.phase;
    $('timerBar').parentElement.parentElement.classList.toggle('hidden', !v.duration);

    // my card
    const role = me.role && ROLES[me.role];
    $('myCardImg').style.backgroundImage = `url(${cardURL(me.card)})`;
    $('myRoleName').textContent = role ? `${role.card.toUpperCase()} · ${role.name.toUpperCase()}` : '?';
    $('myRoleName').style.color = role ? role.color : '';
    const hints = { mafia: 'Kill at night. Lie by day.', sheriff: 'Investigate one player each night.', angel: 'Protect one player each night.', civilian: 'Find the Jokers. Vote wisely.' };
    $('myRoleHint').textContent = me.alive ? (hints[me.role] || '') : 'You are dead. Ghosts see all.';
    const notes = [];
    if (me.role === 'mafia') {
      const mates = v.players.filter(p => p.role === 'mafia' && p.pid !== me.pid);
      notes.push(mates.length ? `<div class="note bad">Fellow Jokers: ${mates.map(p => `${esc(p.name)}${p.alive ? '' : ' ☠'}`).join(', ')}</div>` : '<div class="note bad">You are the only Joker.</div>');
    }
    if (me.results && me.results.length && (me.role === 'sheriff' || !me.alive)) {
      notes.push('<div class="label" style="margin-top:6px">INVESTIGATIONS</div>');
      for (const r of me.results) notes.push(`<div class="note ${r.mafia ? 'bad' : 'good'}">N${r.day}: ${esc(r.name)} — ${r.mafia ? 'MAFIA' : 'not Mafia'}</div>`);
    }
    if (me.role === 'angel' && me.angelLast && me.alive) { const p = byId(me.angelLast); if (p) notes.push(`<div class="note good">Protected last night: ${p.pid === me.pid ? 'yourself' : esc(p.name)} (not again tonight)</div>`); }
    $('myNotes').innerHTML = notes.join('');

    // roster
    const alive = v.players.filter(p => p.alive).length;
    $('aliveCount').textContent = `${alive} alive`;
    const tally = {};
    for (const p of v.players) if (p.vote && p.vote !== 'skip') tally[p.vote] = (tally[p.vote] || 0) + 1;
    const targets = new Set(me.targets || []);
    const sel = me.actionKind === 'vote' ? me.vote : me.action;
    const ul = $('gameRoster');
    ul.innerHTML = '';
    for (const p of v.players) {
      const li = document.createElement('li');
      const r = p.role && ROLES[p.role];
      li.className = [p.alive ? '' : 'dead', p.pid === me.pid ? 'me' : '', targets.has(p.pid) ? 'target' : '', sel === p.pid ? 'sel' : '', p.connected ? '' : 'off'].join(' ');
      const status = [];
      if (!p.alive) status.push('☠');
      if (p.ready && (v.phase === 'day' || v.phase === 'deal')) status.push('<span style="color:var(--green)">✓</span>');
      if (p.vote === 'skip') status.push('<span class="tagx">SKIP</span>');
      if (p.nightPick && p.role === 'mafia') { const tg = byId(p.nightPick); if (tg) status.push(`<span style="color:#ff6a70">→${esc(tg.name)}</span>`); }
      li.innerHTML = `<i class="dot" style="background:${colorOf(p)}"></i>
        <span class="nm">${this.markHTML(p.pid)}${p.isHost && !v.solo ? '<span class="crown">♛</span> ' : ''}${esc(p.name)}${p.pid === me.pid ? '<span class="tagx">YOU</span>' : ''}${!p.connected ? '<span class="tagx">AWAY</span>' : ''}</span>
        <span class="right">${status.join(' ')}${r && (p.pid !== me.pid) ? `<span class="role-chip" style="color:${r.color}">${cardLabel(p.card)}</span>` : ''}${tally[p.pid] ? `<span class="votes">${tally[p.pid]}</span>` : ''}${me.isHost && !p.isHost && p.alive && !p.connected ? `<button class="kick" data-kick="${p.pid}" title="Remove player who left">✕</button>` : ''}</span>`;
      li.addEventListener('click', ev => {
        if (ev.target.dataset.kick) return;
        if (targets.has(p.pid)) this.a.pick(p.pid);
        else this.a.lookAt(p.pid);
      });
      li.addEventListener('contextmenu', ev => { ev.preventDefault(); this.cycleMark(p.pid); });
      ul.appendChild(li);
    }
    ul.querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', () => this.confirm('REMOVE PLAYER?', 'They will be treated as dead (they walked out). Use this if a friend left for good.', 'REMOVE', () => this.a.kick(b.dataset.kick))));

    this.renderActions(v);
    const talkPhase = ['day', 'vote', 'dawn', 'verdict', 'deal', 'over'].includes(v.phase);
    $('emotes').classList.toggle('hidden', !(me.alive && talkPhase));
  }

  renderActions(v) {
    const me = v.me, A = this.a;
    const byId = pid => v.players.find(p => p.pid === pid);
    const txt = $('actionText'), btns = $('actionBtns');
    btns.innerHTML = '';
    const button = (label, fn, cls = '') => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.textContent = label;
      b.addEventListener('click', () => { audio.sfx('click'); fn(); });
      btns.appendChild(b);
      return b;
    };
    let t = '';
    const name = pid => { const p = byId(pid); return p ? esc(p.name) : '?'; };
    switch (v.phase) {
      case 'deal':
        t = me.ready ? `Waiting for the others... <b>${v.readyCount}/${v.players.length}</b> ready` : 'Look at your card, then get ready.';
        button('VIEW MY CARD', () => A.viewCard(), me.ready ? '' : 'primary pulse');
        if (!me.ready) button("I'M READY", () => A.ready(true));
        break;
      case 'night':
        if (!me.alive) t = 'Ghosts see everything. Watch the night unfold.';
        else if (me.role === 'mafia') {
          const mates = v.players.filter(p => p.role === 'mafia' && p.alive && p.pid !== me.pid && p.nightPick);
          t = me.action ? `Your target: <span class="kill">${name(me.action)}</span>` : '<span class="kill">Click a player to mark tonight\'s victim.</span><br><small>No pick by dawn = a random victim.</small>';
          if (mates.length) t += `<br><small>${mates.map(p => `${esc(p.name)} → ${name(p.nightPick)}`).join(' · ')}</small>`;
          if (me.action) button('CLEAR', () => A.pick(null));
        } else if (me.role === 'sheriff') {
          t = me.action ? `You investigated <span class="inspect">${name(me.action)}</span>. Result in your notes.` : '<span class="inspect">Click a player to investigate them.</span> The answer is instant — choose well.';
        } else if (me.role === 'angel') {
          t = me.action ? `You are protecting <span class="save">${name(me.action)}</span>.` : '<span class="save">Click a player to protect them tonight.</span>';
          if (me.targets.includes(me.pid) && me.action !== me.pid) button('PROTECT MYSELF', () => A.pick(me.pid));
          if (me.action) button('CLEAR', () => A.pick(null));
        } else t = '';
        break;
      case 'day': {
        if (!me.alive) { t = 'You are a ghost. Only the dead can hear you.'; break; }
        t = `Discuss. When enough of you are ready, voting begins early. <b>${v.readyCount}/${v.readyNeed}</b>`;
        button(me.ready ? 'NOT READY' : 'READY TO VOTE', () => A.ready(!me.ready), me.ready ? 'on' : '');
        break;
      }
      case 'vote':
        if (!me.alive) { t = 'The living are voting.'; break; }
        t = me.vote === 'skip' ? 'You voted to <b>skip</b>. Click a player to change.' : me.vote ? `You accuse <span class="kill">${name(me.vote)}</span>. Click someone else to change.` : 'Click a player to accuse them.';
        button('SKIP VOTE', () => A.pick('skip'), me.vote === 'skip' ? 'on' : '');
        if (me.vote) button('CLEAR', () => A.pick(null));
        break;
      case 'lastwords':
        t = v.accused === me.pid ? '<span class="kill">You have been condemned. Say your last words in the chat.</span>' : `Silence. <b>${name(v.accused)}</b> speaks their last words.`;
        break;
      case 'over':
        t = '';
        if (v.solo) button('PLAY AGAIN', () => A.playAgain(), 'primary');
        else if (me.isHost) button('BACK TO LOBBY', () => A.toLobby(), 'primary');
        button('RESULTS', () => this.showGameOver(v));
        break;
      default: t = '';
    }
    txt.innerHTML = t;
  }

  // ------------------------------------------------------------------ chat
  renderChatChannel(v) {
    const ch = v.me.channel;
    const el = $('chatChan'), inp = $('chatIn');
    el.className = 'chan';
    if (ch === 'mafia') { el.textContent = 'MAFIA · SECRET'; el.classList.add('mafia'); inp.placeholder = 'Whisper to your fellow Jokers...'; }
    else if (ch === 'dead') { el.textContent = 'GRAVEYARD'; el.classList.add('dead'); inp.placeholder = 'Only the dead can hear you...'; }
    else if (ch === 'town') { el.textContent = v.phase === 'lobby' ? 'LOBBY' : 'TOWN'; inp.placeholder = v.phase === 'lastwords' ? 'Your last words...' : 'Say something...'; }
    else { el.textContent = v.phase === 'night' ? 'ASLEEP' : 'SILENCE'; el.classList.add('mute'); inp.placeholder = v.phase === 'night' ? 'Shh... you are asleep.' : 'Only the condemned may speak.'; }
    inp.disabled = !ch;
    if (!ch && document.activeElement === inp) inp.blur();
  }

  clearChat() { $('chatLog').innerHTML = ''; }

  addChat(m, v) {
    const log = $('chatLog');
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    const d = document.createElement('div');
    d.className = 'msg ' + m.ch + (m.kind ? ' ' + m.kind : '');
    const p = v && m.pid ? v.players.find(q => q.pid === m.pid) : null;
    if (m.ch === 'sys' || m.ch === 'priv') d.textContent = m.text;
    else {
      const tag = m.ch === 'mafia' ? '<span class="tag">[MAFIA]</span>' : m.ch === 'dead' ? '<span class="tag">[DEAD]</span>' : '';
      d.innerHTML = `${tag}<span class="who" style="color:${p ? colorOf(p) : '#ccc'}">${esc(m.name)}:</span>${esc(m.text)}`;
    }
    log.appendChild(d);
    while (log.children.length > 220) log.firstChild.remove();
    if (near || m.pid === v?.me?.pid) log.scrollTop = log.scrollHeight;
  }

  cycleMark(pid) {
    if (!this.view || pid === this.view.me.pid) return;
    const cur = this.marks.get(pid);
    if (!cur) this.marks.set(pid, 'sus');
    else if (cur === 'sus') this.marks.set(pid, 'ok');
    else this.marks.delete(pid);
    audio.sfx('hover');
    this.a.rerender();
  }

  markHTML(pid) {
    const m = this.marks.get(pid);
    return m === 'sus' ? '<span class="mk sus" title="You suspect them">?</span>' : m === 'ok' ? '<span class="mk ok" title="You trust them">✓</span>' : '';
  }

  // ------------------------------------------------------------ name tags
  syncTags(v) {
    const keep = new Set();
    const me = v.me;
    const tally = {};
    for (const p of v.players) if (p.vote && p.vote !== 'skip') tally[p.vote] = (tally[p.vote] || 0) + 1;
    const targets = new Set(me.targets || []);
    const sel = me.actionKind === 'vote' ? me.vote : me.action;
    for (const p of v.players) {
      if (p.pid === me.pid) continue;
      keep.add(p.pid);
      let t = this.tags.get(p.pid);
      if (!t) {
        const el = document.createElement('div');
        el.className = 'tag3d';
        el.innerHTML = '<div class="bubble hidden"></div><div class="typing hidden">...</div><div class="emo hidden"></div><div class="plate"></div>';
        el.addEventListener('click', () => {
          if (this.tagTargets?.has(p.pid)) this.a.pick(p.pid);
          else if (el.classList.contains('edge-l') || el.classList.contains('edge-r')) { audio.sfx('hover'); this.a.lookAt(p.pid); }
        });
        el.addEventListener('contextmenu', e => { e.preventDefault(); this.cycleMark(p.pid); });
        $('tags').appendChild(el);
        t = { el, bubble: el.children[0], typing: el.children[1], emo: el.children[2], plate: el.children[3], bubbleUntil: 0, typingUntil: 0, emoUntil: 0 };
        this.tags.set(p.pid, t);
      }
      const r = v.phase !== 'lobby' && p.role && ROLES[p.role];
      const sleeping = v.phase === 'night' && p.alive && !(p.role === 'mafia' && (me.role === 'mafia' || !me.alive));
      t.plate.innerHTML = `${this.markHTML(p.pid)}${p.isHost && !v.solo ? '<span class="crown">♛</span>' : ''}<span style="color:${colorOf(p)}">${esc(p.name)}</span>${!p.alive ? ' ☠' : ''}${sleeping ? ' <span style="color:#7fa8e0">z</span>' : ''}${r ? ` <span class="rc" style="color:${r.color}">${cardLabel(p.card)}</span>` : ''}${tally[p.pid] ? ` <span class="vc">${tally[p.pid]}</span>` : ''}`;
      t.el.className = 'tag3d' + (p.alive ? '' : ' dead') + (p.connected ? '' : ' off') + (targets.has(p.pid) ? ' target' : '') + (sel === p.pid ? ' sel' : '');
    }
    this.tagTargets = targets;
    for (const [pid, t] of this.tags) if (!keep.has(pid)) { t.el.remove(); this.tags.delete(pid); }
  }

  clearTags() { for (const t of this.tags.values()) t.el.remove(); this.tags.clear(); }

  bubble(pid, text, ch) {
    const t = this.tags.get(pid);
    if (!t) return;
    t.bubble.textContent = text.length > 120 ? text.slice(0, 117) + '...' : text;
    t.bubble.className = 'bubble' + (ch === 'mafia' ? ' mafia' : ch === 'dead' ? ' dead' : '');
    t.bubbleUntil = performance.now() + 2600 + Math.min(6000, text.length * 70);
    t.typingUntil = 0;
  }

  typing(pid) { const t = this.tags.get(pid); if (t) t.typingUntil = performance.now() + 2500; }

  emoteTag(pid, e, targetName) {
    const t = this.tags.get(pid);
    if (!t) return;
    t.emo.textContent = e === 'point' && targetName ? `POINTS AT ${targetName.toUpperCase()}` : ({ nod: 'NODS', shake: 'SHAKES HEAD', shrug: 'SHRUGS', suspicious: 'LOOKS SUSPICIOUS', point: 'POINTS' }[e] || e);
    t.emoUntil = performance.now() + 1800;
  }

  positionTags(proj) {
    const now = performance.now();
    const W = window.innerWidth, H = window.innerHeight;
    const z = this.uiScale || 1; // tags live in the scaled layer: window pixels divide by the scale
    // in first person, pin off-screen players to the edges of the open 3D area
    const fp = this.current === 'hud';
    let lb = 0, rb = W;
    if (fp) {
      // panel edges change rarely: re-measure twice a second, not every frame (avoids forced layouts)
      if (!this._bounds || now - this._bounds.t > 500) {
        const cl = document.querySelector('#hud .col-left'), ch = $('chat');
        const hidden = document.body.classList.contains('hud-hidden');
        this._bounds = {
          t: now,
          l: cl && W > 820 && !hidden ? cl.getBoundingClientRect().right : 0,
          // wide: stop at the chat panel; narrow: stop at the column of icon buttons on the right
          r: ch && W > 820 && !ch.classList.contains('min') && !hidden ? ch.getBoundingClientRect().left
            : W <= 820 && !$('topbar').classList.contains('hidden') ? $('topbar').getBoundingClientRect().left - 4 : W,
        };
      }
      lb = this._bounds.l; rb = this._bounds.r;
    }
    const edges = { l: [], r: [] };
    for (const [pid, t] of this.tags) {
      const p = proj[pid];
      if (!p) { t.el.style.display = 'none'; continue; }
      t.el.style.display = '';
      let edge = fp ? p.edge : null;
      if (fp && !edge && p.x < lb + 40) edge = 'l';
      if (fp && !edge && p.x > rb - 40) edge = 'r';
      if (!fp && (p.edge || p.x < 0 || p.x > W)) { t.el.style.display = 'none'; continue; }
      t.bubble.classList.toggle('hidden', now > t.bubbleUntil);
      t.typing.classList.toggle('hidden', now > t.typingUntil || now < t.bubbleUntil);
      t.emo.classList.toggle('hidden', now > t.emoUntil);
      t.el.classList.toggle('edge-l', edge === 'l');
      t.el.classList.toggle('edge-r', edge === 'r');
      if (edge) { edges[edge].push({ t, p }); continue; }
      const s = Math.max(0.72, Math.min(1.08, 3.2 / p.d));
      t.el.style.transform = `translate(${(p.x / z).toFixed(1)}px, ${(p.y / z).toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
      t.el.style.zIndex = String(1000 - Math.round(p.d * 100));
    }
    for (const side of ['l', 'r']) {
      const list = edges[side].sort((a, b) => Math.abs(a.p.ang) - Math.abs(b.p.ang));
      list.forEach(({ t }, i) => {
        const y = (H * 0.3) / z + i * 34;
        const x = (side === 'l' ? lb + 10 : rb - 10) / z;
        t.el.style.transform = `translate(${x}px, ${y}px) translate(${side === 'l' ? '0' : '-100%'}, -50%)`;
        t.el.style.zIndex = String(2000 - i);
      });
    }
  }

  // timer display (called every frame)
  frame() {
    const v = this.view;
    if (!v || v.phase === 'lobby') return;
    const left = Math.max(0, this.deadline - performance.now());
    const sec = Math.ceil(left / 1000);
    // touch the DOM only when something visible changes
    const txt = v.duration ? fmtClock(sec) : '';
    if (txt !== this._timerTxt) { this._timerTxt = txt; $('timer').textContent = txt; }
    const pct = v.duration ? Math.round(Math.max(0, Math.min(100, (left / v.duration) * 100)) * 4) / 4 : 0;
    if (pct !== this._timerPct) { this._timerPct = pct; $('timerBar').style.width = pct + '%'; }
    const urgent = v.duration && sec <= 10 && ['night', 'day', 'vote', 'deal'].includes(v.phase);
    $('timer').classList.toggle('urgent', !!urgent);
    if (urgent && sec !== this.lastTickSec && sec > 0 && ['vote', 'night', 'day'].includes(v.phase) && sec <= 5) audio.sfx('tick');
    this.lastTickSec = sec;
  }

  // ------------------------------------------------------------ overlays
  openReveal({ card, role, mode, mates }) {
    const r = ROLES[role];
    $('flipBack').style.backgroundImage = `url(${cardURL(null)})`;
    $('flipFront').style.backgroundImage = `url(${cardURL(card)})`;
    $('flipCard').classList.remove('flipped');
    $('revealRole').classList.add('hidden');
    $('revealHint').classList.remove('hidden');
    $('revealRoleName').textContent = `${r.card.toUpperCase()} — ${r.name.toUpperCase()}`;
    $('revealRoleName').style.color = r.color;
    $('revealBlurb').textContent = r.blurb;
    $('revealExtra').textContent = role === 'mafia' ? (mates.length ? `Your fellow Jokers: ${mates.join(', ')}` : 'You are the only Joker. Good luck.') : '';
    $('btnReady').classList.add('hidden');
    $('btnCloseReveal').classList.add('hidden');
    this.revealState = { mode };
    $('reveal').classList.remove('hidden');
    if (mode === 'view') this.flipReveal(true);
  }

  flipReveal(instant) {
    const fc = $('flipCard');
    if (fc.classList.contains('flipped')) return;
    fc.classList.add('flipped');
    audio.sfx('flip');
    setTimeout(() => {
      $('revealRole').classList.remove('hidden');
      $('revealHint').classList.add('hidden');
      const deal = this.revealState?.mode === 'deal' && !this.view?.me?.ready;
      $('btnReady').classList.toggle('hidden', !deal);
      $('btnCloseReveal').classList.remove('hidden');
    }, instant ? 50 : 650);
  }

  closeReveal() { $('reveal').classList.add('hidden'); this.a.revealClosed && this.a.revealClosed(); }
  revealOpen() { return !$('reveal').classList.contains('hidden'); }

  announce(ann, ms = 5200) {
    if (!ann) return;
    const el = $('announce');
    el.className = 'announce ' + (ann.kind || '');
    $('announceTitle').textContent = ann.title;
    $('announceText').textContent = ann.text;
    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  hideAnnounce() { $('announce').classList.add('hidden'); }

  sleep(on, text) {
    $('sleep').classList.toggle('hidden', !on);
    $('tags').classList.toggle('asleep', on);
    if (text) $('sleepText').textContent = text;
  }

  youDied() {
    const el = $('youDied');
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 4300);
  }

  showGameOver(v) {
    const win = v.winner;
    $('goTitle').textContent = win === 'town' ? 'THE TOWN WINS' : 'THE MAFIA WINS';
    $('goTitle').className = 'gameover-title ' + win;
    $('goText').textContent = v.announce ? v.announce.text : '';
    const box = $('goCards');
    box.innerHTML = '';
    for (const p of v.players) {
      const r = ROLES[p.role] || ROLES.civilian;
      const won = (r.team === 'mafia') === (win === 'mafia');
      const d = document.createElement('div');
      d.className = 'go-card' + (p.alive ? '' : ' dead') + (won ? ' win' : '');
      d.innerHTML = `<div class="im" style="background-image:url(${cardURL(p.card)})"></div><div style="color:${colorOf(p)}">${esc(p.name)}${p.alive ? '' : ' ☠'}${p.pid === v.me.pid ? ' <span class="you">YOU</span>' : ''}</div><div class="r" style="color:${r.color}">${r.name.toUpperCase()}</div>`;
      box.appendChild(d);
    }
    const host = v.me.isHost;
    $('btnAgain').textContent = v.solo ? 'PLAY AGAIN' : 'BACK TO LOBBY';
    $('btnAgain').classList.toggle('hidden', !host);
    $('goWait').classList.toggle('hidden', host);
    $('gameover').classList.remove('hidden');
  }

  hideGameOver() { $('gameover').classList.add('hidden'); }

  // ---------------------------------------------------------------- modals
  modal(html, onMount) {
    $('modalBox').innerHTML = html;
    $('modal').classList.remove('hidden');
    $('modalBox').querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { audio.sfx('click'); this.closeModal(); }));
    onMount && onMount($('modalBox'));
  }
  closeModal() { $('modal').classList.add('hidden'); $('modalBox').innerHTML = ''; }

  confirm(title, text, ok, fn) {
    this.modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button class="btn primary" id="mOk">${esc(ok)}</button><button class="btn" data-close>CANCEL</button></div>`, box => {
      box.querySelector('#mOk').addEventListener('click', () => { audio.sfx('click'); this.closeModal(); fn(); });
    });
  }

  message(title, text) {
    this.modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button class="btn primary" data-close>OK</button></div>`);
  }

  showFriends(prefill, onCreate, onJoin) {
    this.modal(`<h2>PLAY WITH FRIENDS</h2>
      <div class="friends">
        <div class="fr-col">
          <h3>HOST A TABLE</h3>
          <p>Open a private room and send your friends the code or link. 4 to 12 players.</p>
          <button class="btn big primary" id="mHost">OPEN A ROOM</button>
        </div>
        <div class="fr-col">
          <h3>JOIN A TABLE</h3>
          <p>Got a code from a friend? Type it here.</p>
          <input class="code-input" id="mCode" maxlength="5" placeholder="ABCDE" value="${esc(prefill || '')}" autocomplete="off" spellcheck="false">
          <button class="btn big" id="mJoin">TAKE A SEAT</button>
        </div>
      </div>
      <div class="err" id="mErr"></div>
      <div class="row"><button class="btn" data-close>CANCEL</button></div>`, box => {
      const err = msg => { box.querySelector('#mErr').textContent = msg; };
      const inp = box.querySelector('#mCode');
      if (prefill) setTimeout(() => box.querySelector('#mJoin').focus(), 50);
      inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); err(''); });
      box.querySelector('#mHost').addEventListener('click', () => { audio.sfx('click'); err(''); onCreate(err); });
      const join = () => {
        audio.sfx('click');
        if (inp.value.length !== 5) { err('Room codes are 5 letters.'); audio.sfx('error'); inp.focus(); return; }
        err('');
        onJoin(inp.value, err);
      };
      box.querySelector('#mJoin').addEventListener('click', join);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    });
  }

  showHow() {
    const role = (k, card) => { const r = ROLES[k]; return `<div class="how-role"><div class="im" style="background-image:url(${cardURL(card)})"></div><b style="color:${r.color}">${r.card.toUpperCase()}</b>${r.name}</div>`; };
    this.modal(`<h2>HOW TO PLAY</h2>
      <p>Everyone sits at the table and is dealt one card in secret. Your card is your role.</p>
      <div class="how-roles">
        ${role('mafia', { rank: 'JOKER' })}${role('sheriff', { rank: 'K', suit: 'S' })}${role('angel', { rank: 'A', suit: 'S' })}${role('civilian', { rank: '7', suit: 'H' })}
      </div>
      <h3>THE JOKERS (MAFIA)</h3><p>Know each other. Each night they secretly agree on a victim. They win when they equal or outnumber everyone else.</p>
      <h3>THE KING (SHERIFF)</h3><p>Each night, investigates one player and learns if they are Mafia.</p>
      <h3>THE ACE (ANGEL)</h3><p>Each night, protects one player from the Mafia, themselves included, but never the same person two nights in a row.</p>
      <h3>NUMBER CARDS (CIVILIANS)</h3><p>No powers. Talk, deduce, and vote. The town wins when every Joker is gone.</p>
      <h3>SINGLE PLAYER</h3><p>Mafia is best with real friends, but you can practise against bots: the regulars: eleven characters with their own tempers, habits and tells. They read the votes, remember who lied, and they listen to you. Name someone to accuse them, ask <i>"who do you suspect?"</i>, ask <i>"Rosa, what about Sal?"</i>, claim your card (<i>"I'm the King, Sal is a Joker"</i>) or plead your innocence. As a Joker, whisper a name at night and your partners will follow.</p>
      <h3>A ROUND</h3>
      <p><b style="color:var(--ice)">NIGHT</b> — the town sleeps; the Jokers, King and Ace act by clicking a player.</p>
      <p><b style="color:var(--amber)">DAWN</b> — find out who died. Cards stay secret: the dead take theirs to the grave, and every card is shown when the game ends.</p>
      <p><b style="color:var(--amber)">DAY</b> — discuss in the chat. Accuse, defend, bluff.</p>
      <p><b style="color:#ff5a5f">VOTE</b> — click a player to accuse them. Most votes is condemned, gets last words, then is executed. Ties and skips spare everyone.</p>
      <h3>CONTROLS</h3>
      <p><kbd>DRAG</kbd> look around · <kbd>CLICK</kbd> a player or their name tag to choose them · <kbd>RIGHT-CLICK</kbd> a player to privately mark them <span class="mk sus">?</span>suspect or <span class="mk ok">✓</span>trusted · <kbd>A</kbd>/<kbd>D</kbd> turn · <kbd>SPACE</kbd> recenter · <kbd>WHEEL</kbd> zoom · <kbd>ENTER</kbd> chat · <kbd>H</kbd> hide HUD · click your card on the table to peek at it.</p>
      <div class="row"><button class="btn primary" data-close>GOT IT</button></div>`);
  }

  showOptions() {
    const s = audio.settings;
    const qi = this.a.qualityInfo();
    const q = qi.mode;
    let crt = true;
    try { crt = localStorage.getItem('mafia.crt') !== '"off"' && localStorage.getItem('mafia.crt') !== 'off'; } catch { /* ignore */ }
    const qb = (k, label) => `<button class="btn small ${q === k ? 'on' : ''}" data-q="${k}">${label}</button>`;
    this.modal(`<h2>OPTIONS</h2>
      <div class="opt-row"><span>Master volume</span><input type="range" min="0" max="1" step="0.05" value="${s.master}" data-a="master"></div>
      <div class="opt-row"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-a="music"></div>
      <div class="opt-row"><span>Effects</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-a="sfx"></div>
      <div class="opt-row"><span>Graphics</span><span class="qrow">${qb('auto', 'AUTO')}${qb('low', 'LOW')}${qb('medium', 'MEDIUM')}${qb('high', 'HIGH')}${qb('ultra', 'ULTRA')}</span></div>
      <p class="hint" id="qNote">${q === 'auto' ? `Auto adjusts to your PC. Running at ${qi.tier.toUpperCase()} now.` : 'Fixed quality. Pick AUTO if the game stutters.'}</p>
      <div class="opt-row"><span>CRT scanlines</span><button class="toggle ${crt ? 'on' : ''}" id="optCrt"></button></div>
      <div class="row"><button class="btn primary" data-close>DONE</button></div>`, box => {
      box.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => { audio.init(); audio.set(r.dataset.a, +r.value); }));
      box.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
        audio.sfx('select');
        box.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === b));
        this.a.quality(b.dataset.q);
        const info = this.a.qualityInfo();
        box.querySelector('#qNote').textContent = info.mode === 'auto' ? `Auto adjusts to your PC. Running at ${info.tier.toUpperCase()} now.` : 'Fixed quality. Pick AUTO if the game stutters.';
      }));
      box.querySelector('#optCrt').addEventListener('click', e => {
        const on = !e.currentTarget.classList.contains('on');
        e.currentTarget.classList.toggle('on', on);
        this.a.crt(on);
      });
    });
  }
}

function fmtTime(s) { return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; }
function fmtClock(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// three short lines about an outfit, for the title screen
function describeLook(l) {
  const n = (k, i) => lookName(k, i);
  const suit = `${n('suit', l.suit)}${l.pattern ? ' ' + n('pattern', l.pattern).toLowerCase() : ''} suit`;
  const top = [l.hat === 4 ? null : n('hat', l.hat), l.hat === 4 || l.hair === 6 ? n('hair', l.hair).toLowerCase() : null].filter(Boolean).join(', ');
  const face = [l.facial ? n('facial', l.facial) : null, l.wear ? n('wear', l.wear) : null, l.mouth === 5 ? 'Cigar' : null].filter(Boolean).join(', ');
  return [suit, top.charAt(0).toUpperCase() + top.slice(1), face || n('tie', l.tie)].filter(Boolean);
}
