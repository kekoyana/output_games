
declare global {
  interface Window {
    gtag?: (type: 'event', action: string, params?: Record<string, any>) => void;
  }
}

function track(action: string, params?: Record<string, any>) {
  window.gtag?.('event', action, params);
}

export function trackGameStart(heroId: string) {
  track('game_start', { hero_id: heroId });
}

export function trackChapterStart(chapter: number, heroId: string) {
  track('chapter_start', { chapter, hero_id: heroId });
}

export function trackBattleStart(enemyId: string, chapter: number, isBoss: boolean) {
  track('battle_start', { enemy_id: enemyId, chapter, is_boss: isBoss });
}

export function trackBattleWin(enemyId: string, chapter: number, isBoss: boolean) {
  track('battle_win', { enemy_id: enemyId, chapter, is_boss: isBoss });
}

export function trackGameOver(heroId: string, chapter: number, enemiesDefeated: number) {
  track('game_over', { hero_id: heroId, chapter, enemies_defeated: enemiesDefeated });
}

export function trackGameClear(heroId: string) {
  track('game_clear', { hero_id: heroId });
}

export function trackItemPurchase(itemId: string, cost: number) {
  track('item_purchase', { item_id: itemId, cost });
}

export function trackLegacyUpgrade(upgradeId: string, level: number, cost: number) {
  track('legacy_upgrade', { upgrade_id: upgradeId, level, cost });
}
