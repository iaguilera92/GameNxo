import { register } from 'node:module';
register('data:text/javascript,'+encodeURIComponent("export async function resolve(s,c,n){if((s.startsWith('./')||s.startsWith('../'))&&!/\\.[cm]?[jt]s$/.test(s)){try{return await n(s+'.ts',c)}catch{}}return n(s,c)}"), import.meta.url);
const R = await import('/C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/domain/shopRotation.ts');
const H=3600e3;
// sabado 21-11-2026 12:00 Chile (UTC-3 aprox) y domingo, lunes
for (const [d,h] of [[21,15],[22,15],[23,15],[28,15]]) { const t=Date.UTC(2026,10,d,h); const w=R.rotationWindow(t,168); console.log(d, new Date(t).toISOString(), w.id, (w.nextMs/H).toFixed(1)+'h', R.shopOffers('zone',t).map(i=>i.id).join(','), R.offersChangeIn('zone',t)!==null); }
