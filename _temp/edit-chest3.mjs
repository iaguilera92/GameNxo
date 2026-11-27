import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/RankedScene.ts',[
["      const any = t as unknown as { targets?: unknown[]; currentTween?: { targets?: unknown[] }; data?: { targets?: unknown[] }[] };\n      const tg = any.targets ?? any.currentTween?.targets ?? any.data?.[0]?.targets ?? [];\n      if (tg.length && tg.every(dead)) t.remove();",
 "      // las cadenas (tweens.chain) no tienen `targets` propios: los de sus pasos\n      const any = t as unknown as { targets?: unknown[]; data?: { targets?: unknown[] }[] };\n      const tg = any.targets?.length ? any.targets : (any.data ?? []).flatMap((d) => d.targets ?? []);\n      // por el gestor: TweenChain.remove(paso) es otra cosa (quita un paso de la cadena)\n      if (tg.length && tg.every(dead)) this.tweens.remove(t);"],
]);
console.log('ok');
