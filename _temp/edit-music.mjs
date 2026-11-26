import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const F='frontend/src/fx/matchMusic.ts';
apply(F,[
["/** soundtrack de cada ambiente: 2 → soundtrack-3, 3 y el parque del 2v2 → soundtrack-2, el resto → soundtrack-1 */\n// (19-11-2026, usuario) el PARQUE del 2v2 (ambiente-1-2v2) también suena con soundtrack-2\nexport const trackFor = (ambiente: string) => (ambiente === 'ambiente-3' || ambiente === 'ambiente-1-2v2' ? 'soundtrack-2' : ambiente === 'ambiente-2' ? 'soundtrack-3' : 'soundtrack-1');",
`/**
 * (26-11-2026, usuario) La música del partido ya NO depende del ambiente: se sortea entre estas en cada partido (1v1 y 2v2). Contra el bot, al
 * azar; ONLINE sale del id de la sala (\`trackForRoom\`), así los dos (o los cuatro) teléfonos escuchan la MISMA canción.
 * Para sumar una canción: dejarla en public/mp3/<nombre>.m4a (AAC 64 kbps) y añadir su nombre aquí.
 */
export const MATCH_TRACKS = ['soundtrack-1', 'soundtrack-2', 'soundtrack-3', 'soundtrack-6'];
/** canción al azar */
const randomTrack = () => MATCH_TRACKS[Math.floor(Math.random() * MATCH_TRACKS.length)];
/** canción de una sala online: el mismo cálculo en todos los teléfonos (hash del id de la sala, distinto del del ambiente) */
export function trackForRoom(roomId: string): string {
  let h = 2166136261;
  for (const c of \`musica:\${roomId}\`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 16;
  return MATCH_TRACKS[(h >>> 0) % MATCH_TRACKS.length];
}
/** canción elegida para el próximo partido (la búsqueda la elige y la carga; la toca el VS y sigue en el partido) */
let pickedTrack: string | null = null;`],
["export function prepareMatchMusic(scene: Phaser.Scene, doubles = false): string {\n  if (picked === null) picked = pickAmbiente(scene, doubles) ?? ''; // (19-11-2026) el 2v2 tiene su propio mapa (CourtView, `only: '2v2'`)\n  ensureLoaded(scene, trackFor(picked));\n  return picked;\n}",
 "export function prepareMatchMusic(scene: Phaser.Scene, doubles = false): string {\n  if (picked === null) picked = pickAmbiente(scene, doubles) ?? ''; // (19-11-2026) el 2v2 tiene su propio mapa (CourtView, `only: '2v2'`)\n  pickedTrack ??= randomTrack();\n  ensureLoaded(scene, pickedTrack);\n  return picked;\n}"],
["  const next = ambienteForRoom(scene, roomId, doubles) ?? '';\n  const old = picked !== null ? trackFor(picked) : '';\n  picked = next;\n  if (old && old !== trackFor(next) && old !== musicKey && scene.cache.audio.exists(old)) scene.cache.audio.remove(old);\n  ensureLoaded(scene, trackFor(next));\n  return next;",
 "  const next = ambienteForRoom(scene, roomId, doubles) ?? '';\n  const old = pickedTrack ?? '';\n  const track = trackForRoom(roomId);\n  picked = next;\n  pickedTrack = track;\n  if (old && old !== track && old !== musicKey && scene.cache.audio.exists(old)) scene.cache.audio.remove(old);\n  ensureLoaded(scene, track);\n  return next;"],
["/** Hace sonar en bucle la música de `ambiente` (si ya suena, no la reinicia). */\nexport function playMatchMusic(scene: Phaser.Scene, ambiente: string) {\n  const key = trackFor(ambiente);\n  if (music && musicKey === key && music.isPlaying) return;",
 "/**\n * Hace sonar en bucle la música del partido (si ya suena una del partido, p. ej. desde el VS, no la reinicia). La elegida por la búsqueda;\n * si no hay (revancha), al azar o, online, la de la sala (`roomId`). `_ambiente` queda por compatibilidad (la música ya no depende de él).\n */\nexport function playMatchMusic(scene: Phaser.Scene, _ambiente: string, roomId?: string) {\n  if (music && MATCH_TRACKS.includes(musicKey) && music.isPlaying) return;\n  const key = pickedTrack ?? (roomId ? trackForRoom(roomId) : randomTrack());\n  pickedTrack = null;"],
["    for (const k of new Set([musicKey, picked ? trackFor(picked) : '', ...requested])) if (k && scene.cache.audio.exists(k)) scene.cache.audio.remove(k);\n    requested.clear();\n    picked = null;",
 "    for (const k of new Set([musicKey, pickedTrack ?? '', ...requested])) if (k && scene.cache.audio.exists(k)) scene.cache.audio.remove(k);\n    requested.clear();\n    picked = null;\n    pickedTrack = null;"],
]);
apply('frontend/src/scenes/MatchScene.ts',[
["    playMatchMusic(this, this.ambienteKey);", "    playMatchMusic(this, this.ambienteKey, this.net?.roomId); // (26-11-2026) online: la misma canción en todos los teléfonos"],
]);
console.log('ok');
