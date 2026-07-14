'use strict';

// ============================================================
// 『サハラで袖を切れ』 エンジン + UI
// 画面遷移: title → prep → run(day/night ×7) → result
// ============================================================

const app = document.getElementById('app');

// ---------- 乱数(シード付き) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- ヘルパ(イベントから使う) ----------
const H = {
  // 装備の現在段階からリスクタグを合算
  tag(s, name) {
    let v = 0;
    GEAR.forEach((g, i) => { v += g.stages[s.gear[i]].tags[name] || 0; });
    return v;
  },
  weight(s) {
    return GEAR.reduce((sum, g, i) => sum + g.stages[s.gear[i]].g, 0);
  },
  rand(s) { return s.rng(); },
  // 効果適用 + 表示行生成
  ap(s, eff, flavor) {
    const lines = [];
    if (flavor) lines.push({ t: 'flavor', text: flavor });
    const map = { sta: '体力', feet: '足', mind: '精神力' };
    for (const k of ['sta', 'feet', 'mind']) {
      const v = eff[k];
      if (!v) continue;
      s[k] = Math.min(100, s[k] + v);
      lines.push({ t: v > 0 ? 'gain' : 'loss', text: `${map[k]} ${v > 0 ? '+' : ''}${v}` });
    }
    if (eff.time) {
      s.time += eff.time;
      lines.push({ t: 'loss', text: `+${eff.time}分のロス` });
    }
    return lines;
  },
};

// ---------- 実績・ベストスコア(localStorage) ----------
const STORE_KEY = 'sahara_v1';
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveStore(st) { localStorage.setItem(STORE_KEY, JSON.stringify(st)); }

// ---------- 表示ユーティリティ ----------
function fmtTime(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}時間${String(m).padStart(2, '0')}分`;
}
function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.firstElementChild;
}

// ============================================================
// 画面: タイトル
// ============================================================
function renderTitle() {
  document.body.className = 'phase-title';
  const store = loadStore();
  const achCount = Object.keys(store.ach || {}).length;
  const best = store.best;
  app.innerHTML = `
    <div class="title-screen">
      <p class="title-kicker">限界突破ライフハック presents</p>
      <h1 class="title-logo">サハラで<span class="accent">袖</span>を切れ</h1>
      <p class="title-sub">装備削ぎ落としローグライク</p>
      <p class="title-desc">7日間・264kmの砂漠マラソン。<br>ザックが重すぎて、このままでは出走できない。<br>切れ。折れ。捨てろ。ただし——ツケは、あとで来る。</p>
      <div class="title-buttons">
        <button class="btn primary" id="btn-daily">今日のサハラに挑む<span class="btn-note">デイリー(全員同じ砂漠)</span></button>
        <button class="btn" id="btn-free">フリーラン<span class="btn-note">毎回ランダム</span></button>
      </div>
      <div class="title-records">
        ${best ? `<p>自己ベスト: ${fmtTime(best.time)}(${(best.weight / 1000).toFixed(2)}kg)</p>` : '<p>まだ完走記録なし</p>'}
        <p>実績 ${achCount} / ${ACHIEVEMENTS.length}</p>
      </div>
    </div>`;
  document.getElementById('btn-daily').onclick = () => startPrep('daily');
  document.getElementById('btn-free').onclick = () => startPrep('free');
}

// ============================================================
// 画面: 準備(装備削ぎ落とし)
// ============================================================
let prep = null;

function startPrep(mode) {
  const seedStr = mode === 'daily' ? `sahara-${todayStr()}` : `sahara-${Math.random()}`;
  prep = { mode, seedStr, gear: GEAR.map(() => 0) };
  renderPrep();
}

function prepWeight() {
  return GEAR.reduce((sum, g, i) => sum + g.stages[prep.gear[i]].g, 0);
}

function renderPrep() {
  document.body.className = 'phase-prep';
  const w = prepWeight();
  const ok = w <= WEIGHT_LIMIT;
  const risks = [];
  GEAR.forEach((g, i) => risks.push(...g.stages[prep.gear[i]].risk));
  app.innerHTML = `
    <div class="prep-screen">
      <h2 class="screen-title">出発前夜 — 装備の削ぎ落とし</h2>
      <p class="screen-sub">ザックが重すぎる。<b>${(WEIGHT_LIMIT / 1000).toFixed(1)}kg以下</b>にしないと出走できない。装備をタップして切り刻め。</p>
      <div class="weight-panel">
        <div class="weight-row">
          <span>背負う重量</span>
          <span class="weight-num ${ok ? 'ok' : 'over'}">${(w / 1000).toFixed(2)}kg</span>
        </div>
        <div class="weight-bar"><div class="weight-fill ${ok ? 'ok' : 'over'}" style="width:${Math.min(100, (w / 10000) * 100)}%"></div><div class="weight-limit" style="left:${(WEIGHT_LIMIT / 10000) * 100}%"></div></div>
      </div>
      <div class="gear-grid" id="gear-grid"></div>
      <div class="prep-footer">
        <div class="risk-list">${risks.length ? '背負ったリスク: ' + risks.map((r) => `<span class="risk-chip">${r}</span>`).join('') : '背負ったリスク: なし'}</div>
        <div class="prep-actions">
          <button class="btn small" id="btn-back">タイトルへ</button>
          <button class="btn primary" id="btn-start" ${ok ? '' : 'disabled'}>${ok ? 'スタートラインへ →' : `あと ${((w - WEIGHT_LIMIT) / 1000).toFixed(2)}kg 削れ`}</button>
        </div>
      </div>
    </div>`;

  const grid = document.getElementById('gear-grid');
  GEAR.forEach((g, i) => {
    const st = g.stages[prep.gear[i]];
    const cut = prep.gear[i] > 0;
    const last = prep.gear[i] === g.stages.length - 1;
    const card = el(`
      <div class="gear-card ${cut ? 'cut' : ''}">
        <div class="gear-head"><span class="gear-icon">${g.icon}</span><span class="gear-name">${g.name}</span><span class="gear-weight ${cut ? 'lighter' : ''}">${st.g}g</span></div>
        <div class="gear-stage">✂ ${st.label}<span class="gear-action">${last ? '戻す' : '切る'}</span></div>
        ${st.risk.length ? `<div class="gear-risks">${st.risk.map((r) => `<span class="risk-chip">${r}</span>`).join('')}</div>` : ''}
      </div>`);
    card.onclick = () => { prep.gear[i] = (prep.gear[i] + 1) % g.stages.length; renderPrep(); };
    grid.appendChild(card);
  });

  document.getElementById('btn-back').onclick = renderTitle;
  document.getElementById('btn-start').onclick = () => { if (prepWeight() <= WEIGHT_LIMIT) startRun(); };
}

// ============================================================
// ラン本体
// ============================================================
let S = null; // ランの状態

function startRun() {
  S = {
    mode: prep.mode,
    rng: mulberry32(seedFromString(prep.seedStr)),
    gear: prep.gear.slice(),
    day: 0,
    phase: 'daystart', // daystart → dayevent → night → sleep
    sta: 100, feet: 100, mind: 100,
    time: 0, km: 0,
    startWeight: null,
    flags: {},
    usedDay: [], usedNight: [],
    retired: false, finished: false,
    eventsLeftToday: 0,
  };
  S.startWeight = H.weight(S);
  stepDayStart();
}

function statDead() {
  if (S.sta <= 0) return { stat: '体力', reason: '熱中症で医療テントに収容された。ドクターの目が「よく頑張った」と言っている。' };
  if (S.feet <= 0) return { stat: '足', reason: '足裏が限界を迎え、ドクターストップ。マメは、育てるとこうなる。' };
  if (S.mind <= 0) return { stat: '精神力', reason: '「なんで俺、こんなことしてるんだろう」——ふと我に返ってしまった。砂漠で我に返ってはいけない。' };
  return null;
}

// --- 日中開始: 重量に応じたドレイン + 移動時間加算 ---
function stepDayStart() {
  const d = DAYS[S.day];
  const kg = H.weight(S) / 1000;
  const staDrain = Math.round(10 + kg * 1.9 + (d.long ? 14 : 0));
  const feetDrain = Math.round(d.km / 7);
  const mindDrain = d.long ? 9 : 5;
  const pace = 8.5 + kg * 0.45 + (100 - S.sta) * 0.025 + (100 - S.feet) * 0.02;
  const moveMin = Math.round(d.km * pace);

  S.sta -= staDrain;
  S.feet -= feetDrain;
  S.mind -= mindDrain;
  S.time += moveMin;
  S.eventsLeftToday = d.long ? 2 : S.rng() < 0.45 ? 2 : 1;

  const lines = [
    { t: 'flavor', text: d.desc },
    { t: 'loss', text: `体力 -${staDrain}(ザック ${kg.toFixed(2)}kg)` },
    { t: 'loss', text: `足 -${feetDrain}(${d.km}km)` },
    { t: 'loss', text: `精神力 -${mindDrain}(暑さと単調な砂)` },
    { t: 'info', text: `本日の移動: 約${fmtTime(moveMin)}` },
  ];
  renderCard({
    phase: 'day', kicker: `DAY ${S.day + 1} / 7 ・ 日中`,
    title: `${d.name} — ${d.km}km`,
    lines,
    next: () => { if (!checkRetire()) stepDayEvent(); },
  });
}

// --- イベント抽選 ---
function pickEvent(pool, used) {
  const forced = pool.find((e) => e.forced && (!e.cond || e.cond(S, H)) && !used.includes(e.id));
  if (forced) { used.push(forced.id); return forced; }
  let cands = pool.filter((e) => !e.forced && !used.includes(e.id) && (!e.cond || e.cond(S, H)));
  if (!cands.length) cands = pool.filter((e) => !e.forced && (!e.cond || e.cond(S, H)));
  const ev = cands[Math.floor(S.rng() * cands.length)];
  used.push(ev.id);
  return ev;
}

function stepDayEvent() {
  if (S.eventsLeftToday <= 0) { stepNight(); return; }
  S.eventsLeftToday--;
  runEvent(pickEvent(DAY_EVENTS, S.usedDay), 'day', () => { if (!checkRetire()) stepDayEvent(); });
}

function stepNight() {
  runEvent(pickEvent(NIGHT_EVENTS, S.usedNight), 'night', () => { if (!checkRetire()) stepSleep(); });
}

// --- 就寝・回復 ---
function stepSleep() {
  const foodlv = H.tag(S, 'foodlv');
  const rec = SLEEP_RECOVERY[foodlv];
  const meal = H.tag(S, 'coldmeal');
  const cold = Math.min(H.tag(S, 'cold'), 4);
  const mindAdj = meal === 0 ? 3 : meal === 1 ? 1 : -2;
  const lines = [];
  const mealText = ['ストーブで温めた飯が五臓六腑に染みる。', '固形燃料でぬるく温めた飯。ないよりずっといい。', '冷たい飯を無言で流し込む。900g軽い代償だ。'][meal];
  lines.push({ t: 'flavor', text: mealText });
  lines.push(...H.ap(S, { sta: rec.sta - cold * 3, mind: rec.mind + mindAdj, feet: 3 }));
  if (cold > 0) lines.push({ t: 'info', text: '切り詰めた寝袋の隙間から体温が逃げ、眠りが浅い。' });
  if (foodlv >= 2) lines.push({ t: 'info', text: '食料を削った分、回復が鈍い。' });

  S.km += DAYS[S.day].km;

  renderCard({
    phase: 'night', kicker: `DAY ${S.day + 1} / 7 ・ 就寝`,
    title: '一日が終わる',
    lines,
    nextLabel: S.day === DAYS.length - 1 ? 'ゴールへ' : '翌朝へ',
    next: () => {
      if (checkRetire()) return;
      S.day++;
      if (S.day >= DAYS.length) { S.finished = true; renderResult(); } else stepDayStart();
    },
  });
}

function checkRetire() {
  const dead = statDead();
  if (!dead) return false;
  S.retired = true;
  S.retireInfo = dead;
  renderResult();
  return true;
}

// --- イベント実行(選択肢 or 自動) ---
function runEvent(ev, phase, done) {
  const base = {
    phase, kicker: `DAY ${S.day + 1} / 7 ・ ${phase === 'day' ? '日中' : '夜'}`,
    title: ev.title, text: ev.text,
  };
  if (ev.choices) {
    renderCard({
      ...base,
      choices: ev.choices.map((c) => ({
        label: c.label, hint: c.hint,
        pick: () => {
          const lines = c.run(S, H);
          renderCard({ ...base, lines, next: done });
        },
      })),
    });
  } else {
    renderCard({ ...base, next: () => { const lines = ev.run(S, H); renderCard({ ...base, lines, next: done }); }, nextLabel: 'そして——' });
  }
}

// ============================================================
// ラン画面レンダリング
// ============================================================
function statBar(label, val, cls) {
  const v = Math.max(0, Math.min(100, val));
  return `<div class="stat"><span class="stat-label">${label}</span><div class="stat-bar"><div class="stat-fill ${cls} ${v <= 25 ? 'danger' : ''}" style="width:${v}%"></div></div><span class="stat-num">${Math.max(0, val)}</span></div>`;
}

function renderCard(card) {
  document.body.className = card.phase === 'night' ? 'phase-night' : 'phase-day';
  const kg = H.weight(S) / 1000;
  const totalKm = DAYS.reduce((a, d) => a + d.km, 0);

  app.innerHTML = `
    <div class="run-screen">
      <div class="hud">
        <div class="hud-top">
          <span class="hud-day">${card.kicker}</span>
          <span class="hud-meta">${S.km}/${totalKm}km ・ ${kg.toFixed(2)}kg <button class="link-btn" id="btn-gear">✂装備</button></span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${(S.km / totalKm) * 100}%"></div></div>
        <div class="stats">
          ${statBar('体力', S.sta, 'sta')}
          ${statBar('足', S.feet, 'feet')}
          ${statBar('精神', S.mind, 'mind')}
        </div>
      </div>
      <div class="event-card">
        <h3 class="event-title">${card.title}</h3>
        ${card.text ? `<p class="event-text">${card.text}</p>` : ''}
        ${card.lines ? `<div class="event-lines">${card.lines.map((l) => `<p class="line ${l.t}">${l.text}</p>`).join('')}</div>` : ''}
        <div class="event-actions" id="event-actions"></div>
      </div>
      <div id="gear-panel" class="gear-panel hidden"></div>
    </div>`;

  const actions = document.getElementById('event-actions');
  if (card.choices) {
    card.choices.forEach((c) => {
      const b = el(`<button class="btn choice">${c.label}${c.hint ? `<span class="btn-note">${c.hint}</span>` : ''}</button>`);
      b.onclick = c.pick;
      actions.appendChild(b);
    });
  } else {
    const b = el(`<button class="btn primary">${card.nextLabel || '続ける'}</button>`);
    b.onclick = card.next;
    actions.appendChild(b);
  }

  document.getElementById('btn-gear').onclick = () => toggleGearPanel(card);
}

// --- レース中の装備カット(戻せない) ---
function toggleGearPanel(card) {
  const panel = document.getElementById('gear-panel');
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  panel.innerHTML = `<p class="gear-panel-title">✂ 走りながら切る(元には戻せない)</p>`;
  GEAR.forEach((g, i) => {
    const st = g.stages[S.gear[i]];
    const canCut = S.gear[i] < g.stages.length - 1;
    const row = el(`
      <div class="gear-row">
        <span>${g.icon} ${g.name} <small>${st.label}</small></span>
        <span class="gear-row-right">${st.g}g ${canCut ? `<button class="btn tiny">切る</button>` : ''}</span>
      </div>`);
    if (canCut) {
      row.querySelector('button').onclick = (e) => {
        e.stopPropagation();
        S.gear[i]++;
        S.flags.midcut = true;
        toggleGearPanel(card); // 再描画のため一度閉じる
        renderCard(card);
        document.getElementById('btn-gear').click();
      };
    }
    panel.appendChild(row);
  });
}

// ============================================================
// 画面: リザルト
// ============================================================
function renderResult() {
  document.body.className = S.finished ? 'phase-day' : 'phase-night';
  const store = loadStore();
  store.ach = store.ach || {};

  // 実績判定
  const newAch = [];
  ACHIEVEMENTS.forEach((a) => {
    if (!store.ach[a.id] && a.check(S, H)) { store.ach[a.id] = true; newAch.push(a); }
  });

  let scoreHtml = '';
  if (S.finished) {
    const lightBonus = Math.round((WEIGHT_LIMIT - S.startWeight) * 0.4);
    const score = Math.max(0, Math.round((4800 - S.time) * 2) + lightBonus + S.sta + S.feet + S.mind);
    if (!store.best || S.time < store.best.time) store.best = { time: S.time, weight: S.startWeight };
    scoreHtml = `
      <div class="result-stats">
        <div class="result-stat"><span>完走タイム</span><b>${fmtTime(S.time)}</b></div>
        <div class="result-stat"><span>出走時重量</span><b>${(S.startWeight / 1000).toFixed(2)}kg</b></div>
        <div class="result-stat"><span>スコア</span><b>${score.toLocaleString()}</b></div>
      </div>`;
  }
  saveStore(store);

  const totalAch = Object.keys(store.ach).length;
  app.innerHTML = `
    <div class="result-screen">
      <p class="title-kicker">${S.mode === 'daily' ? `今日のサハラ(${todayStr()})` : 'フリーラン'}</p>
      <h2 class="result-title">${S.finished ? '🏁 完走!' : 'リタイア…'}</h2>
      <p class="result-text">${S.finished
        ? `264kmの砂漠を走り切った。ゴールテープの向こうで、切り落とした袖のことを少しだけ思い出した。${H.tag(S, 'nocamera') === 0 ? 'カメラには' + (S.flags.photos || 0) + '枚の思い出。' : '写真は、ない。カメラは砂漠のどこかだ。'}`
        : `${S.km}km地点、${S.retireInfo.stat}が尽きた。${S.retireInfo.reason}`}</p>
      ${scoreHtml}
      ${newAch.length ? `<div class="ach-box"><p class="ach-head">🏆 新しい実績</p>${newAch.map((a) => `<p class="ach-item"><b>${a.name}</b> — ${a.desc}</p>`).join('')}</div>` : ''}
      <p class="title-records">実績 ${totalAch} / ${ACHIEVEMENTS.length}</p>
      ${S.finished ? '' : '<p class="retry-hint">ヒント: 削った場所と倒れた場所を見比べろ。それが砂漠の学習だ。</p>'}
      <div class="title-buttons">
        <button class="btn primary" id="btn-retry">もう一度削る</button>
        <button class="btn" id="btn-title">タイトルへ</button>
      </div>
    </div>`;
  document.getElementById('btn-retry').onclick = () => startPrep(S.mode);
  document.getElementById('btn-title').onclick = renderTitle;
}

// ---------- 起動 ----------
renderTitle();
