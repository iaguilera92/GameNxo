/**
 * API REST (base). Hoy solo estado del servidor; aquí se añadirán autenticación, perfiles, ranking (Supabase).
 */
import { Router } from 'express';
import type { RoomManager } from '../socket/rooms/RoomManager.js';

export function apiRouter(getRooms: () => RoomManager | null) {
  const r = Router();
  r.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'nxogames-backend', rooms: getRooms()?.stats ?? null, time: new Date().toISOString() });
  });
  return r;
}
