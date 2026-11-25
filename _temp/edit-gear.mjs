import fs from 'fs';
const f='frontend/src/scenes/MenuScene.ts';
const ed=[
[`    this.guideOverlay = guideFocus(this, target, labels[step]);
  }`,`    this.guideOverlay = guideFocus(this, target, labels[step]);
    // (25-11-2026, usuario) AJUSTES sigue disponible durante la guía (ahí irá INICIAR SESIÓN): por encima del oscurecido, sin mano ni animación
    this.gearBtn?.setDepth(8101);
  }
  /** botón de AJUSTES (engranaje) de la barra de arriba */
  private gearBtn?: Phaser.GameObjects.Container;`],
[`    this.guideOverlay = undefined;
    if (isDevMode() || !this.guideRects) return;`,`    this.guideOverlay = undefined;
    this.gearBtn?.setDepth(0);
    if (isDevMode() || !this.guideRects) return;`],
[`    this.gearButton(gx, gy, gs, () => showSettings(this));`,`    this.gearBtn = this.gearButton(gx, gy, gs, () => showSettings(this));`],
[`angle: gear.angle + 45, duration: 300, ease: 'Back.easeOut' });
      onClick();
    });
  }`,`angle: gear.angle + 45, duration: 300, ease: 'Back.easeOut' });
      onClick();
    });
    return c;
  }`],
];
let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error('nf '+o.slice(0,40));s=s.slice(0,i)+n+s.slice(i+o.length);}
fs.writeFileSync(f,s);console.log('ok');

