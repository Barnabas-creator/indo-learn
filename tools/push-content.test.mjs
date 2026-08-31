import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSql, sqlQuote } from './push-content.mjs';

const units = [
  { module: 'packs', unitId: 'p-1', tier: 'free', title: null, body: [{ w: "it's" }] },
];

test('单引号按 SQL 规矩翻倍，不是反斜杠转义', () => {
  assert.equal(sqlQuote("it's"), "'it''s'");
});

test('body 存成 JSON 字符串', () => {
  const sql = buildSql(units, 'c1', 1000);
  assert.match(sql, /\[\{"w":"it''s"\}\]/);
});

test('用 INSERT OR REPLACE，重推同一版本不报主键冲突', () => {
  assert.match(buildSql(units, 'c1', 1000), /INSERT OR REPLACE INTO content/);
});

test('版本号最后写，写在所有单元之后', () => {
  const sql = buildSql(units, 'c1', 1000);
  assert.ok(sql.indexOf('content_meta') > sql.indexOf('INSERT OR REPLACE INTO content'));
});

test('删掉这次没推的旧单元——内容删了一包，线上不该还留着', () => {
  assert.match(buildSql(units, 'c1', 1000), /DELETE FROM content WHERE version != 'c1'/);
});

// 上一个任务留的坑：list 型模块（roots/dialogs/grammar/course）的源数据如果 id 重名，
// splitIntoUnits 不报错，等写库时撞 (module, unit_id) 主键才炸，报错会指向 SQL 约束
// 而不是数据源，排查成本很高。这里在拼 SQL 前显式校验，报错直接点名 module 和重复的 id。
test('同一 module 里 unitId 重复要显式报错，别等撞 SQL 主键', () => {
  const dup = [
    { module: 'roots', unitId: 'r-1', tier: 'paid', title: null, body: {} },
    { module: 'roots', unitId: 'r-1', tier: 'paid', title: null, body: {} },
  ];
  assert.throws(
    () => buildSql(dup, 'c1', 1000),
    /roots.*r-1/,
  );
});

test('不同 module 用同一个 unitId 不算重复', () => {
  const notDup = [
    { module: 'roots', unitId: 'x-1', tier: 'paid', title: null, body: {} },
    { module: 'dialogs', unitId: 'x-1', tier: 'paid', title: null, body: {} },
  ];
  assert.doesNotThrow(() => buildSql(notDup, 'c1', 1000));
});

// 10.5A：meta 跟 title 一样，null 要写成裸 SQL NULL，不能写成字符串 'null'——
// 后者会让查询函数把它当成一段合法 JSON 解析出「null 值」，跟真正的空区分不开。
test('meta 为 null 时 SQL 里是裸 NULL，不是字符串 \'null\'', () => {
  const units2 = [
    { module: 'packs', unitId: 'p-1', tier: 'free', title: null, body: [], meta: null },
  ];
  const sql = buildSql(units2, 'c1', 1000);
  assert.match(sql, /NULL, '\[\]'\);/);
  assert.doesNotMatch(sql, /'null'/);
});

test('meta 有值时序列化成 JSON 字符串', () => {
  const units2 = [
    {
      module: 'grammar', unitId: 'phonetic', tier: 'paid', title: '发音篇', body: {}, meta: { number: 1, lessons: 3 },
    },
  ];
  const sql = buildSql(units2, 'c1', 1000);
  assert.match(sql, /\{"number":1,"lessons":3\}/);
});
