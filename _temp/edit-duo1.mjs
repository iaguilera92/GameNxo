import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
// catálogo
apply('frontend/src/characters/catalog.ts',[
["/** Hoja de animaciones de un personaje en una vista,", `/** (25-11-2026, usuario) personajes del 2v2 contra bots: tu compañero (de espaldas) y los dos rivales (de frente) */
export type DoublesSkins = { ally: SkinId; rival1: SkinId; rival2: SkinId };
/**
 * (25-11-2026, usuario) 2v2 contra bots con VARIEDAD: tu compañero y los dos rivales son tres personajes DISTINTOS entre sí y del tuyo, al
 * azar en cada partido. Si no alcanzan (pocos personajes con arte), se repiten: primero el rival 2 pasa a ser tu personaje de frente
 * (como antes) y, con un solo personaje más, compañero y rival 1 son ese.
 */
export function doublesSkinsFor(playerId: string | undefined, rnd: () => number = Math.random): DoublesSkins {
  const pool = CATALOG.filter((s) => s.sheets.front && s.id !== playerId).map((s) => s.id as SkinId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const me = (CATALOG.find((s) => s.id === playerId)?.id ?? 'nxo') as SkinId;
  const other = pool[0] ?? rivalFor(playerId);
  return { ally: pool[1] ?? other, rival1: other, rival2: pool[2] ?? me };
}

/** Hoja de animaciones de un personaje en una vista,`],
]);
// búsqueda (VS)
apply('frontend/src/scenes/MatchmakingScene.ts',[
["import { rivalFor, skinById, tutorialRivalFor } from '../characters/catalog';", "import { type DoublesSkins, doublesSkinsFor, rivalFor, skinById, tutorialRivalFor } from '../characters/catalog';"],
["    {\n      // 2v2: el aliado y el rival 1 llevan el otro personaje (rivalFor); el rival 2, el tuyo (como en el partido y en la VS)\n      const skin = getProfile().skin;\n      this.allyName = charName(rivalFor(skin));\n      this.rival2Name = charName(skin);\n    }",
 "    {\n      // (25-11-2026, usuario) 2v2: compañero y rivales, tres personajes distintos al azar (doublesSkinsFor); se pasan al partido\n      const skin = getProfile().skin;\n      this.duo = doublesSkinsFor(skin);\n      this.allyName = charName(this.duo.ally);\n      this.rival2Name = charName(this.duo.rival2);\n    }"],
["  private rival2Name = 'Rival 2';", "  private rival2Name = 'Rival 2';\n  /** (25-11-2026) personajes del 2v2 (compañero y los dos rivales) */\n  private duo: DoublesSkins = { ally: 'mai', rival1: 'mai', rival2: 'nxo' };"],
["[this.rival1Skin(), 'front'], ...(this.doubles ? [[rivalFor(me), 'back'] as [string, 'back']] : [])]", "[this.rival1Skin(), 'front'], ...(this.doubles ? [[this.duo.ally, 'back'], [this.duo.rival2, 'front']] as [string, 'back' | 'front'][] : [])]"],
["            mateSkin: rivalFor(p.skin),\n            rivals: [rivalFor(p.skin), p.skin],", "            mateSkin: this.duo.ally,\n            rivals: [this.duo.rival1, this.duo.rival2],"],
["              mate: { name: this.allyName, level: p.level, look: rivalLook(p.skin) },\n              rival1: { name: botName, level: rivalLevel, look: rivalLook(p.skin) },\n              rival2: { name: this.rival2Name, level: rivalLevel, look: rivalLook(p.skin) },",
 "              mate: { name: this.allyName, level: p.level, look: lookForSkin(this.duo.ally, 'front', p.skin) },\n              rival1: { name: botName, level: rivalLevel, look: lookForSkin(this.duo.rival1, 'front', p.skin) },\n              rival2: { name: this.rival2Name, level: rivalLevel, look: lookForSkin(this.duo.rival2, 'front', p.skin) },"],
["mode: '2v2', allyName: this.allyName, rival2Name: this.rival2Name } : { botName, rivalLevel, ambiente: this.ambiente,", "mode: '2v2', allyName: this.allyName, rival2Name: this.rival2Name, duo: this.duo } : { botName, rivalLevel, ambiente: this.ambiente,"],
["    return !this.doubles && isTutorialMatch(p.level, isDevMode(), false) ? tutorialRivalFor(skin, p.level) : rivalFor(skin);", "    if (this.doubles) return this.duo.rival1;\n    return isTutorialMatch(p.level, isDevMode(), false) ? tutorialRivalFor(skin, p.level) : rivalFor(skin);"],
]);
console.log('ok');
