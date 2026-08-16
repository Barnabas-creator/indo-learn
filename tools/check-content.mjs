// 词库与对话校验。生成内容后必须跑，防止批量生成时字段漏填或例句跑题。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REQUIRED = ['id', 'word', 'pos', 'zh', 'example', 'exampleZh'];

export function validatePacks(packs) {
  const problems = [];
  const seenPackIds = new Set();

  for (const pack of packs ?? []) {
    if (seenPackIds.has(pack.id)) problems.push(`包 ${pack.id} 重复出现`);
    seenPackIds.add(pack.id);

    const words = pack.words ?? [];
    if (words.length !== 10) {
      problems.push(
        `包 ${pack.id}（${pack.title}）有 ${words.length} 词，应为 10 词`,
      );
    }

    const seenWords = new Set();
    for (const w of words) {
      for (const f of REQUIRED) {
        if (!w?.[f]) {
          problems.push(`包 ${pack.id} 的词 ${w?.word ?? '?'} 缺字段 ${f}`);
        }
      }
      const key = String(w?.word ?? '').toLowerCase();
      if (seenWords.has(key)) problems.push(`包 ${pack.id} 内重复词：${w.word}`);
      seenWords.add(key);

      if (w?.word && w?.example) {
        const stem = String(w.word)
          .toLowerCase()
          .slice(0, Math.max(3, w.word.length - 2));
        if (!String(w.example).toLowerCase().includes(stem)) {
          problems.push(
            `包 ${pack.id} 的词 ${w.word} 例句未包含该词：${w.example}`,
          );
        }
      }
    }
  }
  return problems;
}

export function validateDialogs(dialogs) {
  const problems = [];
  for (const d of dialogs ?? []) {
    const lines = d.lines ?? [];
    if (lines.length < 8 || lines.length > 12) {
      problems.push(
        `对话 ${d.id}（${d.sceneZh}）有 ${lines.length} 轮，应为 8–12 轮`,
      );
    }
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].speaker === lines[i - 1].speaker) {
        problems.push(`对话 ${d.id} 第 ${i + 1} 行说话人未交替`);
        break;
      }
    }
    for (const [i, l] of lines.entries()) {
      if (!l.id_text) problems.push(`对话 ${d.id} 第 ${i + 1} 行缺 id_text`);
      if (!l.zh) problems.push(`对话 ${d.id} 第 ${i + 1} 行缺 zh`);
    }
    if (!(d.keyPhrases ?? []).length) problems.push(`对话 ${d.id} 缺关键句`);
    if (!(d.vocab ?? []).length) problems.push(`对话 ${d.id} 缺生词`);
  }
  return problems;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const readOrEmpty = (f) => {
    try {
      return JSON.parse(readFileSync(join(root, 'content-src', f), 'utf8'));
    } catch {
      return [];
    }
  };

  // --partial：生成过程中只校验已填词的包，方便逐批验收
  const partial = process.argv.includes('--partial');
  const all = readOrEmpty('packs.json');
  const packs = partial ? all.filter((p) => (p.words ?? []).length) : all;
  const dialogs = readOrEmpty('dialogs.json');
  const problems = [...validatePacks(packs), ...validateDialogs(dialogs)];
  const words = packs.reduce((n, p) => n + (p.words?.length ?? 0), 0);

  console.log(`${packs.length} 个包 / ${words} 词 / ${dialogs.length} 组对话`);
  if (problems.length) {
    console.error(`发现 ${problems.length} 个问题：`);
    for (const p of problems.slice(0, 50)) console.error('  -', p);
    process.exit(1);
  }
  console.log('校验通过');
}
