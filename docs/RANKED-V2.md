# Ranked v2: diagnóstico y diseño (antes de programar)

Redactado el 16-11-2026 a partir del pedido del usuario ("Diseño e implementación del sistema Ranked") y de la revisión del
código. **Todavía no se cambió nada del juego.** El sistema actual está en `docs/RANKED.md`. Este documento dice qué cambia,
cómo se construye y qué falta decidir. Las decisiones pendientes (sección 8) se confirman con el usuario antes de implementar.

---

## 1. Diagnóstico de la arquitectura actual

| Pieza | Estado hoy | Consecuencia para Ranked v2 |
|---|---|---|
| **Cuentas / base de datos** | No existen. Supabase **no está conectado** (solo mencionado en `backend/src/api/routes.ts` y `playerStore.ts`). | El backend no puede ser autoridad todavía: primero cuentas, login y base de datos. |
| **Guardado del jugador** | `PlayerState` completo en `localStorage` (`domain/playerStore.ts`, con `PlayerRepository` listo para cambiarlo por una API). | Monedas, liga y resultados se pueden editar en el teléfono. |
| **Lógica Ranked** | Pura y sin Phaser en `domain/ranked.ts`, `rankedConfig.ts`, `rankedState.ts`, `rankedBots.ts`; fachada `logic/Ranked.ts`; tests `tools/test-ranked.mjs`. | Buena base: el servidor puede ejecutar las mismas funciones (Node + TypeScript). |
| **Rival de una partida Ranked** | `MatchmakingScene` (con `ranked.bet`) arma el partido contra el **bot local**; el resultado lo decide el teléfono y `MatchEndScene` llama a `settleRanked`. | **El resultado no se puede verificar en un servidor**: lo produce el cliente (ver sección 8, decisión D2). |
| **Partido online (LAN)** | `backend/` Express + Socket.IO. `RoomManager.point()` lleva el marcador oficial, pero **los puntos los avisa un teléfono** ("juez de la pelota"); no hay simulación autoritativa. | Un partido online tampoco es 100 % seguro: el servidor confía en el aviso de punto del cliente. |
| **Hora** | `domain/timeSource.ts` (`gameClock`, nunca retrocede; `setServerTime` preparado). Corte diario 23:59 Chile (`cycleIdAt`), semana lunes→domingo. | Con backend, la hora es la del servidor. |
| **Monedas** | `PlayerState.coins` = moneda competitiva; la Tienda cobra DINERO (`gems`). Saldo inicial `STARTING_COINS = 5000`. | Encaja con "saldo global": las monedas solo se gastan en Ranked. |

### Qué hace hoy Ranked y qué cambia con v2

| Regla | Hoy (`docs/RANKED.md`) | Pedido v2 |
|---|---|---|
| Clasificación de liga | Saldo global de monedas | **Resultado neto semanal** (solo apuestas Ranked) |
| Ranking global | No existe aparte | **Nuevo**: saldo global, permanente |
| Ascenso | Al terminar una partida con saldo ≥ objetivo; **puede encadenar ligas** | Al **cerrar la semana**, neto semanal ≥ meta; **una sola liga** |
| Requisito semanal | ≥ 3 partidas **completadas** | ≥ 3 **victorias** |
| Premio por posición | Top 1 / Top 10 / Top 50 (se suma a la base) | Top 1 · 2–3 · 4–10 · 11–50 · resto; cantidades **por definir** |
| Bots | Simulan el **mes**, varían cada hora, **siempre bajo** el objetivo | Ciclo **semanal**, avance **diario**, perfiles, algunos superan la meta (**máx. 120 %**) |
| Sin monedas | Juega amistoso gratis | Con 0 monedas no entra a Ranked (amistoso sí) |
| Descenso mensual | Todos bajan una liga y **se recorta el saldo** (`coinsCut`) | Criterio **por definir**; el saldo global **nunca** se reinicia |
| Autoridad | El cliente (sin servidor) | El backend |

---

## 2. Tablas y relaciones (PostgreSQL / Supabase, propuesta)

Todas las cantidades son enteros (`bigint`). Toda moneda que entra o sale pasa por el **libro de movimientos** (`coin_ledger`)
dentro de la misma transacción que actualiza el saldo. Las restricciones `unique` son las que impiden cobrar o pagar dos veces.

```text
accounts            (id uuid PK, created_at)
wallets             (account_id PK→accounts, coins bigint CHECK (coins >= 0), cash bigint CHECK (cash >= 0), updated_at)
coin_ledger         (id uuid PK, account_id, currency 'coins'|'cash', delta bigint, balance_after bigint,
                     reason 'ranked_entry'|'ranked_payout'|'weekly_reward'|'wheel'|'daily'|'chest'|'pass'|'shop'|…,
                     ref_id text, created_at,
                     UNIQUE (account_id, reason, ref_id))            -- idempotencia de cada movimiento

ranked_weeks        (week_id text PK 'AAAA-MM-DD' del lunes, starts_at, ends_at,
                     status 'open'|'closing'|'closed', closed_at)
league_membership   (account_id, week_id, league, PK (account_id, week_id))   -- liga con la que juega esa semana

ranked_matches      (id uuid PK, account_id, week_id, league, bet 1|2, entry bigint, payout bigint,
                     opponent_kind 'bot'|'player', opponent_id, room_id,
                     status 'entered'|'won'|'lost'|'surrendered'|'abandoned'|'void',
                     result_source 'server_room'|'server_sim'|'client',
                     created_at, settled_at)

weekly_results      (account_id, week_id, league, net bigint DEFAULT 0, wins int, losses int, matches int,
                     reached_at timestamptz,                         -- cuándo alcanzó su neto actual (desempate 4)
                     PK (account_id, week_id))

position_prize_tiers(league, from_pos, to_pos, coins, cash, PK (league, from_pos))   -- configurable, sin valores definitivos

weekly_rewards      (account_id, week_id, league, position int NULL, tier text NULL, eligible bool,
                     coins bigint, cash bigint, rays int, ledger_id uuid NULL, claimed_at,
                     PK (account_id, week_id))

league_changes      (id uuid PK, account_id, period_id, kind 'promotion'|'demotion', from_league, to_league, created_at,
                     UNIQUE (account_id, period_id, kind))

job_runs            (job 'week_close'|'month_close'|'bots_daily', period_id, status 'running'|'done', started_at, finished_at,
                     PK (job, period_id))                             -- cada cierre se procesa una sola vez

bot_cohorts         (week_id, league, seed bigint, reach_count int, PK (week_id, league))
bot_daily           (week_id, league, bot_id, day int, net bigint, wins int, losses int, PK (week_id, league, bot_id, day))
```

- **Saldo global** = `wallets.coins`. **Resultado semanal** = `weekly_results.net`. Son registros distintos de la misma moneda.
- **Historial de apuestas** = `ranked_matches` + sus filas de `coin_ledger`. **Victorias / derrotas** = `ranked_matches.status`
  (y los contadores de `weekly_results`). **Ascensos** = `league_changes`.
- Los bots **no** están en `accounts` ni en `wallets`: viven en `bot_cohorts` / `bot_daily` (o se calculan desde la semilla).
- Lectura de los rankings con índices: `wallets (coins DESC)` y `weekly_results (week_id, league, net DESC, wins DESC, losses ASC, reached_at ASC)`.

---

## 3. Flujo de una apuesta

**Entrar** (`POST /ranked/enter { matchId, bet }`, una transacción):

1. Bloquear `wallets` del jugador (`SELECT … FOR UPDATE`).
2. Validar:
   - semana `open`;
   - `bet ∈ {1, 2}`;
   - liga del jugador según `league_membership`;
   - `entry = entrada_liga × bet`;
   - `coins ≥ entry` (nunca negativo);
   - que no tenga otra partida `entered` abierta.
3. Insertar `ranked_matches` (`status = 'entered'`). El `id` lo genera el servidor, o se acepta el del cliente si es nuevo.
4. Insertar en `coin_ledger` `−entry` (`reason = 'ranked_entry'`, `ref_id = matchId`) y restar el saldo.
5. Hacer upsert en `weekly_results`: `net −= entry`, `matches += 1`.

Ejemplo del pedido: saldo 10.000 → 9.000; neto semanal 0 → −1.000.

**Partida ganada** (resultado decidido por el servidor; ver D2): una transacción.

1. Bloquear `ranked_matches`, solo si sigue `entered`. Si ya está liquidada, devolver el resultado guardado (idempotente).
2. `payout = entry × 2`. Insertar `coin_ledger` `+payout` (`'ranked_payout'`, `ref_id = matchId`) y sumarlo al saldo.
3. `weekly_results`: `net += payout`, `wins += 1`, `reached_at = now()`.
4. `status = 'won'`, `settled_at = now()`.

Ejemplo: saldo 9.000 → 11.000; neto −1.000 → +1.000.

**Partida perdida**:

- `status = 'lost'`, `losses += 1`, `reached_at = now()`.
- No se mueve ninguna moneda: la entrada ya se descontó.

**Rendición o abandono**: igual que perder (falta decidir si cuentan como derrota en el desempate: D9). Una partida `entered`
sin resultado durante más de N minutos la cierra el servidor como `abandoned`.

---

## 4. Cierre semanal (domingo 23:59, hora de Chile)

Tarea programada (Supabase `pg_cron` o un cron del backend):

1. `INSERT INTO job_runs ('week_close', week_id) ON CONFLICT DO NOTHING`. Si ya existía, termina: el cierre se procesa una sola vez.
2. `ranked_weeks.status = 'closing'`. Desde aquí no se aceptan entradas nuevas de esa semana.
3. Cerrar las partidas `entered` de la semana como `abandoned`.
4. Por cada liga, ordenar `weekly_results` con el desempate de la sección 6.
5. Calcular la posición **de premio** (entre jugadores reales; D7).
6. Elegible = `wins ≥ 3`. Recompensa = base de la liga + premio de su tramo (`position_prize_tiers`).
7. Insertar `weekly_rewards`: PK `(account_id, week_id)`, así no hay duplicados.
8. Acreditar en `coin_ledger` (`'weekly_reward'`, `ref_id = week_id`). Va al **saldo global**, nunca a `weekly_results`.
   - Se puede acreditar al cerrar o cuando el jugador pulsa "cobrar" (hoy es con botón). En ambos casos es idempotente por la clave única.
9. Ascensos (sección 5).
10. Crear la semana siguiente:
    - `ranked_weeks` en estado `open`;
    - `league_membership` de cada jugador (su liga ya actualizada);
    - `bot_cohorts` nuevos.
11. `status = 'closed'` y `job_runs.status = 'done'`.

Si el proceso se corta a mitad, se puede volver a ejecutar: cada paso escribe con claves únicas.

## 5. Ascensos

- Al cerrar la semana: si `weekly_results.net ≥ meta de la liga` y la liga no es Challenger, el jugador sube **una** liga, aunque
  haya superado la meta varias veces.
- Se inserta en `league_changes (account_id, week_id, 'promotion')` (único por semana) y la `league_membership` de la semana
  siguiente queda con la liga nueva.
- La meta se compara con el **neto semanal**, no con el saldo global (ver D1).
- La animación de ascenso del cliente (`seenLeague`) se mantiene: el cliente la muestra al ver el cambio.
- Los bots nunca ascienden.

---

## 6. Los dos rankings

**Ranking Global**

- `wallets.coins DESC`, solo de cuentas reales. Es permanente: nunca se reinicia.
- Para desempatar se propone ordenar después por la antigüedad de la cuenta.
- Se muestra el Top 100 y la posición del jugador.
- Se propone **no** mostrar bots aquí (D12).

**Ranking Liga (semanal)**

- `weekly_results` de la semana actual y la liga del jugador, mezclado con los bots de esa liga hasta completar 100 filas.
- Orden:
  1. `net` (mayor arriba). La regla 1 del pedido, "más monedas netas semanales", **es el mismo criterio** (D8).
  2. Más `wins`.
  3. Menos `losses`.
  4. `reached_at` más antiguo arriba: quien alcanzó primero esa puntuación.
- `reached_at` se actualiza en cada liquidación (ganada o perdida), porque el neto cambia o se confirma en ese momento.
- Las monedas de ruleta, cofre, pase o premio diario **no** tocan `weekly_results`: solo `coin_ledger` y `wallets`.

## 7. Bots del Ranking Liga

- Solo de presentación: no son cuentas, no tienen saldo global, no apuestan, no reciben premios, no ascienden.
- **No quitan premios a reales**: la posición de premio se calcula solo entre reales (D7).
- **Ciclo semanal**:
  - Al abrir la semana se crea `bot_cohorts (week_id, league, seed)`.
  - De la semilla salen el nombre, el avatar y el perfil de cada bot, de forma determinista: la misma tabla en todos los teléfonos.
  - `reach_count` es cuántos bots llegarán a la meta esa semana. Se sortea, por ejemplo entre 0 y 6, así cambia cada semana.
- **Perfiles**: reparto y neto final como fracción de la meta (todos con tope 1,20):

| Perfil | Reparto | Neto final (× meta) | Días activos |
|---|---|---|---|
| Muy competitivo | 8 % | 0,85 – 1,20 | 6 – 7 |
| Competitivo | 20 % | 0,55 – 0,95 | 5 – 7 |
| Casual | 35 % | 0,20 – 0,60 | 3 – 5 |
| Poco activo | 25 % | 0,00 – 0,25 | 1 – 3 |
| Irregular | 12 % | −0,10 – 0,80 | rachas |

  Los `reach_count` bots elegidos terminan entre 1,00 y 1,20 de la meta.
- **Avance diario**:
  - Un trabajo diario (`job_runs 'bots_daily'`) escribe `bot_daily` para el día que cierra. También se puede calcular al vuelo desde la semilla.
  - El neto final se reparte entre los días activos en pasos de la entrada de la liga (± entrada, porque son victorias y derrotas).
  - Hay días negativos, días en blanco y algún día fuerte, para que no parezca una secuencia artificial.
  - Nunca supera 1,20 × meta. Ejemplo en Bronce (meta 15.000, D1): como máximo 18.000.
  - **Un real que pasa la meta queda primero** (decisión del usuario, 16-11-2026): si algún jugador real de la liga superó la
    meta, el neto que se muestra de cada bot se rebaja para que quede **por debajo del mejor de esos reales**:
    `neto_bot = min(neto_bot, 1,20 × meta, mejor_real_sobre_meta − entrada)`.
  - Los reales **sí** pueden pasar la meta sin tope: así se arma el Top. Al cerrar la semana, todos (reales y bots) vuelven a 0.
  - Victorias y derrotas coherentes con el neto: `net = (wins − losses) × entrada`, aproximado.
- **Cuántos bots**: `100 − jugadores reales de la liga` (como hoy).
- El código actual de `domain/rankedBots.ts` (mensual, por hora, siempre bajo la meta) se reescribe con estas reglas.

---

## 8. Contradicciones y decisiones pendientes

**D1. La columna "victorias netas" no cuadra con la meta semanal.** → **DECIDIDO (16-11-2026): opción (a)**, metas de 30 victorias netas x1: Bronce 15.000 · Plata 30.000 · Oro 60.000 · Platino 120.000 · Diamante 240.000 (30 / 15 en todas).

- Cada victoria x1 deja **+1 entrada neta** (paga 2 × entrada y costó 1 entrada). Una derrota deja −1 entrada.
- Victorias netas x1 = meta / entrada:

| Liga | Meta | Entrada | Victorias netas x1 / x2 (cálculo) | Tabla |
|---|---|---|---|---|
| Bronce | 30.000 | 500 | 60 / 30 | 60 / 30 ✔ |
| Plata | 60.000 | 1.000 | **60 / 30** | 30 / 15 ✘ |
| Oro | 120.000 | 2.000 | **60 / 30** | 30 / 15 ✘ |
| Platino | 240.000 | 4.000 | **60 / 30** | 30 / 15 ✘ |
| Diamante | 480.000 | 8.000 | **60 / 30** | 30 / 15 ✘ |

- El 30 / 15 venía del sistema anterior: el **saldo** acumulado desde la meta de la liga anterior (por ejemplo, Plata
  60.000 − 30.000 = 30.000 → 30 victorias). Con la meta **semanal** desde 0, todas las ligas piden 60 / 30.
- Además, 60 victorias netas **en una semana** es muy alto. Con un 60 % de victorias, cada partida deja +0,2 de neto: harían
  falta unas **300 partidas x1** (o 150 x2) en 7 días.
- **Propuesta (elegir una):**
  - **(a)** Metas = 30 victorias netas x1 (Bronce 15.000 · Plata 30.000 · Oro 60.000 · Platino 120.000 · Diamante 240.000).
    Queda 30 / 15 en todas las ligas.
  - **(b)** Metas más bajas, de 15 victorias netas x1 (Bronce 7.500 · Plata 15.000 · …), alcanzables en una semana jugando a diario.
  - **(c)** Mantener las metas y corregir la columna a 60 / 30.

**D2. El resultado de una partida Ranked lo decide el teléfono.**

- Hoy Ranked se juega contra el **bot local**: el servidor no puede saber si ganó.
- En online, los puntos los avisa un cliente.
- **Opciones:**
  - **(a)** Ranked solo contra jugadores reales online, con marcador en el servidor y validación cruzada (los dos teléfonos deben
    coincidir; si no, la partida es `void` y se devuelve la entrada).
  - **(b)** Simulación autoritativa en el servidor: trabajo grande, porque toca el motor.
  - **(c)** Aceptar el riesgo contra el bot y añadir detección de anomalías: rachas imposibles, partidos demasiado cortos,
    límites diarios.
- Sin una de estas, el backend no puede garantizar "evitar que el cliente manipule victorias".
- → **DECIDIDO (16-11-2026): bots + jugadores reales.**
  - Con el **modo online** encendido (en producción, siempre), Ranked busca primero un **jugador real**.
  - Si en **5 s** no lo encuentra, asigna un **bot** que varía sus jugadas. Su **dificultad sube con la liga**: Bronce fácil,
    Challenger difícil.
  - Consecuencia de seguridad: las partidas contra **reales** usan el marcador del servidor y validación cruzada (opción a).
    Las partidas contra el **bot** siguen decidiéndose en el teléfono y necesitan detección de anomalías (opción c).
    `ranked_matches.opponent_kind` y `result_source` distinguen los dos casos.
  - Pendiente: definir la escala de dificultad del bot por liga. Toca la IA del bot del partido, que es de Kiro: se coordina aparte.

**D3. Entrar con saldo insuficiente.** El pedido dice "con 0 monedas no puede participar". ¿Qué pasa con saldo mayor que 0 pero
menor que la entrada? Por ejemplo, 300 monedas en Bronce.

- Propuesta: se exige `saldo ≥ entrada × apuesta`.
- Si no alcanza, solo amistoso, como hoy.
- → **DECIDIDO (16-11-2026): saldo ≥ entrada × apuesta.** Si no alcanza, amistoso gratis. Con amistosos, ruletas y premio
  diario junta monedas para volver a Ranked.

**D4. Requisito semanal: 3 victorias en vez de 3 partidas.** Se aplica lo pedido: el contador `wins` de `weekly_results`. Es un
cambio respecto a hoy.

**D5. Ascenso: semanal y de una sola liga.** Hoy se asciende al instante y se pueden encadenar ligas: hay que cambiarlo.
¿Mientras dura la semana el jugador sigue en su liga y con su entrada, aunque ya pasó la meta? Propuesta: sí.

**D6. Descenso mensual.** El código actual baja a todos una liga y **recorta el saldo** (`demotionCap`, `coinsCut`). Eso
contradice "el saldo global nunca se reinicia".

- Propuesta: **desactivar el recorte ya** y dejar el descenso en pausa hasta definirlo.
- Queda la arquitectura: `league_changes` y `job_runs 'month_close'`.
- Falta decidir quién baja: ¿todos? ¿quien no jugó? ¿quien quedó en los últimos puestos? ¿quien tuvo neto negativo?
- → **DECIDIDO (16-11-2026): las monedas no se recortan NUNCA.** El saldo global se conserva siempre. El Ranking Liga vuelve a 0
  cada semana, para todos. El criterio de descenso de liga sigue pendiente: mientras tanto, no baja nadie.

**D7. Posición de premio con bots.** Los bots no pueden quitar premios, así que el premio se calcula por la posición **entre
reales**. Pero la tabla visible mezcla bots: alguien puede verse en el puesto 7 y cobrar el premio de Top 1.

- Propuesta: mostrar aparte "Posición de premio".
- Alternativa: los bots cuentan para la posición visible y no hay premio en esa posición, lo que contradice el pedido.
- → **DECIDIDO (16-11-2026): tabla con bots + "Posición de premio" aparte**, calculada solo entre reales. Además, un real que
  pasa la meta queda primero: los bots se rebajan por debajo de él (sección 7).

**D8. Desempate 1** ("mayor cantidad de monedas netas") es el mismo criterio que el orden principal. Propuesta: quitarlo de la lista.

**D9. ¿La rendición y el abandono cuentan como derrota** para el desempate y las estadísticas? Hoy pierden la entrada, pero no
suman a las partidas jugadas.

→ **DECIDIDO (16-11-2026):**

- **Quien se rinde o abandona**: cuenta como **derrota** y pierde la entrada.
- **El rival** (partida online contra un real):
  - Si ya había ganado **al menos un juego**, cobra la **mitad de la ganancia**: entrada + entrada / 2. Ejemplo: apostó 500 y
    recibe 750, es decir +250 de neto.
  - Si no había ganado ningún juego, **no gana monedas**.
  - Pendiente confirmar: en ese caso, ¿se le devuelve su entrada (neto 0) o la pierde? Propuesta: se le devuelve.
- ¿El abandono del rival cuenta como **victoria** para el requisito de 3 victorias? Propuesta: solo si ya había ganado un juego.

**D10. Premios por posición.**

- Los tramos pedidos: 1 · 2–3 · 4–10 · 11–50 · resto.
- ¿Se **suman** a la base de la liga, como hoy, o la **reemplazan**?
- Los valores actuales (Top 1 5.000 + 50 · Top 10 2.000 + 20 · Top 50 500 + 5) quedan como provisionales en `position_prize_tiers`.
- → **DECIDIDO (16-11-2026): se SUMAN a la base.** Las cantidades por tramo siguen pendientes.

**D11. Rayos.** Hoy la recompensa semanal elegible entrega además 1 Rayo de ZONA (`WeeklyReward.rays`). El pedido no lo menciona.
¿Se mantiene? → **DECIDIDO (16-11-2026): se mantiene 1 Rayo** con la recompensa semanal elegible.

**D12. Ranking Global.** ¿Se muestran bots? Propuesta: no; solo cuentas reales.

→ **DECIDIDO (16-11-2026): sí hay bots en el Global**, para que no se vea vacío.

- Identidad estable (mismos nombres siempre) y saldo que cambia una vez al día (`globalBotsFor` en `rankedBots.ts`).
- Los jugadores reales se muestran **siempre**, aunque queden fuera del Top 100.
- El Global se abre desde el menú (botón GLOBAL), no desde LIGA.

**D13 → DECIDIDO (16-11-2026): Supabase Auth.** El jugador entra como **invitado** y luego vincula **Google** para no perder la
cuenta. **Facebook** también, más adelante. Siguen pendientes: qué hacer con los perfiles de `localStorage` (propuesta: subirlos a
la cuenta la primera vez) y dónde corre el cron.

**D13. Cuentas y base de datos.** No hay ninguna. Faltan por decidir:

- confirmar Supabase;
- la forma de iniciar sesión;
- qué pasa con los perfiles guardados hoy en `localStorage`;
- alojamiento del cron (Supabase `pg_cron` o Render).

**D14. Ranked sin conexión.** Con el backend como autoridad, Ranked necesita Internet. Hoy funciona sin conexión. Propuesta:
sin conexión, solo amistosos.

**D15. Zona horaria.** El corte es domingo 23:59 **hora de Chile** para todos los jugadores. ¿Se mantiene si hay jugadores de
otros países? Propuesta: sí, un único corte global.

---

## Cambio 16-11-2026: el neto de la liga nunca es negativo

- El mínimo es 0. El neto ya no baja al apostar: al liquidar se suma lo ganado o perdido en esa partida (premio − entrada) y se
  recorta en 0.
- Ejemplo: saldo 10.000, neto 0 → apuesta 1.000: saldo 9.000, neto 0 → gana: saldo 11.000, neto +1.000 → pierde la siguiente: neto 0.
- Los bots también tienen mínimo 0.
- Lo de la sección 3 sobre "neto −entry al entrar" queda reemplazado: en el servidor, `weekly_results.net` se actualiza al liquidar,
  con `GREATEST(0, net + payout − entry)`.

## Estado

**Etapa 1 hecha (16-11-2026)**, en local, sin servidor:

- `rankedConfig.ts`: metas D1, `minWinsForReward`, `forfeitBonus`, tramos 1 · 3 · 10 · 50 (cantidades provisionales), descenso en pausa.
- `rankedState.ts`: `weekNet`, `weekWins`, `weekLosses`, `weekReachedAt`.
- `ranked.ts`:
  - entrada que baja el neto y liquidación con D9 (`opponent_left`);
  - cierre semanal con ascenso de una liga;
  - `globalBoardFor`, y en la vista: `weekNet`, `promoting`, `prizePosition`.
- `rankedBots.ts` reescrito (ciclo semanal, avance diario, perfiles, tope 120 %, real sobre la meta primero, `compareEntries`).
- `RankedScene`: solo textos (victorias y meta semanal).
- `RankedScene` (19-11-2026, usuario): sin la tarjeta del MODO RIESGO (va en el menú). ÚLTIMAS PARTIDAS y PREMIOS EXTRA ya no son dos tarjetas grandes al final: son dos botones chicos (54 px de alto) entre la recompensa semanal y LÍDERES DE LA LIGA (`quickButtons` / `quickButton`). El del historial muestra las últimas 5 partidas como puntitos verde / rojo. Cada uno abre su diálogo (`historyOverlay` / `extraRewardsOverlay`).
- `tools/test-ranked.mjs`: 20 pruebas.

**Etapa 2 hecha (16-11-2026)**, pantalla RANKING:

- El número grande es el NETO DE LA SEMANA (verde o rojo); el saldo global va en la píldora de arriba.
- Barra de la meta semanal, con el aviso "¡META CUMPLIDA! SUBES A … EL DOMINGO".
- Placas: POSICIÓN (con tramo de premio y "PREMIO #x" si difiere) y SEMANA (victorias-derrotas).
- Botones TOP 100 LIGA / GLOBAL: ventana con pestañas. LIGA muestra el neto con signo y bots; GLOBAL, el saldo, solo reales.
- Tarjeta y ventana de premios extra con 4 tramos.
- Fin de temporada: neto de la semana y "¡LLEGASTE A LA META! SUBES A …".

Mientras no haya servidor, `botsCountForPositionPrizes = true`: con un solo jugador real, contar solo reales lo haría Top 1
todas las semanas. Con el backend se pone en `false`, como decidió D7.

## 9. Plan de implementación por etapas

| Etapa | Qué | Depende de |
|---|---|---|
| **0** | El usuario resuelve D1–D15 | — |
| **1** | **Dominio puro v2** en `domain/`, sin servidor y con tests en `tools/test-ranked.mjs`. Funciona ya en local y luego se ejecuta en el servidor. Incluye: <br>• neto semanal separado del saldo; <br>• requisito de 3 victorias; <br>• ascenso semanal de una liga; <br>• tramos de posición configurables; <br>• desempate completo con `reachedAt`; <br>• bots v2; <br>• quitar el recorte de saldo (D6); <br>• migración del `PlayerState` guardado. | D1, D3–D12 |
| **2** | Ajuste de la pantalla RANKING: <br>• pestañas Global / Liga; <br>• neto semanal; <br>• "x / 3 victorias"; <br>• posición de premio; <br>• aviso de ascenso al cierre. <br>No toca el partido. | Etapa 1 |
| **3** | Cuentas y base de datos: <br>• Supabase con las tablas de la sección 2 y RLS (el cliente solo lee); <br>• login; <br>• `PlayerRepository` por API. | D13 |
| **4** | Endpoints Ranked en el backend: `enter`, `settle`, `claim`, `board/global` y `board/league`, con transacciones y claves únicas. El cliente deja de mover monedas Ranked. | Etapa 3 |
| **5** | Resultado seguro del partido, según la opción elegida en D2. | D2, Etapa 4 |
| **6** | Tareas programadas: `week_close`, `bots_daily` y `month_close` (este último solo cuando D6 esté definido). | Etapas 3–4 |
| **7** | Descenso mensual. | D6 |

Durante todo el plan **no se toca** el motor del partido (MatchScene, físicas, controles, animaciones). La única dependencia
posible es la D2 (b), que habría que justificar aparte.

## MODO RIESGO x2 (evento semanal, 18-11-2026)

- Solo los **lunes** (ciclo diario de Chile, corte 23:59, el mismo de la semana Ranked). Se activa a mano, **una vez por semana**.
- Dura **10 minutos** desde la hora de activación del servidor: es una resta de horas, no un contador (cerrar el juego o perder la conexión no lo pausa). Al terminar se apaga solo hasta el lunes siguiente.
- Mientras está activo, la apuesta Ranked que **empieza** (x1 o x2) vale el doble: entrada y premio. El multiplicador queda fijado en `ranked.pending.risk` al pagar la entrada; la liquidación usa la entrada y el premio guardados (se aplica una sola vez). Una partida empezada antes del evento sigue x1; una empezada durante el evento cobra x2 aunque termine después.
- Saldo global y neto semanal se mueven el doble; el neto sigue sin bajar de 0 (regla de la liga, sin cambios). Ruletas, premios diarios, recompensa semanal y ascensos: sin cambios.
- Código: `frontend/src/domain/riskMode.ts` (reglas), `domain/ranked.ts` (`enterRanked`), `logic/Ranked.ts` (`syncRiskMode`, `activateRiskMode`), `net/riskApi.ts`, tarjeta en el MENÚ principal (`MenuScene`; desde el 19-11-2026 ya no está en la pantalla LIGA) y marca `ui/riskBadge.ts` en el marcador. Servidor: `backend/src/risk/riskMode.ts` y `api/riskRoutes.ts` (`GET /api/risk-mode/:id`, `POST …/activate`, `POST …/stake`), guardado en `backend/data/risk-mode.json` (`RISK_DATA_FILE`). Pruebas: `frontend/tools/test-risk-mode.mjs` y `backend/test/riskMode.test.ts`.
- Límite actual: sin cuentas, el id es del dispositivo y las monedas Ranked se siguen moviendo en el teléfono. El servidor decide la activación y la hora; `stake`/`settle` del servidor quedan listos para la etapa 4 (endpoints Ranked).

- MODO RIESGO x2, sonidos (20-11-2026, usuario): al mantener presionado suena `modo-riesgo.mp3` y el anillo se llena en 2 s (antes 3 s; `RISK_FILL_MS` en MenuScene). Al soltar antes se corta. Al activarse suena `uiSound 'risk-on'` (sintetizado; antes power-up).
