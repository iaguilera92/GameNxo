// Prueba rápida (23-11-2026): kits del 2v2 contra bots y posición del compañero. Se compila con esbuild y se corre con node.
import { randomDoublesKits } from '../frontend/src/ai/botKit';
import { itemRarity } from '../frontend/src/domain/shopCatalog';
import { coverY } from '../frontend/src/ai/doublesPositioning';

let bad = 0;
for (let i = 0; i < 2000; i++) {
  const kits = randomDoublesKits(['nxo', 'mai', 'nxo'], { smash: 'fire', inferno: 'ice', defensive: 'dash' });
  for (const k of ['smash', 'inferno', 'defensive'] as const) {
    const ids = kits.map((x) => x[k]);
    if (new Set(ids).size !== ids.length) bad++, console.log('repetido', k, ids);
    for (const id of ids) if (itemRarity(`${k}:${id}`) === 'legendaria') bad++, console.log('legendaria', k, id);
  }
  if (kits.some((x) => x.smash === 'fire' || x.inferno === 'ice' || x.defensive === 'dash')) bad++, console.log('igual al jugador', kits);
}
console.log('kits: 2000 sorteos,', bad ? `${bad} errores` : 'sin errores');
console.log('ejemplo:', JSON.stringify(randomDoublesKits(['nxo', 'mai', 'nxo'], { smash: 'fire' }).map(({ smash, inferno, defensive }) => ({ smash, inferno, defensive }))));

// posición: cancha de dobles 158..662
const lane = { top: 158, bottom: 662 };
for (const [mate, ball] of [[170, 410], [410, 410], [640, 600], [300, 200], [650, 410]]) {
  const c = coverY(mate, ball, lane, 0);
  console.log(`compañero en ${mate}, pelota en ${ball} -> cubre en ${Math.round(c.y)} (separación ${Math.round(Math.abs(c.y - mate))})`);
}
