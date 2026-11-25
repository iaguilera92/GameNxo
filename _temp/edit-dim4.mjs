import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
[`  private guideDim?: Phaser.GameObjects.Rectangle;
  private guideDimMask?: Phaser.GameObjects.Graphics;`,`  private guideDim?: Phaser.GameObjects.Graphics;`],
[`    this.guideDim = undefined;
    this.guideDimMask = undefined;`,`    this.guideDim = undefined;`],
[`    if (!this.guideDim) {
      this.guideDimMask = this.make.graphics({}, false);
      const mask = this.guideDimMask.createGeometryMask();
      mask.setInvertAlpha(true);
      // por encima del marcador (5500); encima del oscurecido: joystick, botón de saque, aviso de quién saca y tu personaje
      this.guideDim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x02060f, 0.6).setOrigin(0).setScrollFactor(0).setDepth(5600).setMask(mask);
    }
    if (!this.guideDim.visible) this.guideDim.setVisible(true);`,`    // por encima del marcador (5500); encima del oscurecido: joystick, botón de saque, aviso de quién saca y tu personaje
    this.guideDim ??= this.add.graphics().setDepth(5600);
    if (!this.guideDim.visible) this.guideDim.setVisible(true);`],
[`    // agujero: solo el cuadro al que tienes que ir (en coordenadas del mundo: la máscara se dibuja con la cámara)
    const g = this.guideDimMask!.clear().fillStyle(0xffffff, 1);
    if (this.guideZonePts.length) g.fillPoints(this.guideZonePts, true);
  }`,`    // (25-11-2026) sin máscara: el oscurecido se dibuja en 4 piezas ALREDEDOR del cuadro al que tienes que ir (en coordenadas del mundo,
    // las mismas del cuadro): arriba, abajo y los dos costados en diagonal. Sin cuadro, la pantalla entera.
    const v = this.cameras.main.worldView;
    const X0 = v.x - 4, X1 = v.right + 4, Y0 = v.y - 4, Y1 = v.bottom + 4;
    const g = this.guideDim.clear().fillStyle(0x02060f, 0.6);
    const z = this.guideZonePts;
    if (z.length !== 4) {
      g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
      return;
    }
    // a, b = borde de cerca (abajo); c, d = borde del fondo (arriba)
    const [a, b, c, d] = z;
    const nl = a.x <= b.x ? a : b, nr = a.x <= b.x ? b : a;
    const fl = d.x <= c.x ? d : c, fr = d.x <= c.x ? c : d;
    const yT = Math.min(fl.y, fr.y), yB = Math.max(nl.y, nr.y);
    g.fillRect(X0, Y0, X1 - X0, yT - Y0);
    g.fillRect(X0, yB, X1 - X0, Y1 - yB);
    g.fillPoints([{ x: X0, y: yT }, fl, nl, { x: X0, y: yB }], true);
    g.fillPoints([fr, { x: X1, y: yT }, { x: X1, y: yB }, nr], true);
  }`],
[`    if (i === 0) return { x0: COURT.left, x1: NET_X, ...half(side ?? -1) }; // el rectángulo largo: de la línea de fondo a la red`,`    if (i === 0) return { x0: COURT.left, x1: sv, ...half(side ?? -1) }; // (25-11-2026, usuario) solo el de abajo: de la línea de fondo a la de saque`],
[`0 = el rectángulo largo (de la línea de fondo a la red), mitad izquierda;`,`0 = el rectángulo de abajo (de la línea de fondo a la de saque), mitad izquierda;`],
[`    const xOk = r.x0 === COURT.left ? p.x <= r.x1 - 45 : p.x >= r.x0 + 15;`,`    const xOk = r.x0 === COURT.left ? p.x <= r.x1 - 12 : p.x >= r.x0 + 15;`],
[`      btn.setEnabled(false);
      btn.setSubLabel(unlockLabel(key));`,`      btn.setEnabled(false);
      // (25-11-2026, usuario) "NIVEL n" en el centro del botón (ya no debajo)
      btn.setSubLabel('');
      btn.setLockText(unlockLabel(key));`],
]);
apply('frontend/src/ui/AbilityButton.ts',[
[`  /** Sin etiqueta ni subtítulo (jugadores en nivel máximo: ya conocen los botones). */`,`  /** (25-11-2026) bloqueado por nivel: "NIVEL n" grande en el centro del botón (null lo quita) */
  private lockText?: Phaser.GameObjects.Container;
  setLockText(text: string | null) {
    this.lockText?.destroy();
    this.lockText = undefined;
    if (!text) return;
    const [word, num] = text.split(' ');
    const st = { fontFamily: '"Lilita One", "Arial Black", sans-serif', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 };
    const c = this.scene.add.container(0, 0);
    c.add(this.scene.add.text(0, -this.radius * 0.3, word, { ...st, fontSize: \`\${Math.round(this.radius * 0.36)}px\` }).setOrigin(0.5));
    c.add(this.scene.add.text(0, this.radius * 0.2, num ?? '', { ...st, fontSize: \`\${Math.round(this.radius * 0.8)}px\` }).setOrigin(0.5));
    this.add(c);
    this.lockText = c;
  }

  /** Sin etiqueta ni subtítulo (jugadores en nivel máximo: ya conocen los botones). */`],
]);
console.log('ok');
