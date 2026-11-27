/**
 * (27-11-2026, usuario) AMIGOS entre cuentas de INVITADO (servidor = autoridad).
 *
 * Cada teléfono tiene un id secreto (`deviceId`, el mismo del Modo Riesgo): es la "llave" del invitado y NUNCA se muestra a otros.
 * Al sincronizar, el servidor le da un id PÚBLICO (`pid`, el que ven sus amigos) y un CÓDIGO para agregarlo: NOMBRE#111. (27-11-2026, usuario)
 * El número va POR NOMBRE y EMPIEZA EN 111 (nunca #1: que no se note cuántos jugadores hay): el primer Nxo es Nxo#111, el segundo Nxo#112…;
 * el primer Mai es Mai#111. Si el jugador cambia de nombre, recibe el siguiente número libre de su nombre nuevo.
 *
 * Reglas: hasta 100 amigos; una solicitud por pareja (si los dos se la envían, quedan amigos); un REGALO por amigo y día (ciclo 23:59
 * de Chile, como la ruleta) con monedas sorpresa (las mismas que el REGALO GRATIS de la tienda); hasta 30 regalos sin abrir.
 * "En línea" = sincronizó hace menos de 3 minutos.
 *
 * Persistencia: archivo JSON (FRIENDS_DATA_FILE; por defecto data/friends.json), escrito atómico (tmp + rename), igual que el Modo Riesgo.
 * Las monedas del regalo se suman en el teléfono (la economía aún vive allí).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { cycleIdAt } from '../risk/riskMode.js';

export const FRIENDS = { maxFriends: 100, maxGifts: 30, onlineMs: 3 * 60_000, maxRequests: 50 } as const;
/**
 * (27-11-2026, usuario) DUELO entre amigos: el reto dura 30 s. Si el retado lo RECHAZA, el que retó debe esperar 30 s para retarlo otra vez;
 * cada rechazo seguido dobla la espera (30 s, 1 min, 2 min…, hasta 30 min). Aceptar (o 1 h sin retos) la vuelve a 30 s.
 */
/** (27-11-2026) SUGERENCIAS: hasta 10, vistos en los últimos 7 días */
export const SUGGEST = { max: 10, recentMs: 7 * 24 * 3600_000, maxMet: 20 } as const;
export const DUEL = { ttlMs: 30_000, baseWaitMs: 30_000, maxWaitMs: 30 * 60_000, forgetMs: 60 * 60_000 } as const;
/** espera tras el rechazo número `strikes` (1 = 30 s) */
export const duelWaitMs = (strikes: number) => Math.min(DUEL.maxWaitMs, DUEL.baseWaitMs * 2 ** Math.max(0, strikes - 1));
export const GIFT_OPTIONS = [
  { kind: 'coins', amount: 10, weight: 30 },
  { kind: 'coins', amount: 15, weight: 15 },
  { kind: 'coins', amount: 25, weight: 5 },
  { kind: 'coins2v2', amount: 5, weight: 30 },
  { kind: 'coins2v2', amount: 8, weight: 15 },
  { kind: 'coins2v2', amount: 10, weight: 5 },
] as const;
const LEAGUES = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'challenger'] as const;
const NAME_RE = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{3,12}$/;

export type League = (typeof LEAGUES)[number];
export type GiftKind = 'coins' | 'coins2v2';
interface Gift {
  id: string;
  from: string; // pid de quien lo envió
  fromName: string;
  kind: GiftKind;
  amount: number;
  at: number;
}
interface Player {
  pid: string;
  name: string;
  tag: string; // (27-11-2026, usuario) número del jugador: 111, 112, 113… (único, nunca cambia)
  level: number;
  league: League;
  skin: string;
  lastSeen: number;
  friends: string[]; // pids
  requests: string[]; // pids que te enviaron solicitud
  gifts: Gift[];
  giftSent: Record<string, string>; // pid -> día del ciclo
  /** (27-11-2026) retos de duelo recibidos (vencen a los 30 s) */
  duels?: { id: string; from: string; fromName: string; at: number }[];
  /** reto enviado y su respuesta (el que retó la lee una vez) */
  duelOut?: { id: string; to: string; toName: string; at: number; state: 'pending' | 'accepted' | 'rejected'; key?: string };
  /** espera para que cada amigo te pueda volver a retar (pid -> rechazos seguidos y hasta cuándo) */
  duelBlock?: Record<string, { strikes: number; until: number; last: number }>;
  /** (27-11-2026, usuario) jugadores con los que jugaste en línea: rival (1v1) o compañero (2v2); el más reciente primero, hasta 20 */
  met?: { pid: string; kind: 'rival' | 'mate'; at: number }[];
}
export interface Profile {
  name: string;
  level: number;
  league: string;
  skin: string;
}
export type FriendsError = 'invalid' | 'not_found' | 'self' | 'already_friends' | 'already_sent' | 'full' | 'not_friend' | 'gift_sent' | 'no_request' | 'duel_wait' | 'offline' | 'expired';

export const isDeviceId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v);
const norm = (s: string) => s.trim().toLowerCase();
/** primer número de jugador (27-11-2026, usuario) */
export const FIRST_TAG = 111;
/** "Nacho#112" → { name, tag } (sin distinguir mayúsculas) */
export function parseCode(raw: unknown): { name: string; tag: string } | null {
  if (typeof raw !== 'string') return null;
  const m = /^\s*(.{3,12}?)\s*#\s*(\d{3,9})\s*$/.exec(raw);
  return m && NAME_RE.test(m[1]) ? { name: m[1], tag: m[2] } : null;
}

export class FriendsStore {
  private byDevice = new Map<string, Player>();
  private byPid = new Map<string, Player>();
  constructor(
    private readonly file: string | null,
    private readonly clock: () => number = Date.now,
    private readonly rng: () => number = Math.random,
  ) {
    if (!file) return;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Player>;
      for (const [dev, p] of Object.entries(raw)) if (isDeviceId(dev) && p?.pid) this.index(dev, p);
    } catch {
      /* sin archivo todavía */
    }
  }

  private index(dev: string, p: Player) {
    this.byDevice.set(dev, p);
    this.byPid.set(p.pid, p);
  }

  private save() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.byDevice)));
    renameSync(tmp, this.file);
  }

  /** (27-11-2026, usuario) número nuevo para ESE nombre: el mayor de los que ya lo usan + 1 (el primero, 111) */
  private newTag(name: string) {
    let max = FIRST_TAG - 1;
    for (const q of this.byPid.values()) if (norm(q.name) === norm(name)) max = Math.max(max, Number(q.tag) || 0);
    return String(max + 1);
  }

  private me(dev: string) {
    return this.byDevice.get(dev) ?? null;
  }

  /** Crea o pone al día al jugador (nombre, nivel, liga, personaje) y marca que está en línea. */
  sync(dev: string, prof: Profile) {
    const now = this.clock();
    const name = typeof prof.name === 'string' && NAME_RE.test(prof.name.trim()) ? prof.name.trim() : 'Jugador';
    const level = Number.isFinite(prof.level) ? Math.max(1, Math.min(999, Math.floor(prof.level))) : 1;
    const league = (LEAGUES as readonly string[]).includes(prof.league) ? (prof.league as League) : 'bronze';
    const skin = typeof prof.skin === 'string' && /^[a-z0-9_-]{1,20}$/.test(prof.skin) ? prof.skin : 'nxo';
    let p = this.me(dev);
    if (!p) {
      let pid = '';
      do pid = randomBytes(8).toString('hex');
      while (this.byPid.has(pid));
      p = { pid, name, tag: this.newTag(name), level, league, skin, lastSeen: now, friends: [], requests: [], gifts: [], giftSent: {} };
      this.index(dev, p);
    } else {
      if (norm(p.name) !== norm(name)) p.tag = this.newTag(name); // otro nombre: su siguiente número libre
      Object.assign(p, { name, level, league, skin, lastSeen: now });
    }
    this.save();
    return this.view(dev)!;
  }

  /** Lo que ve el jugador: su código, amigos, solicitudes y regalos sin abrir. */
  view(dev: string) {
    const p = this.me(dev);
    if (!p) return null;
    const now = this.clock();
    const today = cycleIdAt(now);
    const card = (q: Player) => ({ id: q.pid, name: q.name, level: q.level, league: q.league, skin: q.skin });
    return {
      code: `${p.name}#${p.tag}`,
      friends: p.friends.map((id) => this.byPid.get(id)).filter((q): q is Player => !!q).map((q) => {
        const ago = now - q.lastSeen;
        return { ...card(q), status: ago < FRIENDS.onlineMs ? ('online' as const) : ('offline' as const), lastSeenMin: Math.max(0, Math.floor(ago / 60_000)) };
      }),
      requests: p.requests.map((id) => this.byPid.get(id)).filter((q): q is Player => !!q).map(card),
      gifts: p.gifts.map((g) => ({ id: g.id, fromName: g.fromName, kind: g.kind, amount: g.amount })),
      // solo los de hoy: el cliente no necesita los días viejos
      giftSent: Object.fromEntries(Object.entries(p.giftSent).filter(([, d]) => d === today)),
    };
  }

  private fail(error: FriendsError) {
    return { ok: false as const, error };
  }
  private done(dev: string) {
    this.save();
    return { ok: true as const, snap: this.view(dev)! };
  }

  /** Envía una solicitud por código (NOMBRE#1234). Si el otro ya te la había enviado, quedan amigos. */
  request(dev: string, code: unknown) {
    const p = this.me(dev);
    const c = parseCode(code);
    if (!p || !c) return this.fail('invalid');
    const q = [...this.byPid.values()].find((x) => x.tag === c.tag && norm(x.name) === norm(c.name));
    if (!q) return this.fail('not_found');
    return this.requestTo(dev, p, q);
  }

  /** (27-11-2026) solicitud a un jugador por su id público (botón AGREGAR de SUGERENCIAS) */
  requestById(dev: string, pid: unknown) {
    const p = this.me(dev);
    if (!p || typeof pid !== 'string') return this.fail('invalid');
    const q = this.byPid.get(pid);
    if (!q) return this.fail('not_found');
    return this.requestTo(dev, p, q);
  }

  private requestTo(dev: string, p: Player, q: Player) {
    if (q === p) return this.fail('self');
    if (p.friends.includes(q.pid)) return this.fail('already_friends');
    if (p.requests.includes(q.pid)) return this.answer(dev, q.pid, true); // él ya te la había enviado
    if (q.requests.includes(p.pid)) return this.fail('already_sent');
    if (p.friends.length >= FRIENDS.maxFriends || q.requests.length >= FRIENDS.maxRequests) return this.fail('full');
    q.requests.push(p.pid);
    return { ...this.done(dev), name: q.name };
  }

  /**
   * (27-11-2026, usuario) SUGERENCIAS: jugadores registrados (invitados que entraron al menú con servidor) que aún no son tus amigos ni tienen
   * solicitud pendiente contigo. Los vistos en los últimos 7 días; primero los EN LÍNEA, luego los de nivel parecido y los más recientes. Hasta 10.
   */
  suggest(dev: string) {
    const p = this.me(dev);
    if (!p) return null;
    const now = this.clock();
    const ok = (q: Player | undefined): q is Player => !!q && q.pid !== p.pid && !p.friends.includes(q.pid) && !p.requests.includes(q.pid) && !q.requests.includes(p.pid);
    const online = (q: Player) => now - q.lastSeen < FRIENDS.onlineMs;
    const card = (q: Player, met?: 'rival' | 'mate') => {
      const ago = now - q.lastSeen;
      return { id: q.pid, name: q.name, tag: q.tag, level: q.level, league: q.league, skin: q.skin, status: online(q) ? ('online' as const) : ('offline' as const), lastSeenMin: Math.max(0, Math.floor(ago / 60_000)), ...(met ? { met } : {}) };
    };
    // (27-11-2026, usuario) SIEMPRE primero los que jugaron contigo (rivales del 1v1 y compañeros del 2v2), el más reciente primero, sin importar cuándo
    const metList = (p.met ?? []).map((m) => ({ m, q: this.byPid.get(m.pid) })).filter((x): x is { m: NonNullable<Player['met']>[number]; q: Player } => ok(x.q));
    const used = new Set(metList.map((x) => x.q.pid));
    const rest = [...this.byPid.values()].filter((q) => ok(q) && !used.has(q.pid) && now - q.lastSeen < SUGGEST.recentMs);
    rest.sort((a, b) => Number(online(b)) - Number(online(a)) || Math.abs(a.level - p.level) - Math.abs(b.level - p.level) || b.lastSeen - a.lastSeen);
    return [...metList.map((x) => card(x.q, x.m.kind)), ...rest.slice(0, Math.max(0, SUGGEST.max - metList.length)).map((q) => card(q))];
  }

  /**
   * (27-11-2026, usuario) Dos jugadores acaban de emparejarse en línea (ids secretos de sus teléfonos): quedan anotados el uno en el otro
   * como RIVAL (1v1) o COMPAÑERO (2v2), para que salgan en SUGERENCIAS.
   */
  met(devA: string, devB: string, kind: 'rival' | 'mate') {
    const a = this.me(devA);
    const b = this.me(devB);
    if (!a || !b || a === b) return;
    const at = this.clock();
    const add = (x: Player, y: Player) => {
      x.met = [{ pid: y.pid, kind, at }, ...(x.met ?? []).filter((m) => m.pid !== y.pid)].slice(0, SUGGEST.maxMet);
    };
    add(a, b);
    add(b, a);
    this.save();
  }

  /** Acepta o rechaza una solicitud recibida. */
  answer(dev: string, fromPid: unknown, accept: boolean) {
    const p = this.me(dev);
    if (!p || typeof fromPid !== 'string') return this.fail('invalid');
    if (!p.requests.includes(fromPid)) return this.fail('no_request');
    p.requests = p.requests.filter((x) => x !== fromPid);
    const q = this.byPid.get(fromPid);
    if (accept && q) {
      if (p.friends.length >= FRIENDS.maxFriends || q.friends.length >= FRIENDS.maxFriends) return this.fail('full');
      if (!p.friends.includes(q.pid)) p.friends.push(q.pid);
      if (!q.friends.includes(p.pid)) q.friends.push(p.pid);
      q.requests = q.requests.filter((x) => x !== p.pid);
    }
    return { ...this.done(dev), name: q?.name ?? '' };
  }

  /** Quita a un amigo (de las dos listas). */
  remove(dev: string, pid: unknown) {
    const p = this.me(dev);
    if (!p || typeof pid !== 'string') return this.fail('invalid');
    p.friends = p.friends.filter((x) => x !== pid);
    const q = this.byPid.get(pid);
    if (q) q.friends = q.friends.filter((x) => x !== p.pid);
    return this.done(dev);
  }

  /** Envía un regalo a un amigo: uno por amigo y día; el contenido (sorpresa) lo decide el servidor. */
  gift(dev: string, pid: unknown) {
    const p = this.me(dev);
    if (!p || typeof pid !== 'string') return this.fail('invalid');
    const q = this.byPid.get(pid);
    if (!q || !p.friends.includes(pid)) return this.fail('not_friend');
    const today = cycleIdAt(this.clock());
    if (p.giftSent[pid] === today) return this.fail('gift_sent');
    if (q.gifts.length >= FRIENDS.maxGifts) return this.fail('full');
    const total = GIFT_OPTIONS.reduce((a, o) => a + o.weight, 0);
    let r = this.rng() * total;
    const pick = GIFT_OPTIONS.find((o) => (r -= o.weight) < 0) ?? GIFT_OPTIONS[0];
    q.gifts.push({ id: randomBytes(6).toString('hex'), from: p.pid, fromName: p.name, kind: pick.kind, amount: pick.amount, at: this.clock() });
    // se limpian los días viejos
    for (const [k, d] of Object.entries(p.giftSent)) if (d !== today) delete p.giftSent[k];
    p.giftSent[pid] = today;
    return this.done(dev);
  }

  // ---------------------------------------------------------------- DUELO (27-11-2026)

  /** Reta a un amigo en línea. Respeta la espera tras sus rechazos (`waitS` = segundos que faltan). */
  duel(dev: string, pid: unknown) {
    const p = this.me(dev);
    if (!p || typeof pid !== 'string') return this.fail('invalid');
    const q = this.byPid.get(pid);
    if (!q || !p.friends.includes(pid)) return this.fail('not_friend');
    const now = this.clock();
    p.lastSeen = now;
    if (now - q.lastSeen >= FRIENDS.onlineMs) return this.fail('offline');
    const b = q.duelBlock?.[p.pid];
    if (b && now < b.until) return { ok: false as const, error: 'duel_wait' as const, waitS: Math.ceil((b.until - now) / 1000) };
    this.dropOut(p); // un reto a la vez: el anterior se retira
    const id = randomBytes(6).toString('hex');
    q.duels = [...(q.duels ?? []).filter((d) => d.from !== p.pid && now - d.at < DUEL.ttlMs), { id, from: p.pid, fromName: p.name, at: now }];
    p.duelOut = { id, to: q.pid, toName: q.name, at: now, state: 'pending' };
    return { ok: true as const, duelId: id, ttlMs: DUEL.ttlMs };
  }

  private dropOut(p: Player) {
    const o = p.duelOut;
    if (!o) return;
    const q = this.byPid.get(o.to);
    if (q?.duels) q.duels = q.duels.filter((d) => d.id !== o.id);
    p.duelOut = undefined;
  }

  /** Retira el reto enviado (el que retó se cansó de esperar). */
  duelCancel(dev: string) {
    const p = this.me(dev);
    if (!p) return this.fail('invalid');
    this.dropOut(p);
    return { ok: true as const };
  }

  /**
   * Consulta rápida (cada pocos segundos en el menú): retos recibidos vigentes y la respuesta al reto enviado. Una respuesta final
   * (aceptado / rechazado / vencido) se entrega UNA vez. Cuenta como "en línea". No escribe el archivo (solo memoria).
   */
  duelPoll(dev: string) {
    const p = this.me(dev);
    if (!p) return null;
    const now = this.clock();
    p.lastSeen = now;
    if (p.duels) p.duels = p.duels.filter((d) => now - d.at < DUEL.ttlMs && p.friends.includes(d.from));
    const incoming = (p.duels ?? []).map((d) => ({ id: d.id, fromName: d.fromName, msLeft: DUEL.ttlMs - (now - d.at) }));
    let out: { id: string; toName: string; state: 'pending' | 'accepted' | 'rejected' | 'expired'; key?: string } | null = null;
    const o = p.duelOut;
    if (o) {
      const state = o.state === 'pending' && now - o.at >= DUEL.ttlMs ? 'expired' : o.state;
      out = { id: o.id, toName: o.toName, state, ...(o.key ? { key: o.key } : {}) };
      if (state !== 'pending') this.dropOut(p);
    }
    return { incoming, out };
  }

  /** El retado acepta (los dos reciben la misma clave de sala privada) o rechaza (el que retó espera más cada vez). */
  duelAnswer(dev: string, duelId: unknown, accept: boolean) {
    const p = this.me(dev);
    if (!p || typeof duelId !== 'string') return this.fail('invalid');
    const now = this.clock();
    const d = (p.duels ?? []).find((x) => x.id === duelId);
    p.duels = (p.duels ?? []).filter((x) => x.id !== duelId);
    const c = d && this.byPid.get(d.from);
    if (!d || !c || !c.duelOut || now - d.at >= DUEL.ttlMs || c.duelOut.id !== duelId) return this.fail('expired');
    p.duelBlock ??= {};
    if (accept) {
      delete p.duelBlock[c.pid];
      const key = randomBytes(8).toString('hex');
      c.duelOut = { ...c.duelOut, state: 'accepted', key };
      this.save();
      return { ok: true as const, key, name: c.name };
    }
    const prev = p.duelBlock[c.pid];
    const strikes = prev && now - prev.last < DUEL.forgetMs ? prev.strikes + 1 : 1;
    p.duelBlock[c.pid] = { strikes, until: now + duelWaitMs(strikes), last: now };
    c.duelOut = { ...c.duelOut, state: 'rejected' };
    this.save();
    return { ok: true as const, name: c.name };
  }

  /** Abre un regalo recibido: se quita y se devuelve qué traía (una sola vez). */
  take(dev: string, giftId: unknown) {
    const p = this.me(dev);
    if (!p || typeof giftId !== 'string') return this.fail('invalid');
    const g = p.gifts.find((x) => x.id === giftId);
    if (!g) return this.fail('not_found');
    p.gifts = p.gifts.filter((x) => x !== g);
    return { ...this.done(dev), gift: { id: g.id, fromName: g.fromName, kind: g.kind, amount: g.amount } };
  }
}

let shared: FriendsStore | null = null;
/** (27-11-2026) el almacén del servidor (uno solo: lo usan la API de amigos y el emparejamiento, que anota rivales y compañeros) */
export function sharedFriendsStore(): FriendsStore {
  return (shared ??= new FriendsStore(process.env.FRIENDS_DATA_FILE ?? 'data/friends.json'));
}
