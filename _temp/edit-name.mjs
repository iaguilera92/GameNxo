// (24-11-2026) Paso del NOMBRE de la pantalla de inicio con el arte de como-te-llamas.png (título + caja).
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
const i0 = s.indexOf(`    c.add(this.add.text(W / 2, H * 0.3, '¿CÓMO TE LLAMAS?'`);
const i1 = s.indexOf(`  /** <input> de HTML sobre el lienzo`);
if (i0 < 0 || i1 < 0) throw new Error('bloque');
s = s.slice(0, i0) + `    // (24-11-2026, usuario) arte de como-te-llamas.png: el título (assets/ui/como-te-llamas.webp) y la caja del nombre (assets/ui/caja-nombre.webp)
    const ty = H * 0.2;
    if (this.textures.exists('ob-name-title')) {
      const t = this.add.image(W / 2, ty, 'ob-name-title');
      t.setScale((W - 40) / t.width);
      c.add(t);
    } else c.add(this.add.text(W / 2, ty, '¿CÓMO TE LLAMAS?', { fontFamily: FONT, fontSize: '50px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5));
    // subtítulo entre dos líneas doradas
    const sy = ty + 150;
    const sub = this.add.text(W / 2, sy, 'Así te verán tus rivales', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
    const lg = this.add.graphics();
    const half = sub.width / 2 + 26;
    lg.fillStyle(GOLD, 1).fillRoundedRect(W / 2 - half - 70, sy - 2, 70, 4, 2).fillRoundedRect(W / 2 + half, sy - 2, 70, 4, 2);
    c.add([lg, sub]);
    // caja del nombre: la imagen (con su barra amarilla) y encima el <input> del teléfono; a la derecha, el lápiz
    const bw = W - 60;
    const by = sy + 130;
    let bh = 100;
    let textL = W / 2 - bw / 2 + 60;
    if (this.textures.exists('ob-name-box')) {
      const b = this.add.image(W / 2, by, 'ob-name-box');
      b.setScale(bw / b.width);
      bh = b.displayHeight;
      textL = W / 2 - bw / 2 + (130 / 1579) * bw; // justo después de la barra amarilla (x 99 de 1579 en la imagen)
      c.add(b);
    } else {
      const g = this.add.graphics();
      g.fillStyle(NAVY, 1).fillRoundedRect(W / 2 - bw / 2, by - 50, bw, 100, 18);
      g.lineStyle(4, NEON, 1).strokeRoundedRect(W / 2 - bw / 2, by - 50, bw, 100, 18);
      c.add(g);
    }
    const pen = this.add.graphics({ x: W / 2 + bw / 2 - 62, y: by });
    // lápiz: cuerpo inclinado, punta y goma
    pen.lineStyle(4, 0xcfe0ff, 1);
    pen.beginPath().moveTo(-14, 14).lineTo(-10, 2).lineTo(8, -16).lineTo(16, -8).lineTo(-2, 10).closePath().strokePath();
    pen.lineBetween(4, -12, 12, -4);
    pen.lineBetween(-10, 2, -2, 10);
    c.add(pen);
    // aviso de las reglas: píldora con (i)
    const iy = by + bh / 2 + 52;
    const rule = this.add.text(W / 2 + 22, iy, \`De \${USERNAME.min} a \${USERNAME.max} letras o números\`, { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const pw = rule.width + 100;
    const pill = this.add.graphics();
    pill.fillStyle(0x060f2a, 0.85).fillRoundedRect(W / 2 - pw / 2, iy - 24, pw, 48, 24);
    const ix = W / 2 - pw / 2 + 32;
    pill.lineStyle(3, 0x6fb2ff, 1).strokeCircle(ix, iy, 15);
    pill.fillStyle(0x6fb2ff, 1).fillCircle(ix, iy - 7, 2.6).fillRoundedRect(ix - 2, iy - 2, 4, 11, 2);
    c.add([pill, rule]);
    const err = this.add.text(W / 2, iy + 48, '', { fontFamily: FONT, fontSize: '20px', color: '#ff8a8a', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
    c.add(err);
    this.makeInput(textL, by, W / 2 + bw / 2 - 110 - textL, bh * 0.6);
    const next = () => {
      const n = validUsername(this.nameBox?.value ?? '');
      if (!n) {
        err.setText(\`Escribe un nombre de \${USERNAME.min} a \${USERNAME.max} letras o números\`);
        return;
      }
      this.name = n;
      this.removeInput();
      this.stepCharacter();
    };
    this.nameBox?.addEventListener('keydown', (e) => e.key === 'Enter' && next());
    // SIGUIENTE: como el JUGAR del menú, sin la sombra
    c.add(arcadeButton(this, W / 2, iy + 160, 440, 108, 'SIGUIENTE', next, { palette: 'yellow', noShadow: true }));
  }

` + s.slice(i1);
// <input>: alineado a la izquierda (x = borde izquierdo), placeholder gris
rep(`  private makeInput(x: number, y: number, w: number, h: number) {`, `  /** \`x\` = borde IZQUIERDO del texto, \`y\` = centro. */
  private makeInput(x: number, y: number, w: number, h: number) {`);
rep(`      left: \`\${r.left + (x - w / 2) * k}px\`,`, `      left: \`\${r.left + x * k}px\`,`);
rep(`      fontSize: \`\${Math.round(34 * k)}px\`,
      fontFamily: '"Lilita One", sans-serif',
      textAlign: 'center',`, `      fontSize: \`\${Math.round(38 * k)}px\`,
      fontFamily: '"Lilita One", sans-serif',
      textAlign: 'left',
      caretColor: '#ffd23f',`);
rep(`    document.body.appendChild(el);
    this.nameBox = el;`, `    el.className = 'ob-name';
    if (!document.getElementById('ob-name-css')) {
      const css = document.createElement('style');
      css.id = 'ob-name-css';
      css.textContent = '.ob-name::placeholder{color:#7f8fb3;opacity:1;font-style:italic}';
      document.head.appendChild(css);
    }
    document.body.appendChild(el);
    this.nameBox = el;`);
rep(`    if (!this.textures.exists('ob-title')) this.load.image('ob-title', 'assets/ui/elige-tu-pj.webp');`, `    if (!this.textures.exists('ob-title')) this.load.image('ob-title', 'assets/ui/elige-tu-pj.webp');
    if (!this.textures.exists('ob-name-title')) this.load.image('ob-name-title', 'assets/ui/como-te-llamas.webp');
    if (!this.textures.exists('ob-name-box')) this.load.image('ob-name-box', 'assets/ui/caja-nombre.webp');`);
writeFileSync(F, s, 'utf8');
console.log('ok');
