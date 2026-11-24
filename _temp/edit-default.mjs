// (24-11-2026) Ediciones del ESPECIAL Default y la ULTI Default: cada par [archivo, viejo, nuevo]; falla si el viejo no está una sola vez.
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  // ---------------- ESPECIAL (smashFx)
  ['fx/smashFx.ts', `export const SMASH_LOOK: Record<SmashPower, SmashLook> = {
`, `export const SMASH_LOOK: Record<SmashPower, SmashLook> = {
  // (24-11-2026, usuario) DEFAULT (rareza Default, el inicial de todos): pelota con brillo blanco suave, casi sin humo ni partículas grandes.
  // Aturde igual que los otros (el golpe es el mismo).
  default: {
    ball: { core: 0xffffff, trail: 0xdfe8ff, flames: [0xffffff, 0xeef4ff, 0xcfdcf5, 0xaebfe0], rise: 0.1, shards: false },
    smoke: {
      normal: { colors: [0xeef4ff, 0xd6e2f8, 0xbfcdea], alpha: 0.12 },
      strong: { colors: [0xf6f9ff, 0xe0e9fa, 0xc8d6ef, 0xaebfe0], alpha: 0.16 },
      sparks: [0xffffff, 0xeef4ff, 0xcfdcf5],
      additive: false,
    },
    aura: { col: 0x8fa6d6, hot: 0xdfe8ff, core: 0xffffff },
    blast: { flash: 0xffffff, core: 0xeef4ff, ring: 0xcfdcf5, lines: [0xffffff, 0xaebfe0], sparks: [0xffffff, 0xeef4ff, 0xcfdcf5] },
    ring: 0xdfe8ff,
    cine: {
      colors: { core: 0xffffff, gold: 0xdfe8ff, hot: 0x8fa6d6, cyan: 0xeef4ff },
      aura: [
        [1.2, 0x8fa6d6, 0.16],
        [1.0, 0xcfdcf5, 0.18],
        [0.84, 0xffffff, 0.18],
      ],
      flashTint: 0xffffff,
    },
  },
`],
  ['fx/smashFx.ts', `const own = el === 'fire' ? undefined : (SMASH_LOOK[el].cine ?? INFERNO_LOOK[el as Exclude<SmashPower, 'shadow' | 'light' | 'comet' | 'dragon'>].cine);`,
    `const own = el === 'fire' ? undefined : (SMASH_LOOK[el].cine ?? INFERNO_LOOK[el as Exclude<SmashPower, 'shadow' | 'light' | 'comet' | 'dragon' | 'default'>].cine);`],
  ['fx/smashFx.ts', `p = { ...SMASH_CINE, ...own, particles, ...(el === 'dragon' && DRAGON_CINE_ON ? DRAGON_TIMES : {}) };`,
    `p = { ...SMASH_CINE, ...own, particles, ...(el === 'dragon' && DRAGON_CINE_ON ? DRAGON_TIMES : {}), ...(el === 'default' ? DEFAULT_LOOK : {}) };`],
  ['fx/smashFx.ts', `const CINES: Partial<Record<SmashPower, CineProfile>> = {};`,
    `/** (24-11-2026) ESPECIAL DEFAULT: la misma cinemática (mismos tiempos: los dos teléfonos la esperan igual) pero más tenue: menos oscuro y menos rayos */
const DEFAULT_LOOK: Partial<CineProfile> = { darken: 0.22, glow: 0.7, particles: 0 };

const CINES: Partial<Record<SmashPower, CineProfile>> = {};`],
  // ---------------- smashElementFx GLOW
  ['fx/smashElementFx.ts', `const GLOW: Record<SmashPower, [number, number]> = {
`, `const GLOW: Record<SmashPower, [number, number]> = {
  default: [0xaebfe0, 0xffffff], // (24-11-2026) DEFAULT: plata y blanco
`],
  // ---------------- AbilityButton (filtro del botón)
  ['ui/AbilityButton.ts', `const ELEMENT_FILTER: Record<Exclude<SmashPower, 'fire'>, string> = {
`, `const ELEMENT_FILTER: Record<Exclude<SmashPower, 'fire'>, string> = {
  default: 'grayscale(1) brightness(1.55) contrast(1.05)', // (24-11-2026) DEFAULT: plateado
`],
  // ---------------- ImpactFx (estallido de la ULTI y huella del ESPECIAL)
  ['fx/ImpactFx.ts', `const BLAST: Record<InfernoElement, { flash: number; tongues: number[]; puffs: number[]; wave: number; frags: number[]; ground: number; groundFlash: number }> = {
`, `const BLAST: Record<InfernoElement, { flash: number; tongues: number[]; puffs: number[]; wave: number; frags: number[]; ground: number; groundFlash: number }> = {
  // (24-11-2026) ULTI DEFAULT: dorado y blanco
  default: { flash: 0xfffbea, tongues: [0xffb020, 0xffc94a, 0xffe48a, 0xffffff], puffs: [0xffc94a, 0xffe48a, 0xfff6dc], wave: 0xffe48a, frags: [0xffffff, 0xfff1b8, 0xffc94a], ground: 0xffc94a, groundFlash: 0xfffbea },
`],
  ['fx/ImpactFx.ts', `const AFTER: Record<SmashPower | 'tulip', { main: number; light: number; flash: [number, number, number] | null }> = {
`, `const AFTER: Record<SmashPower | 'tulip', { main: number; light: number; flash: [number, number, number] | null }> = {
  default: { main: 0xcfdcf5, light: 0xffffff, flash: [240, 245, 255] }, // (24-11-2026) DEFAULT (ESPECIAL plateado; la ULTI usa su estallido dorado)
`],
  // ---------------- infernoGaze
  ['fx/infernoGaze.ts', `const GAZE_FX: Record<InfernoPower, { edge: number; edgeIn: number; glowIn: number; glow: number; spark: number; line: number }> = {
`, `const GAZE_FX: Record<InfernoPower, { edge: number; edgeIn: number; glowIn: number; glow: number; spark: number; line: number }> = {
  default: { edge: 0xffb020, edgeIn: 0xfff1b8, glowIn: 0xfffbea, glow: 0xffc94a, spark: 0xffffff, line: 0xffe48a }, // (24-11-2026) ULTI DEFAULT: dorado
`],
  // ---------------- wallFx
  ['fx/wallFx.ts', `const POWER_WALL: Record<FxElement, { hot: number; ring: number }> = {
`, `const POWER_WALL: Record<FxElement, { hot: number; ring: number }> = {
  default: { hot: 0xfffbea, ring: 0xffc94a }, // (24-11-2026) DEFAULT (ESPECIAL y ULTI): blanco y dorado
`],
  // ---------------- InfernoFx
  ['fx/InfernoFx.ts', `export type ProceduralBall = 'ultra' | 'barrage' | 'energy' | 'hurricane';`, `export type ProceduralBall = 'ultra' | 'barrage' | 'energy' | 'hurricane' | 'default'; // (24-11-2026) default = ULTI DEFAULT (esfera dorada por código, updateDefault)
//`],
  ['fx/InfernoFx.ts', `  return el === 'ultra' || el === 'barrage' || el === 'energy' || el === 'hurricane';`, `  return el === 'ultra' || el === 'barrage' || el === 'energy' || el === 'hurricane' || el === 'default';`],
  ['fx/InfernoFx.ts', `    else if (el === 'hurricane') addHurricanePreview(scene, c, maxW, maxH, animate); // (17-11-2026) HURACÁN`,
    `    else if (el === 'hurricane') addHurricanePreview(scene, c, maxW, maxH, animate); // (17-11-2026) HURACÁN
    else if (el === 'default') addDefaultPreview(scene, c, maxW, maxH, animate); // (24-11-2026) ULTI DEFAULT`],
  ['fx/InfernoFx.ts', `/** Tamaño en pantalla [ancho, alto] de una bola de alto \`h\` (las cuadradas, h × h). */`,
    `/** (24-11-2026) Vista previa de la ULTI DEFAULT: la esfera dorada con su brillo que late (sin hoja). */
function addDefaultPreview(scene: Phaser.Scene, c: Phaser.GameObjects.Container, maxW: number, maxH: number, animate: boolean) {
  const m = Math.min(maxW, maxH);
  ensureRadial(scene, GLOW, 64, [
    [0, 1],
    [0.35, 0.85],
    [0.7, 0.3],
    [1, 0],
  ]);
  const P = BALL_FX.default;
  const halo = scene.add.image(0, 0, GLOW).setTint(P.halo).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(m * 0.95, m * 0.95).setAlpha(0.7);
  const body = scene.add.image(0, 0, GLOW).setTint(0xffd86b).setDisplaySize(m * 0.5, m * 0.5);
  const core = scene.add.image(0, 0, GLOW).setTint(P.core).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(m * 0.32, m * 0.32);
  c.add([halo, body, core]);
  if (animate) scene.tweens.add({ targets: halo, alpha: 0.4, scale: halo.scale * 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** Tamaño en pantalla [ancho, alto] de una bola de alto \`h\` (las cuadradas, h × h). */`],
  ['fx/InfernoFx.ts', `export const INFERNO_LOOK: Record<InfernoElement, InfernoLook> = {
`, `export const INFERNO_LOOK: Record<InfernoElement, InfernoLook> = {
  // (24-11-2026, usuario) ULTI DEFAULT (rareza Default, la inicial de todos): dorada y blanca, más tenue que las de la Tienda
  default: {
    ghostTint: 0xffe48a,
    ghostRamp: [0x7a5200, 0xfff1b8],
    cine: {
      colors: { core: 0xffffff, gold: 0xffd86b, hot: 0xffb020, cyan: 0xfff1b8 },
      aura: [
        [1.25, 0xffb020, 0.18],
        [1.04, 0xffd86b, 0.2],
        [0.86, 0xfffbea, 0.2],
      ],
      flashTint: 0xfffbea,
    },
    hit: { ring: 0xffc94a, star: 0xffffff, flash: [255, 240, 190] },
  },
`],
  ['fx/InfernoFx.ts', `const CINES: Partial<Record<InfernoElement, CineProfile>> = { fire: INFERNO_CINE };`,
    `const CINES: Partial<Record<InfernoElement, CineProfile>> = {
  fire: INFERNO_CINE,
  // (24-11-2026) ULTI DEFAULT: los mismos tiempos (el partido y el otro teléfono esperan INFERNO_CINE.hitAtMs) pero más tenue: menos oscuro, sin partículas
  default: { ...INFERNO_CINE, ...INFERNO_LOOK.default.cine, darken: INFERNO_CINE.darken * 0.55, glow: INFERNO_CINE.glow * 0.75, particles: 0 },
};`],
  ['fx/InfernoFx.ts', `const BALL_FX: Record<InfernoElement, { halo: number; core: number; trail: [number, number]; bits: [number, number]; rise: number; glow: [number, number]; sparks: number[] }> = {
`, `const BALL_FX: Record<InfernoElement, { halo: number; core: number; trail: [number, number]; bits: [number, number]; rise: number; glow: [number, number]; sparks: number[] }> = {
  // (24-11-2026) ULTI DEFAULT: esfera dorada con núcleo blanco y estela dorada
  default: { halo: 0xffb020, core: 0xffffff, trail: [0xfff1b8, 0xffc94a], bits: [0xffffff, 0xffe48a], rise: 0, glow: [0xfffbea, 0xffc94a], sparks: [0xffffff, 0xfff1b8, 0xffc94a] },
`],
  ['fx/InfernoFx.ts', `  private energyT = 0;
`, `  private energyT = 0;
  /** (24-11-2026) ULTI DEFAULT (sin hoja): halo, cuerpo y núcleo dorados + estela de 8 brillos (se crean al usarse) */
  private def?: { halo: Phaser.GameObjects.Image; body: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; trail: Phaser.GameObjects.Image[]; hist: { x: number; y: number }[] };
`],
  ['fx/InfernoFx.ts', `    if (isProceduralBall(this.el)) {
      this.updateUltra(air, k, d, dt);`, `    if (this.el === 'default') {
      this.updateDefault(air, R, d);
      return;
    }
    if (isProceduralBall(this.el)) {
      this.updateUltra(air, k, d, dt);`],
  ['fx/InfernoFx.ts', `  private hide() {
    this.drawing = false;`, `  /**
   * (24-11-2026, usuario) ULTI DEFAULT: esfera dorada grande (más que la carga máxima, menos que las de la Tienda) con núcleo blanco que
   * late y una estela dorada de 8 brillos que se achican detrás. Todo por código, sin hoja.
   */
  private updateDefault(air: { sx: number; sy: number }, R: number, d: number) {
    const sc = this.scene;
    const add = Phaser.BlendModes.ADD;
    const P = BALL_FX.default;
    this.def ??= {
      halo: sc.add.image(0, 0, GLOW).setTint(P.halo).setBlendMode(add),
      body: sc.add.image(0, 0, GLOW).setTint(0xffd86b),
      core: sc.add.image(0, 0, GLOW).setTint(P.core).setBlendMode(add),
      trail: Array.from({ length: 8 }, (_, i) => sc.add.image(0, 0, GLOW).setTint(i % 2 ? P.trail[1] : P.trail[0]).setBlendMode(add)),
      hist: [],
    };
    const D = this.def;
    const pulse = 1 + 0.06 * Math.sin(this.t * 22);
    D.hist.unshift({ x: air.sx, y: air.sy });
    if (D.hist.length > 24) D.hist.length = 24;
    D.trail.forEach((o, i) => {
      const h = D.hist[Math.min(D.hist.length - 1, (i + 1) * 3)];
      const f = 1 - (i + 1) / (D.trail.length + 1);
      o.setPosition(h.x, h.y).setDisplaySize(R * 2.2 * f, R * 2.2 * f).setAlpha(0.55 * f).setDepth(d - 0.03).setVisible(D.hist.length > 3);
    });
    D.halo.setPosition(air.sx, air.sy).setDisplaySize(R * 2.9 * pulse, R * 2.9 * pulse).setAlpha(0.6).setDepth(d - 0.02).setVisible(true);
    D.body.setPosition(air.sx, air.sy).setDisplaySize(R * 1.7, R * 1.7).setAlpha(0.95).setDepth(d + 0.01).setVisible(true);
    D.core.setPosition(air.sx, air.sy).setDisplaySize(R * 1.05 * pulse, R * 1.05 * pulse).setDepth(d + 0.012).setVisible(true);
  }

  private hide() {
    this.drawing = false;
    if (this.def) {
      this.def.halo.setVisible(false);
      this.def.body.setVisible(false);
      this.def.core.setVisible(false);
      this.def.trail.forEach((o) => o.setVisible(false));
      this.def.hist.length = 0;
    }`],
];
const files = new Map();
for (let [f, a, b] of E) {
  const s = files.get(f) ?? readFileSync(S + f, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  a = a.replace(/\r?\n/g, eol);
  b = b.replace(/\r?\n/g, eol);
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${f}: ${n} veces: ${a.slice(0, 80)}`);
  files.set(f, s.replace(a, () => b));
}
for (const [f, s] of files) writeFileSync(S + f, s, 'utf8');
console.log('ok', files.size, 'archivos');
