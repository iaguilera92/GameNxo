import { defineConfig, type Plugin } from 'vite';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * public/personajes contiene las hojas FUENTE de los sprites (las que procesan tools/build-nxo-*.mjs) y copias
 * de seguridad ("Old sprites"): ~50 MB que el juego no usa y que acabarían dentro del APK. El juego solo lee de
 * personajes/ el retrato WebP de Nxo, la franja de la mirada (INFERNO) y los emojis; el resto se quita de dist.
 */
const KEEP_IN_PERSONAJES = ['Nxo/pj-nxo.webp', 'Nxo/pj-nxo-mirada.webp', 'Nxo/emojis'];
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
      console.log('trim-source-art: personajes/ reducido a', readdirSync(join(root, 'Nxo')).join(', '));
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
