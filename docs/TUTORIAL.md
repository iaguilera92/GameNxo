# Tutorial por nivel

Decidido con el usuario el 14-11-2026. Solo existe con el **MODO DESARROLLO apagado** (en modo desarrollo el perfil es de pruebas, nivel 20).

## Cómo funciona

Con desarrollo apagado, el botón **Jugar** va directo al VS de una partida a cuatro puntos hasta el nivel 15 inclusive.
La tarjeta de ruletas, Diario, Global y la tarjeta de Liga del menú aparecen tras ganar el primer partido. **Amigos** aparece en el nivel 5. Invitar y jugar partidas con amigos sigue pendiente. **2v2** se desbloquea en el nivel 10. **Riesgo** se ve desde el comienzo y se puede activar desde el nivel 20, sujeto a sus reglas habituales.

El recorrido guiado empieza en el nivel 1. El primer partido enseña movimiento con el joystick, el saque con dos toques y el saque directo.
Completarlo desbloquea el nivel 2 y un giro con monedas de 1v1. Después se guía al jugador por **Personaje → Defensivo → En acción → Equipar**,
el perfil y una segunda partida con saque con efecto en el primer punto. En el segundo se practica el defensivo y la carga al 50 %. En el tercero se enseñan el globo y el tiro lateral con carga al 100 %. Estas prácticas habilitan temporalmente la carga y excluyen el DROP SHOT 0 durante toda la segunda partida. Los rivales controlados por el juego acceden al defensivo, especial y ulti en los respectivos niveles de desbloqueo. El recorrido se guarda por cuenta.

- Cada nivel tiene un paso (`frontend/src/domain/tutorial.ts`, `TUTORIAL_STEPS`): título, 1 a 3 páginas de texto corto y, si el nivel desbloquea algo, una banda "¡NUEVO!".
- El aviso sale **una sola vez**, la primera vez que el jugador entra al **menú** con ese nivel o más. Si subió varios niveles de golpe, salen en orden, uno tras otro.
- En el menú sale después de la ruleta y de la presentación de la EXP (`MenuScene.create`, `maybeShowTutorial` en `ui/TutorialDialog.ts`).
- Lo ya visto se guarda en la cuenta: `PlayerState.tutorial` (ids de pasos). **Los ids de los pasos no se cambian nunca** (van a la base de datos: `docs/BASE-DE-DATOS.md`).
- Los niveles con desbloqueo toman su número de `domain/unlocks.ts`. Si se cambia ahí, el tutorial lo sigue.

## Tabla de trabajo

> **(25-11-2026, usuario) Niveles cambiados:** CARGANDO GOLPE en el **8** (antes 12), ZONA y PASE DE BATALLA en el **10** (antes 15 y sin nivel), ESTILOS en el **15** (antes 8; el regalo del color GRIS va con ellos) y SAQUE CON EFECTO sigue en el 15. Misiones: las de carga pasan al 8, el 12 queda libre y el 15 ya no pide la ZONA. Fuente: `domain/unlocks.ts`. Las filas de la tabla todavía describen el orden anterior en lo que no sea desbloqueo.

**Implementado** identifica el recorrido guiado de los niveles 1 y 2. Del 3 al 20, la acción es una **propuesta** basada en los avisos actuales. Los desbloqueos de la última columna ya existen.

| Nivel | Qué hará el jugador | Estado de la práctica | Desbloqueo o recompensa |
|---|---|---|---|
| 1 | Cerrar la bienvenida o esperar 2 s y tocar **Jugar**. Primer punto: joystick y devoluciones a ambos lados. Segundo: saque con dos toques a la derecha. Tercero: saque directo. Desde el cuarto: juego libre. Al ganar, revisar las misiones **Usar joystick** y **Saque directo** y girar la ruleta. | Implementado | Nivel 2, ruleta de monedas 1v1 y tarjetas de Ruletas, Diario, Global y Liga |
| 2 | Entrar a **Personaje**, deslizar a **En acción**, equipar el defensivo y abrir el perfil. Segundo partido: saque con efecto en el primer punto, defensivo y carga al 50 % en el segundo, y globo y tiro lateral al 100 % en el tercero. | Implementado | Defensivo. Carga y saque con efecto habilitados para sus ejercicios |
| 3 | Usar el joystick para dirigir un golpe a cada lado y luego hacer una cortita. | Propuesta | — |
| 4 | Armar el **Especial**, conectar el golpe y ver cómo se recarga. | Propuesta | Especial |
| 5 | Usar el aro para acertar dos golpes en buen tiempo y reconocer **BIEN** y **PERFECTO**. Abrir **Amigos**. | Propuesta | Amigos. Invitaciones pendientes |
| 6 | Ganar puntos hasta cargar la **Ulti**, lanzarla y ver qué pasa cuando el rival pierde la raqueta. | Propuesta | Ulti |
| 7 | Seguir el círculo de caída de un globo rival, entrar en él y rematar. | Propuesta | — |
| 8 | Probar y equipar un estilo de color desde **Personaje**. | Propuesta | Estilos |
| 9 | Intentar una estirada para alcanzar una pelota lejana y ver una demostración **En acción** en la Tienda. | Propuesta | — |
| 10 | Probar una estela de pelota y entrar al selector **2v2** para conocer el modo. | Propuesta | Efecto pelota y 2v2 |
| 11 | Jugar un **Duelo en la Red** y acertar el toque en el momento indicado. | Propuesta | — |
| 12 | Repasar la carga, hacer un globo máximo y aprender el **Drop Shot 0** con el joystick hacia abajo. | Propuesta | Cargando golpe fuera del tutorial |
| 13 | Comparar dos poderes en **En acción** y cambiar uno de los equipados. | Propuesta | — |
| 14 | Abrir el **Pase de Batalla**, revisar su progreso y localizar el siguiente premio gratis. | Propuesta | — |
| 15 | Ver cuándo se activa la **Zona**, revisar sus cinco atributos en **Personaje** y repetir el saque con efecto. | Propuesta | Zona y saque con efecto fuera del tutorial |
| 16 | Abrir **Ranked** y revisar la entrada, el premio por victoria y la clasificación antes de elegir una partida. | Propuesta | Termina el recorrido inicial de partidos a 4 puntos |
| 17 | Revisar la recompensa semanal de su liga, el avance de las tres partidas y dónde se reclaman los Rayos. | Propuesta | — |
| 18 | Jugar un reto contra un rival más exigente y elegir cuándo defender y cuándo atacar. | Propuesta | — |
| 19 | Usar el **Defensivo**, el **Especial** y la **Ulti** en un mismo partido. | Propuesta | — |
| 20 | Abrir **Riesgo**, revisar cómo funciona el x2 y activarlo cuando esté disponible. | Propuesta | Nivel máximo y activación de Riesgo |

## Ritmo de niveles (decidido junto con el tutorial)

- Una victoria = un nivel (190 XP); una derrota = medio nivel (95); rendirse o abandonar = un tercio de una derrota (32).
- La curva es plana (`xpToNext` en `config.ts`). Detalles y consecuencias en `docs/ECONOMIA.md` sección 6.

## Pendiente

- Definir los ejercicios guiados, sus condiciones de éxito y sus recompensas para los niveles 3 a 20. Hoy esos niveles tienen avisos informativos.
- Un jugador que ya tenga nivel alto y abra el menú por primera vez con el modo apagado verá todos los avisos pendientes seguidos.
- Si se agrega una habilidad nueva con candado de nivel, se añade su paso aquí y en `unlocks.ts`.
