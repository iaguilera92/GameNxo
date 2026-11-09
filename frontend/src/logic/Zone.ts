/**
 * ZONA — mecánica de remontada (lógica pura, sin Phaser; la usa MatchScene).
 *
 * Reglas (decididas con el usuario):
 *  - Se cuentan los puntos GANADOS por cada lado en todo el partido.
 *  - Un lado entra en Zona cuando ya ganó al menos `minPoints` puntos y el rival le saca `lead` o más puntos
 *    de ventaja (va perdiendo). Ayuda al que va perdiendo: si vas ganando, no se activa.
 *  - Una sola vez por partido para cada lado. Dura los `durationPoints` puntos siguientes.
 *  - En Zona: más rápido, golpes más fuertes, más alcance (ágil) y resistente (inmune al impacto de la bola de
 *    fuego del SMASH / INFERNO rival; más adelante, también a la rotura de raqueta).
 * Determinista: con el mismo marcador da el mismo resultado en los dos teléfonos (partido en red).
 */
export type Side = 'player' | 'bot';

export const ZONE = {
  minPoints: 6,
  lead: 2,
  durationPoints: 2,
  /** velocidad de desplazamiento */
  speedMult: 1.25,
  /** velocidad de los golpes (no globos ni dejadas) */
  shotMult: 1.15,
  /** alcance de la raqueta */
  reachMult: 1.2,
};

export class ZoneTracker {
  /** puntos ganados en el partido */
  won: Record<Side, number> = { player: 0, bot: 0 };
  /** puntos de Zona que quedan (0 = sin Zona) */
  left: Record<Side, number> = { player: 0, bot: 0 };
  /** ya la usó en este partido */
  used: Record<Side, boolean> = { player: false, bot: false };

  active(side: Side) {
    return this.left[side] > 0;
  }

  /**
   * Registra un punto. Primero consume un punto de Zona de quien la tenga (el punto recién jugado contaba
   * como turno de Zona) y luego comprueba si alguien entra en Zona para los próximos puntos.
   * Devuelve el lado que acaba de entrar en Zona (o null) y quién salió.
   */
  onPoint(winner: Side): { entered: Side | null; ended: Side[] } {
    const ended: Side[] = [];
    for (const s of ['player', 'bot'] as Side[])
      if (this.left[s] > 0) {
        this.left[s]--;
        if (this.left[s] === 0) ended.push(s);
      }
    this.won[winner]++;
    let entered: Side | null = null;
    for (const s of ['player', 'bot'] as Side[]) {
      const other: Side = s === 'player' ? 'bot' : 'player';
      if (!this.used[s] && this.won[s] >= ZONE.minPoints && this.won[other] - this.won[s] >= ZONE.lead) {
        this.used[s] = true;
        this.left[s] = ZONE.durationPoints;
        entered = s;
      }
    }
    return { entered, ended };
  }
}
