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
    el aturdido y las estrellas durante esos ms. Con la ULTI la raqueta sale volando: el emisor dice dónde cae
    (`racket` con `lost` y `x, y`) y avisa cuando la recoge (`racket` con `lost: false`).
  - **DASH:** el rival ve el sprint (`game:action`).
  - **Emotes:** el emote elegido sale también sobre la cabeza del rival (`emote`).
- **Movimiento:** cada teléfono envía la posición de su jugador unas 20 veces por segundo (`game:state`); quieto, un
  latido cada 250 ms, y al arrancar a moverse se envía al tiro. El otro la suaviza (`frontend/src/net/interp.ts`,
  100 ms en el pasado): el movimiento empieza 50 ms antes del primer estado en movimiento y, si faltan estados, el
  rival sigue en su dirección hasta 120 ms. Cada estado lleva `pt` (2 · puntos jugados + 1 si ya se colocó para el
  saque): al colocarse para un punto se descartan durante 2,5 s los estados del punto anterior (tras una reconexión no
  se filtra). Al salir de una cinemática el rival sigue desde donde quedó.
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
| `game:state` | c → s → rival | `{ t, x, y, moving, dirX, facing, charging, stunned, pt? }` | posición del jugador (~20 Hz) |
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
| `stunned` | `ms` (duración del aturdido), `kind` (smash\|inferno) | explosión, aturdido y estrellas; con `inferno` el rival usa los clips de la ULTI (`ulti-hit` / `ulti-stun`) |
| `racket` | `lost: true` + `x, y` (dónde cae) / `lost: false` | su raqueta cae en la cancha y queda en el suelo / la recogió |
| `bump` | `ms` | recibió mi golpe cargado al máximo (no cortita ni globo) y retrocede un poco: el rival solo pone el polvo y la sacudida; la posición llega con `game:state`. Lo decide y mueve SU teléfono |
| `remate-start` / `remate-end` | `slow` (cámara lenta), `t` (s de juego hasta el contacto) / — | la misma cámara lenta mientras apunta su remate y su salto (sin acercar la cámara); termina con `remate-end` o con su golpe |
| `emote` | `kind` (happy\|cool\|wow) | globo con la carita sobre su cabeza |
| `smash-armed` / `smash-disarmed` | — | aura del SMASH armado |
| `smash-cine` | `x, y` (posición del emisor), `overhead`, `ms` (parte congelada del emisor) | partido congelado el mismo tiempo (`ms` es informativo: los dos teléfonos usan el mismo perfil de `SMASH_CINE`) y pose del remate (con salto) |
| `inferno-cine` | `x, y` (desde), `tx, ty` (punto de contacto), `ms` (informativo, perfil `INFERNO_CINE`), `power` (poder elegido: `fire`, `ice`, `wind`, `lightning` o `tulip`; sin él, el del personaje) | partido congelado, concentración y desplazamiento con sombras; su bola del INFERNO es la de ese poder |

Las coordenadas de `data` son las del emisor; el receptor las espeja (`mirror.ts`). La carga (`charging`)
viaja en `game:state` y se ve como la pose de carga del rival.

El aro del suelo de esa carga (efecto de carga: `classic`, `fire`, `energy` o `tulip`) lo elige cada jugador en
PERSONALIZACIÓN y viaja en el perfil de la búsqueda (`PlayerProfile.charge`, opcional). El servidor solo lo deja pasar si
es uno de esos cuatro; sin él, el rival usa el de su personaje (Nxo = `fire`, Mai = `tulip`). Es solo visual.
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
limitan por segundo (`src/socket/guard.ts`); `STATE` se envía como volátil. `game:action` reenvía CUALQUIER acción
con nombre válido (minúsculas, números y guiones; son solo visuales): una acción visual nueva del cliente no obliga a
redesplegar el backend (cada cliente ignora las que no conoce).
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

## Duelo en la red (DUELO RED)

Un peloteo en la red nunca se alarga: se convierte en el duelo (1 vez por punto, < 8 s) y acaba siempre en un GLOBO DISPARADO.
Flujo: intro (~1,2 s, miradas, cámara a la red, DEFENSIVO/ESPECIAL bloqueados) → 3 rondas (peloteo auto 2-3 golpes + aro que se cierra en 1 s; cada uno toca y se mide la diferencia en ms con el cierre) → gana quien gane más rondas (empate: el que recibía) → el ganador apunta (joystick izq/der, 1 s) → globo con tiempo de vuelo ajustado al rival.
Disparo: receptor cerca de la red y pelota a su alcance, o `forceAfterShots` (6) golpes en el punto.

Acciones (`ActionKind`):
- `duel-start {x,y,a,b,c}`: lo manda el receptor (juez); posiciones y plan de golpes por ronda.
- `duel-tap {r,ms}`: cada teléfono manda solo su diferencia en ms (9999 = sin toque).
- `duel-round {r,w,p,b}`: el juez avisa cada ronda (w: 1 = jugador del emisor, 2 = su rival, 0 = empate).
- `duel-result {w}`: resultado final del juez.
- `duel-aim {side}`: lado del globo. Solo lo usa el teléfono del perdedor por si no llega el globo: **no se le muestra** (17-11-2026: misterio, ve los dos lados iguales hasta que sale el globo).

El globo del ganador llega como `game:hit` (shock + lob); el que lo recibe cancela el duelo (`duelAbort('hit')`) y no lo intercepta durante `lobGraceMs`. Si algo no llega: espera `netWaitMs` y usa su propio recuento; si no llega el globo, lo simula tras `hitWaitMs`. Se cancela en `netResume`, punto o fin de partido. Constantes en `frontend/src/logic/NetDuel.ts` (`NET_DUEL`). Prueba: `node tools/test-net-duel.mjs`. Apagar: `localStorage 'dev.netDuelOff'`.

## Sin ULTI contra ULTI (21-11-2026, decidido con el usuario)
Una ULTI no se puede devolver con otra. La que se lanza primero queda "en juego" y la ULTI del otro lado queda **bloqueada** (botón apagado, no se arma ni se ejecuta) hasta que el golpe llega, el que lo recibe recupera la raqueta y deja el aturdido. Entonces se vuelve a habilitar. Un punto nuevo la libera siempre; si el golpe no llega a nadie (fuera, rebote), se libera a los ~1 s.
- Estado en `MatchScene`: `ultiOwner` / `ultiVictim` / `ultiLanded` (`ultiStart`, `ultiHit` desde `ultiStunOn`, `ultiBlocked`, `ultiTick`). Bloquea: `armInferno`, `tryInferno`, el botón (`syncAbilityLock`) y la ULTI del bot (`botUlti`). Vale en 1v1 contra bot, 1v1 online y 2v2 (la del compañero bloquea a los bots y la de un bot, a los humanos).
- **Online:** cada teléfono marca la ULTI del rival al recibir su `inferno-cine` y la suya al lanzarla. Si las dos salen a la vez (se cruzan por la red) gana la del **anfitrión**: el invitado cancela la suya (queda armada y con su carga) y muestra la del anfitrión, y el anfitrión ignora la del invitado (`ultiAcceptRemote`). Si la mía ya está en vuelo, la del rival se ignora.
- Sin probar con dos teléfonos reales.

## 2v2 (21-11-2026)
- **Contra bots (hecho, solo offline):** tú + aliado BOT contra 2 rivales BOT (`MatchScene.doubles`, `ally`, `rivalActors`, `doublesTick`, `allyHit`). El botón 2v2 del menú arranca `Matchmaking` con `mode: '2v2'`. Formación uno arriba / uno atrás, saque alternado entre los rivales, un solo ESPECIAL / ULTI rival por punto.
- **Online (decidido): 2 humanos del MISMO equipo contra 2 bots que simula el HOST.** Reglas acordadas:
  - Si un jugador se desconecta o se rinde, **un bot juega por él**; si fue un corte puede volver con su clave y recupera su personaje (`MATE_AWAY` / `MATE_BACK`). Si se va el host (se rinde, o se corta y no vuelve en el tiempo de gracia), **su compañero pasa a ser el anfitrión** y el partido sigue (ver "El anfitrión se va"); solo termina si el compañero también estaba fuera.
  - **El host es el juez único de los puntos** (el `game:point` del compañero se ignora en el servidor).
  - Compañeros: **nada se espeja** (los dos ven su campo abajo; `MatchNet` con `mode === '2v2'`).
  - **EXP y ruleta (decidido, 19-11-2026):** igual que el 1v1 (190 / 95; rendirte 0; ruleta con las mismas reglas). **Ranking 2v2 (decidido):** MONEDAS 2v2, contador propio (+30 ganar, −15 perder, −30 rendirse, nunca bajo 0; online y contra bots; `domain/coins2v2.ts`, franja en `MatchEndScene.coins2v2Row`). No usa las monedas de la Liga ni cuesta nada. **LIGA 2v2 (hecho, 19-11-2026):** pantalla `Liga2v2Scene` (botón "LIGA 2v2" en LIGA): rango 2v2 por MONEDAS 2v2 (los rangos de la Liga: Bronce 0, Plata 150, Oro 400, Platino 800, Diamante 1400, Challenger 2200; `domain/league2v2.ts`), tu total con la barra hasta el siguiente rango, el TOP 10 con tu fila y JUGAR 2v2. La tabla la llenan 49 jugadores SIMULADOS deterministas que crecen una vez al día (como el Ranking Liga) hasta que haya cuentas en el servidor.
- **Hecho (servidor y red, con tests):** `FindRequest.mode`, cola por modo, `MatchedMsg.mode`, `StateMsg.a` / `HitMsg.a` (id de actor: 0 = el emisor, 1 y 2 = los bots del host), `RoomManager` con `mode` y `gone`, host juez único, el compañero que se va no termina el partido, `rejoin` del compañero. `MatchNet(mode)`, `LanSearchScene(mode)`. `backend/test` (46 pruebas).
- **Hecho (cliente, `MatchScene` con `net2`):** el host simula a los 2 bots y manda sus estados y golpes (`a` = 1 y 2; `net2SendBots`); el invitado los muestra como actores remotos (`net2OnState`, `net2ApplyHit`, `net2Tick`). Cuando saca el equipo humano, saca uno de los dos al azar (ver "Saque entre los dos humanos"). Si el invitado se corta, `allyRemote = false` y el bot aliado (`allyBrain`, `doublesTick`) juega por él; al volver (`MATE_BACK`) recupera su personaje y los dos rejuegan el punto (`netResume`). Si los dos golpean casi a la vez (menos de 250 ms), gana el golpe del host. `LanSearchScene` busca con `mode: '2v2'` y el menú lo usa cuando hay servidor; sin servidor, `Matchmaking` contra bots.
- **Probado (21-11-2026):** dos Chrome contra el backend local, 2 humanos + 2 bots del host, con `autoPlay` en los dos: mismo marcador en ambos teléfonos, pelota a menos de 250 px entre ambos en todas las muestras (4 pruebas, 70 a 100 muestras cada una), sin errores de JS. Corte del invitado: el bot del host toma su lugar; reconexión: vuelve el control y el juego sigue. Sin probar en teléfonos reales ni con latencia alta.
- **ESPECIAL y ULTI en el 2v2 online (hecho, 21-11-2026):** la cinemática de quien la lanza (humano en cualquier teléfono, o un bot del host) congela los 4 personajes en los dos teléfonos, como en el 1v1: `smash-cine` / `inferno-cine` con `a` (0 = el compañero, 1 y 2 = bots) → `net2ApplyAction` (en el teléfono receptor, `asBot(actor, …)` reutiliza `netRemoteSmashCine` / `netRemoteInfernoCine`). El golpe llega con `HitMsg.el` (el poder de la bola: cada teléfono la dibuja igual, también la de los bots, cuyo kit puede diferir entre teléfonos) y se aplica al terminar la cinemática remota sumando a la pelota el tiempo retenido. El host juzga el impacto contra sus bots (`fireImpact`): manda `stunned` con `a`, la devolución floja como golpe `impact` del bot, `racket` (ULTI) y `sky-launch` (¡A LAS ESTRELLAS!). Si la víctima es un humano, su teléfono lo juzga (`playerImpact`) y lo avisa; si el compañero sale volando, el host da el punto. Los ESPECIAL de los bots no llevan cinemática en red (solo el golpe y su poder).
- **Probado (21-11-2026):** `_temp/cdp-2v2-spec.mjs` (dos Chrome, ESPECIAL y ULTI forzados en humanos y bots, 3 corridas de ~110 muestras): mismo marcador, cinemáticas simultáneas en los dos teléfonos (solo 1 a 5 muestras de 300 ms sueltas con un teléfono congelado y el otro no, ninguna racha larga), poder de los bots visto igual (`comet`), sin errores de JS. Un desajuste de pelota en 3 corridas, cuando los dos compañeros lanzaron una cinemática a la vez sobre la misma pelota (cada uno ignora la cinemática remota mientras vive la suya; el siguiente golpe reconcilia la pelota).
- **Saque entre los dos humanos (hecho, 21-11-2026):** cuando le toca sacar al equipo humano, saca **uno de los dos al azar, cada juego** (el mejor de 3 es igual que el 1v1: puede que uno saque dos veces y el otro ninguna). El azar es `hostServesGame(roomId, gameIndex)` (`net/doubles.ts`): sale del id de la sala y del número de juego, así que los dos teléfonos llegan al mismo resultado SIN enviarse nada y sigue igual si uno se reconecta. En `MatchScene`: `net2ServerIsHost()`, `net2IServe`, y de ahí `meServes`, `srvActor()` y `netRemoteServes()`. El plano de saque tiene dos sitios (A = fondo si saca el equipo; B = red) y cada teléfono se dibuja como `player` (antes el intercambio de sitios se hacía dos veces y se anulaba). El host juzga todo: si el invitado se queda sin tiempo para sacar, le avisa con la acción `serve-timeout` y el host aplica la falta (la doble falta también la juzga el host: `serviceFault` ya no exigía ser el receptor). Si el compañero se cae justo antes de sacar, saca el host y al volver se rejuega el punto con el azar de siempre.
- **Probado (21-11-2026):** `_temp/cdp-2v2-serve.mjs` (dos Chrome): sacó el invitado en unas corridas y el host en otras (juego 0), solo uno tiene el saque y la etiqueta SERVICIO está en el sacador de cada teléfono, el sacador queda en el mismo sitio en los dos, sin atascos; invitado sin tiempo (falta, 2.º saque, doble falta y punto del rival, marcador igual); saque largo del invitado (falta y doble falta juzgadas por el host); corte del invitado justo antes de sacar (saca el host y al volver sigue). Mejor de 3 sin rotación observada de juego 2 (los partidos acabaron 2-0): el azar de los juegos siguientes se calcula igual pero no se vio sacar a ninguno.
- **Reglas de DOBLES (hecho, 19-11-2026; solo con `doubles`, el 1v1 no cambia):**
  - **Cancha ancha:** en 2v2 la pelota que bota en los PASILLOS es buena (`isInCourt(x, y, wide)` en `Ball.ts`, usado en `handleBounce`). Los cuatro se mueven por todo el ancho (`setLane` en `MatchScene`: `Y_MIN`, `Y_MAX` y `HALF_W` incluyen `ALLEY`) y los bots y el aliado bot apuntan también a los pasillos (`BotBounds.wide` en `BotBrain`). El SAQUE va al cuadro de INDIVIDUALES (regla real, decidido con el usuario): un saque al pasillo es falta (`computeServeBox` sin cambios).
  - **Solo devuelve el saque el del cuadro cruzado:** `serveReceiver` se fija en `placeForServe` (el del equipo que recibe que queda al fondo) y se borra cuando ese equipo devuelve (setter de `lastHitter`); después el punto es libre para los cuatro. Cada pareja tiene su lado FIJO para recibir: el jugador / host el de y > centro y el aliado / invitado el otro; en el rival, el 1.º el de y < centro (`startPoint`). El receptor espera al fondo de su lado y su compañero en la red (en los dos equipos). El que no recibe no alcanza la pelota y no es falta (`serveBlocked` en `checkHits` y `playerHit`; `allyCanHit` y `doublesTick` para el aliado bot; `pickRival` no cambia de rival mientras dure). Online cada teléfono calcula el receptor con las mismas posiciones (`hostInA`), sin mensajes nuevos.
- **Probado (19-11-2026):** 2v2 contra bots en Chrome (autoPlay, un partido completo): 11 saques, los 9 devueltos los devolvió el receptor del cuadro cruzado (r0 / r1 y jugador / aliado alternando por punto), 12 botes en los pasillos siguieron en juego, sin errores de JS. Online (dos Chrome, `_temp/cdp-2v2-online.mjs`): marcador igual y 1 desajuste de pelota por la carrera ya conocida de dos cinemáticas a la vez; los dos teléfonos eligieron el mismo receptor en 24 de 24 muestras de saque (en esa corrida siempre recibían los bots); `DROP=1` (corte y regreso del invitado) bien; 1v1 (`MODE=1v1`, comparando la pelota espejada) sin desajustes (peor 154 px). `cdp-2v2-serve.mjs` bien. Sin probar: el equipo humano recibiendo ONLINE en la muestra, teléfonos reales y latencia alta.
- **Saque del ALIADO bot en el 2v2 contra bots (hecho, 19-11-2026, decidido con el usuario):** el saque del equipo humano se alterna por juego entre tú y el aliado (`allyServes`: como los rivales, `floor(gameIndex / 2) % 2`). En su juego él va al sitio de saque y tú a la red; saca solo con el plan de `ServeAI` (espera `allyTossAt`, golpe en `botPlan.pressAt`, destino `botPlan.aimT`); tus botones de saque no salen y el toque no hace nada (`onServeButton` exige `meServes`). Solo contra bots: en el 2v2 online sigue el azar entre los dos humanos. Probado en Chrome (partido 2-1): sacaste tú el juego 1 y el aliado el 3, sin atascos ni errores.
- **Acciones del COMPAÑERO en el 2v2 online (hecho, 19-11-2026):** `net2ApplyAction` ya muestra, sobre el compañero (`a = 0`), su aura de ESPECIAL armado con el color de su poder (`net2MateArmed` / `net2MateEl`, `updateSmashGlow` lado `mate`; se apaga con `smash-disarmed`, al lanzarlo o al acabar el punto), sus emotes con SU cara (`Emotes.showRemote(kind, head, skin)`), la estirada (`net2Lunge`), el DASH (`net2Dash`, con el retraso de su posición), los defensivos DESTELLO / teletransporte / RELÁMPAGO (portal de salida y llegada, desaparece y reaparece), SOMBRA / PATINAJE (sprint con su destello) y SUPERSALTO / VOLTERETA (despegue y salto) (`net2Defensive`), y el remate de globo (`net2Remate`: raqueta arriba y salto, sin cámara lenta en este teléfono). En el 2v2 nada se espeja y su POSICIÓN sigue llegando por sus estados: estas funciones solo ponen la animación y los efectos. TIEMPO LENTO sigue bloqueado.
- **Probado (19-11-2026):** dos Chrome contra el backend local, el invitado (Mai) envía cada acción y el host la muestra: aura de hielo encendida y apagada, emote con la cara de Mai, estirada (clip `dive`), DESTELLO y RELÁMPAGO (el compañero se desvanece), SUPERSALTO, SOMBRA y remate (raqueta arriba y salto), marcador igual y sin errores de JS. Las acciones se enviaron a mano desde la consola (no jugando), así que no se probó la sincronía fina de cada efecto con su golpe; sin probar en teléfonos reales.
- **El anfitrión se va (hecho, 19-11-2026, decidido con el usuario): el invitado pasa a ser el anfitrión.** Servidor: `RoomManager.leave` del host en un 2v2 en juego, con el compañero conectado, marca al host `gone` (no puede volver), pone al compañero en `players[0]` (pasa a ser `host`: juez de los puntos) y lo libera de la sala; el marcador no cambia (índice 0 = equipo humano). Avisa con el evento nuevo `game:promoted` (`EV.PROMOTED`, data `ScoreMsg`; en las DOS copias de `protocol.ts`), tanto si se rinde como si se corta y no vuelve en `reconnectGraceMs`. Si el compañero también estaba fuera, termina como antes. Cliente: `MatchNet` cambia su `role` a `host` y `MatchScene.net2Promoted` pone al bot aliado en el personaje del que se fue (`allyRemote = false`), vacía las colas de los bots remotos, reinicia sus cerebros y rejuega el punto desde el marcador oficial (`netResume`); desde ahí simula a los bots y juzga los puntos. Pruebas en `backend/test/rooms.test.ts` (2 nuevas, 49 en total).
- **Probado (19-11-2026):** dos Chrome contra el backend local. Host se RINDE: el invitado pasa a anfitrión al instante (`role host`, `simBots`), los bots se mueven y el punto siguiente se juega y se suma (1-0 → 2-0). Host se CORTA (gracia de 4 s en la prueba): pausa "ANFITRIÓN RECONECTANDO…" y a los ~4 s pasa a anfitrión y sigue igual (0-0 → 2-0). Sin errores de JS. Sin probar en teléfonos reales ni con el compañero ya cortado.
- **Carrera de cinemáticas (hecho, 19-11-2026):** si los dos teléfonos lanzan su ESPECIAL / ULTI sobre la misma pelota antes de recibir la del otro, gana la del ANFITRIÓN: el invitado cancela la suya al recibir la remota (`net2YieldCine`: su golpe no sale, el ESPECIAL sigue armado y la ULTI se aborta como al cancelarla) y muestra la del anfitrión; el anfitrión ignora la del invitado (`cineLock`). Así ya no se desalinea la pelota.
- **ESPECIAL de los BOTS con cinemática en red (hecho, 19-11-2026):** el anfitrión lanza la cinemática del ESPECIAL de sus bots (antes solo contra bots offline) y la avisa con `smash-cine` + el actor (`net2Tag`); el invitado la ve a la vez (`net2ApplyAction` → `netRemoteSmashCine`) y el golpe se aplica al terminar. En el 2v2 se congelan los cuatro (`freezeSprites`; también offline).
- **ULTI LEGENDARIA y TIEMPO LENTO en 2v2 online: siguen BLOQUEADOS a propósito.** La legendaria es un peloteo automático con semilla contra UNA víctima (no está adaptado a dos rivales ni a dos teléfonos) y TIEMPO LENTO frena el mundo en un solo teléfono (descuadraría a los bots del anfitrión y al compañero). Avisos más claros: "ULTI LEGENDARIA: aún no en 2v2 online" y "TIEMPO LENTO: aún no en 2v2 online".
- **Probado (19-11-2026):** `cdp-2v2-spec.mjs` (ESPECIAL y ULTI forzados en humanos y bots): pelota sin desajustes (peor 105 px en 95 muestras), cinemáticas a la vez en los dos teléfonos (0 muestras con una sí y otra no), marcador igual, el host envió la cinemática del ESPECIAL de un bot, sin errores. Saque en el juego 3 (marcador puesto a 1-1 en juegos en los dos teléfonos): sacó el invitado por el azar, los dos teléfonos de acuerdo en quién saca y con la etiqueta SERVICIO bien, sin atascos, partido terminado 2-1 igual en ambos. La carrera exacta (dos cinemáticas en el mismo instante) no salió en esta corrida: la regla está en el código pero no se vio en una prueba.
- **ULTI LEGENDARIA HURACÁN en el 2v2 contra bots (corregido, 21-11-2026):** no salía la imagen del TORNADO. Causa: `MatchScene.tornadoImg` (`TornadoSprite`) se creaba una vez y no se reiniciaba en `create`; la escena se reutiliza entre partidos y al cerrarse destruye sus objetos, así que en el partido siguiente (el 2v2 que se juega después de otra partida) se dibujaba una imagen ya destruida (invisible, sin error; el sonido y la esfera sí salían). Ahora `create` la reinicia y `TornadoSprite.draw` / `warm` recrean la imagen si la suya está destruida. Además, la carga de la legendaria congela a los cuatro (`freezeSprites`) en el 2v2. Solo la lanza el usuario: el aliado bot y los rivales bot no tienen ULTI LEGENDARIA (`ai/botKit.ts` las excluye). Sin cambios en 1v1 ni en el bloqueo del 2v2 online.
- **LOG del 2v2 online (19-11-2026, para probar en AWS):** el mismo log de diagnóstico del 1v1 (`game:log` → `backend/logs/matches/<día>/<sala>.jsonl` y `backend/logs/LOG-PARTIDO.txt`, la última partida; por API `/api/log-partido?key=LOG_KEY`). Antes el 2v2 solo dejaba `session`, golpes y puntos; ahora `MatchScene.diag2Tick` (host e invitado) añade: `flu2` (fps, tirones, estados recibidos por actor `in` = compañero/bot1/bot2, `gap`, `lag`), `mv2` (los 4 y la pelota cada 200 ms), `snap2` (fase, saque, receptor, marcador, cinemáticas, compañero remoto), `serve2` (quién saca y recibe en cada saque: los dos teléfonos deben coincidir), `tp2`, `no-state2`, `stuck2`, `hit2-drop` (el host descarta un golpe del invitado), `cine-yield`, `mate-away` / `mate-back` / `promoted`. `session` lleva `mode` y `room`; los `send` / `recv` y los `relay` del servidor llevan `a` (actor). El servidor marca la sala como 2v2 en `matched` / `start` y en la cabecera de LOG-PARTIDO. Se apaga en el teléfono con `localStorage 'dev.netLog' = '0'` y en el servidor con `LOG_PARTIDO=0` (solo el texto).
- **Pendiente:** la ULTI LEGENDARIA y TIEMPO LENTO bloqueados en 2v2 online (ver arriba); los defensivos y la estirada de los BOTS del anfitrión no se envían (en el invitado solo se ve su golpe); la tabla de la LIGA 2v2 con jugadores reales (necesita cuentas en el servidor).