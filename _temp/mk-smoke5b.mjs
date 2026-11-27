import fs from 'fs';
let s = fs.readFileSync('_temp/smoke5.mjs', 'utf8');
const waitG = "for (let k = 0; k < 60; k++) { if (await ev('!!(window.__game && window.__game.scene.getScene(\"Menu\")?.sys.isActive())')) break; await sleep(1000); }\n";
s = s.replace("await ev(\"localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1\");\nawait sleep(15000);", "await ev(\"localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1\");\nawait sleep(3000);\n" + waitG);
s = s.replace("await sleep(6000);\nawait ev(\"localStorage", waitG + "await ev(\"localStorage");
s = s.replace("sc.scene.restart(); })", "sc.scene.restart(); setTimeout(() => res(-1), 30000); })");
fs.writeFileSync('_temp/smoke5.mjs', s);
