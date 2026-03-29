import type { GameState, PlayerId, Era } from '../models/types';
import { t } from '../i18n';
import { collectResources, collectResourcesForPlayer, resetCityActions } from './citySystem';
import { executeAI } from './aiSystem';
import { updateVisibility } from './mapGenerator';
import { getUnitStats } from '../models/unitData';

// 勝利条件チェック
export function checkVictory(state: GameState): boolean {
  // 科学勝利チェック
  state.players.forEach(player => {
    if (player.isEliminated) return;
    if (player.researchedTechs.has('space_program')) {
      state.gameOver = true;
      state.winner = player.id;
      state.victoryType = 'science';
    }
  });

  if (state.gameOver) return true;

  // 制覇勝利チェック（AIの首都がすべて占領されたか）
  let playerWins = true;
  let aiWins = false;

  state.aiPlayerIds.forEach(aiId => {
    const aiPlayer = state.players.get(aiId);
    if (!aiPlayer) return;

    if (!aiPlayer.isEliminated) {
      // まだ生きているAIがいる
      let hasCapital = false;
      aiPlayer.cities.forEach(cityId => {
        const city = state.cities.get(cityId);
        if (city?.isCapital) hasCapital = true;
      });
      if (hasCapital) playerWins = false;
    }
  });

  if (playerWins && state.aiPlayerIds.length > 0) {
    const playerState = state.players.get('player');
    if (playerState && !playerState.isEliminated) {
      state.gameOver = true;
      state.winner = 'player';
      state.victoryType = 'conquest';
      return true;
    }
  }

  // プレイヤーが排除された
  const playerState = state.players.get('player');
  if (playerState?.isEliminated) {
    state.gameOver = true;
    // 最も多い領土を持つAIが勝者
    let maxCities = 0;
    let winnerAI: PlayerId = 'ai1';
    state.aiPlayerIds.forEach(aiId => {
      const ai = state.players.get(aiId);
      if (ai && !ai.isEliminated) {
        if (ai.cities.length > maxCities) {
          maxCities = ai.cities.length;
          winnerAI = aiId;
        }
      }
    });
    state.winner = winnerAI;
    state.victoryType = 'conquest';
    return true;
  }

  // ターン制限
  if (state.turn > state.maxTurns) {
    state.gameOver = true;
    state.victoryType = 'timeout';

    // 最大領土のプレイヤーが勝者
    let maxTiles = -1;
    state.players.forEach(player => {
      if (player.isEliminated) return;
      let tileCount = 0;
      state.tiles.forEach(tile => {
        if (tile.owner === player.id) tileCount++;
      });
      if (tileCount > maxTiles) {
        maxTiles = tileCount;
        state.winner = player.id;
      }
    });
    return true;
  }

  return false;
}

// ターン終了処理
export function endPlayerTurn(state: GameState): void {
  if (state.gameOver) return;

  // ユニットの移動/攻撃フラグをリセット（プレイヤー）
  const playerState = state.players.get('player');
  if (playerState) {
    playerState.units.forEach(unitId => {
      const unit = state.units.get(unitId);
      if (unit) {
        const stats = getUnitStats(unit.type);
        const movementBonus = playerState.researchedTechs.has('mechanization') ? 1 : 0;
        unit.movesLeft = stats.movement + movementBonus;
        unit.hasAttacked = false;
      }
    });
  }

  // AI行動
  state.aiPlayerIds.forEach(aiId => {
    const aiPlayer = state.players.get(aiId);
    if (!aiPlayer || aiPlayer.isEliminated) return;

    // AIのユニットをリセット
    aiPlayer.units.forEach(unitId => {
      const unit = state.units.get(unitId);
      if (unit) {
        const stats = getUnitStats(unit.type);
        const movementBonus = aiPlayer.researchedTechs.has('mechanization') ? 1 : 0;
        unit.movesLeft = stats.movement + movementBonus;
        unit.hasAttacked = false;
      }
    });

    // AI都市アクションをリセット
    aiPlayer.cities.forEach(cityId => {
      const city = state.cities.get(cityId);
      if (city) city.actionUsed = false;
    });

    // AI資源獲得 → AI行動実行
    collectResourcesForPlayer(state, aiId);
    executeAI(state, aiId);
  });

  // 次のターン
  state.turn++;

  // プレイヤーの資源獲得
  collectResourcesForPlayer(state, 'player');

  // 都市アクションリセット（プレイヤー）
  resetCityActions(state);

  // ユニット移動リセットは次ターン開始時に実施済み

  // 視界更新
  updateVisibility(state);

  // 統計更新
  updateStats(state);

  // 勝利チェック
  checkVictory(state);
}

function updateStats(state: GameState): void {
  state.players.forEach(player => {
    let tileCount = 0;
    state.tiles.forEach(tile => {
      if (tile.owner === player.id) tileCount++;
    });
    state.stats.tilesOwned.set(player.id, tileCount);
  });
}

// 時代名を返す
export function getEraName(era: Era): string {
  const names: Record<Era, string> = {
    ancient: t('eraAncient'),
    medieval: t('eraMedieval'),
    modern: t('eraModern'),
    atomic: t('eraAtomic'),
  };
  return names[era];
}
