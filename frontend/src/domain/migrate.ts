/**
 * Convierte datos guardados (de cualquier versión, o corruptos) en un PlayerState válido.
 * v1 = antiguo Profile de logic/Profile.ts ('gamenxo.profile.v1'): se conservan nivel, XP,
 * nombre, skin y habilidades.
 */
import { MAX_LEVEL } from '../config';
import { type ItemId, type PlayerState, type StyleId, STARTER_ITEMS, itemId, newPlayer } from './player';
import { SHOP_ITEMS } from './shopCatalog';
import { sanitizeWheel } from './dailyWheel';
import { sanitizeBattlePass } from './battlePass';
import { sanitizeRanked } from './ranked';
import { sanitizeLogin } from './dailyLogin';
import { sanitizeZoneProgress } from './zoneProgress';
import { isInfernoPower } from './infernoPowers';

/** Todos los ítems que existen (los demás ids guardados se descartan). */
// Mai deja de ser inicial para quedar como gran premio del nivel 30; se conserva en perfiles antiguos.
const KNOWN_ITEMS = new Set<string>([...STARTER_ITEMS, 'skin:mai', ...SHOP_ITEMS.map((i) => i.id)]);

const V1_STYLE: Record<string, StyleId> = { Clásico: 'classic' };

type Raw = Record<string, unknown>;
const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const str = (v: unknown, def: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 16) : def);

export function migratePlayer(raw: unknown): PlayerState {
  const s = newPlayer();
  if (!raw || typeof raw !== 'object') return s;
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

  s.name = str(r.name, s.name);
  s.level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(num(r.level, 1))));
  s.xp = Math.max(0, Math.floor(num(r.xp, 0)));

  if (isV2) {
    s.coins = Math.max(0, Math.floor(num(r.coins, s.coins)));
    s.gems = Math.max(0, Math.floor(num(r.gems, 0)));
    const owned = Array.isArray(r.owned) ? r.owned.filter((x): x is ItemId => typeof x === 'string' && KNOWN_ITEMS.has(x)) : [];
    s.owned = [...new Set<ItemId>([...STARTER_ITEMS, ...owned])];
  }

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
    if (isInfernoPower(eq.inferno)) s.equipped.inferno = eq.inferno;
  }
  return s;
}
