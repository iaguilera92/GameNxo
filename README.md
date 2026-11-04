# Game Nxo (1v1)

Juego de tenis 1 vs 1 (vertical) contra un bot. Phaser 3 + TypeScript + Vite, empaquetado para Android con Capacitor 6.

> Estado detallado, controles actuales y guía para continuar: ver `README.txt`.

## Requisitos

- Node 18+ (probado con Node 24)
- JDK 17 (`JAVA_HOME`)
- Android SDK con `platforms;android-34` y `build-tools;34.0.0` (`ANDROID_HOME`)

En esta máquina están instalados en modo portable:

- `JAVA_HOME = %USERPROFILE%\devtools\jdk\jdk17`
- `ANDROID_HOME = %USERPROFILE%\devtools\android-sdk`

> Capacitor 7+ requiere JDK 21. Por eso se usa Capacitor 6, compatible con JDK 17.

## Comandos

```powershell
npm install            # dependencias
npm run dev            # jugar en el navegador (http://localhost:5173)
npm run build          # compila TypeScript y genera dist/
npx cap sync android   # copia dist/ al proyecto Android
npm run apk            # build + sync + gradlew assembleDebug
```

Compilar el APK a mano:

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

APK resultante: `android/app/build/outputs/apk/debug/app-debug.apk`

Instalar con el teléfono conectado por USB (depuración USB activada):

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## Controles

| Acción | Móvil | Navegador |
| --- | --- | --- |
| Mover | Joystick flotante (mitad izquierda) | WASD / flechas |
| Golpear | Automático al entrar la pelota en el alcance de la raqueta | — |
| Dirigir el golpe | Inclina el joystick arriba/abajo al golpear | W/S |
| Dash (10 s) | Botón azul | Q o J |
| Smash (30 s) | Botón rojo: arma el siguiente golpe | E o K |

## Reglas

- Mejor de 3 juegos (gana quien llegue a 2).
- Puntos 0-15-30-40-juego. En 40-40: ventaja simplificada (ganas con ventaja; si la pierdes, vuelve a iguales).
- Alternativa: `GOLDEN_POINT = true` en `src/config.ts` (punto de oro: el siguiente punto en 40-40 gana).
- El saque es automático y siempre entra (sin faltas). Se alterna cada juego.
- La pelota debe botar en la cancha rival; fuera, red o doble bote = punto para el rival.

## Ajustes

Todo en `src/config.ts`:

- `BOT_DIFFICULTY` (0 a 1): velocidad, reacción, error de posicionamiento, precisión y probabilidad de tirarla fuera.
- Cooldowns, duración/multiplicador del dash, velocidad del smash, tamaño de la cancha, física.

## Estructura

```
src/
  main.ts                 Configuración de Phaser (escala EXPAND, landscape)
  config.ts               Constantes ajustables
  scenes/
    BootScene.ts          Carga: logo, "Cargando", barra de progreso
    MenuScene.ts          Menú: botón JUGAR + personaje en idle
    MatchmakingScene.ts   "Buscando partida..." + presentación VS
    MatchScene.ts         Partido, reglas, HUD, golpes, efectos
    ResultScene.ts        Victoria/Derrota + Revancha/Menú
  objects/
    Character.ts          Personaje vectorial con raqueta (reemplazable por sprites)
    Ball.ts               Física pseudo-3D (altura z), sombra y estela
  logic/
    Score.ts              Marcador de tenis
    BotAI.ts              IA del bot
  ui/
    theme.ts              Colores, tipografía, fondos
    Button.ts             Botón con relieve y rebote
    Joystick.ts           Joystick virtual flotante
    AbilityButton.ts      Botón de habilidad con cooldown radial
android/                  Proyecto nativo (landscape bloqueado + inmersivo en MainActivity)
```

## Reemplazar el arte

`Character` está formado por `shadow`, `rig > torso` (cuerpo) y `rig > racketArm` (brazo + raqueta que pivota en el hombro). Sustituye los `Graphics` de `torso` y `racketArm` por `Sprite`s y las animaciones de golpe/idle siguen funcionando.
