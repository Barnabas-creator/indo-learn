import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTts, pickIndonesianVoice, CANCEL_GAP_MS } from '../lib/tts.js';

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

// 可控的假 synth：voices 可空（模拟安卓首次 getVoices() 返回空），
// speaking 可开（模拟「正在播时又点朗读」这条要打断的路径）。
function fakeSynth({ voices = [{ lang: 'id-ID', name: 'Damayanti' }] } = {}) {
  const listeners = {};
  return {
    spoken: [],
    cancelled: 0,
    resumed: 0,
    voices,
    speaking: false,
    getVoices() { return this.voices; },
    speak(u) { this.spoken.push(u); },
    cancel() { this.cancelled++; },
    resume() { this.resumed++; },
    addEventListener(name, fn) { (listeners[name] ??= []).push(fn); },
    emit(name) { (listeners[name] ?? []).forEach((fn) => fn()); },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

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
  assert.equal(pickIndonesianVoice([{ lang: 'en-US' }, { lang: 'zh-CN' }]), null);
});

// iOS Safari 只认用户手势同步栈里的 speak()，所以这条最常见路径必须是同步的。
test('音色已就绪且当前没在播时，speak 同步发声', () => {
  const synth = fakeSynth();
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  tts.speak('Selamat pagi');
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].text, 'Selamat pagi');
  assert.equal(synth.spoken[0].lang, 'id-ID');
  assert.equal(synth.spoken[0].voice.name, 'Damayanti');
  assert.equal(synth.cancelled, 0, '没在播就不该 cancel（cancel 后紧接着 speak 会被安卓丢掉）');
  assert.equal(synth.resumed, 1, 'Chrome 切后台会挂起队列，发声前要 resume');
});

test('无印尼语音色时仍设 lang，voice 为 undefined', () => {
  const synth = fakeSynth({ voices: [{ lang: 'en-US' }] });
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  assert.equal(tts.hasIndonesianVoice(), false);
  tts.speak('halo');
  assert.equal(synth.spoken[0].lang, 'id-ID');
  assert.equal(synth.spoken[0].voice, undefined);
});

// 安卓首次 getVoices() 返回空：早发声会静音，必须等 voiceschanged。
test('音色未就绪时先等 voiceschanged 再发声', async () => {
  const synth = fakeSynth({ voices: [] });
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  tts.speak('halo');
  await tick();
  assert.equal(synth.spoken.length, 0, '音色没到齐前不该发声');

  synth.voices = [{ lang: 'id-ID', name: 'Damayanti' }];
  synth.emit('voiceschanged');
  await tick();
  await tick();
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].voice.name, 'Damayanti', '等到音色后要挂上印尼语音色');
});

// Chrome：cancel() 之后立刻 speak()，这条会被丢掉。必须隔一个间隔。
test('正在播时再点朗读：先 cancel，隔一个间隔后才发新的', async () => {
  const delays = [];
  const synth = fakeSynth();
  synth.speaking = true;
  const tts = createTts({
    synth,
    VoiceUtterance: FakeUtterance,
    setTimeoutFn: (fn, ms) => { delays.push(ms); return setTimeout(fn, 0); },
  });
  tts.speak('dua');
  assert.equal(synth.cancelled, 1);
  assert.equal(synth.spoken.length, 0, 'cancel 后不能同一时刻 speak');
  await tick();
  await tick();
  assert.deepEqual(delays, [CANCEL_GAP_MS]);
  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].text, 'dua');
});

test('stop 调用 synth.cancel', () => {
  const synth = fakeSynth({ voices: [] });
  createTts({ synth, VoiceUtterance: FakeUtterance }).stop();
  assert.equal(synth.cancelled, 1);
});

// stop() 后不能再冒出一条排队中的朗读——退出词卡页时最明显。
test('等待期间被 stop 掉的朗读不会再发声', async () => {
  const synth = fakeSynth({ voices: [] });
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  tts.speak('halo');
  tts.stop();
  synth.voices = [{ lang: 'id-ID' }];
  synth.emit('voiceschanged');
  await tick();
  await tick();
  assert.equal(synth.spoken.length, 0);
});

test('speakSequence 逐条朗读，前一条结束才播下一条', async () => {
  const synth = fakeSynth();
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  tts.speakSequence(['satu', 'dua', 'tiga'], 0);

  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].text, 'satu');
  synth.spoken[0].onend();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(synth.spoken.length, 2);
  assert.equal(synth.spoken[1].text, 'dua');
});

test('speakSequence 被 stop 后不再继续下一条', async () => {
  const synth = fakeSynth();
  const tts = createTts({ synth, VoiceUtterance: FakeUtterance });
  tts.speakSequence(['satu', 'dua'], 0);
  const first = synth.spoken[0];
  tts.stop();
  first.onend();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(synth.spoken.length, 1);
});
