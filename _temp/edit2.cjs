const fs = require('fs');
function rep(f, a, b) { let t = fs.readFileSync(f, 'utf8'); const crlf = t.includes('\r\n'); if (crlf) t = t.replace(/\r\n/g, '\n'); if (!t.includes(a)) throw new Error('no anchor: ' + a.slice(0, 60)); t = t.replace(a, b); if (crlf) t = t.replace(/\n/g, '\r\n'); fs.writeFileSync(f, t, 'utf8'); }
const f = 'src/view/CourtView.ts';
rep(f, "  // (21-11-2026, usuario) PRUEBA TEMPORAL: en 1v1 solo sale el ambiente en prueba (ahora ambiente-1, el barrio). Poner PRUEBA_1V1 = null para volver al sorteo\n  const only = all1v1.filter((a) => a.key === PRUEBA_1V1);",
"  // (22-11-2026, usuario) en 1v1 sale AL AZAR uno de SORTEO_1V1 (ambiente-3 queda fuera hasta que llegue su imagen nueva). null = todos\n  const only = SORTEO_1V1 ? all1v1.filter((a) => SORTEO_1V1.includes(a.key)) : [];");
rep(f, "/** (21-11-2026) ambiente fijo del 1v1 mientras se prueba; null = aleatorio entre todos */\nconst PRUEBA_1V1: string | null = 'ambiente-2'; // (22-11-2026) probando la arcilla nueva",
"/** (22-11-2026, usuario) ambientes que entran al sorteo del 1v1; null = aleatorio entre todos */\nconst SORTEO_1V1: string[] | null = ['ambiente-1', 'ambiente-2', 'ambiente-4'];");
