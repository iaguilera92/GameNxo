import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const R='frontend/src/scenes/RankedScene.ts';
apply(R,[
["  private rebuild() {\n    this.children.list.filter((o) => !this.overlay.includes(o)).forEach((o) => o.destroy());\n    this.build();\n  }",
`  private rebuild() {
    this.children.list.filter((o) => !this.overlay.includes(o)).forEach((o) => o.destroy());
    this.pruneDeadTweens();
    this.build();
  }

  /**
   * (26-11-2026, usuario: "el cofre semanal pegó toda la app") Quita las animaciones cuyos objetos ya se destruyeron. Antes, cada
   * reconstrucción de la pantalla (abrir / cerrar un aviso, cambiar de pestaña) dejaba vivas las animaciones en bucle (brillos, latidos, el
   * cofre que vibra) de los objetos borrados: se acumulaban y cada vez costaba más dibujar un cuadro.
   */
  private pruneDeadTweens() {
    const dead = (x: unknown) => !!x && typeof x === 'object' && 'type' in (x as object) && !(x as { scene?: unknown }).scene;
    for (const t of this.tweens.getTweens()) {
      const any = t as unknown as { targets?: unknown[]; currentTween?: { targets?: unknown[] }; data?: { targets?: unknown[] }[] };
      const tg = any.targets ?? any.currentTween?.targets ?? any.data?.[0]?.targets ?? [];
      if (tg.length && tg.every(dead)) t.remove();
    }
  }`],
["  private openOverlay(alpha = 0.75) {\n    this.closeOverlay();", "  private openOverlay(alpha = 0.75) {\n    // (26-11-2026) al pasar de un aviso a otro NO se reconstruye la pantalla de debajo (antes se rehacía entera justo al abrir el cofre)\n    this.closeOverlay(false);"],
["  private closeOverlay() {\n    if (!this.overlay.length) return;\n    this.overlay.forEach((o) => {\n      this.tweens.killTweensOf(o);\n      o.destroy();\n    });\n    this.overlay = [];\n    this.events.emit('overlay-closed');\n    this.scrollY = this.overlayReturnScroll;\n    this.rebuild();\n  }",
 "  private closeOverlay(rebuild = true) {\n    if (!this.overlay.length) return;\n    this.overlay.forEach((o) => {\n      this.tweens.killTweensOf(o);\n      o.destroy();\n    });\n    this.overlay = [];\n    this.pruneDeadTweens(); // las de los hijos de los paneles (p. ej. el cofre que vibra dentro del panel semanal)\n    this.events.emit('overlay-closed');\n    this.scrollY = this.overlayReturnScroll;\n    if (rebuild) this.rebuild();\n    else this.children.list.forEach((o) => (o as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(true));\n  }"],
// cofre: ocultar lo de debajo y rayos en textura
["    const objs = this.openOverlay(1);\n    const shade = objs[0];\n    const alive = () => this.overlay[0] === shade;",
 "    const objs = this.openOverlay(1);\n    const shade = objs[0];\n    const alive = () => this.overlay[0] === shade;\n    // (26-11-2026) la pantalla de la liga queda tapada por el fondo opaco: no se dibuja mientras tanto (se rehace al cerrar)\n    for (const o of this.children.list) if (!objs.includes(o)) (o as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(false);"],
["    const rays = add(this.add.graphics({ x: cx, y: cy }).setDepth(D).setBlendMode(Phaser.BlendModes.ADD));\n    for (let i = 0; i < 18; i++) {\n      const a0 = (i / 18) * Math.PI * 2;\n      rays.fillStyle(i % 2 ? st.color : GOLD, 0.12).slice(0, 0, len, a0, a0 + Math.PI / 18, false).fillPath();\n    }\n    rays.setAlpha(0);",
 "    // (26-11-2026) los rayos se dibujan UNA vez en una textura de 512 px (antes, 18 arcos de pantalla completa rehechos en cada cuadro)\n    const raysKey = `season-rays-${w.league}`;\n    if (!this.textures.exists(raysKey)) {\n      const rg = this.make.graphics({}, false);\n      for (let i = 0; i < 18; i++) {\n        const a0 = (i / 18) * Math.PI * 2;\n        rg.fillStyle(i % 2 ? st.color : GOLD, 0.12).slice(256, 256, 256, a0, a0 + Math.PI / 18, false).fillPath();\n      }\n      rg.generateTexture(raysKey, 512, 512);\n      rg.destroy();\n    }\n    const rays = add(this.add.image(cx, cy, raysKey).setDisplaySize(len * 2, len * 2).setDepth(D).setBlendMode(Phaser.BlendModes.ADD));\n    rays.setAlpha(0);"],
]);
console.log('ok');
