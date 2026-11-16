/**
 * AMIGOS (21-11-2026): datos puros (sin Phaser ni DOM) de la lista de amigos y las solicitudes.
 *
 * Los amigos son de la CUENTA y los valida el servidor, igual que lo comprado (docs/BASE-DE-DATOS.md). Todavía no hay cuentas, motor de base de
 * datos ni inicio de sesión (decisión pendiente del usuario): por eso la pantalla (ui/FriendsDialog.ts) solo habla con un `FriendsRepository`.
 * Hoy se usa `offlineFriends` (sin cuenta: lista vacía, `available = false`) y, solo en modo desarrollo, `sampleFriends` para ver el diseño.
 * Cuando haya servidor se escribe otro repositorio con la misma forma y no se toca la pantalla.
 */
import type { RankId } from './ranks';

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

export interface FriendRequest {
  id: string;
  name: string;
  level: number;
  skin: string;
  league: RankId;
}

export interface FriendsSnapshot {
  /** false = aún no hay cuentas: la pantalla avisa y desactiva las acciones */
  available: boolean;
  friends: FriendEntry[];
  /** solicitudes que te llegaron */
  requests: FriendRequest[];
}

export interface FriendsRepository {
  load(): FriendsSnapshot;
  /** acepta o rechaza una solicitud recibida (el servidor decide; devuelve la lista nueva) */
  answer(requestId: string, accept: boolean): FriendsSnapshot;
  /** quita a un amigo */
  remove(friendId: string): FriendsSnapshot;
}

/** Sin cuenta: nada que mostrar y ninguna acción posible. */
export const offlineFriends: FriendsRepository = {
  load: () => ({ available: false, friends: [], requests: [] }),
  answer: () => offlineFriends.load(),
  remove: () => offlineFriends.load(),
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
  let state: FriendsSnapshot = {
    available: true,
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
  };
  return {
    load: () => state,
    answer: (id, accept) => {
      const rq = state.requests.find((r) => r.id === id);
      state = {
        ...state,
        requests: state.requests.filter((r) => r.id !== id),
        friends: accept && rq ? [...state.friends, { id: rq.id, name: rq.name, level: rq.level, skin: rq.skin, league: rq.league, status: 'online' }] : state.friends,
      };
      return state;
    },
    remove: (id) => (state = { ...state, friends: state.friends.filter((f) => f.id !== id) }),
  };
}
