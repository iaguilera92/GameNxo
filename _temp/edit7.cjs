const fs = require('fs');
function rep(f, a, b) { let t = fs.readFileSync(f, 'utf8'); const crlf = t.includes('\r\n'); if (crlf) t = t.replace(/\r\n/g, '\n'); if (!t.includes(a)) throw new Error('no anchor: ' + a.slice(0, 60)); t = t.replace(a, b); if (crlf) t = t.replace(/\n/g, '\r\n'); fs.writeFileSync(f, t, 'utf8'); }
const C = 'src/view/CourtView.ts';
rep(C, "  zoom?: number;\n  surface: Surface;",
  "  zoom?: number;\n  /**\n   * (22-11-2026, usuario) escala FIJA (la de un teléfono de 720x1280), igual en todos los teléfonos: la cancha no cambia con el alto de la\n   * pantalla y, sin esto, en un teléfono más alargado la imagen crecía y las gradas quedaban pegadas a la cancha. Para imágenes dibujadas\n   * sobre la cancha (boceto _temp/standsketch.mjs). Lo que sobra abajo en un teléfono alargado lo cubre el relleno común (SHARED_FOOTER)\n   */\n  fixedScale?: boolean;\n  surface: Surface;");
rep(C, "  const s = Math.max(H / (amb.scaleH ?? amb.h), COVER_W / amb.w) * (amb.zoom ?? 1);",
  "  const s = Math.max((amb.fixedScale ? VIEW.H : H) / (amb.scaleH ?? amb.h), COVER_W / amb.w) * (amb.zoom ?? 1);");
rep(C, "courtDY: 52, zoom: 0.7, wallBottomY: 350, wallTopY: 298,", "courtDY: 52, zoom: 0.7, fixedScale: true, wallBottomY: 350, wallTopY: 298,");
console.log('ok');
