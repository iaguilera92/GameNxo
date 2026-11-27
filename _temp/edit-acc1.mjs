import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/domain/player.ts',[
["  onboarded?: boolean;\n}", "  onboarded?: boolean;\n  /** (27-11-2026, usuario) cuenta vinculada (domain/account.ts); sin ella = INVITADO */\n  account?: AccountLink;\n}"],
]);
let p=fs.readFileSync('frontend/src/domain/player.ts','utf8');
const pi=p.indexOf('\n', p.indexOf('import '));
p=p.slice(0,pi+1)+"import type { AccountLink } from './account';\n"+p.slice(pi+1);
fs.writeFileSync('frontend/src/domain/player.ts',p);
apply('frontend/src/domain/migrate.ts',[
["  if (r.onboarded === true) s.onboarded = true; // (24-11-2026) pantalla de inicio ya hecha", "  if (r.onboarded === true) s.onboarded = true; // (24-11-2026) pantalla de inicio ya hecha\n  { const acc = parseAccount(r.account); if (acc) s.account = acc; } // (27-11-2026) cuenta vinculada (si no, invitado)"],
["import { isTutorialId } from './tutorial';", "import { isTutorialId } from './tutorial';\nimport { parseAccount } from './account';"],
]);
apply('frontend/src/domain/playerStore.ts',[
["export interface PlayerRepository {\n  load(): unknown; // datos crudos (se validan con migratePlayer)\n  save(s: PlayerState): void;\n}",
 "export interface PlayerRepository {\n  load(): unknown; // datos crudos (se validan con migratePlayer)\n  save(s: PlayerState): void;\n  /** (27-11-2026) borra lo guardado en este dispositivo (CERRAR SESIÓN: la cuenta queda en el servidor) */\n  clear?(): void;\n}"],
["  save(s: PlayerState) {\n    try {\n      localStorage.setItem(this.key, JSON.stringify(s));\n    } catch {\n      /* sin almacenamiento: se juega igual */\n    }\n  }\n}",
 "  save(s: PlayerState) {\n    try {\n      localStorage.setItem(this.key, JSON.stringify(s));\n    } catch {\n      /* sin almacenamiento: se juega igual */\n    }\n  }\n  clear() {\n    try {\n      localStorage.removeItem(this.key);\n      if (this.key === KEY_V2) localStorage.removeItem(KEY_V1);\n    } catch {\n      /* sin almacenamiento */\n    }\n  }\n}"],
["/** Cambia el almacenamiento (tests / backend futuro). */", "/**\n * (27-11-2026, usuario) CERRAR SESIÓN: borra el perfil de este dispositivo (con cuenta, su progreso está en el servidor) y vuelve a empezar;\n * quien llama reinicia la app, que abre INICIAR SESIÓN.\n */\nexport function signOutLocal() {\n  repo.clear?.();\n  state = null;\n}\n/** Cambia el almacenamiento (tests / backend futuro). */"],
]);
// LoginScene: usar authButtons
const L='frontend/src/scenes/LoginScene.ts';
let s=fs.readFileSync(L,'utf8').replace(/\r\n/g,'\n');
const a=s.indexOf("    const soon = (who: string) => this.toast(`${who}: muy pronto`);");
const b=s.indexOf("    // INVITADO: entra como siempre");
if(a<0||b<0) throw 'login nf';
s=s.slice(0,a)+"    by = authButtons(this, null, W / 2, by - bh / 2, bw, (p) => this.toast(`${PROVIDER_NAME[p]}: muy pronto`), bh, gap) + gap + 18 + bh / 2;\n"+s.slice(b);
const c=s.indexOf("  /** Botón de un proveedor: fondo de su color");
const d=s.indexOf("  private toast(msg: string) {");
s=s.slice(0,c)+s.slice(d);
s=s.replace("import { uiSound } from '../fx/uiSound';","import { uiSound } from '../fx/uiSound';\nimport { authButtons } from '../ui/authButtons';\nimport { PROVIDER_NAME } from '../domain/account';");
s=s.replace("const NAVY = 0x0a1638;\n\n","");
fs.writeFileSync(L,s);
console.log('ok');
