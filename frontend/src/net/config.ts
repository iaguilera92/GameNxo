/**
 * Dirección del servidor multijugador (LAN hoy, Render mañana). Se guarda en este dispositivo y se cambia en
 * Ajustes > SERVIDOR LAN sin tocar la lógica del juego. Vacía = sin multijugador (JUGAR va directo al BOT).
 *
 * Formatos aceptados: "192.168.1.20" (puerto por defecto), "192.168.1.20:3001" o una URL completa
 * ("http://192.168.1.20:3001", "https://mi-backend.onrender.com").
 */
const KEY = 'gamenxo.lanServer';
export const DEFAULT_PORT = 3001;
/** servidor por defecto (PC de pruebas en la LAN). Si cambia la IP del PC, cámbiala aquí o en Ajustes. */
export const DEFAULT_SERVER = '192.168.1.101';

export function getServerAddress(): string {
  try {
    // sin valor guardado = servidor por defecto; '' guardado = el jugador lo dejó vacío (solo BOT)
    return localStorage.getItem(KEY) ?? DEFAULT_SERVER;
  } catch {
    return DEFAULT_SERVER;
  }
}

export function setServerAddress(v: string) {
  try {
    localStorage.setItem(KEY, v.trim()); // vacío se guarda tal cual: desactiva el multijugador
  } catch {
    /* sin almacenamiento */
  }
}

/** URL completa del servidor, o null si no hay dirección configurada. */
export function serverUrl(addr = getServerAddress()): string | null {
  const t = addr.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t.replace(/\/+$/, '');
  return /:\d+$/.test(t) ? `http://${t}` : `http://${t}:${DEFAULT_PORT}`;
}
