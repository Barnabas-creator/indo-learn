import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTts, pickIndonesianVoice } from '../lib/tts.js';

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

test('优先选 id-ID 精确匹配', () => {
  const v = pickIndonesianVoice([
    { lang: 'en-US', name: 'A' },
    { lang: 'id', name: 'B' },
    { lang: 'id-ID', name: 'C' },
  ]);
  assert.equal(v.name, 'C');
});

test('没有精确匹配时退回 id 前缀', () => {
  const v = pickIndonesianVoice([{ lang: 'en-US' }, { lang: 'id_ID' }]);
  assert.equal(v.lang, 'id_ID');
});

test('完全没有印尼语音色返回 null', () => {
  assert.equal(
    pickIndonesianVoice([{ lang: 'en-US' }, { lang: 'zh-CN' }]),
    null,
  );
});

test('speak 会设置 lang 并调用 synth.speak', () => {
  const spoken = [];
  const synth = {
    getVoices: () => [{ lang: 'id-ID', name: 'Damayanti' }],
    speak: (u) => spoken.push(u),
    cancel: () => {},
  };
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  tts.speak('Selamat pagi');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'Selamat pagi');
  assert.equal(spoken[0].lang, 'id-ID');
  assert.equal(spoken[0].voice.name, 'Damayanti');
});

test('无印尼语音色时仍设 lang，voice 为 undefined', () => {
  const spoken = [];
  const synth = {
    getVoices: () => [{ lang: 'en-US' }],
    speak: (u) => spoken.push(u),
    cancel: () => {},
  };
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  assert.equal(tts.hasIndonesianVoice(), false);
  tts.speak('halo');
  assert.equal(spoken[0].lang, 'id-ID');
  assert.equal(spoken[0].voice, undefined);
});

test('stop 调用 synth.cancel', () => {
  let cancelled = 0;
  const synth = {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {
      cancelled++;
    },
  };
  createTts({ synth, VoiceUtterance: FakeUtterance }).stop();
  assert.equal(cancelled, 1);
});

test('speakSequence 逐条朗读，前一条结束才播下一条', () => {
  const spoken = [];
  const synth = {
    getVoices: () => [{ lang: 'id-ID', name: 'D' }],
    speak: (u) => spoken.push(u),
    cancel: () => {},
  };
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  tts.speakSequence(['satu', 'dua', 'tiga'], 0);

  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'satu');
  spoken[0].onend();
  return new Promise((resolve) =>
    setTimeout(() => {
      assert.equal(spoken.length, 2);
      assert.equal(spoken[1].text, 'dua');
      resolve();
    }, 5),
  );
});
