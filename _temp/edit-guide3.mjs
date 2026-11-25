import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
[`  private guideReadyAt = 0;`,`  private guideReadyAt = 0;
  /**
   * (25-11-2026, usuario) peloteo guiado del nivel 1 (guideMove 3): k = golpe (0 el saque del bot a tu derecha; 1 arriba a la izquierda;
   * 2 arriba a la derecha; 3 todo el rectángulo de abajo). serve/feed = la pelota viene a ti; fly = la tuya va al bot; wait = el bot la
   * tiene hasta que llegas al cuadro; done = tu último golpe: bota dos veces en su campo y el punto es tuyo.
   */
  private guideRally: { k: number; st: 'serve' | 'feed' | 'fly' | 'wait' | 'done' } = { k: 0, st: 'serve' };`],
[`    this.guideReadyAt = 0;`,`    this.guideReadyAt = 0;
    this.guideRally = { k: 0, st: 'serve' };`],
[`      if (this.guideMove === 4) {
        this.guideMove = 5;
        return;
      }
      if (this.guideMove === 5) return;
      if ((this.guideMove === 3 || this.guideMove === 6) && this.bounces > 0) {
        this.guideFeed(this.guideMove === 3 ? 1 : -1);
        return;
      }`,`      const r = this.guideRally;
      if (this.guideMove === 3 && r.st === 'fly' && s.x > NET_X) {
        r.st = 'wait'; // el bot la tiene hasta que llegues al cuadro
        return;
      }
      if (this.guideMove === 3 && r.st === 'wait') return;
      // no le pegaste (dio 2 botes en tu lado): el bot la tira otra vez al mismo sitio
      if (this.guideMove === 3 && (r.st === 'serve' || r.st === 'feed') && this.bounces > 0) {
        this.guideFeed(this.guideZoneRect(Math.max(1, r.k), r.k === 0 ? 1 : undefined));
        r.st = 'feed';
        return;
      }`],
[`  /** (25-11-2026, usuario) centro del cuadro del primer partido: la mitad de fondo del rectángulo de tu lado (izquierda -1 / derecha 1) */
  private guideTargetY(side: number) {
    return LAT_C + side * (LAT_C - COURT.top) / 2;
  }

  /** largo (desde tu línea de fondo) del cuadro del primer partido: la mitad del rectángulo de fondo (hasta la línea de saque) */
  private guideZoneDepth() {
    return ((NET_X - COURT.left) * (1 - 0.538)) / 2;
  }`,`  /** (25-11-2026, usuario) centro (a lo ancho) de la mitad izquierda (-1) o derecha (1) de tu cancha */
  private guideTargetY(side: number) {
    return LAT_C + side * (LAT_C - COURT.top) / 2;
  }

  /** tu línea de saque (el fondo de los cuadros de saque, como computeServeBox) */
  private guideServiceLine() {
    return NET_X - (NET_X - COURT.left) * 0.538;
  }

  /**
   * (25-11-2026, usuario) cuadros del primer partido, en tu lado: 0 = rectángulo de abajo (de la línea de fondo a la de saque), mitad izquierda;
   * 1 = cuadro de saque de arriba a la izquierda; 2 = arriba a la derecha; 3 = todo el rectángulo de abajo. \`side\` cambia el lado de 0 (1 = derecha).
   */
  private guideZoneRect(i: number, side?: -1 | 1) {
    const sv = this.guideServiceLine();
    const half = (s: number) => (s < 0 ? { y0: COURT.top, y1: LAT_C, side: -1 } : { y0: LAT_C, y1: COURT.bottom, side: 1 });
    if (i === 0) return { x0: COURT.left, x1: sv, ...half(side ?? -1) };
    if (i === 1) return { x0: sv, x1: NET_X, ...half(-1) };
    if (i === 2) return { x0: sv, x1: NET_X, ...half(1) };
    return { x0: COURT.left, x1: sv, y0: COURT.top, y1: COURT.bottom, side: 0 };
  }

  /** ¿Tu personaje está dentro del cuadro? (en los de abajo vale estar detrás de la línea de fondo) */
  private inGuideZone(r: ReturnType<MatchScene['guideZoneRect']>) {
    const p = this.player;
    const xOk = r.x0 === COURT.left ? p.x <= r.x1 - 12 : p.x >= r.x0 + 15;
    const yOk = r.side < 0 ? p.y <= LAT_C - 25 : r.side > 0 ? p.y >= LAT_C + 25 : true;
    return xOk && yOk;
  }

  /** ¡BIEN! con un check verde (y sonido) en el cuadro que acabas de tocar */
  private guideCheck(r: ReturnType<MatchScene['guideZoneRect']>) {
    sfx(this, 'equipar');
    const c = project((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
    const g = this.add.container(c.sx, c.sy - 40).setDepth(6066);
    const ic = this.add.graphics();
    ic.fillStyle(0x000000, 0.35).fillCircle(2, 4, 34);
    ic.fillStyle(0x2ecc71, 1).fillCircle(0, 0, 34);
    ic.lineStyle(4, 0xffffff, 1).strokeCircle(0, 0, 34);
    ic.lineStyle(9, 0xffffff, 1).beginPath().moveTo(-15, 1).lineTo(-4, 13).lineTo(17, -12).strokePath();
    const t = this.add.text(0, -62, '¡BIEN!', { ...textStyle(34, '#7dffb0'), stroke: '#06331a', strokeThickness: 7 }).setOrigin(0.5);
    g.add([ic, t]);
    g.setScale(0.3);
    this.tweens.add({ targets: g, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: g, alpha: 0, y: g.y - 30, delay: 900, duration: 350, onComplete: () => g.destroy() });
  }`],
[`  private guideFeed(side: 1 | -1) {
    const s = this.ball.s;
    s.x = this.bot.x - 15;
    s.y = this.bot.y;
    s.z = 48;
    this.bot.ch.swing();
    const y = this.guideTargetY(side);
    // El bote queda delante del jugador y la pelota sigue hacia su cuadro.
    aimShot(s, COURT.left + 70, y, 610, 24);`,`  private guideFeed(r: ReturnType<MatchScene['guideZoneRect']>) {
    const s = this.ball.s;
    s.x = this.bot.x - 15;
    s.y = this.bot.y;
    s.z = 48;
    this.bot.ch.swing();
    // el bote, dentro del cuadro y justo delante de ti: la pelota sigue hacia ti
    const p = this.player;
    const bx = clamp(p.x + 80, r.x0 + 20, r.x1 - 15);
    const by = clamp(p.y, r.y0 + 15, r.y1 - 15);
    aimShot(s, bx, by, 610, 24);`],
[`    if (this.score.played === 0) {
      const right = this.guideMove === 3;
      if ((right || this.guideMove === 6) && s.vx < 0 && this.bounces > 0
        && Math.abs(this.player.y - this.guideTargetY(right ? 1 : -1)) < 50
        && this.inReach(this.player, s, HIT_RANGE * 1.7, HIT_MAX_Z * 1.3)) {
        this.playerHit();
        aimShot(s, COURT.right - 85, LAT_C, 660, 24);
        this.guideMove = right ? 4 : 7;
        if (!right) this.guideMission('guideJoystick');
      }
      return true;
    }`,`    if (this.score.played === 0) {
      const r = this.guideRally;
      if (this.guideMove === 3 && (r.st === 'serve' || r.st === 'feed') && s.vx < 0 && this.bounces > 0
        && this.inReach(this.player, s, HIT_RANGE * 1.7, HIT_MAX_Z * 1.3)) {
        this.playerHit();
        aimShot(s, COURT.right - 85, LAT_C, 660, 24);
        if (r.k >= 3) {
          // golpe desde el rectángulo de abajo: bota dos veces en su campo, punto tuyo (y el bot hace su pose de punto perdido)
          r.st = 'done';
          this.guideMission('guideJoystickUpDown');
        } else {
          r.k++;
          r.st = 'fly';
        }
      }
      return true;
    }`],
[`      const step = this.guideMove;
      direction = step === 0 || step === 5 || step === 6 ? -1 : step <= 3 ? 1 : 0;
      text = step <= 1 ? \`MUEVE EL JOYSTICK A LA \${direction < 0 ? 'IZQUIERDA' : 'DERECHA'}\` : direction ? \`VE AL CUADRO DE LA \${direction < 0 ? 'IZQUIERDA' : 'DERECHA'}\` : '';
      if (direction) {
        const p = this.player;
        p.y = clamp(p.y, COURT.top + 24, COURT.bottom - 24);
        p.x = clamp(p.x, COURT.left - 68, COURT.left + this.guideZoneDepth() - 10);
        if (Math.abs(p.y - this.guideTargetY(direction)) < 38) {
          if (step <= 1) {
            this.guideMove++;
            if (step === 1) this.guideReadyAt = this.time.now + 850;
          } else if (step === 2 && this.time.now >= this.guideReadyAt) {
            this.guideMove = 3;
            this.beginToss('normal');
          } else if (step === 5) {
            this.guideMove = 6;
            this.guideFeed(-1);
          }
        }
      }
      if (this.guideMove === 5) {
        const s = this.ball.s;
        s.vx = s.vy = s.vz = 0;
        s.z = 48;
      }`,`      // (25-11-2026, usuario) 1) izquierda (check) 2) derecha (misión) 3) el bot saca a tu derecha y le pegas 4) te la tira arriba a la
      // izquierda, 5) arriba a la derecha y 6) a todo el rectángulo de abajo (misión). Ese último golpe es punto tuyo.
      const step = this.guideMove;
      const r = this.guideRally;
      const p = this.player;
      if (step <= 1) {
        zone = this.guideZoneRect(0, step === 0 ? -1 : 1);
        text = step === 0 ? 'MUEVE EL JOYSTICK A LA IZQUIERDA' : 'AHORA A LA DERECHA';
        p.y = clamp(p.y, COURT.top + 24, COURT.bottom - 24);
        p.x = clamp(p.x, COURT.left - 68, zone.x1 - 14);
        if (this.inGuideZone(zone)) {
          if (step === 0) this.guideCheck(zone);
          else {
            this.guideCheck(zone);
            this.guideMission('guideJoystick');
            this.guideReadyAt = this.time.now + 1300;
          }
          this.guideMove++;
        }
      } else if (step === 2) {
        if (this.time.now >= this.guideReadyAt) {
          this.guideMove = 3;
          this.guideRally = { k: 0, st: 'serve' };
          this.beginToss('normal');
        }
      } else if (r.k >= 1 && r.st !== 'done') {
        zone = this.guideZoneRect(r.k);
        text = r.k === 1 ? 'SUBE AL CUADRO DE ARRIBA A LA IZQUIERDA' : r.k === 2 ? 'AHORA ARRIBA A LA DERECHA' : 'BAJA AL RECTÁNGULO DE ABAJO';
        if (r.st === 'wait') {
          // el bot la tiene en la mano hasta que llegues
          const s = this.ball.s;
          s.x = this.bot.x - 15;
          s.y = this.bot.y;
          s.vx = s.vy = s.vz = 0;
          s.z = 48;
          if (this.inGuideZone(zone)) {
            this.guideCheck(zone);
            this.guideFeed(zone);
            r.st = 'feed';
          }
        }
      }`],
[`    let text = '';
    let direction = 0;`,`    let text = '';
    let zone: ReturnType<MatchScene['guideZoneRect']> | null = null;`],
[`    if (direction) {
      // dentro de la cancha: la mitad de fondo del rectángulo de abajo a la izquierda (o a la derecha), de línea a línea
      const y0 = direction < 0 ? COURT.top : LAT_C;
      const y1 = direction < 0 ? LAT_C : COURT.bottom;
      const x1 = COURT.left + this.guideZoneDepth();
      const a = project(COURT.left, y0 + 4);
      const b = project(COURT.left, y1 - 4);
      const c = project(x1, y1 - 4);
      const d = project(x1, y0 + 4);`,`    if (zone) {
      // dentro de la cancha, de línea a línea (un poco hacia adentro para no tapar las líneas)
      const a = project(zone.x0 + 4, zone.y0 + 4);
      const b = project(zone.x0 + 4, zone.y1 - 4);
      const c = project(zone.x1 - 4, zone.y1 - 4);
      const d = project(zone.x1 - 4, zone.y0 + 4);`],
]);
apply('frontend/src/domain/matchMissions.ts',[
["'guideJoystick' | 'guideDirectServe' |","'guideJoystick' | 'guideJoystickUpDown' | 'guideDirectServe' |"],
["  if (id === 'guideDirectServe') return","  if (id === 'guideJoystickUpDown') return { id, title: 'Joystick arriba y abajo', coins: 15 }; // (25-11-2026, usuario) nivel 1\n  if (id === 'guideDirectServe') return"],
]);
apply('frontend/src/domain/tutorialMissions.ts',[
["  1: ['guideJoystick', 'guideDirectServe', 'tWin'],","  1: ['guideJoystick', 'guideJoystickUpDown', 'guideDirectServe', 'tWin'],"],
]);
apply('frontend/src/scenes/MatchEndScene.ts',[
["[missionDef('guideJoystick'), missionDef('guideDirectServe')]","[missionDef('guideJoystick'), missionDef('guideJoystickUpDown'), missionDef('guideDirectServe')]"],
]);
console.log('ok');
