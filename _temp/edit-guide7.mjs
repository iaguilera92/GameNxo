import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const M='frontend/src/scenes/MatchScene.ts';
apply('frontend/src/objects/Ball.ts',[
[`    const depth = ground.sy + 2;
    if (this.sprite.depth !== depth) this.sprite.setDepth(depth);`,`    const depth = ground.sy + 2 + this.depthBoost;
    if (this.sprite.depth !== depth) this.sprite.setDepth(depth);`],
]);
let b=fs.readFileSync('frontend/src/objects/Ball.ts','utf8');
// campo público: antes del primer "constructor("
const ci=b.indexOf('  constructor(');
if(ci<0) throw 'no ctor';
b=b.slice(0,ci)+"  /** (25-11-2026) se suma a la profundidad del dibujo (nivel 1: la pelota por encima del oscurecido de la guía) */\n  depthBoost = 0;\n"+b.slice(ci);
fs.writeFileSync('frontend/src/objects/Ball.ts',b);
apply(M,[
[`  private guideRally: { k: number; st: 'serve' | 'feed' | 'fly' | 'wait' | 'done'; reached?: boolean; hold?: { x: number; y: number; z: number } } = { k: 0, st: 'serve' };`,
`  private guideRally: { k: number; st: 'serve' | 'held' | 'feed' | 'fly' | 'wait' | 'done'; hold?: { x: number; y: number; z: number } } = { k: 0, st: 'serve' };
  /** cuadro de cada golpe del peloteo guiado (k 1..4): abajo a la izquierda, arriba a la izquierda, arriba a la derecha, todo el de abajo */
  private guideRallyZone(k: number) {
    return k <= 1 ? this.guideZoneRect(0, -1) : this.guideZoneRect(k - 1);
  }`],
[`      this.setActor(this.bot, COURT.right + 40, LAT_C + 70);
      this.setActor(this.player, COURT.left - 45, LAT_C - 110);`,`      this.setActor(this.bot, COURT.right + 40, LAT_C - 70);
      this.setActor(this.player, COURT.left - 45, LAT_C - 110);`],
[`    // (25-11-2026, usuario) nivel 1, primer punto: empiezas a la IZQUIERDA (vas primero a la derecha) y el bot saca desde su lado para que
    // el saque caiga en tu cuadro de la IZQUIERDA (computeServeBox usa su posición)`,`    // (25-11-2026, usuario) nivel 1, primer punto: empiezas a la IZQUIERDA (vas primero a la derecha); el bot, a la izquierda, saca en
    // diagonal a tu cuadro de la DERECHA (computeServeBox usa su posición)`],
[`        this.guideFeed(r.k === 0 ? this.guideZoneRect(0, -1) : this.guideZoneRect(r.k));`,`        this.guideFeed(this.guideRallyZone(Math.max(1, r.k)));`],
[`      if (this.guideMove === 3 && (r.st === 'serve' || r.st === 'feed') && s.vx < 0 && this.bounces > 0
        && this.inReach(this.player, s, HIT_RANGE * 1.7, HIT_MAX_Z * 1.3)) {
        this.playerHit();`,`      // el saque quieto tras su bote (held) o la que te tira el bot (feed): le pegas al llegar a ella
      if (this.guideMove === 3 && (r.st === 'held' || (r.st === 'feed' && s.vx < 0 && this.bounces > 0))
        && this.inReach(this.player, s, HIT_RANGE * 1.7, HIT_MAX_Z * 1.3)) {
        if (r.st === 'held') this.guideMission('guideJoystick'); // (25-11-2026, usuario) fuiste a la pelota con el joystick
        this.playerHit();`],
[`        if (r.k >= 3) aimShot(`,`        if (r.k >= 4) aimShot(`],
[`        if (r.k >= 3) {
          // golpe desde el rectángulo de abajo`,`        if (r.k >= 4) {
          // golpe desde el rectángulo de abajo`],
[`          this.guideRally = { k: 0, st: 'serve', reached: false };`,`          this.guideRally = { k: 0, st: 'serve' };`],
[`      } else if (r.k === 0 && r.st !== 'done') {
        // el saque del bot va a tu izquierda: ve a ese cuadro
        zone = this.guideZoneRect(0, -1);
        text = 'AHORA VE A LA IZQUIERDA';
        if (!r.reached && this.inGuideZone(zone)) {
          r.reached = true;
          this.guideCheck(zone);
          this.guideMission('guideJoystick');
        }
      } else if (r.k >= 1 && r.st !== 'done') {
        zone = this.guideZoneRect(r.k);
        text = r.k === 1 ? 'SUBE AL CUADRO DE ARRIBA A LA IZQUIERDA' : r.k === 2 ? 'AHORA ARRIBA A LA DERECHA' : 'BAJA AL RECTÁNGULO DE ABAJO';
        const s = this.ball.s;`,`      } else if (r.k === 0) {
        // (25-11-2026, usuario) el saque del bot: tras su bote la pelota se QUEDA QUIETA (en lo alto del bote) hasta que llegues a ella
        const s = this.ball.s;
        if (r.st === 'serve' && !this.serving && this.bounces > 0 && s.vz <= 0) {
          r.st = 'held';
          r.hold = { x: s.x, y: s.y, z: Math.max(25, s.z) };
        }
        if (r.st === 'held' && r.hold) {
          s.x = r.hold.x;
          s.y = r.hold.y;
          s.z = r.hold.z;
          s.vx = s.vy = s.vz = 0;
          text = 'MUEVE EL JOYSTICK HACIA LA PELOTA';
        }
      } else if (r.k >= 1 && r.st !== 'done') {
        zone = this.guideRallyZone(r.k);
        text = r.k === 1 ? 'AHORA VE A LA IZQUIERDA' : r.k === 2 ? 'SUBE AL CUADRO DE ARRIBA A LA IZQUIERDA' : r.k === 3 ? 'AHORA ARRIBA A LA DERECHA' : 'BAJA AL RECTÁNGULO DE ABAJO';
        const s = this.ball.s;`],
[`        this.player.depthBoost = 0;
        this.bot.depthBoost = 0;`,`        this.player.depthBoost = 0;
        this.bot.depthBoost = 0;
        this.ball.depthBoost = 0;`],
[`    this.player.depthBoost = 6000;`,`    this.player.depthBoost = 6000;
    this.ball.depthBoost = 6000; // la pelota también se ve (solo su dibujo)`],
]);
console.log('ok');
