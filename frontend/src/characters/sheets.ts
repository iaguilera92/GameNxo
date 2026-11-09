import nxoBack from './nxo-sprites.json';
import nxoFront from './nxo-front-sprites.json';
import maiBack from './mai-sprites.json';
import maiFront from './mai-front-sprites.json';

/**
 * Hojas de animación procesadas (tools/build-nxo-sprites.mjs <hoja.png> <id>).
 * Cada una vive en public/assets/characters/<id>-sprites/ y tiene su JSON de celda, ancla y fotogramas clave.
 * Para añadir una hoja: generarla con la herramienta, importar su JSON aquí y registrarla en SHEETS.
 */
export type SheetId = 'nxo' | 'nxo-front' | 'mai' | 'mai-front';
export type SheetCfg = typeof nxoBack;

export const SHEETS: Record<SheetId, SheetCfg> = {
  nxo: nxoBack,
  'nxo-front': nxoFront,
  mai: maiBack,
  'mai-front': maiFront,
};
export const SHEET_IDS = Object.keys(SHEETS) as SheetId[];
