import fs from 'fs';
let s = fs.readFileSync('_temp/smoke6.mjs', 'utf8');
s = s.replace("console.log('cofre #' + (k + 1)", "console.log(await ev(\"JSON.stringify(window.__game.scene.getScene('Ranked').tweens.getTweens().map(t => ({ cls: t.constructor.name, isChain: !!t.isTweenChain, n: (t.targets||[]).length, tg: (t.targets||t.currentTween?.targets||t.data?.[0]?.targets||[]).map(x => x && (x.type || typeof x) + ':' + (x.scene ? 'vivo' : 'muerto')), data: (t.data||[]).length })))\")); console.log('cofre #' + (k + 1)");
fs.writeFileSync('_temp/smoke6b.mjs', s);
