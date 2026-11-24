# Tutorial del nivel 1 al 20: plan (borrador para implementar)

Redactado el 24-11-2026 con las respuestas del usuario. Reemplaza la tabla de `docs/TUTORIAL.md` cuando se implemente.
Actualizado el 24-11-2026 con la segunda ronda de respuestas. Lo marcado **[confirmar]** está pendiente.

## 1. Reglas generales

- **Nadie se salta el tutorial.** Todos pasan del nivel 1 al 20 y las lecciones no se repiten. Una cuenta que ya existe retoma
  en el paso donde quedó.
- **Un partido = un nivel.** Cada partido del tutorial da justo la EXP del siguiente nivel, gane o pierda. Solo una vez se
  suben dos niveles de golpe: del 15 al 17 (el partido sube al 16 y la ruleta da EXP hasta el 17). El nivel 16 no tiene contenido propio: lo suyo se repartió en el 15 y el 17.
- **Gana siempre hasta el nivel 9.** En los puntos libres, si el jugador va perdiendo, el bot falla. Desde el nivel 10 el
  partido es de verdad (bot más fuerte), pero igual sube de nivel.
- **Sin rendirse.** Los partidos del tutorial no tienen el botón de rendirse. Si cierra la app a mitad del partido, ese partido
  se cancela y se juega de nuevo.
- **Avance guardado por paso.** Cada paso tiene un id fijo (va a la cuenta: no se cambia nunca). Al volver, sigue desde el
  último paso hecho. El nivel solo se completa con todas sus misiones hechas.
- **Solo contra el bot.** Los ejercicios solo pasan contra el rival bot. Nunca contra un rival online ni en partidos con amigos.
- **Habilidades.** En los puntos libres, el jugador y el bot solo usan lo desbloqueado. En los partidos con amigos, los dos
  juegan con todas las habilidades en su versión Default.
- **Tienda.** Se puede comprar desde el principio. Lo comprado solo se equipa cuando su casilla se desbloquea por nivel.
- **Visible desde el inicio:** JUGAR, TIENDA, PERSONAJE, PASE y 2v2 (con candado "NIVEL 10"). El resto aparece cuando
  toca: ruletas, Diario y Global (tras el primer partido), Amigos, Liga, Riesgo.
- **Ligas 1v1 y 2v2: nivel 20.** Se explican en el 17, sin premios hasta el 20.

## 2. Cómo es un ejercicio dentro del partido

1. **Pausa con explicación.** El tiempo se detiene y sale un texto breve de lo que va a pasar ("El rival te tirará un globo").
   Botón ENTENDIDO; si no lo toca, sigue solo a los 6 s.
2. **Demostración.** Si la lección es una habilidad nueva, el juego toma el control del personaje y la usa una vez, para que se
   vea cómo funciona, y termina el punto.
3. **Turno del jugador.** El bot fuerza la jugada (el globo, la pelota lejana, la llegada a la red). El jugador tiene **10 s**
   para hacerlo. Si no lo logra, el personaje va solo y lo hace, y el punto sigue.
4. Unos **2 puntos guiados por partido**. El resto se juega libre con dificultad normal y tranquila; más difícil desde el 10.
5. **Misiones del tutorial**, como mucho **4 por partido**, cada una con monedas. Solo existen en el tutorial.
6. Textos: una línea, arriba de la cancha, sin tapar la pelota.

## 3. Tabla

Partido: **corto** = a 4 puntos (niveles 1 a 15); **tiebreak 2v2** = a 7 puntos; **completo** = amistoso normal (16 a 19).

| Nivel | Menú | Partido y puntos guiados | Misiones (máx. 4) | Premio | Desbloqueo |
|---|---|---|---|---|---|
| Inicio | Elige personaje (aviso: es gratis y no se puede cambiar; los demás se compran) | — | — | El personaje elegido | — |
| 1 | Bienvenida → JUGAR | Corto. P1: joystick a los dos lados. P2: saque con dos toques. P3: saque directo. P4 libre | Joystick · Saque directo · Gana | Ruleta de monedas | Ruletas, Diario, Global |
| 2 | PERSONAJE → En acción → equipar DEFENSIVO; perfil; aparece Amigos | Corto. P1: pausa + demostración del DEFENSIVO. P2: lo usa él | Usa el DEFENSIVO · Devuelve tras el DEFENSIVO · Gana | Monedas | DEFENSIVO, Amigos **[confirmar nivel]** |
| 3 | Visita a la TIENDA y una demo En acción | Corto. P1: un golpe a cada lado. P2: cortita | Golpe a la izquierda · Golpe a la derecha · Cortita · Gana | Ruleta → **COFRE** (se explica) | — |
| 4 | — | Corto. P1: demostración del ESPECIAL Default. P2: lo arma él y ve la recarga | Arma el ESPECIAL · Aturde al rival · Gana | EXP (se ven las barras del nivel y del pase) | ESPECIAL |
| 5 | — | Corto. P1: el aro, BIEN y PERFECTO. P2: racha. P3 y P4 libres | BIEN · PERFECTO · 2 PERFECTOS seguidos · Gana | Dinero | — |
| 6 | — | Corto. P1: pausa (la ULTI viene cargada) + demostración. P2: la lanza él; el rival pierde la raqueta | Lanza la ULTI · El rival pierde la raqueta · Gana | Monedas | ULTI |
| 7 | — | Corto. P1: pausa "te tirará un globo", círculo y remate. P2: solo | Remata un globo · Gana | Ruleta → el cofre **EVOLUCIONA** (se explica) | — |
| 8 | Regalo: color **GRIS**; probarlo y equiparlo en PERSONAJE | Corto, libre | Equipa el GRIS · Haz un PERFECTO · Gana | Monedas | Estilos |
| 9 | — | Corto. P1: pausa "te tirará lejos", estirada. P2: solo. Último partido con victoria asegurada | Estirada · Gana | **Monedas 2v2** (se explica para qué) | — |
| 10 | Regalo: **estela AZUL** (sale en golpes fuertes a los lados; la cortita es blanca y el globo amarillo); equiparla | **Tiebreak 2v2.** P1: dónde va tu compañero y tu lado. P2: quién saca y a quién pegarle. Resto libre | Equipa la estela · Punto ganado en equipo · Gana el tiebreak | EXP | Efecto pelota, 2v2 |
| 11 | — | Corto. P1: pausa "vamos los dos a la red", Duelo en la Red. P2: solo | Gana un Duelo · Gana | Monedas | — |
| 12 | — | Corto. P1: carga al 50 %. P2: carga al 100 %, globo disparado y DROP SHOT 0 | Carga a la mitad · Globo disparado · DROP SHOT 0 · Gana | Dinero | CARGANDO GOLPE |
| 13 | En acción: compara un poder suyo con uno de la Tienda; cambia uno si tiene otro | Corto, libre | Usa el DEFENSIVO · Usa el ESPECIAL · Gana | EXP | — |
| 14 | PASE: progreso y siguiente premio gratis | Tiebreak 2v2, libre | Punto en equipo · Usa la ULTI · Gana | Monedas | — |
| 15 | — | Corto. P1: saque con efecto. Cuando entra la ZONA: pausa y qué hace | Saca con efecto · Activa la ZONA · Gana | EXP: sube al 17 | Saque con efecto, ZONA |
| 16 | Aviso: "Ahora juegas partidos completos" (sale junto con el del 17) | — | — | — | Partidos completos |
| 17 | LIGA 1v1 y 2v2: entrada, premio por victoria, clasificación, 3 victorias por semana; premios desde el 20 | Completo 1v1 | 3 del partido normal | Monedas | — |
| 18 | Misiones normales del partido (DROP SHOT 0, globo disparado, Duelo, globo especial) | Completo 2v2 | 3 del partido normal | Dinero | — |
| 19 | Personajes: comprar otro y su pasiva | Completo 1v1 | 3 del partido normal | Monedas | — |
| 20 | Ligas abiertas con premios; RIESGO x2 (se activa los lunes); maestría; resumen | — | — | Cofre | Ligas, RIESGO, maestría |

Los cofres salen en ruletas no seguidas (3 y 7). El cofre del 3 tarda en abrirse; en el 7 evoluciona si aún no se abrió y, si ya
se abrió, sale uno nuevo.

## 4. Rarezas e ítems nuevos

Rarezas desde ahora: **Default · especial · épica · legendaria**. La rareza **normal desaparece**.

| Ítem | Qué es | Rareza |
|---|---|---|
| ESPECIAL Default | Pelota con brillo blanco suave, golpe sin partículas grandes; aturde igual que los otros | Default (nueva) |
| ULTI Default | Más que la carga máxima: pelota grande con estela dorada, destello al golpear, cinemática de 1 s, sin hoja de sprites | Default (nueva) |
| DEFENSIVO DASH, carga CLÁSICO, color CLÁSICO, sin estela | Los iniciales que ya existen | Default |
| Color GRIS (nuevo) | Color de ropa, regalo del nivel 8 | Especial |
| Estela AZUL (nueva) | Efecto pelota, regalo del nivel 10; sale en golpes fuertes a los lados | Especial |

Los que hoy son **normal** pasan a **especial** (confirmado):
DEFENSIVO DESTELLO (defensive:blink), carga FUEGO (charge:fire), estelas Rojo, Verde, Oro y Rosado (style:red,
style:green, style:gold, style:pink).

## 5. Perfiles y modo desarrollo (cómo se guarda hoy)

- Cada modo tiene su propio perfil guardado en el teléfono (localStorage): el normal en gamenxo.player.v2 y el de pruebas en
  gamenxo.player.dev (domain/devMode.ts).
- **Modo desarrollo OFF:** el progreso (nivel, tutorial, compras, monedas) se guarda mientras siga en OFF, también al cerrar la app.
- **De ON a OFF:** el perfil normal se BORRA y empieza de cero en el nivel 1. **De OFF a ON** no se borra nada, pero al volver a OFF
  se borra igual. Desinstalar la app o borrar sus datos también lo borra.
- Por eso no hace falta migrar las cuentas: el perfil nuevo (
ewPlayer) nace con todo en Default, y el OFF siempre empieza limpio.
  Se quitan de los iniciales FUEGO (ESPECIAL, ULTI y carga), la ULTI HIELO y la carga TULIPÁN de Mai.
## 6. Hecho

- (24-11-2026) Rareza `default` en lugar de `normal`; los 6 normales pasaron a especial.
- (24-11-2026) AJUSTES → TUTORIAL LVL (solo con el modo desarrollo): elige nivel 1 a 20 y PROBAR. Borra el perfil normal, crea uno nuevo en ese nivel con el tutorial anterior ya visto (`tutorialSeenBefore` en `domain/tutorial.ts`), pasa a OFF y reinicia. Cuando haya regalos por nivel (gris, estela azul), `startTutorialAt` tiene que darlos también.
- (24-11-2026) ESPECIAL DEFAULT (`smash:default`) y ULTI DEFAULT (`inferno:default`), rareza Default, iniciales de todos. ESPECIAL: brillo blanco y cola plateada (`SMASH_LOOK.default`, `smashElementFx` sin partículas, cinemática más tenue). ULTI: esfera dorada por código con estela de 8 brillos (`InfernoFire.updateDefault`, `addDefaultPreview`), estallido dorado, cinemática más tenue. Mismos tiempos que las demás (`SMASH_CINE` / `INFERNO_CINE`): los dos teléfonos la esperan igual. FUEGO (ESPECIAL `smash:fire` y ULTI `inferno:fire`) se compra en la Tienda (especial). Sin iniciales por personaje (Mai ya no trae ULTI HIELO ni carga TULIPÁN; Nxo ya no trae carga FUEGO). El bot parte del kit Default y puede salir con Default o Fuego.
- (24-11-2026) Regalos: color GRIS (`color:gris`, para todos los personajes, especial) en el nivel 8 y estela AZUL (`style:blue`, especial, también en la Tienda 40 / $490) en el 10. `TUTORIAL_GIFTS` (`domain/tutorial.ts`) + `grantTutorialGifts` (`operations.ts`), los da el menú al entrar y TUTORIAL LVL. Falta la presentación del regalo (pasos de menú de los niveles 8 y 10).
- (24-11-2026) Motor del partido: `domain/tutorialMatch.ts` (reglas y tiempos), `tutorial/MatchCoach.ts` (`pause` con `ui/CoachPause.ts`: ENTENDIDO o sigue sola a los 6 s; `demo` = el juego mueve tu personaje con el AUTO; `attempt` = 10 s y si no, lo hace solo). En `MatchScene`: `tutorial` (contra el bot, OFF, nivel < 20) quita RENDIRSE y AUTO; `tutorialGuardPoint` (el bot tira fuera: empatados 50 %, ganando 100 %, solo en puntos libres, hasta el nivel 9) y `tutorialReplayPoint` (si el bot fuese a ganar el partido corto, se repite el punto). `MatchEndScene`: un partido = un nivel (`xpToLevelUp`). Falta usar el entrenador en cada nivel y las misiones por nivel.
- (24-11-2026) Misiones del tutorial por nivel (`domain/tutorialMissions.ts`, máximo 4, ids fijos): nivel 1 Joystick · Saque directo · Gana; nivel 2 Usa el DEFENSIVO · Devuélvela · Gana; nivel 3 A la izquierda · A la derecha · Cortita · Gana; nivel 4 Arma el ESPECIAL · Aturde al rival · Gana. Solo en el partido que trae el ejercicio; sin todas hechas no se sube (`MatchEndScene`). Los niveles sin ejercicio todavía usan las misiones normales.
- (24-11-2026) Ejercicios con el entrenador: nivel 2 = solo DEFENSIVO (primer punto: el juego te lo muestra y luego tú; ya no saque con efecto ni carga), nivel 3 = izquierda, derecha y cortita, nivel 4 = ESPECIAL (te lo muestra y luego tú). Si no lo logra en 10 s, el AUTO lo hace con esa dirección / el juego lo arma.
- (24-11-2026) Menú: Amigos desde el 2; ligas 1v1 y 2v2 desde el 20 (`RANKED.unlockLevel` = 20; `recordMatch2v2` no cuenta antes); niveles 16 a 19 JUGAR = partido completo amistoso contra el bot; 2v2 bajo el 20 contra bots (sin buscar compañero). En red bajo el 20 (amigos) todas las habilidades desbloqueadas. Pendiente: que en red con amigos vaya todo en Default (hoy usa lo equipado).
- (24-11-2026) Misiones de los niveles 5 a 15 (`tutorialMissions.ts`, máximo 4, premios de 10 o 15): 5 BIEN · PERFECTO · 2 PERFECTOS · Gana; 6 ULTI · rival sin raqueta · Gana; 7 Remate · ESPECIAL · Gana; 8 PERFECTO · DEFENSIVO · Gana; 9 Estirada · ULTI · Gana; 10 Punto del compañero · 3 puntos · ESPECIAL; 11 Duelo · DEFENSIVO · ESPECIAL; 12 Cargado · Globo disparado · DROP SHOT 0; 13 DEFENSIVO · ESPECIAL · ULTI; 14 Punto del compañero · ULTI · 3 puntos; 15 Saque con efecto · ZONA · PERFECTO. Obligatorias solo en los niveles con ejercicio (1 a 4); en el resto son premio extra hasta tener su ejercicio. 16 a 19: las normales.
- (24-11-2026) Partidos con amigos: con lo equipado (confirmado por el usuario).
- (24-11-2026) PANTALLA DE INICIO (`scenes/OnboardingScene.ts`, antes del menú, una vez por cuenta): nombre de usuario (3 a 12) y personaje (10 huecos: 5 hombres arriba, 5 mujeres abajo; hoy se eligen NXO o MAI, el resto PRONTO; el 5.º hombre aún no existe). Confirmación sin vuelta atrás. `completeOnboarding` / `needsOnboarding` en `operations.ts`; `PlayerState.onboarded`. NXO ya no es de todos: `STARTER_ITEMS` sin `skin:nxo`; cada cuenta tiene solo el que eligió (los perfiles de antes conservan el que usan). Hoy se guarda en el teléfono; con la base de datos, en el servidor.
