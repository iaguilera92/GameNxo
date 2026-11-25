// (24-11-2026) Elige tu personaje: aviso más abajo, ficha del color de cada personaje, botón VOLVER y diálogo sin sombra en los botones.
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  // ---------------- diálogo: botones sin la sombra 3D (opcional)
  ['ui/ConfirmDialog.ts', `  lockSeconds?: number;
  depth?: number;`, `  lockSeconds?: number;
  depth?: number;
  /** (24-11-2026) botones sin la sombra de color (pantalla de inicio) */
  noShadow?: boolean;`],
  ['ui/ConfirmDialog.ts', `o.cancelLabel, o.onCancel, { palette: 'yellow' }));`, `o.cancelLabel, o.onCancel, { palette: 'yellow', noShadow: o.noShadow }));`],
  ['ui/ConfirmDialog.ts', `o.confirmLabel, o.onConfirm, { palette: 'red' }));`, `o.confirmLabel, o.onConfirm, { palette: 'red', noShadow: o.noShadow }));`],
  ['scenes/OnboardingScene.ts', `      onCancel: () => {
        this.dialog.forEach((o) => o.destroy());
        this.dialog = [];
      },
      depth: 9000,`, `      onCancel: () => {
        this.dialog.forEach((o) => o.destroy());
        this.dialog = [];
      },
      depth: 9000,
      noShadow: true, // (24-11-2026, usuario) ELEGIR y VOLVER sin la sombra 3D`],
  // ---------------- aviso más abajo y la rejilla tras él
  ['scenes/OnboardingScene.ts', `    this.notice(c, W / 2, 272, W - 40, [`, `    this.notice(c, W / 2, 304, W - 40, [ // (24-11-2026, usuario) más abajo (antes 272)`],
  ['scenes/OnboardingScene.ts', `    const top = 326;`, `    const top = 366;`],
  // ---------------- ficha del color de cada personaje
  ['scenes/OnboardingScene.ts', `    if (this.textures.exists('ob-card')) card.add(this.add.image(W / 2, cardTop, 'ob-card').setOrigin(0.5, 0).setDisplaySize(cardW, cardH));`, `    const cardImg = this.textures.exists('ob-card') ? this.add.image(W / 2, cardTop, 'ob-card').setOrigin(0.5, 0).setDisplaySize(cardW, cardH) : null;
    if (cardImg) card.add(cardImg);`],
  ['scenes/OnboardingScene.ts', `      hint.setVisible(false);
      card.setVisible(true);`, `      hint.setVisible(false);
      card.setVisible(true);
      cardImg?.setTexture(this.cardTexture(selected)).setDisplaySize(cardW, cardH); // la ficha del color del personaje`],
  ['scenes/OnboardingScene.ts', `  /** Panel de aviso estándar con (i) a la izquierda`, `  /**
   * (24-11-2026, usuario) La ficha (perfil-pj, roja = NXO) del COLOR de cada personaje: se cambia el tono de lo rojo (marco, caja del nombre,
   * franjas y raqueta del fondo) y se deja igual lo azul. Se hace una vez por personaje (textura \`ob-card-<id>\`).
   */
  private cardTexture(id: string): string {
    const hue = CARD_HUE[id];
    if (hue === undefined || !this.textures.exists('ob-card')) return 'ob-card';
    const key = \`ob-card-\${id}\`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get('ob-card').getSourceImage() as HTMLImageElement;
    const tex = this.textures.createCanvas(key, src.width, src.height);
    if (!tex) return 'ob-card';
    const ctx = tex.getContext();
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, src.width, src.height);
    const d = img.data;
    const [th, ts, tv] = hue;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
      if (dl < 0.08 || mx !== r) continue; // solo lo rojo (el rojo manda y hay color)
      let h = ((g - b) / dl) % 6;
      h *= 60;
      if (h < 0) h += 360;
      if (!(h >= 320 || h <= 25)) continue;
      const sat = dl / mx;
      if (sat < 0.25) continue;
      // nuevo tono; saturación y brillo se ajustan para cada color (el amarillo y el celeste, más claros)
      const ns = Math.min(1, sat * ts);
      const nv = Math.min(1, mx * tv);
      const c = nv * ns, x = c * (1 - Math.abs(((th / 60) % 2) - 1)), m = nv - c;
      const [rr, gg, bb] = th < 60 ? [c, x, 0] : th < 120 ? [x, c, 0] : th < 180 ? [0, c, x] : th < 240 ? [0, x, c] : th < 300 ? [x, 0, c] : [c, 0, x];
      d[i] = (rr + m) * 255;
      d[i + 1] = (gg + m) * 255;
      d[i + 2] = (bb + m) * 255;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    return key;
  }

  /** Panel de aviso estándar con (i) a la izquierda`],
  ['scenes/OnboardingScene.ts', `/** (24-11-2026, usuario) los dos pasos con el título`, `/**
 * (24-11-2026, usuario) COLOR de la ficha de cada personaje: [tono 0-360, × saturación, × brillo]. NXO = la roja de la imagen. ISA = el fucsia de
 * su raqueta; FLO = el verde azulado de su raqueta (el usuario no lo definió: se toma de su ropa y raqueta).
 */
const CARD_HUE: Record<string, [number, number, number]> = {
  mai: [335, 0.85, 1.15], // rosado
  jun: [25, 1, 1.2], // naranja
  mat: [130, 0.95, 0.95], // verde
  zac: [50, 1, 1.35], // amarillo
  net: [275, 0.95, 1.1], // morado
  isa: [315, 1, 1.05], // fucsia (su raqueta)
  rin: [195, 0.95, 1.3], // celeste
  flo: [178, 0.85, 0.95], // verde azulado (su raqueta)
};
/** (24-11-2026, usuario) los dos pasos con el título`],
  // ---------------- botón VOLVER al nombre (abajo a la izquierda, junto a ELEGIR)
  ['scenes/OnboardingScene.ts', `    c.add(btn);
    const info = () => {`, `    c.add(btn);
    // (24-11-2026, usuario) VOLVER a ¿CÓMO TE LLAMAS? (conserva el nombre escrito)
    c.add(this.backButton(64, H - BTN_Y, () => this.stepName()));
    const info = () => {`],
  ['scenes/OnboardingScene.ts', `  /** Panel de aviso estándar con (i) a la izquierda`, `  /** Botón redondo con flecha hacia atrás (azul, sin sombra). */
  private backButton(x: number, y: number, onTap: () => void) {
    const R = 44;
    const b = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x0a1638, 1).fillCircle(0, 0, R + 4);
    g.fillStyle(0x153f9e, 1).fillCircle(0, 2, R);
    g.fillStyle(0x2f7bff, 1).fillCircle(0, 0, R - 2);
    g.fillStyle(0xffffff, 0.18).fillEllipse(0, -R * 0.45, R * 1.3, R * 0.6);
    g.lineStyle(7, 0xffffff, 1);
    g.beginPath().moveTo(8, -16).lineTo(-10, 0).lineTo(8, 16).strokePath();
    b.add(g);
    b.setSize(R * 2 + 16, R * 2 + 16).setInteractive({ useHandCursor: true });
    b.on('pointerup', () => {
      this.tweens.add({ targets: b, scale: { from: 0.9, to: 1 }, duration: 140, ease: 'Back.easeOut' });
      onTap();
    });
    return b;
  }

  /** Panel de aviso estándar con (i) a la izquierda`],
];
const files = new Map();
for (let [f, a, b] of E) {
  const s = files.get(f) ?? readFileSync(S + f, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  a = a.replace(/\r?\n/g, eol);
  b = b.replace(/\r?\n/g, eol);
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${f}: ${n} veces: ${a.slice(0, 100)}`);
  files.set(f, s.replace(a, () => b));
}
for (const [f, s] of files) writeFileSync(S + f, s, 'utf8');
console.log('ok', files.size, 'archivos');
