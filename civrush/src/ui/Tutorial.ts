import Phaser from 'phaser';
import { t } from '../i18n';

export class Tutorial {
  private scene: Phaser.Scene;
  private active: boolean;
  private stepIndex = 0;
  private steps: string[] = [];
  private container: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, enabled: boolean) {
    this.scene = scene;
    this.active = enabled;
  }

  start(): void {
    if (!this.active) return;

    this.steps = [
      t('tutorialWelcome'),
      t('tutorialResources'),
      t('tutorialCity'),
      t('tutorialTechTree'),
      t('tutorialUnit'),
      t('tutorialCombat'),
      t('tutorialVictory'),
    ];

    this.stepIndex = 0;
    this.scene.time.delayedCall(1000, () => {
      this.showPopup();
    });
  }

  /** 日本語テキストを実際のレンダリング幅で改行 */
  private wrapJa(text: string, fontSize: number, maxWidth: number): string {
    // 既存の改行で分割してから各行を折り返し
    const inputLines = text.split('\n');
    const measure = this.scene.add.text(0, 0, '', { fontSize: `${fontSize}px` }).setVisible(false);
    const result: string[] = [];
    for (const line of inputLines) {
      let current = '';
      for (const ch of line) {
        const test = current + ch;
        measure.setText(test);
        if (measure.width > maxWidth && current.length > 0) {
          result.push(current);
          current = ch;
        } else {
          current = test;
        }
      }
      if (current) result.push(current);
      else result.push('');
    }
    measure.destroy();
    return result.join('\n');
  }

  private showPopup(): void {
    this.destroyPopup();

    const { width, height } = this.scene.scale;
    const isSmall = width < 500;
    const panelW = isSmall ? width - 24 : Math.min(500, width - 60);
    const panelPad = 20;
    const cx = width / 2;
    const fontSize = isSmall ? 14 : 16;
    const textW = panelW - panelPad * 2;

    this.container = this.scene.add.container(0, 0).setDepth(300).setScrollFactor(0);

    // スポットライト付きオーバーレイ
    const spotlight = this.getSpotlight();
    const overlayGfx = this.scene.add.graphics();
    if (spotlight) {
      // スポットライト: 穴あきオーバーレイ（上下左右の4つの矩形で構成）
      const { x: sx, y: sy, w: sw, h: sh } = spotlight;
      const pad = 4;
      const hx = sx - pad, hy = sy - pad, hw = sw + pad * 2, hh = sh + pad * 2;
      overlayGfx.fillStyle(0x000000, 0.5);
      // 上
      overlayGfx.fillRect(0, 0, width, hy);
      // 下
      overlayGfx.fillRect(0, hy + hh, width, height - (hy + hh));
      // 左
      overlayGfx.fillRect(0, hy, hx, hh);
      // 右
      overlayGfx.fillRect(hx + hw, hy, width - (hx + hw), hh);
      // ハイライト枠
      overlayGfx.lineStyle(2, 0xffd700, 1);
      overlayGfx.strokeRoundedRect(hx, hy, hw, hh, 6);
    } else {
      overlayGfx.fillStyle(0x000000, 0.5);
      overlayGfx.fillRect(0, 0, width, height);
    }
    this.container.add(overlayGfx);

    // タッチ吸収用の透明矩形
    const overlayHit = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0).setInteractive();
    this.container.add(overlayHit);

    // テキストを手動改行して作成
    const msg = this.wrapJa(this.steps[this.stepIndex], fontSize, textW);
    const progress = `${this.stepIndex + 1} / ${this.steps.length}`;

    const msgText = this.scene.add.text(0, 0, msg, {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      lineSpacing: 6,
    });

    const progressText = this.scene.add.text(0, 0, progress, {
      fontSize: '13px',
      color: '#aaaaaa',
    });

    // パネルサイズ計算
    const btnH = 42;
    const btnGap = 12;
    const contentH = msgText.height + 14 + progressText.height + btnGap + btnH;
    const panelH = contentH + panelPad * 2;
    const panelY = Math.floor((height - panelH) / 2);

    // パネル背景
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f1a30, 0.95);
    bg.fillRoundedRect(cx - panelW / 2, panelY, panelW, panelH, 12);
    bg.lineStyle(2, 0x4488ff, 0.8);
    bg.strokeRoundedRect(cx - panelW / 2, panelY, panelW, panelH, 12);
    this.container.add(bg);

    // メッセージテキスト配置
    const textX = cx - panelW / 2 + panelPad;
    const textY = panelY + panelPad;
    msgText.setPosition(textX, textY);
    this.container.add(msgText);

    // 進捗テキスト
    const progY = textY + msgText.height + 8;
    progressText.setPosition(cx, progY).setOrigin(0.5, 0);
    this.container.add(progressText);

    // ボタン行
    const btnY = progY + progressText.height + btnGap;
    const isLast = this.stepIndex >= this.steps.length - 1;

    if (isLast) {
      this.addButton(cx, btnY, panelW - panelPad * 2, btnH, t('tutorialStart'), 0x226622, 0x44cc44, () => {
        this.finish();
      });
    } else {
      const halfW = (panelW - panelPad * 2 - 10) / 2;
      this.addButton(cx - halfW / 2 - 5, btnY, halfW, btnH, t('tutorialSkip'), 0x333344, 0x666688, () => {
        this.finish();
      });
      this.addButton(cx + halfW / 2 + 5, btnY, halfW, btnH, t('tutorialNext'), 0x224488, 0x4488ff, () => {
        this.stepIndex++;
        this.showPopup();
      });
    }
  }

  private addButton(
    cx: number, y: number, w: number, h: number,
    label: string, bgColor: number, borderColor: number,
    onClick: () => void
  ): void {
    if (!this.container) return;
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(bgColor, 0.9);
    btnBg.fillRoundedRect(cx - w / 2, y, w, h, 8);
    btnBg.lineStyle(1.5, borderColor, 0.9);
    btnBg.strokeRoundedRect(cx - w / 2, y, w, h, 8);
    this.container.add(btnBg);

    const hitArea = this.scene.add.rectangle(cx, y + h / 2, w, h, 0x000000, 0)
      .setInteractive({ cursor: 'pointer' });
    this.container.add(hitArea);

    const btnText = this.scene.add.text(cx, y + h / 2, label, {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(btnText);

    hitArea.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(borderColor, 0.6);
      btnBg.fillRoundedRect(cx - w / 2, y, w, h, 8);
      btnBg.lineStyle(1.5, 0xffffff, 0.9);
      btnBg.strokeRoundedRect(cx - w / 2, y, w, h, 8);
    });
    hitArea.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(bgColor, 0.9);
      btnBg.fillRoundedRect(cx - w / 2, y, w, h, 8);
      btnBg.lineStyle(1.5, borderColor, 0.9);
      btnBg.strokeRoundedRect(cx - w / 2, y, w, h, 8);
    });
    hitArea.on('pointerdown', onClick);
  }

  private finish(): void {
    this.active = false;
    this.destroyPopup();
  }

  private destroyPopup(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }

  /** ステップに応じたスポットライト領域を返す（なければnull） */
  private getSpotlight(): { x: number; y: number; w: number; h: number } | null {
    const { width } = this.scene.scale;
    const isSmall = width < 500;

    const capsuleW = isSmall ? 80 : 120;
    const capsuleH = isSmall ? 24 : 32;
    const capsuleY = isSmall ? 14 : 24;
    const capsuleGap = isSmall ? 8 : 20;

    if (this.stepIndex === 1) {
      // 2/7: 生産力・科学力カプセル（両方）
      const totalW = capsuleW * 2 + capsuleGap;
      return {
        x: width / 2 - capsuleW - capsuleGap / 2,
        y: capsuleY,
        w: totalW,
        h: capsuleH,
      };
    }

    if (this.stepIndex === 3) {
      // 4/7: 科学力カプセルのみ
      return {
        x: width / 2 + capsuleGap / 2,
        y: capsuleY,
        w: capsuleW,
        h: capsuleH,
      };
    }

    return null;
  }

  notify(_event: string): void {}
  next(): void {}

  get isActive(): boolean {
    return this.active;
  }

  destroy(): void {
    this.active = false;
    this.destroyPopup();
  }
}
