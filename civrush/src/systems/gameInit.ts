import type {
  GameState, PlayerState, PlayerId, City, Unit, Difficulty, HexCoord, Era
} from '../models/types';
import { createTechTree } from '../models/techData';
import { getUnitStats } from '../models/unitData';
import { generateMap, findStartPositions, updateVisibility } from './mapGenerator';
import { hexKey, getNeighbors } from './hexUtils';
import { t, tArray } from '../i18n';

let unitIdCounter = 0;
let cityIdCounter = 0;

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++unitIdCounter}`;
}

function getPlayerConfigs(): Array<{ id: PlayerId; name: string; color: number; colorHex: string }> {
  return [
    { id: 'player' as PlayerId, name: t('playerName'), color: 0x4488ff, colorHex: '#4488ff' },
    { id: 'ai1' as PlayerId, name: t('ai1Name'), color: 0xff4444, colorHex: '#ff4444' },
    { id: 'ai2' as PlayerId, name: t('ai2Name'), color: 0xff8800, colorHex: '#ff8800' },
  ];
}

export function initializeGame(difficulty: Difficulty, aiCount: number = 1): GameState {
  unitIdCounter = 0;
  cityIdCounter = 0;

  const tiles = generateMap();
  const techTree = createTechTree();

  const players = new Map<PlayerId, PlayerState>();
  const cities = new Map<string, City>();
  const units = new Map<string, Unit>();

  const playerIds: PlayerId[] = ['player'];
  for (let i = 0; i < aiCount; i++) {
    playerIds.push(i === 0 ? 'ai1' : 'ai2');
  }

  // プレイヤー初期化
  playerIds.forEach(id => {
    const config = getPlayerConfigs().find(c => c.id === id)!;
    const state: PlayerState = {
      id,
      name: config.name,
      color: config.color,
      colorHex: config.colorHex,
      production: 0,
      science: 0,
      researchedTechs: new Set(),
      currentEra: 'ancient',
      cities: [],
      units: [],
      isEliminated: false,
    };
    players.set(id, state);
  });

  // 開始位置を見つける
  const startPositions = findStartPositions(tiles, playerIds.length);

  // 各プレイヤーの初期都市とユニットを配置
  playerIds.forEach((playerId, index) => {
    const startPos = startPositions[index] ?? { q: index * 3, r: index * 3 };
    const playerState = players.get(playerId)!;

    // 首都を作成
    const cityId = `city_${++cityIdCounter}`;
    const capital: City = {
      id: cityId,
      name: t('cityCapital'),
      coord: startPos,
      owner: playerId,
      isCapital: true,
      production: 3,
      science: 3,
      buildings: [],
      actionUsed: false,
    };
    cities.set(cityId, capital);
    playerState.cities.push(cityId);

    // タイルに都市を配置
    const tile = tiles.get(hexKey(startPos));
    if (tile) {
      tile.owner = playerId;
      tile.cityId = cityId;
      tile.terrain = 'plain'; // 首都は平原に強制
    }

    // 周辺タイルをプレイヤー所有に
    getNeighbors(startPos).forEach(neighbor => {
      const neighborTile = tiles.get(hexKey(neighbor));
      if (neighborTile && neighborTile.terrain !== 'sea' && neighborTile.terrain !== 'mountain') {
        neighborTile.owner = playerId;
      }
    });

    // 初期ユニット（戦士×2）
    // 首都タイル自体 + 周辺タイルから空き地を探す
    const warriorStats = getUnitStats('warrior');
    const candidateCoords: HexCoord[] = [startPos, ...getNeighbors(startPos)];
    const spawnCoords = candidateCoords.filter(n => {
      const t = tiles.get(hexKey(n));
      return t && t.terrain !== 'sea' && t.terrain !== 'mountain' && !t.unitId;
    });

    // 半径2まで広げて確実に2体確保
    if (spawnCoords.length < 2) {
      const neighbors2 = getNeighbors(startPos).flatMap(n => getNeighbors(n));
      neighbors2.forEach(n => {
        if (spawnCoords.length >= 2) return;
        const t = tiles.get(hexKey(n));
        if (t && t.terrain !== 'sea' && t.terrain !== 'mountain' && !t.unitId) {
          const alreadyIn = spawnCoords.some(c => c.q === n.q && c.r === n.r);
          if (!alreadyIn) spawnCoords.push(n);
        }
      });
    }

    for (let i = 0; i < 2 && i < spawnCoords.length; i++) {
      const unitId = generateId('unit');
      const unit: Unit = {
        id: unitId,
        type: 'warrior',
        owner: playerId,
        coord: spawnCoords[i],
        hp: warriorStats.maxHp,
        maxHp: warriorStats.maxHp,
        movesLeft: warriorStats.movement,
        hasAttacked: false,
      };
      units.set(unitId, unit);
      playerState.units.push(unitId);

      const unitTile = tiles.get(hexKey(spawnCoords[i]));
      if (unitTile) unitTile.unitId = unitId;
    }
  });

  const aiPlayerIds = playerIds.filter(id => id !== 'player') as PlayerId[];

  const stats = {
    tilesOwned: new Map<PlayerId, number>(),
    techsResearched: new Map<PlayerId, number>(),
    unitsKilled: new Map<PlayerId, number>(),
    unitsLost: new Map<PlayerId, number>(),
  };
  playerIds.forEach(id => {
    stats.tilesOwned.set(id, 0);
    stats.techsResearched.set(id, 0);
    stats.unitsKilled.set(id, 0);
    stats.unitsLost.set(id, 0);
  });

  const state: GameState = {
    turn: 1,
    maxTurns: 40,
    phase: 'city_action',
    currentPlayer: 'player',
    players,
    tiles,
    cities,
    units,
    techTree,
    difficulty,
    aiPlayerIds,
    selectedUnitId: null,
    gameOver: false,
    winner: null,
    victoryType: null,
    pendingCityActions: [],
    combatLog: [],
    stats,
  };

  // 最初の視界更新
  updateVisibility(state);

  return state;
}

export { cityIdCounter };
export function getNextCityName(index: number): string {
  const names = tArray('cityNames');
  return names[index % names.length];
}
