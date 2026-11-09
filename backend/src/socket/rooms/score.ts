/**
 * Marcador OFICIAL de una sala (mismas reglas que frontend/src/logic/Score.ts: 15/30/40/juego, ventaja o punto
 * de oro, partido al llegar a `gamesToWin` juegos). Índice 0 = host, 1 = guest.
 */
export interface ScoreState {
  points: [number, number];
  games: [number, number];
}

export const newScore = (): ScoreState => ({ points: [0, 0], games: [0, 0] });

export interface PointOutcome {
  gameWinner: 0 | 1 | null;
  matchWinner: 0 | 1 | null;
}

export function scorePoint(s: ScoreState, w: 0 | 1, gamesToWin: number, goldenPoint: boolean): PointOutcome {
  const l = (1 - w) as 0 | 1;
  const p = s.points;
  let gameWon = false;
  if (p[0] >= 3 && p[1] >= 3) {
    if (goldenPoint && p[0] === p[1]) gameWon = true;
    else if (p[w] > p[l]) gameWon = true; // tenía ventaja
    else if (p[w] === p[l]) p[w]++; // iguales -> ventaja
    else p[l]--; // pierde la ventaja el rival -> iguales
  } else {
    p[w]++;
    if (p[w] >= 4) gameWon = true;
  }
  if (!gameWon) return { gameWinner: null, matchWinner: null };
  s.games[w]++;
  s.points = [0, 0];
  return { gameWinner: w, matchWinner: s.games[w] >= gamesToWin ? w : null };
}
