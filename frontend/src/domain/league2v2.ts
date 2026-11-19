/**
 * LIGA 2v2 (19-11-2026, decidido con el usuario): ranking del 2v2 por MONEDAS 2v2 (domain/coins2v2.ts). Datos puros, sin Phaser.
 *
 * - RANGO 2v2: los mismos rangos de la Liga (Bronce … Challenger), por MONEDAS 2v2 acumuladas (RANK_2V2: desde cuántas).
 * - TABLA: hasta que existan cuentas en el servidor, la llenan jugadores SIMULADOS (como el Ranking Liga, domain/rankedBots.ts): deterministas
 *   (la misma tabla en cualquier dispositivo), con un total que crece una vez al día a su ritmo. El jugador real se ordena entre ellos.
 */
import type { PlayerState } from './player';
import type { RankId } from './ranks';
import { cycleIdAt } from './dailyWheel';

/** Desde cuántas MONEDAS 2v2 se tiene cada rango 2v2. */
export const RANK_2V2: { id: RankId; from: number }[] = [
  { id: 'bronze', from: 0 },
  { id: 'silver', from: 150 },
  { id: 'gold', from: 400 },
  { id: 'platinum', from: 800 },
  { id: 'diamond', from: 1400 },
  { id: 'challenger', from: 2200 },
];

export const LEAGUE_2V2 = {
  /** jugadores simulados de la tabla */
  bots: 49,
  /** día desde el que crecen (los totales parten de su base ese día) */
  epoch: '2026-11-17',
  /** tope del total de un simulado */
  maxTotal: 4000,
};

export interface Entry2v2 {
  id: string;
  name: string;
  bot: boolean;
  level: number;
  total: number;
  avatar: { skin: 'nxo' | 'mai'; color: number };
  position: number;
}

export const ME_2V2 = 'me';

/** Rango 2v2 por total, y el siguiente (null = el máximo). */
export function rank2v2(total: number): { id: RankId; from: number; next: { id: RankId; from: number } | null } {
  let i = 0;
  for (let k = 0; k < RANK_2V2.length; k++) if (total >= RANK_2V2[k].from) i = k;
  return { ...RANK_2V2[i], next: RANK_2V2[i + 1] ?? null };
}

const PRE = ['Volea', 'Saque', 'Drop', 'Lob', 'Smash', 'Topspin', 'Slice', 'Ace', 'Net', 'Rally', 'Break', 'Deuce', 'Set', 'Spin', 'Match', 'Grip'];
const SUF = ['Rex', 'Zor', 'Kai', 'Nova', 'Vex', 'Lux', 'Max', 'Rio', 'Pix', 'Ozo', 'Fox', 'Yuk', 'Taz', 'Jet', 'Bly', 'Kip'];
const COLORS = [0x3a7bff, 0xff4f5e, 0x62d935, 0xffc42e, 0xb06bff, 0x37e0ff, 0xff8a3d, 0xff6fc8];
const DAY = 86_400_000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dayIndex = (id: string) => {
  const [y, m, d] = id.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
};

/** Los simulados el día (ciclo diario) de `now`: total = base + ritmo × días activos (crecen una vez al día). */
export function bots2v2(now: number): Omit<Entry2v2, 'position'>[] {
  const days = Math.max(0, dayIndex(cycleIdAt(now)) - dayIndex(LEAGUE_2V2.epoch));
  const out: Omit<Entry2v2, 'position'>[] = [];
  for (let i = 0; i < LEAGUE_2V2.bots; i++) {
    const r = rng(0x2a2b + i * 7919);
    const name = `${PRE[Math.floor(r() * PRE.length)]}${SUF[Math.floor(r() * SUF.length)]}${r() < 0.4 ? Math.floor(r() * 90 + 10) : ''}`;
    // pocos muy buenos, muchos casuales: la base y el ritmo diario se reparten en curva
    const skill = r() ** 1.8;
    const base = Math.round(skill * 900);
    const rate = skill * 70 + r() * 15;
    const active = 0.35 + r() * 0.6; // fracción de días que juega
    const total = Math.min(LEAGUE_2V2.maxTotal, Math.round(base + rate * days * active));
    out.push({ id: `b${i}`, name, bot: true, level: 1 + Math.floor(r() * 20), total, avatar: { skin: r() < 0.5 ? 'nxo' : 'mai', color: COLORS[Math.floor(r() * COLORS.length)] } });
  }
  return out;
}

/** Tabla completa ordenada (mayor total primero; empate: el real delante). */
export function board2v2(s: PlayerState, now: number): Entry2v2[] {
  const me: Omit<Entry2v2, 'position'> = {
    id: ME_2V2,
    name: s.name,
    bot: false,
    level: s.level,
    total: Math.max(0, s.coins2v2 ?? 0),
    avatar: { skin: s.equipped.skin === 'mai' ? 'mai' : 'nxo', color: 0xffc42e },
  };
  return [me, ...bots2v2(now)]
    .sort((a, b) => b.total - a.total || Number(a.bot) - Number(b.bot))
    .map((e, i) => ({ ...e, position: i + 1 }));
}
