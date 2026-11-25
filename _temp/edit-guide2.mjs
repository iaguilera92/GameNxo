import fs from 'fs';
const f='frontend/src/scenes/MatchmakingScene.ts';
let s=fs.readFileSync(f,'utf8');
const o=`      const rk0 = !!this.rankedBet || this.unranked;
      void rk0;
`;
if(s.split(o).length!==2) throw 'nf';
s=s.replace(o,'');fs.writeFileSync(f,s);console.log('ok');
