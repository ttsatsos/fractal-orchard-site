/* The record. Shared by every page on the hidden trail.
   Progress lives in the visitor's own browser. Nothing is sent anywhere. */
(() => {
  'use strict';
  const KEY = 'fractal-orchard-record-v1';
  const NS = 'http://www.w3.org/2000/svg';

  // Six pieces, one per hidden page. Each draws one stroke of the corner mark
  // and decodes two letters of the phrase the last page asks for.
  const PIECES = ['ledger', 'growth', 'plate', 'chart', 'frequency', 'assembly'];
  const LETTERS = { ledger: ['I', 'T'], growth: ['G', 'R'], plate: ['E', 'W'], chart: ['B', 'A'], frequency: ['C', 'K'], assembly: [] };
  const PHRASE = ['IT', 'GREW', 'BACK'];

  // The corner mark, split into six strokes. The arc thirds are exact sub-arcs of the
  // original circle (center 23.13, 24.19, radius 18), so the assembled mark matches the logo.
  const SEGMENTS = [
    'M31 8 A18 18 0 0 0 5.74 19.55',
    'M5.74 19.55 A18 18 0 0 0 21.88 42.15',
    'M21.88 42.15 A18 18 0 0 0 41 22',
    'M42 15 L32 24',
    'M32 24 L39 32',
    'M32 24 L26 19'
  ];

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (name, attrs = {}) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  // ── state ──────────────────────────────────────────────────────────
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { pieces: new Set(data.pieces || []), letters: new Set(data.letters || []) };
    } catch { return { pieces: new Set(), letters: new Set() }; }
  }
  const state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ pieces: [...state.pieces], letters: [...state.letters] })); } catch { /* private mode: progress lasts the visit */ }
  }

  // ── the script ─────────────────────────────────────────────────────
  // Every letter gets a stable glyph: two or three strokes across a 3 x 3 lattice, sometimes
  // a hook or a ring. Generated in alphabet order with collision checks, so it never changes.
  const NODE = [12, 24, 36];
  const ALPHABET = (() => {
    const seen = new Set();
    const table = {};
    for (let code = 65; code <= 90; code++) {
      for (let attempt = 0; attempt < 50; attempt++) {
        let s = code * 7919 + attempt * 104729 + 17;
        const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const pick = () => NODE[Math.floor(rand() * 3)];
        const parts = [];
        const strokes = 2 + Math.floor(rand() * 2);
        for (let i = 0; i < strokes; i++) {
          const a = [pick(), pick()];
          let b = [pick(), pick()];
          let guard = 0;
          while (b[0] === a[0] && b[1] === a[1] && guard++ < 9) b = [pick(), pick()];
          if (b[0] === a[0] && b[1] === a[1]) continue;
          if (rand() < .28) {
            const qx = (a[0] + b[0]) / 2 + Math.round(rand() * 14 - 7);
            const qy = (a[1] + b[1]) / 2 + Math.round(rand() * 14 - 7);
            parts.push({ kind: 'path', d: `M${a[0]} ${a[1]} Q${qx} ${qy} ${b[0]} ${b[1]}` });
          } else {
            parts.push({ kind: 'path', d: `M${a[0]} ${a[1]} L${b[0]} ${b[1]}` });
          }
        }
        if (rand() < .35) parts.push({ kind: 'circle', cx: pick(), cy: pick(), r: 3 });
        const signature = parts.map(p => p.d || `c${p.cx},${p.cy}`).sort().join('|');
        if (parts.length >= 2 && !seen.has(signature)) { seen.add(signature); table[String.fromCharCode(code)] = parts; break; }
      }
    }
    return table;
  })();

  function glyph(letter, className = 'glyph-mark') {
    const svg = el('svg', { viewBox: '0 0 48 48', class: className, 'aria-hidden': 'true' });
    for (const part of ALPHABET[letter] || []) {
      svg.append(part.kind === 'circle' ? el('circle', { cx: part.cx, cy: part.cy, r: part.r }) : el('path', { d: part.d }));
    }
    return svg;
  }

  // ── the corner mark ────────────────────────────────────────────────
  function renderSigil(svg, newIndex = -1) {
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.replaceChildren();
    SEGMENTS.forEach((d, i) => {
      svg.append(el('path', { d, class: 'seg seg-missing' }));
      if (state.pieces.has(PIECES[i])) {
        svg.append(el('path', { d, class: i === newIndex && !reduced() ? 'seg seg-found seg-new' : 'seg seg-found', pathLength: '1' }));
      }
    });
  }
  function renderAllSigils(newIndex) {
    document.querySelectorAll('svg[data-sigil]').forEach(svg => renderSigil(svg, newIndex));
  }

  // ── decoded letters, shown when a piece is found, until the next tap ─
  function announce(letters, note) {
    const strip = document.createElement('div');
    strip.className = 'decoded';
    strip.setAttribute('role', 'status');
    if (letters.length) {
      for (const letter of letters) {
        const pair = document.createElement('span');
        pair.className = 'pair';
        pair.append(glyph(letter));
        const text = document.createElement('b');
        text.textContent = letter;
        pair.append(text);
        strip.append(pair);
      }
    }
    if (note) {
      const p = document.createElement('span');
      p.className = 'note';
      p.textContent = note;
      strip.append(p);
    }
    document.querySelectorAll('.decoded').forEach(old => old.remove());
    document.body.append(strip);
    requestAnimationFrame(() => strip.classList.add('shown'));
    // Stays until the visitor taps somewhere (or leaves), so the letters cannot slip by unseen.
    const dismiss = () => {
      document.removeEventListener('pointerdown', dismiss, true);
      strip.classList.remove('shown');
      setTimeout(() => strip.remove(), 900);
    };
    setTimeout(() => document.addEventListener('pointerdown', dismiss, true), 900);
  }

  // ── the page itself acknowledges: a glow on the artifact, and a quiet note ─
  function recordedNote(animate) {
    const stage = document.querySelector('.stage');
    if (!stage || stage.querySelector('.recorded')) return;
    const p = document.createElement('p');
    p.className = animate && !reduced() ? 'recorded recorded-new' : 'recorded';
    p.textContent = 'Recorded.';
    const caption = stage.querySelector('.caption');
    if (caption) caption.after(p); else stage.append(p);
  }
  function glowArtifact() {
    const artifact = document.querySelector('.stage > *');
    if (!artifact || reduced()) return;
    artifact.classList.remove('record-glow'); void artifact.offsetWidth; artifact.classList.add('record-glow');
  }

  // ── the mark comes forward, takes its new stroke, and returns to the corner ─
  function reveal(index, done) {
    const home = document.querySelector('.home');
    if (reduced() || !home) { renderAllSigils(); done(); return; }
    const veil = document.createElement('div');
    veil.className = 'reveal';
    veil.setAttribute('aria-hidden', 'true');
    const big = el('svg', { class: 'sigil reveal-sigil' });
    veil.append(big);
    document.body.append(veil);
    renderSigil(big, index);
    home.classList.add('awaiting');
    requestAnimationFrame(() => veil.classList.add('shown'));

    let finished = false;
    const land = () => {
      if (finished) return;
      finished = true;
      const from = big.getBoundingClientRect(), to = home.getBoundingClientRect();
      const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      big.style.transform = `translate(${dx}px, ${dy}px) scale(${to.width / from.width})`;
      veil.classList.add('landing');
      setTimeout(() => {
        veil.remove();
        home.classList.remove('awaiting');
        renderAllSigils();
        home.classList.add('arrived');
        setTimeout(() => home.classList.remove('arrived'), 1600);
        done();
      }, 750);
    };
    veil.addEventListener('pointerdown', land);
    setTimeout(land, 2900);
  }

  function award(id, note) {
    if (!PIECES.includes(id) || state.pieces.has(id)) return false;
    state.pieces.add(id);
    LETTERS[id].forEach(letter => state.letters.add(letter));
    save();
    glowArtifact();
    recordedNote(true);
    setTimeout(() => reveal(PIECES.indexOf(id), () => announce(LETTERS[id], note)), reduced() ? 0 : 650);
    document.dispatchEvent(new CustomEvent('record:piece', { detail: { id } }));
    return true;
  }

  // ── leaving a page ─────────────────────────────────────────────────
  function go(href) {
    if (reduced()) { location.href = href; return; }
    document.body.classList.add('leaving');
    setTimeout(() => { location.href = href; }, 420);
  }
  window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));

  // ── a quieter sky for the hidden pages ─────────────────────────────
  function sky(canvas, perPixel = 3200, seed = 4409) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let stars = [], w = 1, h = 1, frame = 0, last = 0;
    function field(count) {
      let s = seed;
      const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
      stars = Array.from({ length: count }, () => ({
        x: rand(), y: rand(), r: .3 + rand() * .8, base: .1 + rand() * .3, amp: .06 + rand() * .22,
        speed: .3 + rand() * 1.3, phase: rand() * 6.283
      }));
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        const a = reduced() ? st.base : st.base + st.amp * Math.sin(t * .001 * st.speed + st.phase);
        if (a <= .02) continue;
        ctx.fillStyle = `rgba(226,230,224,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(st.x * w, st.y * h, st.r, 0, 6.2832); ctx.fill();
      }
    }
    function tick(stamp) {
      frame = 0;
      if (reduced() || document.hidden) return;
      if (stamp - last > 40) { last = stamp; draw(stamp); }
      frame = requestAnimationFrame(tick);
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!stars.length) field(Math.min(500, Math.round(w * h / perPixel)));
      draw(performance.now());
    }
    new ResizeObserver(resize).observe(canvas);
    document.addEventListener('visibilitychange', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); });
    resize();
    frame = requestAnimationFrame(tick);
  }

  // ── old paper: grain, foxing, a water stain, a fold ────────────────
  // Drawn once into a canvas that is multiplied over the page colour.
  function paper(canvas, { seed = 23011, stain = [.78, .2], fold = .53 } = {}) {
    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const g = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
      let s = seed; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const img = g.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 235 + rand() * 20;
        img.data[i] = v; img.data[i + 1] = v - 4; img.data[i + 2] = v - 14; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const ring = g.createRadialGradient(w * stain[0], h * stain[1], 0, w * stain[0], h * stain[1], w * .38);
      ring.addColorStop(0, 'rgba(150,110,60,.05)'); ring.addColorStop(.72, 'rgba(140,100,50,.12)');
      ring.addColorStop(.78, 'rgba(120,80,40,.22)'); ring.addColorStop(.84, 'rgba(255,255,255,0)');
      g.fillStyle = ring; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 38; i++) {
        g.fillStyle = `rgba(120,80,40,${.06 + rand() * .14})`;
        g.beginPath(); g.arc(rand() * w, rand() * h, (1 + rand() * 5) * dpr, 0, 6.28); g.fill();
      }
      const crease = g.createLinearGradient(0, h * (fold - .01), 0, h * (fold + .03));
      crease.addColorStop(0, 'rgba(0,0,0,0)'); crease.addColorStop(.5, 'rgba(60,40,20,.16)'); crease.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = crease; g.fillRect(0, h * (fold - .03), w, h * .08);
      const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .72);
      edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(70,45,20,.38)');
      g.fillStyle = edge; g.fillRect(0, 0, w, h);
    };
    new ResizeObserver(paint).observe(canvas);
  }

  // ── the visitor's own line ─────────────────────────────────────────
  // Kept in this browser only: the date and the mark. The address is not kept here.
  const LINE_KEY = 'fractal-orchard-line-v1';
  function readLine() {
    try {
      const data = JSON.parse(localStorage.getItem(LINE_KEY) || 'null');
      return data && typeof data.date === 'string' && Array.isArray(data.mark) ? data : null;
    } catch { return null; }
  }
  function writeLine(date, mark) {
    try { localStorage.setItem(LINE_KEY, JSON.stringify({ date, mark })); } catch { /* private mode */ }
  }

  // Ledger-style date, e.g. "Sep. 12, 2026".
  function ledgerDate(d = new Date()) {
    const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // A stroke of [x, y] points in a 0-100 box, smoothed through midpoints.
  function markPath(points) {
    if (!points || points.length < 2) return '';
    let d = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const mx = ((points[i][0] + points[i + 1][0]) / 2).toFixed(1);
      const my = ((points[i][1] + points[i + 1][1]) / 2).toFixed(1);
      d += ` Q${points[i][0]} ${points[i][1]} ${mx} ${my}`;
    }
    const end = points[points.length - 1];
    return d + ` L${end[0]} ${end[1]}`;
  }

  window.Record = {
    PIECES, LETTERS, PHRASE, state, glyph, award, go, sky, paper, renderAllSigils,
    readLine, writeLine, ledgerDate, markPath,
    has: id => state.pieces.has(id),
    complete: () => PIECES.every(id => state.pieces.has(id))
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderAllSigils();
    const piece = document.body.dataset.piece;
    if (piece && state.pieces.has(piece)) recordedNote(false);
    document.querySelectorAll('canvas[data-sky]').forEach(c => sky(c));
  });
})();
