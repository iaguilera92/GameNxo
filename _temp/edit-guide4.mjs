import fs from 'fs';
const f='frontend/src/scenes/MatchScene.ts';let s=fs.readFileSync(f,'utf8');
const o="this.guideFeed(this.guideZoneRect(Math.max(1, r.k), r.k === 0 ? 1 : undefined));";
if(s.split(o).length!==2)throw 'nf';
s=s.replace(o,"this.guideFeed(r.k === 0 ? this.guideZoneRect(0, 1) : this.guideZoneRect(r.k));");
fs.writeFileSync(f,s);console.log('ok');
