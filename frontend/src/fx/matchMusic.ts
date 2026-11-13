import Phaser from 'phaser';
import { pickAmbiente } from '../view/CourtView';

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

/** soundtrack de cada ambiente: 2 → soundtrack-3, 3 → soundtrack-2, el resto → soundtrack-1 */
export const trackFor = (ambiente: string) => (ambiente === 'ambiente-3' ? 'soundtrack-2' : ambiente === 'ambiente-2' ? 'soundtrack-3' : 'soundtrack-1');

let picked: string | null = null;
let music: Phaser.Sound.BaseSound | null = null;
let musicKey = '';
/** cada play/stop invalida las cargas anteriores (una carga que termina tarde no arranca música vieja) */
let token = 0;

function ensureLoaded(scene: Phaser.Scene, key: string, onReady?: () => void) {
  if (scene.cache.audio.exists(key)) {
    onReady?.();
    return;
  }
  scene.load.audio(key, `mp3/${key}.mp3`);
  // si el archivo falta, COMPLETE llega igual y simplemente no suena (sin error)
  if (onReady) scene.load.once(Phaser.Loader.Events.COMPLETE, onReady);
  if (!scene.load.isLoading()) scene.load.start();
}

/** Elige (una vez) el ambiente del próximo partido y empieza a cargar su música. Devuelve su clave ('' = sin imagen). */
export function prepareMatchMusic(scene: Phaser.Scene): string {
  if (picked === null) picked = pickAmbiente(scene) ?? '';
  ensureLoaded(scene, trackFor(picked));
  return picked;
}

/** Ambiente ya elegido para este partido (lo consume el partido: una revancha vuelve a sortear). */
export function takePickedAmbiente(): string | null {
  const p = picked;
  picked = null;
  return p;
}

/** Hace sonar en bucle la música de `ambiente` (si ya suena, no la reinicia). */
export function playMatchMusic(scene: Phaser.Scene, ambiente: string) {
  const key = trackFor(ambiente);
  if (music && musicKey === key && music.isPlaying) return;
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
    for (const k of new Set([musicKey, picked ? trackFor(picked) : ''])) if (k && scene.cache.audio.exists(k)) scene.cache.audio.remove(k);
    picked = null;
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
