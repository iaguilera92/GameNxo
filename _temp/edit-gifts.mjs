// (24-11-2026) Regalos del tutorial: color GRIS (nivel 8) y estela AZUL (nivel 10).
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  // color GRIS
  ['domain/charColors.ts', `export type CharColorId = 'classic' | 'azul' | 'verde' | 'morado' | 'dorado' | 'sombra';`, `export type CharColorId = 'classic' | 'azul' | 'verde' | 'morado' | 'dorado' | 'sombra' | 'gris'; // gris = regalo del tutorial (nivel 8, 24-11-2026)`],
  ['domain/charColors.ts', `  { id: 'sombra', name: 'SOMBRA', desc: 'Tu ropa oscura, sin color.', color: 0x4a5266 },
`, `  { id: 'sombra', name: 'SOMBRA', desc: 'Tu ropa oscura, sin color.', color: 0x4a5266 },
  // (24-11-2026, usuario) GRIS: regalo del tutorial en el nivel 8 (rareza especial), para todos tus personajes
  { id: 'gris', name: 'GRIS', desc: 'Tu ropa en gris claro.', color: 0xa7afbd },
`],
  ['fx/CharColorFx.ts', `  { id: 'sombra', name: 'SOMBRA', to: null, sat: 0.12, bright: 0.5 },
`, `  { id: 'sombra', name: 'SOMBRA', to: null, sat: 0.12, bright: 0.5 },
  { id: 'gris', name: 'GRIS', to: null, sat: 0.06, bright: 0.95 }, // (24-11-2026) regalo del tutorial (nivel 8): gris claro
`],
  // estela AZUL
  ['domain/player.ts', `export type StyleId = 'classic' | 'red' | 'green' | 'gold' | 'pink' |`, `export type StyleId = 'classic' | 'blue' | 'red' | 'green' | 'gold' | 'pink' |`],
  ['ui/styleLook.ts', `  red: { color: 0xff4f5e,`, `  // (24-11-2026, usuario) AZUL: regalo del tutorial (nivel 10, rareza especial)
  blue: { color: 0x3a8bff, dark: 0x1a4fb0, trail: 0x4fa8ff, sparkle: false, fx: 'plain', perk: 'Estela azul' },
  red: { color: 0xff4f5e,`],
  ['scenes/CustomizeScene.ts', `const STYLE_NAME: Record<string, string> = { classic: 'POR DEFECTO', red: 'ROJO',`, `const STYLE_NAME: Record<string, string> = { classic: 'POR DEFECTO', blue: 'AZUL', red: 'ROJO',`],
  ['domain/shopCatalog.ts', `  { id: 'style:red', kind: 'style',`, `  { id: 'style:blue', kind: 'style', name: 'Azul', price: 40, clp: 490, minLevel: 1, available: true }, // (24-11-2026) regalo del tutorial (nivel 10)
  { id: 'style:red', kind: 'style',`],
  ['domain/shopCatalog.ts', `'style:red': 'especial',`, `'style:blue': 'especial', 'style:red': 'especial',`],
  ['domain/shopCatalog.ts', `const DEFAULT_ITEMS = new Set<string>([`, `/** (24-11-2026) rareza de los colores de ropa que no se venden (regalos) */
const GIFT_RARITY: Record<string, ItemRarity> = { 'color:gris': 'especial' };
const DEFAULT_ITEMS = new Set<string>([`],
  ['domain/shopCatalog.ts', `?? (DEFAULT_ITEMS.has(id) ? 'default' : undefined);`, `?? GIFT_RARITY[id] ?? (DEFAULT_ITEMS.has(id) ? 'default' : undefined);`],
  // regalos por nivel (datos)
  ['domain/tutorial.ts', `export const GUIDE = {`, `/**
 * (24-11-2026, usuario) REGALOS del tutorial: al llegar al nivel se le dan (si aún no los tiene). GRIS = color de ropa para todos sus personajes
 * (ítem \`color:gris\`); AZUL = estela de pelota. Los da \`grantTutorialGifts\` (domain/operations.ts).
 */
export const TUTORIAL_GIFTS: { level: number; item: string }[] = [
  { level: 8, item: 'color:gris' },
  { level: 10, item: 'style:blue' },
];

export const GUIDE = {`],
  // operación
  ['domain/operations.ts', `/** Suma DINERO virtual (billetes, gems): premios de la ruleta, del pase, etc. */`, `/** (24-11-2026, usuario) Da los REGALOS del tutorial de los niveles ya alcanzados que aún no tiene (idempotente; domain/tutorial.ts TUTORIAL_GIFTS). */
export function grantTutorialGifts(s: PlayerState): OpResult {
  const add = TUTORIAL_GIFTS.filter((g) => g.level <= s.level && !s.owned.includes(g.item as ItemId)).map((g) => g.item as ItemId);
  if (!add.length) return { ok: true, state: s };
  const n = clonePlayer(s);
  n.owned = [...n.owned, ...add];
  return { ok: true, state: n };
}

/** Suma DINERO virtual (billetes, gems): premios de la ruleta, del pase, etc. */`],
  // TUTORIAL LVL también los da
  ['domain/devMode.ts', `  const seen = tutorialSeenBefore(lv);
  if (seen.length) s.tutorial = seen;`, `  const seen = tutorialSeenBefore(lv);
  if (seen.length) s.tutorial = seen;
  // regalos de los niveles ya pasados (gris, estela azul)
  for (const g of TUTORIAL_GIFTS) if (g.level <= lv && !s.owned.includes(g.item as ItemId)) s.owned.push(g.item as ItemId);`],
  ['domain/devMode.ts', `import { tutorialSeenBefore } from './tutorial';`, `import { TUTORIAL_GIFTS, tutorialSeenBefore } from './tutorial';`],
];
const files = new Map();
for (let [f, a, b] of E) {
  const s = files.get(f) ?? readFileSync(S + f, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  a = a.replace(/\r?\n/g, eol);
  b = b.replace(/\r?\n/g, eol);
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${f}: ${n} veces: ${a.slice(0, 90)}`);
  files.set(f, s.replace(a, () => b));
}
for (const [f, s] of files) writeFileSync(S + f, s, 'utf8');
console.log('ok', files.size, 'archivos');
