/**
 * Convierte datos guardados (de cualquier versión, o corruptos) en un PlayerState válido.
 * v1 = antiguo Profile de logic/Profile.ts ('gamenxo.profile.v1'): se conservan nivel, XP,
 * nombre, skin y habilidades.
 */
import { MAX_LEVEL } from '../config';
import { type ItemId, type PlayerState, type StarterSkin, type StyleId, STARTER_ITEMS, itemId, newPlayer } from './player';
import { SHOP_ITEMS } from './shopCatalog';
import { sanitizeWheel } from './dailyWheel';
import { bpGrantClaimedItemsInPlace, sanitizeBattlePass } from './battlePass';
import { EMOTES } from './emotes';
import { sanitizeRanked } from './ranked';
import { sanitizeLogin } from './dailyLogin';
import { sanitizeZoneProgress } from './zoneProgress';
import { sanitizeMastery } from './characterPassives';
import { isInfernoPower } from './infernoPowers';
import { chargeFxOwned, isChargeFx } from './chargeFx';
import { CHAR_COLOR_LIST, COLOR_SKINS, type CharColorId, charColorItem, charColorOwned, isCharColor } from './charColors';
import { isSmashPower, smashOwned } from './smashPowers';
import { defensiveOwned, isDefensivePower } from './defensivePowers';
import { isTutorialId } from './tutorial';
import { sanitizeChest } from './chest';
import { sanitizeRisk } from './riskMode';
import { sanitizeCoins2v2 } from './coins2v2';
import { isFrameId } from './profileFrames';

/** Todos los ítems que existen (los demás ids guardados se descartan). */
// Mai deja de ser inicial (fue el premio del nivel 30 hasta el 21-11-2026, cuando lo reemplazó Jun); se conserva en perfiles antiguos.
// Los emotes solo se ganan en el Pase de Batalla.
const KNOWN_ITEMS = new Set<string>([
  ...STARTER_ITEMS,
  'skin:mai',
  ...SHOP_ITEMS.map((i) => i.id),
  ...EMOTES.map((k) => itemId.emote(k)),
  // estilos de color del personaje (premios del Pase; domain/charColors.ts)
  ...CHAR_COLOR_LIST.filter((c) => c.id !== 'classic').map((c) => itemId.color(c.id)),
  // (19-11-2026) y los de cada personaje: `color:<id>:<skin>`
  ...CHAR_COLOR_LIST.filter((c) => c.id !== 'classic').flatMap((c) => COLOR_SKINS.map((sk) => charColorItem(c.id, sk))),
]);

const V1_STYLE: Record<string, StyleId> = { Clásico: 'classic' };

type Raw = Record<string, unknown>;
const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const str = (v: unknown, def: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 16) : def);

/** `starter` = personaje de un jugador NUEVO (sin partida guardada); las partidas guardadas conservan el suyo. */
export function migratePlayer(raw: unknown, starter: StarterSkin = 'nxo'): PlayerState {
  if (!raw || typeof raw !== 'object') return newPlayer(starter);
  const s = newPlayer();
  const r = raw as Raw;
  // v3 = v2 + ruletas diarias · v4 = v3 + pase de batalla: mismo formato para el resto de campos
  // v5 = Ranked + premio diario · v6 = giros bonus del pase · v7 = Rayos y atributos Zona
  const version = typeof r.version === 'number' ? r.version : 0;
  const isV2 = version >= 2 && version <= 7;
  if (version >= 3 && version <= 7) s.wheel = sanitizeWheel(r.wheel);
  s.bp = sanitizeBattlePass(version >= 4 && version <= 7 ? r.bp : undefined);
  if (version >= 5 && version <= 7) {
    s.ranked = sanitizeRanked(r.ranked);
    s.login = sanitizeLogin(r.login);
  }
  if (version >= 7) s.zone = sanitizeZoneProgress(r.zone);
  // MAESTRÍAS por personaje (domain/characterPassives.ts): solo personajes con pasiva y puntos válidos
  const mastery = sanitizeMastery(r.mastery);
  if (mastery) s.mastery = mastery;
  // tutorial por nivel: solo ids de avisos que existen
  if (Array.isArray(r.tutorial)) s.tutorial = [...new Set(r.tutorial.filter(isTutorialId))];
  const risk = sanitizeRisk(r.riskMode); // MODO RIESGO x2 (domain/riskMode.ts)
  if (risk) s.riskMode = risk;
  const c2 = sanitizeCoins2v2(r.coins2v2); // MONEDAS 2v2 (domain/coins2v2.ts)
  if (c2) s.coins2v2 = c2;
  const chest = sanitizeChest(r.chest); // cofre evolutivo de la ruleta (domain/chest.ts)
  if (chest) s.chest = chest;
  if (typeof r.giftDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.giftDay)) s.giftDay = r.giftDay; // regalo gratis de la Tienda

  s.name = str(r.name, s.name);
  s.level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(num(r.level, 1))));
  s.xp = Math.max(0, Math.floor(num(r.xp, 0)));

  if (isV2) {
    s.coins = Math.max(0, Math.floor(num(r.coins, s.coins)));
    s.gems = Math.max(0, Math.floor(num(r.gems, 0)));
    // (12-11-2026) el especial ESTRELLA pasó a llamarse LUZ: se conserva lo comprado y lo equipado
    const renamed = Array.isArray(r.owned) ? r.owned.map((x) => (x === 'smash:star' ? 'smash:light' : x)) : [];
    const owned = renamed.filter((x): x is ItemId => typeof x === 'string' && KNOWN_ITEMS.has(x));
    s.owned = [...new Set<ItemId>([...STARTER_ITEMS, ...owned])];
  }
  // premios del pase ya reclamados que hoy son cosméticos (la tabla cambió): se entregan
  bpGrantClaimedItemsInPlace(s);

  // equipamiento: v2 en `equipped`, v1 en la raíz (skin, style, abilities)
  const eq = (isV2 ? r.equipped : r) as Raw | undefined;
  if (eq && typeof eq === 'object') {
    const skin = eq.skin;
    if (typeof skin === 'string' && s.owned.includes(`skin:${skin}` as ItemId)) s.equipped.skin = skin as PlayerState['equipped']['skin'];
    const style = typeof eq.style === 'string' ? (V1_STYLE[eq.style] ?? eq.style) : undefined;
    if (style && s.owned.includes(`style:${style}` as ItemId)) s.equipped.style = style as StyleId;
    const ab = eq.abilities;
    if (Array.isArray(ab) && ab.length === 2 && ab[0] !== ab[1] && ab.every((a) => typeof a === 'string' && s.owned.includes(itemId.ability(a as never))))
      s.equipped.abilities = [ab[0], ab[1]];
    // poder del INFERNO elegido (opcional: sin él, cada personaje usa el suyo)
    // perfiles anteriores (cuando eran gratis): el poder que ya usaban se conserva como comprado
    // efecto de carga elegido: solo si lo tiene (clásico, el de su personaje o comprado)
    if (isChargeFx(eq.charge) && chargeFxOwned(s.owned, eq.charge, s.equipped.skin)) s.equipped.charge = eq.charge;
    // poder del ESPECIAL (SMASH) elegido: solo si lo tiene
    const smashId = eq.smash === 'star' ? 'light' : eq.smash;
    if (isSmashPower(smashId) && smashOwned(s.owned, smashId)) s.equipped.smash = smashId;
    // estilo de color del personaje: solo si lo tiene (el clásico es de todos)
    // (19-11-2026) por personaje: se conserva si lo tiene para alguno (en pantalla, getProfile pone el clásico en los personajes sin ese color)
    if (isCharColor(eq.color) && COLOR_SKINS.some((sk) => charColorOwned(s.owned, eq.color as CharColorId, sk))) s.equipped.color = eq.color;
    // poder del defensivo elegido: solo si lo tiene (el DASH es de todos)
    if (isDefensivePower(eq.defensive) && defensiveOwned(s.owned, eq.defensive)) s.equipped.defensive = eq.defensive;
    // estilo de ZONA: solo si lo tiene
    if ((eq.zone === 'fire' || eq.zone === 'shadow') && s.owned.includes(`zone:${eq.zone}` as ItemId)) s.equipped.zone = eq.zone;
    // marco del perfil: id de liga válido (si está desbloqueado lo decide profileFrames.equippedFrame al mostrarlo)
    if (isFrameId(eq.frame)) s.equipped.frame = eq.frame;
    if (isInfernoPower(eq.inferno)) {
      s.equipped.inferno = eq.inferno;
      if (eq.inferno !== 'fire' && !s.owned.includes(itemId.inferno(eq.inferno))) s.owned.push(itemId.inferno(eq.inferno));
    }
  }
  return s;
}
