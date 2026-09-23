// Room transports. The host is authoritative; clients only ever talk to the host.
// Two flavours share one interface:
//   - "online": PeerJS (WebRTC data channels, public signalling server, no backend of our own)
//   - "local":  BroadcastChannel, for testing with several tabs on one machine
const PREFIX = 'mafia-noir-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function cleanCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
}

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { (this._h[ev] || []).forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }); }
}

const rid = () => Math.random().toString(36).slice(2, 10);
const PEER_OPTS = { debug: 1, config: { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
] } };

function needPeer() {
  if (!window.Peer) throw new Error('Online mode needs the PeerJS library (check your internet connection).');
}

// ---------------------------------------------------------------- PeerJS host
export class PeerHost extends Emitter {
  constructor() { super(); this.conns = new Map(); this.peer = null; }

  open(code) {
    needPeer();
    return new Promise((resolve, reject) => {
      let settled = false;
      const peer = new window.Peer(PREFIX + code, PEER_OPTS);
      this.peer = peer;
      const t = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Could not reach the matchmaking server. Try again, or use same-device mode.')); } }, 15000);
      peer.on('open', () => { if (!settled) { settled = true; clearTimeout(t); resolve(); } });
      peer.on('error', err => {
        if (!settled) {
          settled = true; clearTimeout(t);
          reject(err.type === 'unavailable-id' ? Object.assign(new Error('taken'), { taken: true }) : new Error(err.message || String(err.type)));
        } else console.warn('[peer host]', err.type, err);
      });
      peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch { /* ignore */ } });
      peer.on('connection', conn => {
        const id = conn.peer + ':' + rid();
        conn.on('open', () => { this.conns.set(id, conn); this.emit('join', id); });
        conn.on('data', d => this.emit('message', id, d));
        const gone = () => { if (this.conns.delete(id)) this.emit('leave', id); };
        conn.on('close', gone);
        conn.on('error', gone);
      });
    });
  }

  send(id, msg) {
    const c = this.conns.get(id);
    if (c && c.open) { try { c.send(msg); } catch (e) { console.warn(e); } }
  }

  drop(id) {
    const c = this.conns.get(id);
    if (c) { this.conns.delete(id); try { c.close(); } catch { /* ignore */ } }
  }

  close() {
    for (const c of this.conns.values()) { try { c.close(); } catch { /* ignore */ } }
    this.conns.clear();
    try { this.peer && this.peer.destroy(); } catch { /* ignore */ }
  }
}

// -------------------------------------------------------------- PeerJS client
export class PeerClient extends Emitter {
  constructor() { super(); this.peer = null; this.conn = null; this.closed = false; }

  connect(code) {
    needPeer();
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = msg => { if (!settled) { settled = true; clearTimeout(t); reject(new Error(msg)); this.close(); } };
      const t = setTimeout(() => fail('Could not connect. Check the room code, or the host may be behind a strict firewall.'), 15000);
      const peer = new window.Peer(PEER_OPTS);
      this.peer = peer;
      peer.on('error', err => {
        if (!settled) fail(err.type === 'peer-unavailable' ? 'Room not found. Check the code with your host.' : (err.message || String(err.type)));
        else if (err.type === 'peer-unavailable' || err.type === 'network') this._lost();
      });
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        this.conn = conn;
        conn.on('open', () => { if (!settled) { settled = true; clearTimeout(t); resolve(); } });
        conn.on('data', d => this.emit('message', d));
        conn.on('close', () => this._lost());
        conn.on('error', () => this._lost());
      });
    });
  }

  _lost() { if (!this.closed) { this.closed = true; this.emit('close'); } }
  send(msg) { if (this.conn && this.conn.open) { try { this.conn.send(msg); } catch (e) { console.warn(e); } } }
  close() {
    this.closed = true;
    try { this.conn && this.conn.close(); } catch { /* ignore */ }
    try { this.peer && this.peer.destroy(); } catch { /* ignore */ }
  }
}

// ------------------------------------------------- BroadcastChannel (same device)
export class LocalHost extends Emitter {
  constructor() { super(); this.ch = null; this.conns = new Set(); this.hostTag = rid(); }

  open(code) {
    return new Promise((resolve, reject) => {
      const ch = new BroadcastChannel(PREFIX + code);
      this.ch = ch;
      let probing = true;
      ch.onmessage = ev => {
        const m = ev.data || {};
        if (probing) {
          if (m.k === 'here') { probing = false; ch.close(); reject(Object.assign(new Error('taken'), { taken: true })); }
          return;
        }
        if (m.k === 'probe') ch.postMessage({ k: 'here' });
        else if (m.k === 'join') {
          this.conns.add(m.from);
          ch.postMessage({ k: 'welcome', to: m.from });
          this.emit('join', m.from);
        } else if (m.k === 'msg' && m.to === 'host' && this.conns.has(m.from)) this.emit('message', m.from, m.d);
        else if (m.k === 'bye' && this.conns.delete(m.from)) this.emit('leave', m.from);
      };
      ch.postMessage({ k: 'probe' });
      setTimeout(() => { if (probing) { probing = false; resolve(); } }, 300);
    });
  }

  send(id, msg) { if (this.ch && this.conns.has(id)) this.ch.postMessage({ k: 'msg', to: id, d: msg }); }
  drop(id) { if (this.conns.delete(id) && this.ch) this.ch.postMessage({ k: 'drop', to: id }); }
  close() { if (this.ch) { this.ch.postMessage({ k: 'hostgone' }); this.ch.close(); this.ch = null; } }
}

export class LocalClient extends Emitter {
  constructor() { super(); this.ch = null; this.id = 'tab-' + rid(); this.closed = false; }

  connect(code) {
    return new Promise((resolve, reject) => {
      const ch = new BroadcastChannel(PREFIX + code);
      this.ch = ch;
      let ok = false;
      ch.onmessage = ev => {
        const m = ev.data || {};
        if (m.k === 'welcome' && m.to === this.id) { ok = true; resolve(); }
        else if (m.k === 'msg' && m.to === this.id) this.emit('message', m.d);
        else if ((m.k === 'drop' && m.to === this.id) || m.k === 'hostgone') this._lost();
      };
      ch.postMessage({ k: 'join', from: this.id });
      setTimeout(() => { if (!ok) { ch.close(); this.ch = null; reject(new Error('Room not found on this device. Same-device rooms only work between tabs of this browser.')); } }, 1500);
      this._unload = () => this.close();
      window.addEventListener('beforeunload', this._unload);
    });
  }

  _lost() { if (!this.closed) { this.closed = true; this.emit('close'); } }
  send(msg) { if (this.ch) this.ch.postMessage({ k: 'msg', from: this.id, to: 'host', d: msg }); }
  close() {
    this.closed = true;
    if (this.ch) { try { this.ch.postMessage({ k: 'bye', from: this.id }); this.ch.close(); } catch { /* ignore */ } this.ch = null; }
    if (this._unload) window.removeEventListener('beforeunload', this._unload);
  }
}

export function makeHostTransport(mode) { return mode === 'local' ? new LocalHost() : new PeerHost(); }
export function makeClientTransport(mode) { return mode === 'local' ? new LocalClient() : new PeerClient(); }
