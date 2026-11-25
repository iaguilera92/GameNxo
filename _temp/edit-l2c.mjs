import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`  private level2PauseArmed = false;`,`  private level2PauseArmed = false;
  /** (25-11-2026, usuario) nivel 2: pelota congelada en el aire (posición y velocidad guardadas) hasta que pulses DEFENSIVO */
  private l2Freeze: { x: number; y: number; z: number; vx: number; vy: number; vz: number } | null = null;
  /** nivel 2: tu personaje quieto (sin joystick) desde el saque hasta usar el DEFENSIVO */
  private l2Lock = false;
  /** nivel 2: ya devolviste con el DEFENSIVO; el bot no se mueve hasta el final del punto (es tuyo) */
  private l2Won = false;`],
[`    this.guideReadyAt = 0;
    this.level2PauseArmed = false;`,`    this.guideReadyAt = 0;
    this.level2PauseArmed = false;
    this.l2Freeze = null;
    this.l2Lock = false;
    this.l2Won = false;`],
[`    if (!secondServe) this.guidePracticeStep = 0;`,`    if (!secondServe) this.guidePracticeStep = 0;
    this.l2Freeze = null;
    this.l2Won = false;
    this.l2Lock = this.guide === 'spin' && this.score.played === 0;
    this.level2PauseArmed = false;`],
[`    const v = this.joy.value.clone();
    const k = this.keys;`,`    if (this.l2Lock) return new Phaser.Math.Vector2(0, 0); // (25-11-2026) nivel 2: quieto hasta el DEFENSIVO
    const v = this.joy.value.clone();
    const k = this.keys;`],
[`    if (this.paused || this.cineLock || this.duel || !this.unlocked('defensive')) return false;`,`    if (this.l2Freeze) {
      // (25-11-2026, usuario) nivel 2: la pelota sigue su vuelo y el DEFENSIVO corre a por ella
      const f = this.l2Freeze;
      const s = this.ball.s;
      this.l2Freeze = null;
      Object.assign(s, f);
      const ok = this.activateDash();
      if (!ok) {
        this.l2Freeze = f;
        return false;
      }
      this.l2Lock = false;
      this.bot.ch.releaseFollowThrough();
      return true;
    }
    if (this.paused || this.cineLock || this.duel || !this.unlocked('defensive')) return false;`],
[`    if (v === 'player' && defensive && this.practicingReturns()) {
      this.guidePracticeStep++;
      if (this.guidePracticeStep >= 2) {
        this.tutMission('t02Def');
        this.tutMission('t02DefReturn');
      } else this.time.delayedCall(400, () => this.practicingReturns() && this.level2Coach()); // ahora tú
    }`,`    if (v === 'player' && defensive && this.practicingReturns()) {
      // (25-11-2026, usuario) nivel 2: una sola vez, la haces tú; la devolución va lejos del bot y el punto es tuyo
      this.guidePracticeStep = 2;
      this.l2Lock = false;
      this.l2Won = true;
      this.tutMission('t02Def');
      this.tutMission('t02DefReturn');
      this.time.delayedCall(0, () => {
        if (!this.l2Won || this.phase !== 'rally') return;
        aimShot(this.ball.s, COURT.right - 70, this.bot.y < LAT_C ? COURT.bottom - 45 : COURT.top + 45, 700, 20);
      });
    }`],
[`    const mv = this.entering || (this.phase === 'pointover' && !fetch) || this.guideBotFrozen() || (this.guide === 'spin' && this.practicingReturns()) ?`,`    const mv = this.entering || (this.phase === 'pointover' && !fetch) || this.guideBotFrozen() || (this.guide === 'spin' && (this.practicingReturns() || this.l2Won)) ?`],
[`    const defensive = !this.practiceChargeLimit();`,`    const defensive = !this.practiceChargeLimit();
    if (this.guide === 'spin' && this.l2Freeze) return; // ya hay un tiro esperando el DEFENSIVO`],
[`    const y = defensive ? (p.y < LAT_C ? COURT.bottom - 25 : COURT.top + 25) : clamp(p.y, COURT.top + 6, COURT.bottom - 6);`,`    // (nivel 2: siempre a tu IZQUIERDA, la mitad de arriba de la pantalla)
    const y = defensive ? (this.guide === 'spin' ? COURT.top + 25 : p.y < LAT_C ? COURT.bottom - 25 : COURT.top + 25) : clamp(p.y, COURT.top + 6, COURT.bottom - 6);`],
[`      // el tiro del bot ya botó en tu lado: al levantarse, se para el tiempo (pausa del DEFENSIVO)
      const bs = this.ball.s;
      if (this.level2PauseArmed && (bs.vz <= 0 || bs.z >= 30)) {
        this.level2PauseArmed = false;
        this.level2Coach();
      }`,`      // el tiro del bot ya botó en tu lado: al levantarse un poco, se para el tiempo (pelota en el aire, el bot en su golpe)
      const bs = this.ball.s;
      if (this.level2PauseArmed && (bs.vz <= 0 || bs.z >= 25)) {
        this.level2PauseArmed = false;
        this.l2Freeze = { x: bs.x, y: bs.y, z: bs.z, vx: bs.vx, vy: bs.vy, vz: bs.vz };
        this.bot.ch.facing = -1;
        this.bot.ch.swing(true);
        this.bot.ch.holdFollowThrough(4);
      }
      if (this.l2Freeze) {
        const f = this.l2Freeze;
        bs.x = f.x;
        bs.y = f.y;
        bs.z = f.z;
        bs.vx = bs.vy = bs.vz = 0;
        text = 'USA EL DEFENSIVO';
      }`],
[`    this.dashBtn.setHint(this.practicingReturns() && this.guidePracticeStep === 1 && !this.serveLock && this.phase === 'rally');`,`    this.dashBtn.setHint(!!this.l2Freeze);
    this.dashBtn.setDepth(this.l2Freeze ? 5610 : 5000); // nivel 2: por encima del oscurecido mientras esperas pulsarlo`],
[`    if (text && this.meServes && ((this.guide === 'first' && this.guideServeLesson() === 'tap') || (this.guide === 'spin' && this.practicingReturns()))) this.guideHand =`,`    if (this.guide === 'spin' && this.l2Freeze) this.guideHand = tapHint(this, this.dashBtn.x, this.dashBtn.y, 6060); // la mano, en el botón DEFENSIVO
    else if (text && this.meServes && (this.phase === 'serve' || this.phase === 'toss') && ((this.guide === 'first' && this.guideServeLesson() === 'tap') || (this.guide === 'spin' && this.practicingReturns()))) this.guideHand =`],
[`    const on = this.guide === 'first' && !!text;`,`    const on = (this.guide === 'first' || (this.guide === 'spin' && this.practicingReturns())) && !!text;`],
]);
console.log('ok');

