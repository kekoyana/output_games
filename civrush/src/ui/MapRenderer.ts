import Phaser from 'phaser';
import type { GameState, HexCoord, TerrainType, Unit } from '../models/types';
import { hexKey, hexToPixel } from '../systems/hexUtils';
import { getUnitStats } from '../models/unitData';

const TERRAIN_COLORS: Record<TerrainType, number> = {
  plain: 0x8cc844,
  forest: 0x1e6b1e,
  mountain: 0x8a7060,
  sea: 0x1a4aaa,
};

const TERRAIN_BORDER: Record<TerrainType, number> = {
  plain: 0x5a9a22,
  forest: 0x0d440d,
  mountain: 0x5a4030,
  sea: 0x0d2a88,
};

export class MapRenderer {
  private scene: Phaser.Scene;
  private hexSize: number;
  private mapContainer: Phaser.GameObjects.Container;
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private unitGraphics: Phaser.GameObjects.Graphics;
  private tileGraphics: Phaser.GameObjects.Graphics;
  private terrainDetailGraphics: Phaser.GameObjects.Graphics;
  private labelContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, hexSize: number) {
    this.scene = scene;
    this.hexSize = hexSize;
    this.mapContainer = scene.add.container(0, 0).setDepth(10);
    this.tileGraphics = scene.add.graphics().setDepth(10);
    this.terrainDetailGraphics = scene.add.graphics().setDepth(11);
    this.highlightGraphics = scene.add.graphics().setDepth(20);
    this.unitGraphics = scene.add.graphics().setDepth(30);
    this.labelContainer = scene.add.container(0, 0).setDepth(35);
  }

  setPosition(x: number, y: number): void {
    this.tileGraphics.x = x;
    this.tileGraphics.y = y;
    this.terrainDetailGraphics.x = x;
    this.terrainDetailGraphics.y = y;
    this.highlightGraphics.x = x;
    this.highlightGraphics.y = y;
    this.unitGraphics.x = x;
    this.unitGraphics.y = y;
    this.labelContainer.x = x;
    this.labelContainer.y = y;
  }

  drawMap(state: GameState): void {
    this.tileGraphics.clear();
    this.terrainDetailGraphics.clear();
    this.labelContainer.removeAll(true);

    state.tiles.forEach(tile => {
      if (!tile.explored) {
        this.drawHexFog(tile.coord);
        return;
      }

      const color = TERRAIN_COLORS[tile.terrain];
      const borderColor = TERRAIN_BORDER[tile.terrain];
      const dimmed = !tile.visible ? 0.5 : 1.0;

      this.drawHex(tile.coord, color, borderColor, dimmed);

      // 地形ディテール描画（可視タイルのみ）
      if (tile.visible) {
        this.drawTerrainDetail(tile.coord, tile.terrain);
      }

      // 所有者カラーのボーダー
      if (tile.owner && tile.visible) {
        const player = state.players.get(tile.owner);
        if (player) {
          this.drawHexBorderOwner(tile.coord, player.color, 0.5);
        }
      }

      // 都市表示
      if (tile.cityId && tile.visible) {
        const city = state.cities.get(tile.cityId);
        if (city) {
          const pos = hexToPixel(tile.coord, this.hexSize);
          const player = state.players.get(city.owner);
          const playerColor = player?.color ?? 0xffffff;
          const playerColorHex = player?.colorHex ?? '#ffffff';

          this.drawCitySymbol(pos, playerColor, city.isCapital);

          const nameText = this.scene.add.text(pos.x, pos.y + this.hexSize * 0.65, city.name, {
            fontSize: '9px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(0.5);
          this.labelContainer.add(nameText);

          // 首都の場合は王冠テキストも追加
          if (city.isCapital) {
            const crownText = this.scene.add.text(pos.x, pos.y - this.hexSize * 0.55, '♛', {
              fontSize: '12px', color: playerColorHex,
              stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);
            this.labelContainer.add(crownText);
          }
        }
      }
    });
  }

  drawHighlights(
    reachable: Set<string>,
    attackable: Set<string>,
    buildable: Set<string>
  ): void {
    this.highlightGraphics.clear();

    reachable.forEach(key => {
      const [q, r] = key.split(',').map(Number);
      this.drawHexHighlight({ q, r }, 0x88ddff, 0.5);
    });

    attackable.forEach(key => {
      const [q, r] = key.split(',').map(Number);
      this.drawHexHighlight({ q, r }, 0xff3333, 0.55);
    });

    buildable.forEach(key => {
      const [q, r] = key.split(',').map(Number);
      this.drawHexHighlight({ q, r }, 0xffee00, 0.5);
    });
  }

  drawUnits(state: GameState, selectedUnitId: string | null): void {
    this.unitGraphics.clear();

    state.units.forEach(unit => {
      const tile = state.tiles.get(hexKey(unit.coord));
      if (!tile?.visible) return;

      this.drawUnit(unit, unit.id === selectedUnitId, state);
    });
  }

  private drawTerrainDetail(coord: HexCoord, terrain: TerrainType): void {
    const pos = hexToPixel(coord, this.hexSize);
    const g = this.terrainDetailGraphics;
    const s = this.hexSize;

    switch (terrain) {
      case 'plain': {
        // ランダムっぽいが決定論的な草のドット（座標ベース）
        const seed = (coord.q * 73 + coord.r * 31) & 0xff;
        g.fillStyle(0x55aa22, 0.5);
        for (let i = 0; i < 5; i++) {
          const sx = ((seed * (i + 1) * 37) % 60) - 30;
          const sy = ((seed * (i + 1) * 53) % 40) - 20;
          const dotR = 1 + (i % 2);
          // ヘックス内に収める（大まかな円形クリップとして半径の60%以内）
          if (Math.sqrt(sx * sx + sy * sy) < s * 0.6) {
            g.fillCircle(pos.x + sx, pos.y + sy, dotR);
          }
        }
        break;
      }
      case 'forest': {
        // 2本の木（三角形）
        g.fillStyle(0x0d5c0d, 0.7);
        const offsets = [
          { dx: -s * 0.2, dy: s * 0.05 },
          { dx: s * 0.2, dy: -s * 0.05 },
        ];
        offsets.forEach(o => {
          const tx = pos.x + o.dx;
          const ty = pos.y + o.dy;
          const th = s * 0.5;
          const tw = s * 0.3;
          g.fillTriangle(tx, ty - th, tx - tw, ty + th * 0.4, tx + tw, ty + th * 0.4);
        });
        // 幹
        g.fillStyle(0x5a3010, 0.6);
        offsets.forEach(o => {
          g.fillRect(pos.x + o.dx - 2, pos.y + o.dy + s * 0.15, 4, s * 0.2);
        });
        break;
      }
      case 'mountain': {
        // 山のシルエット（大きい三角 + 小さい三角）
        g.fillStyle(0x6a5548, 0.6);
        const mh = s * 0.6;
        const mw = s * 0.55;
        g.fillTriangle(pos.x, pos.y - mh, pos.x - mw, pos.y + mh * 0.3, pos.x + mw, pos.y + mh * 0.3);
        // 雪のキャップ
        g.fillStyle(0xeeeeee, 0.5);
        g.fillTriangle(pos.x, pos.y - mh, pos.x - mw * 0.35, pos.y - mh * 0.45, pos.x + mw * 0.35, pos.y - mh * 0.45);
        break;
      }
      case 'sea': {
        // 波線パターン（sinカーブ）
        g.lineStyle(1.5, 0x5588ee, 0.45);
        for (let wi = -1; wi <= 1; wi++) {
          const wy = pos.y + wi * s * 0.25;
          const pts: { x: number; y: number }[] = [];
          for (let xi = -8; xi <= 8; xi++) {
            const wx = pos.x + xi * (s * 0.1);
            const wyo = wy + Math.sin((xi / 2) * Math.PI) * (s * 0.06);
            pts.push({ x: wx, y: wyo });
          }
          for (let pi = 0; pi < pts.length - 1; pi++) {
            g.lineBetween(pts[pi].x, pts[pi].y, pts[pi + 1].x, pts[pi + 1].y);
          }
        }
        break;
      }
    }
  }

  private drawCitySymbol(pos: { x: number; y: number }, playerColor: number, isCapital: boolean): void {
    const g = this.tileGraphics;
    const s = this.hexSize * 0.38;

    if (isCapital) {
      // 首都: 城のシルエット（長方形の上に凸型）
      g.fillStyle(playerColor, 0.9);
      // 城壁本体
      g.fillRect(pos.x - s, pos.y - s * 0.3, s * 2, s * 1.1);
      // 城壁の凸部（銃眼）3つ
      const merlonW = s * 0.45;
      const merlonH = s * 0.4;
      for (let mi = 0; mi < 3; mi++) {
        g.fillRect(pos.x - s + mi * (s * 0.65), pos.y - s * 0.3 - merlonH, merlonW, merlonH);
      }
      // アウトライン
      g.lineStyle(1.5, 0xffd700, 0.9);
      g.strokeRect(pos.x - s, pos.y - s * 0.3, s * 2, s * 1.1);
    } else {
      // 一般都市: 家のシルエット
      g.fillStyle(playerColor, 0.85);
      // 家の本体
      g.fillRect(pos.x - s * 0.7, pos.y, s * 1.4, s * 0.9);
      // 屋根（三角形）
      g.fillTriangle(
        pos.x, pos.y - s * 0.6,
        pos.x - s * 0.95, pos.y,
        pos.x + s * 0.95, pos.y
      );
      // アウトライン
      g.lineStyle(1, 0xffffff, 0.6);
      g.strokeRect(pos.x - s * 0.7, pos.y, s * 1.4, s * 0.9);
    }
  }

  private drawHex(coord: HexCoord, fillColor: number, strokeColor: number, alpha: number): void {
    const pos = hexToPixel(coord, this.hexSize);
    const points = this.getHexPoints(pos.x, pos.y);

    this.tileGraphics.fillStyle(fillColor, alpha);
    this.tileGraphics.fillPoints(points, true);

    this.tileGraphics.lineStyle(0.8, strokeColor, alpha * 0.7);
    this.tileGraphics.strokePoints(points, true);
  }

  private drawHexFog(coord: HexCoord): void {
    const pos = hexToPixel(coord, this.hexSize);
    const points = this.getHexPoints(pos.x, pos.y);

    this.tileGraphics.fillStyle(0x1a1a2e, 1.0);
    this.tileGraphics.fillPoints(points, true);
    this.tileGraphics.lineStyle(0.8, 0x2e2e50, 0.5);
    this.tileGraphics.strokePoints(points, true);
  }

  private drawHexBorderOwner(coord: HexCoord, color: number, alpha: number): void {
    const pos = hexToPixel(coord, this.hexSize);
    const size = this.hexSize - 2;
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(new Phaser.Geom.Point(
        pos.x + size * Math.cos(angle),
        pos.y + size * Math.sin(angle)
      ));
    }
    this.tileGraphics.lineStyle(2, color, alpha);
    this.tileGraphics.strokePoints(points, true);
  }

  private drawHexHighlight(coord: HexCoord, color: number, alpha: number): void {
    const pos = hexToPixel(coord, this.hexSize);
    const points = this.getHexPoints(pos.x, pos.y);
    this.highlightGraphics.fillStyle(color, alpha);
    this.highlightGraphics.fillPoints(points, true);
    this.highlightGraphics.lineStyle(2.5, color, 1.0);
    this.highlightGraphics.strokePoints(points, true);
  }

  private drawUnit(unit: Unit, isSelected: boolean, state: GameState): void {
    const pos = hexToPixel(unit.coord, this.hexSize);
    const player = state.players.get(unit.owner);
    const color = player?.color ?? 0xffffff;
    const g = this.unitGraphics;
    const s = this.hexSize * 0.38;
    const alpha = unit.movesLeft === 0 ? 0.55 : 1.0;

    // 選択リング
    if (isSelected) {
      g.lineStyle(3, 0xffffff, 1.0);
      g.strokeCircle(pos.x, pos.y, s + 6);
    }

    // 盾型の背景
    this.drawShieldBackground(pos, color, s, alpha);

    // ユニットタイプ別シンボル
    g.lineStyle(1.5, 0xffffff, alpha);
    g.fillStyle(0xffffff, alpha);

    switch (unit.type) {
      case 'warrior':
        // 剣（2本の斜め線が交差）
        g.lineStyle(2, 0xffffff, alpha);
        g.lineBetween(pos.x - s * 0.4, pos.y - s * 0.5, pos.x + s * 0.4, pos.y + s * 0.5);
        g.lineBetween(pos.x + s * 0.4, pos.y - s * 0.5, pos.x - s * 0.4, pos.y + s * 0.5);
        break;
      case 'archer':
        // 弓（曲線は折れ線で近似）
        g.lineStyle(2, 0xffffff, alpha);
        // 弓の弦
        g.lineBetween(pos.x, pos.y - s * 0.55, pos.x, pos.y + s * 0.55);
        // 弓の本体（3点折れ線）
        g.lineBetween(pos.x, pos.y - s * 0.55, pos.x - s * 0.45, pos.y);
        g.lineBetween(pos.x - s * 0.45, pos.y, pos.x, pos.y + s * 0.55);
        // 矢
        g.lineBetween(pos.x - s * 0.3, pos.y, pos.x + s * 0.4, pos.y);
        g.lineBetween(pos.x + s * 0.4, pos.y, pos.x + s * 0.25, pos.y - s * 0.15);
        break;
      case 'cavalry':
        // 馬の頭のシルエット（簡略化）
        g.lineStyle(2, 0xffffff, alpha);
        // 首
        g.lineBetween(pos.x - s * 0.1, pos.y + s * 0.4, pos.x, pos.y - s * 0.1);
        // 頭
        g.lineBetween(pos.x, pos.y - s * 0.1, pos.x + s * 0.4, pos.y - s * 0.35);
        g.lineBetween(pos.x + s * 0.4, pos.y - s * 0.35, pos.x + s * 0.45, pos.y - s * 0.1);
        g.lineBetween(pos.x + s * 0.45, pos.y - s * 0.1, pos.x + s * 0.2, pos.y + s * 0.1);
        g.lineBetween(pos.x + s * 0.2, pos.y + s * 0.1, pos.x, pos.y - s * 0.1);
        // 耳
        g.lineBetween(pos.x + s * 0.3, pos.y - s * 0.35, pos.x + s * 0.25, pos.y - s * 0.55);
        break;
      case 'artillery':
        // 砲台（四角＋円の砲身）
        g.lineStyle(2, 0xffffff, alpha);
        // 台座（四角）
        g.strokeRect(pos.x - s * 0.45, pos.y, s * 0.9, s * 0.45);
        // 砲身（円+長方形）
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(pos.x - s * 0.1, pos.y - s * 0.05, s * 0.22);
        g.fillRect(pos.x - s * 0.1, pos.y - s * 0.3, s * 0.5, s * 0.16);
        break;
    }

    // HPバー
    const hpRatio = unit.hp / unit.maxHp;
    const barW = this.hexSize * 0.85;
    const barH = 4;
    const barX = pos.x - barW / 2;
    const barY = pos.y + s + 5;

    g.fillStyle(0x222222, 0.9);
    g.fillRect(barX, barY, barW, barH);
    const hpColor = hpRatio > 0.6 ? 0x44ee44 : hpRatio > 0.3 ? 0xffaa00 : 0xff3333;
    g.fillStyle(hpColor, 1.0);
    g.fillRect(barX, barY, barW * hpRatio, barH);
  }

  private drawShieldBackground(
    pos: { x: number; y: number },
    color: number,
    s: number,
    alpha: number
  ): void {
    const g = this.unitGraphics;
    // 盾型（五角形っぽい形）
    const shieldPts: Phaser.Geom.Point[] = [
      new Phaser.Geom.Point(pos.x - s * 0.65, pos.y - s * 0.7),
      new Phaser.Geom.Point(pos.x + s * 0.65, pos.y - s * 0.7),
      new Phaser.Geom.Point(pos.x + s * 0.65, pos.y + s * 0.3),
      new Phaser.Geom.Point(pos.x, pos.y + s * 0.8),
      new Phaser.Geom.Point(pos.x - s * 0.65, pos.y + s * 0.3),
    ];
    g.fillStyle(color, alpha * 0.85);
    g.fillPoints(shieldPts, true);
    g.lineStyle(1.5, 0xffffff, alpha * 0.6);
    g.strokePoints(shieldPts, true);
  }

  private getHexPoints(cx: number, cy: number): Phaser.Geom.Point[] {
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(new Phaser.Geom.Point(
        cx + this.hexSize * Math.cos(angle),
        cy + this.hexSize * Math.sin(angle)
      ));
    }
    return points;
  }

  destroy(): void {
    this.tileGraphics.destroy();
    this.terrainDetailGraphics.destroy();
    this.highlightGraphics.destroy();
    this.unitGraphics.destroy();
    this.labelContainer.destroy();
    this.mapContainer.destroy();
  }
}
