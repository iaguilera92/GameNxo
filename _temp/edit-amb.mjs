import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const C='frontend/src/view/CourtView.ts';
apply(C,[
["function ambientesFor(scene: Phaser.Scene, doubles: boolean): Ambiente[] {\n  const loaded = AMBIENTES.filter((a) => scene.textures.exists(a.key));",
 "function ambientesFor(_scene: Phaser.Scene, doubles: boolean): Ambiente[] {\n  // (25-11-2026) se elige entre TODOS (ya no se cargan al arrancar): el elegido lo carga el partido (queueAmbiente)\n  const loaded = AMBIENTES;"],
["export function queueAmbienteLoad(load: Phaser.Loader.LoaderPlugin) {\n  for (const a of AMBIENTES) if (!load.textureManager.exists(a.key)) load.image(a.key, a.file);\n}",
 "/**\n * (25-11-2026, usuario) Solo el ambiente del partido: antes se cargaban los 5 al arrancar (~9 MB de memoria cada uno). La búsqueda / el\n * partido encolan el elegido y el menú libera los demás al volver (releaseAmbientes).\n */\nexport function queueAmbiente(load: Phaser.Loader.LoaderPlugin, key: string | null | undefined) {\n  const a = AMBIENTES.find((x) => x.key === key);\n  if (a && !load.textureManager.exists(a.key)) load.image(a.key, a.file);\n}\n/** Libera de la memoria las imágenes de ambiente (salvo `keep`). Llamar sin ningún partido abierto. */\nexport function releaseAmbientes(scene: Phaser.Scene, keep: string[] = []) {\n  for (const a of AMBIENTES) if (!keep.includes(a.key) && scene.textures.exists(a.key)) scene.textures.remove(a.key);\n}"],
["  const loaded = AMBIENTES.filter((a) => scene.textures.exists(a.key));\n  if (!loaded.length) return null;\n  const available = ambientesFor(scene, doubles);",
 "  const loaded = AMBIENTES; // (25-11-2026) el elegido se carga aparte (queueAmbiente); drawCourtView no lo dibuja si falta\n  const available = ambientesFor(scene, doubles);"],
["  const amb = resolveAmbiente(scene, preferred, doubles);\n  if (!amb) return null;",
 "  const amb = resolveAmbiente(scene, preferred, doubles);\n  if (!amb || !scene.textures.exists(amb.key)) return null; // sin la imagen: la cancha dibujada de siempre"],
]);
apply('frontend/src/scenes/BootScene.ts',[
["import { queueAmbienteLoad } from '../view/CourtView';\n", ""],
["    queueAmbienteLoad(this.load); // ambiente del partido (estadio)\n", "    // (25-11-2026) los ambientes ya no se cargan aquí: solo el del partido (MatchmakingScene / MatchScene, queueAmbiente)\n"],
]);
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
["import { drawCourtView, resolveAmbiente, footerColor, footerDark, SHARED_FOOTER } from '../view/CourtView';", "import { drawCourtView, queueAmbiente, resolveAmbiente, footerColor, footerDark, SHARED_FOOTER } from '../view/CourtView';"],
["    if (!this.doubles) queueSpectators(this.load, 'ambiente-1'); // (21-11-2026, usuario) espectadores en las gradas del barrio\n    if (!this.doubles) queueSpectators(this.load, 'ambiente-2'); // (22-11-2026, usuario) espectadores y perrito en las gradas de la arcilla\n    if (!this.doubles) queueWalkers(this.load, 'ambiente-3'); // (23-11-2026, usuario) autos de la CIUDAD (el 1v1)\n    if (!this.doubles) queueWalkers(this.load, 'ambiente-4'); // (21-11-2026, usuario) figuras de la NIEVE (el 1v1)",
 "    // (25-11-2026, usuario) SOLO el ambiente de este partido (antes los 5 desde el arranque) y sus figuras\n    const amb = resolveAmbiente(this, this.ambienteHint, this.doubles)?.key ?? null;\n    if (amb) this.ambienteHint = amb;\n    queueAmbiente(this.load, amb);\n    if (!this.doubles && amb === 'ambiente-1') queueSpectators(this.load, 'ambiente-1'); // (21-11-2026, usuario) espectadores en las gradas del barrio\n    if (!this.doubles && amb === 'ambiente-2') queueSpectators(this.load, 'ambiente-2'); // (22-11-2026, usuario) espectadores y perrito en las gradas de la arcilla\n    if (!this.doubles && amb === 'ambiente-3') queueWalkers(this.load, 'ambiente-3'); // (23-11-2026, usuario) autos de la CIUDAD (el 1v1)\n    if (!this.doubles && amb === 'ambiente-4') queueWalkers(this.load, 'ambiente-4'); // (21-11-2026, usuario) figuras de la NIEVE (el 1v1)"],
]);
console.log('ok');
