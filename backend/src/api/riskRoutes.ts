/**
 * API del MODO RIESGO x2 (ver src/risk/riskMode.ts). El cliente solo pide; el servidor decide con SU hora.
 *   GET  /api/risk-mode/:playerId            → estado (fase, ms restantes, hora del servidor)
 *   POST /api/risk-mode/:playerId/activate   → activa (409 si ya se usó esta semana o hoy no es lunes)
 *   POST /api/risk-mode/:playerId/stake      { matchId } → multiplicador fijado para esa partida Ranked
 * Ningún cuerpo trae multiplicador, hora ni duración: si los manda, se ignoran.
 */
import express, { Router } from 'express';
import { RiskStore, isPlayerId } from '../risk/riskMode.js';

export function riskRouter(store: RiskStore) {
  const r = Router();
  r.use(express.json({ limit: '1kb' }));
  r.param('playerId', (req, res, next, id) => (isPlayerId(id) ? next() : void res.status(400).json({ ok: false, error: 'invalid_player' })));
  r.get('/:playerId', (req, res) => {
    res.json({ ok: true, ...store.status(req.params.playerId) });
  });
  r.post('/:playerId/activate', (req, res) => {
    const out = store.activate(req.params.playerId);
    res.status(out.ok ? 200 : 409).json(out);
  });
  r.post('/:playerId/stake', (req, res) => {
    const matchId = (req.body as { matchId?: unknown } | undefined)?.matchId;
    if (typeof matchId !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(matchId)) return void res.status(400).json({ ok: false, error: 'invalid_match' });
    res.json({ ok: true, ...store.stake(req.params.playerId, matchId) });
  });
  return r;
}
