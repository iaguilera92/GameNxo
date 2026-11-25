import { GAMES_TO_WIN, GOLDEN_POINT } from '../config';

export type Side = 0 | 1; // 0 = jugador, 1 = bot

const LABELS = ['0', '15', '30', '40'];

export interface PointResult {
  gameWinner: Side | null;
  matchWinner: Side | null;
}

/** Marcador: puntos 15/30/40/juego con ventaja simplificada (o punto de oro). */
export class Score {
  games: [number, number] = [0, 0];
  points: [number, number] = [0, 0];

  constructor(readonly shortMatch = false) {}

  get gameIndex() {
    return this.games[0] + this.games[1];
  }

  /**
   * Desfase del turno de saque (partido en red: el invitado ve al host como 'bot' y el host saca primero).
   * 0 = como siempre (el jugador saca el primer juego).
   */
  serverOffset = 0;

  /** Saca el jugador en juegos pares y el bot en impares (con serverOffset 1, al revés). */
  get server(): Side {
    if (this.fixedServer !== null) return this.fixedServer;
    // (25-11-2026, usuario) por los puntos que CUENTAN (los guiados del tutorial no): 1 el jugador, 2 el bot, 2 el jugador...
    if (this.shortMatch) return ((this.serverOffset + Math.floor((this.points[0] + this.points[1] + 1) / 2)) % 2) as Side;
    return ((this.gameIndex + this.serverOffset) % 2) as Side;
  }

  /** puntos jugados en el partido (crece siempre, también en iguales/ventaja): numera los estados en red */
  played = 0;

  /** (25-11-2026, usuario) tutorial: quién saca, fijo (puntos guiados); null = el turno de siempre */
  fixedServer: Side | null = null;

  /** `practice` (25-11-2026, usuario): punto guiado del tutorial, se juega pero NO suma al marcador */
  pointTo(w: Side, practice = false): PointResult {
    this.played++;
    if (practice) return { gameWinner: null, matchWinner: null };
    if (this.shortMatch) {
      this.points[w]++;
      return { gameWinner: null, matchWinner: this.points[w] >= 4 ? w : null };
    }
    const l = (1 - w) as Side;
    const p = this.points;
    let gameWon = false;

    if (p[0] >= 3 && p[1] >= 3) {
      if (GOLDEN_POINT && p[0] === p[1]) gameWon = true;
      else if (p[w] > p[l]) gameWon = true; // tenía ventaja
      else if (p[w] === p[l]) p[w]++; // iguales -> ventaja
      else p[l]--; // pierde la ventaja el rival -> iguales
    } else {
      p[w]++;
      if (p[w] >= 4) gameWon = true;
    }

    if (!gameWon) return { gameWinner: null, matchWinner: null };
    this.games[w]++;
    this.points = [0, 0];
    return { gameWinner: w, matchWinner: this.games[w] >= GAMES_TO_WIN ? w : null };
  }

  /** Etiqueta del punto actual de cada lado. */
  labels(): [string, string] {
    const p = this.points;
    if (this.shortMatch) return [String(p[0]), String(p[1])];
    if (p[0] >= 3 && p[1] >= 3) {
      if (p[0] === p[1]) return ['40', '40'];
      return p[0] > p[1] ? ['AD', '40'] : ['40', 'AD'];
    }
    return [LABELS[p[0]], LABELS[p[1]]];
  }

  /** Texto especial: "Iguales" / "Ventaja" / "Punto de oro". */
  status(): string | null {
    if (this.shortMatch) return null;
    const p = this.points;
    if (p[0] >= 3 && p[1] >= 3) {
      if (p[0] === p[1]) return GOLDEN_POINT ? '¡Punto de oro!' : 'Iguales';
      return 'Ventaja';
    }
    return null;
  }
}
