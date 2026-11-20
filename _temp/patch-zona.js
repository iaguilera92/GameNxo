const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 60) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}

// ---- rotación semanal
edit('domain/shopRotation.ts', [
  [
    " *   - EFECTO PELOTA no rota",
    " *   - ZONA (21-11-2026): se ven 2 a la vez y cambian cada SEMANA (todos los domingos, con el reinicio de la noche del sábado).\n *   - EFECTO PELOTA no rota",
  ],
  [
    "/** categorías con rotación y cada cuántas horas cambian */\nexport const ROTATION: Partial<Record<ItemKind, { hours: 12 | 24 }>> = {",
    "/** categorías con rotación: cada cuántas horas cambian, cuántos se ven a la vez (por defecto ROTATION_SHOW) y si el contador sale siempre */\nexport const ROTATION: Partial<Record<ItemKind, { hours: 12 | 24 | 168; show?: number; alwaysTimer?: boolean }>> = {",
  ],
  [
    "  inferno: { hours: 24 },\n};",
    "  inferno: { hours: 24 },\n  // semanal; el contador sale siempre (aunque hoy se vean las 2 a la vez, cuando haya más estilos de zona rotarán)\n  zone: { hours: 168, show: 2, alwaysTimer: true },\n};",
  ],
  [
    "export function rotationWindow(now: number, hours: 12 | 24): { id: number; nextMs: number } {\n  const next = msToNextReset(now);\n  const [y, m, d] = cycleIdAt(now).split('-').map(Number);\n  const day = Math.round(Date.UTC(y, m - 1, d) / 86400_000);\n  if (hours === 24) return { id: day, nextMs: next };",
    "export function rotationWindow(now: number, hours: 12 | 24 | 168): { id: number; nextMs: number } {\n  const next = msToNextReset(now);\n  const [y, m, d] = cycleIdAt(now).split('-').map(Number);\n  const day = Math.round(Date.UTC(y, m - 1, d) / 86400_000);\n  if (hours === 24) return { id: day, nextMs: next };\n  if (hours === 168) {\n    // semana de domingo a domingo (el día 3 desde 1970-01-01 fue domingo): cambia con el reinicio que abre el domingo\n    const dow = (((day - 3) % 7) + 7) % 7; // 0 = domingo\n    return { id: Math.floor((day - 3) / 7), nextMs: next + (6 - dow) * 86400_000 };\n  }",
  ],
  [
    "export function shopOffers(kind: ItemKind, now: number): ShopItem[] {\n  const rot = ROTATION[kind];\n  const items = pool(kind);\n  if (!rot || items.length <= ROTATION_SHOW) return items;",
    "export function shopOffers(kind: ItemKind, now: number): ShopItem[] {\n  const rot = ROTATION[kind];\n  const items = pool(kind);\n  const show = rot?.show ?? ROTATION_SHOW;\n  if (!rot || items.length <= show) return items;",
  ],
  [
    "  const start = (w.id * ROTATION_SHOW) % order.length;\n  return Array.from({ length: ROTATION_SHOW }, (_, i)",
    "  const start = (w.id * show) % order.length;\n  return Array.from({ length: show }, (_, i)",
  ],
  [
    "  if (!rot || pool(kind).length <= ROTATION_SHOW) return null;",
    "  if (!rot || (pool(kind).length <= (rot.show ?? ROTATION_SHOW) && !rot.alwaysTimer)) return null;",
  ],
]);

// ---- textos breves de las cards de la Tienda
fs.writeFileSync(
  base + 'domain/shopBlurbs.ts',
  `/**
 * TEXTOS BREVES de las cards de la Tienda (21-11-2026, usuario): máximo 4 palabras. La descripción completa de cada poder
 * (infernoPowers, smashPowers, defensivePowers, chargeFx, zoneSkins) sigue en la vista previa; esto solo va en la card.
 * Datos puros, sin Phaser. El id de un poder no cambia nunca (docs/BASE-DE-DATOS.md): se busca por tipo + id.
 */
export type BlurbKind = 'inferno' | 'smash' | 'defensive' | 'charge' | 'zone';
const BLURBS: Record<BlurbKind, Record<string, string>> = {
  inferno: {
    fire: 'Golpe de fuego devastador',
    ice: 'Remolino de hielo',
    wind: 'Torbellino de viento',
    lightning: 'Esfera eléctrica',
    tulip: 'Ráfaga de pétalos',
    shadow: 'Esfera de oscuridad',
    light: 'Luz sagrada dorada',
    ultra: 'Efecto brutal de aire',
    barrage: 'Ráfaga de pelotas',
    energy: 'Bola de energía gigante',
    hurricane: 'Viento y tornado',
  },
  smash: {
    fire: 'Bola de fuego',
    ice: 'Pelota helada',
    wind: 'Torbellino verde',
    lightning: 'Pelota eléctrica',
    shadow: 'Esfera de sombra',
    light: 'Esfera de luz',
    comet: 'Meteorito con cráter',
    dragon: 'Dragón de fuego',
  },
  defensive: {
    dash: 'Sprint explosivo',
    blink: 'Teletransporte con revés',
    shadow: 'Clon de sombra',
    jump: 'Salto con onda',
    flip: 'Volteretas laterales',
    skate: 'Patinaje sobre hielo',
    lightning: 'Rayo con estela',
    slowmo: 'Tiempo lento',
  },
  charge: {
    classic: 'Aro de energía',
    fire: 'Aro de llamas',
    energy: 'Aro de energía azul',
    tulip: 'Pétalos giratorios',
  },
  zone: {
    electric: 'Rayo en los ojos',
    fire: 'Aura de llamas',
    shadow: 'Oscuridad y humo',
  },
};
/** Texto breve de la card; si un poder nuevo aún no lo tiene, sus primeras 4 palabras. */
export function shopBlurb(kind: BlurbKind, id: string, fullDesc: string): string {
  const b = BLURBS[kind][id];
  if (b) return b;
  return fullDesc.split(/\\s+/).slice(0, 4).join(' ').replace(/[.,:;]+$/, '');
}
`,
);

// ---- ShopScene
edit('scenes/ShopScene.ts', [
  ["import { LEGENDARY_EMOTES, type EmoteKind } from '../domain/emotes';", "import { LEGENDARY_EMOTES, type EmoteKind } from '../domain/emotes';\nimport { shopBlurb } from '../domain/shopBlurbs';"],
  // zona: 2 cards que rotan cada semana, con contador
  [
    "    this.sectionTitle(W, y, 'ZONA', INFO.zone);\n    y += titleGap;\n    const zc = cols3(ZONE_SKIN_IDS.length);\n    const zh = 270;\n    ZONE_SKIN_IDS.forEach((zid, i) => {\n      this.zoneCard(zc.x(i), y, zc.w, zh, zid, SHOP_ITEMS.find((it) => it.id === `zone:${zid}`));\n      this.reg(y, zh);\n    });",
    "    // (21-11-2026, usuario) 2 cards que cambian cada SEMANA (domingo), con su contador (domain/shopRotation.ts)\n    this.sectionTitle(W, y, 'ZONA', INFO.zone, { kind: 'zone', now });\n    y += titleGap;\n    const zoneItems = shopOffers('zone', now);\n    const zc = cols3(zoneItems.length);\n    const zh = 270;\n    zoneItems.forEach((zit, i) => {\n      this.zoneCard(zc.x(i), y, zc.w, zh, zit.id.split(':')[1] as ZoneSkinId, zit);\n      this.reg(y, zh);\n    });",
  ],
  ["(['charge', 'inferno', 'smash', 'defensive'] as ItemKind[])", "(['charge', 'inferno', 'smash', 'defensive', 'zone'] as ItemKind[])"],
  // textos breves
  ["has ? 'COMPRADO' : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : legend", "has ? 'COMPRADO' : shopBlurb('inferno', power, def.desc), { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : legend"],
]);
