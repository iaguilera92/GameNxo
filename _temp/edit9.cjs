const fs = require('fs');
function rep(f, a, b) { let t = fs.readFileSync(f, 'latin1'); const crlf = t.includes('\r\n'); const A = crlf ? a.replace(/\r?\n/g, '\r\n') : a, B = crlf ? b.replace(/\r?\n/g, '\r\n') : b; if (!t.includes(A)) throw new Error('anchor missing in ' + f + ': ' + a.slice(0, 60)); t = t.replace(A, B); fs.writeFileSync(f, t, 'latin1'); }
const cv = 'src/view/CourtView.ts';
rep(cv, `  fixedScale?: boolean;
  surface: Surface;`, `  fixedScale?: boolean;
  /**
   * (22-11-2026, usuario) y de la imagen que se pone en WALL_AT_Y (sin él, \`wallBottomY\`). Sirve para subir el muro en el dibujo sin mover la
   * imagen: las gradas, alineadas a la cancha, quedan donde estaban y la pared (choque de la pelota, paloma) se mide en su \`wallBottomY\` real
   */
  anchorY?: number;
  surface: Surface;`);
rep(cv, `  // _temp/respaldo_oficial/ambientes/ambiente-1-1254-v3.png): muro del fondo medido, borde de arriba y 298, pie y 350
  { key: 'ambiente-1', file: 'ambiente-1.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.7, fixedScale: true, wallBottomY: 350, wallTopY: 298, fenceTopY: 247,`,
`  // _temp/respaldo_oficial/ambientes/ambiente-1-1254-v3.png). (22-11-2026, usuario) MURO MAS ARRIBA y gradas mas separadas (ChatGPT sobre la
  // guia _temp/guia-muro.mjs, enderezada otra vez: ambiente-1-1254-v4-muro.png): muro borde de arriba y 251, pie y 306, malla 200. La imagen
  // sigue anclada como antes (anchorY 350 = el pie del muro anterior) para que las gradas no se muevan respecto a la cancha
  { key: 'ambiente-1', file: 'ambiente-1.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.7, fixedScale: true, anchorY: 350, wallBottomY: 306, wallTopY: 251, fenceTopY: 200,`);
rep(cv, `  const top = WALL_AT_Y - amb.wallBottomY * s;`, `  const top = WALL_AT_Y - (amb.anchorY ?? amb.wallBottomY) * s;
  const wallAtY = top + amb.wallBottomY * s; // pie del muro en pantalla (= WALL_AT_Y sin anchorY)`);
rep(cv, `return { wallAtY: WALL_AT_Y, padPx:`, `return { wallAtY, padPx:`);
const sp = 'src/fx/spectators.ts';
rep(sp, `{ row: 1, x: 321, y: 369, flip: false, every: [4000, 9000] }`, `{ row: 1, x: 318, y: 334, flip: false, every: [4000, 9000] }`);
rep(sp, `{ row: 0, x: 380, y: 385, flip: false, every: [5000, 11000] }`, `{ row: 0, x: 367, y: 367, flip: false, every: [5000, 11000] }`);
rep(sp, `{ row: 2, x: 1164, y: 393, flip: true, every: [10000, 20000] }, // grada derecha, escalón de abajo junto a la esquina`.replace('escalón', 'escal\u00c3\u00b3n'), `{ row: 2, x: 1232, y: 345, flip: true, every: [10000, 20000] }, // grada derecha, escalón de encima`.replace('escalón', 'escal\u00c3\u00b3n'));
rep(sp, `{ row: 0, x: 1219, y: 456, flip: true, every: [6000, 12000] }`, `{ row: 0, x: 1218, y: 414, flip: true, every: [6000, 12000] }`);
console.log('ok');
