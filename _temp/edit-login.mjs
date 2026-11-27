import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/main.ts',[
["import { OnboardingScene } from './scenes/OnboardingScene';", "import { OnboardingScene } from './scenes/OnboardingScene';\nimport { LoginScene } from './scenes/LoginScene';"],
["scene: [BootScene, OnboardingScene,", "scene: [BootScene, LoginScene, OnboardingScene,"],
]);
apply('frontend/src/scenes/BootScene.ts',[
["const first = needsOnboarding(getPlayer(), isDevMode()) ? 'Onboarding' : 'Menu';", "const first = needsOnboarding(getPlayer(), isDevMode()) ? 'Login' : 'Menu'; // (27-11-2026) cuenta nueva: INICIAR SESIÓN y luego la pantalla de inicio"],
]);
apply('frontend/src/domain/devMode.ts',[
["/** Con qué modo arranca la app cuando el jugador aún no ha elegido. true mientras se prueba; ponlo en false para publicar. */\nexport const DEV_MODE_DEFAULT = true;",
 "/** Con qué modo arranca la app cuando el jugador aún no ha elegido. (27-11-2026, usuario) false: siempre empieza en modo TUTORIAL (perfil normal). */\nexport const DEV_MODE_DEFAULT = false;\n/**\n * (27-11-2026, usuario) Contraseña para ENCENDER el modo desarrollo en AJUSTES (numérica, hasta 6 dígitos). Está en el cliente: solo\n * evita que se encienda por error, no es seguridad de verdad (con cuentas, el modo desarrollo lo debería decidir el servidor).\n */\nconst DEV_PASSWORD = '7';\nexport const DEV_PASSWORD_MAX = 6;\nexport function checkDevPassword(pin: string): boolean {\n  return pin === DEV_PASSWORD;\n}"],
]);
const S='frontend/src/ui/SettingsDialog.ts';
apply(S,[
["import { startTutorialAt, writeDevMode } from '../domain/devMode';", "import { DEV_PASSWORD_MAX, checkDevPassword, startTutorialAt, writeDevMode } from '../domain/devMode';\nimport { askPassword } from './PasswordDialog';"],
["      (on) => {\n        writeDevMode(on);\n        subDev.setText(`Reiniciando… ${devSub(on)}`);\n        scene.time.delayedCall(300, () => window.location.reload());\n      },\n      'ON',\n      'OFF',\n    ),\n  );",
 "      (on) => {\n        writeDevMode(on);\n        subDev.setText(`Reiniciando… ${devSub(on)}`);\n        scene.time.delayedCall(300, () => window.location.reload());\n      },\n      'ON',\n      'OFF',\n      // (27-11-2026, usuario) ENCENDERLO pide la contraseña; apagarlo no\n      (next, apply) => {\n        if (!next) return apply();\n        askPassword(scene, { title: 'MODO DESARROLLO', max: DEV_PASSWORD_MAX, check: checkDevPassword, onOk: apply, depth: depth + 50 });\n      },\n    ),\n  );"],
["function toggle(scene: Phaser.Scene, x: number, y: number, initial: boolean, onChange: (on: boolean) => void, onLabel = 'SÍ', offLabel = 'NO') {",
 "function toggle(scene: Phaser.Scene, x: number, y: number, initial: boolean, onChange: (on: boolean) => void, onLabel = 'SÍ', offLabel = 'NO', guard?: (next: boolean, apply: () => void) => void) {"],
["  c.on('pointerup', () => {\n    on = !on;\n    draw(true);\n    onChange(on);\n  });\n  return c;",
 "  c.on('pointerup', () => {\n    const next = !on;\n    const apply = () => {\n      on = next;\n      draw(true);\n      onChange(on);\n    };\n    // `guard`: decide antes de cambiar (p. ej. pedir una contraseña); si no llama a apply, el interruptor no se mueve\n    if (guard) guard(next, apply);\n    else apply();\n  });\n  return c;"],
]);
console.log('ok');
