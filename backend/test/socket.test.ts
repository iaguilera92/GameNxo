// Prueba de extremo a extremo con clientes Socket.IO reales (servidor en un puerto libre). npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';

process.env.SEARCH_TIMEOUT_MS = '600'; // búsqueda corta para la prueba
const { registerSocketHandlers } = await import('../src/socket/handlers/index.js');
const { EV } = await import('../src/socket/events/protocol.js');

let http: HttpServer;
let url = '';
const sockets: Socket[] = [];
before(async () => {
  http = createServer();
  registerSocketHandlers(new Server(http, { cors: { origin: true } }));
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});
after(() => {
  sockets.forEach((s) => s.close());
  http.close();
});

const client = async () => {
  const s = connect(url, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  await new Promise<void>((r) => s.once('connect', () => r()));
  return s;
};
const once = <T>(s: Socket, ev: string, ms = 2000) =>
  new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`sin ${ev}`)), ms);
    s.once(ev, (d: T) => {
      clearTimeout(t);
      res(d);
    });
  });
const profile = (name: string) => ({ profile: { name, level: 3, skin: 'nxo' } });

test('dos clientes: buscando → emparejados → START → reenvío → marcador oficial → fin', async () => {
  const a = await client();
  const b = await client();
  a.emit(EV.FIND, profile('Ana'));
  const searching = await once<{ players: number }>(a, EV.SEARCHING);
  assert.equal(searching.players, 1);
  const ma = once<{ role: string; opponent: { name: string } }>(a, EV.MATCHED);
  const mb = once<{ role: string; opponent: { name: string } }>(b, EV.MATCHED);
  b.emit(EV.FIND, profile('Beto'));
  const [ra, rb] = await Promise.all([ma, mb]);
  assert.equal(ra.role, 'host');
  assert.equal(rb.role, 'guest');
  assert.equal(ra.opponent.name, 'Beto');
  const sa = once(a, EV.START);
  const sb = once(b, EV.START);
  a.emit(EV.READY);
  b.emit(EV.READY);
  await Promise.all([sa, sb]);
  // reenvío de golpe
  const hit = once<{ seq: number }>(b, EV.HIT);
  a.emit(EV.HIT, { seq: 7 });
  assert.equal((await hit).seq, 7);
  // 8 puntos para el host (avisa el juez B: "para el rival") → 2 juegos → fin oficial
  const overA = once<{ winner: string; reason: string }>(a, EV.OVER);
  for (let i = 0; i < 8; i++) b.emit(EV.POINT, { seq: i, kind: 'point', to: 'opponent', reason: '', color: '' });
  const over = await overA;
  assert.equal(over.winner, 'host');
  assert.equal(over.reason, 'score');
  // sala liberada: pueden volver a buscar
  a.emit(EV.FIND, profile('Ana'));
  await once(a, EV.SEARCHING);
  a.emit(EV.CANCEL);
  await once(a, EV.CANCELLED);
});

test('sin rival: el servidor avisa TIMEOUT', async () => {
  const c = await client();
  c.emit(EV.FIND, profile('Solo'));
  await once(c, EV.SEARCHING);
  await once(c, EV.TIMEOUT, 2000);
});

test('desconexión en partido: el rival recibe OPPONENT_LEFT y gana', async () => {
  const a = await client();
  const b = await client();
  a.emit(EV.FIND, profile('A'));
  await once(a, EV.SEARCHING);
  const ma = once(a, EV.MATCHED);
  b.emit(EV.FIND, profile('B'));
  await ma;
  const left = once<{ reason: string }>(a, EV.OPPONENT_LEFT);
  const over = once<{ winner: string; reason: string }>(a, EV.OVER);
  b.disconnect();
  assert.equal((await left).reason, 'disconnect');
  const o = await over;
  assert.equal(o.winner, 'host');
  assert.equal(o.reason, 'disconnect');
});
