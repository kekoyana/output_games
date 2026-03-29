import type { GameState, Unit, HexCoord, PlayerId } from '../models/types';
import { getUnitStats } from '../models/unitData';
import { hexKey, getNeighbors, hexDistance } from './hexUtils';
import { t } from '../i18n';

// 移動コスト計算
export function getMoveCost(state: GameState, unit: Unit, to: HexCoord): number {
  const tile = state.tiles.get(hexKey(to));
  if (!tile) return Infinity;

  // 通行不可
  if (tile.terrain === 'mountain') {
    // 山岳行軍技術があれば通行可
    const player = state.players.get(unit.owner);
    if (!player?.researchedTechs.has('railroad')) return Infinity;
    return 2;
  }

  if (tile.terrain === 'sea') {
    // 航海術技術があれば通行可（未実装のため不可）
    return Infinity;
  }

  if (tile.terrain === 'forest') return 2;

  // 鉄道技術：都市間移動コスト0
  const player = state.players.get(unit.owner);
  if (player?.researchedTechs.has('railroad') && tile.cityId) {
    return 0;
  }

  return 1;
}

// 移動可能なタイルを取得（BFS）
export function getReachableTiles(state: GameState, unitId: string): Set<string> {
  const unit = state.units.get(unitId);
  if (!unit || unit.movesLeft === 0) return new Set();

  const stats = getUnitStats(unit.type);
  const reachable = new Set<string>();
  const queue: Array<{ coord: HexCoord; movesLeft: number }> = [
    { coord: unit.coord, movesLeft: unit.movesLeft }
  ];
  const visited = new Map<string, number>(); // key -> best movesLeft
  visited.set(hexKey(unit.coord), unit.movesLeft);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighbor of getNeighbors(current.coord)) {
      const tile = state.tiles.get(hexKey(neighbor));
      if (!tile) continue;

      const cost = getMoveCost(state, unit, neighbor);
      if (cost === Infinity) continue;

      const newMovesLeft = current.movesLeft - cost;
      if (newMovesLeft < 0) continue;

      // 敵ユニットがいるタイルは通行不可（攻撃は別処理）
      if (tile.unitId) {
        const occupant = state.units.get(tile.unitId);
        if (occupant && occupant.owner !== unit.owner) continue;
        if (occupant && occupant.owner === unit.owner) continue; // 味方も通行不可
      }

      const key = hexKey(neighbor);
      const existing = visited.get(key);
      if (existing === undefined || newMovesLeft > existing) {
        visited.set(key, newMovesLeft);
        reachable.add(key);
        if (newMovesLeft > 0) {
          queue.push({ coord: neighbor, movesLeft: newMovesLeft });
        }
      }
    }
  }

  // 現在地は除く
  reachable.delete(hexKey(unit.coord));

  return reachable;
}

// 攻撃可能なタイルを取得
export function getAttackableTiles(state: GameState, unitId: string): Set<string> {
  const unit = state.units.get(unitId);
  if (!unit || unit.hasAttacked) return new Set();

  const stats = getUnitStats(unit.type);
  const attackable = new Set<string>();

  state.units.forEach(target => {
    if (target.owner === unit.owner) return;
    const dist = hexDistance(unit.coord, target.coord);
    if (dist >= 1 && dist <= stats.range) {
      attackable.add(hexKey(target.coord));
    }
  });

  return attackable;
}

// ユニットを移動
export function moveUnit(state: GameState, unitId: string, to: HexCoord): boolean {
  const unit = state.units.get(unitId);
  if (!unit) return false;

  const reachable = getReachableTiles(state, unitId);
  const targetKey = hexKey(to);

  if (!reachable.has(targetKey)) return false;

  const targetTile = state.tiles.get(targetKey);
  if (!targetTile || targetTile.unitId) return false;

  // 移動コストを計算
  const cost = calculatePathCost(state, unit, unit.coord, to);

  // 元のタイルから除去
  const fromTile = state.tiles.get(hexKey(unit.coord));
  if (fromTile) fromTile.unitId = null;

  // 新タイルに配置
  targetTile.unitId = unitId;
  unit.coord = to;
  unit.movesLeft = Math.max(0, unit.movesLeft - cost);

  // 都市占領チェック
  if (targetTile.cityId) {
    const city = state.cities.get(targetTile.cityId);
    if (city && city.owner !== unit.owner) {
      captureCity(state, city.id, unit.owner);
    }
  }

  return true;
}

function calculatePathCost(state: GameState, unit: Unit, from: HexCoord, to: HexCoord): number {
  // 簡易版：直接コスト
  return getMoveCost(state, unit, to);
}

// 都市占領
export function captureCity(state: GameState, cityId: string, newOwner: PlayerId): void {
  const city = state.cities.get(cityId);
  if (!city) return;

  const oldOwner = city.owner;
  const oldPlayer = state.players.get(oldOwner);
  const newPlayer = state.players.get(newOwner);

  if (!oldPlayer || !newPlayer) return;

  // 都市の所有権変更
  oldPlayer.cities = oldPlayer.cities.filter(id => id !== cityId);
  newPlayer.cities.push(cityId);
  city.owner = newOwner;

  // タイルの所有権変更
  const tile = state.tiles.get(hexKey(city.coord));
  if (tile) tile.owner = newOwner;

  // 首都が占領された場合の処理
  if (city.isCapital) {
    // 他の都市とユニットも移譲
    oldPlayer.cities.forEach(cId => {
      const c = state.cities.get(cId);
      if (c) {
        c.owner = newOwner;
        newPlayer.cities.push(cId);
        const ct = state.tiles.get(hexKey(c.coord));
        if (ct) ct.owner = newOwner;
      }
    });
    oldPlayer.cities = [];

    oldPlayer.units.forEach(uId => {
      const u = state.units.get(uId);
      if (u) u.owner = newOwner;
      newPlayer.units.push(uId);
    });
    oldPlayer.units = [];

    oldPlayer.isEliminated = true;
  }

  state.combatLog.unshift(`${newPlayer.name}${t('captured').replace('{enemy}', oldPlayer.name).replace('{city}', city.name)}`);
}
