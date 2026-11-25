import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const MINE = "sheetsOf([[getProfile().skin, 'back'], [getProfile().skin, 'front']])";
apply('frontend/src/scenes/BootScene.ts',[
["import { queueNxoSpriteLoads, registerNxoAnims } from '../objects/NxoActor';", "import { queueNxoSpriteLoads, registerNxoAnims, sheetsOf } from '../objects/NxoActor';\nimport { getProfile } from '../logic/Profile';"],
["    queueNxoSpriteLoads(this.load); // animaciones de NXO en el partido (si falta algo, se usa el dibujo de siempre)", `    // (25-11-2026) solo TU personaje (de espaldas y de frente): el rival se carga al ir al partido (si falta algo, se usa el dibujo de siempre)\n    queueNxoSpriteLoads(this.load, ${MINE});`],
]);
apply('frontend/src/scenes/MenuScene.ts',[
["import { getProfile, levelProgress } from '../logic/Profile';", "import { getProfile, levelProgress } from '../logic/Profile';\nimport { queueNxoSpriteLoads, registerNxoAnims, releaseCharacterSprites, sheetsOf } from '../objects/NxoActor';"],
["  preload() {\n    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');\n    if (!this.textures.exists('guide-click'))", `  preload() {\n    queueNxoSpriteLoads(this.load, ${MINE}); // (25-11-2026) tu personaje (p. ej. recién elegido o cambiado)\n    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');\n    if (!this.textures.exists('guide-click'))`],
["  create() {\n    const W = this.scale.width;\n    const H = this.scale.height;", `  create() {\n    // (25-11-2026, usuario) los personajes del partido que terminó se liberan (solo queda el tuyo); nunca con un partido abierto\n    registerNxoAnims(this);\n    const busy = ['Match', 'MatchEnd'].some((k) => this.scene.isActive(k) || this.scene.isPaused(k) || this.scene.isSleeping(k));\n    if (!busy) releaseCharacterSprites(this, ${MINE});\n    const W = this.scale.width;\n    const H = this.scale.height;`],
]);
apply('frontend/src/scenes/CustomizeScene.ts',[
["import { skinById } from '../characters/catalog';", "import { skinById } from '../characters/catalog';\nimport { queueNxoSpriteLoads, registerNxoAnims, sheetsOf } from '../objects/NxoActor';"],
["  preload() {\n    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');", `  preload() {\n    queueNxoSpriteLoads(this.load, ${MINE}); // (25-11-2026) tu personaje (al cambiarlo, la escena se reinicia y lo carga)\n    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');`],
["  create() {\n    const W = this.scale.width;", "  create() {\n    registerNxoAnims(this);\n    const W = this.scale.width;"],
]);
apply('frontend/src/scenes/MatchmakingScene.ts',[
["import { getProfile } from '../logic/Profile';", "import { getProfile } from '../logic/Profile';\nimport { queueNxoSpriteLoads, registerNxoAnims, sheetsOf } from '../objects/NxoActor';"],
["  preload() {\n    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');\n    if (this.rankedBet", "  preload() {\n    // (25-11-2026) los personajes del partido: el rival de frente (y en el 2v2 tu compañero de espaldas); el partido los usa ya cargados\n    const me = getProfile().skin;\n    queueNxoSpriteLoads(this.load, sheetsOf([[me, 'back'], [me, 'front'], [this.rival1Skin(), 'front'], ...(this.doubles ? [[rivalFor(me), 'back'] as [string, 'back']] : [])]));\n    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');\n    if (this.rankedBet"],
]);
let mm=fs.readFileSync('frontend/src/scenes/MatchmakingScene.ts','utf8');
const ci=mm.indexOf('  create() {\n');
if(ci<0) throw 'mm create';
mm=mm.slice(0,ci)+'  create() {\n    registerNxoAnims(this);\n'+mm.slice(ci+'  create() {\n'.length);
fs.writeFileSync('frontend/src/scenes/MatchmakingScene.ts',mm);
apply('frontend/src/scenes/MatchScene.ts',[
["import { ensureLooseRacket } from '../objects/NxoActor';", "import { ensureLooseRacket, queueNxoSpriteLoads, registerNxoAnims, sheetsOf } from '../objects/NxoActor';"],
["  preload() {\n    queueEmoteArt(this.load);", "  preload() {\n    // (25-11-2026, usuario) SOLO los personajes de este partido: tú (espaldas y frente, el frente en el resultado), el rival de frente, el\n    // rival online y, en el 2v2, tu compañero de espaldas (el 2.º rival es tu personaje de frente). Al volver al menú se liberan.\n    const me = getProfile().skin;\n    const ally = this.net2 ? this.net?.opponent.skin : this.rivalSkin();\n    queueNxoSpriteLoads(this.load, sheetsOf([[me, 'back'], [me, 'front'], [this.rivalSkin(), 'front'], [this.vsOpp?.skin, 'front'], ...(this.doubles ? [[ally, 'back'] as [string | undefined, 'back']] : [])]));\n    queueEmoteArt(this.load);"],
]);
let ms=fs.readFileSync('frontend/src/scenes/MatchScene.ts','utf8');
const mi=ms.indexOf('  create() {\n    // estado (la escena se reutiliza en revanchas)');
if(mi<0) throw 'match create';
ms=ms.slice(0,mi)+'  create() {\n    registerNxoAnims(this); // (25-11-2026) animaciones de los personajes recién cargados (preload)\n'+ms.slice(mi+'  create() {\n'.length);
fs.writeFileSync('frontend/src/scenes/MatchScene.ts',ms);
console.log('ok');
