/**
 * INTERPOLACIÓN del rival en red (módulo puro, sin Phaser). El rival manda su estado ~20 veces/s; aquí se guardan
 * esos estados con su hora y se muestra al rival un poco en el pasado (`delayMs`), deslizándolo ENTRE dos posiciones
 * reales (sin tirones ni "patinar" hacia la última que llegó). También da su velocidad real para el ritmo de carrera.
 *
 * Hora de cada estado: se reparte con la separación que dice el emisor (`t`, su reloj) pero SIEMPRE acotada a su
 * llegada local (nunca en el futuro, nunca más de MAX_LAG ms antes de llegar). Así el retraso variable de la red
 * (jitter) no lo hace ir a saltos, y un reloj del emisor raro (cámara lenta, pausa, otra escala) no puede congelarlo:
 * en el peor caso se usa la hora de llegada. El desfase mínimo (recibido − enviado) se guarda aparte (minOffset).
 */
export interface RemoteSnap {
  x: number;
  y: number;
  moving: boolean;
  dirX: number;
  facing: number;
  charging: boolean;
  stunned: boolean;
}

export interface InterpSample {
  x: number;
  y: number;
  /** velocidad real (unidades de cancha por segundo) entre los dos estados que se están mostrando */
  speed: number;
  /** "hambre": no hay un estado más nuevo que el instante mostrado (se queda en el último; con red lenta, se nota) */
  starved: boolean;
  /** estado (banderas) del instante que se muestra */
  snap: RemoteSnap;
}

type Entry = RemoteSnap & { t: number; st: number };

/** un estado se coloca como mucho esto antes de su llegada (ms) */
const MAX_LAG = 150;
/** arranque desde quieto: el movimiento empieza este tiempo antes del primer estado en movimiento (≈ un envío, 50 ms) */
const START_MS = 50;
/** sin estados nuevos: el rival sigue en su dirección como mucho este tiempo (ms) antes de quedarse quieto */
const EXTRAP_MS = 120;

export class RemoteInterp {
  private buf: Entry[] = [];
  private offset: number | null = null;

  constructor(readonly delayMs = 100) {}

  /** desfase mínimo visto (recibido − enviado, ms); null = aún sin estados */
  get minOffset(): number | null {
    return this.offset;
  }

  /** Estado recibido: `senderT` = su hora (ms), `recvT` = hora local de llegada (ms). */
  push(senderT: number, recvT: number, s: RemoteSnap) {
    if (!Number.isFinite(senderT)) senderT = recvT;
    const off = recvT - senderT;
    if (this.offset === null || off < this.offset) this.offset = off;
    else this.offset += (off - this.offset) * 0.002;
    const last = this.buf[this.buf.length - 1];
    // separación del emisor desde el anterior (acotada), pegada a la hora de llegada. Una hora del emisor que no crece
    // (servidor antiguo que la recortaba, reloj raro) NO descarta el estado: se coloca a su hora de llegada.
    const sane = !!last && last.st !== -Infinity && senderT > last.st && senderT - last.st < 1000;
    const ideal = !last ? recvT : sane ? last.t + (senderT - last.st) : recvT;
    const t = Math.min(recvT, Math.max(recvT - MAX_LAG, ideal, last ? last.t + 1 : -Infinity));
    // ARRANQUE: quieto se manda un latido cada 250 ms; si el primer estado en movimiento llega tras un latido viejo, el
    // rival se deslizaría desde ahí todo ese rato (parece que arranca tarde y luego "se alcanza"). Se repite la posición
    // quieta justo antes (START_MS) para que el movimiento empiece cuando de verdad empezó.
    if (last && !last.moving && s.moving && t - last.t > START_MS * 2) {
      this.buf.push({ ...last, t: t - START_MS, st: senderT - START_MS });
    }
    // (...s primero: el estado recibido trae su propio `t` = reloj del EMISOR, que no debe pisar la hora local)
    this.buf.push({ ...s, t, st: senderT });
    if (this.buf.length > 60) this.buf.shift();
  }

  /**
   * Ancla: el rival está AHORA en `s` (golpe, teletransporte, cinemática…). Se muestra ahí desde ya y los estados
   * siguientes continúan desde este punto.
   */
  reset(now: number, s: RemoteSnap) {
    this.buf = [{ ...s, t: now - this.delayMs, st: -Infinity }];
  }

  /** estados guardados (diagnóstico) */
  get size() {
    return this.buf.length;
  }

  clear() {
    this.buf = [];
    this.offset = null;
  }

  /** Posición a mostrar en `now` (ms, reloj local). null = aún no hay estados. */
  sample(now: number): InterpSample | null {
    const b = this.buf;
    if (!b.length) return null;
    const rt = now - this.delayMs;
    // quitar lo que ya quedó atrás (se conserva uno anterior al instante mostrado)
    while (b.length > 2 && b[1].t <= rt) b.shift();
    const a = b[0];
    if (rt <= a.t || b.length === 1) return { x: a.x, y: a.y, speed: 0, snap: a, starved: b.length === 1 && rt > a.t };
    const c = b[1];
    if (rt >= c.t) {
      // sin estados nuevos: si venía corriendo, sigue un poco en su dirección (EXTRAP_MS) en vez de frenar en seco y
      // saltar cuando llegue el siguiente; luego se queda en el último
      const dt = (c.t - a.t) / 1000;
      if (c.moving && a.moving && dt >= 0.02) {
        const ex = Math.min(rt - c.t, EXTRAP_MS) / 1000;
        const vx = (c.x - a.x) / dt;
        const vy = (c.y - a.y) / dt;
        return { x: c.x + vx * ex, y: c.y + vy * ex, speed: Math.hypot(vx, vy), snap: c, starved: true };
      }
      return { x: c.x, y: c.y, speed: 0, snap: c, starved: true };
    }
    const k = (rt - a.t) / (c.t - a.t);
    const dt = (c.t - a.t) / 1000;
    const speed = dt > 0 ? Math.hypot(c.x - a.x, c.y - a.y) / dt : 0;
    return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, speed, snap: a, starved: false };
  }
}
