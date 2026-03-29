import Phaser from 'phaser';
import type { Difficulty } from '../models/types';
import titleBgUrl from '../assets/title_bg.jpg';
import logoUrl from '../assets/title_logo.png';
import { t, getLang, setLang } from '../i18n';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  preload(): void {
    this.load.image('title_bg', titleBgUrl);
    this.load.image('logo', logoUrl);
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // 背景画像（画面全体にフィット）
    const bg = this.add.image(cx, cy, 'title_bg');
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const bgScale = Math.max(scaleX, scaleY);
    bg.setScale(bgScale);

    // 暗めのオーバーレイ（背景画像の可読性確保）
    this.add.rectangle(0, 0, width, height, 0x000000, 0.3).setOrigin(0, 0);

    // 言語切り替えボタン（右上）
    const toggleLabel = getLang() === 'ja' ? 'EN' : 'JA';
    const toggleBtnW = 60;
    const toggleBtnH = 32;
    const toggleX = width - toggleBtnW / 2 - 12;
    const toggleY = toggleBtnH / 2 + 12;
    const toggleBg = this.add.rectangle(toggleX, toggleY, toggleBtnW, toggleBtnH, 0x333333, 0.85)
      .setInteractive({ cursor: 'pointer' });
    toggleBg.setStrokeStyle(2, 0xaaaaaa);
    const toggleText = this.add.text(toggleX, toggleY, toggleLabel, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    toggleBg.on('pointerover', () => {
      toggleBg.setFillStyle(0x555555, 0.95);
    });
    toggleBg.on('pointerout', () => {
      toggleBg.setFillStyle(0x333333, 0.85);
    });
    toggleBg.on('pointerdown', () => {
      setLang(getLang() === 'ja' ? 'en' : 'ja');
      this.scene.restart();
    });

    // suppress unused variable warning
    void toggleText;

    const isSmall = width < 500;

    // ロゴ画像
    const logo = this.add.image(cx, cy - 150, 'logo');
    const logoMaxW = Math.min(480, width - 40);
    const logoScale = logoMaxW / logo.width;
    logo.setScale(logoScale);

    const logoBottom = cy - 150 + logo.displayHeight / 2;

    const selectText = this.add.text(cx, logoBottom + 8, t('selectDifficulty'), {
      fontSize: isSmall ? '15px' : '18px',
      color: '#eeeeee',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    const selectBottom = selectText.y + selectText.displayHeight / 2;

    // 難易度ボタン（凝ったデザイン）
    const difficulties: Array<{
      label: string;
      desc: string;
      value: Difficulty;
      color: number;
      icon: string;
      accentColor: number;
    }> = [
      { label: t('easy'), desc: t('easyDesc'), value: 'easy', color: 0x226622, icon: '🌱', accentColor: 0x44cc44 },
      { label: t('normal'), desc: t('normalDesc'), value: 'normal', color: 0x223366, icon: '⚔️', accentColor: 0x4488ff },
      { label: t('hard'), desc: t('hardDesc'), value: 'hard', color: 0x662222, icon: '🔥', accentColor: 0xff4444 },
    ];

    if (isSmall) {
      // スマホ: 縦並びの横長ボタン
      const sBtnW = width - 40;
      const sBtnH = 52;
      const sBtnGap = 8;
      const sBtnStartY = selectBottom + 10 + sBtnH / 2;

      difficulties.forEach((diff, i) => {
        const btnX = cx;
        const btnY = sBtnStartY + i * (sBtnH + sBtnGap);

        const btnGfx = this.add.graphics();
        const drawBtn = (fillColor: number, alpha: number, borderColor: number, borderWidth: number) => {
          btnGfx.clear();
          btnGfx.fillStyle(fillColor, alpha);
          btnGfx.fillRoundedRect(btnX - sBtnW / 2, btnY - sBtnH / 2, sBtnW, sBtnH, 8);
          btnGfx.lineStyle(borderWidth, borderColor, 0.9);
          btnGfx.strokeRoundedRect(btnX - sBtnW / 2, btnY - sBtnH / 2, sBtnW, sBtnH, 8);
        };
        drawBtn(diff.color, 0.85, diff.accentColor, 2);

        const hitArea = this.add.rectangle(btnX, btnY, sBtnW, sBtnH, 0x000000, 0)
          .setInteractive({ cursor: 'pointer' });

        // アイコン + ラベル（左寄せ）
        this.add.text(btnX - sBtnW / 2 + 16, btnY - 10, `${diff.icon} ${diff.label}`, {
          fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0, 0.5);

        // 説明（左寄せ、ラベルの下）
        this.add.text(btnX - sBtnW / 2 + 16, btnY + 12, diff.desc, {
          fontSize: '13px', color: '#eeeedd',
          stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0, 0.5);

        const labelText = this.add.text(0, 0, '').setVisible(false);
        hitArea.on('pointerover', () => drawBtn(diff.color, 1.0, 0xffd700, 3));
        hitArea.on('pointerout', () => drawBtn(diff.color, 0.85, diff.accentColor, 2));
        hitArea.on('pointerdown', () => this.startGame(diff.value));
        void labelText;
      });
    } else {
      // PC: 横3列ボタン
      const btnW = 150;
      const btnH = 80;
      const btnGap = 16;
      const totalW = difficulties.length * btnW + (difficulties.length - 1) * btnGap;
      const btnStartX = cx - totalW / 2;

      difficulties.forEach((diff, i) => {
        const btnX = btnStartX + i * (btnW + btnGap) + btnW / 2;
        const btnY = selectBottom + 14 + btnH / 2;

        const btnGfx = this.add.graphics();
        const drawBtn = (fillColor: number, alpha: number, borderColor: number, borderWidth: number) => {
          btnGfx.clear();
          btnGfx.fillStyle(fillColor, alpha);
          btnGfx.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
          btnGfx.lineStyle(borderWidth, borderColor, 0.9);
          btnGfx.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
        };
        drawBtn(diff.color, 0.85, diff.accentColor, 2);

        const hitArea = this.add.rectangle(btnX, btnY, btnW, btnH, 0x000000, 0)
          .setInteractive({ cursor: 'pointer' });

        this.add.text(btnX, btnY - 22, diff.icon, { fontSize: '24px' }).setOrigin(0.5);

        const labelText = this.add.text(btnX, btnY + 4, diff.label, {
          fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);

        const descText = this.add.text(btnX, btnY + 24, diff.desc, {
          fontSize: '10px', color: '#bbbbbb',
          stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5);

        hitArea.on('pointerover', () => {
          drawBtn(diff.color, 1.0, 0xffd700, 3);
          labelText.setScale(1.05);
        });
        hitArea.on('pointerout', () => {
          drawBtn(diff.color, 0.85, diff.accentColor, 2);
          labelText.setScale(1.0);
        });
        hitArea.on('pointerdown', () => this.startGame(diff.value));
        void descText;
      });
    }

    // 説明テキスト
    const descLines = [
      t('rulesTitle'),
      t('ruleConquest'),
      t('ruleScience'),
      t('ruleTimeout'),
      '',
      t('controlsTitle'),
      t('controlClick'),
      t('controlRight'),
      t('controlEnd'),
    ].join('\n');

    const descFontSize = isSmall ? '14px' : '15px';
    const descLineSpacing = isSmall ? 4 : 6;
    const descMaxW = Math.min(480, width - 32);

    // サイズ計測用の一時テキスト
    const measureText = this.add.text(0, 0, descLines, {
      fontSize: descFontSize,
      lineSpacing: descLineSpacing,
      wordWrap: { width: descMaxW },
    }).setVisible(false);
    const textW = measureText.displayWidth;
    const textH = measureText.displayHeight;
    measureText.destroy();

    // 背景パネル
    const pad = isSmall ? 10 : 18;
    const btnBottom = isSmall
      ? selectBottom + 10 + 52 / 2 + (difficulties.length - 1) * 60 + 52 / 2
      : selectBottom + 14 + 80;
    const descY = btnBottom + (isSmall ? 12 : 24);
    const descBg = this.add.graphics();
    descBg.fillStyle(0x111122, 0.92);
    descBg.fillRoundedRect(
      cx - textW / 2 - pad,
      descY - pad,
      textW + pad * 2,
      textH + pad * 2,
      8
    );

    // テキスト
    this.add.text(cx, descY, descLines, {
      fontSize: descFontSize,
      color: '#ffffff',
      align: 'center',
      lineSpacing: descLineSpacing,
      wordWrap: { width: descMaxW },
    }).setOrigin(0.5, 0);
  }

  private startGame(difficulty: Difficulty): void {
    this.scene.start('GameScene', { difficulty });
  }
}
