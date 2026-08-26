// Web Speech API 封装。印尼语音色在各平台可用性不同：
// iOS Safari 自带 id-ID（Damayanti）；安卓要装「Google 语音服务」的印尼语数据包。
//
// 安卓上「点朗读没声音」有三个各自独立的原因，这里逐个挡掉：
//
// 1. getVoices() 首次同步调用返回空数组，音色要等 voiceschanged 事件才到齐。
//    早于它 speak()，voice 挂不上，Chrome 往往直接静音（只设 lang 不够）。
//    → 音色还没到齐时，等 voiceschanged（最多 VOICES_TIMEOUT_MS）再真正 speak。
// 2. Chrome 的老问题：cancel() 之后立刻 speak()，这条 utterance 会被丢掉。
//    换词卡、speakSequence 开头这些「停了马上播」的地方正好踩中。
//    → 只有确实需要打断时才 cancel，并且 cancel 与 speak 之间隔 CANCEL_GAP_MS。
// 3. 手机压根没装印尼语数据包：不报错，就是没声音。
//    → hasIndonesianVoice() 供 UI 提示怎么装；speak() 不因此中断，照样用系统默认音色试。
//
// 为什么不无脑异步：iOS Safari 要求首次 speak() 落在用户手势的同步调用栈里，
// 一律 setTimeout 会把 iOS 弄哑。所以「音色已就绪且当前没在播」这条最常见的路径
// 保持同步直发，只有真需要等音色/等打断间隔时才异步。

export const CANCEL_GAP_MS = 120;
const VOICES_TIMEOUT_MS = 2000;

export function pickIndonesianVoice(voices) {
  const list = voices ?? [];
  const norm = (l) => String(l ?? '').replace('_', '-').toLowerCase();
  return (
    list.find((v) => norm(v.lang) === 'id-id') ??
    list.find((v) => norm(v.lang).split('-')[0] === 'id') ??
    null
  );
}

export function createTts({ synth, VoiceUtterance, setTimeoutFn = setTimeout }) {
  const voicesLoaded = () => (synth.getVoices() ?? []).length > 0;

  function voice() {
    return pickIndonesianVoice(synth.getVoices());
  }

  // 等音色列表到齐；已经有就立即 resolve，否则等 voiceschanged，最多等 VOICES_TIMEOUT_MS。
  // 超时也照样往下走——没音色时只设 lang 让系统尽力朗读，总比一直不出声强。
  let readyPromise = null;
  function whenReady() {
    if (readyPromise) return readyPromise;
    if (voicesLoaded()) {
      readyPromise = Promise.resolve();
      return readyPromise;
    }
    readyPromise = new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      synth.addEventListener?.('voiceschanged', finish, { once: true });
      setTimeoutFn(finish, VOICES_TIMEOUT_MS);
    });
    return readyPromise;
  }

  function utter(text) {
    const u = new VoiceUtterance(text);
    u.lang = 'id-ID';
    u.rate = 0.9;
    const v = voice();
    if (v) u.voice = v;
    return u;
  }

  // 每次真正 speak 前 resume 一下：安卓/桌面 Chrome 切后台再回来会把队列挂起，
  // 不 resume 的话之后所有朗读都静默排队。没有 resume 的实现（测试假 synth）跳过。
  function push(u) {
    synth.resume?.();
    synth.speak(u);
  }

  // 本次朗读的代号：stop() 或新的 speak() 会让它自增，从而作废还在等待中的旧回调。
  let epoch = 0;
  const busy = () => Boolean(synth.speaking || synth.pending);

  function stop() {
    epoch += 1;
    synth.cancel();
  }

  // 统一的启动路径：needsCancel 决定要不要打断上一条，start 是真正发声的动作。
  function run(start) {
    const mine = ++epoch;
    const needsCancel = busy();
    if (needsCancel) synth.cancel();
    const go = () => { if (mine === epoch) start(); };
    if (!needsCancel && voicesLoaded()) return go(); // 同步直发，保住 iOS 的用户手势
    whenReady().then(() => setTimeoutFn(go, needsCancel ? CANCEL_GAP_MS : 0));
    return undefined;
  }

  function speak(text) {
    if (!text) return;
    run(() => push(utter(text)));
  }

  function speakSequence(texts, gapMs = 400) {
    const list = (texts ?? []).filter(Boolean);
    if (!list.length) return;
    run(() => {
      const mine = epoch;
      let i = 0;
      const next = () => {
        if (mine !== epoch || i >= list.length) return;
        const u = utter(list[i++]);
        u.onend = () => setTimeoutFn(next, gapMs);
        push(u);
      };
      next();
    });
  }

  return {
    speak,
    speakSequence,
    stop,
    whenReady,
    hasIndonesianVoice: () => voice() !== null,
  };
}
