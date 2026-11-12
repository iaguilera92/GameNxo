==========================================================================
 GAME NXO - ECONOMÍA DEL JUEGO (monedas, dinero, XP, pase, Ranked, tienda)
==========================================================================
Última actualización: 12-11-2026 (Kiro: equilibrio de la economía)

Cómo se gana y se gasta todo en el juego, por qué cada número es el que
es y en qué archivo se cambia. Los números salen del código (frontend/).
Si cambias uno: corre el simulador (sección 14) y actualiza este archivo.

--------------------------------------------------------------------------
1. LAS 6 REGLAS DE LA ECONOMÍA
--------------------------------------------------------------------------
1) MONEDAS = RANKED. Solo se gastan en entradas Ranked y además son tu
   puntaje de liga (subes al juntar el objetivo). No compran nada en la
   Tienda.
2) DINERO (billetes) = TIENDA. Llega en cantidades fijas por día, semana
   o mes: jugar más partidas no da más dinero. Techo: ~165 por semana.
3) NADIE SE QUEDA SIN RANKED. Un jugador nuevo puede jugar 10 Ranked
   aunque las pierda todas, y al subir de liga quedas con 30 entradas de
   la liga nueva. Sin monedas, JUGAR hace un amistoso gratis.
4) SIEMPRE HAY UNA META CERCA. El casual recibe algo nuevo (desbloqueo,
   premio del pase, compra o cosmético) cada ~3 días.
5) VOLVER TIENE PREMIO. El domingo del premio diario vale más que los
   otros 6 días juntos, y la semanal de Ranked se cobra el lunes.
6) PAGAR ADELANTA, NO ES OBLIGATORIO. Todo lo de la Tienda se consigue
   jugando. El precio directo en CLP nunca es más caro que comprar ese
   dinero en paquetes.

--------------------------------------------------------------------------
2. MONEDAS: DE DÓNDE SALEN Y EN QUÉ SE GASTAN
--------------------------------------------------------------------------
Entran:
  Saldo inicial ............ 5.000 (10 entradas de Bronce)
  Partida .................. +50 victoria · +10 derrota · 0 rendición
  Ruleta diaria ............ 300 de media por giro (sección 8)
  Premio diario ............ 6.350 por semana (sección 9)
  Semanal Ranked ........... 6.000 (Bronce) a 20.000 (Challenger)
                             + premio por posición (sección 3)
  Cosmético repetido ....... 1.500 (ruleta)
  Ranked ganado ............ entrada × 2

Salen:
  Entradas Ranked .......... 500 (Bronce) a 16.000 (Challenger), x2 si
                             apuestas doble. No hay otro gasto.

Con 50 % de victorias Ranked no gana ni pierde monedas: el saldo crece
con las monedas gratis (ruleta, diario, semanal). Quien gana menos de la
mitad las pierde poco a poco; quien gana más, las multiplica.

--------------------------------------------------------------------------
3. RANKED (frontend/src/domain/rankedConfig.ts, docs/RANKED.md)
--------------------------------------------------------------------------
- Entrar paga la entrada de tu liga × apuesta (x1 o x2). Ganar paga
  entrada × 2; perder no paga nada. Rendirse o abandonar pierde la
  entrada y no cuenta.
- ASCENSO: al terminar una partida con saldo >= objetivo de tu liga.
  El objetivo vale 60 entradas de tu liga = 30 de la siguiente, por eso
  al subir quedas con al menos 30 entradas.
- SEMANA (lunes a domingo, corte 23:59 hora de Chile): con 3 partidas o
  más cobras la semanal de tu liga + premio por posición + 1 Rayo.
- MES: bajas una liga. Si tu saldo supera el tope de la liga nueva, se
  recorta (mitad del tramo hacia la siguiente; con una partida vuelves a
  subir).

  Liga        Entrada x1  Objetivo   Semanal (monedas + dinero)  = entradas
  Bronce           500     30.000     6.000 +  0                    12
  Plata          1.000     60.000     8.000 + 10                     8
  Oro            2.000    120.000     9.000 + 20                     4,5
  Platino        4.000    240.000    12.000 + 30                     3
  Diamante       8.000    480.000    15.000 + 50                     1,9
  Challenger    16.000      —        20.000 + 75                     1,3

  Premio por posición de la semana: Top 1 = 5.000 + 50 dinero ·
  Top 10 = 2.000 + 20 · Top 50 = 500 + 5. Hoy los rivales simulados
  ocupan puestos en la tabla (botsCountForPositionPrizes = true).
  La LIGA ORO desbloquea las Mascotas (Personalizar).

META "10 RANKED" (pedida el 12-11-2026): del nivel 1 al 20 el jugador
tiene monedas para al menos 10 entradas de su liga. Simulado en 60 días:
el 99 % de las partidas del casual empieza con 10 entradas o más y, en
el peor caso de 20 simulaciones, nunca baja de 7.

--------------------------------------------------------------------------
4. DINERO (billetes, PlayerState.gems)
--------------------------------------------------------------------------
Entra:
  Premio diario ............ 15 por semana (jueves 5, domingo 10);
                             x2 con anuncio
  Semanal Ranked ........... 0 (Bronce) a 75 (Challenger)
  Posición semanal ......... Top 1 50 · Top 10 20 · Top 50 5
  Pase gratis .............. 40 por temporada (un mes)
  Pase premium ............. 60 más (con la bienvenida)
  Premio repetido del pase . 3
  Paquetes (dinero real) ... sección 5

Sale: solo en la Tienda. El Pase Premium se paga con dinero real
($3.990 CLP), no con billetes.

Techo semanal sin pagar: ~165 (30 del diario con anuncio + 125 de
Challenger Top 1 + ~10 del pase). Simulado: casual ~32 por semana,
regular ~74, intenso ~115.

--------------------------------------------------------------------------
5. TIENDA Y PRECIOS (frontend/src/domain/shopCatalog.ts)
--------------------------------------------------------------------------
  Ítem                          Dinero   CLP directo   Nivel mín.
  Efecto pelota Rojo               10       $490          1
  Efecto pelota Verde              10       $490          2
  Efecto pelota Oro                25       $990          5
  Efecto pelota Rosado             15       $690          1
  ULTI (INFERNO) Hielo             40     $1.490          1
  ULTI Viento                      60     $1.990          1
  ULTI Rayo                        80     $2.490          1
  ULTI Tulipán                     80     $2.490          1
  ESPECIAL (SMASH) Hielo           45     $1.390          1
  ESPECIAL Viento                  50     $1.490          1
  ESPECIAL Rayo                    55     $1.990          1
  CARGA Fuego                      35     $1.290          1
  CARGA Energía                    35     $1.290          1
  CARGA Tulipán                    45     $1.390          1
  DEFENSIVO Destello               50     $1.490          1
  DEFENSIVO Sombra                 50     $1.490          1
  DEFENSIVO Supersalto             50     $1.490          1
  Toda la tienda                  735

Paquetes de dinero: Puñado 50 = $1.490 · Fajo 130 = $2.990 ·
Maletín 350 = $6.990 · Bolsa 750 = $13.990 · Cofre 2.000 = $34.990 ·
Caja fuerte 4.500 = $69.990. Cuanto más grande, más dinero por peso.

REGLA CLP: el precio directo de un ítem nunca es más caro que juntar su
dinero con paquetes (un ítem de 50 cuesta como mucho $1.490 = Puñado).
El simulador lo revisa en cada corrida.

Jugando, un ítem de 50 tarda ~5 días al regular y ~11 al casual. El
regular compra más de un ítem por semana; el intenso tiene toda la
tienda recién el día ~50.

--------------------------------------------------------------------------
6. XP Y NIVELES (frontend/src/config.ts, frontend/src/domain/unlocks.ts)
--------------------------------------------------------------------------
XP: victoria 60 · derrota o rendición 25 · ruleta 102 de media por giro.
Toda la XP llena también el pase de la temporada.

Curva: XP para pasar del nivel n al n+1 = 100 + (n-1) × 120.
  XP acumulada: nivel 2 = 100 · 5 = 1.120 · 10 = 5.220 · 15 = 12.320 ·
  20 = 22.420 (nivel máximo).

Desbloqueos por nivel y día en que llegan (simulado):
  Nivel   Qué se desbloquea                  Casual   Regular
    2     DEFENSIVO                            día 1    día 1
    4     ESPECIAL (SMASH)                     día 3    día 2
    6     ULTI (INFERNO)                       día 5    día 3
    8     ESTILOS de color                     día 11   día 5
   10     EFECTO PELOTA                        día 14   día 7
   12     CARGANDO GOLPE                       día 20   día 10
   15     ZONA y SAQUE CON EFECTO              día 31   día 16
   20     nivel máximo                         día 53   día 28

El rival se elige por tu nivel (tu nivel ±2; en Ranked, +2 por liga):
subir de nivel también sube la dificultad.

--------------------------------------------------------------------------
7. PASE DE BATALLA (frontend/src/domain/battlePassConfig.ts)
--------------------------------------------------------------------------
- Dura un mes del calendario (BP_SEASON.month) y tiene 30 niveles.
- XP por nivel: Temporada 1 = 100. DESDE LA TEMPORADA 2 = 350 (cambiarlo
  en plena temporada bajaría el nivel de quien ya avanzó).
  Con 350 el casual lo completa cerca del día 25 del mes, el regular en
  ~2 semanas y el intenso en ~8 días (con 100: días 10, 5 y 3).
- Gratis: emotes (Risa de bienvenida, Pensando 3, Enojado 11), Rosado 5,
  Color Azul 8, Verde 15, Color Verde 18, 1 Rayo 25, Mai 30 y 40 de
  dinero.
- Premium ($3.990 CLP, solo dinero real): Color Morado 7, Oro 10,
  Cargando Tulipán 12, Color Dorado 21, 2 Rayos 25, Color Sombra 27,
  Mai Estilo Oro 30 y 60 de dinero.
- Completo: una ruleta extra. Premio que ya tienes: 3 de dinero.

--------------------------------------------------------------------------
8. RULETA DIARIA (frontend/src/domain/wheelConfig.ts)
--------------------------------------------------------------------------
4 giros por día, 1 por partida completada (ganada o perdida; rendirse no
da giro). Se reinicia a las 23:59, hora de Chile.

  Premio                       Probabilidad
  100 monedas                     25 %
  250 monedas                     20 %
  500 monedas                     15 %
  1.000 monedas                   10 %
  100 XP                          12 %
  250 XP                          10 %
  1.000 XP                         4 %
  ÉPICO: 5.000 monedas o 2.500 XP  2 %
  ESPECIAL: cosmético              2 %  (repetido = 1.500 monedas)

Media por giro: 300 monedas + 102 XP. El anuncio x2 repite el premio de
ese giro.

--------------------------------------------------------------------------
9. PREMIO DIARIO (frontend/src/domain/dailyLogin.ts)
--------------------------------------------------------------------------
Calendario de lunes a domingo (corte 23:59 hora de Chile). Se reclama
desde el botón del menú; un día no reclamado se pierde.

  Lun 250 · Mar 300 · Mié 400 · Jue 500 + 5 · Vie 600 · Sáb 800 ·
  DOM 3.500 + 10
  Semana completa: 6.350 monedas + 15 de dinero.

El domingo vale más que los otros 6 días juntos (2.850): da razón para
volver el último día. Anuncio x2: una vez por día.

--------------------------------------------------------------------------
10. ANUNCIOS (frontend/src/ads/ads.ts)
--------------------------------------------------------------------------
Solo dan premio el x2 del premio diario y el x2 de cada ruleta. Nunca son
obligatorios. Simulado: el regular gana +31 % de monedas con anuncios y
el intenso +42 % (meta: +30 % a +50 %). El anuncio al ganar un partido
no da premio.

--------------------------------------------------------------------------
11. RAYOS Y ZONA (frontend/src/domain/zoneProgress.ts)
--------------------------------------------------------------------------
5 atributos × 20 puntos. 1 Rayo = +1 punto (+1 %). La ZONA se abre en el
nivel 15. Rayos: 1 por semana en Ranked (con 3 partidas) y 1 en el nivel
25 del pase (2 con premium). Son ~5 por mes: completar los 100 puntos
toma más de un año. Es la meta larga del jugador.

--------------------------------------------------------------------------
12. METAS Y RESULTADO DEL SIMULADOR (60 días, 20 simulaciones)
--------------------------------------------------------------------------
Perfiles:
  CASUAL   1 sesión, 3 partidas/día, gana 45 %, sin diario ni anuncios
  REGULAR  2 sesiones, 8 partidas/día, gana 50 %, diario + 2 anuncios
  INTENSO  3 sesiones, 20 partidas/día, gana 55 %, apuesta x2, todos
           los anuncios
  NOVATO   como el casual pero gana 40 % (prueba de estrés)

                           Casual   Regular  Intenso  Novato
  Nivel 10 (día)             14        7        4       14
  Nivel 20 (día)             53       28       14       53
  Partidas con < 10
  entradas Ranked           0,6 %    0,6 %    2,1 %    0,9 %
  Mínimo de entradas
  (peor simulación)           7        5        0 (*)    7
  Algo nuevo cada (días)    2,8      2,5      2,8      2,8   (pase T2)
  Pase completo (día del
  mes, Temporada 2)          25       14        8       25
  Dinero por semana          32       74      115       29
  Tienda al día 60         9 de 17  15 de 17  toda (día 50)  9 de 17
  (*) apuesta x2: es decisión del jugador arriesgar el doble.

Metas que se buscaron: casual con algo nuevo cada 2-3 días, nivel 10 en
~2 semanas y nivel 20 en ~2 meses; regular con un ítem por semana sin
pagar; intenso sin toda la tienda antes de 4-6 semanas; anuncio x2 =
+30-50 %; domingo > 7 días normales; ítems CLP alcanzables jugando;
Ranked que no deje fuera al casual tras 2-3 derrotas; 10 Ranked mínimo.

--------------------------------------------------------------------------
13. RIESGOS CONOCIDOS (pendientes, no se arreglan con configuración)
--------------------------------------------------------------------------
- LIGAS ALTAS: el nivel del rival tiene tope 20 y desde tu nivel 17 ya
  es Experto en todas las ligas. Un nivel 20 que gana 55 % multiplica
  sus monedas sin límite (2,4 millones en 60 días) y uno que gana 50 %
  llega a Challenger en ~2 meses solo con monedas gratis. No afecta la
  Tienda (el dinero tiene techo), pero la liga deja de medir habilidad.
  Arreglo posible: dificultad extra por liga para los niveles altos
  (MatchmakingScene / src/ai/BotProfile.ts).
- APUESTA x2 en ligas altas puede dejarte sin entrada por unos días.
- POSICIÓN SEMANAL con bots: con jugadores reales suficientes, poner
  botsCountForPositionPrizes = false (rankedConfig.ts).
- TIENDA CHICA (17 ítems): al agregar ítems, respetar la regla CLP y
  volver a medir cuándo se completa la tienda.

--------------------------------------------------------------------------
14. DÓNDE SE CAMBIA CADA NÚMERO Y CÓMO PROBARLO
--------------------------------------------------------------------------
  frontend/src/config.ts                 XP_WIN, XP_LOSS, COINS_WIN,
                                         COINS_LOSS, xpToNext, MAX_LEVEL
  frontend/src/domain/player.ts          STARTING_COINS
  frontend/src/domain/rankedConfig.ts    entradas, objetivos, semanal,
                                         posición, apuestas, descenso
  frontend/src/domain/dailyLogin.ts      premio de cada día
  frontend/src/domain/wheelConfig.ts     ruletas por día y premios
  frontend/src/domain/battlePassConfig.ts  pase: XP por nivel, premios
  frontend/src/domain/shopCatalog.ts     precios (dinero y CLP), paquetes
  frontend/src/domain/unlocks.ts         nivel de cada desbloqueo
  frontend/src/domain/zoneProgress.ts    atributos y máximo de la ZONA

Simulador (desde frontend/):
  node tools/sim-economy.mjs --runs=20
  node tools/sim-economy.mjs --runs=20 --propuesta   (+ pase T2 de 350)
  node tools/sim-economy.mjs --runs=20 --inicio=6000 --domingo=4000
     (variantes sin tocar archivos; lista completa en la cabecera)
Muestra por perfil: día de cada nivel, saldos, de dónde sale cada moneda,
liga, compras, pase por mes, entradas Ranked disponibles y dinero ganado.

Al cambiar un número: correr el simulador, npx tsc --noEmit,
npm run build, node tools/test-ranked.mjs y actualizar este archivo (y
docs/RANKED.md si es de Ranked).

--------------------------------------------------------------------------
15. HISTORIAL
--------------------------------------------------------------------------
12-11-2026 (Kiro, aprobado por el usuario)
  Monedas iniciales ........ 1.500 -> 5.000
  Semanal Bronce ........... 3.000 -> 6.000
  Semanal Plata ............ 6.000 -> 8.000
  Domingo del diario ....... 1.500 + 10 -> 3.500 + 10
  Curva de XP .............. 100 + 50 por nivel (10.450 al 20)
                             -> 100 + 120 por nivel (22.420 al 20)
  Pase: XP por nivel ....... 100 -> 350 desde la Temporada 2
  CLP directo .............. ESPECIAL Hielo y CARGA Tulipán 1.690 -> 1.390;
                             ESPECIAL Viento y los 3 DEFENSIVOS
                             1.790 -> 1.490
  Efecto: partidas con < 10 entradas Ranked: casual 14 % -> 0,6 %,
  regular 15 % -> 0,6 %, novato 16 % -> 0,9 %. Nivel 20 del casual:
  día 25 -> día 53.
