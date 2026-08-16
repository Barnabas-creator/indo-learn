// Web Speech API 封装。印尼语音色在各平台可用性不同：
// iOS Safari 自带 id-ID（Damayanti）；Android 需装 Google TTS 印尼语包。
// 没有音色时仍设置 lang，让系统尽力朗读，同时由 hasIndonesianVoice() 供 UI 提示。

export function pickIndonesianVoice(voices) {
  const list = voices ?? [];
  const norm = (l) => String(l ?? '').replace('_', '-').toLowerCase();
  return (
    list.find((v) => norm(v.lang) === 'id-id') ??
    list.find((v) => norm(v.lang).split('-')[0] === 'id') ??
    null
  );
}

export function createTts({ synth, VoiceUtterance }) {
  function voice() {
    return pickIndonesianVoice(synth.getVoices());
  }

  function utter(text) {
    const u = new VoiceUtterance(text);
    u.lang = 'id-ID';
    u.rate = 0.9;
    const v = voice();
    if (v) u.voice = v;
    return u;
  }

  function stop() {
    synth.cancel();
  }

  function speak(text) {
    if (!text) return;
    synth.speak(utter(text));
  }

  function speakSequence(texts, gapMs = 400) {
    stop();
    const list = (texts ?? []).filter(Boolean);
    let i = 0;
    const next = () => {
      if (i >= list.length) return;
      const u = utter(list[i++]);
      u.onend = () => setTimeout(next, gapMs);
      synth.speak(u);
    };
    next();
  }

  return {
    speak,
    speakSequence,
    stop,
    hasIndonesianVoice: () => voice() !== null,
  };
}
