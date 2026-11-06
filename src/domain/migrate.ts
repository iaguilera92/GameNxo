/**
 * Convierte datos guardados (de cualquier versión, o corruptos) en un PlayerState válido.
 * v1 = antiguo Profile de logic/Profile.ts ('gamenxo.profile.v1'): se conservan nivel, XP,
 * nombre, skin y habilidades.
 */
import { MAX_LEVEL } from '../config';
import { type ItemId, type PlayerState, type StyleId, STARTER_ITEMS, itemId, newPlayer } from './player';
import { SHOP_ITEMS } from './shopCatalog';

/** Todos los ítems que existen (los demás ids guardados se descartan). */
const KNOWN_ITEMS = new Set<string>([...STARTER_ITEMS, ...SHOP_ITEMS.map((i) => i.id)]);

const V1_STYLE: Record<string, StyleId> = { Clásico: 'classic' };

type Raw = Record<string, unknown>;
const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const str = (v: unknown, def: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 16) : def);

export function migratePlayer(raw: unknown): PlayerState {
  const s = newPlayer();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Raw;
  const isV2 = r.version === 2;

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
  }
  return s;
}
