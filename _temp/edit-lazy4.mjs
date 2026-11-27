import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/objects/NxoActor.ts',[
["export function loadBackViewLater(scene: Phaser.Scene) {\n  const skin = (scene.registry.get('profileSkin') as string | undefined) ?? currentSkin();\n", "export function loadBackViewLater(scene: Phaser.Scene, skin: string) {\n"],
]);
apply('frontend/src/scenes/CustomizeScene.ts',[["    loadBackViewLater(this);", "    loadBackViewLater(this, getProfile().skin);"]]);
apply('frontend/src/scenes/ShopScene.ts',[["    loadBackViewLater(this); //", "    loadBackViewLater(this, getProfile().skin); //"]]);
let s=fs.readFileSync('frontend/src/scenes/ShopScene.ts','utf8');
if(!/import \{[^}]*\bgetProfile\b[^}]*\} from '..\/logic\/Profile'/.test(s)) { s=s.replace("import { setDefensive } from '../logic/Profile';","import { getProfile, setDefensive } from '../logic/Profile';"); fs.writeFileSync('frontend/src/scenes/ShopScene.ts',s); }
// Onboarding: precarga en segundo plano del personaje tocado
apply('frontend/src/scenes/OnboardingScene.ts',[
["          selected = r.id;\n          draw();\n          info();", "          selected = r.id;\n          draw();\n          info();\n          // (26-11-2026) se empieza a cargar ya su sprite de frente (el del menú): al confirmar, el menú entra sin esperar\n          queueNxoSpriteLoads(this.load, sheetsOf([[r.id, 'front']]));\n          if (this.load.list.size && !this.load.isLoading()) this.load.start();"],
["import type { SkinId } from '../characters/skins';", "import type { SkinId } from '../characters/skins';\nimport { queueNxoSpriteLoads, sheetsOf } from '../objects/NxoActor';"],
]);
console.log('ok');
