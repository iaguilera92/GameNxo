const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
let s = fs.readFileSync(base + 'scenes/RankedScene.ts', 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');
function rep(a, b) {
  if (s.split(a).length !== 2) throw new Error('x' + (s.split(a).length - 1) + ': ' + a.slice(0, 80));
  s = s.replace(a, () => b);
}
function cut(from, to, b) {
  const i = s.indexOf(from);
  const j = s.indexOf(to, i);
  if (i < 0 || j < 0) throw new Error('cut ' + from.slice(0, 50));
  s = s.slice(0, i) + b + s.slice(j);
}

rep("import { type ArcadePalette, arcadeButton } from '../ui/modeButtons';", "import { arcadeButton, modeBand, modeShape } from '../ui/modeButtons';");
rep("/** alto que ocupan las pestañas LIGA / LIGA 2V2 bajo el título (todo lo de abajo se corre esto) */\nconst TAB_H = 64;\n", "");
rep("    const e1 = ex * 0.12 + TAB_H;\n", "");

cut(
  "    // (21-11-2026, usuario) DOS PESTAÑAS:",
  "    const headerObjects",
  `    // (21-11-2026, usuario) DOS PESTAÑAS grandes con pelota: LIGA (amarilla) y LIGA 2V2 (morada, dos pelotas); la abierta lleva borde y brillo
    const tabW = Math.min(250, (W - 50) / 2);
    this.drawTab(W / 2 - tabW / 2 - 8, headY + 70, tabW, 58, 'LIGA', '1v1', this.tab === '1v1');
    this.drawTab(W / 2 + tabW / 2 + 8, headY + 70, tabW, 58, 'LIGA 2V2', '2v2', this.tab === '2v2');
`,
);

cut(
  "    // ---- emblema + liga",
  "    // FIN DE TEMPORADA:",
  `    // ---- LIGA ACTUAL (21-11-2026, referencia del usuario): un panel con borde dorado (morado en la 2v2), la etiqueta LIGA ACTUAL sobre su
    // borde, el emblema con laureles y rayos, y debajo la barra de progreso con lo que llevas a la izquierda y la meta a la derecha
    const pW = Math.min(640, W - 40);
    const px0 = W / 2 - pW / 2;
    const pTop = 184 + ex * 0.12;
    const pH = 312;
    const accent = is2 ? 0xb06bff : 0xffc42e;
    const accentHi = is2 ? 0xd9b4ff : 0xffe27a;
    {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4).fillRoundedRect(px0 + 3, pTop + 7, pW, pH, 28);
      g.fillStyle(0x0b1a45, 0.96).fillRoundedRect(px0, pTop, pW, pH, 28);
      g.fillStyle(st.color, 0.15).fillEllipse(W / 2, pTop + 122, pW * 0.84, 200); // luz de la liga detrás del emblema
      g.fillStyle(0xffffff, 0.05).fillRoundedRect(px0 + 6, pTop + 6, pW - 12, 64, { tl: 22, tr: 22, bl: 6, br: 6 });
      g.lineStyle(10, accent, 0.16).strokeRoundedRect(px0 - 2, pTop - 2, pW + 4, pH + 4, 30);
      g.lineStyle(3.5, accent, 1).strokeRoundedRect(px0, pTop, pW, pH, 28);
      g.lineStyle(1.5, accentHi, 0.7).strokeRoundedRect(px0 + 4, pTop + 4, pW - 8, pH - 8, 24);
    }
    const ecx = W / 2;
    const ecy = pTop + 124;
    // rayos de luz del color de la liga girando muy despacio detrás del emblema
    const rays = this.add.graphics({ x: ecx, y: ecy }).setBlendMode(Phaser.BlendModes.ADD);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      rays.fillStyle(st.light, k % 2 ? 0.07 : 0.14).fillTriangle(0, 0, Math.cos(a - 0.12) * 150, Math.sin(a - 0.12) * 150, Math.cos(a + 0.12) * 150, Math.sin(a + 0.12) * 150);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 26000, repeat: -1 });
    this.laurel(ecx, ecy + 4, st.color, st.dark);
    new RankBadge(this, ecx, ecy, { rank: v.league, level: 99, size: 186, doubles: is2, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen: () => this.leagueList() });
    // etiqueta LIGA ACTUAL montada sobre el borde de arriba
    {
      const tl = this.add.text(W / 2, pTop, 'LIGA ACTUAL', { fontFamily: FONT, fontSize: '19px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
      const rw0 = tl.width + 64;
      const rg0 = this.add.graphics();
      rg0.fillStyle(0x0a1638, 1).fillRoundedRect(W / 2 - rw0 / 2 - 3, pTop - 20, rw0 + 6, 40, 20);
      rg0.fillStyle(0x12255c, 1).fillRoundedRect(W / 2 - rw0 / 2, pTop - 17, rw0, 34, 17);
      rg0.lineStyle(2.5, accent, 1).strokeRoundedRect(W / 2 - rw0 / 2, pTop - 17, rw0, 34, 17);
      this.children.bringToTop(tl);
    }
    // ---- PROGRESO DE LIGA: lo que llevas (izquierda, con su moneda) y la meta (derecha) sobre una barra alta
    const bw = pW - 52;
    const bx = W / 2 - bw / 2;
    const bh = 26;
    const barTop = pTop + pH - 22 - bh;
    {
      const top = barTop;
      const prog = v.target == null || v.promoting ? 1 : Phaser.Math.Clamp(v.progress, 0, 1);
      // la barra de la liga normal es AMARILLA (como JUGAR) y la de la LIGA 2V2, MORADA; al llegar a la meta, verde
      const fillCol = v.promoting ? 0x3ad65a : is2 ? 0x8a4bff : 0xffcc1f;
      const fillHi = v.promoting ? 0x8cf59a : is2 ? 0xc9a3ff : 0xffe55a;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(bx + 2, top + 4, bw, bh, bh / 2);
      g.fillStyle(0x08153d, 1).fillRoundedRect(bx, top, bw, bh, bh / 2);
      const fw = prog > 0 ? Math.max(bh - 4, (bw - 6) * prog) : 0;
      if (fw > 0) {
        g.fillStyle(fillCol, 1).fillRoundedRect(bx + 3, top + 3, fw, bh - 6, (bh - 6) / 2);
        g.fillStyle(fillHi, 0.6).fillRoundedRect(bx + 7, top + 5, Math.max(0, fw - 8), (bh - 6) * 0.34, 4);
      }
      g.lineStyle(3, 0xe8eeff, 1).strokeRoundedRect(bx, top, bw, bh, bh / 2);
      if (fw > 0) {
        // franjas diagonales en lo lleno (recortadas a su forma)
        const stripes = this.add.graphics();
        stripes.fillStyle(0xffffff, 0.16);
        for (let x = -bh; x < fw + bh; x += 20) stripes.fillPoints([{ x: bx + 3 + x, y: top + bh }, { x: bx + 3 + x + 10, y: top + bh }, { x: bx + 3 + x + 10 + bh, y: top }, { x: bx + 3 + x + bh, y: top }], true);
        const mg = this.make.graphics({}, false);
        mg.fillStyle(0xffffff).fillRoundedRect(bx + 3, top + 3, fw, bh - 6, (bh - 6) / 2);
        stripes.setMask(mg.createGeometryMask());
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => mg.destroy());
      }
      // cifras sobre la barra: lo que llevas esta semana (con su moneda) a la izquierda y la meta a la derecha
      const lblY = top - 20;
      const net = v.weekNet;
      const cur = this.add.text(bx + 2, lblY, fmtCoins(net), { fontFamily: FONT, fontSize: '28px', color: net < 0 ? '#ff8174' : '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5);
      coinOf(this, bx + 2 + cur.width + 18, lblY, 12); // (17-11-2026) moneda: imagen moneda-1.webp
      if (v.target != null) this.add.text(bx + bw - 2, lblY, fmtCoins(v.target), { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(1, 0.5);
    }

`,
);

// la cápsula de FIN DE TEMPORADA, naranja como en la referencia
rep("    const by = 404 + e1; // centro de la cápsula (las placas de abajo se colocan desde aquí)", "    const by = pTop + pH + 33; // centro de la cápsula (las placas de abajo se colocan desde aquí)");
rep("      g.fillStyle(st.color, 1).fillRoundedRect(x0, cy - ph / 2, pw, ph, ph / 2);", "      g.fillStyle(0xf2842c, 1).fillRoundedRect(x0, cy - ph / 2, pw, ph, ph / 2);");
rep("      g.lineStyle(2, st.light, 1).strokeRoundedRect(x0, cy - ph / 2, pw, ph, ph / 2);", "      g.lineStyle(2, 0xffc27a, 1).strokeRoundedRect(x0, cy - ph / 2, pw, ph, ph / 2);");
rep("      g.fillStyle(st.dark, 0.7).fillRect(sx, cy - 9, 2, 18);", "      g.fillStyle(0x8a3a00, 0.8).fillRect(sx, cy - 9, 2, 18);");

// utilidades: pestañas y laureles
rep(
  "  /** Cambia de pestaña (LIGA / LIGA 2V2) y rehace la pantalla. */",
  `  /**
   * Pestaña grande de la pantalla LIGA (21-11-2026, referencia del usuario): forma inclinada como JUGAR, pelota(s) a la izquierda y el nombre.
   * La abierta lleva borde claro y brillo; la otra, más oscura. LIGA = amarilla; LIGA 2V2 = morada con dos pelotas.
   */
  private drawTab(x: number, y: number, w: number, h: number, label: string, kind: '1v1' | '2v2', active: boolean) {
    const c = this.add.container(x, y);
    const cols = kind === '1v1' ? [0xffe55a, 0xffcc1f, 0xf29a0c] : [0xb98aff, 0x8a4bff, 0x4a1fb0];
    const g = this.add.graphics();
    if (active) g.lineStyle(12, 0x5fb4ff, 0.28).strokePoints(modeShape(w, h, 6), true, true);
    g.fillStyle(0x000000, 0.4).fillPoints(modeShape(w, h, 0).map((p) => ({ x: p.x + 2, y: p.y + 6 })), true);
    g.fillStyle(0x0a1638, 1).fillPoints(modeShape(w, h, 4), true);
    if (active) g.lineStyle(3, 0x9fdcff, 1).strokePoints(modeShape(w, h, 4), true, true);
    g.fillStyle(cols[2], 1).fillPoints(modeShape(w, h), true);
    g.fillStyle(cols[1], 1).fillPoints(modeBand(w, h, -h / 2, h * 0.12, 5, 9), true);
    g.fillStyle(cols[0], 0.55).fillPoints(modeBand(w, h, -h * 0.44, -h * 0.18, 12, 6), true);
    if (!active) g.fillStyle(0x0a1638, 0.38).fillPoints(modeShape(w, h), true);
    c.add(g);
    // pelota(s): amarillo-verde con las dos costuras blancas
    const r = h * 0.27;
    const ball = (bx: number, by: number) => {
      const b = this.add.graphics();
      b.fillStyle(0x0a1638, 1).fillCircle(bx, by, r + 2.5);
      b.fillStyle(0xd9f23a, 1).fillCircle(bx, by, r);
      b.fillStyle(0xffffff, 0.35).fillCircle(bx - r * 0.3, by - r * 0.35, r * 0.4);
      b.lineStyle(Math.max(2, r * 0.16), 0xffffff, 0.95);
      b.beginPath().arc(bx - r * 1.05, by, r * 0.95, -0.9, 0.9).strokePath();
      b.beginPath().arc(bx + r * 1.05, by, r * 0.95, Math.PI - 0.9, Math.PI + 0.9).strokePath();
      c.add(b);
    };
    const ix = -w / 2 + h * 0.78;
    if (kind === '2v2') {
      ball(ix - r * 0.55, 0);
      ball(ix + r * 0.55, 0);
    } else ball(ix, 0);
    const tx = ix + r * (kind === '2v2' ? 1.9 : 1.5);
    const t = this.add.text(0, 1, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: kind === '1v1' ? '#6b3a00' : '#1d0a52', strokeThickness: 6 }).setOrigin(0, 0.5);
    fitText(t, w / 2 + w * 0.46 - tx - 16);
    t.setX(tx);
    c.add(t);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      this.tweens.add({ targets: c, scale: { from: 0.95, to: 1 }, duration: 160, ease: 'Back.easeOut' });
      this.setTab(kind);
    });
    return c;
  }

  /** Laureles a los lados del emblema (hojas en arco, del color de la liga): ( emblema ). */
  private laurel(cx: number, cy: number, color: number, dark: number) {
    const g = this.add.graphics();
    for (const side of [-1, 1]) {
      const R = 112;
      const n = 8;
      for (let i = 0; i < n; i++) {
        // ángulo del arco: de abajo (cerca del emblema) hacia arriba; a la izquierda 100°→250°, a la derecha su espejo
        const t = i / (n - 1);
        const ang = (side < 0 ? Math.PI * (0.62 + 0.76 * t) : Math.PI * (0.38 - 0.76 * t));
        const lx = cx + Math.cos(ang) * R;
        const ly = cy + Math.sin(ang) * R * 0.95;
        g.save();
        g.translateCanvas(lx, ly);
        g.rotateCanvas(ang + (side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5) + (i % 2 ? 0.5 : -0.5) * side);
        g.fillStyle(dark, 0.9).fillEllipse(0, 0, 30, 13);
        g.fillStyle(color, 1).fillEllipse(0, 0, 26, 10);
        g.fillStyle(0xffffff, 0.25).fillEllipse(-2, -2, 14, 4);
        g.restore();
      }
    }
    return g;
  }

  /** Cambia de pestaña (LIGA / LIGA 2V2) y rehace la pantalla. */`,
);
fs.writeFileSync(base + 'scenes/RankedScene.ts', s.replace(/\n/g, nl));
