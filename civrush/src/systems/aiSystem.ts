import type { GameState, PlayerId, TechId, UnitType } from '../models/types';
import { hexDistance } from './hexUtils';
import { researchTech, produceUnit, collectResources } from './citySystem';
import { moveUnit, getReachableTiles } from './movementSystem';
import { resolveCombat, findAttackTargets } from './combatSystem';
import { updateVisibility } from './mapGenerator';

// AI行動実行
export function executeAI(state: GameState, aiId: PlayerId): void {
  const player = state.players.get(aiId);
  if (!player || player.isEliminated) return;

  const turn = state.turn;

  // 序盤：探索と拡張、中盤：攻撃的、終盤：全面攻勢
  if (turn <= 5) {
    aiEarlyGame(state, aiId);
  } else if (turn <= 15) {
    aiMidGame(state, aiId);
  } else {
    aiLateGame(state, aiId);
  }

  updateVisibility(state);
}

function aiEarlyGame(state: GameState, aiId: PlayerId): void {
  const player = state.players.get(aiId);
  if (!player) return;

  // 都市アクション：研究と生産優先（序盤は拡張に専念）
  player.cities.forEach(cityId => {
    const city = state.cities.get(cityId);
    if (!city || city.actionUsed) return;

    // 安価な技術を研究
    const availableTechs = getAvailableTechs(state, aiId);
    if (availableTechs.length > 0 && player.science >= 10) {
      const tech = availableTechs[0];
      if (researchTech(state, aiId, tech)) {
        city.actionUsed = true;
        return;
      }
    }

    // 生産力があれば戦士を生産
    if (player.production >= 6) {
      produceUnit(state, cityId, 'warrior');
      city.actionUsed = true;
    }
  });

  // 序盤は防衛しつつ探索
  moveAIUnits(state, aiId, 'explore');
}

function aiMidGame(state: GameState, aiId: PlayerId): void {
  const player = state.players.get(aiId);
  if (!player) return;

  // 都市アクション
  player.cities.forEach(cityId => {
    const city = state.cities.get(cityId);
    if (!city || city.actionUsed) return;

    // 技術研究
    const availableTechs = getAvailableTechs(state, aiId);
    if (availableTechs.length > 0 && player.science >= 15) {
      const tech = availableTechs[0];
      if (researchTech(state, aiId, tech)) {
        city.actionUsed = true;
        return;
      }
    }

    // ユニット生産（騎兵優先）
    if (player.researchedTechs.has('iron') && player.production >= 10) {
      if (produceUnit(state, cityId, 'cavalry')) {
        city.actionUsed = true;
        return;
      }
    }

    if (player.production >= 6) {
      if (produceUnit(state, cityId, 'warrior')) {
        city.actionUsed = true;
      }
    }
  });

  // ユニット移動：攻撃的
  moveAIUnits(state, aiId, 'attack');
}

function aiLateGame(state: GameState, aiId: PlayerId): void {
  const player = state.players.get(aiId);
  if (!player) return;

  // 科学勝利を目指すか制覇勝利を目指すか
  const researchPath = player.science > player.production * 2;

  player.cities.forEach(cityId => {
    const city = state.cities.get(cityId);
    if (!city || city.actionUsed) return;

    if (researchPath) {
      const availableTechs = getAvailableTechs(state, aiId);
      if (availableTechs.length > 0 && player.science >= 20) {
        if (researchTech(state, aiId, availableTechs[0])) {
          city.actionUsed = true;
          return;
        }
      }
    }

    // 砲兵を生産
    if (player.researchedTechs.has('mathematics') && player.production >= 14) {
      if (produceUnit(state, cityId, 'artillery')) {
        city.actionUsed = true;
        return;
      }
    }

    if (player.production >= 10 && player.researchedTechs.has('iron')) {
      if (produceUnit(state, cityId, 'cavalry')) {
        city.actionUsed = true;
        return;
      }
    }
  });

  moveAIUnits(state, aiId, 'rush');
}

function getAvailableTechs(state: GameState, aiId: PlayerId): TechId[] {
  const player = state.players.get(aiId);
  if (!player) return [];

  const available: TechId[] = [];
  const preferredOrder: TechId[] = [
    'agriculture', 'calendar', 'bronze', 'archery',
    'printing', 'iron', 'fortification', 'mathematics',
    'industrialization', 'railroad', 'mechanization', 'electricity',
    'nuclear_power', 'computers', 'space_program'
  ];

  preferredOrder.forEach(techId => {
    if (player.researchedTechs.has(techId)) return;
    const node = state.techTree.nodes.get(techId);
    if (!node) return;

    const canResearch = node.requires.every(req => player.researchedTechs.has(req));
    if (canResearch && player.science >= node.cost) {
      available.push(techId);
    }
  });

  return available;
}

type AIMode = 'explore' | 'attack' | 'rush' | 'defend';

function moveAIUnits(state: GameState, aiId: PlayerId, mode: AIMode): void {
  const player = state.players.get(aiId);
  if (!player) return;

  const playerCapital = findPlayerCapital(state);

  // AI首都を取得
  let aiCapital: { q: number; r: number } | null = null;
  player.cities.forEach(cityId => {
    const city = state.cities.get(cityId);
    if (city?.isCapital) aiCapital = city.coord;
  });

  player.units.forEach(unitId => {
    const unit = state.units.get(unitId);
    if (!unit || unit.movesLeft === 0) return;

    // 探索モード：プレイヤー方向にゆっくり前進（首都から5ヘックス以内に留まる）
    if (mode === 'explore') {
      if (!playerCapital || !aiCapital) return;
      const distToCapital = hexDistance(unit.coord, aiCapital);
      const reachable = getReachableTiles(state, unitId);
      let bestCoord = unit.coord;
      let bestScore = -Infinity;
      reachable.forEach(key => {
        const tile = state.tiles.get(key);
        if (!tile || tile.unitId) return;
        const [q, r] = key.split(',').map(Number);
        const coord = { q, r };
        const distFromHome = hexDistance(coord, aiCapital!);
        if (distFromHome > 5) return; // 首都から離れすぎない
        const distToPlayer = hexDistance(coord, playerCapital);
        const score = -distToPlayer; // プレイヤーに近づく
        if (score > bestScore) {
          bestScore = score;
          bestCoord = coord;
        }
      });
      if (bestCoord !== unit.coord) {
        moveUnit(state, unitId, bestCoord);
      }
      return;
    }

    // 攻撃可能な敵を探す
    const targets = findAttackTargets(state, unit);
    // attack/rushモードは全ターゲットに攻撃、exploreでも隣接敵は攻撃
    const validTargets = targets.filter(tgt => {
      if (mode === 'rush' || mode === 'attack') return true;
      return hexDistance(unit.coord, tgt.coord) === 1;
    });

    if (validTargets.length > 0 && !unit.hasAttacked) {
      const target = validTargets[0];
      resolveCombat(state, unitId, target.id);
      return;
    }

    if (!playerCapital) return;

    const reachable = getReachableTiles(state, unitId);
    if (reachable.size === 0) return;

    let bestCoord = unit.coord;
    let bestDist = hexDistance(unit.coord, playerCapital);

    reachable.forEach(key => {
      const tile = state.tiles.get(key);
      if (!tile || tile.unitId) return;

      const [q, r] = key.split(',').map(Number);
      const coord = { q, r };
      const dist = hexDistance(coord, playerCapital);

        // attackモードでも首都から最低2ヘックスは離れる
      const minSafeDistance = mode === 'attack' ? 2 : 0;
      if (dist >= minSafeDistance && dist < bestDist) {
        bestDist = dist;
        bestCoord = coord;
      }
    });

    if (bestCoord !== unit.coord) {
      moveUnit(state, unitId, bestCoord);
    }

    // 移動後に攻撃チェック（attack/rushモード）
    if (mode === 'rush' || mode === 'attack') {
      const newTargets = findAttackTargets(state, unit);
      if (newTargets.length > 0 && !unit.hasAttacked) {
        resolveCombat(state, unitId, newTargets[0].id);
      }
    }
  });
}

function findPlayerCapital(state: GameState): { q: number; r: number } | null {
  let capital = null;
  state.cities.forEach(city => {
    if (city.owner === 'player' && city.isCapital) {
      capital = city.coord;
    }
  });
  return capital;
}
