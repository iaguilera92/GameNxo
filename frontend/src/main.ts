import './platformStarter'; // primero: personaje inicial según plataforma (web = Mai, app = Nxo)
import Phaser from 'phaser';
import '@fontsource/lilita-one';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
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
  fps: { target: 60 },
  scene: [BootScene, MenuScene, CustomizeScene, ShopScene, BattlePassScene, MatchmakingScene, MatchScene, ResultScene, RankedScene, LanSearchScene],
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

