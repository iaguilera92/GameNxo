/**
 * Hora "confiable" para el ciclo diario (sin Phaser).
 *
 * Hoy NO hay servidor: se usa el reloj del dispositivo con una marca de agua persistente
 * (la hora nunca retrocede). Así, atrasar el reloj del teléfono no abre un ciclo nuevo ni
 * devuelve uno anterior. Cuando exista backend, `setServerTime(ms)` fija el desfase con la hora
 * del servidor (y la marca de agua lo respeta); el resto del código no cambia.
 *
 * Límite conocido sin servidor: ADELANTAR el reloj sí pasa al ciclo siguiente antes de tiempo
 * (y al volver a la hora real el ciclo NO retrocede: se queda en el futuro hasta alcanzarlo).
 */
const HW_KEY = 'gamenxo.clock.hw';

export interface TimeSource {
  now(): number;
}

let serverOffset = 0;
let highWater = readHw();

function readHw(): number {
  try {
    const v = Number(localStorage.getItem(HW_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeHw(v: number) {
  try {
    localStorage.setItem(HW_KEY, String(Math.floor(v)));
  } catch {
    /* sin almacenamiento */
  }
}

/** Hora del juego (ms epoch): monotónica y persistente. */
export const gameClock: TimeSource = {
  now() {
    const t = Date.now() + serverOffset;
    if (t > highWater) {
      highWater = t;
      writeHw(t);
    }
    return highWater;
  },
};

/** Sincroniza con la hora del servidor (backend futuro). */
export function setServerTime(serverMs: number) {
  if (!Number.isFinite(serverMs)) return;
  serverOffset = serverMs - Date.now();
  // el servidor manda: deshace un reloj local adelantado
  highWater = serverMs;
  writeHw(serverMs);
}
