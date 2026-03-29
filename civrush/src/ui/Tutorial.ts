import Phaser from 'phaser';
import { t } from '../i18n';

export class Tutorial {
  private scene: Phaser.Scene;
  private showMessage: (text: string, color?: string, duration?: number) => void;
  private active: boolean;
  private stepIndex = 0;
  private steps: string[] = [];

  constructor(
    scene: Phaser.Scene,
    showMessage: (text: string, color?: string, duration?: number) => void,
    enabled: boolean
  ) {
    this.scene = scene;
    this.showMessage = showMessage;
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
    this.scene.time.delayedCall(1500, () => {
      this.showCurrentStep();
    });
  }

  /** 次のステップへ進む */
  next(): void {
    if (!this.active) return;
    this.stepIndex++;
    if (this.stepIndex >= this.steps.length) {
      this.active = false;
      this.showMessage(t('tutorialComplete'), '#88ff88');
      return;
    }
    this.showCurrentStep();
  }

  private showCurrentStep(): void {
    const msg = this.steps[this.stepIndex];
    const progress = `(${this.stepIndex + 1}/${this.steps.length})`;
    this.showMessage(`${msg}\n${progress} ▶ タップで次へ`, '#ffee88');
  }

  /** イベント通知（互換性のため残すがno-op） */
  notify(_event: string): void {
    // 情報表示のみのため何もしない
  }

  get isActive(): boolean {
    return this.active;
  }

  get hasNext(): boolean {
    return this.active && this.stepIndex < this.steps.length;
  }

  destroy(): void {
    this.active = false;
  }
}
