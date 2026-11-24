// (24-11-2026) Datos: Default inicial de todos; FUEGO (ESPECIAL y ULTI) se compra; sin iniciales por personaje.
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  // ---------------- smashPowers
  ['domain/smashPowers.ts', ` * - FUEGO es el de siempre y es de todos. HIELO,`, ` * - (24-11-2026, usuario) DEFAULT es el inicial de todos (rareza Default). FUEGO ya no es gratis: se compra como los demás.
 * - HIELO,`],
  ['domain/smashPowers.ts', `export const SMASH_POWERS: SmashPowerDef[] = [
`, `export const SMASH_POWERS: SmashPowerDef[] = [
  // (24-11-2026, usuario) DEFAULT: el inicial de todos. Brillo blanco suave, sin partículas grandes; aturde igual que los otros.
  { id: 'default', name: 'DEFAULT', ball: 'SMASH DEFAULT', desc: 'Pelota con un brillo blanco. Si el rival la toca, sale despedido.', color: 0xdfe8ff, css: '#eef4ff' },
`],
  ['domain/smashPowers.ts', `/** Poder que se usa: el elegido (si es válido) o el fuego de siempre. */
export function smashPowerOf(chosen: unknown): SmashPower {
  return isSmashPower(chosen) ? chosen : 'fire';
}`, `/** Poder que se usa: el elegido (si es válido) o el DEFAULT. */
export function smashPowerOf(chosen: unknown): SmashPower {
  return isSmashPower(chosen) ? chosen : 'default';
}`],
  ['domain/smashPowers.ts', `/** ¿Lo tiene el jugador? FUEGO es de todos; el resto se compra en la Tienda (ítem \`smash:<poder>\`). */
export function smashOwned(owned: readonly string[], id: SmashPower): boolean {
  return id === 'fire' || owned.includes(\`smash:\${id}\`);
}`, `/** ¿Lo tiene el jugador? DEFAULT es de todos; el resto (también FUEGO, 24-11-2026) se compra en la Tienda (ítem \`smash:<poder>\`). */
export function smashOwned(owned: readonly string[], id: SmashPower): boolean {
  return id === 'default' || owned.includes(\`smash:\${id}\`);
}`],
  // ---------------- infernoPowers
  ['domain/infernoPowers.ts', `export const INFERNO_POWERS: InfernoPowerDef[] = [
`, `export const INFERNO_POWERS: InfernoPowerDef[] = [
  // (24-11-2026, usuario) DEFAULT: la ULTI inicial de todos (rareza Default). Esfera dorada por código, más que la carga máxima y menos que las de la Tienda.
  { id: 'default', name: 'DEFAULT', ball: 'BOLA DEFAULT', desc: 'Una esfera dorada que deja una estela.', color: 0xffc94a, css: '#ffe48a' },
`],
  ['domain/infernoPowers.ts', `const DEFAULT_BY_SKIN: Record<string, InfernoPower> = { mai: 'ice' };`, `// (24-11-2026, usuario) ya no hay ULTI inicial por personaje (antes Mai = hielo): todos empiezan con la DEFAULT
const DEFAULT_BY_SKIN: Record<string, InfernoPower> = {};`],
  ['domain/infernoPowers.ts', `  return (skin && DEFAULT_BY_SKIN[skin]) || 'fire';`, `  return (skin && DEFAULT_BY_SKIN[skin]) || 'default';`],
  ['domain/infernoPowers.ts', `  return power === 'fire' || owned.includes(\`inferno:\${power}\`) || infernoPowerOf(undefined, skin) === power;`, `  return power === 'default' || owned.includes(\`inferno:\${power}\`) || infernoPowerOf(undefined, skin) === power;`],
  // ---------------- chargeFx
  ['domain/chargeFx.ts', `const DEFAULT_BY_SKIN: Record<string, ChargeFxId> = { nxo: 'fire', mai: 'tulip' };`, `// (24-11-2026, usuario) ya no hay carga inicial por personaje (antes Nxo = fuego, Mai = tulipán): todos empiezan con la CLÁSICA
const DEFAULT_BY_SKIN: Record<string, ChargeFxId> = {};`],
  // ---------------- Tienda: FUEGO se compra
  ['domain/shopCatalog.ts', `  { id: 'smash:ice', kind: 'smash',`, `  { id: 'smash:fire', kind: 'smash', name: 'Fuego', price: 45, clp: 1390, minLevel: 1, available: true }, // (24-11-2026, usuario) FUEGO ya no es gratis
  { id: 'smash:ice', kind: 'smash',`],
  ['domain/shopCatalog.ts', `  { id: 'inferno:ice', kind: 'inferno',`, `  { id: 'inferno:fire', kind: 'inferno', name: 'Fuego', price: 40, clp: 1490, minLevel: 1, available: true }, // (24-11-2026, usuario) FUEGO ya no es gratis
  { id: 'inferno:ice', kind: 'inferno',`],
  // ---------------- migrate: la ULTI elegida solo si la tiene (ya no se regala la que usaba)
  ['domain/migrate.ts', `    if (isInfernoPower(eq.inferno)) {
      s.equipped.inferno = eq.inferno;
      if (eq.inferno !== 'fire' && !s.owned.includes(itemId.inferno(eq.inferno))) s.owned.push(itemId.inferno(eq.inferno));
    }`, `    // (24-11-2026, usuario) solo si la tiene (DEFAULT es de todos); antes se regalaba la que ya usaba y FUEGO era de todos
    if (isInfernoPower(eq.inferno) && infernoOwned(s.owned, eq.inferno, s.equipped.skin)) s.equipped.inferno = eq.inferno;`],
  // ---------------- bot
  ['ai/botKit.ts', `const NXO: BotKit = { defensive: 'dash', smash: 'fire', inferno: 'fire', charge: 'fire' };
const KITS: Record<string, BotKit> = {
  nxo: NXO,
  mai: { defensive: 'blink', smash: 'ice', inferno: 'ice', charge: 'tulip' },
};`, `// (24-11-2026, usuario) el kit de base del bot es el DEFAULT de todos (antes Nxo = fuego, Mai = hielo / destello / tulipán)
const NXO: BotKit = { defensive: 'dash', smash: 'default', inferno: 'default', charge: 'classic' };
const KITS: Record<string, BotKit> = {
  nxo: NXO,
  mai: NXO,
};`],
  ['ai/botKit.ts', `const SMASHES: SmashPower[] = ['fire',`, `const SMASHES: SmashPower[] = ['default', 'fire',`],
  ['ai/botKit.ts', `const INFERNOS: InfernoPower[] = ['fire',`, `const INFERNOS: InfernoPower[] = ['default', 'fire',`],
  // ---------------- PERSONAJE: el "por defecto" es DEFAULT
  ['scenes/CustomizeScene.ts', `...byDefault(d.id === 'fire', d.name, \`\${d.ball}. \${d.desc}\`),`, `...byDefault(d.id === 'default', d.name, \`\${d.ball}. \${d.desc}\`),`],
  ['scenes/CustomizeScene.ts', `...byDefault(d.id === 'fire', d.name, d.desc),`, `...byDefault(d.id === 'default', d.name, d.desc),`],
  ['scenes/CustomizeScene.ts', `const isDefault = !power || power.id === 'dash' || power.id === 'fire';`, `const isDefault = !power || power.id === 'dash' || power.id === 'default';`],
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
