const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.includes(b)) continue;
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 70) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}

edit('ui/LeagueRanking.ts', [["c.add(coinIcon(scene, w / 2 - 18 - ct.width - 10, 0, 10)); // (17-11-2026) moneda: imagen moneda-1.webp", "c.add((two ? coin2v2Image : coinIcon)(scene, w / 2 - 18 - ct.width - 10, 0, 10)); // (17-11-2026) moneda: imagen moneda-1.webp (2v2: moneda 2v2)"]]);

edit('scenes/MenuScene.ts', [["this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ranked'));", "this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ranked', { tab: this.leagueMode === '2v2' ? '2v2' : '1v1' })); // abre la pestaña de la liga que se ve en la card"]]);

edit('scenes/RankedScene.ts', [
  ["import { coinIcon, drawChestIcon, drawGiftIcon } from '../ui/wheelArt';", "import { coin2v2Image, coinIcon, drawChestIcon, drawGiftIcon } from '../ui/wheelArt';"],
  ["import { arcadeButton } from '../ui/modeButtons';", "import { type ArcadePalette, arcadeButton } from '../ui/modeButtons';"],
  ["import type { RankedView } from '../domain/ranked';", "import type { RankedView } from '../domain/ranked';\nimport { LEAGUE_2V2, type LeagueHubView, league2v2Economy } from '../domain/league2v2';\nimport { claimWeekly2v2, league2v2State, leagueView2v2, markLeague2v2Seen, pendingWeekly2v2, syncLeague2v2 } from '../logic/League2v2';"],
  ["const GOLD = 0xffc42e;\nconst NAV = {", "const GOLD = 0xffc42e;\n/** alto que ocupan las pestañas LIGA / LIGA 2V2 bajo el título (todo lo de abajo se corre esto) */\nconst TAB_H = 64;\nconst NAV = {"],
  [
    "  private overlayReturnScroll = 0;\n\n  constructor() {\n    super('Ranked');\n  }\n\n  init(data?: { toast?: string }) {\n    this.toastMsg = data?.toast;\n  }",
    "  private overlayReturnScroll = 0;\n  /** pestaña abierta: LIGA (1v1, sin decirlo) o LIGA 2V2; se recuerda al volver */\n  private tab: '1v1' | '2v2' = '1v1';\n\n  constructor() {\n    super('Ranked');\n  }\n\n  init(data?: { toast?: string; tab?: '1v1' | '2v2' }) {\n    this.toastMsg = data?.toast;\n    this.tab = data?.tab ?? (this.registry.get('liga.tab') === '2v2' ? '2v2' : '1v1');\n    this.registry.set('liga.tab', this.tab);\n  }",
  ],
  [
    "    if (!this.textures.exists('liga-title')) this.load.image('liga-title', 'assets/liga-titulo.webp'); // (18-11-2026) título LIGA en imagen",
    "    if (!this.textures.exists('liga-title')) this.load.image('liga-title', 'assets/liga-titulo.webp'); // (18-11-2026) título LIGA en imagen\n    if (!this.textures.exists('liga-2v2-title')) this.load.image('liga-2v2-title', 'assets/liga-2v2-titulo.webp'); // título de la pestaña LIGA 2V2",
  ],
  ["    syncRanked();\n    this.overlay = [];", "    syncRanked();\n    syncLeague2v2();\n    this.overlay = [];"],
  [
    "    const v = rankedView();\n    const st = LEAGUE_STYLE[v.league];\n    const bgStart",
    "    const is2 = this.tab === '2v2';\n    const v: LeagueHubView | RankedView = is2 ? leagueView2v2() : rankedView();\n    /** la moneda de lo que se cuenta: monedas de siempre o MONEDAS 2v2 */\n    const coinOf = is2 ? coin2v2Image : coinIcon;\n    const st = LEAGUE_STYLE[v.league];\n    const bgStart",
  ],
  ["    const e1 = ex * 0.12;", "    const e1 = ex * 0.12 + TAB_H;"],
  [
    "    if (this.textures.exists('liga-title')) {\n      const titleW = Math.min(250, Math.max(150, W - 250));\n      this.add.image(W / 2, headY - 1, 'liga-title').setDisplaySize(titleW, titleW / 3);\n    } else this.add.text(W / 2, headY + 2, 'LIGA',",
    "    const titleKey = is2 ? 'liga-2v2-title' : 'liga-title';\n    if (this.textures.exists(titleKey)) {\n      const titleW = Math.min(250, Math.max(150, W - 250));\n      this.add.image(W / 2, headY - 1, titleKey).setDisplaySize(titleW, titleW / 3);\n    } else this.add.text(W / 2, headY + 2, is2 ? 'LIGA 2V2' : 'LIGA',",
  ],
  ["    this.coinPill(W - 24, headY, v.coins); // monedas de la cuenta (arriba a la derecha)", "    this.coinPill(W - 24, headY, v.coins, is2); // monedas de la cuenta (arriba a la derecha; en LIGA 2V2, las monedas 2v2)"],
  [
    "    arcadeButton(this, 84, headY + 74, 128, 46, 'LIGA 2v2', () => {\n      this.cameras.main.fadeOut(180, 0, 0, 0);\n      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Liga2v2'));\n    }, { palette: 'blue' });",
    "    // (21-11-2026, usuario) DOS PESTAÑAS: LIGA (la de siempre, amarilla) y LIGA 2V2 (morada); la abierta lleva su color, la otra va en gris\n    const tabDefs: { id: '1v1' | '2v2'; label: string; pal: ArcadePalette }[] = [\n      { id: '1v1', label: 'LIGA', pal: 'yellow' },\n      { id: '2v2', label: 'LIGA 2V2', pal: 'purple' },\n    ];\n    const tabW = Math.min(210, (W - 60) / 2);\n    tabDefs.forEach((t, i) => {\n      arcadeButton(this, W / 2 + (i - 0.5) * (tabW + 14), headY + 64, tabW, 46, t.label, () => this.setTab(t.id), { palette: this.tab === t.id ? t.pal : 'grey', noShadow: this.tab !== t.id });\n    });",
  ],
  [
    "      const fillCol = v.promoting ? 0x3ad65a : st.color;\n      const fillHi = v.promoting ? 0x8cf59a : st.light;",
    "      // (21-11-2026, usuario) la barra de la liga normal es AMARILLA (como JUGAR) y la de la LIGA 2V2, MORADA; al llegar a la meta, verde\n      const fillCol = v.promoting ? 0x3ad65a : is2 ? 0x8a4bff : 0xffcc1f;\n      const fillHi = v.promoting ? 0x8cf59a : is2 ? 0xc9a3ff : 0xffe55a;",
  ],
  ["      coinIcon(this, gx + cur.width + 6 + cr, lblY - cur.height / 2 + 1, cr); // (17-11-2026) moneda: imagen moneda-1.webp", "      coinOf(this, gx + cur.width + 6 + cr, lblY - cur.height / 2 + 1, cr); // (17-11-2026) moneda: imagen moneda-1.webp"],
  ["      if (c.it.kind === 'coin') ic = coinIcon(this, cxp + 10 + 11, bodyY, 11);", "      if (c.it.kind === 'coin') ic = coinOf(this, cxp + 10 + 11, bodyY, 11);"],
  ["      coinIcon(this, x - coinsW / 2 + 9, podiumBottom - 18, 8); // (17-11-2026) moneda: imagen moneda-1.webp", "      coinOf(this, x - coinsW / 2 + 9, podiumBottom - 18, 8); // (17-11-2026) moneda: imagen moneda-1.webp"],
  ["      coinIcon(this, L + rw3 - 14 - ct.width - 13, yy, 9); // (17-11-2026) moneda: imagen moneda-1.webp", "      coinOf(this, L + rw3 - 14 - ct.width - 13, yy, 9); // (17-11-2026) moneda: imagen moneda-1.webp"],
  [
    "    const quickH = this.quickButtons(v, W / 2, ry + rh / 2 + GAP, rw);\n    const panelTop = ry + rh / 2 + GAP + quickH + GAP + TAG_H / 2;",
    "    // (la LIGA 2V2 aún no guarda historial ni premios extra: sin esos dos botones)\n    const quickH = is2 ? 0 : this.quickButtons(v as RankedView, W / 2, ry + rh / 2 + GAP, rw);\n    const panelTop = ry + rh / 2 + GAP + (is2 ? 0 : quickH + GAP) + TAG_H / 2;",
  ],
  // ---- lista de ligas (metas de la pestaña abierta)
  [
    "    const objs = this.openOverlay();\n    const v = rankedView();\n    const pw = Math.min(620, W - 30);",
    "    const objs = this.openOverlay();\n    const is2 = this.tab === '2v2';\n    const v = is2 ? leagueView2v2() : rankedView();\n    const pw = Math.min(620, W - 30);",
  ],
  ["      const eco = RANKED.leagues[r.id];\n      const cur = r.id === v.league;", "      const eco = is2 ? { ...league2v2Economy(r.id), entry: 0 } : RANKED.leagues[r.id];\n      const cur = r.id === v.league;"],
  [
    "eco.target != null ? `Meta semanal ${fmtCoins(eco.target)} monedas netas` : 'Liga máxima'",
    "eco.target != null ? `Meta semanal ${fmtCoins(eco.target)} monedas${is2 ? ' 2v2' : ''} netas` : 'Liga máxima'",
  ],
  [
    "`Entrada ${fmtCoins(eco.entry)} · Semanal ${fmtCoins(eco.weekly.coins)}${eco.weekly.cash ? ` + ${eco.weekly.cash} dinero` : ''}`",
    "`${is2 ? 'Gana +30 · Pierde −15' : `Entrada ${fmtCoins(eco.entry)}`} · Semanal ${fmtCoins(eco.weekly.coins)}${eco.weekly.cash ? ` + ${eco.weekly.cash} dinero` : ''}`",
  ],
  // ---- avisos al entrar
  [
    "    const w = pendingWeekly()[0];\n    if (w) return this.showWeekly(w);\n  }",
    "    const w = pendingWeekly()[0];\n    if (w) return this.showWeekly(w);\n    // LIGA 2V2: su ascenso (con el marco 2v2 nuevo) y su recompensa semanal\n    const l2 = league2v2State();\n    if (l2 && l2.seenLeague !== l2.league) return this.showPromotion(l2.seenLeague, l2.league, true);\n    const w2 = pendingWeekly2v2()[0];\n    if (w2) return this.showWeekly(w2, true);\n  }",
  ],
  ["  private showPromotion(from: RankId, to: RankId) {", "  private showPromotion(from: RankId, to: RankId, two = false) {"],
  [
    "    const btn = arcadeButton(this, cx, H - 120, 300, 80, 'GENIAL', () => {\n      markRankedSeen();",
    "    if (two) {\n      const mt = this.add.text(cx, cy + 226, `¡MARCO 2V2 ${rankDef(to).name.toUpperCase()} DESBLOQUEADO!`, { fontFamily: FONT, fontSize: '22px', color: '#d9b4ff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setDepth(8005).setAlpha(0);\n      fitText(mt, W - 40);\n      objs.push(mt);\n      this.tweens.add({ targets: mt, alpha: 1, duration: 420, delay: 1450 });\n    }\n    const btn = arcadeButton(this, cx, H - 120, 300, 80, 'GENIAL', () => {\n      if (two) markLeague2v2Seen();\n      else markRankedSeen();",
  ],
  ["  private showWeekly(w: WeeklyReward) {", "  private showWeekly(w: WeeklyReward, two = false) {"],
  [
    "`¡LLEGASTE A LA META! SUBES A ${rankDef(w.promotedTo).name.toUpperCase()}`",
    "`¡LLEGASTE A LA META! SUBES A ${rankDef(w.promotedTo).name.toUpperCase()}${two ? ' · MARCO 2V2' : ''}`",
  ],
  ["      p.add(coinIcon(this, -110, -ph / 2 + 428, 20)); // (17-11-2026) moneda: imagen moneda-1.webp", "      p.add((two ? coin2v2Image : coinIcon)(this, -110, -ph / 2 + 428, 20)); // (17-11-2026) moneda: imagen moneda-1.webp (2v2: moneda 2v2)"],
  ["`Necesitabas ${RANKED.minWinsForReward} victorias (ganaste ${w.wins}).", "`Necesitabas ${two ? LEAGUE_2V2.minWinsForReward : RANKED.minWinsForReward} victorias (ganaste ${w.wins})."],
  [
    "      const res = claimWeekly(w.week);\n      this.closeOverlay();\n      if (res.ok && res.given) this.toast(`+${fmtCoins(w.coins)} monedas${",
    "      const res = two ? claimWeekly2v2(w.week) : claimWeekly(w.week);\n      this.closeOverlay();\n      if (res.ok && res.given) this.toast(`+${fmtCoins(w.coins)} monedas${two ? ' 2v2' : ''}${",
  ],
  // ---- TOP 100 y píldora de monedas
  ["    objs.push(openLeagueRanking(this, { dim: false, onClose: () => this.closeOverlay() }));", "    objs.push(openLeagueRanking(this, { dim: false, onClose: () => this.closeOverlay(), mode: this.tab }));"],
  [
    "  private coinPill(right: number, y: number, coins: number) {",
    "  /** Cambia de pestaña (LIGA / LIGA 2V2) y rehace la pantalla. */\n  private setTab(t: '1v1' | '2v2') {\n    if (t === this.tab) return;\n    this.tab = t;\n    this.registry.set('liga.tab', t);\n    this.scrollY = 0;\n    this.time.delayedCall(0, () => this.scene.isActive() && this.rebuild());\n  }\n\n  private coinPill(right: number, y: number, coins: number, two = false) {",
  ],
  ["    coinIcon(this, right - w + 22, y, 14); // (17-11-2026) moneda: imagen moneda-1.webp\n    this.children.bringToTop(t);", "    (two ? coin2v2Image : coinIcon)(this, right - w + 22, y, 14); // (17-11-2026) moneda: imagen moneda-1.webp (2v2: moneda 2v2)\n    this.children.bringToTop(t);"],
]);

// se va la pantalla vieja de la liga 2v2 (ahora es una pestaña de LIGA)
edit('main.ts', [
  ["import { Liga2v2Scene } from './scenes/Liga2v2Scene';\n", ""],
  ["RankedScene, Liga2v2Scene, LanSearchScene", "RankedScene, LanSearchScene"],
]);
