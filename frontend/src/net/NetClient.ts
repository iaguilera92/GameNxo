/**
 * Conexión con el servidor multijugador. Capa de TRANSPORTE separada del motor de juego: MatchScene y las
 * escenas solo usan NetTransport / MatchNet; cambiar LAN por el servidor online (Render) = otra URL, sin tocar
 * las mecánicas.
 */
import { io, type Socket } from 'socket.io-client';
import { serverUrl } from './config';

/** Lo mínimo que necesita el juego de un transporte en tiempo real. */
export interface NetTransport {
  readonly connected: boolean;
  emit(ev: string, data?: unknown): void;
  /** como emit, pero si la red va congestionada el mensaje se descarta (estado que se repite: posición del jugador) */
  emitVolatile(ev: string, data?: unknown): void;
  on(ev: string, cb: (data: never) => void): void;
  off(ev: string, cb: (data: never) => void): void;
}

class SocketTransport implements NetTransport {
  constructor(readonly socket: Socket) {}
  get connected() {
    return this.socket.connected;
  }
  emit(ev: string, data?: unknown) {
    this.socket.emit(ev, data);
  }
  emitVolatile(ev: string, data?: unknown) {
    this.socket.volatile.emit(ev, data);
  }
  on(ev: string, cb: (data: never) => void) {
    this.socket.on(ev, cb as (d: unknown) => void);
  }
  off(ev: string, cb: (data: never) => void) {
    this.socket.off(ev, cb as (d: unknown) => void);
  }
}

let current: { url: string; socket: Socket; transport: SocketTransport } | null = null;

/**
 * Conecta (o reutiliza la conexión) con el servidor configurado. Rechaza si no hay dirección o si no responde
 * en `timeoutMs` (p. ej. el PC apagado o la IP cambió).
 */
export function connect(timeoutMs = 3500): Promise<NetTransport> {
  const url = serverUrl();
  if (!url) return Promise.reject(new Error('sin_servidor'));
  if (current && current.url === url && current.socket.connected) return Promise.resolve(current.transport);
  disconnect();
  const socket = io(url, { transports: ['websocket'], reconnection: false, timeout: timeoutMs });
  const transport = new SocketTransport(socket);
  current = { url, socket, transport };
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.close();
      reject(new Error('sin_respuesta'));
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(t);
      resolve(transport);
    });
    socket.once('connect_error', (e) => {
      clearTimeout(t);
      socket.close();
      reject(e);
    });
  });
}

export function disconnect() {
  current?.socket.close();
  current = null;
}

export function transport(): NetTransport | null {
  return current?.socket.connected ? current.transport : null;
}
