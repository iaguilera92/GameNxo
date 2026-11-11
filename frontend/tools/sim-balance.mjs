// Simulación de balance de las habilidades (bot contra bot, sin pantalla).
// Uso (desde frontend/):  node tools/sim-balance.mjs [--exp=usage|impact|matrix|all] [--matches=100] [--seed=1] [--tiers=normal,dificil] [--smashCd=30] [--dashCd=8] [--ultiPts=4] [--table=plana] [--powerSpeed=0.75] [--powerByTier=0.7,0.75,0.85,0.9,1] [--stunS=0.4] [--weakK=0.8]
// Empaqueta tools/sim/run.ts con esbuild, cambia Phaser por un stub mínimo (Math.Clamp/FloatBetween/Between/Vector2) y
// usa el código real del juego: BotBrain, BotAI, Ball (stepBall/aimShot), Score, PowerImpact. Ver tools/sim/balance.ts.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const matches = Number(args.matches ?? 100);
const exp = String(args.exp ?? 'all');
const seed = Number(args.seed ?? 1);
const entry = String(args.entry ?? 'tools/sim/run.ts'); // (depuración) otro archivo de entrada que exporte run()
const ALL_TIERS = ['principiante', 'facil', 'normal', 'dificil', 'experto'];
const tiers = args.tiers ? String(args.tiers).split(',') : ALL_TIERS;
if (tiers.some((t) => !ALL_TIERS.includes(t))) throw new Error(`niveles válidos: ${ALL_TIERS.join(', ')}`);

const PHASER_STUB = `
class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
export default { Math: {
  Clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
  FloatBetween: (a, b) => a + Math.random() * (b - a),
  Between: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  Vector2,
} };
`;

const plugin = {
  name: 'sim-balance',
  setup(b) {
    b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'phaser-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'phaser-stub' }, () => ({ contents: PHASER_STUB, loader: 'js' }));
    // objects/Ball.ts mezcla la física (pura) con la pelota dibujada (Phaser): se usa solo lo de antes de la clase Ball
    b.onLoad({ filter: /objects[\\/]Ball\.ts$/ }, (a) => {
      const src = readFileSync(a.path, 'utf8');
      const cut = src.indexOf('/** Pelota visual');
      if (cut < 0) throw new Error('Ball.ts cambió: no encuentro "/** Pelota visual" para separar la física');
      const head = src
        .slice(0, cut)
        .split(/\r?\n/)
        .filter((l) => !/^import /.test(l) || /from '\.\.\/config'/.test(l))
        .join('\n');
      return { contents: head, loader: 'ts', resolveDir: dirname(a.path) };
    });
  },
};

// generador con semilla (mulberry32): las simulaciones se pueden repetir
let s = seed >>> 0;
Math.random = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const dir = mkdtempSync(join(tmpdir(), 'nxo-sim-'));
const out = join(dir, 'sim.mjs');
try {
  await build({ entryPoints: [join(ROOT, entry)], bundle: true, platform: 'node', format: 'esm', outfile: out, plugins: [plugin], logLevel: 'warning' });
  const mod = await import(pathToFileURL(out).href);
  console.log(`Simulación de balance · ${matches} partidos por celda · semilla ${seed} · niveles: ${tiers.join(', ')}`);
  await mod.run({ matches, exp, tiers, smashCd: Number(args.smashCd) || undefined, dashCd: Number(args.dashCd) || undefined, ultiPts: Number(args.ultiPts) || undefined, table: args.table, powerSpeed: Number(args.powerSpeed) || undefined, powerByTier: args.powerByTier, stunS: Number(args.stunS) || undefined, weakK: Number(args.weakK) || undefined });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
