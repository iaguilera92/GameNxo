import Phaser from 'phaser';

/**
 * ESTILOS DE COLOR del personaje (croma selectivo por shader, solo WebGL).
 *
 * En vez de dibujar hojas nuevas, un PostFX cambia SOLO un rango de colores de los sprites del personaje (el color
 * principal de su ropa: el rojo de NXO, el rosa de MAI) y deja igual la piel, el pelo, los blancos y los negros. Vale para
 * todas las animaciones, porque se aplica al sprite (no a la hoja).
 *
 *   rango   tono de origen `from` (0..1 = 0..360°) ± `range`, solo con saturación ≥ `minSat` (la piel queda fuera)
 *   cambio  el tono pasa a `to`; además `sat` (×saturación) y `bright` (×brillo) en esos píxeles
 *
 * Uso: applyCharColor(personaje, 'azul', 'nxo')  ·  applyCharColor(personaje, null) lo quita.
 * Pruebas en el partido: localStorage 'dev.charColor' = id del estilo (azul, verde, morado, dorado, sombra).
 * En Canvas (sin WebGL) no hace nada.
 */

import type { CharColorId } from '../domain/charColors';
export type { CharColorId };

export interface CharColorDef {
  id: CharColorId;
  name: string;
  /** tono destino (0..1); null = conserva el tono (solo cambia saturación / brillo) */
  to: number | null;
  sat: number;
  bright: number;
}

export const CHAR_COLORS: CharColorDef[] = [
  { id: 'classic', name: 'CLÁSICO', to: null, sat: 1, bright: 1 },
  { id: 'azul', name: 'AZUL', to: 0.6, sat: 1, bright: 1.05 },
  { id: 'verde', name: 'VERDE', to: 0.36, sat: 0.95, bright: 1 },
  { id: 'morado', name: 'MORADO', to: 0.78, sat: 1, bright: 1 },
  { id: 'dorado', name: 'DORADO', to: 0.12, sat: 1.05, bright: 1.2 },
  { id: 'sombra', name: 'SOMBRA', to: null, sat: 0.12, bright: 0.5 },
];

/** Color principal de la ropa de cada personaje (el que se cambia). */
// medidos en los retratos (11-11-2026): ropa de NXO ≈ 356° (sat. 0,9-0,96); su piel sombreada ≈ 17° queda FUERA del rango
const SOURCE: Record<string, { from: number; range: number; minSat: number }> = {
  nxo: { from: 0.9875, range: 0.045, minSat: 0.5 }, // rojo de la chaqueta, el short, las zapatillas y la raqueta
  mai: { from: 0.925, range: 0.07, minSat: 0.45 }, // rosa de la gorra y el vestido
};

/**
 * Zonas del RETRATO que nunca cambian (px de la imagen original): la boca de NXO es del mismo rojo que su ropa y por color
 * no se puede separar. El retrato es una imagen fija, así que se recolorea en CPU una vez por estilo (recoloredPortrait).
 */
const PORTRAIT_PROTECT: Record<string, [number, number, number, number][]> = {
  'portrait-nxo': [[474, 396, 584, 452]],
};
const PORTRAIT_KEYS = new Set(['portrait-nxo', 'portrait-mai']);

export function charColorDef(id: CharColorId | string | null | undefined): CharColorDef | null {
  return CHAR_COLORS.find((c) => c.id === id) ?? null;
}

const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uFrom;
uniform float uRange;
uniform float uMinSat;
uniform float uTo;
uniform float uKeepHue;
uniform float uSat;
uniform float uBright;
varying vec2 outTexCoord;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec4 c = texture2D(uMainSampler, outTexCoord);
  if (c.a < 0.004) { gl_FragColor = c; return; }
  vec3 rgb = c.rgb / c.a; // el framebuffer va con alfa premultiplicado
  vec3 hsv = rgb2hsv(rgb);
  // distancia de tono en el círculo (0..0.5)
  float d = abs(fract(hsv.x - uFrom + 0.5) - 0.5);
  float w = (1.0 - smoothstep(uRange * 0.6, uRange, d)) * smoothstep(uMinSat * 0.7, uMinSat, hsv.y) * smoothstep(0.08, 0.2, hsv.z);
  if (w <= 0.0) { gl_FragColor = c; return; }
  // color YA cambiado del todo; luego se mezcla en RGB con el original según el peso. (Mezclar el TONO a medias pasaba
  // por los tonos intermedios: de rojo a azul, verde en los bordes del rango, contornos y piel rojiza.)
  float h = mix(fract(hsv.x - uFrom + uTo), hsv.x, uKeepHue);
  vec3 full = hsv2rgb(vec3(h, clamp(hsv.y * uSat, 0.0, 1.0), clamp(hsv.z * uBright, 0.0, 1.0)));
  gl_FragColor = vec4(mix(rgb, full, w) * c.a, c.a);
}
`;

const PIPE = 'CharColorFX';

/** PostFX por objeto: cada sprite lleva su instancia con sus parámetros. */
export class CharColorPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  from = 0;
  range = 0.06;
  minSat = 0.5;
  to = 0;
  keepHue = 1;
  sat = 1;
  bright = 1;

  constructor(game: Phaser.Game) {
    super({ game, name: PIPE, fragShader: FRAG });
  }

  onPreRender() {
    this.set1f('uFrom', this.from);
    this.set1f('uRange', this.range);
    this.set1f('uMinSat', this.minSat);
    this.set1f('uTo', this.to);
    this.set1f('uKeepHue', this.keepHue);
    this.set1f('uSat', this.sat);
    this.set1f('uBright', this.bright);
  }
}

/** Registra el pipeline una vez (solo WebGL). false = no disponible. */
function ensurePipeline(scene: Phaser.Scene): boolean {
  const r = scene.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  if (!r.pipelines.postPipelineClasses.has(PIPE)) r.pipelines.addPostPipeline(PIPE, CharColorPipeline);
  return true;
}

/** Sprites (y retratos) de un objeto: él mismo o lo que tenga dentro (contenedores del personaje). */
function spritesOf(o: Phaser.GameObjects.GameObject): (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[] {
  const out: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[] = [];
  const walk = (x: Phaser.GameObjects.GameObject) => {
    if (x instanceof Phaser.GameObjects.Sprite || x instanceof Phaser.GameObjects.Image) out.push(x);
    const list = (x as Phaser.GameObjects.Container).list;
    if (Array.isArray(list)) list.forEach(walk);
  };
  walk(o);
  return out;
}

/**
 * Aplica (o quita, con null / 'classic') un estilo de color a un personaje: su contenedor (Character), un sprite o un
 * retrato. `skin` = qué color de ropa cambiar (nxo = rojo, mai = rosa). Devuelve false si no se pudo (Canvas).
 */
export function applyCharColor(target: Phaser.GameObjects.GameObject, id: CharColorId | string | null, skin = 'nxo'): boolean {
  const scene = target.scene;
  const def = charColorDef(id);
  const all = spritesOf(target);
  // RETRATOS (imagen fija): textura recoloreada en CPU, con sus zonas protegidas (la boca de NXO)
  const portraits = all.filter((it) => !(it instanceof Phaser.GameObjects.Sprite) && PORTRAIT_KEYS.has(baseKeyOf(it)));
  for (const it of portraits) {
    const base = baseKeyOf(it);
    it.setData('charColorBase', base);
    it.setTexture(!def || def.id === 'classic' ? base : recoloredPortrait(scene, base, def, skin) ?? base);
  }
  const items = all.filter((it) => !portraits.includes(it));
  if (!def || def.id === 'classic') {
    for (const it of items) it.removePostPipeline?.(PIPE);
    return true;
  }
  if (!items.length) return true;
  if (!ensurePipeline(scene)) return false;
  const src = SOURCE[skin] ?? SOURCE.nxo;
  const instanceOf = (it: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image) => {
    const got = it.getPostPipeline(PIPE);
    return (Array.isArray(got) ? got[0] : got) as CharColorPipeline | undefined;
  };
  for (const it of items) {
    if (!instanceOf(it)) it.setPostPipeline(PIPE);
    const p = instanceOf(it);
    if (!p) continue;
    p.from = src.from;
    p.range = src.range;
    p.minSat = src.minSat;
    p.keepHue = def.to === null ? 1 : 0;
    p.to = def.to ?? src.from;
    p.sat = def.sat;
    p.bright = def.bright;
  }
  return true;
}

/** Textura original de un objeto (si ya se recoloreó, la que tenía antes). */
function baseKeyOf(it: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): string {
  return (it.getData('charColorBase') as string | undefined) ?? it.texture.key;
}

/**
 * Copia del retrato `key` con el estilo aplicado (la MISMA fórmula que el shader) y sus zonas protegidas sin tocar.
 * Se crea una vez por retrato y estilo (`<key>~<estilo>`). null = no se pudo (sin canvas).
 */
function recoloredPortrait(scene: Phaser.Scene, key: string, def: CharColorDef, skin: string): string | null {
  const out = `${key}~${def.id}`;
  if (scene.textures.exists(out)) return out;
  const src = scene.textures.get(key)?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!src || !src.width) return null;
  const tex = scene.textures.createCanvas(out, src.width, src.height);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return null;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, src.width, src.height);
  const px = data.data;
  const S = SOURCE[skin] ?? SOURCE.nxo;
  const protect = PORTRAIT_PROTECT[key] ?? [];
  const W = src.width;
  const fract = (x: number) => x - Math.floor(x);
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 2) continue;
    if (protect.length) {
      const p = i / 4;
      const x = p % W;
      const y = (p - x) / W;
      if (protect.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
    }
    const r = px[i] / 255;
    const g = px[i + 1] / 255;
    const b = px[i + 2] / 255;
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    let h = 0;
    if (d > 1e-6) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = fract(h / 6);
    const s = mx > 0 ? d / mx : 0;
    const v = mx;
    const dh = Math.abs(fract(h - S.from + 0.5) - 0.5);
    const w = (1 - sm(S.range * 0.6, S.range, dh)) * sm(S.minSat * 0.7, S.minSat, s) * sm(0.08, 0.2, v);
    if (w <= 0) continue;
    const nh = def.to === null ? h : fract(h - S.from + def.to);
    const ns = Math.min(1, s * def.sat);
    const nv = Math.min(1, v * def.bright);
    const f = (n: number) => {
      const k = (n + nh * 6) % 6;
      return nv - nv * ns * Math.max(0, Math.min(k, 4 - k, 1));
    };
    px[i] = (r + (f(5) - r) * w) * 255;
    px[i + 1] = (g + (f(3) - g) * w) * 255;
    px[i + 2] = (b + (f(1) - b) * w) * 255;
  }
  ctx.putImageData(data, 0, 0);
  tex.refresh();
  return out;
}

/** Estilo forzado para pruebas (localStorage 'dev.charColor'); null = ninguno. */
export function devCharColor(): CharColorId | null {
  try {
    const v = localStorage.getItem('dev.charColor');
    return charColorDef(v)?.id ?? null;
  } catch {
    return null;
  }
}
