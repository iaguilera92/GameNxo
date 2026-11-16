# Tutorial por nivel

Decidido con el usuario el 14-11-2026. Solo existe con el **MODO DESARROLLO apagado** (en modo desarrollo el perfil es de pruebas, nivel 20).

## Cómo funciona

- Cada nivel tiene un paso (`frontend/src/domain/tutorial.ts`, `TUTORIAL_STEPS`): título, 1 a 3 páginas de texto corto y, si el nivel desbloquea algo, una banda "¡NUEVO!".
- El aviso sale **una sola vez**, la primera vez que el jugador entra al **menú** con ese nivel o más. Si subió varios niveles de golpe, salen en orden, uno tras otro.
- En el menú sale después de la ruleta y de la presentación de la EXP (`MenuScene.create`, `maybeShowTutorial` en `ui/TutorialDialog.ts`).
- Lo ya visto se guarda en la cuenta: `PlayerState.tutorial` (ids de pasos). **Los ids de los pasos no se cambian nunca** (van a la base de datos: `docs/BASE-DE-DATOS.md`).
- Los niveles con desbloqueo toman su número de `domain/unlocks.ts`. Si se cambia ahí, el tutorial lo sigue.

## Tabla

| Nivel | Se desbloquea | Qué enseña |
|---|---|---|
| 1 | — | Moverse, golpear con un toque, el saque y el saque perfecto; ruletas y EXP |
| 2 | DEFENSIVO (DASH) | El botón DEFENSIVO: te lleva a la pelota; recarga; más poderes en la Tienda |
| 3 | — | Dirección del golpe: abajo cortita, arriba globo, lados a la esquina |
| 4 | ESPECIAL (SMASH) | Armar el golpe: bola de poder que aturde; recarga |
| 5 | — | Perfect Timing: el aro, BIEN y PERFECTO, la racha |
| 6 | ULTI | Carga con puntos; el botón cambia; aturde y quita la raqueta |
| 7 | — | El globo del rival y el remate dentro del círculo |
| 8 | ESTILOS de color | Cambiar el color de la ropa en PERSONAJE |
| 9 | — | La estirada; la Tienda (dinero virtual y dinero real) |
| 10 | EFECTO PELOTA | La estela de color; se compra y se equipa |
| 11 | — | El Duelo en la Red |
| 12 | CARGANDO GOLPE | Mantener para cargar; globo disparado y DROP SHOT 0 |
| 13 | — | Cambiar ESPECIAL, DEFENSIVO y ULTI; rarezas |
| 14 | — | El Pase de Batalla |
| 15 | ZONA y SAQUE CON EFECTO | La Zona y el saque con efecto (botón violeta) |
| 16 | — | Ranked: apuestas y clasificación |
| 17 | — | Ligas y premio semanal (3 partidas) |
| 18 | — | Rivales más fuertes al subir |
| 19 | — | Combinar DEFENSIVO, ESPECIAL y ULTI |
| 20 | Nivel máximo | Resumen |

## Ritmo de niveles (decidido junto con el tutorial)

- Una victoria = un nivel (190 XP); una derrota = medio nivel (95); rendirse o abandonar = un tercio de una derrota (32).
- La curva es plana (`xpToNext` en `config.ts`). Detalles y consecuencias en `docs/ECONOMIA.md` sección 6.

## Pendiente

- El tutorial sale en el menú, no dentro del partido: no resalta el botón nuevo con una flecha. Si se quiere, se añade en `MatchScene`.
- Un jugador que ya tenga nivel alto y abra el menú por primera vez con el modo apagado verá todos los avisos pendientes seguidos.
- Si se agrega una habilidad nueva con candado de nivel, se añade su paso aquí y en `unlocks.ts`.
