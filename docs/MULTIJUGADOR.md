# Multijugador LAN 1v1

Dos teléfonos en la misma WiFi juegan un partido 1v1 contra un servidor Node.js + Socket.IO que corre en el PC.
Sin Internet, sin Render y sin Supabase. El mismo backend se podrá desplegar en Render más adelante.

## Estructura del repositorio

```
NxoGames/
├── frontend/   juego (Phaser 3 + TypeScript + Vite + Capacitor/Android). Antes estaba en la raíz.
├── backend/    servidor (Node + TypeScript + Express + Socket.IO)
├── docs/       documentación (este archivo, RANKED.md)
└── _tmp/       respaldos locales (ignorado por git)
```

- **Frontend:** `frontend/src`, `frontend/public`, `frontend/android`, `frontend/tools`. Los comandos de siempre
  (`npm run dev`, `npm run build`, `npm run apk`) se ejecutan **dentro de `frontend/`**.
- **Backend:** `backend/src`:
  - `server.ts`: arranque.
  - `config/env.ts`: puerto, CORS y tiempos.
  - `api/`: REST; hoy `/api/health`.
  - `socket/events/protocol.ts`: eventos.
  - `socket/rooms/`: salas, matchmaking y marcador oficial.
  - `socket/handlers/`: Socket.IO.
- El frontend **no usa React**. Se mantuvo Phaser, la tecnología actual, sin cambiar de framework.

## Puesta en marcha (paso a paso)

1. **Instalar el backend** (una vez):
   ```bash
   cd backend
   npm install
   ```
2. **Arrancar el servidor:**
   ```bash
   npm run dev
   ```
   Escucha en `0.0.0.0:3001` y muestra las IPv4 del PC. Otro puerto: `PORT=4000 npm run dev`.
3. **Ver la IPv4 del PC:**
   1. En Windows, abre una terminal y ejecuta `ipconfig`.
   2. Busca el adaptador de la WiFi (o Ethernet) en la misma red que los teléfonos.
   3. Anota su **Dirección IPv4**, por ejemplo `192.168.1.20`.
   - La IP puede cambiar si cambia la red: vuelve a mirarla y actualízala en el juego.
   - El servidor también la muestra al arrancar.
4. **Firewall:** la primera vez Windows pregunta si Node puede usar la red. Permite **Redes privadas**. Si no
   aparece, abre el puerto 3001 (TCP) en el firewall.
5. **Configurar el juego** en cada teléfono:
   1. Ve a Menú > ⚙ Ajustes > **SERVIDOR LAN** y escribe la IP (por ejemplo `192.168.1.20` o `192.168.1.20:3001`).
   2. Para volver a jugar solo contra el BOT, deja el campo vacío.
   - Se guarda en el teléfono y se cambia cuando quieras, sin tocar la lógica del juego.
6. **Instalar el APK** (incluye permiso de tráfico local sin cifrar):
   ```bash
   cd frontend
   npm run apk
   ```
   El APK queda en `frontend/android/app/build/outputs/apk/debug/game-nxo.apk`.
7. **Conectar los dos teléfonos a la misma WiFi** que el PC y pulsar **JUGAR** en ambos con menos de 5 s de
   diferencia.

Para probar en el PC sin teléfonos, abre dos pestañas de `npm run dev` y configura en ambas `127.0.0.1:3001`.

## Flujo de JUGAR

1. JUGAR, con un servidor configurado, abre la escena `LanSearch` y pide partida (`mm:find`). Sin servidor
   configurado, JUGAR abre el flujo BOT de siempre, igual que antes.
2. El servidor busca una sala **WAITING** de otro jugador:
   - Si existe, se une: la sala pasa a **FULL** y de inmediato a **PLAYING**.
   - Si no, crea una WAITING (1/2) y arranca **su** temporizador de 5 s.
3. Emparejados: los dos reciben `mm:matched`, ven la pantalla VS y entran al partido sin confirmaciones.
4. Sin rival en 5 s: el servidor borra la sala y envía `mm:timeout`. Aparece "SIN RIVAL · ¿Quieres jugar contra
   el BOT?":
   - **JUGAR VS BOT** abre exactamente el flujo BOT de siempre (Ranked con la apuesta elegida o AMISTOSO).
   - **MENÚ** vuelve al menú.
   - Lo mismo ocurre si el servidor no responde.
5. CANCELAR durante la búsqueda envía `mm:cancel` y libera la sala.

### Reglas de salas (servidor)

- Cada sala tiene ID único, estado (WAITING / FULL / PLAYING / FINISHED), máximo 2 jugadores (host y guest),
  fecha de creación, marcador oficial y resultado.
- Una sala completa o en juego nunca acepta un tercero; un tercer jugador crea su propia sala.
- Un jugador no puede estar en dos salas (`mm:error already_searching / already_in_room`).
- **Dos JUGAR casi simultáneos:** Node procesa los eventos de uno en uno. El primero crea la sala y el segundo se
  une; no hay ventana en la que los dos creen sala.
- **Sin salas fantasma:** al vencer la búsqueda, al cancelar o al desconectarse buscando, la sala se borra.
- **No hay límite de tiempo de partido.** La sala se libera solo cuando termina oficialmente (2 juegos), por
  abandono o por desconexión. Después los dos pueden volver a buscar.

## Sincronización del partido: autoridad por posesión

El motor es `frontend/src/scenes/MatchScene.ts`, el mismo del modo BOT. Cada teléfono lo ejecuta con **su**
jugador abajo; el rival es el "bot" **sin IA**. Esto se activa solo cuando la escena recibe `net`; sin `net`, el
modo BOT no cambia.

- **Golpes y saques propios:** al golpear se envía la pelota resultante (`game:hit`: posición, velocidad,
  efecto, potencia o fuego, tipo de golpe) junto con los datos REALES del golpe (cargado/remate, volea, remate por
  arriba, estirada, saque con efecto). El otro teléfono la aplica como un golpe del bot, con la misma animación y
  efectos; la devolución del impacto de una bola de fuego llega con `impact` y no anima un golpe.
- **Un único juez por pelota:** el teléfono que **recibe** la pelota decide si se devuelve, si sale, si da en la
  red, si bota dos veces, si es falta o let.
  - Envía el resultado (`game:point`) y el otro lo aplica sin calcularlo. Nunca hay dos resultados distintos.
  - Las faltas de lanzamiento (no golpear la pelota o agotar el tiempo de saque) las decide quien saca.
- **Habilidades:**
  - **SMASH / INFERNO:** la pelota llega como bola de fuego y, al alcanzarla, se aplica el impacto de siempre:
    aturdido y devolución floja, que vuelve como golpe normal.
  - **SMASH armado:** el rival ve tu aura (`smash-armed` / `smash-disarmed`).
  - **Cinemáticas (SMASH 1 s, INFERNO 2 s):** al empezar, el emisor avisa (`smash-cine` / `inferno-cine`) y el
    rival congela su partido el mismo tiempo y ve la misma cinemática enfocada en el actor rival (salto del
    SMASH; desplazamiento con sombras del INFERNO). El golpe real sigue llegando con `game:hit`: si llega mientras
    dura la cinemática, se aplica al terminar, una sola vez.
  - **Aturdido:** al alcanzar una bola de fuego, el emisor avisa (`stunned` con `ms`) y el rival ve la explosión,
    el aturdido y las estrellas durante esos ms.
  - **DASH:** el rival ve el sprint (`game:action`).
  - **Emotes:** el emote elegido sale también sobre la cabeza del rival (`emote`).
- **Movimiento:** cada teléfono envía la posición de su jugador unas 20 veces por segundo (`game:state`). El
  otro la suaviza.
- **Espejo:** cada uno envía sus coordenadas y el receptor las refleja por la red y el eje lateral
  (`frontend/src/net/mirror.ts`).
- **Saque:** el host saca el primer juego y luego se alterna (`Score.serverOffset` en el invitado).
- **Marcador oficial:**
  - El servidor aplica los `game:point` del juez con las mismas reglas que `Score.ts` (15/30/40, ventaja,
    2 juegos para ganar).
  - Cuando alguien gana, envía `game:over` a los dos y libera la sala.
  - Si un teléfono no llegó al final por un mensaje perdido, termina con el resultado del servidor.
- **Diferencias con el modo BOT:**
  - Sin pared del fondo, para que las dos mitades sean iguales.
  - Rendirse no pausa el partido.
- **Latencia:** cada uno golpea sin retraso. Solo el rival se ve con el retardo de la red (en LAN, unos
  10-30 ms).
- **Futuro servidor autoritativo:** el protocolo ya separa entradas, golpes y resultados. Se puede mover la
  simulación al backend y que el servidor sea el juez de todas las pelotas sin cambiar las mecánicas.

## Inicio del partido y pantalla VS

- **Escucha temprana:** la sesión (`frontend/src/net/MatchNet.ts`) escucha inicio, fin, abandono y desconexión
  **desde el emparejamiento**. Lo que llega mientras se cambia de escena se guarda y se entrega al partido;
  no se pierde nada.
- **Pantalla VS (2,7 s):** si el rival abandona o se cae la conexión, no se entra al partido. Aparece
  "PARTIDA CANCELADA" con dos opciones: BUSCAR otra partida o MENÚ.
- **Partido cargado pero sin salida:**
  - Si el rival se va antes de `game:start`, aparece "EL RIVAL ABANDONÓ" y se vuelve al menú sin resultado.
  - Si no llega la salida en **15 s** (`NET_START_WAIT_MS` en MatchScene; el servidor la da a los 12 s como
    máximo), se avisa al servidor (`game:leave`) y se vuelve al menú.
- **Mensajes repetidos:** los golpes y puntos repetidos o atrasados (mismo número de secuencia) se descartan en
  el cliente; el servidor ya los descartaba del marcador oficial.

## Desconexiones

| Situación | Qué pasa |
|---|---|
| Cancelar la búsqueda / salir de la escena | `mm:cancel`: se borra la sala |
| Desconexión buscando | el servidor borra la sala |
| Rendirse en partido | `game:leave`: gana el rival (`game:opponent-left` + `game:over`, motivo `abandon`) |
| Se cae la conexión de un jugador en partido | el servidor lo detecta en unos 5-10 s (ping): gana el rival (motivo `disconnect`) y se libera la sala |
| El teléfono pierde el servidor | aparece "SIN CONEXIÓN" y el partido termina para él |

**Reconexión:** no se implementa en esta etapa; un corte cuenta como abandono. Para añadirla habría que:
- Dar un id de jugador estable (no el id del socket).
- Mantener la sala PLAYING unos segundos esperando al jugador.
- Reenviar el marcador oficial y el estado del punto al volver.

El motor ya admite empezar un punto con un marcador dado.

## Eventos Socket.IO

Están definidos en `backend/src/socket/events/protocol.ts`, con una copia idéntica en
`frontend/src/net/protocol.ts`.

| Evento | Sentido | Datos | Responsabilidad |
|---|---|---|---|
| `mm:find` | cliente → servidor | `{ profile: { name, level, skin } }` | buscar rival (JUGAR) |
| `mm:cancel` | c → s | — | cancelar la búsqueda |
| `mm:searching` | s → c | `{ roomId, timeoutMs, players }` | sala creada, esperando |
| `mm:matched` | s → c | `{ roomId, role: host\|guest, opponent, gamesToWin }` | emparejados |
| `mm:timeout` | s → c | — | sin rival en 5 s (sala borrada) |
| `mm:cancelled` | s → c | — | búsqueda cancelada |
| `mm:error` | s → c | `{ code, message }` | ya buscando / ya en sala / datos inválidos |
| `game:ready` | c → s | — | escena del partido cargada |
| `game:start` | s → c | `{ roomId }` | empiezan los dos (o al vencer `READY_TIMEOUT_MS`) |
| `game:state` | c → s → rival | `{ t, x, y, moving, dirX, facing, charging, stunned }` | posición del jugador (~20 Hz) |
| `game:hit` | c → s → rival | `{ seq, kind: hit\|serve, ball, x, y, shotKind, power, inferno, charged, overhead, volley, serveSpin?, lunge?, impact? }` | golpe o saque con la pelota resultante y los datos reales del golpe (ver abajo) |
| `game:action` | c → s → rival | `{ kind, data }` (ver abajo) | animaciones y habilidades |
| `game:point` | c → s (+ rival) | `{ seq, kind: point\|fault\|let, to: me\|opponent, reason, color }` | resultado decidido por el juez; los `point` suman al marcador oficial |
| `game:score` | s → c | `{ points: {host,guest}, games: {host,guest} }` | marcador oficial tras cada punto |
| `game:over` | s → c | `{ winner, reason: score\|abandon\|disconnect, games }` | fin oficial (la sala se libera) |
| `game:opponent-left` | s → c | `{ reason: abandon\|disconnect }` | el rival se rindió o se desconectó |
| `game:leave` | c → s | — | rendirse |

### Campos de `game:hit`

| Campo | Significado |
|---|---|
| `ball` | pelota resultante: `x, y, z, vx, vy, vz` y, si existen, `damp`, `fric` y `ay` (curva del saque con efecto; el receptor la espeja) |
| `charged` | golpe fuerte del emisor: tiro cargado o remate (antes siempre `false`) |
| `overhead` | el emisor golpeó por arriba (remate / smash con salto); valor real, ya no se deduce de la altura |
| `volley` | volea en la red (valor real; antes siempre `false`) |
| `serveSpin` | (opcional) el saque era con efecto |
| `lunge` | (opcional) estirada: lado `+1/-1` en las coordenadas del emisor; el receptor lo espeja y anima la estirada |
| `impact` | (opcional) devolución del impacto de una bola de fuego: el emisor está aturdido; el receptor no anima un golpe |
| `power` / `inferno` | bola de fuego (SMASH / INFERNO); con `inferno` el receptor muestra la esfera de fuego |

### Acciones de `game:action`

| `kind` | `data` | Qué ve el rival |
|---|---|---|
| `toss` / `catch` | `kind` (normal\|spin) / — | lanzamiento del saque / lo atrapa |
| `sprint-start` / `sprint-end` | `dirX` / — | DASH |
| `stunned` | `ms` (duración del aturdido) | explosión, aturdido y estrellas |
| `emote` | `kind` (happy\|cool\|wow) | globo con la carita sobre su cabeza |
| `smash-armed` / `smash-disarmed` | — | aura del SMASH armado |
| `smash-cine` | `x, y` (posición del emisor), `overhead`, `ms` (parte congelada del emisor) | partido congelado el mismo tiempo (`ms` es informativo: los dos teléfonos usan el mismo perfil de `SMASH_CINE`) y pose del remate (con salto) |
| `inferno-cine` | `x, y` (desde), `tx, ty` (punto de contacto), `ms` (informativo, perfil `INFERNO_CINE`), `power` (poder elegido: `fire`, `ice`, `wind` o `lightning`; sin él, el del personaje) | partido congelado, concentración y desplazamiento con sombras; su bola del INFERNO es la de ese poder |

Las coordenadas de `data` son las del emisor; el receptor las espeja (`mirror.ts`). La carga (`charging`)
viaja en `game:state` y se ve como la pose de carga del rival.
## Configuración del backend (variables de entorno)

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | 3001 | puerto (Render lo define solo) |
| `HOST` | 0.0.0.0 | interfaz; 0.0.0.0 = toda la red local |
| `CORS_ORIGIN` | `*` | orígenes permitidos, separados por coma (en producción: `https://localhost,capacitor://localhost,...`) |
| `TRUST_PROXY` | 0 | 1 detrás de nginx / ALB (IP real por X-Forwarded-For) |
| `MAX_MATCH_MS` | 1800000 | duración máxima de un partido; al pasarla se cierra por tiempo (gana quien vaya arriba) |
| `MAX_PAYLOAD_BYTES` | 8192 | tamaño máximo de un mensaje del cliente; más grande corta la conexión |
| `DRAIN_TIMEOUT_MS` | 120000 | al recibir SIGTERM, espera máxima a que terminen los partidos en curso |

Producción (AWS): `npm run build` y `npm run start:prod` con **un solo proceso** (las salas viven en memoria).
Archivos listos en `backend/deploy/` (systemd y pm2) y `backend/.env.example`. Los mensajes del cliente se validan y
limitan por segundo (`src/socket/guard.ts`); `STATE` se envía como volátil.
| `SEARCH_TIMEOUT_MS` | 5000 | tiempo máximo de búsqueda |
| `READY_TIMEOUT_MS` | 12000 | espera máxima a que los dos carguen |
| `GAMES_TO_WIN` / `GOLDEN_POINT` | 2 / 0 | reglas (las mismas que `frontend/src/config.ts`) |

## Pruebas

- **Automáticas** (`cd backend && npm test`, 13 pruebas):
  - Salas y matchmaking: 1/2 → 2/2, emparejar a los 4 s, timeout sin sala fantasma, máximo dos, una sala por
    jugador, JUGAR simultáneos, cancelar, marcador oficial hasta 2 juegos, puntos repetidos, abandono y sin
    límite de tiempo.
  - Extremo a extremo con dos clientes Socket.IO reales: emparejar, START, reenvío, fin oficial, nueva
    búsqueda, timeout y desconexión.
- **Manuales con dos teléfonos (o dos pestañas):**
  1. **Pareja:** A pulsa JUGAR y B pulsa JUGAR antes de 5 s → los dos entran al partido.
  2. **Límite de dos:** con A y B jugando, C pulsa JUGAR → C no entra a esa sala (crea la suya; a los 5 s le
     ofrece el BOT).
  3. **Timeout:** solo A pulsa JUGAR → a los 5 s "SIN RIVAL". JUGAR VS BOT abre el partido contra el BOT de
     siempre; MENÚ vuelve al menú.
  4. **BOT intacto:** deja vacío Ajustes > SERVIDOR LAN → JUGAR va directo al BOT como antes.
  5. **Desconexiones:**
     - Cierra la app de B en pleno partido → A ve "RIVAL DESCONECTADO" y gana.
     - Rendirse → el rival ve "EL RIVAL SE RINDIÓ".
     - Apaga el servidor → los dos ven "SIN CONEXIÓN".
  6. **Fin y liberación:**
     - Al llegar a 2 juegos, el servidor registra `sala … terminada: gana …` y `/api/health` vuelve a
       `rooms: 0`.
     - OTRA PARTIDA vuelve a buscar.
- **Estado del servidor:** `http://<IP>:3001/api/health` (salas y jugadores).

## Limitaciones conocidas de esta etapa

- El rival se ve con su personaje real (`opponent.skin`). Si los dos eligen el mismo, se ven iguales. Las hojas
  frontales solo traen las animaciones básicas (idle, correr, golpes, saque, smash, victoria): el resto de poses
  usa los respaldos de siempre.
- Las partidas LAN no tocan Ranked: no hay apuesta ni liquidación. Dan la EXP, las monedas del partido y la
  ruleta de siempre.
- La seguridad es la de una red local de confianza: el servidor valida salas, roles y marcador, pero cree los
  golpes que envía cada cliente. El servidor autoritativo y las cuentas llegarán con la etapa online.
