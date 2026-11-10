/**
 * Dirección del servidor multijugador: ÚNICA fuente de verdad de la red del cliente (WebSocket y, si algún día
 * hay, HTTP). Todo lo que necesite el servidor llama a `serverUrl()` justo antes de conectar: así siempre lee
 * el estado actual del interruptor MODO ONLINE de Ajustes (nada se cachea al arrancar).
 *
 *  - MODO ONLINE = ON  → servidor de producción en AWS (`ONLINE_URL`).
 *  - MODO ONLINE = OFF → sin multijugador: `serverUrl()` devuelve null y JUGAR va directo al BOT.
 * El interruptor se guarda en este dispositivo (localStorage) y persiste al cerrar la app.
 */
import { Capacitor } from '@capacitor/core';

const KEY_ONLINE = 'gamenxo.onlineMode';
/**
 * servidor de producción (AWS EC2, São Paulo) por HTTPS/WSS: Caddy en la EC2 (puerto 443, certificado de Let's
 * Encrypt) reenvía al servidor Node del puerto 3001. Necesario para que la versión web (https) pueda conectar.
 * 18-228-46-227.sslip.io resuelve a la IP de la EC2; si algún día hay dominio propio, cambiar solo esta línea
 * (y el Caddyfile de la EC2).
 */
export const ONLINE_URL = 'https://18-228-46-227.sslip.io';

/** ¿Modo Online activo? Sin valor guardado = ON (servidor de producción). */
export function getOnlineMode(): boolean {
  try {
    return localStorage.getItem(KEY_ONLINE) !== '0';
  } catch {
    return true;
  }
}

export function setOnlineMode(on: boolean) {
  try {
    localStorage.setItem(KEY_ONLINE, on ? '1' : '0');
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * URL del servidor ACTIVO según el interruptor (se lee en cada llamada), o null si el Modo Online está apagado.
 * En la versión web servida por https, el navegador BLOQUEA conectar a un servidor http/ws (contenido mixto): sin
 * servidor https/wss no se intenta (JUGAR va directo al BOT en vez de esperar un timeout). La app nativa (APK) también
 * se sirve como https://localhost pero permite contenido mixto (capacitor.config), así que NO se limita.
 */
export function serverUrl(): string | null {
  if (!getOnlineMode()) return null;
  const securePage = typeof location !== 'undefined' && location.protocol === 'https:';
  if (securePage && !Capacitor.isNativePlatform() && ONLINE_URL.startsWith('http:')) return null;
  return ONLINE_URL;
}