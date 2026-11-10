// Pruebas de la guardia de mensajes (socket/guard.ts) y del cierre de sala por tiempo. npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SocketLimiter, sanitizeAction, sanitizeHit, sanitizePoint, sanitizeState } from '../src/socket/guard.js';
import { RoomManager } from '../src/socket/rooms/RoomManager.js';

const ball = { x: 1, y: 2, z: 3, vx: 4, vy: 5, vz: 6 };
const hit = { seq: 1.9, kind: 'serve', ball, x: 1, y: 2, shotKind: 'a'.repeat(50), power: 1, inferno: false, charged: true, overhead: false, volley: false };

test('sanitizeState: exige x e y numéricos finitos y recorta lo demás', () => {
  assert.equal(sanitizeState({ x: NaN, y: 1 }), null);
  assert.equal(sanitizeState({ x: 1, y: Infinity }), null);
  assert.equal(sanitizeState('hola'), null);
  assert.equal(sanitizeState([1, 2]), null);
  const s = sanitizeState({ x: 1e12, y: -1e12, moving: 'si' });
  assert.deepEqual(s, { t: 0, x: 1e5, y: -1e5, moving: false, dirX: 0, facing: 1, charging: false, stunned: false });
});

test('sanitizeHit: pelota obligatoria, booleanos estrictos, texto recortado, opcionales solo si vienen', () => {
  assert.equal(sanitizeHit({ ...hit, ball: { x: 1 } }), null);
  assert.equal(sanitizeHit({ ...hit, kind: 'otro' }), null);
  const h = sanitizeHit({ ...hit, lunge: -7, special: true, shock: 'true', zzz: 1 })!;
  assert.equal(h.seq, 1);
  assert.equal(h.shotKind.length, 16);
  assert.equal(h.power, false, 'solo true cuenta como true');
  assert.equal(h.charged, true);
  assert.equal(h.lunge, -1);
  assert.equal(h.special, true);
  assert.equal('shock' in h, false);
  assert.equal('zzz' in h, false);
});

test('sanitizeAction: tipo permitido y datos acotados', () => {
  assert.equal(sanitizeAction({ kind: 'hackear' }), null);
  assert.equal(sanitizeAction(undefined), null);
  const data: Record<string, unknown> = {};
  for (let i = 0; i < 30; i++) data['k' + i] = i;
  data.largo = 'x'.repeat(100);
  data.obj = { a: 1 };
  const a = sanitizeAction({ kind: 'emote', data })!;
  assert.ok(Object.keys(a.data!).length <= 12);
  assert.equal('obj' in a.data!, false);
  assert.deepEqual(sanitizeAction({ kind: 'toss' }), { kind: 'toss' });
});

test('sanitizePoint: valores válidos y marcador opcional', () => {
  assert.equal(sanitizePoint({ seq: 1, kind: 'gol', to: 'me' }), null);
  assert.equal(sanitizePoint({ seq: 1, kind: 'point', to: 'yo' }), null);
  const p = sanitizePoint({ seq: 3, kind: 'point', to: 'me', reason: 'r'.repeat(200), games: [1, 2.7] })!;
  assert.equal(p.reason.length, 60);
  assert.deepEqual(p.games, [1, 2]);
  assert.equal(p.color, '');
});

test('SocketLimiter: deja pasar la ráfaga, descarta el exceso, recupera fichas y corta al abusivo', () => {
  const l = new SocketLimiter();
  let ok = 0;
  for (let i = 0; i < 50; i++) if (l.allow('point', 1000)) ok++;
  assert.equal(ok, 8, 'ráfaga de point = 8');
  assert.equal(l.allow('point', 1000 + 1000), true, 'a 4/s recupera fichas');
  assert.equal(l.abusive(), false);
  for (let i = 0; i < 400; i++) l.allow('point', 2000);
  assert.equal(l.abusive(), true);
});

test('cierre por tiempo: gana quien va arriba (juegos, luego puntos); empate total = host', () => {
  const mk = () => new RoomManager({ searchTimeoutMs: 5000, gamesToWin: 2, goldenPoint: false }, { onTimeout() {} });
  const P = (n: string) => ({ name: n, level: 1, skin: 'nxo' });
  const rm = mk();
  rm.find('A', P('A'));
  const room = rm.find('B', P('B'));
  assert.equal(room.type, 'matched');
  rm.point('A', 0, false); // punto para B
  const r = rm.endByTimeout(rm.roomOf('A')!.id)!;
  assert.equal(r.result!.winner, 'guest');
  assert.equal(r.result!.reason, 'timeout');
  assert.equal(rm.endByTimeout(r.id), null, 'ya no estaba en juego');
  const rm2 = mk();
  rm2.find('A', P('A'));
  rm2.find('B', P('B'));
  assert.equal(rm2.endByTimeout(rm2.roomOf('A')!.id)!.result!.winner, 'host');
});
