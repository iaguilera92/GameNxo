import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * public/personajes contiene las hojas FUENTE de los sprites (las que procesan tools/build-nxo-*.mjs) y copias
 * de seguridad ("Old sprites"): ~50 MB que el juego no usa y que acabarían dentro del APK. El juego solo lee de
 * personajes/ el retrato WebP de Nxo y las franjas de la mirada (INFERNO de Nxo y Mai); el resto se quita de dist.
 * (Los emojis de personajes/Nxo/emojis/ son fuentes de tools/build-emote-thumbs.mjs: el juego usa assets/emotes/.)
 */
const KEEP_IN_PERSONAJES = ['Nxo/pj-nxo.webp', 'Nxo/pj-nxo-mirada.webp', 'Mai/pj-mai-mirada.webp'];
function trimSourceArt(): Plugin {
  let outDir = 'dist';
  return {
    name: 'trim-source-art',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const root = join(outDir, 'personajes');
      if (!existsSync(root)) return;
      const keep = join(outDir, '.keep-personajes');
      mkdirSync(keep, { recursive: true });
      for (const rel of KEEP_IN_PERSONAJES) {
        const from = join(root, rel);
        if (existsSync(from)) cpSync(from, join(keep, rel), { recursive: true });
      }
      rmSync(root, { recursive: true, force: true });
      cpSync(keep, root, { recursive: true });
      rmSync(keep, { recursive: true, force: true });
      const dirs = readdirSync(root);
      console.log('trim-source-art: personajes/ reducido a', dirs.map((d) => `${d}/{${readdirSync(join(root, d)).join(', ')}}`).join(' '));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [trimSourceArt()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
