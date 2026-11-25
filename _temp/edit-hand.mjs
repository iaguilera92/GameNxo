import fs from 'fs';
const ed=[
['frontend/src/ui/guideFocus.ts',`import type Phaser from 'phaser';
import { FONT } from './theme';
`,`import type Phaser from 'phaser';
import { FONT } from './theme';

/** mano que indica dónde tocar (assets/ui/guide-click.webp; original en _temp/respaldo_oficial/ui/click.png) */
const HAND = { key: 'guide-click', file: 'assets/ui/guide-click.webp', tipX: 0.255, tipY: 0.185, width: 130 };

/** La mano, abajo a la derecha del control, apuntando a él, con un toque que se repite (baja, aprieta y suelta un anillo). */
function tapHand(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number) {
  if (!root.active) return;
  const hand = scene.add.image(x, y, HAND.key).setOrigin(HAND.tipX, HAND.tipY);
  hand.setScale(HAND.width / hand.width);
  const s = hand.scale;
  const ring = scene.add.circle(x, y, 18).setStrokeStyle(5, 0xffd23f).setFillStyle(0xffffff, 0.25).setAlpha(0);
  root.add([ring, hand]);
  const tap = () => {
    if (!hand.active) return;
    hand.setPosition(x + 26, y + 26).setScale(s);
    scene.tweens.add({
      targets: hand, x, y, duration: 320, ease: 'Sine.easeOut',
      onComplete: () => {
        if (!hand.active) return;
        scene.tweens.add({ targets: hand, scale: s * 0.86, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
        ring.setScale(0.4).setAlpha(1);
        scene.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 520, ease: 'Quad.easeOut' });
        scene.time.delayedCall(800, tap);
      },
    });
  };
  tap();
}
`],
['frontend/src/ui/guideFocus.ts',`    align: 'center', wordWrap: { width: width - 40 },
  }).setOrigin(0.5));
  return root;`,`    align: 'center', wordWrap: { width: width - 40 },
  }).setOrigin(0.5));
  // la punta del dedo, sobre la esquina de abajo a la derecha del control (un poco adentro)
  const hx = Math.min(width - 110, right - Math.min(40, (right - left) * 0.2));
  const hy = bottom - Math.min(26, (bottom - top) * 0.25);
  if (scene.textures.exists(HAND.key)) tapHand(scene, root, hx, hy);
  else {
    scene.load.image(HAND.key, HAND.file);
    scene.load.once('complete', () => tapHand(scene, root, hx, hy));
    scene.load.start();
  }
  return root;`],
['frontend/src/scenes/MenuScene.ts',`title: '¡BIENVENIDO!', pages: ['Tu primer partido empieza aquí.'] }, () => {`,`title: '¡BIENVENIDO A LA COMPETICIÓN!', pages: ['¡Arrasa a tus rivales y sube hasta lo más alto!\\n\\nEmpiezas en el NIVEL 1. Toca JUGAR para tu primer partido.'] }, () => {`],
['frontend/src/scenes/MenuScene.ts',`        commit((s) => markTutorialSeen(s, 'l01-bienvenida'));
      }, 2000);`,`        commit((s) => markTutorialSeen(s, 'l01-bienvenida'));
      }, 5000);`],
];
for(const [f,o,n] of ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error('nf '+o.slice(0,40));s=s.slice(0,i)+n+s.slice(i+o.length);fs.writeFileSync(f,s);}
console.log('ok');
