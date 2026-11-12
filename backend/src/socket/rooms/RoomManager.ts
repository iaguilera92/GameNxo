/**
 * Salas 1v1 y matchmaking (lógica pura, sin Socket.IO: se prueba con test/rooms.test.ts).
 *
 * Reglas:
 *  - Máximo 2 jugadores. Una sala completa nunca acepta un tercero.
 *  - Un jugador solo puede estar en UNA sala (buscando o jugando).
 *  - JUGAR: si hay una sala WAITING de otro jugador, se une (la más antigua) → FULL → PLAYING al instante.
 *    Si no, crea una WAITING (1/2) con un temporizador del SERVIDOR (searchTimeoutMs). Al vencer sin rival,
 *    la sala se borra (sin salas fantasma) y se avisa "sin rival".
 *  - Node procesa los eventos de uno en uno: dos JUGAR casi simultáneos se resuelven en orden de llegada
 *    (el primero crea, el segundo se une). No hay ventana en la que ambos creen sala.
 *  - La sala se libera solo al terminar el partido (marcador oficial), por abandono o por desconexión.
 *    No hay límite de tiempo de partido.
 */
import { randomUUID } from 'node:crypto';
import type { PlayerProfile, Role } from '../events/protocol.js';
import { type ScoreState, newScore, scorePoint } from './score.js';

export type RoomStatus = 'WAITING' | 'FULL' | 'PLAYING' | 'FINISHED';

export interface RoomPlayer {
  id: string;
  profile: PlayerProfile;
  ready: boolean;
  /** clave secreta para RECONECTAR a esta sala tras un corte (se le da al emparejar) */
  token: string;
  /** desconectado y esperando a que reconecte (el partido sigue reservado unos segundos) */
  away?: boolean;
}

export interface RoomResult {
  winner: Role;
  reason: 'score' | 'abandon' | 'disconnect' | 'timeout';
  games: { host: number; guest: number };
}

export interface Room {
  id: string;
  status: RoomStatus;
  /** [host, guest] */
  players: RoomPlayer[];
  createdAt: number;
  score: ScoreState;
  result: RoomResult | null;
  /** último número de secuencia de POINT aplicado por cada emisor (ignora duplicados) */
  pointSeq: Record<string, number>;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(h: unknown): void;
}

export interface RoomEvents {
  /** búsqueda sin rival al vencer el tiempo (la sala ya se borró) */
  onTimeout(playerId: string, roomId: string): void;
}

export type FindResult =
  | { type: 'waiting'; room: Room }
  | { type: 'matched'; room: Room }
  | { type: 'error'; code: 'already_searching' | 'already_in_room' };

export interface RoomRules {
  searchTimeoutMs: number;
  gamesToWin: number;
  goldenPoint: boolean;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  /** jugador -> sala en la que está */
  private playerRoom = new Map<string, string>();
  private searchTimers = new Map<string, unknown>();

  constructor(
    private rules: RoomRules,
    private events: RoomEvents,
    private timers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as NodeJS.Timeout) },
    private now: () => number = () => Date.now(),
  ) {}

  get(roomId: string) {
    return this.rooms.get(roomId);
  }

  roomOf(playerId: string): Room | undefined {
    const id = this.playerRoom.get(playerId);
    return id ? this.rooms.get(id) : undefined;
  }

  get stats() {
    const by: Record<RoomStatus, number> = { WAITING: 0, FULL: 0, PLAYING: 0, FINISHED: 0 };
    for (const r of this.rooms.values()) by[r.status]++;
    return { rooms: this.rooms.size, players: this.playerRoom.size, ...by };
  }

  roleOf(room: Room, playerId: string): Role | null {
    const i = room.players.findIndex((p) => p.id === playerId);
    return i === 0 ? 'host' : i === 1 ? 'guest' : null;
  }

  opponentOf(room: Room, playerId: string): RoomPlayer | undefined {
    return room.players.find((p) => p.id !== playerId);
  }

  /** JUGAR: unirse a una sala en espera o crear una. */
  find(playerId: string, profile: PlayerProfile): FindResult {
    const cur = this.roomOf(playerId);
    if (cur) return { type: 'error', code: cur.status === 'WAITING' ? 'already_searching' : 'already_in_room' };
    // la sala en espera más antigua de OTRO jugador
    let target: Room | undefined;
    for (const r of this.rooms.values())
      if (r.status === 'WAITING' && r.players.length === 1 && r.players[0].id !== playerId && (!target || r.createdAt < target.createdAt)) target = r;
    if (target) {
      this.clearSearch(target.id);
      target.players.push({ id: playerId, profile, ready: false, token: randomUUID() });
      target.status = 'FULL';
      this.playerRoom.set(playerId, target.id);
      // completa: empieza sin confirmaciones (FULL -> PLAYING)
      target.status = 'PLAYING';
      return { type: 'matched', room: target };
    }
    const room: Room = {
      id: randomUUID(),
      status: 'WAITING',
      players: [{ id: playerId, profile, ready: false, token: randomUUID() }],
      createdAt: this.now(),
      score: newScore(),
      result: null,
      pointSeq: {},
    };
    this.rooms.set(room.id, room);
    this.playerRoom.set(playerId, room.id);
    this.searchTimers.set(
      room.id,
      this.timers.set(() => this.expire(room.id), this.rules.searchTimeoutMs),
    );
    return { type: 'waiting', room };
  }

  /** Vence la búsqueda: si sigue sin rival, se borra la sala y se avisa. */
  private expire(roomId: string) {
    this.searchTimers.delete(roomId);
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'WAITING') return;
    const pid = room.players[0].id;
    this.release(room);
    this.events.onTimeout(pid, roomId);
  }

  private clearSearch(roomId: string) {
    const h = this.searchTimers.get(roomId);
    if (h !== undefined) this.timers.clear(h);
    this.searchTimers.delete(roomId);
  }

  /** Cancelar la búsqueda (solo en WAITING). true = se canceló. */
  cancel(playerId: string): boolean {
    const room = this.roomOf(playerId);
    if (!room || room.status !== 'WAITING') return false;
    this.release(room);
    return true;
  }

  /** Cliente listo (escena cargada). Devuelve true cuando ya están los dos. */
  ready(playerId: string): { room: Room; all: boolean } | null {
    const room = this.roomOf(playerId);
    if (!room || room.status !== 'PLAYING') return null;
    const p = room.players.find((x) => x.id === playerId);
    if (p) p.ready = true;
    return { room, all: room.players.length === 2 && room.players.every((x) => x.ready) };
  }

  /**
   * Punto avisado por el juez de la pelota. `toMe`: el punto es para el emisor.
   * Devuelve el marcador y, si el partido terminó, el resultado (la sala queda FINISHED y se libera con finish()).
   */
  point(playerId: string, seq: number, toMe: boolean): { room: Room; matchOver: boolean } | null {
    const room = this.roomOf(playerId);
    if (!room || room.status !== 'PLAYING') return null;
    const role = this.roleOf(room, playerId);
    if (!role) return null;
    if ((room.pointSeq[playerId] ?? -1) >= seq) return { room, matchOver: false }; // repetido
    room.pointSeq[playerId] = seq;
    const me = role === 'host' ? 0 : 1;
    const w = (toMe ? me : 1 - me) as 0 | 1;
    const out = scorePoint(room.score, w, this.rules.gamesToWin, this.rules.goldenPoint);
    if (out.matchWinner !== null) {
      room.status = 'FINISHED';
      room.result = { winner: out.matchWinner === 0 ? 'host' : 'guest', reason: 'score', games: this.gamesOf(room) };
      return { room, matchOver: true };
    }
    return { room, matchOver: false };
  }

  /**
   * El partido superó la duración máxima: se cierra la sala. Gana quien vaya arriba en juegos y, si empatan,
   * en puntos del juego actual; con empate total, el host. Devuelve null si ya no estaba en juego.
   */
  endByTimeout(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'PLAYING') return null;
    const [gh, gg] = room.score.games;
    const [ph, pg] = room.score.points;
    const hostAhead = gh !== gg ? gh > gg : ph >= pg;
    room.status = 'FINISHED';
    room.result = { winner: hostAhead ? 'host' : 'guest', reason: 'timeout', games: this.gamesOf(room) };
    return room;
  }

  gamesOf(room: Room) {
    return { host: room.score.games[0], guest: room.score.games[1] };
  }

  /**
   * Un jugador abandona (rendición) o se desconecta. En búsqueda: se cancela. En partido: gana el rival y la
   * sala queda FINISHED (luego finish()). Devuelve la sala afectada y al rival a avisar.
   */
  leave(playerId: string, reason: 'abandon' | 'disconnect'): { room: Room; opponent?: RoomPlayer; wasPlaying: boolean } | null {
    const room = this.roomOf(playerId);
    if (!room) return null;
    if (room.status === 'WAITING') {
      this.release(room);
      return { room, wasPlaying: false };
    }
    const opponent = this.opponentOf(room, playerId);
    if (room.status !== 'FINISHED') {
      const role = this.roleOf(room, playerId);
      room.status = 'FINISHED';
      room.result = { winner: role === 'host' ? 'guest' : 'host', reason, games: this.gamesOf(room) };
    }
    return { room, opponent, wasPlaying: true };
  }

  /**
   * RECONEXIÓN — el jugador se cortó en pleno partido: queda "ausente" (su sitio se guarda) en vez de perder.
   * Devuelve la sala y al rival a avisar; null si no estaba jugando.
   */
  markAway(playerId: string): { room: Room; player: RoomPlayer; opponent?: RoomPlayer } | null {
    const room = this.roomOf(playerId);
    if (!room || room.status !== 'PLAYING') return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;
    player.away = true;
    return { room, player, opponent: this.opponentOf(room, playerId) };
  }

  /**
   * RECONEXIÓN — vuelve con otra conexión (`newId`) y su clave: recupera su sitio en la sala. null si la sala ya no
   * está en juego, la clave no es de un jugador ausente o la nueva conexión ya está en otra sala.
   */
  rejoin(roomId: string, token: string, newId: string): { room: Room; player: RoomPlayer; opponent?: RoomPlayer } | null {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'PLAYING' || typeof token !== 'string') return null;
    const player = room.players.find((p) => p.token === token);
    if (!player || !player.away) return null;
    const cur = this.playerRoom.get(newId);
    if (cur && cur !== roomId) return null;
    if (this.playerRoom.get(player.id) === room.id) this.playerRoom.delete(player.id);
    player.id = newId;
    player.away = false;
    this.playerRoom.set(newId, room.id);
    return { room, player, opponent: this.opponentOf(room, newId) };
  }

  /** Libera una sala terminada: borra la sala y los jugadores quedan libres para buscar otra. */
  finish(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) this.release(room);
  }

  private release(room: Room) {
    this.clearSearch(room.id);
    for (const p of room.players) if (this.playerRoom.get(p.id) === room.id) this.playerRoom.delete(p.id);
    this.rooms.delete(room.id);
  }
}
