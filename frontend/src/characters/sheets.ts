import nxoBack from './nxo-sprites.json';
import nxoFront from './nxo-front-sprites.json';
import maiBack from './mai-sprites.json';
import maiFront from './mai-front-sprites.json';

/**
 * Hojas de animación de cada personaje y vista (config de celda, ancla y fotogramas clave; las genera tools/build-moves.mjs <id>).
 * Cada una vive en public/assets/characters/<id>-sprites/ y tiene su JSON de celda, ancla y fotogramas clave.
 * Para añadir una hoja: generarla con la herramienta, importar su JSON aquí y registrarla en SHEETS.
 */
export type SheetId = 'nxo' | 'nxo-front' | 'mai' | 'mai-front';
type SheetAnim = { file: string; frames: number; fps: number; loop: boolean; impact?: number; scale?: number; cell?: { w: number; h: number }; origin?: { x: number; y: number } };
/** (14-11-2026) cada animación puede traer su propia celda y ancla (sprites en alta, tools/build-hd.mjs) */
export type SheetCfg = Omit<typeof nxoBack, 'animations'> & { animations: Record<keyof (typeof nxoBack)['animations'], SheetAnim> };

export const SHEETS: Record<SheetId, SheetCfg> = {
  nxo: nxoBack,
  'nxo-front': nxoFront,
  mai: maiBack,
  'mai-front': maiFront,
};
export const SHEET_IDS = Object.keys(SHEETS) as SheetId[];
