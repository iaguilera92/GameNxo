import {decode} from '../tools/png-lite.mjs';
for (const f of ['lanz','dosfilas','otra']) { const d=decode('_tmp/'+f+'.png'); console.log(f,d.w,d.h) }
