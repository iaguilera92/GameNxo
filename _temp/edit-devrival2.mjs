import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
["rival2Name?: string; duo?: DoublesSkins;", "rival2Name?: string; duo?: DoublesSkins; rivalSkin?: string;"],
["    this.duo = this.doubles && !n2 ? data?.duo ?? doublesSkinsFor(getProfile().skin) : null;", "    this.duo = this.doubles && !n2 ? data?.duo ?? doublesSkinsFor(getProfile().skin) : null;\n    // (25-11-2026, usuario) 1v1 contra el bot con el modo desarrollo: el rival elegido al azar en la búsqueda\n    this.rivalPick = !this.doubles && !data?.net ? data?.rivalSkin ?? null : null;"],
["  private duo: DoublesSkins | null = null;", "  private duo: DoublesSkins | null = null;\n  /** (25-11-2026) rival del 1v1 elegido por la búsqueda (modo desarrollo: al azar); null = rivalFor */\n  private rivalPick: string | null = null;"],
["    if (this.duo) return lookForSkin(this.duo.rival1, 'front', getProfile().skin); // (25-11-2026) 2v2 contra bots", "    if (this.duo) return lookForSkin(this.duo.rival1, 'front', getProfile().skin); // (25-11-2026) 2v2 contra bots\n    if (this.rivalPick) return lookForSkin(this.rivalPick, 'front', getProfile().skin);"],
["        botName: this.botName,\n        rivalLevel: this.rivalLevel,", "        botName: this.botName,\n        rivalLevel: this.rivalLevel,\n        rivalSkin: this.rivalPick ?? undefined, // (25-11-2026) la revancha, con el mismo rival"],
]);
apply('frontend/src/scenes/MatchEndScene.ts',[
["  rivalLevel?: number;", "  rivalLevel?: number;\n  /** (25-11-2026) rival del 1v1 elegido por la búsqueda (modo desarrollo); la revancha lo repite */\n  rivalSkin?: string;"],
[": { botName: d.botName, rivalLevel: d.rivalLevel });", ": { botName: d.botName, rivalLevel: d.rivalLevel, rivalSkin: d.rivalSkin });"],
]);
console.log('ok');

