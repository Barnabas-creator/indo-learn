import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePacks, validateDialogs } from './check-content.mjs';

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
    lines: Array.from({ length: 8 }, (_, i) => ({
      speaker: i % 2 === 0 ? 'A' : 'B',
      id_text: `Baris ${i}.`,
      zh: `第 ${i} 句。`,
    })),
    keyPhrases: [{ id_text: 'Selamat pagi', zh: '早上好' }],
    vocab: [{ word: 'pagi', zh: '早晨' }],
  },
];

test('合格对话无问题', () => {
  assert.deepEqual(validateDialogs(goodDialog), []);
});

test('轮次少于 8 报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].lines = bad[0].lines.slice(0, 5);
  assert.match(validateDialogs(bad)[0], /5 轮/);
});

test('说话人必须交替', () => {
  const bad = structuredClone(goodDialog);
  bad[0].lines[1].speaker = 'A';
  assert.ok(validateDialogs(bad).some((p) => /说话人未交替/.test(p)));
});

test('缺关键句报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].keyPhrases = [];
  assert.ok(validateDialogs(bad).some((p) => /关键句/.test(p)));
});

test('缺生词报错', () => {
  const bad = structuredClone(goodDialog);
  bad[0].vocab = [];
  assert.ok(validateDialogs(bad).some((p) => /生词/.test(p)));
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
