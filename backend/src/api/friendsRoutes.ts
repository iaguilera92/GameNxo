/**
 * API de AMIGOS (src/friends/friendsStore.ts). `:deviceId` = id secreto del teléfono (invitado).
 *   POST /api/friends/:deviceId/sync     { name, level, league, skin } → crea/actualiza y devuelve { code, friends, requests, gifts, giftSent }
 *   GET  /api/friends/:deviceId          → lo mismo sin actualizar (404 si nunca sincronizó)
 *   POST /api/friends/:deviceId/request  { code: "Nombre#111" } o { friend: pid }
 *   GET  /api/friends/:deviceId/suggest  → { list: [{ id, name, tag, level, league, skin, status, lastSeenMin }] } (hasta 10)
 *   POST /api/friends/:deviceId/answer   { from, accept }
 *   POST /api/friends/:deviceId/remove   { friend }
 *   POST /api/friends/:deviceId/gift     { friend }
 *   POST /api/friends/:deviceId/take     { gift } → { gift: { kind, amount, fromName } }
 *   POST /api/friends/:deviceId/duel     { friend } → { duelId, ttlMs }  (429 duel_wait con waitS)
 *   GET  /api/friends/:deviceId/duel     → { incoming: [{ id, fromName, msLeft }], out: { id, toName, state, key? } | null }
 *   POST /api/friends/:deviceId/duel/answer { duel, accept } → { key?, name }
 *   POST /api/friends/:deviceId/duel/cancel
 * Error: 400/404/409 con { ok: false, error }.
 */
import express, { Router } from 'express';
import { FriendsStore, isDeviceId, type FriendsError } from '../friends/friendsStore.js';

const STATUS: Record<FriendsError, number> = { invalid: 400, not_found: 404, self: 409, already_friends: 409, already_sent: 409, full: 409, not_friend: 409, gift_sent: 409, no_request: 409, duel_wait: 429, offline: 409, expired: 409 };

export function friendsRouter(store: FriendsStore) {
  const r = Router();
  r.use(express.json({ limit: '1kb' }));
  r.param('dev', (_req, res, next, id) => (isDeviceId(id) ? next() : void res.status(400).json({ ok: false, error: 'invalid' })));
  const body = (req: express.Request) => (req.body ?? {}) as Record<string, unknown>;
  const send = (res: express.Response, out: { ok: true } | { ok: false; error: FriendsError }) => res.status(out.ok ? 200 : STATUS[out.error]).json(out);
  r.post('/:dev/sync', (req, res) => {
    const b = body(req);
    res.json({ ok: true, snap: store.sync(req.params.dev, { name: String(b.name ?? ''), level: Number(b.level), league: String(b.league ?? ''), skin: String(b.skin ?? '') }) });
  });
  r.get('/:dev', (req, res) => {
    const snap = store.view(req.params.dev);
    if (!snap) return void res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, snap });
  });
  // por código (AÑADIR AMIGO) o por id público (AGREGAR en SUGERENCIAS)
  r.post('/:dev/request', (req, res) => send(res, typeof body(req).friend === 'string' ? store.requestById(req.params.dev, body(req).friend) : store.request(req.params.dev, body(req).code)));
  r.get('/:dev/suggest', (req, res) => {
    const list = store.suggest(req.params.dev);
    if (!list) return void res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, list });
  });
  r.post('/:dev/answer', (req, res) => send(res, store.answer(req.params.dev, body(req).from, body(req).accept === true)));
  r.post('/:dev/remove', (req, res) => send(res, store.remove(req.params.dev, body(req).friend)));
  r.post('/:dev/gift', (req, res) => send(res, store.gift(req.params.dev, body(req).friend)));
  r.post('/:dev/take', (req, res) => send(res, store.take(req.params.dev, body(req).gift)));
  // (27-11-2026) DUELO: retar, consultar (cada pocos segundos), responder y retirar
  r.post('/:dev/duel', (req, res) => send(res, store.duel(req.params.dev, body(req).friend)));
  r.get('/:dev/duel', (req, res) => {
    const out = store.duelPoll(req.params.dev);
    if (!out) return void res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, ...out });
  });
  r.post('/:dev/duel/answer', (req, res) => send(res, store.duelAnswer(req.params.dev, body(req).duel, body(req).accept === true)));
  r.post('/:dev/duel/cancel', (req, res) => send(res, store.duelCancel(req.params.dev)));
  return r;
}
