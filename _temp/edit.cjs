const fs = require('fs');
function rep(f, a, b) { let t = fs.readFileSync(f, 'utf8'); const crlf = t.includes('\r\n'); if (crlf) t = t.replace(/\r\n/g, '\n'); if (!t.includes(a)) throw new Error('no anchor in ' + f + ': ' + a.slice(0, 60)); t = t.replace(a, b); if (crlf) t = t.replace(/\n/g, '\r\n'); fs.writeFileSync(f, t, 'utf8'); }
rep('src/view/CourtView.ts',
"  { key: 'ambiente-2', file: 'ambiente-2.webp', w: 1536, h: 1024, wallBottomY: 345, wallTopY: 268, fenceTopY: 196, surface: 'clay', sky: 0x0c2e35 },",
"  // (22-11-2026, usuario) ARCILLA nueva (1536 x 1536, estructura estándar): muro verde del fondo medido sobre la imagen (borde de arriba en y 318,\n  // pie en y 396; postes de la malla hasta y ~251). Gradas a los dos costados: zoom 0.7 como el barrio para que entren en pantalla\n  { key: 'ambiente-2', file: 'ambiente-2.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.7, wallBottomY: 396, wallTopY: 318, fenceTopY: 251, surface: 'clay', sky: 0x0c2e35 },");
rep('src/view/CourtView.ts', "const PRUEBA_1V1: string | null = 'ambiente-1';", "const PRUEBA_1V1: string | null = 'ambiente-2'; // (22-11-2026) probando la arcilla nueva");
rep('src/scenes/MatchScene.ts', "    if (!this.doubles) queueSpectators(this.load, 'ambiente-1'); // (21-11-2026, usuario) espectadores en las gradas del barrio",
"    if (!this.doubles) queueSpectators(this.load, 'ambiente-1'); // (21-11-2026, usuario) espectadores en las gradas del barrio\n    if (!this.doubles) queueSpectators(this.load, 'ambiente-2'); // (22-11-2026, usuario) espectadores y perrito en las gradas de la arcilla");
rep('src/fx/spectators.ts', "import BARRIO from '../view/espectadores-barrio.json';", "import BARRIO from '../view/espectadores-barrio.json';\nimport ARCILLA from '../view/espectadores-arcilla.json';");
rep('src/fx/spectators.ts', "  /** fila de la hoja: 0 mira el partido, 1 mira el celular, 2 toma refresco */", "  /** fila de la hoja (barrio: 0 mira el partido, 1 celular, 2 refresco; arcilla: 0 lentes de sol, 1 chica, 2 celular, 3 perrito) */");
rep('src/fx/spectators.ts', "    ],\n  },\n};", `    ],
  },
  // (22-11-2026, usuario) ARCILLA (ambiente-2): hoja ambiente-2-figuras (4 filas x 8, fondo de tablero quitado con _temp/prep-figuras.mjs y
  // luego tools/build-paseantes.mjs <png> espectadores-arcilla 4 8). Miran a la DERECHA. Pies sobre el borde de los escalones de abajo, en px de
  // la imagen de 1536: grada izquierda borde (441,394)->(0,717), el de encima (404,380)->(0,588); grada derecha, espejada
  'ambiente-2': {
    key: 'spect-arcilla',
    meta: ARCILLA,
    h: 52,
    fps: 7,
    seats: [
      { row: 0, x: 398, y: 425, flip: false, every: [6000, 12000] }, // grada izquierda, escalon de abajo: lentes de sol, aplaude
      { row: 3, x: 366, y: 449, flip: false, every: [7000, 14000] }, // a su lado, mas cerca: el perrito (mueve la cabeza y saca la lengua)
      { row: 2, x: 1166, y: 397, flip: true, every: [5000, 10000] }, // grada derecha, escalon de encima: mira el celular (se dibuja antes: queda detras)
      { row: 1, x: 1136, y: 425, flip: true, every: [6000, 12000] }, // grada derecha, escalon de abajo: la chica, aplaude
    ],
  },
};`);
