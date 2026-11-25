import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const F='frontend/src/objects/NxoActor.ts';
let s=fs.readFileSync(F,'utf8').replace(/\r\n/g,'\n');
// reemplaza queueNxoSpriteLoads + queueBaseLoads completos
const a=s.indexOf('export function queueNxoSpriteLoads(load: Phaser.Loader.LoaderPlugin) {');
const b=s.indexOf('/** Raqueta suelta (misma paleta que la del sprite');
if(a<0||b<0||b<a) throw 'nf bloque';
const nw=`/** una tira cargable: clave (textura = animación), archivo, info de la animación y celda del grupo */
type StripEntry = { key: string; url: string; info: AnimInfo; group: { cell: { w: number; h: number } } };
/**
 * (25-11-2026) TODAS las tiras de un juego de hojas (una vista de un personaje): las de siempre (SHEETS), movimiento, extras,
 * golpes, ESPECIAL, ULTI y, para MAI de frente, la derrota y el pelotazo sueltos. Base de cargar y liberar por personaje.
 */
function sheetEntries(id: SheetId): StripEntry[] {
  const out: StripEntry[] = [];
  const sprites = skinMode() !== 'off';
  const c = CFGS[id];
  if (sprites && c) for (const a of NXO_ANIMS) out.push({ key: spriteKey(id, a), url: \`assets/characters/\${sheetDir(id)}/\${A(id)[a].file}\`, info: A(id)[a], group: c });
  const p = PACKS[id];
  if (sprites && p) {
    const at = (dir: string, info: AnimInfo) => \`assets/characters/\${dir}/\${info.file}\`;
    for (const a of Object.keys(p.move.animations) as MoveAnim[]) out.push({ key: moveKey(a, p.key), url: at(p.dir, p.move.animations[a]), info: p.move.animations[a], group: p.move });
    for (const [a, info] of extrasOf(p)) out.push({ key: extraKey(a, p.key), url: at(p.dir, info), info, group: p.extra });
    for (const a of HIT_ANIMS) out.push({ key: hitKey(a, p.key), url: at(p.dir, p.hits.animations[a]), info: p.hits.animations[a], group: p.hits });
    for (const a of Object.keys(p.special.animations) as SpecialAnim[]) out.push({ key: specialKey(a, p.key), url: at(p.dir, p.special.animations[a]), info: p.special.animations[a], group: p.special });
    out.push({ key: infernoKey(p.key), url: at(p.infDir, p.inf.animations['inferno-swing']), info: p.inf.animations['inferno-swing'], group: p.inf });
    for (const a of ULTI_ANIMS) {
      const info = p.inf.animations[a];
      if (info) out.push({ key: ultiKey(a, p.key), url: at(p.infDir, info), info, group: p.inf });
    }
  }
  // (18-11-2026) la tira ulti-hit trae su PROPIA celda (130 x 175); con la general de la hoja (132 x 177) salían cero frames
  const l = LAUNCH_ONLY[id];
  if (l) {
    const cell = (l.inf.animations['ulti-hit'] as (AnimInfo & { cell?: { w: number; h: number } }) | undefined)?.cell ?? l.inf.cell;
    out.push({ key: l.key, url: l.file, info: { file: l.file, frames: 9, fps: 14, loop: false } as AnimInfo, group: { cell } });
  }
  if (id === 'mai-front') out.push({ key: MAI_DEFEAT.key, url: MAI_DEFEAT.file, info: { file: MAI_DEFEAT.file, frames: 8, fps: MAI_DEFEAT.fps, loop: false } as AnimInfo, group: { cell: { w: MAI_DEFEAT.w, h: MAI_DEFEAT.h } } });
  return out;
}

/** (25-11-2026) hojas (vista de un personaje) de una lista [personaje, vista]; sin repetir, sin las que no existen */
export function sheetsOf(list: [string | undefined, 'back' | 'front'][]): SheetId[] {
  const out = new Set<SheetId>();
  for (const [skin, view] of list) {
    const id = sheetFor(skin, view);
    if (id) out.add(id);
  }
  return [...out];
}

/**
 * (25-11-2026, usuario) Carga SOLO los personajes que se usan (antes se cargaban todos al arrancar: ~250 MB de memoria gráfica, más con
 * cada personaje nuevo). Encola las tiras de esas hojas que aún no estén cargadas; después, registerNxoAnims(scene) en el create.
 * Menú, PERSONALIZAR y Tienda: tu personaje de espaldas y de frente. Partido: además el rival de frente (y en el 2v2, tu compañero de
 * espaldas). Ver releaseCharacterSprites.
 */
export function queueNxoSpriteLoads(load: Phaser.Loader.LoaderPlugin, ids: SheetId[]) {
  for (const id of ids) {
    for (const e of sheetEntries(id)) if (!load.textureManager.exists(e.key)) loadStrip(load, e.key, e.url, e.info, e.group);
  }
}

/** (25-11-2026) Libera de la memoria las hojas que NO estén en \`keep\` (texturas y sus animaciones). Llamar sin ningún partido abierto. */
export function releaseCharacterSprites(scene: Phaser.Scene, keep: SheetId[]) {
  for (const id of IDS) {
    if (keep.includes(id)) continue;
    for (const e of sheetEntries(id)) {
      if (scene.anims.exists(e.key)) scene.anims.remove(e.key);
      if (scene.textures.exists(e.key)) scene.textures.remove(e.key);
    }
  }
}

`;
s=s.slice(0,a)+nw+s.slice(b);
if(!s.includes("import { sheetFor } from '../characters/catalog';")) s=s.replace("import { SHEETS, SHEET_IDS, type SheetCfg, type SheetId } from '../characters/sheets';","import { SHEETS, SHEET_IDS, type SheetCfg, type SheetId } from '../characters/sheets';\nimport { sheetFor } from '../characters/catalog';");
fs.writeFileSync(F,s);
console.log('ok');
