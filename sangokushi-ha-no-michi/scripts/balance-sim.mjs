/**
 * フルゲームシミュレーター（道中の成長込み）
 * usage: node scripts/balance-sim.mjs [回数]
 *
 * 全5章をマップ生成→道中ノード→ボス戦の流れで通しシミュレーション。
 * 軍師カード・商人・休息・イベントによる成長を反映。
 */

const TRIALS = parseInt(process.argv[2] || '500', 10);

// ===== ユーティリティ =====
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function choose(arr) { return arr[randomInt(0, arr.length - 1)]; }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const DICE_FACES = ['sword', 'shield', 'strategy', 'horse', 'arrow', 'star'];
function rollDie() { return choose(DICE_FACES); }

// ===== 倍率テーブル =====
const SLOT_MULTIPLIERS = {
  attack:   { sword: 1.0, star: 1.0, arrow: 1.2, horse: 0.5, strategy: 0.3, shield: 0.2 },
  defense:  { shield: 1.0, star: 1.0, horse: 0.7, sword: 0.3, arrow: 0.3, strategy: 0.2 },
  strategy: { strategy: 0.6, star: 0.6, sword: 0.2, arrow: 0.2 },
};

function calcSlotValue(dice, slot, baseStat) {
  const multipliers = SLOT_MULTIPLIERS[slot];
  if (!multipliers) return 0;
  let total = 0;
  for (const d of dice) {
    if (d.assignedSlot !== slot) continue;
    total += Math.floor(baseStat * (multipliers[d.face] ?? 0));
  }
  return total;
}

// ===== 英雄データ =====
const HERO_DEFS = [
  { id: 'guan_yu', name: '関羽', diceSet: ['sword','sword','sword','star'],
    skill: { cost: { face: 'sword', count: 2 }, effect: 'all_attack' },
    stats: { maxHp: 100, attack: 12, defense: 5 } },
  { id: 'zhang_fei', name: '張飛', diceSet: ['sword','sword','strategy','sword'],
    skill: { cost: { face: 'strategy', count: 1 }, effect: 'buff_swords' },
    stats: { maxHp: 110, attack: 10, defense: 6 } },
  { id: 'zhao_yun', name: '趙雲', diceSet: ['sword','horse','horse','shield'],
    skill: { cost: { face: 'horse', count: 2 }, effect: 'invincible_counter' },
    stats: { maxHp: 95, attack: 10, defense: 8 } },
  { id: 'zhuge_liang', name: '諸葛亮', diceSet: ['strategy','strategy','strategy','arrow'],
    skill: { cost: { face: 'strategy', count: 3 }, effect: 'stun_enemy' },
    stats: { maxHp: 80, attack: 8, defense: 4 } },
  { id: 'liu_bei', name: '劉備', diceSet: ['shield','shield','sword','strategy'],
    skill: { cost: { face: 'shield', count: 1 }, effect: 'shield_to_attack' },
    stats: { maxHp: 95, attack: 8, defense: 10 } },
];

// ===== 全敵データ =====
const ALL_ENEMIES = [
  // Ch1
  { chapter: 1, isBoss: false, name: '黄巾賊兵', maxHp: 35, attack: 6, defense: 2, intents: ['attack','attack','defend'] },
  { chapter: 1, isBoss: false, name: '裴元紹', maxHp: 45, attack: 8, defense: 3, intents: ['attack','buff','attack','defend'] },
  { chapter: 1, isBoss: false, name: '程遠志', maxHp: 50, attack: 9, defense: 3, intents: ['attack','special','defend','attack'] },
  { chapter: 1, isBoss: false, name: '張宝', maxHp: 65, attack: 10, defense: 5, intents: ['buff','special','attack','defend'] },
  { chapter: 1, isBoss: false, name: '張梁', maxHp: 70, attack: 10, defense: 4, intents: ['attack','attack','buff','special'] },
  { chapter: 1, isElite: true, isBoss: false, name: '張曼成', maxHp: 80, attack: 11, defense: 5, intents: ['buff','attack','attack','special','defend'] },
  { chapter: 1, isBoss: true, name: '張角', maxHp: 120, attack: 12, defense: 6, intents: ['buff','special','attack','special','defend'] },
  // Ch2
  { chapter: 2, isBoss: false, name: '西涼兵', maxHp: 45, attack: 8, defense: 4, intents: ['attack','attack','defend'] },
  { chapter: 2, isBoss: false, name: '李傕', maxHp: 60, attack: 10, defense: 5, intents: ['attack','buff','attack','defend'] },
  { chapter: 2, isBoss: false, name: '郭汜', maxHp: 60, attack: 11, defense: 4, intents: ['attack','attack','special','defend'] },
  { chapter: 2, isBoss: false, name: '華雄', maxHp: 80, attack: 13, defense: 6, intents: ['attack','special','attack','defend'] },
  { chapter: 2, isElite: true, isBoss: false, name: '呂布（若き飛将）', maxHp: 120, attack: 16, defense: 8, intents: ['attack','attack','special','buff','defend'] },
  { chapter: 2, isBoss: true, name: '董卓', maxHp: 160, attack: 16, defense: 10, intents: ['attack','buff','attack','special','defend'] },
  // Ch3
  { chapter: 3, isBoss: false, name: '徐州守備兵', maxHp: 50, attack: 10, defense: 5, intents: ['attack','defend','attack'] },
  { chapter: 3, isBoss: false, name: '陳宮', maxHp: 70, attack: 11, defense: 6, intents: ['buff','attack','special','defend'] },
  { chapter: 3, isBoss: false, name: '高順', maxHp: 80, attack: 13, defense: 7, intents: ['attack','attack','defend','special'] },
  { chapter: 3, isElite: true, isBoss: false, name: '張遼', maxHp: 100, attack: 15, defense: 8, intents: ['attack','buff','attack','special','defend'] },
  { chapter: 3, isBoss: true, name: '呂布', maxHp: 200, attack: 20, defense: 12, intents: ['attack','attack','special','buff','defend'] },
  // Ch4
  { chapter: 4, isBoss: false, name: '袁術軍兵', maxHp: 55, attack: 10, defense: 6, intents: ['attack','attack','defend'] },
  { chapter: 4, isBoss: false, name: '紀霊', maxHp: 75, attack: 13, defense: 7, intents: ['attack','special','defend','attack'] },
  { chapter: 4, isBoss: false, name: '楊奉', maxHp: 70, attack: 12, defense: 6, intents: ['attack','buff','attack','defend'] },
  { chapter: 4, isElite: true, isBoss: false, name: '紀霊（大将）', maxHp: 120, attack: 16, defense: 10, intents: ['attack','buff','special','attack','defend'] },
  { chapter: 4, isBoss: true, name: '袁術', maxHp: 220, attack: 18, defense: 14, intents: ['buff','attack','special','attack','defend'] },
  // Ch5
  { chapter: 5, isBoss: false, name: '曹操軍兵', maxHp: 60, attack: 12, defense: 6, intents: ['attack','defend','attack','buff'] },
  { chapter: 5, isBoss: false, name: '徐晃', maxHp: 80, attack: 14, defense: 8, intents: ['attack','attack','special','defend'] },
  { chapter: 5, isBoss: false, name: '張遼', maxHp: 90, attack: 15, defense: 9, intents: ['attack','buff','attack','special','defend'] },
  { chapter: 5, isElite: true, isBoss: false, name: '夏侯惇', maxHp: 130, attack: 18, defense: 10, intents: ['attack','attack','special','buff','defend'] },
  { chapter: 5, isElite: true, isBoss: false, name: '司馬懿', maxHp: 110, attack: 16, defense: 12, intents: ['buff','special','defend','attack','special'] },
  { chapter: 5, isBoss: true, name: '曹操', maxHp: 250, attack: 22, defense: 16, intents: ['buff','attack','attack','special','defend','attack'] },
];

// ===== 軍師カード =====
const ADVISOR_CARDS = [
  { name: '刀槍の鍛錬', effect: { type: 'add_dice', face: 'sword' } },
  { name: '鎧の強化', effect: { type: 'add_dice', face: 'shield' } },
  { name: '兵法研究', effect: { type: 'add_dice', face: 'strategy' } },
  { name: '良馬入手', effect: { type: 'add_dice', face: 'horse' } },
  { name: '弓術修練', effect: { type: 'add_dice', face: 'arrow' } },
  { name: '天の啓示', effect: { type: 'add_dice', face: 'star' } },
  { name: '武芸鍛錬', effect: { type: 'upgrade_stat', stat: 'attack', amount: 3 } },
  { name: '守備固め', effect: { type: 'upgrade_stat', stat: 'defense', amount: 3 } },
  { name: '養生の術', effect: { type: 'upgrade_stat', stat: 'maxHp', amount: 20 } },
];

// ===== 商人アイテム =====
const MERCHANT_ITEMS = [
  { name: '宝刀', cost: 50, effect: { type: 'add_dice', face: 'sword' } },
  { name: '仙薬', cost: 60, effect: { type: 'upgrade_stat', stat: 'maxHp', amount: 20 } },
  { name: '名剣', cost: 80, effect: { type: 'upgrade_stat', stat: 'attack', amount: 5 } },
  { name: '名鎧', cost: 80, effect: { type: 'upgrade_stat', stat: 'defense', amount: 5 } },
  { name: '天書', cost: 100, effect: { type: 'add_dice', face: 'star' } },
];

// ===== イベント =====
const EVENTS = [
  { options: [{ effect: 'hp_down', value: 10 }, { effect: 'gold_down', value: 20 }] },
  { options: [{ effect: 'gold_down', value: 15 }, { effect: 'nothing', value: 0 }] },
  { options: [{ effect: 'hp_up', value: 20 }, { effect: 'hp_down', value: 15 }] },
  { options: [{ effect: 'gold_up', value: 50 }, { effect: 'nothing', value: 0 }] },
  { options: [{ effect: 'gold_down', value: 20 }, { effect: 'nothing', value: 0 }] },
  { options: [{ effect: 'hp_down', value: 5 }, { effect: 'gold_up', value: 30 }] },
  { options: [{ effect: 'hp_down', value: 15 }, { effect: 'nothing', value: 0 }] },
  { options: [{ effect: 'hp_up', value: 30 }, { effect: 'gold_up', value: 10 }] },
];

// ===== ノードタイプ生成 =====
function pickNodeType(row, totalRows) {
  if (row === totalRows - 1) return 'boss';
  if (row === 0) return 'battle';
  const roll = randomInt(1, 100);
  if (row === Math.floor(totalRows / 2)) {
    if (roll <= 30) return 'battle';
    if (roll <= 45) return 'elite';
    if (roll <= 60) return 'advisor';
    if (roll <= 75) return 'merchant';
    if (roll <= 90) return 'rest';
    return 'event';
  }
  if (roll <= 35) return 'battle';
  if (roll <= 50) return 'elite';
  if (roll <= 62) return 'advisor';
  if (roll <= 74) return 'merchant';
  if (roll <= 86) return 'rest';
  return 'event';
}

function generatePath() {
  const ROWS = 6;
  const path = [];
  for (let row = 0; row < ROWS; row++) {
    path.push(pickNodeType(row, ROWS));
  }
  return path;
}

// ===== AI戦略 =====
function canActivateSkill(dice, hero, skillActivated) {
  const { face, count } = hero.skill.cost;
  const available = dice.filter(d => (d.face === face || d.face === 'star') && d.assignedSlot === null);
  return available.length >= count && !skillActivated;
}

function aiAssignDice(dice, hero, enemy, canSkill) {
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
    const atkValue = (SLOT_MULTIPLIERS.attack[d.face] ?? 0) * hero.stats.attack;
    const defValue = (SLOT_MULTIPLIERS.defense[d.face] ?? 0) * hero.stats.defense;

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
function simulateBattle(hero, enemyDef, maxTurns = 30) {
  const enemy = {
    currentHp: enemyDef.maxHp, maxHp: enemyDef.maxHp,
    attack: enemyDef.attack, defense: enemyDef.defense,
    currentIntent: choose(enemyDef.intents), intents: enemyDef.intents,
    blockAmount: 0, buffed: false, stunned: false,
  };

  for (let turn = 1; turn <= maxTurns; turn++) {
    const dice = hero.diceSet.map((_, i) => ({ id: i, face: rollDie(), assignedSlot: null }));
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
      } else if (effect === 'stun_enemy') {
        enemy.stunned = true;
      } else if (effect === 'invincible_counter') {
        invincible = true; counterPending = true;
      }
    }

    if (swordMult > 1) {
      const m = SLOT_MULTIPLIERS.attack;
      for (const d of dice) {
        if (d.assignedSlot !== 'attack') continue;
        const base = Math.floor(hero.stats.attack * (m[d.face] ?? 0));
        enemyDmg += Math.floor(base * (d.face === 'sword' ? swordMult : 1));
      }
    } else {
      enemyDmg += calcSlotValue(dice, 'attack', hero.stats.attack);
    }
    enemyDmg += calcSlotValue(dice, 'strategy', hero.stats.attack);
    const block = calcSlotValue(dice, 'defense', hero.stats.defense);

    const actualDmg = Math.max(0, enemyDmg - enemy.blockAmount);
    enemy.currentHp = clamp(enemy.currentHp - actualDmg, 0, enemy.maxHp);
    enemy.blockAmount = 0;

    if (enemy.currentHp <= 0) return { won: true, turns: turn, heroDmg: 0 };

    if (!enemy.stunned) {
      const intent = enemy.currentIntent;
      if (intent === 'attack' || intent === 'special') {
        const raw = intent === 'special' ? enemy.attack * 2 : (enemy.buffed ? Math.floor(enemy.attack * 1.5) : enemy.attack);
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
        enemy.blockAmount = enemy.defense;
      } else if (intent === 'buff') {
        enemy.buffed = true;
      }
    } else {
      enemy.stunned = false;
    }

    hero.currentHp -= heroDmg;
    if (hero.currentHp <= 0) return { won: false, turns: turn, heroDmg };
    if (enemy.currentHp <= 0) return { won: true, turns: turn, heroDmg };

    enemy.currentIntent = choose(enemy.intents);
  }
  return { won: false, turns: maxTurns, heroDmg: 0 };
}

// ===== アイテム効果適用 =====
function applyEffect(hero, effect) {
  if (effect.type === 'add_dice') {
    hero.diceSet = [...hero.diceSet, effect.face];
  } else if (effect.type === 'upgrade_stat') {
    if (effect.stat === 'maxHp') {
      hero.stats.maxHp += effect.amount;
      hero.currentHp += effect.amount;
    } else if (effect.stat === 'attack') {
      hero.stats.attack += effect.amount;
    } else if (effect.stat === 'defense') {
      hero.stats.defense += effect.amount;
    }
  }
}

// ===== AI: 商人で何を買うか =====
function aiBuyItems(hero, items) {
  // 最も高価なアイテムから購入（攻撃力優先）
  const sorted = [...items].sort((a, b) => b.cost - a.cost);
  for (const item of sorted) {
    if (hero.gold >= item.cost) {
      hero.gold -= item.cost;
      applyEffect(hero, item.effect);
    }
  }
}

// ===== AI: 軍師カードの選択 =====
function aiPickAdvisor(hero, cards) {
  // 攻撃力アップ > ダイス追加(星>剣) > 防御 > HP
  const priority = { attack: 10, star: 9, sword: 8, defense: 5, maxHp: 3, shield: 4, strategy: 6, horse: 4, arrow: 7 };
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
function aiPickEvent(hero, event) {
  // HP余裕があればリスクを取る、なければ安全策
  const opt = event.options;
  if (hero.currentHp > hero.stats.maxHp * 0.6) return opt[0];
  return opt.length > 1 ? opt[1] : opt[0];
}

function getGoldReward(nodeType, chapter) {
  const base = nodeType === 'elite' ? 40 : nodeType === 'boss' ? 100 : 20;
  return base + randomInt(0, chapter * 10);
}

// ===== フルゲームシミュレーション =====
function simulateFullGame(heroDef) {
  const hero = {
    ...heroDef,
    diceSet: [...heroDef.diceSet],
    stats: { ...heroDef.stats },
    currentHp: heroDef.stats.maxHp,
    gold: 100,
  };

  const chapterLog = [];

  for (let chapter = 1; chapter <= 5; chapter++) {
    const path = generatePath();
    const chapterEnemies = ALL_ENEMIES.filter(e => e.chapter === chapter && !e.isBoss);
    const eliteEnemies = ALL_ENEMIES.filter(e => e.chapter === chapter && e.isElite);
    const boss = ALL_ENEMIES.find(e => e.chapter === chapter && e.isBoss);

    const hpBefore = hero.currentHp;

    for (const nodeType of path) {
      if (hero.currentHp <= 0) break;

      if (nodeType === 'battle') {
        const enemy = choose(chapterEnemies.filter(e => !e.isElite));
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
        const result = simulateBattle(hero, boss);
        chapterLog.push({
          chapter, cleared: result.won, diedAt: result.won ? null : 'boss',
          hpBefore, hpAfter: hero.currentHp, stats: { ...hero.stats }, dice: hero.diceSet.length,
        });
        if (!result.won) return { cleared: false, diedAtChapter: chapter, chapterLog };
        hero.gold += getGoldReward('boss', chapter);
      } else if (nodeType === 'advisor') {
        const cards = shuffle(ADVISOR_CARDS).slice(0, 3);
        const pick = aiPickAdvisor(hero, cards);
        applyEffect(hero, pick.effect);
      } else if (nodeType === 'merchant') {
        const items = shuffle(MERCHANT_ITEMS).slice(0, 3);
        aiBuyItems(hero, items);
      } else if (nodeType === 'rest') {
        hero.currentHp = clamp(hero.currentHp + Math.floor(hero.stats.maxHp * 0.3), 0, hero.stats.maxHp);
      } else if (nodeType === 'event') {
        const event = choose(EVENTS);
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
    else deathByChapter[result.diedAtChapter - 1]++;
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
    const hero = {
      ...heroDef, diceSet: [...heroDef.diceSet], stats: { ...heroDef.stats },
      currentHp: heroDef.stats.maxHp, gold: 100,
    };

    let cleared = true;
    for (let chapter = 1; chapter <= 5; chapter++) {
      const path = generatePath();
      const chapterEnemies = ALL_ENEMIES.filter(e => e.chapter === chapter && !e.isBoss);
      const eliteEnemies = ALL_ENEMIES.filter(e => e.chapter === chapter && e.isElite);
      const boss = ALL_ENEMIES.find(e => e.chapter === chapter && e.isBoss);

      for (const nodeType of path) {
        if (hero.currentHp <= 0) { cleared = false; break; }
        if (nodeType === 'battle' || nodeType === 'elite') {
          const pool = nodeType === 'elite' && eliteEnemies.length > 0 ? eliteEnemies : chapterEnemies.filter(e => !e.isElite);
          const r = simulateBattle(hero, choose(pool));
          if (!r.won) { cleared = false; break; }
          hero.gold += getGoldReward(nodeType, chapter);
        } else if (nodeType === 'boss') {
          const r = simulateBattle(hero, boss);
          if (!r.won) { cleared = false; break; }
          hero.gold += getGoldReward('boss', chapter);
        } else if (nodeType === 'advisor') {
          const cards = shuffle(ADVISOR_CARDS).slice(0, 3);
          applyEffect(hero, aiPickAdvisor(hero, cards).effect);
        } else if (nodeType === 'merchant') {
          aiBuyItems(hero, shuffle(MERCHANT_ITEMS).slice(0, 3));
        } else if (nodeType === 'rest') {
          hero.currentHp = clamp(hero.currentHp + Math.floor(hero.stats.maxHp * 0.3), 0, hero.stats.maxHp);
        } else if (nodeType === 'event') {
          const ev = choose(EVENTS);
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
