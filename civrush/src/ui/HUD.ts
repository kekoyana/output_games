import Phaser from 'phaser';
import type { GameState } from '../models/types';
import { getEraName } from '../systems/turnSystem';
import { t } from '../i18n';

export class HUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private turnText: Phaser.GameObjects.Text;
  private eraText: Phaser.GameObjects.Text;
  private productionText: Phaser.GameObjects.Text;
  private scienceText: Phaser.GameObjects.Text;
  private phaseText: Phaser.GameObjects.Text;
  private infoText: Phaser.GameObjects.Text;
  private endTurnBtn: Phaser.GameObjects.Rectangle;
  private endTurnText: Phaser.GameObjects.Text;
  private combatLogText: Phaser.GameObjects.Text;
  private errorText: Phaser.GameObjects.Text | null = null;
  private errorTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, onEndTurn: () => void) {
    this.scene = scene;
    const { width, height } = scene.scale;
    const isSmall = width < 500;
    const fs = isSmall ? 1.0 : 1.0; // font scale

    this.container = scene.add.container(0, 0).setDepth(100).setScrollFactor(0);

    // 上部バー背景
    const topBarH = isSmall ? 48 : 62;
    const topBar = scene.add.graphics();
    topBar.fillGradientStyle(0x0d1b3e, 0x0d1b3e, 0x1a2a5e, 0x1a2a5e, 1, 1, 0.85, 0.85);
    topBar.fillRect(0, 0, width, topBarH);
    topBar.lineStyle(1.5, 0x3a5faa, 0.8);
    topBar.lineBetween(0, topBarH, width, topBarH);
    this.container.add(topBar);

    // ===== 左側: ターン + 時代 =====
    this.turnText = scene.add.text(8, isSmall ? 5 : 9, `${t('turnLabel')}: 1/40`, {
      fontSize: `${Math.floor(15 * fs)}px`, color: '#ddeeff', fontStyle: 'bold',
    });
    this.container.add(this.turnText);

    this.eraText = scene.add.text(8, isSmall ? 22 : 34, t('eraAncient'), {
      fontSize: `${Math.floor(13 * fs)}px`, color: '#ffd700',
    });
    this.container.add(this.eraText);

    // ===== 中央: リソース横並び =====
    const capsuleW = isSmall ? 80 : 120;
    const capsuleH = isSmall ? 24 : 32;
    const capsuleY = isSmall ? 14 : 24;
    const capsuleGap = isSmall ? 8 : 20;
    const resFontSize = `${Math.floor(15 * fs)}px`;

    const prodBg = scene.add.graphics();
    prodBg.fillStyle(0x2a1800, 0.7);
    prodBg.fillRoundedRect(width / 2 - capsuleW - capsuleGap / 2, capsuleY, capsuleW, capsuleH, 8);
    prodBg.lineStyle(1, 0xffaa44, 0.6);
    prodBg.strokeRoundedRect(width / 2 - capsuleW - capsuleGap / 2, capsuleY, capsuleW, capsuleH, 8);
    this.container.add(prodBg);

    this.productionText = scene.add.text(width / 2 - capsuleGap / 2 - capsuleW / 2, capsuleY + capsuleH / 2, '🏭 0', {
      fontSize: resFontSize, color: '#ffbb55', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.productionText);

    const sciBg = scene.add.graphics();
    sciBg.fillStyle(0x001828, 0.7);
    sciBg.fillRoundedRect(width / 2 + capsuleGap / 2, capsuleY, capsuleW, capsuleH, 8);
    sciBg.lineStyle(1, 0x88aaff, 0.6);
    sciBg.strokeRoundedRect(width / 2 + capsuleGap / 2, capsuleY, capsuleW, capsuleH, 8);
    this.container.add(sciBg);

    this.scienceText = scene.add.text(width / 2 + capsuleGap / 2 + capsuleW / 2, capsuleY + capsuleH / 2, '💡 0', {
      fontSize: resFontSize, color: '#99bbff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.scienceText);

    // ===== フェーズ表示 =====
    this.phaseText = scene.add.text(width / 2, isSmall ? 2 : 8, '', {
      fontSize: `${Math.floor(11 * fs)}px`, color: '#88ffcc',
    }).setOrigin(0.5, 0);
    this.container.add(this.phaseText);

    // ===== 右側: 情報テキスト（スマホでは非表示） =====
    const infoW = isSmall ? 0 : 200;
    this.infoText = scene.add.text(width - 10, 8, '', {
      fontSize: `${Math.floor(12 * fs)}px`, color: '#cccccc', wordWrap: { width: infoW }, align: 'right',
    }).setOrigin(1, 0).setVisible(!isSmall);
    this.container.add(this.infoText);

    // ターン終了ボタン
    const btnW = isSmall ? 100 : 140;
    const btnH = isSmall ? 38 : 48;
    const btnX = width - btnW / 2 - 10;
    const btnY = height - (isSmall ? 24 : 32);

    const btnBg = scene.add.graphics();
    btnBg.fillGradientStyle(0x2255cc, 0x2255cc, 0x1133aa, 0x1133aa, 1, 1, 1, 1);
    btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 10);
    btnBg.lineStyle(1.5, 0x6699ff, 0.9);
    btnBg.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 10);
    this.container.add(btnBg);

    this.endTurnBtn = scene.add.rectangle(btnX, btnY, btnW, btnH, 0x000000, 0)
      .setInteractive({ cursor: 'pointer' });
    this.container.add(this.endTurnBtn);

    this.endTurnText = scene.add.text(btnX, btnY, t('endTurn'), {
      fontSize: `${Math.floor(16 * fs)}px`, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.endTurnText);

    const btnHover = scene.add.graphics().setAlpha(0);
    btnHover.fillStyle(0xffffff, 0.12);
    btnHover.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 10);
    this.container.add(btnHover);

    this.endTurnBtn.on('pointerover', () => {
      btnHover.setAlpha(1);
      this.endTurnText.setStyle({ color: '#aaccff' });
    });
    this.endTurnBtn.on('pointerout', () => {
      btnHover.setAlpha(0);
      this.endTurnText.setStyle({ color: '#ffffff' });
    });
    this.endTurnBtn.on('pointerdown', onEndTurn);

    // 戦闘ログ（左下、スマホでは小さく）
    const logW = isSmall ? 160 : 220;
    const logH = isSmall ? 70 : 108;
    const logBg = scene.add.graphics();
    logBg.fillStyle(0x000000, 0.55);
    logBg.fillRoundedRect(4, height - logH - 4, logW, logH, 6);
    logBg.lineStyle(1, 0x334466, 0.7);
    logBg.strokeRoundedRect(4, height - logH - 4, logW, logH, 6);
    this.container.add(logBg);

    this.combatLogText = scene.add.text(10, height - logH, '', {
      fontSize: `${Math.floor(11 * fs)}px`, color: '#ffccaa', wordWrap: { width: logW - 16 }, lineSpacing: 2,
    });
    this.container.add(this.combatLogText);
  }

  update(state: GameState): void {
    const player = state.players.get('player');
    if (!player) return;

    this.turnText.setText(`${t('turnLabel')}: ${state.turn}/${state.maxTurns}`);
    this.eraText.setText(getEraName(player.currentEra));
    this.productionText.setText(`🏭 ${Math.floor(player.production)}`);
    this.scienceText.setText(`💡 ${Math.floor(player.science)}`);

    const phaseLabels: Record<string, string> = {
      unit_move: t('phaseUnit'),
      ai_turn: t('phaseAI'),
    };
    this.phaseText.setText(phaseLabels[state.phase] ?? '');

    this.combatLogText.setText(state.combatLog.slice(0, 5).join('\n'));
  }

  setInfoText(text: string): void {
    this.infoText.setText(text);
  }

  showErrorMessage(message: string): void {
    if (this.errorText) {
      this.errorText.destroy();
      this.errorText = null;
    }
    if (this.errorTimer) {
      this.errorTimer.destroy();
      this.errorTimer = null;
    }

    const { width, height } = this.scene.scale;
    this.errorText = this.scene.add.text(width / 2, height / 2 - 60, message, {
      fontSize: '18px',
      color: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#00000099',
      padding: { x: 14, y: 10 },
    }).setOrigin(0.5).setDepth(500).setScrollFactor(0);

    this.errorTimer = this.scene.time.delayedCall(2000, () => {
      if (this.errorText) {
        this.errorText.destroy();
        this.errorText = null;
      }
      this.errorTimer = null;
    });
  }

  setEndTurnEnabled(enabled: boolean): void {
    if (enabled) {
      this.endTurnBtn.setFillStyle(0x000000, 0).setInteractive();
      this.endTurnText.setColor('#ffffff');
    } else {
      this.endTurnBtn.setFillStyle(0x000000, 0).disableInteractive();
      this.endTurnText.setColor('#888888');
    }
  }

  destroy(): void {
    if (this.errorText) this.errorText.destroy();
    if (this.errorTimer) this.errorTimer.destroy();
    this.container.destroy();
  }
}
