import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('backend/src/config/env.ts',[
["  corsOrigins: origins(process.env.CORS_ORIGIN),", "  corsOrigins: origins(process.env.CORS_ORIGIN),\n  /**\n   * (28-11-2026) además de la lista, acepta el juego en DESARROLLO desde el propio PC (http://localhost:<puerto> y http://127.0.0.1:<puerto>,\n   * p. ej. Vite en 5173). Solo lo abre quien tiene el juego corriendo en su máquina. CORS_ALLOW_DEV=0 lo apaga.\n   */\n  corsAllowDev: process.env.CORS_ALLOW_DEV !== '0',"],
]);
apply('backend/src/server.ts',[
["app.use((req, res, next) => {\n  const origin = req.headers.origin;\n  if (CONFIG.corsOrigins === '*') res.setHeader('Access-Control-Allow-Origin', '*');\n  else if (origin && CONFIG.corsOrigins.includes(origin)) {",
 "/** (28-11-2026) el juego en desarrollo en el propio PC (Vite: http://localhost:5173): ver CONFIG.corsAllowDev */\nconst DEV_ORIGIN = /^http:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d{1,5})?$/;\nconst originAllowed = (origin: string | undefined) => !!origin && (CONFIG.corsOrigins === '*' || CONFIG.corsOrigins.includes(origin) || (CONFIG.corsAllowDev && DEV_ORIGIN.test(origin)));\napp.use((req, res, next) => {\n  const origin = req.headers.origin;\n  if (CONFIG.corsOrigins === '*') res.setHeader('Access-Control-Allow-Origin', '*');\n  else if (origin && originAllowed(origin)) {"],
["  cors: { origin: CONFIG.corsOrigins === '*' ? true : CONFIG.corsOrigins, methods: ['GET', 'POST'] },",
 "  cors: { origin: CONFIG.corsOrigins === '*' ? true : (origin, cb) => cb(null, !origin || originAllowed(origin)), methods: ['GET', 'POST'] },"],
]);
console.log('ok');
