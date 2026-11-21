const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
let s = fs.readFileSync(base + 'scenes/RankedScene.ts', 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');
function rep(a, b) {
  if (s.split(a).length !== 2) throw new Error('x' + (s.split(a).length - 1) + ': ' + a.slice(0, 80));
  s = s.replace(a, () => b);
}
rep("    preloadRankBadges(this.load); // todas: tabla de líderes y lista de ligas",
  "    preloadRankBadges(this.load); // todas: tabla de líderes y lista de ligas\n    preloadRankBadges(this.load, undefined, true); // y los emblemas de la LIGA 2V2 (assets/<liga>-2v2.webp)\n    if (!this.textures.exists('coin-2v2')) this.load.image('coin-2v2', 'assets/moneda-2v2.webp'); // moneda de la liga 2v2");
rep("{ rank: v.league, level: 99, size: 168, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen:",
  "{ rank: v.league, level: 99, size: 168, doubles: is2, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen:");
rep("new RankBadge(this, -pw / 2 + 64, y, { rank: r.id, level: 99, size: 76 })", "new RankBadge(this, -pw / 2 + 64, y, { rank: r.id, level: 99, size: 76, doubles: is2 })");
rep("new RankBadge(this, cx, cy, { rank: from, level: 99, size: 180 })", "new RankBadge(this, cx, cy, { rank: from, level: 99, size: 180, doubles: two })");
rep("new RankBadge(this, cx, cy, { rank: to, level: 99, size: 260 })", "new RankBadge(this, cx, cy, { rank: to, level: 99, size: 260, doubles: two })");
rep("new RankBadge(this, -120, -40, { rank: from, level: 99, size: 150 })", "new RankBadge(this, -120, -40, { rank: from, level: 99, size: 150 })");
rep("{ rank: w.league, level: 99, size: 170, position: w.league === 'challenger' ? (w.position ?? undefined) : undefined })", "{ rank: w.league, level: 99, size: 170, doubles: two, position: w.league === 'challenger' ? (w.position ?? undefined) : undefined })");
fs.writeFileSync(base + 'scenes/RankedScene.ts', s.replace(/\n/g, nl));
