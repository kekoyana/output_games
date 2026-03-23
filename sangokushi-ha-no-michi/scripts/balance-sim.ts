/**
 * フルゲームシミュレーター（道中の成長込み）
 * usage: npm run balance [回数]
 *
 * 全5章をマップ生成→道中ノード→ボス戦の流れで通しシミュレーション。
 * 軍師カード・商人・休息・イベントによる成長を反映。
 * ゲーム本体の src/ からデータを直接 import して使用する。
 */

import type { DiceFace, HeroDef, EnemyDef, NodeType, EnemyIntent } from '../src/types';
import {
  HERO_DEFS,
  ENEMY_DEFS,
  ADVISOR_CARDS,
  MERCHANT_ITEMS,
  GAME_EVENTS,
  LEGACY_UPGRADES,
  rollDie,
} from '../src/data';
import { SLOT_MULTIPLIERS, calcSlotValue, getGoldReward } from '../src/battle';
import { randomInt, choose, shuffle, clamp } from '../src/utils';
import { pickNodeType } from '../src/mapGen';

const TRIALS = parseInt(process.argv[2] || '500', 10);
const MAP_ROWS = 6;

// ===== レガシーアップグレード適用 =====
interface SimHero {
  id: string;
  name: string;
  diceSet: DiceFace[];
  skill: HeroDef['skill'];
  stats: { maxHp: number; attack: number; defense: number; strategyPower: number };
  currentHp: number;
  gold: number;
}

function applyLegacy(heroDef: HeroDef, legacyLevel: number): { hero: SimHero; goldBonus: number; healBonus: number } {
  const hero: SimHero = {
    id: heroDef.id,
    name: heroDef.name,
    diceSet: [...heroDef.diceSet],
    skill: heroDef.skill,
    stats: { ...heroDef.stats },
    currentHp: heroDef.stats.maxHp,
    gold: 80,
  };
  let goldBonus = 0, healBonus = 0;
  for (const upg of LEGACY_UPGRADES) {
    const maxLv = upg.effects.length;
    const lv = legacyLevel === 0 ? 0 : legacyLevel === 1 ? Math.ceil(maxLv / 2) : maxLv;
    let total = 0;
    for (let i = 0; i < lv; i++) total += upg.effects[i];
    if (upg.stat === 'maxHp') hero.stats.maxHp += total;
    else if (upg.stat === 'attack') hero.stats.attack += total;
    else if (upg.stat === 'defense') hero.stats.defense += total;
    else if (upg.stat === 'gold') goldBonus = total;
    else if (upg.stat === 'healPercent') healBonus = total;
  }
  hero.currentHp = hero.stats.maxHp;
  return { hero, goldBonus, healBonus };
}

// ===== ノードタイプ生成 (mapGen.ts の pickNodeType を使用) =====
function generatePath(): NodeType[] {
  const path: NodeType[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    path.push(pickNodeType(row, MAP_ROWS));
  }
  return path;
}

// ===== AI戦略 =====
interface SimDie {
  id: number;
  face: DiceFace;
  nativeFace: DiceFace;
  assignedSlot: string | null;
}

interface SimEnemy {
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  currentIntent: EnemyIntent;
  intents: EnemyIntent[];
  blockAmount: number;
  buffed: boolean;
  stunned: boolean;
}

function canActivateSkill(dice: SimDie[], hero: SimHero, skillActivated: boolean): boolean {
  const { face, count } = hero.skill.cost;
  const available = dice.filter(d => (d.face === face || d.face === 'star') && d.assignedSlot === null);
  return available.length >= count && !skillActivated;
}

function aiAssignDice(dice: SimDie[], hero: SimHero, enemy: SimEnemy, canSkill: boolean): void {
  if (canSkill) {
    const { face, count } = hero.skill.cost;
    let consumed = 0;
    dice.forEach(d => {
      if (consumed < count && (d.face === face || d.face === 'star') && d.assignedSlot === null) {
        d.assignedSlot = 'skill';
        consumed++;
      }
    });
  }

  const unassigned = dice.filter(d => d.assignedSlot === null);
  const enemyAttacking = enemy.currentIntent === 'attack' || enemy.currentIntent === 'special';

  for (const d of unassigned) {
    const atkMult = SLOT_MULTIPLIERS['attack']?.[d.face] ?? 0;
    const defMult = SLOT_MULTIPLIERS['defense']?.[d.face] ?? 0;
    const atkValue = atkMult * hero.stats.attack;
    const defValue = defMult * hero.stats.defense;

    if (d.face === 'shield' || d.face === 'horse') {
      d.assignedSlot = enemyAttacking ? 'defense' : (atkValue > defValue ? 'attack' : 'defense');
    } else if (d.face === 'strategy') {
      d.assignedSlot = 'strategy';
    } else if (d.face === 'star') {
      const hasSwordInAttack = dice.some(dd => dd.assignedSlot === 'attack' && dd.face === 'sword');
      d.assignedSlot = (enemyAttacking && hasSwordInAttack) ? 'defense' : 'attack';
    } else {
      d.assignedSlot = 'attack';
    }
  }
}

// ===== バトル =====
function simulateBattle(hero: SimHero, enemyDef: EnemyDef, maxTurns = 30): { won: boolean; turns: number } {
  const enemy: SimEnemy = {
    currentHp: enemyDef.maxHp, maxHp: enemyDef.maxHp,
    attack: enemyDef.attack, defense: enemyDef.defense,
    currentIntent: choose(enemyDef.intents) as EnemyIntent,
    intents: enemyDef.intents,
    blockAmount: 0, buffed: false, stunned: false,
  };

  for (let turn = 1; turn <= maxTurns; turn++) {
    const dice: SimDie[] = hero.diceSet.map((face, i) => ({
      id: i, face: rollDie(face), nativeFace: face, assignedSlot: null,
    }));
    const canSkill = canActivateSkill(dice, hero, false);
    aiAssignDice(dice, hero, enemy, canSkill);

    let enemyDmg = 0, heroDmg = 0, swordMult = 1;
    let invincible = false, counterPending = false;

    if (canSkill) {
      const effect = hero.skill.effect;
      if (effect === 'buff_swords') swordMult = 1.5;
      else if (effect === 'shield_to_attack') {
        const sc = dice.filter(d => d.face === 'shield' || d.face === 'star').length;
        enemyDmg += Math.floor(hero.stats.defense * sc);
      } else if (effect === 'all_attack') {
        enemyDmg += Math.floor(hero.stats.attack * 1.5);
      } else if (effect === 'heal') {
        const healAmt = 5;
        hero.currentHp = Math.min(hero.currentHp + healAmt, hero.stats.maxHp);
      } else if (effect === 'stun_enemy') {
        enemy.stunned = true;
      } else if (effect === 'invincible_counter') {
        invincible = true; counterPending = true;
      }
    }

    // 敵防御時はダメージ計算前にblockAmountを設定
    if (!enemy.stunned && enemy.currentIntent === 'defend') {
      enemy.blockAmount = enemy.defense;
    }

    if (swordMult > 1) {
      const m = SLOT_MULTIPLIERS['attack']!;
      for (const d of dice) {
        if (d.assignedSlot !== 'attack') continue;
        const base = Math.floor(hero.stats.attack * (m[d.face] ?? 0));
        enemyDmg += Math.floor(base * (d.face === 'sword' ? swordMult : 1));
      }
    } else {
      enemyDmg += calcSlotValue(dice.map(d => ({
        ...d, locked: false, assignedSlot: d.assignedSlot as import('../src/types').ActionSlot | null,
      })), 'attack', hero.stats.attack);
    }
    enemyDmg += calcSlotValue(dice.map(d => ({
      ...d, locked: false, assignedSlot: d.assignedSlot as import('../src/types').ActionSlot | null,
    })), 'strategy', hero.stats.strategyPower);
    const block = calcSlotValue(dice.map(d => ({
      ...d, locked: false, assignedSlot: d.assignedSlot as import('../src/types').ActionSlot | null,
    })), 'defense', hero.stats.defense);

    const actualDmg = Math.max(0, enemyDmg - enemy.blockAmount);
    enemy.currentHp = clamp(enemy.currentHp - actualDmg, 0, enemy.maxHp);
    enemy.blockAmount = 0;

    if (enemy.currentHp <= 0) return { won: true, turns: turn };

    if (!enemy.stunned) {
      const intent = enemy.currentIntent;
      if (intent === 'attack' || intent === 'special') {
        const raw = intent === 'special' ? Math.floor(enemy.attack * 2) : (enemy.buffed ? Math.floor(enemy.attack * 1.5) : enemy.attack);
        if (invincible) {
          if (counterPending) {
            const cd = Math.floor(hero.stats.attack * 2);
            enemy.currentHp = clamp(enemy.currentHp - cd, 0, enemy.maxHp);
          }
        } else {
          heroDmg = Math.max(0, raw - block);
        }
        if (enemy.buffed) enemy.buffed = false;
      } else if (intent === 'defend') {
        // blockAmount は計算前に設定済み
      } else if (intent === 'buff') {
        enemy.buffed = true;
      }
    } else {
      enemy.stunned = false;
    }

    hero.currentHp -= heroDmg;
    if (hero.currentHp <= 0) return { won: false, turns: turn };
    if (enemy.currentHp <= 0) return { won: true, turns: turn };

    enemy.currentIntent = choose(enemy.intents) as EnemyIntent;
  }
  return { won: false, turns: maxTurns };
}

// ===== アイテム効果適用 =====
interface SimEffect {
  type: string;
  face?: DiceFace;
  stat?: string;
  amount?: number;
}

function applyEffect(hero: SimHero, effect: SimEffect): void {
  if (effect.type === 'add_dice' && effect.face) {
    hero.diceSet = [...hero.diceSet, effect.face];
  } else if (effect.type === 'upgrade_stat') {
    if (effect.stat === 'maxHp' && effect.amount) {
      hero.stats.maxHp += effect.amount;
      hero.currentHp += effect.amount;
    } else if (effect.stat === 'attack' && effect.amount) {
      hero.stats.attack += effect.amount;
    } else if (effect.stat === 'defense' && effect.amount) {
      hero.stats.defense += effect.amount;
    } else if (effect.stat === 'strategyPower' && effect.amount) {
      hero.stats.strategyPower += effect.amount;
    }
  }
}

// ===== AI: 商人で何を買うか =====
function aiBuyItems(hero: SimHero, items: typeof MERCHANT_ITEMS): void {
  const sorted = [...items].sort((a, b) => b.cost - a.cost);
  for (const item of sorted) {
    if (hero.gold >= item.cost) {
      hero.gold -= item.cost;
      applyEffect(hero, item.effect);
    }
  }
}

// ===== AI: 軍師カードの選択 =====
function aiPickAdvisor(hero: SimHero, cards: typeof ADVISOR_CARDS): (typeof ADVISOR_CARDS)[number] {
  void hero;
  const priority: Record<string, number> = { attack: 10, strategyPower: 9, star: 9, sword: 8, defense: 5, maxHp: 3, shield: 4, strategy: 6, horse: 4, arrow: 7 };
  let best = cards[0];
  let bestScore = -1;
  for (const card of cards) {
    let score = 0;
    if (card.effect.type === 'upgrade_stat') score = priority[card.effect.stat] ?? 0;
    else if (card.effect.type === 'add_dice') score = priority[card.effect.face] ?? 0;
    if (score > bestScore) { bestScore = score; best = card; }
  }
  return best;
}

// ===== AI: イベント選択 =====
function aiPickEvent(hero: SimHero, event: (typeof GAME_EVENTS)[number]): (typeof GAME_EVENTS)[number]['options'][number] {
  const opt = event.options;
  if (hero.currentHp > hero.stats.maxHp * 0.6) return opt[0];
  return opt.length > 1 ? opt[1] : opt[0];
}

// ===== フルゲームシミュレーション =====
interface ChapterLog {
  chapter: number;
  cleared: boolean;
  diedAt: string | null;
  hpBefore: number;
  hpAfter: number;
  stats: { maxHp: number; attack: number; defense: number };
  dice: number;
}

function simulateFullGame(heroDef: HeroDef): { cleared: boolean; diedAtChapter: number | null; chapterLog: ChapterLog[] } {
  const hero: SimHero = {
    id: heroDef.id,
    name: heroDef.name,
    diceSet: [...heroDef.diceSet],
    skill: heroDef.skill,
    stats: { ...heroDef.stats },
    currentHp: heroDef.stats.maxHp,
    gold: 80,
  };

  const chapterLog: ChapterLog[] = [];

  for (let chapter = 1; chapter <= 5; chapter++) {
    const path = generatePath();
    const chapterEnemies = ENEMY_DEFS.filter(e => e.chapter === chapter && !e.isBoss);
    const eliteEnemies = chapterEnemies.filter(e => e.maxHp === Math.max(...chapterEnemies.map(ce => ce.maxHp)));
    const boss = ENEMY_DEFS.find(e => e.chapter === chapter && e.isBoss);

    const hpBefore = hero.currentHp;

    for (const nodeType of path) {
      if (hero.currentHp <= 0) break;

      if (nodeType === 'battle') {
        const enemy = choose(chapterEnemies);
        const result = simulateBattle(hero, enemy);
        if (!result.won) {
          chapterLog.push({ chapter, cleared: false, diedAt: nodeType, hpBefore, hpAfter: 0, stats: { ...hero.stats }, dice: hero.diceSet.length });
          return { cleared: false, diedAtChapter: chapter, chapterLog };
        }
        hero.gold += getGoldReward('battle', chapter);
      } else if (nodeType === 'elite') {
        const enemy = eliteEnemies.length > 0 ? choose(eliteEnemies) : choose(chapterEnemies);
        const result = simulateBattle(hero, enemy);
        if (!result.won) {
          chapterLog.push({ chapter, cleared: false, diedAt: 'elite', hpBefore, hpAfter: 0, stats: { ...hero.stats }, dice: hero.diceSet.length });
          return { cleared: false, diedAtChapter: chapter, chapterLog };
        }
        hero.gold += getGoldReward('elite', chapter);
      } else if (nodeType === 'boss') {
        if (!boss) continue;
        const result = simulateBattle(hero, boss);
        chapterLog.push({
          chapter, cleared: result.won, diedAt: result.won ? null : 'boss',
          hpBefore, hpAfter: hero.currentHp, stats: { ...hero.stats }, dice: hero.diceSet.length,
        });
        if (!result.won) return { cleared: false, diedAtChapter: chapter, chapterLog };
        hero.gold += getGoldReward('boss', chapter);
      } else if (nodeType === 'advisor') {
        const cards = shuffle([...ADVISOR_CARDS]).slice(0, 3);
        const pick = aiPickAdvisor(hero, cards);
        applyEffect(hero, pick.effect);
      } else if (nodeType === 'merchant') {
        const items = shuffle([...MERCHANT_ITEMS]).slice(0, 3);
        aiBuyItems(hero, items);
      } else if (nodeType === 'rest') {
        hero.currentHp = clamp(hero.currentHp + Math.floor(hero.stats.maxHp * 0.3), 0, hero.stats.maxHp);
      } else if (nodeType === 'event') {
        const event = choose(GAME_EVENTS);
        const opt = aiPickEvent(hero, event);
        if (opt.effect === 'hp_up') hero.currentHp = clamp(hero.currentHp + opt.value, 0, hero.stats.maxHp);
        else if (opt.effect === 'hp_down') hero.currentHp = Math.max(1, hero.currentHp - opt.value);
        else if (opt.effect === 'gold_up') hero.gold += opt.value;
        else if (opt.effect === 'gold_down') hero.gold = Math.max(0, hero.gold - opt.value);
      }
    }
  }

  return { cleared: true, diedAtChapter: null, chapterLog };
}

// ===== メイン =====
console.log(`\n=== フルゲームシミュレーション (${TRIALS}回/英雄) ===\n`);

console.log('【全5章クリア率】');
console.log('─'.repeat(70));
console.log('英雄'.padEnd(10) + 'クリア率'.padStart(10) + '  Ch1死亡  Ch2死亡  Ch3死亡  Ch4死亡  Ch5死亡');
console.log('─'.repeat(70));

for (const heroDef of HERO_DEFS) {
  let clears = 0;
  const deathByChapter = [0, 0, 0, 0, 0];
  for (let i = 0; i < TRIALS; i++) {
    const result = simulateFullGame(heroDef);
    if (result.cleared) clears++;
    else if (result.diedAtChapter) deathByChapter[result.diedAtChapter - 1]++;
  }
  const clearRate = (clears / TRIALS * 100).toFixed(1) + '%';
  const deaths = deathByChapter.map(d => ((d / TRIALS * 100).toFixed(1) + '%').padStart(8));
  console.log(heroDef.name.padEnd(10) + clearRate.padStart(10) + '  ' + deaths.join(''));
}

console.log('');

// --- 章別クリア率（その章のボスに到達して勝てた割合） ---
console.log('【章別ボス撃破率（到達者のうち）】');
console.log('─'.repeat(60));
console.log('英雄'.padEnd(10) + '  Ch1      Ch2      Ch3      Ch4      Ch5');
console.log('─'.repeat(60));

for (const heroDef of HERO_DEFS) {
  const bossReach = [0, 0, 0, 0, 0];
  const bossWin = [0, 0, 0, 0, 0];

  for (let i = 0; i < TRIALS; i++) {
    const result = simulateFullGame(heroDef);
    for (const log of result.chapterLog) {
      bossReach[log.chapter - 1]++;
      if (log.cleared) bossWin[log.chapter - 1]++;
    }
  }

  let row = heroDef.name.padEnd(10) + '  ';
  for (let c = 0; c < 5; c++) {
    const rate = bossReach[c] > 0 ? (bossWin[c] / bossReach[c] * 100).toFixed(1) + '%' : '-';
    row += rate.padStart(8);
  }
  console.log(row);
}

console.log('');

// --- 成長後のステータス（クリア時の平均） ---
console.log('【クリア時の平均ステータス】');
console.log('─'.repeat(60));
console.log('英雄'.padEnd(10) + '    攻撃      防御    MaxHP  ダイス数    残HP');
console.log('─'.repeat(60));

for (const heroDef of HERO_DEFS) {
  let count = 0, totalAtk = 0, totalDef = 0, totalHp = 0, totalDice = 0, totalRemain = 0;

  for (let i = 0; i < TRIALS; i++) {
    const hero: SimHero = {
      id: heroDef.id, name: heroDef.name,
      diceSet: [...heroDef.diceSet], skill: heroDef.skill,
      stats: { ...heroDef.stats }, currentHp: heroDef.stats.maxHp, gold: 80,
    };

    let cleared = true;
    for (let chapter = 1; chapter <= 5; chapter++) {
      const path = generatePath();
      const chapterEnemies = ENEMY_DEFS.filter(e => e.chapter === chapter && !e.isBoss);
      const eliteEnemies = chapterEnemies.filter(e => e.maxHp === Math.max(...chapterEnemies.map(ce => ce.maxHp)));
      const boss = ENEMY_DEFS.find(e => e.chapter === chapter && e.isBoss);

      for (const nodeType of path) {
        if (hero.currentHp <= 0) { cleared = false; break; }
        if (nodeType === 'battle' || nodeType === 'elite') {
          const pool = nodeType === 'elite' && eliteEnemies.length > 0 ? eliteEnemies : chapterEnemies;
          const r = simulateBattle(hero, choose(pool));
          if (!r.won) { cleared = false; break; }
          hero.gold += getGoldReward(nodeType, chapter);
        } else if (nodeType === 'boss') {
          if (!boss) continue;
          const r = simulateBattle(hero, boss);
          if (!r.won) { cleared = false; break; }
          hero.gold += getGoldReward('boss', chapter);
        } else if (nodeType === 'advisor') {
          const cards = shuffle([...ADVISOR_CARDS]).slice(0, 3);
          applyEffect(hero, aiPickAdvisor(hero, cards).effect);
        } else if (nodeType === 'merchant') {
          aiBuyItems(hero, shuffle([...MERCHANT_ITEMS]).slice(0, 3));
        } else if (nodeType === 'rest') {
          hero.currentHp = clamp(hero.currentHp + Math.floor(hero.stats.maxHp * 0.3), 0, hero.stats.maxHp);
        } else if (nodeType === 'event') {
          const ev = choose(GAME_EVENTS);
          const opt = aiPickEvent(hero, ev);
          if (opt.effect === 'hp_up') hero.currentHp = clamp(hero.currentHp + opt.value, 0, hero.stats.maxHp);
          else if (opt.effect === 'hp_down') hero.currentHp = Math.max(1, hero.currentHp - opt.value);
          else if (opt.effect === 'gold_up') hero.gold += opt.value;
          else if (opt.effect === 'gold_down') hero.gold = Math.max(0, hero.gold - opt.value);
        }
      }
      if (!cleared) break;
    }
    if (cleared) {
      count++;
      totalAtk += hero.stats.attack;
      totalDef += hero.stats.defense;
      totalHp += hero.stats.maxHp;
      totalDice += hero.diceSet.length;
      totalRemain += hero.currentHp;
    }
  }

  if (count > 0) {
    console.log(
      heroDef.name.padEnd(10) +
      (totalAtk / count).toFixed(1).padStart(8) +
      (totalDef / count).toFixed(1).padStart(10) +
      (totalHp / count).toFixed(0).padStart(8) +
      (totalDice / count).toFixed(1).padStart(10) +
      (totalRemain / count).toFixed(0).padStart(8)
    );
  } else {
    console.log(heroDef.name.padEnd(10) + '  (クリアなし)');
  }
}

console.log('');

// ===== レガシーレベル別シミュレーション =====
const LEGACY_LABELS = ['Lv0 (新規)', 'Lv中間', 'Lv MAX'];
console.log('=== レガシーレベル別クリア率 ===\n');
console.log('─'.repeat(70));
console.log('レガシー'.padEnd(12) + HERO_DEFS.map(h => h.name).map(s => s.padStart(12)).join(''));
console.log('─'.repeat(70));

for (let legLv = 0; legLv <= 2; legLv++) {
  let row = LEGACY_LABELS[legLv].padEnd(12);
  for (const heroDef of HERO_DEFS) {
    const { hero: boostedHero, goldBonus, healBonus } = applyLegacy(heroDef, legLv);
    let clears = 0;
    for (let i = 0; i < TRIALS; i++) {
      const hero: SimHero = {
        ...boostedHero, diceSet: [...boostedHero.diceSet], stats: { ...boostedHero.stats },
        currentHp: boostedHero.stats.maxHp, gold: 80 + goldBonus,
      };
      let cleared = true;
      for (let chapter = 1; chapter <= 5; chapter++) {
        const path = generatePath();
        const chapterEnemies = ENEMY_DEFS.filter(e => e.chapter === chapter && !e.isBoss);
        const eliteEnemies = chapterEnemies.filter(e => e.maxHp === Math.max(...chapterEnemies.map(ce => ce.maxHp)));
        const boss = ENEMY_DEFS.find(e => e.chapter === chapter && e.isBoss);
        for (const nodeType of path) {
          if (hero.currentHp <= 0) { cleared = false; break; }
          if (nodeType === 'battle' || nodeType === 'elite') {
            const pool = nodeType === 'elite' && eliteEnemies.length > 0 ? eliteEnemies : chapterEnemies;
            const r = simulateBattle(hero, choose(pool));
            if (!r.won) { cleared = false; break; }
            hero.gold += getGoldReward(nodeType, chapter);
          } else if (nodeType === 'boss') {
            if (!boss) continue;
            const r = simulateBattle(hero, boss);
            if (!r.won) { cleared = false; break; }
            hero.gold += getGoldReward('boss', chapter);
          } else if (nodeType === 'advisor') {
            applyEffect(hero, aiPickAdvisor(hero, shuffle([...ADVISOR_CARDS]).slice(0, 3)).effect);
          } else if (nodeType === 'merchant') {
            aiBuyItems(hero, shuffle([...MERCHANT_ITEMS]).slice(0, 3));
          } else if (nodeType === 'rest') {
            const pct = (30 + healBonus) / 100;
            hero.currentHp = clamp(hero.currentHp + Math.floor(hero.stats.maxHp * pct), 0, hero.stats.maxHp);
          } else if (nodeType === 'event') {
            const ev = choose(GAME_EVENTS);
            const opt = aiPickEvent(hero, ev);
            if (opt.effect === 'hp_up') hero.currentHp = clamp(hero.currentHp + opt.value, 0, hero.stats.maxHp);
            else if (opt.effect === 'hp_down') hero.currentHp = Math.max(1, hero.currentHp - opt.value);
            else if (opt.effect === 'gold_up') hero.gold += opt.value;
            else if (opt.effect === 'gold_down') hero.gold = Math.max(0, hero.gold - opt.value);
          }
        }
        if (!cleared) break;
      }
      if (cleared) clears++;
    }
    row += ((clears / TRIALS * 100).toFixed(1) + '%').padStart(12);
  }
  console.log(row);
}

console.log('\n(全5章クリア率)\n');
