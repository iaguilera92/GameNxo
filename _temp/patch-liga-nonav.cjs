const fs = require('fs');
const f = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/scenes/RankedScene.ts';
let s = fs.readFileSync(f, 'utf8');
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
rep("import { navLigaLabel } from '../ui/navLabel';\n", "");
cut("const NAV = {\n", "\n/**", "");
rep("    if (!this.textures.exists(NAV.key)) this.load.image(NAV.key, NAV.file);\n", "");
rep("    const navTop = H - this.navImageHeight(W);\n    this.maxScrollY = Math.max(0, contentBottom - navTop + 16);", "    // (21-11-2026, usuario) sin la barra de navegación de abajo (LIGA · INICIO · EVENTOS): se vuelve con la flecha de arriba\n    this.maxScrollY = Math.max(0, contentBottom - H + 32);");
rep("    this.navImage(W, H);\n  }", "  }");
rep("if (!this.overlay.length && pointer.y < this.scale.height - this.navImageHeight(this.scale.width)) this.setScroll", "if (!this.overlay.length) this.setScroll");
rep("if (this.overlay.length || pointer.y >= this.scale.height - this.navImageHeight(this.scale.width)) return;", "if (this.overlay.length) return;");
cut("  private navImageHeight(W: number) {", "  /**\n   * Pestaña grande", "");
fs.writeFileSync(f, s.replace(/\n/g, nl));
