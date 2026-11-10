/**
 * Servidor NxoGames: HTTP (API REST base) + Socket.IO (multijugador 1v1).
 *   npm run dev         (desarrollo, se reinicia al guardar)
 *   npm start           (sin recarga, vía tsx)
 *   npm run build && npm run start:prod   (producción: node dist/server.js; ver deploy/)
 * Escucha en 0.0.0.0 para que los teléfonos de la misma WiFi se conecten con la IPv4 del PC.
 *
 * Producción: UN solo proceso (las salas viven en memoria). Se apaga con SIGTERM de forma ordenada: no admite
 * búsquedas nuevas y espera a que terminen los partidos en curso (hasta DRAIN_TIMEOUT_MS).
 */
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import express from 'express';
import { Server } from 'socket.io';
import { CONFIG } from './config/env.js';
import { apiRouter } from './api/routes.js';
import { deployRouter } from './api/deploy.js';
import { registerSocketHandlers, setDraining } from './socket/handlers/index.js';
import type { RoomManager } from './socket/rooms/RoomManager.js';

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

const app = express();
app.disable('x-powered-by');
if (CONFIG.trustProxy) app.set('trust proxy', true);
// CORS para la API REST (Socket.IO tiene su propia opción abajo). Con lista de orígenes se responde SOLO el del
// pedido si está permitido (un header con varios orígenes no es válido).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (CONFIG.corsOrigins === '*') res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && CONFIG.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
});
let rooms: RoomManager | null = null;
app.use('/api', apiRouter(() => rooms));
// despliegue continuo desde GitHub (solo si hay WEBHOOK_SECRET; sin él la ruta no existe). Ver deploy/deploy.sh
if (CONFIG.webhookSecret) app.use('/webhook-deploy', deployRouter({ secret: CONFIG.webhookSecret, branch: CONFIG.deployBranch }));
app.get('/', (_req, res) => res.send('NxoGames backend OK'));

const http = createServer(app);
const io = new Server(http, {
  cors: { origin: CONFIG.corsOrigins === '*' ? true : CONFIG.corsOrigins, methods: ['GET', 'POST'] },
  // pings frecuentes: una desconexión (WiFi caída, app cerrada) se detecta en pocos segundos
  pingInterval: 5000,
  pingTimeout: 5000,
  // ningún mensaje legítimo pasa de ~1 KB: un mensaje enorme corta esa conexión
  maxHttpBufferSize: CONFIG.maxPayloadBytes,
});
rooms = registerSocketHandlers(io);

http.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`\nNxoGames backend escuchando en ${CONFIG.host}:${CONFIG.port}`);
  console.log(`  CORS: ${CONFIG.corsOrigins === '*' ? '* (cualquiera: solo para pruebas)' : CONFIG.corsOrigins.join(', ')}  ·  trust proxy: ${CONFIG.trustProxy ? 'sí' : 'no'}`);
  console.log('Direcciones IPv4 de este PC (usa la de tu WiFi en Ajustes > Servidor LAN del juego):');
  for (const [name, list] of Object.entries(networkInterfaces()))
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) console.log(`  ${name}: http://${a.address}:${CONFIG.port}`);
  console.log('También puedes verla con "ipconfig" (Dirección IPv4 del adaptador WiFi).\n');
});

// ------------------------------------------------------------------ apagado ordenado y errores
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) {
    log(`${signal} otra vez: salida inmediata`);
    process.exit(0);
  }
  shuttingDown = true;
  setDraining(true);
  const t0 = Date.now();
  log(`${signal}: apagando; sin búsquedas nuevas, esperando partidos en curso (máx. ${CONFIG.drainTimeoutMs} ms)`);
  const timer = setInterval(() => {
    const left = rooms?.stats.rooms ?? 0;
    if (left === 0 || Date.now() - t0 > CONFIG.drainTimeoutMs) {
      clearInterval(timer);
      log(left === 0 ? 'sin partidos en curso: cerrando' : `se agotó la espera con ${left} salas: cerrando`);
      io.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000).unref();
    }
  }, 1000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// una promesa sin atrapar no justifica tumbar todos los partidos: se registra y se sigue
process.on('unhandledRejection', (e) => log('unhandledRejection:', e));
// una excepción sin atrapar deja el proceso en estado incierto: se registra y se sale para que systemd/pm2 lo reinicie
process.on('uncaughtException', (e) => {
  log('uncaughtException:', e);
  process.exit(1);
});
