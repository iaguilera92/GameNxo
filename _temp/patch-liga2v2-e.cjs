const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.includes(b)) continue;
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 60) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}
edit('scenes/MenuScene.ts', [
  ["import { rank2v2 } from '../domain/league2v2';", "import { leagueView2v2 } from '../logic/League2v2';"],
  [
    "      const total2 = Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0) - this.hold2v2); // (21-11-2026) menos lo que aún no llegó (playCoins2v2)\n      const rk2 = rank2v2(total2);",
    "      // LIGA 2V2 (21-11-2026): igual que la liga normal, el NETO de la semana en MONEDAS 2v2 hacia la meta de ascenso (domain/league2v2.ts)\n      const v2 = leagueView2v2();\n      const net2 = Math.max(0, v2.weekNet - this.hold2v2); // menos lo que aún no llegó (playCoins2v2)",
  ],
  [
    "      const prog = m2 ? (rk2.next ? Math.max(0, Math.min(1, (total2 - rk2.from) / (rk2.next.from - rk2.from))) : 1) : r.target == null || r.promoting ? 1 : Math.max(0, Math.min(1, net / r.target));\n      const full = m2 ? !rk2.next : r.promoting;",
    "      const tgt = m2 ? v2.target : r.target;\n      const prog = tgt == null || (m2 ? v2.promoting : r.promoting) ? 1 : Math.max(0, Math.min(1, (m2 ? net2 : net) / tgt));\n      const full = m2 ? v2.promoting : r.promoting;",
  ],
  [
    "bar.fillStyle(full ? 0x2fbf6a : m2 ? 0x7a3dff : 0x1f6bff, 1).fillRoundedRect(tx, by, fw, bh, bh / 2);\n        bar.fillStyle(full ? 0x7ff0a8 : m2 ? 0xb98aff : 0x5fa8ff, 1)",
    "// (21-11-2026, usuario) barra de la liga normal AMARILLA (como JUGAR) y la de la liga 2v2 MORADA\n        bar.fillStyle(full ? 0x2fbf6a : m2 ? 0x7a3dff : 0xffcc1f, 1).fillRoundedRect(tx, by, fw, bh, bh / 2);\n        bar.fillStyle(full ? 0x7ff0a8 : m2 ? 0xb98aff : 0xffe55a, 1)",
  ],
  ["const shown = m2 ? total2 : net;", "const shown = m2 ? net2 : net;"],
  ["bar.lineStyle(2, m2 ? 0x4a2a8a : 0x2a4a8a, 1).strokeRoundedRect(tx, by, tw, bh, bh / 2);", "bar.lineStyle(2, m2 ? 0x4a2a8a : 0x8a6a1a, 1).strokeRoundedRect(tx, by, tw, bh, bh / 2);"],
  ["const accent = m2 ? 0xb06bff : 0x3a7bff;", "const accent = m2 ? 0xb06bff : 0x3a7bff;"],
]);
edit('ui/PlayEntry2v2.ts', [
  ["import { rank2v2 } from '../domain/league2v2';", "import { league2v2Of } from '../domain/league2v2';"],
  ["rankDef(rank2v2(Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0))).id).name.toUpperCase();", "rankDef(league2v2Of(getPlayer())).name.toUpperCase();"],
  ["export const league2v2Id = (): RankId => rank2v2(Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0))).id;", "export const league2v2Id = (): RankId => league2v2Of(getPlayer());"],
]);
