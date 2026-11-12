/**
 * INTERPOLACIÓN del rival en red (módulo puro, sin Phaser). El rival manda su estado ~20 veces/s; aquí se guardan
 * esos estados con su hora y se muestra al rival un poco en el pasado (`delayMs`), deslizándolo ENTRE dos posiciones
 * reales (sin tirones ni "patinar" hacia la última que llegó). También da su velocidad real para el ritmo de carrera.
 *
 * Hora de cada estado: la del emisor (`t`, su reloj) llevada al reloj local con el desfase MÍNIMO visto
 * (recibido − enviado): el mensaje que menos tardó marca la referencia, así el retraso variable de la red (jitter) no
 * mueve los estados de sitio. El desfase sube muy despacio por si los relojes derivan.
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

type Entry = RemoteSnap & { t: number };

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
    const t = senderT + this.offset;
    const last = this.buf[this.buf.length - 1];
    if (last && t <= last.t) return; // llegó desordenado o es más viejo que un ancla: se ignora
    this.buf.push({ t, ...s });
    if (this.buf.length > 60) this.buf.shift();
  }

  /**
   * Ancla: el rival está AHORA en `s` (golpe, teletransporte, cinemática…). Se muestra ahí desde ya y los estados
   * siguientes continúan desde este punto.
   */
  reset(now: number, s: RemoteSnap) {
    this.buf = [{ t: now - this.delayMs, ...s }];
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
