import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n,all] of ed){const c=s.split(o).length-1;if(c<1||(c>1&&!all))throw new Error(f+' nf '+o.slice(0,60)+' '+c);s=s.split(o).join(n);}fs.writeFileSync(f,s);}
// A) no liberar al reiniciar la escena
const T='frontend/src/ui/sceneTextures.ts';
apply(T,[
["export function releaseSceneTexturesOnExit(scene: Phaser.Scene) {\n  const own = new Set<string>();",
 "/** imágenes propias de cada pantalla (por clave de escena): se conservan entre reinicios y se liberan al salir de verdad */\nconst OWN = new Map<string, Set<string>>();\n/** pantallas que se están REINICIANDO (p. ej. PERSONALIZAR al cambiar de personaje): no liberan nada (antes recargaban ~27 imágenes, 1,6 s) */\nconst RESTARTING = new Set<string>();\n/** (26-11-2026) llamar justo antes de `this.scene.restart()` en una pantalla que usa releaseSceneTexturesOnExit */\nexport function markSceneRestart(scene: Phaser.Scene) {\n  RESTARTING.add(scene.scene.key);\n}\n\nexport function releaseSceneTexturesOnExit(scene: Phaser.Scene) {\n  const sk = scene.scene.key;\n  const own = OWN.get(sk) ?? new Set<string>();\n  OWN.set(sk, own);"],
["    scene.load.off(Phaser.Loader.Events.FILE_LOAD, onLoad);\n    if (!own.size) return;",
 "    scene.load.off(Phaser.Loader.Events.FILE_LOAD, onLoad);\n    if (RESTARTING.delete(sk)) return; // reinicio: la misma pantalla vuelve enseguida y las usa\n    OWN.delete(sk);\n    if (!own.size) return;"],
]);
// B) Customize
const C='frontend/src/scenes/CustomizeScene.ts';
apply(C,[
["this.scene.restart();", "markSceneRestart(this);\n    this.scene.restart();", true],
["queueNxoSpriteLoads(this.load, sheetsOf([[getProfile().skin, 'back'], [getProfile().skin, 'front']])); // (25-11-2026) tu personaje (al cambiarlo, la escena se reinicia y lo carga)",
 "// (26-11-2026) solo tu personaje DE FRENTE (el que se ve aquí): el de espaldas (las demos EN ACCIÓN) se carga después, sin frenar la pantalla\n    queueNxoSpriteLoads(this.load, sheetsOf([[getProfile().skin, 'front']]));"],
["  create() {\n    registerNxoAnims(this);", "  create() {\n    registerNxoAnims(this);\n    loadBackViewLater(this);"],
["import { releaseSceneTexturesOnExit } from '../ui/sceneTextures';", "import { markSceneRestart, releaseSceneTexturesOnExit } from '../ui/sceneTextures';"],
["import { queueNxoSpriteLoads, registerNxoAnims, sheetsOf } from '../objects/NxoActor';", "import { loadBackViewLater, queueNxoSpriteLoads, registerNxoAnims, sheetsOf } from '../objects/NxoActor';"],
]);
// Menu y Boot: solo de frente
apply('frontend/src/scenes/MenuScene.ts',[
["    queueNxoSpriteLoads(this.load, sheetsOf([[getProfile().skin, 'back'], [getProfile().skin, 'front']])); // (25-11-2026) tu personaje (p. ej. recién elegido o cambiado)",
 "    queueNxoSpriteLoads(this.load, sheetsOf([[getProfile().skin, 'front']])); // (26-11-2026) tu personaje DE FRENTE (el del menú); el de espaldas, en la búsqueda / PERSONALIZAR"],
]);
apply('frontend/src/scenes/BootScene.ts',[
["    queueNxoSpriteLoads(this.load, sheetsOf([[getProfile().skin, 'back'], [getProfile().skin, 'front']]));",
 "    queueNxoSpriteLoads(this.load, sheetsOf([[getProfile().skin, 'front']])); // (26-11-2026) solo de frente: el arranque carga la mitad"],
]);
// Shop: espaldas en segundo plano (demos)
const S='frontend/src/scenes/ShopScene.ts';
let sh=fs.readFileSync(S,'utf8').replace(/\r\n/g,'\n');
const ci=sh.indexOf('  create() {\n');
if(ci<0) throw 'shop create';
sh=sh.slice(0,ci)+'  create() {\n    loadBackViewLater(this); // (26-11-2026) tu personaje de espaldas para las demos EN ACCIÓN, sin frenar la pantalla\n'+sh.slice(ci+'  create() {\n'.length);
const ii=sh.indexOf('\n', sh.indexOf('import '));
sh=sh.slice(0,ii+1)+"import { loadBackViewLater } from '../objects/NxoActor';\n"+sh.slice(ii+1);
fs.writeFileSync(S,sh);
// NxoActor: helper
apply('frontend/src/objects/NxoActor.ts',[
["/** (25-11-2026) Libera de la memoria las hojas que NO estén en `keep`",
 "/**\n * (26-11-2026) Tu personaje DE ESPALDAS, en segundo plano (llamar en el create): lo usan las demos EN ACCIÓN de PERSONALIZAR y la Tienda.\n * Antes se cargaba junto con el de frente antes de mostrar la pantalla y frenaba el cambio de personaje (~2-4 s).\n */\nexport function loadBackViewLater(scene: Phaser.Scene) {\n  const skin = (scene.registry.get('profileSkin') as string | undefined) ?? currentSkin();\n  queueNxoSpriteLoads(scene.load, sheetsOf([[skin, 'back']]));\n  if (!scene.load.list.size) return;\n  scene.load.once(Phaser.Loader.Events.COMPLETE, () => scene.sys.isActive() && registerNxoAnims(scene));\n  scene.load.start();\n}\n\n/** (25-11-2026) Libera de la memoria las hojas que NO estén en `keep`"],
]);
console.log('ok');
