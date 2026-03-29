import Phaser from 'phaser';
import type { GameState, PlayerId, TechId } from '../models/types';
import { researchTech } from '../systems/citySystem';
import { t } from '../i18n';

function getEraLabel(era: string): string {
  if (era === 'ancient') return t('eraAncient');
  if (era === 'medieval') return t('eraMedieval');
  if (era === 'modern') return t('eraModern');
  return t('eraAtomic');
}

const ERA_BG_COLORS: Record<string, number> = {
  ancient: 0x2e1e0e,
  medieval: 0x0e1e2e,
  modern: 0x1e0e2e,
  atomic: 0x0e2e1e,
};

const ERA_ACCENT_COLORS: Record<string, number> = {
  ancient: 0xcc8833,
  medieval: 0x3388cc,
  modern: 0xaa33cc,
  atomic: 0x33cc88,
};

// 上→下フロー: 同時代内の前提関係は行をずらす
// row=絶対行番号, col=横位置(0-3)
const TECH_POSITIONS: Record<TechId, { row: number; col: number }> = {
  // Ancient: row 0-1
  agriculture:      { row: 0, col: 0 },
  bronze:           { row: 0, col: 1 },
  calendar:         { row: 0, col: 3 },
  archery:          { row: 1, col: 2 },   // ← bronze なので行ずらし
  // Medieval: row 2
  fortification:    { row: 2, col: 0 },
  iron:             { row: 2, col: 1 },
  mathematics:      { row: 2, col: 2 },
  printing:         { row: 2, col: 3 },
  // Modern: row 3-4
  industrialization:{ row: 3, col: 0 },
  mechanization:    { row: 3, col: 2 },
  electricity:      { row: 3, col: 3 },
  railroad:         { row: 4, col: 1 },   // ← industrialization なので行ずらし
  // Atomic: row 5-6
  nuclear_power:    { row: 5, col: 0 },
  computers:        { row: 5, col: 3 },
  space_program:    { row: 6, col: 1.5 }, // ← nuclear_power, computers なので行ずらし
};

// 時代→行範囲
const ERA_ROW_RANGES: Array<{ era: string; startRow: number; endRow: number }> = [
  { era: 'ancient',  startRow: 0, endRow: 1 },
  { era: 'medieval', startRow: 2, endRow: 2 },
  { era: 'modern',   startRow: 3, endRow: 4 },
  { era: 'atomic',   startRow: 5, endRow: 6 },
];

const TECH_ERA: Partial<Record<TechId, string>> = {
  agriculture: 'ancient', bronze: 'ancient', archery: 'ancient', calendar: 'ancient',
  fortification: 'medieval', iron: 'medieval', mathematics: 'medieval', printing: 'medieval',
  industrialization: 'modern', railroad: 'modern', mechanization: 'modern', electricity: 'modern',
  nuclear_power: 'atomic', computers: 'atomic', space_program: 'atomic',
};

export class TechTreeModal {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private onClose: () => void;
  private onResearch: (techId: TechId) => void;
  private pulseTimers: Phaser.Time.TimerEvent[] = [];

  constructor(
    scene: Phaser.Scene,
    onClose: () => void,
    onResearch: (techId: TechId) => void
  ) {
    this.scene = scene;
    this.onClose = onClose;
    this.onResearch = onResearch;
    this.container = scene.add.container(0, 0).setDepth(200).setVisible(false).setScrollFactor(0);
    this.buildUI();
  }

  private buildUI(): void {
    const { width, height } = this.scene.scale;
    const isSmall = width < 500;
    const panelW = isSmall ? width - 4 : Math.min(720, width - 16);
    const panelH = isSmall ? height - 4 : Math.min(560, height - 16);
    const cx = width / 2;
    const cy = height / 2;

    const overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.75)
      .setOrigin(0, 0).setInteractive();
    overlay.on('pointerdown', () => this.hide());
    this.container.add(overlay);

    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(cx - panelW / 2 + 5, cy - panelH / 2 + 5, panelW, panelH, 12);
    this.container.add(shadow);

    const panelBg = this.scene.add.graphics();
    panelBg.fillGradientStyle(0x0f0f2a, 0x0f0f2a, 0x1a1a3e, 0x1a1a3e, 1, 1, 1, 1);
    panelBg.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12);
    panelBg.lineStyle(2, 0x4488ff, 0.9);
    panelBg.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12);
    this.container.add(panelBg);

    const panel = this.scene.add.rectangle(cx, cy, panelW, panelH, 0x000000, 0)
      .setInteractive();
    this.container.add(panel);

    const title = this.scene.add.text(cx, cy - panelH / 2 + 14, t('techTreeTitle'), {
      fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this.container.add(title);

    const titleLine = this.scene.add.graphics();
    titleLine.lineStyle(1, 0x4488ff, 0.5);
    titleLine.lineBetween(cx - panelW / 2 + 16, cy - panelH / 2 + 42, cx + panelW / 2 - 16, cy - panelH / 2 + 42);
    this.container.add(titleLine);

    const closeBtn = this.scene.add.text(cx + panelW / 2 - 14, cy - panelH / 2 + 8, '✕', {
      fontSize: '22px', color: '#ff6666',
    }).setOrigin(1, 0).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff9999'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);
  }

  show(state: GameState, activeCityId: string | null): void {
    this.stopPulseTimers();
    this.container.removeAll(true);
    this.buildUI();
    this.buildTechNodes(state, activeCityId);
    this.container.setVisible(true);
    this.isVisible = true;
    this.setupScroll();
  }

  private scrollY = 0;
  private scrollMinY = 0;

  private setupScroll(): void {
    const { width, height } = this.scene.scale;
    if (width >= 500) return; // PCではスクロール不要

    const panelH = height - 4;
    const contentH = panelH - 52;
    const totalRows = 7;
    const minNodeH = 70;
    const rowGap = Math.max(minNodeH + 12, Math.floor(contentH / totalRows));
    const totalContentH = totalRows * rowGap + 60;
    this.scrollMinY = Math.min(0, contentH - totalContentH);
    this.scrollY = 0;

    let dragStartY = 0;
    let dragStartScroll = 0;

    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.isVisible) return;
      dragStartY = p.y;
      dragStartScroll = this.scrollY;
    });
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isVisible || !p.isDown) return;
      const dy = p.y - dragStartY;
      if (Math.abs(dy) > 5) {
        this.scrollY = Math.max(this.scrollMinY, Math.min(0, dragStartScroll + dy));
        // コンテナ内の全要素をオフセット（オーバーレイ・背景・タイトル以外）
        // container.yでスクロール
        this.container.y = this.scrollY;
      }
    });
  }

  hide(): void {
    this.stopPulseTimers();
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.container.y = 0;
    this.scrollY = 0;
    this.isVisible = false;
    this.onClose();
  }

  get visible(): boolean { return this.isVisible; }

  private stopPulseTimers(): void {
    this.pulseTimers.forEach(t => t.destroy());
    this.pulseTimers = [];
  }

  private buildTechNodes(state: GameState, activeCityId: string | null): void {
    const { width, height } = this.scene.scale;
    const isSmall = width < 500;
    const panelW = isSmall ? width - 4 : Math.min(720, width - 16);
    const panelH = isSmall ? height - 4 : Math.min(560, height - 16);
    const cx = width / 2;
    const cy = height / 2;

    const player = state.players.get('player');
    if (!player) return;

    const contentW = panelW - 32;
    const contentH = panelH - 52;
    const totalRows = 7;
    const colCount = 4;
    const colGap = Math.floor(contentW / colCount);
    // スマホ: ノードの高さを十分確保（縦にはみ出してOK、スクロールで対応）
    const minNodeH = isSmall ? 70 : 56;
    const rowGap = isSmall ? Math.max(minNodeH + 12, Math.floor(contentH / totalRows)) : Math.floor(contentH / totalRows);
    const nodeW = Math.min(155, colGap - 8);
    const nodeH = Math.min(isSmall ? 70 : 56, rowGap - 6);

    // フォントサイズ
    const nameFontSize = isSmall ? '14px' : '13px';
    const descFontSize = isSmall ? '12px' : '11px';
    const eraFontSize = isSmall ? '13px' : '12px';

    const startX = cx - panelW / 2 + 16;
    const startY = cy - panelH / 2 + 48;

    // 時代別背景帯（横帯、行範囲に合わせる）
    ERA_ROW_RANGES.forEach(({ era, startRow, endRow }) => {
      const bandY = startY + startRow * rowGap;
      const bandH = (endRow - startRow + 1) * rowGap;
      const bgGraphics = this.scene.add.graphics();
      bgGraphics.fillStyle(ERA_BG_COLORS[era], 0.3);
      bgGraphics.fillRoundedRect(startX, bandY, contentW, bandH - 2, 6);
      bgGraphics.lineStyle(1, ERA_ACCENT_COLORS[era], 0.25);
      bgGraphics.strokeRoundedRect(startX, bandY, contentW, bandH - 2, 6);
      this.container.add(bgGraphics);

      const accentHex = `#${ERA_ACCENT_COLORS[era].toString(16).padStart(6, '0')}`;
      this.container.add(this.scene.add.text(startX + 4, bandY + 2, getEraLabel(era), {
        fontSize: eraFontSize, color: accentHex, fontStyle: 'bold',
      }));
    });

    // ノード中心位置キャッシュ
    const nodePositions = new Map<TechId, { x: number; y: number }>();

    const getNodeXY = (pos: { row: number; col: number }) => {
      const nx = startX + pos.col * colGap + (colGap - nodeW) / 2;
      const ny = startY + pos.row * rowGap + 16;
      return { nx, ny };
    };

    state.techTree.nodes.forEach((_tech, techId) => {
      const pos = TECH_POSITIONS[techId];
      if (!pos) return;
      const { nx, ny } = getNodeXY(pos);
      nodePositions.set(techId, { x: nx + nodeW / 2, y: ny + nodeH / 2 });
    });

    // 各技術ノード描画
    state.techTree.nodes.forEach((tech, techId) => {
      const pos = TECH_POSITIONS[techId];
      if (!pos) return;
      const { nx, ny } = getNodeXY(pos);

      const isResearched = player.researchedTechs.has(techId);
      const canResearch = this.canResearch(state, player.id, techId);
      const affordable = player.science >= tech.cost;

      const era = TECH_ERA[techId] ?? 'ancient';
      let bgColor = ERA_BG_COLORS[era] ?? 0x333355;
      let strokeColor = 0x444466;
      let strokeWidth = 1;
      if (isResearched) { bgColor = 0x1a3a1a; strokeColor = 0x44dd44; strokeWidth = 1.5; }
      else if (canResearch && affordable) { bgColor = 0x1a2a3a; strokeColor = 0x4488ff; strokeWidth = 2; }

      const nodeBg = this.scene.add.graphics();
      nodeBg.fillStyle(bgColor, 0.95);
      nodeBg.fillRoundedRect(nx, ny, nodeW, nodeH, 6);
      nodeBg.lineStyle(strokeWidth, strokeColor, 0.9);
      nodeBg.strokeRoundedRect(nx, ny, nodeW, nodeH, 6);
      this.container.add(nodeBg);

      const nodeHitArea = this.scene.add.rectangle(nx + nodeW / 2, ny + nodeH / 2, nodeW, nodeH, 0x000000, 0);
      this.container.add(nodeHitArea);

      // 技術名
      const maxNameW = nodeW - 10;
      const nameText = this.scene.add.text(nx + 4, ny + 2, tech.name, {
        fontSize: nameFontSize,
        color: isResearched ? '#88ff88' : canResearch ? '#aaccff' : '#888899',
        fontStyle: isResearched ? 'bold' : 'normal',
        wordWrap: { width: maxNameW },
        maxLines: 1,
      });
      if (nameText.width > maxNameW) {
        nameText.setScale(maxNameW / nameText.width);
      }
      this.container.add(nameText);

      // コスト
      const nameH = nameText.height * (nameText.scaleY || 1);
      const row2Y = ny + 2 + Math.min(nameH, 18);
      const remainH = ny + nodeH - row2Y - 3;
      const row2MaxW = nodeW - 8;
      if (remainH > 8) {
        const costColor = affordable ? '#88aaff' : '#ff6666';
        const costText = this.scene.add.text(nx + 4, row2Y, `💡${tech.cost}`, {
          fontSize: descFontSize,
          color: isResearched ? '#666666' : costColor,
        });
        this.container.add(costText);

        // 説明（手動で文字単位改行して枠内に収める）
        const descY = row2Y + costText.height + 1;
        const descRemainH = ny + nodeH - descY - 2;
        if (descRemainH > 8) {
          const wrappedDesc = this.wrapText(tech.description, row2MaxW, descFontSize);
          const descText = this.scene.add.text(nx + 4, descY, wrappedDesc, {
            fontSize: descFontSize,
            color: isResearched ? '#888888' : '#ffffff',
            lineSpacing: 1,
          });
          if (descText.height > descRemainH) {
            descText.setCrop(0, 0, row2MaxW, descRemainH);
          }
          this.container.add(descText);
        }
      }


      // 研究済みチェック
      if (isResearched) {
        this.container.add(this.scene.add.text(nx + nodeW - 6, ny + 3, '✓', {
          fontSize: '16px', color: '#44ff44',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 0));
      }

      // 研究可能ノードのパルス＆クリック
      if (canResearch && !isResearched && affordable && activeCityId) {
        nodeHitArea.setInteractive({ cursor: 'pointer' });
        let pulseBright = false;
        const timer = this.scene.time.addEvent({
          delay: 700, loop: true,
          callback: () => {
            pulseBright = !pulseBright;
            nodeBg.clear();
            const pc = pulseBright ? 0x223355 : bgColor;
            nodeBg.fillStyle(pc, 0.95);
            nodeBg.fillRoundedRect(nx, ny, nodeW, nodeH, 6);
            nodeBg.lineStyle(pulseBright ? 2.5 : strokeWidth, pulseBright ? 0x66aaff : strokeColor, 0.9);
            nodeBg.strokeRoundedRect(nx, ny, nodeW, nodeH, 6);
          },
        });
        this.pulseTimers.push(timer);

        nodeHitArea.on('pointerover', () => {
          nodeBg.clear();
          nodeBg.fillStyle(0x2a4466, 0.95);
          nodeBg.fillRoundedRect(nx, ny, nodeW, nodeH, 6);
          nodeBg.lineStyle(2.5, 0xffd700, 1.0);
          nodeBg.strokeRoundedRect(nx, ny, nodeW, nodeH, 6);
        });
        nodeHitArea.on('pointerout', () => {
          nodeBg.clear();
          nodeBg.fillStyle(bgColor, 0.95);
          nodeBg.fillRoundedRect(nx, ny, nodeW, nodeH, 6);
          nodeBg.lineStyle(strokeWidth, strokeColor, 0.9);
          nodeBg.strokeRoundedRect(nx, ny, nodeW, nodeH, 6);
        });
        nodeHitArea.on('pointerdown', () => {
          this.onResearch(techId);
          this.hide();
        });
      }
    });

    // 接続線（ノードの上に描画）
    const lineGraphics = this.scene.add.graphics();
    this.container.add(lineGraphics);

    state.techTree.nodes.forEach((tech, techId) => {
      const toPos = nodePositions.get(techId);
      if (!toPos) return;
      const isResearched = player.researchedTechs.has(techId);

      tech.requires.forEach(reqId => {
        const fromPos = nodePositions.get(reqId);
        if (!fromPos) return;

        const reqResearched = player.researchedTechs.has(reqId);
        const lineColor = isResearched ? 0x44dd44 : reqResearched ? 0xffaa44 : 0x556677;
        const lineAlpha = isResearched ? 1.0 : reqResearched ? 0.85 : 0.4;
        const lineWidth = isResearched ? 3 : reqResearched ? 2.5 : 1.5;

        lineGraphics.lineStyle(lineWidth, lineColor, lineAlpha);
        lineGraphics.beginPath();
        lineGraphics.moveTo(fromPos.x, fromPos.y);
        lineGraphics.lineTo(toPos.x, toPos.y);
        lineGraphics.strokePath();

        // 矢印
        const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
        const arrowLen = 9;
        const edgeDist = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
          ? nodeW / 2 + 3 : nodeH / 2 + 3;
        const arrowX = toPos.x - Math.cos(angle) * edgeDist;
        const arrowY = toPos.y - Math.sin(angle) * edgeDist;

        lineGraphics.fillStyle(lineColor, lineAlpha);
        lineGraphics.beginPath();
        lineGraphics.moveTo(arrowX, arrowY);
        lineGraphics.lineTo(
          arrowX - Math.cos(angle - 0.5) * arrowLen,
          arrowY - Math.sin(angle - 0.5) * arrowLen
        );
        lineGraphics.lineTo(
          arrowX - Math.cos(angle + 0.5) * arrowLen,
          arrowY - Math.sin(angle + 0.5) * arrowLen
        );
        lineGraphics.closePath();
        lineGraphics.fillPath();
      });
    });
  }

  /** 文字単位で折り返し（日本語対応） */
  private wrapText(text: string, maxWidth: number, fontSize: string): string {
    const size = parseInt(fontSize, 10) || 12;
    // 1文字あたりの幅を概算（日本語は等幅に近い）
    const charW = size * 0.85;
    const charsPerLine = Math.max(1, Math.floor(maxWidth / charW));
    if (text.length <= charsPerLine) return text;
    const lines: string[] = [];
    for (let i = 0; i < text.length; i += charsPerLine) {
      lines.push(text.slice(i, i + charsPerLine));
    }
    return lines.join('\n');
  }

  private canResearch(state: GameState, playerId: PlayerId, techId: TechId): boolean {
    const player = state.players.get(playerId);
    const tech = state.techTree.nodes.get(techId);
    if (!player || !tech) return false;
    if (player.researchedTechs.has(techId)) return false;
    return tech.requires.every(req => player.researchedTechs.has(req));
  }

  destroy(): void {
    this.stopPulseTimers();
    this.container.destroy();
  }
}
