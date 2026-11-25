import fs from 'fs';
const ed=[
['frontend/src/ui/guideFocus.ts',`  root.add(scene.add.text(width / 2, textY, message, {
    fontFamily: FONT, fontSize: '26px', color: '#fff3bb', stroke: '#071332', strokeThickness: 6,
    align: 'center', wordWrap: { width: width - 40 },
  }).setOrigin(0.5));`,`  // el texto, centrado sobre el control que hay que tocar (sin salirse de la pantalla)
  const label = scene.add.text(target.x, textY, message, {
    fontFamily: FONT, fontSize: '32px', color: '#fff3bb', stroke: '#071332', strokeThickness: 7,
    align: 'center', wordWrap: { width: width - 40 },
  }).setOrigin(0.5);
  label.x = Math.max(20 + label.width / 2, Math.min(width - 20 - label.width / 2, target.x));
  root.add(label);`],
['frontend/src/scenes/MenuScene.ts',`play: 'TOCA JUGAR',`,`play: 'TOCA PARA JUGAR',`],
];
for(const [f,o,n] of ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error('nf '+o.slice(0,40));s=s.slice(0,i)+n+s.slice(i+o.length);fs.writeFileSync(f,s);}
console.log('ok');
