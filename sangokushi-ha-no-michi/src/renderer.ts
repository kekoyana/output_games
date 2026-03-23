import type { GameState, MapNode, Die, Rect, LegacyData } from './types';
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
  FACTION_COLORS,
  HERO_DEFS,
  CHAPTER_SYNOPSIS,
  LEGACY_UPGRADES,
  HERO_UNLOCK_UPGRADES,
} from './data';
import { canActivateSkill, calcSlotValue, getSkillCost } from './battle';
import { t, tn } from './i18n';
import type { Lang } from './i18n';

const BG_COLOR = '#1a1a2e';
const PANEL_BORDER = '#8b6914';
const TEXT_DARK = '#2c1810';
const TEXT_LIGHT = '#f5e6c8';
const GOLD_COLOR = '#f1c40f';

const SLOT_COLORS: Record<string, string> = {
  attack: '#c0392b',
  defense: '#2980b9',
  strategy: '#8e44ad',
};

const SLOT_UNIT_COLORS: Record<string, string> = {
  attack: '#ff7777',
  defense: '#77bbff',
  strategy: '#cc99ff',
};

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

/** 画像をCanvas全面にcover表示する（アスペクト比を保ちつつ全面カバー） */
function _drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number
): void {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = w / h;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (imgRatio > canvasRatio) {
    sw = img.naturalHeight * canvasRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / canvasRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

/** 背景画像を描画（画像あり→cover+暗めオーバーレイ、なし→単色塗り） */
function _drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  imageKey: string,
  overlayAlpha: number = 0.55
): void {
  const img = getImage(imageKey);
  if (img) {
    _drawCoverImage(ctx, img, w, h);
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);
  }
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  startBtn: Rect,
  langBtnRects: Rect[] = [],
  lang: string = 'ja',
  legacyData: LegacyData | null = null,
  legacyBtnRect: Rect | null = null
): void {
  _drawBackground(ctx, w, h, 'title_background');

  // タイトル
  ctx.save();
  ctx.shadowColor = '#f1c40f';
  ctx.shadowBlur = 20;
  drawText(ctx, t('title.main'), w / 2, h * 0.25, `bold ${Math.min(60, w / 10)}px serif`, GOLD_COLOR, 'center', 'middle');
  drawText(ctx, t('title.sub'), w / 2, h * 0.35, `bold ${Math.min(48, w / 13)}px serif`, TEXT_LIGHT, 'center', 'middle');
  ctx.restore();

  // サブタイトル
  drawText(
    ctx, t('title.desc'),
    w / 2, h * 0.48, `${Math.min(18, w / 40)}px serif`, '#aaa', 'center', 'middle'
  );

  // レガシーボタン（プレイ実績がある場合のみ）
  if (legacyData && legacyData.totalRuns > 0 && legacyBtnRect) {
    drawButton(ctx, legacyBtnRect, `⚜ ${t('legacy.btn')} (${legacyData.legacyPoints}pt)`, '#8e44ad', '#fff', Math.min(14, w / 40), 6);
  }

  // スタートボタン
  drawButton(ctx, startBtn, t('title.start'), GOLD_COLOR, TEXT_DARK, Math.min(22, w / 30), 10);

  // 言語選択ボタン
  const langLabels: Record<string, string> = { ja: '日本語', en: 'EN', zh: '中文' };
  const langKeys: Lang[] = ['ja', 'en', 'zh'];
  langKeys.forEach((lk, i) => {
    const rect = langBtnRects[i];
    if (!rect) return;
    const isActive = lang === lk;
    const bg = isActive ? GOLD_COLOR : '#444';
    const fg = isActive ? TEXT_DARK : '#ccc';
    drawButton(ctx, rect, langLabels[lk], bg, fg, 14, 6);
  });

  // 操作説明
  drawText(ctx, t('title.controls'), w / 2, h * 0.88, '14px serif', '#666', 'center', 'middle');
}

export function drawCharacterSelect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  selectedId: string | null,
  confirmBtn: Rect,
  heroRects: Rect[],
  scrollY: number = 0,
  scrollMax: number = 0,
  unlockedHeroIds: Set<string> = new Set(HERO_DEFS.map((h) => h.id))
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  drawText(ctx, t('select.title'), w / 2, 16, `bold ${Math.min(28, w / 20)}px serif`, GOLD_COLOR, 'center', 'top');

  ctx.save();
  ctx.translate(0, -scrollY);

  const cols = w < 500 ? 2 : 3;
  const maxCardW = w < 500 ? 130 : 160;
  const cardW = Math.min(maxCardW, (w - 40 - (cols - 1) * 10) / cols);
  const cardH = heroRects[0]?.h ?? cardW * 1.3;

  // 解放済みキャラを先に表示するようソート
  const sortedIndices = HERO_DEFS.map((_, i) => i).sort((a, b) => {
    const ua = unlockedHeroIds.has(HERO_DEFS[a].id) ? 0 : 1;
    const ub = unlockedHeroIds.has(HERO_DEFS[b].id) ? 0 : 1;
    return ua - ub || a - b;
  });

  sortedIndices.forEach((heroIdx, slotIdx) => {
    const hero = HERO_DEFS[heroIdx];
    const rect = heroRects[slotIdx];
    if (!rect) return;

    const isUnlocked = unlockedHeroIds.has(hero.id);
    const isSelected = isUnlocked && hero.id === selectedId;
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

    // ロック中は暗くする
    if (!isUnlocked) ctx.globalAlpha = 0.35;

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
      drawText(ctx, tn(hero.name)[0], imgX + imgSize / 2, imgY + imgSize / 2, `bold ${imgSize * 0.4}px serif`, factionColor, 'center', 'middle');
    }

    // 勢力バッジ
    ctx.fillStyle = factionColor;
    ctx.globalAlpha = isUnlocked ? 0.85 : 0.3;
    drawRoundRect(ctx, rect.x + 4, rect.y + 4, 34, 20, 4);
    ctx.fill();
    ctx.globalAlpha = isUnlocked ? 1 : 0.35;
    drawText(ctx, t('faction.' + hero.faction), rect.x + 21, rect.y + 14, 'bold 12px serif', '#fff', 'center', 'middle');

    const textY = imgY + imgSize + 6;
    drawText(ctx, tn(hero.name), rect.x + rect.w / 2, textY, `bold ${Math.min(16, cardW / 9)}px serif`, TEXT_LIGHT, 'center', 'top');

    const statY = textY + 22;
    const statFont = `${Math.min(11, cardW / 14)}px serif`;
    drawText(ctx, `${t('select.hp')}:${hero.stats.maxHp} ${t('select.atk')}:${hero.stats.attack} ${t('select.def')}:${hero.stats.defense}`, rect.x + rect.w / 2, statY, statFont, '#ccc', 'center', 'top');

    const skillY = statY + 16;
    drawText(ctx, `◆${tn(hero.skill.name)}`, rect.x + rect.w / 2, skillY, `bold ${Math.min(11, cardW / 14)}px serif`, GOLD_COLOR, 'center', 'top');
    const skillDescFont = `${Math.min(10, cardW / 16)}px serif`;
    const skillDescMaxW = rect.w - 12;
    wrapText(ctx, t(`skill.desc.${hero.skill.id}`), rect.x + 6, skillY + 15, skillDescMaxW, 13, skillDescFont, '#aaa');

    ctx.globalAlpha = 1;

    // ロック中ラベル
    if (!isUnlocked) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      drawRoundRect(ctx, rect.x, rect.y + rect.h / 2 - 14, rect.w, 28, 0);
      ctx.fill();
      drawText(ctx, t('select.locked'), rect.x + rect.w / 2, rect.y + rect.h / 2, `bold ${Math.min(13, cardW / 10)}px serif`, '#f1c40f', 'center', 'middle');
    }
  });

  ctx.restore(); // スクロール translate を戻す

  // 決定ボタンをスクロール外に固定表示（画面下部）
  if (selectedId) {
    // ボタン背景のグラデーション（コンテンツとの境界をなじませる）
    const fadeH = 30;
    const btnAreaH = 60;
    const grad = ctx.createLinearGradient(0, h - btnAreaH - fadeH, 0, h - btnAreaH);
    grad.addColorStop(0, 'rgba(26,26,46,0)');
    grad.addColorStop(1, BG_COLOR);
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - btnAreaH - fadeH, w, fadeH);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, h - btnAreaH, w, btnAreaH);

    const fixedBtn: Rect = { x: confirmBtn.x, y: h - btnAreaH + 8, w: confirmBtn.w, h: confirmBtn.h };
    drawButton(ctx, fixedBtn, t('select.confirm'), GOLD_COLOR, TEXT_DARK, Math.min(20, w / 32), 8);
  }

  // スクロールインジケーター
  if (scrollMax > 0) {
    const barH = Math.max(30, h * (h / (h + scrollMax)));
    const barY = (scrollY / scrollMax) * (h - barH);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    drawRoundRect(ctx, w - 6, barY, 4, barH, 2);
    ctx.fill();
  }
}

export function drawSynopsis(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chapter: number
): void {
  const synopsis = CHAPTER_SYNOPSIS[chapter];
  if (!synopsis) return;

  _drawBackground(ctx, w, h, 'title_background', 0.85);

  const panelW = Math.min(w - 40, 500);
  const panelH = Math.min(h * 0.7, 450);
  const panelX = (w - panelW) / 2;
  const panelY = (h - panelH) / 2;

  drawPanel(ctx, { x: panelX, y: panelY, w: panelW, h: panelH }, 'rgba(20,15,10,0.9)', GOLD_COLOR, 12);

  // 章タイトル
  const synTitle = t(`synopsis.${chapter}.title`);
  drawText(ctx, synTitle !== `synopsis.${chapter}.title` ? synTitle : synopsis.title, w / 2, panelY + 40, `bold ${Math.min(28, w / 15)}px serif`, GOLD_COLOR, 'center', 'top');

  // 内容
  const startY = panelY + 100;
  const lineH = 32;
  synopsis.content.forEach((_, i) => {
    const key = `synopsis.${chapter}.${i + 1}`;
    const line = t(key);
    drawText(ctx, line !== key ? line : synopsis.content[i], w / 2, startY + i * lineH, `${Math.min(16, w / 25)}px serif`, TEXT_LIGHT, 'center', 'top');
  });

  // 続行案内
  drawText(ctx, t('synopsis.continue'), w / 2, panelY + panelH - 40, '15px serif', '#888', 'center', 'middle');
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
  scrollY: number,
  mapTutorialStep: number = -1,
  heroPortraitKey: string = ''
): void {
  _drawBackground(ctx, w, h, 'map_background', 0.45);

  // ヘッダー（スマホでは2行にして重なりを防止）
  const mapHeaderH = w < 500 ? 62 : 50;
  drawPanel(ctx, { x: 0, y: 0, w, h: mapHeaderH }, '#0d0d1e', '#333');
  const chapterTitle = t('ch.' + chapter);
  if (w < 500) {
    drawText(ctx, `${t('map.chapter', { n: chapter })} ${chapterTitle}`, w / 2, 18, `bold ${Math.min(18, w / 22)}px serif`, GOLD_COLOR, 'center', 'middle');
    drawText(ctx, `HP: ${heroHp}/${heroMaxHp}`, 12, 46, '14px serif', '#2ecc71', 'left', 'middle');
    drawText(ctx, `${t('map.gold')}: ${heroGold}`, w - 12, 46, '14px serif', GOLD_COLOR, 'right', 'middle');
  } else {
    drawText(ctx, `${t('map.chapter', { n: chapter })} ${chapterTitle}`, w / 2, 25, 'bold 20px serif', GOLD_COLOR, 'center', 'middle');
    drawText(ctx, `HP: ${heroHp}/${heroMaxHp}`, 20, 25, '16px serif', '#2ecc71', 'left', 'middle');
    drawText(ctx, `${t('map.gold')}: ${heroGold}`, w - 20, 25, '16px serif', GOLD_COLOR, 'right', 'middle');
  }

  // スマホではスケール下限を設けて可読性を確保（スクロールで対応）
  const scale = Math.max(0.7, Math.min(w / 650, 1.2));
  // スケールが大きい場合は中央寄せ、小さい場合は左寄せ気味に
  const mapContentW = 580 * scale; // ノード座標空間の概算幅
  const offsetX = Math.max(8, (w - mapContentW) / 2);

  ctx.save();
  ctx.translate(offsetX, mapHeaderH + 10 - scrollY);
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
  const r = 33;
  const now = performance.now();
  // 今後到達可能なノードを再帰的に算出
  const currentNode = currentNodeId !== null ? nodes.find((n) => n.id === currentNodeId) : null;
  const futureReachableIds = new Set<number>();
  const queue = currentNode ? [...currentNode.connections] : [];
  while (queue.length > 0) {
    const nid = queue.pop()!;
    if (futureReachableIds.has(nid)) continue;
    const nd = nodes.find((n) => n.id === nid);
    if (!nd || nd.visited) continue;
    futureReachableIds.add(nid);
    for (const cid of nd.connections) queue.push(cid);
  }
  for (const node of nodes) {
    const isCurrent = node.id === currentNodeId;
    const isAvailable = node.available;
    const isVisited = node.visited;
    const isReachable = futureReachableIds.has(node.id);

    const color = NODE_COLORS[node.type] || '#888';

    if (isVisited) {
      ctx.globalAlpha = 0.35;
    } else if (isAvailable) {
      ctx.globalAlpha = 1.0;
    } else if (!isReachable && !isCurrent) {
      // 今後選択できないノード: さらに暗く
      ctx.globalAlpha = 0.2;
    } else {
      ctx.globalAlpha = 0.5;
    }

    // 選択可能ノードの脈動グロー
    if (isAvailable && !isVisited) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.003));
      const glowSize = 16 + 6 * Math.abs(Math.sin(now * 0.002));
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = glowSize;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = pulse * 0.35;
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1.0;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (isAvailable && !isVisited) {
      // 選択可能ノードは明るい白枠
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
    } else if (isCurrent) {
      ctx.strokeStyle = GOLD_COLOR;
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    ctx.globalAlpha = 1.0;

    // 到達不可能ノードはラベルも暗く
    const labelAlpha = (!isVisited && !isAvailable && !isReachable && !isCurrent) ? 0.3 : 1.0;
    ctx.globalAlpha = labelAlpha;
    const label = t('node.' + node.type);
    const fontSize = Math.min(18, 320 / label.length);
    drawText(ctx, label, node.x, node.y, `bold ${fontSize}px serif`, '#fff', 'center', 'middle');
    ctx.globalAlpha = 1.0;
  }

  // 現在地にヒーローアイコンを表示（上下にふわふわアニメーション）
  // 初期状態（currentNodeId === null）では最初のavailableノードにマーカーを表示
  const markerNode = currentNode ?? nodes.find((n) => n.available && !n.visited);
  if (heroPortraitKey && markerNode) {
    const iconSize = 34;
    const bobOffset = Math.sin(now * 0.004) * 5; // 上下に5pxふわふわ
    const iconX = markerNode.x - iconSize / 2;
    const iconY = markerNode.y - r - iconSize - 4 + bobOffset;
    const iconCenterY = iconY + iconSize / 2;
    const heroImg = getImage(heroPortraitKey);

    // 背景の円
    ctx.save();
    ctx.beginPath();
    ctx.arc(markerNode.x, iconCenterY, iconSize / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0d1e';
    ctx.fill();
    ctx.strokeStyle = GOLD_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ポートレート画像（円形クリップ）
    ctx.beginPath();
    ctx.arc(markerNode.x, iconCenterY, iconSize / 2, 0, Math.PI * 2);
    ctx.clip();
    if (heroImg) {
      ctx.drawImage(heroImg, iconX, iconY, iconSize, iconSize);
    } else {
      ctx.fillStyle = '#333';
      ctx.fillRect(iconX, iconY, iconSize, iconSize);
    }
    ctx.restore();
  }

  ctx.restore();

  // マップチュートリアルオーバーレイ
  if (mapTutorialStep >= 1) {
    _drawMapTutorial(ctx, w, h, mapTutorialStep);
  }
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
  selectedDieIdx: number = -1,
  battleAnims: { type: 'attack' | 'hit'; value: number; startTime: number }[] = []
): void {
  const battle = state.battle!;
  const hero = state.hero!;
  const now = performance.now();

  _drawBackground(ctx, w, h, 'battle_background');

  const isLandscape = w > h;
  const panelH = isLandscape ? h * 0.48 : h * 0.42;
  const panelY = h - panelH - 6;
  const panelW = w - 16;

  // 敵表示エリア（上半分）— 攻撃アニメ時にシェイク
  const enemyAreaH = panelY - 10;
  const attackAnim = battleAnims.find((a) => a.type === 'attack');
  const attackElapsed = attackAnim ? now - attackAnim.startTime : -1;
  if (attackAnim && attackElapsed >= 0 && attackElapsed < 500) {
    const shakeAmount = Math.sin(attackElapsed * 0.05) * 8 * (1 - attackElapsed / 500);
    ctx.save();
    ctx.translate(shakeAmount, 0);
    _drawEnemy(ctx, w, enemyAreaH, battle.enemy, isLandscape, battle.phase);
    ctx.restore();
  } else {
    _drawEnemy(ctx, w, enemyAreaH, battle.enemy, isLandscape, battle.phase);
  }

  // 英雄HP（スキル使用可能時にグロー）— 被ダメ時にフラッシュ
  const canSkill = canActivateSkill(battle, hero) && battle.phase === 'assign';
  const hitAnim = battleAnims.find((a) => a.type === 'hit');
  const hitElapsed = hitAnim ? now - hitAnim.startTime : -1;
  _drawHeroStatus(ctx, w, hero, battle.heroBlock, canSkill);
  if (hitAnim && hitElapsed >= 0 && hitElapsed < 400) {
    const flash = Math.sin(hitElapsed * 0.02) * 0.4;
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,0,0,${flash})`;
      const heroSize = Math.min(70, w * 0.12);
      drawRoundRect(ctx, 20, 20, heroSize, heroSize, 6);
      ctx.fill();
    }
  }

  // バトルログ（パネル上部に表示）
  _drawBattleLog(ctx, w, panelY, battle.log, battle.turnCount);

  // 下部パネル
  drawPanel(ctx, { x: 8, y: panelY, w: panelW, h: panelH + 2 }, 'rgba(20,15,10,0.92)', PANEL_BORDER, 10);

  // ヒントテキスト（パネル上端）
  if (battle.phase === 'assign' && !dragInfo) {
    const allUnassigned = battle.dice.filter((d) => d.assignedSlot === null || d.assignedSlot === 'skill').length === battle.dice.length;
    if (selectedDieIdx >= 0) {
      drawText(ctx, t('battle.hint.place'), w / 2, panelY + 12, 'bold 14px serif', '#f1c40f', 'center', 'top');
    } else if (allUnassigned) {
      drawText(ctx, t('battle.hint.select'), w / 2, panelY + 12, 'bold 14px serif', '#f1c40f', 'center', 'top');
    }
  } else if (battle.phase === 'roll') {
    drawText(ctx, t('battle.hint.roll'), w / 2, panelY + 12, 'bold 14px serif', '#3498db', 'center', 'top');
  }

  // アクションスロット（ドラッグ中/選択中はハイライト）
  _drawSlots(ctx, slotRects, battle.dice, hero, dragInfo, selectedDieIdx);

  // ダイス描画（ドラッグ中のダイスは元位置を半透明に、選択中は光らせる）
  battle.dice.forEach((die, i) => {
    const rect = diceRects[i];
    if (!rect) return;
    if (dragInfo && dragInfo.dieIdx === i) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      _drawDie(ctx, rect, die);
      ctx.restore();
    } else if (i === selectedDieIdx && die.assignedSlot === null) {
      ctx.save();
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 14;
      _drawDie(ctx, rect, die);
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
    const dieSize = diceRects[0]?.w ?? 56;
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

  // スキルボタン（使用可能時にグローエフェクト）
  _drawSkillButton(ctx, skillBtnRect, hero, canSkill, battle);

  // 行動確定 / ダイスロールボタン
  if (battle.phase === 'assign') {
    const hasAssigned = battle.dice.some((d) => d.assignedSlot !== null);
    drawButton(ctx, confirmBtnRect, t('battle.confirm'), hasAssigned ? '#c0392b' : '#555', '#fff', 17, 10);
  } else if (battle.phase === 'roll') {
    drawButton(ctx, rollBtnRect, t('battle.roll'), '#2980b9', '#fff', 17, 10);
  }

  // ヘルプボタン
  _drawHelpButton(ctx, helpBtnRect);

  // 結果メッセージ（勝利時は直接rewardに遷移するため、ここは敗北 or 反撃勝利のフォールバック）
  if (battle.phase === 'result') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);
    const won = battle.enemy.currentHp <= 0;
    const color = won ? '#2ecc71' : '#e74c3c';
    const text = won ? t('battle.victory') : t('battle.defeat');
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    drawText(ctx, text, w / 2, h / 2, `bold ${Math.min(60, w / 8)}px serif`, color, 'center', 'middle');
    ctx.restore();
    drawText(ctx, t('battle.continue'), w / 2, h / 2 + 60, '20px serif', '#ccc', 'center', 'top');
  }

  // バトルアニメーション: ダメージ数字 + 斬撃エフェクト
  for (const anim of battleAnims) {
    const elapsed = now - anim.startTime;
    if (elapsed < 0 || elapsed > 800) continue;

    if (anim.type === 'attack') {
      // 敵へのダメージ: 斬撃ライン + 浮き上がるダメージ数字
      const enemyCx = isLandscape ? w * 0.7 : w / 2;
      const enemyPortraitSize = Math.min(enemyAreaH * 0.5, isLandscape ? 180 : 140);
      const enemyCy = enemyAreaH * 0.05 + enemyPortraitSize / 2;

      // 斬撃エフェクト（最初の300ms）
      if (elapsed < 300) {
        const progress = elapsed / 300;
        ctx.save();
        ctx.strokeStyle = `rgba(255,220,100,${1 - progress})`;
        ctx.lineWidth = 4 * (1 - progress);
        ctx.shadowColor = '#ff6';
        ctx.shadowBlur = 20 * (1 - progress);
        const slashLen = enemyPortraitSize * 0.8;
        const sx = enemyCx - slashLen / 2 + slashLen * progress * 0.3;
        const sy = enemyCy - slashLen / 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + slashLen * progress, sy + slashLen * progress);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + slashLen, sy);
        ctx.lineTo(sx + slashLen - slashLen * progress, sy + slashLen * progress);
        ctx.stroke();
        ctx.restore();
      }

      // ダメージ数字（浮き上がる）
      const floatY = enemyCy - 20 - elapsed * 0.06;
      const alpha = Math.max(0, 1 - elapsed / 800);
      const fontSize = Math.min(36, w / 14);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      drawText(ctx, `-${anim.value}`, enemyCx, floatY, `bold ${fontSize}px serif`, '#ff3333', 'center', 'middle');
      ctx.restore();
    } else if (anim.type === 'hit') {
      // ヒーローへのダメージ: 画面端フラッシュ + 浮き上がるダメージ数字
      const heroSize = Math.min(70, w * 0.12);
      const heroCx = 20 + heroSize / 2;
      const heroCy = 20 + heroSize / 2;

      // 画面端の赤フラッシュ（ビネット）
      if (elapsed < 400) {
        const flashAlpha = 0.25 * (1 - elapsed / 400);
        const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
        grad.addColorStop(0, 'rgba(255,0,0,0)');
        grad.addColorStop(1, `rgba(255,0,0,${flashAlpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // ダメージ数字
      const floatY = heroCy - 10 - elapsed * 0.05;
      const alpha = Math.max(0, 1 - elapsed / 800);
      const fontSize = Math.min(28, w / 18);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      drawText(ctx, `-${anim.value}`, heroCx + heroSize, floatY, `bold ${fontSize}px serif`, '#ff5555', 'center', 'middle');
      ctx.restore();
    }
  }

  // ヘルプオーバーレイ
  if (state.showHelp) {
    _drawHelpOverlay(ctx, w, h, hero);
  }

  // チュートリアルオーバーレイ
  if (state.tutorialStep >= 1) {
    _drawTutorialOverlay(ctx, w, h, state.tutorialStep, diceRects, slotRects, confirmBtnRect, skillBtnRect);
  }
}

function _drawEnemy(
  ctx: CanvasRenderingContext2D,
  w: number,
  areaH: number,
  enemy: import('./types').Enemy,
  isLandscape: boolean,
  battlePhase: import('./types').BattlePhase = 'assign'
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
    drawText(ctx, tn(enemy.name)[0], cx, portraitY + portraitSize / 2, `bold ${portraitSize * 0.4}px serif`, '#e74c3c', 'center', 'middle');
  }

  // 敵名
  drawText(ctx, tn(enemy.name), cx, portraitY + portraitSize + 6, `bold ${Math.min(20, w / 25)}px serif`, '#fff', 'center', 'top');

  // HP バー
  const barW = Math.min(200, w * 0.35);
  const barX = cx - barW / 2;
  drawHpBar(ctx, barX, portraitY + portraitSize + 30, barW, 14, enemy.currentHp, enemy.maxHp, '#e74c3c');
  drawText(ctx, `${enemy.currentHp}/${enemy.maxHp}`, cx, portraitY + portraitSize + 46, '13px serif', '#fff', 'center', 'top');

  // インテント表示（具体的なダメージ数値付き）
  // rollフェーズでは前回の行動を表示、それ以外では次の行動を表示
  const intentText = _intentLabelWithDmg(enemy);
  const intentColor = enemy.currentIntent === 'attack' || enemy.currentIntent === 'special' ? '#e74c3c' : '#3498db';
  if (battlePhase === 'roll') {
    drawText(ctx, `${t('battle.lastAction')}: ${intentText}`, cx, portraitY + portraitSize + 62, 'bold 14px serif', '#888', 'center', 'top');
  } else {
    drawText(ctx, `${t('battle.nextAction')}: ${intentText}`, cx, portraitY + portraitSize + 62, 'bold 14px serif', intentColor, 'center', 'top');
  }

  // 攻撃力・防御力の常時表示
  drawText(ctx, `${t('select.atk')}:${enemy.attack}  ${t('select.def')}:${enemy.defense}`, cx, portraitY + portraitSize + 80, '12px serif', '#aaa', 'center', 'top');

  // 状態異常
  const statusY = portraitY + portraitSize + 96;
  if (enemy.stunned) {
    drawText(ctx, t('battle.stunned'), cx, statusY, 'bold 13px serif', '#9b59b6', 'center', 'top');
  }
  if (enemy.buffed) {
    drawText(ctx, t('battle.buffed'), cx, statusY, 'bold 13px serif', '#e67e22', 'center', 'top');
  }

  // ボスギミック表示
  if (enemy.gimmick) {
    const gimmickY = statusY + 16;
    const gName = _getGimmickLabel(enemy.gimmick);
    drawText(ctx, `⚡ ${gName}`, cx, gimmickY, 'bold 12px serif', '#f39c12', 'center', 'top');
  }
}

function _intentLabelWithDmg(enemy: import('./types').Enemy): string {
  const intent = enemy.currentIntent;
  const atk = enemy.buffed ? Math.floor(enemy.attack * 1.5) : enemy.attack;
  if (intent === 'attack') return `${t('intent.attack')} ${atk}${t('intent.dmg')}`;
  if (intent === 'special') return `${t('intent.special')} ${atk * 2}${t('intent.dmg')}`;
  if (intent === 'defend') return `${t('intent.defend')} +${enemy.defense}`;
  if (intent === 'buff') return t('intent.buff');
  return intent;
}

function _getGimmickLabel(gimmick: import('./types').BossGimmick): string {
  const labels: Record<import('./types').BossGimmick, string> = {
    zhang_jiao_sorcery: '妖術：ダイス変換',
    dong_zhuo_tyranny: '暴虐：防御無視攻撃',
    lu_bu_halberd: '方天画戟：瀕死で強化',
    yuan_shu_seal: '玉璽の威光：防御半減',
    cao_cao_scheme: '覇者の策謀：技コスト+1',
  };
  return labels[gimmick];
}

function _drawHeroStatus(
  ctx: CanvasRenderingContext2D,
  w: number,
  hero: import('./types').Hero,
  block: number,
  canSkill: boolean = false
): void {
  const x = 20;
  const y = 20;
  const factionColor = FACTION_COLORS[hero.faction];

  const img = getImage(hero.portraitKey);
  const size = Math.min(70, w * 0.12);

  // スキル使用可能時にグローエフェクト
  if (canSkill) {
    ctx.save();
    ctx.shadowColor = '#d8a4f8';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(155,89,182,0.3)';
    drawRoundRect(ctx, x - 4, y - 4, size + 8, size + 8, 10);
    ctx.fill();
    ctx.restore();

    // パルスアニメーション枠
    ctx.save();
    ctx.strokeStyle = '#d8a4f8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#9b59b6';
    ctx.shadowBlur = 12;
    drawRoundRect(ctx, x - 3, y - 3, size + 6, size + 6, 8);
    ctx.stroke();
    ctx.restore();
  }

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
    drawText(ctx, tn(hero.name)[0], x + size / 2, y + size / 2, `bold ${size * 0.4}px serif`, factionColor, 'center', 'middle');
  }

  // スキル使用可能ラベル
  if (canSkill) {
    ctx.save();
    ctx.fillStyle = 'rgba(155,89,182,0.9)';
    drawRoundRect(ctx, x, y + size - 14, size, 16, 3);
    ctx.fill();
    drawText(ctx, t('battle.skillReady'), x + size / 2, y + size - 6, 'bold 10px serif', '#fff', 'center', 'middle');
    ctx.restore();
  }

  drawText(ctx, tn(hero.name), x + size + 8, y + 4, 'bold 15px serif', factionColor, 'left', 'top');
  drawHpBar(ctx, x + size + 8, y + 24, 120, 12, hero.currentHp, hero.stats.maxHp, '#2ecc71');
  drawText(ctx, `${hero.currentHp}/${hero.stats.maxHp}`, x + size + 8, y + 38, '12px serif', '#aaa', 'left', 'top');
  if (block > 0) {
    drawText(ctx, `${t('battle.block')} ${block}`, x + size + 8, y + 54, 'bold 13px serif', '#3498db', 'left', 'top');
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
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    drawRoundRect(ctx, rect.x, rect.y + rect.h - 16, rect.w, 16, 3);
    ctx.fill();
    const slotKey = die.assignedSlot ?? 'attack';
    const slotAbbrKey = slotKey === 'attack' ? 'slot.abbr.atk' : slotKey === 'defense' ? 'slot.abbr.def' : slotKey === 'strategy' ? 'slot.abbr.str' : 'slot.abbr.skill';
    drawText(ctx, t(slotAbbrKey), rect.x + rect.w / 2, rect.y + rect.h - 8, 'bold 11px serif', '#fff', 'center', 'middle');
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

  for (const [slotKey, rect] of Object.entries(slotRects)) {
    const slotDice = dice.filter((d) => d.assignedSlot === slotKey);
    const isHovered = dragInfo !== null && pointInRect(dragInfo.pos, rect);
    const isSelecting = selectedDieIdx >= 0 && dice[selectedDieIdx]?.assignedSlot === null;
    const highlight = isHovered || isSelecting;

    if (highlight) {
      ctx.save();
      ctx.shadowColor = SLOT_COLORS[slotKey] ?? '#fff';
      ctx.shadowBlur = 16;
    }
    drawPanel(ctx, rect, highlight ? 'rgba(60,40,20,0.95)' : 'rgba(30,20,10,0.8)', SLOT_COLORS[slotKey] ?? '#666', 6);
    if (highlight) {
      drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    const slotLabelKey = slotKey === 'attack' ? 'slot.attack' : slotKey === 'defense' ? 'slot.defense' : 'slot.strategy';
    drawText(ctx, t(slotLabelKey), rect.x + rect.w / 2, rect.y + 8, 'bold 13px serif', '#fff', 'center', 'top');

    if (slotDice.length > 0) {
      // カウントバッジ
      ctx.fillStyle = SLOT_COLORS[slotKey] ?? '#fff';
      ctx.beginPath();
      ctx.arc(rect.x + rect.w - 12, rect.y + 14, 10, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, String(slotDice.length), rect.x + rect.w - 12, rect.y + 14, 'bold 12px serif', '#fff', 'center', 'middle');

      // 共通関数で予測値を計算
      const baseStat = slotKey === 'defense' ? hero.stats.defense : hero.stats.attack;
      const value = calcSlotValue(dice, slotKey, baseStat);
      const unitColor = SLOT_UNIT_COLORS[slotKey] ?? '#fff';
      const unitLabelKey = slotKey === 'attack' ? 'slot.damage' : slotKey === 'defense' ? 'slot.defense.label' : 'slot.bonus';

      if (value > 0) {
        drawText(ctx, String(value), rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, `bold ${Math.min(22, rect.w / 4)}px serif`, unitColor, 'center', 'middle');
        drawText(ctx, t(unitLabelKey), rect.x + rect.w / 2, rect.y + rect.h - 8, '10px serif', '#aaa', 'center', 'bottom');
      } else {
        drawText(ctx, t('slot.noEffect'), rect.x + rect.w / 2, rect.y + rect.h / 2 + 6, '12px serif', '#666', 'center', 'middle');
      }
    } else {
      const hintKey = slotKey === 'attack' ? 'slot.attack.hint' : slotKey === 'defense' ? 'slot.defense.hint' : 'slot.strategy.hint';
      drawText(ctx, t(hintKey), rect.x + rect.w / 2, rect.y + rect.h / 2 + 2, '11px serif', '#777', 'center', 'middle');
      drawText(ctx, t('slot.tap'), rect.x + rect.w / 2, rect.y + rect.h - 8, '10px serif', '#555', 'center', 'bottom');
    }
  }
}

function _getSkillEffectLabel(hero: import('./types').Hero): string {
  const effect = hero.skill.effect;
  const atk = hero.stats.attack;
  if (effect === 'all_attack') {
    return `${t('skill.allAttack')} +${Math.floor(atk * 1.5)}${t('intent.dmg')}`;
  } else if (effect === 'buff_swords') {
    return t('skill.buffSwords');
  } else if (effect === 'invincible_counter') {
    return `${t('skill.invincible')}${atk * 2}${t('intent.dmg')}`;
  } else if (effect === 'stun_enemy') {
    return t('skill.stun');
  } else if (effect === 'shield_to_attack') {
    return t('skill.shieldAttack');
  } else if (effect === 'heal') {
    return t('skill.heal');
  }
  return '';
}

function _drawSkillButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  hero: import('./types').Hero,
  canSkill: boolean,
  battle: import('./types').BattleState
): void {
  const { face } = hero.skill.cost;
  const actualCost = getSkillCost(battle, hero);
  const baseCost = hero.skill.cost.count;
  const costLabel = actualCost > baseCost ? `×${actualCost}(+${actualCost - baseCost})` : `×${actualCost}`;
  const costStr = `${t('skill.cost')}: ${DICE_LABELS[face]} ${t('dice.' + face)}${costLabel}`;
  const effectStr = _getSkillEffectLabel(hero);

  if (canSkill) {
    // グローエフェクト
    ctx.save();
    ctx.shadowColor = '#d8a4f8';
    ctx.shadowBlur = 18;
    drawPanel(ctx, rect, '#7b3fa0', '#d8a4f8', 8);
    ctx.restore();
    // 内側グロー
    ctx.save();
    ctx.strokeStyle = '#e8c4ff';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 6);
    ctx.stroke();
    ctx.restore();
  } else {
    drawPanel(ctx, rect, '#3a3a3a', '#555', 8);
  }

  const textColor = canSkill ? '#fff' : '#888';
  const cx = rect.x + rect.w / 2;

  // スキル名・コスト・効果を表示
  drawText(ctx, `✦ ${tn(hero.skill.name)}`, cx, rect.y + 8, `bold ${Math.min(14, rect.w / 12)}px serif`, textColor, 'center', 'top');
  drawText(ctx, costStr, cx, rect.y + 24, `${Math.min(11, rect.w / 16)}px serif`, canSkill ? '#f8c' : '#666', 'center', 'top');
  drawText(ctx, effectStr, cx, rect.y + 38, `${Math.min(11, rect.w / 16)}px serif`, canSkill ? '#cfc' : '#555', 'center', 'top');
}

function _drawBattleLog(
  ctx: CanvasRenderingContext2D,
  w: number,
  panelY: number,
  log: string[],
  turnCount: number
): void {
  const lines = log.slice(-3);
  if (lines.length === 0) return;

  // パネル上にログバーとして表示
  const logH = lines.length * 18 + 12;
  const logY = panelY - logH - 4;
  const logW = Math.min(w - 24, 500);
  const logX = (w - logW) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  drawRoundRect(ctx, logX, logY, logW, logH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,180,140,0.3)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, logX, logY, logW, logH, 8);
  ctx.stroke();
  ctx.restore();

  drawText(ctx, `T${turnCount}`, logX + 8, logY + 6, 'bold 10px serif', GOLD_COLOR, 'left', 'top');
  lines.forEach((line, i) => {
    drawText(ctx, line, logX + 32, logY + 6 + i * 18, '13px serif', '#ddd', 'left', 'top');
  });
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

  drawText(ctx, t('help.title'), panelX + panelW / 2, y, 'bold 16px serif', GOLD_COLOR, 'center', 'top');
  y += 26;

  // ダイスの出目と効果
  drawText(ctx, t('help.dice'), lx, y, titleFont, '#f1c40f', 'left', 'top');
  y += lineH + 2;
  const diceHelp: [string, string][] = [
    [`⚔ ${t('dice.sword')}`, `${t('slot.attack')}◎(${atk}) ${t('slot.defense')}△(${Math.floor(def * 0.3)}) ${t('slot.strategy')}△(${Math.floor(atk * 0.2)})`],
    [`🛡 ${t('dice.shield')}`, `${t('slot.defense')}◎(${def}) ${t('slot.attack')}×(${Math.floor(atk * 0.2)}) ${t('slot.strategy')}×(0)`],
    [`📜 ${t('dice.strategy')}`, `${t('slot.strategy')}◎(${Math.floor(atk * 0.6)}) ${t('slot.attack')}×(${Math.floor(atk * 0.3)}) ${t('slot.defense')}×(${Math.floor(def * 0.2)})`],
    [`🐴 ${t('dice.horse')}`, `${t('slot.attack')}△(${Math.floor(atk * 0.5)}) ${t('slot.defense')}○(${Math.floor(def * 0.7)}) ${t('help.skillCost')}`],
    [`🏹 ${t('dice.arrow')}`, `${t('slot.attack')}◎(${Math.floor(atk * 1.2)}) ${t('slot.strategy')}△(${Math.floor(atk * 0.2)})`],
    [`⭐ ${t('dice.star')}`, t('help.wild')],
  ];
  for (const [icon, desc] of diceHelp) {
    drawText(ctx, icon, lx + 4, y, bodyFont, '#fff', 'left', 'top');
    drawText(ctx, desc, lx + 30, y, bodyFont, '#ccc', 'left', 'top');
    y += lineH;
  }

  y += 6;
  // スロットの効果
  drawText(ctx, t('help.slots'), lx, y, titleFont, '#f1c40f', 'left', 'top');
  y += lineH + 2;
  const slotHelp: [string, string][] = [
    [t('slot.attack'), t('slot.attack.hint')],
    [t('slot.defense'), t('slot.defense.hint')],
    [t('slot.strategy'), t('slot.strategy.hint')],
  ];
  for (const [slot, desc] of slotHelp) {
    drawText(ctx, slot, lx + 4, y, bodyFont, '#fff', 'left', 'top');
    drawText(ctx, desc, lx + 50, y, bodyFont, '#ccc', 'left', 'top');
    y += lineH;
  }

  y += 6;
  // 操作方法
  drawText(ctx, t('help.controls'), lx, y, titleFont, '#f1c40f', 'left', 'top');
  y += lineH + 2;
  const opHelp: string[] = [
    t('help.drag'),
    t('help.tap'),
    t('help.unassign'),
    t('help.skill'),
    t('help.confirm'),
  ];
  for (const op of opHelp) {
    drawText(ctx, '・' + op, lx, y, bodyFont, '#ccc', 'left', 'top');
    y += lineH;
  }

  y += 10;
  drawText(ctx, t('help.close'), panelX + panelW / 2, y, 'bold 13px serif', '#999', 'center', 'top');
}

export function drawReward(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  reward: import('./types').RewardInfo,
  hero: import('./types').Hero
): void {
  _drawBackground(ctx, w, h, 'battle_background', 0.75);

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
  const titleText = reward.isBoss ? t('reward.bossVictory') : t('reward.victory');
  drawText(ctx, titleText, w / 2, panelY + 30, `bold ${Math.min(36, w / 12)}px serif`, GOLD_COLOR, 'center', 'middle');
  ctx.restore();

  // 敵名
  drawText(ctx, `${tn(reward.enemyName)} ${t('reward.defeated')}`, w / 2, panelY + 65, '18px serif', '#ccc', 'center', 'middle');

  // 報酬一覧
  const rewardY = panelY + 105;
  const lineH = 44;

  // ゴールド報酬
  ctx.fillStyle = 'rgba(241,196,15,0.12)';
  drawRoundRect(ctx, panelX + 20, rewardY, panelW - 40, 36, 6);
  ctx.fill();
  drawText(ctx, t('reward.gold'), panelX + 40, rewardY + 18, 'bold 16px serif', '#aaa', 'left', 'middle');
  drawText(ctx, `+${reward.goldEarned} ${t('reward.unit')}`, panelX + panelW - 40, rewardY + 18, 'bold 20px serif', GOLD_COLOR, 'right', 'middle');

  // 現在の所持金
  const summaryY = rewardY + lineH + 16;
  drawText(ctx, `${t('reward.total')}: ${hero.gold} → ${hero.gold + reward.goldEarned} ${t('reward.unit')}`, w / 2, summaryY, '14px serif', '#999', 'center', 'middle');

  // ボスの場合は次の章の案内
  if (reward.isBoss) {
    drawText(ctx, t('reward.nextChapter'), w / 2, summaryY + 28, 'bold 15px serif', '#f39c12', 'center', 'middle');
  }

  // 続行プロンプト
  drawText(ctx, t('battle.continue'), w / 2, panelY + panelH - 20, '15px serif', '#888', 'center', 'middle');
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
  drawText(ctx, t('advisor.title'), w / 2, 30, `bold ${Math.min(24, w / 20)}px serif`, GOLD_COLOR, 'center', 'top');

  cards.forEach((card, i) => {
    const rect = cardRects[i];
    if (!rect) return;
    drawPanel(ctx, rect, '#1e2a3a', '#4a90d9', 10);
    drawText(ctx, tn(card.name), rect.x + rect.w / 2, rect.y + 16, 'bold 16px serif', '#fff', 'center', 'top');
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
  drawText(ctx, t('merchant.title'), w / 2, 28, `bold ${Math.min(26, w / 20)}px serif`, GOLD_COLOR, 'center', 'top');
  drawText(ctx, `${t('merchant.gold')}: ${gold}${t('reward.unit')}`, w - 20, 30, '16px serif', GOLD_COLOR, 'right', 'middle');

  items.forEach((item, i) => {
    const rect = itemRects[i];
    if (!rect) return;
    const canBuy = gold >= item.cost;
    drawPanel(ctx, rect, canBuy ? '#1a2e1a' : '#2a1a1a', canBuy ? '#2ecc71' : '#555', 8);
    drawText(ctx, tn(item.name), rect.x + rect.w / 2, rect.y + 12, 'bold 15px serif', canBuy ? '#fff' : '#888', 'center', 'top');
    drawText(ctx, item.description, rect.x + rect.w / 2, rect.y + 34, '12px serif', '#aaa', 'center', 'top');
    drawText(ctx, `${item.cost}${t('reward.unit')}`, rect.x + rect.w / 2, rect.y + 54, 'bold 16px serif', canBuy ? GOLD_COLOR : '#666', 'center', 'top');
  });

  drawButton(ctx, leaveBtn, t('merchant.leave'), '#555', '#ddd', 16, 8);
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
  drawText(ctx, t('rest.title'), w / 2, h * 0.2, `bold ${Math.min(36, w / 15)}px serif`, GOLD_COLOR, 'center', 'middle');
  drawText(ctx, t('rest.desc'), w / 2, h * 0.33, '18px serif', '#aaa', 'center', 'middle');
  drawText(ctx, `${t('rest.currentHp')}: ${heroHp} / ${heroMaxHp}`, w / 2, h * 0.44, '16px serif', '#2ecc71', 'center', 'middle');
  drawButton(ctx, healBtn, `${t('rest.heal')}（HP+${Math.floor(heroMaxHp * 0.3)}）`, '#2980b9', '#fff', 16, 8);
  drawButton(ctx, leaveBtn, t('rest.leave'), '#555', '#ddd', 16, 8);
}

export function drawEvent(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  event: import('./types').GameEvent,
  optionRects: Rect[],
  eventResult: string | null = null
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);
  drawPanel(ctx, { x: w * 0.1, y: h * 0.15, w: w * 0.8, h: h * 0.45 }, '#1a1e2e', PANEL_BORDER, 12);
  drawText(ctx, `【${tn(event.title)}】`, w / 2, h * 0.2, `bold ${Math.min(22, w / 22)}px serif`, GOLD_COLOR, 'center', 'top');
  wrapText(ctx, event.description, w * 0.13, h * 0.28, w * 0.74, 22, '15px serif', TEXT_LIGHT);

  if (eventResult !== null) {
    // 占い結果を表示
    const isGood = eventResult.startsWith('吉');
    const resultColor = isGood ? '#2ecc71' : '#e74c3c';
    drawPanel(ctx, { x: w * 0.2, y: h * 0.52, w: w * 0.6, h: h * 0.14 }, '#0d0010', resultColor, 10);
    drawText(ctx, eventResult, w / 2, h * 0.59, `bold ${Math.min(26, w / 18)}px serif`, resultColor, 'center', 'middle');
    drawText(ctx, 'タップして続ける', w / 2, h * 0.72, '15px serif', '#888', 'center', 'middle');
  } else {
    event.options.forEach((opt, i) => {
      const rect = optionRects[i];
      if (!rect) return;
      drawButton(ctx, rect, opt.text, '#2c3e50', TEXT_LIGHT, Math.min(14, w / 35), 8);
    });
  }
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  retryBtn: Rect,
  earnedPoints: number = 0
): void {
  ctx.fillStyle = '#0d0005';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = '#e74c3c';
  ctx.shadowBlur = 30;
  drawText(ctx, t('gameover.title'), w / 2, h * 0.35, `bold ${Math.min(72, w / 6)}px serif`, '#e74c3c', 'center', 'middle');
  ctx.restore();
  drawText(ctx, t('gameover.msg'), w / 2, h * 0.52, '20px serif', '#888', 'center', 'middle');
  if (earnedPoints > 0) {
    drawText(ctx, t('legacy.earned', { n: earnedPoints }), w / 2, h * 0.58, 'bold 18px serif', '#f1c40f', 'center', 'middle');
  }
  drawButton(ctx, retryBtn, t('gameover.retry'), '#c0392b', '#fff', 18, 8);
}

export function drawEnding(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  heroName: string,
  retryBtn: Rect,
  earnedPoints: number = 0
): void {
  ctx.fillStyle = '#0d1a0a';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = '#f1c40f';
  ctx.shadowBlur = 25;
  drawText(ctx, t('ending.title'), w / 2, h * 0.3, `bold ${Math.min(56, w / 9)}px serif`, GOLD_COLOR, 'center', 'middle');
  ctx.restore();
  drawText(ctx, `${tn(heroName)}${t('ending.msg')}`, w / 2, h * 0.46, '20px serif', '#2ecc71', 'center', 'middle');
  if (earnedPoints > 0) {
    drawText(ctx, t('legacy.earned', { n: earnedPoints }), w / 2, h * 0.56, 'bold 18px serif', '#f1c40f', 'center', 'middle');
  }
  drawButton(ctx, retryBtn, t('ending.retry'), GOLD_COLOR, TEXT_DARK, 18, 8);
}

/** マップチュートリアルオーバーレイ */
function _drawMapTutorial(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  step: number
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);

  const STEPS = [
    {
      title: t('mapTut.title1'),
      lines: [
        t('mapTut.line1'),
        t('mapTut.line2'),
        '',
        t('mapTut.next'),
      ],
    },
    {
      title: t('mapTut.title2'),
      lines: [
        t('mapTut.battle'),
        t('mapTut.elite'),
        t('mapTut.advisor'),
        t('mapTut.merchant'),
        t('mapTut.rest'),
        t('mapTut.event'),
        t('mapTut.boss'),
        '',
        t('mapTut.go'),
      ],
    },
  ];

  const stepIdx = step - 1;
  if (stepIdx < 0 || stepIdx >= STEPS.length) return;
  const s = STEPS[stepIdx];

  const lineH = 22;
  const bubbleW = Math.min(w - 30, 400);
  const bubbleH = s.lines.length * lineH + 56;
  const bubbleX = (w - bubbleW) / 2;
  const bubbleY = (h - bubbleH) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 14;
  drawPanel(ctx, { x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH }, '#1a1a2e', '#ccc', 14);
  ctx.restore();

  drawText(ctx, s.title, bubbleX + bubbleW / 2, bubbleY + 16, 'bold 18px serif', GOLD_COLOR, 'center', 'top');

  s.lines.forEach((line, i) => {
    drawText(ctx, line, bubbleX + bubbleW / 2, bubbleY + 44 + i * lineH, '14px serif', '#eee', 'center', 'top');
  });

  // ステップインジケーター
  const dotY = bubbleY + bubbleH + 12;
  for (let i = 0; i < STEPS.length; i++) {
    const dotX = bubbleX + bubbleW / 2 + (i - 0.5) * 18;
    ctx.beginPath();
    ctx.arc(dotX, dotY, i === stepIdx ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === stepIdx ? '#fff' : '#666';
    ctx.fill();
  }
}

/** バトルチュートリアルオーバーレイ */
function _drawTutorialOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  step: number,
  diceRects: Rect[],
  slotRects: Record<string, Rect>,
  confirmBtnRect: Rect,
  skillBtnRect: Rect
): void {
  // ステップごとにハイライト領域と説明を変える
  const STEPS: { highlight: () => Rect | null; title: string; lines: string[]; arrow?: 'down' | 'up' }[] = [
    {
      // Step 1: 戦闘画面の全体説明
      highlight: () => null,
      title: t('batTut.title1'),
      lines: [
        t('batTut.line1a'),
        t('batTut.line1b'),
        '',
        t('mapTut.next'),
      ],
    },
    {
      // Step 2: ダイスの説明
      highlight: () => {
        if (diceRects.length === 0) return null;
        const first = diceRects[0];
        const last = diceRects[diceRects.length - 1];
        return { x: first.x - 6, y: first.y - 6, w: last.x + last.w - first.x + 12, h: first.h + 12 };
      },
      title: t('batTut.title2'),
      lines: [
        t('batTut.line2a'),
        t('batTut.line2b'),
        t('batTut.line2c'),
        '',
        t('mapTut.next'),
      ],
      arrow: 'down',
    },
    {
      // Step 3: スロットの説明
      highlight: () => {
        const keys = Object.keys(slotRects);
        if (keys.length === 0) return null;
        const first = slotRects[keys[0]];
        const last = slotRects[keys[keys.length - 1]];
        return { x: first.x - 4, y: first.y - 4, w: last.x + last.w - first.x + 8, h: first.h + 8 };
      },
      title: t('batTut.title3'),
      lines: [
        t('batTut.line3a'),
        t('batTut.line3b'),
        t('batTut.line3c'),
        '',
        t('mapTut.next'),
      ],
      arrow: 'up',
    },
    {
      // Step 4: ダイスをタップして配置してみよう
      highlight: () => {
        if (diceRects.length === 0) return null;
        const first = diceRects[0];
        const last = diceRects[diceRects.length - 1];
        const slotKeys = Object.keys(slotRects);
        const firstSlot = slotRects[slotKeys[0]];
        const lastSlot = slotRects[slotKeys[slotKeys.length - 1]];
        return {
          x: Math.min(first.x, firstSlot.x) - 6,
          y: first.y - 6,
          w: Math.max(last.x + last.w, lastSlot.x + lastSlot.w) - Math.min(first.x, firstSlot.x) + 12,
          h: lastSlot.y + lastSlot.h - first.y + 12,
        };
      },
      title: t('batTut.title4'),
      lines: [
        t('batTut.line4a'),
        t('batTut.line4b'),
      ],
      arrow: 'up',
    },
    {
      // Step 5: 行動確定ボタンを押そう
      highlight: () => ({ x: confirmBtnRect.x - 4, y: confirmBtnRect.y - 4, w: confirmBtnRect.w + 8, h: confirmBtnRect.h + 8 }),
      title: t('batTut.title5'),
      lines: [
        t('batTut.line5a'),
        t('batTut.line5b'),
      ],
      arrow: 'up',
    },
  ];

  const stepIdx = step - 1;
  if (stepIdx < 0 || stepIdx >= STEPS.length) return;
  const s = STEPS[stepIdx];

  // ハイライト領域を残して暗い背景を描画
  const hlRect = s.highlight();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  if (hlRect) {
    // ハイライト領域を避けて4つの矩形で暗い背景を塗る
    ctx.fillRect(0, 0, w, hlRect.y);                                      // 上
    ctx.fillRect(0, hlRect.y, hlRect.x, hlRect.h);                        // 左
    ctx.fillRect(hlRect.x + hlRect.w, hlRect.y, w - hlRect.x - hlRect.w, hlRect.h); // 右
    ctx.fillRect(0, hlRect.y + hlRect.h, w, h - hlRect.y - hlRect.h);     // 下

    // 水色のグロー枠
    ctx.save();
    ctx.strokeStyle = '#5dade2';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#5dade2';
    ctx.shadowBlur = 16;
    drawRoundRect(ctx, hlRect.x, hlRect.y, hlRect.w, hlRect.h, 10);
    ctx.stroke();
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillRect(0, 0, w, h);
  }

  // 吹き出しパネルの位置計算
  const bubbleW = Math.min(w - 30, 380);
  const lineH = 22;
  const bubbleH = s.lines.length * lineH + 56;
  const bubbleX = (w - bubbleW) / 2;
  let bubbleY: number;
  if (hlRect && s.arrow === 'down') {
    bubbleY = hlRect.y - bubbleH - 20;
    if (bubbleY < 10) bubbleY = hlRect.y + hlRect.h + 20;
  } else if (hlRect && s.arrow === 'up') {
    bubbleY = hlRect.y - bubbleH - 20;
    if (bubbleY < 10) bubbleY = 10;
  } else {
    bubbleY = (h - bubbleH) / 2;
  }

  // 吹き出しパネル描画（白枠でハイライト枠と区別）
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 14;
  drawPanel(ctx, { x: bubbleX, y: bubbleY, w: bubbleW, h: bubbleH }, '#1a1a2e', '#ccc', 14);
  ctx.restore();

  // タイトル
  drawText(ctx, s.title, bubbleX + bubbleW / 2, bubbleY + 16, 'bold 18px serif', GOLD_COLOR, 'center', 'top');

  // 説明テキスト
  s.lines.forEach((line, i) => {
    drawText(ctx, line, bubbleX + bubbleW / 2, bubbleY + 44 + i * lineH, '14px serif', '#eee', 'center', 'top');
  });

  // ステップインジケーター（パネル下の外側に配置）
  const dotY = bubbleY + bubbleH + 12;
  for (let i = 0; i < STEPS.length; i++) {
    const dotX = bubbleX + bubbleW / 2 + (i - 2) * 18;
    ctx.beginPath();
    ctx.arc(dotX, dotY, i === stepIdx ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === stepIdx ? '#fff' : '#666';
    ctx.fill();
  }
}

export function drawLegacy(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  legacyData: LegacyData,
  upgradeRects: Rect[],
  backBtnRect: Rect,
  resetBtnRect: Rect = { x: 0, y: 0, w: 0, h: 0 },
  heroUnlockRects: Rect[] = [],
  scrollY: number = 0,
  activeTab: number = 0,
  tabRects: Rect[] = []
): void {
  ctx.fillStyle = '#0d0d1e';
  ctx.fillRect(0, 0, w, h);

  // ヘッダー部分（スクロールしない）
  // タイトル
  drawText(ctx, t('legacy.title'), w / 2, h * 0.06, `bold ${Math.min(28, w / 16)}px serif`, GOLD_COLOR, 'center', 'top');

  // ポイント表示
  drawText(ctx, `${t('legacy.points')}: ${legacyData.legacyPoints}pt`, w / 2, h * 0.13, `bold ${Math.min(22, w / 20)}px serif`, '#fff', 'center', 'top');

  // 直前の獲得ポイント
  if (legacyData.lastEarnedPoints > 0) {
    drawText(ctx, t('legacy.earned', { n: legacyData.lastEarnedPoints }), w / 2, h * 0.19, '16px serif', '#f1c40f', 'center', 'top');
  }

  // 統計
  const statsY = h * 0.23;
  const runText = legacyData.totalRuns > 0 ? t('legacy.runStats', { n: legacyData.totalRuns }) : '';
  const bestText = legacyData.bestChapter > 0 ? t('legacy.bestCh', { n: legacyData.bestChapter }) : t('legacy.noBest');
  drawText(ctx, `${runText}  ${bestText}`, w / 2, statsY, '13px serif', '#888', 'center', 'top');

  // スクロール対応（タブコンテンツ以降）- タブ下からクリップ
  const clipTop = tabRects.length > 0 ? tabRects[0].y + tabRects[0].h : h * 0.28;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, clipTop, w, h - clipTop);
  ctx.clip();
  ctx.translate(0, -scrollY);

  if (activeTab === 0) {
    // 能力強化タブ
    const nameKeys: Record<string, string> = {
      legacy_hp: 'legacy.hp', legacy_atk: 'legacy.atk', legacy_def: 'legacy.def',
      legacy_gold: 'legacy.gold', legacy_heal: 'legacy.heal',
    };

    LEGACY_UPGRADES.forEach((upg, i) => {
      const rect = upgradeRects[i];
      if (!rect) return;
      const level = legacyData.upgrades[upg.id] ?? 0;
      const isMaxed = level >= upg.maxLevel;
      const nextCost = isMaxed ? 0 : upg.costs[level];
      const canBuy = !isMaxed && legacyData.legacyPoints >= nextCost;

      // 背景
      const bgColor = canBuy ? '#1a2a1a' : '#1a1a2e';
      const borderColor = canBuy ? '#27ae60' : isMaxed ? '#f1c40f' : '#444';
      drawPanel(ctx, rect, bgColor, borderColor, 8);

      const nameKey = nameKeys[upg.id] ?? upg.id;

      // 名前
      drawText(ctx, t(nameKey), rect.x + 12, rect.y + 8, 'bold 14px serif', '#fff', 'left', 'top');

      // レベル
      const levelText = isMaxed ? t('legacy.maxed') : t('legacy.level', { n: level, max: upg.maxLevel });
      drawText(ctx, levelText, rect.x + rect.w - 12, rect.y + 8, '13px serif', isMaxed ? '#f1c40f' : '#aaa', 'right', 'top');

      // 効果説明
      let totalEffect = 0;
      for (let j = 0; j < level; j++) totalEffect += upg.effects[j];
      const nextEffect = isMaxed ? 0 : upg.effects[level];
      const descKey = `legacy.desc.${upg.stat}`;
      if (totalEffect > 0) {
        drawText(ctx, t(descKey, { n: totalEffect }), rect.x + 12, rect.y + 28, '12px serif', '#8f8', 'left', 'top');
      }
      if (!isMaxed) {
        const nextDesc = `→ +${nextEffect}`;
        drawText(ctx, nextDesc, rect.x + 12 + (totalEffect > 0 ? 80 : 0), rect.y + 28, '12px serif', '#aaa', 'left', 'top');
      }

      // コスト / 購入ボタン
      if (!isMaxed) {
        const costText = t('legacy.cost', { n: nextCost });
        const btnColor = canBuy ? '#27ae60' : '#555';
        const btnX = rect.x + rect.w - 90;
        const btnY = rect.y + rect.h - 30;
        drawRoundRect(ctx, btnX, btnY, 80, 24, 4);
        ctx.fillStyle = btnColor;
        ctx.fill();
        drawText(ctx, `${t('legacy.buy')} ${costText}`, btnX + 40, btnY + 12, '11px serif', '#fff', 'center', 'middle');
      }

      // レベルバー
      const barX = rect.x + 12;
      const barY = rect.y + rect.h - 10;
      const barW = rect.w - (isMaxed ? 24 : 114);
      for (let j = 0; j < upg.maxLevel; j++) {
        const segW = barW / upg.maxLevel - 2;
        const segX = barX + j * (segW + 2);
        ctx.fillStyle = j < level ? '#f1c40f' : '#333';
        drawRoundRect(ctx, segX, barY, segW, 4, 2);
        ctx.fill();
      }
    });
  } else {
    // 武将解放タブ
    HERO_UNLOCK_UPGRADES.forEach((upg, i) => {
      const rect = heroUnlockRects[i];
      if (!rect) return;
      const level = legacyData.upgrades[upg.id] ?? 0;
      const isUnlocked = level >= 1;
      const cost = upg.costs[0];
      const canBuy = !isUnlocked && legacyData.legacyPoints >= cost;

      const heroDef = HERO_DEFS.find((hd) => hd.id === upg.heroId);
      if (!heroDef) return;

      const bgColor = canBuy ? '#1a2a1a' : '#1a1a2e';
      const borderColor = canBuy ? '#27ae60' : isUnlocked ? '#f1c40f' : '#444';
      drawPanel(ctx, rect, bgColor, borderColor, 8);

      // ポートレート（小さく）
      const imgSize = rect.h - 12;
      const imgX = rect.x + 6;
      const imgY = rect.y + 6;
      const heroImg = getImage(heroDef.portraitKey);
      if (heroImg) {
        ctx.save();
        ctx.beginPath();
        drawRoundRect(ctx, imgX, imgY, imgSize, imgSize, 4);
        ctx.clip();
        if (!isUnlocked) ctx.globalAlpha = 0.4;
        ctx.drawImage(heroImg, imgX, imgY, imgSize, imgSize);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // 名前
      const textX = imgX + imgSize + 10;
      drawText(ctx, tn(heroDef.name), textX, rect.y + 10, 'bold 14px serif', '#fff', 'left', 'top');

      // ステータス
      drawText(ctx, `HP:${heroDef.stats.maxHp} ${t('select.atk')}:${heroDef.stats.attack} ${t('select.def')}:${heroDef.stats.defense}`, textX, rect.y + 30, '11px serif', '#aaa', 'left', 'top');

      // 解放ボタン or 解放済
      if (isUnlocked) {
        drawText(ctx, t('legacy.unlocked'), rect.x + rect.w - 12, rect.y + rect.h / 2, 'bold 13px serif', '#f1c40f', 'right', 'middle');
      } else {
        const costText = t('legacy.cost', { n: cost });
        const btnColor = canBuy ? '#27ae60' : '#555';
        const btnX = rect.x + rect.w - 90;
        const btnY = rect.y + rect.h - 30;
        drawRoundRect(ctx, btnX, btnY, 80, 24, 4);
        ctx.fillStyle = btnColor;
        ctx.fill();
        drawText(ctx, `${t('legacy.unlock')} ${costText}`, btnX + 40, btnY + 12, '11px serif', '#fff', 'center', 'middle');
      }
    });
  }

  // 戻るボタン（スクロール内）
  drawButton(ctx, backBtnRect, t('legacy.back'), '#555', '#fff', 16, 8);

  ctx.restore(); // スクロール translate を戻す

  // ヘッダー＋タブ再描画（固定位置 - スクロールコンテンツの上に上書き）
  if (tabRects.length > 0) {
    const headerBottom = tabRects[0].y + tabRects[0].h;
    ctx.fillStyle = '#0d0d1e';
    ctx.fillRect(0, 0, w, headerBottom);
  }
  // タイトル
  drawText(ctx, t('legacy.title'), w / 2, h * 0.06, `bold ${Math.min(28, w / 16)}px serif`, GOLD_COLOR, 'center', 'top');
  // ポイント表示
  drawText(ctx, `${t('legacy.points')}: ${legacyData.legacyPoints}pt`, w / 2, h * 0.13, `bold ${Math.min(22, w / 20)}px serif`, '#fff', 'center', 'top');
  // 直前の獲得ポイント
  if (legacyData.lastEarnedPoints > 0) {
    drawText(ctx, t('legacy.earned', { n: legacyData.lastEarnedPoints }), w / 2, h * 0.19, '16px serif', '#f1c40f', 'center', 'top');
  }
  // 統計
  {
    const sY = h * 0.23;
    const rText = legacyData.totalRuns > 0 ? t('legacy.runStats', { n: legacyData.totalRuns }) : '';
    const bText = legacyData.bestChapter > 0 ? t('legacy.bestCh', { n: legacyData.bestChapter }) : t('legacy.noBest');
    drawText(ctx, `${rText}  ${bText}`, w / 2, sY, '13px serif', '#888', 'center', 'top');
  }
  // タブ
  const tabLabels = [t('legacy.tabAbility'), t('legacy.tabHero')];
  tabRects.forEach((rect, i) => {
    const isActive = i === activeTab;
    ctx.fillStyle = isActive ? '#2a2a4e' : '#151528';
    drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.fill();
    if (isActive) {
      ctx.fillStyle = GOLD_COLOR;
      ctx.fillRect(rect.x + 4, rect.y + rect.h - 3, rect.w - 8, 3);
    }
    const textColor = isActive ? GOLD_COLOR : '#666';
    drawText(ctx, tabLabels[i], rect.x + rect.w / 2, rect.y + rect.h / 2, `bold 14px serif`, textColor, 'center', 'middle');
  });

  // リセットボタン（固定位置）
  if (resetBtnRect.w > 0) {
    drawButton(ctx, resetBtnRect, t('legacy.reset'), '#c0392b', '#fff', 12, 6);
  }
}

export { pointInRect };
