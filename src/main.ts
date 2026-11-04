import Phaser from 'phaser';
import '@fontsource/lilita-one';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { CustomizeScene } from './scenes/CustomizeScene';
import { MatchmakingScene } from './scenes/MatchmakingScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { VIEW } from './view/projection';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1c2f8f',
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
  scene: [BootScene, MenuScene, CustomizeScene, MatchmakingScene, MatchScene, ResultScene],
});

// Intento de bloquear orientación vertical en navegador (en Android lo fuerza el Manifest)
const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
orientation?.lock?.('portrait').catch(() => undefined);

export default game;

