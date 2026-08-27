import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePacks, validateDialogs, validateGrammar, validateCourse } from './check-content.mjs';

const good = [
  {
    id: 'freq-beginner-001',
    title: '数字',
    subtitle: '1到10',
    theme: 'blue',
    stage: 1,
    words: Array.from({ length: 10 }, (_, i) => ({
      id: `freq-beginner-001-${i + 1}`,
      word: `kata${i}`,
      pos: '名词',
      zh: '词',
      example: `Ini kata${i} baru.`,
      exampleZh: '这是新词。',
    })),
  },
];

test('合格内容无问题', () => {
  assert.deepEqual(validatePacks(good), []);
});

test('词数不等于 10 报错', () => {
  const bad = structuredClone(good);
  bad[0].words.pop();
  assert.match(validatePacks(bad)[0], /freq-beginner-001.*9 词/);
});

test('缺字段报错', () => {
  const bad = structuredClone(good);
  delete bad[0].words[3].exampleZh;
  assert.match(validatePacks(bad)[0], /exampleZh/);
});

test('包内重复词报错', () => {
  const bad = structuredClone(good);
  bad[0].words[1].word = bad[0].words[0].word;
  assert.ok(validatePacks(bad).some((p) => /重复词/.test(p)));
});

test('例句必须包含该词', () => {
  const bad = structuredClone(good);
  bad[0].words[0].example = 'Kalimat lain sama sekali.';
  assert.ok(validatePacks(bad).some((p) => /例句未包含/.test(p)));
});

test('包 id 重复报错', () => {
  const bad = [...structuredClone(good), ...structuredClone(good)];
  assert.ok(validatePacks(bad).some((p) => /重复出现/.test(p)));
});

const goodDialog = [
  {
    id: 'sapaan',
    scene: 'Sapaan',
    sceneZh: '打招呼',
    situasi: '第一次见面时用。',
    lines: Array.from({ length: 12 }, (_, i) => ({
      speaker: i % 2 === 0 ? 'A' : 'B',
      id_text: `Baris ${i}.`,
      zh: `第 ${i} 句。`,
    })),
    keyPhrases: Array.from({ length: 6 }, (_, i) => ({
      id_text: `Kalimat ${i}`,
      zh: `句 ${i}`,
      // 一半标可替换即可
      ...(i % 2 === 0 ? { ganti: `bagian ${i}` } : {}),
    })),
    vocab: Array.from({ length: 8 }, (_, i) => ({ word: `kata${i}`, zh: `词${i}` })),
    tips: ['贴士一', '贴士二'],
  },
];

test('合格对话无问题', () => {
  assert.deepEqual(validateDialogs(goodDialog), []);
});

test('轮次少于 12 报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].lines = bad[0].lines.slice(0, 8);
  assert.match(validateDialogs(bad)[0], /8 轮/);
});

test('说话人必须交替', () => {
  const bad = structuredClone(goodDialog);
  bad[0].lines[1].speaker = 'A';
  assert.ok(validateDialogs(bad).some((p) => /说话人未交替/.test(p)));
});

test('缺场景说明报错', () => {
  const bad = structuredClone(goodDialog);
  delete bad[0].situasi;
  assert.ok(validateDialogs(bad).some((p) => /situasi/.test(p)));
});

test('贴士少于两条报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].tips = ['只有一条'];
  assert.ok(validateDialogs(bad).some((p) => /贴士/.test(p)));
});

test('关键句不足 6 条报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].keyPhrases = bad[0].keyPhrases.slice(0, 4);
  assert.ok(validateDialogs(bad).some((p) => /关键句少于/.test(p)));
});

test('标了可替换部分的关键句不过半要报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].keyPhrases = bad[0].keyPhrases.map((k) => ({ id_text: k.id_text, zh: k.zh }));
  assert.ok(validateDialogs(bad).some((p) => /ganti/.test(p)));
});

test('生词不足 8 个报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].vocab = bad[0].vocab.slice(0, 5);
  assert.ok(validateDialogs(bad).some((p) => /生词少于/.test(p)));
});

// —— 跨包重复词 ——
import { validateNoCrossLevelDupes, checkExampleVocabulary, stemCandidates } from './check-content.mjs';

const twoPacks = [
  { id: 'a', title: 'A', words: [{ word: 'segar' }, { word: 'manis' }] },
  { id: 'b', title: 'B', words: [{ word: 'segar' }, { word: 'pahit' }] },
];

test('同一个词出现在两个包里报错', () => {
  const out = validateNoCrossLevelDupes(twoPacks);
  assert.equal(out.length, 1);
  assert.match(out[0], /segar.*a.*b/);
});

test('包内重复不由跨包校验负责', () => {
  const same = [{ id: 'a', title: 'A', words: [{ word: 'segar' }, { word: 'segar' }] }];
  assert.deepEqual(validateNoCrossLevelDupes(same), []);
});

// —— 例句用词 ——
test('meN- 吃掉词根首字母仍算派生词', () => {
  assert.ok(stemCandidates('menolong').includes('tolong'));
  assert.ok(stemCandidates('mengirim').includes('kirim'));
  assert.ok(stemCandidates('memakai').includes('pakai'));
  assert.ok(stemCandidates('menyapu').includes('sapu'));
});

test('后缀也能还原', () => {
  assert.ok(stemCandidates('pekerjaan').includes('kerja'));
  assert.ok(stemCandidates('menyelesaikan').includes('selesai'));
});

test('例句用已教过的词不报警', () => {
  const packs = [{ id: 'p', title: 'P', words: [{ word: 'tulus', example: 'Dia menolong saya dengan tulus.' }] }];
  assert.deepEqual(checkExampleVocabulary(packs, ['tolong']), []);
});

test('例句用没教过的词要报出来', () => {
  const packs = [{ id: 'p', title: 'P', words: [{ word: 'tulus', example: 'Dia tulus dan berjualan bakso.' }] }];
  const out = checkExampleVocabulary(packs, []);
  assert.equal(out.length, 1);
  assert.match(out[0], /bakso/);
});

test('短语词条按词收录，例句用其中一个词不算生词', () => {
  const packs = [{ id: 'p', title: 'P', words: [{ word: 'paruh baya', example: 'Ibu itu sudah paruh baya.' }] }];
  assert.deepEqual(checkExampleVocabulary(packs, []), []);
});

test('祈使句脱掉前缀也算例句用了该词', () => {
  const packs = [{
    id: 'p', title: 'P',
    words: Array.from({ length: 10 }, (_, i) => ({
      id: `p-${i + 1}`, word: 'merendam', pos: '动词', zh: '浸泡',
      example: 'Rendam beras ketan satu jam.', exampleZh: '糯米泡一个小时。',
    })),
  }];
  const problems = validatePacks(packs).filter((x) => /例句未包含/.test(x));
  assert.deepEqual(problems, []);
});

test('例句真没用到该词还是要报', () => {
  const packs = [{
    id: 'p', title: 'P',
    words: [{ id: 'p-1', word: 'merendam', pos: '动词', zh: '浸泡', example: 'Saya makan nasi.', exampleZh: '我吃饭。' }],
  }];
  assert.ok(validatePacks(packs).some((x) => /例句未包含/.test(x)));
});

test('短语词条要求例句用到每一个词', () => {
  const packs = [{
    id: 'p', title: 'P',
    words: [{ id: 'p-1', word: 'uang muka', pos: '名词', zh: '首付', example: 'Uang muka motor itu besar.', exampleZh: '那辆摩托首付很高。' }],
  }];
  assert.deepEqual(validatePacks(packs).filter((x) => /例句未包含/.test(x)), []);
});

// --- 语法（《我的第一本印尼语文法》转写产物）---

const opt = (over = {}) => ({
  label: 'ber-', result: 'berjalan', meaning: '走路',
  example: 'Saya berjalan kaki.', translation: '我走路。', ...over,
});
const lesson = (over = {}) => ({ id: 'ber', title: '前缀 ber-', options: [opt()], ...over });
const mod = (over = {}) => ({
  id: 'affix', number: '03', title: '词缀篇', subtitle: 's', lessons: [lesson()], ...over,
});

test('结构完整的语法模块没有问题', () => {
  assert.deepEqual(validateGrammar([mod()]), []);
});

test('模块缺字段会被报出来', () => {
  const p = validateGrammar([mod({ subtitle: '' })]);
  assert.equal(p.length, 1);
  assert.match(p[0], /缺字段 subtitle/);
});

test('空模块与空课都报错', () => {
  assert.match(validateGrammar([mod({ lessons: [] })])[0], /没有课/);
  assert.match(validateGrammar([mod({ lessons: [lesson({ options: [] })] })])[0], /没有条目/);
});

// 视图直接把这五个字段插进 DOM，缺一个就渲染出空行。
test('条目缺任一必填字段都报错', () => {
  for (const f of ['label', 'result', 'meaning', 'example', 'translation']) {
    const p = validateGrammar([mod({ lessons: [lesson({ options: [opt({ [f]: '' })] })] })]);
    assert.equal(p.length, 1, f);
    assert.match(p[0], new RegExp(`缺字段 ${f}`));
  }
});

test('课 id 跨模块重复会被报出来', () => {
  const p = validateGrammar([mod(), mod({ id: 'syntax', number: '04' })]);
  assert.ok(p.some((x) => /课 ber 在 affix 与 syntax 重复/.test(x)));
});

// 把中文译文误填进 example 栏是转写时最容易犯的错。
test('例句里没有印尼语（整条都是中文）会被报出来', () => {
  const p = validateGrammar([
    mod({ lessons: [lesson({ options: [opt({ example: '我走路。' })] })] }),
  ]);
  assert.equal(p.length, 1);
  assert.match(p[0], /例句里没有印尼语/);
});

// --- 课程（BIPA A1 转写产物）---

const cLesson = (over = {}) => ({
  id: 'u01l1', unit: 'u01', order: '01', title: '问候', task: '打招呼',
  words: [{ text: 'pagi', meaning: '早晨' }],
  scene: { title: '早上', lines: [{ speaker: 'Santi', text: 'Selamat pagi.', meaning: '早上好。' }] },
  points: [{ title: '要点', body: '内容' }],
  quiz: [{ prompt: '题干', choices: [{ text: 'A', ok: true, why: '对' }, { text: 'B', ok: false, why: '错' }] }],
  ...over,
});
const cUnit = (over = {}) => ({
  id: 'u01', number: '01', title: 'Menyapa', titleZh: '打招呼', goal: '目标',
  lessons: [cLesson()], ...over,
});

test('结构完整的课程单元没有问题', () => {
  assert.deepEqual(validateCourse([cUnit()]), []);
});

test('课的 unit 字段与所在单元对不上会被报出来', () => {
  const p = validateCourse([cUnit({ lessons: [cLesson({ unit: 'u09' })] })]);
  assert.equal(p.length, 1);
  assert.match(p[0], /unit 字段是 u09/);
});

// 四块缺一块，课文页就渲染出一个空白框。
test('生词/情景/要点/小测缺任一块都报错', () => {
  assert.match(validateCourse([cUnit({ lessons: [cLesson({ words: [] })] })])[0], /没有生词/);
  assert.match(validateCourse([cUnit({ lessons: [cLesson({ points: [] })] })])[0], /没有要点/);
  assert.match(validateCourse([cUnit({ lessons: [cLesson({ quiz: [] })] })])[0], /没有小测/);
  const noScene = validateCourse([cUnit({ lessons: [cLesson({ scene: { title: '', lines: [] } })] })]);
  assert.ok(noScene.some((x) => /情景缺标题/.test(x)));
  assert.ok(noScene.some((x) => /情景没有台词/.test(x)));
});

// 判对错要有唯一解，两个 ok 或零个 ok 都是内容写错了。
test('小测必须正好一个正确答案', () => {
  const two = cLesson({ quiz: [{ prompt: 'q', choices: [{ text: 'A', ok: true, why: 'w' }, { text: 'B', ok: true, why: 'w' }] }] });
  assert.match(validateCourse([cUnit({ lessons: [two] })])[0], /有 2 个正确答案/);
  const none = cLesson({ quiz: [{ prompt: 'q', choices: [{ text: 'A', ok: false, why: 'w' }, { text: 'B', ok: false, why: 'w' }] }] });
  assert.match(validateCourse([cUnit({ lessons: [none] })])[0], /有 0 个正确答案/);
});

test('台词整句没有印尼语（把中文填错栏）会被报出来', () => {
  const bad = cLesson({ scene: { title: '早上', lines: [{ speaker: 'A', text: '早上好。', meaning: '早上好。' }] } });
  const p = validateCourse([cUnit({ lessons: [bad] })]);
  assert.equal(p.length, 1);
  assert.match(p[0], /没有印尼语/);
});
