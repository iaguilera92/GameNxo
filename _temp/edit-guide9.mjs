import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`    const on = this.phase === 'rally' && this.lastHitter === 'player' && s.vx > 0 && s.x > NET_X - 80 && !moving && bt.stun <= 0 && !bt.vanished && !bt.ch.dashing;`,`    // (25-11-2026, usuario) nivel 1: mientras retiene la pelota esperando a que llegues al cuadro, sigue en la pose de carga
    const guideWait = this.guideBotFrozen() && this.guideRally.st === 'wait';
    const on = guideWait || (this.phase === 'rally' && this.lastHitter === 'player' && s.vx > 0 && s.x > NET_X - 80 && !moving && bt.stun <= 0 && !bt.vanished && !bt.ch.dashing);`],
]);
console.log('ok');
