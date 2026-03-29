import type { HexTile, HexCoord, TerrainType, GameState } from '../models/types';
import { hexKey, hexDistance, offsetToAxial } from './hexUtils';

const GRID_SIZE = 10;

// ランダム地形マップを生成
export function generateMap(): Map<string, HexTile> {
  const tiles = new Map<string, HexTile>();

  // シンプルなノイズベースの地形生成
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const coord = offsetToAxial(col, row);
      const terrain = generateTerrain(col, row);
      const tile: HexTile = {
        coord,
        terrain,
        owner: null,
        cityId: null,
        unitId: null,
        visible: false,
        explored: false,
      };
      tiles.set(hexKey(coord), tile);
    }
  }

  return tiles;
}

function generateTerrain(col: number, row: number): TerrainType {
  // 端は海
  if (col === 0 || col === GRID_SIZE - 1 || row === 0 || row === GRID_SIZE - 1) {
    if (Math.random() < 0.6) return 'sea';
  }

  const rand = Math.random();
  // 周辺部は海が多め
  const distFromCenter = Math.abs(col - 4.5) + Math.abs(row - 4.5);
  const seaChance = distFromCenter > 5 ? 0.3 : 0.1;

  if (rand < seaChance) return 'sea';
  if (rand < seaChance + 0.15) return 'mountain';
  if (rand < seaChance + 0.30) return 'forest';
  return 'plain';
}

// プレイヤー開始位置を見つける（平原で互いに離れた場所）
export function findStartPositions(
  tiles: Map<string, HexTile>,
  count: number
): HexCoord[] {
  const positions: HexCoord[] = [];

  // 候補地：平原タイル
  const plainTiles: HexTile[] = [];
  tiles.forEach(tile => {
    if (tile.terrain === 'plain') {
      plainTiles.push(tile);
    }
  });

  if (plainTiles.length === 0) return [];

  // プレイヤー1: 左上寄り
  const p1Candidates = plainTiles.filter(t => {
    const { col, row } = axialToOffset(t.coord);
    return col <= 3 && row <= 3;
  });
  const p1 = p1Candidates.length > 0
    ? p1Candidates[Math.floor(Math.random() * p1Candidates.length)]
    : plainTiles[0];
  positions.push(p1.coord);

  if (count >= 2) {
    // AI1: 右下寄り
    const p2Candidates = plainTiles.filter(t => {
      const { col, row } = axialToOffset(t.coord);
      return col >= 6 && row >= 6;
    });
    const p2 = p2Candidates.length > 0
      ? p2Candidates[Math.floor(Math.random() * p2Candidates.length)]
      : plainTiles[plainTiles.length - 1];
    positions.push(p2.coord);
  }

  if (count >= 3) {
    // AI2: 右上寄り
    const p3Candidates = plainTiles.filter(t => {
      const { col, row } = axialToOffset(t.coord);
      return col >= 6 && row <= 3;
    });
    const p3 = p3Candidates.length > 0
      ? p3Candidates[Math.floor(Math.random() * p3Candidates.length)]
      : plainTiles[Math.floor(plainTiles.length / 2)];
    positions.push(p3.coord);
  }

  // 各首都周辺を通行可能に整地
  positions.forEach(pos => {
    ensurePassableArea(tiles, pos);
  });

  return positions;
}

// 首都周辺の地形を通行可能に整地
function ensurePassableArea(tiles: Map<string, HexTile>, center: HexCoord): void {
  // 半径1: 必ず通行可能（平原or森）にする
  // 半径2: 山/海が多すぎる場合は一部を平原に変換
  tiles.forEach(tile => {
    const dist = hexDistance(center, tile.coord);
    if (dist === 0) {
      // 首都タイルは必ず平原
      tile.terrain = 'plain';
    } else if (dist === 1) {
      // 隣接6マスは必ず通行可能
      if (tile.terrain === 'mountain' || tile.terrain === 'sea') {
        tile.terrain = Math.random() < 0.5 ? 'plain' : 'forest';
      }
    } else if (dist === 2) {
      // 半径2: 山/海は50%の確率で変換（ある程度の地形バリエーションは残す）
      if (tile.terrain === 'mountain' || tile.terrain === 'sea') {
        if (Math.random() < 0.5) {
          tile.terrain = Math.random() < 0.6 ? 'plain' : 'forest';
        }
      }
    }
  });
}

function axialToOffset(coord: HexCoord): { col: number; row: number } {
  const col = coord.q + Math.floor((coord.r - (coord.r & 1)) / 2);
  const row = coord.r;
  return { col, row };
}

// 視界更新
export function updateVisibility(state: GameState): void {
  const VISION_RANGE = 2;

  // 現在の可視タイルをリセット
  state.tiles.forEach(tile => {
    tile.visible = false;
  });

  // プレイヤーのユニットと都市周辺を可視化
  const playerState = state.players.get('player');
  if (!playerState) return;

  const visibleCoords: HexCoord[] = [];

  // 都市周辺
  playerState.cities.forEach(cityId => {
    const city = state.cities.get(cityId);
    if (city) visibleCoords.push(city.coord);
  });

  // ユニット周辺
  playerState.units.forEach(unitId => {
    const unit = state.units.get(unitId);
    if (unit) visibleCoords.push(unit.coord);
  });

  visibleCoords.forEach(center => {
    for (let dq = -VISION_RANGE; dq <= VISION_RANGE; dq++) {
      for (let dr = -VISION_RANGE; dr <= VISION_RANGE; dr++) {
        const s = -dq - dr;
        if (Math.abs(dq) <= VISION_RANGE && Math.abs(dr) <= VISION_RANGE && Math.abs(s) <= VISION_RANGE) {
          const coord = { q: center.q + dq, r: center.r + dr };
          const tile = state.tiles.get(hexKey(coord));
          if (tile) {
            tile.visible = true;
            tile.explored = true;
          }
        }
      }
    }
  });
}

export const MAP_SIZE = GRID_SIZE;
