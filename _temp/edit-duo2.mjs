import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
["import { tutorialRivalFor } from '../characters/catalog';", "import { type DoublesSkins, doublesSkinsFor, tutorialRivalFor } from '../characters/catalog';"],
["  private rival2Name = 'Rival 2';", "  private rival2Name = 'Rival 2';\n  /** (25-11-2026, usuario) 2v2 contra bots: personajes del compañero y de los dos rivales (los elige la búsqueda: doublesSkinsFor) */\n  private duo: DoublesSkins | null = null;"],
["  init(data: { botName?: string; rivalLevel?: number; net?: MatchNet; ambiente?: string; mode?: '2v2'; allyName?: string; rival2Name?: string;", "  init(data: { botName?: string; rivalLevel?: number; net?: MatchNet; ambiente?: string; mode?: '2v2'; allyName?: string; rival2Name?: string; duo?: DoublesSkins;"],
["    this.allyName = data?.allyName ?? 'Aliado';\n    this.rival2Name = data?.rival2Name ?? 'Rival 2';", "    this.allyName = data?.allyName ?? 'Aliado';\n    this.rival2Name = data?.rival2Name ?? 'Rival 2';\n    // 2v2 contra bots: los personajes de la búsqueda (si no llegan, p. ej. desde otra pantalla, se sortean aquí)\n    this.duo = this.doubles && !n2 ? data?.duo ?? doublesSkinsFor(getProfile().skin) : null;"],
// preload: cargar compañero y rival 2
["    const ally = this.net2 ? this.net?.opponent.skin : this.rivalSkin();", "    const ally = this.net2 ? this.net?.opponent.skin : this.duo?.ally ?? this.rivalSkin();"],
["...(this.doubles ? [[ally, 'back'] as [string | undefined, 'back']] : [])]));", "...(this.doubles ? [[ally, 'back'], [this.rival2Skin(), 'front']] as [string | undefined, 'back' | 'front'][] : [])]));"],
// kits
["      const [k1, k2, ka] = randomDoublesKits([this.rivalSkin(), pf.skin, this.rivalSkin()],", "      const [k1, k2, ka] = randomDoublesKits([this.rivalSkin(), this.rival2Skin(), this.duo?.ally ?? this.rivalSkin()],"],
["        this.rivalKits = [botKitFor(this.rivalSkin()), botKitFor(pf.skin)];\n        this.allyKit = botKitFor(this.rivalSkin());", "        this.rivalKits = [botKitFor(this.rivalSkin()), botKitFor(this.rival2Skin())];\n        this.allyKit = botKitFor(this.duo?.ally ?? this.rivalSkin());"],
// actores
["      const otherSkin = this.net2 ? this.net!.opponent.skin : this.rivalSkin();", "      const otherSkin = this.net2 ? this.net!.opponent.skin : this.duo?.ally ?? this.rivalSkin();"],
["      const r2 = mk(lookForSkin(mySkin, 'front', mySkin), 'front', COURT.right + 40, -1);", "      const r2 = mk(lookForSkin(this.rival2Skin(), 'front', mySkin), 'front', COURT.right + 40, -1);"],
// rival1 y skinOf
["  private rivalLk() {\n    if (this.vsOpp) return lookForSkin(this.vsOpp.skin, 'front', getProfile().skin);", "  private rivalLk() {\n    if (this.vsOpp) return lookForSkin(this.vsOpp.skin, 'front', getProfile().skin);\n    if (this.duo) return lookForSkin(this.duo.rival1, 'front', getProfile().skin); // (25-11-2026) 2v2 contra bots"],
["    if (this.doubles && a === this.ally) return this.net2 ? this.net!.opponent.skin : this.rivalSkin();\n    if (this.doubles && this.rivalActors.indexOf(a) === 1) return getProfile().skin;", "    if (this.doubles && a === this.ally) return this.net2 ? this.net!.opponent.skin : this.duo?.ally ?? this.rivalSkin();\n    if (this.doubles && this.rivalActors.indexOf(a) === 1) return this.rival2Skin();"],
["  /** id del personaje rival (nxo, mai…) según rivalLk */", "  /** (25-11-2026) personaje del 2.º rival del 2v2: el de la búsqueda (contra bots) o el tuyo de frente (online, como antes) */\n  private rival2Skin(): string {\n    return this.duo?.rival2 ?? getProfile().skin;\n  }\n\n  /** id del personaje rival (nxo, mai…) según rivalLk */"],
// revancha
["doubles: { allyName: this.allyName, rival2Name: this.rival2Name }", "doubles: { allyName: this.allyName, rival2Name: this.rival2Name, duo: this.duo ?? undefined }"],
]);
apply('frontend/src/scenes/MatchEndScene.ts',[
["  doubles?: { allyName: string; rival2Name: string };", "  doubles?: { allyName: string; rival2Name: string; duo?: DoublesSkins };"],
["mode: '2v2', allyName: d.doubles.allyName, rival2Name: d.doubles.rival2Name }", "mode: '2v2', allyName: d.doubles.allyName, rival2Name: d.doubles.rival2Name, duo: d.doubles.duo }"],
]);
let me=fs.readFileSync('frontend/src/scenes/MatchEndScene.ts','utf8');
const i=me.indexOf('\n', me.indexOf('import '));
me=me.slice(0,i+1)+"import type { DoublesSkins } from '../characters/catalog';\n"+me.slice(i+1);
fs.writeFileSync('frontend/src/scenes/MatchEndScene.ts',me);
console.log('ok');
