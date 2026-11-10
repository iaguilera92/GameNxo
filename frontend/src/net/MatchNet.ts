/**
 * Sesión de un partido en red (1v1). La crea el matchmaking al emparejar y la recibe MatchScene.
 * Envía / recibe los mensajes del partido (protocol.ts) y los traduce a coordenadas locales (espejo).
 * El motor NO sabe nada de Socket.IO: solo llama a estos métodos y recibe callbacks.
 *
 * Ciclo de vida: desde el EMPAREJAMIENTO (constructor) se escuchan inicio, fin, abandono y desconexión, aunque
 * todavía se esté viendo la pantalla VS. Si algo llega antes de que la escena del partido se conecte (attach),
 * queda guardado y se le entrega al conectarse: no se pierde ningún aviso entre escenas.
 */
import { EV, type ActionMsg, type HitMsg, type OverMsg, type OpponentLeftMsg, type PlayerProfile, type PointMsg, type Role, type ScoreMsg, type StateMsg } from './protocol';
import type { NetTransport } from './NetClient';
import { mirrorBall, mirrorX, mirrorY } from './mirror';

export interface MatchNetHandlers {
  onStart(): void;
  /** estado del rival YA en coordenadas locales */
  onState(s: StateMsg): void;
  /** golpe del rival con la pelota YA en coordenadas locales */
  onHit(h: HitMsg): void;
  onAction(a: ActionMsg): void;
  /** punto avisado por el juez: `forMe` = el punto es para el jugador local */
  onPoint(p: PointMsg, forMe: boolean): void;
  onScore(s: ScoreMsg): void;
  onOver(o: OverMsg, iWon: boolean): void;
  onOpponentLeft(o: OpponentLeftMsg): void;
  /** se perdió la conexión con el servidor */
  onDisconnect(): void;
}

/** Eventos que terminan la sesión (se escuchan desde el emparejamiento). */
export type NetEnd = { kind: 'left'; msg: OpponentLeftMsg } | { kind: 'over'; msg: OverMsg } | { kind: 'disconnect' };

export class MatchNet {
  private hitSeq = 0;
  private pointSeq = 0;
  /** últimos números de secuencia recibidos del rival (descarta repetidos / atrasados) */
  private lastHitIn = -1;
  private lastPointIn = -1;
  private bound: [string, (d: never) => void][] = [];
  private early: [string, (d: never) => void][] = [];
  private handlers: MatchNetHandlers | null = null;
  private endListeners = new Set<(e: NetEnd) => void>();
  /** el servidor ya dio la salida (START) */
  started = false;
  /** la sesión terminó (fin oficial, abandono o desconexión); null = sigue */
  ended: NetEnd | null = null;
  private endDelivered = false;

  constructor(
    readonly transport: NetTransport,
    readonly roomId: string,
    readonly role: Role,
    readonly opponent: PlayerProfile,
    readonly gamesToWin: number,
  ) {
    // escucha de ciclo de vida desde el emparejamiento (pantalla VS incluida)
    const on = <T>(ev: string, cb: (d: T) => void) => {
      const f = cb as (d: never) => void;
      this.transport.on(ev, f);
      this.early.push([ev, f]);
    };
    on(EV.START, () => {
      if (this.started) return;
      this.started = true;
      this.handlers?.onStart();
    });
    on<OpponentLeftMsg>(EV.OPPONENT_LEFT, (m) => this.end({ kind: 'left', msg: m }));
    on<OverMsg>(EV.OVER, (m) => this.end({ kind: 'over', msg: m }));
    on('disconnect', () => this.end({ kind: 'disconnect' }));
  }

  private end(e: NetEnd) {
    // un abandono va seguido del fin oficial: se conserva el primer motivo (el más informativo)
    if (!this.ended) this.ended = e;
    this.endListeners.forEach((l) => l(e));
    this.deliverEnd(e);
  }

  /** Entrega el fin a la escena del partido (si ya está conectada). */
  private deliverEnd(e: NetEnd) {
    const h = this.handlers;
    if (!h) return;
    if (e.kind === 'left') h.onOpponentLeft(e.msg);
    else if (e.kind === 'over') h.onOver(e.msg, e.msg.winner === this.role);
    else h.onDisconnect();
    this.endDelivered = true;
  }

  /** Suscripción al fin de sesión (p. ej. la pantalla VS). Devuelve la función para desuscribirse. */
  onEnd(l: (e: NetEnd) => void) {
    this.endListeners.add(l);
    return () => this.endListeners.delete(l);
  }

  /** Conecta los callbacks de la escena (y avisa al servidor de que ya cargó: READY). */
  attach(h: MatchNetHandlers) {
    this.detach();
    this.handlers = h;
    const on = <T>(ev: string, cb: (d: T) => void) => {
      const f = cb as (d: never) => void;
      this.transport.on(ev, f);
      this.bound.push([ev, f]);
    };
    on<StateMsg>(EV.STATE, (s) => h.onState({ ...s, x: mirrorX(s.x), y: mirrorY(s.y), dirX: -s.dirX, facing: -s.facing }));
    on<HitMsg>(EV.HIT, (m) => {
      if (typeof m.seq === 'number') {
        if (m.seq <= this.lastHitIn) return; // repetido
        this.lastHitIn = m.seq;
      }
      h.onHit({ ...m, x: mirrorX(m.x), y: mirrorY(m.y), ball: mirrorBall(m.ball) });
    });
    on<ActionMsg>(EV.ACTION, (a) => h.onAction(a));
    on<PointMsg>(EV.POINT, (p) => {
      if (typeof p.seq === 'number') {
        if (p.seq <= this.lastPointIn) return; // repetido
        this.lastPointIn = p.seq;
      }
      h.onPoint(p, p.to === 'opponent');
    });
    on<ScoreMsg>(EV.SCORE, (s) => h.onScore(s));
    if (!this.ended) this.transport.emit(EV.READY);
    // lo que llegó mientras se cambiaba de escena
    if (this.ended && !this.endDelivered) this.deliverEnd(this.ended);
    else if (this.started) h.onStart();
  }

  /** Desconecta la escena del partido (los avisos de ciclo de vida siguen activos hasta dispose). */
  detach() {
    for (const [ev, f] of this.bound) this.transport.off(ev, f);
    this.bound = [];
    this.handlers = null;
  }

  /** Fin de la sesión: quita todas las escuchas. */
  dispose() {
    this.detach();
    for (const [ev, f] of this.early) this.transport.off(ev, f);
    this.early = [];
    this.endListeners.clear();
  }

  /** El host saca el primer juego (y los pares); el invitado, los impares. */
  get servesFirst() {
    return this.role === 'host';
  }

  sendState(s: StateMsg) {
    this.transport.emitVolatile(EV.STATE, s);
  }

  sendHit(h: Omit<HitMsg, 'seq'>) {
    this.transport.emit(EV.HIT, { ...h, seq: this.hitSeq++ });
  }

  sendAction(kind: ActionMsg['kind'], data?: ActionMsg['data']) {
    this.transport.emit(EV.ACTION, { kind, data });
  }

  /** Punto / falta / let decidido aquí (somos el juez de la pelota). `forMe` = el punto es para el jugador local. */
  sendPoint(kind: PointMsg['kind'], forMe: boolean, reason: string, color: string, games?: [number, number]) {
    this.transport.emit(EV.POINT, { seq: this.pointSeq++, kind, to: forMe ? 'me' : 'opponent', reason, color, games });
  }

  leave() {
    this.transport.emit(EV.LEAVE);
  }
}
