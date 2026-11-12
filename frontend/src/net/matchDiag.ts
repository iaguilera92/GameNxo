/**
 * LOG DE DIAGNÓSTICO del partido en red: eventos del juego y anomalías que se ven raras en pantalla, en lotes al
 * servidor (game:log), que los guarda por sala (backend/logs/matches). No se reenvía al rival.
 *
 * Qué se registra (ev = nombre del evento):
 *  - send / recv          golpes y avisos enviados y recibidos (tipo, retraso, avance de la pelota…)
 *  - phase / point        cambios de fase y puntos
 *  - snap                 foto cada 1 s: fase, los dos personajes (posición, estado, clip, frame), pelota, red
 *  - run-in-place         el rival tiene el clip de correr pero no se mueve (> 300 ms)
 *  - teleport             el rival salta más de 60 unidades en un fotograma (y por qué: golpe, ancla…)
 *  - stuck                un personaje lleva > 3 s en un estado ocupado (saque, remate, golpe, estirada…)
 *  - no-state             > 500 ms sin estados del rival
 *  - flu                  FLUIDEZ cada 1 s: fps, cuadro más largo (maxF) y tirones > 50 ms (jank); estados del rival
 *                         recibidos (in) y mayor hueco entre llegadas (gap); estados enviados (out); fotogramas sin
 *                         estado nuevo en el suavizado (starve %); retraso medio / máximo del rival dibujado (lag/lagMax)
 *  - mv                   MOVIMIENTO cada 100 ms (solo en juego): tú y el rival (posición dibujada, animación), el
 *                         último estado recibido del rival y la distancia a él (cuánto va por detrás), la pelota
 * Para activarlo / desactivarlo: localStorage 'dev.netLog' = '1' / '0' (por defecto ACTIVO mientras probamos).
 */
type Val = number | string | boolean;
export type DiagEntry = Record<string, Val | undefined>;

export function netLogOn(): boolean {
  try {
    return localStorage.getItem('dev.netLog') !== '0';
  } catch {
    return true;
  }
}

export class MatchDiag {
  private buf: Record<string, Val>[] = [];
  private flushAt = 0;
  private t0 = performance.now();
  /** cuántos eventos se descartaron por tope (se informa en el siguiente lote) */
  private dropped = 0;

  constructor(private send: (entries: Record<string, Val>[]) => void) {}

  /** Añade un evento (los valores undefined se quitan; los números se redondean). */
  log(ev: string, data: DiagEntry = {}) {
    const e: Record<string, Val> = { ev, ms: Math.round(performance.now() - this.t0) };
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      e[k] = typeof v === 'number' ? Math.round(v * 10) / 10 : v;
    }
    if (this.buf.length >= 240) {
      this.dropped++;
      return;
    }
    this.buf.push(e);
  }

  /** Llamar cada fotograma: envía un lote cada ~1 s (o antes si se acumulan), siempre por debajo del tope del servidor. */
  tick(now = performance.now()) {
    if (now < this.flushAt || !this.buf.length) return;
    if (this.dropped) {
      this.buf.unshift({ ev: 'dropped', n: this.dropped, ms: Math.round(now - this.t0) });
      this.dropped = 0;
    }
    this.send(this.batch());
    // si quedó más, el siguiente lote sale pronto (el servidor admite 2 por segundo)
    this.flushAt = now + (this.buf.length ? 550 : 1000);
  }

  /** Envía lo pendiente (fin del partido). */
  flush() {
    while (this.buf.length) this.send(this.batch());
  }

  /** Un lote que cabe holgado en el tope de mensaje del servidor (8 KB): máx. 25 eventos y ~6 KB. */
  private batch() {
    const out: Record<string, Val>[] = [];
    let bytes = 20;
    while (this.buf.length && out.length < 25) {
      const len = JSON.stringify(this.buf[0]).length + 1;
      if (out.length && bytes + len > 6000) break;
      bytes += len;
      out.push(this.buf.shift()!);
    }
    return out;
  }
}
