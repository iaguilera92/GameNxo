import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,50));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/ui/guideFocus.ts',[
[`/** La mano, abajo a la derecha del control, apuntando a él, con un toque que se repite (baja, aprieta y suelta un anillo). */`,
`/** La mano tocando en (x, y), en su propio contenedor (p. ej. el primer partido: "toca el lado derecho"). Destruir el contenedor la quita. */
export function tapHint(scene: Phaser.Scene, x: number, y: number, depth: number) {
  const root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  if (scene.textures.exists(HAND.key)) tapHand(scene, root, x, y);
  else {
    scene.load.image(HAND.key, HAND.file);
    scene.load.once('complete', () => tapHand(scene, root, x, y));
    scene.load.start();
  }
  return root;
}

/** La mano, abajo a la derecha del control, apuntando a él, con un toque que se repite (baja, aprieta y suelta un anillo). */`]]);
apply('frontend/src/ui/Joystick.ts',[
[`  private dim = 1;
  setDim(k: number) {`,`  private dim = 1;
  /** (25-11-2026) primer partido del tutorial: el joystick, por encima del oscurecido de la guía y más visible */
  setSpotlight(on: boolean) {
    this.base.setDepth(on ? 5010 : 5000);
    this.knob.setDepth(on ? 5011 : 5001);
    this.setDim(on ? 2 : 1);
  }
  setDim(k: number) {`]]);
apply('frontend/src/scenes/MatchScene.ts',[
[`  private guideZone?: Phaser.GameObjects.Graphics;`,`  private guideZone?: Phaser.GameObjects.Graphics;
  /** (25-11-2026, usuario) nivel 1: todo se oscurece menos tu personaje, el cuadro al que vas, la pelota y el joystick */
  private guideDim?: Phaser.GameObjects.Rectangle;
  private guideDimMask?: Phaser.GameObjects.Graphics;
  private guideZonePts: { x: number; y: number }[] = [];
  private guideHand?: Phaser.GameObjects.Container;`],
[`    this.guideZone = undefined;`,`    this.guideZone = undefined;
    this.guideDim = undefined;
    this.guideDimMask = undefined;
    this.guideZonePts = [];
    this.guideHand = undefined;`],
[`    this.dashBtn.setHint(this.practicingReturns() && this.guidePracticeStep === 1 && !this.serveLock && this.phase === 'rally');
    if (text === this.guideNotice) return;`,`    this.dashBtn.setHint(this.practicingReturns() && this.guidePracticeStep === 1 && !this.serveLock && this.phase === 'rally');
    this.tickGuideDim(text);
    if (text === this.guideNotice) return;`],
[`    this.guideText.setText(text).setVisible(!!text);
    this.guideZone?.clear();`,`    this.guideText.setText(text).setVisible(!!text);
    // nivel 1: el aviso, grande y a media pantalla (sobre el oscurecido); los demás, arriba como siempre
    if (this.guide === 'first') this.guideText.setPosition(this.scale.width / 2, this.scale.height * 0.46).setFontSize(36);
    else this.guideText.setPosition(this.scale.width / 2, 320).setFontSize(27);
    this.guideZone?.clear();
    this.guideZonePts = [];
    // nivel 1, saque tocando: la mano toca el lado derecho de la pantalla
    this.guideHand?.destroy();
    this.guideHand = undefined;
    if (this.guide === 'first' && text && this.guideServeLesson() === 'tap' && this.meServes) this.guideHand = tapHint(this, this.scale.width * 0.72, this.scale.height * 0.62, 6060);`],
[`      this.guideZone.fillStyle(0xffd23f, 0.25).lineStyle(4, 0xffd23f, 0.9).fillPoints([a,b,c,d].map(({ sx, sy }) => ({ x: sx, y: sy })), true).strokePoints([a,b,c,d].map(({ sx, sy }) => ({ x: sx, y: sy })), true);
    }
  }`,`      this.guideZone.fillStyle(0xffd23f, 0.25).lineStyle(4, 0xffd23f, 0.9).fillPoints([a,b,c,d].map(({ sx, sy }) => ({ x: sx, y: sy })), true).strokePoints([a,b,c,d].map(({ sx, sy }) => ({ x: sx, y: sy })), true);
      this.guideZonePts = [a, b, c, d].map(({ sx, sy }) => ({ x: sx, y: sy }));
    }
  }

  /**
   * (25-11-2026, usuario) NIVEL 1 (guía 'first'), con un aviso en pantalla: todo se oscurece menos tu personaje, el cuadro al que tienes que ir,
   * la pelota y el joystick (y el botón de saque en la lección del saque directo). Solo el usuario: el rival bot queda oscurecido.
   */
  private tickGuideDim(text: string) {
    const on = this.guide === 'first' && !!text;
    if (!on) {
      if (this.guideDim?.visible) {
        this.guideDim.setVisible(false);
        this.joy.setSpotlight(false);
        this.serveNormalBtn.setDepth(5000);
      }
      return;
    }
    if (!this.guideDim) {
      this.guideDimMask = this.make.graphics({}, false);
      const mask = this.guideDimMask.createGeometryMask();
      mask.setInvertAlpha(true);
      this.guideDim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x02060f, 0.6).setOrigin(0).setScrollFactor(0).setDepth(5005).setMask(mask);
    }
    if (!this.guideDim.visible) this.guideDim.setVisible(true);
    this.joy.setSpotlight(true);
    this.serveNormalBtn.setDepth(this.guideServeLesson() === 'direct' && this.meServes ? 5010 : 5000);
    // agujeros (en coordenadas del mundo: la máscara se dibuja con la cámara)
    const g = this.guideDimMask!.clear().fillStyle(0xffffff, 1);
    const b = this.player.ch.getBounds();
    g.fillRoundedRect(b.x - 22, b.y - 22, b.width + 44, b.height + 44, 30);
    if (this.guideZonePts.length) g.fillPoints(this.guideZonePts, true);
    const s = this.ball.s;
    const bp = project(s.x, s.y, s.z);
    g.fillCircle(bp.sx, bp.sy, 34);
  }`],
]);
let s=fs.readFileSync('frontend/src/scenes/MatchScene.ts','utf8');
if(!s.includes("import { tapHint }")) s=s.replace("import { botNamesFor, hostServesGame } from '../net/doubles';","import { botNamesFor, hostServesGame } from '../net/doubles';\nimport { tapHint } from '../ui/guideFocus';");
fs.writeFileSync('frontend/src/scenes/MatchScene.ts',s);
console.log('ok');
