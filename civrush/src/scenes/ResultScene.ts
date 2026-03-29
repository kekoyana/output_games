import Phaser from 'phaser';
import type { GameState, PlayerId } from '../models/types';
import { getEraName } from '../systems/turnSystem';
import { t } from '../i18n';
import titleBgUrl from '../assets/title_bg.jpg';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  preload(): void {
    this.load.image('title_bg', titleBgUrl);
  }

  create(data: { state: GameState }): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const state = data.state;
    const isSmall = width < 500;

    // 背景画像
    const bg = this.add.image(cx, cy, 'title_bg');
    const bgScale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(bgScale);

    // 暗めのオーバーレイ
    this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0, 0);

    // 勝利/敗北判定
    const isPlayerWinner = state.winner === 'player';
    const titleColor = isPlayerWinner ? '#ffd700' : '#ff4444';
    const titleText = isPlayerWinner ? t('victory') : t('defeat');

    this.add.text(cx, cy - 200, titleText, {
      fontSize: isSmall ? '48px' : '72px',
      color: titleColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: isSmall ? 4 : 6,
    }).setOrigin(0.5);

    // 勝利種別
    const victoryLabel = state.victoryType === 'conquest'
      ? t('conquestVictory')
      : state.victoryType === 'science'
        ? t('scienceVictory')
        : t('timeoutVictory');

    const winnerPlayer = state.winner ? state.players.get(state.winner) : null;
    const winnerName = winnerPlayer?.name ?? t('unknown');

    this.add.text(cx, cy - 130, `【${victoryLabel}】 ${winnerName}`, {
      fontSize: isSmall ? '18px' : '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 95, `${t('achievedTurn')}: ${state.turn}`, {
      fontSize: isSmall ? '16px' : '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // 統計パネル
    this.drawStatsPanel(state, cx, cy);

    // もう一度ボタン
    const retryBtn = this.add.rectangle(cx, cy + 230, isSmall ? 160 : 200, isSmall ? 48 : 55, 0x4488ff)
      .setInteractive({ cursor: 'pointer' });
    const retryText = this.add.text(cx, cy + 230, t('playAgain'), {
      fontSize: isSmall ? '18px' : '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    retryBtn.on('pointerover', () => retryBtn.setFillStyle(0x66aaff));
    retryBtn.on('pointerout', () => retryBtn.setFillStyle(0x4488ff));
    retryBtn.on('pointerdown', () => {
      this.scene.start('TitleScene');
    });
  }

  private drawStatsPanel(state: GameState, cx: number, cy: number): void {
    const { width } = this.scale;
    const isSmall = width < 500;
    const panelW = Math.min(480, width - 20);

    // パネル背景
    this.add.rectangle(cx, cy + 60, panelW, 220, 0x222222, 0.9);
    this.add.rectangle(cx, cy + 60, panelW, 220, 0x444444, 1).setFillStyle(0x222222).setStrokeStyle(1, 0x666666);

    this.add.text(cx, cy - 50, t('gameStats'), {
      fontSize: isSmall ? '18px' : '20px',
      color: '#ffd700',
    }).setOrigin(0.5);

    const playerIds: PlayerId[] = ['player', ...state.aiPlayerIds];
    const colWidth = isSmall ? Math.floor((panelW - 80) / playerIds.length) : 120;
    const startX = cx - (playerIds.length - 1) * colWidth / 2;
    const labelX = cx - panelW / 2 + 10;

    // ヘッダー
    playerIds.forEach((id, i) => {
      const player = state.players.get(id);
      if (!player) return;
      const color = player.colorHex;
      const maxLen = isSmall ? 4 : 6;
      this.add.text(startX + i * colWidth, cy - 20, player.name.length > maxLen ? player.name.slice(0, maxLen) + '..' : player.name, {
        fontSize: isSmall ? '12px' : '13px',
        color,
        fontStyle: 'bold',
      }).setOrigin(0.5);
    });

    const rows = [
      { label: t('statTiles'), key: 'tilesOwned' as const },
      { label: t('statTechs'), key: 'techsResearched' as const },
      { label: t('statKills'), key: 'unitsKilled' as const },
      { label: t('statLost'), key: 'unitsLost' as const },
    ];

    rows.forEach((row, rowIdx) => {
      const rowY = cy + 10 + rowIdx * 35;

      this.add.text(labelX, rowY, row.label, {
        fontSize: isSmall ? '13px' : '14px',
        color: '#cccccc',
      }).setOrigin(0, 0.5);

      playerIds.forEach((id, i) => {
        const val = state.stats[row.key].get(id) ?? 0;
        this.add.text(startX + i * colWidth, rowY, String(val), {
          fontSize: isSmall ? '15px' : '16px',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5);
      });
    });

    // 時代表示
    playerIds.forEach((id, i) => {
      const player = state.players.get(id);
      if (!player) return;
      const eraName = getEraName(player.currentEra);
      this.add.text(startX + i * colWidth, cy + 155, eraName, {
        fontSize: isSmall ? '12px' : '13px',
        color: '#88ccff',
      }).setOrigin(0.5);
    });
    this.add.text(labelX, cy + 155, t('statEra'), {
      fontSize: isSmall ? '13px' : '14px',
      color: '#cccccc',
    }).setOrigin(0, 0.5);
  }
}
