import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`    walk(this.player, -1);
    // en red también se camina AQUÍ`,`    // (25-11-2026, usuario) nivel 1 (guía 'first'): tu personaje entra desde la IZQUIERDA (empieza a la izquierda y va a la derecha)
    walk(this.player, this.guide === 'first' ? 1 : -1);
    // en red también se camina AQUÍ`],
[`          this.bot.ch.facing = -1;
          this.bot.ch.swing();
          this.bot.ch.holdFollowThrough(3);`,`          // (25-11-2026, usuario) mientras espera: la pose de CARGANDO el golpe; el impacto, cuando llegas al cuadro (guideFeed)
          this.bot.ch.facing = -1;
          this.bot.ch.setCharging(true);`],
[`            this.bot.ch.releaseFollowThrough();
            this.bot.ch.resetPose();`,`            this.bot.ch.setCharging(false);`],
[`    this.tickGuideDim(text);`,`    this.tickGuideDim(text);
    // (25-11-2026, usuario) nivel 1: el marcador queda apagado todo el partido guiado (no distrae)
    if (this.guide === 'first' && this.hud.alpha !== 0.3) this.hud.setAlpha(0.3);`],
]);
console.log('ok');
