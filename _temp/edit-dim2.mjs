import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/fx/actorPose.ts',[
[`export interface PoseActor {
  x: number;`,`export interface PoseActor {
  /** (25-11-2026) se suma a la profundidad (p. ej. tu personaje por encima del oscurecido de la guía del nivel 1) */
  depthBoost?: number;
  x: number;`],
[`  if (ch.depth !== p.sy) ch.setDepth(p.sy);`,`  const depth = p.sy + (a.depthBoost ?? 0);
  if (ch.depth !== depth) ch.setDepth(depth);`],
]);
const st=(fs.readdirSync('frontend/src',{recursive:true}).find(f=>f.endsWith('ServeTurnTag.ts')));
apply('frontend/src/'+st,[
[`  update(dt: number, who: 'player' | 'bot' | null, x: number, y: number) {`,`  /** (25-11-2026) nivel 1: por encima del oscurecido de la guía */
  setFront(on: boolean) {
    this.c.setDepth(on ? 5620 : 4600);
  }
  update(dt: number, who: 'player' | 'bot' | null, x: number, y: number) {`],
]);
apply('frontend/src/ui/Joystick.ts',[
[`    this.base.setDepth(on ? 5010 : 5000);
    this.knob.setDepth(on ? 5011 : 5001);`,`    this.base.setDepth(on ? 5610 : 5000);
    this.knob.setDepth(on ? 5611 : 5001);`],
]);
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
[`interface Actor {
  ch: Character;`,`interface Actor {
  ch: Character;
  /** (25-11-2026) profundidad extra (placeActor): tu personaje sobre el oscurecido de la guía del nivel 1 */
  depthBoost?: number;`],
[`      if (this.guideDim?.visible) {
        this.guideDim.setVisible(false);
        this.joy.setSpotlight(false);
        this.serveNormalBtn.setDepth(5000);
      }
      return;`,`      if (this.guideDim?.visible) {
        this.guideDim.setVisible(false);
        this.joy.setSpotlight(false);
        this.serveNormalBtn.setDepth(5000);
        this.serveTag.setFront(false);
        this.player.depthBoost = 0;
      }
      return;`],
[`      this.guideDim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x02060f, 0.6).setOrigin(0).setScrollFactor(0).setDepth(5005).setMask(mask);`,`      // por encima del marcador (5500); encima del oscurecido: joystick, botón de saque, aviso de quién saca y tu personaje
      this.guideDim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x02060f, 0.6).setOrigin(0).setScrollFactor(0).setDepth(5600).setMask(mask);`],
[`    this.serveNormalBtn.setDepth(this.guideServeLesson() === 'direct' && this.meServes ? 5010 : 5000);
    // agujeros (en coordenadas del mundo: la máscara se dibuja con la cámara)
    const g = this.guideDimMask!.clear().fillStyle(0xffffff, 1);
    const b = this.player.ch.getBounds();
    g.fillRoundedRect(b.x - 22, b.y - 22, b.width + 44, b.height + 44, 30);
    if (this.guideZonePts.length) g.fillPoints(this.guideZonePts, true);
    const s = this.ball.s;
    const bp = project(s.x, s.y, s.z);
    g.fillCircle(bp.sx, bp.sy, 34);`,`    this.serveNormalBtn.setDepth(this.guideServeLesson() === 'direct' && this.meServes ? 5610 : 5000);
    this.serveTag.setFront(true);
    // tu personaje (solo sus sprites, sin recuadro) por encima del oscurecido
    this.player.depthBoost = 6000;
    // agujero: solo el cuadro al que tienes que ir (en coordenadas del mundo: la máscara se dibuja con la cámara)
    const g = this.guideDimMask!.clear().fillStyle(0xffffff, 1);
    if (this.guideZonePts.length) g.fillPoints(this.guideZonePts, true);`],
[`    if (i === 0) return { x0: COURT.left, x1: sv, ...half(side ?? -1) };`,`    if (i === 0) return { x0: COURT.left, x1: NET_X, ...half(side ?? -1) }; // el rectángulo largo: de la línea de fondo a la red`],
[`    const xOk = r.x0 === COURT.left ? p.x <= r.x1 - 12 : p.x >= r.x0 + 15;`,`    const xOk = r.x0 === COURT.left ? p.x <= r.x1 - 45 : p.x >= r.x0 + 15;`],
]);
console.log('ok');
