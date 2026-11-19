/**
 * (21-11-2026) 2v2 ONLINE: nombres de los 2 bots rivales. Salen del id de la sala, así que los dos teléfonos (y la pantalla VS) ven los mismos.
 */
const NAMES = ['RoboAce', 'NetBot', 'Volea.exe', 'BotNadal', 'TopSpin'];

/**
 * (21-11-2026) 2v2 ONLINE: ¿saca el HOST (y no el invitado) cuando le toca sacar al equipo humano en este juego? Es AL AZAR, pero sale del id de la sala
 * y del número de juego, así que los dos teléfonos llegan al mismo resultado sin enviarse nada (y sigue igual si uno se reconecta).
 * Puede repetirse varios juegos seguidos: en un partido corto (mejor de 3) uno de los dos puede no sacar nunca.
 */
export function hostServesGame(roomId: string, gameIndex: number): boolean {
  let h = 2166136261;
  for (const c of `${roomId}:${gameIndex}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h & 1) === 0;
}

export function botNamesFor(roomId: string): [string, string] {
  let h = 0;
  for (const c of roomId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [NAMES[h % NAMES.length], NAMES[(h + 2) % NAMES.length]];
}