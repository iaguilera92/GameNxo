import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchScene.ts',[
[`    queueEmoteArt(this.load); // miniaturas de 160 px (antes las fuentes de ~1,1 MB cada una)`,`    queueEmoteArt(this.load); // miniaturas de 160 px (antes las fuentes de ~1,1 MB cada una)
    // (25-11-2026, usuario) nivel 1: "¡GENIAL!" al tocar cada cuadro (original en _temp/respaldo_oficial/ui/genial.png)
    if (this.guide === 'first' && !this.textures.exists('guide-genial')) this.load.image('guide-genial', 'assets/ui/genial.webp');`],
[`    const g = this.add.container(c.sx, c.sy - 40).setDepth(6066);
    const ic = this.add.graphics();`,`    const g = this.add.container(c.sx, c.sy - 40).setDepth(6066);
    if (this.textures.exists('guide-genial')) {
      // (25-11-2026, usuario) la imagen ¡GENIAL! (check y texto) en vez del dibujo
      const im = this.add.image(0, -30, 'guide-genial');
      im.setScale(190 / im.width);
      g.add(im);
      g.setScale(0.3);
      this.tweens.add({ targets: g, scale: 1, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: g, alpha: 0, y: g.y - 30, delay: 900, duration: 350, onComplete: () => g.destroy() });
      return;
    }
    const ic = this.add.graphics();`],
]);
console.log('ok');
