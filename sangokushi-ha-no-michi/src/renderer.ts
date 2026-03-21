import type { GameState, MapNode, Die, Rect } from './types';
import {
  drawRoundRect,
  drawButton,
  drawText,
  drawPanel,
  drawHpBar,
  wrapText,
  pointInRect,
} from './utils';
import {
  DICE_LABELS,
  DICE_COLORS,
  NODE_COLORS,
  NODE_LABELS,
  FACTION_COLORS,
  FACTION_NAMES,
  HERO_DEFS,
} from './data';

const BG_COLOR = '#1a1a2e';
const PANEL_BG = '#f5e6c8';
const PANEL_BORDER = '#8b6914';
const TEXT_DARK = '#2c1810';
const TEXT_LIGHT = '#f5e6c8';
const GOLD_COLOR = '#f1c40f';

type ImageCache = Record<string, HTMLImageElement>;

let imageCache: ImageCache = {};

export function loadImages(paths: Record<string, string>): Promise<void> {
  const promises = Object.entries(paths).map(([key, path]) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        imageCache[key] = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load image: ${path}`);
        resolve();
      };
      img.src = path;
    });
  });
  return Promise.all(promises).then(() => undefined);
}

function getImage(key: string): HTMLImageElement | null {
  return imageCache[key] ?? null;
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  startBtn: Rect
): void {
  // 背景
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  // 装飾的な円
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.arc(w * 0.15, h * 0.2, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(w * 0.85, h * 0.7, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // タイトル
  ctx.save();
  ctx.shadowColor = '#f1c40f';
  ctx.shadowBlur = 20;
  drawText(ctx, '三国志', w / 2, h * 0.25, `bold ${Math.min(60, w / 10)}px serif`, GOLD_COLOR, 'center', 'middle');
  drawText(ctx, 'ダイス英傑伝', w / 2, h * 0.35, `bold ${Math.min(48, w / 13)}px serif`, TEXT_LIGHT, 'center', 'middle');
  ctx.restore();

  // サブタイトル
  drawText(
    ctx, '劉備軍と共に乱世をダイスで切り拓け',
    w / 2, h * 0.48, `${Math.min(18, w / 40)}px serif`, '#aaa', 'center', 'middle'
  );

  // 勢力カラー説明
  const factions = [
    { name: '蜀', color: '#2ecc71' },
    { name: '魏', color: '#3498db' },
    { name: '呉', color: '#e74c3c' },
  ];
  const fw = Math.min(120, w / 5);
  const totalW = fw * 3 + 20;
  const fx0 = (w - totalW) / 2;
  factions.forEach((f, i) => {
    ctx.fillStyle = f.color;
    ctx.globalAlpha = 0.8;
    drawRoundRect(ctx, fx0 + i * (fw + 10), h * 0.56, fw, 34, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawText(ctx, f.name, fx0 + i * (fw + 10) + fw / 2, h * 0.56 + 17, 'bold 18px serif', '#fff', 'center', 'middle');
  });

  // スタートボタン
  drawButton(ctx, startBtn, 'ゲーム開始', GOLD_COLOR, TEXT_DARK, Math.min(22, w / 30), 10);

  // 操作説明
  drawText(ctx, 'クリック/タップで操作', w / 2, h * 0.88, '14px serif', '#666', 'center', 'middle');
}

export function drawCharacterSelect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  selectedId: string | null,
  confirmBtn: Rect,
  heroRects: Rect[],
  scrollY: number = 0,
  scrollMax: number = 0
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  drawText(ctx, '武将を選べ', w / 2, 16, `bold ${Math.min(28, w / 20)}px serif`, GOLD_COLOR, 'center', 'top');

  ctx.save();
  ctx.translate(0, -scrollY);

  const cols = w < 500 ? 2 : 3;
  const maxCardW = w < 500 ? 130 : 160;
  const cardW = Math.min(maxCardW, (w - 40 - (cols - 1) * 10) / cols);
  const cardH = heroRects[0]?.h ?? cardW * 1.3;

  HERO_DEFS.forEach((hero, i) => {
    const rect = heroRects[i];
    if (!rect) return;

    const isSelected = hero.id === selectedId;
    const factionColor = FACTION_COLORS[hero.faction];

    // カード背景
    drawPanel(ctx, rect, isSelected ? '#2c2c4e' : '#1e1e3a', isSelected ? factionColor : '#555', 8);

    if (isSelected) {
      ctx.save();
      ctx.shadowColor = factionColor;
      ctx.shadowBlur = 15;
      drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.strokeStyle = factionColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // ポートレート
    const img = getImage(hero.portraitKey);
    const imgSize = Math.min(cardW - 16, cardH * 0.45);
    const imgX = rect.x + (rect.w - imgSize) / 2;
    const imgY = rect.y + 10;

    if (img) {
      ctx.save();
      ctx.beginPath();
      drawRoundRect(ctx, imgX, imgY, imgSize, imgSize, 6);
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
      ctx.restore();
    } else {
      ctx.fillStyle = '#333';
      drawRoundRect(ctx, imgX, imgY, imgSize, imgSize, 6);
      ctx.fill();
      drawText(ctx, hero.name[0], imgX + imgSize / 2, imgY + imgSize / 2, `bold ${imgSize * 0.4}px serif`, factionColor, 'center', 'middle');
    }

    // 勢力バッジ
    ctx.fillStyle = factionColor;
    ctx.globalAlpha = 0.85;
    drawRoundRect(ctx, rect.x + 4, rect.y + 4, 34, 20, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawText(ctx, FACTION_NAMES[hero.faction], rect.x + 21, rect.y + 14, 'bold 12px serif', '#fff', 'center', 'middle');

    const textY = imgY + imgSize + 6;
    drawText(ctx, hero.name, rect.x + rect.w / 2, textY, `bold ${Math.min(16, cardW / 9)}px serif`, TEXT_LIGHT, 'center', 'top');

    const statY = textY + 22;
    const statFont = `${Math.min(11, cardW / 14)}px serif`;
    drawText(ctx, `HP:${hero.stats.maxHp} 攻:${hero.stats.attack} 防:${hero.stats.defense}`, rect.x + rect.w / 2, statY, statFont, '#ccc', 'center', 'top');

    const skillY = statY + 16;
    drawText(ctx, `◆${hero.skill.name}`, rect.x + rect.w / 2, skillY, `${Math.min(11, cardW / 14)}px serif`, GOLD_COLOR, 'center', 'top');
  });

  if (selectedId) {
    drawButton(ctx, confirmBtn, 'この武将で出陣！', GOLD_COLOR, TEXT_DARK, Math.min(20, w / 32), 8);
  }

  ctx.restore(); // スクロール translate を戻す

  // スクロールインジケーター
  if (scrollMax > 0) {
    const barH = Math.max(30, h * (h / (h + scrollMax)));
    const barY = (scrollY / scrollMax) * (h - barH);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    drawRoundRect(ctx, w - 6, barY, 4, barH, 2);
    ctx.fill();
  }
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nodes: MapNode[],
  currentNodeId: number | null,
  chapter: number,
  heroHp: number,
  heroMaxHp: number,
  heroGold: number,
  scrollY: number
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  // ヘッダー
  drawPanel(ctx, { x: 0, y: 0, w, h: 50 }, '#0d0d1e', '#333');
  const chapterNames: Record<number, string> = { 1: '黄巾の乱', 2: '董卓の専横', 3: '赤壁の戦い' };
  const chapterTitle = chapterNames[chapter] ?? '';
  drawText(ctx, `第${chapter}章 ${chapterTitle}`, w / 2, 25, 'bold 20px serif', GOLD_COLOR, 'center', 'middle');
  drawText(ctx, `HP: ${heroHp}/${heroMaxHp}`, 20, 25, '16px serif', '#2ecc71', 'left', 'middle');
  drawText(ctx, `金: ${heroGold}`, w - 90, 25, '16px serif', GOLD_COLOR, 'right', 'middle');

  ctx.save();
  ctx.translate(w * 0.1, 60 - scrollY);

  const scale = Math.min(w / 780, 1.2);
  ctx.scale(scale, scale);

  // ノード間の接続線を描画
  for (const node of nodes) {
    for (const connId of node.connections) {
      const conn = nodes.find((n) => n.id === connId);
      if (!conn) continue;

      const isVisited = node.visited && conn.visited;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(conn.x, conn.y);
      ctx.strokeStyle = isVisited ? '#555' : '#666';
      ctx.lineWidth = isVisited ? 1 : 2;
      ctx.setLineDash(isVisited ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ノードを描画
  for (const node of nodes) {
    const r = 22;
    const isCurrent = node.id === currentNodeId;
    const isAvailable = node.available;
    const isVisited = node.visited;

    let color = NODE_COLORS[node.type] || '#888';

    if (isVisited) {
      ctx.globalAlpha = 0.4;
    } else if (isAvailable) {
      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalAlpha = 0.5;
    }

    // 外枠のグロー
    if (isAvailable && !isVisited) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1.0;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isCurrent ? '#fff' : '#aaa';
    ctx.lineWidth = isCurrent ? 3 : 1.5;
    ctx.stroke();

    ctx.globalAlpha = 1.0;

    const label = NODE_LABELS[node.type] || node.type;
    const fontSize = Math.min(12, 200 / label.length);
    drawText(ctx, label, node.x, node.y, `bold ${fontSize}px serif`, '#fff', 'center', 'middle');
  }

  ctx.restore();
}

export function drawBattle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: GameState,
  diceRects: Rect[],
  slotRects: Record<string, Rect>,
  skillBtnRect: Rect,
  confirmBtnRect: Rect,
  rollBtnRect: Rect,
  helpBtnRect: Rect,
  dragInfo: { dieIdx: number; pos: { x: number; y: number } } | null = null,
  selectedDieIdx: number = -1
): void {
  const battle = state.battle!;
  const hero = state.hero!;

  // 背景画像
  const bgImg = getImage('battle_background');
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);
  }

  const isLandscape = w > h;
  const panelH = isLandscape ? h * 0.35 : h * 0.28;
  const panelY = h - panelH - 10;
  const panelW = w - 20;

  // 敵表示エリア（上半分）
  const enemyAreaH = panelY - 10;
  _drawEnemy(ctx, w, enemyAreaH, battle.enemy, isLandscape);

  // 英雄HP
  _drawHeroStatus(ctx, w, h, hero, battle.heroBlock, isLandscape);

  // 下部パネル
  drawPanel(ctx, { x: 10, y: panelY, w: panelW, h: panelH + 5 }, 'rgba(20,15,10,0.92)', PANEL_BORDER, 10);

  // ターン情報
  drawText(ctx, `ターン ${battle.turnCount}  ${battle.message}`, 20, panelY + 8, '13px serif', GOLD_COLOR, 'left', 'top');

  // アクションスロット（ドラッグ中/選択中はハイライト）
  _drawSlots(ctx, slotRects, battle.dice, hero, dragInfo, selectedDieIdx);

  // ダイス描画（ドラッグ中のダイスは元位置を半透明に、選択中は光らせる）
  battle.dice.forEach((die, i) => {
    const rect = diceRects[i];
    if (!rect) return;
    if (dragInfo && dragInfo.dieIdx === i) {
      // ドラッグ中：元位置にゴースト表示
      ctx.save();
      ctx.globalAlpha = 0.25;
      _drawDie(ctx, rect, die);
      ctx.restore();
    } else if (i === selectedDieIdx && die.assignedSlot === null) {
      // タップ選択中：グロー表示
      ctx.save();
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 14;
      _drawDie(ctx, rect, die);
      // 選択枠
      drawRoundRect(ctx, rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4, 8);
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    } else {
      _drawDie(ctx, rect, die);
    }
  });

  // ドラッグ中のダイスをカーソル位置に描画
  if (dragInfo && battle.dice[dragInfo.dieIdx]) {
    const die = battle.dice[dragInfo.dieIdx];
    const dieSize = diceRects[0]?.w ?? 52;
    const dragRect: Rect = {
      x: dragInfo.pos.x - dieSize / 2,
      y: dragInfo.pos.y - dieSize / 2,
      w: dieSize,
      h: dieSize,
    };
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 12;
    _drawDie(ctx, dragRect, { ...die, assignedSlot: null });
    ctx.restore();
  }

  // スキルボタン
  _drawSkillButton(ctx, skillBtnRect, hero, _canSkill(battle, hero));

  // 行動確定ボタン
  if (battle.phase === 'assign') {
    const hasAssigned = battle.dice.some((d) => d.assignedSlot !== null);
    drawButton(ctx, confirmBtnRect, '行動確定', hasAssigned ? '#e74c3c' : '#555', '#fff', 16, 8);
  } else if (battle.phase === 'roll') {
    drawButton(ctx, rollBtnRect, 'ダイスロール！', '#2980b9', '#fff', 16, 8);
  }

  // バトルログ
  const logX = w * 0.55;
  const logY = panelY + 28;
  battle.log.slice(-4).forEach((line, i) => {
    drawText(ctx, line, logX, logY + i * 16, '12px serif', '#ddd', 'left', 'top');
  });

  // ヒントテキスト（assignフェーズ）
  if (battle.phase === 'assign' && !dragInfo) {
    const allUnassigned = battle.dice.filter((d) => d.assignedSlot === null || d.assignedSlot === 'skill').length === battle.dice.length;
    if (selectedDieIdx >= 0) {
      drawText(ctx, 'スロットをタップして配置', w / 2, panelY - 6, 'bold 13px serif', '#f1c40f', 'center', 'bottom');
    } else if (allUnassigned) {
      drawText(ctx, 'ドラッグ or タップでダイスを配置', w / 2, panelY - 6, 'bold 13px serif', '#f1c40f', 'center', 'bottom');
    }
  }

  // ヘルプボタン
  _drawHelpButton(ctx, helpBtnRect);

  // 結果メッセージ
  if (battle.phase === 'result') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);
    const winColor = battle.enemy.currentHp <= 0 ? '#2ecc71' : '#e74c3c';
    const winText = battle.enemy.currentHp <= 0 ? '勝利！' : '敗北...';
    ctx.save();
    ctx.shadowColor = winColor;
    ctx.shadowBlur = 20;
    drawText(ctx, winText, w / 2, h / 2, `bold ${Math.min(60, w / 8)}px serif`, winColor, 'center', 'middle');
    ctx.restore();
    drawText(ctx, 'タップで続ける', w / 2, h / 2 + 60, '20px serif', '#ccc', 'center', 'top');
  }

  // ヘルプオーバーレイ
  if (state.showHelp) {
    _drawHelpOverlay(ctx, w, h, hero);
  }
}

function _drawEnemy(
  ctx: CanvasRenderingContext2D,
  w: number,
  areaH: number,
  enemy: import('./types').Enemy,
  isLandscape: boolean
): void {
  const cx = isLandscape ? w * 0.7 : w / 2;
  const portraitSize = Math.min(areaH * 0.5, isLandscape ? 180 : 140);
  const portraitX = cx - portraitSize / 2;
  const portraitY = areaH * 0.05;

  const img = getImage(enemy.portraitKey);
  if (img) {
    ctx.save();
    ctx.beginPath();
    drawRoundRect(ctx, portraitX, portraitY, portraitSize, portraitSize, 8);
    ctx.clip();
    ctx.drawImage(img, portraitX, portraitY, portraitSize, portraitSize);
    ctx.restore();
  } else {
    ctx.fillStyle = '#2c2c2c';
    drawRoundRect(ctx, portraitX, portraitY, portraitSize, portraitSize, 8);
    ctx.fill();
    drawText(ctx, enemy.name[0], cx, portraitY + portraitSize / 2, `bold ${portraitSize * 0.4}px serif`, '#e74c3c', 'center', 'middle');
  }

  // 敵名
  drawText(ctx, enemy.name, cx, portraitY + portraitSize + 6, `bold ${Math.min(20, w / 25)}px serif`, '#fff', 'center', 'top');

  // HP バー
  const barW = Math.min(200, w * 0.35);
  const barX = cx - barW / 2;
  drawHpBar(ctx, barX, portraitY + portraitSize + 30, barW, 14, enemy.currentHp, enemy.maxHp, '#e74c3c');
  drawText(ctx, `${enemy.currentHp}/${enemy.maxHp}`, cx, portraitY + portraitSize + 46, '13px serif', '#fff', 'center', 'top');

  // インテント表示（具体的なダメージ数値付き）
  const intentText = _intentLabelWithDmg(enemy);
  const intentColor = enemy.currentIntent === 'attack' || enemy.currentIntent === 'special' ? '#e74c3c' : '#3498db';
  drawText(ctx, `次の行動: ${intentText}`, cx, portraitY + portraitSize + 62, 'bold 14px serif', intentColor, 'center', 'top');

  // 攻撃力・防御力の常時表示
  drawText(ctx, `攻:${enemy.attack}  防:${enemy.defense}`, cx, portraitY + portraitSize + 80, '12px serif', '#aaa', 'center', 'top');

  // 状態異常
  const statusY = portraitY + portraitSize + 96;
  if (enemy.stunned) {
    drawText(ctx, '[行動不能]', cx, statusY, 'bold 13px serif', '#9b59b6', 'center', 'top');
  }
  if (enemy.buffed) {
    drawText(ctx, '[強化中 攻撃1.5倍]', cx, statusY, 'bold 13px serif', '#e67e22', 'center', 'top');
  }
}

function _intentLabelWithDmg(enemy: import('./types').Enemy): string {
  const intent = enemy.currentIntent;
  const atk = enemy.buffed ? Math.floor(enemy.attack * 1.5) : enemy.attack;
  if (intent === 'attack') return `⚔ 攻撃 ${atk}dmg`;
  if (intent === 'special') return `☆ 必殺技 ${atk * 2}dmg`;
  if (intent === 'defend') return `🛡 防御 +${enemy.defense}blk`;
  if (intent === 'buff') return '⬆ 強化（次の攻撃1.5倍）';
  return intent;
}

function _intentLabel(intent: string): string {
  const labels: Record<string, string> = {
    attack: '⚔ 攻撃',
    defend: '🛡 防御',
    buff: '⬆ 強化',
    special: '☆ 必殺技',
  };
  return labels[intent] ?? intent;
}

function _drawHeroStatus(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hero: import('./types').Hero,
  block: number,
  isLandscape: boolean
): void {
  const x = isLandscape ? 20 : 20;
  const y = 20;
  const factionColor = FACTION_COLORS[hero.faction];

  const img = getImage(hero.portraitKey);
  const size = Math.min(70, w * 0.12);
  if (img) {
    ctx.save();
    ctx.beginPath();
    drawRoundRect(ctx, x, y, size, size, 6);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = '#333';
    drawRoundRect(ctx, x, y, size, size, 6);
    ctx.fill();
    drawText(ctx, hero.name[0], x + size / 2, y + size / 2, `bold ${size * 0.4}px serif`, factionColor, 'center', 'middle');
  }

  drawText(ctx, hero.name, x + size + 8, y + 4, 'bold 15px serif', factionColor, 'left', 'top');
  drawHpBar(ctx, x + size + 8, y + 24, 120, 12, hero.currentHp, hero.stats.maxHp, '#2ecc71');
  drawText(ctx, `${hero.currentHp}/${hero.stats.maxHp}`, x + size + 8, y + 38, '12px serif', '#aaa', 'left', 'top');
  if (block > 0) {
    drawText(ctx, `🛡 ${block}`, x + size + 8, y + 54, 'bold 13px serif', '#3498db', 'left', 'top');
  }
}

function _drawDie(ctx: CanvasRenderingContext2D, rect: Rect, die: Die): void {
  const isAssigned = die.assignedSlot !== null;
  const color = DICE_COLORS[die.face];

  ctx.save();
  if (isAssigned) {
    ctx.globalAlpha = 0.5;
  }

  // 木製ダイス風
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#8B4513');
  grad.addColorStop(0.5, '#A0522D');
  grad.addColorStop(1, '#6B3410');
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
  ctx.fillStyle = grad;
  ctx.fill();

  // 色付き外枠
  ctx.strokeStyle = isAssigned ? '#444' : color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // アイコン
  drawText(ctx, DICE_LABELS[die.face], rect.x + rect.w / 2, rect.y + rect.h / 2 - 2, `${rect.h * 0.45}px serif`, '#fff', 'center', 'middle');

  ctx.restore();

  // 割り当て済みスロット名
  if (isAssigned && die.assignedSlot !== 'skill') {
    const slotLabel: Record<string, string> = { attack: '攻', defense: '防', strategy: '策', skill: '技' };
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    drawRoundRect(ctx, rect.x, rect.y + rect.h - 16, rect.w, 16, 3);
    ctx.fill();
    drawText(ctx, slotLabel[die.assignedSlot ?? 'attack'] ?? '', rect.x + rect.w / 2, rect.y + rect.h - 8, 'bold 11px serif', '#fff', 'center', 'middle');
  }
}

function _drawSlots(
  ctx: CanvasRenderingContext2D,
  slotRects: Record<string, Rect>,
  dice: Die[],
  hero: import('./types').Hero,
  dragInfo: { dieIdx: number; pos: { x: number; y: number } } | null = null,
  selectedDieIdx: number = -1
): void {
  const slotLabels: Record<string, string> = {
    attack: '⚔ 攻撃',
    defense: '🛡 防御',
    strategy: '📜 策略',
  };
  const slotColors: Record<string, string> = {
    attack: '#c0392b',
    defense: '#2980b9',
    strategy: '#8e44ad',
  };

  for (const [slotKey, rect] of Object.entries(slotRects)) {
    const count = dice.filter((d) => d.assignedSlot === slotKey).length;
    // ドラッグ中にスロット上にいる場合、またはダイス選択中はハイライト
    const isHovered = dragInfo !== null && _pointInRect(dragInfo.pos, rect);
    const isSelecting = selectedDieIdx >= 0 && dice[selectedDieIdx]?.assignedSlot === null;
    const highlight = isHovered || isSelecting;
    if (highlight) {
      ctx.save();
      ctx.shadowColor = slotColors[slotKey] ?? '#fff';
      ctx.shadowBlur = 16;
    }
    drawPanel(ctx, rect, highlight ? 'rgba(60,40,20,0.95)' : 'rgba(30,20,10,0.8)', slotColors[slotKey] ?? '#666', 6);
    if (highlight) {
      // ハイライト枠
      drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    drawText(ctx, slotLabels[slotKey] ?? slotKey, rect.x + rect.w / 2, rect.y + 6, '11px serif', '#ccc', 'center', 'top');
    if (count > 0) {
      ctx.fillStyle = slotColors[slotKey] ?? '#fff';
      ctx.beginPath();
      ctx.arc(rect.x + rect.w - 12, rect.y + 12, 9, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, String(count), rect.x + rect.w - 12, rect.y + 12, 'bold 12px serif', '#fff', 'center', 'middle');
    }
    // 予測ダメージ/ブロック表示（出目に応じた実際の値）
    const slotDice = dice.filter((d) => d.assignedSlot === slotKey);
    let previewText = 'ここにドロップ';
    let previewColor = '#888';
    if (slotDice.length > 0) {
      if (slotKey === 'attack') {
        let dmg = 0;
        for (const d of slotDice) {
          if (d.face === 'sword' || d.face === 'star') dmg += hero.stats.attack;
          else if (d.face === 'arrow') dmg += Math.floor(hero.stats.attack * 1.2);
          else if (d.face === 'horse') dmg += Math.floor(hero.stats.attack * 0.5);
          else if (d.face === 'strategy') dmg += Math.floor(hero.stats.attack * 0.3);
          else if (d.face === 'shield') dmg += Math.floor(hero.stats.attack * 0.2);
        }
        previewText = `${dmg} dmg`;
        previewColor = '#ff9999';
      } else if (slotKey === 'defense') {
        let blk = 0;
        for (const d of slotDice) {
          if (d.face === 'shield' || d.face === 'star') blk += hero.stats.defense;
          else if (d.face === 'horse') blk += Math.floor(hero.stats.defense * 0.7);
          else if (d.face === 'sword' || d.face === 'arrow') blk += Math.floor(hero.stats.defense * 0.3);
          else if (d.face === 'strategy') blk += Math.floor(hero.stats.defense * 0.2);
        }
        previewText = `${blk} blk`;
        previewColor = '#99ccff';
      } else if (slotKey === 'strategy') {
        let bonus = 0;
        for (const d of slotDice) {
          if (d.face === 'strategy' || d.face === 'star') bonus += Math.floor(hero.stats.attack * 0.6);
          else if (d.face === 'sword' || d.face === 'arrow') bonus += Math.floor(hero.stats.attack * 0.2);
        }
        previewText = bonus > 0 ? `${bonus} dmg` : '効果なし';
        previewColor = bonus > 0 ? '#cc99ff' : '#666';
      }
    }
    drawText(ctx, previewText, rect.x + rect.w / 2, rect.y + rect.h - 14, 'bold 10px serif', previewColor, 'center', 'top');
  }
}

function _pointInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function _canSkill(battle: import('./types').BattleState, hero: import('./types').Hero): boolean {
  const { face, count } = hero.skill.cost;
  const available = battle.dice.filter(
    (d) => (d.face === face || d.face === 'star') && d.assignedSlot === null
  );
  return available.length >= count && !battle.skillActivated && battle.phase === 'assign';
}

function _getSkillEffectLabel(hero: import('./types').Hero): string {
  const effect = hero.skill.effect;
  const atk = hero.stats.attack;
  if (effect === 'all_attack') {
    return `全体攻撃+${Math.floor(atk * 1.5)}dmg`;
  } else if (effect === 'buff_swords') {
    return '剣ダイス×1.5';
  } else if (effect === 'invincible_counter') {
    return `無敵+反撃${atk * 2}dmg`;
  } else if (effect === 'stun_enemy') {
    return '敵1T行動不能';
  } else if (effect === 'shield_to_attack') {
    return '盾→攻撃転用';
  }
  return '';
}

function _drawSkillButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  hero: import('./types').Hero,
  canSkill: boolean
): void {
  const skillColor = canSkill ? '#9b59b6' : '#555';
  const textColor = canSkill ? '#fff' : '#888';
  drawPanel(ctx, rect, skillColor, canSkill ? '#d8a4f8' : '#333', 6);

  const { face, count } = hero.skill.cost;
  const faceLabel: Record<import('./types').DiceFace, string> = {
    sword: '剣', shield: '盾', strategy: '策', horse: '馬', arrow: '弓', star: '星',
  };
  const costStr = `${faceLabel[face]}×${count}`;
  const effectStr = _getSkillEffectLabel(hero);

  const cx = rect.x + rect.w / 2;
  drawText(ctx, hero.skill.name, cx, rect.y + 6, 'bold 11px serif', textColor, 'center', 'top');
  drawText(ctx, costStr, cx, rect.y + 22, '10px serif', canSkill ? '#f8c' : '#666', 'center', 'top');
  drawText(ctx, effectStr, cx, rect.y + 35, '10px serif', canSkill ? '#cfc' : '#555', 'center', 'top');
}

function _drawHelpButton(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.save();
  ctx.fillStyle = 'rgba(40,30,20,0.85)';
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.strokeStyle = GOLD_COLOR;
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.stroke();
  drawText(ctx, '?', rect.x + rect.w / 2, rect.y + rect.h / 2, 'bold 20px serif', GOLD_COLOR, 'center', 'middle');
  ctx.restore();
}

function _drawHelpOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hero: import('./types').Hero
): void {
  // 半透明背景
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, w, h);

  const panelW = Math.min(w - 40, 480);
  const panelX = (w - panelW) / 2;
  const panelY = h * 0.04;
  const panelH = h * 0.92;

  drawPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, '#12100e', GOLD_COLOR, 12);

  const atk = hero.stats.attack;
  const def = hero.stats.defense;

  let y = panelY + 16;
  const lx = panelX + 16;
  const lineH = 18;
  const titleFont = 'bold 14px serif';
  const bodyFont = '12px serif';

  drawText(ctx, 'ヘルプ — バトルの遊び方', panelX + panelW / 2, y, 'bold 16px serif', GOLD_COLOR, 'center', 'top');
  y += 26;

  // ダイスの出目と効果
  drawText(ctx, '■ 出目×スロットの相性（適材適所が重要！）', lx, y, titleFont, '#f1c40f', 'left', 'top');
  y += lineH + 2;
  const diceHelp: [string, string][] = [
    ['⚔ 剣', `攻撃◎(${atk}) 防御△(${Math.floor(def * 0.3)}) 策略△(${Math.floor(atk * 0.2)})`],
    ['🛡 盾', `防御◎(${def}) 攻撃×(${Math.floor(atk * 0.2)}) 策略×(0)`],
    ['📜 策', `策略◎(${Math.floor(atk * 0.6)}) 攻撃×(${Math.floor(atk * 0.3)}) 防御×(${Math.floor(def * 0.2)})`],
    ['🐴 馬', `攻撃△(${Math.floor(atk * 0.5)}) 防御○(${Math.floor(def * 0.7)}) スキルコスト用`],
    ['🏹 弓', `攻撃◎貫通(${Math.floor(atk * 1.2)}) 策略△(${Math.floor(atk * 0.2)})`],
    ['⭐ 星', 'ワイルド！どのスロットでも◎の効果'],
  ];
  for (const [icon, desc] of diceHelp) {
    drawText(ctx, icon, lx + 4, y, bodyFont, '#fff', 'left', 'top');
    drawText(ctx, desc, lx + 30, y, bodyFont, '#ccc', 'left', 'top');
    y += lineH;
  }

  y += 6;
  // スロットの効果
  drawText(ctx, '■ スロットの役割', lx, y, titleFont, '#f1c40f', 'left', 'top');
  y += lineH + 2;
  const slotHelp: [string, string][] = [
    ['⚔ 攻撃', '敵にダメージ（剣/弓/星が高効果）'],
    ['🛡 防御', '敵攻撃をブロック（盾/星が高効果）'],
    ['📜 策略', '追加ダメージ（策/星が高効果）'],
  ];
  for (const [slot, desc] of slotHelp) {
    drawText(ctx, slot, lx + 4, y, bodyFont, '#fff', 'left', 'top');
    drawText(ctx, desc, lx + 50, y, bodyFont, '#ccc', 'left', 'top');
    y += lineH;
  }

  y += 6;
  // 操作方法
  drawText(ctx, '■ 操作方法', lx, y, titleFont, '#f1c40f', 'left', 'top');
  y += lineH + 2;
  const opHelp: string[] = [
    'ダイスをドラッグ → スロットにドロップして割り当て',
    'またはダイスをタップ → スロットをタップでも割り当て可',
    '割当済みダイスをタップ → 割り当て解除',
    'スキルボタン → コストを消費して特殊能力を発動',
    '行動確定 → このターンの行動を実行して敵ターンへ',
  ];
  for (const op of opHelp) {
    drawText(ctx, '・' + op, lx, y, bodyFont, '#ccc', 'left', 'top');
    y += lineH;
  }

  y += 10;
  drawText(ctx, '画面タップで閉じる', panelX + panelW / 2, y, 'bold 13px serif', '#999', 'center', 'top');
}

export function drawReward(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  reward: import('./types').RewardInfo,
  hero: import('./types').Hero
): void {
  // 背景
  const bgImg = getImage('battle_background');
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);
  }

  // パネル
  const panelW = Math.min(w - 40, 400);
  const panelH = Math.min(h * 0.55, 320);
  const panelX = (w - panelW) / 2;
  const panelY = (h - panelH) / 2 - 20;
  drawPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, 'rgba(20,15,10,0.95)', GOLD_COLOR, 12);

  // タイトル
  ctx.save();
  ctx.shadowColor = '#f1c40f';
  ctx.shadowBlur = 15;
  const titleText = reward.isBoss ? '大勝利！' : '勝利！';
  drawText(ctx, titleText, w / 2, panelY + 30, `bold ${Math.min(36, w / 12)}px serif`, GOLD_COLOR, 'center', 'middle');
  ctx.restore();

  // 敵名
  drawText(ctx, `${reward.enemyName} を撃破！`, w / 2, panelY + 65, '18px serif', '#ccc', 'center', 'middle');

  // 報酬一覧
  const rewardY = panelY + 105;
  const lineH = 44;

  // ゴールド報酬
  ctx.fillStyle = 'rgba(241,196,15,0.12)';
  drawRoundRect(ctx, panelX + 20, rewardY, panelW - 40, 36, 6);
  ctx.fill();
  drawText(ctx, '報酬金', panelX + 40, rewardY + 18, 'bold 16px serif', '#aaa', 'left', 'middle');
  drawText(ctx, `+${reward.goldEarned} 両`, panelX + panelW - 40, rewardY + 18, 'bold 20px serif', GOLD_COLOR, 'right', 'middle');

  // スコア報酬
  ctx.fillStyle = 'rgba(46,204,113,0.12)';
  drawRoundRect(ctx, panelX + 20, rewardY + lineH, panelW - 40, 36, 6);
  ctx.fill();
  drawText(ctx, 'スコア', panelX + 40, rewardY + lineH + 18, 'bold 16px serif', '#aaa', 'left', 'middle');
  drawText(ctx, `+${reward.scoreEarned}`, panelX + panelW - 40, rewardY + lineH + 18, 'bold 20px serif', '#2ecc71', 'right', 'middle');

  // 現在の所持金・スコア
  const summaryY = rewardY + lineH * 2 + 16;
  drawText(ctx, `所持金: ${hero.gold} → ${hero.gold + reward.goldEarned} 両`, w / 2, summaryY, '14px serif', '#999', 'center', 'middle');

  // ボスの場合は次の章の案内
  if (reward.isBoss) {
    drawText(ctx, '次の章へ進む...', w / 2, summaryY + 28, 'bold 15px serif', '#f39c12', 'center', 'middle');
  }

  // 続行プロンプト
  drawText(ctx, 'タップで続ける', w / 2, panelY + panelH - 20, '15px serif', '#888', 'center', 'middle');
}

export function drawAdvisor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cards: import('./types').AdvisorCard[],
  cardRects: Rect[]
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);
  drawText(ctx, '軍師の進言 — カードを1枚選べ', w / 2, 30, `bold ${Math.min(24, w / 20)}px serif`, GOLD_COLOR, 'center', 'top');

  cards.forEach((card, i) => {
    const rect = cardRects[i];
    if (!rect) return;
    drawPanel(ctx, rect, '#1e2a3a', '#4a90d9', 10);
    drawText(ctx, card.name, rect.x + rect.w / 2, rect.y + 16, 'bold 16px serif', '#fff', 'center', 'top');
    wrapText(ctx, card.description, rect.x + 10, rect.y + 46, rect.w - 20, 18, '13px serif', '#ccc');
  });
}

export function drawMerchant(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  items: import('./types').MerchantItem[],
  gold: number,
  itemRects: Rect[],
  leaveBtn: Rect
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);
  drawText(ctx, '商人の店', w / 2, 28, `bold ${Math.min(26, w / 20)}px serif`, GOLD_COLOR, 'center', 'top');
  drawText(ctx, `所持金: ${gold}両`, w - 20, 30, '16px serif', GOLD_COLOR, 'right', 'middle');

  items.forEach((item, i) => {
    const rect = itemRects[i];
    if (!rect) return;
    const canBuy = gold >= item.cost;
    drawPanel(ctx, rect, canBuy ? '#1a2e1a' : '#2a1a1a', canBuy ? '#2ecc71' : '#555', 8);
    drawText(ctx, item.name, rect.x + rect.w / 2, rect.y + 12, 'bold 15px serif', canBuy ? '#fff' : '#888', 'center', 'top');
    drawText(ctx, item.description, rect.x + rect.w / 2, rect.y + 34, '12px serif', '#aaa', 'center', 'top');
    drawText(ctx, `${item.cost}両`, rect.x + rect.w / 2, rect.y + 54, 'bold 16px serif', canBuy ? GOLD_COLOR : '#666', 'center', 'top');
  });

  drawButton(ctx, leaveBtn, '立ち去る', '#555', '#ddd', 16, 8);
}

export function drawRest(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  heroHp: number,
  heroMaxHp: number,
  healBtn: Rect,
  leaveBtn: Rect
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);
  drawText(ctx, '休息地', w / 2, h * 0.2, `bold ${Math.min(36, w / 15)}px serif`, GOLD_COLOR, 'center', 'middle');
  drawText(ctx, '静かな村で英気を養う...', w / 2, h * 0.33, '18px serif', '#aaa', 'center', 'middle');
  drawText(ctx, `現在HP: ${heroHp} / ${heroMaxHp}`, w / 2, h * 0.44, '16px serif', '#2ecc71', 'center', 'middle');
  drawButton(ctx, healBtn, `回復する（HP+${Math.floor(heroMaxHp * 0.3)}）`, '#2980b9', '#fff', 16, 8);
  drawButton(ctx, leaveBtn, '出発する', '#555', '#ddd', 16, 8);
}

export function drawEvent(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  event: import('./types').GameEvent,
  optionRects: Rect[]
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);
  drawPanel(ctx, { x: w * 0.1, y: h * 0.15, w: w * 0.8, h: h * 0.45 }, '#1a1e2e', PANEL_BORDER, 12);
  drawText(ctx, `【${event.title}】`, w / 2, h * 0.2, `bold ${Math.min(22, w / 22)}px serif`, GOLD_COLOR, 'center', 'top');
  wrapText(ctx, event.description, w * 0.13, h * 0.28, w * 0.74, 22, '15px serif', TEXT_LIGHT);

  event.options.forEach((opt, i) => {
    const rect = optionRects[i];
    if (!rect) return;
    drawButton(ctx, rect, opt.text, '#2c3e50', TEXT_LIGHT, Math.min(14, w / 35), 8);
  });
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  retryBtn: Rect
): void {
  ctx.fillStyle = '#0d0005';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = '#e74c3c';
  ctx.shadowBlur = 30;
  drawText(ctx, '戦死', w / 2, h * 0.35, `bold ${Math.min(72, w / 6)}px serif`, '#e74c3c', 'center', 'middle');
  ctx.restore();
  drawText(ctx, '武将は倒れ、乱世は続く...', w / 2, h * 0.52, '20px serif', '#888', 'center', 'middle');
  drawButton(ctx, retryBtn, '新たな英傑で再起せよ', '#c0392b', '#fff', 18, 8);
}

export function drawEnding(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  heroName: string,
  score: number,
  retryBtn: Rect
): void {
  ctx.fillStyle = '#0d1a0a';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = '#f1c40f';
  ctx.shadowBlur = 25;
  drawText(ctx, '赤壁大勝利！', w / 2, h * 0.3, `bold ${Math.min(56, w / 9)}px serif`, GOLD_COLOR, 'center', 'middle');
  ctx.restore();
  drawText(ctx, `${heroName}は曹操を破り天下に名を轟かせた！`, w / 2, h * 0.46, '20px serif', '#2ecc71', 'center', 'middle');
  drawText(ctx, `スコア: ${score}`, w / 2, h * 0.56, 'bold 24px serif', '#fff', 'center', 'middle');
  drawButton(ctx, retryBtn, 'もう一度プレイ', GOLD_COLOR, TEXT_DARK, 18, 8);
}

export { pointInRect };
