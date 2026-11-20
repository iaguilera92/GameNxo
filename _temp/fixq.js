const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const map = [
  ['compa?ero', 'compa\u00f1ero'],
  ['M?S', 'M\u00c1S'],
  ['c?rculo', 'c\u00edrculo'],
  ['t?]', 't\u00fa]'],
  ['qui?n', 'qui\u00e9n'],
  ['peg?', 'peg\u00f3'],
  ['m?s cercano', 'm\u00e1s cercano'],
  ['cu?ntas', 'cu\u00e1ntas'],
  ['transl?cido', 'transl\u00facido'],
  ['desliz?ndose', 'desliz\u00e1ndose'],
  ['cu?l de', 'cu\u00e1l de'],
  ['rev?s', 'rev\u00e9s'],
  ["'MONEDAS 2V2 ? x2'", "'MONEDAS 2V2 \u00b7 x2'"],
  ['`? ${pts} PTS`', '`\u2605 ${pts} PTS`'],
];
for (const f of ['scenes/MatchEndScene.ts', 'scenes/MatchScene.ts', 'scenes/ShopScene.ts', 'domain/shopGift.ts', 'fx/matchEnd.ts', 'fx/matchFinale.ts', 'domain/shopCatalog.ts']) {
  let s = fs.readFileSync(base + f, 'utf8');
  let n = 0;
  for (const [a, b] of map) {
    const k = s.split(a).length - 1;
    if (k) { s = s.split(a).join(b); n += k; }
  }
  fs.writeFileSync(base + f, s);
  console.log(f, n);
}
