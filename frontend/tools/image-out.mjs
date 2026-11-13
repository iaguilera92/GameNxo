// Salida de imágenes para las herramientas de sprites: TODO lo que se genera para el juego sale en WebP
// (docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md §0, regla 4). Una sola función para que ninguna herramienta escriba PNG por su cuenta.
//
//   import { saveWebp, pngToWebp, fail } from './image-out.mjs';
//   saveWebp('ruta/tira.webp', ancho, alto, bufferRGBA);   // guarda, convierte con Chrome headless y borra el PNG temporal
//   pngToWebp('ruta/hoja.png', 'ruta/hoja.webp');          // convierte un PNG que ya existe (y lo borra si se pide)
//
// Seguridad: la conversión va a un archivo temporal y solo reemplaza al .webp final si salió bien. Si Chrome falla, se cuelga
// o deja un archivo vacío, la herramienta se detiene con un error claro; nunca queda una tira vieja pasando por nueva.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { save } from './png-lite.mjs';

const CONVERT = join(dirname(fileURLToPath(import.meta.url)), 'convert-image.mjs');
const TIMEOUT_MS = 120_000; // Chrome headless tarda ~3 s por imagen; más de 2 minutos es un proceso colgado

/** Ancho y alto de un PNG (cabecera IHDR). */
function pngSize(path) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
/** Ancho y alto de un WebP (cabecera VP8X, VP8 o VP8L). */
function webpSize(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${path} no es un WebP`);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const v = b.readUInt32LE(21);
    return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) };
  }
  throw new Error(`${path}: formato WebP desconocido (${kind})`);
}
/** La imagen convertida tiene que medir lo mismo que la original: si no, Chrome devolvió otra cosa (p. ej. su página de error). */
function sameSize(a, b, what) {
  if (a.w !== b.w || a.h !== b.h) throw new Error(`${what}: la conversión midió ${b.w}x${b.h} y se esperaba ${a.w}x${a.h}`);
}
/** Error de uso o de entrada: mensaje corto y salida con código 1 (sin el volcado de Node). */
export function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

/** Convierte un PNG en WebP con transparencia. `keepPng = false` borra el PNG al terminar. */
export function pngToWebp(pngPath, webpPath, { quality = '0.92', keepPng = false } = {}) {
  if (!/\.webp$/i.test(webpPath)) throw new Error(`la salida tiene que ser .webp: ${webpPath}`);
  if (!existsSync(pngPath)) throw new Error(`no existe la imagen de entrada: ${pngPath}`);
  const tmp = webpPath.replace(/\.webp$/i, '.tmp.webp');
  if (existsSync(tmp)) unlinkSync(tmp);
  try {
    execFileSync(process.execPath, [CONVERT, pngPath, tmp, String(quality)], { stdio: 'ignore', timeout: TIMEOUT_MS });
  } catch (e) {
    if (existsSync(tmp)) unlinkSync(tmp);
    throw new Error(`no se pudo convertir ${pngPath} a WebP (${e.code === 'ETIMEDOUT' ? 'Chrome no respondió en 2 min' : 'falló convert-image.mjs'}); ¿Chrome instalado?`);
  }
  if (!existsSync(tmp) || statSync(tmp).size < 100) {
    if (existsSync(tmp)) unlinkSync(tmp);
    throw new Error(`la conversión de ${pngPath} no dejó un WebP válido`);
  }
  try { sameSize(pngSize(pngPath), webpSize(tmp), pngPath); } catch (e) { unlinkSync(tmp); throw e; }
  if (existsSync(webpPath)) unlinkSync(webpPath);
  renameSync(tmp, webpPath);
  if (!keepPng) unlinkSync(pngPath);
}

/** Guarda un buffer RGBA como WebP (pasa por un PNG temporal que se borra). */
export function saveWebp(webpPath, w, h, rgba, opts) {
  const png = webpPath.replace(/\.webp$/i, '.png');
  save(png, w, h, rgba);
  pngToWebp(png, webpPath, opts);
}

/** Convierte un WebP en un PNG (para las herramientas que leen PNG). Devuelve la ruta del PNG. */
export function webpToPng(webpPath, pngPath) {
  if (!existsSync(webpPath)) throw new Error(`no existe la imagen de entrada: ${webpPath}`);
  try {
    execFileSync(process.execPath, [CONVERT, webpPath, pngPath], { stdio: 'ignore', timeout: TIMEOUT_MS });
  } catch {
    throw new Error(`no se pudo convertir ${webpPath} a PNG; ¿Chrome instalado?`);
  }
  if (!existsSync(pngPath) || statSync(pngPath).size < 100) throw new Error(`la conversión de ${webpPath} no dejó un PNG válido`);
  sameSize(webpSize(webpPath), pngSize(pngPath), webpPath);
  return pngPath;
}