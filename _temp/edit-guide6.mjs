import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
[`  private guideRally: { k: number; st: 'serve' | 'feed' | 'fly' | 'wait' | 'done'; reached?: boolean } = { k: 0, st: 'serve' };`,`  private guideRally: { k: number; st: 'serve' | 'feed' | 'fly' | 'wait' | 'done'; reached?: boolean; hold?: { x: number; y: number; z: number } } = { k: 0, st: 'serve' };
  /** (25-11-2026, usuario) peloteo guiado del nivel 1 en curso (tras el saque): el bot no se mueve, solo hace lo que manda el guion */
  private guideBotFrozen() {
    const st = this.guideRally.st;
    return this.guide === 'first' && this.score.played === 0 && this.guideMove === 3 && st !== 'serve';
  }`],
[`      if (this.guideMove === 3 && r.st === 'fly' && s.x > NET_X) {
        r.st = 'wait'; // el bot la tiene hasta que llegues al cuadro
        return;
      }`,`      // tu golpe va derecho a la raqueta del bot (tickGuide la detiene allí): su bote no cuenta
      if (this.guideMove === 3 && r.st === 'fly') return;`],
[`        this.playerHit();
        aimShot(s, COURT.right - 85, LAT_C, 660, 24);
        if (r.k >= 3) {`,`        this.playerHit();
        // a la raqueta del bot (bota delante de él); el último, lejos de él: punto tuyo
        if (r.k >= 3) aimShot(s, COURT.right - 150, this.bot.y > LAT_C ? COURT.top + 60 : COURT.bottom - 60, 660, 24);
        else aimShot(s, this.bot.x - 140, this.bot.y, 660, 24);
        if (r.k >= 3) {`],
[`        if (r.st === 'wait') {
          // el bot la tiene en la mano hasta que llegues
          const s = this.ball.s;
          s.x = this.bot.x - 15;
          s.y = this.bot.y;
          s.vx = s.vy = s.vz = 0;
          s.z = 48;
          if (this.inGuideZone(zone)) {`,`        const s = this.ball.s;
        // (25-11-2026, usuario) la pelota llega a la raqueta del bot: él se queda QUIETO en la pose del golpe y la pelota, quieta, hasta que
        // llegues al cuadro; entonces le pega
        if (r.st === 'fly' && s.vx > 0 && s.x >= this.bot.x - 40) {
          r.st = 'wait';
          r.hold = { x: s.x, y: s.y, z: Math.max(20, s.z) };
          this.bot.ch.facing = -1;
          this.bot.ch.swing();
          this.bot.ch.holdFollowThrough(3);
        }
        if (r.st === 'wait') {
          const h = r.hold ?? { x: this.bot.x - 30, y: this.bot.y, z: 40 };
          s.x = h.x;
          s.y = h.y;
          s.z = h.z;
          s.vx = s.vy = s.vz = 0;
          if (this.inGuideZone(zone)) {
            this.bot.ch.releaseFollowThrough();
            this.bot.ch.resetPose();`],
[`    const mv = this.entering || (this.phase === 'pointover' && !fetch) ?`,`    const mv = this.entering || (this.phase === 'pointover' && !fetch) || this.guideBotFrozen() ?`],
]);
console.log('ok');
