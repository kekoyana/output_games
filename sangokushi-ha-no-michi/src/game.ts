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
  drawMap,
  drawBattle,
  drawReward,
  drawAdvisor,
  drawMerchant,
  drawRest,
  drawEvent,
  drawGameOver,
  drawEnding,
  pointInRect,
} from './renderer';
import { choose, shuffle, clamp } from './utils';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private animId: number = 0;
  private mapScrollY: number = 0;
  private charScrollY: number = 0;
  private charScrollMax: number = 0;
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = this._initialState();
    this._setupInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  private _initialState(): GameState {
    return {
      phase: 'title',
      hero: null,
      map: null,
      battle: null,
      rewardInfo: null,
      advisorCards: [],
      merchantItems: [],
      currentEvent: null,
      showHelp: false,
      battleCount: 0,
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

    // キャラクター選択（スマホ対応: カードサイズ縮小＋スクロール）
    const cols = w < 500 ? 2 : 3;
    const maxCardW = w < 500 ? 130 : 160;
    const cardW = Math.min(maxCardW, (w - 40 - (cols - 1) * 10) / cols);
    const cardH = Math.floor(cardW * (h < 700 ? 1.3 : 1.5));
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
    this.skillBtnRect = { x: panelCx - skillW / 2, y: skillY, w: skillW, h: 44 };

    // ヘルプボタン（右上）
    this.helpBtnRect = { x: w - 44, y: 8, w: 36, h: 36 };

    const btnW2 = Math.min(slotTotalW, w * 0.6);
    const btnY = skillY + 52;
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
      if (this.state.phase === 'map' || this.state.phase === 'character_select') {
        lastTouchY = e.touches[0].clientY;
      }
    });
    this.canvas.addEventListener('touchmove', (e) => {
      const phase = this.state.phase;
      if (phase === 'map') {
        e.preventDefault();
        const dy = lastTouchY - e.touches[0].clientY;
        this.mapScrollY = clamp(this.mapScrollY + dy, 0, 300);
        lastTouchY = e.touches[0].clientY;
      } else if (phase === 'character_select') {
        e.preventDefault();
        const dy = lastTouchY - e.touches[0].clientY;
        this.charScrollY = clamp(this.charScrollY + dy, 0, this.charScrollMax);
        lastTouchY = e.touches[0].clientY;
      }
    }, { passive: false });

    this.canvas.addEventListener('wheel', (e) => {
      if (this.state.phase === 'map') {
        this.mapScrollY = clamp(this.mapScrollY + e.deltaY * 0.5, 0, 300);
      } else if (this.state.phase === 'character_select') {
        this.charScrollY = clamp(this.charScrollY + e.deltaY * 0.5, 0, this.charScrollMax);
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
  }

  private _handleClick(p: { x: number; y: number }): void {
    const { phase } = this.state;

    if (phase === 'title') {
      if (pointInRect(p, this.startBtnRect)) {
        this.charScrollY = 0;
        this.state = { ...this.state, phase: 'character_select' };
      }
    } else if (phase === 'character_select') {
      const scrolled = { x: p.x, y: p.y + this.charScrollY };
      this.heroRects.forEach((rect, i) => {
        if (pointInRect(scrolled, rect)) {
          this.selectedHeroId = HERO_DEFS[i].id;
        }
      });
      if (this.selectedHeroId && pointInRect(scrolled, this.confirmSelectRect)) {
        this._startGame(this.selectedHeroId);
      }
    } else if (phase === 'map') {
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
    } else if (phase === 'game_over' || phase === 'ending') {
      if (pointInRect(p, this.retryBtnRect)) {
        this.state = this._initialState();
        this.selectedHeroId = null;
        this.mapScrollY = 0;
      }
    }
  }

  private _startGame(heroId: string): void {
    const heroDef = HERO_DEFS.find((h) => h.id === heroId);
    if (!heroDef) return;
    const hero: Hero = {
      ...heroDef,
      currentHp: heroDef.stats.maxHp,
      gold: 100,
      upgrades: [],
    };
    const map = generateMap();
    this.state = {
      ...this.state,
      phase: 'map',
      hero,
      map,
    };
    this._recalcLayout();
  }

  private _handleMapClick(p: { x: number; y: number }): void {
    const { map } = this.state;
    if (!map) return;

    const w = this.canvas.width;
    const scale = Math.min(w / 780, 1.2);
    const offsetX = w * 0.1;
    const offsetY = 60 - this.mapScrollY;

    for (const node of map.nodes) {
      if (!node.available || node.visited) continue;
      const nx = offsetX + node.x * scale;
      const ny = offsetY + node.y * scale;
      const r = 22 * scale;
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
      const tutorialBattle = newBattleCount === 1
        ? { ...battleState, message: 'ダイスをドラッグしてスロットに配置しよう！(右上の?でヘルプ)' }
        : battleState;
      this.state = { ...state, phase: 'battle', battle: tutorialBattle, battleCount: newBattleCount };
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

  private _handleBattleClick(p: { x: number; y: number }): void {
    const { battle, hero } = this.state;
    if (!battle || !hero) return;

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
        this.state = { ...this.state, phase: 'reward', rewardInfo };
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
        const { state: newBattle, heroDmg } = executeBattle(battle, hero);
        const newHp = hero.currentHp - heroDmg;
        const newHero = { ...hero, currentHp: Math.max(0, newHp) };
        const finalBattle = newHp <= 0
          ? { ...newBattle, phase: 'result' as import('./types').BattlePhase, message: '敗北...' }
          : newBattle;
        this.state = { ...this.state, battle: finalBattle, hero: newHero };
      }
    }
  }

  private _handleRewardClick(): void {
    const { hero, rewardInfo } = this.state;
    if (!hero || !rewardInfo) return;

    const newHero = { ...hero, gold: hero.gold + rewardInfo.goldEarned };

    if (rewardInfo.isBoss) {
      const currentChapter = this.state.map?.chapter ?? 1;
      if (currentChapter >= 3) {
        this.state = { ...this.state, hero: newHero, phase: 'ending', battle: null, rewardInfo: null };
      } else {
        const newMap = generateMap();
        newMap.chapter = currentChapter + 1;
        this.state = { ...this.state, hero: newHero, battle: null, map: newMap, phase: 'map', rewardInfo: null };
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
          this.state = { ...this.state, hero: newHero };
          this._applyAdvisorCard({ id: item.id, name: item.name, description: item.description, effect: item.effect });
        }
      }
    });
  }

  private _handleRestClick(p: { x: number; y: number }): void {
    const { hero } = this.state;
    if (!hero) return;
    if (pointInRect(p, this.restHealRect)) {
      const heal = Math.floor(hero.stats.maxHp * 0.3);
      const newHp = clamp(hero.currentHp + heal, 0, hero.stats.maxHp);
      this.state = { ...this.state, hero: { ...hero, currentHp: newHp }, phase: 'map' };
    } else if (pointInRect(p, this.restLeaveRect)) {
      this.state = { ...this.state, phase: 'map' };
    }
  }

  private _handleEventClick(p: { x: number; y: number }): void {
    const { currentEvent, hero } = this.state;
    if (!currentEvent || !hero) return;

    this.eventOptionRects.forEach((rect, i) => {
      const opt = currentEvent.options[i];
      if (opt && pointInRect(p, rect)) {
        let newHero = { ...hero };
        if (opt.effect === 'hp_up') {
          newHero.currentHp = clamp(hero.currentHp + opt.value, 0, hero.stats.maxHp);
        } else if (opt.effect === 'hp_down') {
          newHero.currentHp = Math.max(0, hero.currentHp - opt.value);
        } else if (opt.effect === 'gold_up') {
          newHero.gold = hero.gold + opt.value;
        } else if (opt.effect === 'gold_down') {
          newHero.gold = Math.max(0, hero.gold - opt.value);
        }
        this.state = { ...this.state, hero: newHero, phase: 'map', currentEvent: null };
      }
    });
  }

  private _draw(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const { phase, hero, map, battle } = this.state;

    if (phase === 'title') {
      drawTitle(ctx, w, h, this.startBtnRect);
    } else if (phase === 'character_select') {
      drawCharacterSelect(ctx, w, h, this.selectedHeroId, this.confirmSelectRect, this.heroRects, this.charScrollY, this.charScrollMax);
    } else if (phase === 'map' && map && hero) {
      drawMap(ctx, w, h, map.nodes, map.currentNodeId, map.chapter, hero.currentHp, hero.stats.maxHp, hero.gold, this.mapScrollY);
    } else if (phase === 'reward' && hero && this.state.rewardInfo) {
      drawReward(ctx, w, h, this.state.rewardInfo, hero);
    } else if (phase === 'battle' && battle && hero) {
      const dragInfo = this.isDragging && this.draggingDieIdx >= 0
        ? { dieIdx: this.draggingDieIdx, pos: this.dragPos }
        : null;
      drawBattle(ctx, w, h, this.state, this.diceRects, this.slotRects, this.skillBtnRect, this.confirmBtnRect, this.rollBtnRect, this.helpBtnRect, dragInfo, this.selectedDieIdx);
    } else if (phase === 'advisor') {
      drawAdvisor(ctx, w, h, this.state.advisorCards, this.advisorRects);
    } else if (phase === 'merchant' && hero) {
      drawMerchant(ctx, w, h, this.state.merchantItems, hero.gold, this.merchantRects, this.merchantLeaveRect);
    } else if (phase === 'rest' && hero) {
      drawRest(ctx, w, h, hero.currentHp, hero.stats.maxHp, this.restHealRect, this.restLeaveRect);
    } else if (phase === 'event' && this.state.currentEvent) {
      drawEvent(ctx, w, h, this.state.currentEvent, this.eventOptionRects);
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
}
