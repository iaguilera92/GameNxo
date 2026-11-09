/**
 * Configuración del servidor por variables de entorno (con valores por defecto para pruebas LAN).
 * En Render bastará con definir PORT (y CORS_ORIGIN) en el panel: el código no cambia.
 */
const num = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

export const CONFIG = {
  /** puerto de escucha (Render lo define en PORT) */
  port: num(process.env.PORT, 3001),
  /** 0.0.0.0 = acepta conexiones de la red local (no solo localhost) */
  host: process.env.HOST ?? '0.0.0.0',
  /** orígenes permitidos (CORS). '*' = cualquiera (pruebas LAN); en producción poner el dominio del juego */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  /** tiempo máximo de búsqueda de rival (lo controla el servidor) */
  searchTimeoutMs: num(process.env.SEARCH_TIMEOUT_MS, 5000),
  /** espera máxima a que los dos clientes carguen el partido antes de empezar igualmente */
  readyTimeoutMs: num(process.env.READY_TIMEOUT_MS, 12000),
  /** reglas del partido: las mismas que el modo BOT (frontend/src/config.ts: GAMES_TO_WIN, GOLDEN_POINT) */
  gamesToWin: num(process.env.GAMES_TO_WIN, 2),
  goldenPoint: process.env.GOLDEN_POINT === '1',
};
