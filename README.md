# NxoGames (Game Nxo 1v1)

Juego de tenis 1 vs 1 vertical para móvil. Se juega contra un BOT o contra otro jugador en la misma WiFi
(multijugador LAN 1v1).

```
NxoGames/
├── frontend/   juego: Phaser 3 + TypeScript + Vite, Android con Capacitor 6
├── backend/    servidor: Node.js + TypeScript + Express + Socket.IO
└── docs/       MULTIJUGADOR.md (LAN 1v1, eventos, pruebas) · RANKED.md (ligas) · SPRITES.md (hojas de sprites)
```

> El juego estaba antes en la raíz del repositorio. Ahora todo lo del juego (`src/`, `public/`, `android/`,
> `tools/`, `package.json`…) está en **`frontend/`**, con las mismas rutas internas.

## Requisitos

- Node 18+ (probado con Node 24)
- Para el APK: JDK 17 (`JAVA_HOME`) y Android SDK con `platforms;android-34` y `build-tools;34.0.0`
  (`ANDROID_HOME`).
  - En esta máquina están en modo portable: `%USERPROFILE%\devtools\jdk\jdk17` y
    `%USERPROFILE%\devtools\android-sdk`.
  - Capacitor 7+ requiere JDK 21; por eso se usa Capacitor 6, compatible con JDK 17.

## Juego (frontend)

```powershell
cd frontend
npm install       # dependencias
npm run dev       # jugar en el navegador (http://localhost:5173)
npm run build     # compila TypeScript y genera dist/
npm run apk       # build + cap sync + gradle → android/app/build/outputs/apk/debug/game-nxo.apk
```

Herramientas de sprites y pruebas: `node tools/<script>.mjs`, desde `frontend/`.

## Sprites de personajes

Las imágenes con las que se trabajan los sprites están siempre en `frontend/public/personajes/<Personaje>/`
(la vista de frente del rival, en su subcarpeta `rival/`). Cada personaje tiene, por vista, 4 hojas de movimientos
de 8 filas × 8 frames y una hoja del INFERNO DRIVE; más adelante habrá más hojas. `frontend/tools/build-nxo-v2.mjs`
y `build-nxo-inferno.mjs` las cortan en las tiras que carga el juego (`public/assets/characters/`).

Qué es cada hoja y cada fila, las reglas de dibujo y los comandos: [docs/SPRITES.md](docs/SPRITES.md). Léelo antes
de cambiar o añadir una hoja.

## Servidor (backend)

```powershell
cd backend
npm install
npm run dev       # servidor en 0.0.0.0:3001 (muestra las IPv4 del PC)
npm test          # pruebas de salas, matchmaking y Socket.IO
```

Para jugar en LAN, pon la IPv4 del PC (`ipconfig`) en el juego: Ajustes > **SERVIDOR LAN**. Guía completa en
[docs/MULTIJUGADOR.md](docs/MULTIJUGADOR.md).

Estado detallado del juego y controles: `README.txt`.
