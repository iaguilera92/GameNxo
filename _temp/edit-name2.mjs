// (24-11-2026) ¿Cómo te llamas?: título a la altura del de Elige tu personaje, subtítulo más arriba con líneas más cortas, texto de la caja
// más arriba y SIGUIENTE a la altura de ELEGIR.
import { readFileSync, writeFileSync } from 'node:fs';
const F = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/scenes/OnboardingScene.ts';
let s = readFileSync(F, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const rep = (a, b) => {
  a = a.replace(/\r?\n/g, eol);
  b = b.replace(/\r?\n/g, eol);
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${n} veces: ${a.slice(0, 80)}`);
  s = s.replace(a, () => b);
};
rep(`    const ty = H * 0.2;
    if (this.textures.exists('ob-name-title')) {
      const t = this.add.image(W / 2, ty, 'ob-name-title');
      t.setScale((W - 40) / t.width);
      c.add(t);
    } else`, `    // (24-11-2026, usuario) a la misma altura que el título de ELIGE TU PERSONAJE (TITLE_Y) y del mismo ancho
    const ty = TITLE_Y;
    let titleBottom = ty + 60;
    if (this.textures.exists('ob-name-title')) {
      const t = this.add.image(W / 2, ty, 'ob-name-title');
      t.setScale((W - 60) / t.width);
      titleBottom = ty + t.displayHeight / 2;
      c.add(t);
    } else`);
rep(`    const sy = ty + 150;`, `    const sy = titleBottom + 30; // (24-11-2026, usuario) justo bajo el título`);
rep(`    const half = sub.width / 2 + 26;
    lg.fillStyle(GOLD, 1).fillRoundedRect(W / 2 - half - 70, sy - 2, 70, 4, 2).fillRoundedRect(W / 2 + half, sy - 2, 70, 4, 2);`, `    const half = sub.width / 2 + 18;
    const LINE = 34; // (24-11-2026, usuario) líneas más cortas (antes 70)
    lg.fillStyle(GOLD, 1).fillRoundedRect(W / 2 - half - LINE, sy - 2, LINE, 4, 2).fillRoundedRect(W / 2 + half, sy - 2, LINE, 4, 2);`);
rep(`    const by = sy + 130;`, `    const by = sy + 120;`);
rep(`    this.makeInput(textL, by, W / 2 + bw / 2 - 110 - textL, bh * 0.6);`, `    // el texto de Lilita One queda bajo en un <input>: se sube un poco para que quede al medio de la caja
    this.makeInput(textL, by - bh * 0.05, W / 2 + bw / 2 - 110 - textL, bh * 0.56);`);
rep(`    c.add(arcadeButton(this, W / 2, iy + 160, 440, 108, 'SIGUIENTE', next, { palette: 'yellow', noShadow: true }));`, `    // (24-11-2026, usuario) a la misma altura que ELEGIR de la pantalla siguiente (BTN_Y) y del mismo tamaño
    c.add(arcadeButton(this, W / 2, H - BTN_Y, 420, 108, 'SIGUIENTE', next, { palette: 'yellow', noShadow: true }));`);
// ELEGIR y su título usan las mismas constantes
rep(`      const t = this.add.image(W / 2, 140, 'ob-title');`, `      const t = this.add.image(W / 2, TITLE_Y, 'ob-title');`);
rep(`    } else c.add(this.add.text(W / 2, 140, 'ELIGE TU PERSONAJE',`, `    } else c.add(this.add.text(W / 2, TITLE_Y, 'ELIGE TU PERSONAJE',`);
rep(`    const btn = arcadeButton(this, W / 2, H - 110, 420, 108, 'ELEGIR',`, `    const btn = arcadeButton(this, W / 2, H - BTN_Y, 420, 108, 'ELEGIR',`);
rep(`const PLAYABLE = CATALOG.map((c) => c.id as string);`, `const PLAYABLE = CATALOG.map((c) => c.id as string);
/** (24-11-2026, usuario) los dos pasos con el título y el botón a la misma altura: centro del título y distancia del botón al borde de abajo */
const TITLE_Y = 140;
const BTN_Y = 110;`);
// <input>: alto de línea igual al de la caja (sin relleno), así el texto queda centrado
rep(`      textAlign: 'left',
      caretColor: '#ffd23f',`, `      textAlign: 'left',
      caretColor: '#ffd23f',
      lineHeight: \`\${h * k}px\`,
      padding: '0',
      margin: '0',`);
writeFileSync(F, s, 'utf8');
console.log('ok');
