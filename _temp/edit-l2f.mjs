import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`  private l2Won = false;`,`  private l2Won = false;
  /** nivel 2: ya pulsaste DEFENSIVO; corres hasta la pelota (que sigue quieta) */
  private l2Running = false;`],
[`    this.l2Freeze = null;
    this.l2Lock = false;
    this.l2Won = false;`,`    this.l2Freeze = null;
    this.l2Lock = false;
    this.l2Won = false;
    this.l2Running = false;`],
[`    this.l2Freeze = null;
    this.l2Won = false;
    this.l2Lock = this.guide === 'spin' && this.score.played === 0;`,`    this.l2Freeze = null;
    this.l2Won = false;
    this.l2Running = false;
    this.l2Lock = this.guide === 'spin' && this.score.played === 0;`],
[`    if (this.l2Freeze) {
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
    }`,`    if (this.l2Freeze) return this.l2Dash();`],
[`  /** ¿DASH como sprint? (DASH.enabled y sin localStorage 'dev.dashSprint' = '0') */`,`  /**
   * (25-11-2026, usuario) NIVEL 2: DEFENSIVO con la pelota QUIETA en el aire: corres (sprint del DASH) hasta ella y, al llegar, le pegas;
   * recién ahí la pelota se devuelve (recordHit la manda lejos del bot: punto tuyo).
   */
  private l2Dash(): boolean {
    const f = this.l2Freeze;
    if (!f || this.l2Running) return false;
    this.l2Running = true;
    const pl = this.player;
    const tx = clamp(f.x - 22, P_X[0], P_X[1]);
    const ty = clamp(f.y, Y_MIN, Y_MAX);
    const dirX = Math.sign(ty - pl.y) || 1;
    const dist = Math.hypot(tx - pl.x, ty - pl.y);
    this.stopCharge();
    stopMotion(this.motion);
    pl.ch.setSprint(true, dirX);
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    sfx(this, dashSfx(this.smashEl));
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    this.tweens.add({
      targets: pl,
      x: tx,
      y: ty,
      duration: clamp((dist / (PLAYER_SPEED * 3)) * 1000, 250, 700),
      ease: 'Quad.easeOut',
      onComplete: () => {
        pl.ch.setSprint(false, dirX, true);
        if (!this.l2Freeze || this.phase !== 'rally') return;
        // la pelota retoma su vuelo justo en el golpe (el DEFENSIVO cuenta: dashHit)
        const s = this.ball.s;
        Object.assign(s, f);
        this.l2Freeze = null;
        this.l2Lock = false;
        this.bot.ch.releaseFollowThrough();
        pl.ch.facing = ty < pl.y ? -1 : 1;
        this.dashHit = { t: 0, elapsed: 0, x: tx, y: ty, sprint: true };
        this.playerHit(true);
        this.dashHit = null;
      },
    });
    return true;
  }

  /** ¿DASH como sprint? (DASH.enabled y sin localStorage 'dev.dashSprint' = '0') */`],
[`        text = 'USA EL DEFENSIVO';`,`        text = this.l2Running ? '' : 'USA EL DEFENSIVO';`],
[`    if (this.guide === 'spin' && this.l2Freeze) this.guideHand =`,`    if (this.guide === 'spin' && this.l2Freeze && text) this.guideHand =`],
]);
console.log('ok');
