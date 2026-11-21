const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.includes(b)) continue; // ya aplicado
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 60) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}
edit('domain/migrate.ts', [
  ["import { sanitizeCoins2v2 } from './coins2v2';", "import { sanitizeCoins2v2 } from './coins2v2';\nimport { sanitizeLeague2v2 } from './league2v2State';"],
  ["  if (c2) s.coins2v2 = c2;", "  if (c2) s.coins2v2 = c2;\n  const l2 = sanitizeLeague2v2(r.league2v2); // LIGA 2v2 (domain/league2v2.ts)\n  if (l2) s.league2v2 = l2;"],
  ["    if (isFrameId(eq.frame)) s.equipped.frame = eq.frame;", "    if (isFrameId(eq.frame)) s.equipped.frame = eq.frame;\n    if (isFrameId(eq.frame2v2)) s.equipped.frame2v2 = eq.frame2v2; // marco 2v2 (se muestra solo si la liga 2v2 ya se alcanzó)"],
]);
