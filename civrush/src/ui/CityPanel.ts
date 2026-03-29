import Phaser from 'phaser';
import type { GameState, City, UnitType, BuildingType, TechId } from '../models/types';
import { produceUnit, buildBuilding } from '../systems/citySystem';
import { t } from '../i18n';

function getBuildingDesc(b: BuildingType): string {
  return { barracks: t('descBarracks'), library: t('descLibrary'), fortress: t('descFortress') }[b];
}

function getBuildingCost(b: BuildingType): number {
  return { barracks: 8, library: 8, fortress: 12 }[b];
}

function getUnitStatLabel(type: UnitType): string {
  const labels: Record<UnitType, string> = {
    warrior: `${t('attack')}3/${t('defense')}3/HP15`,
    archer: `${t('attack')}4/${t('defense')}2/HP12/${t('range')}2`,
    cavalry: `${t('attack')}5/${t('defense')}2/HP12/${t('move')}3`,
    artillery: `${t('attack')}7/${t('defense')}1/HP10/${t('range')}3`,
  };
  return labels[type];
}

type CityPanelCallback = {
  onResearch: (cityId: string) => void;
  onBuildCity: (cityId: string) => void;
  onClose: () => void;
};

export class CityPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private callbacks: CityPanelCallback;
  private currentCityId: string | null = null;

  constructor(scene: Phaser.Scene, callbacks: CityPanelCallback) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.container = scene.add.container(0, 0).setDepth(150).setVisible(false).setScrollFactor(0);
  }

  show(state: GameState, cityId: string): void {
    this.currentCityId = cityId;
    this.container.removeAll(true);
    this.container.setVisible(true);

    const city = state.cities.get(cityId);
    const player = state.players.get('player');
    if (!city || !player) return;

    const { width, height } = this.scene.scale;
    const isSmall = width < 500;
    const panelW = Math.min(340, width - 20);
    const panelH = Math.min(500, height - (isSmall ? 60 : 80));
    const px = width - panelW - 10;
    const py = isSmall ? 50 : 62;

    // ドロップシャドウ
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRoundedRect(px + 5, py + 5, panelW, panelH, 10);
    this.container.add(shadow);

    // パネル背景（グラデーション風）
    const bgGfx = this.scene.add.graphics();
    bgGfx.fillGradientStyle(0x0f1a30, 0x0f1a30, 0x1a2540, 0x1a2540, 1, 1, 1, 1);
    bgGfx.fillRoundedRect(px, py, panelW, panelH, 10);
    bgGfx.lineStyle(1.5, 0x4a88cc, 0.85);
    bgGfx.strokeRoundedRect(px, py, panelW, panelH, 10);
    this.container.add(bgGfx);

    // タイトルバー背景
    const titleBarGfx = this.scene.add.graphics();
    titleBarGfx.fillGradientStyle(0x1a3060, 0x1a3060, 0x0f1a30, 0x0f1a30, 1, 1, 1, 1);
    titleBarGfx.fillRoundedRect(px, py, panelW, 44, 10);
    titleBarGfx.lineStyle(1, 0x4a88cc, 0.5);
    titleBarGfx.lineBetween(px, py + 44, px + panelW, py + 44);
    this.container.add(titleBarGfx);

    // 都市名
    const capitalMark = city.isCapital ? '♛ ' : '';
    const cityTitle = this.scene.add.text(px + 12, py + 10, `${capitalMark}${city.name}`, {
      fontSize: '18px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    });
    this.container.add(cityTitle);

    // 閉じるボタン
    const closeBtn = this.scene.add.text(px + panelW - 10, py + 10, '✕', {
      fontSize: '18px', color: '#ff6666',
    }).setOrigin(1, 0).setInteractive({ cursor: 'pointer' });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff9999'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    // 都市ステータス
    const prod = this.calcCityProduction(state, city);
    const sci = this.calcCityScience(state, city);
    const statsText = [
      `🏭 ${t('production')}: +${prod}   💡 ${t('science')}: +${sci}`,
      `${t('buildings')}: ${city.buildings.map(b => buildingName(b)).join(', ') || t('none')}`,
    ].join('\n');

    const stats = this.scene.add.text(px + 12, py + 50, statsText, {
      fontSize: '12px', color: '#aabbcc', lineSpacing: 5,
    });
    this.container.add(stats);

    if (city.actionUsed) {
      const usedText = this.scene.add.text(px + panelW / 2, py + 95, t('actionUsed'), {
        fontSize: '14px', color: '#ff8888', fontStyle: 'bold',
      }).setOrigin(0.5);
      this.container.add(usedText);
      return;
    }

    let btnY = py + 92;

    // 「研究」セクションヘッダー
    btnY = this.addSectionHeader(px + 10, btnY, panelW - 20, t('sectionResearch'));

    // 研究ボタン
    btnY = this.addButton(px + 10, btnY, panelW - 20, t('techResearch'), 0x1a3066, () => {
      this.callbacks.onResearch(cityId);
    });

    // 「生産」セクションヘッダー
    btnY = this.addSectionHeader(px + 10, btnY, panelW - 20, t('sectionProduce'));

    // ユニット生産ボタン
    const unitDefs: Array<{ type: UnitType; cost: number; requires?: TechId }> = [
      { type: 'warrior', cost: 6 },
      { type: 'archer', cost: 8, requires: 'archery' },
      { type: 'cavalry', cost: 10, requires: 'iron' },
      { type: 'artillery', cost: 14, requires: 'mathematics' },
    ];

    const unitNames: Record<UnitType, string> = {
      warrior: t('unitWarrior'), archer: t('unitArcher'), cavalry: t('unitCavalry'), artillery: t('unitArtillery'),
    };

    let hasUnit = false;
    unitDefs.forEach(def => {
      const hasReq = !def.requires || player.researchedTechs.has(def.requires);
      const affordable = player.production >= def.cost;
      if (!hasReq) return;
      hasUnit = true;
      const unitName = unitNames[def.type];
      const label = `${unitName} (🏭${def.cost}) - ${getUnitStatLabel(def.type)}`;
      if (affordable) {
        btnY = this.addButton(px + 10, btnY, panelW - 20, label, 0x1a3a1a, () => {
          produceUnit(state, cityId, def.type);
          city.actionUsed = true;
          this.hide();
        });
      } else {
        btnY = this.addButtonDisabled(px + 10, btnY, panelW - 20, `${label} ${t('insufficient')}`);
      }
    });
    if (!hasUnit) {
      const noUnit = this.scene.add.text(px + 12, btnY, t('noUnits'), {
        fontSize: '11px', color: '#555566',
      });
      this.container.add(noUnit);
      btnY += 18;
    }

    // 「建設」セクションヘッダー
    btnY = this.addSectionHeader(px + 10, btnY, panelW - 20, t('sectionBuild'));

    // 建物建設ボタン
    const buildings: Array<{ type: BuildingType; label: string }> = [
      { type: 'barracks', label: t('buildBarracks') },
      { type: 'library', label: t('buildLibrary') },
      { type: 'fortress', label: t('buildFortress') },
    ];

    buildings.forEach(b => {
      const cost = getBuildingCost(b.type);
      const desc = getBuildingDesc(b.type);
      if (city.buildings.includes(b.type)) {
        const label = `${t('built')} ${b.label} (🏭${cost}) - ${desc}`;
        btnY = this.addButtonDisabled(px + 10, btnY, panelW - 20, label);
        return;
      }
      const affordable = player.production >= cost;
      const label = `${b.label} (🏭${cost}) - ${desc}`;
      if (affordable) {
        btnY = this.addButton(px + 10, btnY, panelW - 20, label, 0x2a2a00, () => {
          buildBuilding(state, cityId, b.type);
          city.actionUsed = true;
          this.hide();
        });
      } else {
        btnY = this.addButtonDisabled(px + 10, btnY, panelW - 20, `${label} ${t('insufficient')}`);
      }
    });

    // 新都市建設ボタン
    if (player.cities.length < 3 && player.production >= 10) {
      btnY = this.addButton(px + 10, btnY, panelW - 20, `${t('buildCity')} (🏭10)`, 0x2a1a3a, () => {
        this.callbacks.onBuildCity(cityId);
        this.hide();
      });
    }
  }

  private addSectionHeader(x: number, y: number, w: number, label: string): number {
    const headerGfx = this.scene.add.graphics();
    headerGfx.fillStyle(0x223355, 0.7);
    headerGfx.fillRoundedRect(x, y, w, 22, 4);
    this.container.add(headerGfx);

    const headerText = this.scene.add.text(x + 8, y + 4, `▸ ${label}`, {
      fontSize: '12px', color: '#88aaff', fontStyle: 'bold',
    });
    this.container.add(headerText);

    return y + 26;
  }

  private addButton(x: number, y: number, w: number, label: string, color: number, onClick: () => void): number {
    const h = 34;
    const btnGfx = this.scene.add.graphics();
    btnGfx.fillStyle(color, 0.9);
    btnGfx.fillRoundedRect(x, y, w, h, 5);
    btnGfx.lineStyle(1, 0x446688, 0.8);
    btnGfx.strokeRoundedRect(x, y, w, h, 5);
    this.container.add(btnGfx);

    const hitArea = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
      .setInteractive({ cursor: 'pointer' });
    this.container.add(hitArea);

    const btnText = this.scene.add.text(x + 8, y + h / 2, label, {
      fontSize: '12px', color: '#e8e8e8', wordWrap: { width: w - 16 },
    }).setOrigin(0, 0.5);
    this.container.add(btnText);

    hitArea.on('pointerover', () => {
      btnGfx.clear();
      const lighter = Math.min(color + 0x111a22, 0x4a7acc);
      btnGfx.fillStyle(lighter, 1.0);
      btnGfx.fillRoundedRect(x, y, w, h, 5);
      btnGfx.lineStyle(1.5, 0x88aaff, 1.0);
      btnGfx.strokeRoundedRect(x, y, w, h, 5);
      btnText.setStyle({ color: '#ffffff' });
    });
    hitArea.on('pointerout', () => {
      btnGfx.clear();
      btnGfx.fillStyle(color, 0.9);
      btnGfx.fillRoundedRect(x, y, w, h, 5);
      btnGfx.lineStyle(1, 0x446688, 0.8);
      btnGfx.strokeRoundedRect(x, y, w, h, 5);
      btnText.setStyle({ color: '#e8e8e8' });
    });
    hitArea.on('pointerdown', onClick);

    return y + h + 4;
  }

  private addButtonDisabled(x: number, y: number, w: number, label: string): number {
    const h = 34;
    const btnGfx = this.scene.add.graphics();
    btnGfx.fillStyle(0x181820, 0.7);
    btnGfx.fillRoundedRect(x, y, w, h, 5);
    btnGfx.lineStyle(1, 0x333344, 0.6);
    btnGfx.strokeRoundedRect(x, y, w, h, 5);
    this.container.add(btnGfx);

    const btnText = this.scene.add.text(x + 8, y + h / 2, label, {
      fontSize: '12px', color: '#555566', wordWrap: { width: w - 16 },
    }).setOrigin(0, 0.5);
    this.container.add(btnText);

    return y + h + 4;
  }

  hide(): void {
    this.container.setVisible(false);
    this.currentCityId = null;
    this.callbacks.onClose();
  }

  get visible(): boolean {
    return this.container.visible;
  }

  get cityId(): string | null {
    return this.currentCityId;
  }

  private calcCityProduction(state: GameState, city: City): number {
    const player = state.players.get(city.owner);
    if (!player) return city.production;
    let p = city.production;
    if (player.researchedTechs.has('agriculture')) p += 2;
    if (city.buildings.includes('barracks')) p += 2;
    if (player.researchedTechs.has('industrialization')) p = Math.floor(p * 1.5);
    return p;
  }

  private calcCityScience(state: GameState, city: City): number {
    const player = state.players.get(city.owner);
    if (!player) return city.science;
    let s = city.science;
    if (player.researchedTechs.has('calendar')) s += 2;
    if (player.researchedTechs.has('printing')) s += 4;
    if (city.buildings.includes('library')) s += 3;
    return s;
  }

  destroy(): void {
    this.container.destroy();
  }
}

function buildingName(b: BuildingType): string {
  const names: Record<BuildingType, string> = {
    barracks: t('barracks'),
    library: t('library'),
    fortress: t('fortress'),
  };
  return names[b];
}
