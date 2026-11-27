import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const S='frontend/src/ui/SettingsDialog.ts';
apply(S,[
["  const signInLabel = scene.add.text(x + 108, signInY, 'INICIAR SESIÓN', { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0, 0.5);\n  const signInStatus = scene.add.text(x + pw - 60, signInY, 'PRONTO', { fontFamily: FONT, fontSize: '16px', color: '#8ea8da' }).setOrigin(1, 0.5);\n  panel.add([signInBorder, signInLabel, signInStatus]);",
 `  // (27-11-2026, usuario) INVITADO: "VINCULAR CUENTA" (abre los proveedores); con cuenta: "CERRAR SESIÓN" (pide confirmación)
  const account = getPlayer().account;
  const signInLabel = scene.add.text(x + 108, signInY, account ? 'CERRAR SESIÓN' : 'VINCULAR CUENTA', { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0, 0.5);
  const signInStatus = scene.add.text(x + pw - 60, signInY, account ? (account.email ?? PROVIDER_NAME[account.provider]).toUpperCase() : 'INVITADO', { fontFamily: FONT, fontSize: '16px', color: account ? '#7dffb0' : '#ffd23f' }).setOrigin(1, 0.5);
  if (signInStatus.width > pw * 0.32) signInStatus.setScale((pw * 0.32) / signInStatus.width);
  panel.add([signInBorder, signInLabel, signInStatus]);
  const signInHit = scene.add.zone(signInLeft + signInWidth / 2, signInY, signInWidth, signInHeight).setInteractive({ useHandCursor: true });
  signInHit.on('pointerup', () => {
    if (!account) return openLinkDialog(scene, depth + 50);
    showConfirm(scene, {
      title: 'CERRAR SESIÓN',
      message: \`¿Salir de tu cuenta de \${PROVIDER_NAME[account.provider]}?\`,
      detail: 'Tu progreso queda guardado en tu cuenta. Para volver, inicia sesión otra vez.',
      confirmLabel: 'SALIR',
      cancelLabel: 'VOLVER',
      depth: depth + 50,
      onConfirm: () => {
        signOutLocal();
        scene.time.delayedCall(200, () => window.location.reload());
      },
      onCancel: () => undefined,
    });
  });
  panel.add(signInHit);`],
["import { openBugReport } from './BugReportDialog';", "import { openBugReport } from './BugReportDialog';\nimport { showConfirm } from './ConfirmDialog';\nimport { authButtons } from './authButtons';\nimport { PROVIDER_NAME } from '../domain/account';\nimport { getPlayer, signOutLocal } from '../domain/playerStore';"],
]);
let s=fs.readFileSync(S,'utf8');
s+=`
/**
 * (27-11-2026, usuario) VINCULAR CUENTA (jugador INVITADO): los botones de los proveedores (los mismos de INICIAR SESIÓN). Hoy avisan
 * "muy pronto": falta el servidor de cuentas (docs/BASE-DE-DATOS.md). Al vincular, el progreso del invitado pasa a la cuenta.
 */
function openLinkDialog(scene: Phaser.Scene, depth: number) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const close = () => objs.forEach((o) => o.destroy());
  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.8).setOrigin(0).setScrollFactor(0).setDepth(depth).setInteractive();
  shade.on('pointerup', close);
  objs.push(shade);
  const pw = Math.min(600, W - 40);
  const bw = pw - 70;
  const bh = 78;
  const gap = 18;
  const ph = 150 + bh * 3 + gap * 2 + 140;
  const panel = scene.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(depth + 1);
  objs.push(panel);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4).fillRoundedRect(-pw / 2 + 4, -ph / 2 + 8, pw, ph, 26);
  g.fillStyle(NAVY, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
  g.lineStyle(4, NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
  panel.add(g);
  panel.add(scene.add.zone(0, 0, pw, ph).setInteractive()); // el toque dentro del panel no lo cierra
  panel.add(scene.add.text(0, -ph / 2 + 50, 'VINCULAR CUENTA', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(1));
  const sub = scene.add.text(0, -ph / 2 + 96, 'Guarda tu progreso y juega en cualquier teléfono', { fontFamily: FONT, fontSize: '18px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5);
  panel.add(sub);
  const toast = (msg: string) => {
    const t = scene.add.text(0, ph / 2 - 128, msg, { fontFamily: FONT, fontSize: '20px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
    panel.add(t);
    scene.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  };
  authButtons(scene, panel, 0, -ph / 2 + 130, bw, (p) => toast(\`\${PROVIDER_NAME[p]}: muy pronto\`), bh, gap);
  panel.add(arcadeButton(scene, 0, ph / 2 - 62, Math.min(300, pw - 120), 76, 'CERRAR', close, { palette: 'blue', noShadow: true }));
  panel.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
}
`;
fs.writeFileSync(S,s);
console.log('ok');
