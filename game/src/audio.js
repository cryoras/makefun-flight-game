export function createAudio() {
  let ctx, master, engine, motor, wind, windGain, muted = false;
  function start() {
    if (ctx) { ctx.resume().catch(() => {}); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = .28; master.connect(ctx.destination);
      motor = ctx.createGain(); motor.gain.value = 0; motor.connect(master);
      engine = ctx.createOscillator(); engine.type = 'sawtooth';
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 260;
      engine.connect(filter); filter.connect(motor); engine.start();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
      let last = 0; for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .04) / 1.03; data[i] = last * 4; }
      wind = ctx.createBufferSource(); wind.buffer = buffer; wind.loop = true;
      windGain = ctx.createGain(); windGain.gain.value = 0; wind.connect(windGain); windGain.connect(master); wind.start();
    } catch { ctx = null; }
  }
  function tone(f, duration, volume = .3, type = 'sine', delay = 0) {
    if (!ctx) return;
    const at = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(Math.max(25, f * .6), at + duration);
    g.gain.setValueAtTime(.001, at); g.gain.exponentialRampToValueAtTime(volume, at + .015); g.gain.exponentialRampToValueAtTime(.001, at + duration);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + duration + .03);
  }
  return {
    start,
    toggle() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : .28, ctx.currentTime, .08); return muted; },
    event(name) {
      if (name === 'ring') { tone(880, .55); tone(1320, .7, .2, 'sine', .09); }
      if (name === 'touchdown') { tone(100, .35, .4, 'triangle'); tone(660, .6, .15, 'sine', .2); }
      if (name === 'crash') { tone(65, 1.2, .65, 'sawtooth'); tone(38, .9, .4, 'triangle', .05); }
      if (name === 'win') [660, 880, 1100].forEach((f, i) => tone(f, .8, .22, 'sine', i * .15));
    },
    update(p, active) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engine.frequency.setTargetAtTime(35 + p.throttle * 62 + p.speed * .18, t, .15);
      motor.gain.setTargetAtTime(active && p.fuel > 0 ? .025 + p.throttle * .12 : 0, t, .15);
      windGain.gain.setTargetAtTime(active ? Math.min(.35, p.speed / 250) : 0, t, .2);
    }
  };
}
