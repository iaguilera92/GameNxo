// Pruebas del MODO RIESGO x2 en el servidor (src/risk/riskMode.ts y src/api/riskRoutes.ts). npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { RISK_MODE, RiskStore, isRiskDay, riskStatus, riskWeekAt } from '../src/risk/riskMode.js';
import { riskRouter } from '../src/api/riskRoutes.js';
// mismas reglas que el cliente (frontend/src/domain/riskMode.ts): se comparan aquí para que no se separen
// @ts-expect-error módulo del frontend (sin tipos para el backend)
import * as Front from '../../frontend/src/domain/riskMode.ts';

const H = 3_600_000, MIN = 60_000, D = 24 * H;
const MON = Date.UTC(2026, 10, 16, 15); // lunes 16-11-2026 12:00 Chile
const TUE = MON + D;
const NEXT_MON = MON + 7 * D;
const P = 'jugador-prueba-01';

const tmp = () => join(mkdtempSync(join(tmpdir(), 'risk-')), 'risk.json');
function storeAt(t: { now: number }, file: string | null = null) {
  return new RiskStore(file, () => t.now);
}

test('activación un lunes y rechazo de la segunda en la misma semana', () => {
  const t = { now: MON };
  const s = storeAt(t);
  const a = s.activate(P);
  assert.equal(a.ok, true);
  assert.equal(s.status(P).phase, 'active');
  t.now += MIN;
  assert.deepEqual(s.activate(P), { ok: false, error: 'active', now: t.now, risk: { week: '2026-11-16', activatedAt: MON } });
  t.now = MON + RISK_MODE.durationMs + MIN;
  assert.equal((s.activate(P) as { error: string }).error, 'already_used');
});

test('solo los lunes', () => {
  const t = { now: TUE };
  assert.equal((storeAt(t).activate(P) as { error: string }).error, 'not_monday');
});

test('10 minutos exactos, fin automático y nueva disponibilidad el lunes siguiente', () => {
  const t = { now: MON };
  const s = storeAt(t);
  s.activate(P);
  t.now = MON + RISK_MODE.durationMs - 1;
  assert.equal(s.status(P).multiplier, 2);
  assert.equal(s.status(P).msLeft, 1);
  t.now = MON + RISK_MODE.durationMs;
  assert.equal(s.status(P).phase, 'used');
  assert.equal(s.status(P).multiplier, 1);
  t.now = NEXT_MON;
  assert.equal(s.status(P).phase, 'available');
  assert.equal(s.activate(P).ok, true);
});

test('reconexión / reinicio del servidor: la activación persiste (archivo atómico) y el tiempo sigue corriendo', () => {
  const file = tmp();
  const t = { now: MON };
  storeAt(t, file).activate(P);
  t.now = MON + 7 * MIN;
  const again = storeAt(t, file);
  assert.equal(again.status(P).phase, 'active');
  assert.equal(again.status(P).msLeft, 3 * MIN);
  assert.equal((again.activate(P) as { error: string }).error, 'active');
  rmSync(file, { force: true });
});

test('multiplicador fijado por partida una sola vez (sin pagos duplicados ni subir partidas viejas)', () => {
  const t = { now: MON - MIN };
  const s = storeAt(t);
  assert.deepEqual(s.stake(P, 'antes'), { mult: 1, duplicate: false });
  t.now = MON;
  s.activate(P);
  assert.deepEqual(s.stake(P, 'antes'), { mult: 1, duplicate: true }, 'empezada antes del evento: x1');
  assert.deepEqual(s.stake(P, 'durante'), { mult: 2, duplicate: false });
  t.now = MON + RISK_MODE.durationMs + MIN;
  assert.deepEqual(s.stake(P, 'durante'), { mult: 2, duplicate: true }, 'termina después: sigue x2');
  assert.deepEqual(s.stake(P, 'despues'), { mult: 1, duplicate: false });
});

test('liquidación con el multiplicador fijado: x1 y x2, victoria y derrota (Bronce 500 / 1.000)', () => {
  const t = { now: MON };
  const s = storeAt(t);
  s.activate(P);
  s.stake(P, 'm1');
  // apuesta x1 → base 500 / 1.000; x2 → base 1.000 / 2.000
  assert.deepEqual(s.settle(P, 'm1', 500, 1000, true), { mult: 2, entry: 1000, prize: 2000, delta: 1000 });
  assert.deepEqual(s.settle(P, 'm1', 500, 1000, false), { mult: 2, entry: 1000, prize: 0, delta: -1000 });
  assert.deepEqual(s.settle(P, 'm1', 1000, 2000, true), { mult: 2, entry: 2000, prize: 4000, delta: 2000 });
  assert.deepEqual(s.settle(P, 'm1', 1000, 2000, false), { mult: 2, entry: 2000, prize: 0, delta: -2000 });
  assert.deepEqual(s.settle(P, 'otra', 500, 1000, true), { mult: 1, entry: 500, prize: 1000, delta: 500 }, 'sin stake: x1');
});

test('mismas reglas que el cliente (calendario y estado)', () => {
  const rec = { week: '2026-11-16', activatedAt: MON };
  for (let t = MON - 2 * D; t < NEXT_MON + D; t += 37 * MIN) {
    assert.equal(isRiskDay(t), Front.isRiskDay(t), `isRiskDay ${t}`);
    assert.equal(riskWeekAt(t), Front.riskWeekAt(t), `riskWeekAt ${t}`);
    assert.deepEqual(riskStatus(rec, t), Front.riskStatus(rec, t), `riskStatus ${t}`);
  }
});

test('API: el cliente no puede mandar multiplicador, hora ni duración', async () => {
  const t = { now: MON };
  const app = express();
  app.use('/api/risk-mode', riskRouter(storeAt(t)));
  const srv = createServer(app).listen(0);
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/risk-mode`;
  try {
    const post = (path: string, body?: unknown) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    assert.equal((await fetch(`${base}/x`)).status, 400, 'id inválido');
    const a = await post(`/${P}/activate`, { activatedAt: MON - 9 * MIN, durationMs: 99 * MIN, multiplier: 10 });
    assert.equal(a.status, 200);
    const body = (await a.json()) as { risk: { activatedAt: number }; msLeft: number; multiplier: number };
    assert.equal(body.risk.activatedAt, MON, 'hora del servidor');
    assert.equal(body.msLeft, RISK_MODE.durationMs);
    assert.equal(body.multiplier, 2);
    assert.equal((await post(`/${P}/activate`)).status, 409, 'segunda activación');
    const st = (await (await post(`/${P}/stake`, { matchId: 'partida-1', mult: 50 })).json()) as { mult: number };
    assert.equal(st.mult, 2);
    assert.equal((await post(`/${P}/stake`, { matchId: '' })).status, 400);
    t.now = MON + 4 * MIN;
    const g = (await (await fetch(`${base}/${P}`)).json()) as { msLeft: number; now: number };
    assert.equal(g.msLeft, 6 * MIN, 'al reconectar: el tiempo real que queda');
    assert.equal(g.now, t.now);
  } finally {
    srv.close();
  }
});
