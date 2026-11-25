import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`    const x = defensive ? COURT.left + 145 : clamp(p.x + 55, COURT.left + 18, NET_X - 55);
    const y = defensive ? LAT_C + (p.y < LAT_C ? 125 : -125) : clamp(p.y, COURT.top + 6, COURT.bottom - 6);`,`    // (25-11-2026, usuario) DEFENSIVO: golpe FUERTE y plano a la esquina contraria a la tuya (bota cerca de la línea lateral)
    const x = defensive ? COURT.left + 120 : clamp(p.x + 55, COURT.left + 18, NET_X - 55);
    const y = defensive ? (p.y < LAT_C ? COURT.bottom - 25 : COURT.top + 25) : clamp(p.y, COURT.top + 6, COURT.bottom - 6);`],
[`    this.bot.ch.swing();
    aimShot(s, x, y, 380, 30);
    if (!defensive) s.damp = 0.3;`,`    this.bot.ch.swing(defensive);
    if (defensive) aimShot(s, x, y, 720, 14, 1.2);
    else aimShot(s, x, y, 380, 30);
    if (!defensive) s.damp = 0.3;`],
[`    if (this.guide === 'spin' && this.practicingReturns() && this.lastHitter === 'bot' && s.x < NET_X && this.bounces === 0) this.level2Coach();`,`    // (se arma en el bote y se para cuando la pelota ya se levanta: tickGuide)
    if (this.guide === 'spin' && this.practicingReturns() && this.lastHitter === 'bot' && s.x < NET_X && this.bounces === 0) this.level2PauseArmed = true;`],
[`      const servingNow = this.meServes && (this.phase === 'serve' || this.phase === 'toss');`,`      const servingNow = this.meServes && (this.phase === 'serve' || this.phase === 'toss');
      // el tiro del bot ya botó en tu lado: al levantarse, se para el tiempo (pausa del DEFENSIVO)
      const bs = this.ball.s;
      if (this.level2PauseArmed && (bs.vz <= 0 || bs.z >= 30)) {
        this.level2PauseArmed = false;
        this.level2Coach();
      }`],
[`  private guideReadyAt = 0;`,`  private guideReadyAt = 0;
  /** (25-11-2026) nivel 2: el tiro del bot botó en tu lado; la pausa del DEFENSIVO sale cuando la pelota se levanta */
  private level2PauseArmed = false;`],
[`    this.guideReadyAt = 0;`,`    this.guideReadyAt = 0;
    this.level2PauseArmed = false;`],
]);
console.log('ok');
