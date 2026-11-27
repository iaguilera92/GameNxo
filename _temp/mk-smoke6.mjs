import fs from 'fs';
let s = fs.readFileSync('_temp/smoke5.mjs', 'utf8');
const i = s.indexOf("await ev(\"window.__lt = []"), j = s.indexOf('console.log(logs.slice');
const body = `
await go('Ranked', {}, 6000);
const tw = "window.__game.scene.getScene('Ranked').tweens.getTweens().length";
const fps = "new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); }; requestAnimationFrame(f); })";
console.log('tweens al entrar:', await ev(tw), '| fps:', await ev(fps));
for (let k = 0; k < 6; k++) await ev("(() => { const sc = window.__game.scene.getScene('Ranked'); sc.setTab(sc.tab === '2v2' ? '1v1' : '2v2'); return 1; })()");
await sleep(1500);
console.log('tweens tras 6 cambios de pesta?a:', await ev(tw));
const fake = "{ week: '2026-11-23', league: 'gold', eligible: true, coins: 120, rays: 1, cash: 5, wins: 4, net: 30, position: 6, positionLabel: '' }";
for (let k = 0; k < 3; k++) {
  await ev(\`(() => { window.__game.scene.getScene('Ranked').showWeekly(\${fake}); return 1; })()\`);
  await sleep(1200);
  await ev(\`(() => { window.__game.scene.getScene('Ranked').showSeasonChest(\${fake}, false); return 1; })()\`);
  await sleep(1500);
  const f = await ev(fps);
  await ev("(() => { window.__game.scene.getScene('Ranked').closeOverlay(); return 1; })()");
  await sleep(800);
  console.log('cofre #' + (k + 1), '| fps con el cofre:', f, '| tweens tras cerrarlo:', await ev(tw));
}
`;
fs.writeFileSync('_temp/smoke6.mjs', s.slice(0, i) + body + s.slice(j));
