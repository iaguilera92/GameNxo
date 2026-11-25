import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`    } else if (this.guide === 'spin' && this.practicingReturns()) {
      text = ''; // (24-11-2026) nivel 2: lo explica la pausa del entrenador`,`    } else if (this.guide === 'spin' && this.practicingReturns()) {
      // (25-11-2026, usuario) nivel 2: primero SACAS (con su instrucción); el DEFENSIVO lo explica la pausa del entrenador
      const servingNow = this.meServes && (this.phase === 'serve' || this.phase === 'toss');
      text = servingNow ? (this.phase === 'toss' ? 'TOCA OTRA VEZ PARA GOLPEAR' : 'TOCA EL LADO DERECHO PARA SACAR') : '';`],
[`    if (this.guide === 'first') this.guideText.setPosition(this.scale.width / 2, this.scale.height * 0.46).setFontSize(36);`,`    if (this.guide === 'first' || this.guide === 'spin') this.guideText.setPosition(this.scale.width / 2, this.scale.height * 0.46).setFontSize(36);`],
[`    if (this.guide === 'first' && text && this.guideServeLesson() === 'tap' && this.meServes) this.guideHand =`,`    if (text && this.meServes && ((this.guide === 'first' && this.guideServeLesson() === 'tap') || (this.guide === 'spin' && this.practicingReturns()))) this.guideHand =`],
// bot cerca de su cuadro de saque (donde cae tu saque)
[`    if (this.guide === 'first' && this.score.played === 0 && this.server === 'bot') {`,`    // (25-11-2026, usuario) nivel 2, primer punto: el bot espera tu saque ADELANTADO, junto a su cuadro de saque (donde cae), y desde ahí
    // te tira esquinado al otro lado (feedPracticeReturn): no llegas sin el DEFENSIVO
    if (this.guide === 'spin' && this.score.played === 0 && this.server === 'player') {
      const sl = (COURT.right - NET_X) * 0.538;
      const boxY = this.player.y > LAT_C ? (COURT.top + LAT_C) / 2 : (LAT_C + COURT.bottom) / 2;
      this.setActor(this.bot, NET_X + sl * 0.9, boxY);
    }
    if (this.guide === 'first' && this.score.played === 0 && this.server === 'bot') {`],
[`    const mv = this.entering || (this.phase === 'pointover' && !fetch) || this.guideBotFrozen() ?`,`    const mv = this.entering || (this.phase === 'pointover' && !fetch) || this.guideBotFrozen() || (this.guide === 'spin' && this.practicingReturns()) ?`],
[`    this.bot.ch.swing();
    aimShot(s, x, y, 380, 30);
    if (!defensive) s.damp = 0.3;
    this.ball.setKind('normal');
    this.ball.setMaxCharge(false);
    this.lastHitter = 'bot';
    this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
    if (this.guide === 'spin') this.level2Coach();`,`    this.bot.ch.swing();
    aimShot(s, x, y, 380, 30);
    if (!defensive) s.damp = 0.3;
    this.ball.setKind('normal');
    this.ball.setMaxCharge(false);
    this.lastHitter = 'bot';
    this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
    // (25-11-2026, usuario) nivel 2: la pausa del entrenador sale cuando la pelota BOTA en tu lado (handleBounce), no al tirarla`],
[`    if (this.guide === 'first' && this.score.played === 0) {
      const r = this.guideRally;`,`    // (25-11-2026, usuario) nivel 2: el tiro esquinado del bot bota en tu lado y el tiempo se para (pausa del DEFENSIVO)
    if (this.guide === 'spin' && this.practicingReturns() && this.lastHitter === 'bot' && s.x < NET_X && this.bounces === 0) this.level2Coach();
    if (this.guide === 'first' && this.score.played === 0) {
      const r = this.guideRally;`],
]);
console.log('ok');
