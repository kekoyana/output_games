
export function trackGameStart(heroId: string) {
  (window as any).gtag?.('event', 'game_start', { hero_id: heroId });
}

export function trackChapterStart(chapter: number, heroId: string) {
  (window as any).gtag?.('event', 'chapter_start', { chapter, hero_id: heroId });
}

export function trackBattleStart(enemyId: string, chapter: number, isBoss: boolean) {
  (window as any).gtag?.('event', 'battle_start', { enemy_id: enemyId, chapter, is_boss: isBoss });
}

export function trackBattleWin(enemyId: string, chapter: number, isBoss: boolean) {
  (window as any).gtag?.('event', 'battle_win', { enemy_id: enemyId, chapter, is_boss: isBoss });
}

export function trackGameOver(heroId: string, chapter: number, enemiesDefeated: number) {
  (window as any).gtag?.('event', 'game_over', { hero_id: heroId, chapter, enemies_defeated: enemiesDefeated });
}

export function trackGameClear(heroId: string) {
  (window as any).gtag?.('event', 'game_clear', { hero_id: heroId });
}

export function trackItemPurchase(itemId: string, cost: number) {
  (window as any).gtag?.('event', 'item_purchase', { item_id: itemId, cost });
}

export function trackLegacyUpgrade(upgradeId: string, level: number, cost: number) {
  (window as any).gtag?.('event', 'legacy_upgrade', { upgrade_id: upgradeId, level, cost });
}
