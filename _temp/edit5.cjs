const fs = require('fs');
function rep(f, a, b) { let t = fs.readFileSync(f, 'utf8'); const crlf = t.includes('\r\n'); if (crlf) t = t.replace(/\r\n/g, '\n'); if (!t.includes(a)) throw new Error('no anchor: ' + a.slice(0, 60)); t = t.replace(a, b); if (crlf) t = t.replace(/\n/g, '\r\n'); fs.writeFileSync(f, t, 'utf8'); }
const S = 'src/fx/spectators.ts';
rep(S, "  /** espera entre movimientos (ms) */\n  every: [number, number];", "  /** espera entre movimientos (ms); no se usa si aplaude */\n  every: [number, number];\n  /** (22-11-2026, usuario) APLAUDE: quieto todo el rato y solo hace su movimiento cuando se gana un punto (cheer) */\n  clap?: boolean;");
rep(S, "      { row: 0, x: 360, y: 448, flip: false, every: [6000, 12000] }, // grada izquierda, escalon de abajo: lentes de sol, aplaude", "      { row: 0, x: 360, y: 448, flip: false, every: [6000, 12000], clap: true }, // grada izquierda, escalon de abajo: lentes de sol, aplaude en cada punto");
rep(S, "      { row: 1, x: 1136, y: 428, flip: true, every: [6000, 12000] }, // grada derecha, escalon de abajo: la chica, aplaude", "      { row: 1, x: 1136, y: 428, flip: true, every: [6000, 12000], clap: true }, // grada derecha, escalon de abajo: la chica, aplaude en cada punto");
rep(S, "export function startSpectators(scene: Phaser.Scene, ambiente: string, img: { left: number; top: number; s: number }) {\n  const set = SETS[ambiente];\n  if (!set || !scene.textures.exists(set.key)) return;",
"/** Pone los espectadores. Devuelve cheer(): los que aplauden hacen su movimiento (llamarlo al ganarse un punto); null si no hay. */\nexport function startSpectators(scene: Phaser.Scene, ambiente: string, img: { left: number; top: number; s: number }): (() => void) | null {\n  const set = SETS[ambiente];\n  if (!set || !scene.textures.exists(set.key)) return null;\n  const clappers: { spr: Phaser.GameObjects.Sprite; anim: string }[] = [];");
rep(S, "    spr.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.setFrame(first));\n",
"    spr.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.setFrame(first));\n    if (seat.clap) {\n      clappers.push({ spr, anim });\n      continue; // sin temporizador: solo aplaude en los puntos\n    }\n");
rep(S, "    next();\n  }\n}", `    next();
  }
  if (!clappers.length) return null;
  return () => {
    for (const c of clappers) {
      // cada uno con su pequeño retraso, como una reacción
      scene.time.delayedCall(Phaser.Math.Between(150, 550), () => {
        if (scene.sys.isActive() && c.spr.active) c.spr.play(c.anim);
      });
    }
  };
}`);
const M = 'src/scenes/MatchScene.ts';
rep(M, "    if (drawn) startSpectators(this, drawn.key, drawn.img); // (21-11-2026, usuario) espectadores sentados (ambiente-1)",
"    this.spectatorsCheer = drawn ? startSpectators(this, drawn.key, drawn.img) : null; // (21-11-2026, usuario) espectadores sentados (ambiente-1 y 2)");
rep(M, "  private pointTo(w: Who, reason: string, color: string) {", "  /** (22-11-2026, usuario) los espectadores que aplauden (ambiente-2) lo hacen solo al ganarse un punto */\n  private spectatorsCheer: (() => void) | null = null;\n  private pointTo(w: Who, reason: string, color: string) {");
rep(M, "    this.phase = 'pointover';\n    this.slowmoAbort();", "    this.phase = 'pointover';\n    this.spectatorsCheer?.(); // (22-11-2026, usuario) aplauden en cada punto, gane quien gane (tambien el que llega por red)\n    this.slowmoAbort();");
