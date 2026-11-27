/**
 * AMIGOS (21-11-2026): datos puros (sin Phaser ni DOM) de la lista de amigos y las solicitudes.
 *
 * Los amigos son de la CUENTA y los valida el servidor, igual que lo comprado (docs/BASE-DE-DATOS.md). Todavía no hay cuentas, motor de base de
 * datos ni inicio de sesión (decisión pendiente del usuario): por eso la pantalla (ui/FriendsDialog.ts) solo habla con un `FriendsRepository`.
 * Hoy se usa `offlineFriends` (sin cuenta: lista vacía, `available = false`) y, solo en modo desarrollo, `sampleFriends` para ver el diseño.
 * Cuando haya servidor se escribe otro repositorio con la misma forma y no se toca la pantalla.
 */
import type { RankId } from './ranks';
import { cycleIdAt, pickWeighted } from './dailyWheel';
import { addCoins, addXp } from './operations';
import { addCoins2v2 } from './coins2v2';
import type { PlayerState } from './player';

/** dónde está un amigo ahora mismo */
export type FriendStatus = 'online' | 'match' | 'offline';

export interface FriendEntry {
  /** id de la cuenta del amigo (fijo) */
  id: string;
  name: string;
  level: number;
  /** personaje elegido (skin) */
  skin: string;
  league: RankId;
  status: FriendStatus;
  /** hace cuántos minutos se conectó por última vez (solo con status 'offline') */
  lastSeenMin?: number;
}

/** (27-11-2026) jugador sugerido (registrado en el servidor, aún no es tu amigo): con su número (#111) */
export interface FriendSuggestion extends FriendEntry {
  tag: string;
  /** (27-11-2026) jugaron juntos en línea: rival (1v1) o compañero (2v2); estos salen siempre primero */
  met?: 'rival' | 'mate';
}

export interface FriendRequest {
  id: string;
  name: string;
  level: number;
  skin: string;
  league: RankId;
}

export interface FriendsSnapshot {
  /** false = sin cuentas o sin conexión con el servidor: la pantalla avisa y desactiva las acciones */
  available: boolean;
  /** (27-11-2026) true = hay servidor pero no respondió (el aviso dice "sin conexión") */
  offline?: boolean;
  /** (27-11-2026) tu código para que te agreguen: NOMBRE#111 (lo da el servidor; los números empiezan en 111) */
  code?: string;
  friends: FriendEntry[];
  /** solicitudes que te llegaron */
  requests: FriendRequest[];
  /** (27-11-2026) regalos que te enviaron tus amigos y aún no abres (salen en el menú) */
  gifts: FriendGift[];
  /** (27-11-2026) día (ciclo 23:59 Chile) en que enviaste regalo a cada amigo: uno por amigo y día */
  giftSent: Record<string, string>;
}

/** respuesta de una acción: la lista nueva, o un error (códigos del servidor: not_found, self, already_friends, already_sent, full, gift_sent, invalid, net) */
export type FriendsReply = { ok: true; snap: FriendsSnapshot; name?: string } | { ok: false; error: string; snap: FriendsSnapshot };

/** Texto corto para cada error de AMIGOS. */
export function friendsErrorText(e: string): string {
  const t: Record<string, string> = {
    not_found: 'No existe ese código',
    self: 'Ese es tu código',
    already_friends: 'Ya son amigos',
    already_sent: 'Ya le enviaste solicitud',
    full: 'Lista llena',
    gift_sent: 'Ya le enviaste un regalo hoy',
    not_friend: 'Ya no es tu amigo',
    invalid: 'Código no válido (ej: Nacho#123)',
    net: 'Sin conexión con el servidor',
    offline: 'Tu amigo no está en línea',
    expired: 'El reto ya venció',
  };
  return t[e] ?? 'No se pudo, prueba otra vez';
}

/**
 * (27-11-2026, usuario) REGALO DE UN AMIGO: monedas sorpresa (1v1 o 2V2, las mismas cantidades que el REGALO GRATIS de la tienda). Enviarlo
 * no cuesta nada; se puede enviar uno por amigo y día. El contenido lo decide el servidor al enviarlo.
 */
export interface FriendGift {
  id: string;
  fromName: string;
  /** (27-11-2026) también EXP y DINERO */
  kind: FriendGiftKind;
  amount: number;
}
export type FriendGiftKind = 'coins' | 'coins2v2' | 'xp' | 'cash';
/** mismas opciones que el servidor (backend friendsStore GIFT_OPTIONS): para el botón TEST y los ejemplos */
export const FRIEND_GIFT_OPTIONS: { kind: FriendGiftKind; amount: number; weight: number }[] = [
  { kind: 'coins', amount: 10, weight: 30 },
  { kind: 'coins', amount: 15, weight: 15 },
  { kind: 'coins', amount: 25, weight: 5 },
  { kind: 'coins2v2', amount: 5, weight: 30 },
  { kind: 'coins2v2', amount: 8, weight: 15 },
  { kind: 'coins2v2', amount: 10, weight: 5 },
  { kind: 'xp', amount: 20, weight: 20 },
  { kind: 'xp', amount: 40, weight: 8 },
  { kind: 'cash', amount: 1, weight: 6 },
  { kind: 'cash', amount: 2, weight: 2 },
];

/** ¿ya le enviaste regalo hoy a este amigo? */
export function giftSentToday(snap: FriendsSnapshot, friendId: string, now: number): boolean {
  return snap.giftSent[friendId] === cycleIdAt(now);
}

/** suma al jugador lo que traía un regalo abierto */
export function applyFriendGift(s: PlayerState, g: FriendGift): { ok: true; state: PlayerState } | { ok: false; error: string } {
  const amt = Math.max(0, Math.min(1000, Math.floor(g.amount) || 0));
  if (g.kind === 'coins2v2') return { ok: true, state: addCoins2v2(s, amt) };
  if (g.kind === 'cash') return { ok: true, state: { ...s, gems: s.gems + amt } };
  if (g.kind === 'xp') {
    const r = addXp(s, amt);
    return r.ok ? { ok: true, state: r.state } : { ok: false, error: 'xp' };
  }
  const r = addCoins(s, g.amount);
  return r.ok ? { ok: true, state: r.state } : { ok: false, error: 'coins' };
}

/** contenido sorpresa de un regalo (`rng` en [0, 1)) */
export function rollFriendGift(rng: () => number = Math.random): Pick<FriendGift, 'kind' | 'amount'> {
  const p = pickWeighted(FRIEND_GIFT_OPTIONS, rng);
  return { kind: p.kind, amount: p.amount };
}

/**
 * Contrato de la pantalla con quien guarda los amigos. `load` devuelve lo último que se sabe (al instante); lo demás va al servidor
 * (asíncrono) y devuelve la lista nueva.
 */
export interface FriendsRepository {
  load(): FriendsSnapshot;
  /** pide la lista al servidor (y lo marca en línea) */
  refresh(): Promise<FriendsSnapshot>;
  /** envía una solicitud por código NOMBRE#111 */
  add(code: string): Promise<FriendsReply>;
  /** acepta o rechaza una solicitud recibida */
  answer(requestId: string, accept: boolean): Promise<FriendsReply>;
  /** quita a un amigo */
  remove(friendId: string): Promise<FriendsReply>;
  /** envía un regalo a un amigo (uno por amigo y día) */
  sendGift(friendId: string, now: number): Promise<FriendsReply>;
  /** abre un regalo recibido: lo quita de la lista y devuelve qué traía (null si ya no está o sin conexión) */
  takeGift(giftId: string): Promise<FriendGift | null>;
  /** (27-11-2026) SUGERENCIAS: jugadores registrados que aún no son tus amigos (null = sin conexión) */
  suggestions?(): Promise<FriendSuggestion[] | null>;
  /** solicitud por id público (AGREGAR en SUGERENCIAS) */
  addById?(playerId: string): Promise<FriendsReply>;
  /** SOLO DESARROLLO (botón TEST): te llega un regalo de un amigo de prueba (local) */
  devReceiveGift?(): FriendsSnapshot;
  // (27-11-2026) DUELO entre amigos (solo con servidor; ui/DuelDialogs.ts)
  /** reta a un amigo en línea (`waitS`: segundos que faltan si te rechazó hace poco) */
  duel?(friendId: string): Promise<{ ok: true; duelId: string; ttlMs: number } | { ok: false; error: string; waitS?: number }>;
  /** retos recibidos y la respuesta a tu reto (null = sin conexión) */
  duelPoll?(): Promise<DuelPoll | null>;
  /** acepta (devuelve la clave de la sala privada) o rechaza un reto */
  duelAnswer?(duelId: string, accept: boolean): Promise<{ ok: true; key?: string; name: string } | { ok: false; error: string }>;
  /** retira tu reto */
  duelCancel?(): Promise<void>;
}

export interface DuelPoll {
  incoming: { id: string; fromName: string; msLeft: number }[];
  out: { id: string; toName: string; state: 'pending' | 'accepted' | 'rejected' | 'expired'; key?: string } | null;
}

const EMPTY: FriendsSnapshot = { available: false, friends: [], requests: [], gifts: [], giftSent: {} };
/** Sin servidor ni modo desarrollo: nada que mostrar y ninguna acción posible. */
export const offlineFriends: FriendsRepository = {
  load: () => EMPTY,
  refresh: async () => EMPTY,
  add: async () => ({ ok: false, error: 'net', snap: EMPTY }),
  answer: async () => ({ ok: false, error: 'net', snap: EMPTY }),
  remove: async () => ({ ok: false, error: 'net', snap: EMPTY }),
  sendGift: async () => ({ ok: false, error: 'net', snap: EMPTY }),
  takeGift: async () => null,
};

/** Texto de estado de un amigo ("EN LÍNEA", "EN PARTIDA", "HACE 5 MIN"…). */
export function friendStatusText(f: FriendEntry): string {
  if (f.status === 'online') return 'EN LÍNEA';
  if (f.status === 'match') return 'EN PARTIDA';
  const m = f.lastSeenMin;
  if (m == null) return 'DESCONECTADO';
  if (m < 60) return `HACE ${Math.max(1, m)} MIN`;
  if (m < 60 * 24) return `HACE ${Math.floor(m / 60)} H`;
  return `HACE ${Math.floor(m / 1440)} D`;
}

/** Los conectados primero (en línea, luego en partida), después por última conexión y nombre. Determinista. */
export function sortFriends(list: readonly FriendEntry[]): FriendEntry[] {
  const rank = (f: FriendEntry) => (f.status === 'online' ? 0 : f.status === 'match' ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.lastSeenMin ?? 0) - (b.lastSeenMin ?? 0) || a.name.localeCompare(b.name, 'es'));
}

/** SOLO DESARROLLO: amigos y solicitudes de ejemplo para revisar el diseño (los estados y ligas cubren todos los casos). */
export function sampleFriends(): FriendsRepository {
  let testN = 0;
  let state: FriendsSnapshot = {
    available: true,
    code: 'Demo#111',
    friends: [
      { id: 'a1', name: 'Mai_Fan', level: 14, skin: 'mai', league: 'gold', status: 'online' },
      { id: 'a2', name: 'Rodri', level: 20, skin: 'nxo', league: 'diamond', status: 'match' },
      { id: 'a3', name: 'Cata', level: 9, skin: 'mai', league: 'silver', status: 'online' },
      { id: 'a4', name: 'Tomás', level: 17, skin: 'nxo', league: 'platinum', status: 'offline', lastSeenMin: 25 },
      { id: 'a5', name: 'Fer', level: 6, skin: 'nxo', league: 'bronze', status: 'offline', lastSeenMin: 300 },
      { id: 'a6', name: 'Javi', level: 12, skin: 'nxo', league: 'gold', status: 'offline', lastSeenMin: 3000 },
      { id: 'a7', name: 'Pau', level: 20, skin: 'mai', league: 'challenger', status: 'online' },
      { id: 'a8', name: 'Nacho', level: 3, skin: 'nxo', league: 'bronze', status: 'offline', lastSeenMin: 9000 },
    ],
    requests: [
      { id: 'r1', name: 'Dani', level: 11, skin: 'nxo', league: 'silver' },
      { id: 'r2', name: 'Vale', level: 15, skin: 'mai', league: 'gold' },
    ],
    gifts: [{ id: 'g1', fromName: 'Mai_Fan', ...rollFriendGift() }],
    giftSent: {},
  };
  const ok = (snap: FriendsSnapshot): FriendsReply => ({ ok: true, snap });
  return {
    load: () => state,
    refresh: async () => state,
    add: async (code) => ({ ok: false, error: code.includes('#') ? 'not_found' : 'invalid', snap: state }),
    answer: async (id, accept) => {
      const rq = state.requests.find((r) => r.id === id);
      state = {
        ...state,
        requests: state.requests.filter((r) => r.id !== id),
        friends: accept && rq ? [...state.friends, { id: rq.id, name: rq.name, level: rq.level, skin: rq.skin, league: rq.league, status: 'online' }] : state.friends,
      };
      return ok(state);
    },
    remove: async (id) => ok((state = { ...state, friends: state.friends.filter((f) => f.id !== id) })),
    sendGift: async (id, now) => ok((state = { ...state, giftSent: { ...state.giftSent, [id]: cycleIdAt(now) } })),
    takeGift: async (id) => {
      const g = state.gifts.find((x) => x.id === id) ?? null;
      state = { ...state, gifts: state.gifts.filter((x) => x.id !== id) };
      return g;
    },
    devReceiveGift: () => (state = { ...state, gifts: [...state.gifts, { id: `t${++testN}`, fromName: 'Amigo_Test', ...rollFriendGift() }] }),
    suggestions: async () => [
      { id: 's1', name: 'Lucho', tag: '214', level: 8, skin: 'nxo', league: 'silver', status: 'online', met: 'rival' },
      { id: 's3', name: 'Feña', tag: '305', level: 9, skin: 'mai', league: 'silver', status: 'offline', lastSeenMin: 200, met: 'mate' },
      { id: 's2', name: 'Anto', tag: '187', level: 11, skin: 'mai', league: 'gold', status: 'offline', lastSeenMin: 40 },
    ],
    addById: async () => ok(state),
  };
}
