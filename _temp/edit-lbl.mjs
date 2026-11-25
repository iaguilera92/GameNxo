import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/ui/AbilityButton.ts',[
[`    this.labelText = scene.add.text(0, R + 22, label, textStyle(20)).setOrigin(0.5);`,`    // (25-11-2026, usuario) etiqueta un poco más abajo (antes R + 22: quedaba pegada al borde del botón), centrada bajo él
    this.labelText = scene.add.text(0, R + 32, label, textStyle(20)).setOrigin(0.5, 0.5);`],
[`    this.subText = scene.add.text(0, R + 43, '',`,`    this.subText = scene.add.text(0, R + 53, '',`],
]);
console.log('ok');
