/**
 * TEXTOS BREVES de las cards de la Tienda (21-11-2026, usuario): máximo 4 palabras. La descripción completa de cada poder
 * (infernoPowers, smashPowers, defensivePowers, chargeFx, zoneSkins) sigue en la vista previa; esto solo va en la card.
 * Datos puros, sin Phaser. El id de un poder no cambia nunca (docs/BASE-DE-DATOS.md): se busca por tipo + id.
 */
export type BlurbKind = 'inferno' | 'smash' | 'defensive' | 'charge' | 'zone';
const BLURBS: Record<BlurbKind, Record<string, string>> = {
  inferno: {
    fire: 'Golpe de fuego devastador',
    ice: 'Remolino de hielo',
    wind: 'Torbellino de viento',
    lightning: 'Esfera eléctrica',
    tulip: 'Ráfaga de pétalos',
    shadow: 'Esfera de oscuridad',
    light: 'Luz sagrada dorada',
    ultra: 'Efecto brutal de aire',
    barrage: 'Ráfaga de pelotas',
    energy: 'Bola de energía gigante',
    hurricane: 'Viento y tornado',
  },
  smash: {
    fire: 'Bola de fuego',
    ice: 'Pelota helada',
    wind: 'Torbellino verde',
    lightning: 'Pelota eléctrica',
    shadow: 'Esfera de sombra',
    light: 'Esfera de luz',
    comet: 'Meteorito con cráter',
    dragon: 'Dragón de fuego',
  },
  defensive: {
    dash: 'Sprint explosivo',
    blink: 'Teletransporte con revés',
    shadow: 'Clon de sombra',
    jump: 'Salto con onda',
    flip: 'Volteretas laterales',
    skate: 'Patinaje sobre hielo',
    lightning: 'Rayo con estela',
    slowmo: 'Tiempo lento',
  },
  charge: {
    classic: 'Aro de energía',
    fire: 'Aro de llamas',
    energy: 'Aro de energía azul',
    tulip: 'Pétalos giratorios',
  },
  zone: {
    electric: 'Rayo en los ojos',
    fire: 'Aura de llamas',
    shadow: 'Oscuridad y humo',
  },
};
/** Texto breve de la card; si un poder nuevo aún no lo tiene, sus primeras 4 palabras. */
export function shopBlurb(kind: BlurbKind, id: string, fullDesc: string): string {
  const b = BLURBS[kind][id];
  if (b) return b;
  return fullDesc.split(/\s+/).slice(0, 4).join(' ').replace(/[.,:;]+$/, '');
}
