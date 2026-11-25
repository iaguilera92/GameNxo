import fs from 'fs';
for (const n of ['RankedScene', 'ShopScene', 'BattlePassScene', 'CustomizeScene']) {
  const f = `frontend/src/scenes/${n}.ts`;
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const o = '  preload() {\n';
  if (s.split(o).length !== 2) throw new Error(n + ' preload');
  s = s.replace(o, o + '    releaseSceneTexturesOnExit(this); // (25-11-2026) sus imágenes propias se liberan al salir (ui/sceneTextures.ts)\n');
  // import tras el primer import
  const i = s.indexOf('\n', s.indexOf('import '));
  s = s.slice(0, i + 1) + "import { releaseSceneTexturesOnExit } from '../ui/sceneTextures';\n" + s.slice(i + 1);
  fs.writeFileSync(f, s);
}
console.log('ok');
