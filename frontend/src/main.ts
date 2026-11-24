import './platformStarter'; // primero: personaje inicial según plataforma (web = Mai, app = Nxo)
import Phaser from 'phaser';
import '@fontsource/lilita-one';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { OnboardingScene } from './scenes/OnboardingScene';
import { CustomizeScene } from './scenes/CustomizeScene';
import { ShopScene } from './scenes/ShopScene';
import { BattlePassScene } from './scenes/BattlePassScene';
import { MatchmakingScene } from './scenes/MatchmakingScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { RankedScene } from './scenes/RankedScene';
import { LanSearchScene } from './scenes/LanSearchScene';
import { VIEW } from './view/projection';
import { installSettings } from './logic/Settings';
import { installBlackTransitions } from './fx/transitions';
import { installAdMob } from './ads/admobProvider';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#000000', // negro: entre pantallas (y mientras una carga) no se ve azul
  scale: {
    // EXPAND: garantiza un área mínima de 720x1280 (vertical) y se extiende en pantallas más altas/anchas
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW.W,
    height: VIEW.H,
  },
  input: { activePointers: 4 },
  render: { antialias: true, powerPreference: 'high-performance', batchSize: 4096 },
  // (21-11-2026, usuario) tope de 60 fps: en pantallas de 90/120 Hz no dibuja de más (batería, calor, cuadros parejos y misma sensación en todos)
  // (21-11-2026, log online) NO usar limit: 60: Phaser (TimeStep.stepLimitFPS) exige delta >= 1000/limit y borra el sobrante, así que
  // en 60 Hz un cuadro de 16,6 ms (jitter) se salta -> 30 fps (invitado) y en 120 Hz ~45. Con 100 (10 ms): 60 Hz -> 60, 120 Hz -> 60
  // (8,3 ms no llega, 16,7 sí), 90 Hz -> 90, 144 Hz -> 72; margen de 1+ ms contra el jitter en todas.
  fps: { target: 60, limit: 100 },
  scene: [BootScene, OnboardingScene, MenuScene, CustomizeScene, ShopScene, BattlePassScene, MatchmakingScene, MatchScene, ResultScene, RankedScene, LanSearchScene],
});

// Ajustes del jugador (sonido, vibración, temblor de pantalla) aplicados a todo el juego
installSettings(game);
// cambio de pantalla siempre con fundido a negro
installBlackTransitions();
// Anuncios (AdMob) solo en la app nativa y con VITE_ADS_ENABLED=true; no bloquea el arranque
void installAdMob();

// Intento de bloquear orientación vertical en navegador (en Android lo fuerza el Manifest)
const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
orientation?.lock?.('portrait').catch(() => undefined);

// solo en desarrollo (npm run dev): el juego queda en window.__game para probar mecánicas desde la consola del navegador
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

export default game;

