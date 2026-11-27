/**
 * (27-11-2026, usuario) CUENTA del jugador (datos puros, sin Phaser). Hoy todos juegan como INVITADO: la cuenta vive solo en el teléfono.
 * Cuando exista el servidor de cuentas (docs/BASE-DE-DATOS.md: servicio sin decidir), iniciar sesión o vincular deja aquí el proveedor y
 * el id de la cuenta (`PlayerState.account`), y AJUSTES pasa de "VINCULAR CUENTA" a "CERRAR SESIÓN".
 * Los ids de proveedor no se cambian nunca (se guardan en la cuenta).
 */
import type { PlayerState } from './player';

export type AuthProvider = 'facebook' | 'google' | 'apple' | 'playgames';
export const AUTH_PROVIDERS: readonly AuthProvider[] = ['facebook', 'google', 'apple', 'playgames'];

/** Cuenta vinculada: proveedor, id que da el servidor y, si lo hay, el correo o nombre para mostrar. */
export interface AccountLink {
  provider: AuthProvider;
  uid: string;
  email?: string;
}

/** Nombre visible de cada proveedor */
export const PROVIDER_NAME: Record<AuthProvider, string> = { facebook: 'Facebook', google: 'Google', apple: 'Apple', playgames: 'Google Play' };

/** ¿Juega como invitado (sin cuenta vinculada)? */
export function isGuest(p: Readonly<PlayerState>): boolean {
  return !p.account;
}

/** Valida una cuenta guardada (migrate.ts); null si no sirve. */
export function parseAccount(raw: unknown): AccountLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!AUTH_PROVIDERS.includes(r.provider as AuthProvider) || typeof r.uid !== 'string' || !r.uid) return null;
  return { provider: r.provider as AuthProvider, uid: r.uid.slice(0, 128), ...(typeof r.email === 'string' && r.email ? { email: r.email.slice(0, 120) } : {}) };
}
