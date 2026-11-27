import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
["    if (!st.sound) {\n      st.sound = true;\n      infernoSound.dash(this);\n      this.ghosts.begin(D.toMs - D.fromMs - 120);\n    }\n    const u = Math.min(1, (e - D.fromMs) / (D.toMs - D.fromMs - 120));\n    a.x = from.x + (to.x - from.x) * u;\n    a.y = from.y + (to.y - from.y) * u;\n    this.renderActors();\n    // 4 sombras en posiciones anteriores reales (solo mientras se desplaza; luego se quedan y se desvanecen)\n    if (u < 1) this.ghosts.record(sprites[0], a.ch.depth);\n    else this.ghosts.end();",
 "    // (26-11-2026, usuario) ULTI DEFAULT: el mismo avance rápido hasta la pelota, pero SIN sombras de colores (la Default no lleva tanto estilo)\n    const plain = el === 'default';\n    if (!st.sound) {\n      st.sound = true;\n      infernoSound.dash(this);\n      if (!plain) this.ghosts.begin(D.toMs - D.fromMs - 120);\n    }\n    const u = Math.min(1, (e - D.fromMs) / (D.toMs - D.fromMs - 120));\n    a.x = from.x + (to.x - from.x) * u;\n    a.y = from.y + (to.y - from.y) * u;\n    this.renderActors();\n    if (plain) return;\n    // 4 sombras en posiciones anteriores reales (solo mientras se desplaza; luego se quedan y se desvanecen)\n    if (u < 1) this.ghosts.record(sprites[0], a.ch.depth);\n    else this.ghosts.end();"],
]);
apply('frontend/src/fx/powerDemo.ts',[
["        if (ghosts < D.ghosts && u >= ghosts / D.ghosts) {", "        // (26-11-2026, usuario) la ULTI DEFAULT avanza sin sombras, como en el partido\n        if (el !== 'default' && ghosts < D.ghosts && u >= ghosts / D.ghosts) {"],
]);
apply('frontend/src/fx/InfernoFx.ts',[
["    const D = this.def;\n    const pulse = 1 + 0.06 * Math.sin(this.t * 22);", "    const D = this.def;\n    // (26-11-2026, usuario) un poco más grande (+15 %): tiene que verse más que la bola del ESPECIAL\n    R *= 1.15;\n    const pulse = 1 + 0.06 * Math.sin(this.t * 22);"],
]);
console.log('ok');
