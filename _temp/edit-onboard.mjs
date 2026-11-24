// (24-11-2026) Pantalla de inicio: nombre de usuario + elegir UN personaje (sin vuelta atrás).
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  // PlayerState.onboarded
  ['domain/player.ts', `  /** CAMBIO de ofertas de la Tienda (domain/shopRotation.ts): semana (su lunes) y categorías ya cambiadas pagando dinero; vale una vez por categoría y semana */
  shopReroll?: ShopRerollState;
}`, `  /** CAMBIO de ofertas de la Tienda (domain/shopRotation.ts): semana (su lunes) y categorías ya cambiadas pagando dinero; vale una vez por categoría y semana */
  shopReroll?: ShopRerollState;
  /** (24-11-2026, usuario) ya pasó la pantalla de inicio (nombre de usuario y personaje elegido, sin vuelta atrás: operations.completeOnboarding) */
  onboarded?: boolean;
}`],
  // ya no es de todos NXO: cada cuenta tiene SOLO el personaje que eligió
  ['domain/player.ts', `export const STARTER_ITEMS: ItemId[] = ['ability:dash', 'ability:smash', 'skin:nxo', 'style:classic'];`, `// (24-11-2026, usuario) NXO ya no es de todos: cada cuenta tiene SOLO el personaje que eligió al empezar (newPlayer / completeOnboarding)
export const STARTER_ITEMS: ItemId[] = ['ability:dash', 'ability:smash', 'style:classic'];`],
  ['domain/player.ts', `    owned: starter === 'mai' ? [...STARTER_ITEMS, 'skin:mai'] : [...STARTER_ITEMS],`, `    owned: [...STARTER_ITEMS, \`skin:\${starter}\` as ItemId],`],
  // migrate: conocer skin:nxo y conservar el personaje equipado de los perfiles de antes
  ['domain/migrate.ts', `  ...STARTER_ITEMS,
  'skin:mai',`, `  ...STARTER_ITEMS,
  'skin:nxo',
  'skin:mai',`],
  ['domain/migrate.ts', `    if (typeof skin === 'string' && s.owned.includes(\`skin:\${skin}\` as ItemId)) s.equipped.skin = skin as PlayerState['equipped']['skin'];`, `    if (typeof skin === 'string' && s.owned.includes(\`skin:\${skin}\` as ItemId)) s.equipped.skin = skin as PlayerState['equipped']['skin'];
    // (24-11-2026) perfiles de antes (NXO era de todos): el personaje con el que juega queda como suyo
    if (!s.owned.includes(\`skin:\${s.equipped.skin}\` as ItemId)) s.owned.push(\`skin:\${s.equipped.skin}\` as ItemId);`],
  ['domain/migrate.ts', `  if (Array.isArray(r.tutorial)) s.tutorial = [...new Set(r.tutorial.filter(isTutorialId))];`, `  if (Array.isArray(r.tutorial)) s.tutorial = [...new Set(r.tutorial.filter(isTutorialId))];
  if (r.onboarded === true) s.onboarded = true; // (24-11-2026) pantalla de inicio ya hecha`],
  // operación
  ['domain/operations.ts', `/** (24-11-2026, usuario) Da los REGALOS del tutorial`, `/** (24-11-2026, usuario) NOMBRE DE USUARIO: 3 a 12 letras, números, espacio, guion o guion bajo (sin espacios al principio ni al final). */
export const USERNAME = { min: 3, max: 12, re: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]+$/ };
export function validUsername(raw: string): string | null {
  const n = raw.trim().replace(/\\s+/g, ' ');
  return n.length >= USERNAME.min && n.length <= USERNAME.max && USERNAME.re.test(n) ? n : null;
}
/**
 * (24-11-2026, usuario) PANTALLA DE INICIO: nombre de usuario y el ÚNICO personaje que se regala (los demás se desbloquean en la Tienda). Sin
 * vuelta atrás: solo vale una vez por cuenta. \`playable\` = ids de los personajes que se pueden elegir (CATALOG).
 */
export function completeOnboarding(s: PlayerState, name: string, skin: string, playable: readonly string[]): OpResult {
  if (s.onboarded) return fail('already_done');
  const n = validUsername(name);
  if (!n) return fail('invalid_name');
  if (!playable.includes(skin)) return fail('invalid_skin');
  const c = clonePlayer(s);
  c.name = n;
  // solo el elegido: fuera los personajes que traía el perfil nuevo por defecto
  c.owned = [...c.owned.filter((i) => !i.startsWith('skin:')), \`skin:\${skin}\` as ItemId];
  c.equipped = { ...c.equipped, skin: skin as PlayerState['equipped']['skin'] };
  c.onboarded = true;
  return { ok: true, state: c };
}
/** ¿Falta la pantalla de inicio? Cuenta nueva (nivel 1, sin tutorial empezado) con el modo desarrollo apagado. */
export function needsOnboarding(s: Readonly<PlayerState>, devMode: boolean): boolean {
  return !devMode && !s.onboarded && s.level === 1 && !(s.tutorial?.length);
}

/** (24-11-2026, usuario) Da los REGALOS del tutorial`],
  // TUTORIAL LVL: desde el nivel 2 ya pasó la pantalla de inicio; en el 1 se ve
  ['domain/devMode.ts', `  s.level = lv;
  s.xp = 0;`, `  s.level = lv;
  s.xp = 0;
  if (lv > 1) s.onboarded = true; // en el nivel 1 se ve la pantalla de inicio (nombre y personaje)`],
  // arranque: pantalla de inicio antes del menú
  ['scenes/BootScene.ts', `  private crossfadeToMenu() {
    const cam = this.cameras.main;
    const menu = this.scene.get('Menu');`, `  private crossfadeToMenu() {
    const cam = this.cameras.main;
    // (24-11-2026, usuario) cuenta nueva: primero la pantalla de inicio (nombre de usuario y personaje)
    const first = needsOnboarding(getPlayer(), isDevMode()) ? 'Onboarding' : 'Menu';
    const menu = this.scene.get(first);`],
  ['scenes/BootScene.ts', `    this.scene.launch('Menu');
    this.scene.bringToTop();`, `    this.scene.launch(first);
    this.scene.bringToTop();`],
  ['main.ts', `  scene: [BootScene, MenuScene,`, `  scene: [BootScene, OnboardingScene, MenuScene,`],
];
const files = new Map();
for (let [f, a, b] of E) {
  const s = files.get(f) ?? readFileSync(S + f, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  a = a.replace(/\r?\n/g, eol);
  b = b.replace(/\r?\n/g, eol);
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${f}: ${n} veces: ${a.slice(0, 100)}`);
  files.set(f, s.replace(a, () => b));
}
for (const [f, s] of files) writeFileSync(S + f, s, 'utf8');
console.log('ok', files.size, 'archivos');
