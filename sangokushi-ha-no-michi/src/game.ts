import type {
  GameState,
  Hero,
  MapNode,
  Rect,
  AdvisorCard,
  MerchantItem,
  GameEvent,
} from './types';
import {
  HERO_DEFS,
  ENEMY_DEFS,
  ADVISOR_CARDS,
  MERCHANT_ITEMS,
  GAME_EVENTS,
  LEGACY_UPGRADES,
  HERO_UNLOCK_UPGRADES,
  getDefaultLegacyData,
} from './data';
import { generateMap, advanceMap } from './mapGen';
import {
  createBattleState,
  rerollDice,
  assignDie,
  executeBattle,
  canActivateSkill,
  activateSkill,
  getGoldReward,
} from './battle';
import {
  drawTitle,
  drawCharacterSelect,
  drawSynopsis,
  drawMap,
  drawBattle,
  drawReward,
  drawAdvisor,
  drawMerchant,
  drawRest,
  drawEvent,
  drawGameOver,
  drawEnding,
  drawLegacy,
  pointInRect,
} from './renderer';
import { choose, shuffle, clamp } from './utils';
import { setLang, t, type Lang } from './i18n';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private animId: number = 0;
  private mapScrollY: number = 0;
  private charScrollY: number = 0;
  private charScrollMax: number = 0;
  private legacyScrollY: number = 0;
  private legacyScrollMax: number = 0;
  private legacyTab: number = 0; // 0=能力強化, 1=武将解放
  private legacyTabRects: Rect[] = [];
  private selectedHeroId: string | null = null;

  // ドラッグ＆ドロップ状態
  private draggingDieIdx: number = -1;
  private dragPos: { x: number; y: number } = { x: 0, y: 0 };
  private isDragging: boolean = false;
  // タップ選択状態（ダイスをタップ→スロットをタップ）
  private selectedDieIdx: number = -1;

  // UIレイアウトキャッシュ
  private heroRects: Rect[] = [];
  private diceRects: Rect[] = [];
  private slotRects: Record<string, Rect> = {};
  private skillBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private confirmBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private rollBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private helpBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private startBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private confirmSelectRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private advisorRects: Rect[] = [];
  private merchantRects: Rect[] = [];
  private merchantLeaveRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private restHealRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private restLeaveRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private eventOptionRects: Rect[] = [];
  private retryBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private langBtnRects: Rect[] = [];
  private legacyBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private legacyUpgradeRects: Rect[] = [];
  private legacyHeroUnlockRects: Rect[] = [];
  private legacyBackRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private legacyResetRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  // バトルアニメーション
  private battleAnims: {
    type: 'attack' | 'hit';
    value: number;
    startTime: number;
  }[] = [];
  private animBlocked: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = this._initialState();
    this._setupInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  private _initialState(): GameState {
    const tutorialDone = this._isTutorialDone();
    return {
      phase: 'title',
      hero: null,
      map: null,
      battle: null,
      rewardInfo: null,
      advisorCards: [],
      merchantItems: [],
      currentEvent: null,
      eventResult: null,
      showHelp: false,
      battleCount: 0,
      tutorialStep: tutorialDone ? -1 : 0,
      mapTutorialStep: tutorialDone ? -1 : 0,
      lang: 'ja',
      legacyData: this._loadLegacy(),
      enemiesDefeated: 0,
      bossesDefeated: 0,
      chaptersReached: 0,
    };
  }

  private _resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this._recalcLayout();
  }

  private _recalcLayout(): void {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // スタートボタン
    const btnW = Math.min(220, w * 0.5);
    this.startBtnRect = { x: (w - btnW) / 2, y: h * 0.68, w: btnW, h: 48 };
    this.retryBtnRect = { x: (w - 260) / 2, y: h * 0.65, w: 260, h: 50 };

    // 言語選択ボタン（タイトル画面右上）
    const langBtnW = 44;
    const langBtnH = 28;
    const langBtnGap = 6;
    const langStartX = w - (langBtnW * 3 + langBtnGap * 2) - 12;
    this.langBtnRects = [0, 1, 2].map((i) => ({
      x: langStartX + i * (langBtnW + langBtnGap),
      y: 10,
      w: langBtnW,
      h: langBtnH,
    }));

    // レガシーボタン（タイトル画面）
    this.legacyBtnRect = { x: w / 2 - 60, y: h * 0.78, w: 120, h: 36 };

    // レガシー画面レイアウト
    const legUpgradeW = Math.min(w - 40, 400);
    const legUpgradeH = 60;
    const legUpgradeX = (w - legUpgradeW) / 2;

    // タブボタン
    const tabW = legUpgradeW / 2;
    const tabH = 36;
    const tabY = h * 0.27;
    this.legacyTabRects = [
      { x: legUpgradeX, y: tabY, w: tabW, h: tabH },
      { x: legUpgradeX + tabW, y: tabY, w: tabW, h: tabH },
    ];

    // タブ以下のコンテンツ開始Y（両タブ共通）
    const contentStartY = tabY + tabH + 12;

    // 能力強化タブ
    this.legacyUpgradeRects = LEGACY_UPGRADES.map((_, i) => ({
      x: legUpgradeX, y: contentStartY + i * (legUpgradeH + 8), w: legUpgradeW, h: legUpgradeH,
    }));
    const upgradeContentBottom = contentStartY + LEGACY_UPGRADES.length * (legUpgradeH + 8) + 20;

    // 武将解放タブ
    this.legacyHeroUnlockRects = HERO_UNLOCK_UPGRADES.map((_, i) => ({
      x: legUpgradeX, y: contentStartY + i * (legUpgradeH + 8), w: legUpgradeW, h: legUpgradeH,
    }));
    const heroContentBottom = contentStartY + HERO_UNLOCK_UPGRADES.length * (legUpgradeH + 8) + 20;

    // アクティブタブに応じたコンテンツ下端
    const legacyContentBottom = this.legacyTab === 0 ? upgradeContentBottom : heroContentBottom;
    this.legacyBackRect = { x: (w - 200) / 2, y: legacyContentBottom, w: 200, h: 44 };
    this.legacyScrollMax = Math.max(0, legacyContentBottom + 44 + 20 - h);
    this.legacyResetRect = { x: w - 140 - 12, y: 12, w: 140, h: 32 };

    // キャラクター選択（スマホ対応: カードサイズ縮小＋スクロール）
    const cols = w < 500 ? 2 : 3;
    const maxCardW = w < 500 ? 130 : 160;
    const cardW = Math.min(maxCardW, (w - 40 - (cols - 1) * 10) / cols);
    const cardH = Math.floor(cardW * (h < 700 ? 1.55 : 1.75));
    const gap = Math.min(10, (w - cols * cardW) / (cols + 1));
    const startX = (w - cols * cardW - (cols - 1) * gap) / 2;
    const headerH = 50;
    this.heroRects = HERO_DEFS.map((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return { x: startX + col * (cardW + gap), y: headerH + row * (cardH + gap), w: cardW, h: cardH };
    });
    const totalRows = Math.ceil(HERO_DEFS.length / cols);
    const confirmY = headerH + totalRows * (cardH + gap) + 8;
    const confW = Math.min(220, w * 0.5);
    this.confirmSelectRect = { x: (w - confW) / 2, y: confirmY, w: confW, h: 44 };
    // スクロール上限: コンテンツがはみ出す分
    const contentBottom = confirmY + 44 + 20;
    this.charScrollMax = Math.max(0, contentBottom - h);

    // バトルレイアウト（中央寄せ・大きめ）
    const isLandscape = w > h;
    const panelH = isLandscape ? h * 0.48 : h * 0.42;
    const panelY = h - panelH - 6;
    const panelW = w - 16;
    const panelCx = w / 2;
    const diceCount = this.state.hero?.diceSet.length ?? 4;
    const diceSize = Math.min(56, (panelW - 40) / (diceCount + 1));
    const diceGap = Math.min(10, (panelW - diceCount * diceSize) / (diceCount + 1));
    const diceTotalW = diceCount * diceSize + (diceCount - 1) * diceGap;
    const diceStartX = panelCx - diceTotalW / 2;
    const diceY = panelY + 28;
    this.diceRects = Array.from({ length: diceCount }, (_, i) => ({
      x: diceStartX + i * (diceSize + diceGap),
      y: diceY,
      w: diceSize,
      h: diceSize,
    }));

    const slotGap = Math.min(8, w * 0.02);
    const slotW = Math.min(110, (panelW - 24 - slotGap * 2) / 3);
    const slotH = 62;
    const slotTotalW = slotW * 3 + slotGap * 2;
    const slotStartX = panelCx - slotTotalW / 2;
    const slotY = diceY + diceSize + 12;
    this.slotRects = {
      attack: { x: slotStartX, y: slotY, w: slotW, h: slotH },
      defense: { x: slotStartX + slotW + slotGap, y: slotY, w: slotW, h: slotH },
      strategy: { x: slotStartX + (slotW + slotGap) * 2, y: slotY, w: slotW, h: slotH },
    };

    const skillW = Math.min(slotTotalW, w * 0.7);
    const skillY = slotY + slotH + 8;
    this.skillBtnRect = { x: panelCx - skillW / 2, y: skillY, w: skillW, h: 54 };

    // ヘルプボタン（右上）
    this.helpBtnRect = { x: w - 44, y: 8, w: 36, h: 36 };

    const btnW2 = Math.min(slotTotalW, w * 0.6);
    const btnY = skillY + 54 + 8;
    this.confirmBtnRect = { x: panelCx - btnW2 / 2, y: btnY, w: btnW2, h: 42 };
    this.rollBtnRect = { x: panelCx - btnW2 / 2, y: btnY, w: btnW2, h: 42 };

    // 軍師カード
    const aCardW = Math.min(180, (w - 60) / 3);
    const aCardH = Math.min(140, h * 0.3);
    const aStartX = (w - 3 * aCardW - 2 * 12) / 2;
    this.advisorRects = Array.from({ length: 3 }, (_, i) => ({
      x: aStartX + i * (aCardW + 12),
      y: h * 0.28,
      w: aCardW,
      h: aCardH,
    }));

    // 商人アイテム
    const mItemW = Math.min(140, (w - 60) / 3);
    const mItemH = 90;
    const mStartX = (w - 3 * mItemW - 24) / 2;
    this.merchantRects = Array.from({ length: 5 }, (_, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return {
        x: mStartX + col * (mItemW + 12),
        y: h * 0.18 + row * (mItemH + 10),
        w: mItemW,
        h: mItemH,
      };
    });
    this.merchantLeaveRect = { x: (w - 160) / 2, y: h * 0.75, w: 160, h: 44 };

    // 休息
    const restW = Math.min(240, w * 0.5);
    this.restHealRect = { x: (w - restW) / 2, y: h * 0.55, w: restW, h: 48 };
    this.restLeaveRect = { x: (w - restW) / 2, y: h * 0.67, w: restW, h: 44 };

    // イベント選択肢
    this.eventOptionRects = Array.from({ length: 2 }, (_, i) => ({
      x: w * 0.15,
      y: h * 0.65 + i * 54,
      w: w * 0.7,
      h: 46,
    }));
  }

  private _toCanvasPos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  private _setupInput(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = this._toCanvasPos(e);

      // バトル中のassignフェーズでダイスをドラッグ開始
      if (this.state.phase === 'battle' && this.state.battle?.phase === 'assign' && !this.state.showHelp) {
        for (let i = 0; i < this.diceRects.length; i++) {
          if (pointInRect(p, this.diceRects[i])) {
            const die = this.state.battle.dice[i];
            if (die && die.assignedSlot !== 'skill') {
              this.draggingDieIdx = i;
              this.dragPos = p;
              this.isDragging = false; // まだ移動していない
              return;
            }
          }
        }
      }

      this._handleClick(p);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.draggingDieIdx >= 0) {
        e.preventDefault();
        const p = this._toCanvasPos(e);
        this.dragPos = p;
        this.isDragging = true;
      }
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.draggingDieIdx >= 0 && this.isDragging) {
        e.preventDefault();
        const p = this._toCanvasPos(e);
        this._handleDiceDrop(this.draggingDieIdx, p);
        this.draggingDieIdx = -1;
        this.isDragging = false;
        this.selectedDieIdx = -1;
        return;
      }
      // ドラッグせずにリリース（タップ）
      if (this.draggingDieIdx >= 0 && !this.isDragging) {
        const battle = this.state.battle;
        if (battle) {
          const tappedIdx = this.draggingDieIdx;
          const die = battle.dice[tappedIdx];
          if (die && die.assignedSlot !== null && die.assignedSlot !== 'skill') {
            // 割当済みダイスをタップ → 解除＆選択解除
            const newDice = battle.dice.map((d) =>
              d.id === die.id ? { ...d, assignedSlot: null } : d
            );
            this.state = { ...this.state, battle: { ...battle, dice: newDice } };
            this.selectedDieIdx = -1;
          } else if (die && die.assignedSlot === null) {
            // 未割当ダイスをタップ → 選択/選択解除のトグル
            this.selectedDieIdx = this.selectedDieIdx === tappedIdx ? -1 : tappedIdx;
          }
        }
      }
      this.draggingDieIdx = -1;
      this.isDragging = false;
    });

    this.canvas.addEventListener('pointerleave', () => {
      this.draggingDieIdx = -1;
      this.isDragging = false;
    });

    // スクロール（マップ＆キャラ選択）
    let lastTouchY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.state.phase === 'map' || this.state.phase === 'character_select' || this.state.phase === 'legacy') {
        lastTouchY = e.touches[0].clientY;
      }
    });
    this.canvas.addEventListener('touchmove', (e) => {
      const phase = this.state.phase;
      if (phase === 'map') {
        e.preventDefault();
        const dy = lastTouchY - e.touches[0].clientY;
        this.mapScrollY = clamp(this.mapScrollY + dy, 0, 600);
        lastTouchY = e.touches[0].clientY;
      } else if (phase === 'character_select') {
        e.preventDefault();
        const dy = lastTouchY - e.touches[0].clientY;
        this.charScrollY = clamp(this.charScrollY + dy, 0, this.charScrollMax);
        lastTouchY = e.touches[0].clientY;
      } else if (phase === 'legacy') {
        e.preventDefault();
        const dy = lastTouchY - e.touches[0].clientY;
        this.legacyScrollY = clamp(this.legacyScrollY + dy, 0, this.legacyScrollMax);
        lastTouchY = e.touches[0].clientY;
      }
    }, { passive: false });

    this.canvas.addEventListener('wheel', (e) => {
      if (this.state.phase === 'map') {
        this.mapScrollY = clamp(this.mapScrollY + e.deltaY * 0.5, 0, 600);
      } else if (this.state.phase === 'character_select') {
        this.charScrollY = clamp(this.charScrollY + e.deltaY * 0.5, 0, this.charScrollMax);
      } else if (this.state.phase === 'legacy') {
        this.legacyScrollY = clamp(this.legacyScrollY + e.deltaY * 0.5, 0, this.legacyScrollMax);
      }
    });
  }

  private _handleDiceDrop(dieIdx: number, p: { x: number; y: number }): void {
    const { battle } = this.state;
    if (!battle) return;
    const die = battle.dice[dieIdx];
    if (!die) return;

    // スロットの上にドロップ → そのスロットに割り当て
    type SlotKey = 'attack' | 'defense' | 'strategy';
    let targetSlot: SlotKey | null = null;
    for (const [key, rect] of Object.entries(this.slotRects)) {
      if (pointInRect(p, rect)) {
        targetSlot = key as SlotKey;
        break;
      }
    }

    const newDice = battle.dice.map((d) =>
      d.id === die.id ? { ...d, assignedSlot: targetSlot } : d
    );
    this.state = { ...this.state, battle: { ...battle, dice: newDice } };
    if (targetSlot && this.state.tutorialStep === 4) {
      const allAssigned = newDice.every((d) => d.assignedSlot !== null);
      if (allAssigned) this._advanceTutorial();
    }
  }

  private _handleClick(p: { x: number; y: number }): void {
    const { phase } = this.state;

    if (phase === 'title') {
      // 言語選択
      const langs: Lang[] = ['ja', 'en', 'zh'];
      for (let i = 0; i < this.langBtnRects.length; i++) {
        if (pointInRect(p, this.langBtnRects[i])) {
          setLang(langs[i]);
          this.state = { ...this.state, lang: langs[i] };
          return;
        }
      }
      // レガシーボタン
      if (this.state.legacyData.totalRuns > 0 && pointInRect(p, this.legacyBtnRect)) {
        this.legacyScrollY = 0;
        this.state = { ...this.state, phase: 'legacy' };
        return;
      }
      if (pointInRect(p, this.startBtnRect)) {
        this.charScrollY = 0;
        this.state = { ...this.state, phase: 'character_select' };
      }
    } else if (phase === 'character_select') {
      // 決定ボタンは画面下部に固定表示（スクロール座標ではなく画面座標で判定）
      const ch = this.canvas.height;
      const btnAreaH = 60;
      const fixedBtn: Rect = { x: this.confirmSelectRect.x, y: ch - btnAreaH + 8, w: this.confirmSelectRect.w, h: this.confirmSelectRect.h };
      if (this.selectedHeroId && pointInRect(p, fixedBtn)) {
        this._startGame(this.selectedHeroId);
        return;
      }
      const scrolled = { x: p.x, y: p.y + this.charScrollY };
      // 描画と同じソート順で判定
      const sortedIndices = HERO_DEFS.map((_, idx) => idx).sort((a, b) => {
        const ua = this._isHeroUnlocked(HERO_DEFS[a].id) ? 0 : 1;
        const ub = this._isHeroUnlocked(HERO_DEFS[b].id) ? 0 : 1;
        return ua - ub || a - b;
      });
      sortedIndices.forEach((heroIdx, slotIdx) => {
        const rect = this.heroRects[slotIdx];
        if (rect && pointInRect(scrolled, rect)) {
          const heroId = HERO_DEFS[heroIdx].id;
          if (this._isHeroUnlocked(heroId)) {
            this.selectedHeroId = heroId;
          }
        }
      });
    } else if (phase === 'synopsis') {
      const startMapTutorial = this.state.mapTutorialStep === 0;
      this.state = { ...this.state, phase: 'map', mapTutorialStep: startMapTutorial ? 1 : this.state.mapTutorialStep };
    } else if (phase === 'map') {
      if (this.state.mapTutorialStep >= 1) {
        const next = this.state.mapTutorialStep + 1;
        const done = next > 2;
        this.state = { ...this.state, mapTutorialStep: done ? -1 : next as 1 | 2 };
        if (done) this._markTutorialDone();
        return;
      }
      this._handleMapClick(p);
    } else if (phase === 'reward') {
      this._handleRewardClick();
    } else if (phase === 'battle') {
      this._handleBattleClick(p);
    } else if (phase === 'advisor') {
      this._handleAdvisorClick(p);
    } else if (phase === 'merchant') {
      this._handleMerchantClick(p);
    } else if (phase === 'rest') {
      this._handleRestClick(p);
    } else if (phase === 'event') {
      this._handleEventClick(p);
    } else if (phase === 'legacy') {
      this._handleLegacyClick(p);
    } else if (phase === 'game_over' || phase === 'ending') {
      if (pointInRect(p, this.retryBtnRect)) {
        this._finishRun();
        this.state = { ...this.state, phase: 'legacy' };
      }
    }
  }

  private _handleLegacyClick(p: { x: number; y: number }): void {
    // リセットボタン（固定位置、スクロール影響なし）
    if (pointInRect(p, this.legacyResetRect)) {
      if (window.confirm(t('legacy.resetConfirm'))) {
        const defaultLegacy = getDefaultLegacyData();
        this._saveLegacy(defaultLegacy);
        try { localStorage.removeItem('sangokushi_tutorial_done'); } catch { /* ignore */ }
        this.state = { ...this.state, legacyData: defaultLegacy };
      }
      return;
    }
    // タブ切り替え（固定位置、スクロール影響なし）
    for (let i = 0; i < this.legacyTabRects.length; i++) {
      if (pointInRect(p, this.legacyTabRects[i])) {
        if (this.legacyTab !== i) {
          this.legacyTab = i;
          this.legacyScrollY = 0;
          this._recalcLayout();
        }
        return;
      }
    }
    // スクロールオフセット適用
    const scrolled = { x: p.x, y: p.y + this.legacyScrollY };
    // タイトルに戻る
    if (pointInRect(scrolled, this.legacyBackRect)) {
      this.state = this._initialState();
      this.selectedHeroId = null;
      this.mapScrollY = 0;
      this.legacyTab = 0;
      return;
    }
    const legacy = this.state.legacyData;
    if (this.legacyTab === 0) {
      // アップグレード購入
      this.legacyUpgradeRects.forEach((rect, i) => {
        if (pointInRect(scrolled, rect)) {
          const upg = LEGACY_UPGRADES[i];
          if (!upg) return;
          const level = legacy.upgrades[upg.id] ?? 0;
          if (level >= upg.maxLevel) return;
          const cost = upg.costs[level];
          if (legacy.legacyPoints < cost) return;
          const newLegacy = {
            ...legacy,
            legacyPoints: legacy.legacyPoints - cost,
            upgrades: { ...legacy.upgrades, [upg.id]: level + 1 },
          };
          this._saveLegacy(newLegacy);
          this.state = { ...this.state, legacyData: newLegacy };
        }
      });
    } else {
      // 武将解放購入
      this.legacyHeroUnlockRects.forEach((rect, i) => {
        if (pointInRect(scrolled, rect)) {
          const upg = HERO_UNLOCK_UPGRADES[i];
          if (!upg) return;
          const level = legacy.upgrades[upg.id] ?? 0;
          if (level >= upg.maxLevel) return;
          const cost = upg.costs[level];
          if (legacy.legacyPoints < cost) return;
          const newLegacy = {
            ...legacy,
            legacyPoints: legacy.legacyPoints - cost,
            upgrades: { ...legacy.upgrades, [upg.id]: level + 1 },
          };
          this._saveLegacy(newLegacy);
          this.state = { ...this.state, legacyData: newLegacy };
        }
      });
    }
  }

  private _loadLegacy(): import('./types').LegacyData {
    try {
      const raw = localStorage.getItem('sangokushi_legacy');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.version === 1) return data;
      }
    } catch { /* ignore */ }
    return getDefaultLegacyData();
  }

  private _saveLegacy(data: import('./types').LegacyData): void {
    try {
      localStorage.setItem('sangokushi_legacy', JSON.stringify(data));
    } catch { /* ignore */ }
  }

  private _isHeroUnlocked(heroId: string): boolean {
    if (heroId === 'liu_bei') return true; // 劉備は初期解放
    const unlockUpg = HERO_UNLOCK_UPGRADES.find((u) => u.heroId === heroId);
    if (!unlockUpg) return true; // 定義がなければ解放扱い
    return (this.state.legacyData.upgrades[unlockUpg.id] ?? 0) >= 1;
  }

  private _isTutorialDone(): boolean {
    try {
      return localStorage.getItem('sangokushi_tutorial_done') === '1';
    } catch { return false; }
  }

  private _markTutorialDone(): void {
    try {
      localStorage.setItem('sangokushi_tutorial_done', '1');
    } catch { /* ignore */ }
  }

  private _calcLegacyBonuses(data: import('./types').LegacyData): { maxHp: number; attack: number; defense: number; gold: number; healPercent: number } {
    const bonuses = { maxHp: 0, attack: 0, defense: 0, gold: 0, healPercent: 0 };
    for (const upg of LEGACY_UPGRADES) {
      const level = data.upgrades[upg.id] ?? 0;
      let total = 0;
      for (let i = 0; i < level; i++) total += upg.effects[i];
      (bonuses as Record<string, number>)[upg.stat] = total;
    }
    return bonuses;
  }

  private _earnLegacyPoints(): number {
    const { chaptersReached, enemiesDefeated, bossesDefeated } = this.state;
    const cleared = this.state.phase === 'ending';
    let pts = chaptersReached * 15 + enemiesDefeated * 5 + bossesDefeated * 25;
    if (cleared) pts += 60;
    return pts;
  }

  private _finishRun(): void {
    const earned = this._earnLegacyPoints();
    const legacy = { ...this.state.legacyData };
    legacy.totalRuns++;
    legacy.legacyPoints += earned;
    legacy.lastEarnedPoints = earned;
    const currentCh = this.state.map?.chapter ?? 0;
    if (currentCh > legacy.bestChapter) legacy.bestChapter = currentCh;
    this._saveLegacy(legacy);
    this.state = { ...this.state, legacyData: legacy };
  }

  private _startGame(heroId: string): void {
    const heroDef = HERO_DEFS.find((h) => h.id === heroId);
    if (!heroDef) return;
    const hero: Hero = {
      ...heroDef,
      currentHp: heroDef.stats.maxHp,
      gold: 80,
      upgrades: [],
    };
    const bonuses = this._calcLegacyBonuses(this.state.legacyData);
    hero.stats = {
      ...hero.stats,
      maxHp: hero.stats.maxHp + bonuses.maxHp,
      attack: hero.stats.attack + bonuses.attack,
      defense: hero.stats.defense + bonuses.defense,
    };
    hero.currentHp = hero.stats.maxHp;
    hero.gold += bonuses.gold;
    const map = generateMap();
    this.state = {
      ...this.state,
      phase: 'synopsis',
      hero,
      map,
    };
    this._recalcLayout();
  }

  private _handleMapClick(p: { x: number; y: number }): void {
    const { map } = this.state;
    if (!map) return;

    const w = this.canvas.width;
    const scale = Math.max(0.7, Math.min(w / 650, 1.2));
    const mapContentW = 580 * scale;
    const offsetX = Math.max(8, (w - mapContentW) / 2);
    const mapHeaderH = w < 500 ? 62 : 50;
    const offsetY = mapHeaderH + 10 - this.mapScrollY;

    for (const node of map.nodes) {
      if (!node.available || node.visited) continue;
      const nx = offsetX + node.x * scale;
      const ny = offsetY + node.y * scale;
      const r = 33 * scale;
      if (Math.hypot(p.x - nx, p.y - ny) <= r + 4) {
        this._enterNode(node);
        return;
      }
    }
  }

  private _enterNode(node: MapNode): void {
    const { state } = this;
    if (!state.map || !state.hero) return;
    advanceMap(state.map, node.id);

    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
      const enemy = this._selectEnemy(node.type, state.map.chapter);
      const battleState = createBattleState(state.hero, enemy);
      const newBattleCount = (state.battleCount ?? 0) + 1;
      const startTutorial = newBattleCount === 1 && state.tutorialStep === 0;
      this.state = {
        ...state,
        phase: 'battle',
        battle: battleState,
        battleCount: newBattleCount,
        tutorialStep: startTutorial ? 1 : state.tutorialStep,
      };
      this._recalcLayout();
    } else if (node.type === 'advisor') {
      const cards = shuffle([...ADVISOR_CARDS]).slice(0, 3) as AdvisorCard[];
      this.state = { ...state, phase: 'advisor', advisorCards: cards };
    } else if (node.type === 'merchant') {
      const items = shuffle([...MERCHANT_ITEMS]).slice(0, 3) as MerchantItem[];
      this.state = { ...state, phase: 'merchant', merchantItems: items };
    } else if (node.type === 'rest') {
      this.state = { ...state, phase: 'rest' };
    } else if (node.type === 'event') {
      const event = choose(GAME_EVENTS);
      this.state = { ...state, phase: 'event', currentEvent: event };
    } else if (node.type === 'start') {
      // 開始マス: 何も起きずマップに戻る
      this.state = { ...state, phase: 'map' };
    }
  }

  private _selectEnemy(nodeType: string, chapter: number): import('./types').EnemyDef {
    // 章に対応する敵を選出
    const chapterEnemies = ENEMY_DEFS.filter((e) => e.chapter === chapter);

    if (nodeType === 'boss') {
      const boss = chapterEnemies.find((e) => e.isBoss);
      if (boss) return { ...boss };
    }
    if (nodeType === 'elite') {
      // 精鋭: その章の非ボス最強を選出
      const elites = chapterEnemies.filter((e) => !e.isBoss);
      const elite = elites.reduce((a, b) => (a.maxHp >= b.maxHp ? a : b), elites[0]);
      if (elite) return { ...elite };
    }
    // 通常戦闘: その章の非ボス敵からランダム
    const pool = chapterEnemies.filter((e) => !e.isBoss);
    const base = choose(pool.length > 0 ? pool : ENEMY_DEFS.filter((e) => !e.isBoss));
    return { ...base };
  }

  private _advanceTutorial(): void {
    const step = this.state.tutorialStep;
    if (step >= 1 && step < 5) {
      this.state = { ...this.state, tutorialStep: (step + 1) as import('./types').TutorialStep };
    } else if (step === 5) {
      this.state = { ...this.state, tutorialStep: -1 };
      this._markTutorialDone();
    }
  }

  private _handleBattleClick(p: { x: number; y: number }): void {
    const { battle, hero } = this.state;
    if (!battle || !hero) return;

    // チュートリアル表示中: ステップ1,2,3はタップで次へ、4,5は操作を許可しつつ進行
    const tStep = this.state.tutorialStep;
    if (tStep >= 1 && tStep <= 3) {
      this._advanceTutorial();
      return;
    }

    // ヘルプオーバーレイ表示中はタップで閉じる
    if (this.state.showHelp) {
      this.state = { ...this.state, showHelp: false };
      return;
    }

    // ヘルプボタン
    if (pointInRect(p, this.helpBtnRect)) {
      this.state = { ...this.state, showHelp: true };
      return;
    }

    if (battle.phase === 'result') {
      const won = battle.enemy.currentHp <= 0;
      if (won) {
        const nodeType = this.state.map?.nodes.find((n) => n.id === this.state.map?.currentNodeId)?.type ?? 'battle';
        const gold = getGoldReward(nodeType, this.state.map?.chapter ?? 1);
        const isBoss = battle.enemy.isBoss;
        const rewardInfo = {
          goldEarned: gold,
          enemyName: battle.enemy.name,
          isBoss,
        };
        this.state = {
          ...this.state,
          phase: 'reward',
          rewardInfo,
          enemiesDefeated: this.state.enemiesDefeated + 1,
          bossesDefeated: this.state.bossesDefeated + (isBoss ? 1 : 0),
        };
      } else {
        this.state = { ...this.state, phase: 'game_over' };
      }
      return;
    }

    if (battle.phase === 'roll') {
      if (pointInRect(p, this.rollBtnRect)) {
        const newBattle = rerollDice(battle);
        this.state = { ...this.state, battle: newBattle };
        this.selectedDieIdx = -1;
      }
      return;
    }

    if (battle.phase === 'assign') {
      // タップ選択モード：ダイス選択中にスロットをタップ → 割り当て
      if (this.selectedDieIdx >= 0) {
        type SlotKey = 'attack' | 'defense' | 'strategy';
        for (const [key, rect] of Object.entries(this.slotRects)) {
          if (pointInRect(p, rect)) {
            const die = battle.dice[this.selectedDieIdx];
            if (die && die.assignedSlot === null) {
              const newDice = battle.dice.map((d) =>
                d.id === die.id ? { ...d, assignedSlot: key as SlotKey } : d
              );
              this.state = { ...this.state, battle: { ...battle, dice: newDice } };
              this.selectedDieIdx = -1;
              if (this.state.tutorialStep === 4) {
                const allAssigned = newDice.every((d) => d.assignedSlot !== null);
                if (allAssigned) this._advanceTutorial();
              }
            }
            return;
          }
        }
      }

      // スキルボタン
      if (pointInRect(p, this.skillBtnRect)) {
        if (canActivateSkill(battle, hero)) {
          const newBattle = activateSkill(battle, hero);
          this.state = { ...this.state, battle: newBattle };
        }
        return;
      }

      // 行動確定
      if (pointInRect(p, this.confirmBtnRect)) {
        const hasAssigned = battle.dice.some((d) => d.assignedSlot !== null);
        if (!hasAssigned || this.animBlocked) return;
        const { state: newBattle, heroDmg, enemyDmg } = executeBattle(battle, hero);
        const newHp = hero.currentHp - heroDmg;
        const newHero = { ...hero, currentHp: Math.max(0, newHp) };

        if (this.state.tutorialStep === 5) {
          this.state = { ...this.state, tutorialStep: -1 };
          this._markTutorialDone();
        }

        // アニメーション開始
        const now = performance.now();
        this.battleAnims = [];
        if (enemyDmg > 0) {
          this.battleAnims.push({ type: 'attack', value: enemyDmg, startTime: now });
        }
        if (heroDmg > 0) {
          this.battleAnims.push({ type: 'hit', value: heroDmg, startTime: now + 600 });
        }

        // アニメーション中は操作ブロック、終了後に状態反映
        const totalDelay = (heroDmg > 0 ? 1200 : 600);
        this.animBlocked = true;

        // 先にバトル状態（ログ等）を更新、HPは段階的に反映
        this.state = { ...this.state, battle: newBattle, hero: newHero };

        setTimeout(() => {
          this.animBlocked = false;
          this.battleAnims = [];
          if (newHp <= 0) {
            this.state = { ...this.state, phase: 'game_over' };
          } else if (newBattle.enemy.currentHp <= 0) {
            const nodeType = this.state.map?.nodes.find((n) => n.id === this.state.map?.currentNodeId)?.type ?? 'battle';
            const gold = getGoldReward(nodeType, this.state.map?.chapter ?? 1);
            const wasBoss = newBattle.enemy.isBoss;
            const rewardInfo = {
              goldEarned: gold,
              enemyName: newBattle.enemy.name,
              isBoss: wasBoss,
            };
            this.state = {
              ...this.state,
              phase: 'reward',
              rewardInfo,
              enemiesDefeated: this.state.enemiesDefeated + 1,
              bossesDefeated: this.state.bossesDefeated + (wasBoss ? 1 : 0),
            };
          }
        }, totalDelay);
      }
    }
  }

  private _handleRewardClick(): void {
    const { hero, rewardInfo } = this.state;
    if (!hero || !rewardInfo) return;

    const newHero = { ...hero, gold: hero.gold + rewardInfo.goldEarned };

    if (rewardInfo.isBoss) {
      const currentChapter = this.state.map?.chapter ?? 1;
      if (currentChapter >= 5) {
        this.state = { ...this.state, hero: newHero, phase: 'ending', battle: null, rewardInfo: null, chaptersReached: currentChapter };
      } else {
        const newMap = generateMap();
        newMap.chapter = currentChapter + 1;
        this.state = { ...this.state, hero: newHero, battle: null, map: newMap, phase: 'synopsis', rewardInfo: null, chaptersReached: currentChapter };
        this.mapScrollY = 0;
        this._recalcLayout();
      }
    } else {
      this.state = { ...this.state, hero: newHero, battle: null, phase: 'map', rewardInfo: null };
    }
  }

  private _handleAdvisorClick(p: { x: number; y: number }): void {
    this.advisorRects.forEach((rect, i) => {
      if (pointInRect(p, rect)) {
        const card = this.state.advisorCards[i];
        if (card) {
          this._applyAdvisorCard(card);
          this.state = { ...this.state, phase: 'map', advisorCards: [] };
        }
      }
    });
  }

  private _applyAdvisorCard(card: AdvisorCard): void {
    const { hero } = this.state;
    if (!hero) return;
    const effect = card.effect;
    if (effect.type === 'add_dice') {
      const newDiceSet = [...hero.diceSet, effect.face];
      this.state = { ...this.state, hero: { ...hero, diceSet: newDiceSet } };
    } else if (effect.type === 'upgrade_stat') {
      if (effect.stat === 'maxHp') {
        const newHero = { ...hero, stats: { ...hero.stats, maxHp: hero.stats.maxHp + effect.amount }, currentHp: hero.currentHp + effect.amount };
        this.state = { ...this.state, hero: newHero };
      } else if (effect.stat === 'attack') {
        const newHero = { ...hero, stats: { ...hero.stats, attack: hero.stats.attack + effect.amount } };
        this.state = { ...this.state, hero: newHero };
      } else if (effect.stat === 'defense') {
        const newHero = { ...hero, stats: { ...hero.stats, defense: hero.stats.defense + effect.amount } };
        this.state = { ...this.state, hero: newHero };
      }
    } else if (effect.type === 'gold') {
      this.state = { ...this.state, hero: { ...hero, gold: hero.gold + effect.amount } };
    }
    this._recalcLayout();
  }

  private _handleMerchantClick(p: { x: number; y: number }): void {
    if (pointInRect(p, this.merchantLeaveRect)) {
      this.state = { ...this.state, phase: 'map', merchantItems: [] };
      return;
    }
    this.merchantRects.forEach((rect, i) => {
      if (pointInRect(p, rect)) {
        const item = this.state.merchantItems[i];
        const hero = this.state.hero;
        if (item && hero && hero.gold >= item.cost) {
          const newHero = { ...hero, gold: hero.gold - item.cost };
          const newItems = this.state.merchantItems.filter((_, idx) => idx !== i);
          this.state = { ...this.state, hero: newHero, merchantItems: newItems };
          this._applyAdvisorCard({ id: item.id, name: item.name, description: item.description, effect: item.effect });
        }
      }
    });
  }

  private _handleRestClick(p: { x: number; y: number }): void {
    const { hero } = this.state;
    if (!hero) return;
    if (pointInRect(p, this.restHealRect)) {
      const healPercent = (30 + this._calcLegacyBonuses(this.state.legacyData).healPercent) / 100;
      const heal = Math.floor(hero.stats.maxHp * healPercent);
      const newHp = clamp(hero.currentHp + heal, 0, hero.stats.maxHp);
      this.state = { ...this.state, hero: { ...hero, currentHp: newHp }, phase: 'map' };
    } else if (pointInRect(p, this.restLeaveRect)) {
      this.state = { ...this.state, phase: 'map' };
    }
  }

  private _handleEventClick(p: { x: number; y: number }): void {
    const { currentEvent, hero, eventResult } = this.state;
    if (!currentEvent || !hero) return;

    // 結果表示中はタップで次の画面へ
    if (eventResult !== null) {
      this.state = { ...this.state, phase: 'map', currentEvent: null, eventResult: null };
      return;
    }

    this.eventOptionRects.forEach((rect, i) => {
      const opt = currentEvent.options[i];
      if (opt && pointInRect(p, rect)) {
        let newHero = { ...hero };
        let effect = opt.effect;
        let value = opt.value;
        let resultMessage: string | null = null;

        // 占い師: 50%で凶（HP-15）に変わる
        if (currentEvent.id === 'fortune_teller' && effect === 'hp_up') {
          if (Math.random() < 0.5) {
            effect = 'hp_down';
            value = 15;
            resultMessage = `凶！HP-${value}`;
          } else {
            resultMessage = `吉！HP+${value}`;
          }
        }

        if (effect === 'hp_up') {
          newHero.currentHp = clamp(hero.currentHp + value, 0, hero.stats.maxHp);
        } else if (effect === 'hp_down') {
          newHero.currentHp = Math.max(0, hero.currentHp - value);
        } else if (effect === 'gold_up') {
          newHero.gold = hero.gold + value;
        } else if (effect === 'gold_down') {
          newHero.gold = Math.max(0, hero.gold - value);
        }

        if (resultMessage !== null) {
          // 占い結果を表示してから次の画面へ（タップ待ち）
          this.state = { ...this.state, hero: newHero, eventResult: resultMessage };
        } else {
          this.state = { ...this.state, hero: newHero, phase: 'map', currentEvent: null, eventResult: null };
        }
      }
    });
  }

  private _draw(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const { phase, hero, map, battle } = this.state;

    if (phase === 'title') {
      drawTitle(ctx, w, h, this.startBtnRect, this.langBtnRects, this.state.lang, this.state.legacyData, this.legacyBtnRect);
    } else if (phase === 'character_select') {
      const unlockedHeroIds = new Set(HERO_DEFS.filter((h) => this._isHeroUnlocked(h.id)).map((h) => h.id));
      drawCharacterSelect(ctx, w, h, this.selectedHeroId, this.confirmSelectRect, this.heroRects, this.charScrollY, this.charScrollMax, unlockedHeroIds);
    } else if (phase === 'synopsis' && map) {
      drawSynopsis(ctx, w, h, map.chapter);
    } else if (phase === 'map' && map && hero) {
      drawMap(ctx, w, h, map.nodes, map.currentNodeId, map.chapter, hero.currentHp, hero.stats.maxHp, hero.gold, this.mapScrollY, this.state.mapTutorialStep, hero.portraitKey);
    } else if (phase === 'reward' && hero && this.state.rewardInfo) {
      drawReward(ctx, w, h, this.state.rewardInfo, hero);
    } else if (phase === 'battle' && battle && hero) {
      const dragInfo = this.isDragging && this.draggingDieIdx >= 0
        ? { dieIdx: this.draggingDieIdx, pos: this.dragPos }
        : null;
      drawBattle(ctx, w, h, this.state, this.diceRects, this.slotRects, this.skillBtnRect, this.confirmBtnRect, this.rollBtnRect, this.helpBtnRect, dragInfo, this.selectedDieIdx, this.battleAnims);
    } else if (phase === 'advisor') {
      drawAdvisor(ctx, w, h, this.state.advisorCards, this.advisorRects);
    } else if (phase === 'merchant' && hero) {
      drawMerchant(ctx, w, h, this.state.merchantItems, hero.gold, this.merchantRects, this.merchantLeaveRect);
    } else if (phase === 'rest' && hero) {
      drawRest(ctx, w, h, hero.currentHp, hero.stats.maxHp, this.restHealRect, this.restLeaveRect);
    } else if (phase === 'event' && this.state.currentEvent) {
      drawEvent(ctx, w, h, this.state.currentEvent, this.eventOptionRects, this.state.eventResult);
    } else if (phase === 'legacy') {
      drawLegacy(ctx, w, h, this.state.legacyData, this.legacyUpgradeRects, this.legacyBackRect, this.legacyResetRect, this.legacyHeroUnlockRects, this.legacyScrollY, this.legacyTab, this.legacyTabRects);
    } else if (phase === 'game_over') {
      drawGameOver(ctx, w, h, this.retryBtnRect);
    } else if (phase === 'ending' && hero) {
      drawEnding(ctx, w, h, hero.name, this.retryBtnRect);
    }
  }

  start(): void {
    const loop = () => {
      this._draw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animId);
  }

  // === 開発用チート（dev モードのみ有効） ===

  /** 指定章から強化状態で開始。使い方: __game.cheatStart('guan_yu', 5) */
  cheatStart(heroId: string = 'guan_yu', chapter: number = 5): void {
    if (!import.meta.env.DEV) { console.warn('Cheats disabled in production'); return; }
    const heroDef = HERO_DEFS.find((h) => h.id === heroId);
    if (!heroDef) {
      console.error(`Hero not found: ${heroId}. Available: ${HERO_DEFS.map(h => h.id).join(', ')}`);
      return;
    }

    // 章に応じた強化値
    const chapterBonus = chapter - 1;
    const bonusAttack = chapterBonus * 5;
    const bonusDefense = chapterBonus * 3;
    const bonusHp = chapterBonus * 30;
    const bonusDice: import('./types').DiceFace[] = [];
    for (let i = 0; i < chapterBonus; i++) {
      bonusDice.push('star');
      if (i % 2 === 0) bonusDice.push('sword');
      else bonusDice.push('shield');
    }

    const hero: Hero = {
      ...heroDef,
      stats: {
        ...heroDef.stats,
        maxHp: heroDef.stats.maxHp + bonusHp,
        attack: heroDef.stats.attack + bonusAttack,
        defense: heroDef.stats.defense + bonusDefense,
        diceCount: heroDef.stats.diceCount + bonusDice.length,
      },
      diceSet: [...heroDef.diceSet, ...bonusDice],
      currentHp: heroDef.stats.maxHp + bonusHp,
      gold: 100 + chapterBonus * 100,
      upgrades: [],
    };

    const map = generateMap();
    map.chapter = chapter;

    this.state = {
      ...this._initialState(),
      phase: 'synopsis',
      hero,
      map,
      tutorialStep: -1,
      mapTutorialStep: -1,
    };
    this.selectedHeroId = heroId;
    this._recalcLayout();

    console.log(`[CHEAT] Started chapter ${chapter} with ${heroDef.name}`);
    console.log(`  HP: ${hero.currentHp}, ATK: ${hero.stats.attack}, DEF: ${hero.stats.defense}, Dice: ${hero.diceSet.length}, Gold: ${hero.gold}`);
  }

  /** HP全回復。使い方: __game.cheatHeal() */
  cheatHeal(): void {
    if (!import.meta.env.DEV) { console.warn('Cheats disabled in production'); return; }
    const hero = this.state.hero;
    if (!hero) { console.error('No hero'); return; }
    this.state = {
      ...this.state,
      hero: { ...hero, currentHp: hero.stats.maxHp },
    };
    console.log(`[CHEAT] HP fully restored: ${hero.stats.maxHp}`);
  }

  /** ゴールド追加。使い方: __game.cheatGold(500) */
  cheatGold(amount: number = 500): void {
    if (!import.meta.env.DEV) { console.warn('Cheats disabled in production'); return; }
    const hero = this.state.hero;
    if (!hero) { console.error('No hero'); return; }
    this.state = {
      ...this.state,
      hero: { ...hero, gold: hero.gold + amount },
    };
    console.log(`[CHEAT] Gold +${amount} → ${hero.gold + amount}`);
  }

  /** 現在のバトルの敵HPを1にする。使い方: __game.cheatKill() */
  cheatKill(): void {
    if (!import.meta.env.DEV) { console.warn('Cheats disabled in production'); return; }
    if (!this.state.battle) { console.error('Not in battle'); return; }
    this.state = {
      ...this.state,
      battle: {
        ...this.state.battle,
        enemy: { ...this.state.battle.enemy, currentHp: 1 },
      },
    };
    console.log(`[CHEAT] Enemy HP set to 1`);
  }

  /** 宝玉を増減する。使い方: __game.cheatJade(100) で+100、__game.cheatJade(-50) で-50 */
  cheatJade(amount: number = 100): void {
    if (!import.meta.env.DEV) { console.warn('Cheats disabled in production'); return; }
    const legacy = { ...this.state.legacyData };
    legacy.legacyPoints = Math.max(0, legacy.legacyPoints + amount);
    this._saveLegacy(legacy);
    this.state = { ...this.state, legacyData: legacy };
    console.log(`[CHEAT] 宝玉 ${amount >= 0 ? '+' : ''}${amount} → ${legacy.legacyPoints}`);
  }
}
