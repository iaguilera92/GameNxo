import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MenuScene.ts',[
["    this.add.image(NAV.side, bottom, NAV.key).setOrigin(x0 / NAV.w, y1 / NAV.h).setScale(s).setDepth(100);",
 "    // (25-11-2026) la imagen puede estar achicada: las medidas siguen en px del original (NAV.w), la escala se corrige por el ancho real\n    const navK = NAV.w / (this.textures.get(NAV.key).getSourceImage() as { width: number }).width;\n    this.add.image(NAV.side, bottom, NAV.key).setOrigin(x0 / NAV.w, y1 / NAV.h).setScale(s * navK).setDepth(100);"],
["      c.add(this.add.image(-A.bx * sx, -A.by * sy, 'menu-pass-card').setOrigin(0).setScale(sx, sy));",
 "      // (25-11-2026) medidas en px del original (2000): la escala se corrige si el archivo está achicado\n      const pk = 2000 / (this.textures.get('menu-pass-card').getSourceImage() as { width: number }).width;\n      c.add(this.add.image(-A.bx * sx, -A.by * sy, 'menu-pass-card').setOrigin(0).setScale(sx * pk, sy * pk));"],
["        c.add(this.add.image(-A.bx * sx, -A.by * sy, artKey).setOrigin(0).setScale(sx, sy));",
 "        // (25-11-2026) medidas en px del original (1774): la escala se corrige si el archivo está achicado\n        const lk = 1774 / (this.textures.get(artKey).getSourceImage() as { width: number }).width;\n        c.add(this.add.image(-A.bx * sx, -A.by * sy, artKey).setOrigin(0).setScale(sx * lk, sy * lk));"],
]);
apply('frontend/src/ui/searchTimer.ts',[
["  const img = scene.add.image(x - (cx - ART.imgW / 2) * s, y - (cy - ART.imgH / 2) * s, KEY).setScale(s);",
 "  // (25-11-2026) medidas en px del original (ART.imgW): la escala se corrige si el archivo está achicado\n  const k = ART.imgW / (scene.textures.get(KEY).getSourceImage() as { width: number }).width;\n  const img = scene.add.image(x - (cx - ART.imgW / 2) * s, y - (cy - ART.imgH / 2) * s, KEY).setScale(s * k);"],
]);
console.log('ok');
