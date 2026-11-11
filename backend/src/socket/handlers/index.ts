/**
 * Manejadores Socket.IO: matchmaking, reenvío de mensajes del partido, marcador oficial y desconexiones.
 * La lógica de salas vive en RoomManager (sin Socket.IO); aquí solo se traducen eventos y se avisa a los clientes.
 *
 * Defensa (ver socket/guard.ts): todo mensaje del cliente se valida y se reconstruye antes de reenviarlo, hay
 * límite de mensajes por segundo y por tipo, y un error en un manejador no tumba el proceso (ni los demás partidos).
 */
import type { Server, Socket } from 'socket.io';
import { CONFIG } from '../../config/env.js';
import { RoomManager, type Room } from '../rooms/RoomManager.js';
import { SocketLimiter, sanitizeAction, sanitizeHit, sanitizePoint, sanitizeState, type LimitKey } from '../guard.js';
import {
  EV,
  type FindRequest,
  type MatchedMsg,
  type OverMsg,
  type ScoreMsg,
  type SearchingMsg,
} from '../events/protocol.js';

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

/** apagado ordenado: no se aceptan búsquedas nuevas, los partidos en curso terminan */
let draining = false;
export const setDraining = (v: boolean) => {
  draining = v;
};

/** IP real del jugador (detrás de nginx / ALB solo se confía en X-Forwarded-For si TRUST_PROXY=1) */
const clientIp = (socket: Socket) => {
  if (CONFIG.trustProxy) {
    const xf = socket.handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(xf) ? xf[0] : xf)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address;
};

export function registerSocketHandlers(io: Server) {
  const rooms = new RoomManager(
    { searchTimeoutMs: CONFIG.searchTimeoutMs, gamesToWin: CONFIG.gamesToWin, goldenPoint: CONFIG.goldenPoint },
    {
      onTimeout(playerId, roomId) {
        log(`búsqueda sin rival ${short(playerId)} (sala ${short(roomId)} borrada)`);
        io.to(playerId).emit(EV.TIMEOUT, {});
      },
    },
  );
  const readyTimers = new Map<string, NodeJS.Timeout>();
  /** duración máxima de cada partido en curso */
  const matchTimers = new Map<string, NodeJS.Timeout>();

  const scoreMsg = (room: Room): ScoreMsg => ({
    points: { host: room.score.points[0], guest: room.score.points[1] },
    games: { host: room.score.games[0], guest: room.score.games[1] },
  });

  /** Fin oficial: avisa a los dos y libera la sala. */
  const finish = (room: Room) => {
    if (!room.result) return;
    const msg: OverMsg = { winner: room.result.winner, reason: room.result.reason, games: room.result.games };
    for (const p of room.players) io.to(p.id).emit(EV.OVER, msg);
    for (const timers of [readyTimers, matchTimers]) {
      const t = timers.get(room.id);
      if (t) clearTimeout(t);
      timers.delete(room.id);
    }
    log(`sala ${short(room.id)} terminada: gana ${msg.winner} (${msg.reason}) ${msg.games.host}-${msg.games.guest}`);
    rooms.finish(room.id);
    started.delete(room.id);
  };

  const started = new Set<string>();
  const start = (room: Room) => {
    if (started.has(room.id)) return; // una sola vez por sala
    started.add(room.id);
    const t = readyTimers.get(room.id);
    if (t) clearTimeout(t);
    readyTimers.delete(room.id);
    for (const p of room.players) io.to(p.id).emit(EV.START, { roomId: room.id });
    matchTimers.set(
      room.id,
      setTimeout(() => {
        const r = rooms.endByTimeout(room.id);
        if (!r) return;
        log(`sala ${short(room.id)} supera ${CONFIG.maxMatchMs} ms: se cierra por tiempo`);
        finish(r);
      }, CONFIG.maxMatchMs),
    );
    log(`sala ${short(room.id)}: empieza el partido`);
  };

  io.on('connection', (socket: Socket) => {
    log(`conectado ${short(socket.id)} desde ${clientIp(socket)}`);
    const limiter = new SocketLimiter();

    /** Envuelve un manejador: límite de mensajes + un fallo aquí no tumba el servidor. */
    const guarded =
      <T>(key: LimitKey, fn: (data: T) => void) =>
      (data: T) => {
        if (!limiter.allow(key, Date.now())) {
          if (limiter.abusive()) {
            log(`desconectado por exceso de mensajes ${short(socket.id)}`);
            socket.disconnect(true);
          }
          return;
        }
        try {
          fn(data);
        } catch (e) {
          log(`error en manejador de ${short(socket.id)}:`, e);
        }
      };

    socket.on(
      EV.FIND,
      guarded<FindRequest>('ctl', (req) => {
        if (draining) {
          socket.emit(EV.ERROR, { code: 'maintenance', message: 'Servidor en mantenimiento' });
          return;
        }
        const profile = req?.profile;
        if (!profile || typeof profile.name !== 'string') {
          socket.emit(EV.ERROR, { code: 'invalid', message: 'Perfil inválido' });
          return;
        }
        const rawZone: Record<string, unknown> = profile.zoneStats && typeof profile.zoneStats === 'object' ? profile.zoneStats : {};
        const clampZone = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(20, Math.floor(Number(value)))) : 0;
        // efecto de carga elegido (solo cosmético): si no es uno conocido se omite y el rival usa el de su personaje
        const charge = typeof profile.charge === 'string' && ['classic', 'fire', 'energy', 'tulip'].includes(profile.charge) ? profile.charge : undefined;
        const clean = {
          name: profile.name.slice(0, 16),
          level: Math.max(1, Math.floor(Number(profile.level) || 1)),
          skin: String(profile.skin ?? 'nxo').slice(0, 16),
          ...(charge ? { charge } : {}),
          zoneStats: {
            strength: clampZone(rawZone.strength),
            speed: clampZone(rawZone.speed),
            precision: clampZone(rawZone.precision),
            agility: clampZone(rawZone.agility),
            resistance: clampZone(rawZone.resistance),
          },
        };
        const res = rooms.find(socket.id, clean);
        if (res.type === 'error') {
          socket.emit(EV.ERROR, { code: res.code, message: res.code === 'already_searching' ? 'Ya estás buscando partida' : 'Ya estás en una partida' });
          return;
        }
        const room = res.room;
        if (res.type === 'waiting') {
          const msg: SearchingMsg = { roomId: room.id, timeoutMs: CONFIG.searchTimeoutMs, players: 1 };
          socket.emit(EV.SEARCHING, msg);
          log(`buscando ${short(socket.id)} (${clean.name}) sala ${short(room.id)} 1/2`);
          return;
        }
        // emparejados: los dos pasan al partido sin confirmaciones
        const [host, guest] = room.players;
        const toHost: MatchedMsg = { roomId: room.id, role: 'host', opponent: guest.profile, gamesToWin: CONFIG.gamesToWin };
        const toGuest: MatchedMsg = { roomId: room.id, role: 'guest', opponent: host.profile, gamesToWin: CONFIG.gamesToWin };
        io.to(host.id).emit(EV.MATCHED, toHost);
        io.to(guest.id).emit(EV.MATCHED, toGuest);
        log(`emparejados ${host.profile.name} vs ${guest.profile.name} sala ${short(room.id)} 2/2 → PLAYING`);
        // si alguno no llega a cargar, se empieza igualmente al vencer la espera
        readyTimers.set(
          room.id,
          setTimeout(() => {
            const r = rooms.get(room.id);
            if (r && r.status === 'PLAYING') start(r);
          }, CONFIG.readyTimeoutMs),
        );
      }),
    );

    socket.on(
      EV.CANCEL,
      guarded('ctl', () => {
        if (rooms.cancel(socket.id)) {
          socket.emit(EV.CANCELLED, {});
          log(`búsqueda cancelada ${short(socket.id)}`);
        }
      }),
    );

    socket.on(
      EV.READY,
      guarded('ctl', () => {
        const r = rooms.ready(socket.id);
        if (r?.all) start(r.room);
      }),
    );

    // reenvío al rival (solo si el emisor está jugando en esa sala). El mensaje se valida y se reconstruye: lo
    // inválido se descarta. STATE va "volatile": si la red del rival va justa, un estado viejo se tira (el siguiente
    // llega en 50 ms) en vez de encolarse y llegar tarde en bloque.
    const relay = <T>(ev: string, key: LimitKey, sanitize: (d: unknown) => T | null, volatile = false) =>
      guarded<unknown>(key, (raw) => {
        const data = sanitize(raw);
        if (!data) return;
        const room = rooms.roomOf(socket.id);
        if (!room || room.status !== 'PLAYING') return;
        const opp = rooms.opponentOf(room, socket.id);
        if (!opp) return;
        (volatile ? io.to(opp.id).volatile : io.to(opp.id)).emit(ev, data);
      });
    socket.on(EV.STATE, relay(EV.STATE, 'state', sanitizeState, true));
    socket.on(EV.HIT, relay(EV.HIT, 'hit', sanitizeHit));
    socket.on(EV.ACTION, relay(EV.ACTION, 'action', sanitizeAction));

    // punto del juez de la pelota: marcador oficial + reenvío al rival
    socket.on(
      EV.POINT,
      guarded<unknown>('point', (raw) => {
        const msg = sanitizePoint(raw);
        const room = rooms.roomOf(socket.id);
        if (!msg || !room || room.status !== 'PLAYING') return;
        const opp = rooms.opponentOf(room, socket.id);
        if (opp) io.to(opp.id).emit(EV.POINT, msg);
        if (msg.kind !== 'point') return; // faltas y let no suman en el marcador oficial
        const res = rooms.point(socket.id, msg.seq, msg.to === 'me');
        if (!res) return;
        const sc = scoreMsg(res.room);
        for (const p of res.room.players) io.to(p.id).emit(EV.SCORE, sc);
        if (res.matchOver) finish(res.room);
      }),
    );

    const leave = (reason: 'abandon' | 'disconnect') => {
      const r = rooms.leave(socket.id, reason);
      if (!r) return;
      if (!r.wasPlaying) {
        log(`búsqueda terminada por ${reason} ${short(socket.id)}`);
        return;
      }
      if (r.opponent) io.to(r.opponent.id).emit(EV.OPPONENT_LEFT, { reason });
      finish(r.room);
    };
    socket.on(
      EV.LEAVE,
      guarded('ctl', () => leave('abandon')),
    );
    socket.on('disconnect', () => {
      log(`desconectado ${short(socket.id)}`);
      try {
        leave('disconnect');
      } catch (e) {
        log(`error al liberar la sala de ${short(socket.id)}:`, e);
      }
    });
  });

  return rooms;
}

const short = (id: string) => id.slice(0, 6);
