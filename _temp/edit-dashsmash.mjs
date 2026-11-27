import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const M='frontend/src/scenes/MatchScene.ts';
apply(M,[
// 1) snap: tambien en 2v2 con el DEFENSIVO o contra tu ESPECIAL, y mas pegado al cuerpo si es el ESPECIAL (te pega en el cuerpo)
["  private snapToBall(a: Actor) {\n    const s = this.ball.s;\n    if (this.doubles || this.reachDist(a, s) <= HIT_RANGE * 0.4) return;\n    const mine = a === this.player;\n    const ty = clamp(s.y + (s.y > a.y ? -18 : 18), Y_MIN, Y_MAX);",
 "  private snapToBall(a: Actor, force = false) {\n    const s = this.ball.s;\n    if ((this.doubles && !force) || this.reachDist(a, s) <= HIT_RANGE * 0.4) return;\n    const mine = a === this.player;\n    // (28-11-2026, usuario) el ESPECIAL recibido le da en el CUERPO: más pegado a la pelota (antes 18 de lado)\n    const side = this.ball.power ? 8 : 18;\n    const ty = clamp(s.y + (s.y > a.y ? -side : side), Y_MIN, Y_MAX);"],
["        if ((this.tutorial || this.brain.dashBall) && !this.doubles) this.snapToBall(this.bot);",
 "        // (28-11-2026, usuario) con tu ESPECIAL y su DEFENSIVO se veía lejos de la pelota: también en el 2v2 y siempre contra el ESPECIAL\n        if (this.tutorial || this.brain.dashBall || this.ball.power) this.snapToBall(this.bot, this.brain.dashBall || this.ball.power);"],
["        this.bot.x = clamp(s.x + 14, B_X[0], B_X[1]);\n        this.bot.y = clamp(s.y + (s.y > this.bot.y ? -28 : 28), Y_MIN, Y_MAX);",
 "        this.bot.x = clamp(s.x + 14, B_X[0], B_X[1]);\n        const side = this.ball.power ? 8 : 16; // (28-11-2026, usuario) antes 28: quedaba lejos de la pelota\n        this.bot.y = clamp(s.y + (s.y > this.bot.y ? -side : side), Y_MIN, Y_MAX);"],
// 2) Duelo en la red: las recargas siguen corriendo
["    if (this.duel) {\n      this.tickDuel(deltaMs);\n      return;\n    }\n    const dt = Math.min(deltaMs / 1000, 0.05) * this.slowMo;",
 "    if (this.duel) {\n      // (28-11-2026, usuario) durante el DUELO EN LA RED las recargas del DEFENSIVO y del ESPECIAL siguen corriendo (las tuyas y las del bot)\n      const ddt = Math.min(deltaMs / 1000, 0.05);\n      this.dashBtn.update(ddt);\n      this.smashBtn.update(ddt);\n      for (const b of this.doubles ? [...this.rivalBrains, this.allyBrain] : [this.brain]) b?.tickCooldowns(ddt);\n      this.tickDuel(deltaMs);\n      return;\n    }\n    const dt = Math.min(deltaMs / 1000, 0.05) * this.slowMo;"],
]);
console.log('ok');
