/**
 * Servidor NxoGames: HTTP (API REST base) + Socket.IO (multijugador 1v1).
 *   npm run dev     (desarrollo, se reinicia al guardar)
 *   npm start       (sin recarga)
 * Escucha en 0.0.0.0 para que los teléfonos de la misma WiFi se conecten con la IPv4 del PC.
 * El mismo código servirá en Render (PORT por variable de entorno).
 */
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import express from 'express';
import { Server } from 'socket.io';
import { CONFIG } from './config/env.js';
import { apiRouter } from './api/routes.js';
import { registerSocketHandlers } from './socket/handlers/index.js';
import type { RoomManager } from './socket/rooms/RoomManager.js';

const app = express();
// CORS para la API (Socket.IO tiene su propia opción abajo)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CONFIG.corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
});
let rooms: RoomManager | null = null;
app.use('/api', apiRouter(() => rooms));
app.get('/', (_req, res) => res.send('NxoGames backend OK'));

const http = createServer(app);
const io = new Server(http, {
  cors: { origin: CONFIG.corsOrigin === '*' ? true : CONFIG.corsOrigin.split(','), methods: ['GET', 'POST'] },
  // pings frecuentes: una desconexión (WiFi caída, app cerrada) se detecta en pocos segundos
  pingInterval: 5000,
  pingTimeout: 5000,
});
rooms = registerSocketHandlers(io);

http.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`\nNxoGames backend escuchando en ${CONFIG.host}:${CONFIG.port}`);
  console.log('Direcciones IPv4 de este PC (usa la de tu WiFi en Ajustes > Servidor LAN del juego):');
  for (const [name, list] of Object.entries(networkInterfaces()))
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) console.log(`  ${name}: http://${a.address}:${CONFIG.port}`);
  console.log('También puedes verla con "ipconfig" (Dirección IPv4 del adaptador WiFi).\n');
});
