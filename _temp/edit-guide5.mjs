import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
[`      this.setActor(this.player, COURT.left - 45, LAT_C + side * 40);
    }`,`      this.setActor(this.player, COURT.left - 45, LAT_C + side * 40);
    }
    // (25-11-2026, usuario) nivel 1, primer punto: empiezas a la IZQUIERDA (vas primero a la derecha) y el bot saca desde su lado para que
    // el saque caiga en tu cuadro de la IZQUIERDA (computeServeBox usa su posición)
    if (this.guide === 'first' && this.score.played === 0 && this.server === 'bot') {
      this.setActor(this.bot, COURT.right + 40, LAT_C + 70);
      this.setActor(this.player, COURT.left - 45, LAT_C - 110);
    }`],
[`if (who === 'bot' && this.guide === 'first') ty = clamp(s.y + (this.guideTargetY(1) - s.y)`,`if (who === 'bot' && this.guide === 'first') ty = clamp(s.y + (this.guideTargetY(this.serveBox.y0 < LAT_C ? -1 : 1) - s.y)`],
[`  private guideRally: { k: number; st: 'serve' | 'feed' | 'fly' | 'wait' | 'done' } = { k: 0, st: 'serve' };`,`  private guideRally: { k: number; st: 'serve' | 'feed' | 'fly' | 'wait' | 'done'; reached?: boolean } = { k: 0, st: 'serve' };`],
[`        this.guideFeed(r.k === 0 ? this.guideZoneRect(0, 1) : this.guideZoneRect(r.k));`,`        this.guideFeed(r.k === 0 ? this.guideZoneRect(0, -1) : this.guideZoneRect(r.k));`],
[`      if (step <= 1) {
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
      } else if (step === 2) {`,`      // (25-11-2026, usuario) empiezas a la izquierda: 1) a la DERECHA (check) 2) el bot saca a tu IZQUIERDA y vas allí (check + misión)
      if (step <= 1) {
        zone = this.guideZoneRect(0, 1);
        text = 'MUEVE EL JOYSTICK A LA DERECHA';
        p.y = clamp(p.y, COURT.top + 24, COURT.bottom - 24);
        p.x = clamp(p.x, COURT.left - 68, zone.x1 - 14);
        if (this.inGuideZone(zone)) {
          this.guideCheck(zone);
          this.guideReadyAt = this.time.now + 900;
          this.guideMove = 2;
        }
      } else if (step === 2) {`],
[`          this.guideRally = { k: 0, st: 'serve' };`,`          this.guideRally = { k: 0, st: 'serve', reached: false };`],
[`      } else if (r.k >= 1 && r.st !== 'done') {
        zone = this.guideZoneRect(r.k);
        text = r.k === 1 ?`,`      } else if (r.k === 0 && r.st !== 'done') {
        // el saque del bot va a tu izquierda: ve a ese cuadro
        zone = this.guideZoneRect(0, -1);
        text = 'AHORA VE A LA IZQUIERDA';
        if (!r.reached && this.inGuideZone(zone)) {
          r.reached = true;
          this.guideCheck(zone);
          this.guideMission('guideJoystick');
        }
      } else if (r.k >= 1 && r.st !== 'done') {
        zone = this.guideZoneRect(r.k);
        text = r.k === 1 ?`],
// pulso del joystick (una vez) cuando sale "MUEVE EL JOYSTICK"
[`    this.guideText.setText(text).setVisible(!!text);`,`    this.guideText.setText(text).setVisible(!!text);
    if (this.guide === 'first' && text.startsWith('MUEVE EL JOYSTICK')) this.joy.pulse(text.endsWith('DERECHA') ? 1 : -1); // (25-11-2026) una pulsación`],
// oscurecido en el saque: tu cuadro de saque del rival y el rival, sin oscurecer
[`        this.serveTag.setFront(false);
        this.player.depthBoost = 0;`,`        this.serveTag.setFront(false);
        this.player.depthBoost = 0;
        this.bot.depthBoost = 0;`],
[`    this.player.depthBoost = 6000;`,`    this.player.depthBoost = 6000;
    // (25-11-2026, usuario) cuando SACAS: sin oscurecer el cuadro donde va el saque ni el rival
    const serving = this.meServes && (this.phase === 'serve' || this.phase === 'toss');
    this.bot.depthBoost = serving ? 6000 : 0;`],
[`    const z = this.guideZonePts;
    if (z.length !== 4) {`,`    const sb = this.serveBox;
    const z = serving
      ? [project(sb.x0, sb.y0), project(sb.x0, sb.y1), project(sb.x1, sb.y1), project(sb.x1, sb.y0)].map(({ sx, sy }) => ({ x: sx, y: sy }))
      : this.guideZonePts;
    if (z.length !== 4) {`],
]);
apply('frontend/src/ui/Joystick.ts',[
[`  /** (25-11-2026) primer partido del tutorial: el joystick, por encima del oscurecido de la guía y más visible */`,`  /** (25-11-2026) primer partido del tutorial: UNA pulsación del joystick (la base late y la palanca se mueve hacia \`dir\`: -1 izq., 1 der.) */
  pulse(dir: -1 | 1) {
    if (this.pointerId !== null) return;
    const s = this.scene;
    s.tweens.add({ targets: this.base, scale: { from: 1, to: 1.18 }, duration: 220, yoyo: true, ease: 'Quad.easeOut' });
    s.tweens.add({ targets: this.knob, x: this.home.x + dir * this.radius * 0.6, duration: 260, yoyo: true, hold: 120, ease: 'Quad.easeInOut', onComplete: () => this.pointerId === null && this.knob.setPosition(this.home.x, this.home.y) });
  }

  /** (25-11-2026) primer partido del tutorial: el joystick, por encima del oscurecido de la guía y más visible */`],
]);
console.log('ok');
