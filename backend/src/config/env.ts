/**
 * Configuración del servidor por variables de entorno (con valores por defecto para pruebas LAN).
 * En producción (AWS EC2, systemd/pm2) se definen en /etc/nxogames.env (ver .env.example): el código no cambia.
 */
const num = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

/** 'CORS_ORIGIN' → '*' (cualquiera) o lista de orígenes exactos separados por coma */
const origins = (v: string | undefined): '*' | string[] => {
  const t = (v ?? '*').trim();
  if (t === '' || t === '*') return '*';
  return t.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
};

export const CONFIG = {
  /** puerto de escucha (PORT) */
  port: num(process.env.PORT, 3001),
  /** 0.0.0.0 = acepta conexiones de la red local (no solo localhost) */
  host: process.env.HOST ?? '0.0.0.0',
  /**
   * orígenes permitidos (CORS), separados por coma. '*' = cualquiera (pruebas LAN).
   * En producción poner los del juego, p. ej. "https://localhost,capacitor://localhost,https://juego.midominio.com".
   */
  corsOrigins: origins(process.env.CORS_ORIGIN),
  /** detrás de nginx / ALB: confía en X-Forwarded-For para la IP real del jugador (TRUST_PROXY=1) */
  trustProxy: process.env.TRUST_PROXY === '1',
  /** tiempo máximo de búsqueda de rival (lo controla el servidor) */
  searchTimeoutMs: num(process.env.SEARCH_TIMEOUT_MS, 5000),
  /** espera máxima a que los dos clientes carguen el partido antes de empezar igualmente */
  readyTimeoutMs: num(process.env.READY_TIMEOUT_MS, 12000),
  /** RECONEXIÓN: tiempo que se guarda el sitio de un jugador que se cortó en pleno partido (0 = pierde al instante) */
  reconnectGraceMs: num(process.env.RECONNECT_GRACE_MS, 15000),
  /** duración máxima de un partido en curso (después se cierra la sala por tiempo: gana quien vaya arriba) */
  maxMatchMs: num(process.env.MAX_MATCH_MS, 30 * 60_000),
  /** tamaño máximo de un mensaje de un cliente (bytes); más grande = se corta esa conexión */
  maxPayloadBytes: num(process.env.MAX_PAYLOAD_BYTES, 8 * 1024),
  /** al apagar (SIGTERM): tiempo máximo esperando a que terminen los partidos en curso */
  drainTimeoutMs: num(process.env.DRAIN_TIMEOUT_MS, 120_000),
  /** secreto del webhook de GitHub (Settings > Webhooks > Secret). Vacío = el webhook de despliegue está desactivado */
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  /** clave para leer los logs de partidas por la API (/api/match-logs); vacía = API de logs apagada */
  logKey: process.env.LOG_KEY ?? '',
  /** rama que dispara el despliegue */
  deployBranch: process.env.DEPLOY_BRANCH ?? 'main',
  /** reglas del partido: las mismas que el modo BOT (frontend/src/config.ts: GAMES_TO_WIN, GOLDEN_POINT) */
  gamesToWin: num(process.env.GAMES_TO_WIN, 2),
  goldenPoint: process.env.GOLDEN_POINT === '1',
};
