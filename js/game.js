/* 《问道长生》游戏引擎 v2.2
 * 七章 · 八十余结局 · 死亡回响 · 结局图鉴 · 自动存档 · 手动存档位 · 回退一步
 */
(function () {
  "use strict";

  const SAVE_KEY = "wendao_save_v3";
  const CODEX_KEY = "wendao_codex_v1";
  const SOUND_KEY = "wendao_sound_v1";
  const SLOTS_KEY = "wendao_slots_v1";
  const SNAPSHOT_LIMIT = 12;

  const ATTR_ORDER = ["修为", "心性", "声望", "机缘", "杀戮", "情缘"];
  const ATTR_MAX = 120;

  const $ = (id) => document.getElementById(id);

  /* ---------- 章节结算 / 结局图鉴分层 ---------- */
  const TIERS = {
    ch1: { label: "第一章 · 凡尘问道", endings: "endings", def: "defaultEnding" },
    ch2: { label: "第二章 · 风起云涌", endings: "finalEndings", def: "defaultFinalEnding" },
    ch3: { label: "第三章 · 金丹问道", endings: "nascentEndings", def: "defaultNascentEnding" },
    ch4: { label: "第四章 · 元婴纵横", endings: "yuanyingEndings", def: "defaultYuanyingEnding" },
    ch5: { label: "第五章 · 化神问道", endings: "huashenEndings", def: "defaultHuashenEnding" },
    ch6: { label: "第六章 · 渡劫问天", endings: "dujieEndings", def: "defaultDujieEnding" },
    final: { label: "终局 · 飞升", endings: "ultimateEndings", def: "defaultUltimateEnding" },
    death: { label: "败亡 · 道消身死", endings: "deathEndings", def: "defaultDeathEnding" }
  };

  const SETTLE_CONFIG = {
    "__SETTLE_CH1__": {
      tier: "ch1",
      scene: "第一章 · 终",
      art: "dawn",
      titlePrefix: "筑基天成 · ",
      chapterLabel: "第一章 · 凡尘问道",
      realm: "筑基期",
      epilogues: "flagEpilogues",
      nextEvent: "ch2_start",
      nextLabel: "进入第二章 · 风起云涌（筑基期）"
    },
    "__SETTLE_CH2__": {
      tier: "ch2",
      scene: "第二章 · 终",
      art: "celestial",
      titlePrefix: "金丹大成 · ",
      chapterLabel: "第二章 · 风起云涌",
      realm: "金丹期",
      epilogues: "flagEpiloguesFinal",
      nextEvent: "ch3_start",
      nextLabel: "进入第三章 · 金丹问道（金丹期）"
    },
    "__SETTLE_CH3__": {
      tier: "ch3",
      scene: "第三章 · 终",
      art: "celestial",
      titlePrefix: "碎丹成婴 · ",
      chapterLabel: "第三章 · 金丹问道",
      realm: "元婴期",
      epilogues: "flagEpiloguesUltimate",
      nextEvent: "ch4_start",
      nextLabel: "踏入第四章 · 元婴纵横（元婴期）"
    },
    "__SETTLE_CH4__": {
      tier: "ch4",
      scene: "第四章 · 终",
      art: "fire",
      titlePrefix: "元婴圆满 · ",
      chapterLabel: "第四章 · 元婴纵横",
      realm: "元婴期",
      epilogues: "flagEpiloguesYuanying",
      nextEvent: "ch5_start",
      nextLabel: "踏入第五章 · 化神问道（化神期）"
    },
    "__SETTLE_CH5__": {
      tier: "ch5",
      scene: "第五章 · 终",
      art: "night",
      titlePrefix: "神魂大成 · ",
      chapterLabel: "第五章 · 化神问道",
      realm: "化神期",
      epilogues: "flagEpiloguesHuashen",
      nextEvent: "ch6_start",
      nextLabel: "踏入第六章 · 渡劫问天（渡劫期）"
    },
    "__SETTLE_CH6__": {
      tier: "ch6",
      scene: "第六章 · 终",
      art: "celestial",
      titlePrefix: "九劫之末 · ",
      chapterLabel: "第六章 · 渡劫问天",
      realm: "渡劫期",
      epilogues: "flagEpiloguesDujie",
      nextEvent: "ch7_start",
      nextLabel: "踏入终章 · 飞升（天门之后）"
    }
  };

  let state = null;

  /* ================= 状态 ================= */

  function newState(run) {
    return {
      attrs: Object.assign({}, GAME_DATA.initialAttrs),
      flags: [],
      current: GAME_DATA.startEvent,
      history: [],
      run: run || 1,
      view: { type: "event" },
      snapshots: []
    };
  }

  /* ================= 回退一步（选择前快照） ================= */

  function takeSnapshot() {
    return {
      attrs: Object.assign({}, state.attrs),
      flags: state.flags.slice(),
      current: state.current,
      history: state.history.slice(),
      run: state.run || 1
    };
  }

  function pushSnapshot() {
    if (!Array.isArray(state.snapshots)) state.snapshots = [];
    state.snapshots.push(takeSnapshot());
    if (state.snapshots.length > SNAPSHOT_LIMIT) state.snapshots.shift();
  }

  function canUndo() {
    return !!(state && Array.isArray(state.snapshots) && state.snapshots.length);
  }

  function undoStep() {
    if (!canUndo()) return false;
    const wasDeath = state.view && state.view.type === "death";
    const s = state.snapshots.pop();
    state.attrs = Object.assign({}, s.attrs);
    state.flags = s.flags.slice();
    state.current = s.current;
    state.history = s.history.slice();
    state.run = s.run || state.run || 1;
    state.view = { type: "event" };
    save();
    bumpMeta("undo");
    if (wasDeath) bumpMeta("revive");
    renderView();
    scrollTop();
    refreshTopbar();
    toast("已退回上一步");
    checkAchievements();
    return true;
  }

  /* ================= 条件与效果 ================= */

  function checkCond(cond) {
    if (!cond) return true;
    if (cond.attr) {
      for (const k in cond.attr) {
        if ((state.attrs[k] || 0) < cond.attr[k]) return false;
      }
    }
    if (cond.attrMax) {
      for (const k in cond.attrMax) {
        if ((state.attrs[k] || 0) > cond.attrMax[k]) return false;
      }
    }
    if (cond.flags) {
      for (const f of cond.flags) {
        if (!state.flags.includes(f)) return false;
      }
    }
    if (cond.anyFlags && cond.anyFlags.length) {
      let hit = false;
      for (const f of cond.anyFlags) {
        if (state.flags.includes(f)) { hit = true; break; }
      }
      if (!hit) return false;
    }
    if (cond.notFlags) {
      for (const f of cond.notFlags) {
        if (state.flags.includes(f)) return false;
      }
    }
    return true;
  }

  function resolveNext(next) {
    if (typeof next === "string") return { go: next };
    for (const branch of next) {
      if (!branch.if || checkCond(branch.if)) return { go: branch.go, death: branch.death };
    }
    const last = next[next.length - 1];
    return { go: last.go, death: last.death };
  }

  function applyEffects(opt) {
    const changes = [];
    const ef = opt.effects || {};
    if (ef.attr) {
      for (const k in ef.attr) {
        const v = ef.attr[k];
        state.attrs[k] = (state.attrs[k] || 0) + v;
        if (state.attrs[k] < 0) state.attrs[k] = 0;
        changes.push({ attr: k, delta: v });
      }
    }
    if (ef.flags) {
      for (const f of ef.flags) {
        if (!state.flags.includes(f)) state.flags.push(f);
      }
    }
    if (ef.removeFlags && ef.removeFlags.length) {
      state.flags = state.flags.filter((f) => !ef.removeFlags.includes(f));
    }
    return changes;
  }

  function echoFor(eventId, idx) {
    const table = GAME_DATA.echoes;
    if (!table) return null;
    const e = table[eventId + "#" + idx];
    if (!e) return null;
    return typeof e === "string" ? { text: e } : e;
  }

  function advance(nextId, deathCause, changes) {
    if (nextId === "__DEATH__") {
      state.view = { type: "death", cause: deathCause || "" };
      save();
      drawDeath();
      refreshTopbar();
      scrollTop();
      return;
    }
    if (nextId === "__ENDING__") {
      state.view = { type: "ending" };
      save();
      drawEnding();
      refreshTopbar();
      scrollTop();
      return;
    }
    if (nextId.indexOf("__SETTLE_") === 0 && SETTLE_CONFIG[nextId]) {
      state.view = { type: "settle", key: nextId };
      save();
      drawSettle(nextId);
      refreshTopbar();
      scrollTop();
      return;
    }

    state.current = nextId;
    state.view = { type: "event" };
    save();
    renderEvent();
    if (changes && changes.length) showEffects(changes);
    refreshTopbar();
    scrollTop();
  }

  function choose(idx) {
    const ev = GAME_DATA.events[state.current];
    if (!ev) return;
    const opt = ev.options[idx];
    if (!opt || !checkCond(opt.cond)) return;

    const eventId = state.current;
    pushSnapshot();
    const changes = applyEffects(opt);
    const echo = echoFor(eventId, idx);
    if (echo && Array.isArray(echo.flags)) {
      echo.flags.forEach((f) => { if (state.flags.indexOf(f) < 0) state.flags.push(f); });
    }
    state.history.push({ event: eventId, choice: opt.text });
    const route = resolveNext(opt.next);
    const nextId = route.go;
    const death = opt.death || route.death || "";

    if (echo && echo.text) {
      state.view = { type: "outcome", eventId: eventId, text: echo.text, next: nextId, death: death };
      save();
      drawOutcome(changes);
      refreshTopbar();
      scrollTop();
      return;
    }

    advance(nextId, death, changes);
  }

  function resolveOutcome() {
    const v = state.view;
    if (!v || v.type !== "outcome") return;
    advance(v.next, v.death, []);
  }

  function drawOutcome(changes) {
    const v = state.view || {};
    const ev = GAME_DATA.events[v.eventId] || {};
    setChapter(ev.chapter || GAME_DATA.meta.chapter);
    if ($("realm")) $("realm").textContent = ev.realm || "炼气期";
    renderScene({
      scene: ev.scene || "",
      art: ev.art,
      sceneKind: ev.sceneKind,
      cast: ev.cast,
      weather: ev.weather,
      title: ev.title
    });

    const title = $("event-title");
    title.textContent = "选择之后";
    title.className = "event-title tone-causal";
    $("event-text").textContent = v.text || "";
    const npc = $("npc-react");
    if (npc) npc.hidden = true;
    const note = $("ending-note");
    note.textContent = "—— 因果已生，继续前行 ——";
    note.classList.remove("fresh");

    const box = $("options");
    box.innerHTML = "";
    const next = document.createElement("button");
    next.className = "opt-btn restart";
    next.innerHTML = '<span class="opt-text">继续 →</span>';
    next.onclick = resolveOutcome;
    box.appendChild(next);

    if (canUndo()) {
      const undo = document.createElement("button");
      undo.className = "opt-btn ghost undo-btn";
      undo.innerHTML = '<span class="opt-text">↶ 收回这个选择</span>';
      undo.onclick = () => undoStep();
      box.appendChild(undo);
    }

    renderRelations();
    renderAttrs();
    updateRunInfo();
    if (changes && changes.length) showEffects(changes);
  }

  /* ================= 渲染 : 场景插画 ================= */

  const PALETTES = {
    dawn: { sky: ["#f6f1e6", "#e4dbc6"], far: "#d9d2bf", near: "#b6ae97", orb: "#c0392b", ink: "#5a5344", star: false, birds: true, glow: "rgba(192,57,43,0.20)" },
    night: { sky: ["#232a3c", "#4a5369"], far: "#39425a", near: "#232936", orb: "#f2e8c9", ink: "#c9d2e6", star: true, birds: false, glow: "rgba(242,232,201,0.22)" },
    fire: { sky: ["#2f1a19", "#7a3a2b"], far: "#8a4a34", near: "#3d1c18", orb: "#f2b04a", ink: "#f6d9b0", star: false, birds: true, glow: "rgba(242,176,74,0.26)" },
    jade: { sky: ["#eaf0e4", "#c6d7c8"], far: "#a9c0b2", near: "#7d9a8c", orb: "#e9d9a8", ink: "#46594f", star: false, birds: true, glow: "rgba(233,217,168,0.28)" },
    celestial: { sky: ["#221c38", "#5a4880"], far: "#6f5c8c", near: "#332a4c", orb: "#e8cdff", ink: "#e2d6ff", star: true, birds: false, glow: "rgba(232,205,255,0.28)" },
    cave: { sky: ["#241f19", "#4b4335"], far: "#3a342c", near: "#1d1915", orb: "#d9a94a", ink: "#e6d9c0", star: false, birds: false, glow: "rgba(217,169,74,0.22)" }
  };

  const STARS = [
    [60, 28, 1.4, 0.9], [132, 66, 1.0, 0.7], [210, 24, 1.6, 0.8], [286, 74, 1.1, 0.6],
    [350, 36, 1.3, 0.9], [420, 20, 1.0, 0.6], [478, 62, 1.5, 0.8], [548, 30, 1.1, 0.7],
    [600, 80, 1.2, 0.55], [700, 26, 1.3, 0.85], [742, 88, 1.0, 0.6], [90, 96, 1.1, 0.5],
    [258, 108, 1.2, 0.55], [388, 96, 1.0, 0.5], [512, 112, 1.3, 0.6], [664, 118, 1.0, 0.5]
  ];

  const ART_RULES = [
    [/天门|天柱|九天|天穹|雷劫|雷云|雷海|雷兵|天劫|紫府|仙山|仙庭/, "celestial"],
    [/血|火|战|刀|魔|幽冥|乱葬|杀/, "fire"],
    [/夜|月|灯|星|孤坟|湖畔/, "night"],
    [/海|湖|蓬莱|青丘|泉|秘境|山林|江/, "jade"],
    [/洞府|丹房|闭关|山腹|禁地|破庙/, "cave"]
  ];

  function artFor(ev) {
    if (ev.art && PALETTES[ev.art]) return ev.art;
    const s = (ev.scene || "") + (ev.title || "");
    for (const rule of ART_RULES) {
      if (rule[0].test(s)) return rule[1];
    }
    return "dawn";
  }

  /* ================= 场景插画（手绘矢量，可整体替换为 AI 立绘/背景） =================
   * 每种场景返回 far / mid / near 三层，分别挂在不同的视差组上。
   * 调色仍由 artFor() 选的 PALETTES 决定，所以同一场景在黎明/夜色/血色下观感不同。
   */

  const SCENE_KINDS = [
    [/天门|天柱|仙庭|雷海|天穹|紫府|天劫|仙使|守门/, "heaven"],
    [/血|刀|魔|战场|乱葬|屠|尸|幽冥|杀/, "blood"],
    [/药庐|药铺|药王谷|丹房|药王|炼药|药柜/, "pharmacy"],
    [/坊市|市集|街|摊|赌石|酒楼/, "market"],
    [/青云宗|山门|云梯|外门|长老|藏书楼|宗门|道统|弟子/, "sect"],
    [/青丘|狐|祖树|月坛/, "qingqiu"],
    [/心魔|镜|幻境/, "mirror"],
    [/湖|江|海|秘境|泉|船|舟/, "water"],
    [/洞府|禁地|山腹|井|石室|墓|窟/, "cave"],
    [/镇|村|人家|人间|长街/, "village"]
  ];

  function sceneKindFor(ev) {
    if (ev.sceneKind) return ev.sceneKind;
    const s = (ev.scene || "") + (ev.title || "");
    for (const rule of SCENE_KINDS) {
      if (rule[0].test(s)) return rule[1];
    }
    return "mountain";
  }

  /* ---- 绘图小件：全部使用墨色剪影 + 天空留白，保证同一套图形在不同色调下都成立 ---- */
  const solid = (c, op) => 'fill="' + c + '" opacity="' + (op == null ? 1 : op) + '"';

  function svgRoof(x, y, w, fill, op) {
    const hw = w / 2;
    return '<path d="M' + (x - hw - 14) + ' ' + (y + 7) +
      ' Q' + (x - hw * 0.5) + ' ' + (y - 2) + ' ' + x + ' ' + (y - 10) +
      ' Q' + (x + hw * 0.5) + ' ' + (y - 2) + ' ' + (x + hw + 14) + ' ' + (y + 7) +
      ' L' + (x + hw) + ' ' + (y + 13) + ' L' + (x - hw) + ' ' + (y + 13) + ' Z"' + solid(fill, op) + '/>';
  }

  function svgHouse(x, y, w, h, p, op) {
    const hw = w / 2;
    return '<rect x="' + (x - hw + 3) + '" y="' + (y + 11) + '" width="' + (w - 6) + '" height="' + h + '" ' + solid(p.ink, op * 0.42) + '/>' +
      '<rect x="' + (x - w / 10) + '" y="' + (y + h * 0.5) + '" width="' + (w / 5) + '" height="' + (h * 0.5 + 11) + '" ' + solid(p.sky[1], op * 0.9) + '/>' +
      svgRoof(x, y, w, p.ink, op * 0.9);
  }

  function svgGround(p, y, op) {
    return '<path d="M-20 ' + y + ' Q150 ' + (y - 9) + ' 320 ' + y + ' T660 ' + (y - 7) + ' T820 ' + y + ' V212 H-20 Z" ' + solid(p.ink, op) + '/>';
  }

  function svgPine(x, y, s, fill, op) {
    return '<path d="M' + x + ' ' + (y - s * 2.8) + ' L' + (x + s) + ' ' + (y - s * 1.0) + ' L' + (x + s * 0.42) + ' ' + (y - s * 1.0) +
      ' L' + (x + s * 1.2) + ' ' + (y + s * 0.45) + ' L' + (x - s * 1.2) + ' ' + (y + s * 0.45) + ' L' + (x - s * 0.42) + ' ' + (y - s * 1.0) +
      ' L' + (x - s) + ' ' + (y - s * 1.0) + ' Z" ' + solid(fill, op) + '/>' +
      '<rect x="' + (x - 1.1) + '" y="' + (y + s * 0.4) + '" width="2.2" height="' + (s * 0.95) + '" ' + solid(fill, op) + '/>';
  }

  function svgBamboo(x, y, n, fill, op) {
    let out = "";
    for (let i = 0; i < n; i++) {
      const dx = i * 7 - n * 3;
      const h = 34 + ((i * 13) % 22);
      out += '<path d="M' + (x + dx) + ' ' + y + ' q3 -' + h + ' 0 -' + (h + 6) + '" stroke="' + fill + '" stroke-width="1.8" fill="none" opacity="' + op + '"/>' +
        '<path d="M' + (x + dx) + ' ' + (y - h * 0.7) + ' q10 -6 16 2 M' + (x + dx) + ' ' + (y - h * 0.45) + ' q-10 -6 -16 2" stroke="' + fill + '" stroke-width="1.4" fill="none" opacity="' + (op * 0.8) + '"/>';
    }
    return out;
  }

  function svgLantern(x, y, r, color) {
    return '<line x1="' + x + '" y1="' + (y - r * 2.8) + '" x2="' + x + '" y2="' + (y - r) + '" stroke="' + color + '" stroke-width="1" opacity="0.55"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 2.6) + '" fill="' + color + '" opacity="0.13"/>' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r + '" ry="' + (r * 1.25) + '" ' + solid(color, 0.9) + '/>';
  }

  function svgCloud(x, y, w, fill, op) {
    const h = w * 0.14;
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + w + '" ry="' + h + '" ' + solid(fill, op) + '/>' +
      '<ellipse cx="' + (x + w * 0.28) + '" cy="' + (y - h * 0.55) + '" rx="' + (w * 0.62) + '" ry="' + (h * 0.85) + '" ' + solid(fill, op * 0.75) + '/>' +
      '<ellipse cx="' + (x - w * 0.4) + '" cy="' + (y + h * 0.2) + '" rx="' + (w * 0.5) + '" ry="' + (h * 0.7) + '" ' + solid(fill, op * 0.6) + '/>';
  }

  function svgSteps(x, y, w, n, fill, op) {
    let out = "";
    for (let i = 0; i < n; i++) {
      const sw = w * (1 - i * 0.07);
      out += '<rect x="' + (x - sw / 2) + '" y="' + (y + i * 6) + '" width="' + sw + '" height="5" ' + solid(fill, op * (1 - i * 0.055)) + '/>';
    }
    return out;
  }

  function svgMountains(p, y, amp, fill, op) {
    return '<path d="M-20 ' + (y + 34) + ' Q90 ' + (y - amp) + ' 200 ' + (y + 10) + ' T420 ' + (y - amp * 0.55) +
      ' T640 ' + (y + 8) + ' T820 ' + (y - amp * 0.8) + ' V212 H-20 Z" ' + solid(fill, op) + '/>';
  }

  function svgBirds(p, y, op) {
    return '<path d="M118 ' + y + ' q10 -8 20 0 q10 -8 20 0" stroke="' + p.ink + '" fill="none" stroke-width="1.4" opacity="' + op + '"/>' +
      '<path d="M172 ' + (y - 16) + ' q8 -6 16 0 q8 -6 16 0" stroke="' + p.ink + '" fill="none" stroke-width="1.1" opacity="' + (op * 0.8) + '"/>' +
      '<path d="M520 ' + (y + 4) + ' q9 -7 18 0 q9 -7 18 0" stroke="' + p.ink + '" fill="none" stroke-width="1.2" opacity="' + (op * 0.7) + '"/>';
  }

  function svgCrowd(p, y, op) {
    let out = "";
    for (let i = 0; i < 12; i++) {
      const x = 60 + i * 62 + (i % 3) * 9;
      const h = 14 + (i % 4) * 4;
      out += '<path d="M' + (x - 9) + ' ' + y + ' q9 -' + h + ' 18 0 z" ' + solid(p.ink, op) + '/>' +
        '<circle cx="' + x + '" cy="' + (y - h - 5) + '" r="4.2" ' + solid(p.ink, op) + '/>';
    }
    return out;
  }

  /* ---- 各类场景：far / mid / near 三层 ---- */
  const SCENES = {
    mountain: function (p) {
      return {
        far: svgMountains(p, 112, 58, p.far, 0.6) + svgCloud(180, 96, 130, p.sky[0], 0.35),
        mid: svgMountains(p, 152, 42, p.near, 0.55) +
          svgHouse(250, 150, 40, 20, p, 0.55) + svgHouse(300, 154, 52, 18, p, 0.5) + svgHouse(620, 148, 44, 22, p, 0.5),
        near: svgGround(p, 178, 0.28) + svgPine(86, 184, 18, p.ink, 0.75) + svgPine(140, 190, 13, p.ink, 0.6) +
          svgBirds(p, 64, 0.55)
      };
    },

    village: function (p) {
      return {
        far: svgMountains(p, 104, 48, p.far, 0.5) + svgCloud(560, 88, 150, p.sky[0], 0.3),
        mid: svgGround(p, 150, 0.2) +
          svgHouse(150, 132, 62, 34, p, 0.62) + svgHouse(232, 140, 78, 30, p, 0.56) +
          svgHouse(330, 128, 54, 38, p, 0.64) + svgHouse(430, 124, 68, 42, p, 0.6) +
          svgHouse(540, 134, 58, 32, p, 0.56) + svgHouse(648, 128, 80, 38, p, 0.62) +
          svgLantern(300, 140, 3, p.orb) + svgLantern(486, 134, 3.4, p.orb),
        near: svgGround(p, 178, 0.34) + svgBamboo(70, 196, 5, p.ink, 0.55) + svgBamboo(742, 196, 4, p.ink, 0.5) +
          '<rect x="380" y="164" width="46" height="30" rx="4" fill="none" stroke="' + p.ink + '" stroke-width="1.6" opacity="0.45"/>' +
          '<path d="M380 170 h46 M403 164 v30" stroke="' + p.ink + '" stroke-width="1.2" opacity="0.35"/>'
      };
    },

    sect: function (p) {
      const gate =
        '<rect x="332" y="86" width="10" height="104" ' + solid(p.ink, 0.6) + '/>' +
        '<rect x="458" y="86" width="10" height="104" ' + solid(p.ink, 0.6) + '/>' +
        '<rect x="338" y="96" width="124" height="7" ' + solid(p.ink, 0.55) + '/>' +
        svgRoof(400, 92, 122, p.ink, 0.8) +
        svgRoof(400, 74, 88, p.ink, 0.7) +
        svgSteps(400, 168, 132, 7, p.ink, 0.4);
      return {
        far: svgCloud(180, 122, 170, p.sky[0], 0.45) + svgCloud(640, 132, 210, p.sky[0], 0.4) +
          svgMountains(p, 96, 44, p.far, 0.45),
        mid: gate,
        near: svgGround(p, 184, 0.3) + svgPine(78, 190, 19, p.ink, 0.72) + svgPine(724, 194, 21, p.ink, 0.68) +
          svgBirds(p, 56, 0.5)
      };
    },

    market: function (p) {
      const stall = (x, w) =>
        svgRoof(x, 118, w, p.ink, 0.82) +
        '<rect x="' + (x - w / 2 + 6) + '" y="128" width="5" height="54" ' + solid(p.ink, 0.68) + '/>' +
        '<rect x="' + (x + w / 2 - 11) + '" y="128" width="5" height="54" ' + solid(p.ink, 0.68) + '/>' +
        '<rect x="' + (x - w / 2 + 10) + '" y="146" width="' + (w - 20) + '" height="8" ' + solid(p.ink, 0.55) + '/>' +
        '<circle cx="' + (x - w / 4) + '" cy="144" r="3.2" ' + solid(p.ink, 0.55) + '/>' +
        '<circle cx="' + (x + w / 6) + '" cy="144" r="2.6" ' + solid(p.ink, 0.5) + '/>';
      return {
        far: svgMountains(p, 100, 34, p.far, 0.45) +
          svgHouse(120, 112, 74, 44, p, 0.34) + svgHouse(300, 106, 90, 50, p, 0.3) +
          svgHouse(560, 110, 84, 46, p, 0.34) + svgHouse(720, 104, 70, 52, p, 0.3),
        mid: svgGround(p, 158, 0.2) + stall(150, 116) + stall(390, 146) + stall(620, 118) +
          svgLantern(122, 134, 4, p.orb) + svgLantern(214, 128, 3.4, p.orb) +
          svgLantern(352, 132, 4.2, p.orb) + svgLantern(456, 126, 3.6, p.orb) + svgLantern(586, 132, 3.8, p.orb),
        near: svgGround(p, 190, 0.36) + svgCrowd(p, 202, 0.55)
      };
    },

    pharmacy: function (p) {
      return {
        far: svgMountains(p, 100, 34, p.far, 0.35),
        mid: svgGround(p, 152, 0.16) +
          '<rect x="168" y="104" width="464" height="78" ' + solid(p.ink, 0.4) + '/>' +
          svgRoof(400, 104, 480, p.ink, 0.68) +
          '<rect x="196" y="124" width="118" height="54" ' + solid(p.sky[1], 0.55) + '/>' +
          '<rect x="486" y="124" width="118" height="54" ' + solid(p.sky[1], 0.55) + '/>' +
          '<path d="M196 138 h118 M196 152 h118 M196 166 h118 M486 138 h118 M486 152 h118 M486 166 h118" stroke="' + p.ink + '" stroke-width="1" opacity="0.3"/>' +
          '<rect x="356" y="146" width="88" height="5" ' + solid(p.ink, 0.45) + '/>' +
          svgLantern(330, 132, 4, p.orb) + svgLantern(470, 132, 4, p.orb),
        near: svgGround(p, 184, 0.3) + svgBamboo(96, 200, 3, p.ink, 0.5) +
          '<path d="M150 200 q28 -22 56 0 z" ' + solid(p.ink, 0.55) + '/>' +
          '<path d="M600 200 q30 -24 60 0 z" ' + solid(p.ink, 0.55) + '/>' +
          '<rect x="270" y="174" width="10" height="24" rx="2" ' + solid(p.ink, 0.4) + '/>' +
          '<rect x="520" y="174" width="10" height="24" rx="2" ' + solid(p.ink, 0.4) + '/>'
      };
    },

    cave: function (p) {
      let stal = "";
      for (let i = 0; i < 10; i++) {
        const x = 40 + i * 78;
        const h = 18 + ((i * 37) % 30);
        stal += '<path d="M' + x + ' -8 L' + (x + 11) + ' ' + h + ' L' + (x + 22) + ' -8 Z" ' + solid(p.ink, 0.22) + '/>';
      }
      return {
        far: '<rect x="-20" y="-20" width="840" height="232" ' + solid(p.near, 0.5) + '/>' +
          svgCloud(200, 60, 140, p.ink, 0.12) + svgCloud(620, 74, 160, p.ink, 0.1),
        mid: stal + '<path d="M120 200 Q400 128 680 200 V212 H120 Z" ' + solid(p.ink, 0.12) + '/>',
        near: '<ellipse cx="400" cy="196" rx="130" ry="16" fill="' + p.orb + '" opacity="0.28"/>' +
          '<rect x="352" y="168" width="96" height="9" ' + solid(p.ink, 0.6) + '/>' +
          '<path d="M392 168 q4 -24 8 0 q6 -18 10 0 q4 -14 8 0 q4 -20 8 0 z" fill="' + p.orb + '" opacity="0.85"/>' +
          svgGround(p, 190, 0.3)
      };
    },

    blood: function (p) {
      let swords = "";
      for (let i = 0; i < 7; i++) {
        const x = 110 + i * 96;
        const lean = (i % 2 ? 1 : -1) * (7 + (i * 3) % 9);
        swords += '<path d="M' + x + ' 208 L' + (x + lean) + ' 140" stroke="' + p.ink + '" stroke-width="2.4" opacity="0.5"/>' +
          '<path d="M' + (x - 7) + ' 150 h14" stroke="' + p.ink + '" stroke-width="2" opacity="0.45"/>';
      }
      return {
        far: '<path d="M-20 118 Q140 66 300 114 T620 100 T820 120 V212 H-20 Z" ' + solid(p.far, 0.6) + '/>' +
          svgCloud(200, 58, 170, p.ink, 0.14) + svgCloud(620, 46, 200, p.ink, 0.12),
        mid: swords +
          '<rect x="298" y="92" width="8" height="108" ' + solid(p.ink, 0.65) + '/>' +
          '<path d="M302 92 q48 10 82 4 l-8 36 q-36 6 -74 -4 z" ' + solid(p.orb, 0.45) + '/>' +
          '<rect x="558" y="100" width="7" height="100" ' + solid(p.ink, 0.65) + '/>' +
          '<path d="M561 100 q42 8 70 2 l-6 30 q-32 6 -64 -2 z" ' + solid(p.orb, 0.38) + '/>',
        near: svgGround(p, 186, 0.34) +
          '<circle cx="176" cy="182" r="7.5" fill="none" stroke="' + p.ink + '" stroke-width="1.3" opacity="0.45"/>' +
          '<circle cx="474" cy="188" r="6.5" fill="none" stroke="' + p.ink + '" stroke-width="1.3" opacity="0.4"/>'
      };
    },

    heaven: function (p) {
      let nails = "";
      for (let i = 0; i < 7; i++) {
        nails += '<circle cx="' + (330 + i * 24) + '" cy="100" r="3.6" fill="' + p.orb + '" opacity="0.95"/>';
      }
      return {
        far: svgCloud(150, 90, 180, p.sky[0], 0.4) + svgCloud(610, 70, 210, p.sky[0], 0.36) +
          '<path d="M-20 128 Q160 84 340 122 T680 110 T820 126 V212 H-20 Z" ' + solid(p.far, 0.5) + '/>',
        mid: '<rect x="300" y="52" width="9" height="150" ' + solid(p.ink, 0.7) + '/>' +
          '<rect x="491" y="52" width="9" height="150" ' + solid(p.ink, 0.7) + '/>' +
          '<rect x="300" y="52" width="200" height="11" ' + solid(p.ink, 0.72) + '/>' +
          svgRoof(400, 52, 232, p.ink, 0.7) +
          '<path d="M400 68 L400 200" stroke="' + p.orb + '" stroke-width="2.4" opacity="0.45"/>' +
          nails +
          '<path d="M322 136 L350 166 L338 198 M470 134 L452 168 L462 198" stroke="' + p.ink + '" stroke-width="1.2" opacity="0.3" fill="none"/>',
        near: svgGround(p, 188, 0.32) +
          '<path d="M300 200 L380 160 L470 190 L560 164 L640 196" stroke="' + p.ink + '" stroke-width="3" fill="none" opacity="0.45"/>' +
          '<path d="M330 200 q70 -46 140 0" stroke="' + p.orb + '" stroke-width="1.6" opacity="0.4" fill="none"/>'
      };
    },

    water: function (p) {
      return {
        far: svgMountains(p, 94, 40, p.far, 0.5) + svgCloud(520, 76, 130, p.sky[0], 0.3),
        mid: svgGround(p, 132, 0.12) +
          '<rect x="-20" y="132" width="840" height="82" ' + solid(p.sky[1], 0.5) + '/>' +
          '<ellipse cx="560" cy="150" rx="62" ry="4" fill="' + p.orb + '" opacity="0.3"/>' +
          '<ellipse cx="560" cy="166" rx="44" ry="3" fill="' + p.orb + '" opacity="0.2"/>' +
          '<path d="M118 194 q44 -12 88 0 q-44 9 -88 0 z" ' + solid(p.ink, 0.45) + '/>' +
          '<path d="M160 178 l-2 -18" stroke="' + p.ink + '" stroke-width="1.4" opacity="0.5"/>',
        near: svgGround(p, 190, 0.3) +
          '<path d="M462 190 q62 -24 124 0 q-8 13 -62 13 q-54 0 -62 -13 z" ' + solid(p.ink, 0.7) + '/>' +
          '<path d="M514 176 l6 -22 M556 174 l4 -20" stroke="' + p.ink + '" stroke-width="1.4" opacity="0.45"/>'
      };
    },

    mirror: function (p) {
      let shards = "";
      for (let i = 0; i < 7; i++) {
        const x = 150 + i * 82;
        const y = 58 + (i % 3) * 24;
        shards += '<path d="M' + x + ' ' + y + ' l28 -20 l11 28 l-22 15 z" fill="' + p.orb + '" opacity="' + (0.14 + i * 0.03) + '" stroke="' + p.ink + '" stroke-width="0.8"/>';
      }
      return {
        far: '<rect x="-20" y="-20" width="840" height="232" ' + solid(p.near, 0.42) + '/>' +
          svgCloud(180, 130, 150, p.ink, 0.1),
        mid: shards,
        near: svgGround(p, 192, 0.34) +
          '<path d="M400 96 q18 40 0 78 q-18 -38 0 -78 z" ' + solid(p.ink, 0.62) + '/>' +
          '<path d="M356 200 q44 -38 88 0 z" ' + solid(p.ink, 0.55) + '/>'
      };
    },

    qingqiu: function (p) {
      let blossom = "";
      for (let i = 0; i < 22; i++) {
        const x = 110 + (i * 67) % 580;
        const y = 34 + (i * 41) % 104;
        blossom += '<circle cx="' + x + '" cy="' + y + '" r="' + (1.8 + (i % 3) * 0.9) + '" fill="#f4efe1" opacity="0.7"/>';
      }
      return {
        far: svgMountains(p, 102, 42, p.far, 0.45),
        mid: '<path d="M420 210 q-12 -74 4 -116 q18 -46 8 -70" stroke="' + p.ink + '" stroke-width="18" fill="none" opacity="0.55"/>' +
          '<path d="M398 210 q-34 -62 -58 -82 M444 210 q42 -52 70 -78" stroke="' + p.ink + '" stroke-width="8" fill="none" opacity="0.4"/>' +
          '<ellipse cx="352" cy="66" rx="96" ry="34" ' + solid(p.ink, 0.26) + '/>' +
          '<ellipse cx="470" cy="52" rx="108" ry="38" ' + solid(p.ink, 0.3) + '/>' +
          '<ellipse cx="400" cy="86" rx="130" ry="30" ' + solid(p.ink, 0.22) + '/>' +
          blossom,
        near: svgGround(p, 186, 0.32) +
          '<path d="M612 196 q16 -16 32 0 q-5 9 -16 9 q-11 0 -16 -9 z" fill="#f4efe1" opacity="0.85"/>' +
          '<path d="M602 198 l-12 -18 M654 198 l12 -16" stroke="#f4efe1" stroke-width="2" opacity="0.65"/>'
      };
    }
  };

  function sceneSVG(p, kind) {
    const stars = p.star
      ? STARS.map((s) => '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="' + p.ink + '" opacity="' + s[3] + '"/>').join("")
      : "";
    const draw = SCENES[kind] || SCENES.mountain;
    const layers = draw(p);
    return '<svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice" class="scene-svg" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + p.sky[0] + '"/><stop offset="100%" stop-color="' + p.sky[1] + '"/>' +
      '</linearGradient>' +
      '<radialGradient id="scene-glow"><stop offset="0%" stop-color="' + p.orb + '" stop-opacity="0.34"/><stop offset="100%" stop-color="' + p.orb + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="scene-fog" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#f4efe1" stop-opacity="0"/><stop offset="100%" stop-color="#f4efe1" stop-opacity="0.55"/>' +
      '</linearGradient>' +
      '<radialGradient id="scene-vig" cx="50%" cy="48%" r="72%">' +
      '<stop offset="55%" stop-color="#201a12" stop-opacity="0"/><stop offset="100%" stop-color="#201a12" stop-opacity="0.28"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<g class="pl" data-depth="8">' +
        '<rect x="-40" y="-20" width="880" height="240" fill="url(#scene-sky)"/>' +
        stars +
        '<circle cx="656" cy="50" r="52" fill="url(#scene-glow)"/>' +
        '<circle cx="656" cy="50" r="20" fill="' + p.orb + '" opacity="0.92"/>' +
      '</g>' +
      '<g class="pl" data-depth="18">' + layers.far + '</g>' +
      '<rect x="-20" y="120" width="840" height="84" fill="url(#scene-fog)" opacity="0.25"/>' +
      '<g class="pl" data-depth="30">' + layers.mid + '</g>' +
      '<g class="pl" data-depth="44">' + layers.near + '</g>' +
      '<rect x="0" y="0" width="800" height="200" fill="url(#scene-vig)"/>' +
      '</svg>';
  }

  /* ================= 角色立绘（SVG 半身像） ================= */

  const PORTRAITS = {
    "阿禾": { skin: "#f0dcc4", hair: "#2f2b26", robe: "#7d9a8c", collar: "#e8e2d4", ink: "#3a362e", glow: "#a9c0b2", bun: true, herb: true },
    "苏漓": { skin: "#f4e6d8", hair: "#e4dfd3", robe: "#f2ecdd", collar: "#c9b98f", ink: "#5a5344", glow: "#e8cdff", ears: true },
    "赵乾": { skin: "#ecd3b6", hair: "#24211d", robe: "#8c6a2f", collar: "#f2ecdd", ink: "#2c2a26", glow: "#d9b45a", crown: true },
    "醉道人": { skin: "#e6c9a8", hair: "#6b6352", robe: "#6b6352", collar: "#d8d0bb", ink: "#3a362e", glow: "#d9a94a", gourd: true, beard: true },
    "守门人": { skin: "#dfe4e8", hair: "#3a3448", robe: "#5a4880", collar: "#e2d6ff", ink: "#e2d6ff", glow: "#b9a6e0", nails: true },
    "心魔": { skin: "#3a2a2c", hair: "#1c1618", robe: "#2a1e20", collar: "#8c2f2f", ink: "#e06a6a", glow: "#8c2f2f", eyes: true, eyeGlow: true },
    "仙使": { skin: "#f6ece0", hair: "#f2ecdd", robe: "#e8dcc0", collar: "#b8860b", ink: "#5a5344", glow: "#f6e8c9", halo: true }
  };

  const CAST_ORDER = ["阿禾", "苏漓", "赵乾", "醉道人", "守门人", "心魔", "仙使"];

  function portraitSVG(name) {
    const c = PORTRAITS[name];
    if (!c) return "";
    const extra = [];
    if (c.bun) extra.push('<ellipse cx="60" cy="22" rx="11" ry="7" fill="' + c.hair + '"/>' +
      '<path d="M49 24 h22" stroke="' + c.collar + '" stroke-width="1.6" opacity="0.8"/>');
    if (c.crown) extra.push('<path d="M44 30 L48 16 L55 26 L60 12 L65 26 L72 16 L76 30 Z" fill="' + c.collar + '" opacity="0.9"/>');
    if (c.herb) extra.push('<path d="M88 66 q11 -8 17 -2 q-9 11 -17 2 z" fill="#8fae7e" opacity="0.9"/>' +
      '<path d="M92 70 q6 6 3 12" stroke="#8fae7e" stroke-width="1.4" fill="none" opacity="0.8"/>');
    if (c.gourd) extra.push('<path d="M93 102 q11 4 9 16 q-2 11 -11 9 q-9 -2 -7 -13 q2 -11 9 -12 z" fill="' + c.collar + '" opacity="0.9"/>');
    if (c.beard) extra.push('<path d="M53 62 q7 20 14 0 q-7 7 -14 0 z" fill="' + c.hair + '" opacity="0.8"/>');
    if (c.halo) extra.push('<circle cx="60" cy="44" r="31" fill="none" stroke="' + c.collar + '" stroke-width="1.4" opacity="0.5"/>');
    if (c.nails) extra.push('<circle cx="47" cy="24" r="2.2" fill="' + c.ink + '"/><circle cx="60" cy="18" r="2.2" fill="' + c.ink + '"/><circle cx="73" cy="24" r="2.2" fill="' + c.ink + '"/>');
    if (c.ears) extra.push('<path d="M37 30 L29 10 L49 22 Z" fill="' + c.hair + '" opacity="0.95"/>' +
      '<path d="M83 30 L91 10 L71 22 Z" fill="' + c.hair + '" opacity="0.95"/>');
    if (c.eyeGlow) extra.push('<circle cx="53" cy="49" r="4" fill="' + c.ink + '" opacity="0.25"/><circle cx="67" cy="49" r="4" fill="' + c.ink + '" opacity="0.25"/>');

    return '<svg viewBox="0 0 120 150" aria-hidden="true">' +
      '<ellipse cx="60" cy="147" rx="45" ry="6" fill="' + c.glow + '" opacity="0.4"/>' +
      '<path d="M60 74 C 39 78 31 102 28 150 L92 150 C 89 102 81 78 60 74 Z" fill="' + c.robe + '"/>' +
      '<path d="M60 76 L50 98 L60 114 L70 98 Z" fill="' + c.collar + '" opacity="0.95"/>' +
      '<path d="M33 124 q27 8 54 0" stroke="' + c.collar + '" stroke-width="1.6" fill="none" opacity="0.35"/>' +
      '<path d="M55 56 h10 v20 h-10 z" fill="' + c.skin + '"/>' +
      '<path d="M60 18 C 42 18 35 34 36 54 C 37 68 42 76 46 80 L74 80 C 78 76 83 68 84 54 C 85 34 78 18 60 18 Z" fill="' + c.hair + '"/>' +
      '<path d="M60 26 C 49 26 44 37 44 47 C 44 57 51 65 60 65 C 69 65 76 57 76 47 C 76 37 71 26 60 26 Z" fill="' + c.skin + '"/>' +
      '<path d="M44 43 C 46 30 74 30 76 43 C 70 35 63 32 60 32 C 57 32 50 35 44 43 Z" fill="' + c.hair + '"/>' +
      '<path d="M46 42 q4 -2 8 0" stroke="' + c.hair + '" stroke-width="0.9" fill="none" opacity="0.5"/>' +
      '<path d="M66 42 q4 -2 8 0" stroke="' + c.hair + '" stroke-width="0.9" fill="none" opacity="0.5"/>' +
      (c.eyes
        ? '<path d="M50 49 l6 2.4 l-6 2.4 z" fill="' + c.ink + '"/><path d="M70 49 l-6 2.4 l6 2.4 z" fill="' + c.ink + '"/>'
        : '<path d="M50 48 q4 -2.4 8 0" stroke="' + c.ink + '" fill="none" stroke-width="1.4" stroke-linecap="round"/>' +
          '<path d="M62 48 q4 -2.4 8 0" stroke="' + c.ink + '" fill="none" stroke-width="1.4" stroke-linecap="round"/>') +
      '<path d="M60 52 v3" stroke="' + c.ink + '" stroke-width="0.9" opacity="0.45"/>' +
      '<path d="M57 58 q3 1.6 6 0" stroke="' + c.ink + '" fill="none" stroke-width="1.1" stroke-linecap="round" opacity="0.65"/>' +
      extra.join("") +
      '</svg>';
  }

  function countOccurrences(text, word) {
    if (!text || !word) return 0;
    let n = 0;
    let i = text.indexOf(word);
    while (i >= 0) { n += 1; i = text.indexOf(word, i + word.length); }
    return n;
  }

  function castFor(ev) {
    if (Array.isArray(ev.cast)) return ev.cast.filter((n) => PORTRAITS[n]).slice(0, 2);
    const s = (ev.scene || "") + " " + (ev.title || "");
    const direct = CAST_ORDER.filter((n) => s.indexOf(n) >= 0);
    if (direct.length) return direct.slice(0, 2);
    const text = ev.text || "";
    const hits = CAST_ORDER.filter((n) => countOccurrences(text, n) >= 2);
    return hits.slice(0, 2);
  }

  function renderPortraits(ev) {
    const layer = $("portrait-layer");
    if (!layer) return;
    const cast = castFor(ev);
    layer.innerHTML = cast.map((n, i) =>
      '<div class="portrait" style="animation-delay:' + (i * 90) + 'ms">' +
        portraitSVG(n) + '<span class="portrait-name">' + n + "</span></div>"
    ).join("");
  }

  /* 场景天气：按场景关键词给一层轻量氛围，不依赖任何素材 */
  const WEATHER_RULES = [
    [/雪|寒|冰|霜|冬/, "snow"],
    [/雨|雷|潮|雾|云/, "rain"],
    [/夜|月|星|灯|坟/, "firefly"],
    [/花|春|桃|青丘|狐/, "petal"]
  ];

  function weatherFor(ev) {
    if (ev.weather && ev.weather !== "none") return ev.weather;
    const s = (ev.scene || "") + (ev.title || "");
    for (const rule of WEATHER_RULES) {
      if (rule[0].test(s)) return rule[1];
    }
    return "";
  }

  function bindParallax() {
    const box = $("scene-visual");
    if (!box || box.dataset.parallax) return;
    box.dataset.parallax = "1";
    let raf = 0;
    const reset = () => {
      box.querySelectorAll(".pl").forEach((g) => { g.style.transform = ""; });
    };
    box.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = box.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        box.querySelectorAll(".pl").forEach((g) => {
          const d = parseFloat(g.getAttribute("data-depth")) || 0;
          g.style.transform = "translate(" + (dx * d).toFixed(2) + "px," + (dy * d * 0.55).toFixed(2) + "px)";
        });
      });
    });
    box.addEventListener("pointerleave", reset);
    box.addEventListener("pointercancel", reset);
  }

  function renderScene(ev) {
    const art = artFor(ev);
    const box = $("scene-art");
    box.innerHTML = sceneSVG(PALETTES[art], sceneKindFor(ev));
    box.style.animation = "none";
    void box.offsetWidth;
    box.style.animation = "sceneFade 0.5s ease";
    $("scene").textContent = ev.scene || "";
    renderPortraits(ev);
    const w = weatherFor(ev);
    const layer = $("weather");
    if (layer) {
      layer.className = "weather";
      if (w) layer.classList.add("weather-" + w);
    }
    bindParallax();
  }

  /* ================= 渲染 : 主界面 ================= */

  function setChapter(label) {
    if (!label) return;
    const el = $("chapter-label");
    if (!el || el.textContent === label) return;
    el.textContent = label;
    const banner = $("chapter-banner");
    if (banner) {
      banner.textContent = label;
      banner.classList.remove("show");
      void banner.offsetWidth;
      banner.classList.add("show");
    }
  }

  function resolveEventText(ev) {
    if (Array.isArray(ev.variants)) {
      for (const v of ev.variants) {
        if (!v.if || checkCond(v.if)) return v.text;
      }
    }
    return ev.text;
  }

  function renderEvent() {
    const ev = GAME_DATA.events[state.current];
    if (!ev) {
      start();
      return;
    }
    setChapter(ev.chapter || GAME_DATA.meta.chapter);
    $("realm").textContent = ev.realm || "炼气期";
    renderScene(ev);
    $("ending-note").textContent = "";

    const title = $("event-title");
    title.textContent = ev.title;
    title.className = "event-title";
    $("event-text").textContent = resolveEventText(ev);
    renderNpcReaction(ev);

    const box = $("options");
    box.innerHTML = "";
    ev.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "opt-btn";
      const ok = checkCond(opt.cond);
      const risk = opt.risk ? '<span class="opt-risk">⚠ ' + opt.risk + "</span>" : "";
      if (!ok) {
        btn.classList.add("locked");
        btn.innerHTML = '<span class="opt-text">' + opt.text + '</span><span class="opt-lock">【条件不足】' + condHint(opt.cond) + "</span>" + risk;
      } else {
        btn.innerHTML = '<span class="opt-text">' + opt.text + "</span>" + risk;
        btn.onclick = () => choose(i);
      }
      box.appendChild(btn);
    });

    renderRelations();
    renderAttrs();
    updateRunInfo();
    updateAchvBadge();
    checkAchievements();
  }
  function condHint(cond) {
    if (!cond) return "";
    const parts = [];
    if (cond.attr) for (const k in cond.attr) parts.push(k + "≥" + cond.attr[k]);
    if (cond.attrMax) for (const k in cond.attrMax) parts.push(k + "≤" + cond.attrMax[k]);
    if (cond.flags) for (const f of cond.flags) parts.push("需经历「" + f + "」");
    if (cond.anyFlags) parts.push("需经历「" + cond.anyFlags.join("」或「") + "」");
    if (cond.notFlags) for (const f of cond.notFlags) parts.push("未经历「" + f + "」");
    return parts.join("，");
  }

  function pathLabel() {
    const a = state.attrs;
    if ((a.杀戮 || 0) >= 35 && (a.杀戮 || 0) >= (a.心性 || 0) + 12) return "魔道 · 以杀证道";
    if ((a.心性 || 0) >= 40 && (a.心性 || 0) >= (a.杀戮 || 0) + 18) return "仁道 · 众生在心";
    if ((a.情缘 || 0) >= 28 && (a.情缘 || 0) >= (a.声望 || 0)) return "情道 · 有人同行";
    if ((a.声望 || 0) >= 42 && (a.声望 || 0) >= (a.修为 || 0)) return "霸业 · 众生俯首";
    if ((a.机缘 || 0) >= 42 && (a.机缘 || 0) >= (a.修为 || 0)) return "天机 · 顺天而行";
    if ((a.修为 || 0) >= 45) return "剑道 · 一力破万法";
    return "求道 · 未定之身";
  }

  function renderAttrs() {
    const panel = $("attr-list");
    panel.innerHTML = "";
    const peak = Math.max(ATTR_MAX, ...ATTR_ORDER.map((k) => state.attrs[k] || 0));
    ATTR_ORDER.forEach((k) => {
      const v = state.attrs[k] || 0;
      const row = document.createElement("div");
      row.className = "attr-row";
      row.innerHTML =
        '<span class="attr-name">' + k + "</span>" +
        '<div class="attr-bar"><div class="attr-fill attr-' + k + '" style="width:' + Math.min(100, (v / peak) * 100) + '%"></div></div>' +
        '<span class="attr-val">' + v + "</span>";
      panel.appendChild(row);
    });
    if ($("path-label")) $("path-label").textContent = pathLabel();
  }

  function showEffects(changes) {
    if (!changes || !changes.length) return;
    const box = $("toast-area");
    changes.forEach((c, idx) => {
      setTimeout(() => {
        const t = document.createElement("div");
        t.className = "toast " + (c.delta >= 0 ? "up" : "down");
        t.textContent = c.attr + " " + (c.delta >= 0 ? "+" : "") + c.delta;
        box.appendChild(t);
        setTimeout(() => t.remove(), 2200);
      }, idx * 320);
    });
  }

  function toast(text) {
    const box = $("toast-area");
    if (!box) return;
    const t = document.createElement("div");
    t.className = "toast info";
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  function scrollTop() {
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
  }

  /* ================= 结局判定 ================= */

  function endingsOf(tierKey) {
    return GAME_DATA[TIERS[tierKey].endings] || [];
  }

  function defaultOf(tierKey) {
    return GAME_DATA[TIERS[tierKey].def];
  }

  function evaluateTier(tierKey) {
    for (const e of endingsOf(tierKey)) {
      if (checkCond(e.cond || e)) return e;
    }
    return defaultOf(tierKey);
  }

  function totalEndingCount() {
    let n = 0;
    for (const k in TIERS) n += endingsOf(k).length + 1;
    return n;
  }

  /* ================= 结局图鉴存档 ================= */

  function loadCodex() {
    try {
      const raw = localStorage.getItem(CODEX_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveCodex(codex) {
    try { localStorage.setItem(CODEX_KEY, JSON.stringify(codex)); } catch (e) {}
  }

  function recordEnding(tierKey, ending) {
    const codex = loadCodex();
    if (!codex[tierKey]) codex[tierKey] = {};
    const isNew = !codex[tierKey][ending.name];
    if (isNew) {
      codex[tierKey][ending.name] = {
        desc: ending.desc,
        tone: ending.tone || "normal",
        at: Date.now()
      };
      saveCodex(codex);
    }
    return isNew;
  }

  function achievedCount() {
    const codex = loadCodex();
    let n = 0;
    for (const tierKey in TIERS) {
      const got = codex[tierKey] || {};
      endingsOf(tierKey).forEach((e) => { if (got[e.name]) n += 1; });
      if (got[defaultOf(tierKey).name]) n += 1;
    }
    return n;
  }

  function updateRunInfo() {
    if ($("run-no")) $("run-no").textContent = state.run || 1;
    if ($("codex-count")) $("codex-count").textContent = achievedCount() + " / " + totalEndingCount();
  }

  /* ================= 渲染 : 章末结算 ================= */

  function endingText(ending, epilogueKey) {
    let text = ending.desc;
    if (!epilogueKey) return text;
    const epi = GAME_DATA[epilogueKey] || {};
    const parts = [];
    state.flags.forEach((f) => {
      if (epi[f]) parts.push(epi[f]);
    });
    if (parts.length) {
      if (epilogueKey === "flagEpiloguesAscension") {
        text += "\n\n—— 此生因果，一一归位 ——\n" + parts.join("\n");
      } else {
        text += "\n\n" + parts.join("\n\n");
      }
    }
    return text;
  }

  function drawSettle(key) {
    const cfg = SETTLE_CONFIG[key];
    const ending = evaluateTier(cfg.tier);
    const isNew = recordEnding(cfg.tier, ending);
    markReached(cfg.tier);

    setChapter(cfg.chapterLabel);
    $("realm").textContent = cfg.realm;
    renderScene({ scene: cfg.scene, art: cfg.art });
    renderEndingFrame(cfg.titlePrefix + ending.name, ending, endingText(ending, cfg.epilogues), isNew);

    const box = $("options");
    box.innerHTML = "";
    const next = document.createElement("button");
    next.className = "opt-btn restart";
    next.innerHTML = '<span class="opt-text">' + cfg.nextLabel + "</span>";
    next.onclick = () => {
      state.current = cfg.nextEvent;
      state.view = { type: "event" };
      save();
      renderEvent();
      scrollTop();
    };
    box.appendChild(next);
    appendCommonButtons(box, "回顾本世抉择");
    checkAchievements();
  }

  /* ================= 渲染 : 真·终局 ================= */

  function drawEnding() {
    const ending = evaluateTier("final");
    const isNew = recordEnding("final", ending);
    markReached("final");

    setChapter("终章 · 飞升");
    $("realm").textContent = "飞升";
    renderScene({ scene: "终章 · " + ending.name, art: "celestial" });
    renderEndingFrame("终章 · " + ending.name, ending, endingText(ending, "flagEpiloguesAscension"), isNew);

    const box = $("options");
    box.innerHTML = "";
    const again = document.createElement("button");
    again.className = "opt-btn restart";
    again.innerHTML = '<span class="opt-text">再入轮回（重新开始）</span>';
    again.onclick = () => {
      if (confirm("确定要再入轮回吗？本世进度将清空，结局图鉴会保留。")) {
        clearSave();
        start();
      }
    };
    box.appendChild(again);
    appendCommonButtons(box, "回顾本世抉择");
    checkAchievements();
  }

  /* ================= 渲染 : 败亡 ================= */

  function deathEndingFor(cause) {
    const list = GAME_DATA.deathEndings || [];
    if (!cause) return GAME_DATA.defaultDeathEnding;
    const hit = list.find((e) => e.name === cause);
    return hit || GAME_DATA.defaultDeathEnding;
  }

  function drawDeath() {
    const cause = state.view && state.view.cause;
    const ending = deathEndingFor(cause);
    const isNew = recordEnding("death", ending);
    markReached("death");

    setChapter("败亡 · 道消身死");
    $("realm").textContent = "身死道消";
    renderScene({ scene: "败亡 · " + ending.name, art: "fire" });
    renderEndingFrame("败亡 · " + ending.name, ending, endingText(ending, "flagEpiloguesDeath"), isNew);

    const box = $("options");
    box.innerHTML = "";
    const again = document.createElement("button");
    again.className = "opt-btn restart";
    again.innerHTML = '<span class="opt-text">重入轮回（此生已断，再走一遭）</span>';
    again.onclick = () => {
      if (confirm("此生已断。要重入轮回吗？本世进度将清空，结局图鉴会保留。")) {
        clearSave();
        start();
      }
    };
    box.appendChild(again);
    appendCommonButtons(box, "回顾此生抉择");
    checkAchievements();
  }

  function renderEndingFrame(titleText, ending, text, isNew) {
    const title = $("event-title");
    title.textContent = titleText;
    title.className = "event-title tone-" + (ending.tone || "normal");
    $("event-text").textContent = text;

    const note = $("ending-note");
    if (isNew) {
      note.textContent = "✦ 新结局已收录 ·《" + ending.name + "》· 图鉴 " + achievedCount() + " / " + totalEndingCount();
      note.classList.add("fresh");
    } else {
      note.textContent = "此结局此前已收录 · 图鉴 " + achievedCount() + " / " + totalEndingCount();
      note.classList.remove("fresh");
    }
    renderAttrs();
    updateRunInfo();
  }

  function appendCommonButtons(box, reviewLabel) {
    if (canUndo()) {
      const undo = document.createElement("button");
      undo.className = "opt-btn ghost undo-btn";
      undo.innerHTML = '<span class="opt-text">↶ 退回上一步（撤销刚才的选择）</span>';
      undo.onclick = () => undoStep();
      box.appendChild(undo);
    }

    const review = document.createElement("button");
    review.className = "opt-btn ghost";
    review.innerHTML = '<span class="opt-text">' + reviewLabel + "（" + state.history.length + " 次）</span>";
    review.onclick = showHistory;
    box.appendChild(review);

    const codex = document.createElement("button");
    codex.className = "opt-btn ghost";
    codex.innerHTML = '<span class="opt-text">翻开结局图鉴（' + achievedCount() + " / " + totalEndingCount() + "）</span>";
    codex.onclick = openCodex;
    box.appendChild(codex);
  }

  /* ================= 抉择回顾 ================= */

  function showHistory() {
    const title = $("event-title");
    title.textContent = "本世抉择录";
    title.className = "event-title";
    const lines = state.history.map((h, i) => {
      const ev = GAME_DATA.events[h.event];
      return "【" + (i + 1) + "】" + (ev ? ev.title : h.event) + " → " + h.choice;
    });
    $("event-text").textContent = lines.length ? lines.join("\n") : "尚未做出任何选择。";

    const box = $("options");
    box.innerHTML = "";
    const back = document.createElement("button");
    back.className = "opt-btn ghost";
    back.innerHTML = '<span class="opt-text">← 返回</span>';
    back.onclick = () => { renderView(); scrollTop(); };
    box.appendChild(back);
  }

  function renderView() {
    const v = state.view || { type: "event" };
    if (v.type === "outcome") {
      drawOutcome([]);
      return;
    }
    if (v.type === "settle" && SETTLE_CONFIG[v.key]) {
      drawSettle(v.key);
      return;
    }
    if (v.type === "death") {
      drawDeath();
      return;
    }
    if (v.type === "ending") {
      drawEnding();
      return;
    }
    if (!GAME_DATA.events[state.current]) {
      state.current = GAME_DATA.startEvent;
      state.view = { type: "event" };
    }
    renderEvent();
  }

  /* ================= 结局图鉴 ================= */

  function openCodex() {
    const codex = loadCodex();
    const body = $("codex-body");
    let html = "";
    let got = 0;
    let total = 0;

    for (const tierKey in TIERS) {
      const tier = TIERS[tierKey];
      const gotTier = codex[tierKey] || {};
      const list = endingsOf(tierKey).slice();
      const def = defaultOf(tierKey);
      list.push(Object.assign({}, def, { isDefault: true }));

      let tierGot = 0;
      let cards = "";
      list.forEach((e) => {
        const rec = gotTier[e.name];
        total += 1;
        if (rec) {
          tierGot += 1;
          cards += '<article class="codex-card got tone-' + (rec.tone || e.tone || "normal") + '">' +
            '<div class="codex-name">' + e.name + '</div>' +
            '<div class="codex-desc">' + (rec.desc || e.desc) + '</div>' +
            '</article>';
        } else {
          const hint = e.isDefault ? "未满足任何专属条件时的结局" : (e.hint || condHint(e.cond) || "特殊条件");
          cards += '<article class="codex-card locked">' +
            '<div class="codex-name">？？？</div>' +
            '<div class="codex-desc">' + hint + '</div>' +
            '</article>';
        }
      });
      got += tierGot;
      html += '<section class="codex-tier"><h4>' + tier.label +
        '<span class="codex-tier-count">' + tierGot + " / " + list.length + "</span></h4>" +
        '<div class="codex-grid">' + cards + "</div></section>";
    }

    body.innerHTML = html;
    $("codex-progress").textContent = got + " / " + total;
    $("codex-overlay").hidden = false;
    document.body.classList.add("codex-open");
  }

  function closeCodex() {
    $("codex-overlay").hidden = true;
    document.body.classList.remove("codex-open");
  }

  /* ================= 成就 ================= */

  const META_KEY = "wendao_meta_v1";

  function emptyMeta() {
    return { runs: 0, deaths: 0, undo: 0, revive: 0, slot: 0, reached: [], flagsSeen: [], unlocked: {} };
  }

  function loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return emptyMeta();
      const m = JSON.parse(raw) || {};
      const out = emptyMeta();
      ["runs", "deaths", "undo", "revive", "slot"].forEach((k) => { out[k] = Number(m[k]) || 0; });
      if (Array.isArray(m.reached)) out.reached = m.reached.slice();
      if (Array.isArray(m.flagsSeen)) out.flagsSeen = m.flagsSeen.slice();
      if (m.unlocked && typeof m.unlocked === "object") out.unlocked = m.unlocked;
      return out;
    } catch (e) {
      return emptyMeta();
    }
  }

  function saveMeta(m) {
    try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {}
  }

  function bumpMeta(key) {
    const m = loadMeta();
    m[key] = (m[key] || 0) + 1;
    saveMeta(m);
    return m[key];
  }

  function markReached(tier) {
    const m = loadMeta();
    if (m.reached.indexOf(tier) < 0) {
      m.reached.push(tier);
      saveMeta(m);
    }
  }

  function achievementCtx() {
    const m = loadMeta();
    const codex = loadCodex();
    return {
      state: state,
      meta: m,
      codexCount: achievedCount(),
      reached: new Set(m.reached),
      flagsSeen: new Set(m.flagsSeen),
      endingOf: (tier, name) => !!(codex[tier] && codex[tier][name])
    };
  }

  function evalClause(c, ctx) {
    if (!c) return false;
    if (Array.isArray(c.all)) return c.all.every((x) => evalClause(x, ctx));
    if (Array.isArray(c.any)) return c.any.some((x) => evalClause(x, ctx));
    let hit = false;
    if (c.flags) { hit = true; for (const f of c.flags) if (ctx.state.flags.indexOf(f) < 0) return false; }
    if (c.anyFlags) { hit = true; if (!c.anyFlags.some((f) => ctx.state.flags.indexOf(f) >= 0)) return false; }
    if (c.notFlags) { hit = true; for (const f of c.notFlags) if (ctx.state.flags.indexOf(f) >= 0) return false; }
    if (c.attr) { hit = true; for (const k in c.attr) if ((ctx.state.attrs[k] || 0) < c.attr[k]) return false; }
    if (c.reached) { hit = true; if (!ctx.reached.has(c.reached)) return false; }
    if (c.ending) { hit = true; if (!ctx.endingOf(c.ending.tier, c.ending.name)) return false; }
    if (typeof c.codex === "number") { hit = true; if (ctx.codexCount < c.codex) return false; }
    if (typeof c.runs === "number") { hit = true; if ((ctx.meta.runs || 0) < c.runs) return false; }
    if (c.stat) { hit = true; if ((ctx.meta[c.stat.key] || 0) < (c.stat.min || 1)) return false; }
    if (c.flagsSeen) { hit = true; for (const f of c.flagsSeen) if (!ctx.flagsSeen.has(f)) return false; }
    return hit;
  }

  function achvCount() {
    const m = loadMeta();
    const list = GAME_DATA.achievements || [];
    return list.filter((a) => m.unlocked[a.id]).length;
  }

  function updateAchvBadge() {
    const el = $("achv-count");
    if (el) el.textContent = achvCount() + " / " + ((GAME_DATA.achievements || []).length || 0);
  }

  function checkAchievements() {
    const list = GAME_DATA.achievements || [];
    if (!list.length || !state) return [];
    const meta = loadMeta();
    let dirty = false;
    state.flags.forEach((f) => {
      if (meta.flagsSeen.indexOf(f) < 0) { meta.flagsSeen.push(f); dirty = true; }
    });
    if (dirty) saveMeta(meta);
    const ctx = achievementCtx();
    const fresh = [];
    for (const a of list) {
      if (meta.unlocked[a.id]) continue;
      if (!evalClause(a.cond, ctx)) continue;
      meta.unlocked[a.id] = Date.now();
      fresh.push(a);
    }
    if (fresh.length) {
      saveMeta(meta);
      updateAchvBadge();
      renderAchvIfOpen();
      fresh.forEach((a, i) => {
        setTimeout(() => toast("★ 成就解锁 ·「" + a.name + "」"), 300 + i * 450);
      });
    }
    return fresh;
  }

  function renderAchv() {
    const body = $("achv-body");
    if (!body) return;
    const meta = loadMeta();
    const groups = GAME_DATA.achievementGroups || ["成就"];
    const list = GAME_DATA.achievements || [];
    let html = "";
    groups.forEach((group) => {
      const items = list.filter((a) => a.group === group);
      if (!items.length) return;
      const got = items.filter((a) => meta.unlocked[a.id]).length;
      let cards = "";
      items.forEach((a) => {
        const on = !!meta.unlocked[a.id];
        const when = on ? new Date(meta.unlocked[a.id]).toLocaleDateString("zh-CN") : "";
        cards += '<article class="achv-card' + (on ? " got" : " locked") + '">' +
          '<div class="achv-icon">' + (on ? (a.icon || "★") : "？") + "</div>" +
          '<div class="achv-main">' +
            '<div class="achv-name">' + (on ? a.name : "未解锁") + "</div>" +
            '<div class="achv-desc">' + a.desc + "</div>" +
            (on && when ? '<div class="achv-date">' + when + " 解锁</div>" : "") +
          "</div></article>";
      });
      html += '<section class="achv-group"><h4>' + group +
        '<span class="achv-group-count">' + got + " / " + items.length + "</span></h4>" +
        '<div class="achv-grid">' + cards + "</div></section>";
    });
    body.innerHTML = html;
    const total = list.length;
    const gotAll = list.filter((a) => meta.unlocked[a.id]).length;
    if ($("achv-progress")) $("achv-progress").textContent = gotAll + " / " + total;
  }

  function renderAchvIfOpen() {
    const ov = $("achv-overlay");
    if (ov && !ov.hidden) renderAchv();
  }

  function openAchv() {
    renderAchv();
    const ov = $("achv-overlay");
    if (ov) ov.hidden = false;
    document.body.classList.add("codex-open");
  }

  function closeAchv() {
    const ov = $("achv-overlay");
    if (ov) ov.hidden = true;
    document.body.classList.remove("codex-open");
  }

  /* ================= 人物态度 ================= */

  const ATTITUDE_CHARS = ["阿禾", "苏漓", "赵乾"];
  const ATTITUDE_LABELS = { "-2": "决裂", "-1": "疏远", "0": "平淡", "1": "亲近", "2": "生死相托" };
  const ATTITUDE_RULES = {
    "阿禾": [
      [-2, { anyFlags: ["屠狐", "投名状", "血池洗礼"] }],
      [-1, { anyFlags: ["袖手旁观"] }],
      [2, { flags: ["药庐同心"] }],
      [1, { anyFlags: ["药王谷之恩", "青崖善缘", "阿禾之约"] }],
      [0, null]
    ],
    "苏漓": [
      [-2, { flags: ["屠狐"] }],
      [-1, { anyFlags: ["袖手旁观"] }],
      [2, { flags: ["青丘同契"] }],
      [1, { anyFlags: ["狐妖之恩", "青丘信物", "狐侣同行"] }],
      [0, null]
    ],
    "赵乾": [
      [-2, { flags: ["赵乾之怨"], notFlags: ["渡魔", "赵乾悔悟"] }],
      [2, { anyFlags: ["渡魔", "赵乾悔悟"] }],
      [1, { anyFlags: ["道心可托", "弟子守山"] }],
      [0, null]
    ]
  };

  function attitudeTier(name) {
    const rules = ATTITUDE_RULES[name] || [];
    for (const rule of rules) {
      if (!rule[1] || checkCond(rule[1])) return rule[0];
    }
    return 0;
  }

  function attitudeBand(tier) {
    if (tier <= -1) return "cold";
    if (tier >= 1) return "warm";
    return "calm";
  }

  function renderRelations() {
    const box = $("relations");
    if (!box) return;
    box.innerHTML = ATTITUDE_CHARS.map((name) => {
      const tier = attitudeTier(name);
      const band = attitudeBand(tier);
      const pct = Math.round(((tier + 2) / 4) * 100);
      return '<div class="rel-row rel-' + band + '">' +
        '<span class="rel-name">' + name + "</span>" +
        '<span class="rel-bar"><span class="rel-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="rel-label">' + (ATTITUDE_LABELS[String(tier)] || "平淡") + "</span></div>";
    }).join("");
  }

  function renderNpcReaction(ev) {
    const box = $("npc-react");
    if (!box) return;
    const table = GAME_DATA.attitudeLines || {};
    const entry = table[state.current];
    if (!entry) { box.hidden = true; return; }
    const name = ATTITUDE_CHARS.find((n) => entry[n]) || Object.keys(entry)[0];
    const lines = entry[name] || {};
    const band = attitudeBand(attitudeTier(name));
    const line = lines[band] || lines.calm;
    if (!line) { box.hidden = true; return; }
    $("npc-name").textContent = name;
    $("npc-line").textContent = line;
    box.className = "npc-react " + band;
    box.hidden = false;
  }

  /* ================= 琴音（WebAudio 生成，无音频文件） ================= */

  const Sound = {
    ctx: null,
    master: null,
    timer: null,
    on: false,
    armed: false,
    scale: [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0],

    supported: function () {
      return typeof window.AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined";
    },

    begin: function () {
      if (!this.supported() || this.ctx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        this.ctx.resume();
        this.tick();
        this.timer = setInterval(() => this.tick(), 1500);
        this.on = true;
        this.armed = false;
      } catch (e) {
        this.ctx = null;
        this.master = null;
        this.on = false;
        this.armed = false;
      }
      this.refreshButton();
    },

    start: function () {
      this.on = true;
      this.armed = false;
      this.begin();
    },

    stop: function () {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (this.ctx) {
        try { this.ctx.close(); } catch (e) {}
      }
      this.ctx = null;
      this.master = null;
      this.on = false;
      this.armed = false;
      this.refreshButton();
    },

    tick: function () {
      if (!this.ctx || !this.master) return;
      if (document.hidden) return;
      if (Math.random() < 0.28) return;
      const now = this.ctx.currentTime + 0.02;
      const freq = this.scale[Math.floor(Math.random() * this.scale.length)];
      this.pluck(freq, now, 2.6, 0.11);
      if (Math.random() < 0.18) {
        const f2 = this.scale[Math.floor(Math.random() * this.scale.length)] * 2;
        this.pluck(f2, now + 0.34, 2.2, 0.05);
      }
    },

    pluck: function (freq, when, dur, vol) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sine";
      osc.frequency.value = freq;
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(vol, when + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    },

    toggle: function () {
      if (!this.supported()) return;
      if (this.on || this.armed) this.stop();
      else this.start();
      try { localStorage.setItem(SOUND_KEY, this.on ? "1" : "0"); } catch (e) {}
    },

    refreshButton: function () {
      const btn = $("btn-sound");
      if (!btn) return;
      btn.classList.toggle("active", this.on || this.armed);
      btn.textContent = this.on || this.armed ? "♪ 琴音 · 开" : "♪ 琴音 · 关";
    }
  };

  /* ================= 存档 ================= */

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function normalizeState(s) {
    if (!s || typeof s !== "object") return null;
    if (!s.attrs || !Array.isArray(s.flags) || !Array.isArray(s.history)) return null;
    if (!s.view) s.view = { type: "event" };
    if (!s.run) s.run = 1;
    if (!Array.isArray(s.snapshots)) s.snapshots = [];
    if (s.view.type === "outcome") {
      const n = s.view.next;
      const validNext = n === "__DEATH__" || n === "__ENDING__" ||
        (typeof n === "string" && n.indexOf("__SETTLE_") === 0 && SETTLE_CONFIG[n]) ||
        (typeof n === "string" && !!GAME_DATA.events[n]);
      if (!s.view.text || !validNext) s.view = { type: "event" };
    }
    if (s.view.type === "settle" && !SETTLE_CONFIG[s.view.key]) s.view = { type: "event" };
    if (s.view.type === "death" && !s.view.cause) s.view = { type: "event" };
    if (s.view.type === "event" && !GAME_DATA.events[s.current]) return null;
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return normalizeState(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  /* ---------- 手动存档位（三个，独立于自动存档） ---------- */

  const CHAPTER_REALM = {
    "序章": "炼气期", "第一章": "炼气期", "第二章": "筑基期", "第三章": "金丹期",
    "第四章": "元婴期", "第五章": "化神期", "第六章": "渡劫期", "终章": "飞升"
  };

  function realmOf(chapter) {
    for (const k in CHAPTER_REALM) {
      if (chapter && chapter.indexOf(k) === 0) return CHAPTER_REALM[k];
    }
    return "";
  }

  function loadSlots() {
    try {
      const raw = localStorage.getItem(SLOTS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function persistSlots(slots) {
    try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch (e) {}
  }

  function cloneState() {
    return {
      attrs: Object.assign({}, state.attrs),
      flags: state.flags.slice(),
      current: state.current,
      history: state.history.slice(),
      run: state.run || 1,
      view: Object.assign({}, state.view),
      snapshots: []
    };
  }

  function slotMeta() {
    const ev = GAME_DATA.events[state.current] || {};
    const v = state.view || {};
    let chapter = ev.chapter || GAME_DATA.meta.chapter || "";
    let realm = ev.realm || realmOf(chapter);
    let title = ev.title || "";
    if (v.type === "settle" && SETTLE_CONFIG[v.key]) {
      const cfg = SETTLE_CONFIG[v.key];
      chapter = cfg.chapterLabel;
      realm = cfg.realm;
      title = "章末结算";
    } else if (v.type === "death") {
      chapter = "败亡 · 道消身死";
      realm = "身死道消";
      title = "败亡";
    } else if (v.type === "ending") {
      chapter = "终章 · 飞升";
      realm = "飞升";
      title = "终章";
    }
    return { chapter: chapter, realm: realm, title: title, history: state.history.length, run: state.run || 1 };
  }

  function writeSlot(i) {
    const slots = loadSlots();
    slots[i] = { at: Date.now(), meta: slotMeta(), state: cloneState() };
    persistSlots(slots);
    bumpMeta("slot");
    renderSlots();
    toast("已存入存档位 " + i);
    checkAchievements();
  }

  function readSlot(i) {
    const slots = loadSlots();
    const rec = slots[i];
    if (!rec || !rec.state) return;
    if (!confirm("读取存档位 " + i + "？当前未手动保存的进度会被覆盖。")) return;
    const s = normalizeState(JSON.parse(JSON.stringify(rec.state)));
    if (!s) { toast("存档位 " + i + " 已损坏"); return; }
    state = s;
    save();
    closeSlots();
    renderView();
    refreshTopbar();
    scrollTop();
    toast("已读取存档位 " + i);
  }

  function deleteSlot(i) {
    const slots = loadSlots();
    if (!slots[i]) return;
    if (!confirm("删除存档位 " + i + "？")) return;
    delete slots[i];
    persistSlots(slots);
    renderSlots();
    toast("已删除存档位 " + i);
  }

  function renderSlots() {
    const body = $("slot-body");
    if (!body) return;
    const slots = loadSlots();
    let html = "";
    for (let i = 1; i <= 3; i++) {
      const rec = slots[i];
      const filled = !!(rec && rec.state);
      const m = (rec && rec.meta) || {};
      const when = rec && rec.at ? new Date(rec.at).toLocaleString("zh-CN", { hour12: false }) : "";
      html += '<article class="slot-card' + (filled ? "" : " empty") + '">' +
        '<div class="slot-no">存档位 ' + i + "</div>" +
        (filled
          ? '<div class="slot-info">' + (m.chapter || "未知章节") + "</div>" +
            '<div class="slot-detail">' + (m.realm || "") + " · " + (m.title || "") + "</div>" +
            '<div class="slot-meta">已抉择 ' + (m.history || 0) + " 次 · 第 " + (m.run || 1) + " 世 · " + when + "</div>"
          : '<div class="slot-info empty-text">尚未使用</div>' +
            '<div class="slot-detail">这一位还空着</div>') +
        '<div class="slot-actions">' +
          '<button class="mini-btn" data-slot-save="' + i + '">存入</button>' +
          '<button class="mini-btn" data-slot-load="' + i + '"' + (filled ? "" : " disabled") + ">读取</button>" +
          '<button class="mini-btn" data-slot-del="' + i + '"' + (filled ? "" : " disabled") + ">删除</button>" +
        "</div></article>";
    }
    body.innerHTML = html;
    body.querySelectorAll("[data-slot-save]").forEach((b) => { b.onclick = () => writeSlot(Number(b.getAttribute("data-slot-save"))); });
    body.querySelectorAll("[data-slot-load]").forEach((b) => { b.onclick = () => readSlot(Number(b.getAttribute("data-slot-load"))); });
    body.querySelectorAll("[data-slot-del]").forEach((b) => { b.onclick = () => deleteSlot(Number(b.getAttribute("data-slot-del"))); });
  }

  function openSlots() {
    renderSlots();
    const ov = $("slot-overlay");
    if (ov) ov.hidden = false;
    document.body.classList.add("codex-open");
  }

  function closeSlots() {
    const ov = $("slot-overlay");
    if (ov) ov.hidden = true;
    document.body.classList.remove("codex-open");
  }

  function refreshTopbar() {
    const btn = $("btn-undo");
    if (!btn) return;
    const n = state && Array.isArray(state.snapshots) ? state.snapshots.length : 0;
    btn.disabled = n === 0;
    btn.title = n ? "退回上一步（可回退最近 " + n + " 步）" : "暂无可回退的步骤";
  }

  /* ================= 启动 ================= */

  function start() {
    const run = (state && state.run ? state.run : 0) + 1;
    state = newState(run);
    bumpMeta("runs");
    save();
    renderView();
    refreshTopbar();
    updateAchvBadge();
    scrollTop();
  }

  function boot() {
    const s = load();
    if (s) {
      state = s;
      renderView();
    } else {
      start();
    }
    updateRunInfo();
    Sound.refreshButton();
    refreshTopbar();
    updateAchvBadge();

    $("btn-restart").onclick = () => {
      if (confirm("确定要重新入轮回吗？本世进度将清空，结局图鉴会保留。")) {
        clearSave();
        start();
      }
    };
    $("btn-codex").onclick = openCodex;
    $("codex-close").onclick = closeCodex;
    $("codex-overlay").addEventListener("click", (e) => {
      if (e.target === $("codex-overlay")) closeCodex();
    });
    const btnAchv = $("btn-achv");
    if (btnAchv) btnAchv.onclick = openAchv;
    const achvClose = $("achv-close");
    if (achvClose) achvClose.onclick = closeAchv;
    const achvOverlay = $("achv-overlay");
    if (achvOverlay) achvOverlay.addEventListener("click", (e) => {
      if (e.target === achvOverlay) closeAchv();
    });
    const btnUndo = $("btn-undo");
    if (btnUndo) btnUndo.onclick = () => { if (!undoStep()) toast("已经回到起点了"); };
    const btnSave = $("btn-save");
    if (btnSave) btnSave.onclick = openSlots;
    const slotClose = $("slot-close");
    if (slotClose) slotClose.onclick = closeSlots;
    const slotOverlay = $("slot-overlay");
    if (slotOverlay) slotOverlay.addEventListener("click", (e) => {
      if (e.target === slotOverlay) closeSlots();
    });
    $("btn-sound").onclick = () => Sound.toggle();
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if ($("slot-overlay") && !$("slot-overlay").hidden) { closeSlots(); return; }
      if ($("achv-overlay") && !$("achv-overlay").hidden) { closeAchv(); return; }
      if (!$("codex-overlay").hidden) closeCodex();
    });

    // 浏览器要求手势后才能出声：上次偏好开启时，首次点击页面再启奏
    let prefOn = false;
    try { prefOn = localStorage.getItem(SOUND_KEY) === "1"; } catch (e) {}
    if (prefOn && Sound.supported()) {
      Sound.on = true;
      Sound.armed = true;
      Sound.refreshButton();
      const kick = (e) => {
        document.removeEventListener("pointerdown", kick);
        if (e.target && e.target.closest && e.target.closest("#btn-sound")) return;
        if (Sound.armed) Sound.begin();
      };
      document.addEventListener("pointerdown", kick);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // 调试用接口（不影响游戏）
  window.WENDAO = {
    getState: () => state,
    renderView: renderView,
    data: GAME_DATA,
    choose: choose,
    checkCond: checkCond,
    resolveNext: resolveNext,
    undo: undoStep,
    canUndo: canUndo,
    continue: resolveOutcome,
    echoFor: echoFor,
    saveSlot: writeSlot,
    loadSlot: readSlot,
    slots: loadSlots
  };
})();
