export type Lang = 'ja' | 'en';

let currentLang: Lang = 'ja';

export function setLang(lang: Lang): void {
  currentLang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

const translations = {
  // ===== Title Scene =====
  title: { ja: 'CivRush', en: 'CivRush' },
  subtitle: { ja: '10分文明戦略', en: '10-Min Civilization' },
  selectDifficulty: { ja: '難易度を選択してください', en: 'Select Difficulty' },
  easy: { ja: '簡単', en: 'Easy' },
  normal: { ja: '普通', en: 'Normal' },
  hard: { ja: '難しい', en: 'Hard' },
  rulesTitle: { ja: '【勝利条件】', en: '[Victory Conditions]' },
  ruleConquest: { ja: '・制覇勝利：敵首都を占領', en: '- Conquest: Capture enemy capitals' },
  ruleScience: { ja: '・科学勝利：「宇宙開発」を研究', en: '- Science: Research "Space Program"' },
  ruleTimeout: { ja: '・時間切れ：40ターン後、最大領土の文明が勝利', en: '- Timeout: Most territory after 40 turns wins' },
  controlsTitle: { ja: '【操作方法】', en: '[Controls]' },
  controlClick: { ja: 'ヘックスをクリック/タップ：ユニット選択・移動', en: 'Click/Tap hex: Select & move units' },
  controlRight: { ja: '右クリック：選択解除', en: 'Right-click: Deselect' },
  controlEnd: { ja: '「ターン終了」ボタン：ターン送り', en: '"End Turn" button: Advance turn' },

  easyDesc: { ja: 'AIは消極的に行動します', en: 'AI plays passively' },
  normalDesc: { ja: 'バランスの取れたAIと対戦', en: 'Balanced AI opponent' },
  hardDesc: { ja: 'AIが積極的に攻撃してきます', en: 'AI attacks aggressively' },
  prerequisite: { ja: '前提:', en: 'Requires:' },

  // ===== HUD =====
  turnLabel: { ja: 'ターン', en: 'Turn' },
  endTurn: { ja: 'ターン終了', en: 'End Turn' },
  phaseCity: { ja: '[ 都市アクション選択フェーズ ]', en: '[ City Action Phase ]' },
  phaseUnit: { ja: '[ ユニット行動フェーズ ]', en: '[ Unit Action Phase ]' },
  phaseAI: { ja: '[ AI行動中... ]', en: '[ AI Turn... ]' },

  // ===== Era =====
  eraAncient: { ja: '古代', en: 'Ancient' },
  eraMedieval: { ja: '中世', en: 'Medieval' },
  eraModern: { ja: '近代', en: 'Modern' },
  eraAtomic: { ja: '原子力時代', en: 'Atomic Age' },

  // ===== Terrain =====
  terrainPlain: { ja: '平原', en: 'Plain' },
  terrainForest: { ja: '森', en: 'Forest' },
  terrainMountain: { ja: '山', en: 'Mountain' },
  terrainSea: { ja: '海', en: 'Sea' },

  // ===== Units =====
  unitWarrior: { ja: '戦士', en: 'Warrior' },
  unitArcher: { ja: '弓兵', en: 'Archer' },
  unitCavalry: { ja: '騎兵', en: 'Cavalry' },
  unitArtillery: { ja: '砲兵', en: 'Artillery' },

  // ===== City Panel =====
  sectionResearch: { ja: '研究', en: 'Research' },
  sectionProduce: { ja: '生産', en: 'Production' },
  sectionBuild: { ja: '建設', en: 'Construction' },
  techResearch: { ja: '技術研究...', en: 'Tech Research...' },
  produceUnit: { ja: 'を生産', en: '' }, // handled specially
  buildCity: { ja: '新都市を建設', en: 'Build New City' },
  actionUsed: { ja: 'このターン使用済み', en: 'Action used this turn' },
  noUnits: { ja: '（生産可能ユニットなし）', en: '(No units available)' },
  insufficient: { ja: '[不足]', en: '[Insufficient]' },
  built: { ja: '[建設済]', en: '[Built]' },

  // ===== Buildings =====
  barracks: { ja: '兵舎', en: 'Barracks' },
  library: { ja: '図書館', en: 'Library' },
  fortress: { ja: '要塞', en: 'Fortress' },
  buildBarracks: { ja: '兵舎を建設', en: 'Build Barracks' },
  buildLibrary: { ja: '図書館を建設', en: 'Build Library' },
  buildFortress: { ja: '要塞を建設', en: 'Build Fortress' },
  descBarracks: { ja: '都市の生産力+2', en: 'City production +2' },
  descLibrary: { ja: '都市の科学力+3', en: 'City science +3' },
  descFortress: { ja: '都市内ユニットの防御+5', en: 'Units in city: defense +5' },

  // ===== Tech Tree =====
  techTreeTitle: { ja: '技術ツリー', en: 'Tech Tree' },
  // Tech names
  techAgriculture: { ja: '農業', en: 'Agriculture' },
  techBronze: { ja: '青銅器', en: 'Bronze Working' },
  techArchery: { ja: '弓術', en: 'Archery' },
  techCalendar: { ja: '暦', en: 'Calendar' },
  techIron: { ja: '鉄器', en: 'Iron Working' },
  techFortification: { ja: '城郭', en: 'Fortification' },
  techMathematics: { ja: '数学', en: 'Mathematics' },
  techPrinting: { ja: '印刷術', en: 'Printing' },
  techIndustrialization: { ja: '産業化', en: 'Industrialization' },
  techMechanization: { ja: '機械化', en: 'Mechanization' },
  techElectricity: { ja: '電力', en: 'Electricity' },
  techRailroad: { ja: '鉄道', en: 'Railroad' },
  techNuclearPower: { ja: '原子力', en: 'Nuclear Power' },
  techComputers: { ja: 'コンピュータ', en: 'Computers' },
  techSpaceProgram: { ja: '宇宙開発', en: 'Space Program' },
  // Tech descriptions
  descAgriculture: { ja: '全都市の生産力+2', en: 'All cities +2 production' },
  descBronze: { ja: '戦士の攻撃力+2', en: 'Warrior attack +2' },
  descArchery: { ja: '弓兵ユニットを解放', en: 'Unlocks Archer unit' },
  descCalendar: { ja: '全都市の科学力+2', en: 'All cities +2 science' },
  descIron: { ja: '騎兵ユニットを解放', en: 'Unlocks Cavalry unit' },
  descFortification: { ja: '全ユニットの防御+3', en: 'All units +3 defense' },
  descMathematics: { ja: '砲兵ユニットを解放', en: 'Unlocks Artillery unit' },
  descPrinting: { ja: '全都市の科学力+4', en: 'All cities +4 science' },
  descIndustrialization: { ja: '全生産力×1.5', en: 'All production x1.5' },
  descMechanization: { ja: '全ユニット移動+1', en: 'All units +1 movement' },
  descElectricity: { ja: '全都市の科学力+5', en: 'All cities +5 science' },
  descRailroad: { ja: '都市間移動コスト0、山岳通行可', en: 'Zero city travel cost, mountain passage' },
  descNuclearPower: { ja: '全生産力×2', en: 'All production x2' },
  descComputers: { ja: '全科学力×2', en: 'All science x2' },
  descSpaceProgram: { ja: '科学勝利達成！', en: 'Science victory!' },

  // ===== Game Info =====
  terrain: { ja: '地形', en: 'Terrain' },
  capital: { ja: '★首都', en: '★Capital' },
  city: { ja: '都市', en: 'City' },
  attack: { ja: '攻', en: 'ATK' },
  defense: { ja: '守', en: 'DEF' },

  // ===== Game Scene =====
  noBuildableTiles: { ja: '建設可能な場所がありません', en: 'No buildable tiles' },
  cannotBuildHere: { ja: 'ここには建設できません', en: 'Cannot build here' },
  buildFailed: { ja: '建設に失敗しました（リソース不足の可能性があります）', en: 'Build failed (possibly insufficient resources)' },
  buildCityGuide: { ja: '都市を建設する場所をクリックしてください（黄色のマス）\n右クリックでキャンセル', en: 'Click a yellow tile to build a city\nRight-click to cancel' },
  eraAdvanced: { ja: '時代が進みました', en: 'Era advanced' },

  // ===== Result Scene =====
  victory: { ja: '勝利！', en: 'Victory!' },
  defeat: { ja: '敗北...', en: 'Defeat...' },
  conquestVictory: { ja: '制覇勝利', en: 'Conquest Victory' },
  scienceVictory: { ja: '科学勝利', en: 'Science Victory' },
  timeoutVictory: { ja: '時間切れ判定', en: 'Timeout' },
  unknown: { ja: '不明', en: 'Unknown' },
  achievedTurn: { ja: '達成ターン', en: 'Turn achieved' },
  gameStats: { ja: 'ゲーム統計', en: 'Game Stats' },
  statTiles: { ja: '占領領土', en: 'Territory' },
  statTechs: { ja: '研究技術数', en: 'Techs' },
  statKills: { ja: '撃破ユニット', en: 'Units Killed' },
  statLost: { ja: '喪失ユニット', en: 'Units Lost' },
  statEra: { ja: '到達時代', en: 'Era Reached' },
  playAgain: { ja: 'もう一度', en: 'Play Again' },

  // ===== Combat Log =====
  combatAttack: { ja: 'が{target}を攻撃: {dmg}ダメージ', en: ' attacks {target}: {dmg} damage' },
  combatCounter: { ja: '、反撃{dmg}ダメージ', en: ', {dmg} counter damage' },
  captured: { ja: 'が{enemy}の{city}を占領！', en: ' captured {enemy}\'s {city}!' },

  // ===== Player/City Names =====
  playerName: { ja: 'あなたの文明', en: 'Your Civilization' },
  ai1Name: { ja: 'ローマ帝国', en: 'Roman Empire' },
  ai2Name: { ja: 'モンゴル帝国', en: 'Mongol Empire' },
  cityCapital: { ja: '首都', en: 'Capital' },
  cityNames: {
    ja: ['帝都', '大都市', '交易港', '要塞都市', '学術都市', '農業都市', '工業都市', '聖地', '港湾都市', '辺境都市'],
    en: ['Imperial City', 'Metropolis', 'Trade Port', 'Fort City', 'Academy', 'Farmland', 'Industry', 'Holy City', 'Harbor', 'Frontier'],
  },

  // ===== Tutorial =====
  tutorialWelcome: {
    ja: '📖 CivRushへようこそ！40ターンで文明を発展させ、敵を倒すゲームです。基本を説明します',
    en: '📖 Welcome to CivRush! Build your civilization in 40 turns. Let me explain the basics',
  },
  tutorialResources: {
    ja: '📖 上部の🏭は生産力（ユニット生産・建設に使用）、💡は科学力（技術研究に使用）です。都市が毎ターン生産します',
    en: '📖 🏭 = Production (units/buildings), 💡 = Science (research). Cities generate these each turn',
  },
  tutorialCity: {
    ja: '📖 都市をダブルタップすると都市パネルが開きます。1ターンに1回、研究・生産・建設のどれかを実行できます',
    en: '📖 Double-tap a city to open its panel. You can research, produce, or build once per turn',
  },
  tutorialTechTree: {
    ja: '📖 上部の💡科学力をタップすると技術ツリーが開きます。技術を研究すると新ユニットや強化が解放されます',
    en: '📖 Tap 💡 science in the top bar to open the tech tree. Research unlocks new units and bonuses',
  },
  tutorialUnit: {
    ja: '📖 盾マークのユニットをタップ→水色マスをタップで移動。赤マスの敵をタップで攻撃。1ターン1回行動できます',
    en: '📖 Tap a unit → tap blue tile to move, red tile to attack. Each unit acts once per turn',
  },
  tutorialCombat: {
    ja: '📖 戦士→弓兵→騎兵→砲兵の順に強くなります。技術研究で解放しましょう。地形や建物で防御ボーナスもあります',
    en: '📖 Units get stronger: Warrior→Archer→Cavalry→Artillery. Unlock via tech. Terrain gives defense bonuses',
  },
  tutorialVictory: {
    ja: '📖 勝利条件: ①敵首都を全て占領（制覇）②宇宙開発を研究（科学）③40ターン後に最大領土（判定）。頑張ってください！',
    en: '📖 Win by: ①Capture all enemy capitals ②Research Space Program ③Most territory after 40 turns. Good luck!',
  },
  tutorialComplete: { ja: '✅ 説明完了！自由にプレイしましょう', en: '✅ Tutorial done! Play freely' },
  tutorialNext: { ja: '次へ ▶', en: 'Next ▶' },
  tutorialSkip: { ja: 'スキップ', en: 'Skip' },
  tutorialStart: { ja: 'ゲーム開始！', en: 'Start Game!' },

  // ===== Misc =====
  production: { ja: '生産力', en: 'Production' },
  science: { ja: '科学力', en: 'Science' },
  buildings: { ja: '建物', en: 'Buildings' },
  none: { ja: 'なし', en: 'None' },
  range: { ja: '射程', en: 'Range' },
  move: { ja: '移動', en: 'Move' },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey): string {
  const entry = translations[key];
  if (Array.isArray((entry as Record<string, unknown>)[currentLang])) {
    return ''; // Use tArray for array values
  }
  return (entry as Record<string, string>)[currentLang] ?? key;
}

export function tArray(key: TranslationKey): string[] {
  const entry = translations[key];
  const val = (entry as Record<string, unknown>)[currentLang];
  if (Array.isArray(val)) return val as string[];
  return [];
}
