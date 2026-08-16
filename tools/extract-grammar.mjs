// 从小程序解包结果提取语法课程。curriculum.js 是压缩过的 define() 模块，
// 直接正则解析不可靠，改为在 vm 沙箱中求值取 module.exports。
import {
  readFileSync, writeFileSync, mkdirSync, cpSync, existsSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

export function evalDefineModule(source, moduleName) {
  let captured = null;
  const sandbox = {
    define(name, factory) {
      if (name !== moduleName) return;
      const module = { exports: {} };
      // 小程序的 factory 形参很长（require, module, exports, window, …），
      // 数据模块只用前三个，其余留 undefined。
      factory(() => ({}), module, module.exports);
      captured = module.exports;
    },
    require: () => ({}),
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { timeout: 5000 });
  if (!captured) throw new Error(`未找到模块 ${moduleName}`);
  return captured;
}

function normalizeOption(o) {
  return {
    label: o.label ?? '',
    result: o.result ?? '',
    meaning: o.meaning ?? '',
    example: o.example ?? '',
    translation: o.translation ?? '',
    note: o.note ?? '',
  };
}

export function normalizeGrammar(raw) {
  const modules = raw?.modules ?? (Array.isArray(raw) ? raw : []);
  return modules.map((m) => ({
    id: m.id,
    number: m.number ?? '',
    title: m.title ?? '',
    subtitle: m.subtitle ?? '',
    visual: m.visual ?? '',
    lessons: (m.lessons ?? []).map((l) => ({
      id: l.id,
      title: l.title ?? '',
      base: l.base ?? '',
      instruction: l.instruction ?? '',
      tip: l.tip ?? '',
      options: (l.options ?? []).map(normalizeOption),
    })),
  }));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(join(root, 'reference/curriculum.js'), 'utf8');
  const grammar = normalizeGrammar(
    evalDefineModule(src, 'pages/grammar/curriculum.js'),
  );
  mkdirSync(join(root, 'content-src'), { recursive: true });
  writeFileSync(
    join(root, 'content-src/grammar.json'),
    JSON.stringify(grammar, null, 2),
  );

  const svgSrc = join(
    root,
    'reference/wxapkg-unpacked/grammar/pages/grammar/images',
  );
  if (existsSync(svgSrc)) {
    cpSync(svgSrc, join(root, 'assets/grammar-svg'), { recursive: true });
  }

  const lessons = grammar.reduce((n, m) => n + m.lessons.length, 0);
  console.log(
    `提取 ${grammar.length} 个语法模块 / ${lessons} 课 -> content-src/grammar.json`,
  );
}
