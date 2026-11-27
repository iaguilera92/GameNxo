import fs from 'fs';
let s = fs.readFileSync('_temp/smoke6c.mjs', 'utf8');
s = s.replace("await ev(\"window.__game.scene.getScene('Ranked').pruneDeadTweens(), 1\");", "console.log('dbg', await ev(\"(() => { const sc = window.__game.scene.getScene('Ranked'); const t = sc.tweens.getTweens().find(t => (t.targets||[])[0]?.type === 'Text'); const tg = t.targets ?? t.currentTween?.targets ?? t.data?.[0]?.targets ?? []; const dead = (x) => !!x && typeof x === 'object' && 'type' in x && !x.scene; const r = { hasParent: !!t.parent, processing: sc.tweens.processing, tgLen: tg.length, every: tg.every(dead), state: t.state }; t.remove(); r.after = sc.tweens.getTweens().length; return JSON.stringify(r); })()\"));");
fs.writeFileSync('_temp/smoke6d.mjs', s);
