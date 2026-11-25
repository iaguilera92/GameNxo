import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const R='frontend/src/scenes/RankedScene.ts';
apply(R,[
["  tabs1: { key: 'liga-tabs', file: 'assets/liga/pestanas-liga.webp', ar: 2000 / 667,", "  // (25-11-2026) `w0` = ancho ORIGINAL del archivo: los recortes (LIGA_PIECES, `off`) siguen en px del original y piece() los escala al\n  // ancho real del archivo (las imágenes se achicaron a la mitad: se ven a ≤ 660 px en un lienzo de 720)\n  tabs1: { key: 'liga-tabs', file: 'assets/liga/pestanas-liga.webp', w0: 2000, ar: 2000 / 667,"],
["file: 'assets/liga/pestanas-liga-2v2.webp', ar:", "file: 'assets/liga/pestanas-liga-2v2.webp', w0: 2000, ar:"],
["file: 'assets/liga/escenario-liga.webp', ar:", "file: 'assets/liga/escenario-liga.webp', w0: 1774, ar:"],
["file: 'assets/liga/card-0.webp', off:", "file: 'assets/liga/card-0.webp', w0: 638, off:"],
["file: 'assets/liga/card-1.webp', off:", "file: 'assets/liga/card-1.webp', w0: 635, off:"],
["file: 'assets/liga/card-2.webp', off:", "file: 'assets/liga/card-2.webp', w0: 639, off:"],
["file: 'assets/liga/panel-recompensa.webp', ar:", "file: 'assets/liga/panel-recompensa.webp', w0: 2000, ar:"],
["file: 'assets/liga/botones-liga.webp', ar:", "file: 'assets/liga/botones-liga.webp', w0: 2000, ar:"],
["file: 'assets/liga/titulo-lideres.webp', ar:", "file: 'assets/liga/titulo-lideres.webp', w0: 2000, ar:"],
["file: 'assets/liga/podio-0.webp', off:", "file: 'assets/liga/podio-0.webp', w0: 542, off:"],
["file: 'assets/liga/podio-1.webp', off:", "file: 'assets/liga/podio-1.webp', w0: 643, off:"],
["file: 'assets/liga/podio-2.webp', off:", "file: 'assets/liga/podio-2.webp', w0: 541, off:"],
["file: 'assets/liga/btn-top100.webp', ar:", "file: 'assets/liga/btn-top100.webp', w0: 2000, ar:"],
["  private piece(art: { key: string; off?: readonly number[] }, name: string, r: Piece, left: number, top: number, w: number) {", "  private piece(art: { key: string; off?: readonly number[]; w0?: number }, name: string, r: Piece, left: number, top: number, w: number) {"],
["    if (!tex.has(name)) tex.add(name, 0, r[0] - ox, r[1] - oy, r[2], r[3]);", "    // (25-11-2026) el archivo puede estar achicado: el recorte (en px del original) se pasa a px del archivo real\n    const k = art.w0 ? (tex.getSourceImage() as { width: number }).width / art.w0 : 1;\n    if (!tex.has(name)) tex.add(name, 0, (r[0] - ox) * k, (r[1] - oy) * k, r[2] * k, r[3] * k);"],
["    const P = this.piece({ key }, is2 ? 'tabs2' : 'tabs1', LIGA_PIECES.tabs,", "    const P = this.piece(is2 ? LIGA_ART.tabs2 : LIGA_ART.tabs1, is2 ? 'tabs2' : 'tabs1', LIGA_PIECES.tabs,"],
]);
console.log('ok');
