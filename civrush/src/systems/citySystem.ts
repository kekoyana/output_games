import type {
  GameState, City, PlayerId, Unit, TechId, UnitType, HexCoord, Era, BuildingType
} from '../models/types';
import { getUnitStats } from '../models/unitData';
import { hexKey, getNeighbors, hexDistance } from './hexUtils';
import { generateId, getNextCityName } from './gameInit';
import { updateVisibility } from './mapGenerator';

// 特定プレイヤーの資源獲得
export function collectResourcesForPlayer(state: GameState, playerId: PlayerId): void {
  const player = state.players.get(playerId);
  if (!player || player.isEliminated) return;
  collectPlayerResources(state, player);
}

// 全プレイヤーの資源獲得
export function collectResources(state: GameState): void {
  state.players.forEach(player => {
    if (player.isEliminated) return;
    collectPlayerResources(state, player);
  });
}

function collectPlayerResources(state: GameState, player: { id: PlayerId; cities: string[]; production: number; science: number; researchedTechs: Set<TechId>; isEliminated: boolean }): void {

    let totalProduction = 0;
    let totalScience = 0;

    player.cities.forEach(cityId => {
      const city = state.cities.get(cityId);
      if (!city) return;

      let cityProduction = city.production;
      let cityScience = city.science;

      // 農業技術効果
      if (player.researchedTechs.has('agriculture')) cityProduction += 2;
      // 暦技術効果
      if (player.researchedTechs.has('calendar')) cityScience += 2;
      // 印刷術技術効果
      if (player.researchedTechs.has('printing')) cityScience += 4;
      // 電力技術効果
      if (player.researchedTechs.has('electricity')) cityScience += 5;
      // 産業化技術効果
      if (player.researchedTechs.has('industrialization')) cityProduction = Math.floor(cityProduction * 1.5);
      // 原子力技術効果
      if (player.researchedTechs.has('nuclear_power')) cityProduction = Math.floor(cityProduction * 2);
      // コンピュータ技術効果
      if (player.researchedTechs.has('computers')) cityScience = Math.floor(cityScience * 2);

      // 図書館ボーナス
      if (city.buildings.includes('library')) cityScience += 3;
      // 兵舎ボーナス
      if (city.buildings.includes('barracks')) cityProduction += 2;

      // 周辺タイルのボーナス
      getNeighbors(city.coord).forEach(neighbor => {
        const tile = state.tiles.get(hexKey(neighbor));
        if (tile && tile.owner === player.id) {
          if (tile.terrain === 'plain') cityProduction += 1;
        }
      });

      totalProduction += cityProduction;
      totalScience += cityScience;
    });

  player.production += totalProduction;
  player.science += totalScience;
}

// 技術研究
export function researchTech(state: GameState, playerId: PlayerId, techId: TechId): boolean {
  const player = state.players.get(playerId);
  const techNode = state.techTree.nodes.get(techId);
  if (!player || !techNode) return false;

  // すでに研究済み
  if (player.researchedTechs.has(techId)) return false;

  // 前提技術チェック
  for (const req of techNode.requires) {
    if (!player.researchedTechs.has(req)) return false;
  }

  // 科学力チェック
  if (player.science < techNode.cost) return false;

  player.science -= techNode.cost;
  player.researchedTechs.add(techId);

  // 統計更新
  const count = state.stats.techsResearched.get(playerId) ?? 0;
  state.stats.techsResearched.set(playerId, count + 1);

  // 時代進行チェック
  updateEra(player);

  return true;
}

function updateEra(player: { currentEra: Era; researchedTechs: Set<TechId> }): void {
  const medieval: TechId[] = ['iron', 'fortification', 'mathematics', 'printing'];
  const modern: TechId[] = ['industrialization', 'mechanization', 'electricity', 'railroad'];
  const atomic: TechId[] = ['nuclear_power', 'computers', 'space_program'];

  if (player.currentEra === 'ancient') {
    if (medieval.some(t => player.researchedTechs.has(t))) {
      player.currentEra = 'medieval';
    }
  } else if (player.currentEra === 'medieval') {
    if (modern.some(t => player.researchedTechs.has(t))) {
      player.currentEra = 'modern';
    }
  } else if (player.currentEra === 'modern') {
    if (atomic.some(t => player.researchedTechs.has(t))) {
      player.currentEra = 'atomic';
    }
  }
}

// ユニット生産
export function produceUnit(
  state: GameState,
  cityId: string,
  unitType: UnitType
): string | null {
  const city = state.cities.get(cityId);
  if (!city) return null;

  const player = state.players.get(city.owner);
  if (!player) return null;

  const stats = getUnitStats(unitType);

  // 技術チェック
  if (unitType === 'archer' && !player.researchedTechs.has('archery')) return null;
  if (unitType === 'cavalry' && !player.researchedTechs.has('iron')) return null;
  if (unitType === 'artillery' && !player.researchedTechs.has('mathematics')) return null;

  // 生産力チェック
  if (player.production < stats.productionCost) return null;

  // 配置場所を探す
  const spawnCoord = findSpawnLocation(state, city.coord, city.owner);
  if (!spawnCoord) return null;

  player.production -= stats.productionCost;

  // 機械化技術効果
  const movement = player.researchedTechs.has('mechanization')
    ? stats.movement + 1
    : stats.movement;

  const unitId = generateId('unit');
  const unit: Unit = {
    id: unitId,
    type: unitType,
    owner: city.owner,
    coord: spawnCoord,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    movesLeft: movement,
    hasAttacked: false,
  };

  state.units.set(unitId, unit);
  player.units.push(unitId);

  const spawnTile = state.tiles.get(hexKey(spawnCoord));
  if (spawnTile) spawnTile.unitId = unitId;

  return unitId;
}

function findSpawnLocation(
  state: GameState,
  cityCoord: HexCoord,
  owner: PlayerId
): HexCoord | null {
  // 都市自体が空なら都市に配置
  const cityTile = state.tiles.get(hexKey(cityCoord));
  if (cityTile && !cityTile.unitId) return cityCoord;

  // 周辺タイルを探す
  for (const neighbor of getNeighbors(cityCoord)) {
    const tile = state.tiles.get(hexKey(neighbor));
    if (tile && !tile.unitId && tile.terrain !== 'sea' && tile.terrain !== 'mountain') {
      return neighbor;
    }
  }
  return null;
}

// 都市建設
export function buildCity(
  state: GameState,
  ownerId: PlayerId,
  targetCoord: HexCoord
): boolean {
  const player = state.players.get(ownerId);
  if (!player) return false;

  // 最大3都市チェック
  if (player.cities.length >= 3) return false;

  // 生産力チェック
  if (player.production < 10) return false;

  // 対象タイルチェック
  const tile = state.tiles.get(hexKey(targetCoord));
  if (!tile) return false;
  if (tile.terrain !== 'plain' && tile.terrain !== 'forest') return false;
  if (tile.cityId) return false;
  if (tile.unitId) {
    const unit = state.units.get(tile.unitId);
    if (unit && unit.owner !== ownerId) return false;
  }

  // 既存都市から3ヘックス以内
  let nearCapital = false;
  player.cities.forEach(cityId => {
    const city = state.cities.get(cityId);
    if (city && hexDistance(city.coord, targetCoord) <= 4) {
      nearCapital = true;
    }
  });
  if (!nearCapital) return false;

  // 他の都市との最小距離チェック
  let tooClose = false;
  state.cities.forEach(city => {
    if (hexDistance(city.coord, targetCoord) < 2) {
      tooClose = true;
    }
  });
  if (tooClose) return false;

  player.production -= 10;

  const cityId = `city_${Date.now()}`;
  const cityIndex = player.cities.length;
  const newCity: City = {
    id: cityId,
    name: getNextCityName(cityIndex),
    coord: targetCoord,
    owner: ownerId,
    isCapital: false,
    production: 2,
    science: 2,
    buildings: [],
    actionUsed: true,
  };

  state.cities.set(cityId, newCity);
  player.cities.push(cityId);

  tile.owner = ownerId;
  tile.cityId = cityId;

  // 周辺タイルをプレイヤー所有に
  getNeighbors(targetCoord).forEach(neighbor => {
    const neighborTile = state.tiles.get(hexKey(neighbor));
    if (neighborTile && !neighborTile.owner) {
      neighborTile.owner = ownerId;
    }
  });

  updateVisibility(state);
  return true;
}

// 建物建設
export function buildBuilding(
  state: GameState,
  cityId: string,
  building: BuildingType
): boolean {
  const city = state.cities.get(cityId);
  if (!city) return false;

  const player = state.players.get(city.owner);
  if (!player) return false;

  if (city.buildings.includes(building)) return false;

  const costs: Record<BuildingType, number> = {
    barracks: 8,
    library: 8,
    fortress: 12,
  };

  if (player.production < costs[building]) return false;

  player.production -= costs[building];
  city.buildings.push(building);

  return true;
}

// ターン開始時の都市アクションリセット
export function resetCityActions(state: GameState): void {
  state.cities.forEach(city => {
    city.actionUsed = false;
  });
}
