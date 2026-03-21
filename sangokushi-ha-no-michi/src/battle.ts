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

  const assignedDice = newState.dice.filter((d) => d.assignedSlot !== null);
  const attackDice = assignedDice.filter((d) => d.assignedSlot === 'attack');
  const defenseDice = assignedDice.filter((d) => d.assignedSlot === 'defense');
  const strategyDice = assignedDice.filter((d) => d.assignedSlot === 'strategy');

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

  // 攻撃処理 — 出目によって効果が変わる
  for (const d of attackDice) {
    let dmg = 0;
    if (d.face === 'sword' || d.face === 'star') {
      // 剣/星: フルダメージ
      dmg = hero.stats.attack;
    } else if (d.face === 'arrow') {
      // 弓: 敵防御を無視する貫通攻撃（後で防御差し引きされないようフラグ管理が面倒なので高倍率に）
      dmg = Math.floor(hero.stats.attack * 1.2);
    } else if (d.face === 'horse') {
      // 馬: 攻撃には不向き（0.5倍）
      dmg = Math.floor(hero.stats.attack * 0.5);
    } else if (d.face === 'strategy') {
      // 策: 攻撃には不向き（0.3倍）
      dmg = Math.floor(hero.stats.attack * 0.3);
    } else if (d.face === 'shield') {
      // 盾: 攻撃にはほぼ使えない（0.2倍）
      dmg = Math.floor(hero.stats.attack * 0.2);
    }
    enemyDmg += Math.floor(dmg * skillMultiplier);
  }

  // 策略ダイス — 策/星で高効果、他は低効果
  for (const d of strategyDice) {
    if (d.face === 'strategy' || d.face === 'star') {
      // 策/星: フル効果
      enemyDmg += Math.floor(hero.stats.attack * 0.6);
    } else if (d.face === 'sword' || d.face === 'arrow') {
      // 剣/弓: 低効果
      enemyDmg += Math.floor(hero.stats.attack * 0.2);
    }
    // 盾/馬を策略に入れても効果なし
  }

  // 防御処理 — 出目によって効果が変わる
  let block = 0;
  for (const d of defenseDice) {
    if (d.face === 'shield' || d.face === 'star') {
      // 盾/星: フルブロック
      block += hero.stats.defense;
    } else if (d.face === 'horse') {
      // 馬: 回避的防御（0.7倍）
      block += Math.floor(hero.stats.defense * 0.7);
    } else if (d.face === 'sword' || d.face === 'arrow') {
      // 剣/弓: 防御には不向き（0.3倍）
      block += Math.floor(hero.stats.defense * 0.3);
    } else if (d.face === 'strategy') {
      // 策: 防御には不向き（0.2倍）
      block += Math.floor(hero.stats.defense * 0.2);
    }
  }
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
