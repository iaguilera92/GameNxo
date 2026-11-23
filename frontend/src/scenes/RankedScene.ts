import { installTapSound } from '../fx/uiSound';
import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton, modeBand, modeShape } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { coin2v2Image, coinIcon, drawChestIcon, drawGiftIcon } from '../ui/wheelArt';
import { drawCashIcon } from './BattlePassScene';
import { wheelClaim, wheelTick, wheelWin } from '../fx/wheelSound';
import { LEAGUE_STYLE, fmtCoins, fmtNet } from '../ui/leagueStyle';
import { openLeagueRanking } from '../ui/LeagueRanking';
import { RANKS, type RankId, rankDef } from '../domain/ranks';
import { RANKED, positionPrize, weeklyChestCash } from '../domain/rankedConfig';
import type { BoardEntry } from '../domain/rankedBots';
import type { RankedView } from '../domain/ranked';
import { LEAGUE_2V2, type LeagueHubView, league2v2Economy } from '../domain/league2v2';
import { claimWeekly2v2, league2v2State, leagueView2v2, markLeague2v2Seen, pendingWeekly2v2, syncLeague2v2 } from '../logic/League2v2';
import type { WeeklyReward } from '../domain/rankedState';
import { onPlayerChange } from '../domain/playerStore';
import { claimWeekly, markRankedSeen, pendingWeekly, rankedState, rankedView, syncRanked } from '../logic/Ranked';

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
/** (23-11-2026) alto de la TAPA en el arte del cofre semanal (cofre-semanal.webp, 256 px): se recorta para abrirlo */
const SEASON_LID_Y = 100;

/**
 * ARTE DE LA PANTALLA LIGA (21-11-2026, mockup del usuario: _temp/liga/liga-mockup.png). Cada imagen es un WebP sin texto; el
 * código escribe encima los números y textos reales. Si una imagen falta, se dibuja lo de antes (no se rompe). Las hojas con varios
 * elementos (cards, podio, pestañas, botones) se recortan por fracciones del ancho. Proporción w/h de cada una, para colocarlas sin deformar.
 */
// `ar` = proporción de la CAJA; `pad` = cuánto del alto de la caja es transparente arriba y abajo (medido con tools/bbox, _temp/bbox-liga.mjs).
// Para que las secciones no queden con huecos enormes, se colocan por el DIBUJO visible (restando ese padding), no por la caja.
const LIGA_ART = {
  bg: { key: 'liga-bg', file: 'assets/liga/fondo-liga.webp', ar: 1024 / 1536, pad: [0, 0] },
  tabs1: { key: 'liga-tabs', file: 'assets/liga/pestanas-liga.webp', ar: 2000 / 667, pad: [0.244, 0.199] },
  tabs2: { key: 'liga-tabs-2v2', file: 'assets/liga/pestanas-liga-2v2.webp', ar: 2000 / 667, pad: [0.237, 0.201] },
  stage: { key: 'liga-stage', file: 'assets/liga/escenario-liga.webp', ar: 1774 / 887, pad: [0.122, 0.08] }, // (21-11-2026) escenario más bajo, laureles cerca del centro
  // (21-11-2026) las 3 cards y las 3 del podio, en archivos SUELTOS con margen transparente: recortadas de una hoja, el filtrado lineal
  // sangraba el borde de la pieza vecina y se veían RAYAS. `off` = coordenada de la hoja original donde empieza cada archivo.
  card0: { key: 'liga-card-0', file: 'assets/liga/card-0.webp', off: [30, 130] },
  card1: { key: 'liga-card-1', file: 'assets/liga/card-1.webp', off: [643, 130] },
  card2: { key: 'liga-card-2', file: 'assets/liga/card-2.webp', off: [1253, 130] },
  reward: { key: 'liga-reward', file: 'assets/liga/panel-recompensa.webp', ar: 2000 / 667, pad: [0.168, 0.189] },
  buttons: { key: 'liga-buttons', file: 'assets/liga/botones-liga.webp', ar: 2000 / 667, pad: [0.312, 0.304] },
  leaders: { key: 'liga-leaders-title', file: 'assets/liga/titulo-lideres.webp', ar: 2000 / 667, pad: [0.294, 0.316] },
  pod0: { key: 'liga-pod-0', file: 'assets/liga/podio-0.webp', off: [36, 115] },
  pod1: { key: 'liga-pod-1', file: 'assets/liga/podio-1.webp', off: [566, 115] },
  pod2: { key: 'liga-pod-2', file: 'assets/liga/podio-2.webp', off: [1197, 115] },
  top100: { key: 'liga-top100', file: 'assets/liga/btn-top100.webp', ar: 2000 / 667, pad: [0.297, 0.313] },
} as const;

/**
 * (21-11-2026, revisión de diseño) RECORTES EXACTOS de cada pieza dentro de su imagen: [x, y, ancho, alto] en px de la imagen original
 * (medidos por alfa; las hojas con piezas que se tocan se cortan en la columna con menos píxeles). Antes se cortaba en tercios/mitades con
 * máscaras y las piezas salían cortadas o corridas (p. ej. la card de RACHA). Las posiciones de los textos se dan en px de la imagen.
 */
const LIGA_PIECES = {
  tabs: [15, 159, 1951, 375],
  stage: [49, 160, 1676, 658], // (21-11-2026) escenario más limpio: misma base, laureles más bajos
  card0: [36, 136, 626, 542],
  card1: [649, 136, 623, 542],
  card2: [1259, 136, 627, 542],
  reward: [48, 118, 1908, 420],
  btn0: [34, 209, 957, 254],
  btn1: [1008, 209, 957, 254],
  leaders: [88, 196, 1823, 259],
  pod0: [42, 121, 530, 664],
  pod1: [572, 121, 631, 664],
  pod2: [1203, 121, 529, 664],
  top100: [53, 198, 1894, 259],
} as const;
type Piece = readonly [number, number, number, number];

/**
 * Pantalla principal de RANKED (v2, docs/RANKED-V2.md): liga y emblema, NETO de la semana y avance a la meta semanal,
 * posición (y posición de premio), victorias de la semana (x/3), récord, racha, tiempo restante, recompensa estimada y las
 * tabla RANKING LIGA (neto semanal, con bots). El título de la pantalla es LIGA (16-11-2026, pedido del usuario).
 * El RANKING GLOBAL (saldo) NO está aquí: se abre desde el menú principal (ui/GlobalRanking.ts) para no confundirlos.
 * Al entrar muestra (una vez) el ascenso y las recompensas semanales. El saldo global va en la píldora de arriba.
 */
export class RankedScene extends Phaser.Scene {
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private toastMsg?: string;
  private scrollY = 0;
  private maxScrollY = 0;
  private dragY: number | null = null;
  private dragScrollY = 0;
  private dragging = false;
  private overlayReturnScroll = 0;
  /** pestaña abierta: LIGA (1v1, sin decirlo) o LIGA 2V2; se recuerda al volver */
  private tab: '1v1' | '2v2' = '1v1';

  constructor() {
    super('Ranked');
  }

  init(data?: { toast?: string; tab?: '1v1' | '2v2' }) {
    this.toastMsg = data?.toast;
    this.tab = data?.tab ?? (this.registry.get('liga.tab') === '2v2' ? '2v2' : '1v1');
    this.registry.set('liga.tab', this.tab);
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    for (const a of Object.values(LIGA_ART)) if (!this.textures.exists(a.key)) this.load.image(a.key, a.file); // (21-11-2026) arte de la pantalla LIGA
    if (!this.textures.exists('liga-chest-week')) this.load.image('liga-chest-week', 'assets/cofre-semanal.webp'); // (21-11-2026) cofre del panel de la recompensa semanal
    preloadRankBadges(this.load); // todas: tabla de líderes y lista de ligas
    preloadRankBadges(this.load, undefined, true); // y los emblemas de la LIGA 2V2 (assets/<liga>-2v2.webp)
    if (!this.textures.exists('coin-2v2')) this.load.image('coin-2v2', 'assets/moneda-2v2.webp'); // moneda de la liga 2v2
    if (!this.textures.exists('liga-title')) this.load.image('liga-title', 'assets/liga-titulo.webp'); // (18-11-2026) título LIGA en imagen
    if (!this.textures.exists('liga-2v2-title')) this.load.image('liga-2v2-title', 'assets/liga-2v2-titulo.webp'); // título de la pestaña LIGA 2V2
  }

  create() {
    restartOnResize(this);
    installTapSound(this); // clic de interfaz en cada botón / diálogo
    this.cameras.main.fadeIn(200, 0, 0, 0);
    syncRanked();
    syncLeague2v2();
    this.overlay = [];
    this.build();
    this.setupScroll();
    const off = onPlayerChange(() => this.time.delayedCall(0, () => this.overlay.length === 0 && this.scene.isActive() && this.rebuild()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    // contador de la temporada
    this.time.addEvent({ delay: 30_000, loop: true, callback: () => this.overlay.length === 0 && this.rebuild() });
    this.time.delayedCall(350, () => this.presentQueue());
    if (this.toastMsg) this.toast(this.toastMsg);
  }

  private rebuild() {
    this.children.list.filter((o) => !this.overlay.includes(o)).forEach((o) => o.destroy());
    this.build();
  }

  /**
   * Imagen de una PIEZA recortada (frame exacto de LIGA_PIECES) con su borde superior-izquierdo en (left, top) y `w` de ancho.
   * Devuelve la escala y conversores de px de la imagen original a px de pantalla, para colocar textos encima. null si falta la imagen.
   */
  private piece(art: { key: string; off?: readonly number[] }, name: string, r: Piece, left: number, top: number, w: number) {
    if (!this.textures.exists(art.key)) return null;
    const tex = this.textures.get(art.key);
    // `off`: el archivo es un trozo de la hoja original que empieza en (off[0], off[1]); `r` sigue en coordenadas de la hoja
    const ox = art.off?.[0] ?? 0;
    const oy = art.off?.[1] ?? 0;
    if (!tex.has(name)) tex.add(name, 0, r[0] - ox, r[1] - oy, r[2], r[3]);
    const s = w / r[2];
    const img = this.add.image(left, top, art.key, name).setOrigin(0, 0).setDisplaySize(w, r[3] * s);
    return { img, s, w, h: r[3] * s, X: (px: number) => left + (px - r[0]) * s, Y: (py: number) => top + (py - r[1]) * s };
  }

  // ================================================================ hub
  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    const is2 = this.tab === '2v2';
    const v: LeagueHubView | RankedView = is2 ? leagueView2v2() : rankedView();
    /** la moneda de lo que se cuenta: monedas de siempre o MONEDAS 2v2 */
    const coinOf = is2 ? coin2v2Image : coinIcon;
    const st = LEAGUE_STYLE[v.league];
    const bgStart = this.children.list.length;
    // fondo de la pantalla (assets/liga/fondo-liga.webp, cover centrado); sin la imagen, el estadio dibujado de antes
    if (this.textures.exists(LIGA_ART.bg.key)) {
      const src = this.textures.get(LIGA_ART.bg.key).getSourceImage() as { width: number; height: number };
      const k = Math.max(W / src.width, H / src.height);
      this.add.image(W / 2, H / 2, LIGA_ART.bg.key).setDisplaySize(src.width * k, src.height * k);
    } else stadiumBg(this, 0.62);
    this.children.list.slice(bgStart).forEach((o) => (o as Phaser.GameObjects.GameObject & { setScrollFactor(x: number, y?: number): unknown }).setScrollFactor(0));
    // pantallas más altas que 1280: el espacio extra se reparte entre los bloques (JUGAR queda abajo)
    const ex = Phaser.Math.Clamp(H - 1280, 0, 360);
    // resplandor del color de la liga detrás del emblema

    // ---- cabecera
    const headY = 60;
    const headerStart = this.children.list.length;
    this.backButton(50, headY);
    // título LIGA (antes la imagen "RANKED"; 16-11-2026: los títulos de Ranked pasan a LIGA)
    // (18-11-2026) título en imagen (mismo estilo que TIENDA: liga-titulo.webp, 3:1); sin ella, el texto de antes
    const titleKey = is2 ? 'liga-2v2-title' : 'liga-title';
    if (this.textures.exists(titleKey)) {
      const titleW = Math.min(250, Math.max(150, W - 250));
      this.add.image(W / 2, headY - 1, titleKey).setDisplaySize(titleW, titleW / 3);
    } else this.add.text(W / 2, headY + 2, is2 ? 'LIGA 2V2' : 'LIGA', { fontFamily: FONT, fontSize: '54px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 10 }).setOrigin(0.5).setLetterSpacing(6).setShadow(0, 5, '#000000', 6, true, true);
    this.coinPill(W - 24, headY, v.coins, is2); // monedas de la cuenta (arriba a la derecha; en LIGA 2V2, las monedas 2v2)
    // (21-11-2026, mockup) DOS PESTAÑAS en una sola imagen (la activa en color, la otra en gris). Las coloco por su DIBUJO visible: su borde
    // superior visible arranca bajo el título. `drawTabs` devuelve dónde termina el dibujo visible, para encadenar el escenario.
    const tabsVisTop = headY + 40;
    const tabsBottom = this.drawTabs(W, tabsVisTop, is2);
    const headerObjects = this.children.list.slice(headerStart);
    this.add.container(0, 0, headerObjects).setScrollFactor(0);
    const contentStart = this.children.list.length;

    // ---- LIGA ACTUAL (21-11-2026, mockup): la imagen escenario-liga (pedestal, laureles, estandartes, placa y riel de la barra); encima el
    // emblema, "LIGA ACTUAL" en la placa y, sobre el riel, el relleno del progreso con la moneda + saldo a la izquierda y la meta a la derecha.
    const accent = is2 ? 0xb06bff : 0xffc42e;
    // (21-11-2026, usuario) TODAS las secciones con el MISMO ancho que la card de LÍDERES (escenario, 3 cards, recompensa, botones)
    const CW = Math.min(660, W - 40);
    const stageW = CW;
    const stageH = stageW / LIGA_ART.stage.ar;
    // `stageTop` = borde de la CAJA del escenario; se coloca de modo que su DIBUJO visible arranque bajo las pestañas (21-11-2026, usuario: más arriba)
    // (21-11-2026, usuario) más arriba: las puntas de los laureles quedan justo bajo el piquito de las pestañas; lo de abajo se encadena y sube igual
    // (21-11-2026) el emblema sobresale por arriba del escenario: el escenario baja lo justo para que el emblema quede bajo las pestañas
    const EMB_SRC = 560; // alto del emblema en px de escenario-liga.png (base apoyada en el pedestal, y 522)
    const embOver = Math.max(0, LIGA_PIECES.stage[1] - (522 - EMB_SRC)) * (Math.min(660, W - 40) / LIGA_PIECES.stage[2]);
    const stageVisTop = tabsBottom - 46 + embOver + ex * 0.12; // (21-11-2026, usuario) más arriba (la punta del emblema se monta un poco sobre el piquito)
    const stageTop = stageVisTop;
    const ecx = W / 2;
    const hasStage = this.textures.exists(LIGA_ART.stage.key);
    const SP = LIGA_PIECES.stage;
    // con imagen: el escenario recortado empieza justo en `stageVisTop` y termina en `stageVisBot`
    const stageVisBot = hasStage ? stageVisTop + (stageW * SP[3]) / SP[2] : stageTop + stageH;
    let barTop: number; // (lo usa FIN DE TEMPORADA más abajo)
    if (hasStage) {
      // (21-11-2026, revisión) posiciones en px de escenario-liga.png: el emblema GRANDE apoyado en el pedestal (como el mockup, montado
      // un poco sobre los laureles), "LIGA ACTUAL" en la placa, y la barra en el riel oscuro con moneda+saldo y meta en los huecos a sus lados
      const P = this.piece(LIGA_ART.stage, 'stage', SP, ecx - stageW / 2, stageVisTop, stageW)!;
      const embH = EMB_SRC * P.s;
      new RankBadge(this, P.X(887), P.Y(522) - embH / 2, { rank: v.league, level: 99, size: embH, doubles: is2, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen: () => this.leagueList() });
      const plate = this.add.text(P.X(885), P.Y(606), 'LIGA ACTUAL', { fontFamily: FONT, fontSize: '24px', color: '#4a2600', stroke: '#fff1b8', strokeThickness: 3 }).setOrigin(0.5).setLetterSpacing(1);
      fitText(plate, (1290 - 480) * P.s);
      // riel interior (px de la imagen): x 404..1369, y 692..757
      const railX = P.X(404);
      const railW = P.X(1369) - railX;
      const railY = P.Y(724.5);
      const bh = (757 - 692) * P.s;
      barTop = railY - bh / 2;
      const prog = v.target == null || v.promoting ? 1 : Phaser.Math.Clamp(v.progress, 0, 1);
      const fillCol = v.promoting ? 0x3ad65a : is2 ? 0x8a4bff : 0xffcc1f;
      const fillHi = v.promoting ? 0x8cf59a : is2 ? 0xc9a3ff : 0xffe55a;
      const fw = prog > 0 ? Math.max(bh, railW * prog) : 0;
      if (fw > 0) {
        const g = this.add.graphics();
        // (22-11-2026, usuario) al entrar (y al cambiar de pestaña) la barra parte de 0 y se llena en 1 s hasta lo que llevamos
        const paint = (w: number) => {
          g.clear();
          if (w <= 0) return;
          const ww = Math.max(bh, w); // ancho mínimo: la cápsula redonda no se deforma
          g.setAlpha(Math.min(1, w / bh));
          g.fillStyle(fillCol, 1).fillRoundedRect(railX, railY - bh / 2, ww, bh, bh / 2);
          g.fillStyle(fillHi, 0.6).fillRoundedRect(railX + 3, railY - bh / 2 + 3, Math.max(0, ww - 6), bh * 0.34, bh / 4);
        };
        paint(0);
        this.tweens.addCounter({ from: 0, to: fw, duration: 1000, ease: 'Cubic.easeOut', onUpdate: (tw) => g.active && paint(tw.getValue() ?? 0) });
      }
      // moneda + saldo centrados en el hueco izquierdo (x 90..385) y la meta en el derecho (x 1390..1685)
      // (21-11-2026, usuario) cifras GRANDES (100.000 o más) también caben: cada hueco usa todo su ancho (300 px de la imagen), el número
      // se achica hasta la mitad si hace falta (no se corta con "..."), los dos lados quedan del MISMO tamaño, y desde 1.000.000 se abrevia (1,2M)
      const net = v.weekNet;
      const fmtBar = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })}M` : fmtCoins(n));
      const sideW = 300 * P.s;
      const COIN_R = 12;
      const numStyle = { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#2a1500', strokeThickness: 4 };
      const netT = this.add.text(0, railY, fmtBar(net), { ...numStyle, color: net < 0 ? '#ff8174' : '#ffffff' }).setOrigin(0, 0.5);
      fitText(netT, sideW - COIN_R * 2 - 6, 0.5);
      const tg = v.target != null ? this.add.text(P.X(1535), railY, fmtBar(v.target), numStyle).setOrigin(0.5) : null;
      if (tg) {
        fitText(tg, sideW - 8, 0.5);
        const k = Math.min(netT.scaleX, tg.scaleX);
        netT.setScale(k);
        tg.setScale(k);
      }
      const grpW = COIN_R * 2 + 5 + netT.displayWidth;
      const gx0 = P.X(237) - grpW / 2;
      coinOf(this, gx0 + COIN_R, railY, COIN_R); // (17-11-2026) moneda
      netT.setX(gx0 + COIN_R * 2 + 5);
    } else {
      // --- sin la imagen: el panel dibujado de antes (borde dorado/morado, rayos, laureles, barra alta)
      const pW = stageW;
      const px0 = W / 2 - pW / 2;
      const pTop = stageTop;
      const pH = 312;
      const accentHi = is2 ? 0xd9b4ff : 0xffe27a;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4).fillRoundedRect(px0 + 3, pTop + 7, pW, pH, 28);
      g.fillStyle(0x0b1a45, 0.96).fillRoundedRect(px0, pTop, pW, pH, 28);
      g.fillStyle(st.color, 0.15).fillEllipse(W / 2, pTop + 122, pW * 0.84, 200);
      g.lineStyle(3.5, accent, 1).strokeRoundedRect(px0, pTop, pW, pH, 28);
      g.lineStyle(1.5, accentHi, 0.7).strokeRoundedRect(px0 + 4, pTop + 4, pW - 8, pH - 8, 24);
      const ey = pTop + 124;
      const rays = this.add.graphics({ x: ecx, y: ey }).setBlendMode(Phaser.BlendModes.ADD);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        rays.fillStyle(st.light, k % 2 ? 0.07 : 0.14).fillTriangle(0, 0, Math.cos(a - 0.12) * 118, Math.sin(a - 0.12) * 118, Math.cos(a + 0.12) * 118, Math.sin(a + 0.12) * 118);
      }
      this.tweens.add({ targets: rays, angle: 360, duration: 26000, repeat: -1 });
      new RankBadge(this, ecx, ey, { rank: v.league, level: 99, size: 186, doubles: is2, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen: () => this.leagueList() });
      const tl = this.add.text(W / 2, pTop, 'LIGA ACTUAL', { fontFamily: FONT, fontSize: '19px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
      const rw0 = tl.width + 64;
      const rg0 = this.add.graphics();
      rg0.fillStyle(0x12255c, 1).fillRoundedRect(W / 2 - rw0 / 2, pTop - 17, rw0, 34, 17);
      rg0.lineStyle(2.5, accent, 1).strokeRoundedRect(W / 2 - rw0 / 2, pTop - 17, rw0, 34, 17);
      this.children.bringToTop(tl);
      const bw = pW - 52;
      const bx = W / 2 - bw / 2;
      const bh = 26;
      barTop = pTop + pH - 22 - bh;
      const prog = v.target == null || v.promoting ? 1 : Phaser.Math.Clamp(v.progress, 0, 1);
      const fillCol = v.promoting ? 0x3ad65a : is2 ? 0x8a4bff : 0xffcc1f;
      const fillHi = v.promoting ? 0x8cf59a : is2 ? 0xc9a3ff : 0xffe55a;
      const bg = this.add.graphics();
      bg.fillStyle(0x08153d, 1).fillRoundedRect(bx, barTop, bw, bh, bh / 2);
      const fw = prog > 0 ? Math.max(bh - 4, (bw - 6) * prog) : 0;
      bg.lineStyle(3, 0xe8eeff, 1).strokeRoundedRect(bx, barTop, bw, bh, bh / 2);
      if (fw > 0) {
        // (22-11-2026, usuario) igual que con la imagen: parte de 0 y se llena en 1 s
        const fg = this.add.graphics();
        const r = bh - 6;
        const paint = (w: number) => {
          fg.clear();
          if (w <= 0) return;
          const ww = Math.max(r, w);
          fg.setAlpha(Math.min(1, w / r));
          fg.fillStyle(fillCol, 1).fillRoundedRect(bx + 3, barTop + 3, ww, r, r / 2);
          fg.fillStyle(fillHi, 0.6).fillRoundedRect(bx + 7, barTop + 5, Math.max(0, ww - 8), r * 0.34, 4);
        };
        paint(0);
        this.tweens.addCounter({ from: 0, to: fw, duration: 1000, ease: 'Cubic.easeOut', onUpdate: (tw) => fg.active && paint(tw.getValue() ?? 0) });
      }
      const lblY = barTop - 20;
      const net = v.weekNet;
      const cur = this.add.text(bx + 2, lblY, fmtCoins(net), { fontFamily: FONT, fontSize: '28px', color: net < 0 ? '#ff8174' : '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5);
      coinOf(this, bx + 2 + cur.width + 18, lblY, 12);
      if (v.target != null) this.add.text(bx + bw - 2, lblY, fmtCoins(v.target), { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(1, 0.5);
    }

    // (21-11-2026, usuario) SEPARACIÓN uniforme entre secciones, medida por el DIBUJO visible de cada imagen (no por la caja, que trae
    // padding transparente). El layout se encadena con un cursor (`by`, `sy`, `ry`…) + este GAP.
    const GAP = 20;
    // (21-11-2026, usuario) sin la cápsula FIN DE TEMPORADA (sobraba): las cards van GAP bajo el escenario. `by + 17` = borde de arriba del hueco
    const by = (hasStage ? stageVisBot : barTop + 34) - 17;
    // ---- estadísticas: 3 cards (POSICIÓN · SEMANA · RACHA) de cards-stats.webp; número grande, título y el dato en la píldora.
    const TGAP = 16;
    const tw = (CW - 2 * TGAP) / 3;
    const hasCards0 = this.textures.exists(LIGA_ART.card0.key) && this.textures.exists(LIGA_ART.card1.key) && this.textures.exists(LIGA_ART.card2.key);
    // (21-11-2026, revisión) cada card es un recorte exacto (card0/1/2) a `tw` de ancho; su alto sale de su proporción
    const cardH = hasCards0 ? (tw * LIGA_PIECES.card0[3]) / LIGA_PIECES.card0[2] : 108;
    const cardsVisTop = by + 17 + 4; // (21-11-2026, usuario) más pegadas al escenario
    const sy = cardsVisTop + cardH / 2;
    const cardsVisBot = cardsVisTop + cardH; // dónde termina el dibujo de las cards
    const topPos = v.position != null && v.position <= 10;
    // tramo de premio (posición de premio: solo entre reales con servidor, D7)
    const prizeLbl = positionPrize(v.prizePosition)?.label ?? null;
    const prizeSub = prizeLbl ? (v.prizePosition !== v.position ? `PREMIO #${v.prizePosition} · ${prizeLbl}` : prizeLbl) : `DE ${v.board.length}`;
    const tiles: { label: string; value: string; sub: string; accent: number; icon: StatIcon; hot: boolean }[] = [
      { label: 'POSICIÓN', value: v.position ? `#${v.position}` : '—', sub: prizeSub, accent: topPos ? GOLD : 0x3a7bff, icon: 'trophy', hot: topPos },
      { label: 'SEMANA', value: `${v.weekWins}-${v.weekLosses}`, sub: `${pct(v.weekWins, v.weekLosses)} VICT.`, accent: 0x37e0ff, icon: 'chart', hot: false },
      { label: 'RACHA', value: `${v.season.streak}`, sub: `MEJOR ${v.total.bestStreak}`, accent: 0xff8a3d, icon: 'flame', hot: v.season.streak >= 3 },
    ];
    // (21-11-2026, mockup) las 3 cards salen de cards-stats.webp; el medallón del icono ya viene en el arte. Sin la imagen, las placas de antes.
    const hasCards = hasCards0;
    tiles.forEach((t, i) => {
      const x = W / 2 + (i - 1) * (tw + TGAP);
      if (hasCards) {
        // recorte exacto de la card i; textos en px de la card (alto 541): número entre los laureles (y≈.49), título (y≈.645) y el dato DENTRO de la píldora (y≈.825)
        const ch = cardH;
        const top = sy - ch / 2;
        const pr = [LIGA_PIECES.card0, LIGA_PIECES.card1, LIGA_PIECES.card2][i];
        this.piece([LIGA_ART.card0, LIGA_ART.card1, LIGA_ART.card2][i], `card${i}`, pr, x - tw / 2, top, tw);
        const vt = this.add.text(x, top + ch * 0.49, t.value, { fontFamily: FONT, fontSize: '40px', color: t.hot ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5);
        fitText(vt, tw * 0.62);
        const lt = this.add.text(x, top + ch * 0.655, t.label, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5).setLetterSpacing(1.5);
        fitText(lt, tw * 0.8);
        const stt = this.add.text(x, top + ch * 0.83, t.sub, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5);
        fitText(stt, tw * 0.56);
        if (t.hot) {
          const halo = this.add.graphics();
          halo.lineStyle(7, GOLD, 0.4).strokeRoundedRect(x - tw / 2 + 2, top + 2, tw - 4, ch - 4, 16);
          this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        return;
      }
      // --- respaldo: placa inclinada dibujada
      const th = 108;
      const top = sy - th / 2 + 6;
      const k = 10;
      const L = x - tw / 2;
      const R = x + tw / 2;
      const shape = (g: number) => [
        { x: L + k - g, y: top - g },
        { x: R + g, y: top - g },
        { x: R - k + g, y: top + th + g },
        { x: L - g, y: top + th + g },
      ];
      const tg = this.add.graphics();
      tg.fillStyle(0x000000, 0.4).fillPoints(shape(0).map((p) => ({ x: p.x + 3, y: p.y + 6 })), true);
      tg.fillStyle(0x0a1638, 1).fillPoints(shape(3), true);
      tg.fillStyle(0x0d1a3a, 1).fillPoints(shape(0), true);
      tg.fillStyle(t.accent, 1).fillPoints([{ x: L + 1.2, y: top + th - 6 }, { x: R - k + 1.2, y: top + th - 6 }, { x: R - k, y: top + th }, { x: L, y: top + th }], true);
      tg.lineStyle(2, t.accent, t.hot ? 1 : 0.6).strokePoints(shape(0), true, true);
      if (t.hot) {
        const halo = this.add.graphics();
        halo.lineStyle(8, GOLD, 0.35).strokePoints(shape(2), true, true);
        this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const ic = this.add.graphics({ x, y: top });
      ic.fillStyle(0x0a1638, 1).fillCircle(0, 0, 21);
      ic.fillStyle(t.accent, 1).fillCircle(0, 0, 17);
      drawStatIcon(ic, t.icon);
      const vt = this.add.text(x, top + 44, t.value, { fontFamily: FONT, fontSize: '34px', color: t.hot ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
      fitText(vt, tw - 22);
      this.add.text(x, top + 70, t.label, { fontFamily: FONT, fontSize: '12px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(2);
      const stt = this.add.text(x, top + 88, t.sub, { fontFamily: FONT, fontSize: '12px', color: t.hot ? '#1a1200' : '#ffffff' }).setOrigin(0.5);
      fitText(stt, tw - 34);
      const pw = Math.min(tw - 24, stt.displayWidth + 18);
      this.add.graphics().fillStyle(t.hot ? GOLD : t.accent, t.hot ? 1 : 0.35).fillRoundedRect(x - pw / 2, top + 80, pw, 17, 8.5);
      this.children.bringToTop(stt);
    });

    // ---- recompensa semanal estimada (13-11-2026, rediseño): cinta de título arriba, cofre en medallón con rayos de luz,
    // progreso con un punto por partida y el premio en fichas que se ajustan a su contenido (antes el cuadro tenía un ancho
    // fijo y la moneda o el rayo se salían)
    const rw = CW;
    const hasReward0 = this.textures.exists(LIGA_ART.reward.key);
    // alto de la CAJA del panel-recompensa según su proporción; sin la imagen, 132 px. Se coloca por su dibujo visible bajo las cards.
    // (21-11-2026, revisión) recorte exacto del panel (sin padding): todo lo de encima se ubica en px de panel-recompensa.png
    const RP = LIGA_PIECES.reward;
    const rh = hasReward0 ? (rw * RP[3]) / RP[2] : 132;
    const rPadTop = 0;
    const rPadBot = 0;
    /** px de la imagen → pantalla (x / y), relativo al recorte del panel */
    const rX = (px: number) => W / 2 - rw / 2 + ((px - RP[0]) / RP[2]) * rw;
    const rewardVisTop = cardsVisBot + 8; // (21-11-2026, usuario) más arriba
    const ry = rewardVisTop - rh * rPadTop + rh / 2;
    const rewardVisBot = rewardVisTop + rh * (1 - rPadTop - rPadBot); // dónde termina el dibujo de la recompensa
    const rx0 = W / 2 - rw / 2;
    const rTop = ry - rh / 2;
    const elig = v.estimate.eligible;
    const goldLine = elig ? GOLD : 0x8a7130;
    const hasReward = hasReward0;
    const rg = this.add.graphics();
    const ribbonH = 32;
    // banda del DIBUJO visible del panel (con imagen) o la caja entera (sin ella). Todo el texto se ancla a esta banda.
    const panVisTop = hasReward ? rewardVisTop : rTop;
    const panVisBot = hasReward ? rewardVisBot : rTop + rh;
    const panVisH = panVisBot - panVisTop;
    if (hasReward) {
      // (21-11-2026, mockup) fondo panel-recompensa.webp (barra dorada con el cofre a la izquierda y el recuadro del premio a la derecha)
      this.piece(LIGA_ART.reward, 'reward', RP, W / 2 - rw / 2, rewardVisTop, rw);
    } else {
      rg.fillStyle(0x000000, 0.35).fillRoundedRect(rx0 + 3, rTop + 6, rw, rh, 20);
      rg.fillStyle(0x1d1708, 0.97).fillRoundedRect(rx0, rTop, rw, rh, 20);
      rg.fillStyle(elig ? 0xb37400 : 0x5a4512, 1).fillRoundedRect(rx0, rTop, rw, ribbonH, { tl: 20, tr: 20, bl: 0, br: 0 });
      rg.lineStyle(3, goldLine, 1).strokeRoundedRect(rx0, rTop, rw, rh, 20);
      rg.lineStyle(2, goldLine, 0.8).lineBetween(rx0 + 2, rTop + ribbonH, rx0 + rw - 2, rTop + ribbonH);
    }
    // (21-11-2026, usuario) COFRE SEMANAL dentro del círculo oscuro del panel (el arte ya no trae cofre): centro (273, 334) y radio interior ~150 en px del
    // arte; el cofre mide el 80 % del diámetro. Lista para cobrar: vibra (±4° y ±2,5 px, 3 ciclos de 60 ms por lado) y pausa de 1,5 s; si no, quieto a 0.75.
    if (hasReward) {
      const chestSize = 300 * 0.8 * (rw / RP[2]);
      const ccx = rX(273);
      const ccy = panVisTop + ((334 - RP[1]) / RP[3]) * rh;
      let chestObj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      if (this.textures.exists('liga-chest-week')) chestObj = this.add.image(ccx, ccy, 'liga-chest-week').setDisplaySize(chestSize, chestSize);
      else {
        chestObj = this.add.graphics({ x: ccx, y: ccy + 2 });
        drawChestIcon(chestObj, 24, 0, 0);
        chestObj.setScale(chestSize / 56);
      }
      if (!elig) chestObj.setAlpha(0.75);
      else {
        const steps: { angle?: number; x: number; duration: number }[] = [];
        for (let k = 0; k < 6; k++) steps.push({ angle: k % 2 ? 4 : -4, x: ccx + (k % 2 ? 2.5 : -2.5), duration: 60 });
        steps.push({ angle: 0, x: ccx, duration: 60 });
        steps.push({ x: ccx, duration: 1500 }); // pausa
        this.tweens.chain({ targets: chestObj, tweens: steps, loop: -1 });
      }
    }
    // la franja del título va en la parte alta del dibujo
    // con imagen: el título en la franja de arriba (tras el círculo del cofre, y 192 px) y el estado en la etiqueta amarilla (x 1560..1900, y 187)
    const rYp = (py: number) => panVisTop + ((py - RP[1]) / RP[3]) * rh;
    const titleY = hasReward ? rYp(189) : rTop + ribbonH / 2;
    const weeklyTitle = this.add.text(hasReward ? rX(470) : rx0 + 24, titleY, `RECOMPENSA SEMANAL · ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#4a2c00', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(1);
    const stTxt = hasReward
      ? this.add.text(rX(1746), rYp(184), elig ? '¡LISTA!' : 'EN CURSO', { fontFamily: FONT, fontSize: '16px', color: '#4a2600', stroke: '#fff1b8', strokeThickness: 2 }).setOrigin(0.5).setLetterSpacing(1)
      : this.add.text(rx0 + rw - 22, titleY, elig ? '¡LISTA!' : 'EN CURSO', { fontFamily: FONT, fontSize: '14px', color: elig ? '#fff4b0' : '#5a3200', stroke: elig ? '#4a2c00' : '#ffe9a8', strokeThickness: 3 }).setOrigin(1, 0.5).setLetterSpacing(1);
    if (hasReward) fitText(stTxt, rX(1890) - rX(1595));
    fitText(weeklyTitle, hasReward ? rX(1568) - rX(470) : rw - 56 - stTxt.width);

    // cuerpo: cofre (izquierda) · texto y progreso (centro) · premio (derecha). Con imagen, el cofre y el recuadro del premio YA vienen en el arte,
    // así que el texto va en la banda central y el premio dentro del recuadro de la derecha. `bodyY` un pelo bajo el título.
    const bodyY = hasReward ? panVisTop + panVisH * 0.62 : rTop + ribbonH + (rh - ribbonH) / 2;
    const cx0 = rx0 + 52;
    // bandas horizontales (fracción del ancho de la caja ≈ dibujo): cofre 0..0.22 · texto 0.24..0.66 · premio 0.68..0.97
    const contentX = hasReward ? rX(480) : cx0 + 46;
    const prizeBandCx = hasReward ? rX(1681) : rx0 + rw * 0.835; // centro del recuadro del premio del arte (x 1450..1870)
    // el cofre y los rayos solo se dibujan si NO hay imagen (el arte ya trae su cofre)
    if (!hasReward) {
      if (elig) {
        const rays = this.add.graphics({ x: cx0, y: bodyY });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          rays.fillStyle(GOLD, 0.22).fillTriangle(0, 0, Math.cos(a - 0.16) * 46, Math.sin(a - 0.16) * 46, Math.cos(a + 0.16) * 46, Math.sin(a + 0.16) * 46);
        }
        this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
      }
      const med = this.add.graphics({ x: cx0, y: bodyY });
      med.fillStyle(0x07152f, 1).fillCircle(0, 0, 33);
      med.fillStyle(elig ? 0x5a3a00 : 0x2c2410, 1).fillCircle(0, 0, 30);
      med.lineStyle(2.5, goldLine, 1).strokeCircle(0, 0, 30);
      const chest = this.add.graphics({ x: cx0, y: bodyY + 2 });
      drawChestIcon(chest, 24, 0, 0);
      if (!elig) chest.setAlpha(0.75);
      if (elig) this.tweens.add({ targets: chest, angle: { from: -3, to: 3 }, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1800 });
    }

    // premio: fichas [icono + cifra] medidas antes de dibujar; el cuadro se ajusta a ellas (nada se sale)
    const items: { kind: 'coin' | 'cash' | 'rays'; text: string; color: string }[] = [{ kind: 'coin', text: fmtCoins(v.estimate.coins), color: '#ffd23f' }];
    if (v.estimate.cash > 0) items.push({ kind: 'cash', text: `${v.estimate.cash}`, color: '#9fe8a0' });
    if (v.estimate.rays > 0) items.push({ kind: 'rays', text: `+${v.estimate.rays}`, color: '#66e8ff' });
    const maxPrizeW = hasReward ? rX(1878) - rX(1485) : rw * 0.46; // con imagen: lo que cabe dentro del recuadro
    let fs = 22;
    // (21-11-2026, usuario) con imagen, fichas compactas (menos relleno) y la cifra puede achicarse más: moneda y rayo caben en el recuadro
    const PADL = hasReward ? 2 : 10;
    const PADR = hasReward ? 4 : 10;
    const chipOf = (it: (typeof items)[number], size: number) => {
      const tt = this.add.text(0, 0, it.text, { fontFamily: FONT, fontSize: `${size}px`, color: elig ? it.color : '#a99a6c', stroke: '#1a1000', strokeThickness: hasReward ? 3 : 0 }).setOrigin(0, 0.5);
      return { it, tt, w: PADL + 22 + 5 + tt.width + PADR };
    };
    let chips = items.map((it) => chipOf(it, fs));
    const totalW = () => chips.reduce((s, c) => s + c.w, 0) + (chips.length - 1) * 6 + (hasReward ? 0 : 12);
    while (totalW() > maxPrizeW && fs > (hasReward ? 12 : 15)) {
      chips.forEach((c) => c.tt.destroy());
      fs -= 1;
      chips = items.map((it) => chipOf(it, fs));
    }
    const prizeW = totalW();
    // con imagen: centrado en el recuadro del premio del arte; sin ella, pegado al borde derecho
    const prizeX = hasReward ? prizeBandCx - prizeW / 2 : rx0 + rw - 12 - prizeW;
    const prizeH = 50;
    if (!hasReward) {
      rg.fillStyle(0x080f27, 0.95).fillRoundedRect(prizeX, bodyY - prizeH / 2, prizeW, prizeH, 16);
      rg.lineStyle(2, goldLine, 0.9).strokeRoundedRect(prizeX, bodyY - prizeH / 2, prizeW, prizeH, 16);
    }
    // "PREMIO ESTIMADO" solo sin imagen (el arte ya lo trae); con imagen, el texto del label iría sobre el del arte
    // "PREMIO ESTIMADO": sobre el recuadro (con imagen, en y 292 px, que el arte deja libre)
    if (hasReward) this.add.text(prizeBandCx, rYp(289), 'PREMIO ESTIMADO', { fontFamily: FONT, fontSize: '13px', color: '#ffe9a8', stroke: '#2a1500', strokeThickness: 3 }).setOrigin(0.5).setLetterSpacing(1);
    else this.add.text(prizeX + prizeW / 2, bodyY - prizeH / 2 - 9, 'PREMIO ESTIMADO', { fontFamily: FONT, fontSize: '11px', color: '#c9b98a' }).setOrigin(0.5).setLetterSpacing(1);
    // la ficha del premio va centrada en el recuadro del arte (y 330..460 px)
    const prizeY = hasReward ? rYp(391) : bodyY;
    let cxp = prizeX + (hasReward ? 0 : 6);
    for (const c of chips) {
      if (!hasReward) rg.fillStyle(elig ? 0x2a1c00 : 0x1e1a10, 1).fillRoundedRect(cxp, prizeY - 17, c.w, 34, 12);
      // (17-11-2026) moneda: imagen moneda-1.webp
      let ic: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      if (c.it.kind === 'coin') ic = coinOf(this, cxp + PADL + 11, prizeY, 11);
      else {
        const icg = this.add.graphics({ x: cxp + PADL + 11, y: prizeY });
        if (c.it.kind === 'cash') drawCashIcon(icg, 0.55);
        else icg.fillStyle(0x46dfff, 1).fillPoints([{ x: 2, y: -11 }, { x: 10, y: -11 }, { x: 5, y: -2 }, { x: 11, y: -2 }, { x: -1, y: 12 }, { x: 3, y: 2 }, { x: -3, y: 2 }], true);
        ic = icg;
      }
      if (!elig) ic.setAlpha(0.55);
      c.tt.setPosition(cxp + PADL + 22 + 5, prizeY);
      this.children.bringToTop(c.tt);
      cxp += c.w + 6;
    }

    // texto y progreso: un punto por partida, unidos por una línea; los completados con ✓. Con imagen arrancan en la banda central (tras el cofre).
    const tx = contentX;
    const textW = Math.max(80, (hasReward ? rX(1383) : prizeX) - tx - 14); // con imagen: hasta la línea separadora (x 1380)
    const left = v.minWins - v.weekWins;
    const estSub = elig ? `¡Meta cumplida! Se cobra el domingo${v.estimate.label ? ` · ${v.estimate.label}` : ''}` : `Gana ${left} partida${left === 1 ? '' : 's'} más y se cobra el domingo`;
    // con imagen: el texto en la banda alta del dibujo y los pasos en la baja; sin ella, como antes (±18 de bodyY)
    const estY = hasReward ? rYp(297) : bodyY - 18;
    const est = this.add.text(tx, estY, estSub, { fontFamily: FONT, fontSize: hasReward ? '16px' : '14px', color: '#f2e7c1', stroke: '#2a1c00', strokeThickness: 3 }).setOrigin(0, 0.5);
    fitText(est, textW);
    const segments = Math.max(1, v.minWins);
    // (21-11-2026, usuario) con imagen, los pasos más grandes y separados (sin salirse: el tramo se limita al ancho del texto)
    const dotR = hasReward ? 15 : 11;
    const pgY = hasReward ? rYp(407) : bodyY + 18;
    const span = Math.max(0, Math.min(textW - dotR * 2 - 60, (segments - 1) * (hasReward ? 78 : 40)));
    const step = segments > 1 ? span / (segments - 1) : 0;
    const pg = this.add.graphics();
    const lw5 = hasReward ? 6 : 4;
    pg.lineStyle(lw5, 0x39404c, 1).lineBetween(tx + dotR, pgY, tx + dotR + span, pgY);
    const done = Math.min(v.weekWins, segments);
    if (done > 1) pg.lineStyle(lw5, 0x52e432, 1).lineBetween(tx + dotR, pgY, tx + dotR + step * (done - 1), pgY);
    for (let i = 0; i < segments; i++) {
      const dx = tx + dotR + i * step;
      const ok = i < v.weekWins;
      pg.fillStyle(0x07152f, 1).fillCircle(dx, pgY, dotR + 2);
      pg.fillStyle(ok ? 0x52e432 : 0x39404c, 1).fillCircle(dx, pgY, dotR);
      if (ok) { const k = dotR / 11; pg.lineStyle(3 * k, 0xffffff, 1).beginPath().moveTo(dx - 5 * k, pgY).lineTo(dx - 1 * k, pgY + 4 * k).lineTo(dx + 5 * k, pgY - 4 * k).strokePath(); }
      else this.add.text(dx, pgY, `${i + 1}`, { fontFamily: FONT, fontSize: hasReward ? '16px' : '12px', color: '#c3cad6' }).setOrigin(0.5);
    }
    this.add.text(tx + dotR * 2 + span + 10, pgY, `${Math.min(v.weekWins, v.minWins)}/${v.minWins}`, { fontFamily: FONT, fontSize: hasReward ? '19px' : '14px', color: '#ffffff', stroke: '#1a1000', strokeThickness: hasReward ? 3 : 0 }).setOrigin(0, 0.5);

    // ---- líderes de la liga: podio, puestos siguientes y tabla completa
    // panel: la etiqueta del título va montada sobre su borde de arriba (centro en `panelTop`)
    const TAG_H = 34;
    // ---- (19-11-2026, usuario) ÚLTIMAS PARTIDAS y PREMIOS EXTRA: dos botones chicos (abren su diálogo) entre la recompensa
    // semanal y los líderes. El MODO RIESGO x2 ya no está aquí: vive en el menú principal.
    // (la LIGA 2V2 aún no guarda historial ni premios extra: sin esos dos botones)
    // los botones se colocan por su dibujo visible desde rewardVisBot + GAP; quickButtons devuelve el alto del DIBUJO (no la caja)
    // (21-11-2026, usuario) los LÍDERES van justo tras la recompensa; ÚLTIMAS PARTIDAS / PREMIOS EXTRA, DESPUÉS de los líderes
    const panelTop = rewardVisBot + GAP + TAG_H / 2;
    const podiumW = CW;
    const podiumPanel = this.add.graphics();
    // LÍDERES (13-11-2026, estilo de la referencia): top 3 en cards pegadas (el 1.º al centro y más alto), insignia
    // cuadrada con el número, y debajo filas del 4.º, 5.º y la tuya (seleccionada)
    const colGap = 8;
    const colW = (podiumW - 32 - colGap * 2) / 3;
    const podCardH = 138;
    const podiumTop = panelTop + TAG_H / 2 + 24;
    // (21-11-2026, revisión) con imagen, el podio son los 3 recortes (pod0·pod1·pod2) lado a lado a todo el ancho interior del panel,
    // a su tamaño relativo real (antes salían chicos y recortados con máscaras)
    const hasPodiumArt = this.textures.exists(LIGA_ART.pod0.key) && this.textures.exists(LIGA_ART.pod1.key) && this.textures.exists(LIGA_ART.pod2.key);
    const podInnerW = podiumW - 100; // (21-11-2026, usuario) el podio un poco más chico, centrado
    const podS = podInnerW / (LIGA_PIECES.pod2[0] + LIGA_PIECES.pod2[2] - LIGA_PIECES.pod0[0]);
    const podiumBottom = hasPodiumArt ? podiumTop + LIGA_PIECES.pod1[3] * podS : podiumTop + podCardH + 26; // el 1.º sobresale ~22 px hacia arriba
    const rowH3 = 48;
    const rowGap3 = 8;
    const rowsTop = podiumBottom + 16;
    const top100Y = rowsTop + 3 * rowH3 + 2 * rowGap3 + 18 + 24;
    const leadersH = top100Y + 24 + 18 - panelTop;
    podiumPanel.fillStyle(0x061433, 0.94).fillRoundedRect(W / 2 - podiumW / 2, panelTop, podiumW, leadersH, 24);
    podiumPanel.lineStyle(10, NEON, 0.16).strokeRoundedRect(W / 2 - podiumW / 2, panelTop, podiumW, leadersH, 24);
    podiumPanel.lineStyle(3, 0x1754ad, 0.98).strokeRoundedRect(W / 2 - podiumW / 2, panelTop, podiumW, leadersH, 24);
    // (21-11-2026, mockup) título "LÍDERES DE LA LIGA": placa titulo-lideres.webp (trofeo + laureles) con el texto encima; sin ella, la etiqueta dibujada
    if (this.textures.exists(LIGA_ART.leaders.key)) {
      // (21-11-2026, revisión) recorte exacto. (usuario) el texto más centrado en la placa (placa x 325..1675, centro 1000): va en 1080,
      // lo más al centro posible sin pisar la copa (que termina en x≈670)
      const LP = LIGA_PIECES.leaders;
      const lw = Math.min(W - 40, 450); // (21-11-2026, usuario) placa más chica (gana alto)
      const lh = (lw * LP[3]) / LP[2];
      // (21-11-2026, usuario) la placa 10 px más abajo, sin mover el panel
      const P = this.piece(LIGA_ART.leaders, 'leaders', LP, W / 2 - lw / 2, panelTop - lh / 2 + 10, lw)!;
      const ct = this.add.text(P.X(1080), P.Y(322), 'LÍDERES DE LA LIGA', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#2a1550', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(0.5);
      fitText(ct, 2 * (1080 - 680) * P.s);
      this.children.bringToTop(ct);
    } else {
      const classificationTitle = this.add.text(0, panelTop, 'LÍDERES DE LA LIGA', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0, 0.5).setLetterSpacing(0.3);
      const tagW = Math.min(W - 56, 22 + 10 + classificationTitle.width + 36);
      const tagX = W / 2 - tagW / 2;
      const weeklyTag = this.add.graphics();
      weeklyTag.fillStyle(0x061b42, 1).fillRoundedRect(tagX, panelTop - TAG_H / 2, tagW, TAG_H, TAG_H / 2);
      weeklyTag.lineStyle(2, NEON, 1).strokeRoundedRect(tagX, panelTop - TAG_H / 2, tagW, TAG_H, TAG_H / 2);
      const trophy = this.add.graphics({ x: tagX + 18 + 11, y: panelTop });
      trophy.fillStyle(GOLD, 1);
      drawStatIcon(trophy, 'trophy');
      classificationTitle.setX(tagX + 18 + 22 + 10);
      this.children.bringToTop(classificationTitle);
    }
    const topThree = v.board.slice(0, 3);
    const medalColors = [GOLD, 0xc0c8d8, 0xd88a4a];
    const slotOf = [1, 0, 2]; // columna de cada puesto: 1.º al centro, 2.º a la izquierda, 3.º a la derecha
    // avatar dibujado (círculo del color del jugador con silueta), con aro del color indicado
    const drawAvatar = (x: number, y: number, r: number, e: BoardEntry, ring: number) => {
      const av = this.add.graphics({ x, y });
      av.fillStyle(0x07152f, 1).fillCircle(0, 0, r + 4);
      av.fillStyle(ring, 1).fillCircle(0, 0, r + 2);
      av.fillStyle(e.avatar.color, 1).fillCircle(0, 0, r - 1);
      av.fillStyle(0x0a1638, 0.85).fillCircle(0, -r * 0.2, r * 0.32);
      av.fillRoundedRect(-r * 0.5, r * 0.18, r, r * 0.45, { tl: r * 0.4, tr: r * 0.4, bl: 2, br: 2 });
      return av;
    };
    // insignia cuadrada con el número (estilo de la referencia)
    const numBadge = (x: number, y: number, s: number, n: number, fill: number, txt = '#07152f') => {
      const b = this.add.graphics();
      b.fillStyle(0x07152f, 1).fillRoundedRect(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4, 7);
      b.fillStyle(fill, 1).fillRoundedRect(x - s / 2, y - s / 2, s, s, 6);
      b.fillStyle(0xffffff, 0.3).fillRoundedRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s * 0.3, 4);
      this.add.text(x, y + 1, `${n}`, { fontFamily: FONT, fontSize: `${Math.round(s * 0.62)}px`, color: txt }).setOrigin(0.5);
    };
    // TOP 3: tres cards pegadas; la del 1.º más alta (sobresale hacia arriba), las tres con la base alineada.
    // (21-11-2026, mockup) el fondo de cada card sale de podio-liga.webp (hoja 2·1·3); el avatar va en su círculo oscuro, nombre y monedas debajo.
    topThree.forEach((entry, i) => {
      const slot = slotOf[i]; // 0 izquierda (2.º) · 1 centro (1.º) · 2 derecha (3.º)
      const x = W / 2 + (slot - 1) * (colW + colGap);
      const ch = i === 0 ? podCardH + 22 : podCardH;
      const top = podiumBottom - ch;
      const me = entry.id === 'me';
      const color = medalColors[i];
      let ay = top + (i === 0 ? 80 : 70);
      const r = i === 0 ? 26 : 22;
      if (hasPodiumArt) {
        // recorte exacto de la card de esa columna (hoja 2·1·3 = izq·centro·der); avatar en su círculo, nombre y monedas bajo él (px de podio-liga.png)
        const pr = [LIGA_PIECES.pod0, LIGA_PIECES.pod1, LIGA_PIECES.pod2][slot];
        const L0 = W / 2 - podInnerW / 2;
        const P = this.piece([LIGA_ART.pod0, LIGA_ART.pod1, LIGA_ART.pod2][slot], `pod${slot}`, pr, L0 + (pr[0] - LIGA_PIECES.pod0[0]) * podS, podiumTop, pr[2] * podS)!;
        const circ = [{ x: 310, y: 527, r: 115 }, { x: 886, y: 500, r: 145 }, { x: 1463, y: 527, r: 115 }][slot];
        const cxA = P.X(circ.x);
        // (21-11-2026, usuario) sin avatar ni fila de monedas abajo: las MONEDAS van DENTRO del círculo (moneda arriba, cifra debajo)
        // y el nombre, bajo el círculo, centrado en lo que queda de la card
        const nameY = P.Y(slot === 1 ? 712 : 704);
        const cardInnerW = (pr[2] - 80) * podS;
        if (me) {
          const halo = this.add.graphics();
          halo.lineStyle(5, GOLD, 0.5).strokeRoundedRect(P.X(pr[0] + 20), P.Y(slot === 1 ? 245 : 330), (pr[2] - 40) * podS, (slot === 1 ? 535 : 435) * podS, 14);
          this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        const cr = circ.r * podS; // radio del círculo oscuro en pantalla
        const ccy = P.Y(circ.y);
        coinOf(this, cxA, ccy - cr * 0.34, Math.max(7, cr * 0.3));
        const coins = this.add.text(cxA, ccy + cr * 0.3, fmtCoins(entry.coins), { fontFamily: FONT, fontSize: slot === 1 ? '22px' : '19px', color: '#ffe066', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
        fitText(coins, cr * 1.6);
        const nm = this.add.text(cxA, nameY, me ? 'TÚ' : entry.name, { fontFamily: FONT, fontSize: slot === 1 ? '20px' : '18px', color: me ? '#ffe066' : '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
        fitText(nm, cardInnerW);
        return;
      }
      // --- respaldo dibujado
      const cg = this.add.graphics();
      cg.fillStyle(0x000000, 0.3).fillRoundedRect(x - colW / 2 + 2, top + 4, colW, ch, 14);
      cg.fillStyle(i === 0 ? 0x162a5c : 0x10224b, 1).fillRoundedRect(x - colW / 2, top, colW, ch, 14);
      cg.fillStyle(color, 0.1).fillRoundedRect(x - colW / 2, top, colW, ch * 0.45, { tl: 14, tr: 14, bl: 0, br: 0 });
      cg.lineStyle(me ? 3 : 2, me ? GOLD : i === 0 ? GOLD : 0x2a4a8a, me || i === 0 ? 1 : 0.9).strokeRoundedRect(x - colW / 2, top, colW, ch, 14);
      numBadge(x, top + 26, i === 0 ? 34 : 28, i + 1, color);
      if (i === 0) {
        const rays = this.add.graphics({ x, y: ay }).setBlendMode(Phaser.BlendModes.ADD);
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const len = k % 2 ? 44 : 54;
          rays.fillStyle(GOLD, k % 2 ? 0.16 : 0.28).fillTriangle(0, 0, Math.cos(a - 0.1) * len, Math.sin(a - 0.1) * len, Math.cos(a + 0.1) * len, Math.sin(a + 0.1) * len);
        }
        this.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
        this.tweens.add({ targets: rays, alpha: { from: 1, to: 0.55 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      drawAvatar(x, ay, r, entry, color);
      const nm = this.add.text(x, podiumBottom - 40, me ? 'TÚ' : entry.name, { fontFamily: FONT, fontSize: i === 0 ? '18px' : '16px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0.5);
      fitText(nm, colW - 12);
      const coins = this.add.text(0, podiumBottom - 18, fmtCoins(entry.coins), { fontFamily: FONT, fontSize: i === 0 ? '20px' : '17px', color: '#ffd23f' }).setOrigin(0, 0.5);
      const coinsW = coins.width + 24;
      coinOf(this, x - coinsW / 2 + 9, podiumBottom - 18, 8);
      coins.setX(x - coinsW / 2 + 22);
    });
    // FILAS: 4.º, 5.º y la tuya (seleccionada). Si estás en el top 5, la 6.ª; si estás en el top 3, tu card ya se resalta
    const meEntry = v.board.find((e) => e.id === 'me');
    const rowsList: BoardEntry[] = [v.board[3], v.board[4]].filter((e): e is BoardEntry => !!e);
    if (meEntry && meEntry.position > 5) rowsList.push(meEntry);
    else if (v.board[5]) rowsList.push(v.board[5]);
    const rw3 = colW * 3 + colGap * 2;
    rowsList.forEach((entry, k) => {
      const yy = rowsTop + k * (rowH3 + rowGap3) + rowH3 / 2;
      const me = entry.id === 'me';
      const L = W / 2 - rw3 / 2;
      const rgx = this.add.graphics();
      if (me) {
        // SELECCIONADA: halo dorado que respira
        const halo = this.add.graphics();
        halo.lineStyle(8, GOLD, 0.3).strokeRoundedRect(L - 2, yy - rowH3 / 2 - 2, rw3 + 4, rowH3 + 4, 14);
        this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      rgx.fillStyle(me ? 0x3a2a08 : 0x10224b, 1).fillRoundedRect(L, yy - rowH3 / 2, rw3, rowH3, 12);
      rgx.lineStyle(me ? 2.5 : 1.5, me ? GOLD : 0x2a4a8a, 1).strokeRoundedRect(L, yy - rowH3 / 2, rw3, rowH3, 12);
      const bs = rowH3 - 12;
      numBadge(L + 8 + bs / 2, yy, bs, entry.position, me ? GOLD : NEON, me ? '#07152f' : '#ffffff');
      drawAvatar(L + 8 + bs + 12 + 17, yy, 15, entry, me ? GOLD : 0x2a4a8a);
      const nx = L + 8 + bs + 12 + 34 + 12;
      const nm = this.add.text(nx, yy, me ? `${entry.name} (TÚ)` : entry.name, { fontFamily: FONT, fontSize: '17px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
      fitText(nm, rw3 * 0.5);
      const ct = this.add.text(L + rw3 - 14, yy, fmtCoins(entry.coins), { fontFamily: FONT, fontSize: '19px', color: '#ffd23f' }).setOrigin(1, 0.5);
      coinOf(this, L + rw3 - 14 - ct.width - 13, yy, 9); // (17-11-2026) moneda: imagen moneda-1.webp
    });
    // (21-11-2026, mockup) VER TOP 100: botón btn-top100.webp (con las flechas a los lados) y el texto encima; sin él, el botón de antes
    if (this.textures.exists(LIGA_ART.top100.key)) {
      // (21-11-2026, revisión) recorte exacto; el texto centrado en el cuerpo del botón (y 330 px de la imagen)
      const TP = LIGA_PIECES.top100;
      const tw100 = Math.min(470, W - 60); // (21-11-2026, usuario) un poco más chico (antes 560)
      const th100 = (tw100 * TP[3]) / TP[2];
      const P = this.piece(LIGA_ART.top100, 'top100', TP, W / 2 - tw100 / 2, top100Y - th100 / 2, tw100)!;
      const t100 = this.add.text(W / 2, P.Y(322), 'VER TOP 100', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a2a66', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2);
      fitText(t100, (1700 - 300) * P.s);
      const z = this.add.zone(W / 2, top100Y, tw100 * 0.7, th100 * 0.7).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => !this.overlay.length && this.leaderboard());
    } else arcadeButton(this, W / 2, top100Y, Math.min(480, W - 80), 46, 'VER TOP 100', () => this.leaderboard(), { palette: 'blue' });

    // (21-11-2026, usuario) ÚLTIMAS PARTIDAS / PREMIOS EXTRA DESPUÉS de los líderes (fuera del panel), con GAP bajo él
    const leadersBottom = panelTop + leadersH;
    const quickVisH = is2 ? 0 : this.quickButtons(v as RankedView, W / 2, leadersBottom + GAP, rw);

    const contentObjects = this.children.list.slice(contentStart);
    this.add.container(0, 0, contentObjects);
    const contentBottom = leadersBottom + (is2 ? 0 : GAP + quickVisH);
    // (21-11-2026, usuario) sin la barra de navegación de abajo (LIGA · INICIO · EVENTOS): se vuelve con la flecha de arriba
    this.maxScrollY = Math.max(0, contentBottom - H + 32);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScrollY);
    this.cameras.main.setBounds(0, 0, W, H + this.maxScrollY);
    this.cameras.main.setScroll(0, this.scrollY);
  }

  /**
   * (19-11-2026, usuario) Dos botones CHICOS lado a lado: ÚLTIMAS PARTIDAS (reloj, con los últimos resultados en puntitos) y
   * PREMIOS EXTRA (regalo). Cada uno abre su diálogo (historyOverlay / extraRewardsOverlay). Reemplazan a las dos tarjetas
   * grandes del final y a la tarjeta del MODO RIESGO. Devuelve el alto de la fila.
   */
  /** `top` = borde SUPERIOR del dibujo visible de los botones. Devuelve el alto del DIBUJO visible (no la caja), para encadenar. */
  private quickButtons(v: RankedView, cx: number, top: number, w: number): number {
    const gap = 12;
    const bw = (w - gap) / 2; // (21-11-2026, usuario) entre los dos, el ancho de las demás secciones
    const hasImg = this.textures.exists(LIGA_ART.buttons.key);
    // la hoja tiene 2 botones; el alto de la CAJA de cada botón = bw / (ar/2). El dibujo visible es más bajo (pad arriba/abajo).
    // (21-11-2026, revisión) cada botón es un recorte exacto (btn0/btn1): su alto sale de su proporción, sin padding
    const boxH = hasImg ? (bw * LIGA_PIECES.btn0[3]) / LIGA_PIECES.btn0[2] : 54;
    const padT = 0;
    const padB = 0;
    const visH = boxH * (1 - padT - padB);
    const cy = top - boxH * padT + boxH / 2; // centro de la caja, para que su dibujo arranque en `top`
    const recent = v.history.slice(0, 5);
    this.quickButton(cx - bw / 2 - gap / 2, cy, bw, boxH, 'history', 'ÚLTIMAS PARTIDAS', 0x168bff, 0x061433, recent.map((m) => m.outcome === 'win'), () => this.historyOverlay(), 0);
    this.quickButton(cx + bw / 2 + gap / 2, cy, bw, boxH, 'gift', 'PREMIOS EXTRA', 0xf0b91f, 0x211704, null, () => this.extraRewardsOverlay(), 1);
    return visH;
  }

  /** Botón chico: ícono a la izquierda, título y (en el historial) los últimos resultados como puntitos verde / rojo. `frame` = mitad de botones-liga.webp (0/1); -1 = dibujado. */
  private quickButton(x: number, y: number, w: number, h: number, icon: 'history' | 'gift', label: string, line: number, fill: number, dots: boolean[] | null, onTap: () => void, frame = -1) {
    const holder = this.add.container(x, y);
    const inner = this.add.container(0, 0);
    holder.add(inner);
    const hasImg = frame >= 0 && this.textures.exists(LIGA_ART.buttons.key);
    const drawIcon = !hasImg; // el arte ya trae su ícono (reloj / regalo)
    if (hasImg) {
      // recorte exacto del botón (azul o morado), centrado en el contenedor
      const pr = frame === 0 ? LIGA_PIECES.btn0 : LIGA_PIECES.btn1;
      const P = this.piece(LIGA_ART.buttons, `btn${frame}`, pr, -w / 2, -h / 2, w)!;
      inner.add(P.img);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 16);
      g.fillStyle(fill, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      g.fillStyle(0xffffff, 0.06).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.42, 13);
      g.lineStyle(6, line, 0.14).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
      g.lineStyle(2.5, line, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
      inner.add(g);
    }
    const ix = -w / 2 + 28;
    if (drawIcon) {
      const ic = this.add.graphics({ x: ix, y: 0 });
      if (icon === 'history') {
        ic.lineStyle(3, 0x45d9ff, 1).strokeCircle(0, 0, 13);
        ic.lineStyle(3, 0x45d9ff, 1).beginPath().moveTo(0, -8).lineTo(0, 0).lineTo(7, 4).strokePath();
      } else drawGiftIcon(ic, 17);
      inner.add(ic);
    }
    // con imagen: el texto tras el ícono del arte (x 300 px de 957) hasta casi el borde derecho
    const tx = hasImg ? -w / 2 + w * (300 / 957) : ix + 24;
    const maxW = hasImg ? w * (560 / 957) : w / 2 + w * 0.3 - tx;
    const hasDots = !!dots && dots.length > 0;
    const t = this.add.text(tx, hasDots ? -9 : 0, label, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0, 0.5).setLetterSpacing(0.3);
    fitText(t, maxW);
    inner.add(t);
    if (hasDots) {
      const dg = this.add.graphics();
      dots!.forEach((win, i) => {
        const dx = tx + 6 + i * 16;
        dg.fillStyle(0x07152f, 1).fillCircle(dx, 12, 7);
        dg.fillStyle(win ? 0x52e432 : 0xff5a4f, 1).fillCircle(dx, 12, 5.5);
      });
      inner.add(dg);
    }
    holder.setSize(w, h).setInteractive({ useHandCursor: true });
    let pressed = false;
    const release = (fire: boolean) => {
      if (!pressed) return;
      pressed = false;
      this.tweens.killTweensOf(inner);
      this.tweens.add({ targets: inner, scale: 1, duration: 220, ease: 'Back.easeOut', easeParams: [3], onComplete: () => fire && !this.overlay.length && onTap() });
    };
    holder.on('pointerdown', () => {
      pressed = true;
      this.tweens.killTweensOf(inner);
      this.tweens.add({ targets: inner, scale: 0.93, duration: 70, ease: 'Quad.easeOut' });
    });
    holder.on('pointerup', () => release(true));
    holder.on('pointerout', () => release(false));
    return holder;
  }

  private setupScroll() {
    const wheel = (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      if (!this.overlay.length) this.setScroll(this.scrollY + dy);
    };
    const down = (pointer: Phaser.Input.Pointer) => {
      if (this.overlay.length) return;
      const hits = this.input.hitTestPointer(pointer);
      if (hits.some((o) => o.input?.enabled)) return;
      this.dragY = pointer.y;
      this.dragScrollY = this.scrollY;
      this.dragging = false;
    };
    const move = (pointer: Phaser.Input.Pointer) => {
      if (this.dragY == null || !pointer.isDown) return;
      const dy = this.dragY - pointer.y;
      if (!this.dragging && Math.abs(dy) < 6) return;
      this.dragging = true;
      this.setScroll(this.dragScrollY + dy);
    };
    const up = () => {
      this.dragY = null;
      this.dragging = false;
    };
    this.input.on('wheel', wheel);
    this.input.on('pointerdown', down);
    this.input.on('pointermove', move);
    this.input.on('pointerup', up);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', wheel);
      this.input.off('pointerdown', down);
      this.input.off('pointermove', move);
      this.input.off('pointerup', up);
    });
  }

  private setScroll(y: number) {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScrollY);
    this.cameras.main.setScroll(0, this.scrollY);
  }

  private historyOverlay() {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.82);
    const v = rankedView();
    const pw = Math.min(600, W - 36);
    const ph = Math.min(660, H - 80);
    const p = this.add.container(W / 2, (H - ph) / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, ph / 2, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.99).fillRoundedRect(-pw / 2, 0, pw, ph, 24);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-pw / 2, 0, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, 42, 'HISTORIAL DE LIGA', { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
    p.add(this.add.text(0, 75, 'Tus últimas partidas completadas', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5));
    const entries = v.history.slice(0, 12);
    if (!entries.length) {
      p.add(this.add.text(0, 150, 'Aún no tienes partidas de Liga registradas.', { fontFamily: FONT, fontSize: '18px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 50 } }).setOrigin(0.5));
    } else {
      const rowH = Math.min(42, (ph - 180) / entries.length);
      entries.forEach((match, i) => {
        const y = 112 + i * rowH;
        const rg = this.add.graphics();
        rg.fillStyle(0x10234b, 1).fillRoundedRect(-pw / 2 + 18, y, pw - 36, rowH - 5, 12);
        p.add(rg);
        p.add(this.add.text(-pw / 2 + 34, y + (rowH - 5) / 2, match.outcome === 'win' ? 'VICTORIA' : 'DERROTA', { fontFamily: FONT, fontSize: '16px', color: match.outcome === 'win' ? '#62ef89' : '#ff8174' }).setOrigin(0, 0.5));
        p.add(this.add.text(0, y + (rowH - 5) / 2, rankDef(match.league).name.toUpperCase(), { fontFamily: FONT, fontSize: '14px', color: '#9fb4e0' }).setOrigin(0.5));
        p.add(this.add.text(pw / 2 - 34, y + (rowH - 5) / 2, `${match.delta >= 0 ? '+' : '−'}${fmtCoins(Math.abs(match.delta))}`, { fontFamily: FONT, fontSize: '18px', color: match.delta >= 0 ? '#62ef89' : '#ff8174' }).setOrigin(1, 0.5));
      });
    }
    p.add(arcadeButton(this, 0, ph - 44, Math.min(300, pw - 60), 54, 'CERRAR', () => this.closeOverlay(), { palette: 'blue' }));
  }

  private extraRewardsOverlay() {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.82);
    const pw = Math.min(600, W - 36);
    const ph = 540;
    const p = this.add.container(W / 2, (H - ph) / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, ph / 2, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x211704, 0.99).fillRoundedRect(-pw / 2, 0, pw, ph, 24);
    g.lineStyle(3, GOLD, 1).strokeRoundedRect(-pw / 2, 0, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, 42, 'PREMIOS EXTRA DE LA SEMANA', { fontFamily: FONT, fontSize: '27px', color: '#ffe15b' }).setOrigin(0.5));
    p.add(this.add.text(0, 78, 'Se suman a la recompensa de tu liga al cerrar la semana. Los bots no reciben premios.', { fontFamily: FONT, fontSize: '15px', color: '#f1dfab', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5));
    RANKED.positionPrizes.forEach((prize, i) => {
      const y = 142 + i * 70;
      const row = this.add.graphics();
      row.fillStyle(0x191405, 1).fillRoundedRect(-pw / 2 + 24, y - 26, pw - 48, 56, 16);
      row.lineStyle(2, i === 0 ? GOLD : 0x8d773b, 1).strokeRoundedRect(-pw / 2 + 24, y - 26, pw - 48, 56, 16);
      p.add(row);
      p.add(this.add.text(-pw / 2 + 48, y + 1, prize.label, { fontFamily: FONT, fontSize: '20px', color: i === 0 ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5));
      p.add(this.add.text(pw / 2 - 48, y + 1, `${fmtCoins(prize.coins)} monedas${prize.cash ? ` · ${prize.cash} dinero` : ''}`, { fontFamily: FONT, fontSize: '17px', color: '#ffe15b' }).setOrigin(1, 0.5));
    });
    p.add(this.add.text(0, 142 + RANKED.positionPrizes.length * 70 - 10, `Gana ${RANKED.minWinsForReward} partidas de Liga en la semana para optar a estos premios.`, { fontFamily: FONT, fontSize: '15px', color: '#f1dfab', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5));
    p.add(arcadeButton(this, 0, ph - 42, Math.min(300, pw - 60), 54, 'CERRAR', () => this.closeOverlay(), { palette: 'yellow' }));
  }

  // ================================================================ tabla Top 100
  /**
   * Tabla Top 100 del RANKING LIGA (neto de la semana, con bots). El Global se abre desde el menú. La ventana es ui/LeagueRanking.ts (la misma
   * que abre la card de liga del MENÚ); aquí va sobre el overlay de la pantalla (que resetea el desplazamiento y rehace la pantalla al cerrar).
   */
  private leaderboard() {
    const objs = this.openOverlay();
    objs.push(openLeagueRanking(this, { dim: false, onClose: () => this.closeOverlay(), mode: this.tab }));
  }
  // ================================================================ lista de ligas
  private leagueList() {
    const W = this.scale.width;
    const objs = this.openOverlay();
    const is2 = this.tab === '2v2';
    const v = is2 ? leagueView2v2() : rankedView();
    const pw = Math.min(620, W - 30);
    const ph = 6 * 104 + 120;
    const p = this.add.container(W / 2, this.scale.height / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, 0, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, -ph / 2 + 40, 'LIGAS', { fontFamily: FONT, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(3));
    RANKS.forEach((r, i) => {
      const y = -ph / 2 + 120 + i * 104;
      const eco = is2 ? { ...league2v2Economy(r.id), entry: 0 } : RANKED.leagues[r.id];
      const cur = r.id === v.league;
      const st = LEAGUE_STYLE[r.id];
      const rg = this.add.graphics();
      rg.fillStyle(cur ? 0x1d2d5c : 0x111c3c, 1).fillRoundedRect(-pw / 2 + 16, y - 46, pw - 32, 92, 14);
      rg.lineStyle(cur ? 3 : 2, cur ? st.color : 0x2c4a8a, 1).strokeRoundedRect(-pw / 2 + 16, y - 46, pw - 32, 92, 14);
      p.add(rg);
      p.add(new RankBadge(this, -pw / 2 + 64, y, { rank: r.id, level: 99, size: 76, doubles: is2 }));
      p.add(this.add.text(-pw / 2 + 112, y - 20, r.name.toUpperCase() + (cur ? '  · TU LIGA' : ''), { fontFamily: FONT, fontSize: '22px', color: st.css }).setOrigin(0, 0.5));
      p.add(this.add.text(-pw / 2 + 112, y + 6, eco.target != null ? `Meta semanal ${fmtCoins(eco.target)} monedas${is2 ? ' 2v2' : ''} netas` : 'Liga máxima', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0, 0.5));
      p.add(this.add.text(-pw / 2 + 112, y + 28, `${is2 ? 'Gana +30 · Pierde −15' : `Entrada ${fmtCoins(eco.entry)}`} · Semanal ${fmtCoins(eco.weekly.coins)}${eco.weekly.cash ? ` + ${eco.weekly.cash} dinero` : ''}`, { fontFamily: FONT, fontSize: '14px', color: '#7f93bf' }).setOrigin(0, 0.5));
    });
    const close = this.add.text(pw / 2 - 30, -ph / 2 + 36, '✕', { fontFamily: FONT, fontSize: '30px', color: '#9fb4e0' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.closeOverlay());
    p.add(close);
  }

  // ================================================================ avisos al entrar (uno tras otro)
  private presentQueue() {
    if (!this.scene.isActive() || this.overlay.length) return;
    const r = rankedState();
    if (r.demotion) return this.showDemotion(r.demotion.from, r.demotion.to, r.demotion.coinsCut);
    if (r.seenLeague !== r.league) return this.showPromotion(r.seenLeague, r.league);
    const w = pendingWeekly()[0];
    if (w) return this.showWeekly(w);
    // LIGA 2V2: su ascenso (con el marco 2v2 nuevo) y su recompensa semanal
    const l2 = league2v2State();
    if (l2 && l2.seenLeague !== l2.league) return this.showPromotion(l2.seenLeague, l2.league, true);
    const w2 = pendingWeekly2v2()[0];
    if (w2) return this.showWeekly(w2, true);
  }

  /** Animación de ascenso de liga. */
  private showPromotion(from: RankId, to: RankId, two = false) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.85);
    const st = LEAGUE_STYLE[to];
    const cx = W / 2;
    const cy = H * 0.42;
    const rays = this.add.graphics({ x: cx, y: cy }).setDepth(8001).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      rays.fillStyle(st.color, i % 2 ? 0.1 : 0.2).fillTriangle(0, 0, Math.cos(a) * 520, Math.sin(a) * 520, Math.cos(a + 0.16) * 520, Math.sin(a + 0.16) * 520);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
    objs.push(rays);
    const old = new RankBadge(this, cx, cy, { rank: from, level: 99, size: 180, doubles: two }).setDepth(8002);
    objs.push(old);
    const nb = new RankBadge(this, cx, cy, { rank: to, level: 99, size: 260, doubles: two }).setDepth(8003).setScale(0).setAlpha(0);
    objs.push(nb);
    const flash = this.add.circle(cx, cy, 80, 0xffffff, 0).setDepth(8004).setBlendMode(Phaser.BlendModes.ADD);
    objs.push(flash);
    this.tweens.add({ targets: old, scale: 0.6, alpha: 0, angle: -30, duration: 500, delay: 300, ease: 'Back.easeIn' });
    this.tweens.add({ targets: flash, fillAlpha: { from: 0.9, to: 0 }, scale: 6, duration: 700, delay: 760 });
    this.tweens.add({ targets: nb, scale: 1, alpha: 1, duration: 650, delay: 780, ease: 'Back.easeOut' });
    const t1 = this.add.text(cx, cy - 210, '¡ASCENSO!', { fontFamily: FONT, fontSize: '58px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5).setDepth(8005).setScale(0);
    const t2 = this.add.text(cx, cy + 180, rankDef(to).name.toUpperCase(), { fontFamily: FONT, fontSize: '48px', color: st.css, stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5).setDepth(8005).setAlpha(0).setLetterSpacing(4);
    objs.push(t1, t2);
    this.tweens.add({ targets: t1, scale: 1, duration: 420, delay: 1100, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t2, alpha: 1, y: cy + 166, duration: 420, delay: 1250 });
    this.confetti(objs, [st.color, st.light, GOLD, 0xffffff]);
    if (two) {
      const mt = this.add.text(cx, cy + 226, `¡MARCO 2V2 ${rankDef(to).name.toUpperCase()} DESBLOQUEADO!`, { fontFamily: FONT, fontSize: '22px', color: '#d9b4ff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setDepth(8005).setAlpha(0);
      fitText(mt, W - 40);
      objs.push(mt);
      this.tweens.add({ targets: mt, alpha: 1, duration: 420, delay: 1450 });
    }
    const btn = arcadeButton(this, cx, H - 120, 300, 80, 'GENIAL', () => {
      if (two) markLeague2v2Seen();
      else markRankedSeen();
      this.closeOverlay();
      this.time.delayedCall(200, () => this.presentQueue());
    }, { palette: 'yellow' }).setDepth(8006).setAlpha(0);
    objs.push(btn);
    this.tweens.add({ targets: btn, alpha: 1, duration: 300, delay: 1600 });
  }

  /** Aviso del reinicio mensual (descenso parcial). */
  private showDemotion(from: RankId, to: RankId, cut: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.85);
    const cx = W / 2;
    const p = this.add.container(cx, H * 0.45).setDepth(8001);
    objs.push(p);
    const pw = Math.min(600, W - 40);
    const ph = 560;
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, -ph / 2 + 46, 'NUEVO MES DE RANKING', { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2));
    p.add(new RankBadge(this, -120, -40, { rank: from, level: 99, size: 150 }).setAlpha(0.6));
    p.add(this.add.text(0, -40, '➜', { fontFamily: FONT, fontSize: '50px', color: '#9fb4e0' }).setOrigin(0.5));
    p.add(new RankBadge(this, 120, -40, { rank: to, level: 99, size: 150 }));
    p.add(this.add.text(0, 80, `Empiezas el mes en ${rankDef(to).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '24px', color: LEAGUE_STYLE[to].css }).setOrigin(0.5));
    const msg = cut > 0 ? `Tu saldo se ajustó (−${fmtCoins(cut)}): con una partida vuelves a subir y empiezas a mitad de liga` : 'Conservas todas tus monedas';
    const mt = this.add.text(0, 130, msg, { fontFamily: FONT, fontSize: '18px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5);
    p.add(mt);
    p.add(arcadeButton(this, 0, ph / 2 - 60, 280, 76, '¡A SUBIR!', () => {
      markRankedSeen();
      this.closeOverlay();
      this.time.delayedCall(200, () => this.presentQueue());
    }, { palette: 'yellow' }));
  }

  /** Pantalla de recompensas semanales (se cobra con el botón). */
  private showWeekly(w: WeeklyReward, two = false) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.85);
    const st = LEAGUE_STYLE[w.league];
    const cx = W / 2;
    const p = this.add.container(cx, H * 0.45).setDepth(8001);
    objs.push(p);
    const pw = Math.min(620, W - 40);
    const ph = w.eligible ? 700 : 640; // (23-11-2026) elegible: sitio para el cofre
    const g = this.add.graphics();
    g.lineStyle(12, w.eligible ? GOLD : NEON, 0.25).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    g.lineStyle(3, w.eligible ? GOLD : NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    p.add(g);
    p.add(this.add.text(0, -ph / 2 + 46, 'FIN DE TEMPORADA', { fontFamily: FONT, fontSize: '36px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
    p.add(this.add.text(0, -ph / 2 + 84, `Semana del ${w.week.split('-').reverse().join('/')}`, { fontFamily: FONT, fontSize: '17px', color: '#9fb4e0' }).setOrigin(0.5));
    const badge = new RankBadge(this, 0, -ph / 2 + 200, { rank: w.league, level: 99, size: 170, doubles: two, position: w.league === 'challenger' ? (w.position ?? undefined) : undefined });
    p.add(badge);
    this.tweens.add({ targets: badge, scale: { from: 0.7, to: 1 }, duration: 500, ease: 'Back.easeOut' });
    p.add(this.add.text(0, -ph / 2 + 306, rankDef(w.league).name.toUpperCase(), { fontFamily: FONT, fontSize: '30px', color: st.css }).setOrigin(0.5).setLetterSpacing(3));
    const sumTxt = this.add.text(0, -ph / 2 + 346, `POSICIÓN ${w.position ? `#${w.position}` : '—'}${w.positionLabel ? ` · ${w.positionLabel}` : ''} · ${w.wins} VICTORIAS · NETO ${fmtNet(w.net)}`, { fontFamily: FONT, fontSize: '18px', color: '#dbe5ff' }).setOrigin(0.5);
    fitText(sumTxt, pw - 40);
    p.add(sumTxt);
    if (w.promotedTo) p.add(this.add.text(0, -ph / 2 + 112, `¡LLEGASTE A LA META! SUBES A ${rankDef(w.promotedTo).name.toUpperCase()}${two ? ' · MARCO 2V2' : ''}`, { fontFamily: FONT, fontSize: '17px', color: '#62ef89' }).setOrigin(0.5));
    // (23-11-2026, usuario) elegible: en vez de la caja con las monedas y el Rayo, el COFRE SEMANAL (late y vibra). Tocarlo o RECLAMAR cobra y lo
    // abre en pantalla completa (showSeasonChest): sale el premio uno a uno (monedas → Rayo → dinero al azar)
    let claimNow: (() => void) | null = null;
    if (w.eligible) {
      const ccy = -ph / 2 + 462;
      const glow = this.add.circle(0, ccy, 96, GOLD, 0.22).setBlendMode(Phaser.BlendModes.ADD);
      p.add(glow);
      this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.1, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const chest = this.seasonChestArt(0, ccy, 170);
      p.add(chest);
      const steps: { angle?: number; scale?: number; duration: number }[] = [];
      for (let k = 0; k < 6; k++) steps.push({ angle: k % 2 ? 5 : -5, duration: 60 });
      steps.push({ angle: 0, scale: 1.08, duration: 160 });
      steps.push({ scale: 1, duration: 200 });
      steps.push({ angle: 0, duration: 1200 }); // pausa
      this.tweens.chain({ targets: chest, tweens: steps, loop: -1 });
      chest.setSize(170, 170).setInteractive({ useHandCursor: true });
      chest.on('pointerup', () => claimNow?.());
      const ht = this.add.text(0, ccy + 104, 'TOCA EL COFRE PARA ABRIRLO', { fontFamily: FONT, fontSize: '19px', color: '#ffe680', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(1);
      p.add(ht);
      this.tweens.add({ targets: ht, alpha: 0.5, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.confetti(objs, [GOLD, st.color, 0xffffff]);
    } else {
      const t = this.add.text(0, -ph / 2 + 428, `Necesitabas ${two ? LEAGUE_2V2.minWinsForReward : RANKED.minWinsForReward} victorias (ganaste ${w.wins}).\nSigues en tu liga: ¡esta semana sí!`, { fontFamily: FONT, fontSize: '19px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 70 } }).setOrigin(0.5);
      p.add(t);
    }
    let claimed = false;
    claimNow = () => {
      if (claimed) return;
      claimed = true;
      // se cobra AL TOCAR (idempotente): cerrar la app a mitad de la animación no pierde el premio
      const res = two ? claimWeekly2v2(w.week) : claimWeekly(w.week);
      if (res.ok && res.given) return this.showSeasonChest(w, two);
      this.closeOverlay();
      this.time.delayedCall(300, () => this.presentQueue());
    };
    p.add(arcadeButton(this, 0, ph / 2 - 62, 300, 80, w.eligible ? 'RECLAMAR' : 'ENTENDIDO', () => claimNow?.(), { palette: 'yellow' }));
  }

  /** (23-11-2026) cofre semanal (imagen, o el dibujo de respaldo) en un contenedor de `size` px. `lid`: solo la tapa / solo el cuerpo. */
  private seasonChestArt(x: number, y: number, size: number, part?: 'lid' | 'body'): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    if (this.textures.exists('liga-chest-week')) {
      const img = this.add.image(0, 0, 'liga-chest-week').setDisplaySize(size, size);
      // la tapa del arte (256 px) llega hasta y ~100
      if (part === 'lid') img.setCrop(0, 0, 256, SEASON_LID_Y);
      else if (part === 'body') img.setCrop(0, SEASON_LID_Y, 256, 256 - SEASON_LID_Y);
      c.add(img);
    } else if (part !== 'lid') {
      const g = this.add.graphics();
      drawChestIcon(g, 24, 0, 0);
      g.setScale(size / 56);
      c.add(g);
    }
    return c;
  }

  /**
   * (23-11-2026, usuario) APERTURA DEL COFRE de fin de temporada, como la ruleta: pantalla completa con rayos y destellos, el cofre entra girando
   * y rebotando; al tocar vibra cada vez más y se abre (sale la tapa y un golpe de luz); el premio sale de dentro UNO A UNO: monedas (cuenta
   * hacia arriba) → Rayo → dinero al azar (3 a 10, domain/rankedConfig.weeklyChestCash). Cada premio pasa a la fila de abajo. Ya está cobrado.
   */
  private showSeasonChest(w: WeeklyReward, two: boolean) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(1);
    const shade = objs[0];
    const alive = () => this.overlay[0] === shade;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      objs.push(o);
      return o;
    };
    const st = LEAGUE_STYLE[w.league];
    const cx = W / 2;
    const cy = H * 0.44;
    const D = 8001;
    // Fondo opaco propio del cofre, detrás de los rayos y por encima de la liga.
    const bgKey = 'season-chest-backdrop';
    if (!this.textures.exists(bgKey)) {
      const bw = 256;
      const bh = 384;
      const tex = this.textures.createCanvas(bgKey, bw, bh);
      if (tex) {
        const ctx = tex.getContext();
        const light = ctx.createRadialGradient(bw / 2, bh * 0.44, 6, bw / 2, bh * 0.44, bh * 0.65);
        light.addColorStop(0, '#244fba');
        light.addColorStop(0.45, '#152c71');
        light.addColorStop(1, '#050b23');
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, bw, bh);
        tex.refresh();
      }
    }
    if (this.textures.exists(bgKey)) {
      add(this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(D - 0.5));
    }
    // fondo: rayos que giran y destellos que suben (los de la ruleta)
    const len = Math.max(W, H);
    const rays = add(this.add.graphics({ x: cx, y: cy }).setDepth(D).setBlendMode(Phaser.BlendModes.ADD));
    for (let i = 0; i < 18; i++) {
      const a0 = (i / 18) * Math.PI * 2;
      rays.fillStyle(i % 2 ? st.color : GOLD, 0.12).slice(0, 0, len, a0, a0 + Math.PI / 18, false).fillPath();
    }
    rays.setAlpha(0);
    this.tweens.add({ targets: rays, alpha: 1, duration: 500 });
    this.tweens.add({ targets: rays, angle: 360, duration: 40000, repeat: -1 });
    for (let i = 0; i < 26; i++) {
      const sz = Phaser.Math.FloatBetween(3, 8);
      const s = add(this.add.star(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 4, sz * 0.4, sz, Phaser.Utils.Array.GetRandom([0xffe9a0, 0xbfe0ff, 0xffffff]), 0.8).setDepth(D).setBlendMode(Phaser.BlendModes.ADD));
      this.tweens.add({ targets: s, y: s.y - Phaser.Math.Between(120, 360), alpha: { from: 0.15, to: 0.9 }, angle: 180, duration: Phaser.Math.Between(2600, 5200), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2500), ease: 'Sine.easeInOut' });
    }
    // título
    const title = add(this.add.text(cx, H * 0.1, 'FIN DE TEMPORADA', { fontFamily: FONT, fontSize: '50px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 10 }).setOrigin(0.5).setDepth(D + 5));
    fitText(title, W - 40);
    title.setShadow(0, 6, '#0a1638', 0, true, true);
    const sub = add(this.add.text(cx, H * 0.1 + 56, `${rankDef(w.league).name.toUpperCase()}${two ? ' · 2V2' : ''}  ·  COFRE SEMANAL`, { fontFamily: FONT, fontSize: '22px', color: st.css, stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 5).setLetterSpacing(1));
    title.setScale(0.4).setAlpha(0);
    sub.setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, delay: 200, duration: 300 });
    // resplandor + cofre (cuerpo y tapa por separado: la tapa sale volando al abrirse)
    const size = Math.min(340, W * 0.5);
    const glow = add(this.add.circle(cx, cy, size * 0.55, GOLD, 0.25).setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD));
    this.tweens.add({ targets: glow, scale: 1.2, alpha: 0.12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const chest = add(this.add.container(cx, cy).setDepth(D + 3));
    const inner = this.add.ellipse(0, -size / 2 + (SEASON_LID_Y / 256) * size + 4, size * 0.62, size * 0.16, 0xfff1b8, 0).setBlendMode(Phaser.BlendModes.ADD);
    const body = this.seasonChestArt(0, 0, size, 'body');
    const lid = this.seasonChestArt(0, 0, size, 'lid');
    chest.add([inner, body, lid]);
    chest.setScale(0.2).setAngle(-40).setAlpha(0);
    this.tweens.add({ targets: chest, scale: 1, angle: 0, alpha: 1, duration: 750, ease: 'Back.easeOut' });
    const sway = this.tweens.add({ targets: chest, angle: { from: -3, to: 3 }, delay: 800, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const hint = add(this.add.text(cx, cy + size / 2 + 70, 'TOCA EL COFRE\nPARA ABRIRLO', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 9, align: 'center' }).setOrigin(0.5).setDepth(D + 5).setAlpha(0));
    this.tweens.add({ targets: hint, alpha: 1, delay: 600, duration: 300, onComplete: () => this.tweens.add({ targets: hint, alpha: 0.55, scale: 1.06, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });

    // premios en orden (ya cobrados): monedas → Rayo → dinero
    const cash = w.cash + weeklyChestCash(w, two);
    const prizes: { kind: 'coins' | 'rays' | 'cash'; amount: number; label: string; color: string }[] = [
      { kind: 'coins', amount: w.coins, label: two ? 'MONEDAS 2V2' : 'MONEDAS', color: '#ffd23f' },
      ...(w.rays ? [{ kind: 'rays' as const, amount: w.rays, label: w.rays === 1 ? 'RAYO' : 'RAYOS', color: '#79e8ff' }] : []),
      ...(cash ? [{ kind: 'cash' as const, amount: cash, label: 'DINERO', color: '#9fe8a0' }] : []),
    ];
    const prizeIcon = (kind: 'coins' | 'rays' | 'cash', r: number): Phaser.GameObjects.Container => {
      const c = this.add.container(0, 0);
      if (kind === 'coins') c.add((two ? coin2v2Image : coinIcon)(this, 0, 0, r));
      else if (kind === 'cash') {
        if (this.textures.exists('cash-pack')) c.add(this.add.image(0, 0, 'cash-pack').setDisplaySize(r * 2.4, r * 2.4));
        else {
          const g = this.add.graphics();
          drawCashIcon(g, r / 14);
          c.add(g);
        }
      } else {
        const g = this.add.graphics();
        const k = r / 12;
        const bolt = [{ x: 2, y: -11 }, { x: 12, y: -11 }, { x: 6, y: -1 }, { x: 13, y: -1 }, { x: -1, y: 12 }, { x: 4, y: 2 }, { x: -2, y: 2 }].map((q) => ({ x: (q.x - 5) * k, y: q.y * k }));
        g.fillStyle(0x0a1638, 1).fillPoints(bolt.map((q) => ({ x: q.x * 1.12, y: q.y * 1.12 })), true);
        g.fillStyle(0x47dfff, 1).fillPoints(bolt, true);
        g.fillStyle(0xd8fbff, 0.7).fillPoints(bolt.map((q) => ({ x: q.x * 0.5 - 1.5 * k, y: q.y * 0.5 - 2 * k })), true);
        c.add(g);
      }
      return c;
    };
    const burst = (x: number, y: number, n: number, far: number) => {
      const ring = add(this.add.circle(x, y, 30, 0xffffff, 0).setStrokeStyle(8, GOLD, 1).setDepth(D + 6).setBlendMode(Phaser.BlendModes.ADD));
      this.tweens.add({ targets: ring, scale: far / 40, alpha: 0, duration: 650, ease: 'Cubic.easeOut' });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const d = Phaser.Math.FloatBetween(far * 0.45, far);
        const s = add(this.add.star(x, y, 5, 5, 12, Phaser.Utils.Array.GetRandom([0xffd23f, 0xfff1b8, 0xffffff, st.light])).setDepth(D + 6).setBlendMode(Phaser.BlendModes.ADD));
        this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 360, alpha: 0, scale: 0.4, duration: Phaser.Math.Between(600, 900), ease: 'Cubic.easeOut' });
      }
    };

    // fila de abajo: cada premio ya visto se queda ahí
    const rowY = H * 0.8;
    const slotX = (i: number) => cx + (i - (prizes.length - 1) / 2) * Math.min(200, (W - 60) / prizes.length);
    let phase: 'idle' | 'opening' | 'prize' | 'done' = 'idle';
    let step = -1;
    let current: Phaser.GameObjects.GameObject[] = [];
    let currentIcon: Phaser.GameObjects.Container | null = null;
    let canNext = false;
    const cont = add(this.add.text(cx, H * 0.92, 'TOCA PARA CONTINUAR', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setDepth(D + 5).setAlpha(0).setLetterSpacing(2));

    const settleCurrent = () => {
      // el premio a la vista baja a su sitio de la fila
      const i = step;
      const p = prizes[i];
      if (!p || !currentIcon) return;
      for (const o of current) {
        this.tweens.killTweensOf(o);
        this.tweens.add({ targets: o, alpha: 0, duration: 200, onComplete: () => o.destroy() });
      }
      current = [];
      const ic = currentIcon;
      currentIcon = null;
      this.tweens.killTweensOf(ic);
      this.tweens.add({ targets: ic, x: slotX(i), y: rowY - 18, scale: 0.42, angle: 0, duration: 380, ease: 'Cubic.easeInOut' });
      const t = add(this.add.text(slotX(i), rowY + 40, `+${fmtCoins(p.amount)}`, { fontFamily: FONT, fontSize: '28px', color: p.color, stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setDepth(D + 5).setAlpha(0));
      this.tweens.add({ targets: t, alpha: 1, delay: 300, duration: 220 });
    };

    const showPrize = () => {
      step++;
      const p = prizes[step];
      if (!p) {
        phase = 'done';
        this.tweens.add({ targets: chest, alpha: 0.35, duration: 400 });
        this.time.delayedCall(250, () => {
          if (!alive()) return;
          canNext = true;
          this.tweens.add({ targets: cont, alpha: 1, duration: 300, onComplete: () => this.tweens.add({ targets: cont, alpha: 0.4, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
        });
        return;
      }
      phase = 'prize';
      canNext = false;
      const py = H * 0.36;
      const r = Math.min(110, W * 0.15);
      // sale del cofre: de la boca del cofre hacia arriba, con rebote
      const ic = add(prizeIcon(p.kind, r).setDepth(D + 4));
      ic.setPosition(cx, cy - size * 0.1).setScale(0.1).setAngle(-30);
      currentIcon = ic;
      this.tweens.add({ targets: ic, y: py, scale: 1, angle: 0, duration: 560, ease: 'Back.easeOut' });
      this.tweens.add({ targets: ic, y: py - 10, delay: 600, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const halo = add(this.add.circle(cx, py, r * 1.3, p.kind === 'rays' ? 0x47dfff : p.kind === 'cash' ? 0x62ef89 : GOLD, 0).setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD));
      this.tweens.add({ targets: halo, fillAlpha: 0.3, scale: { from: 0.4, to: 1.2 }, delay: 120, duration: 480, ease: 'Cubic.easeOut' });
      this.time.delayedCall(200, () => alive() && burst(cx, py, 16, 180));
      wheelClaim(this);
      // cantidad que cuenta hacia arriba y su nombre
      const amt = add(this.add.text(cx, py + r + 62, '+0', { fontFamily: FONT, fontSize: '96px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 14 }).setOrigin(0.5).setDepth(D + 5).setAlpha(0).setScale(0.4));
      amt.setShadow(0, 8, '#0a1638', 0, true, true);
      this.tweens.add({ targets: amt, alpha: 1, scale: 1, delay: 260, duration: 380, ease: 'Back.easeOut' });
      const c = { v: 0 };
      this.tweens.add({ targets: c, v: p.amount, delay: 320, duration: p.amount > 20 ? 800 : 400, ease: 'Cubic.easeOut', onUpdate: () => amt.setText(`+${fmtCoins(Math.round(c.v))}`), onComplete: () => amt.setText(`+${fmtCoins(p.amount)}`) });
      const lb = add(this.add.text(cx, amt.y + 76, p.label, { fontFamily: FONT, fontSize: '40px', color: p.color, stroke: '#0a1638', strokeThickness: 9 }).setOrigin(0.5).setDepth(D + 5).setAlpha(0).setLetterSpacing(3));
      this.tweens.add({ targets: lb, alpha: 1, delay: 560, duration: 300 });
      current = [halo, amt, lb];
      // tocar pasa al siguiente; si no, pasa solo
      this.time.delayedCall(650, () => {
        if (!alive() || step !== prizes.indexOf(p)) return;
        canNext = true;
      });
      this.time.delayedCall(2000, () => {
        if (!alive() || step !== prizes.indexOf(p) || phase !== 'prize') return;
        settleCurrent();
        showPrize();
      });
    };

    const open = () => {
      phase = 'opening';
      sway.stop();
      this.tweens.killTweensOf(hint);
      this.tweens.add({ targets: hint, alpha: 0, duration: 200 });
      this.tweens.add({ targets: sub, alpha: 0, duration: 200 });
      // vibra cada vez más (3 sacudidas) …
      const shakes: { angle?: number; scale?: number; duration: number; onStart?: () => void }[] = [];
      for (let b = 0; b < 3; b++) {
        const amp = 4 + b * 4;
        shakes.push({ angle: 0, duration: 1, onStart: () => { if (alive()) { wheelTick(this, 1.2 + b * 0.25); this.cameras.main.shake(120 + b * 60, 0.003 + b * 0.003); } } });
        for (let k = 0; k < 6; k++) shakes.push({ angle: k % 2 ? amp : -amp, scale: 1 + b * 0.05, duration: 45 });
        shakes.push({ angle: 0, duration: 45 });
        shakes.push({ angle: 0, duration: 140 });
      }
      this.tweens.chain({
        targets: chest,
        tweens: shakes,
        onComplete: () => {
          if (!alive()) return;
          // … y se abre: la tapa sale volando, golpe de luz desde dentro
          wheelWin(this, true);
          this.cameras.main.flash(260, 255, 235, 170);
          this.cameras.main.shake(260, 0.01);
          this.tweens.add({ targets: lid, y: -size * 0.75, angle: -28, alpha: 0, duration: 520, ease: 'Cubic.easeOut' });
          this.tweens.add({ targets: inner, fillAlpha: 0.95, scaleX: 1.3, duration: 260 });
          this.tweens.add({ targets: chest, scale: 0.85, y: cy + size * 0.38, angle: 0, duration: 500, ease: 'Back.easeOut' });
          this.tweens.add({ targets: glow, y: cy + size * 0.2, duration: 500 });
          const beam = add(this.add.graphics({ x: cx, y: cy + size * 0.38 - size * 0.3 }).setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
          beam.fillStyle(0xfff1b8, 0.35).fillTriangle(-size * 0.28, 0, size * 0.28, 0, 0, -H);
          beam.fillStyle(0xffffff, 0.25).fillTriangle(-size * 0.5, 0, -size * 0.1, 0, -size * 0.9, -H);
          beam.fillStyle(0xffffff, 0.25).fillTriangle(size * 0.1, 0, size * 0.5, 0, size * 0.9, -H);
          this.tweens.add({ targets: beam, alpha: 1, duration: 200 });
          this.tweens.add({ targets: beam, alpha: 0.4, delay: 200, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          burst(cx, cy, 34, 340);
          this.confetti(objs, [GOLD, st.color, st.light, 0xffffff]);
          this.time.delayedCall(560, () => alive() && showPrize());
        },
      });
    };

    const zone = add(this.add.zone(0, 0, W, H).setOrigin(0).setDepth(D + 10).setInteractive());
    zone.on('pointerup', () => {
      if (phase === 'idle') {
        if (chest.scale < 0.9) return; // aún entrando
        return open();
      }
      if (!canNext) return;
      if (phase === 'prize') {
        settleCurrent();
        showPrize();
      } else if (phase === 'done') {
        phase = 'opening'; // (un solo cierre)
        this.closeOverlay();
        this.toast(prizes.map((q) => `+${fmtCoins(q.amount)} ${q.kind === 'coins' ? (two ? 'monedas 2v2' : 'monedas') : q.kind === 'rays' ? 'Rayo' : 'dinero'}`).join(' · '));
        this.time.delayedCall(300, () => this.presentQueue());
      }
    });
  }

  // ================================================================ utilidades
  private openOverlay(alpha = 0.75) {
    this.closeOverlay();
    this.overlayReturnScroll = this.scrollY;
    this.scrollY = 0;
    this.cameras.main.setScroll(0, 0);
    const W = this.scale.width;
    const H = this.scale.height;
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, alpha).setOrigin(0).setDepth(8000).setScrollFactor(0).setInteractive();
    this.overlay = [shade];
    return this.overlay;
  }

  private closeOverlay() {
    if (!this.overlay.length) return;
    this.overlay.forEach((o) => {
      this.tweens.killTweensOf(o);
      o.destroy();
    });
    this.overlay = [];
    this.events.emit('overlay-closed');
    this.scrollY = this.overlayReturnScroll;
    this.rebuild();
  }

  private confetti(objs: Phaser.GameObjects.GameObject[], colors: number[]) {
    const W = this.scale.width;
    const H = this.scale.height;
    for (let i = 0; i < 46; i++) {
      const r = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(-H * 0.5, -20), Phaser.Math.Between(8, 14), Phaser.Math.Between(12, 20), Phaser.Utils.Array.GetRandom(colors)).setDepth(8007);
      objs.push(r);
      this.tweens.add({ targets: r, y: H + 40, x: r.x + Phaser.Math.Between(-120, 120), angle: Phaser.Math.Between(-540, 540), duration: Phaser.Math.Between(2400, 4200), delay: Phaser.Math.Between(0, 1000) });
    }
  }

  private backButton(x: number, y: number) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.94).fillRoundedRect(-30, -30, 60, 60, 16);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-30, -30, 60, 60, 16);
    g.lineStyle(6, 0xffffff, 1).beginPath().moveTo(6, -13).lineTo(-8, 0).lineTo(6, 13).strokePath();
    c.add(g);
    c.setSize(64, 64).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
  }

  /**
   * (21-11-2026, mockup) LAS DOS PESTAÑAS en una imagen: pestanas-liga.webp = LIGA activa (amarilla) y 2V2 en gris; pestanas-liga-2v2.webp al revés.
   * Se muestra la de la pestaña activa. Cada mitad es una zona táctil. El texto "LIGA (1 VS 1)" / "LIGA 2V2 (2 VS 2)" va encima, en dos líneas.
   * Sin la imagen, las dos pestañas dibujadas de antes (drawTabFallback).
   */
  private drawTabs(W: number, visTop: number, is2: boolean): number {
    const key = is2 ? LIGA_ART.tabs2.key : LIGA_ART.tabs1.key;
    const bw = Math.min(660, W - 40); // (21-11-2026, usuario) mismo ancho que las demás secciones (CW en build)
    if (!this.textures.exists(key)) {
      const fh = 58;
      const cyF = visTop + fh / 2;
      this.drawTabFallback(W / 2 - bw / 4 - 6, cyF, bw / 2 - 10, fh, '1v1', !is2);
      this.drawTabFallback(W / 2 + bw / 4 + 6, cyF, bw / 2 - 10, fh, '2v2', is2);
      return cyF + fh / 2;
    }
    // (21-11-2026, revisión) recorte exacto de las pestañas; los textos en px de la imagen: centro del CUERPO de cada pestaña (y≈322, sin el
    // piquito) y, en x, el centro del hueco a la derecha de la(s) pelota(s): LIGA x 420..980 → 700 · LIGA 2V2 x 1390..1940 → 1665
    const P = this.piece({ key }, is2 ? 'tabs2' : 'tabs1', LIGA_PIECES.tabs, W / 2 - bw / 2, visTop, bw)!;
    const visBot = visTop + P.h;
    const midY = P.Y(322);
    const half = (560 * P.s) / 0.6; // (fitText usa half*0.6 = ancho del hueco del texto)
    const label = (lx: number, l1: string, l2: string, active: boolean, two: boolean) => {
      const col = active ? '#ffffff' : '#b8c4e0';
      const cont = this.add.container(lx, midY);
      // (21-11-2026, revisión) más grandes: el "(1 VS 1)" no se leía
      // (21-11-2026, usuario) "LIGA" / "LIGA 2V2" en cursiva (el subtítulo no)
      // (21-11-2026, usuario) más grandes y con el borde de las letras más marcado (más grueso y más oscuro)
      const strokeD = active ? (two ? '#24084f' : '#4a2a00') : '#050b1c';
      const t1 = this.add.text(0, -12, l1, { fontFamily: FONT, fontSize: '32px', fontStyle: 'italic', color: col, stroke: strokeD, strokeThickness: 8 }).setOrigin(0.5);
      const t2 = this.add.text(0, 17, l2, { fontFamily: FONT, fontSize: '19px', color: col, stroke: strokeD, strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(1);
      fitText(t1, half * 0.6);
      fitText(t2, half * 0.6);
      cont.add([t1, t2]);
    };
    // el texto a la derecha de la(s) pelota(s) de cada pestaña
    // (21-11-2026, usuario) más a la izquierda, más cerca de la(s) pelota(s)
    label(P.X(600), 'LIGA', '(1 VS 1)', !is2, false);
    label(P.X(1570), 'LIGA 2V2', '(2 VS 2)', is2, true);
    const hit = (lx: number, kind: '1v1' | '2v2') => {
      const z = this.add.zone(lx, midY, bw / 2 - 6, 270 * P.s).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.setTab(kind));
    };
    hit(P.X(515), '1v1');
    hit(P.X(1480), '2v2');
    return visBot;
  }

  /** Pestaña dibujada de respaldo (sin la imagen): forma inclinada con pelota(s) y el nombre. */
  private drawTabFallback(x: number, y: number, w: number, h: number, kind: '1v1' | '2v2', active: boolean) {
    const c = this.add.container(x, y);
    const cols = kind === '1v1' ? [0xffe55a, 0xffcc1f, 0xf29a0c] : [0xb98aff, 0x8a4bff, 0x4a1fb0];
    const g = this.add.graphics();
    if (active) g.lineStyle(12, 0x5fb4ff, 0.28).strokePoints(modeShape(w, h, 6), true, true);
    g.fillStyle(0x000000, 0.4).fillPoints(modeShape(w, h, 0).map((p) => ({ x: p.x + 2, y: p.y + 6 })), true);
    g.fillStyle(0x0a1638, 1).fillPoints(modeShape(w, h, 4), true);
    if (active) g.lineStyle(3, 0x9fdcff, 1).strokePoints(modeShape(w, h, 4), true, true);
    g.fillStyle(cols[2], 1).fillPoints(modeShape(w, h), true);
    g.fillStyle(cols[1], 1).fillPoints(modeBand(w, h, -h / 2, h * 0.12, 5, 9), true);
    g.fillStyle(cols[0], 0.55).fillPoints(modeBand(w, h, -h * 0.44, -h * 0.18, 12, 6), true);
    if (!active) g.fillStyle(0x0a1638, 0.38).fillPoints(modeShape(w, h), true);
    c.add(g);
    const r = h * 0.27;
    const ball = (bx: number) => {
      const b = this.add.graphics();
      b.fillStyle(0x0a1638, 1).fillCircle(bx, 0, r + 2.5);
      b.fillStyle(0xd9f23a, 1).fillCircle(bx, 0, r);
      c.add(b);
    };
    const ix = -w / 2 + h * 0.78;
    if (kind === '2v2') { ball(ix - r * 0.55); ball(ix + r * 0.55); } else ball(ix);
    const tx = ix + r * (kind === '2v2' ? 1.9 : 1.5);
    const t = this.add.text(0, 1, kind === '1v1' ? 'LIGA' : 'LIGA 2V2', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: kind === '1v1' ? '#6b3a00' : '#1d0a52', strokeThickness: 6 }).setOrigin(0, 0.5);
    fitText(t, w / 2 + w * 0.46 - tx - 16);
    t.setX(tx);
    c.add(t);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.setTab(kind));
    return c;
  }

  /** Cambia de pestaña (LIGA / LIGA 2V2) y rehace la pantalla. */
  private setTab(t: '1v1' | '2v2') {
    if (t === this.tab) return;
    this.tab = t;
    this.registry.set('liga.tab', t);
    this.scrollY = 0;
    this.time.delayedCall(0, () => this.scene.isActive() && this.rebuild());
  }

  private coinPill(right: number, y: number, coins: number, two = false) {
    const t = this.add.text(right - 14, y, fmtCoins(coins), { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5);
    const w = t.width + 60;
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.94).fillRoundedRect(right - w, y - 22, w, 44, 22);
    g.lineStyle(2, GOLD, 1).strokeRoundedRect(right - w, y - 22, w, 44, 22);
    (two ? coin2v2Image : coinIcon)(this, right - w + 22, y, 14); // (17-11-2026) moneda: imagen moneda-1.webp (2v2: moneda 2v2)
    this.children.bringToTop(t);
  }

  private toast(msg: string) {
    const W = this.scale.width;
    const t = this.add.text(W / 2, this.scale.height * 0.62, msg, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6, align: 'center', wordWrap: { width: W - 60 } }).setOrigin(0.5).setDepth(9500).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 300, onComplete: () => t.destroy() });
  }
}

const pct = (w: number, l: number) => (w + l ? `${Math.round((w / (w + l)) * 100)}%` : '0%');

type StatIcon = 'trophy' | 'calendar' | 'chart' | 'flame';

/** Iconos blancos simples de los cuadros de estadísticas (centrados en 0,0, radio ~10). */
function drawStatIcon(g: Phaser.GameObjects.Graphics, icon: StatIcon) {
  g.fillStyle(0xffffff, 1);
  if (icon === 'trophy') {
    g.fillRoundedRect(-7, -8, 14, 9, { tl: 1, tr: 1, bl: 6, br: 6 });
    g.lineStyle(2, 0xffffff, 1).strokeCircle(-8, -4, 3).strokeCircle(8, -4, 3);
    g.fillRect(-1.5, 1, 3, 4).fillRoundedRect(-5, 5, 10, 3, 1);
  } else if (icon === 'calendar') {
    g.fillRoundedRect(-8, -6, 16, 14, 2);
    g.fillStyle(0x0a1638, 1).fillRect(-6, -1, 12, 7);
    g.fillStyle(0xffffff, 1).fillRect(-5, -9, 2, 5).fillRect(3, -9, 2, 5);
  } else if (icon === 'chart') {
    g.fillRect(-8, 2, 4, 6).fillRect(-2, -2, 4, 10).fillRect(4, -7, 4, 15);
  } else {
    g.fillPoints([{ x: 0, y: -10 }, { x: 6, y: -2 }, { x: 7, y: 4 }, { x: 0, y: 9 }, { x: -7, y: 4 }, { x: -5, y: -3 }, { x: -2, y: 0 }], true);
    g.fillStyle(0xffe066, 1).fillCircle(0, 4, 3);
  }
}
