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

    this.container = scene.add.container(0, 0).setDepth(100).setScrollFactor(0);

    // 上部バー背景（グラデーション風: ダークブルー不透明→下側透明）
    const topBar = scene.add.graphics();
    topBar.fillGradientStyle(0x0d1b3e, 0x0d1b3e, 0x1a2a5e, 0x1a2a5e, 1, 1, 0.85, 0.85);
    topBar.fillRect(0, 0, width, 62);
    // 下線
    topBar.lineStyle(1.5, 0x3a5faa, 0.8);
    topBar.lineBetween(0, 62, width, 62);
    this.container.add(topBar);

    // ===== 左側: ターン + 時代 =====
    this.turnText = scene.add.text(14, 9, `${t('turnLabel')}: 1/40`, {
      fontSize: '15px', color: '#ddeeff', fontStyle: 'bold',
    });
    this.container.add(this.turnText);

    this.eraText = scene.add.text(14, 34, t('eraAncient'), {
      fontSize: '13px', color: '#ffd700',
    });
    this.container.add(this.eraText);

    // ===== 中央: リソース横並び（装飾的に） =====
    // 生産力背景カプセル
    const prodBg = scene.add.graphics();
    prodBg.fillStyle(0x2a1800, 0.7);
    prodBg.fillRoundedRect(width / 2 - 140, 24, 120, 32, 8);
    prodBg.lineStyle(1, 0xffaa44, 0.6);
    prodBg.strokeRoundedRect(width / 2 - 140, 24, 120, 32, 8);
    this.container.add(prodBg);

    this.productionText = scene.add.text(width / 2 - 80, 40, '🏭 0', {
      fontSize: '15px', color: '#ffbb55', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.productionText);

    // 科学力背景カプセル
    const sciBg = scene.add.graphics();
    sciBg.fillStyle(0x001828, 0.7);
    sciBg.fillRoundedRect(width / 2 + 20, 24, 120, 32, 8);
    sciBg.lineStyle(1, 0x88aaff, 0.6);
    sciBg.strokeRoundedRect(width / 2 + 20, 24, 120, 32, 8);
    this.container.add(sciBg);

    this.scienceText = scene.add.text(width / 2 + 80, 40, '💡 0', {
      fontSize: '15px', color: '#99bbff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.scienceText);

    // ===== フェーズ表示（リソースカプセルの上） =====
    this.phaseText = scene.add.text(width / 2, 8, '', {
      fontSize: '11px', color: '#88ffcc',
    }).setOrigin(0.5, 0);
    this.container.add(this.phaseText);

    // ===== 右側: 情報テキスト =====
    this.infoText = scene.add.text(width - 10, 8, '', {
      fontSize: '12px', color: '#cccccc', wordWrap: { width: 200 }, align: 'right',
    }).setOrigin(1, 0);
    this.container.add(this.infoText);

    // ターン終了ボタン（グラデーション風）
    const btnW = 140;
    const btnH = 48;
    const btnX = width - 75;
    const btnY = height - 32;

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
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.endTurnText);

    // ホバーエフェクト（ボタン上のオーバーレイ）
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

    // 戦闘ログ（左下）
    const logBg = scene.add.graphics();
    logBg.fillStyle(0x000000, 0.55);
    logBg.fillRoundedRect(4, height - 112, 220, 108, 6);
    logBg.lineStyle(1, 0x334466, 0.7);
    logBg.strokeRoundedRect(4, height - 112, 220, 108, 6);
    this.container.add(logBg);

    this.combatLogText = scene.add.text(10, height - 107, '', {
      fontSize: '11px', color: '#ffccaa', wordWrap: { width: 210 }, lineSpacing: 2,
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
