/**
 * API REST (base). Hoy solo estado del servidor; aquí se añadirán autenticación, perfiles, ranking (Supabase).
 */
import express, { Router } from 'express';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createReadStream } from 'node:fs';
import type { RoomManager } from '../socket/rooms/RoomManager.js';
import { matchLog } from '../socket/handlers/index.js';
import { LOG_PARTIDO, LOG_PARTIDO_2V2 } from '../socket/matchLog.js';
import { CONFIG } from '../config/env.js';
import { riskRouter } from './riskRoutes.js';
import { RiskStore } from '../risk/riskMode.js';

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
  r.get('/log-partido-2v2', (req, res) => {
    if (!allowed(req)) return res.status(404).end();
    res.type('text/plain; charset=utf-8');
    createReadStream(LOG_PARTIDO_2V2)
      .on('error', () => res.status(404).end('sin LOG-PARTIDO-2V2 todavía'))
      .pipe(res);
  });
  r.get('/match-logs/:room', async (req, res) => {
    if (!allowed(req)) return res.status(404).end();
    const f = await matchLog.find(req.params.room);
    if (!f) return res.status(404).json({ error: 'sin log' });
    res.type('application/x-ndjson');
    createReadStream(f).pipe(res);
  });
  // (26-11-2026, usuario) REPORTAR BUG (AJUSTES del juego): se guarda cada reporte (hasta 200 caracteres) en un archivo NDJSON
  const bugFile = process.env.BUG_DATA_FILE ?? 'data/bug-reports.ndjson';
  r.post('/bug-report', express.json({ limit: '2kb' }), async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const text = typeof b.text === 'string' ? b.text.trim().slice(0, 200) : '';
    if (text.length < 3) return res.status(400).json({ ok: false });
    const row = {
      at: new Date().toISOString(),
      text,
      name: typeof b.name === 'string' ? b.name.slice(0, 40) : '',
      level: typeof b.level === 'number' ? b.level : null,
      version: typeof b.version === 'string' ? b.version.slice(0, 20) : '',
      ua: typeof b.ua === 'string' ? b.ua.slice(0, 160) : '',
    };
    try {
      await mkdir(dirname(bugFile), { recursive: true });
      await appendFile(bugFile, JSON.stringify(row) + '\n', 'utf8');
      res.json({ ok: true });
    } catch {
      res.status(500).json({ ok: false });
    }
  });
  // lista de reportes (con LOG_KEY, como los logs)
  r.get('/bug-reports', (req, res) => {
    if (!allowed(req)) return res.status(404).end();
    res.type('application/x-ndjson');
    createReadStream(bugFile).on('error', () => res.status(404).end('sin reportes')).pipe(res);
  });
  // MODO RIESGO x2 (evento semanal de Ranked): el servidor registra la activación y fija el multiplicador
  r.use('/risk-mode', riskRouter(new RiskStore(process.env.RISK_DATA_FILE ?? 'data/risk-mode.json')));
  return r;
}
