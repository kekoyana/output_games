import type { BattleState, Die, DiceFace, ActionSlot, Hero, EnemyDef, Enemy } from './types';
import { choose, clamp, randomInt } from './utils';
import { rollDie } from './data';

let dieIdCounter = 0;

function makeDie(face: DiceFace): Die {
  return { id: dieIdCounter++, face, locked: false, assignedSlot: null };
}

export function createBattleState(hero: Hero, enemyDef: EnemyDef): BattleState {
  const dice = hero.diceSet.map((face) => makeDie(face));
  const enemy: Enemy = {
    ...enemyDef,
    currentHp: enemyDef.maxHp,
    currentIntent: choose(enemyDef.intents),
    blockAmount: 0,
    buffed: false,
    stunned: false,
  };

  // 初回ロール
  const rolledDice = dice.map((d) => ({ ...d, face: rollDie() as DiceFace }));

  return {
    enemy,
    dice: rolledDice,
    phase: 'assign',
    heroBlock: 0,
    skillActivated: false,
    turnCount: 1,
    message: 'ダイスをアクションに割り当てよ！',
    invincible: false,
    counterPending: false,
    log: [],
  };
}

export function rerollDice(state: BattleState): BattleState {
  const newDice = state.dice.map((d) => ({
    ...d,
    face: rollDie() as DiceFace,
    assignedSlot: null,
    locked: false,
  }));
  return {
    ...state,
    dice: newDice,
    phase: 'assign',
    heroBlock: 0,
    skillActivated: false,
    message: 'ダイスをアクションに割り当てよ！',
  };
}

export function assignDie(state: BattleState, dieId: number, slot: ActionSlot): BattleState {
  const newDice = state.dice.map((d) => {
    if (d.id === dieId) {
      const newSlot = d.assignedSlot === slot ? null : slot;
      return { ...d, assignedSlot: newSlot };
    }
    return d;
  });
  return { ...state, dice: newDice };
}

export function executeBattle(
  state: BattleState,
  hero: Hero
): { state: BattleState; heroDmg: number; enemyDmg: number } {
  let newState = { ...state, dice: [...state.dice] };
  let enemyDmg = 0;
  let heroDmg = 0;
  const log: string[] = [...state.log];

  // スター（ワイルド）は割り当てスロットに応じてそのまま機能する
  const countFace = (face: DiceFace): number =>
    newState.dice.filter((d) => d.face === face || d.face === 'star').length;

  let skillMultiplier = 1;
  if (newState.skillActivated) {
    const effect = hero.skill.effect;
    if (effect === 'buff_swords') {
      skillMultiplier = 1.5;
      log.push(`${hero.skill.name} 発動！剣ダイス強化！`);
    } else if (effect === 'shield_to_attack') {
      const shieldCount = countFace('shield');
      enemyDmg += Math.floor(hero.stats.defense * shieldCount);
      log.push(`${hero.skill.name} 発動！盾を攻撃に転用！`);
    } else if (effect === 'all_attack') {
      const bonus = Math.floor(hero.stats.attack * 1.5);
      enemyDmg += bonus;
      log.push(`${hero.skill.name} 発動！全体攻撃 +${bonus}ダメージ！`);
    } else if (effect === 'stun_enemy') {
      newState.enemy = { ...newState.enemy, stunned: true };
      log.push(`${hero.skill.name} 発動！敵を行動不能に！`);
    } else if (effect === 'invincible_counter') {
      newState.invincible = true;
      newState.counterPending = true;
      log.push(`${hero.skill.name} 発動！無敵＋反撃準備！`);
    }
  }

  // 攻撃・策略・防御の効果値を共通テーブルで計算
  const attackDmg = calcSlotValue(newState.dice, 'attack', hero.stats.attack);
  enemyDmg += Math.floor(attackDmg * skillMultiplier);
  enemyDmg += calcSlotValue(newState.dice, 'strategy', hero.stats.attack);
  const block = calcSlotValue(newState.dice, 'defense', hero.stats.defense);
  newState.heroBlock = block;

  // ダメージを敵に与える（防御差し引き）
  const actualEnemyDmg = Math.max(0, enemyDmg - newState.enemy.blockAmount);
  const newEnemyHp = clamp(newState.enemy.currentHp - actualEnemyDmg, 0, newState.enemy.maxHp);

  if (actualEnemyDmg > 0) log.push(`敵に${actualEnemyDmg}ダメージ！`);
  if (block > 0) log.push(`防御${block}を構えた！`);

  newState.enemy = {
    ...newState.enemy,
    currentHp: newEnemyHp,
    blockAmount: 0,
  };

  if (newEnemyHp <= 0) {
    return {
      state: { ...newState, phase: 'result', message: '勝利！', log },
      heroDmg: 0,
      enemyDmg: actualEnemyDmg,
    };
  }

  // 敵ターン
  if (!newState.enemy.stunned) {
    const intent = newState.enemy.currentIntent;
    if (intent === 'attack') {
      const rawDmg = newState.enemy.buffed
        ? Math.floor(newState.enemy.attack * 1.5)
        : newState.enemy.attack;
      if (newState.invincible) {
        log.push('無敵！敵の攻撃を回避！');
        if (newState.counterPending) {
          heroDmg = 0;
          const counterDmg = Math.floor(hero.stats.attack * 2);
          const newHp2 = clamp(newState.enemy.currentHp - counterDmg, 0, newState.enemy.maxHp);
          newState.enemy = { ...newState.enemy, currentHp: newHp2 };
          log.push(`反撃！${counterDmg}ダメージ！`);
        }
      } else {
        heroDmg = Math.max(0, rawDmg - block);
        if (heroDmg > 0) log.push(`敵の攻撃！${heroDmg}ダメージを受けた！`);
        else log.push('防御成功！ダメージなし！');
      }
    } else if (intent === 'defend') {
      newState.enemy = { ...newState.enemy, blockAmount: newState.enemy.defense };
      log.push(`敵が防御！${newState.enemy.defense}ブロック！`);
    } else if (intent === 'buff') {
      newState.enemy = { ...newState.enemy, buffed: true };
      log.push('敵が強化！次の攻撃が1.5倍に！');
    } else if (intent === 'special') {
      const specialDmg = Math.floor(newState.enemy.attack * 2);
      heroDmg = Math.max(0, specialDmg - block);
      if (heroDmg > 0) log.push(`敵の必殺技！${heroDmg}ダメージ！`);
    }
  } else {
    newState.enemy = { ...newState.enemy, stunned: false };
    log.push('敵は行動不能！');
  }

  // 次のインテントを設定
  const nextIntent = choose(newState.enemy.intents);
  newState.enemy = { ...newState.enemy, currentIntent: nextIntent };

  return {
    state: {
      ...newState,
      phase: 'roll',
      invincible: false,
      counterPending: false,
      skillActivated: false,
      turnCount: newState.turnCount + 1,
      message: 'ダイスをロールせよ！',
      log: log.slice(-5),
    },
    heroDmg,
    enemyDmg: actualEnemyDmg,
  };
}

/** ダイスの出目×スロットに対する効果倍率テーブル */
const SLOT_MULTIPLIERS: Record<string, Partial<Record<DiceFace, number>>> = {
  attack:   { sword: 1.0, star: 1.0, arrow: 1.2, horse: 0.5, strategy: 0.3, shield: 0.2 },
  defense:  { shield: 1.0, star: 1.0, horse: 0.7, sword: 0.3, arrow: 0.3, strategy: 0.2 },
  strategy: { strategy: 0.6, star: 0.6, sword: 0.2, arrow: 0.2 },
};

/** スロットに配置されたダイスの合計値を計算する */
export function calcSlotValue(
  dice: readonly Die[],
  slot: string,
  baseStat: number
): number {
  const multipliers = SLOT_MULTIPLIERS[slot];
  if (!multipliers) return 0;
  let total = 0;
  for (const d of dice) {
    if (d.assignedSlot !== slot) continue;
    const mult = multipliers[d.face] ?? 0;
    total += Math.floor(baseStat * mult);
  }
  return total;
}

export function canActivateSkill(state: BattleState, hero: Hero): boolean {
  const { face, count } = hero.skill.cost;
  const available = state.dice.filter(
    (d) => (d.face === face || d.face === 'star') && d.assignedSlot === null
  );
  return available.length >= count && !state.skillActivated;
}

export function activateSkill(state: BattleState, hero: Hero): BattleState {
  if (!canActivateSkill(state, hero)) return state;
  const { face, count } = hero.skill.cost;
  let consumed = 0;
  const newDice = state.dice.map((d) => {
    if (consumed < count && (d.face === face || d.face === 'star') && d.assignedSlot === null) {
      consumed++;
      return { ...d, assignedSlot: 'skill' as ActionSlot };
    }
    return d;
  });
  return { ...state, dice: newDice, skillActivated: true, message: `${hero.skill.name}を発動！` };
}

export function getEnemyForNode(
  nodeType: string,
  chapter: number
): EnemyDef {
  // ここでは data.ts の ENEMY_DEFS を直接参照しないためインポートが必要
  // game.ts 側で処理
  void nodeType;
  void chapter;
  return {
    id: 'soldier',
    name: '黄巾賊兵',
    maxHp: 40 + chapter * 10,
    attack: 7 + chapter * 2,
    defense: 2 + chapter,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'attack', 'defend'],
  };
}

export function getGoldReward(nodeType: string, chapter: number): number {
  const base = nodeType === 'elite' ? 40 : nodeType === 'boss' ? 100 : 20;
  return base + randomInt(0, chapter * 10);
}
