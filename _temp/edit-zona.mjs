import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
const F='frontend/src/scenes/CustomizeScene.ts';
let s=fs.readFileSync(F,'utf8').replace(/\r\n/g,'\n');
const a=s.indexOf("        // Rayos sin gastar: aviso dorado que late para que se usen (sin Rayos no se muestra nada)");
const b=s.indexOf("  /** Botón (i) redondo que abre una explicación. */");
if(a<0||b<0) throw 'nf';
const nw=`        // (25-11-2026, usuario) sin el aviso "N RAYOS PARA USAR": con Rayos para gastar, la TARJETA ENTERA brilla y late (y el contador
        // de arriba a la derecha también); el espacio ganado es para los atributos, más grandes y legibles
        const canSpend = zone.rays > 0;
        if (canSpend) {
          const glow = this.add.graphics();
          for (let i = 4; i >= 1; i--) glow.lineStyle(i * 5, 0xffd23f, 0.09).strokeRoundedRect(item.x - 2, top - 2, w + 4, h + 4, 18);
          glow.lineStyle(3, 0xffe27a, 1).strokeRoundedRect(item.x, top, w, h, 16);
          this.tweens.add({ targets: glow, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          // un destello que recorre la tarjeta de arriba abajo
          const shine = this.add.rectangle(item.x + w / 2, top + 72, w - 8, 26, 0xffffff, 0.1).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: shine, y: top + h - 16, alpha: { from: 0.16, to: 0 }, duration: 1400, repeat: -1, repeatDelay: 600, ease: 'Sine.easeIn' });
        }
        const labels: Record<ZoneStatKey, string> = { strength: 'FUERZA', speed: 'VELOCIDAD', precision: 'PRECISIÓN', agility: 'AGILIDAD', resistance: 'RESISTENCIA' };
        // filas desde bajo la cabecera hasta el borde de abajo, repartidas en todo el alto
        const rowTop = top + 92;
        const step = (h - 92 - 24) / (ZONE_STAT_KEYS.length - 1);
        ZONE_STAT_KEYS.forEach((key, index) => {
          const level = zoneLevels[key];
          const cy = rowTop + index * step;
          // fila: nombre | barra | n/20 | botón +, con aire entre columnas
          const lab = this.add.text(item.x + 14, cy, labels[key], { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#061431', strokeThickness: 3 }).setOrigin(0, 0.5);
          if (lab.width > 92) lab.setScale(92 / lab.width);
          const bx = item.x + 112;
          const bw = Math.max(38, w - 112 - 88);
          const bar = this.add.graphics();
          bar.fillStyle(0x04132e, 1).fillRoundedRect(bx, cy - 8, bw, 16, 8);
          bar.lineStyle(1.5, 0x3472a2, 0.9).strokeRoundedRect(bx, cy - 8, bw, 16, 8);
          if (level > 0) {
            const fw = Math.max(16, (bw * level) / ZONE_STAT_MAX);
            bar.fillStyle(item.color, 1).fillRoundedRect(bx, cy - 8, fw, 16, 8);
            bar.fillStyle(0xffffff, 0.45).fillRoundedRect(bx + 4, cy - 5, Math.max(0, fw - 8), 4, 2);
          }
          this.add.text(item.x + w - 46, cy, \`\${level}/20\`, { fontFamily: FONT, fontSize: '13px', color: '#d8eeff' }).setOrigin(1, 0.5);
          const plusX = item.x + w - 24;
          const enabled = level < ZONE_STAT_MAX && canSpend;
          const plus = this.add.graphics({ x: plusX, y: cy }).setAlpha(enabled ? 1 : 0.42);
          plus.fillStyle(enabled ? 0xffc42e : 0x54637d, 1).fillCircle(0, 0, 15);
          plus.lineStyle(3.5, enabled ? 0x3a2400 : 0xffffff, 0.95).lineBetween(-7, 0, 7, 0).lineBetween(0, -7, 0, 7);
          // con Rayos para gastar, los + laten (invitan a mejorar)
          if (enabled) this.tweens.add({ targets: plus, scale: { from: 1, to: 1.18 }, duration: 600, delay: index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          const hit = this.add.zone(plusX, cy, 44, Math.max(32, step)).setInteractive({ useHandCursor: true });
          hit.on('pointerup', () => {
            const result = commit((state) => upgradeZoneStat(state, key, zoneSkin));
            if (!result.ok) return this.toast(result.error === 'not_enough_rays' ? 'Gana Rayos en las recompensas semanales de la Liga' : 'Este atributo ya llegó al 20%');
            this.scene.restart();
          });
        });
      }
    }
  }

`;
s=s.slice(0,a)+nw+s.slice(b);
fs.writeFileSync(F,s);
apply(F,[
["    t.setX(right - 16).setDepth(1);\n    const hit = this.add.zone(x0 + w / 2, cy, w, h + 10)", "    t.setX(right - 16).setDepth(1);\n    // (25-11-2026, usuario) con Rayos para gastar, el contador también brilla y late (va con la tarjeta de la ZONA)\n    if (rays > 0) {\n      const glow = this.add.graphics();\n      glow.lineStyle(8, 0xffd23f, 0.25).strokeRoundedRect(x0 - 3, cy - h / 2 - 3, w + 6, h + 6, h / 2 + 3);\n      glow.lineStyle(2.5, 0xffe27a, 1).strokeRoundedRect(x0, cy - h / 2, w, h, h / 2);\n      this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });\n      this.tweens.add({ targets: ic, scale: { from: 1, to: 1.2 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });\n    }\n    const hit = this.add.zone(x0 + w / 2, cy, w, h + 10)"],
]);
console.log('ok');
