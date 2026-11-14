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
import { SocketLimiter, sanitizeAction, sanitizeHit, sanitizeLog, sanitizePoint, sanitizeState, type LimitKey } from '../guard.js';
import { MatchLogger } from '../matchLog.js';
import {
  EV,
  type FindRequest,
  type MatchedMsg,
  type ResumeRequest,
  type ResumedMsg,
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

/** log de diagnóstico de partidas (logs/matches/…): lo lee la API protegida con LOG_KEY */
export const matchLog = new MatchLogger();

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
  /** LOG: sala y rol de cada conexión, también unos segundos DESPUÉS del fin (el juego manda el log del final tarde) */
  const logRoom = new Map<string, { roomId: string; role: string; until: number }>();
  const LOG_AFTER_MS = 30_000;
  /** RECONEXIÓN: jugador ausente (clave) -> temporizador que lo da por perdido */
  const awayTimers = new Map<string, NodeJS.Timeout>();
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
    for (const p of room.players) {
      const t = awayTimers.get(p.token);
      if (t) clearTimeout(t);
      awayTimers.delete(p.token);
    }
    log(`sala ${short(room.id)} terminada: gana ${msg.winner} (${msg.reason}) ${msg.games.host}-${msg.games.guest}`);
    room.players.forEach((p, i) => logRoom.set(p.id, { roomId: room.id, role: i === 0 ? 'host' : 'guest', until: Date.now() + LOG_AFTER_MS }));
    matchLog.write(room.id, 'srv', { ev: 'over', winner: msg.winner, reason: msg.reason, games: `${msg.games.host}-${msg.games.guest}` });
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
    matchLog.write(room.id, 'srv', { ev: 'start', host: room.players[0]?.profile.name, guest: room.players[1]?.profile.name });
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
        // estilo de color del personaje (solo cosmético): id corto en minúsculas; el cliente ignora los que no conoce
        const color = typeof profile.color === 'string' && /^[a-z0-9-]{1,16}$/.test(profile.color) && profile.color !== 'classic' ? profile.color : undefined;
        // victorias totales (solo se muestran en la pantalla VS): entero entre 0 y 999999
        const wins = Number.isFinite(Number(profile.wins)) ? Math.max(0, Math.min(999999, Math.floor(Number(profile.wins)))) : 0;
        const clean = {
          name: profile.name.slice(0, 16),
          level: Math.max(1, Math.floor(Number(profile.level) || 1)),
          skin: String(profile.skin ?? 'nxo').slice(0, 16),
          ...(charge ? { charge } : {}),
          ...(color ? { color } : {}),
          ...(wins > 0 ? { wins } : {}),
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
        const toHost: MatchedMsg = { roomId: room.id, role: 'host', opponent: guest.profile, gamesToWin: CONFIG.gamesToWin, token: host.token };
        const toGuest: MatchedMsg = { roomId: room.id, role: 'guest', opponent: host.profile, gamesToWin: CONFIG.gamesToWin, token: guest.token };
        io.to(host.id).emit(EV.MATCHED, toHost);
        io.to(guest.id).emit(EV.MATCHED, toGuest);
        log(`emparejados ${host.profile.name} vs ${guest.profile.name} sala ${short(room.id)} 2/2 → PLAYING`);
        matchLog.write(room.id, 'srv', { ev: 'matched', host: host.profile.name, hostSkin: host.profile.skin, guest: guest.profile.name, guestSkin: guest.profile.skin });
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
        // en el log: golpes y acciones que pasan por el servidor (los estados no: son 20 por segundo)
        if (!volatile) {
          const d = data as { kind?: unknown; seq?: unknown };
          if (d.kind === 'ping' || d.kind === 'pong') return; // medición del retraso cada 2 s: solo ruido en el log
          matchLog.write(room.id, 'srv', { ev: `relay:${ev}`, from: rooms.roleOf(room, socket.id), kind: String(d.kind ?? ''), seq: typeof d.seq === 'number' ? d.seq : undefined });
        }
      });
    socket.on(EV.STATE, relay(EV.STATE, 'state', sanitizeState, true));
    socket.on(EV.HIT, relay(EV.HIT, 'hit', sanitizeHit));
    socket.on(EV.ACTION, relay(EV.ACTION, 'action', sanitizeAction));
    // LOG de diagnóstico del cliente: se guarda con su rol (host / guest); no se reenvía
    socket.on(
      EV.LOG,
      guarded<unknown>('log', (raw) => {
        const entries = sanitizeLog(raw);
        if (!entries) return;
        const room = rooms.roomOf(socket.id);
        if (room) {
          const src = rooms.roleOf(room, socket.id) ?? '?';
          for (const e of entries) matchLog.write(room.id, src, e);
          return;
        }
        // la sala ya terminó: lo que llega en los segundos siguientes (pantalla final) va igual a su log
        const last = logRoom.get(socket.id);
        if (!last || Date.now() > last.until) return;
        for (const e of entries) matchLog.write(last.roomId, last.role, e);
      }),
    );

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
        matchLog.write(res.room.id, 'srv', { ev: 'point', by: rooms.roleOf(res.room, socket.id), to: msg.to, reason: msg.reason, score: `${res.room.score.points.join('-')} / ${res.room.score.games.join('-')}` });
        const sc = scoreMsg(res.room);
        for (const p of res.room.players) io.to(p.id).emit(EV.SCORE, sc);
        if (res.matchOver) finish(res.room);
      }),
    );

    // RECONEXIÓN: vuelve con su clave (otra conexión) y recupera su sitio; los dos rejuegan el punto en curso
    socket.on(
      EV.RESUME,
      guarded<ResumeRequest>('ctl', (req) => {
        const r = rooms.rejoin(String(req?.roomId ?? ''), String(req?.token ?? ''), socket.id);
        if (!r) {
          socket.emit(EV.ERROR, { code: 'not_in_room', message: 'No se pudo volver al partido' });
          return;
        }
        const t = awayTimers.get(r.player.token);
        if (t) clearTimeout(t);
        awayTimers.delete(r.player.token);
        const msg: ResumedMsg = { score: scoreMsg(r.room) };
        socket.emit(EV.RESUMED, msg);
        matchLog.write(r.room.id, 'srv', { ev: 'rejoin', who: r.player.profile.name });
        if (r.opponent) io.to(r.opponent.id).emit(EV.OPPONENT_BACK, msg.score);
        log(`reconectado ${r.player.profile.name} a la sala ${short(r.room.id)} (${short(socket.id)})`);
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
    socket.on('disconnect', (why: string) => {
      log(`desconectado ${short(socket.id)} (${why})`);
      const lr = logRoom.get(socket.id);
      if (lr && Date.now() > lr.until) logRoom.delete(socket.id);
      try {
        // en pleno partido: su sitio se guarda unos segundos por si reconecta (datos móviles, túnel, cambio de red)
        const room = rooms.roomOf(socket.id);
        // (solo cortes de red: 'ping timeout' / 'transport close'; un corte forzado por abuso o mensaje enorme pierde al instante)
        const netDrop = why === 'ping timeout' || why === 'transport close';
        if (netDrop && room && room.status === 'PLAYING' && started.has(room.id) && CONFIG.reconnectGraceMs > 0) {
          const a = rooms.markAway(socket.id);
          if (a) {
            if (a.opponent) io.to(a.opponent.id).emit(EV.OPPONENT_AWAY, {});
            const oldId = socket.id;
            const token = a.player.token;
            awayTimers.set(
              token,
              setTimeout(() => {
                awayTimers.delete(token);
                const cur = rooms.get(a.room.id);
                const p = cur?.players.find((x) => x.token === token);
                if (!cur || !p?.away || p.id !== oldId) return; // ya volvió o la sala terminó
                const r = rooms.leave(oldId, 'disconnect');
                if (!r?.wasPlaying) return;
                if (r.opponent) io.to(r.opponent.id).emit(EV.OPPONENT_LEFT, { reason: 'disconnect' });
                finish(r.room);
              }, CONFIG.reconnectGraceMs),
            );
            log(`ausente ${a.player.profile.name} en la sala ${short(room.id)}: ${CONFIG.reconnectGraceMs} ms para volver`);
            matchLog.write(room.id, 'srv', { ev: 'away', who: a.player.profile.name, why });
            return;
          }
        }
        leave('disconnect');
      } catch (e) {
        log(`error al liberar la sala de ${short(socket.id)}:`, e);
      }
    });
  });

  return rooms;
}

const short = (id: string) => id.slice(0, 6);
