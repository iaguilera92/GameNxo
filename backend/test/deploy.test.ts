// Pruebas del webhook de despliegue (api/deploy.ts): firma HMAC, evento, rama y arranque. npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { deployRouter, verifySignature } from '../src/api/deploy.js';

const SECRET = 's3creto-de-prueba';
const sign = (body: string, secret = SECRET) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

let http: Server;
let url = '';
let runs = 0;
let canRun = true;
before(async () => {
  const app = express();
  app.use('/webhook-deploy', deployRouter({ secret: SECRET, run: () => (runs++, canRun) }));
  http = createServer(app);
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}/webhook-deploy`;
});
after(() => http.close());

const post = (body: string, headers: Record<string, string>) =>
  fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });
const push = (ref: string) => JSON.stringify({ ref });

test('verifySignature: acepta la firma correcta y rechaza el resto', () => {
  const b = Buffer.from('hola');
  assert.equal(verifySignature(SECRET, b, sign('hola')), true);
  assert.equal(verifySignature(SECRET, b, sign('hola', 'otro')), false);
  assert.equal(verifySignature(SECRET, b, sign('chao')), false);
  assert.equal(verifySignature(SECRET, b, undefined), false);
  assert.equal(verifySignature(SECRET, b, 'sha256=abc'), false);
  assert.equal(verifySignature(SECRET, b, sign('hola').replace('sha256=', '')), false);
});

test('sin firma o firma falsa: 401 y no se despliega', async () => {
  const body = push('refs/heads/main');
  assert.equal((await post(body, { 'x-github-event': 'push' })).status, 401);
  assert.equal((await post(body, { 'x-github-event': 'push', 'x-hub-signature-256': sign(body, 'malo') })).status, 401);
  assert.equal(runs, 0);
});

test('ping responde pong; eventos y ramas ajenas se ignoran sin desplegar', async () => {
  const ping = JSON.stringify({ zen: 'x' });
  const r = await post(ping, { 'x-github-event': 'ping', 'x-hub-signature-256': sign(ping) });
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as { pong: boolean }).pong, true);
  const issue = '{}';
  const r2 = await post(issue, { 'x-github-event': 'issues', 'x-hub-signature-256': sign(issue) });
  assert.equal(((await r2.json()) as { ignored: string }).ignored.includes('issues'), true);
  const dev = push('refs/heads/dev');
  const r3 = await post(dev, { 'x-github-event': 'push', 'x-hub-signature-256': sign(dev) });
  assert.equal(r3.status, 200);
  assert.equal(runs, 0);
});

test('push a main firmado: 200 y arranca el despliegue; si no puede arrancar, 500', async () => {
  const body = push('refs/heads/main');
  const h = { 'x-github-event': 'push', 'x-hub-signature-256': sign(body) };
  const ok = await post(body, h);
  assert.equal(ok.status, 200);
  assert.equal(runs, 1);
  canRun = false;
  assert.equal((await post(body, h)).status, 500);
  canRun = true;
});

test('JSON roto con firma válida: 400', async () => {
  const body = '{no es json';
  const r = await post(body, { 'x-github-event': 'push', 'x-hub-signature-256': sign(body) });
  assert.equal(r.status, 400);
});
