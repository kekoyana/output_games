import Phaser from 'phaser';
import type { GameState, HexCoord, Difficulty, TechId, PlayerId } from '../models/types';
import { initializeGame } from '../systems/gameInit';
import { hexKey, pixelToHex, hexToPixel, getNeighbors } from '../systems/hexUtils';
import { getReachableTiles, getAttackableTiles, moveUnit } from '../systems/movementSystem';
import { resolveCombat } from '../systems/combatSystem';
import { researchTech, buildCity, collectResourcesForPlayer } from '../systems/citySystem';
import { endPlayerTurn } from '../systems/turnSystem';
import { updateVisibility } from '../systems/mapGenerator';
import { HUD } from '../ui/HUD';
import { MapRenderer } from '../ui/MapRenderer';
import { CityPanel } from '../ui/CityPanel';
import { TechTreeModal } from '../ui/TechTreeModal';
import { getUnitStats } from '../models/unitData';
import { t } from '../i18n';
import { Tutorial } from '../ui/Tutorial';

// HEX_SIZEとオフセットは画面サイズに応じて動的計算
const MAP_GRID_SIZE = 10;
function getHudHeight(screenW: number): number { return screenW < 500 ? 50 : 65; }
function getBtnHeight(screenW: number): number { return screenW < 500 ? 48 : 60; }

function calcHexLayout(screenW: number, screenH: number): { hexSize: number; offsetX: number; offsetY: number; hudHeight: number; btnHeight: number } {
  const cols = MAP_GRID_SIZE;
  const rows = MAP_GRID_SIZE;
  const hudHeight = getHudHeight(screenW);
  const btnHeight = getBtnHeight(screenW);
  const availW = screenW - 20;
  const availH = screenH - hudHeight - btnHeight - 10;

  // hexSizeByW: xMax - xMin = sqrt(3)*size*(cols - 1 + 0.5) + size = size*(sqrt(3)*(cols-0.5) + 1)
  // hexSizeByH: yMax - yMin = 1.5*size*(rows-1) + 2*size = size*(1.5*rows + 0.5)
  const hexSizeByW = availW / (Math.sqrt(3) * (cols - 0.5) + 1);
  const hexSizeByH = availH / (1.5 * rows + 0.5);
  const hexSize = Math.floor(Math.min(hexSizeByW, hexSizeByH, 40));

  // 実際のマップ幅・高さ
  const mapW = hexSize * (Math.sqrt(3) * (cols - 0.5) + 1);
  const mapH = hexSize * (1.5 * rows + 0.5);

  // 中央配置: offsetX/offsetY はマップの描画原点 (q=0,r=0 のピクセル位置)
  // hexToPixel({0,0}) = (0,0) なので、画面中央から mapW/2 を引いた位置が原点
  const offsetX = Math.floor((screenW - mapW) / 2 + hexSize * Math.sqrt(3) / 2);
  const offsetY = Math.floor(hudHeight + (availH - mapH) / 2 + hexSize);

  return { hexSize, offsetX, offsetY, hudHeight, btnHeight };
}

export class GameScene extends Phaser.Scene {
  state!: GameState;
  private hud!: HUD;
  private mapRenderer!: MapRenderer;
  private cityPanel!: CityPanel;
  private techModal!: TechTreeModal;
  private tutorial!: Tutorial;

  hexSize: number = 36;
  mapOffsetX: number = 80;
  mapOffsetY: number = 70;
  private hudHeight: number = 65;
  private btnHeight: number = 60;

  private reachableTiles: Set<string> = new Set();
  private attackableTiles: Set<string> = new Set();
  private buildableTiles: Set<string> = new Set();
  private isBuildingMode: boolean = false;
  private buildModeJustActivated: boolean = false;
  private activeCityIdForBuild: string | null = null;
  private activeCityIdForTech: string | null = null;
  private eraOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: { difficulty: Difficulty }): void {
    const difficulty = data.difficulty ?? 'normal';
    const aiCount = difficulty === 'easy' ? 1 : 2;
    this.state = initializeGame(difficulty, aiCount);

    const { width, height } = this.scale;
    const layout = calcHexLayout(width, height);
    this.hexSize = layout.hexSize;
    this.mapOffsetX = layout.offsetX;
    this.mapOffsetY = layout.offsetY;
    this.hudHeight = layout.hudHeight;
    this.btnHeight = layout.btnHeight;

    this.mapRenderer = new MapRenderer(this, this.hexSize);
    this.mapRenderer.setPosition(this.mapOffsetX, this.mapOffsetY);

    this.hud = new HUD(this, () => this.onEndTurn(), () => this.openTechTreeFromHud());

    this.cityPanel = new CityPanel(this, {
      onResearch: (cityId) => this.openTechModal(cityId),
      onBuildCity: (cityId) => this.enterBuildCityMode(cityId),
      onClose: () => {},
    });

    this.techModal = new TechTreeModal(
      this,
      () => { this.activeCityIdForTech = null; },
      (techId) => this.onResearchTech(techId)
    );

    // カメラ設定（マップ範囲でスクロール可能に）
    const mapPixelW = this.hexSize * (Math.sqrt(3) * (MAP_GRID_SIZE - 0.5) + 1);
    const mapPixelH = this.hexSize * (1.5 * MAP_GRID_SIZE + 0.5);
    const boundsW = Math.max(width, this.mapOffsetX + mapPixelW + 40);
    const boundsH = Math.max(height, this.mapOffsetY + mapPixelH + this.btnHeight + 20);
    this.cameras.main.setBounds(0, 0, boundsW, boundsH);

    // 入力設定
    this.setupInput();

    // 初ターンの資源獲得
    collectResourcesForPlayer(this.state, 'player');

    // チュートリアル（簡単モードのみ）
    this.tutorial = new Tutorial(this, difficulty === 'easy');
    this.tutorial.start();

    // 初回描画
    this.redrawAll();
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.onRightClick();
        return;
      }
      if (this.techModal.visible) return;
      // cityPanelが表示中でもクリック処理を通す（パネル内のボタンはPhaserのInteractiveが処理する）
      // パネル外クリックで閉じる処理はonPointerDown内で行う
      this.onPointerDown(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.onPointerMove(pointer);
    });
  }

  private pointerToHex(pointer: Phaser.Input.Pointer): HexCoord {
    return pixelToHex(
      pointer.worldX - this.mapOffsetX,
      pointer.worldY - this.mapOffsetY,
      this.hexSize
    );
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state.gameOver) return;

    const coord = this.pointerToHex(pointer);
    const key = hexKey(coord);
    const tile = this.state.tiles.get(key);

    // cityPanelが表示中の場合、都市タイルをクリックした場合は別の都市パネルを表示
    // それ以外はパネルを閉じる
    if (this.cityPanel.visible) {
      if (tile && tile.cityId && tile.visible) {
        const city = this.state.cities.get(tile.cityId);
        if (city?.owner === 'player') {
          // 同じ都市または別の都市をクリックした場合はパネルを更新
          this.cityPanel.show(this.state, tile.cityId);

          this.redrawAll();
          return;
        }
      }
      // 都市以外をクリックしたらパネルを閉じる
      this.cityPanel.hide();
      this.redrawAll();
      return;
    }

    if (!tile) return;

    // 建設モード
    if (this.isBuildingMode) {
      // ボタンクリックと同一フレームのイベントをスキップ
      if (this.buildModeJustActivated) {
        this.buildModeJustActivated = false;
        return;
      }
      this.tryBuildCity(coord);
      return;
    }

    // ユニット選択モード中（移動/攻撃）
    if (this.state.selectedUnitId) {
      const selectedUnit = this.state.units.get(this.state.selectedUnitId);

      // 攻撃可能タイルをクリック
      if (this.attackableTiles.has(key) && tile.unitId) {
        const targetUnit = this.state.units.get(tile.unitId);
        if (targetUnit && targetUnit.owner !== selectedUnit?.owner) {
          resolveCombat(this.state, this.state.selectedUnitId, tile.unitId);
          this.state.selectedUnitId = null;
          this.clearHighlights();

          this.redrawAll();
          return;
        }
      }

      // 移動可能タイルをクリック（都市タイルへの移動も含む）
      if (this.reachableTiles.has(key) && !tile.unitId) {
        moveUnit(this.state, this.state.selectedUnitId, coord);
        // 1ターン1移動: 移動後は行動終了
        const movedUnit = this.state.units.get(this.state.selectedUnitId);
        if (movedUnit) {
          movedUnit.movesLeft = 0;
        }
        this.state.selectedUnitId = null;
        this.clearHighlights();
        updateVisibility(this.state);
        this.panToCoord(coord);

        this.redrawAll();
        return;
      }

      // 他のユニットをクリック（自ユニット）
      if (tile.unitId) {
        const clickedUnit = this.state.units.get(tile.unitId);
        if (clickedUnit?.owner === 'player' && tile.unitId !== this.state.selectedUnitId) {
          this.selectUnit(tile.unitId);
          this.redrawAll();
          return;
        }
      }

      // 都市をクリック（移動範囲外の自都市 → パネルを開く）
      if (tile.cityId) {
        const city = this.state.cities.get(tile.cityId);
        if (city?.owner === 'player' && tile.visible) {
          this.state.selectedUnitId = null;
          this.clearHighlights();
          this.cityPanel.show(this.state, tile.cityId);

          this.redrawAll();
          return;
        }
      }

      // それ以外：選択解除
      this.state.selectedUnitId = null;
      this.clearHighlights();
      this.redrawAll();
      return;
    }

    // プレイヤーのユニットをクリック（都市上でもユニットを優先選択）
    if (tile.unitId && tile.visible) {
      const unit = this.state.units.get(tile.unitId);
      if (unit?.owner === 'player') {
        this.selectUnit(tile.unitId);
        this.redrawAll();
        return;
      }
    }

    // プレイヤーの都市をクリック（ユニットがいない都市ヘックス）
    if (tile.cityId && tile.visible) {
      const city = this.state.cities.get(tile.cityId);
      if (city?.owner === 'player') {
        this.cityPanel.show(this.state, tile.cityId);
        this.tutorial.notify('city_opened');
        this.redrawAll();
        return;
      }
    }
  }

  private onRightClick(): void {
    this.state.selectedUnitId = null;
    this.isBuildingMode = false;
    this.activeCityIdForBuild = null;
    this.clearHighlights();
    this.cityPanel.hide();
    this.redrawAll();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    // worldX/worldYはpointerToHex内で使用（カメラスクロール対応）
    const coord = this.pointerToHex(pointer);
    const key = hexKey(coord);
    const tile = this.state.tiles.get(key);
    if (!tile || !tile.visible) {
      this.hud.setInfoText('');
      return;
    }

    const terrainNames: Record<string, string> = {
      plain: t('terrainPlain'), forest: t('terrainForest'), mountain: t('terrainMountain'), sea: t('terrainSea'),
    };
    let info = `${t('terrain')}: ${terrainNames[tile.terrain] ?? tile.terrain}`;

    if (tile.cityId) {
      const city = this.state.cities.get(tile.cityId);
      const player = this.state.players.get(city?.owner ?? 'player');
      if (city) info += `\n${city.isCapital ? t('capital') : t('city')}: ${city.name} (${player?.name ?? ''})`;
    }

    if (tile.unitId) {
      const unit = this.state.units.get(tile.unitId);
      const player = this.state.players.get(unit?.owner ?? 'player');
      if (unit) {
        const unitNames: Record<string, string> = {
          warrior: t('unitWarrior'), archer: t('unitArcher'), cavalry: t('unitCavalry'), artillery: t('unitArtillery'),
        };
        const stats = getUnitStats(unit.type);
        info += `\n${unitNames[unit.type]} (${player?.name ?? ''})\nHP: ${unit.hp}/${unit.maxHp} ${t('attack')}:${stats.attack} ${t('defense')}:${stats.defense}`;
      }
    }

    this.hud.setInfoText(info);
  }

  private selectUnit(unitId: string): void {
    this.state.selectedUnitId = unitId;
    const unit = this.state.units.get(unitId);
    if (!unit) return;

    this.reachableTiles = getReachableTiles(this.state, unitId);
    this.attackableTiles = getAttackableTiles(this.state, unitId);
    this.buildableTiles = new Set();

  }

  private clearHighlights(): void {
    this.reachableTiles = new Set();
    this.attackableTiles = new Set();
    this.buildableTiles = new Set();
  }

  private enterBuildCityMode(cityId: string): void {
    this.buildableTiles = this.getBuildableTiles(cityId);
    if (this.buildableTiles.size === 0) {
      this.hud.setInfoText(t('noBuildableTiles'));
      this.hud.showErrorMessage(t('noBuildableTiles'));
      return;
    }
    this.isBuildingMode = true;
    this.buildModeJustActivated = true;
    this.activeCityIdForBuild = cityId;
    this.hud.setInfoText(t('buildCityGuide'));
    this.redrawAll();
  }

  private getBuildableTiles(cityId: string): Set<string> {
    const city = this.state.cities.get(cityId);
    if (!city) return new Set();

    const buildable = new Set<string>();
    const playerState = this.state.players.get('player');
    if (!playerState) return new Set();

    this.state.tiles.forEach((tile, key) => {
      if (tile.terrain !== 'plain' && tile.terrain !== 'forest') return;
      if (tile.cityId) return;
      if (tile.unitId) return;

      // 既存都市から4ヘックス以内
      let near = false;
      playerState.cities.forEach(cId => {
        const c = this.state.cities.get(cId);
        if (!c) return;
        const [q, r] = key.split(',').map(Number);
        const dist = Math.max(
          Math.abs(q - c.coord.q), Math.abs(r - c.coord.r),
          Math.abs((q + r) - (c.coord.q + c.coord.r))
        );
        if (dist <= 4) near = true;
      });
      if (!near) return;

      // 他都市と近すぎない
      let tooClose = false;
      this.state.cities.forEach(c => {
        const [q, r] = key.split(',').map(Number);
        const dist = Math.max(
          Math.abs(q - c.coord.q), Math.abs(r - c.coord.r),
          Math.abs((q + r) - (c.coord.q + c.coord.r))
        );
        if (dist < 2) tooClose = true;
      });
      if (tooClose) return;

      buildable.add(key);
    });

    return buildable;
  }

  private tryBuildCity(coord: HexCoord): void {
    const key = hexKey(coord);
    if (!this.buildableTiles.has(key)) {
      this.hud.showErrorMessage(t('cannotBuildHere'));
      return;
    }

    const success = buildCity(this.state, 'player', coord);
    if (success) {
      const city = this.state.cities.get(this.activeCityIdForBuild ?? '');
      if (city) city.actionUsed = true;
    } else {
      this.hud.showErrorMessage(t('buildFailed'));
    }

    this.isBuildingMode = false;
    this.activeCityIdForBuild = null;
    this.buildableTiles = new Set();
    updateVisibility(this.state);
    this.redrawAll();
  }

  /** HUD上の科学力タップから技術ツリーを閲覧モードで開く */
  private openTechTreeFromHud(): void {
    if (this.techModal.visible) return;
    this.techModal.show(this.state, null);
  }

  private openTechModal(cityId: string): void {
    this.activeCityIdForTech = cityId;
    this.cityPanel.hide();
    this.techModal.show(this.state, cityId);
  }

  private onResearchTech(techId: TechId): void {
    const cityId = this.activeCityIdForTech;
    if (!cityId) return;

    const city = this.state.cities.get(cityId);
    if (!city) return;

    const prevEra = this.state.players.get('player')?.currentEra;
    const success = researchTech(this.state, 'player', techId);

    if (success) {
      city.actionUsed = true;

      const newEra = this.state.players.get('player')?.currentEra;
      if (newEra && prevEra !== newEra) {
        this.showEraTransition(newEra);
      }
    }

    this.activeCityIdForTech = null;
    this.redrawAll();
  }

  private onEndTurn(): void {
    if (this.state.gameOver) return;
    if (this.techModal.visible) return;

    this.state.selectedUnitId = null;
    this.clearHighlights();
    this.cityPanel.hide();

    endPlayerTurn(this.state);


    this.redrawAll();
    this.hud.update(this.state);

    if (this.state.gameOver) {
      this.time.delayedCall(500, () => {
        this.scene.start('ResultScene', { state: this.state });
      });
    }
  }

  private panToCoord(coord: HexCoord): void {
    const pos = hexToPixel(coord, this.hexSize);
    const worldX = pos.x + this.mapOffsetX;
    const worldY = pos.y + this.mapOffsetY;
    const cam = this.cameras.main;

    // 移動先がビューポート端に近ければカメラをパン
    const screenX = worldX - cam.scrollX;
    const screenY = worldY - cam.scrollY;
    const marginX = 80;
    const marginTop = this.hudHeight + 40;
    const marginBottom = this.btnHeight + 40;

    const needsPan = screenX < marginX || screenX > cam.width - marginX ||
                     screenY < marginTop || screenY > cam.height - marginBottom;

    if (needsPan) {
      cam.pan(worldX, worldY, 300, 'Sine.easeInOut');
    }
  }

  private redrawAll(): void {
    this.mapRenderer.drawMap(this.state);
    this.mapRenderer.drawHighlights(
      this.reachableTiles,
      this.attackableTiles,
      this.buildableTiles
    );
    this.mapRenderer.drawUnits(this.state, this.state.selectedUnitId);
    this.hud.update(this.state);
  }

  private showEraTransition(era: string): void {
    if (this.eraOverlay) {
      this.eraOverlay.destroy();
    }

    const { width, height } = this.scale;
    const container = this.add.container(0, 0).setDepth(500).setScrollFactor(0);

    const overlay = this.add.rectangle(0, 0, width, height, 0xffffff, 0.5)
      .setOrigin(0, 0);
    container.add(overlay);

    const eraNames: Record<string, string> = { medieval: t('eraMedieval'), modern: t('eraModern') };
    const eraText = this.add.text(width / 2, height / 2, `${t('eraAdvanced')}: ${eraNames[era] ?? era}`, {
      fontSize: '36px', color: '#ffd700',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(eraText);

    this.eraOverlay = container;

    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        container.destroy();
        this.eraOverlay = null;
      },
    });
    this.tweens.add({
      targets: eraText,
      alpha: 0,
      duration: 1500,
    });
  }

  shutdown(): void {
    this.mapRenderer.destroy();
    this.hud.destroy();
    this.cityPanel.destroy();
    this.techModal.destroy();
    this.tutorial.destroy();
  }
}
