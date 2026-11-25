import fs from 'fs';
const f='frontend/src/scenes/MatchmakingScene.ts';
const ed=[
["import { rivalFor } from '../characters/catalog';","import { rivalFor, skinById } from '../characters/catalog';"],
[`const BOT_NAMES = ['RoboAce', 'BotNadal', 'TopSpin-3000', 'NetBot', 'Volea.exe'];
const PRACTICE_NAMES = ['Álex', 'Dani', 'Nico', 'Sam'];
`,`/** (25-11-2026, usuario) los rivales BOT se llaman como su personaje (antes, nombres inventados: RoboAce, BotNadal…) */
const charName = (id: string) => skinById(id as SkinId).name.toUpperCase();
`],
[`    {
      const names = Phaser.Utils.Array.Shuffle([...BOT_NAMES.filter((n) => n.length <= 9)]);
      this.allyName = names[0];
      this.rival2Name = names[1];
    }`,`    {
      // 2v2: el aliado y el rival 1 llevan el otro personaje (rivalFor); el rival 2, el tuyo (como en el partido y en la VS)
      const skin = getProfile().skin;
      this.allyName = charName(rivalFor(skin));
      this.rival2Name = charName(skin);
    }`],
[`      this.showVersus(rk0 ? this.rankedRivalName() : Phaser.Utils.Array.GetRandom(PRACTICE_NAMES));`,`      void rk0;
      this.showVersus(this.rival1Name());`],
[`      this.showVersus(this.doubles ? this.rival1Name() : rk ? this.rankedRivalName() : Phaser.Utils.Array.GetRandom(BOT_NAMES));`,`      this.showVersus(this.rival1Name());`],
[`  /** 2v2: el nombre del rival 1 (distinto del aliado y del rival 2) */
  private rival1Name() {
    const rest = BOT_NAMES.filter((n) => n !== this.allyName && n !== this.rival2Name && n.length <= 9);
    return Phaser.Utils.Array.GetRandom(rest.length ? rest : BOT_NAMES) as string;
  }

  /** Rival Ranked: un participante (simulado) de tu tabla con una posición cercana a la tuya. */
  private rankedRivalName() {
    const v = rankedView();
    const near = v.board.filter((e) => e.bot && Math.abs(e.position - (v.position ?? 50)) <= 8);
    return (Phaser.Utils.Array.GetRandom(near.length ? near : v.board.filter((e) => e.bot)) as { name: string } | undefined)?.name ?? 'Rival';
  }`,`  /** el rival (1v1) o el rival 1 (2v2): el nombre de su personaje (rivalFor, el mismo que sale en la VS y en el partido) */
  private rival1Name() {
    return charName(rivalFor(getProfile().skin));
  }`],
];
let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error('nf '+o.slice(0,50));s=s.slice(0,i)+n+s.slice(i+o.length);}
fs.writeFileSync(f,s);
const g='frontend/src/scenes/MatchScene.ts';
const ed2=[
[`    this.computeServeBox();
    this.showServeHint();`,`    this.computeServeBox();
    // (25-11-2026, usuario) el cuadro de saque resaltado solo cuando sacas tú (ya no se marca dónde sacará el rival)
    if (this.meServes) this.showServeHint();
    else this.hideServeHint();`],
[`  private guideTargetY(side: number) {
    return LAT_C + side * 105;
  }`,`  /** (25-11-2026, usuario) centro del cuadro del primer partido: la mitad de fondo del rectángulo de tu lado (izquierda -1 / derecha 1) */
  private guideTargetY(side: number) {
    return LAT_C + side * (LAT_C - COURT.top) / 2;
  }

  /** largo (desde tu línea de fondo) del cuadro del primer partido: la mitad del rectángulo de fondo (hasta la línea de saque) */
  private guideZoneDepth() {
    return ((NET_X - COURT.left) * (1 - 0.538)) / 2;
  }`],
[`        p.x = clamp(p.x, COURT.left - 68, COURT.left + 10);`,`        p.x = clamp(p.x, COURT.left - 68, COURT.left + this.guideZoneDepth() - 10);`],
[`      const y = this.guideTargetY(direction);
      const a = project(COURT.left - 66, y - 39);
      const b = project(COURT.left - 66, y + 39);
      const c = project(COURT.left + 42, y + 39);
      const d = project(COURT.left + 42, y - 39);`,`      // dentro de la cancha: la mitad de fondo del rectángulo de abajo a la izquierda (o a la derecha), de línea a línea
      const y0 = direction < 0 ? COURT.top : LAT_C;
      const y1 = direction < 0 ? LAT_C : COURT.bottom;
      const x1 = COURT.left + this.guideZoneDepth();
      const a = project(COURT.left, y0 + 4);
      const b = project(COURT.left, y1 - 4);
      const c = project(x1, y1 - 4);
      const d = project(x1, y0 + 4);`],
];
s=fs.readFileSync(g,'utf8').replace(/\r\n/g,'\n');
for(const [o,n] of ed2){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error('nf '+o.slice(0,50));s=s.slice(0,i)+n+s.slice(i+o.length);}
fs.writeFileSync(g,s);
console.log('ok');
