import fs from 'fs';
let s = fs.readFileSync('_temp/smoke6.mjs', 'utf8');
s = s.replace("console.log('cofre #' + (k + 1)", "console.log('antes de prune manual', await ev(tw), 'tiene prune:', await ev(\"typeof window.__game.scene.getScene('Ranked').pruneDeadTweens\"), await ev(\"(() => { const sc = window.__game.scene.getScene('Ranked'); const t = sc.tweens.getTweens().find(t => (t.targets||[])[0]?.type === 'Text'); if (!t) return 'sin'; const x = t.targets[0]; return JSON.stringify({ hasType: 'type' in x, scene: String(x.scene), len: t.targets.length }); })()\")); await ev(\"window.__game.scene.getScene('Ranked').pruneDeadTweens(), 1\"); console.log('despues', await ev(tw)); console.log('cofre #' + (k + 1)");
fs.writeFileSync('_temp/smoke6c.mjs', s);
