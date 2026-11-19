# Audio

## Dónde se crean
- **Soundtrack de los partidos** (`soundtrack-1..5`, `soundtrack-victoria`, `soundtrack-derrota`): se generan con **Mureka** (IA de música).
- Efectos: se descargan y se copian a mano.

## Dónde van
- Archivos: `frontend/public/mp3/` (mp3, m4a o wav).
- Efectos: se conectan en `frontend/src/fx/sfx.ts` y se cargan en `BootScene`.
- Sonidos de interfaz: se sintetizan en `frontend/src/fx/uiSound.ts`. Para usar un mp3: `public/mp3/ui-<tipo>.mp3` + añadir el tipo a `UI_SOUND_FILES`.

## Sonidos conectados (efectos de interfaz)
- `power-up` (`mp3/power-up.m4a`, 21-11-2026): suena en el Menú al subir el NIVEL de la cuenta (card del perfil) y al ganar MAESTRÍA (el personaje se ilumina).
- `inferno-hit` (`mp3/inferno.mp3`, genérico de la ULTI): además suena en el 1.er golpe de la ULTI HURACAN tras la carga (el golpe de viento, 21-11-2026, en lugar de `golpe-fuerte`; `HURRICANE.firstHit.sound` en `logic/EnergyRally.ts`), en el partido y en la demo.
- `tornado-1` (`mp3/tornado-1.m4a`, 21-11-2026): ULTI HURACAN, suena cuando empieza el tornado (salto del personaje): en el partido (tú o el rival online) y en la demo de Tienda / Personalizar (`MatchScene` tickHurricane, `fx/energyDemo.ts`).

