import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`      const servingNow = this.meServes && (this.phase === 'serve' || this.phase === 'toss');
      // el tiro del bot`,`      const servingNow = this.server === 'player' && (this.phase === 'serve' || this.phase === 'toss');
      text = servingNow ? (this.phase === 'toss' ? 'TOCA OTRA VEZ PARA GOLPEAR' : 'TOCA EL LADO DERECHO PARA SACAR') : '';
      // el tiro del bot`],
[`        text = 'USA EL DEFENSIVO';
      }
      text = servingNow ? (this.phase === 'toss' ? 'TOCA OTRA VEZ PARA GOLPEAR' : 'TOCA EL LADO DERECHO PARA SACAR') : '';`,`        text = 'USA EL DEFENSIVO';
      }`],
[`    const on = (this.guide === 'first' || (this.guide === 'spin' && this.practicingReturns())) && !!text;`,`    // (25-11-2026, usuario) siempre que se enseña algo: oscuro salvo tu personaje, el rival y la pelota (nivel 2: el saque y la pausa del DEFENSIVO)
    const l2 = this.guide === 'spin' && this.practicingReturns() && (!!this.l2Freeze || (this.server === 'player' && (this.phase === 'serve' || this.phase === 'toss')));
    const on = (this.guide === 'first' && !!text) || l2;`],
[`    // (25-11-2026, usuario) cuando SACAS: sin oscurecer el cuadro donde va el saque ni el rival
    const serving = this.meServes && (this.phase === 'serve' || this.phase === 'toss');
    this.bot.depthBoost = serving ? 6000 : 0;`,`    // (25-11-2026, usuario) cuando SACAS: sin oscurecer el cuadro donde va el saque; el rival se ve al sacar y en la pausa del nivel 2
    const serving = this.server === 'player' && (this.phase === 'serve' || this.phase === 'toss');
    this.bot.depthBoost = serving || l2 ? 6000 : 0;`],
]);
console.log('ok');
