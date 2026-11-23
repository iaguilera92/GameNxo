// src/domain/unlocks.ts
var UNLOCK_LEVEL = {
  defensive: 2,
  special: 4,
  ulti: 6,
  styles: 8,
  trail: 10,
  charge: 12,
  zone: 15,
  spin: 15
};

// src/domain/shopCatalog.ts
var CHARACTER_PRICE = { clp: 6990, price: 1e3 };
var BASE_ITEMS = [
  { id: "skin:flo", kind: "skin", name: "Flo", ...CHARACTER_PRICE, minLevel: 1, available: true },
  // en propiedad hasta que sea jugable
  { id: "skin:zac", kind: "skin", name: "Zac", ...CHARACTER_PRICE, minLevel: 1, available: true },
  // en propiedad hasta que sea jugable
  // personajes (rareza sin clasificar: preguntar al usuario)
  { id: "skin:mai", kind: "skin", name: "Mai", ...CHARACTER_PRICE, minLevel: 1, available: false },
  // retirada de Nuevos personajes; queda como personaje inicial para las cuentas web existentes
  { id: "skin:net", kind: "skin", name: "Net", ...CHARACTER_PRICE, minLevel: 1, available: true },
  // (21-11-2026) aún no jugable: solo queda en propiedad
  { id: "skin:mat", kind: "skin", name: "Mat", ...CHARACTER_PRICE, minLevel: 1, available: true },
  // nuevo personaje de la Tienda; se guarda en propiedad hasta que sea jugable
  { id: "skin:isa", kind: "skin", name: "Isa", ...CHARACTER_PRICE, minLevel: 1, available: true },
  // nuevo personaje de la Tienda; se guarda en propiedad hasta que sea jugable
  { id: "skin:rin", kind: "skin", name: "Rin", ...CHARACTER_PRICE, minLevel: 1, available: true },
  // nuevo personaje de la Tienda; se guarda en propiedad hasta que sea jugable
  // estilos (estela de los golpes)
  { id: "style:red", kind: "style", name: "Rojo", price: 40, clp: 490, minLevel: 1, available: true },
  { id: "style:green", kind: "style", name: "Verde", price: 40, clp: 490, minLevel: 2, available: true },
  { id: "style:gold", kind: "style", name: "Oro", price: 80, clp: 990, minLevel: 5, available: true },
  // rosado: premio del Pase de Batalla (nivel 5); también se compra
  { id: "style:pink", kind: "style", name: "Rosado", price: 50, clp: 690, minLevel: 1, available: true },
  // (21-11-2026, usuario) EFECTOS DE PELOTA más caros en dinero virtual (\, fx/ballTrailFx.ts). Precios: ESPECIAL como los poderes especiales (40 / $1.490),
  // ÉPICA 60 / $1.990 y LEGENDARIA 100 / $2.490 (referencia: solo se pagan con dinero real).
  { id: "style:rainbow", kind: "style", name: "Arco\xEDris", price: 100, clp: 2490, minLevel: 1, available: true },
  { id: "style:ember", kind: "style", name: "Brasas", price: 120, clp: 1490, minLevel: 1, available: true },
  { id: "style:frost", kind: "style", name: "Hielo", price: 120, clp: 1490, minLevel: 1, available: true },
  { id: "style:neon", kind: "style", name: "Ne\xF3n", price: 120, clp: 1490, minLevel: 1, available: true },
  { id: "style:smoke", kind: "style", name: "Humo", price: 120, clp: 1490, minLevel: 1, available: true },
  { id: "style:tulip", kind: "style", name: "Tulipanes", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "style:hearts", kind: "style", name: "Corazones", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "style:stars", kind: "style", name: "Estrellas", price: 100, clp: 2490, minLevel: 1, available: true },
  // poderes del INFERNO (el FUEGO es de todos; el HIELO viene con Mai)
  { id: "inferno:ice", kind: "inferno", name: "Hielo", price: 40, clp: 1490, minLevel: 1, available: true },
  { id: "inferno:wind", kind: "inferno", name: "Viento", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "inferno:lightning", kind: "inferno", name: "Rayo", price: 80, clp: 2490, minLevel: 1, available: true },
  { id: "inferno:tulip", kind: "inferno", name: "Tulip\xE1n", price: 80, clp: 2490, minLevel: 1, available: true },
  { id: "inferno:shadow", kind: "inferno", name: "Sombra", price: 80, clp: 2490, minLevel: 1, available: true },
  // (17-11-2026) ULTI de SOMBRA
  { id: "inferno:light", kind: "inferno", name: "Luz", price: 80, clp: 2490, minLevel: 1, available: true },
  // (17-11-2026) ULTI de LUZ
  // (17-11-2026) ULTI ULTRA EFECTO (sin hoja: pelota normal + ventilador de aire gigante). ÉPICA (decisión del usuario): por encima de las
  // ULTIS especiales (80 / $2.490). $2.790 cumple la regla de precios (100 de dinero = 2 Puñados, $2.980)
  { id: "inferno:ultra", kind: "inferno", name: "Ultra Efecto", price: 100, clp: 2790, minLevel: 1, available: true },
  // (17-11-2026) ULTI RÁFAGA (sin hoja: pelota real + ráfaga visual de pelotas). ÉPICA y mismo precio que ULTRA EFECTO
  { id: "inferno:barrage", kind: "inferno", name: "R\xE1faga", price: 100, clp: 2790, minLevel: 1, available: true },
  // (17-11-2026) ULTI BOLA DE ENERGÍA: la primera ULTI LEGENDARIA (cinemática extra: carga de 6 s, peloteo automático y bola gigante).
  // Por encima de las épicas ($2.790): 130 de dinero = 1 Fajo ($2.990), justo en la regla de precios. Solo dinero real y, como toda
  // legendaria no se veía en la Tienda; ESTA sí se VE (ShopScene LEGEND_VIEWABLE, 17-11-2026: demo con 4 máquinas)
  { id: "inferno:energy", kind: "inferno", name: "Bola de Energ\xEDa", price: 130, clp: 2990, minLevel: 1, available: true },
  // (17-11-2026) ULTI HURACÁN: segunda LEGENDARIA (precio de toda legendaria: LEGENDARY_PRICE, más abajo)
  { id: "inferno:hurricane", kind: "inferno", name: "Hurac\xE1n", price: 130, clp: 2990, minLevel: 1, available: true },
  // poderes del ESPECIAL (SMASH). El fuego es de todos
  { id: "smash:ice", kind: "smash", name: "Hielo", price: 45, clp: 1390, minLevel: 1, available: true },
  { id: "smash:wind", kind: "smash", name: "Viento", price: 50, clp: 1490, minLevel: 1, available: true },
  { id: "smash:lightning", kind: "smash", name: "Rayo", price: 55, clp: 1990, minLevel: 1, available: true },
  { id: "smash:shadow", kind: "smash", name: "Sombra", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "smash:light", kind: "smash", name: "Luz", price: 60, clp: 1990, minLevel: 1, available: true },
  // (17-11-2026) COMETA: primer ESPECIAL ÉPICO (más rareza, más precio): solo dinero real; su price en dinero queda de referencia
  { id: "smash:comet", kind: "smash", name: "Cometa", price: 85, clp: 2490, minLevel: 1, available: true },
  // (18-11-2026) DRAGÓN: primer ESPECIAL LEGENDARIO (precio de toda legendaria: LEGENDARY_PRICE)
  { id: "smash:dragon", kind: "smash", name: "Drag\xF3n", price: 130, clp: 2990, minLevel: 1, available: true },
  // efectos de CARGA (el aro bajo el jugador al cargar un golpe). Nxo trae el de fuego y Mai el de tulipán; el clásico es de todos
  { id: "charge:fire", kind: "charge", name: "Fuego", price: 35, clp: 1290, minLevel: 1, available: true },
  { id: "charge:energy", kind: "charge", name: "Energ\xEDa", price: 35, clp: 1290, minLevel: 1, available: true },
  { id: "charge:hielo", kind: "charge", name: "Hielo", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "charge:light", kind: "charge", name: "Rayo", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "charge:wild", kind: "charge", name: "Viento", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "charge:tulip", kind: "charge", name: "Tulip\xE1n", price: 45, clp: 1390, minLevel: 1, available: true },
  { id: "charge:shadow", kind: "charge", name: "Sombra", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "charge:luz", kind: "charge", name: "Luz", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "charge:glitch", kind: "charge", name: "Glitch", price: 60, clp: 1990, minLevel: 1, available: true },
  { id: "charge:time", kind: "charge", name: "Tiempo", price: 130, clp: 2990, minLevel: 1, available: true },
  // poderes del DEFENSIVO (el DASH es de todos)
  { id: "defensive:blink", kind: "defensive", name: "Destello", price: 50, clp: 1490, minLevel: 1, available: true },
  { id: "defensive:shadow", kind: "defensive", name: "Sombra", price: 50, clp: 1490, minLevel: 1, available: true },
  { id: "defensive:jump", kind: "defensive", name: "Supersalto", price: 50, clp: 1490, minLevel: 1, available: true },
  { id: "defensive:flip", kind: "defensive", name: "Voltereta", price: 50, clp: 1490, minLevel: 1, available: true },
  { id: "defensive:skate", kind: "defensive", name: "Patinaje", price: 50, clp: 1490, minLevel: 1, available: true },
  // (18-11-2026) RELÁMPAGO: primer DEFENSIVO ÉPICO (solo dinero real; el price en dinero queda de referencia)
  { id: "defensive:lightning", kind: "defensive", name: "Rel\xE1mpago", price: 85, clp: 2490, minLevel: 1, available: true },
  // (18-11-2026) TIEMPO LENTO: primer DEFENSIVO LEGENDARIO (precio de toda legendaria: LEGENDARY_PRICE)
  { id: "defensive:slowmo", kind: "defensive", name: "Tiempo Lento", price: 130, clp: 2990, minLevel: 1, available: true },
  // ESTILOS DE ZONA (16-11-2026, domain/zoneSkins.ts; la ELÉCTRICA es de todos): FUEGO épica y SOMBRA legendaria = solo dinero real
  { id: "zone:fire", kind: "zone", name: "Fuego", price: 80, clp: 1990, minLevel: 1, available: true },
  { id: "zone:shadow", kind: "zone", name: "Sombra", price: 100, clp: 2490, minLevel: 1, available: true }
];
function itemRarity(id) {
  return SHOP_ITEMS.find((i) => i.id === id)?.rarity;
}
var KIND_UNLOCK = { defensive: "defensive", smash: "special", inferno: "ulti", charge: "charge", style: "trail", zone: "zone" };
var LEGENDARY_PRICE = { clp: 59990, price: 3500 };
var EPIC_PRICE = 600;
var SHOP_ITEMS = BASE_ITEMS.map(withRarity).map((it) => it.rarity === "legendaria" ? { ...it, ...LEGENDARY_PRICE, realMoneyOnly: true } : it.rarity === "epica" ? { ...it, price: EPIC_PRICE } : it);
function withRarity(it) {
  const key = KIND_UNLOCK[it.kind];
  const base = key ? { ...it, minLevel: Math.max(it.minLevel, UNLOCK_LEVEL[key]) } : it;
  if (it.kind === "inferno") return { ...base, rarity: it.id === "inferno:energy" || it.id === "inferno:hurricane" ? "legendaria" : it.id === "inferno:ultra" || it.id === "inferno:barrage" ? "epica" : "especial" };
  if (it.kind === "zone") return { ...base, rarity: it.id === "zone:shadow" ? "legendaria" : "epica" };
  if (it.id === "defensive:slowmo") return { ...base, rarity: "legendaria", realMoneyOnly: true };
  if (it.id === "defensive:lightning") return { ...base, rarity: "epica" };
  if (it.id === "smash:comet") return { ...base, rarity: "epica" };
  if (it.id === "smash:dragon") return { ...base, rarity: "legendaria", realMoneyOnly: true };
  if (it.kind === "smash" || it.kind === "defensive") return { ...base, rarity: it.id === "defensive:blink" ? "normal" : "especial" };
  if (it.kind === "charge") {
    if (it.id === "charge:time") return { ...base, rarity: "legendaria" };
    if (it.id === "charge:glitch") return { ...base, rarity: "epica" };
    const rarity = it.id === "charge:fire" ? "normal" : it.id === "charge:energy" || it.id === "charge:hielo" || it.id === "charge:light" || it.id === "charge:wild" ? "especial" : "epica";
    return { ...base, rarity };
  }
  if (it.kind === "style") {
    const STYLE_RARITY = { "style:ember": "especial", "style:frost": "especial", "style:neon": "especial", "style:smoke": "especial", "style:tulip": "epica", "style:hearts": "epica", "style:stars": "legendaria", "style:rainbow": "legendaria", "style:red": "normal", "style:green": "normal", "style:gold": "normal", "style:pink": "normal" };
    const rarity = STYLE_RARITY[it.id];
    if (rarity) return { ...base, rarity };
  }
  return base;
}

// src/ai/botKit.ts
var NXO = { defensive: "dash", smash: "fire", inferno: "fire", charge: "fire" };
var KITS = {
  nxo: NXO,
  mai: { defensive: "blink", smash: "ice", inferno: "ice", charge: "tulip" }
};
function botKitFor(skin) {
  return skin && KITS[skin] || NXO;
}
var BOT_DEFENSIVES = ["dash", "blink", "shadow", "jump", "flip", "skate"];
var SMASHES = ["fire", "ice", "wind", "lightning", "shadow", "light", "comet", "dragon"];
var INFERNOS = ["fire", "ice", "wind", "lightning", "tulip", "shadow", "light", "ultra", "barrage"];
var CHARGES = ["classic", "fire", "energy", "tulip"];
var COLORS = ["azul", "verde", "morado", "dorado", "sombra"];
var allowed = (kind, ids) => ids.filter((id) => {
  const r = itemRarity(`${kind}:${id}`);
  return r !== "epica" && r !== "legendaria";
});
var notLegendary = (kind, ids) => ids.filter((id) => itemRarity(`${kind}:${id}`) !== "legendaria");
function randomDoublesKits(skins, avoid = {}, rnd = Math.random) {
  const used = { smash: /* @__PURE__ */ new Set(), inferno: /* @__PURE__ */ new Set(), defensive: /* @__PURE__ */ new Set() };
  for (const k of ["smash", "inferno", "defensive"]) if (avoid[k]) used[k].add(avoid[k]);
  const pickFree = (kind, ids) => {
    const free = ids.filter((id2) => !used[kind].has(id2));
    const pool = free.length ? free : ids;
    const id = pool[Math.floor(rnd() * pool.length)];
    used[kind].add(id);
    return id;
  };
  const smashes = notLegendary("smash", SMASHES);
  const infernos = notLegendary("inferno", INFERNOS);
  const defensives = notLegendary("defensive", BOT_DEFENSIVES);
  return skins.map((skin) => {
    const base = randomBotKit(skin, rnd);
    return { ...base, smash: pickFree("smash", smashes), inferno: pickFree("inferno", infernos), defensive: pickFree("defensive", defensives) };
  });
}
function randomBotKit(skin, rnd = Math.random) {
  const base = botKitFor(skin);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const keepOwn = (p) => rnd() < p;
  const smashes = allowed("smash", SMASHES);
  const infernos = allowed("inferno", INFERNOS);
  const charges = allowed("charge", CHARGES);
  const defensives = allowed("defensive", BOT_DEFENSIVES);
  return {
    defensive: keepOwn(0.4) && defensives.includes(base.defensive) ? base.defensive : pick(defensives),
    smash: keepOwn(0.3) && smashes.includes(base.smash) ? base.smash : pick(smashes),
    inferno: keepOwn(0.3) && infernos.includes(base.inferno) ? base.inferno : pick(infernos),
    charge: charges.includes(base.charge) && keepOwn(0.3) ? base.charge : pick(charges),
    // croma: 1 de cada 3 con los colores de siempre
    color: keepOwn(0.33) ? "classic" : pick(allowed("color", COLORS))
  };
}

// src/ai/doublesPositioning.ts
var DOUBLES_POS = {
  /** cuánto se corre el centro del equipo hacia la pelota (0 = siempre al medio, 1 = encima de la pelota) */
  ballPull: 0.4,
  /** distancia ideal al centro del equipo, en fracción del ancho de cancha */
  spread: 0.25,
  /** separación mínima y máxima con el compañero, en fracción del ancho */
  minGap: 0.3,
  maxGap: 0.55,
  /** px que el otro tiene que pasar el centro para cambiar de lado */
  sideSwitch: 25,
  /** margen a los bordes del ancho de juego (px) */
  edge: 30,
  /** el que acaba de golpear vuelve a su mitad: distancia al medio en fracción del ancho */
  homeSpread: 0.22,
  /** suavizado del sitio de cobertura (s): no reacciona al instante a cada paso del otro */
  smoothS: 0.22
};
function coverY(mateY, ballY, lane2, prevSide) {
  const W = lane2.bottom - lane2.top;
  const mid = (lane2.top + lane2.bottom) / 2;
  const c = mid + DOUBLES_POS.ballPull * (ballY - mid);
  let side;
  if (Math.abs(mateY - c) > DOUBLES_POS.sideSwitch || prevSide === 0) side = mateY <= c ? 1 : -1;
  else side = prevSide;
  const ideal = c + side * W * DOUBLES_POS.spread;
  const near = mateY + side * W * DOUBLES_POS.minGap;
  const far = mateY + side * W * DOUBLES_POS.maxGap;
  let y = side > 0 ? Math.min(Math.max(ideal, near), far) : Math.max(Math.min(ideal, near), far);
  y = Math.min(Math.max(y, lane2.top + DOUBLES_POS.edge), lane2.bottom - DOUBLES_POS.edge);
  if (Math.abs(y - mateY) < W * DOUBLES_POS.minGap * 0.5) {
    side = side > 0 ? -1 : 1;
    y = Math.min(Math.max(mateY + side * W * DOUBLES_POS.minGap, lane2.top + DOUBLES_POS.edge), lane2.bottom - DOUBLES_POS.edge);
  }
  return { y, side };
}

// ../_temp/test-2v2-bots.ts
var bad = 0;
for (let i = 0; i < 2e3; i++) {
  const kits = randomDoublesKits(["nxo", "mai", "nxo"], { smash: "fire", inferno: "ice", defensive: "dash" });
  for (const k of ["smash", "inferno", "defensive"]) {
    const ids = kits.map((x) => x[k]);
    if (new Set(ids).size !== ids.length) bad++, console.log("repetido", k, ids);
    for (const id of ids) if (itemRarity(`${k}:${id}`) === "legendaria") bad++, console.log("legendaria", k, id);
  }
  if (kits.some((x) => x.smash === "fire" || x.inferno === "ice" || x.defensive === "dash")) bad++, console.log("igual al jugador", kits);
}
console.log("kits: 2000 sorteos,", bad ? `${bad} errores` : "sin errores");
console.log("ejemplo:", JSON.stringify(randomDoublesKits(["nxo", "mai", "nxo"], { smash: "fire" }).map(({ smash, inferno, defensive }) => ({ smash, inferno, defensive }))));
var lane = { top: 158, bottom: 662 };
for (const [mate, ball] of [[170, 410], [410, 410], [640, 600], [300, 200], [650, 410]]) {
  const c = coverY(mate, ball, lane, 0);
  console.log(`compa\xF1ero en ${mate}, pelota en ${ball} -> cubre en ${Math.round(c.y)} (separaci\xF3n ${Math.round(Math.abs(c.y - mate))})`);
}
