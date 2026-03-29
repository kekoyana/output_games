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
  private msgBarBg!: Phaser.GameObjects.Graphics;
  private msgBarRect = { x: 0, y: 0, w: 0, h: 0 };
  private msgTimer: Phaser.Time.TimerEvent | null = null;
  private msgCloseBtn!: Phaser.GameObjects.Text;
  private msgReopenBg!: Phaser.GameObjects.Graphics;
  private msgReopenBtn!: Phaser.GameObjects.Text;
  private lastMessageText = '';
  private lastMessageColor = '#ffffff';
  private onMessageTap: (() => void) | null = null;
  private msgTapArea!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, onEndTurn: () => void, onScienceTap?: () => void) {
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

    // 科学力カプセルをタップで技術ツリーを開く
    if (onScienceTap) {
      const sciHit = scene.add.rectangle(
        width / 2 + capsuleGap / 2 + capsuleW / 2, capsuleY + capsuleH / 2,
        capsuleW, capsuleH, 0x000000, 0
      ).setInteractive({ cursor: 'pointer' });
      sciHit.on('pointerdown', onScienceTap);
      this.container.add(sciHit);
    }

    // ===== フェーズ表示 =====
    this.phaseText = scene.add.text(width / 2, isSmall ? 2 : 8, '', {
      fontSize: `${Math.floor(11 * fs)}px`, color: '#88ffcc',
    }).setOrigin(0.5, 0);
    this.container.add(this.phaseText);

    // ===== 右側: 情報テキスト =====
    this.infoText = scene.add.text(width - 10, 8, '', {
      fontSize: '12px', color: '#cccccc', wordWrap: { width: 200 }, align: 'right',
    }).setOrigin(1, 0).setVisible(!isSmall);
    this.container.add(this.infoText);

    // ターン終了ボタン（左上、HUDバー下）
    const btnW = isSmall ? 100 : 140;
    const btnH = isSmall ? 34 : 48;
    const btnX = btnW / 2 + 8;
    const btnY = topBarH + btnH / 2 + 4;

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
      fontSize: isSmall ? '14px' : '16px', color: '#ffffff', fontStyle: 'bold',
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

    // メッセージバー（画面下部、横いっぱい、閉じる/再表示可能）
    const msgBarW = width - 8;
    const msgBarH = isSmall ? 60 : 80;
    const msgBarX = 4;
    const msgBarY = height - msgBarH - 4;

    this.msgBarBg = scene.add.graphics().setAlpha(0);
    this.container.add(this.msgBarBg);

    this.combatLogText = scene.add.text(msgBarX + 10, msgBarY + 6, '', {
      fontSize: isSmall ? '13px' : '12px',
      color: '#ffffff',
      wordWrap: { width: msgBarW - 40 },
      lineSpacing: 3,
    }).setAlpha(0);
    this.container.add(this.combatLogText);

    // 閉じるボタン（メッセージバー右上）
    this.msgCloseBtn = scene.add.text(msgBarX + msgBarW - 10, msgBarY + 4, '✕', {
      fontSize: '16px', color: '#ff8888',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(1, 0).setInteractive({ cursor: 'pointer' }).setAlpha(0);
    this.msgCloseBtn.on('pointerdown', () => this.hideMessage());
    this.container.add(this.msgCloseBtn);

    // 再表示ボタン（画面右下、メッセージが閉じられたとき表示）
    const reopenX = width - 36;
    const reopenY = height - 36;
    this.msgReopenBg = scene.add.graphics().setAlpha(0);
    this.msgReopenBg.fillStyle(0x000000, 0.7);
    this.msgReopenBg.fillCircle(reopenX, reopenY, 20);
    this.msgReopenBg.lineStyle(1.5, 0x4488ff, 0.8);
    this.msgReopenBg.strokeCircle(reopenX, reopenY, 20);
    this.container.add(this.msgReopenBg);

    this.msgReopenBtn = scene.add.text(reopenX, reopenY, '💬', {
      fontSize: '18px',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' }).setAlpha(0);
    this.msgReopenBtn.on('pointerdown', () => this.reopenMessage());
    this.container.add(this.msgReopenBtn);

    // メッセージバー全体のタップ領域（閉じるボタンより上に配置）
    this.msgTapArea = scene.add.rectangle(
      msgBarX + msgBarW / 2, msgBarY + msgBarH / 2,
      msgBarW - 40, msgBarH, 0x000000, 0
    ).setInteractive({ cursor: 'pointer' }).setAlpha(0);
    this.msgTapArea.on('pointerdown', () => {
      if (this.onMessageTap) this.onMessageTap();
    });
    this.container.add(this.msgTapArea);

    this.msgBarRect = { x: msgBarX, y: msgBarY, w: msgBarW, h: msgBarH };
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

    // 新しい戦闘ログがあればメッセージバーに表示
    const recentLog = state.combatLog.slice(0, 3).join('\n');
    if (recentLog && recentLog !== this.lastCombatLog) {
      this.lastCombatLog = recentLog;
      this.showMessage(recentLog, '#ffccaa', 4000);
    }
  }

  private lastCombatLog = '';

  setInfoText(text: string): void {
    this.infoText.setText(text);
    // スマホではメッセージバーに表示
    if (this.scene.scale.width < 500 && text) {
      this.showMessage(text, '#ccddee', 3000);
    }
  }

  setOnMessageTap(callback: (() => void) | null): void {
    this.onMessageTap = callback;
  }

  /** メッセージバーにメッセージを表示（閉じるボタンで消せる） */
  showMessage(text: string, color: string = '#ffffff', _duration?: number): void {
    if (this.msgTimer) {
      this.msgTimer.destroy();
      this.msgTimer = null;
    }

    this.lastMessageText = text;
    this.lastMessageColor = color;

    const { x, y, w, h } = this.msgBarRect;
    this.msgBarBg.clear();
    this.msgBarBg.fillStyle(0x000000, 0.7);
    this.msgBarBg.fillRoundedRect(x, y, w, h, 6);
    this.msgBarBg.lineStyle(1, 0x334466, 0.7);
    this.msgBarBg.strokeRoundedRect(x, y, w, h, 6);
    this.msgBarBg.setAlpha(1);

    this.combatLogText.setText(text);
    this.combatLogText.setColor(color);
    this.combatLogText.setAlpha(1);
    this.combatLogText.setY(y + 6);

    this.msgCloseBtn.setAlpha(1);
    this.msgTapArea.setAlpha(1);
    // 再表示ボタンは隠す
    this.msgReopenBg.setAlpha(0);
    this.msgReopenBtn.setAlpha(0);
  }

  /** メッセージバーを閉じる */
  private hideMessage(): void {
    this.msgBarBg.setAlpha(0);
    this.combatLogText.setAlpha(0);
    this.msgCloseBtn.setAlpha(0);
    this.msgTapArea.setAlpha(0);
    // 再表示ボタンを表示
    if (this.lastMessageText) {
      this.msgReopenBg.setAlpha(1);
      this.msgReopenBtn.setAlpha(1);
    }
  }

  /** 最後のメッセージを再表示 */
  private reopenMessage(): void {
    if (this.lastMessageText) {
      this.showMessage(this.lastMessageText, this.lastMessageColor);
    }
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
    if (this.msgTimer) this.msgTimer.destroy();
    this.container.destroy();
  }
}
