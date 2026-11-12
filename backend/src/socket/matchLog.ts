/**
 * LOG DE PARTIDAS (diagnóstico): una línea JSON por evento en logs/matches/<fecha>/<sala>.jsonl.
 * Lo escriben el servidor (emparejado, inicio, cortes, puntos, fin y un resumen de lo que reenvía) y los clientes
 * (game:log: eventos del juego, anomalías de sprites, fotos periódicas del estado). Sirve para ver qué pasó en un
 * partido online cuando algo se ve mal (sprites que no salen, saltos, saques, remates, habilidades…).
 *  - Cada sala tiene un tope de tamaño (MAX_BYTES): lo que pase de ahí se descarta.
 *  - Al arrancar se borran las carpetas de más de KEEP_DAYS días.
 *  - Escritura asíncrona y sin esperar: un fallo de disco nunca afecta al partido.
 */
import { appendFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs', 'matches');
/**
 * LOG-PARTIDO: el MISMO registro en texto legible, solo de la ÚLTIMA partida (se reescribe al emparejar otra).
 * backend/logs/LOG-PARTIDO.txt · leerlo en el servidor:  tail -f ~/GameNxo/backend/logs/LOG-PARTIDO.txt
 * Solo para pruebas: se apaga con LOG_PARTIDO=0.
 */
export const LOG_PARTIDO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs', 'LOG-PARTIDO.txt');
const TEXT_ON = process.env.LOG_PARTIDO !== '0';
const MAX_BYTES = 3 * 1024 * 1024;
const KEEP_DAYS = 5;

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const safe = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);

export class MatchLogger {
  private size = new Map<string, number>();
  private dirs = new Set<string>();
  private queue = new Map<string, Promise<void>>();
  /** sala que se escribe en LOG-PARTIDO (la última emparejada) */
  private textRoom = '';
  private textQueue: Promise<void> = Promise.resolve();
  private textBytes = 0;

  constructor(readonly root = ROOT) {
    void this.prune();
  }

  /** Ruta del log de una sala (por la fecha en que empezó a escribirse). */
  file(roomId: string, t = Date.now()) {
    return join(this.root, day(t), `${safe(roomId)}.jsonl`);
  }

  /** Añade un evento (src = 'srv' | 'host' | 'guest'). */
  write(roomId: string, src: string, entry: Record<string, unknown>) {
    this.text(roomId, src, entry);
    const line = JSON.stringify({ ts: new Date().toISOString(), src, ...entry }) + '\n';
    const key = safe(roomId);
    const cur = this.size.get(key) ?? 0;
    if (cur + line.length > MAX_BYTES) return;
    this.size.set(key, cur + line.length);
    const f = this.file(roomId);
    const dir = dirname(f);
    // en orden: cada sala escribe en cola (una escritura detrás de otra)
    const prev = this.queue.get(key) ?? Promise.resolve();
    const next = prev
      .then(() => (this.dirs.has(dir) ? undefined : mkdir(dir, { recursive: true }).then(() => void this.dirs.add(dir))))
      .then(() => appendFile(f, line))
      .catch(() => undefined);
    this.queue.set(key, next);
  }

  /**
   * LOG-PARTIDO (texto): una línea por evento → "14:26:11.512 [host ] mv      me=… rv=…". Al emparejarse una sala
   * nueva el archivo empieza de cero con su cabecera; los eventos de otras salas no entran.
   */
  private text(roomId: string, src: string, entry: Record<string, unknown>) {
    if (!TEXT_ON) return;
    const ev = String(entry.ev ?? '?');
    let head: string | null = null;
    if (ev === 'matched' && roomId !== this.textRoom) {
      this.textRoom = roomId;
      this.textBytes = 0;
      head = `===== PARTIDO ${roomId}  ${new Date().toISOString()}  host=${entry.host} (${entry.hostSkin})  guest=${entry.guest} (${entry.guestSkin}) =====
`;
    }
    if (roomId !== this.textRoom) return;
    const fields = Object.entries(entry)
      .filter(([k, v]) => k !== 'ev' && v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${typeof v === 'string' && v.includes(' ') ? `"${v}"` : v}`)
      .join(' ');
    const line = `${new Date().toISOString().slice(11, 23)} [${src.padEnd(5)}] ${ev.padEnd(12)} ${fields}
`;
    if (this.textBytes + line.length > MAX_BYTES * 2) return;
    this.textBytes += line.length;
    this.textQueue = this.textQueue
      .then(() => mkdir(dirname(LOG_PARTIDO), { recursive: true }))
      .then(() => (head !== null ? writeFile(LOG_PARTIDO, head + line) : appendFile(LOG_PARTIDO, line)))
      .catch(() => undefined);
  }

  /** Últimas salas con log (más recientes primero): nombre, tamaño y fecha. */
  async list(limit = 30): Promise<{ day: string; room: string; bytes: number; mtime: string }[]> {
    const out: { day: string; room: string; bytes: number; mtime: string }[] = [];
    let days: string[] = [];
    try {
      days = (await readdir(this.root)).sort().reverse();
    } catch {
      return out;
    }
    for (const d of days) {
      for (const f of await readdir(join(this.root, d)).catch(() => [] as string[])) {
        if (!f.endsWith('.jsonl')) continue;
        const st = await stat(join(this.root, d, f)).catch(() => null);
        if (st) out.push({ day: d, room: f.replace('.jsonl', ''), bytes: st.size, mtime: st.mtime.toISOString() });
      }
    }
    return out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1)).slice(0, limit);
  }

  /** Busca el archivo de una sala en cualquier día guardado. */
  async find(roomId: string): Promise<string | null> {
    const room = safe(roomId);
    for (const it of await this.list(500)) if (it.room === room) return join(this.root, it.day, `${room}.jsonl`);
    return null;
  }

  private async prune() {
    const limit = Date.now() - KEEP_DAYS * 86_400_000;
    for (const d of await readdir(this.root).catch(() => [] as string[])) {
      const t = Date.parse(d);
      if (Number.isFinite(t) && t < limit) await rm(join(this.root, d), { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
