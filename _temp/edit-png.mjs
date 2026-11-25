import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n,all] of ed){const c=s.split(o).length-1;if(c<1||(c>1&&!all))throw new Error(f+' nf '+o.slice(0,60)+' '+c);s=s.split(o).join(n);}fs.writeFileSync(f,s);}
apply('frontend/tools/build-charge-fx.mjs',[
["src: 'public/assets/charge-", "src: 'art/cargando/charge-", true],
["  fuego: { id: 'fire', mode: 'bands',", "  // (25-11-2026) las fuentes charge-*.png viven en art/cargando/ (fuera de public/: no llegan al APK)\n  fuego: { id: 'fire', mode: 'bands',"],
]);
apply('frontend/src/ui/Emotes.ts',[
["    else load.image(key, `assets/emotes/${key}.png`);", "    else load.image(key, `assets/emotes/${key}.webp`); // (25-11-2026) miniaturas en WebP", true],
]);
apply('frontend/tools/build-emote-thumbs.mjs',[
["// Salida:  public/assets/emotes/emote-<pj>-<nombre>.png:", "// Salida:  public/assets/emotes/emote-<pj>-<nombre>.webp (25-11-2026: WebP con tools/convert-image.mjs; antes .png):"],
["import { existsSync, mkdirSync, readdirSync } from 'node:fs';", "import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';\nimport { spawnSync } from 'node:child_process';\nimport { tmpdir } from 'node:os';"],
["mkdirSync(OUT_DIR, { recursive: true });", "mkdirSync(OUT_DIR, { recursive: true });\nconst TMP = mkdtempSync(join(tmpdir(), 'emote-thumbs-'));"],
["  const name = outName(f);\n  save(join(OUT_DIR, name), SIZE, SIZE, out);\n  console.log(`${f} (${w}x${h}) -> assets/emotes/${name} ${SIZE}x${SIZE}`);\n}",
 "  const name = outName(f).replace(/\\.png$/, '.webp');\n  const tmpPng = join(TMP, name.replace(/\\.webp$/, '.png'));\n  save(tmpPng, SIZE, SIZE, out);\n  const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'convert-image.mjs'), tmpPng, join(OUT_DIR, name), '0.9'], { stdio: 'inherit' });\n  if (r.status !== 0) throw new Error(`${f}: no se pudo convertir a WebP`);\n  console.log(`${f} (${w}x${h}) -> assets/emotes/${name} ${SIZE}x${SIZE}`);\n}\nrmSync(TMP, { recursive: true, force: true });"],
]);
console.log('ok');
