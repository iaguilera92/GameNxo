// (24-11-2026) Elige tu personaje: aviso en un panel estándar con (i) y palabras en amarillo; la cara de la ficha centrada en la cabeza.
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
// ---------------- aviso
rep(`    c.add(
      this.add
        .text(W / 2, 272, 'Solo puedes elegir UNO: es gratis y queda guardado en tu cuenta.\\nLos demás los desbloqueas después en la Tienda.', { fontFamily: FONT, fontSize: '21px', color: '#ffe680', align: 'center', lineSpacing: 6, wordWrap: { width: W - 60 } })
        .setOrigin(0.5),
    );`, `    // (24-11-2026, usuario) aviso en un panel como los demás (azul oscuro, borde neón), letras blancas con UNO y TIENDA en amarillo, y el
    // icono de información a la izquierda, entre las dos filas
    this.notice(c, W / 2, 272, W - 40, [
      [['Solo puedes elegir ', '#ffffff'], ['UNO', '#ffd23f'], [': es gratis y queda guardado en tu cuenta.', '#ffffff']],
      [['Los demás los desbloqueas después en la ', '#ffffff'], ['Tienda', '#ffd23f'], ['.', '#ffffff']],
    ]);`);
rep(`  private portrait(id: string, x: number, feetY: number, h: number): Phaser.GameObjects.GameObject | undefined {`, `  /** Panel de aviso estándar con (i) a la izquierda y filas de texto con trozos de color ([texto, color]). */
  private notice(c: Phaser.GameObjects.Container, cx: number, cy: number, w: number, rows: [string, string][][]) {
    const fs = 20;
    const lineH = 28;
    const iconW = 54;
    const h = rows.length * lineH + 22;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(cx - w / 2 + 3, cy - h / 2 + 5, w, h, 16);
    g.fillStyle(NAVY, 0.95).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
    // (i)
    const ix = cx - w / 2 + 30;
    g.fillStyle(0x0a1638, 1).fillCircle(ix, cy, 17);
    g.lineStyle(3, 0x6fb2ff, 1).strokeCircle(ix, cy, 15);
    g.fillStyle(0x6fb2ff, 1).fillCircle(ix, cy - 7, 2.8).fillRoundedRect(ix - 2.2, cy - 2, 4.4, 11, 2);
    c.add(g);
    const left = cx - w / 2 + iconW;
    const avail = w - iconW - 14;
    rows.forEach((parts, i) => {
      const y = cy - ((rows.length - 1) * lineH) / 2 + i * lineH;
      const line = this.add.container(0, y);
      let x = 0;
      for (const [t, col] of parts) {
        const tx = this.add.text(x, 0, t, { fontFamily: FONT, fontSize: \`\${fs}px\`, color: col, stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0, 0.5);
        line.add(tx);
        x += tx.width;
      }
      const k = Math.min(1, avail / Math.max(1, x));
      line.setScale(k).setX(left + (avail - x * k) / 2);
      c.add(line);
    });
  }

  /**
   * (24-11-2026, usuario) CARA de un personaje para la ficha: centro de la cabeza (x) y arriba del pelo (y) en px de su retrato, y el alto
   * de la cabeza a los hombros. Sin datos: el centro y el tercio de arriba de la caja visible.
   */
  private faceOf(id: string): { key: string; w: number; h: number; cx: number; top: number; fh: number } | null {
    const FACE: Record<string, { cx: number; top: number; fh: number }> = { nxo: { cx: 450, top: 18, fh: 600 }, mai: { cx: 480, top: 10, fh: 600 } };
    const key = id === 'nxo' ? 'portrait-nxo' : id === 'mai' ? 'portrait-mai' : rosterPortrait(id)?.key;
    if (!key || !this.textures.exists(key)) return null;
    const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
    const p = rosterPortrait(id);
    const f = FACE[id] ?? (p ? { cx: (p.box.x0 + p.box.x1) / 2, top: p.box.y0, fh: (p.box.y1 - p.box.y0) * 0.42 } : { cx: src.width / 2, top: 0, fh: src.height * 0.42 });
    return { key, w: src.width, h: src.height, ...f };
  }

  private portrait(id: string, x: number, feetY: number, h: number): Phaser.GameObjects.GameObject | undefined {`);
// ---------------- cara de la ficha
rep(`      const fh = (faceB.y - faceA.y) * 2.4; // el retrato entero, alto: en la zona queda la cara y los hombros
      face = this.portrait(selected, (faceA.x + faceB.x) / 2, faceA.y + fh - 2, fh);
      if (face) {`, `      // la cabeza centrada en la zona y de la cabeza a los hombros dentro de ella (antes se centraba el retrato entero y la cabeza, que está a
      // un lado de la raqueta, se cortaba a la izquierda)
      const fd = this.faceOf(selected);
      if (fd) {
        const zw = faceB.x - faceA.x;
        const zh = faceB.y - faceA.y;
        const sc = (zh * 0.98) / fd.fh;
        face = this.add.image(faceA.x + zw / 2, faceA.y + zh * 0.04, fd.key).setOrigin(fd.cx / fd.w, fd.top / fd.h).setScale(sc);
      } else face = undefined;
      if (face) {`);
// la zona de la cara: un poco más a la izquierda y ancha (dentro del marco de la ficha)
rep(`    const faceA = P(70, 100);
    const faceB = P(690, 640);`, `    const faceA = P(60, 96);
    const faceB = P(700, 650);`);
writeFileSync(F, s, 'utf8');
console.log('ok');
