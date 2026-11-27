import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const R='frontend/src/scenes/RankedScene.ts';
apply(R,[
["    else this.children.list.forEach((o) => (o as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(true));\n  }",
 "    else for (const o of this.hiddenUnder) if (o.active) (o as unknown as { setVisible: (v: boolean) => void }).setVisible(true);\n    this.hiddenUnder = [];\n  }\n  /** (26-11-2026) objetos de la pantalla ocultados bajo un aviso opaco (el cofre), para volver a mostrarlos si no se reconstruye */\n  private hiddenUnder: Phaser.GameObjects.GameObject[] = [];"],
["    for (const o of this.children.list) if (!objs.includes(o)) (o as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(false);",
 "    this.hiddenUnder = this.children.list.filter((o) => !objs.includes(o) && (o as unknown as { visible?: boolean }).visible === true);\n    for (const o of this.hiddenUnder) (o as unknown as { setVisible: (v: boolean) => void }).setVisible(false);"],
]);
console.log('ok');
