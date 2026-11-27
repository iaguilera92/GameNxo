import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/RankedScene.ts',[
["      const c = { v: 0 };\n      this.tweens.add({ targets: c, v: p.amount, delay: 320, duration: p.amount > 20 ? 800 : 400, ease: 'Cubic.easeOut', onUpdate: () => amt.setText(`+${fmtCoins(Math.round(c.v))}`),",
 "      const c = { v: 0 };\n      // (26-11-2026) el texto grande (96 px con borde) solo se redibuja cuando cambia la cifra\n      let shown = -1;\n      this.tweens.add({ targets: c, v: p.amount, delay: 320, duration: p.amount > 20 ? 800 : 400, ease: 'Cubic.easeOut', onUpdate: () => { const n = Math.round(c.v); if (n !== shown) { shown = n; amt.setText(`+${fmtCoins(n)}`); } },"],
]);
console.log('ok');
