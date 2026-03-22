/** 多言語対応 (日本語/English/中文) */

export type Lang = 'ja' | 'en' | 'zh';

let currentLang: Lang = 'ja';

export function setLang(lang: Lang): void {
  currentLang = lang;
}
export function getLang(): Lang {
  return currentLang;
}

type Translations = Record<string, Record<Lang, string>>;

const UI: Translations = {
  // タイトル画面
  'title.main': { ja: '三国志', en: 'Three Kingdoms', zh: '三国志' },
  'title.sub': { ja: '覇への道', en: 'Path to Glory', zh: '霸者之路' },
  'title.desc': { ja: '劉備軍と共に乱世をダイスで切り拓け', en: 'Roll the dice and carve your way through chaos', zh: '与刘备军一起用骰子开辟乱世' },
  'title.start': { ja: 'ゲーム開始', en: 'Start Game', zh: '开始游戏' },
  'title.controls': { ja: 'クリック/タップで操作', en: 'Click / Tap to play', zh: '点击/轻触操作' },

  // キャラ選択
  'select.title': { ja: '武将を選べ', en: 'Choose Your Hero', zh: '选择武将' },
  'select.confirm': { ja: 'この武将で出陣！', en: 'March to Battle!', zh: '出阵！' },
  'select.hp': { ja: 'HP', en: 'HP', zh: 'HP' },
  'select.atk': { ja: '攻', en: 'ATK', zh: '攻' },
  'select.def': { ja: '防', en: 'DEF', zh: '防' },

  // マップ
  'map.chapter': { ja: '第{n}章', en: 'Chapter {n}', zh: '第{n}章' },
  'map.gold': { ja: '金', en: 'Gold', zh: '金' },

  // バトル
  'battle.hint.select': { ja: '▼ ダイスをタップして選択 → スロットに配置 ▼', en: '▼ Tap dice to select → place in slot ▼', zh: '▼ 点击骰子选择 → 放入栏位 ▼' },
  'battle.hint.place': { ja: '▼ スロットをタップして配置 ▼', en: '▼ Tap a slot to place ▼', zh: '▼ 点击栏位放置 ▼' },
  'battle.hint.roll': { ja: '▼ ダイスを振ろう ▼', en: '▼ Roll the dice ▼', zh: '▼ 掷骰子 ▼' },
  'battle.confirm': { ja: '⚔ 行動確定 ⚔', en: '⚔ Confirm ⚔', zh: '⚔ 确认行动 ⚔' },
  'battle.roll': { ja: '🎲 ダイスロール！', en: '🎲 Roll Dice!', zh: '🎲 掷骰子！' },
  'battle.victory': { ja: '勝利！', en: 'Victory!', zh: '胜利！' },
  'battle.defeat': { ja: '敗北...', en: 'Defeat...', zh: '战败...' },
  'battle.continue': { ja: 'タップで続ける', en: 'Tap to continue', zh: '点击继续' },
  'battle.nextAction': { ja: '次の行動', en: 'Next action', zh: '下一动作' },
  'battle.lastAction': { ja: '前回の行動', en: 'Last action', zh: '上次行动' },
  'battle.stunned': { ja: '[行動不能]', en: '[Stunned]', zh: '[无法行动]' },
  'battle.buffed': { ja: '[強化中 攻撃1.5倍]', en: '[Buffed ATK x1.5]', zh: '[强化中 攻击1.5倍]' },
  'battle.skillReady': { ja: '技発動可！', en: 'Skill OK!', zh: '技能就绪！' },
  'battle.block': { ja: '🛡 防御', en: '🛡 Block', zh: '🛡 防御' },

  // スロット
  'slot.attack': { ja: '⚔ 攻撃', en: '⚔ Attack', zh: '⚔ 攻击' },
  'slot.defense': { ja: '🛡 防御', en: '🛡 Defense', zh: '🛡 防御' },
  'slot.strategy': { ja: '📜 策略', en: '📜 Strategy', zh: '📜 策略' },
  'slot.attack.hint': { ja: '敵にダメージ', en: 'Deal damage', zh: '对敌伤害' },
  'slot.defense.hint': { ja: '攻撃を軽減', en: 'Reduce damage', zh: '减轻伤害' },
  'slot.strategy.hint': { ja: '追加ダメージ', en: 'Bonus damage', zh: '追加伤害' },
  'slot.tap': { ja: 'タップで配置', en: 'Tap to place', zh: '点击放置' },
  'slot.noEffect': { ja: '効果なし', en: 'No effect', zh: '无效果' },
  'slot.damage': { ja: 'ダメージ', en: 'Damage', zh: '伤害' },
  'slot.defense.label': { ja: '防御力', en: 'Block', zh: '防御力' },
  'slot.bonus': { ja: '追加ダメ', en: 'Bonus', zh: '追加伤害' },
  'slot.abbr.atk': { ja: '攻', en: 'A', zh: '攻' },
  'slot.abbr.def': { ja: '防', en: 'D', zh: '防' },
  'slot.abbr.str': { ja: '策', en: 'S', zh: '策' },
  'slot.abbr.skill': { ja: '技', en: 'Sk', zh: '技' },

  // ダイス名
  'dice.sword': { ja: '剣', en: 'Sword', zh: '剑' },
  'dice.shield': { ja: '盾', en: 'Shield', zh: '盾' },
  'dice.strategy': { ja: '策', en: 'Strategy', zh: '策' },
  'dice.horse': { ja: '馬', en: 'Horse', zh: '马' },
  'dice.arrow': { ja: '弓', en: 'Arrow', zh: '弓' },
  'dice.star': { ja: '星', en: 'Star', zh: '星' },

  // 敵インテント
  'intent.attack': { ja: '⚔ 攻撃', en: '⚔ Attack', zh: '⚔ 攻击' },
  'intent.special': { ja: '☆ 必殺技', en: '☆ Special', zh: '☆ 必杀技' },
  'intent.defend': { ja: '🛡 防御', en: '🛡 Defend', zh: '🛡 防御' },
  'intent.buff': { ja: '⬆ 強化（次の攻撃1.5倍）', en: '⬆ Buff (next ATK x1.5)', zh: '⬆ 强化（下次攻击1.5倍）' },
  'intent.dmg': { ja: 'ダメージ', en: 'dmg', zh: '伤害' },

  // スキル効果
  'skill.cost': { ja: '必要', en: 'Cost', zh: '需要' },
  'skill.allAttack': { ja: '渾身の一撃', en: 'Mighty Blow', zh: '全力一击' },
  'skill.buffSwords': { ja: '剣ダイス威力 ×1.5倍', en: 'Sword dice x1.5', zh: '剑骰威力 ×1.5倍' },
  'skill.invincible': { ja: '無敵 + 反撃', en: 'Invincible + Counter', zh: '无敌 + 反击' },
  'skill.stun': { ja: '敵を1ターン行動不能に', en: 'Stun enemy 1 turn', zh: '使敌人1回合无法行动' },
  'skill.shieldAttack': { ja: '盾の防御力を攻撃に転用', en: 'Convert defense to attack', zh: '将防御力转为攻击' },
  'skill.heal': { ja: 'HP回復（防御力分）', en: 'Heal HP (DEF amount)', zh: '回复HP（防御力量）' },

  // 報酬
  'reward.bossVictory': { ja: '大勝利！', en: 'Great Victory!', zh: '大胜利！' },
  'reward.victory': { ja: '勝利！', en: 'Victory!', zh: '胜利！' },
  'reward.defeated': { ja: 'を撃破！', en: ' defeated!', zh: ' 被击破！' },
  'reward.gold': { ja: '報酬金', en: 'Reward', zh: '奖励金' },
  'reward.unit': { ja: '両', en: 'G', zh: '两' },
  'reward.total': { ja: '所持金', en: 'Total', zh: '持有金' },
  'reward.nextChapter': { ja: '次の章へ進む...', en: 'Proceeding to next chapter...', zh: '前往下一章...' },

  // 軍師・商人・休息
  'advisor.title': { ja: '軍師の進言 — カードを1枚選べ', en: 'Advisor — Pick a card', zh: '军师进言 — 选择一张卡' },
  'merchant.title': { ja: '商人の店', en: 'Merchant Shop', zh: '商人的店' },
  'merchant.gold': { ja: '所持金', en: 'Gold', zh: '持有金' },
  'merchant.leave': { ja: '立ち去る', en: 'Leave', zh: '离开' },
  'rest.title': { ja: '休息地', en: 'Rest Site', zh: '休息地' },
  'rest.desc': { ja: '静かな村で英気を養う...', en: 'Rest and recover...', zh: '在静谧村庄中恢复精力...' },
  'rest.currentHp': { ja: '現在HP', en: 'Current HP', zh: '当前HP' },
  'rest.heal': { ja: '回復する', en: 'Heal', zh: '回复' },
  'rest.leave': { ja: '出発する', en: 'Leave', zh: '出发' },

  // ゲームオーバー・エンディング
  'gameover.title': { ja: '戦死', en: 'Fallen', zh: '战死' },
  'gameover.msg': { ja: '武将は倒れ、乱世は続く...', en: 'The hero has fallen...', zh: '武将倒下，乱世仍在继续...' },
  'gameover.retry': { ja: '新たな英傑で再起せよ', en: 'Try again with a new hero', zh: '以新英雄重新崛起' },
  'ending.title': { ja: '赤壁大勝利！', en: 'Victory at Red Cliffs!', zh: '赤壁大捷！' },
  'ending.msg': { ja: 'は曹操を破り天下に名を轟かせた！', en: ' defeated Cao Cao and made history!', zh: '击破曹操，威震天下！' },
  'ending.retry': { ja: 'もう一度プレイ', en: 'Play Again', zh: '再玩一次' },

  // ヘルプ
  'help.title': { ja: 'ヘルプ — バトルの遊び方', en: 'Help — How to Play', zh: '帮助 — 战斗玩法' },
  'help.dice': { ja: '■ 出目×スロットの相性（適材適所が重要！）', en: '■ Dice × Slot compatibility', zh: '■ 骰面×栏位相性（适材适所很重要！）' },
  'help.slots': { ja: '■ スロットの役割', en: '■ Slot roles', zh: '■ 栏位的作用' },
  'help.controls': { ja: '■ 操作方法', en: '■ Controls', zh: '■ 操作方法' },
  'help.close': { ja: '画面タップで閉じる', en: 'Tap to close', zh: '点击屏幕关闭' },
  'help.wild': { ja: 'ワイルド！どのスロットでも◎の効果', en: 'Wild! Best effect in any slot', zh: '万能！任何栏位都有最佳效果' },
  'help.skillCost': { ja: 'スキルコスト用', en: 'For skill cost', zh: '技能消耗用' },
  'help.drag': { ja: 'ダイスをドラッグ → スロットにドロップして割り当て', en: 'Drag dice → Drop on slot', zh: '拖动骰子 → 放到栏位上' },
  'help.tap': { ja: 'またはダイスをタップ → スロットをタップでも割り当て可', en: 'Or tap dice → tap slot to assign', zh: '或点击骰子 → 点击栏位来分配' },
  'help.unassign': { ja: '割当済みダイスをタップ → 割り当て解除', en: 'Tap assigned dice → unassign', zh: '点击已分配骰子 → 取消分配' },
  'help.skill': { ja: 'スキルボタン → コストを消費して特殊能力を発動', en: 'Skill button → use special ability', zh: '技能按钮 → 消耗骰子发动特殊能力' },
  'help.confirm': { ja: '行動確定 → このターンの行動を実行して敵ターンへ', en: 'Confirm → execute action, enemy turn', zh: '确认行动 → 执行行动，进入敌方回合' },

  // あらすじ
  'synopsis.continue': { ja: 'タップして進む', en: 'Tap to continue', zh: '点击继续' },

  // マップチュートリアル
  'mapTut.title1': { ja: 'マップの進め方', en: 'How to Advance', zh: '地图推进方法' },
  'mapTut.line1': { ja: '光っているノードをタップして進みます。', en: 'Tap glowing nodes to advance.', zh: '点击发光的节点前进。' },
  'mapTut.line2': { ja: 'ノードの種類で発生するイベントが変わります。', en: 'Different nodes trigger different events.', zh: '不同节点触发不同事件。' },
  'mapTut.next': { ja: 'タップして次へ →', en: 'Tap to continue →', zh: '点击继续 →' },
  'mapTut.title2': { ja: 'ノードの種類', en: 'Node Types', zh: '节点种类' },
  'mapTut.battle': { ja: '⚔ 戦闘 — 敵と戦う（メイン）', en: '⚔ Battle — Fight enemies', zh: '⚔ 战斗 — 与敌人作战（主线）' },
  'mapTut.elite': { ja: '☆ 精鋭 — 強い敵（報酬多め）', en: '☆ Elite — Stronger enemy, more reward', zh: '☆ 精锐 — 强敌（奖励更多）' },
  'mapTut.advisor': { ja: '軍師 — 武将を強化できる', en: 'Advisor — Upgrade your hero', zh: '军师 — 可以强化武将' },
  'mapTut.merchant': { ja: '商人 — ゴールドでアイテム購入', en: 'Merchant — Buy items with gold', zh: '商人 — 用金币购买道具' },
  'mapTut.rest': { ja: '休息 — HPを回復', en: 'Rest — Recover HP', zh: '休息 — 回复HP' },
  'mapTut.event': { ja: '？ — ランダムイベント', en: '? — Random event', zh: '？ — 随机事件' },
  'mapTut.boss': { ja: '☠ ボス — 章の最終戦', en: '☠ Boss — Chapter final battle', zh: '☠ Boss — 章节最终战' },
  'mapTut.go': { ja: 'タップして冒険を始めよう！', en: 'Tap to begin your adventure!', zh: '点击开始冒险吧！' },

  // バトルチュートリアル
  'batTut.title1': { ja: 'バトル開始！', en: 'Battle Start!', zh: '战斗开始！' },
  'batTut.line1a': { ja: 'ダイスを振って攻撃・防御・策略に', en: 'Roll dice and assign them to', zh: '掷骰子，将其分配到' },
  'batTut.line1b': { ja: '割り振って戦います。', en: 'Attack, Defense, or Strategy slots.', zh: '攻击、防御、策略栏位中作战。' },
  'batTut.title2': { ja: 'ダイスの出目', en: 'Dice Faces', zh: '骰子面' },
  'batTut.line2a': { ja: '⚔剣 🛡盾 📜策 🐴馬 🏹弓 ⭐星', en: '⚔Sword 🛡Shield 📜Strategy 🐴Horse 🏹Arrow ⭐Star', zh: '⚔剑 🛡盾 📜策 🐴马 🏹弓 ⭐星' },
  'batTut.line2b': { ja: 'スロットとの相性でダメージが変わります。', en: 'Effectiveness depends on slot compatibility.', zh: '根据栏位相性，伤害会变化。' },
  'batTut.line2c': { ja: '⭐星はどこに置いても最大効果！', en: '⭐Star gives max effect anywhere!', zh: '⭐星放在任何地方都有最大效果！' },
  'batTut.title3': { ja: 'スロットに配置', en: 'Place in Slots', zh: '放入栏位' },
  'batTut.line3a': { ja: '⚔攻撃 → 敵にダメージ（剣が高効果）', en: '⚔Attack → Damage enemy (Sword best)', zh: '⚔攻击 → 对敌伤害（剑效果最佳）' },
  'batTut.line3b': { ja: '🛡防御 → 敵の攻撃を軽減（盾が高効果）', en: '🛡Defense → Reduce damage (Shield best)', zh: '🛡防御 → 减轻伤害（盾效果最佳）' },
  'batTut.line3c': { ja: '📜策略 → 追加ダメージ（策が高効果）', en: '📜Strategy → Bonus damage (Strategy best)', zh: '📜策略 → 追加伤害（策效果最佳）' },
  'batTut.title4': { ja: 'やってみよう！', en: 'Try It!', zh: '试试看！' },
  'batTut.line4a': { ja: 'ダイスをタップ → スロットをタップで配置。', en: 'Tap dice → Tap slot to place.', zh: '点击骰子 → 点击栏位放置。' },
  'batTut.line4b': { ja: '全てのダイスを配置してみましょう！', en: 'Place all your dice!', zh: '把所有骰子都放好吧！' },
  'batTut.title5': { ja: '行動確定で攻撃！', en: 'Confirm to Attack!', zh: '确认行动，发起攻击！' },
  'batTut.line5a': { ja: '配置が終わったら「行動確定」を押そう！', en: 'Press "Confirm" when ready!', zh: '放置完毕后按"确认行动"！' },
  'batTut.line5b': { ja: '✦ スキルボタンで必殺技も使えます', en: '✦ Use the skill button for special moves', zh: '✦ 技能按钮可以使用必杀技' },

  // バトルログ
  'log.assignDice': { ja: 'ダイスをアクションに割り当てよ！', en: 'Assign dice to action slots!', zh: '将骰子分配到行动栏位！' },
  'log.rollDice': { ja: 'ダイスをロールせよ！', en: 'Roll the dice!', zh: '掷骰子！' },
  'log.enemyDmg': { ja: '敵に{n}ダメージ！', en: '{n} damage to enemy!', zh: '对敌造成{n}伤害！' },
  'log.block': { ja: '防御{n}を構えた！', en: 'Blocked {n}!', zh: '防御{n}！' },
  'log.invincible': { ja: '無敵！敵の攻撃を回避！', en: 'Invincible! Dodged attack!', zh: '无敌！回避了敌人的攻击！' },
  'log.counter': { ja: '反撃！{n}ダメージ！', en: 'Counter! {n} damage!', zh: '反击！{n}伤害！' },
  'log.enemyAtk': { ja: '敵の攻撃！{n}ダメージを受けた！', en: 'Enemy attack! Took {n} damage!', zh: '敌人攻击！受到{n}伤害！' },
  'log.blocked': { ja: '防御成功！ダメージなし！', en: 'Blocked! No damage!', zh: '防御成功！没有伤害！' },
  'log.enemyDef': { ja: '敵が防御！{n}ブロック！', en: 'Enemy defends! {n} block!', zh: '敌人防御！{n}格挡！' },
  'log.enemyBuff': { ja: '敵が強化！次の攻撃が1.5倍に！', en: 'Enemy buffed! Next ATK x1.5!', zh: '敌人强化！下次攻击1.5倍！' },
  'log.enemySpecial': { ja: '敵の必殺技！{n}ダメージ！', en: 'Enemy special! {n} damage!', zh: '敌人必杀技！{n}伤害！' },
  'log.stunned': { ja: '敵は行動不能！', en: 'Enemy is stunned!', zh: '敌人无法行动！' },
  'log.skillSword': { ja: '発動！剣ダイス強化！', en: ' activated! Sword dice buffed!', zh: '发动！剑骰强化！' },
  'log.skillShield': { ja: '発動！盾を攻撃に転用！', en: ' activated! Shield to attack!', zh: '发动！将盾转为攻击！' },
  'log.skillAllAtk': { ja: '発動！渾身の一撃', en: ' activated! Mighty blow', zh: '发动！全力一击' },
  'log.skillStun': { ja: '発動！敵を行動不能に！', en: ' activated! Enemy stunned!', zh: '发动！使敌人无法行动！' },
  'log.skillInv': { ja: '発動！無敵＋反撃準備！', en: ' activated! Invincible + counter!', zh: '发动！无敌+反击准备！' },
  'log.skillHeal': { ja: '発動！HP{n}回復！', en: ' activated! Healed {n} HP!', zh: '发动！回复{n}HP！' },
  'log.skillActivate': { ja: 'を発動！', en: ' activated!', zh: '发动了！' },

  // ノードラベル
  'node.battle': { ja: '⚔ 戦闘', en: '⚔ Battle', zh: '⚔ 战斗' },
  'node.elite': { ja: '☆ 精鋭', en: '☆ Elite', zh: '☆ 精锐' },
  'node.advisor': { ja: '軍師', en: 'Advisor', zh: '军师' },
  'node.merchant': { ja: '商人', en: 'Shop', zh: '商人' },
  'node.rest': { ja: '休息', en: 'Rest', zh: '休息' },
  'node.event': { ja: '？', en: '?', zh: '？' },
  'node.boss': { ja: '☠ ボス', en: '☠ Boss', zh: '☠ Boss' },

  // 陣営
  'faction.shu': { ja: '蜀', en: 'Shu', zh: '蜀' },
  'faction.wei': { ja: '魏', en: 'Wei', zh: '魏' },
  'faction.wu': { ja: '呉', en: 'Wu', zh: '吴' },
  'faction.other': { ja: '無所属', en: 'None', zh: '无所属' },

  // 章名
  'ch.1': { ja: '黄巾の乱', en: 'Yellow Turban Rebellion', zh: '黄巾之乱' },
  'ch.2': { ja: '董卓の専横', en: 'Dong Zhuo\'s Tyranny', zh: '董卓专横' },
  'ch.3': { ja: '徐州攻防戦', en: 'Battle of Xu Province', zh: '徐州攻防战' },
  'ch.4': { ja: '偽帝袁術', en: 'The False Emperor Yuan Shu', zh: '伪帝袁术' },
  'ch.5': { ja: '赤壁の戦い', en: 'Battle of Red Cliffs', zh: '赤壁之战' },
  // スキル説明
  'skill.desc.blue_dragon': { ja: '剣×2消費 → 渾身の一撃（攻撃力×1.5の追加ダメージ）', en: 'Sword×2 → Mighty blow (ATK×1.5 bonus damage)', zh: '剑×2消耗 → 全力一击（攻击力×1.5追加伤害）' },
  'skill.desc.snake_spear': { ja: '策×1消費 → 全ての剣ダイス×1.5倍', en: 'Strategy×1 → All sword dice ×1.5', zh: '策×1消耗 → 所有剑骰×1.5倍' },
  'skill.desc.lone_rescue': { ja: '馬×2消費 → 無敵1ターン＋反撃', en: 'Horse×2 → Invincible 1 turn + counter', zh: '马×2消耗 → 无敌1回合+反击' },
  'skill.desc.empty_city': { ja: '策×3消費 → 敵を1ターン行動不能', en: 'Strategy×3 → Stun enemy 1 turn', zh: '策×3消耗 → 使敌人1回合无法行动' },
  'skill.desc.benevolence': { ja: '盾×1消費 → 防御を攻撃に転用（盾の数×攻撃力）', en: 'Shield×1 → Convert defense to attack', zh: '盾×1消耗 → 将防御转为攻击（盾数×攻击力）' },
  'skill.desc.benevolent_heal': { ja: '盾×1消費 → HP回復（防御力分）', en: 'Shield×1 → Heal HP (DEF amount)', zh: '盾×1消耗 → 回复HP（防御力量）' },

  // 英雄説明
  'hero.desc.guan_yu': { ja: '蜀の猛将。剣ダイスが多く攻撃力に優れる。', en: 'Fierce warrior of Shu. Excels in attack with many sword dice.', zh: '蜀国猛将。剑骰多，攻击力出众。' },
  'hero.desc.zhang_fei': { ja: '蜀の豪傑。咆哮で剣を強化する。', en: 'Hero of Shu. Buffs swords with his roar.', zh: '蜀国豪杰。咆哮强化剑骰。' },
  'hero.desc.zhao_yun': { ja: '蜀の白馬将軍。機動力と防御が光る。', en: 'White Horse General. Agile and defensive.', zh: '蜀国白马将军。机动力与防御出色。' },
  'hero.desc.zhuge_liang': { ja: '蜀の軍師。策略で敵を翻弄する。', en: 'Strategist of Shu. Outwits enemies with tactics.', zh: '蜀国军师。以策略翻弄敌人。' },
  'hero.desc.liu_bei': { ja: '蜀の君主。仁徳で民を癒す。', en: 'Lord of Shu. Heals allies with virtue.', zh: '蜀国君主。以仁德治愈民众。' },
  'hero.desc.pang_tong': { ja: '蜀の副軍師。守りを攻めに転じる鳳雛。', en: 'Vice-strategist of Shu. The Young Phoenix who turns defense into offense.', zh: '蜀国副军师。将防御转为进攻的凤雏。' },

  // 章のあらすじ
  'synopsis.1.title': { ja: '第一章：黄巾の乱', en: 'Chapter 1: Yellow Turban Rebellion', zh: '第一章：黄巾之乱' },
  'synopsis.1.1': { ja: '後漢末期、政治の腐敗により民衆は喘いでいた。', en: 'In the late Eastern Han, the people suffered under corrupt rule.', zh: '东汉末年，政治腐败，百姓苦不堪言。' },
  'synopsis.1.2': { ja: '太平道の教祖・張角は「蒼天すでに死す」と唱え、', en: 'Zhang Jiao, leader of the Way of Peace, proclaimed:', zh: '太平道教主张角高呼"苍天已死"，' },
  'synopsis.1.3': { ja: '各地で黄巾の乱を巻き起こす。', en: '"The blue sky is dead!" and sparked rebellions.', zh: '在各地掀起黄巾之乱。' },
  'synopsis.1.4': { ja: '義勇兵として立ち上がった劉備たちは、', en: 'Liu Bei and his sworn brothers rose as volunteers,', zh: '刘备等人作为义勇军挺身而出，' },
  'synopsis.1.5': { ja: '天下安寧のため、最初の戦いに身を投じる。', en: 'plunging into their first battle for peace.', zh: '为天下安宁投身第一场战斗。' },

  'synopsis.2.title': { ja: '第二章：董卓の専横', en: 'Chapter 2: Dong Zhuo\'s Tyranny', zh: '第二章：董卓专横' },
  'synopsis.2.1': { ja: '黄巾の乱を鎮圧したのも束の間、', en: 'The Yellow Turban rebellion was barely suppressed', zh: '黄巾之乱刚刚平定，' },
  'synopsis.2.2': { ja: '都・洛陽では、西涼の豪族・董卓が実権を握る。', en: 'when Dong Zhuo of Xiliang seized power in Luoyang.', zh: '都城洛阳便被西凉豪族董卓掌控。' },
  'synopsis.2.3': { ja: 'その暴虐は凄まじく、天下は再び混迷を極めた。', en: 'His tyranny plunged the land into chaos once more.', zh: '其暴政令天下再度陷入混乱。' },
  'synopsis.2.4': { ja: '曹操による董卓暗殺失敗を機に、', en: 'After Cao Cao\'s failed assassination attempt,', zh: '曹操刺杀董卓失败后，' },
  'synopsis.2.5': { ja: '反董卓連合軍が結成される。', en: 'an anti-Dong Zhuo coalition was formed.', zh: '反董卓联合军正式组建。' },
  'synopsis.2.6': { ja: '劉備たちは虎牢関にて、若き飛将・呂布と対峙する。', en: 'At Hulao Pass, our heroes face the young flying general Lu Bu.', zh: '刘备等人在虎牢关与年轻飞将吕布对峙。' },

  'synopsis.3.title': { ja: '第三章：徐州攻防戦', en: 'Chapter 3: Battle of Xu Province', zh: '第三章：徐州攻防战' },
  'synopsis.3.1': { ja: '董卓亡き後、呂布は各地を転々とし、', en: 'After Dong Zhuo\'s fall, Lu Bu wandered from place to place,', zh: '董卓灭亡后，吕布四处流浪，' },
  'synopsis.3.2': { ja: '劉備の留守を狙い徐州を奪い取った。', en: 'seizing Xu Province while Liu Bei was away.', zh: '趁刘备不在夺取了徐州。' },
  'synopsis.3.3': { ja: '天下無双へと成長した猛将・呂布。', en: 'Lu Bu has grown into a peerless warrior.', zh: '吕布已成长为天下无双的猛将。' },
  'synopsis.3.4': { ja: 'その傍らには軍師・陳宮の智謀がある。', en: 'With strategist Chen Gong at his side.', zh: '其身旁有军师陈宫的智谋。' },
  'synopsis.3.5': { ja: '徐州奪還のため、劉備たちは再び呂布と対峙する。', en: 'To reclaim Xu Province, our heroes face Lu Bu again.', zh: '为夺回徐州，刘备等人再次与吕布对峙。' },
  'synopsis.3.6': { ja: '今度こそ決着をつけねばならない。', en: 'This time, they must settle things once and for all.', zh: '这次必须做出了断。' },

  'synopsis.4.title': { ja: '第四章：偽帝袁術', en: 'Chapter 4: The False Emperor Yuan Shu', zh: '第四章：伪帝袁术' },
  'synopsis.4.1': { ja: '呂布を討った後、南方で異変が起きた。', en: 'After defeating Lu Bu, turmoil erupted in the south.', zh: '讨伐吕布之后，南方发生异变。' },
  'synopsis.4.2': { ja: '名門袁家の袁術が伝国の玉璽を手に入れ、', en: 'Yuan Shu of the noble Yuan clan obtained the Imperial Seal,', zh: '名门袁家的袁术得到传国玉玺，' },
  'synopsis.4.3': { ja: 'ついに皇帝を僭称したのだ。', en: 'and declared himself Emperor.', zh: '竟然僭称皇帝。' },
  'synopsis.4.4': { ja: '国号を「仲」と定め、寿春に都を置く袁術。', en: 'Naming his dynasty "Zhong" with capital at Shouchun.', zh: '定国号为"仲"，建都寿春。' },
  'synopsis.4.5': { ja: '漢王朝の威信を守るため、', en: 'To uphold the Han dynasty\'s authority,', zh: '为了守护汉王朝的威信，' },
  'synopsis.4.6': { ja: '劉備たちは偽帝討伐の軍を起こす。', en: 'our heroes march against the false emperor.', zh: '刘备等人举兵讨伐伪帝。' },

  'synopsis.5.title': { ja: '第五章：赤壁の戦い', en: 'Chapter 5: Battle of Red Cliffs', zh: '第五章：赤壁之战' },
  'synopsis.5.1': { ja: '袁術を滅ぼし、群雄割拠の時代も終わりが近づく。', en: 'With Yuan Shu defeated, the era of warlords nears its end.', zh: '袁术灭亡后，群雄割据的时代即将结束。' },
  'synopsis.5.2': { ja: '北方の覇者となった曹操は、圧倒的な大軍を率いて', en: 'Cao Cao, hegemon of the north, leads a vast army', zh: '成为北方霸主的曹操率领压倒性的大军' },
  'synopsis.5.3': { ja: '天下統一を果たすべく、南下を開始した。', en: 'southward to unify all under heaven.', zh: '开始南下，意图统一天下。' },
  'synopsis.5.4': { ja: '劉備と孫権の連合軍は、揚子江の要衝・赤壁にて', en: 'The allied forces of Liu Bei and Sun Quan stand', zh: '刘备与孙权的联合军在长江要塞赤壁' },
  'synopsis.5.5': { ja: '曹操の百万の大軍を迎え撃つ。', en: 'at Red Cliffs to face Cao Cao\'s million-strong army.', zh: '迎击曹操的百万大军。' },
  'synopsis.5.6': { ja: '天下の行方を決める、最終決戦の火蓋が切られた。', en: 'The final battle that will decide the fate of the land begins.', zh: '决定天下命运的最终决战拉开帷幕。' },

  // ローグライト（レガシー）
  'legacy.title': { ja: '宝玉の間', en: 'Jade Chamber', zh: '宝玉之间' },
  'legacy.points': { ja: '宝玉', en: 'Jade', zh: '宝玉' },
  'legacy.earned': { ja: '宝玉獲得: +{n}', en: 'Jade earned: +{n}', zh: '获得宝玉: +{n}' },
  'legacy.hp': { ja: '体力強化', en: 'HP Boost', zh: '体力强化' },
  'legacy.atk': { ja: '武力強化', en: 'ATK Boost', zh: '武力强化' },
  'legacy.def': { ja: '守備強化', en: 'DEF Boost', zh: '防御强化' },
  'legacy.gold': { ja: '軍資金増加', en: 'Starting Gold', zh: '军资增加' },
  'legacy.heal': { ja: '休息強化', en: 'Better Rest', zh: '休息强化' },
  'legacy.level': { ja: 'Lv.{n}/{max}', en: 'Lv.{n}/{max}', zh: 'Lv.{n}/{max}' },
  'legacy.cost': { ja: '{n}pt', en: '{n}pt', zh: '{n}pt' },
  'legacy.maxed': { ja: '最大', en: 'MAX', zh: '已满' },
  'legacy.buy': { ja: '強化', en: 'Upgrade', zh: '强化' },
  'legacy.back': { ja: 'タイトルに戻る', en: 'Back to Title', zh: '返回标题' },
  'legacy.btn': { ja: '宝玉', en: 'Jade', zh: '宝玉' },
  'legacy.desc.maxHp': { ja: '最大HP+{n}', en: 'Max HP +{n}', zh: '最大HP+{n}' },
  'legacy.desc.attack': { ja: '攻撃力+{n}', en: 'ATK +{n}', zh: '攻击力+{n}' },
  'legacy.desc.defense': { ja: '防御力+{n}', en: 'DEF +{n}', zh: '防御力+{n}' },
  'legacy.desc.gold': { ja: '初期金+{n}', en: 'Starting gold +{n}', zh: '初始金+{n}' },
  'legacy.desc.healPercent': { ja: '休息回復+{n}%', en: 'Rest heals +{n}%', zh: '休息恢复+{n}%' },
  'legacy.runStats': { ja: '挑戦回数: {n}', en: 'Total Runs: {n}', zh: '挑战次数: {n}' },
  'legacy.bestCh': { ja: '最高到達: 第{n}章', en: 'Best: Chapter {n}', zh: '最高到达: 第{n}章' },
  'legacy.noBest': { ja: '最高到達: -', en: 'Best: -', zh: '最高到达: -' },
  'legacy.reset': { ja: 'データリセット', en: 'Reset Data', zh: '重置数据' },
  'legacy.resetConfirm': { ja: '本当にリセットしますか？', en: 'Really reset?', zh: '确定重置吗？' },
  'legacy.tabAbility': { ja: '能力強化', en: 'Upgrades', zh: '能力强化' },
  'legacy.tabHero': { ja: '武将解放', en: 'Heroes', zh: '解锁武将' },
  'legacy.heroUnlock': { ja: '武将解放', en: 'Unlock Heroes', zh: '解锁武将' },
  'legacy.unlocked': { ja: '解放済', en: 'Unlocked', zh: '已解锁' },
  'legacy.unlock': { ja: '解放', en: 'Unlock', zh: '解锁' },
  'select.locked': { ja: '🔒 宝玉で解放', en: '🔒 Unlock with Jade', zh: '🔒 用宝玉解锁' },
};

// 名前の翻訳テーブル（英雄・敵・アイテム等）
const NAMES: Record<string, Record<Lang, string>> = {
  // 英雄
  '関羽': { ja: '関羽', en: 'Guan Yu', zh: '关羽' },
  '張飛': { ja: '張飛', en: 'Zhang Fei', zh: '张飞' },
  '趙雲': { ja: '趙雲', en: 'Zhao Yun', zh: '赵云' },
  '諸葛亮': { ja: '諸葛亮', en: 'Zhuge Liang', zh: '诸葛亮' },
  '劉備': { ja: '劉備', en: 'Liu Bei', zh: '刘备' },
  '龐統': { ja: '龐統', en: 'Pang Tong', zh: '庞统' },
  // 英雄スキル
  '青龍偃月刀': { ja: '青龍偃月刀', en: 'Green Dragon Blade', zh: '青龙偃月刀' },
  '蛇矛の突き': { ja: '蛇矛の突き', en: 'Serpent Spear', zh: '蛇矛突刺' },
  '単騎救主': { ja: '単騎救主', en: 'Lone Rider Rescue', zh: '单骑救主' },
  '空城の計': { ja: '空城の計', en: 'Empty Fort Strategy', zh: '空城计' },
  '仁徳の御旗': { ja: '仁徳の御旗', en: 'Banner of Virtue', zh: '仁德之旗' },
  '仁徳の施し': { ja: '仁徳の施し', en: 'Benevolent Aid', zh: '仁德之施' },
  // 第1章の敵
  '波才': { ja: '波才', en: 'Bo Cai', zh: '波才' },
  '裴元紹': { ja: '裴元紹', en: 'Pei Yuanshao', zh: '裴元绍' },
  '程遠志': { ja: '程遠志', en: 'Cheng Yuanzhi', zh: '程远志' },
  '張宝': { ja: '張宝', en: 'Zhang Bao', zh: '张宝' },
  '張梁': { ja: '張梁', en: 'Zhang Liang', zh: '张梁' },
  '張曼成': { ja: '張曼成', en: 'Zhang Mancheng', zh: '张曼成' },
  '張角': { ja: '張角', en: 'Zhang Jiao', zh: '张角' },
  // 第2章の敵
  '徐栄': { ja: '徐栄', en: 'Xu Rong', zh: '徐荣' },
  '李傕': { ja: '李傕', en: 'Li Jue', zh: '李傕' },
  '郭汜': { ja: '郭汜', en: 'Guo Si', zh: '郭汜' },
  '華雄': { ja: '華雄', en: 'Hua Xiong', zh: '华雄' },
  '呂布（若き飛将）': { ja: '呂布（若き飛将）', en: 'Lu Bu (Young)', zh: '吕布（年轻飞将）' },
  '董卓': { ja: '董卓', en: 'Dong Zhuo', zh: '董卓' },
  // 第3章の敵
  '侯成': { ja: '侯成', en: 'Hou Cheng', zh: '侯成' },
  '陳宮': { ja: '陳宮', en: 'Chen Gong', zh: '陈宫' },
  '高順': { ja: '高順', en: 'Gao Shun', zh: '高顺' },
  '張遼': { ja: '張遼', en: 'Zhang Liao', zh: '张辽' },
  '陳宮（軍師）': { ja: '陳宮（軍師）', en: 'Chen Gong (Advisor)', zh: '陈宫（军师）' },
  '呂布': { ja: '呂布', en: 'Lu Bu', zh: '吕布' },
  // 第4章の敵
  '張勲': { ja: '張勲', en: 'Zhang Xun', zh: '张勋' },
  '紀霊': { ja: '紀霊', en: 'Ji Ling', zh: '纪灵' },
  '楊奉': { ja: '楊奉', en: 'Yang Feng', zh: '杨奉' },
  '雷薄': { ja: '雷薄', en: 'Lei Bo', zh: '雷薄' },
  '紀霊（大将）': { ja: '紀霊（大将）', en: 'Ji Ling (General)', zh: '纪灵（大将）' },
  '袁術': { ja: '袁術', en: 'Yuan Shu', zh: '袁术' },
  // 第5章の敵
  '曹仁': { ja: '曹仁', en: 'Cao Ren', zh: '曹仁' },
  '徐晃': { ja: '徐晃', en: 'Xu Huang', zh: '徐晃' },
  '夏侯惇': { ja: '夏侯惇', en: 'Xiahou Dun', zh: '夏侯惇' },
  '司馬懿': { ja: '司馬懿', en: 'Sima Yi', zh: '司马懿' },
  '典韋': { ja: '典韋', en: 'Dian Wei', zh: '典韦' },
  '曹操': { ja: '曹操', en: 'Cao Cao', zh: '曹操' },
  // アイテム・カード
  '刀槍の鍛錬': { ja: '刀槍の鍛錬', en: 'Weapon Training', zh: '刀枪锻炼' },
  '鎧の強化': { ja: '鎧の強化', en: 'Armor Upgrade', zh: '铠甲强化' },
  '兵法研究': { ja: '兵法研究', en: 'Strategy Study', zh: '兵法研究' },
  '良馬入手': { ja: '良馬入手', en: 'Fine Horse', zh: '良马入手' },
  '弓術修練': { ja: '弓術修練', en: 'Archery Training', zh: '弓术修炼' },
  '天の啓示': { ja: '天の啓示', en: 'Divine Revelation', zh: '天之启示' },
  '武芸鍛錬': { ja: '武芸鍛錬', en: 'Martial Training', zh: '武艺锻炼' },
  '守備固め': { ja: '守備固め', en: 'Fortify Defense', zh: '加固防守' },
  '養生の術': { ja: '養生の術', en: 'Art of Healing', zh: '养生之术' },
  '宝刀': { ja: '宝刀', en: 'Treasure Blade', zh: '宝刀' },
  '仙薬': { ja: '仙薬', en: 'Elixir', zh: '仙药' },
  '名剣': { ja: '名剣', en: 'Fine Sword', zh: '名剑' },
  '名鎧': { ja: '名鎧', en: 'Fine Armor', zh: '名铠' },
  '天書': { ja: '天書', en: 'Celestial Book', zh: '天书' },
  // イベント
  '伏兵出現': { ja: '伏兵出現', en: 'Ambush!', zh: '伏兵出现' },
  '商人の情報': { ja: '商人の情報', en: 'Merchant Intel', zh: '商人的情报' },
  '占い師の予言': { ja: '占い師の予言', en: 'Fortune Teller', zh: '占卜师的预言' },
  '埋蔵金発見': { ja: '埋蔵金発見', en: 'Treasure Found', zh: '发现埋藏金' },
  '密偵の報告': { ja: '密偵の報告', en: 'Spy Report', zh: '密探的报告' },
  '古の兵法書': { ja: '古の兵法書', en: 'Ancient Scrolls', zh: '古兵法书' },
  '村人の嘆願': { ja: '村人の嘆願', en: 'Village Plea', zh: '村民的请愿' },
  '秘湯発見': { ja: '秘湯発見', en: 'Hot Spring Found', zh: '发现秘汤' },

  // レガシー強化
  '体力強化': { ja: '体力強化', en: 'HP Boost', zh: '体力强化' },
  '武力強化': { ja: '武力強化', en: 'ATK Boost', zh: '武力强化' },
  '守備強化': { ja: '守備強化', en: 'DEF Boost', zh: '防御强化' },
  '軍資金増加': { ja: '軍資金増加', en: 'Starting Gold', zh: '军资增加' },
  '休息強化': { ja: '休息強化', en: 'Better Rest', zh: '休息强化' },
};

/** UIテキストを取得。{n}はplaceholderとして置換可能 */
export function t(key: string, params?: Record<string, string | number>): string {
  const entry = UI[key];
  let text = entry ? (entry[currentLang] ?? entry.ja) : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/** 名前を翻訳（英雄名・敵名・アイテム名等） */
export function tn(name: string): string {
  const entry = NAMES[name];
  return entry ? (entry[currentLang] ?? name) : name;
}
