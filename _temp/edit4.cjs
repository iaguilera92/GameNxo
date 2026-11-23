const fs = require('fs');
function rep(f, a, b) { let t = fs.readFileSync(f, 'utf8'); const crlf = t.includes('\r\n'); if (crlf) t = t.replace(/\r\n/g, '\n'); if (!t.includes(a)) throw new Error('no anchor: ' + a.slice(0, 60)); t = t.replace(a, b); if (crlf) t = t.replace(/\n/g, '\r\n'); fs.writeFileSync(f, t, 'utf8'); }
rep('src/view/CourtView.ts', "Gradas a los dos costados: zoom 0.7 como el barrio para que entren en pantalla\n  { key: 'ambiente-2', file: 'ambiente-2.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.7,",
"Gradas a los dos costados: zoom 0.6 (con 0.7 casi no entraban en pantalla y los espectadores no se veian, 22-11-2026)\n  { key: 'ambiente-2', file: 'ambiente-2.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.6,");
rep('src/fx/spectators.ts', `    h: 52,
    fps: 7,
    seats: [
      { row: 0, x: 398, y: 425, flip: false, every: [6000, 12000] }, // grada izquierda, escalon de abajo: lentes de sol, aplaude
      { row: 3, x: 366, y: 449, flip: false, every: [7000, 14000] }, // a su lado, mas cerca: el perrito (mueve la cabeza y saca la lengua)
      { row: 2, x: 1166, y: 397, flip: true, every: [5000, 10000] }, // grada derecha, escalon de encima: mira el celular (se dibuja antes: queda detras)
      { row: 1, x: 1136, y: 425, flip: true, every: [6000, 12000] }, // grada derecha, escalon de abajo: la chica, aplaude
    ],`, `    h: 80, // (22-11-2026, usuario: con 52 no se veian) ~60 px en pantalla con el zoom 0.6
    fps: 7,
    // en pantalla (zoom 0.6) se ve de x ~288 a ~1248 de la imagen: los asientos van en la esquina de cada grada, junto al muro
    seats: [
      { row: 3, x: 420, y: 410, flip: false, every: [7000, 14000] }, // grada izquierda, junto a la esquina: el perrito (se dibuja antes: queda detras)
      { row: 0, x: 360, y: 448, flip: false, every: [6000, 12000] }, // grada izquierda, escalon de abajo: lentes de sol, aplaude
      { row: 2, x: 1196, y: 413, flip: true, every: [5000, 10000] }, // grada derecha, escalon de encima: mira el celular (detras)
      { row: 1, x: 1136, y: 428, flip: true, every: [6000, 12000] }, // grada derecha, escalon de abajo: la chica, aplaude
    ],`);
