import type { UnitType, UnitStats } from './types';
import { t } from '../i18n';

const unitStatsData: Record<UnitType, UnitStats> = {
  warrior: {
    type: 'warrior',
    attack: 3,
    defense: 3,
    maxHp: 15,
    movement: 2,
    range: 1,
    productionCost: 6,
  },
  archer: {
    type: 'archer',
    attack: 4,
    defense: 2,
    maxHp: 12,
    movement: 2,
    range: 2,
    productionCost: 8,
  },
  cavalry: {
    type: 'cavalry',
    attack: 5,
    defense: 2,
    maxHp: 12,
    movement: 3,
    range: 1,
    productionCost: 10,
  },
  artillery: {
    type: 'artillery',
    attack: 7,
    defense: 1,
    maxHp: 10,
    movement: 1,
    range: 3,
    productionCost: 14,
  },
};

export function getUnitStats(type: UnitType): UnitStats {
  return unitStatsData[type];
}

export function getUnitTypeName(type: UnitType): string {
  const names: Record<UnitType, string> = {
    warrior: t('unitWarrior'),
    archer: t('unitArcher'),
    cavalry: t('unitCavalry'),
    artillery: t('unitArtillery'),
  };
  return names[type];
}

export function getTerrainName(terrain: string): string {
  const names: Record<string, string> = {
    plain: t('terrainPlain'),
    forest: t('terrainForest'),
    mountain: t('terrainMountain'),
    sea: t('terrainSea'),
  };
  return names[terrain] ?? terrain;
}
