import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`hold?: { x: number; y: number; z: number } } = { k: 0, st: 'serve' };`,`hold?: { x: number; y: number; z: number }; bounced?: boolean } = { k: 0, st: 'serve' };`],
[`      // tu golpe va derecho a la raqueta del bot (tickGuide la detiene allí): su bote no cuenta
      if (this.guideMove === 3 && r.st === 'fly') return;`,`      // tu golpe va derecho a la raqueta del bot (tickGuide la detiene en lo alto de su bote, delante de él): su bote no cuenta
      if (this.guideMove === 3 && r.st === 'fly') {
        if (s.x > NET_X) r.bounced = true;
        return;
      }`],
[`        else aimShot(s, this.bot.x - 140, this.bot.y, 660, 24);`,`        else aimShot(s, this.bot.x - 200, this.bot.y, 660, 24);`],
[`          r.k++;
          r.st = 'fly';`,`          r.k++;
          r.st = 'fly';
          r.bounced = false;`],
[`        if (r.st === 'fly' && s.vx > 0 && s.x >= this.bot.x - 40) {`,`        // (se para en lo alto del bote en su campo, o antes de tocarle: si llegara a su cuerpo, contaría como punto)
        if (r.st === 'fly' && ((r.bounced && s.vz <= 0) || s.x >= this.bot.x - 90)) {`],
]);
console.log('ok');
