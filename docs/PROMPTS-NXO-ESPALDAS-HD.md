# NXO de espaldas en ALTA: prompts para ChatGPT (14-11-2026)

**Por qué:** hoy NXO mide ~120 px de alto en sus hojas (4 imágenes de 8 × 8) y en el teléfono se agranda 3-4 veces, así que
se ve borroso. Ahora va **una imagen por animación**, con 8 frames en **2 filas de 4**. Así el personaje sale unas 2,5 veces
más grande en la fuente.

**Estilo nuevo:** el de los juegos de acción para móvil en 3D cartoon (personajes robustos, contornos marcados y colores
muy vivos), pero **es NXO**: mismo pelo, misma ropa, mismos colores y misma raqueta. (En el prompt no se nombra ningún juego
real: se describe el estilo.)

## Cómo trabajar

1. Abre una conversación nueva de ChatGPT y **adjunta 2 imágenes** (de `frontend/public/personajes/Nxo/`):
   - `pj-nxo.webp`: el diseño de NXO (colores, ropa, cara).
   - `pj-nxo-1.png` (o la hoja donde esté la animación que pides): cómo se ve de espaldas y qué movimiento rehacer.
2. Pide **una animación por mensaje**: pega el **bloque común** y, debajo, el bloque de la animación. Usa **la misma
   conversación** para todas (así mantiene el diseño).
3. Guarda cada imagen como PNG en `frontend/public/personajes/Nxo/jugador/<nombre>.png`, con el nombre exacto de la tabla.
4. Avísame y corro `node tools/build-hd.mjs nxo`. **Se puede ir de a poco**: las animaciones sin imagen nueva siguen con la
   tira actual.

**NO pedir** (el juego no las usa; siguen con su tira actual): `run-left`, `wait`, `dropshot`, `intro`, `greet`. Están
tachadas en las tablas. Si algún día se usan, se piden entonces.

**Orden sugerido (lo que más se ve primero):** hoja 1 (`idle`, `run`, `runstop`, `victory`, `brake-turn`, `dash`, `defeat`),
luego los golpes (`forehand`, `backhand`, `forehand-power`, `backhand-power`, `volley`, `smash`, `smash-power`), el
saque y el resto.

---

## Bloque común (pegar SIEMPRE antes de cada animación)

```
REGLAS OBLIGATORIAS (no las cambies):
1) VISTA DE ESPALDAS: se ve la NUCA y la ESPALDA del personaje, NUNCA la cara. La cámara está detrás y un poco arriba, como en un juego de tenis visto desde el fondo de la cancha. En ningún frame se gira hacia la cámara.
2) FONDO VERDE CROMA: todo el fondo es un solo verde puro #00FF00, plano. Sin degradados, sin suelo, sin sombras, sin texto ni números. Nada de verde en el personaje, la ropa, la raqueta ni los efectos.
3) ALTA RESOLUCIÓN: imagen de 1536x1024 dividida en una rejilla de 2 filas x 4 columnas (cada casilla de 384x512 px). El personaje mide unos 300 px de alto en su casilla, IGUAL en los 8 frames. Dibujo nítido y detallado, sin pixelado ni borroso.

PERSONAJE: usa EXACTAMENTE el personaje de la primera imagen adjunta (NXO): pelo NEGRO en punta, barba negra corta, aro en la oreja, chaqueta deportiva NEGRA con franjas rojas y blancas en mangas y costados (abierta, con polera blanca debajo), shorts negros con franjas rojas y blancas a los lados, calcetines blancos, zapatillas negras con cordones y suela rojos, y raqueta roja con cordaje blanco. No cambies su diseño ni sus colores. La segunda imagen adjunta es su hoja de movimientos ACTUAL: rehace ese mismo movimiento de ESPALDAS con el diseño y el estilo nuevos.
ESTILO: videojuego móvil de acción en 3D cartoon. Proporciones chibi robustas (cabeza grande, cuerpo compacto y fuerte, manos y zapatillas grandes), contornos oscuros gruesos y limpios, cel-shading con sombras duras, brillo de borde suave y colores muy saturados.

HOJA: UNA sola animación de 8 frames, en orden de lectura: fila de arriba frames 1-4 (de izquierda a derecha), fila de abajo frames 5-8.
- Cada frame centrado en su casilla y el personaje SIEMPRE completo: cabeza, pies y TODA la raqueta dentro de su casilla, sin tocar los bordes ni la casilla vecina. Deja aire alrededor.
- Los pies apoyados a la misma altura en todos los frames (salvo en un salto).
- La raqueta siempre en la mano DERECHA: de espaldas queda a la DERECHA de la imagen (aunque en la imagen de diseño la tenga en la otra mano).
- NO dibujes pelota de tenis. Sí polvo o líneas de movimiento si la animación las pide.
- Movimiento fluido entre frames, como una animación real de videojuego.
```

Si una imagen falla en una regla, pide que la repita nombrando la regla:
- **Cara visible:** `repítela: de ESPALDAS, que se vea la nuca, sin la cara`.
- **Fondo no plano:** `repítela: fondo verde #00FF00 plano, sin suelo ni sombras`.
- **Personaje chico o borroso:** `repítela más grande y nítida: el personaje de ~300 px de alto por casilla`.
- **Personaje cortado o tocando otra casilla:** `repítela con más espacio entre frames`.

---

## Las animaciones (nombre del archivo = nombre del clip)

Los frames se cuentan desde 1. **"De pie"** = en guardia, a la altura normal: la herramienta lo usa para medir el tamaño.

### Movimiento

| Archivo | Prompt de la animación |
|---|---|
| `idle.png` | `Animación: REPOSO EN GUARDIA (bucle). De pie en guardia, rodillas un poco flexionadas, raqueta delante. Respira y se balancea suave de un pie al otro. El frame 8 debe enlazar con el 1.` |
| `run.png` | `Animación: CORRER HACIA LA DERECHA DE LA IMAGEN (bucle). De espaldas, corre de lado hacia la derecha con la raqueta en la mano. Ciclo completo de carrera en 8 frames que enlaza el 8 con el 1.` |
| ~~`run-left.png`~~ **NO PEDIR (sin uso)** | `Animación: CORRER HACIA LA IZQUIERDA DE LA IMAGEN (bucle). Igual que correr, pero hacia la izquierda. Ciclo de 8 frames que enlaza.` |
| `runstop.png` | `Animación: FRENADA. Frame 1 corriendo hacia la derecha; frena derrapando (polvo en los pies) y termina en el frame 8 de pie en guardia.` |
| `brake-turn.png` | `Animación: FRENAR Y GIRAR. Frame 1 corriendo hacia la derecha; frena (frames 2-5, polvo) y gira; los frames 7-8 ya corren hacia la izquierda.` |
| `dash.png` | `Animación: SPRINT EXPLOSIVO hacia la derecha (bucle). Cuerpo muy inclinado hacia delante, zancadas largas, líneas de velocidad detrás. 8 frames que enlazan.` |
| `walk.png` | `Animación: CAMINAR hacia la derecha (bucle). Pasos cortos y tranquilos, raqueta en la mano. 8 frames que enlazan.` |
| `victory.png` | `Animación: CELEBRA HABER GANADO EL PARTIDO. Frame 1 de pie; salta y levanta la raqueta al cielo, festeja; el frame 8 es una pose triunfal que se queda quieta.` |
| `defeat.png` | `Animación: PIERDE EL PARTIDO. Frame 1 de pie; baja los hombros, se lamenta, cae de rodillas o se agacha triste; el frame 8 es la pose final que se queda quieta.` |

### Golpes

| Archivo | Prompt de la animación |
|---|---|
| `forehand.png` | `Animación: GOLPE DE DERECHA (por el lado derecho de la imagen). 1 de pie; 2 pose de ESPERA con la raqueta atrás a la derecha (importante: se queda congelada mientras espera la pelota); 3-6 swing hacia delante; 7 IMPACTO (raqueta delante del cuerpo, brazo extendido); 8 acompañamiento terminando el golpe.` |
| `backhand.png` | `Animación: GOLPE DE REVÉS (la pelota llega por el lado IZQUIERDO de la imagen). 1 de pie; 2 pose de ESPERA con la raqueta cruzada atrás a la izquierda; 3-5 swing; 6 IMPACTO a la izquierda del cuerpo; 7-8 acompañamiento.` |
| `forehand-power.png` | `Animación: GOLPE DE DERECHA CARGADO (muy fuerte). 1 de pie; 2-3 arma el golpe; 4 pose de CARGA: cuerpo muy torcido, raqueta muy atrás, piernas abiertas (se queda congelada mientras carga); 5 swing violento; 6 IMPACTO con el cuerpo girado; 7-8 acompañamiento largo.` |
| `backhand-power.png` | `Animación: REVÉS CARGADO (muy fuerte). 1 de pie; 2-3 arma; 4 pose de CARGA de revés (raqueta muy atrás a la izquierda, cuerpo torcido); 5 swing; 6 IMPACTO a la izquierda; 7-8 acompañamiento.` |
| `volley.png` | `Animación: VOLEA en la red. 1 de pie cerca de la red; 2-4 prepara un golpe corto con la raqueta alta delante; 5 IMPACTO (golpe seco, raqueta delante, sin mucho swing); 6-8 vuelve a la guardia.` |
| ~~`dropshot.png`~~ **NO PEDIR (sin uso)** | `Animación: DEJADA (golpe suave y corto). 1 de pie; 2-4 prepara con la raqueta abierta; 5 IMPACTO suave acariciando la pelota; 6-8 vuelve a la guardia.` |
| `smash.png` | `Animación: REMATE por arriba. 1 de pie; 2 mira arriba y apunta con la mano izquierda; 3 raqueta armada detrás de la cabeza; 4 sube el brazo; 5 IMPACTO por encima de la cabeza, brazo totalmente estirado; 6-8 baja la raqueta y termina.` |
| `smash-power.png` | `Animación: REMATE ESPECIAL CON SALTO (golpe definitivo). 1 de pie; 2 se agacha para saltar; 3 en el aire con la raqueta armada detrás de la cabeza; 4 más arriba; 5 IMPACTO en lo más alto del salto, con un destello en la raqueta; 6-7 cae; 8 aterriza en guardia. Los frames 3-7 en el aire (pies más arriba).` |

### Saque

| Archivo | Prompt de la animación |
|---|---|
| `serve-bounce.png` | `Animación: BOTA LA PELOTA antes de sacar (bucle). De pie de lado a la línea, mano izquierda abajo botando (NO dibujes la pelota), raqueta en la derecha. La mano sube y baja. 8 frames que enlazan.` |
| `serve-toss.png` | `Animación: LANZA LA PELOTA. 1 de pie con la mano izquierda abajo; 2-6 sube la mano izquierda estirada hacia arriba (lanza) y arma la raqueta detrás; 7-8 pose de TROFEO: brazo izquierdo arriba, raqueta detrás de la cabeza (esta pose se queda quieta).` |
| `serve.png` | `Animación: SAQUE. 1 de pie; 2 lanza; 3 pose de TROFEO (brazo izquierdo arriba, raqueta detrás de la cabeza, se queda esperando la pelota); 4 sube la raqueta; 5 IMPACTO arriba con el brazo estirado (la raqueta lo más alta posible); 6-8 baja la raqueta cruzando el cuerpo y termina.` |
| `serve-spin.png` | `Animación: SAQUE CON EFECTO. Igual que el saque, pero el golpe en el frame 5 es más de lado, cepillando (raqueta inclinada); 6-8 termina girando el cuerpo.` |

### Estiradas y reacciones

| Archivo | Prompt de la animación |
|---|---|
| `dive-right.png` | `Animación: ESTIRADA HACIA LA DERECHA de la imagen. 1 de pie; 2-3 se lanza; 4 MÁXIMO ALCANCE con el brazo y la raqueta totalmente estirados a la derecha; 5-7 cae al suelo; 8 tumbado en el suelo (termina en el suelo).` |
| `dive-left.png` | `Animación: ESTIRADA HACIA LA IZQUIERDA de la imagen. Igual que la de la derecha, hacia la izquierda: 4 máximo alcance, 8 tumbado en el suelo.` |
| `recover-right.png` | `Animación: SE LEVANTA tras tirarse a la derecha. 1 tumbado en el suelo (como el último frame de la estirada a la derecha); 2-7 se levanta rápido; 8 de pie en guardia.` |
| `recover-left.png` | `Animación: SE LEVANTA tras tirarse a la izquierda. 1 tumbado; 8 de pie en guardia.` |
| `stunned.png` | `Animación: ATURDIDO (bucle). Mareado, tambaleándose, con estrellitas amarillas girando sobre la cabeza. 8 frames que enlazan.` |
| `inferno-hit.png` | `Animación: LE PEGA UNA BOLA DE FUEGO. 1 de pie; 2 recibe el golpe y la raqueta se le escapa de la mano; desde el frame 3 la mano queda VACÍA (no dibujes la raqueta: la dibuja el juego); 3-8 sale despedido hacia atrás y queda aturdido.` |
| `point-won.png` | `Animación: GANA EL PUNTO. 1 de pie; celebra (puño arriba, pequeño salto); 8 vuelve casi a la guardia.` |
| `point-lost.png` | `Animación: PIERDE EL PUNTO. 1 de pie; se lamenta (cabeza abajo, brazos caídos o mano a la cabeza); 8 vuelve casi a la guardia.` |
| ~~`wait.png`~~ **NO PEDIR (sin uso)** | `Animación: ESPERA ACTIVA (bucle). Da saltitos en el sitio, listo para recibir. 8 frames que enlazan.` |
| ~~`intro.png`~~ **NO PEDIR (sin uso)** | `Animación: PRESENTACIÓN al empezar el partido. Gira la raqueta en la mano y se pone en guardia con confianza.` |
| ~~`greet.png`~~ **NO PEDIR (sin uso)** | `Animación: SALUDO. Saluda con la mano izquierda levantada y vuelve a la guardia.` |

---

## Notas

- Si una imagen sale con el personaje cortado o tocando otra casilla, pídele a ChatGPT que la repita (`deja más espacio
  entre frames, el personaje más pequeño dentro de cada casilla`).
- Si sale con la raqueta en la mano izquierda, pide repetirla (`la raqueta en la mano DERECHA, a la derecha de la imagen`).
- **Memoria:** las tiras nuevas pesan unas 2,7 veces más en la GPU (tamaño `--stand=190`; hoy 115). No subirlo de ~200.
- Al cambiar `serve`, `serve-spin` o `serve-bounce` hay que volver a medir dónde va la pelota (`serveRacket` y `BOUNCE`):
  la herramienta avisa y lo hago yo.
