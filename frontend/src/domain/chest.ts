/**
 * COFRE EVOLUTIVO (15-11-2026, decisión del usuario). Datos puros, sin Phaser.
 *
 * - Sale en la RULETA (sector COFRE). La primera vez desbloquea un COFRE NORMAL que se abre a los 2 DÍAS.
 * - Si vuelve a salir en la ruleta mientras el cofre sigue sin abrir, EVOLUCIONA: normal → ESPECIAL → ÉPICO.
 *   El tiempo NO se reinicia (sigue abriéndose a los 2 días de la primera vez) y la recompensa es mayor.
 * - Si sale con el cofre ya ÉPICO, se compensa con monedas.
 * - Al cumplirse el tiempo se abre desde el menú (botón COFRE) y entrega su premio; el siguiente vuelve a empezar en normal.
 */
import type { ItemId, PlayerState } from './player';
import { owns } from './player';
import { addCash, addCoins, addXp, grantItem } from './operations';

export type ChestLevel = 0 | 1 | 2;

export interface ChestState {
  /** 0 = normal · 1 = especial · 2 = épico */
  level: ChestLevel;
  /** cuándo se puede abrir (ms, reloj del juego) */
  readyAt: number;
}

export interface ChestReward {
  coins: number;
  xp: number;
  cash: number;
  /** cosmético (solo el ÉPICO, si queda alguno que no tengas) */
  item?: { id: ItemId; name: string };
}

export const CHEST = {
  /** tiempo hasta poder abrirlo */
  unlockMs: 2 * 24 * 60 * 60 * 1000,
  names: ['COFRE NORMAL', 'COFRE ESPECIAL', 'COFRE ÉPICO'] as const,
  /** color de cada nivel (marco y brillo) */
  colors: [0x4aa8ff, 0xb44bff, 0xffb020] as const,
  rewards: [
    { coins: 200, xp: 60, cash: 3 },
    { coins: 450, xp: 140, cash: 8 },
    { coins: 900, xp: 300, cash: 20 },
  ] as const,
  /** el ÉPICO trae además uno de estos cosméticos (el primero que no tengas) */
  epicItems: [
    { id: 'style:gold' as ItemId, name: 'Estilo Oro' },
    { id: 'style:red' as ItemId, name: 'Estilo Rojo' },
    { id: 'style:green' as ItemId, name: 'Estilo Verde' },
  ],
  /** el cofre ya era ÉPICO y vuelve a salir: monedas */
  maxedCoins: 150,
};

export type ChestGain =
  /** desbloqueó (nuevo) o evolucionó el cofre */
  | { kind: 'chest'; level: ChestLevel; upgraded: boolean; readyAt: number }
  /** ya estaba ÉPICO: compensación */
  | { kind: 'coins'; amount: number };

/** El cofre sale en la ruleta: nuevo (normal, 2 días) o sube un nivel conservando su tiempo. */
export function gainChest(s: PlayerState, now: number): { state: PlayerState; gain: ChestGain } {
  const c = s.chest;
  if (!c) {
    const chest: ChestState = { level: 0, readyAt: now + CHEST.unlockMs };
    return { state: { ...s, chest }, gain: { kind: 'chest', level: 0, upgraded: false, readyAt: chest.readyAt } };
  }
  if (c.level >= 2) {
    const r = addCoins(s, CHEST.maxedCoins);
    return { state: r.ok ? r.state : s, gain: { kind: 'coins', amount: CHEST.maxedCoins } };
  }
  const chest: ChestState = { level: (c.level + 1) as ChestLevel, readyAt: c.readyAt };
  return { state: { ...s, chest }, gain: { kind: 'chest', level: chest.level, upgraded: true, readyAt: chest.readyAt } };
}

export type ChestStatus = { kind: 'none' } | { kind: 'locked'; level: ChestLevel; msLeft: number } | { kind: 'ready'; level: ChestLevel };

export function chestStatus(s: PlayerState, now: number): ChestStatus {
  const c = s.chest;
  if (!c) return { kind: 'none' };
  return now >= c.readyAt ? { kind: 'ready', level: c.level } : { kind: 'locked', level: c.level, msLeft: c.readyAt - now };
}

/** Premio de un cofre de ese nivel para este jugador (el cosmético del ÉPICO solo si queda uno que no tenga). */
export function chestReward(s: PlayerState, level: ChestLevel): ChestReward {
  const r: ChestReward = { ...CHEST.rewards[level] };
  if (level === 2) {
    const it = CHEST.epicItems.find((i) => !owns(s, i.id));
    if (it) r.item = it;
  }
  return r;
}

/** Abre el cofre (si ya se puede): entrega su premio (operaciones de siempre: monedas, EXP con subida de nivel, dinero,
 * cosmético) y lo quita. null = no hay cofre o aún no se puede abrir.
 * `skipWait` (16-11-2026, decisión del usuario): se vio un ANUNCIO para abrirlo YA, sin esperar el tiempo. */
export function openChest(s: PlayerState, now: number, skipWait = false): { state: PlayerState; reward: ChestReward; level: ChestLevel } | null {
  const st = chestStatus(s, now);
  if (st.kind === 'none' || (st.kind === 'locked' && !skipWait)) return null;
  const reward = chestReward(s, st.level);
  let n = s;
  const step = (r: { ok: boolean; state?: PlayerState }) => {
    if (r.ok && r.state) n = r.state;
  };
  step(addCoins(n, reward.coins));
  step(addXp(n, reward.xp));
  step(addCash(n, reward.cash));
  if (reward.item) step(grantItem(n, reward.item.id));
  n = { ...n };
  delete n.chest;
  return { state: n, reward, level: st.level };
}

/** Datos guardados → ChestState válido (o undefined). */
export function sanitizeChest(v: unknown): ChestState | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const level = r.level === 0 || r.level === 1 || r.level === 2 ? r.level : null;
  const readyAt = typeof r.readyAt === 'number' && Number.isFinite(r.readyAt) && r.readyAt > 0 ? r.readyAt : null;
  if (level === null || readyAt === null) return undefined;
  return { level, readyAt };
}

/** Contador con segundos: "47:59:59" (horas totales:minutos:segundos). */
export function formatChestClock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const p = (v: number) => String(v).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}

/** "1 d 5 h", "3 h 20 m", "12 m" */
export function formatChestTime(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${mm} m`;
  return `${mm} m`;
}
