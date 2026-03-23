import type { BattleState, Die, DiceFace, ActionSlot, Hero, EnemyDef, Enemy, EnemyIntent, BossGimmick } from './types';
import { choose, clamp, randomInt } from './utils';
import { rollDie } from './data';
import { t, tn } from './i18n';

let dieIdCounter = 0;

function makeDie(face: DiceFace): Die {
  return { id: dieIdCounter++, face, nativeFace: face, locked: false, assignedSlot: null };
}

/** 敵の状態を考慮してインテントを選択する */
function chooseIntent(enemy: Enemy): EnemyIntent {
  const intents = enemy.intents;

  // バフ済み → 攻撃系を優先（バフを活かす）
  if (enemy.buffed) {
    const aggressive = intents.filter((i) => i === 'attack' || i === 'special');
    if (aggressive.length > 0) return choose(aggressive);
  }

  // 前回防御 → 連続防御を避ける
  if (enemy.currentIntent === 'defend') {
    const nonDefend = intents.filter((i) => i !== 'defend');
    if (nonDefend.length > 0) return choose(nonDefend);
  }

  // HP低い（30%以下）→ 防御を優先しやすくする
  if (enemy.currentHp <= enemy.maxHp * 0.3) {
    const hasDefend = intents.includes('defend');
    if (hasDefend && Math.random() < 0.5) return 'defend';
  }

  // 既にバフ済み → 再バフを避ける
  if (enemy.buffed) {
    const nonBuff = intents.filter((i) => i !== 'buff');
    if (nonBuff.length > 0) return choose(nonBuff);
  }

  return choose(intents);
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
    gimmickActivated: false,
  };

  // 初回ロール（各ダイスのネイティブ面に偏りあり）
  const rolledDice = dice.map((d) => ({ ...d, face: rollDie(d.nativeFace) }));

  return {
    enemy,
    dice: rolledDice,
    phase: 'assign',
    heroBlock: 0,
    skillActivated: false,
    turnCount: 1,
    message: t('log.assignDice'),
    invincible: false,
    counterPending: false,
    log: [],
  };
}

export function rerollDice(state: BattleState): BattleState {
  const newDice = state.dice.map((d) => ({
    ...d,
    face: rollDie(d.nativeFace),
    assignedSlot: null,
    locked: false,
  }));
  // ダイスロール時に敵の次の行動を決定する
  const nextIntent = chooseIntent(state.enemy);
  return {
    ...state,
    dice: newDice,
    phase: 'assign',
    heroBlock: 0,
    skillActivated: false,
    message: t('log.assignDice'),
    enemy: { ...state.enemy, currentIntent: nextIntent },
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

  // 敵が防御インテントの場合、ダメージ計算前にblockAmountを設定する
  // （UIで「防御」と表示されているターンに防御が効くようにする）
  if (!newState.enemy.stunned && newState.enemy.currentIntent === 'defend') {
    newState.enemy = { ...newState.enemy, blockAmount: newState.enemy.defense };
  }

  let swordMultiplier = 1;
  if (newState.skillActivated) {
    const effect = hero.skill.effect;
    if (effect === 'buff_swords') {
      swordMultiplier = 1.5;
      log.push(`${tn(hero.skill.name)} ${t('log.skillSword')}`);
    } else if (effect === 'shield_to_attack') {
      const shieldCount = countFace('shield');
      enemyDmg += Math.floor(hero.stats.defense * shieldCount);
      log.push(`${tn(hero.skill.name)} ${t('log.skillShield')}`);
    } else if (effect === 'all_attack') {
      const bonus = Math.floor(hero.stats.attack * 1.5);
      enemyDmg += bonus;
      log.push(`${tn(hero.skill.name)} ${t('log.skillAllAtk')} +${bonus}!`);
    } else if (effect === 'heal') {
      const healAmount = hero.stats.defense;
      hero.currentHp = Math.min(hero.currentHp + healAmount, hero.stats.maxHp);
      log.push(`${tn(hero.skill.name)} ${t('log.skillHeal', { n: healAmount })}`);
    } else if (effect === 'stun_enemy') {
      newState.enemy = { ...newState.enemy, stunned: true };
      log.push(`${tn(hero.skill.name)} ${t('log.skillStun')}`);
    } else if (effect === 'invincible_counter') {
      newState.invincible = true;
      newState.counterPending = true;
      log.push(`${tn(hero.skill.name)} ${t('log.skillInv')}`);
    }
  }

  // 攻撃・策略・防御の効果値を共通テーブルで計算
  // buff_swords: 剣ダイスのみ1.5倍（他のダイスは通常倍率）
  if (swordMultiplier > 1) {
    const attackMultipliers = SLOT_MULTIPLIERS['attack']!;
    for (const d of newState.dice) {
      if (d.assignedSlot !== 'attack') continue;
      const mult = attackMultipliers[d.face] ?? 0;
      const base = Math.floor(hero.stats.attack * mult);
      const bonus = (d.face === 'sword') ? swordMultiplier : 1;
      enemyDmg += Math.floor(base * bonus);
    }
  } else {
    enemyDmg += calcSlotValue(newState.dice, 'attack', hero.stats.attack);
  }
  enemyDmg += calcSlotValue(newState.dice, 'strategy', hero.stats.attack);
  let block = calcSlotValue(newState.dice, 'defense', hero.stats.defense);
  // 袁術ギミック: 防御効果半減
  if (newState.enemy.gimmick === 'yuan_shu_seal') {
    block = Math.floor(block / 2);
  }
  newState.heroBlock = block;

  // ダメージを敵に与える（防御差し引き）
  const actualEnemyDmg = Math.max(0, enemyDmg - newState.enemy.blockAmount);
  const newEnemyHp = clamp(newState.enemy.currentHp - actualEnemyDmg, 0, newState.enemy.maxHp);

  if (actualEnemyDmg > 0) log.push(t('log.enemyDmg', { n: actualEnemyDmg }));
  if (block > 0) log.push(t('log.block', { n: block }));

  newState.enemy = {
    ...newState.enemy,
    currentHp: newEnemyHp,
    blockAmount: 0,
  };

  if (newEnemyHp <= 0) {
    return {
      state: { ...newState, phase: 'result', message: t('battle.victory'), log },
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
        log.push(t('log.invincible'));
        if (newState.counterPending) {
          heroDmg = 0;
          const counterDmg = Math.floor(hero.stats.attack * 2);
          const newHp2 = clamp(newState.enemy.currentHp - counterDmg, 0, newState.enemy.maxHp);
          newState.enemy = { ...newState.enemy, currentHp: newHp2 };
          log.push(t('log.counter', { n: counterDmg }));
        }
      } else {
        heroDmg = Math.max(0, rawDmg - block);
        if (heroDmg > 0) log.push(t('log.enemyAtk', { n: heroDmg }));
        else log.push(t('log.blocked'));
      }
    } else if (intent === 'defend') {
      // blockAmountはダメージ計算前に設定済み。ログのみ出力
      log.push(t('log.enemyDef', { n: newState.enemy.defense }));
    } else if (intent === 'buff') {
      newState.enemy = { ...newState.enemy, buffed: true };
      log.push(t('log.enemyBuff'));
    } else if (intent === 'special') {
      const specialDmg = Math.floor(newState.enemy.attack * 2);
      heroDmg = Math.max(0, specialDmg - block);
      if (heroDmg > 0) log.push(t('log.enemySpecial', { n: heroDmg }));
    }
  } else {
    newState.enemy = { ...newState.enemy, stunned: false };
    log.push(t('log.stunned'));
  }

  // ボス固有ギミック処理
  const gimmickResult = applyBossGimmick(newState, hero, heroDmg, log);
  newState = gimmickResult.state;
  heroDmg = gimmickResult.heroDmg;

  // 次のインテントはダイスロール時に設定する（結果表示中は今回の行動を表示）

  return {
    state: {
      ...newState,
      phase: 'roll',
      invincible: false,
      counterPending: false,
      skillActivated: false,
      turnCount: newState.turnCount + 1,
      message: t('log.rollDice'),
      log: log.slice(-6),
    },
    heroDmg,
    enemyDmg: actualEnemyDmg,
  };
}

/** ダイスの出目×スロットに対する効果倍率テーブル */
export const SLOT_MULTIPLIERS: Record<string, Partial<Record<DiceFace, number>>> = {
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
  const costIncrease = state.enemy.gimmick === 'cao_cao_scheme' ? 1 : 0;
  const totalCost = count + costIncrease;
  const available = state.dice.filter(
    (d) => (d.face === face || d.face === 'star') && d.assignedSlot === null
  );
  return available.length >= totalCost && !state.skillActivated;
}

/** スキルコスト（ギミック込み）を返す */
export function getSkillCost(state: BattleState, hero: Hero): number {
  const costIncrease = state.enemy.gimmick === 'cao_cao_scheme' ? 1 : 0;
  return hero.skill.cost.count + costIncrease;
}

export function activateSkill(state: BattleState, hero: Hero): BattleState {
  if (!canActivateSkill(state, hero)) return state;
  const { face } = hero.skill.cost;
  const totalCost = getSkillCost(state, hero);
  let consumed = 0;
  const newDice = state.dice.map((d) => {
    if (consumed < totalCost && (d.face === face || d.face === 'star') && d.assignedSlot === null) {
      consumed++;
      return { ...d, assignedSlot: 'skill' as ActionSlot };
    }
    return d;
  });
  return { ...state, dice: newDice, skillActivated: true, message: `${tn(hero.skill.name)}${t('log.skillActivate')}` };
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

// === ボス固有ギミック ===

/** ボスギミック名を返す（UI表示用） */
export function getGimmickName(gimmick: BossGimmick | undefined): string {
  if (!gimmick) return '';
  const names: Record<BossGimmick, string> = {
    zhang_jiao_sorcery: '妖術',
    dong_zhuo_tyranny: '暴虐',
    lu_bu_halberd: '方天画戟',
    yuan_shu_seal: '玉璽の威光',
    cao_cao_scheme: '覇者の策謀',
  };
  return names[gimmick];
}

/** ボスギミック説明を返す（UI表示用） */
export function getGimmickDescription(gimmick: BossGimmick | undefined): string {
  if (!gimmick) return '';
  const descs: Record<BossGimmick, string> = {
    zhang_jiao_sorcery: 'ターン終了時、ダイス1個が策に変わる',
    dong_zhuo_tyranny: '3ターンごとに防御無視の追加ダメージ',
    lu_bu_halberd: 'HP半分以下で攻撃力が永続1.5倍',
    yuan_shu_seal: '防御スロットの効果が半減する',
    cao_cao_scheme: 'スキル発動コストが+1される',
  };
  return descs[gimmick];
}

/** ターン終了時にボスギミックを適用する */
function applyBossGimmick(
  state: BattleState,
  _hero: Hero,
  heroDmg: number,
  log: string[]
): { state: BattleState; heroDmg: number } {
  const gimmick = state.enemy.gimmick;
  if (!gimmick) return { state, heroDmg };

  let newState = { ...state };

  switch (gimmick) {
    case 'zhang_jiao_sorcery': {
      // ダイス1個をランダムに策に変換
      const nonStrategyIdx: number[] = [];
      newState.dice.forEach((d, i) => {
        if (d.face !== 'strategy' && d.face !== 'star') nonStrategyIdx.push(i);
      });
      if (nonStrategyIdx.length > 0) {
        const targetIdx = choose(nonStrategyIdx);
        const newDice = newState.dice.map((d, i) =>
          i === targetIdx ? { ...d, face: 'strategy' as DiceFace } : d
        );
        newState = { ...newState, dice: newDice };
        log.push('【妖術】ダイスが策に変えられた！');
      }
      break;
    }

    case 'dong_zhuo_tyranny': {
      // 3ターンごとに防御無視の固定ダメージ
      if (newState.turnCount % 3 === 0) {
        const tyrannyDmg = Math.floor(newState.enemy.attack * 0.8);
        heroDmg += tyrannyDmg;
        log.push(`【暴虐】防御無視の${tyrannyDmg}ダメージ！`);
      }
      break;
    }

    case 'lu_bu_halberd': {
      // HP50%以下で永続攻撃力1.5倍（一度のみ発動）
      if (!newState.enemy.gimmickActivated && newState.enemy.currentHp <= newState.enemy.maxHp / 2) {
        newState.enemy = {
          ...newState.enemy,
          attack: Math.floor(newState.enemy.attack * 1.5),
          gimmickActivated: true,
        };
        log.push('【方天画戟】呂布の攻撃力が上昇した！');
      }
      break;
    }

    case 'yuan_shu_seal': {
      // 防御半減は executeBattle 内で処理済み。ログは初回のみ
      if (!newState.enemy.gimmickActivated) {
        newState.enemy = { ...newState.enemy, gimmickActivated: true };
        log.push('【玉璽の威光】防御効果が半減している！');
      }
      break;
    }

    case 'cao_cao_scheme': {
      // スキルコスト+1は canActivateSkill/activateSkill で処理済み。ログは初回のみ
      if (!newState.enemy.gimmickActivated) {
        newState.enemy = { ...newState.enemy, gimmickActivated: true };
        log.push('【覇者の策謀】スキルコストが増加している！');
      }
      break;
    }
  }

  return { state: newState, heroDmg };
}
