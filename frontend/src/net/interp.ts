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
  /** estado (banderas) del instante que se muestra */
  snap: RemoteSnap;
}

type Entry = RemoteSnap & { t: number; st: number };

/** un estado se coloca como mucho esto antes de su llegada (ms) */
const MAX_LAG = 150;

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
    if (rt <= a.t || b.length === 1) return { x: a.x, y: a.y, speed: 0, snap: a };
    const c = b[1];
    if (rt >= c.t) return { x: c.x, y: c.y, speed: 0, snap: c }; // sin estados nuevos: se queda en el último
    const k = (rt - a.t) / (c.t - a.t);
    const dt = (c.t - a.t) / 1000;
    const speed = dt > 0 ? Math.hypot(c.x - a.x, c.y - a.y) / dt : 0;
    return { x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, speed, snap: a };
  }
}
