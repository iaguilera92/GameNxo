import fs from 'fs';
const f='frontend/src/scenes/MenuScene.ts';let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const o="    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');\n";
if(s.split(o).length!==2)throw 'nf';
s=s.replace(o,o+"    if (!this.textures.exists('guide-click')) this.load.image('guide-click', 'assets/ui/guide-click.webp'); // mano del tutorial (guideFocus)\n");
fs.writeFileSync(f,s);console.log('ok');
