// Compila el APK de pruebas (debug) y deja una copia con nombre fijo: game-nxo.apk.
//   node tools/apk.mjs   (lo llama "npm run apk" después de cap:sync)
import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(ROOT, 'android');
const win = process.platform === 'win32';
// ruta absoluta: npm define NoDefaultCurrentDirectoryInExePath y cmd no busca en la carpeta actual
const gradlew = join(android, win ? 'gradlew.bat' : 'gradlew');
const r = spawnSync(win ? `"${gradlew}"` : gradlew, ['assembleDebug'], { cwd: android, stdio: 'inherit', shell: win });
if (r.status !== 0) process.exit(r.status ?? 1);
const out = join(android, 'app', 'build', 'outputs', 'apk', 'debug');
copyFileSync(join(out, 'app-debug.apk'), join(out, 'game-nxo.apk'));
console.log(`APK: ${join(out, 'game-nxo.apk')}`);
