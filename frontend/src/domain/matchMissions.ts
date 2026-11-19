/**
 * MISIONES POR PARTIDA (1v1, contra el bot u online). Se reinician en cada partida; cada una cuenta UNA sola vez.
 * Solo lógica (sin Phaser): MatchScene avisa de cada golpe y de cada punto y muestra el LOGRO; MatchEndScene paga
 * las monedas en la sección ADICIONALES (también si pierdes). Docs: docs/MISIONES.md. Prueba: tools/test-match-missions.mjs.
 *
 *  dropZero   punto con DROP SHOT 0 (el motivo del punto es '¡DROP SHOT 0!')                         20
 *  skyLaunch  ¡A LAS ESTRELLAS!: el rival sin raqueta (tu ULTI) recibe tu ESPECIAL y sale volando     40
 *  netDuel    ganas el punto en el que hubo DUELO EN LA RED                                           20
 *  specialLob tiras el ESPECIAL, el rival lo devuelve y tú ganas el punto con un GLOBO al máximo      20
 *             (GLOBO DISPARADO) sin que el rival vuelva a tocarla
 */
export type MissionId = 'dropZero' | 'skyLaunch' | 'netDuel' | 'specialLob';

export interface MissionDef {
  id: MissionId;
  /** texto de la alerta y de la card */
  title: string;
  coins: number;
}

export const MISSIONS: readonly MissionDef[] = [
  { id: 'dropZero', title: 'Dejada Mortal', coins: 20 },
  { id: 'skyLaunch', title: '¡A las Estrellas!', coins: 40 },
  { id: 'netDuel', title: 'Rey de la Red', coins: 20 },
  { id: 'specialLob', title: 'Combo Globo', coins: 20 },
];

/** monedas si se cumplen las 4 */
export const MISSIONS_MAX = MISSIONS.reduce((a, m) => a + m.coins, 0);

/** golpe del jugador que importa para las misiones (null = cualquier otro) */
export type MissionShot = 'special' | 'maxLob' | null;

/** cadena ESPECIAL → devolución del rival → GLOBO al máximo, dentro del punto */
type Chain = 'none' | 'special' | 'returned' | 'lob';

export interface MissionTracker {
  done: MissionId[];
  chain: Chain;
}

export function createMissionTracker(): MissionTracker {
  return { done: [], chain: 'none' };
}

/** Empieza un punto: la cadena del ESPECIAL no pasa de un punto a otro. */
export function missionPointStart(t: MissionTracker) {
  t.chain = 'none';
}

/** Cada golpe del punto (saque incluido). `shot` solo cuenta en los del jugador. */
export function missionHit(t: MissionTracker, who: 'player' | 'rival', shot: MissionShot = null) {
  if (who === 'rival') {
    t.chain = t.chain === 'special' ? 'returned' : 'none';
    return;
  }
  if (shot === 'special') t.chain = 'special';
  else if (shot === 'maxLob' && t.chain === 'returned') t.chain = 'lob';
  else t.chain = 'none';
}

export interface MissionPoint {
  winner: 'player' | 'rival';
  /** motivo del punto (el de MatchScene.pointTo) */
  reason: string;
  /** el rival salió volando (¡A LAS ESTRELLAS!) en este punto */
  rivalLaunched?: boolean;
  /** hubo DUELO EN LA RED en este punto */
  duel?: boolean;
}

/** Punto decidido: devuelve las misiones que se cumplen AHORA (las ya cumplidas no se repiten). */
export function missionPoint(t: MissionTracker, p: MissionPoint): MissionId[] {
  const hit: MissionId[] = [];
  if (p.winner === 'player') {
    if (p.reason === '¡DROP SHOT 0!') hit.push('dropZero');
    if (p.rivalLaunched) hit.push('skyLaunch');
    if (p.duel) hit.push('netDuel');
    if (t.chain === 'lob') hit.push('specialLob');
  }
  t.chain = 'none';
  const fresh = hit.filter((id) => !t.done.includes(id));
  t.done.push(...fresh);
  return fresh;
}

export function missionDef(id: MissionId): MissionDef {
  return MISSIONS.find((m) => m.id === id)!;
}

/** Monedas de las misiones cumplidas (cada una una vez; ids desconocidos o repetidos no suman). */
export function missionCoins(done: readonly MissionId[]): number {
  return MISSIONS.filter((m) => done.includes(m.id)).reduce((a, m) => a + m.coins, 0);
}
