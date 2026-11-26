import Phaser from 'phaser';
import { ambienteForRoom, pickAmbiente } from '../view/CourtView';

/**
 * Música de la cancha (soundtrack del ambiente), compartida entre la pantalla VS y el partido.
 *
 *  - Al empezar la búsqueda se ELIGE el ambiente del próximo partido y se empieza a cargar su soundtrack
 *    (`prepareMatchMusic`), así ya está listo cuando sale el VS.
 *  - En el VS, 1 s después del sonido "vs", arranca la música (`playMatchMusic`) y SIGUE sonando al pasar al
 *    partido (el gestor de sonido es del juego, no de la escena): el partido usa ese mismo ambiente y no la corta.
 *  - Al terminar el partido o cancelar la búsqueda se para y se libera de la memoria (`stopMatchMusic`).
 *
 * Solo se carga el soundtrack que va a sonar (decodificado ocupa mucha RAM: soundtrack-1 ~57 MB).
 */
const VOLUME = 0.22;

/**
 * (26-11-2026, usuario) La música del partido ya NO depende del ambiente: se sortea entre estas en cada partido (1v1 y 2v2). Contra el bot, al
 * azar; ONLINE sale del id de la sala (`trackForRoom`), así los dos (o los cuatro) teléfonos escuchan la MISMA canción.
 * Para sumar una canción: dejarla en public/mp3/<nombre>.m4a (AAC 64 kbps) y añadir su nombre aquí.
 */
export const MATCH_TRACKS = ['soundtrack-1', 'soundtrack-2', 'soundtrack-3', 'soundtrack-6', 'soundtrack-7'];
/** canción al azar */
const randomTrack = () => MATCH_TRACKS[Math.floor(Math.random() * MATCH_TRACKS.length)];
/** canción de una sala online: el mismo cálculo en todos los teléfonos (hash del id de la sala, distinto del del ambiente) */
export function trackForRoom(roomId: string): string {
  let h = 2166136261;
  for (const c of `musica:${roomId}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 16;
  return MATCH_TRACKS[(h >>> 0) % MATCH_TRACKS.length];
}
/** canción elegida para el próximo partido (la búsqueda la elige y la carga; la toca el VS y sigue en el partido) */
let pickedTrack: string | null = null;

let picked: string | null = null;
let music: Phaser.Sound.BaseSound | null = null;
let musicKey = '';
/** cada play/stop invalida las cargas anteriores (una carga que termina tarde no arranca música vieja) */
let token = 0;

/** soundtracks pedidos al cargador en esta partida (para liberar también el que se pidió y no llegó a sonar) */
const requested = new Set<string>();

function ensureLoaded(scene: Phaser.Scene, key: string, onReady?: () => void) {
  if (scene.cache.audio.exists(key)) {
    onReady?.();
    return;
  }
  requested.add(key);
  scene.load.audio(key, `mp3/${key}.m4a`);
  // si el archivo falta, COMPLETE llega igual y simplemente no suena (sin error)
  if (onReady) scene.load.once(Phaser.Loader.Events.COMPLETE, onReady);
  if (!scene.load.isLoading()) scene.load.start();
}

/** Elige (una vez) el ambiente del próximo partido y empieza a cargar su música. Devuelve su clave ('' = sin imagen). */
export function prepareMatchMusic(scene: Phaser.Scene, doubles = false): string {
  if (picked === null) picked = pickAmbiente(scene, doubles) ?? ''; // (19-11-2026) el 2v2 tiene su propio mapa (CourtView, `only: '2v2'`)
  pickedTrack ??= randomTrack();
  ensureLoaded(scene, pickedTrack);
  return picked;
}

/**
 * Partido ONLINE emparejado: el ambiente y su música salen del id de la sala (`ambienteForRoom`), iguales en los dos teléfonos. Sustituye al
 * sorteado al empezar la búsqueda (que cada teléfono hacía por su cuenta): se suelta su soundtrack si era otro y se carga el nuevo.
 */
export function setRoomMatchMusic(scene: Phaser.Scene, roomId: string, doubles = false): string {
  const next = ambienteForRoom(scene, roomId, doubles) ?? '';
  const old = pickedTrack ?? '';
  const track = trackForRoom(roomId);
  picked = next;
  pickedTrack = track;
  if (old && old !== track && old !== musicKey && scene.cache.audio.exists(old)) scene.cache.audio.remove(old);
  ensureLoaded(scene, track);
  return next;
}

/** Ambiente ya elegido para este partido (lo consume el partido: una revancha vuelve a sortear). */
export function takePickedAmbiente(): string | null {
  const p = picked;
  picked = null;
  return p;
}

/**
 * Hace sonar en bucle la música del partido (si ya suena una del partido, p. ej. desde el VS, no la reinicia). La elegida por la búsqueda;
 * si no hay (revancha), al azar o, online, la de la sala (`roomId`). `_ambiente` queda por compatibilidad (la música ya no depende de él).
 */
export function playMatchMusic(scene: Phaser.Scene, _ambiente: string, roomId?: string) {
  if (music && MATCH_TRACKS.includes(musicKey) && music.isPlaying) return;
  const key = pickedTrack ?? (roomId ? trackForRoom(roomId) : randomTrack());
  pickedTrack = null;
  stopMatchMusic(scene, false);
  const my = ++token;
  musicKey = key;
  ensureLoaded(scene, key, () => {
    if (my !== token || music || !scene.cache.audio.exists(key)) return;
    music = scene.sound.add(key, { loop: true, volume: VOLUME });
    music.play();
  });
}

/** Para la música. `release` = además la saca de la memoria (fin del partido / búsqueda cancelada). */
export function stopMatchMusic(scene: Phaser.Scene, release = true) {
  token++;
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = null;
  music?.stop();
  music?.destroy();
  music = null;
  if (release) {
    for (const k of new Set([musicKey, pickedTrack ?? '', ...requested])) if (k && scene.cache.audio.exists(k)) scene.cache.audio.remove(k);
    requested.clear();
    picked = null;
    pickedTrack = null;
  }
  musicKey = '';
}
/** volumen de la música del resultado (soundtrack-victoria / soundtrack-derrota) */
const RESULT_VOLUME = 0.5;
/**
 * Fin del partido (apenas termina): corta el soundtrack del ambiente y suena `soundtrack-victoria` (ganaste) o
 * `soundtrack-derrota` (perdiste) en public/mp3/. Se puede llamar varias veces (final con espectáculo, rendición,
 * fin del servidor): la segunda no la reinicia. Se para y se libera al salir del partido (stopMatchMusic).
 * Si el archivo no existe no suena nada (el del ambiente ya se cortó).
 */
export function playResultMusic(scene: Phaser.Scene, win: boolean) {
  const key = win ? 'soundtrack-victoria' : 'soundtrack-derrota';
  if (musicKey === key) return;
  stopMatchMusic(scene); // corta y libera el soundtrack del ambiente
  const my = ++token;
  musicKey = key;
  ensureLoaded(scene, key, () => {
    if (my !== token || music || !scene.cache.audio.exists(key)) return;
    music = scene.sound.add(key, { loop: false, volume: RESULT_VOLUME });
    playResultCycle(music);
  });
}
/** ms finales de cada vuelta en los que el volumen baja poco a poco hasta 0 */
const RESULT_FADE_MS = 4000;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
/**
 * Una vuelta de la música del resultado: suena entera, en sus últimos RESULT_FADE_MS el volumen baja de a poco hasta 0
 * y, al acabar, vuelve a empezar a volumen completo (hasta que se salga de la pantalla: stopMatchMusic).
 * El fundido va por reloj real (setInterval) y no por tweens: no depende de que la escena del partido siga activa.
 */
function playResultCycle(snd: Phaser.Sound.BaseSound) {
  if (music !== snd) return;
  snd.play(undefined, { volume: RESULT_VOLUME });
  if (fadeTimer) clearInterval(fadeTimer);
  fadeTimer = setInterval(() => {
    if (music !== snd || !snd.isPlaying) return;
    const total = snd.duration * 1000;
    const left = total - (snd as Phaser.Sound.WebAudioSound).seek * 1000;
    const fade = Math.min(RESULT_FADE_MS, total);
    if (left < fade) (snd as Phaser.Sound.WebAudioSound).setVolume(RESULT_VOLUME * Math.max(0, left / fade));
  }, 80);
  snd.once(Phaser.Sound.Events.COMPLETE, () => playResultCycle(snd));
}
