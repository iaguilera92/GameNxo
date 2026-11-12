/**
 * API REST (base). Hoy solo estado del servidor; aquí se añadirán autenticación, perfiles, ranking (Supabase).
 */
import { Router } from 'express';
import { createReadStream } from 'node:fs';
import type { RoomManager } from '../socket/rooms/RoomManager.js';
import { matchLog } from '../socket/handlers/index.js';
import { LOG_PARTIDO } from '../socket/matchLog.js';
import { CONFIG } from '../config/env.js';

export function apiRouter(getRooms: () => RoomManager | null) {
  const r = Router();
  r.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'nxogames-backend', rooms: getRooms()?.stats ?? null, time: new Date().toISOString() });
  });
  // LOG DE PARTIDAS (diagnóstico): solo con LOG_KEY definida, y pidiéndola en la cabecera x-log-key o ?key=
  const allowed = (req: { get(h: string): string | undefined; query: Record<string, unknown> }) =>
    !!CONFIG.logKey && (req.get('x-log-key') === CONFIG.logKey || req.query.key === CONFIG.logKey);
  r.get('/match-logs', async (req, res) => {
    if (!allowed(req)) return res.status(404).end();
    res.json(await matchLog.list(Number(req.query.limit) || 30));
  });
  // LOG-PARTIDO (texto de la última partida): /api/log-partido?key=…
  r.get('/log-partido', (req, res) => {
    if (!allowed(req)) return res.status(404).end();
    res.type('text/plain; charset=utf-8');
    createReadStream(LOG_PARTIDO)
      .on('error', () => res.status(404).end('sin LOG-PARTIDO todavía'))
      .pipe(res);
  });
  r.get('/match-logs/:room', async (req, res) => {
    if (!allowed(req)) return res.status(404).end();
    const f = await matchLog.find(req.params.room);
    if (!f) return res.status(404).json({ error: 'sin log' });
    res.type('application/x-ndjson');
    createReadStream(f).pipe(res);
  });
  return r;
}
