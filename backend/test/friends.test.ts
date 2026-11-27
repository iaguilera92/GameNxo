// Pruebas de AMIGOS entre invitados (src/friends/friendsStore.ts y src/api/friendsRoutes.ts). npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { FriendsStore, parseCode } from '../src/friends/friendsStore.js';
import { friendsRouter } from '../src/api/friendsRoutes.js';

const A = 'device-aaaa-0001';
const B = 'device-bbbb-0002';
const prof = (name: string) => ({ name, level: 5, league: 'gold', skin: 'mai' });
const mk = (t = { now: Date.UTC(2026, 10, 27, 15) }, file: string | null = null) => new FriendsStore(file, () => t.now);

test('código NOMBRE#111 y búsqueda sin mayúsculas', () => {
  assert.deepEqual(parseCode(' Nacho #112 '), { name: 'Nacho', tag: '112' });
  assert.equal(parseCode('Nacho#12'), null);
  assert.equal(parseCode('Nacho0421'), null);
  assert.equal(parseCode('ab#0001'), null);
  const s = mk();
  const a = s.sync(A, prof('Nacho'));
  assert.equal(a.code, 'Nacho#111'); // el primero es el 111
  s.sync(B, prof('Cata'));
  const r = s.request(B, a.code.toUpperCase());
  assert.equal(r.ok, true);
  assert.equal(s.view(A)!.requests.length, 1);
});

test('número por nombre desde 111; al cambiar de nombre, el siguiente libre del nombre nuevo', () => {
  const s = mk();
  assert.equal(s.sync(A, prof('Nxo')).code, 'Nxo#111');
  assert.equal(s.sync(B, prof('nxo')).code, 'nxo#112'); // mismo nombre: siguiente
  assert.equal(s.sync('device-cccc-0003', prof('Mai')).code, 'Mai#111'); // otro nombre: parte en 111
  assert.equal(s.sync('device-dddd-0004', prof('Mai')).code, 'Mai#112');
  assert.equal(s.sync(A, prof('NXO')).code, 'NXO#111'); // solo mayúsculas: conserva su número
  assert.equal(s.sync(A, prof('Mai')).code, 'Mai#113'); // cambia de nombre
});

test('solicitud, aceptar, regalo una vez al día, abrir, quitar', () => {
  const t = { now: Date.UTC(2026, 10, 27, 15) };
  const s = mk(t);
  const a = s.sync(A, prof('Nacho'));
  s.sync(B, prof('Cata'));
  assert.deepEqual(s.request(A, a.code), { ok: false, error: 'self' });
  assert.deepEqual(s.request(B, 'Nadie#0000'), { ok: false, error: 'not_found' });
  s.request(B, a.code);
  assert.deepEqual(s.request(B, a.code), { ok: false, error: 'already_sent' });
  const bPid = s.view(A)!.requests[0].id;
  const acc = s.answer(A, bPid, true);
  assert.equal(acc.ok, true);
  assert.equal(s.view(A)!.friends.length, 1);
  assert.equal(s.view(B)!.friends.length, 1);
  assert.equal(s.view(B)!.friends[0].status, 'online');
  const aPid = s.view(B)!.friends[0].id;
  assert.equal(s.gift(B, aPid).ok, true);
  assert.deepEqual(s.gift(B, aPid), { ok: false, error: 'gift_sent' });
  t.now += 24 * 3600_000; // día siguiente: se puede otra vez
  assert.equal(s.gift(B, aPid).ok, true);
  const gifts = s.view(A)!.gifts;
  assert.equal(gifts.length, 2);
  assert.equal(gifts[0].fromName, 'Cata');
  const tk = s.take(A, gifts[0].id);
  assert.ok(tk.ok && tk.gift.amount > 0);
  assert.deepEqual(s.take(A, gifts[0].id), { ok: false, error: 'not_found' });
  s.remove(A, bPid);
  assert.equal(s.view(B)!.friends.length, 0);
  assert.deepEqual(s.gift(B, aPid), { ok: false, error: 'not_friend' });
});

test('si los dos se envían solicitud, quedan amigos', () => {
  const s = mk();
  const a = s.sync(A, prof('Nacho'));
  const b = s.sync(B, prof('Cata'));
  s.request(A, b.code);
  const r = s.request(B, a.code);
  assert.equal(r.ok, true);
  assert.equal(s.view(A)!.friends.length, 1);
  assert.equal(s.view(B)!.requests.length, 0);
});

test('el id secreto no aparece en lo que ven los amigos y se guarda en archivo', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'friends-')), 'friends.json');
  const s = mk(undefined, file);
  const a = s.sync(A, prof('Nacho'));
  s.sync(B, prof('Cata'));
  s.request(B, a.code);
  assert.ok(!JSON.stringify(s.view(A)).includes(B));
  const again = mk(undefined, file);
  assert.equal(again.view(A)!.code, a.code);
  assert.equal(again.sync('device-cccc-0003', prof('Nacho')).code, 'Nacho#112'); // sigue contando tras reiniciar
  assert.equal(again.view(A)!.requests.length, 1);
});

test('rutas HTTP', async () => {
  const app = express();
  app.use('/f', friendsRouter(mk()));
  const srv = createServer(app).listen(0);
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/f`;
  const post = (p: string, b: unknown) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  try {
    assert.equal((await fetch(`${base}/x`)).status, 400);
    assert.equal((await fetch(`${base}/${A}`)).status, 404);
    const a = (await (await post(`/${A}/sync`, prof('Nacho'))).json()) as { snap: { code: string } };
    await post(`/${B}/sync`, prof('Cata'));
    assert.equal((await post(`/${B}/request`, { code: a.snap.code })).status, 200);
    assert.equal((await post(`/${B}/request`, { code: 'Nadie#1111' })).status, 404);
  } finally {
    srv.close();
  }
});

test('duelo: reto, rechazo con espera que se dobla, aceptar con clave', () => {
  const t = { now: Date.UTC(2026, 10, 27, 15) };
  const s = mk(t);
  const a = s.sync(A, prof('Nacho'));
  s.sync(B, prof('Cata'));
  s.request(B, a.code);
  s.answer(A, s.view(A)!.requests[0].id, true);
  const aPid = s.view(B)!.friends[0].id;
  // B reta a A
  const d1 = s.duel(B, aPid);
  assert.ok(d1.ok);
  const inc = s.duelPoll(A)!.incoming;
  assert.equal(inc.length, 1);
  assert.equal(inc[0].fromName, 'Cata');
  // A rechaza: 30 s de espera
  assert.ok(s.duelAnswer(A, inc[0].id, false).ok);
  assert.equal(s.duelPoll(B)!.out?.state, 'rejected');
  assert.equal(s.duelPoll(B)!.out, null); // se entrega una vez
  const w1 = s.duel(B, aPid);
  assert.ok(!w1.ok && w1.error === 'duel_wait' && 'waitS' in w1 && w1.waitS === 30);
  t.now += 30_000;
  s.sync(A, prof('Nacho'));
  const d2 = s.duel(B, aPid);
  assert.ok(d2.ok);
  s.duelAnswer(A, s.duelPoll(A)!.incoming[0].id, false);
  const w2 = s.duel(B, aPid);
  assert.ok(!w2.ok && 'waitS' in w2 && w2.waitS === 60); // segundo rechazo: 1 min
  t.now += 60_000;
  s.sync(A, prof('Nacho'));
  assert.ok(s.duel(B, aPid).ok);
  const acc = s.duelAnswer(A, s.duelPoll(A)!.incoming[0].id, true);
  assert.ok(acc.ok && 'key' in acc && typeof acc.key === 'string');
  const out = s.duelPoll(B)!.out;
  assert.equal(out?.state, 'accepted');
  assert.equal(out?.key, acc.ok && 'key' in acc ? acc.key : '');
  // aceptar borra la espera
  assert.ok(s.duel(B, aPid).ok);
});

test('duelo: vence a los 30 s y no se puede retar a alguien desconectado', () => {
  const t = { now: Date.UTC(2026, 10, 27, 15) };
  const s = mk(t);
  const a = s.sync(A, prof('Nacho'));
  s.sync(B, prof('Cata'));
  s.request(B, a.code);
  s.answer(A, s.view(A)!.requests[0].id, true);
  const aPid = s.view(B)!.friends[0].id;
  assert.ok(s.duel(B, aPid).ok);
  const id = s.duelPoll(A)!.incoming[0].id;
  t.now += 31_000;
  assert.equal(s.duelPoll(A)!.incoming.length, 0);
  assert.deepEqual(s.duelAnswer(A, id, true), { ok: false, error: 'expired' });
  assert.equal(s.duelPoll(B)!.out?.state, 'expired');
  t.now += 5 * 60_000; // A no aparece en 5 min
  s.sync(B, prof('Cata'));
  assert.deepEqual(s.duel(B, aPid), { ok: false, error: 'offline' });
});

test('sugerencias: sin uno mismo, amigos ni solicitudes; en línea primero; agregar por id', () => {
  const t = { now: Date.UTC(2026, 10, 27, 15) };
  const s = mk(t);
  s.sync(A, prof('Nacho'));
  s.sync(B, prof('Cata'));
  t.now += 10 * 60_000; // Cata ya no está en línea
  s.sync('device-cccc-0003', { ...prof('Pau'), level: 40 });
  s.sync(A, prof('Nacho'));
  const sug = s.suggest(A)!;
  assert.deepEqual(sug.map((x) => x.name), ['Pau', 'Cata']); // Pau en línea va primero
  const cata = sug[1];
  assert.equal(s.requestById(A, cata.id).ok, true);
  assert.deepEqual(s.suggest(A)!.map((x) => x.name), ['Pau']); // con solicitud ya no se sugiere
  assert.ok(!s.suggest(B)!.some((x) => x.name === 'Nacho')); // a Cata tampoco: ya tiene la solicitud
  t.now += 8 * 24 * 3600_000; // una semana sin entrar: deja de sugerirse
  s.sync(A, prof('Nacho'));
  assert.deepEqual(s.suggest(A), []);
});

test('sugerencias: siempre primero los rivales y compañeros con los que jugaste', () => {
  const t = { now: Date.UTC(2026, 10, 27, 15) };
  const s = mk(t);
  const C = 'device-cccc-0003';
  s.sync(A, prof('Nacho'));
  s.sync(B, prof('Cata'));
  s.met(A, B, 'rival');
  t.now += 30 * 24 * 3600_000; // un mes después: Cata no entra, pero igual se sugiere
  s.sync(C, prof('Pau'));
  s.sync(A, prof('Nacho'));
  s.met(A, C, 'mate');
  const sug = s.suggest(A)!;
  assert.deepEqual(sug.map((x) => [x.name, x.met]), [['Pau', 'mate'], ['Cata', 'rival']]); // el más reciente primero
  // al hacerse amigos deja de sugerirse
  s.requestById(A, sug[0].id);
  assert.deepEqual(s.suggest(A)!.map((x) => x.name), ['Cata']);
});
