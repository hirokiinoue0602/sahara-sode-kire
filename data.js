'use strict';

// ============================================================
// 『サハラで袖を切れ』 ゲームデータ定義
// 装備・ステージ(日程)・イベント・実績
// ============================================================

const WEIGHT_LIMIT = 7500; // g

// --- 装備 -----------------------------------------------------
// tags: 削り段階が持つリスクタグ(イベント側が参照する)
//   sunburn: 日焼け / cold: 夜の寒さ / hygiene: 歯磨き
//   foodlv: 食料の削り段階 / nolight: 予備電池なし
//   medkit: 救急セット削り段階 / rest: 休憩の質(削り段階)
//   nocamera: カメラなし / socks: 靴下削り段階 / coldmeal: 火なし
const GEAR = [
  {
    id: 'shirt', icon: '👕', name: 'Tシャツ',
    stages: [
      { label: 'そのまま', g: 200, tags: {}, risk: [] },
      { label: '袖を切った', g: 140, tags: { sunburn: 1 }, risk: ['日焼け+'] },
      { label: 'タンクトップ化', g: 90, tags: { sunburn: 2, cold: 1 }, risk: ['日焼け++', '夜の寒さ+'] },
    ],
  },
  {
    id: 'bag', icon: '🛏️', name: '寝袋',
    stages: [
      { label: 'そのまま', g: 1400, tags: {}, risk: [] },
      { label: '足元を切った', g: 900, tags: { cold: 1 }, risk: ['夜の寒さ+'] },
      { label: '上半身だけ', g: 550, tags: { cold: 3 }, risk: ['夜の寒さ+++'] },
    ],
  },
  {
    id: 'brush', icon: '🪥', name: '歯ブラシ',
    stages: [
      { label: 'そのまま', g: 30, tags: {}, risk: [] },
      { label: '柄を折った', g: 12, tags: { hygiene: 1 }, risk: ['磨きにくい'] },
    ],
  },
  {
    id: 'food', icon: '🍙', name: '食料 ×7日分',
    stages: [
      { label: 'そのまま', g: 5600, tags: { foodlv: 0 }, risk: [] },
      { label: 'パッケージを全部剥がした', g: 5100, tags: { foodlv: 1 }, risk: [] },
      { label: 'フリーズドライ化', g: 4300, tags: { foodlv: 2 }, risk: ['精神力の回復-'] },
      { label: 'カロリー下限ギリギリ', g: 3500, tags: { foodlv: 3 }, risk: ['体力回復-', '精神力の回復--'] },
    ],
  },
  {
    id: 'light', icon: '🔦', name: 'ヘッドライト',
    stages: [
      { label: 'そのまま', g: 120, tags: {}, risk: [] },
      { label: '予備電池を捨てた', g: 75, tags: { nolight: 1 }, risk: ['夜間ステージ運ゲー'] },
    ],
  },
  {
    id: 'aid', icon: '🩹', name: '救急セット',
    stages: [
      { label: 'そのまま', g: 380, tags: {}, risk: [] },
      { label: '絆創膏と針だけ', g: 120, tags: { medkit: 1 }, risk: ['マメ悪化リスク+'] },
    ],
  },
  {
    id: 'cushion', icon: '🪑', name: '折りたたみ座布団',
    stages: [
      { label: 'そのまま', g: 180, tags: {}, risk: [] },
      { label: '半分に切った', g: 90, tags: { rest: 1 }, risk: [] },
      { label: '捨てた', g: 0, tags: { rest: 2 }, risk: ['休憩の回復-'] },
    ],
  },
  {
    id: 'camera', icon: '📷', name: '思い出用カメラ',
    stages: [
      { label: 'そのまま', g: 520, tags: {}, risk: [] },
      { label: '捨てた', g: 0, tags: { nocamera: 1 }, risk: ['ゴールの感動が薄れる…?'] },
    ],
  },
  {
    id: 'socks', icon: '🧦', name: '替えの靴下 ×3足',
    stages: [
      { label: 'そのまま', g: 240, tags: {}, risk: [] },
      { label: '1足だけ', g: 80, tags: { socks: 1 }, risk: ['足のケア-'] },
    ],
  },
  {
    id: 'stove', icon: '🔥', name: 'ストーブ+コッヘル',
    stages: [
      { label: 'そのまま', g: 900, tags: {}, risk: [] },
      { label: '固形燃料だけに', g: 400, tags: { coldmeal: 1 }, risk: ['温かい飯が貴重に'] },
      { label: '捨てた', g: 0, tags: { coldmeal: 2 }, risk: ['毎晩冷たい飯'] },
    ],
  },
];

// --- 日程(7ステージ・計264km) --------------------------------
const DAYS = [
  { km: 32, name: 'ステージ1', desc: '初日。まだ全員に余裕がある。' },
  { km: 34, name: 'ステージ2', desc: '砂丘地帯。足が砂に取られる。' },
  { km: 36, name: 'ステージ3', desc: '岩場と涸れ谷。景色は最高、路面は最悪。' },
  { km: 82, name: 'ステージ4「ロングデー」', desc: '82km。夜通し歩く者もいる、大会最大の山場。', long: true },
  { km: 42, name: 'ステージ5', desc: 'フルマラソンと同じ距離。疲労はピークに。' },
  { km: 17, name: 'ステージ6', desc: '短いが、体はもうボロボロ。' },
  { km: 21, name: '最終ステージ', desc: 'ゴールの町が地平線に見える。' },
];

// --- イベント -------------------------------------------------
// phase: 'day' | 'night'
// cond(s,h): 出現条件(省略時は常に候補)
// run(s,h): 自動イベント / choices: 選択肢イベント
// h.ap(s, {sta, feet, mind, time}) が効果適用+表示行を返す

const DAY_EVENTS = [
  {
    id: 'heat', title: '灼熱の砂丘',
    text: '気温47度。太陽が真上から刺してくる。腕がジリジリと音を立てている気がする。',
    choices: [
      {
        label: '岩陰で休みながら進む',
        hint: '+40分',
        run(s, h) {
          const sb = h.tag(s, 'sunburn');
          return h.ap(s, { time: 40, sta: -4, mind: 2, feet: 0 - Math.ceil(sb * 1.5) },
            sb ? '袖のない腕がヒリつくが、日陰で最悪は免れた。' : '袖のおかげで腕は無事だ。');
        },
      },
      {
        label: '構わず突っ込む',
        hint: '日焼けリスク',
        run(s, h) {
          const sb = h.tag(s, 'sunburn');
          const dmg = [0, 11, 18][sb] || 0;
          return h.ap(s, { sta: -6 - dmg, mind: sb ? -4 : 2 },
            sb ? '露出した腕が真っ赤に焼けた。袖を切ったツケが今来た。' : '袖が守ってくれた。判断は間違っていなかった。');
        },
      },
    ],
  },
  {
    id: 'sandstorm', title: '砂嵐',
    text: '地平線が茶色く濁ったと思った次の瞬間、視界がゼロになった。口の中がジャリジャリする。',
    choices: [
      {
        label: 'うずくまって待つ',
        hint: '+50分',
        run(s, h) { return h.ap(s, { time: 50, mind: -4 }, '砂に埋もれながら通過を待った。長い50分だった。'); },
      },
      {
        label: 'GPSを信じて進む',
        hint: '消耗する',
        run(s, h) { return h.ap(s, { sta: -10, feet: -4, mind: -2, time: 10 }, '砂と戦いながら進んだ。削れたのは時間ではなく体力だった。'); },
      },
    ],
  },
  {
    id: 'blister', title: 'マメができた',
    text: '左足の裏に、嫌な熱を持った膨らみ。砂漠ランナーの最大の敵、マメだ。',
    choices: [
      {
        label: '処置する',
        hint: '救急セット次第',
        run(s, h) {
          const mk = h.tag(s, 'medkit');
          if (mk === 0) return h.ap(s, { feet: -4, time: 15 }, 'フル装備の救急セットで完璧に処置。テーピングまで済ませた。');
          return h.ap(s, { feet: -9, time: 15 }, '針で潰して絆創膏を貼るだけの応急処置。消毒液を削ったのが悔やまれる。');
        },
      },
      {
        label: '気合いで無視する',
        hint: '足が削れる',
        run(s, h) { return h.ap(s, { feet: -13, mind: -2 }, 'マメは育った。一歩ごとに存在を主張してくる。'); },
      },
    ],
  },
  {
    id: 'oasis', title: '給水ポイント',
    text: 'チェックポイントで支給の水を受け取る。ぬるい。しかし、うまい。',
    run(s, h) { return h.ap(s, { sta: 8, mind: 5 }, '生き返った。水は主催者支給——運ばなくていいのが唯一の救いだ。'); },
  },
  {
    id: 'runner27', title: '2.7倍速の男',
    text: '併走してきたランナーのイヤホンから、異常な速度の日本語が漏れている。「ポッドキャストは2.7倍速が平常運転なんですよ」と彼は笑った。',
    run(s, h) { s.flags.runner27 = true; return h.ap(s, { mind: 8 }, '何を言っているのか全く聞き取れなかったが、元気だけはもらった。'); },
  },
  {
    id: 'spoon', title: '砂に埋まる銀色の何か',
    text: '砂丘の斜面に、スプーンが半分埋まっている。柄に「19,800円」の値札。まさか、舌を電気でハックするという噂のアレか…?',
    run(s, h) { s.flags.spoon = true; return h.ap(s, { mind: 5 }, 'なぜ砂漠に。誰が捨てたのか。持ち主の旅を想って少し笑った。'); },
  },
  {
    id: 'sandshoe', title: '靴に砂が入った',
    text: '一歩ごとに、かかとの下でジャリ、と鳴る。小さな砂粒は、放っておくとヤスリになる。',
    choices: [
      {
        label: '立ち止まって砂を出す',
        hint: '+15分',
        run(s, h) { return h.ap(s, { time: 15 }, '靴を脱ぎ、砂を出し、履き直す。地味だが、これが完走者の所作だ。'); },
      },
      {
        label: '気にせず走る',
        hint: '足が削れる',
        run(s, h) { return h.ap(s, { feet: -6 }, '砂粒は予想通りヤスリになった。'); },
      },
    ],
  },
  {
    id: 'mirage', title: '蜃気楼',
    text: '遠くに、キンキンに冷えた自動販売機が見える。見えるのだ。確かに。',
    run(s, h) { return h.ap(s, { mind: -4, time: 10 }, '近づくと消えた。分かっていたのに、喉の渇きが3割増した。'); },
  },
  {
    id: 'kids', title: '遊牧民の子どもたち',
    text: 'どこからともなく現れた子どもたちが、並走しながら手を振ってくる。',
    run(s, h) { return h.ap(s, { mind: 7 }, 'ハイタッチした。走る理由なんて、案外こういうことでいいのかもしれない。'); },
  },
  {
    id: 'weighin', title: '検量チェックポイント',
    text: '係員がザックを持ち上げて重さを確かめている。',
    run(s, h) {
      const kg = h.weight(s) / 1000;
      if (kg < 5) return h.ap(s, { mind: 6 }, `「${kg.toFixed(1)}kg?! 何を切ったらそうなるんだ」係員が目を丸くした。少し誇らしい。`);
      return h.ap(s, { mind: 2 }, `「${kg.toFixed(1)}kg、まあ標準だな」と係員。もっと削れたか…?という悪魔の囁きが聞こえる。`);
    },
  },
  {
    id: 'bigrest', title: '大休止',
    text: '木陰を見つけた。砂漠で日陰は、それだけでご馳走だ。',
    run(s, h) {
      const r = h.tag(s, 'rest');
      if (r === 0) return h.ap(s, { sta: 10, mind: 3, time: 20 }, '座布団を敷いて座る。この180gは正義だったかもしれない。');
      if (r === 1) return h.ap(s, { sta: 7, mind: 2, time: 20 }, '半分になった座布団に器用に尻を乗せる。半分でも、あるとないでは大違いだ。');
      return h.ap(s, { sta: 3, mind: -2, time: 20 }, '岩に直接座る。尻が熱い。座布団を捨てた過去の自分に文句を言う。');
    },
  },
  {
    id: 'phototime', title: 'シャッターチャンス',
    text: '砂丘の稜線が、風で煙のように舞っている。息を呑む光景だ。',
    cond(s, h) { return h.tag(s, 'nocamera') === 0; },
    choices: [
      {
        label: 'カメラを取り出す',
        hint: '+20分',
        run(s, h) { s.flags.photos = (s.flags.photos || 0) + 1; return h.ap(s, { time: 20, mind: 8 }, '520gの重りが、一生モノの一枚になった。'); },
      },
      {
        label: '目に焼き付けて先を急ぐ',
        run(s, h) { return h.ap(s, { mind: 3 }, '記憶にだけ保存した。たぶん、忘れる。'); },
      },
    ],
  },
];

const NIGHT_EVENTS = [
  {
    id: 'coldnight', title: '冷え込む夜',
    text: '日中47度だった砂漠が、夜は一桁まで冷える。寒暖差40度、それが砂漠だ。',
    run(s, h) {
      const c = h.tag(s, 'cold');
      const dmg = [0, 6, 9, 15][Math.min(c, 3)];
      if (c === 0) return h.ap(s, { mind: 2 }, '無傷の寝袋にくるまる。1400gの安心感。');
      return h.ap(s, { sta: -dmg, mind: -Math.ceil(dmg / 2) }, '切り詰めた寝袋の隙間から、夜が侵入してくる。震えながら朝を待った。');
    },
  },
  {
    id: 'stars', title: '満天の星空',
    text: 'テントから顔を出すと、天の川が地平線から地平線まで架かっていた。',
    run(s, h) {
      if (h.tag(s, 'nocamera') === 0) { s.flags.photos = (s.flags.photos || 0) + 1; return h.ap(s, { mind: 10 }, '星空を撮った。カメラを捨てなかった自分を褒めたい。'); }
      return h.ap(s, { mind: 6 }, '美しい。カメラがあれば…と一瞬思ったが、この軽さと引き換えだ。'); },
  },
  {
    id: 'party', title: 'テント村の宴',
    text: '隣のテントから笑い声。各国のランナーが乏しい食料を持ち寄って何かやっている。',
    choices: [
      {
        label: '混ざる',
        hint: '楽しいが夜更かし',
        run(s, h) { return h.ap(s, { mind: 8, sta: -4 }, 'フランス人のチーズを一欠片もらった。国境なんて砂漠にはない。'); },
      },
      {
        label: '寝る',
        hint: '回復優先',
        run(s, h) { return h.ap(s, { sta: 4 }, '楽しそうな声を子守唄に、泥のように眠った。'); },
      },
    ],
  },
  {
    id: 'nightmarch', title: '夜間行軍',
    text: 'ロングデーの夜。コースはまだ続いている。ヘッドライトの灯りだけが頼りだ。',
    cond(s) { return s.day === 3; }, forced: true,
    run(s, h) {
      if (h.tag(s, 'nolight') === 0) return h.ap(s, { sta: -6, mind: 2 }, '新品の電池に交換して夜を進む。光は正義だ。');
      if (h.rand(s) < 0.5) return h.ap(s, { sta: -8, mind: -2 }, '電池残量の表示が点滅している。冷や汗をかきながら、なんとか持った。');
      return h.ap(s, { time: 60, sta: -10, mind: -7 }, '真っ暗闇の中でライトが死んだ。月明かりだけで進む地獄の1時間。予備電池45gをケチった代償だ。');
    },
  },
  {
    id: 'toothtime', title: '歯磨きの時間',
    text: '砂漠でも歯は磨く。文明人だからだ。',
    run(s, h) {
      if (h.tag(s, 'hygiene') === 0) return h.ap(s, { mind: 3 }, '普通の歯ブラシで普通に磨く。普通は素晴らしい。');
      return h.ap(s, { mind: 1 }, '柄を折った歯ブラシは絶望的に磨きにくい。だが軽い。18gの勝利を噛みしめる。');
    },
  },
  {
    id: 'snore', title: '隣人のいびき',
    text: 'テントの隣人(ドイツ人・巨漢)のいびきが、砂漠の静寂を粉砕している。',
    choices: [
      {
        label: '耳に砂を詰める',
        hint: '原始的ソリューション',
        run(s, h) { return h.ap(s, { mind: -2 }, '意外と効いた。おすすめはしない。'); },
      },
      {
        label: '耐える',
        run(s, h) { return h.ap(s, { mind: -5, sta: -2 }, '一晩中、重低音と共に過ごした。'); },
      },
    ],
  },
  {
    id: 'footcare', title: '足の手入れ',
    text: '一日戦った足を点検する。砂漠マラソンは、結局のところ足のメンテナンス大会だ。',
    run(s, h) {
      const mk = h.tag(s, 'medkit');
      const sk = h.tag(s, 'socks');
      const heal = 8 - mk * 4 - sk * 2;
      if (mk === 0 && sk === 0) return h.ap(s, { feet: heal }, '洗った靴下に履き替え、丁寧にケア。足が生き返っていく。');
      return h.ap(s, { feet: Math.max(heal, 1) }, '道具を削った分、できるケアは限られる。それでもやらないよりマシだ。');
    },
  },
  {
    id: 'strategy', title: '明日の作戦会議(一人)',
    text: 'ヘッドライトの灯りでコースマップを眺める。',
    run(s, h) {
      const next = DAYS[s.day + 1];
      if (!next) return h.ap(s, { mind: 4 }, '次はもう、ない。明日でこの旅は終わる。');
      return h.ap(s, { mind: 4 }, `明日は${next.name}、${next.km}km。${next.desc}`);
    },
  },
];

// --- 就寝(食料・ストーブによる回復) ---------------------------
// foodlv: 0,1 = 満足 / 2 = フリーズドライ / 3 = 下限ギリギリ
const SLEEP_RECOVERY = [
  { sta: 26, mind: 7 },
  { sta: 26, mind: 7 },
  { sta: 21, mind: 3 },
  { sta: 16, mind: 0 },
];

// --- 実績 -----------------------------------------------------
const ACHIEVEMENTS = [
  { id: 'finish', name: '完走', desc: 'サハラ264kmを走り切った', check: (s) => s.finished },
  { id: 'scissors', name: 'ハサミの求道者', desc: '全装備に手を入れて完走', check: (s) => s.finished && s.gear.every((st) => st > 0) },
  { id: 'brush', name: '柄を折った男', desc: '歯ブラシの柄を折って完走', check: (s, h) => s.finished && h.tag(s, 'hygiene') > 0 },
  { id: 'ultralight', name: 'ウルトラライト', desc: '5kg以下で完走', check: (s, h) => s.finished && h.weight(s) <= 5000 },
  { id: 'memories', name: '思い出は重い', desc: 'カメラを最後まで持って完走', check: (s, h) => s.finished && h.tag(s, 'nocamera') === 0 },
  { id: 'spoon', name: '電極スプーン発見', desc: '砂漠で19,800円のスプーンを見つけた', check: (s) => !!s.flags.spoon },
  { id: 'photographer', name: '砂漠の写真家', desc: '3回以上撮影して完走', check: (s) => s.finished && (s.flags.photos || 0) >= 3 },
  { id: 'midcut', name: 'サハラで袖を切った', desc: 'レース中に装備を切った', check: (s) => !!s.flags.midcut },
];
