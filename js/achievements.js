/* 《问道长生》成就表（纯数据）
 * 由 game.js 的成就引擎求值：cond 为单条断言或 { all: [...] }。
 * 断言语义：
 *   flags / anyFlags / notFlags  当前这局的标记（notFlags 用于排除）
 *   attr                        当前这局属性下限（>=）
 *   reached                     曾抵达的结算层：ch1..ch6 / final / death
 *   ending                      已收录结局 { tier, name }
 *   codex                       已收录结局数下限
 *   runs                        轮回次数下限
 *   stat                        累计计数下限 { stat: "undo" | "revive" | "slot" | "death", min: n }
 *   flagsSeen                   跨周目见过的标记（用于「三条入门路」这类成就）
 *   all                         全部子断言成立
 */
GAME_DATA.achievementGroups = ["剧情", "结局", "修行", "系统"];

GAME_DATA.achievements = [
  /* ---------- 剧情 ---------- */
  {
    id: "prologue_vision", name: "青崖问物", group: "剧情", icon: "眼",
    desc: "在序章的雷击木前看清那七个人的脸。",
    cond: { anyFlags: ["前尘残影"] }
  },
  {
    id: "settle_ch1", name: "筑基天成", group: "剧情", icon: "基",
    desc: "第一次走到第一章结算。",
    cond: { reached: "ch1" }
  },
  {
    id: "settle_ch2", name: "金丹大道", group: "剧情", icon: "丹",
    desc: "结成金丹，走到第二章结算。",
    cond: { reached: "ch2" }
  },
  {
    id: "settle_ch3", name: "元婴出窍", group: "剧情", icon: "婴",
    desc: "碎丹成婴，走到第三章结算。",
    cond: { reached: "ch3" }
  },
  {
    id: "settle_ch4", name: "化神问道", group: "剧情", icon: "神",
    desc: "元婴圆满，走到第四章结算。",
    cond: { reached: "ch4" }
  },
  {
    id: "settle_ch5", name: "渡劫问天", group: "剧情", icon: "劫",
    desc: "渡过心魔，走到第五章结算。",
    cond: { reached: "ch5" }
  },
  {
    id: "settle_ch6", name: "天门将开", group: "剧情", icon: "门",
    desc: "走到第六章结算，天门已在眼前。",
    cond: { reached: "ch6" }
  },
  {
    id: "final_any", name: "终局问道", group: "剧情", icon: "终",
    desc: "抵达任意一个终局。",
    cond: { reached: "final" }
  },
  {
    id: "death_any", name: "道消身死", group: "剧情", icon: "殁",
    desc: "经历一次败亡。死亡也是这条道的一部分。",
    cond: { reached: "death" }
  },

  /* ---------- 结局 ---------- */
  {
    id: "ending_kaitian", name: "开天者", group: "结局", icon: "开",
    desc: "以三信物重铸天门，达成真·终局「开天者」。",
    cond: { ending: { tier: "final", name: "开天者" } }
  },
  {
    id: "ending_demon", name: "幽冥魔尊", group: "结局", icon: "魔",
    desc: "引魔潮灌入仙界，达成「幽冥魔尊」。",
    cond: { ending: { tier: "final", name: "幽冥魔尊" } }
  },
  {
    id: "ending_love", name: "比翼飞升", group: "结局", icon: "翼",
    desc: "与道侣携手踏入天门，达成「比翼飞升」。",
    cond: { ending: { tier: "final", name: "比翼飞升" } }
  },
  {
    id: "ending_fox", name: "狐仙眷侣", group: "结局", icon: "狐",
    desc: "与苏漓归隐青丘，达成「狐仙眷侣」。",
    cond: { ending: { tier: "final", name: "狐仙眷侣" } }
  },
  {
    id: "codex_10", name: "图鉴初开", group: "结局", icon: "录",
    desc: "收录 10 个结局。",
    cond: { codex: 10 }
  },
  {
    id: "codex_30", name: "三十而立", group: "结局", icon: "卷",
    desc: "收录 30 个结局。",
    cond: { codex: 30 }
  },
  {
    id: "codex_60", name: "六十甲子", group: "结局", icon: "册",
    desc: "收录 60 个结局。",
    cond: { codex: 60 }
  },
  {
    id: "codex_92", name: "观尽长生", group: "结局", icon: "全",
    desc: "集齐全部 92 个结局。",
    cond: { codex: 92 }
  },

  /* ---------- 修行 ---------- */
  {
    id: "attr_kill", name: "杀伐证道", group: "修行", icon: "杀",
    desc: "单局杀戮达到 60。",
    cond: { attr: { 杀戮: 60 } }
  },
  {
    id: "attr_heart", name: "仁心道种", group: "修行", icon: "仁",
    desc: "单局心性达到 80。",
    cond: { attr: { 心性: 80 } }
  },
  {
    id: "attr_love", name: "情根深种", group: "修行", icon: "情",
    desc: "单局情缘达到 40。",
    cond: { attr: { 情缘: 40 } }
  },
  {
    id: "attr_fame", name: "名动玄黄", group: "修行", icon: "名",
    desc: "单局声望达到 50。",
    cond: { attr: { 声望: 50 } }
  },
  {
    id: "attr_cult", name: "一力破万法", group: "修行", icon: "力",
    desc: "单局修为达到 90。",
    cond: { attr: { 修为: 90 } }
  },
  {
    id: "bond_ah", name: "药庐同心", group: "修行", icon: "药",
    desc: "走完阿禾的专属支线「药庐三夜」。",
    cond: { flags: ["药庐同心"] }
  },
  {
    id: "bond_sl", name: "青丘同契", group: "修行", icon: "契",
    desc: "走完苏漓的专属支线「青丘月」。",
    cond: { flags: ["青丘同契"] }
  },
  {
    id: "three_paths", name: "三途皆走", group: "修行", icon: "途",
    desc: "跨周目分别踏入青云宗、散修、魔道三条入门路。",
    cond: { flagsSeen: ["青云候选", "红尘心", "魔修"] }
  },

  /* ---------- 系统 ---------- */
  {
    id: "sys_undo", name: "悔棋一步", group: "系统", icon: "悔",
    desc: "第一次使用「回退一步」。",
    cond: { stat: { key: "undo", min: 1 } }
  },
  {
    id: "sys_revive", name: "死地回生", group: "系统", icon: "生",
    desc: "在败亡界面退回上一步，把命捡回来。",
    cond: { stat: { key: "revive", min: 1 } }
  },
  {
    id: "sys_slot", name: "留一线", group: "系统", icon: "存",
    desc: "第一次使用手动存档位。",
    cond: { stat: { key: "slot", min: 1 } }
  },
  {
    id: "sys_runs", name: "轮回三世", group: "系统", icon: "轮",
    desc: "累计开始第三世。",
    cond: { runs: 3 }
  },
  {
    id: "sys_full_clear", name: "七章走遍", group: "系统", icon: "遍",
    desc: "在一局中走完序章到终局。",
    cond: {
      all: [
        { reached: "ch1" }, { reached: "ch2" }, { reached: "ch3" },
        { reached: "ch4" }, { reached: "ch5" }, { reached: "ch6" }, { reached: "final" }
      ]
    }
  }
];
