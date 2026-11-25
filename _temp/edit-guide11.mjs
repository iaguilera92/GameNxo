import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`    this.botKit = this.net ? botKitFor(this.rivalSkin()) : randomBotKit(this.rivalSkin());`,`    // (25-11-2026, usuario) en el TUTORIAL (bajo el nivel 20) el bot lleva lo DEFAULT: DASH, ESPECIAL y ULTI default, carga y colores de siempre
    this.botKit = this.net || this.tutorial ? botKitFor(this.rivalSkin()) : randomBotKit(this.rivalSkin());`],
[`      this.rivalKits = [k1, { ...k2, charge: k1.charge, color: k1.color }];
      this.allyKit = ka;
      this.botKit = k1;`,`      this.rivalKits = [k1, { ...k2, charge: k1.charge, color: k1.color }];
      this.allyKit = ka;
      this.botKit = k1;
      if (this.tutorial) {
        // tutorial: los tres bots del 2v2 con lo DEFAULT
        this.rivalKits = [botKitFor(this.rivalSkin()), botKitFor(pf.skin)];
        this.allyKit = botKitFor(this.rivalSkin());
        this.botKit = this.rivalKits[0];
      }`],
[`        zone = this.guideRallyZone(r.k);
        text = r.k === 1 ? 'AHORA VE A LA IZQUIERDA' : r.k === 2 ? 'SUBE AL CUADRO DE ARRIBA A LA IZQUIERDA' : r.k === 3 ? 'AHORA ARRIBA A LA DERECHA' : 'BAJA AL RECTÁNGULO DE ABAJO';
        const s = this.ball.s;`,`        zone = this.guideRallyZone(r.k);
        text = r.k === 1 ? 'AHORA VE A LA IZQUIERDA' : r.k === 2 ? 'SUBE AL CUADRO DE ARRIBA A LA IZQUIERDA' : r.k === 3 ? 'AHORA ARRIBA A LA DERECHA' : 'BAJA AL RECTÁNGULO DE ABAJO';
        const s = this.ball.s;
        // (25-11-2026, usuario) la que te tira el bot se QUEDA QUIETA en el cuadro (en lo alto de su bote) hasta que le pegues, como el saque
        if (r.st === 'feed' && this.bounces > 0 && s.x < NET_X && s.vz <= 0) {
          r.st = 'held';
          r.hold = { x: s.x, y: s.y, z: Math.max(25, s.z) };
        }
        if (r.st === 'held' && r.hold) {
          s.x = r.hold.x;
          s.y = r.hold.y;
          s.z = r.hold.z;
          s.vx = s.vy = s.vz = 0;
          text = 'MUEVE EL JOYSTICK HACIA LA PELOTA';
        }`],
]);
console.log('ok');
