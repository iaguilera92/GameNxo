import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/ui/GlobalRanking.ts',[
["  const titleImg = scene.add.image(W / 2 - titleW / 2 - TB[0] * ts, titleTop - TB[1] * ts, RK_ART.title.key).setOrigin(0, 0).setScale(ts);",
 "  // (25-11-2026) TB y ts en px del original (1774): la escala se corrige si el archivo está achicado\n  const tk = 1774 / (scene.textures.get(RK_ART.title.key).getSourceImage() as { width: number }).width;\n  const titleImg = scene.add.image(W / 2 - titleW / 2 - TB[0] * ts, titleTop - TB[1] * ts, RK_ART.title.key).setOrigin(0, 0).setScale(ts * tk);"],
]);
apply('frontend/tools/make-button-sprites.mjs',[
["// Entrada : public/assets/btn-dash.webp,", "// Entrada : art/botones/btn-dash.webp (25-11-2026: los originales salieron de public/; PERSONALIZAR usa public/assets/btn-dash y btn-smash a 320 px),"],
["  const { w, h, px } = decode(webpToPng(join(ROOT, 'public', 'assets', `${name}.webp`), join(tmp, `${name}.png`)));", "  const { w, h, px } = decode(webpToPng(join(ROOT, 'art', 'botones', `${name}.webp`), join(tmp, `${name}.png`)));"],
]);
// mover originales de botones
fs.mkdirSync('frontend/art/botones', { recursive: true });
for (const n of ['btn-dash', 'btn-smash', 'btn-saque', 'btn-saque-efecto', 'btn-ulti', 'btn-emotes', 'btn-rendirse']) {
  const from = `frontend/public/assets/${n}.webp`, to = `frontend/art/botones/${n}.webp`;
  if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to);
}
console.log('ok');
