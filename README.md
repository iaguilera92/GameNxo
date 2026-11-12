# NxoGames (Game Nxo 1v1)

Juego de tenis 1 vs 1 vertical para móvil. Se juega contra un BOT o contra otro jugador en la misma WiFi
(multijugador LAN 1v1).

```
NxoGames/
├── frontend/   juego: Phaser 3 + TypeScript + Vite, Android con Capacitor 6
├── backend/    servidor: Node.js + TypeScript + Express + Socket.IO
└── docs/       MULTIJUGADOR.md (LAN 1v1, eventos, pruebas) · RANKED.md (ligas) · ECONOMIA.md (monedas, dinero, XP,
                pase, tienda) · COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md (hojas de sprites)
```

> El juego estaba antes en la raíz del repositorio. Ahora todo lo del juego (`src/`, `public/`, `android/`,
> `tools/`, `package.json`…) está en **`frontend/`**, con las mismas rutas internas.

## Requisitos

- Node 18+ (probado con Node 24)
- Para el APK: JDK 17 (`JAVA_HOME`) y Android SDK con `platforms;android-34` y `build-tools;34.0.0`
  (`ANDROID_HOME`).
  - En esta máquina están en modo portable: `%USERPROFILE%\devtools\jdk\jdk17` y
    `%USERPROFILE%\devtools\android-sdk`.
  - Capacitor 7+ requiere JDK 21; por eso se usa Capacitor 6, compatible con JDK 17. No actualizar Capacitor sin pasar a
    JDK 21.
- Variables de usuario `JAVA_HOME` y `ANDROID_HOME`. Evitar `+` en la ruta de `JAVA_HOME` (falla `sdkmanager.bat`).
- PC nuevo, tras clonar: `cd frontend`, `npm install`, `npm run build`, `npx cap sync android`. Si Gradle no encuentra el
  SDK, crear `frontend/android/local.properties` con `sdk.dir=C:\\ruta\\al\\android-sdk`.
- No se suben al repo (se regeneran): `node_modules`, `dist`, `android/app/build`, `android/local.properties`,
  `android/app/src/main/assets/public`.

## Juego (frontend)

```powershell
cd frontend
npm install       # dependencias
npm run dev       # jugar en el navegador (http://localhost:5173)
npm run build     # compila TypeScript y genera dist/
npm run apk       # build + cap sync + gradle → android/app/build/outputs/apk/debug/game-nxo.apk
npm run cap:release   # build de producción (anuncios reales, .env.release) + cap sync
```

- En el móvil, en la misma Wi-Fi: `http://<IP-del-PC>:5173` con `npm run dev`. No abrir `index.html` con doble clic
  (sale en blanco).
- Instalar por USB: `adb install -r android\app\build\outputs\apk\debug\game-nxo.apk`. Recarga en vivo por USB:
  `npx cap run android -l --external`.
- Nombre de la app Android: `capacitor.config.ts` (`appName`) y `android/app/src/main/res/values/strings.xml`.
- Herramientas de sprites y pruebas: `node tools/<script>.mjs`, desde `frontend/`.

## Cómo está hecho el partido

- Coordenadas lógicas de cancha: x = profundidad (jugador en x pequeños, rival en x grandes, red en `NET_X`),
  y = lateral, z = altura. Todo se dibuja pasando por `project(x, y, z)`; la cámara se ajusta solo con `VIEW` en
  `frontend/src/view/projection.ts`. La profundidad de dibujo (`depth`) es la y en pantalla del punto en el suelo.
- Joystick → cancha: arriba = hacia la red, derecha = +y.
- Fases del partido (`MatchScene`): intro → serve → toss → rally → pointover → over.
- Teclado para probar en el PC: WASD o flechas = mover · Q/J = DEFENSIVO · E/K = ESPECIAL (al sacar: E/K saque normal,
  Q/J con efecto) · ESPACIO o L = golpe cargado.
- Constantes ajustables (nombre, dificultad, juegos, recargas, XP): `frontend/src/config.ts`. Economía completa:
  `docs/ECONOMIA.md`.

## Notas para la IA que continúe

- Responder al usuario en español y de forma resumida. Trabajar por etapas y, tras cada cambio, compilar
  (`npx tsc --noEmit` y `npm run build`) y decir qué probar en el teléfono.
- Coordinación entre IAs: `NOTAS-CLAUDE.txt` (lo que hizo cada una y avisos). Reglas de Kiro: `.kiro/steering/`.
  Sprites: `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` (leer antes de tocar hojas). Economía: `docs/ECONOMIA.md`.
- No cambiar el stack sin consultar (Phaser 3 + Capacitor 6 + JDK 17). Versiones fijadas en `package.json`.
- Antes del APK siempre `npm run build && npx cap sync android` (lo hace `npm run apk`).
- En `Character` no usar la propiedad `body` (choca con Phaser): es `torso`.
- Al destruir un Text, quitar antes cualquier `time.addEvent` que lo actualice: un error dentro del bucle de Phaser
  congela todo el juego.
- La fuente Lilita One no tiene emojis: no usar emojis en textos.
- No poner preFX/postFX en los sprites del personaje (están dentro de un Container): en el APK se rompe el dibujo.
- Para revisar pantallas sin teléfono: capturas con Chrome headless (`--screenshot`, `--virtual-time-budget`), forzando
  `fps.forceSetTimeOut` en Phaser solo durante la captura.

## Sprites de personajes

Las imágenes con las que se trabajan los sprites están siempre en `frontend/public/personajes/<Personaje>/`
(la vista de frente del rival, en su subcarpeta `rival/`). Cada personaje tiene, por vista, 4 hojas de movimientos
de 8 filas × 8 frames y una hoja del INFERNO DRIVE; más adelante habrá más hojas. `frontend/tools/build-nxo-v2.mjs`
y `build-nxo-inferno.mjs` las cortan en las tiras que carga el juego (`public/assets/characters/`).

**Regla:** un sprite nuevo SIEMPRE entra como hoja en `personajes/` y se pasa a `assets/characters/` con la herramienta.
Nunca se pone una imagen directo en `assets/characters/`. Desde la próxima hoja, las tiras van en WebP (detalles en
`docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md`, sección 0).

Qué es cada hoja y cada fila, las reglas de dibujo y los comandos:
[docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md](docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md). Léelo antes de cambiar o añadir
una hoja.

## Servidor (backend)

```powershell
cd backend
npm install
npm run dev       # servidor en 0.0.0.0:3001 (muestra las IPv4 del PC)
npm test          # pruebas de salas, matchmaking y Socket.IO
```

Para jugar en LAN, pon la IPv4 del PC (`ipconfig`) en el juego: Ajustes > **SERVIDOR LAN**. Guía completa en
[docs/MULTIJUGADOR.md](docs/MULTIJUGADOR.md).

Economía del juego (monedas, dinero, XP, pase, Ranked, tienda, ruleta y premio diario), por qué es así y dónde se
cambia cada número: [docs/ECONOMIA.md](docs/ECONOMIA.md). Simulador: `cd frontend && node tools/sim-economy.mjs --runs=20`.
