import Phaser from 'phaser';
/**
 * MÚSICA DEL MENÚ (la intro): public/mp3/intro-1.mp3. Suena desde que se abre el menú y SIGUE sonando al pasar por
 * Personalizar, Tienda, Pase y Ranked (el gestor de sonido es del juego, no de la escena). Parte normal; en sus últimos
 * FADE_MS el volumen baja poco a poco hasta 0 y vuelve a partir desde el principio, una y otra vez.
 * SIGUE durante la búsqueda de rival (Matchmaking / LanSearch) y se apaga con un fundido cuando sale la pantalla VS (`stopIntroMusic`);
 * ahí se saca de la memoria y entra el soundtrack de la cancha.
 * El fundido va por reloj real (setInterval): no depende de que la escena siga activa.
 */
const KEY = 'intro-1';
const FILE = 'mp3/intro-1.mp3';
const VOLUME = 0.35;
/** ms finales de cada vuelta en los que el volumen baja hasta 0 */
const FADE_MS = 3000;

let music: Phaser.Sound.BaseSound | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
/** cada start/stop invalida las cargas anteriores */
let token = 0;

/** Una vuelta: suena entera, baja el volumen al final y, al acabar, vuelve a empezar. */
function cycle(snd: Phaser.Sound.BaseSound) {
  if (music !== snd) return;
  snd.play(undefined, { volume: VOLUME });
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (music !== snd || !snd.isPlaying) return;
    const total = snd.duration * 1000;
    const left = total - (snd as Phaser.Sound.WebAudioSound).seek * 1000;
    const fade = Math.min(FADE_MS, total);
    if (left < fade) (snd as Phaser.Sound.WebAudioSound).setVolume(VOLUME * Math.max(0, left / fade));
  }, 80);
  snd.once(Phaser.Sound.Events.COMPLETE, () => cycle(snd));
}

/** Empieza la música del menú (si ya suena, no la reinicia: abrir Tienda o girar la pantalla no la corta). */
export function startIntroMusic(scene: Phaser.Scene) {
  if (music) return;
  const my = ++token;
  const go = () => {
    if (my !== token || music || !scene.cache.audio.exists(KEY)) return;
    music = scene.sound.add(KEY, { loop: false, volume: VOLUME });
    cycle(music);
  };
  if (scene.cache.audio.exists(KEY)) return go();
  scene.load.audio(KEY, FILE);
  scene.load.once(Phaser.Loader.Events.COMPLETE, go); // si el archivo falta, no suena y sin error
  if (!scene.load.isLoading()) scene.load.start();
}

/**
 * Para la música del menú y la saca de la memoria. Con adeMs baja el volumen de a poco antes de pararla (se usa al
 * aparecer la pantalla VS: la búsqueda de rival sigue con esta música y ahí entra el sonido del VS y luego la del partido).
 */
export function stopIntroMusic(scene: Phaser.Scene, fadeMs = 0) {
  token++;
  if (timer) clearInterval(timer);
  timer = null;
  const snd = music;
  music = null;
  const done = () => {
    snd?.stop();
    snd?.destroy();
    if (!music && scene.cache.audio.exists(KEY)) scene.cache.audio.remove(KEY);
  };
  if (!snd || fadeMs <= 0 || !snd.isPlaying) return done();
  const vol0 = (snd as Phaser.Sound.WebAudioSound).volume;
  const t0 = performance.now();
  const step = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / fadeMs);
    (snd as Phaser.Sound.WebAudioSound).setVolume(vol0 * (1 - k));
    if (k >= 1) {
      clearInterval(step);
      done();
    }
  }, 40);
}
