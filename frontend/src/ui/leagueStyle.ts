import type { RankId } from '../domain/ranks';

/** Color identificativo de cada liga (UI Ranked). */
export const LEAGUE_STYLE: Record<RankId, { color: number; light: number; dark: number; css: string }> = {
  bronze: { color: 0xd88a4a, light: 0xffc49a, dark: 0x4a2410, css: '#ffb47a' },
  silver: { color: 0xb9c6dc, light: 0xffffff, dark: 0x2c3a52, css: '#dfe8f7' },
  gold: { color: 0xffc42e, light: 0xfff1b8, dark: 0x4a3200, css: '#ffd23f' },
  platinum: { color: 0x3fe0c8, light: 0xc4fff4, dark: 0x0b3f3a, css: '#7ff5e2' },
  diamond: { color: 0x5aa8ff, light: 0xd4e9ff, dark: 0x0e2a5c, css: '#9fd0ff' },
  challenger: { color: 0xff4f9a, light: 0xffc4de, dark: 0x4a0e2c, css: '#ff8fc0' },
};

export const fmtCoins = (n: number) => n.toLocaleString('es-CL');

/** "3d 04h" / "5h 12m" / "12m". */
export function fmtLeft(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`;
  if (h > 0) return `${h}h ${String(mm).padStart(2, '0')}m`;
  return `${mm}m`;
}
