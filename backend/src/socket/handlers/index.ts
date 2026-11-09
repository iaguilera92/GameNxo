/**
 * Manejadores Socket.IO: matchmaking, reenvío de mensajes del partido, marcador oficial y desconexiones.
 * La lógica de salas vive en RoomManager (sin Socket.IO); aquí solo se traducen eventos y se avisa a los clientes.
 */
import type { Server, Socket } from 'socket.io';
import { CONFIG } from '../../config/env.js';
import { RoomManager, type Room } from '../rooms/RoomManager.js';
import {
  EV,
  type ActionMsg,
  type FindRequest,
  type HitMsg,
  type MatchedMsg,
  type OverMsg,
  type PointMsg,
  type ScoreMsg,
  type SearchingMsg,
  type StateMsg,
} from '../events/protocol.js';

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

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

  const scoreMsg = (room: Room): ScoreMsg => ({
    points: { host: room.score.points[0], guest: room.score.points[1] },
    games: { host: room.score.games[0], guest: room.score.games[1] },
  });

  /** Fin oficial: avisa a los dos y libera la sala. */
  const finish = (room: Room) => {
    if (!room.result) return;
    const msg: OverMsg = { winner: room.result.winner, reason: room.result.reason, games: room.result.games };
    for (const p of room.players) io.to(p.id).emit(EV.OVER, msg);
    const t = readyTimers.get(room.id);
    if (t) clearTimeout(t);
    readyTimers.delete(room.id);
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
    log(`sala ${short(room.id)}: empieza el partido`);
  };

  io.on('connection', (socket: Socket) => {
    log(`conectado ${short(socket.id)} desde ${socket.handshake.address}`);

    socket.on(EV.FIND, (req: FindRequest) => {
      const profile = req?.profile;
      if (!profile || typeof profile.name !== 'string') {
        socket.emit(EV.ERROR, { code: 'invalid', message: 'Perfil inválido' });
        return;
      }
      const clean = { name: profile.name.slice(0, 16), level: Math.max(1, Math.floor(Number(profile.level) || 1)), skin: String(profile.skin ?? 'nxo').slice(0, 16) };
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
    });

    socket.on(EV.CANCEL, () => {
      if (rooms.cancel(socket.id)) {
        socket.emit(EV.CANCELLED, {});
        log(`búsqueda cancelada ${short(socket.id)}`);
      }
    });

    socket.on(EV.READY, () => {
      const r = rooms.ready(socket.id);
      if (r?.all) start(r.room);
    });

    // reenvío al rival (solo si el emisor está jugando en esa sala)
    const relay = (ev: string) => (data: StateMsg | HitMsg | ActionMsg) => {
      const room = rooms.roomOf(socket.id);
      if (!room || room.status !== 'PLAYING') return;
      const opp = rooms.opponentOf(room, socket.id);
      if (opp) io.to(opp.id).emit(ev, data);
    };
    socket.on(EV.STATE, relay(EV.STATE));
    socket.on(EV.HIT, relay(EV.HIT));
    socket.on(EV.ACTION, relay(EV.ACTION));

    // punto del juez de la pelota: marcador oficial + reenvío al rival
    socket.on(EV.POINT, (msg: PointMsg) => {
      const room = rooms.roomOf(socket.id);
      if (!room || room.status !== 'PLAYING' || !msg) return;
      const opp = rooms.opponentOf(room, socket.id);
      if (opp) io.to(opp.id).emit(EV.POINT, msg);
      if (msg.kind !== 'point') return; // faltas y let no suman en el marcador oficial
      const res = rooms.point(socket.id, Number(msg.seq) || 0, msg.to === 'me');
      if (!res) return;
      const sc = scoreMsg(res.room);
      for (const p of res.room.players) io.to(p.id).emit(EV.SCORE, sc);
      if (res.matchOver) finish(res.room);
    });

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
    socket.on(EV.LEAVE, () => leave('abandon'));
    socket.on('disconnect', () => {
      log(`desconectado ${short(socket.id)}`);
      leave('disconnect');
    });
  });

  return rooms;
}

const short = (id: string) => id.slice(0, 6);
