import fs from 'fs';
let s = fs.readFileSync('_temp/smoke6c.mjs', 'utf8');
s = s.replace("await ev(\"window.__game.scene.getScene('Ranked').pruneDeadTweens(), 1\");", "console.log('prune:', await ev(\"(() => { try { const sc = window.__game.scene.getScene('Ranked'); sc.pruneDeadTweens(); return 'ok ' + sc.tweens.getTweens().length + ' ' + sc.pruneDeadTweens.toString().slice(0, 600); } catch (e) { return 'ERR ' + e.message; } })()\"));");
fs.writeFileSync('_temp/smoke6e.mjs', s);
