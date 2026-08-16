import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalDefineModule, normalizeGrammar } from './extract-grammar.mjs';

const SAMPLE = `define("pages/grammar/curriculum.js", function (require, module, exports) {
  "use strict";
  var mk = function (label, result, meaning, example, translation, note) {
    return { label: label, result: result, meaning: meaning,
             example: example, translation: translation, note: note || "" };
  };
  module.exports = {
    modules: [{
      id: "word-family", number: "01", title: "词根与词缀",
      subtitle: "一个词根，变出动作、人物、结果和状态", visual: "morph",
      lessons: [{
        id: "lihat-family", title: "lihat：看见家族", kind: "morph",
        base: "lihat · 看", instruction: "选择词缀。",
        options: [ mk("meN-", "melihat", "看；看见",
                      "Saya melihat mobil itu.", "我看见那辆车。",
                      "meN- 遇到 l 表现为 me-。") ],
      }],
    }],
  };
}, { isPage: false });`;

test('能求值 define 包装的模块', () => {
  const mod = evalDefineModule(SAMPLE, 'pages/grammar/curriculum.js');
  assert.ok(Array.isArray(mod.modules));
  assert.equal(mod.modules[0].id, 'word-family');
});

test('规范化后保留课程与选项的完整字段', () => {
  const mod = evalDefineModule(SAMPLE, 'pages/grammar/curriculum.js');
  const out = normalizeGrammar(mod);
  assert.equal(out.length, 1);
  const lesson = out[0].lessons[0];
  assert.equal(lesson.base, 'lihat · 看');
  const opt = lesson.options[0];
  assert.deepEqual(opt, {
    label: 'meN-',
    result: 'melihat',
    meaning: '看；看见',
    example: 'Saya melihat mobil itu.',
    translation: '我看见那辆车。',
    note: 'meN- 遇到 l 表现为 me-。',
  });
});

test('缺 note 的选项补空字符串', () => {
  const src = SAMPLE.replace('"meN- 遇到 l 表现为 me-。"', 'undefined');
  const out = normalizeGrammar(
    evalDefineModule(src, 'pages/grammar/curriculum.js'),
  );
  assert.equal(out[0].lessons[0].options[0].note, '');
});
