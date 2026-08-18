// 词库与对话校验。生成内容后必须跑，防止批量生成时字段漏填或例句跑题。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REQUIRED = ['id', 'word', 'pos', 'zh', 'example', 'exampleZh'];

// meN- / peN- 前缀会吃掉词根首字母：men+tolong -> menolong，meng+kirim -> mengirim。
// 还原时把这些字母补回去，否则派生词会被误判成生词。
const NASAL = { men: 't', meng: 'k', mem: 'p', meny: 's', pen: 't', peng: 'k', pem: 'p', peny: 's' };
const PREFIXES = ['memper', 'menge', 'meng', 'meny', 'mem', 'men', 'me', 'peng', 'peny', 'pem', 'pen', 'pe', 'ber', 'bel', 'ter', 'di', 'ke', 'se'];
const SUFFIXES = ['kannya', 'annya', 'nya', 'kan', 'an', 'i'];

// 一个词可能的词根，含前缀鼻音还原后的形式。
export function stemCandidates(token) {
  const out = new Set([token]);
  for (const p of PREFIXES) {
    if (!token.startsWith(p) || token.length - p.length < 3) continue;
    const rest = token.slice(p.length);
    out.add(rest);
    if (NASAL[p]) out.add(NASAL[p] + rest);
  }
  for (const base of [...out]) {
    for (const sfx of SUFFIXES) {
      if (base.endsWith(sfx) && base.length - sfx.length >= 3) out.add(base.slice(0, -sfx.length));
    }
  }
  return [...out];
}

// 例句是否用到了该词条：短语逐词匹配，单词按词根匹配（含 meN- 前缀还原）。
export function exampleUsesWord(example, word) {
  const tokens = String(example).toLowerCase().match(/[a-z]+/g) ?? [];
  const parts = String(word).toLowerCase().match(/[a-z]+/g) ?? [];
  if (!parts.length) return false;
  const roots = new Set(tokens.flatMap((t) => stemCandidates(t)));
  return parts.every((part) => stemCandidates(part).some((r) => roots.has(r)));
}

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
        // 祈使句会脱掉前缀（merendam -> Rendam beras…），按词根比对才不会误判
        if (!exampleUsesWord(w.example, w.word)) {
          problems.push(
            `包 ${pack.id} 的词 ${w.word} 例句未包含该词：${w.example}`,
          );
        }
      }
    }
  }
  return problems;
}

// 中级词条不得与初级重复：重复了就是白占一个中级名额。
export function validateNoCrossLevelDupes(packs) {
  const problems = [];
  const seen = new Map(); // 词 -> 首次出现的包 id
  for (const pack of packs ?? []) {
    for (const w of pack.words ?? []) {
      const key = String(w?.word ?? '').toLowerCase();
      if (!key) continue;
      const first = seen.get(key);
      if (first && first !== pack.id) {
        problems.push(`词 ${w.word} 在 ${first} 与 ${pack.id} 重复`);
      } else if (!first) {
        seen.set(key, pack.id);
      }
    }
  }
  return problems;
}

// 例句可自由使用的基础词：虚词，加上初级词表没收但躲不开的核心高频词
// （bicara / tinggal / pergi …）。收在这里，例句才写得自然。
const STOPWORDS = new Set([
  'saya', 'aku', 'kamu', 'anda', 'dia', 'kami', 'kita', 'mereka', 'ini', 'itu',
  'yang', 'dan', 'atau', 'tapi', 'tetapi', 'di', 'ke', 'dari', 'pada', 'untuk',
  'dengan', 'tidak', 'bukan', 'ada', 'adalah', 'akan', 'sudah', 'belum', 'masih',
  'juga', 'sangat', 'sekali', 'lagi', 'saja', 'bisa', 'harus', 'mau', 'ingin',
  'ya', 'nya', 'lah', 'kah', 'pun', 'para', 'oleh', 'karena', 'kalau', 'jika',
  'setiap', 'semua', 'banyak', 'sedikit', 'apa', 'siapa', 'kapan', 'mana',
  'hanya', 'cuma', 'dekat', 'jauh',
  'bagaimana', 'kenapa', 'mengapa', 'sini', 'situ', 'sana', 'ku', 'mu', 'se',
  'sejak', 'setelah', 'sebelum', 'sambil', 'supaya', 'agar', 'sampai', 'selama',
  'secara', 'seperti', 'sebentar', 'dulu', 'lain', 'punya', 'jadi', 'menjadi',
  'lebih', 'kurang', 'paling', 'baru', 'lagi', 'sendiri', 'orang', 'hal',
  'waktu', 'hari', 'jam', 'tahun', 'bulan', 'minggu', 'pagi', 'siang', 'malam',
  'dalam', 'depan', 'luar', 'atas', 'bawah', 'antara', 'tanpa', 'tentang',
  'bicara', 'tinggal', 'pergi', 'lupa', 'dengar', 'bilang', 'kata', 'tanya',
  'bagus', 'pindah', 'main', 'susah', 'mudah', 'soal', 'angka', 'cerita',
  'barang', 'hasil', 'rencana', 'laporan', 'proyek', 'capai', 'wajah',
  'dapat', 'kabar', 'kunci', 'harga', 'uang', 'rumah', 'kerja', 'sekolah',
  'kelas', 'guru', 'anak', 'ibu', 'ayah', 'teman', 'kantor', 'kota', 'jalan',
]);

// 例句只该用「已教过的词 + 本包新词」。越界不阻断打包，只列出来供人工过一眼。
export function checkExampleVocabulary(packs, knownWords = []) {
  // 词表里有短语和连字符词（tambah nasi / ragu-ragu），按非字母切开逐词收录
  const split = (w) => String(w).toLowerCase().match(/[a-z]+/g) ?? [];
  const known = new Set([...knownWords, ...STOPWORDS].flatMap(split));
  const warnings = [];
  for (const pack of packs ?? []) {
    const local = new Set((pack.words ?? []).flatMap((w) => split(w.word)));
    const unknown = new Set();
    for (const w of pack.words ?? []) {
      for (const token of String(w.example ?? '').toLowerCase().match(/[a-z]+/g) ?? []) {
        const ok = stemCandidates(token).some((s) => known.has(s) || local.has(s));
        if (!ok) unknown.add(token);
      }
    }
    if (unknown.size) {
      warnings.push(`包 ${pack.id}（${pack.title}）例句含生词：${[...unknown].join('、')}`);
    }
  }
  return warnings;
}

export function validateDialogs(dialogs) {
  const problems = [];
  const seen = new Set();
  for (const d of dialogs ?? []) {
    if (seen.has(d.id)) problems.push(`对话 ${d.id} 重复出现`);
    seen.add(d.id);

    const lines = d.lines ?? [];
    if (lines.length < 12 || lines.length > 16) {
      problems.push(
        `对话 ${d.id}（${d.sceneZh}）有 ${lines.length} 轮，应为 12–16 轮`,
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

    // 场景说明与贴士是「实用」的主要载体，缺了这组对话就退回教科书对白
    if (!d.situasi) problems.push(`对话 ${d.id} 缺场景说明 situasi`);
    if ((d.tips ?? []).length < 2) {
      problems.push(`对话 ${d.id} 贴士少于 2 条`);
    }
    if ((d.keyPhrases ?? []).length < 6) {
      problems.push(`对话 ${d.id} 关键句少于 6 条`);
    }
    if ((d.vocab ?? []).length < 8) {
      problems.push(`对话 ${d.id} 生词少于 8 个`);
    }
    // 关键句要能套用：至少一半标出可替换部分
    const withGanti = (d.keyPhrases ?? []).filter((k) => k.ganti).length;
    if ((d.keyPhrases ?? []).length && withGanti * 2 < d.keyPhrases.length) {
      problems.push(
        `对话 ${d.id} 只有 ${withGanti} 条关键句标了可替换部分（ganti），应过半`,
      );
    }
  }
  return problems;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const readOrEmpty = (f, fallback) => {
    try {
      return JSON.parse(readFileSync(join(root, 'content-src', f), 'utf8'));
    } catch {
      return fallback;
    }
  };

  const skeleton = readOrEmpty('skeleton.json', []);
  const words = readOrEmpty('words.json', {});
  const dialogs = readOrEmpty('dialogs.json', []);

  // 只校验已填词的包 —— 没填词的是「准备中」，不是错误
  const packs = skeleton
    .map((p) => ({ ...p, words: words[p.id] ?? [] }))
    .filter((p) => p.words.length);

  // 已教过的词 = 初级全部 + 已开放的中高级包（学到中级时初级词都学过了）
  const taughtWords = packs.flatMap((p) => p.words.map((w) => w.word));

  const problems = [
    ...validatePacks(packs),
    ...validateNoCrossLevelDupes(packs),
    ...validateDialogs(dialogs),
  ];
  const warnings = checkExampleVocabulary(
    packs.filter((p) => p.level !== 'beginner'),
    taughtWords,
  );

  const total = packs.reduce((n, p) => n + p.words.length, 0);
  const byLevel = packs.reduce((acc, p) => {
    acc[p.level] = (acc[p.level] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `${packs.length} 个包 / ${total} 词 / ${dialogs.length} 组对话（`
    + Object.entries(byLevel).map(([k, v]) => `${k} ${v} 包`).join(' / ') + '）',
  );

  if (warnings.length) {
    console.warn(`例句生词提醒 ${warnings.length} 条：`);
    for (const w of warnings.slice(0, 20)) console.warn('  -', w);
  }
  if (problems.length) {
    console.error(`发现 ${problems.length} 个问题：`);
    for (const p of problems.slice(0, 50)) console.error('  -', p);
    process.exit(1);
  }
  console.log('校验通过');
}
