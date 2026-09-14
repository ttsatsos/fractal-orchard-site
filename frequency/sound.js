/* Sound for the frequency page, generated in the browser. No audio files.
   While the line is held: a low hum and a whirr that rise as the gold fills, and the line's
   own pulses as faint tones. Once it is still: dark music from somewhere far off.
   Browsers only allow sound after a tap, so nothing plays until the visitor touches the page. */
(() => {
  'use strict';
  const KEY = 'fractal-orchard-sound-muted';
  let ctx = null, master = null, hum = null, whirr = null, tone = null, rave = null, wantRave = false;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked: default to sound on */ }
  const listeners = new Set();

  function noise(seconds) {
    const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // A long, dark room: stereo noise that dies away, so the music arrives smeared by distance.
  function impulse(seconds, decay) {
    const length = Math.round(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);

    // The hum: a sine and a quieter, slightly detuned saw under a low-pass that opens with the gold.
    const humOut = ctx.createGain(); humOut.gain.value = 0;
    const humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 260; humFilter.Q.value = 3;
    const low = ctx.createOscillator(); low.type = 'sine'; low.frequency.value = 55;
    const buzz = ctx.createOscillator(); buzz.type = 'sawtooth'; buzz.frequency.value = 110.6;
    const buzzLevel = ctx.createGain(); buzzLevel.gain.value = .35;
    low.connect(humFilter); buzz.connect(buzzLevel).connect(humFilter);
    humFilter.connect(humOut).connect(master);
    low.start(); buzz.start();
    hum = { out: humOut, filter: humFilter, low, buzz };

    // The whirr: noise through a narrow band that climbs, fluttering a few times a second.
    const source = ctx.createBufferSource(); source.buffer = noise(2); source.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 700; band.Q.value = 4;
    const flutter = ctx.createGain(); flutter.gain.value = .6;
    const flutterLfo = ctx.createOscillator(); flutterLfo.frequency.value = 7;
    const flutterDepth = ctx.createGain(); flutterDepth.gain.value = .4;
    flutterLfo.connect(flutterDepth).connect(flutter.gain);
    const whirrOut = ctx.createGain(); whirrOut.gain.value = 0;
    source.connect(band).connect(flutter).connect(whirrOut).connect(master);
    source.start(); flutterLfo.start();
    whirr = { out: whirrOut, band };

    // The line's pulses, heard as a faint tone.
    const beep = ctx.createOscillator(); beep.type = 'sine'; beep.frequency.value = 620;
    const beepOut = ctx.createGain(); beepOut.gain.value = 0;
    beep.connect(beepOut).connect(master);
    beep.start();
    tone = { out: beepOut };

    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    return true;
  }

  // Call from inside a tap or key press.
  function wake() {
    if (!ctx && !build()) return;
    const ready = () => { if (wantRave) startRave(); };
    if (ctx.state === 'suspended') ctx.resume().then(ready, () => {}); else ready();
  }

  // Called every frame by the page with the line's state.
  function update(progress, holding, pulse, done) {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime, glide = .08;
    const level = done ? 0 : Math.max(holding ? .15 : 0, progress);
    hum.out.gain.setTargetAtTime(.14 * level, now, glide);
    hum.low.frequency.setTargetAtTime(55 * (1 + .5 * progress), now, glide);
    hum.buzz.frequency.setTargetAtTime(110.6 * (1 + .5 * progress), now, glide);
    hum.filter.frequency.setTargetAtTime(260 + 1400 * progress, now, glide);
    whirr.out.gain.setTargetAtTime(.05 * level, now, glide);
    whirr.band.frequency.setTargetAtTime(700 + 2200 * progress, now, glide);
    tone.out.gain.setTargetAtTime(.035 * level * Math.max(0, pulse), now, .015);
  }

  // Dark four-on-the-floor from a mile away: kick and bass only, everything above a low murmur
  // filtered out, drowned in a long room, drifting louder and quieter as if on the wind.
  function startRave() {
    wantRave = true;
    if (rave || !ctx || ctx.state !== 'running') return;
    const bus = ctx.createGain(); bus.gain.value = .9;
    const distance = ctx.createBiquadFilter(); distance.type = 'lowpass'; distance.frequency.value = 230; distance.Q.value = .7;
    const room = ctx.createConvolver(); room.buffer = impulse(3.6, 2.4);
    const dry = ctx.createGain(); dry.gain.value = .5;
    const wet = ctx.createGain(); wet.gain.value = .9;
    const drift = ctx.createGain(); drift.gain.value = 0;
    bus.connect(distance);
    distance.connect(dry).connect(drift);
    distance.connect(room).connect(wet).connect(drift);
    drift.connect(master);

    const t0 = ctx.currentTime;
    drift.gain.setValueAtTime(0, t0);
    drift.gain.linearRampToValueAtTime(.42, t0 + 8);
    const wind = ctx.createOscillator(); wind.frequency.value = .06;
    const windDepth = ctx.createGain(); windDepth.gain.value = .16;
    wind.connect(windDepth).connect(drift.gain);
    wind.start(t0 + 8);

    const BPM = 126, sixteenth = 60 / BPM / 4;
    const roots = [55, 55, 49, 58.27];            // A, A, G, B-flat: one per bar
    let next = t0 + .1, step = 0;

    const kick = at => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(42, at + .12);
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(1, at + .005); g.gain.exponentialRampToValueAtTime(.001, at + .42);
      o.connect(g).connect(bus); o.start(at); o.stop(at + .45);
    };
    const bass = (at, frequency) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = frequency;
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.32, at + .01); g.gain.exponentialRampToValueAtTime(.001, at + sixteenth * 1.8);
      o.connect(g).connect(bus); o.start(at); o.stop(at + sixteenth * 2);
    };
    const crowd = at => {
      const s = ctx.createBufferSource(); s.buffer = noise(4);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = .8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(.12, at + 1.6); g.gain.exponentialRampToValueAtTime(.0001, at + 4);
      s.connect(f).connect(g).connect(bus); s.start(at); s.stop(at + 4);
    };

    const timer = setInterval(() => {
      if (ctx.state !== 'running') return;
      while (next < ctx.currentTime + .15) {
        const s = step % 16, bar = Math.floor(step / 16) % 4;
        if (s % 4 === 0) kick(next);
        if (s % 4 === 2) bass(next, roots[bar]);
        if (bar === 3 && s === 14) bass(next, roots[bar] * 1.5);
        if (step % (16 * 16) === 16 * 8) crowd(next);
        next += sixteenth; step++;
      }
    }, 40);
    rave = { timer };
  }

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* ignore */ }
    if (ctx) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, .05);
    listeners.forEach(fn => fn(value));
  }

  window.OrchardSound = {
    wake, update, startRave, setMuted,
    isMuted: () => muted,
    // For checking from the console: is the audio running, and has the far-off music started?
    status: () => ({ context: ctx ? ctx.state : 'not started', humLevel: hum ? +hum.out.gain.value.toFixed(3) : 0, farMusic: !!rave, muted }),
    onChange: fn => { listeners.add(fn); fn(muted); }
  };
})();
