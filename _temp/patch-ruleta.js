const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 60) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}
edit('scenes/MenuScene.ts', [
  [
    "    if (!this.textures.exists('daily-coins-art')) this.load.image('daily-coins-art', 'assets/monedas.webp');",
    "    if (!this.textures.exists('ruleta-frame')) this.load.image('ruleta-frame', 'assets/ruleta-frame.webp'); // marco de las ruletas pequeñas (DailyWheels)\n    if (!this.textures.exists('daily-coins-art')) this.load.image('daily-coins-art', 'assets/monedas.webp');",
  ],
]);
edit('ui/DailyWheels.ts', [
  [
    "const MINI_R = 34;\nconst PANEL_H = 104;",
    "const MINI_R = 34;\nconst PANEL_H = 104;\n/** marco de las ruletas (assets/ruleta-frame.webp, el mismo de WheelScene): 900 px de lado y el disco de 336 px de radio */\nconst FRAME = { key: 'ruleta-frame', size: 900, disc: 336 };",
  ],
  [
    "      sel.lineStyle(4, 0x7ff0ff, 1).strokeCircle(0, 0, MINI_R + 9);\n      sel.lineStyle(10, 0x7ff0ff, 0.22).strokeCircle(0, 0, MINI_R + 10);",
    "      const sr = framed ? MINI_R + 15 : MINI_R + 9; // con el marco, el aro va por fuera de él\n      sel.lineStyle(4, 0x7ff0ff, 1).strokeCircle(0, 0, sr);\n      sel.lineStyle(10, 0x7ff0ff, 0.22).strokeCircle(0, 0, sr + 1);",
  ],
  [
    "    const ready = s === 'ready' || s === 'spun';\n    if (selected) {",
    "    const ready = s === 'ready' || s === 'spun';\n    // (21-11-2026, usuario) con ruleta-frame.webp: aro metálico con luces, indicador dorado y centro; si no cargó, el dibujo de siempre\n    const framed = this.scene.textures.exists(FRAME.key);\n    if (selected) {",
  ],
  [
    "      const aura = this.scene.add.circle(0, 0, MINI_R + 10, GOLD, 0.3)",
    "      const aura = this.scene.add.circle(0, 0, framed ? MINI_R + 14 : MINI_R + 10, GOLD, 0.3)",
  ],
  [
    "    const rim = this.scene.add.graphics();\n    rim.fillStyle(NAVY, 1).fillCircle(0, 0, MINI_R + 5);\n    rim.fillStyle(s === 'done' ? 0x55607a : GOLD, 1).fillCircle(0, 0, MINI_R + 2.5);\n    c.add(rim);\n    const face = this.scene.add.graphics();\n    drawWheelFace(face, MINI_R, false);\n    c.add(face);\n    const hub = this.scene.add.graphics();\n    hub.fillStyle(NAVY, 1).fillCircle(0, 0, 8);\n    hub.fillStyle(GOLD, 1).fillCircle(0, 0, 5.5);\n    c.add(hub);\n    // indicador\n    const ptr = this.scene.add.graphics();\n    ptr.fillStyle(NAVY, 1).fillTriangle(-7, -MINI_R - 9, 7, -MINI_R - 9, 0, -MINI_R + 4);\n    ptr.fillStyle(0xff3b4f, 1).fillTriangle(-4.5, -MINI_R - 7, 4.5, -MINI_R - 7, 0, -MINI_R + 1);\n    c.add(ptr);\n",
    "    if (!framed) {\n      const rim = this.scene.add.graphics();\n      rim.fillStyle(NAVY, 1).fillCircle(0, 0, MINI_R + 5);\n      rim.fillStyle(s === 'done' ? 0x55607a : GOLD, 1).fillCircle(0, 0, MINI_R + 2.5);\n      c.add(rim);\n    }\n    const face = this.scene.add.graphics();\n    drawWheelFace(face, MINI_R, false);\n    c.add(face);\n    if (framed) {\n      // el marco va ENCIMA del disco (que gira por debajo): trae el aro, el indicador y el centro\n      const d = (FRAME.size * MINI_R) / FRAME.disc;\n      c.add(this.scene.add.image(0, 0, FRAME.key).setDisplaySize(d, d));\n    } else {\n      const hub = this.scene.add.graphics();\n      hub.fillStyle(NAVY, 1).fillCircle(0, 0, 8);\n      hub.fillStyle(GOLD, 1).fillCircle(0, 0, 5.5);\n      c.add(hub);\n      // indicador\n      const ptr = this.scene.add.graphics();\n      ptr.fillStyle(NAVY, 1).fillTriangle(-7, -MINI_R - 9, 7, -MINI_R - 9, 0, -MINI_R + 4);\n      ptr.fillStyle(0xff3b4f, 1).fillTriangle(-4.5, -MINI_R - 7, 4.5, -MINI_R - 7, 0, -MINI_R + 1);\n      c.add(ptr);\n    }\n",
  ],
  [
    "      c.add(this.scene.add.circle(0, 0, MINI_R + 3, 0x1a2238, 0.68));",
    "      c.add(this.scene.add.circle(0, 0, framed ? MINI_R + 10 : MINI_R + 3, 0x1a2238, 0.68));",
  ],
  [
    "      const badge = this.scene.add.container(MINI_R - 2, -MINI_R + 4);",
    "      const badge = this.scene.add.container(framed ? MINI_R + 5 : MINI_R - 2, framed ? -MINI_R + 1 : -MINI_R + 4);",
  ],
  [
    "    c.setSize(MINI_R * 2 + 16, MINI_R * 2 + 16).setInteractive({ useHandCursor: true });\n    c.on('pointerup', () => {\n      this.scene.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });\n      if (ready)",
    "    c.setSize(MINI_R * 2 + (framed ? 28 : 16), MINI_R * 2 + (framed ? 28 : 16)).setInteractive({ useHandCursor: true });\n    c.on('pointerup', () => {\n      this.scene.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });\n      if (ready)",
  ],
  [
    "    const ring = this.scene.add.circle(x, 4, MINI_R + 4, 0xffffff, 0)",
    "    const ring = this.scene.add.circle(x, 4, this.scene.textures.exists(FRAME.key) ? MINI_R + 11 : MINI_R + 4, 0xffffff, 0)",
  ],
]);
