import type { GameState, Unit, PlayerId } from '../models/types';
import { getUnitStats } from '../models/unitData';
import { hexKey, hexDistance, getNeighbors } from './hexUtils';
import { t } from '../i18n';

// 攻撃可能なユニットを探す
export function findAttackTargets(state: GameState, attackerUnit: Unit): Unit[] {
  const stats = getUnitStats(attackerUnit.type);
  const targets: Unit[] = [];

  state.units.forEach(unit => {
    if (unit.owner === attackerUnit.owner) return;
    const player = state.players.get(unit.owner);
    if (player?.isEliminated) return;

    const dist = hexDistance(attackerUnit.coord, unit.coord);
    if (dist <= stats.range && dist >= 1) {
      targets.push(unit);
    }
  });

  return targets;
}

// 戦闘解決
export function resolveCombat(
  state: GameState,
  attackerId: string,
  defenderId: string
): { attackerDamage: number; defenderDamage: number; defenderKilled: boolean; attackerKilled: boolean } {
  const attacker = state.units.get(attackerId);
  const defender = state.units.get(defenderId);

  if (!attacker || !defender) {
    return { attackerDamage: 0, defenderDamage: 0, defenderKilled: false, attackerKilled: false };
  }

  const attackerStats = getUnitStats(attacker.type);
  const defenderStats = getUnitStats(defender.type);
  const defenderTile = state.tiles.get(hexKey(defender.coord));

  // 基本攻撃力計算
  let attackPower = attackerStats.attack;
  let defensePower = defenderStats.defense;

  // 青銅器技術効果（戦士強化）
  const attackerPlayer = state.players.get(attacker.owner);
  if (attackerPlayer?.researchedTechs.has('bronze') && attacker.type === 'warrior') {
    attackPower += 2;
  }

  // 城郭技術効果（防御+3）
  const defenderPlayer = state.players.get(defender.owner);
  if (defenderPlayer?.researchedTechs.has('fortification')) {
    defensePower += 3;
  }

  // 森の防御ボーナス
  if (defenderTile?.terrain === 'forest') {
    defensePower += 2;
  }

  // 要塞建物の防御ボーナス（都市内の防御ユニット）
  if (defenderTile?.cityId) {
    const defCity = state.cities.get(defenderTile.cityId);
    if (defCity && defCity.buildings.includes('fortress')) {
      defensePower += 5;
    }
  }

  // ダメージ計算
  const defenderDamage = Math.max(1, attackPower - Math.floor(defensePower / 2));
  const attackerDamage = attackerStats.range === 1
    ? Math.max(1, Math.floor(defensePower / 2))
    : 0; // 遠距離は反撃なし

  // HPを減らす
  defender.hp -= defenderDamage;
  attacker.hp -= attackerDamage;

  const defenderKilled = defender.hp <= 0;
  const attackerKilled = attacker.hp <= 0;

  // 攻撃フラグを立てる
  attacker.hasAttacked = true;
  attacker.movesLeft = 0;

  // 戦闘ログ
  const unitNames: Record<string, string> = {
    warrior: t('unitWarrior'),
    archer: t('unitArcher'),
    cavalry: t('unitCavalry'),
    artillery: t('unitArtillery'),
  };
  const aName = unitNames[attacker.type] ?? attacker.type;
  const dName = unitNames[defender.type] ?? defender.type;
  const log = `${aName}${t('combatAttack').replace('{target}', dName).replace('{dmg}', String(defenderDamage))}` +
    (attackerDamage > 0 ? t('combatCounter').replace('{dmg}', String(attackerDamage)) : '');
  state.combatLog.unshift(log);
  if (state.combatLog.length > 10) state.combatLog.pop();

  // ユニット除去
  if (defenderKilled) {
    removeUnit(state, defenderId);
    // 統計更新
    const killerStats = state.stats.unitsKilled.get(attacker.owner) ?? 0;
    state.stats.unitsKilled.set(attacker.owner, killerStats + 1);
    const lostStats = state.stats.unitsLost.get(defender.owner) ?? 0;
    state.stats.unitsLost.set(defender.owner, lostStats + 1);
  }

  if (attackerKilled) {
    removeUnit(state, attackerId);
    const killerStats = state.stats.unitsKilled.get(defender.owner) ?? 0;
    state.stats.unitsKilled.set(defender.owner, killerStats + 1);
    const lostStats = state.stats.unitsLost.get(attacker.owner) ?? 0;
    state.stats.unitsLost.set(attacker.owner, lostStats + 1);
  }

  return { attackerDamage, defenderDamage, defenderKilled, attackerKilled };
}

// ユニットを除去
export function removeUnit(state: GameState, unitId: string): void {
  const unit = state.units.get(unitId);
  if (!unit) return;

  // タイルから除去
  const tile = state.tiles.get(hexKey(unit.coord));
  if (tile && tile.unitId === unitId) {
    tile.unitId = null;
  }

  // プレイヤーリストから除去
  const player = state.players.get(unit.owner);
  if (player) {
    player.units = player.units.filter(id => id !== unitId);
  }

  state.units.delete(unitId);

  // 選択解除
  if (state.selectedUnitId === unitId) {
    state.selectedUnitId = null;
  }
}

// 移動後に自動戦闘チェック
export function checkAdjacentCombat(state: GameState, unitId: string): void {
  const unit = state.units.get(unitId);
  if (!unit || unit.hasAttacked) return;

  const targets = findAttackTargets(state, unit);
  if (targets.length === 0) return;

  // 近距離ユニットは隣接敵に自動攻撃
  const stats = getUnitStats(unit.type);
  if (stats.range === 1) {
    // 最も近い敵を攻撃
    const nearest = targets.reduce((a, b) =>
      hexDistance(unit.coord, a.coord) < hexDistance(unit.coord, b.coord) ? a : b
    );
    resolveCombat(state, unitId, nearest.id);
  }
}
