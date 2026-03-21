import type { HeroDef, EnemyDef, AdvisorCard, MerchantItem, GameEvent, DiceFace } from './types';

export const HERO_DEFS: HeroDef[] = [
  {
    id: 'guan_yu',
    name: '関羽',
    faction: 'shu',
    portraitKey: 'guan_yu_portrait',
    diceSet: ['sword', 'sword', 'sword', 'star'],
    skill: {
      id: 'blue_dragon',
      name: '青龍偃月刀',
      description: '剣×2消費 → 渾身の一撃（攻撃力×1.5の追加ダメージ）',
      cost: { face: 'sword', count: 2 },
      effect: 'all_attack',
    },
    stats: { maxHp: 100, attack: 12, defense: 5, diceCount: 4 },
    description: '蜀の猛将。剣ダイスが多く攻撃力に優れる。',
  },
  {
    id: 'zhang_fei',
    name: '張飛',
    faction: 'shu',
    portraitKey: 'zhang_fei_portrait',
    diceSet: ['sword', 'sword', 'strategy', 'sword'],
    skill: {
      id: 'snake_spear',
      name: '蛇矛の突き',
      description: '策×1消費 → 全ての剣ダイス×1.5倍',
      cost: { face: 'strategy', count: 1 },
      effect: 'buff_swords',
    },
    stats: { maxHp: 110, attack: 10, defense: 6, diceCount: 4 },
    description: '蜀の豪傑。咆哮で剣を強化する。',
  },
  {
    id: 'zhao_yun',
    name: '趙雲',
    faction: 'shu',
    portraitKey: 'zhao_yun_portrait',
    diceSet: ['sword', 'horse', 'horse', 'shield'],
    skill: {
      id: 'lone_rescue',
      name: '単騎救主',
      description: '馬×2消費 → 無敵1ターン＋反撃',
      cost: { face: 'horse', count: 2 },
      effect: 'invincible_counter',
    },
    stats: { maxHp: 95, attack: 10, defense: 8, diceCount: 4 },
    description: '蜀の白馬将軍。機動力と防御が光る。',
  },
  {
    id: 'zhuge_liang',
    name: '諸葛亮',
    faction: 'shu',
    portraitKey: 'zhuge_liang_portrait',
    diceSet: ['strategy', 'strategy', 'strategy', 'arrow'],
    skill: {
      id: 'empty_city',
      name: '空城の計',
      description: '策×3消費 → 敵を1ターン行動不能',
      cost: { face: 'strategy', count: 3 },
      effect: 'stun_enemy',
    },
    stats: { maxHp: 80, attack: 8, defense: 4, diceCount: 4 },
    description: '蜀の軍師。策略で敵を翻弄する。',
  },
  {
    id: 'liu_bei',
    name: '劉備',
    faction: 'shu',
    portraitKey: 'liu_bei_portrait',
    diceSet: ['shield', 'shield', 'sword', 'strategy'],
    skill: {
      id: 'benevolence',
      name: '仁徳の御旗',
      description: '盾×1消費 → 防御を攻撃に転用（盾の数×攻撃力）',
      cost: { face: 'shield', count: 1 },
      effect: 'shield_to_attack',
    },
    stats: { maxHp: 95, attack: 8, defense: 10, diceCount: 4 },
    description: '蜀の君主。仁徳で民を守り、盾を力に変える。',
  },
];

export const ENEMY_DEFS: EnemyDef[] = [
  // ===== 第1章: 黄巾賊 =====
  {
    id: 'yellow_soldier',
    name: '黄巾賊兵',
    maxHp: 35,
    attack: 6,
    defense: 2,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'attack', 'defend'],
    chapter: 1,
  },
  {
    id: 'pei_yuan_shao',
    name: '裴元紹',
    maxHp: 45,
    attack: 8,
    defense: 3,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'buff', 'attack', 'defend'],
    chapter: 1,
  },
  {
    id: 'cheng_yuan_zhi',
    name: '程遠志',
    maxHp: 50,
    attack: 9,
    defense: 3,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'special', 'defend', 'attack'],
    chapter: 1,
  },
  {
    id: 'zhang_bao',
    name: '張宝',
    maxHp: 65,
    attack: 10,
    defense: 5,
    isBoss: false,
    portraitKey: '',
    intents: ['buff', 'special', 'attack', 'defend'],
    chapter: 1,
  },
  {
    id: 'zhang_liang_yellow',
    name: '張梁',
    maxHp: 70,
    attack: 10,
    defense: 4,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'attack', 'buff', 'special'],
    chapter: 1,
  },
  // 第1章 精鋭
  {
    id: 'elite_zhang_mancheng',
    name: '張曼成',
    maxHp: 80,
    attack: 11,
    defense: 5,
    isBoss: false,
    portraitKey: '',
    intents: ['buff', 'attack', 'attack', 'special', 'defend'],
    chapter: 1,
  },
  // 第1章 ボス
  {
    id: 'zhang_jiao',
    name: '張角',
    maxHp: 120,
    attack: 12,
    defense: 6,
    isBoss: true,
    portraitKey: '',
    intents: ['buff', 'special', 'attack', 'special', 'defend'],
    chapter: 1,
  },

  // ===== 第2章: 董卓軍 =====
  {
    id: 'dong_zhuo_soldier',
    name: '西涼兵',
    maxHp: 50,
    attack: 9,
    defense: 4,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'attack', 'defend'],
    chapter: 2,
  },
  {
    id: 'li_jue',
    name: '李傕',
    maxHp: 60,
    attack: 10,
    defense: 5,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'buff', 'attack', 'defend'],
    chapter: 2,
  },
  {
    id: 'guo_si',
    name: '郭汜',
    maxHp: 60,
    attack: 11,
    defense: 4,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'special', 'attack', 'defend'],
    chapter: 2,
  },
  {
    id: 'hua_xiong',
    name: '華雄',
    maxHp: 75,
    attack: 12,
    defense: 6,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'special', 'defend', 'attack'],
    chapter: 2,
  },
  {
    id: 'lu_bu',
    name: '呂布',
    maxHp: 100,
    attack: 15,
    defense: 7,
    isBoss: false,
    portraitKey: 'lu_bu_portrait',
    intents: ['attack', 'special', 'attack', 'buff', 'special'],
    chapter: 2,
  },
  // 第2章 精鋭
  {
    id: 'elite_lu_bu',
    name: '呂布（飛将）',
    maxHp: 120,
    attack: 16,
    defense: 8,
    isBoss: false,
    portraitKey: 'lu_bu_portrait',
    intents: ['attack', 'special', 'buff', 'attack', 'special'],
    chapter: 2,
  },
  // 第2章 ボス
  {
    id: 'dong_zhuo',
    name: '董卓',
    maxHp: 160,
    attack: 16,
    defense: 10,
    isBoss: true,
    portraitKey: '',
    intents: ['attack', 'buff', 'attack', 'special', 'defend'],
    chapter: 2,
  },

  // ===== 第3章: 曹操軍 =====
  {
    id: 'cao_soldier',
    name: '曹操軍兵',
    maxHp: 60,
    attack: 10,
    defense: 5,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'attack', 'defend'],
    chapter: 3,
  },
  {
    id: 'xu_huang',
    name: '徐晃',
    maxHp: 75,
    attack: 12,
    defense: 6,
    isBoss: false,
    portraitKey: '',
    intents: ['attack', 'attack', 'buff', 'defend'],
    chapter: 3,
  },
  {
    id: 'zhang_liao',
    name: '張遼',
    maxHp: 80,
    attack: 13,
    defense: 7,
    isBoss: false,
    portraitKey: '',
    intents: ['buff', 'attack', 'special', 'defend'],
    chapter: 3,
  },
  {
    id: 'xiahou_dun',
    name: '夏侯惇',
    maxHp: 85,
    attack: 13,
    defense: 9,
    isBoss: false,
    portraitKey: '',
    intents: ['defend', 'attack', 'attack', 'special'],
    chapter: 3,
  },
  {
    id: 'sima_yi',
    name: '司馬懿',
    maxHp: 70,
    attack: 11,
    defense: 8,
    isBoss: false,
    portraitKey: '',
    intents: ['buff', 'special', 'defend', 'attack', 'special'],
    chapter: 3,
  },
  // 第3章 精鋭
  {
    id: 'elite_dian_wei',
    name: '典韋',
    maxHp: 110,
    attack: 15,
    defense: 8,
    isBoss: false,
    portraitKey: '',
    intents: ['buff', 'attack', 'attack', 'special', 'defend'],
    chapter: 3,
  },
  // 第3章 ボス
  {
    id: 'cao_cao_boss',
    name: '曹操',
    maxHp: 200,
    attack: 20,
    defense: 12,
    isBoss: true,
    portraitKey: 'cao_cao_portrait',
    intents: ['buff', 'attack', 'attack', 'special', 'defend', 'attack'],
    chapter: 3,
  },
];

export const ADVISOR_CARDS: AdvisorCard[] = [
  {
    id: 'add_sword',
    name: '刀槍の鍛錬',
    description: 'ダイスに剣を1つ追加',
    effect: { type: 'add_dice', face: 'sword' },
  },
  {
    id: 'add_shield',
    name: '鎧の強化',
    description: 'ダイスに盾を1つ追加',
    effect: { type: 'add_dice', face: 'shield' },
  },
  {
    id: 'add_strategy',
    name: '兵法研究',
    description: 'ダイスに策を1つ追加',
    effect: { type: 'add_dice', face: 'strategy' },
  },
  {
    id: 'add_horse',
    name: '良馬入手',
    description: 'ダイスに馬を1つ追加',
    effect: { type: 'add_dice', face: 'horse' },
  },
  {
    id: 'add_arrow',
    name: '弓術修練',
    description: 'ダイスに弓を1つ追加',
    effect: { type: 'add_dice', face: 'arrow' },
  },
  {
    id: 'add_star',
    name: '天の啓示',
    description: 'ダイスに星（ワイルド）を1つ追加',
    effect: { type: 'add_dice', face: 'star' },
  },
  {
    id: 'upgrade_attack',
    name: '武芸鍛錬',
    description: '攻撃力+3',
    effect: { type: 'upgrade_stat', stat: 'attack', amount: 3 },
  },
  {
    id: 'upgrade_defense',
    name: '守備固め',
    description: '防御力+3',
    effect: { type: 'upgrade_stat', stat: 'defense', amount: 3 },
  },
  {
    id: 'upgrade_hp',
    name: '養生の術',
    description: '最大HP+20',
    effect: { type: 'upgrade_stat', stat: 'maxHp', amount: 20 },
  },
];

export const MERCHANT_ITEMS: MerchantItem[] = [
  {
    id: 'm_sword',
    name: '宝刀',
    description: 'ダイスに剣を1つ追加',
    cost: 50,
    effect: { type: 'add_dice', face: 'sword' },
  },
  {
    id: 'm_hp',
    name: '仙薬',
    description: '最大HP+20',
    cost: 60,
    effect: { type: 'upgrade_stat', stat: 'maxHp', amount: 20 },
  },
  {
    id: 'm_attack',
    name: '名剣',
    description: '攻撃力+5',
    cost: 80,
    effect: { type: 'upgrade_stat', stat: 'attack', amount: 5 },
  },
  {
    id: 'm_defense',
    name: '名鎧',
    description: '防御力+5',
    cost: 80,
    effect: { type: 'upgrade_stat', stat: 'defense', amount: 5 },
  },
  {
    id: 'm_star',
    name: '天書',
    description: 'ダイスに星（ワイルド）を1つ追加',
    cost: 100,
    effect: { type: 'add_dice', face: 'star' },
  },
];

export const GAME_EVENTS: GameEvent[] = [
  {
    id: 'ambush',
    title: '伏兵出現',
    description: '山中で突然伏兵に囲まれた！',
    options: [
      { text: '迎撃する（HP-10）', effect: 'hp_down', value: 10 },
      { text: '突破する（金-20）', effect: 'gold_down', value: 20 },
    ],
  },
  {
    id: 'merchant_rumor',
    title: '商人の情報',
    description: '行商人から敵の弱点を教えてもらった。',
    options: [
      { text: '礼金を払う（金-15、攻撃+2）', effect: 'gold_down', value: 15 },
      { text: '断る', effect: 'nothing', value: 0 },
    ],
  },
  {
    id: 'fortune_teller',
    title: '占い師の予言',
    description: '老婆が吉凶を占ってくれる。',
    options: [
      { text: '大吉（HP+20）', effect: 'hp_up', value: 20 },
      { text: '大凶（HP-15）', effect: 'hp_down', value: 15 },
    ],
  },
  {
    id: 'find_treasure',
    title: '埋蔵金発見',
    description: '廃墟に宝が眠っていた！',
    options: [
      { text: '掘り起こす（金+50）', effect: 'gold_up', value: 50 },
      { text: '見逃す', effect: 'nothing', value: 0 },
    ],
  },
  {
    id: 'spy_report',
    title: '密偵の報告',
    description: '味方の密偵が情報を持ってきた。',
    options: [
      { text: '情報料を払う（金-20、次のボス弱体化）', effect: 'gold_down', value: 20 },
      { text: '断る', effect: 'nothing', value: 0 },
    ],
  },
  {
    id: 'ancient_scroll',
    title: '古の兵法書',
    description: '廃寺で貴重な兵法書を見つけた。',
    options: [
      { text: '読み解く（HP-5、攻撃+1）', effect: 'hp_down', value: 5 },
      { text: '持ち帰って売る（金+30）', effect: 'gold_up', value: 30 },
    ],
  },
  {
    id: 'village_plea',
    title: '村人の嘆願',
    description: '山賊に苦しむ村人が助けを求めている。',
    options: [
      { text: '助ける（HP-15、金+40）', effect: 'hp_down', value: 15 },
      { text: '素通りする', effect: 'nothing', value: 0 },
    ],
  },
  {
    id: 'hot_spring',
    title: '秘湯発見',
    description: '山中に温泉が湧いていた。',
    options: [
      { text: '浸かって休む（HP+30）', effect: 'hp_up', value: 30 },
      { text: '警戒して離れる（金+10）', effect: 'gold_up', value: 10 },
    ],
  },
];

export const DICE_LABELS: Record<DiceFace, string> = {
  sword: '⚔',
  shield: '🛡',
  strategy: '📜',
  horse: '🐴',
  arrow: '🏹',
  star: '⭐',
};

export const DICE_COLORS: Record<DiceFace, string> = {
  sword: '#e74c3c',
  shield: '#3498db',
  strategy: '#9b59b6',
  horse: '#27ae60',
  arrow: '#e67e22',
  star: '#f1c40f',
};

export const NODE_COLORS: Record<string, string> = {
  battle: '#c0392b',
  elite: '#8e44ad',
  advisor: '#f39c12',
  merchant: '#27ae60',
  rest: '#2980b9',
  event: '#7f8c8d',
  boss: '#2c3e50',
};

export const NODE_LABELS: Record<string, string> = {
  battle: '⚔ 戦闘',
  elite: '☆ 精鋭',
  advisor: '軍師',
  merchant: '商人',
  rest: '休息',
  event: '？',
  boss: '☠ ボス',
};

export const FACTION_COLORS: Record<string, string> = {
  shu: '#2ecc71',
  wei: '#3498db',
  wu: '#e74c3c',
  other: '#95a5a6',
};

export const FACTION_NAMES: Record<string, string> = {
  shu: '蜀',
  wei: '魏',
  wu: '呉',
  other: '無所属',
};

export function rollDie(): DiceFace {
  const faces: DiceFace[] = ['sword', 'shield', 'strategy', 'horse', 'arrow', 'star'];
  return faces[Math.floor(Math.random() * faces.length)];
}
