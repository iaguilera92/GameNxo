// Pruebas de salas y matchmaking (lógica pura). npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/socket/rooms/RoomManager.js';

/** temporizadores manuales: avanzar() dispara los vencidos */
function fakeTimers() {
  let now = 0;
  const list: { at: number; fn: () => void; id: number }[] = [];
  let seq = 0;
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        const id = ++seq;
        list.push({ at: now + ms, fn, id });
        return id;
      },
      clear: (h: unknown) => {
        const i = list.findIndex((t) => t.id === h);
        if (i >= 0) list.splice(i, 1);
      },
    },
    now: () => now,
    advance(ms: number) {
      now += ms;
      for (const t of [...list].sort((a, b) => a.at - b.at)) if (t.at <= now) {
        list.splice(list.indexOf(t), 1);
        t.fn();
      }
    },
  };
}

const P = (name: string) => ({ name, level: 5, skin: 'nxo' });
const setup = () => {
  const ft = fakeTimers();
  const timeouts: string[] = [];
  const rm = new RoomManager({ searchTimeoutMs: 5000, gamesToWin: 2, goldenPoint: false }, { onTimeout: (p) => timeouts.push(p) }, ft.timers, ft.now);
  return { rm, ft, timeouts };
};

test('A busca (1/2) y B entra a los 4 s: emparejados al instante, PLAYING', () => {
  const { rm, ft, timeouts } = setup();
  const a = rm.find('A', P('A'));
  assert.equal(a.type, 'waiting');
  ft.advance(4000);
  const b = rm.find('B', P('B'));
  assert.equal(b.type, 'matched');
  if (b.type !== 'matched') return;
  assert.equal(b.room.status, 'PLAYING');
  assert.deepEqual(b.room.players.map((p) => p.id), ['A', 'B']);
  ft.advance(5000);
  assert.deepEqual(timeouts, []); // el temporizador se canceló al emparejar
});

test('sin rival en 5 s: timeout y no queda sala fantasma', () => {
  const { rm, ft, timeouts } = setup();
  rm.find('A', P('A'));
  ft.advance(4999);
  assert.deepEqual(timeouts, []);
  ft.advance(1);
  assert.deepEqual(timeouts, ['A']);
  assert.equal(rm.stats.rooms, 0);
  assert.equal(rm.roomOf('A'), undefined);
  // puede volver a buscar
  assert.equal(rm.find('A', P('A')).type, 'waiting');
});

test('máximo dos: un tercero crea otra sala, no entra a la completa', () => {
  const { rm } = setup();
  rm.find('A', P('A'));
  const b = rm.find('B', P('B'));
  const c = rm.find('C', P('C'));
  assert.equal(c.type, 'waiting');
  if (b.type === 'matched' && c.type === 'waiting') assert.notEqual(b.room.id, c.room.id);
  assert.equal(rm.stats.PLAYING, 1);
  assert.equal(rm.stats.WAITING, 1);
});

test('un jugador no puede estar en dos salas', () => {
  const { rm } = setup();
  rm.find('A', P('A'));
  assert.deepEqual(rm.find('A', P('A')), { type: 'error', code: 'already_searching' });
  rm.find('B', P('B'));
  assert.deepEqual(rm.find('A', P('A')), { type: 'error', code: 'already_in_room' });
});

test('dos JUGAR seguidos (casi simultáneos): uno crea y el otro se une', () => {
  const { rm } = setup();
  const r1 = rm.find('A', P('A'));
  const r2 = rm.find('B', P('B'));
  assert.equal(r1.type, 'waiting');
  assert.equal(r2.type, 'matched');
  assert.equal(rm.stats.rooms, 1);
});

test('cancelar la búsqueda libera la sala; desconectarse buscando también', () => {
  const { rm, ft, timeouts } = setup();
  rm.find('A', P('A'));
  assert.equal(rm.cancel('A'), true);
  assert.equal(rm.stats.rooms, 0);
  rm.find('B', P('B'));
  const l = rm.leave('B', 'disconnect');
  assert.equal(l?.wasPlaying, false);
  assert.equal(rm.stats.rooms, 0);
  ft.advance(6000);
  assert.deepEqual(timeouts, []);
});

test('marcador oficial: gana quien llega a 2 juegos; luego se libera', () => {
  const { rm } = setup();
  rm.find('A', P('A'));
  rm.find('B', P('B'));
  let seq = 0;
  let over = false;
  // A (host) gana 8 puntos seguidos = 2 juegos
  for (let i = 0; i < 8; i++) over = rm.point('A', seq++, true)!.matchOver;
  assert.equal(over, true);
  const room = rm.roomOf('A')!;
  assert.equal(room.status, 'FINISHED');
  assert.deepEqual(room.result, { winner: 'host', reason: 'score', games: { host: 2, guest: 0 } });
  rm.finish(room.id);
  assert.equal(rm.stats.rooms, 0);
  assert.equal(rm.find('A', P('A')).type, 'waiting');
});

test('POINT repetido (mismo seq) no suma dos veces; el juez puede ser cualquiera', () => {
  const { rm } = setup();
  rm.find('A', P('A'));
  rm.find('B', P('B'));
  rm.point('B', 0, false); // B avisa: punto para A
  rm.point('B', 0, false); // repetido
  assert.deepEqual(rm.roomOf('A')!.score.points, [1, 0]);
});

test('abandono en partido: gana el rival; la sala no acepta a nadie más', () => {
  const { rm } = setup();
  rm.find('A', P('A'));
  rm.find('B', P('B'));
  const l = rm.leave('B', 'abandon')!;
  assert.equal(l.wasPlaying, true);
  assert.equal(l.opponent?.id, 'A');
  assert.equal(l.room.result?.winner, 'host');
  // mientras no se libera, un tercero no entra a esa sala
  const c = rm.find('C', P('C'));
  assert.equal(c.type, 'waiting');
  rm.finish(l.room.id);
  assert.equal(rm.roomOf('A'), undefined);
});

test('sin límite de tiempo de partido: la sala sigue PLAYING tras mucho tiempo', () => {
  const { rm, ft } = setup();
  rm.find('A', P('A'));
  rm.find('B', P('B'));
  ft.advance(60 * 60 * 1000);
  assert.equal(rm.roomOf('A')?.status, 'PLAYING');
});

test('RECONEXIÓN: ausente conserva su sitio y vuelve con su clave (otra conexión)', () => {
  const { rm } = setup();
  rm.find('a', P('A'));
  const m = rm.find('b', P('B'));
  assert.equal(m.type, 'matched');
  const room = (m as { room: ReturnType<RoomManager['get']> & object }).room;
  const tokenA = room.players[0].token;
  assert.ok(tokenA && tokenA !== room.players[1].token);
  const a = rm.markAway('a')!;
  assert.equal(a.player.away, true);
  assert.equal(a.opponent?.id, 'b');
  assert.equal(room.status, 'PLAYING');
  // clave equivocada o jugador no ausente: no
  assert.equal(rm.rejoin(room.id, 'mala', 'a2'), null);
  assert.equal(rm.rejoin(room.id, room.players[1].token, 'b2'), null);
  // vuelve: nueva conexión, mismo sitio
  const r = rm.rejoin(room.id, tokenA, 'a2')!;
  assert.equal(r.player.id, 'a2');
  assert.equal(r.player.away, false);
  assert.equal(rm.roomOf('a2')?.id, room.id);
  assert.equal(rm.roomOf('a'), undefined);
  assert.equal(rm.roleOf(room, 'a2'), 'host');
  // ya no está ausente: la misma clave no sirve otra vez
  assert.equal(rm.rejoin(room.id, tokenA, 'a3'), null);
});

test('RECONEXIÓN: si no vuelve, su salida da la victoria al rival', () => {
  const { rm } = setup();
  rm.find('a', P('A'));
  rm.find('b', P('B'));
  rm.markAway('a');
  const r = rm.leave('a', 'disconnect')!;
  assert.equal(r.room.status, 'FINISHED');
  assert.equal(r.room.result?.winner, 'guest');
  assert.equal(rm.rejoin(r.room.id, r.room.players[0].token, 'a2'), null);
});
