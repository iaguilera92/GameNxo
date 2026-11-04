==========================================================================
 GAME NXO (nombre provisional) - Estado del proyecto y guía para continuar
==========================================================================
Última actualización: 04-11-2026

--------------------------------------------------------------------------
1. QUÉ ES
--------------------------------------------------------------------------
Juego móvil Android de tenis 1 vs 1 contra un bot, en VERTICAL (portrait),
con cámara detrás del jugador tipo Mario Tennis. Cada jugador tiene un
personaje con 2 habilidades y nivel (1 a 30).

Definición corta: App mobile Android: motor Phaser 3 en TypeScript, build
con Vite y empaquetado con Capacitor (APK).

Stack:
- Phaser 3.90 + TypeScript 5.6 + Vite 5 (el juego, 2D). No usa React.
- Capacitor 6.2.1 (empaqueta el juego como app Android nativa).
- Gradle (assembleDebug) para generar el APK.
- Node.js solo se usa en el PC para instalar/compilar (no va en el APK).

Decisiones:
- Se mantiene Capacitor. Expo Go solo ejecuta React Native: descartado.
- Capacitor 7+ exige JDK 21. Se usa Capacitor 6 (JDK 17).
  No actualizar Capacitor sin pasar a JDK 21.

--------------------------------------------------------------------------
2. ESTADO ACTUAL (HECHO)
--------------------------------------------------------------------------
[x] Carga: logo "GAME NXO", "Cargando..." y barra animada.
[x] Menú: nivel + XP, título, personaje en idle, PERSONALIZAR y JUGAR.
[x] Personalizar (simple): personaje, nombre, nivel/XP, estilo (Clásico,
    otros bloqueados), habilidades equipadas con descripción y recarga,
    y "Tienda · próximamente" con habilidades bloqueadas y precio.
[x] Matchmaking simulado: "Buscando partida...", tarjeta VS vertical.
[x] Partido vertical en perspectiva fuerte (tú abajo de espaldas, rival
    arriba de frente). Estadio con público, gradas laterales, vallas,
    focos. La cámara sigue un poco al jugador en lateral.
[x] Física pseudo-3D: la pelota tiene altura z, gravedad, bote y red.
[x] Golpe automático al entrar la pelota en el alcance de la raqueta.
    El tipo de golpe lo decide el joystick JUSTO al golpear (o su última
    dirección en los últimos 250 ms):
      abajo = pelota corta | arriba = globo | izq/der = a esa esquina |
      neutro = golpe normal.
[x] DASH (10 s): el jugador desaparece y reaparece donde llegará la
    pelota (solo si la pelota viene hacia ti).
[x] SMASH (30 s): la pelota se prende fuego; el siguiente golpe es una
    bola de fuego. Si el rival la toca: devuelve flojo, sale despedido
    hacia atrás y queda aturdido 1 s (estrellas sobre la cabeza).
[x] Botones de habilidad con relleno radial, anillo y segundos.
[x] Rendirse: icono de bandera arriba a la derecha. Pausa y pregunta
    "¿Seguro que quieres rendirte?" (Rendirse = derrota, Seguir).
[x] Joystick flotante semitransparente (zona inferior izquierda).
[x] Reglas: mejor de 3 juegos, 0-15-30-40-juego, ventaja simplificada.
    Fuera, red o doble bote = punto. Saque automático, sin faltas.
[x] Bot con IA simple. Dificultad con BOT_DIFFICULTY.
[x] Resultado: Victoria/Derrota, +XP, barra de nivel, "¡Subiste a nivel!",
    Revancha y Menú.
[x] Perfil guardado en el dispositivo (localStorage): nivel, XP, estilo,
    habilidades equipadas. Victoria +60 XP, derrota +25 XP.
[x] Android: vertical bloqueado (portrait) y pantalla completa inmersiva.
    Nombre de la app: "Game Nxo".

Pendiente de verificar a mano en un teléfono real:
- Tamaño/posición de controles, que el bot sea ganable, FPS en gama baja.

--------------------------------------------------------------------------
3. ESTRUCTURA DEL CÓDIGO
--------------------------------------------------------------------------
src/main.ts                Config de Phaser. Escala EXPAND sobre 720x1280.
src/config.ts              TODAS las constantes ajustables (sección 6).
src/view/projection.ts     Proyección en perspectiva (cancha -> pantalla).
                           VIEW: NEAR_Y, FAR_Y, NEAR_W, RATIO (fuerza de
                           perspectiva), Z_K, CHAR_K, FOLLOW (cámara).
src/scenes/
  BootScene.ts             Carga.
  MenuScene.ts             Menú principal.
  CustomizeScene.ts        Personalizar (personaje, estilo, habilidades).
  MatchmakingScene.ts      Búsqueda simulada -> Match { botName }.
  MatchScene.ts            Partido: fases, reglas, golpes, habilidades,
                           HUD, rendirse, cámara, estadio.
  ResultScene.ts           Resultado + XP. Recibe ResultData.
src/objects/
  Character.ts             Personaje vectorial. view 'back' (jugador) o
                           'front' (rival/menús). Jerarquía: shadow,
                           rig > torso, rig > racketArm. swing(), setMoving().
  Ball.ts                  stepBall (física), aimShot (apuntar a un punto
                           pasando la red), predictIntercept (usado por
                           Dash), Ball (sprite, sombra, estela, fuego).
src/logic/
  Score.ts                 Marcador de tenis.
  BotAI.ts                 IA del bot.
  Profile.ts               Perfil local: nivel 1-30, XP, addXp().
  Abilities.ts             Catálogo de habilidades (dash, smash y las
                           bloqueadas de la tienda).
src/ui/
  theme.ts, Button.ts, Joystick.ts, AbilityButton.ts,
  LevelBadge.ts (nivel + barra XP), icons.ts (iconos de habilidades).
android/                   Proyecto nativo (Capacitor).
  AndroidManifest.xml      screenOrientation="portrait"
  MainActivity.java        modo inmersivo
  res/values/strings.xml   nombre "Game Nxo"

Detalles técnicos clave:
- La física usa coordenadas lógicas de cancha: x = profundidad (jugador
  en x pequeños, rival en x grandes, red en NET_X), y = lateral, z = altura.
  Todo se dibuja pasando por project(x, y, z). Para cambiar la cámara,
  tocar solo VIEW en projection.ts.
- Joystick (pantalla) -> cancha: arriba = hacia la red, derecha = +y.
- Fases del partido: intro -> serve -> toss -> rally -> pointover -> over.
- Profundidad de dibujo (depth) = y en pantalla del punto en el suelo.
- Teclado para probar en PC: WASD/flechas mover, Q/J dash, E/K smash.

--------------------------------------------------------------------------
4. PREPARAR UN COMPUTADOR NUEVO (Windows)
--------------------------------------------------------------------------
1) Node 18+ (probado con Node 24).
2) JDK 17 (no 21).
3) Android SDK: platform-tools, platforms;android-34, build-tools;34.0.0
   (Android Studio, o solo "command line tools" + sdkmanager).
4) Variables de usuario JAVA_HOME y ANDROID_HOME.
   PC original: %USERPROFILE%\devtools\jdk\jdk17 y
                %USERPROFILE%\devtools\android-sdk
   Evitar "+" en la ruta de JAVA_HOME (falla sdkmanager.bat).

Tras clonar:  npm install  ->  npm run build  ->  npx cap sync android
Si Gradle no encuentra el SDK, crear android/local.properties con:
   sdk.dir=C:\\ruta\\al\\android-sdk
No se suben al repo (se regeneran): node_modules, dist, android/app/build,
android/local.properties, android/app/src/main/assets/public.

--------------------------------------------------------------------------
5. COMANDOS
--------------------------------------------------------------------------
npm run dev          Navegador: http://localhost:5173
                     Móvil en la misma Wi-Fi: http://<IP-del-PC>:5173
                     (no abrir index.html con doble clic: sale en blanco)
npm run build        Compila -> dist/
npx cap sync android Copia dist/ al proyecto Android.
npm run apk          build + sync + gradlew assembleDebug.

APK: android\app\build\outputs\apk\debug\app-debug.apk
Instalar por USB: adb install -r android\app\build\outputs\apk\debug\app-debug.apk
Recarga en vivo por USB: npx cap run android -l --external

--------------------------------------------------------------------------
6. CONSTANTES AJUSTABLES (src/config.ts)
--------------------------------------------------------------------------
GAME_NAME            "GAME NXO" (nombre mostrado; cambiar aquí).
BOT_DIFFICULTY       0..1 (actual 0.45).
GAMES_TO_WIN 2, GOLDEN_POINT false (true = punto de oro en 40-40).
DASH_COOLDOWN 10, SMASH_COOLDOWN 30, SMASH_SPEED_MULT 1.75,
STUN_DURATION 1.0, KNOCKBACK_DIST 110.
MAX_LEVEL 30, XP_WIN 60, XP_LOSS 25, xpToNext(nivel) = 100 + (nivel-1)*50.
COURT, NET_X, NET_HEIGHT, GRAVITY, BOUNCE_DAMP, SHOT_SPEED, SERVE_SPEED,
PLAYER_SPEED, HIT_RANGE, HIT_MAX_Z, SIDE_MARGIN.
Tipos de golpe (velocidad/altura/zona): MatchScene.playerHit().
Cambiar el nombre de la app Android: capacitor.config.ts (appName) y
android/app/src/main/res/values/strings.xml.

--------------------------------------------------------------------------
7. PRÓXIMOS PASOS SUGERIDOS
--------------------------------------------------------------------------
1) Probar en teléfono real y ajustar controles, dificultad y velocidades.
2) Monedas + tienda real: comprar habilidades (Muro, Efecto, Hielo) y
   equiparlas (Profile.abilities ya existe; falta lógica de cada una).
3) Estilos/skins del personaje (colores ya preparados en CharacterLook).
4) Recompensas por nivel (1-30): desbloqueos de estilos/habilidades.
5) Sonido y música; vibración (@capacitor/haptics v6).
6) Arte real: sustituir Graphics de Character por sprites.
7) Icono y splash de la app (@capacitor/assets).
8) Botón "atrás" de Android -> abrir diálogo de rendirse (@capacitor/app).
9) Publicación: AAB firmado (bundleRelease), versionCode/versionName.
10) Online futuro: matchmaking real (WebSockets / Colyseus).

--------------------------------------------------------------------------
8. NOTAS PARA LA IA QUE CONTINÚE
--------------------------------------------------------------------------
- Responder al usuario en español y de forma resumida.
- Trabajar por etapas, compilar (npm run build) tras cada cambio y decir
  qué probar en el teléfono.
- No cambiar el stack sin consultar (Phaser + Capacitor 6 + JDK 17).
- Versiones exactas fijadas en package.json.
- En Character no usar la propiedad "body" (choca con Phaser): es "torso".
- Antes del APK siempre: npm run build && npx cap sync android.
- Al destruir un Text, eliminar antes cualquier time.addEvent que lo
  actualice: un error dentro del bucle de Phaser congela todo el juego.
- La fuente Lilita One no tiene emojis: no usar emojis en textos.
- Para revisar pantallas sin teléfono se usaron capturas con Chrome
  headless (--screenshot, --virtual-time-budget). Requiere forzar
  fps.forceSetTimeOut en Phaser solo durante la captura.
- npm audit reporta vulnerabilidades en dependencias de desarrollo
  (vite 5 / cli); pendiente de revisar.
