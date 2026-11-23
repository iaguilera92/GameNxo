import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-3-1254-v2.png'); const W = im.w;
const P = (x, y) => { const d = (y * W + x) * 4; return [im.px[d], im.px[d+1], im.px[d+2]].join(','); };
const pts = { asf1:[220,250], asf2:[310,240], asf3:[100,300], asf4:[30,370], asfFar:[330,250], amarilla:[220,292], blanca:[230,250], malla1:[230,340], malla2:[100,420], malla3:[250,320], arbusto:[350,265], muro:[380,290], vereda:[300,360], poste:[285,200], posteAm:[288,200], rejaVerde:[240,330], curbFar:[250,212], curbFar2:[100,222], arbAtras:[250,200] };
for (const [k, [x, y]] of Object.entries(pts)) console.log(k, x, y, P(x, y));
