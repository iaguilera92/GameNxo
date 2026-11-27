/**
 * (27-11-2026, usuario) AMIGOS contra el servidor (backend/src/api/friendsRoutes.ts). El invitado se identifica con el id de este teléfono
 * (riskPlayerId: secreto, nunca se muestra); el servidor le da su código NOMBRE#111 para que lo agreguen.
 * Mismo contrato `FriendsRepository` que usa la pantalla (domain/friends.ts). Sin conexión: la última lista conocida, marcada `offline`.
 */
import { serverUrl } from './config';
import { riskPlayerId } from './riskApi';
import { type DuelPoll, type FriendGift, type FriendSuggestion, type FriendsReply, type FriendsRepository, type FriendsSnapshot, rollFriendGift } from '../domain/friends';

export interface FriendsProfile {
  name: string;
  level: number;
  league: string;
  skin: string;
}

type ServerSnap = Omit<FriendsSnapshot, 'available' | 'offline'>;

const CODE_KEY = 'gamenxo.friendCode';
/** (27-11-2026, usuario) tu número de jugador ("#111"), guardado para mostrarlo al instante en la card del perfil; null si aún no lo hay */
export function myFriendTag(): string | null {
  try {
    const c = localStorage.getItem(`${CODE_KEY}.${riskPlayerId()}`);
    const i = c ? c.lastIndexOf('#') : -1;
    return c && i >= 0 ? c.slice(i) : null;
  } catch {
    return null;
  }
}

export function serverFriends(base: string, profile: () => FriendsProfile): FriendsRepository {
  let snap: FriendsSnapshot = { available: false, friends: [], requests: [], gifts: [], giftSent: {} };
  /** regalos del botón TEST (solo en este teléfono) */
  let testGifts: FriendGift[] = [];
  let testN = 0;
  const withTest = (s: FriendsSnapshot): FriendsSnapshot => (testGifts.length ? { ...s, gifts: [...s.gifts, ...testGifts] } : s);
  const url = (path: string) => `${base}/api/friends/${encodeURIComponent(riskPlayerId())}${path}`;

  async function call(path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> } | null> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const res = await fetch(url(path), body === undefined ? { signal: ctl.signal } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      return { status: res.status, data: (await res.json()) as Record<string, unknown> };
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  const take = (raw: unknown): FriendsSnapshot => {
    const s = raw as ServerSnap;
    if (s.code)
      try {
        localStorage.setItem(`${CODE_KEY}.${riskPlayerId()}`, s.code);
      } catch {
        /* sin almacenamiento */
      }
    snap = { available: true, code: s.code, friends: s.friends ?? [], requests: s.requests ?? [], gifts: s.gifts ?? [], giftSent: s.giftSent ?? {} };
    return withTest(snap);
  };
  const lost = (): FriendsSnapshot => (snap = { ...snap, offline: true, available: snap.available && !!snap.code });
  /** acción: el servidor devuelve la lista nueva o un error */
  async function act(path: string, body: unknown): Promise<FriendsReply> {
    const r = await call(path, body);
    if (!r) return { ok: false, error: 'net', snap: withTest(lost()) };
    if (r.data.ok !== true) {
      // la lista puede haber cambiado (p. ej. ya no es tu amigo): se pide de nuevo sin esperar
      if (r.data.error !== 'invalid') void repo.refresh();
      return { ok: false, error: String(r.data.error ?? 'error'), snap: withTest(snap) };
    }
    return { ok: true, snap: take(r.data.snap), name: typeof r.data.name === 'string' ? r.data.name : undefined };
  }

  const repo: FriendsRepository = {
    load: () => withTest(snap),
    refresh: async () => {
      const r = await call('/sync', profile());
      if (!r || r.data.ok !== true) return withTest(lost());
      return take(r.data.snap);
    },
    add: (code) => act('/request', { code }),
    addById: (id) => act('/request', { friend: id }),
    suggestions: async () => {
      const r = await call('/suggest');
      if (!r || r.data.ok !== true) return null;
      return (r.data.list as FriendSuggestion[]) ?? [];
    },
    answer: (id, accept) => act('/answer', { from: id, accept }),
    remove: (id) => act('/remove', { friend: id }),
    sendGift: (id) => act('/gift', { friend: id }),
    takeGift: async (id) => {
      const local = testGifts.find((g) => g.id === id);
      if (local) {
        testGifts = testGifts.filter((g) => g !== local);
        return local;
      }
      const r = await call('/take', { gift: id });
      if (!r || r.data.ok !== true) return null;
      take(r.data.snap);
      return r.data.gift as FriendGift;
    },
    devReceiveGift: () => {
      testGifts = [...testGifts, { id: `test-${++testN}`, fromName: 'Amigo_Test', ...rollFriendGift() }];
      return withTest(snap);
    },
    duel: async (id) => {
      const r = await call('/duel', { friend: id });
      if (!r) return { ok: false, error: 'net' };
      const d = r.data;
      if (d.ok === true) return { ok: true, duelId: String(d.duelId), ttlMs: Number(d.ttlMs) || 30_000 };
      return { ok: false, error: String(d.error ?? 'error'), ...(typeof d.waitS === 'number' ? { waitS: d.waitS } : {}) };
    },
    duelPoll: async () => {
      const r = await call('/duel');
      if (!r || r.data.ok !== true) return null;
      return { incoming: (r.data.incoming as DuelPoll['incoming']) ?? [], out: (r.data.out as DuelPoll['out']) ?? null };
    },
    duelAnswer: async (id, accept) => {
      const r = await call('/duel/answer', { duel: id, accept });
      if (!r) return { ok: false, error: 'net' };
      if (r.data.ok !== true) return { ok: false, error: String(r.data.error ?? 'error') };
      return { ok: true, name: String(r.data.name ?? ''), ...(typeof r.data.key === 'string' ? { key: r.data.key } : {}) };
    },
    duelCancel: async () => {
      await call('/duel/cancel', {});
    },
  };
  return repo;
}

let cached: { base: string; repo: FriendsRepository } | null = null;
/** Repositorio del servidor configurado (uno por dirección); null sin servidor. */
export function serverFriendsRepo(profile: () => FriendsProfile): FriendsRepository | null {
  const base = serverUrl();
  if (!base) return null;
  if (cached?.base !== base) cached = { base, repo: serverFriends(base, profile) };
  return cached.repo;
}
