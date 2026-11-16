# MAI de espaldas en ALTA: prompts para ChatGPT (14-11-2026)

Mismo método que NXO (`docs/PROMPTS-NXO-ESPALDAS-HD.md`): **una imagen por animación**, 8 frames en 2 filas de 4, 1536×1024, fondo verde
croma. Aquí van los prompts YA AFINADOS con lo aprendido con NXO (idle a dos manos, caminar y correr con poses distintas, golpes cargados
potentes, revés cargado a dos manos, remate con carga).

## Lo que cambia respecto a NXO (léelo antes)

- **Diseño:** gorra rosada con visera blanca, pelo largo ondulado negro con mechones rubios, polo rosado, falda rosada con franjas blancas,
  zapatillas rosadas, raqueta rosada. De espaldas **no se ve el emblema del tulipán** (va al frente de la gorra).
- **VERDE:** el emblema del tulipán lleva hojas verdes, pero de espaldas no salen. **Nada de verde en ninguna parte.** El **cordaje de la
  raqueta es DORADO-AMARILLO** (como en el diseño): nunca verdoso ni blanco-verdoso. Con NXO el cordaje salió verdoso y el croma lo borró
  (la raqueta se veía incompleta en el juego).
- **Falda y pelo largo:** se mueven con la animación (más aún al correr, saltar y girar), pero **no tapan los pies ni la raqueta**.
- **Nombres de archivo:** `mai-<hoja>-<n>.png` en `frontend/public/personajes/Mai/jugador/` (misma numeración que NXO, ver abajo).
- **Sin bote del saque** (`bounce: null`, igual que NXO).

## Cómo trabajar

1. Conversación nueva de ChatGPT y **adjunta 2 imágenes**:
   - `frontend/public/personajes/Mai/pj-mai.png`: el diseño de MAI (colores, ropa, cara).
   - La animación de NXO YA TERMINADA, de `frontend/public/personajes/Nxo/jugador/` (p. ej. `nxo-movimientos-1.png` para el reposo, `nxo-movimientos-2.png` para correr): fija el movimiento, el encuadre, el tamaño y el estilo. El bloque común ya dice que copie eso pero con el diseño de MAI.
2. Una animación por mensaje: **bloque común** + el bloque de la animación. Siempre en **la misma conversación**.
3. Guarda cada imagen como PNG en `frontend/public/personajes/Mai/jugador/<nombre>.png` con el nombre de la tabla.
4. Avísame: reviso la imagen (reglas, saltos entre frames, tamaño). La instalación (`node tools/build-hd.mjs mai`) la hace Claude.

**NO pedir** (sin uso): `run-left`, `wait`, `dropshot`, `intro`, `greet`, `serve-bounce`.

---

## Bloque común (pegar SIEMPRE antes de cada animación)

```
REGLAS OBLIGATORIAS (no las cambies):
1) VISTA DE ESPALDAS: la cámara está detrás del personaje y un poco arriba. Se ve la NUCA, el PELO LARGO sobre la espalda y la espalda; NUNCA la cara. (En las animaciones de carrera/golpe puede verse en tres cuartos desde atrás, pero nunca la cara.)
2) FONDO VERDE CROMA: todo el fondo es un solo verde puro #00FF00, plano. Sin degradados, sin suelo, sin sombras, sin texto, sin números y sin líneas ni bordes entre casillas. NADA de verde en el personaje, la ropa, el pelo, la raqueta (ni en su cordaje ni en su borde) ni en los efectos.
3) ALTA RESOLUCIÓN: imagen de EXACTAMENTE 1536x1024 dividida en una rejilla de 2 filas x 4 columnas (cada casilla de 384x512 px). El personaje mide unos 300 px de alto en su casilla, IGUAL en los 8 frames. Dibujo nítido y detallado.

PERSONAJE: usa EXACTAMENTE a MAI de la primera imagen adjunta: gorra rosada con visera blanca (el emblema de tulipán va al frente: de espaldas no se ve), pelo largo ondulado negro con mechones rubios que cae por la espalda, aretes dorados, polo rosado con cuello y mangas blancas, muñequeras rosadas, falda rosada plisada con franjas blancas, calcetines blancos con franjas rosadas, zapatillas rosadas con cordones y suela blancos, y raqueta ROSADA con el CORDAJE DORADO-AMARILLO en cuadrícula (nunca verde ni blanco-verdoso). No cambies su diseño ni sus colores. La SEGUNDA imagen adjunta es la animación de NXO YA TERMINADA: copia EXACTAMENTE su movimiento (cada pose, en el mismo orden), su encuadre, su tamaño (~300 px por casilla), su cantidad de frames y su estilo de dibujo, pero con el DISEÑO de MAI (primera imagen). NO copies el diseño de NXO: ni su pelo, ni su ropa, ni sus colores, ni su raqueta roja con cordaje blanco. La raqueta de MAI es rosada con cordaje dorado-amarillo. Adapta las poses al cuerpo de MAI (falda y pelo largo que se mueven con la animación, sin tapar los pies ni la raqueta).
ESTILO: videojuego móvil de acción en 3D cartoon. Proporciones chibi robustas (cabeza grande, cuerpo compacto, manos y zapatillas grandes), contornos oscuros gruesos y limpios, cel-shading con sombras duras, brillo de borde suave y colores muy saturados.

HOJA: UNA sola animación de 8 frames, en orden de lectura: fila de arriba frames 1-4 (de izquierda a derecha), fila de abajo frames 5-8.
- Cada frame centrado en su casilla y el personaje SIEMPRE completo: cabeza, pelo, falda, pies y TODA la raqueta dentro de su casilla, sin tocar los bordes ni la casilla vecina. Deja aire alrededor.
- Los pies apoyados a la misma altura en todos los frames (salvo en un salto o una estirada).
- La raqueta siempre en la mano DERECHA: de espaldas queda a la DERECHA de la imagen.
- NO dibujes pelota de tenis. Sin polvo ni efectos salvo donde la animación lo pida.
- Cada frame es una pose DISTINTA y el movimiento es fluido; el frame 8 enlaza con el 1 en las animaciones en bucle.
```

Si una imagen falla, pide que la repita nombrando la regla:
- **Cara visible:** `repítela: de ESPALDAS, que se vea la nuca y el pelo, sin la cara`.
- **Fondo no plano:** `repítela: fondo verde #00FF00 plano, sin suelo ni sombras`.
- **Cordaje verdoso:** `repítela: el cordaje de la raqueta DORADO-AMARILLO, ningún tono verde`.
- **Tamaño o formato:** `repítela de exactamente 1536x1024, el personaje de ~300 px por casilla`.
- **Cortado o tocando otra casilla:** `repítela con más espacio entre frames`.

---

**En CADA prompt di que es MAI, la MUJER (no NXO),** y adjunta `pj-mai.webp`: ChatGPT la confunde con NXO y la dibuja como él.

## Las animaciones (nombre del archivo = nombre del clip)

### Movimiento (`mai-movimientos-N.png`)

| Archivo | Prompt de la animación |
|---|---|
| `mai-movimientos-1.png` (idle) | `Animación: REPOSO EN GUARDIA (bucle). Vista de ESPALDAS RECTA a la cámara (no girada), mirando hacia el fondo de la cancha, cuerpo y cabeza rectos y simétricos. Piernas abiertas al ancho de los hombros, rodillas flexionadas, cuerpo un poco inclinado. La raqueta se sostiene con LAS DOS MANOS delante del cuerpo a la altura de la cintura (desde atrás se ven los antebrazos y los codos a cada lado y la raqueta asoma junto a la cabeza, hacia arriba y adelante). Se balancea alerta y atlética: el peso pasa de un pie al otro, las rodillas suben y bajan, un talón se levanta a ratos, la raqueta se mece con el cuerpo; el pelo y la falda acompañan. Cada frame es una pose distinta; el 8 enlaza con el 1.` |
| `mai-movimientos-2.png` (run) | `Animación: CORRER HACIA LA DERECHA de la imagen (bucle), carrera rasante de tenista, zancada larga, cuerpo inclinado hacia adelante, sin saltar. Poses: 1 contacto con la pierna DERECHA adelante y talón tocando; 2 apoyo, cuerpo en su punto más bajo; 3 impulso, el pie trasero apenas se despega; 4 paso corto en el aire con las piernas en tijera, pies siempre cerca del suelo (NUNCA las dos piernas recogidas); 5-8 lo mismo con la pierna IZQUIERDA; el 8 enlaza con el 1. Hombros y cadera giran en sentido contrario, el brazo izquierdo bombea. La raqueta en la mano DERECHA sube y baja con cada zancada, la cabeza de la raqueta oscila un poco, la muñeca y el codo la acompañan (movimiento notable pero controlado; todo dentro de la casilla). La falda y el pelo vuelan hacia atrás. Corre EN EL SITIO. Sin polvo.` |
| `mai-movimientos-3.png` (runstop) | `Animación: FRENADA. Frame 1 corriendo hacia la derecha; frena derrapando (polvo en los pies) y termina en el frame 8 de pie en guardia.` |
| `mai-movimientos-4.png` (victory) | `Animación: CELEBRA HABER GANADO EL PARTIDO. Frame 1 de pie; salta y levanta la raqueta al cielo, festeja; el frame 8 es una pose triunfal que se queda quieta.` |
| `mai-movimientos-5.png` (brake-turn) | `Animación: FRENAR Y GIRAR. Frame 1 corriendo hacia la derecha; frena (frames 2-5, polvo) y gira; los frames 7-8 ya corren hacia la izquierda. La raqueta se queda SIEMPRE en la mano DERECHA (de espaldas a la derecha de la imagen) en todos los frames, también al correr hacia la izquierda.` |
| `mai-movimientos-6.png` (dash) | `Animación: SPRINT EXPLOSIVO hacia la derecha (bucle). Cuerpo muy inclinado hacia delante, zancadas largas, líneas de velocidad detrás. 8 frames que enlazan.` |
| `mai-movimientos-7.png` (defeat) | `Animación: PIERDE EL PARTIDO. Frame 1 de pie; baja los hombros, se lamenta, cae de rodillas o se agacha triste; el frame 8 es la pose final que se queda quieta.` |
| `mai-movimientos-8.png` (walk) | `Animación: CAMINAR hacia la DERECHA de la imagen (bucle), pasos cortos y ágiles de tenista que se acomoda en la cancha, cuerpo un poco agachado y atento (no un paseo relajado). Ciclo de 8 poses DISTINTAS: 1 contacto con la pierna derecha adelante (talón tocando); 2 apoyo, cuerpo en su punto más bajo, el talón trasero se despega; 3 paso, la pierna izquierda pasa junto a la derecha, cuerpo en su punto más alto; 4 alcance, la izquierda se estira hacia adelante; 5-8 lo mismo con la pierna izquierda; el 8 enlaza con el 1. Los hombros y la cadera giran en sentido contrario, el brazo izquierdo se balancea al revés que la pierna. La raqueta en la mano DERECHA, delante del cuerpo a la altura de la cintura, estable. Camina EN EL SITIO. Falda y pelo con balanceo suave.` |
| `mai-movimientos-9.png` (dive-right) | `Animación: ESTIRADA HACIA LA DERECHA de la imagen. 1 de pie; 2-3 se lanza; 4 MÁXIMO ALCANCE con el brazo y la raqueta totalmente estirados a la derecha; 5-7 cae al suelo; 8 tumbada en el suelo (termina en el suelo).` |
| `mai-movimientos-10.png` (dive-left) | `Animación: ESTIRADA HACIA LA IZQUIERDA de la imagen. Igual que la de la derecha, hacia la izquierda: 4 máximo alcance, 8 tumbada en el suelo.` |
| `mai-movimientos-11.png` (recover-right) | `Animación: SE LEVANTA tras tirarse a la derecha. 1 tumbada en el suelo (como el último frame de la estirada a la derecha); 2-7 se levanta rápido; 8 de pie en guardia.` |
| `mai-movimientos-12.png` (recover-left) | `Animación: SE LEVANTA tras tirarse a la izquierda. 1 tumbada; 8 de pie en guardia.` |

### Golpes (`mai-golpes-N.png`)

| Archivo | Prompt de la animación |
|---|---|
| `mai-golpes-1.png` (forehand) | `Animación: GOLPE DE DERECHA (por el lado derecho de la imagen). 1 de pie; 2 pose de ESPERA con la raqueta atrás a la derecha (se queda congelada mientras espera la pelota); 3-6 swing hacia delante; 7 IMPACTO (raqueta delante del cuerpo, brazo extendido, destello y trazo de velocidad); 8 acompañamiento terminando el golpe. Sin efectos en los frames de espera.` |
| `mai-golpes-2.png` (backhand) | `Animación: GOLPE DE REVÉS (la pelota llega por el lado IZQUIERDO de la imagen). 1 de pie; 2 pose de ESPERA con la raqueta cruzada atrás a la izquierda; 3-5 swing; 6 IMPACTO a la izquierda del cuerpo; 7-8 acompañamiento.` |
| `mai-golpes-3.png` (forehand-power) | `Animación: GOLPE DE DERECHA CARGADO (mucho más potente que el normal). 1-3 preparación: se agacha y gira el cuerpo hacia atrás, la raqueta baja y va atrás, el peso sobre la pierna trasera; 4 CARGA (se queda congelada): zancada profunda, piernas bien abiertas, rodillas flexionadas, hombros y cadera girados al máximo, raqueta atrás a la altura del hombro (NO sobre la cabeza), brazo libre adelante; 5 arranque, el peso salta adelante y la raqueta cae rápido; 6 IMPACTO, el frame más potente, con un GRAN trazo blanco de velocidad en arco y una chispa de impacto, pelo y falda vuelan por la fuerza; 7 continuación, el trazo todavía visible, la raqueta cruza el cuerpo; 8 final, la raqueta sobre el hombro izquierdo. Efectos solo en los frames 6 y 7.` |
| `mai-golpes-4.png` (backhand-power) | `Animación: REVÉS CARGADO a DOS MANOS (muy potente). Desde el frame 2 hasta el 7 la raqueta va agarrada con LAS DOS manos en el mango (izquierda abajo, derecha encima, ambas cerradas); el frame 1 de pie con la raqueta en la derecha. 3 giro del tronco, raqueta atrás a la izquierda; 4 CARGA (se queda congelada): zancada profunda, hombros y cadera girados al máximo, las dos manos con la raqueta atrás a la izquierda a la altura del hombro; 5 arranque, el peso salta adelante; 6 IMPACTO con brazos casi estirados, destello y GRAN trazo blanco en arco; 7 continuación; 8 final con las dos manos y la raqueta alta sobre el hombro derecho. Efectos solo en 6 y 7.` |
| `mai-golpes-5.png` (serve) | `Animación: SAQUE. 1 de pie; 2 lanza; 3 pose de TROFEO (brazo izquierdo arriba, raqueta detrás de la cabeza, se queda esperando la pelota); 4 sube la raqueta; 5 IMPACTO arriba con el brazo estirado (la raqueta lo más alta posible); 6-8 baja la raqueta cruzando el cuerpo y termina.` |
| `mai-golpes-6.png` (serve-spin) | `Animación: SAQUE CON EFECTO. Igual que el saque, pero el golpe en el frame 5 es más de lado, cepillando (raqueta inclinada); 6-8 termina girando el cuerpo.` |
| `mai-golpes-7.png` (smash) | `Animación: REMATE por arriba, explosivo. 1 en guardia con la raqueta en la derecha a media altura; 2 mira la pelota arriba, brazo IZQUIERDO apuntando hacia arriba, la raqueta sube atrás del hombro; 3 POSE DE TROFEO (el golpe arranca aquí): cuerpo arqueado hacia atrás, raqueta detrás de la cabeza con el codo alto, rodillas flexionadas; 4 CARGA PARA EL IMPACTO (la clave): cuerpo como un resorte comprimido, rodillas muy flexionadas, espalda arqueada, talones empiezan a levantarse, la raqueta cae detrás de la espalda y arranca hacia arriba, el brazo izquierdo baja con fuerza; 5 IMPACTO: cuerpo totalmente estirado y de puntillas, brazo derecho estirado arriba, destello fuerte en la raqueta; 6 el brazo baja cruzando el cuerpo, GRAN trazo blanco desde arriba; 7 la raqueta termina abajo a la izquierda; 8 vuelve a la guardia y enlaza con el frame 1. Efectos solo en 5 y 6.` |
| `mai-golpes-8.png` (smash-power) | `Animación: REMATE ESPECIAL CON SALTO (golpe definitivo). 1 de pie; 2 se agacha para saltar; 3 en el aire con la raqueta armada detrás de la cabeza; 4 más arriba; 5 IMPACTO en lo más alto del salto, con un destello en la raqueta; 6-7 cae; 8 aterriza en guardia. Los frames 3-7 en el aire (pies más arriba).` |
| `mai-golpes-9.png` (serve-toss) | `Animación: LANZA LA PELOTA. 1 de pie con la mano izquierda abajo; 2-6 sube la mano izquierda estirada hacia arriba (lanza) y arma la raqueta detrás; 7-8 pose de TROFEO: brazo izquierdo arriba, raqueta detrás de la cabeza (esta pose se queda quieta).` |

### Reacciones (`mai-reacciones-N.png`)

| Archivo | Prompt de la animación |
|---|---|
| `mai-reacciones-1.png` (stunned) | `Animación: ATURDIDA (bucle). Mareada, tambaleándose, con estrellitas amarillas girando sobre la cabeza. 8 frames que enlazan.` |
| `mai-reacciones-2.png` (point-won) | `Animación: GANA EL PUNTO. 1 de pie; celebra (puño arriba, pequeño salto); 8 vuelve casi a la guardia.` |
| `mai-reacciones-3.png` (point-lost) | `Animación: PIERDE EL PUNTO. 1 de pie; se lamenta (cabeza abajo, brazos caídos o mano a la cabeza); 8 vuelve casi a la guardia.` |

### Extras (`mai-extras-N.png`)

| Archivo | Prompt de la animación |
|---|---|
| `mai-extras-1.png` (walk-intro) | `Animación: CAMINATA LENTA DE ENTRADA al partido (bucle), tranquila y segura de sí misma, hacia la derecha de la imagen, la raqueta en la mano derecha. 8 frames que enlazan.` |
| `mai-extras-2.png` (inferno-hit) | `Animación: LE PEGA UNA BOLA DE PODER. 1 de pie; 2 recibe el golpe y la raqueta se le escapa de la mano; desde el frame 3 la mano queda VACÍA (no dibujes la raqueta: la dibuja el juego); 3-8 sale despedida hacia atrás y queda aturdida.` |
| `mai-extras-3.png` (volley) | `Animación: VOLEA en la red. 1 de pie cerca de la red; 2-4 prepara un golpe corto con la raqueta alta delante; 5 IMPACTO (golpe seco, raqueta delante, sin mucho swing); 6-8 vuelve a la guardia.` |

---

## Después (otra tanda)

- **ULTI** (`mai-ulti-1..6`, imagen vertical 1024×1536 con 3×3): se prepara aparte, con los prompts de la ULTI de NXO como base y el
  poder de MAI (hielo).
- **La ulti, el retrato y las hojas de frente** (`Mai/rival/`) son otro paso.

## Notas

- La numeración y los nombres son los mismos que NXO (`COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md`, «Carpeta y nombres»). `walk` va como
  `movimientos-8`, las estiradas y recuperaciones como `movimientos-9..12` y el lanzamiento (`serve-toss`) como `golpes-9`.
- **Memoria:** las tiras HD pesan unas 2,7 veces más en la GPU. NXO ya ocupa ~51 MB: MAI sumará otro tanto (PENDIENTE ALTA PRIORIDAD en
  `NOTAS-CLAUDE.txt`).
- **Mai hoy usa hojas viejas con algunas excepciones** (`MAI_LEGACY_MOVES`): al pasar a HD esas excepciones desaparecen.
