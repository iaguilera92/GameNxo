const fs = require('fs');
function rep(f, a, b) { let t = fs.readFileSync(f, 'utf8'); const crlf = t.includes('\r\n'); if (crlf) t = t.replace(/\r\n/g, '\n'); if (!t.includes(a)) throw new Error('no anchor: ' + a.slice(0, 60)); t = t.replace(a, b); if (crlf) t = t.replace(/\n/g, '\r\n'); fs.writeFileSync(f, t, 'utf8'); }
const S = 'src/fx/spectators.ts';
const a0 = "    // (22-11-2026) imagen nueva: sentados en el borde del escalón, pies al pie de su frente.";
const raw = fs.readFileSync(S, 'utf8'); const crlf = raw.includes('\r\n'); let t = raw.replace(/\r\n/g, '\n');
const i0 = t.indexOf(a0), i1 = t.indexOf('    ],', i0);
if (i0 < 0 || i1 < 0) throw new Error('no seats');
const seats = `    // (22-11-2026, usuario) imagen de ChatGPT con las gradas ENDEREZADAS (_temp/warp-gradas.mjs): corren paralelas a la cancha. Pies sobre el
    // borde iluminado del escalón donde se sientan (px de la imagen de 1536). Grada izquierda: escalón de abajo (401,358)->(220,588), el de encima
    // (352,337)->(220,472); grada derecha: escalón de abajo (1133,358)->(1323,576). En pantalla se ve de x ~284 a ~1252 (y la cámara se mueve un poco)
    seats: [
      { row: 1, x: 321, y: 369, flip: false, every: [4000, 9000] }, // grada izquierda, escalón de encima, más afuera: celular (se dibuja antes: queda detrás)
      { row: 0, x: 380, y: 385, flip: false, every: [5000, 11000] }, // grada izquierda, escalón de abajo junto a la esquina: mira el partido
      { row: 2, x: 1164, y: 393, flip: true, every: [10000, 20000] }, // grada derecha, escalón de abajo junto a la esquina: toma refresco de vez en cuando
      { row: 0, x: 1219, y: 456, flip: true, every: [6000, 12000] }, // grada derecha, escalón de abajo, más hacia la red: mira el partido
`;
t = t.slice(0, i0) + seats + t.slice(i1);
fs.writeFileSync(S, crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
rep('src/view/CourtView.ts', "  // (22-11-2026, usuario) imagen nueva (redibujada para la cancha actual, guia _temp/guia-ambiente-1-cancha.png): muro del fondo medido, borde de arriba y 298, pie y 350",
  "  // (22-11-2026, usuario) imagen de ChatGPT con las GRADAS ENDEREZADAS a la perspectiva de la cancha (_temp/warp-gradas.mjs; original en\n  // _temp/respaldo_oficial/ambientes/ambiente-1-1254-v3.png): muro del fondo medido, borde de arriba y 298, pie y 350");
console.log('ok');
