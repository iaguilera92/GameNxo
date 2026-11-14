import Phaser from 'phaser';
/**
 * SONIDOS DE JUEGO en archivo (carpeta public/mp3/). Se cargan una vez en BootScene (la cache de audio es global)
 * y suenan con `sfx(scene, clave)`: si el archivo no está, no suena y no pasa nada.
 *
 * Qué suena y dónde (MatchScene, salvo el último; todos para usuario, bot y rival online):
 *  ball-saque-1                  golpe del saque (normal y con efecto)
 *  ball-saque-2                  REMATE del globo (salto en el círculo)
 *  electricidad                  choque eléctrico del golpe cargado al 100 %
 *  dash-1 / dash-electirco-1     DEFENSIVO DASH (eléctrico si su ESPECIAL es el de rayo)
 *  dash-shadow / -jump / -destello   SOMBRA / SUPERSALTO / DESTELLO
 *  ball-recibir-ulti-ataque      el pelotazo de la ULTI de viento / tulipán le llega al personaje y la raqueta sale volando
 *  ball-ulti-pared               la bola de la ULTI choca con la pared
 *  recoger-raqueta               recoger la raqueta del suelo
 *  equipar                       PowerDialog (Personalizar): botón EQUIPAR
 *  recolectar-monedas            fin de partida (MatchEndScene): las monedas del perdedor pasan al ganador (3 s)
 *  impacto-ulti-fuego / -rayo / -hielo   lo mismo con la ULTI de fuego / rayo / hielo (ImpactFx.powerImpactFx)
 *  ulti-fuego / -rayo / -hielo   golpe de la ULTI al lanzarla (InfernoFx.infernoSound.impact); viento y tulipán: inferno.mp3
 *  stun                          el personaje queda aturdido por el ESPECIAL o la ULTI (ImpactFx.powerImpactFx)
 *  recolectar-exp                Menú al volver de la partida (MenuScene.playXpGain): 3 oleadas de EXP a nivel y pase
 * Los .m4a y el .wav se cargan igual que los mp3 (Phaser elige por la extensión).
 */
export const SFX_FILES: Record<string, string> = {
  'ball-saque-1': 'mp3/ball-saque-1.m4a',
  'ball-saque-2': 'mp3/ball-saque-2.m4a',
  'ball-recibir-ulti-ataque': 'mp3/ball-recibir-ulti-ataque.mp3',
  'ball-ulti-pared': 'mp3/ball-ulti-pared.m4a',
  electricidad: 'mp3/electricidad.wav',
  'dash-1': 'mp3/dash-1.mp3',
  'dash-electirco-1': 'mp3/dash-electirco-1.m4a',
  'dash-shadow': 'mp3/dash-shadow.mp3',
  'dash-jump': 'mp3/dash-jump.m4a',
  'dash-destello': 'mp3/dash-destello.m4a',
  'recoger-raqueta': 'mp3/recoger-raqueta.m4a',
  equipar: 'mp3/equipar.m4a',
  'recolectar-monedas': 'mp3/recolectar-monedas.m4a',
  'recolectar-exp': 'mp3/recolectar-exp.m4a',
  'impacto-ulti-fuego': 'mp3/impacto-ulti-fuego.m4a',
  'ulti-rayo': 'mp3/ulti-rayo.m4a',
  'ulti-fuego': 'mp3/ulti-fuego.m4a',
  stun: 'mp3/stun.mp3',
  'ulti-hielo': 'mp3/ulti-hielo.m4a',
  'impacto-ulti-hielo': 'mp3/impacto-ulti-hielo.m4a',
  'impacto-ulti-rayo': 'mp3/impacto-ulti-rayo.m4a',
};

export function queueSfx(load: Phaser.Loader.LoaderPlugin) {
  for (const [key, file] of Object.entries(SFX_FILES)) if (!load.cacheManager.audio.exists(key)) load.audio(key, file);
}

/** Suena `key` una vez (si está cargado). */
export function sfx(scene: Phaser.Scene, key: string, volume = 1) {
  if (scene.cache.audio.exists(key)) scene.sound.play(key, { volume, seek: SFX_SEEK[key] ?? 0 });
}

/**
 * Silencio al INICIO de algunos archivos (s, medido con el audio decodificado): se salta para que suenen justo con el golpe.
 * ball-saque-1: el sonido empieza a los 0,32 s (se oía tarde) · ball-saque-2: a los 0,16 s.
 */
export const SFX_SEEK: Record<string, number> = {
  'ball-saque-1': 0.3,
  'ball-saque-2': 0.15,
};

/** Sonido del DASH: eléctrico si el ESPECIAL de quien lo hace es el de rayo. */
export function dashSfx(smashEl?: string): string {
  return smashEl === 'lightning' ? 'dash-electirco-1' : 'dash-1';
}
