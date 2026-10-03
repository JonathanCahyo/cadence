/* Cadence — boot, scroll choreography and the hero's virtual cube. */
(function () {
  'use strict';
  const NS = window.Cadence;
  const C = NS.cube;
  const U = NS.util;
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const typing = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');

  document.documentElement.classList.add('js');
  NS.fx.initTicker();
  NS.fx.initReveal();
  NS.fx.initTilt();
  const timer = NS.Timer.init();
  NS.initStats();
  NS.initCoach();
  NS.initMethods();
  NS.initDetails();
  NS.initRing();

  /* nav state + year */
  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const yr = $('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* timer listens to Space only while its section is on screen */
  const timerSec = $('timer');
  if (timerSec && 'IntersectionObserver' in window) {
    new IntersectionObserver((en) => timer.setActive(en[0].intersectionRatio > 0.35), { threshold: [0, 0.35, 0.6, 1] }).observe(timerSec);
  }

  let engine = null;
  if (C.Engine) {
    try {
      engine = new C.Engine($('scene'));
    } catch (e) {
      console.warn('WebGL unavailable', e);
    }
  }
  if (!engine) {
    document.documentElement.classList.add('no-webgl');
    let last = performance.now();
    (function loop(now) {
      timer.tick(now);
      last = now;
      requestAnimationFrame(loop);
    })(last);
    return;
  }

  let mode = null;

  /* ---------------- hero: virtual cube with its own race timer ---------------- */
  const hero = (function () {
    const el = { time: $('vtTime'), moves: $('vtMoves'), pill: $('vtState'), hint: $('vtHint'), log: $('vtLog'),
      scr: $('vtScramble'), solve: $('vtSolve'), reset: $('vtReset'), anchor: document.querySelector('[data-cube="hero"]') };
    const DEFAULT_HINT = 'Drag a sticker to turn a layer · drag beside the cube to spin it';
    let saved = [], st = 'free', t0 = 0, n = 0, token = 0, log = [];
    const LABEL = { free: 'Virtual', scrambling: 'Scrambling', armed: 'Ready', solving: 'Live', done: 'Solved', autosolve: 'Auto-solve' };
    function render() {
      el.pill.textContent = LABEL[st];
      el.pill.className = 'vt-pill' + (st === 'solving' || st === 'armed' ? ' is-live' : st === 'done' ? ' is-done' : '');
      el.moves.textContent = n + (n === 1 ? ' move' : ' moves');
      const lock = st === 'scrambling' || st === 'autosolve';
      el.scr.disabled = lock;
      el.solve.disabled = lock;
    }
    function hint(t) {
      el.hint.textContent = t;
    }
    function pushLog(name) {
      log.push(name);
      if (log.length > 18) log.shift();
      el.log.innerHTML = log.map((m, i) => '<span' + (i === log.length - 1 ? ' class="new"' : '') + '>' + m + '</span>').join('');
    }
    function clearLog() {
      log = [];
      el.log.innerHTML = '';
    }
    async function scramble() {
      if (mode !== 'hero') return;
      const my = ++token;
      engine.setState([]);
      clearLog();
      n = 0;
      el.time.textContent = '0.00';
      st = 'scrambling';
      render();
      hint('Scrambling…');
      const ok = await engine.playAlg(C.parseAlg(C.randomScramble(20)), reduced ? 0.02 : 0.075, 'auto');
      if (my !== token || !ok) return;
      st = 'armed';
      render();
      hint('Your turn — the timer starts with your first move');
    }
    async function solve() {
      if (mode !== 'hero') return;
      const sol = C.simplify(C.invertAlg(engine.history));
      if (!sol.length) {
        hint('Already solved — hit Scramble to race');
        return;
      }
      const my = ++token;
      st = 'autosolve';
      render();
      hint('Unwinding ' + sol.length + (sol.length === 1 ? ' move…' : ' moves…'));
      const ok = await engine.playAlg(sol, clamp(3 / sol.length, 0.05, 0.16), 'auto');
      if (my !== token || !ok) return;
      st = 'free';
      n = 0;
      render();
      hint(DEFAULT_HINT);
    }
    function reset() {
      token++;
      engine.setState([]);
      st = 'free';
      n = 0;
      el.time.textContent = '0.00';
      clearLog();
      render();
      hint(DEFAULT_HINT);
    }
    function onMove(m, source) {
      pushLog(C.moveName(m));
      if (source === 'user') {
        if (st === 'armed') {
          st = 'solving';
          t0 = performance.now();
          n = 0;
          hint('Go — back to six solid faces');
        } else if (st === 'done') {
          st = 'free';
          n = 0;
        }
        n++;
        render();
      }
      if (engine.isSolved()) {
        engine.history = [];
        if (st === 'solving') {
          const ms = performance.now() - t0;
          st = 'done';
          el.time.textContent = U.fmt(ms);
          render();
          hint('Solved in ' + U.fmt(ms) + ' · ' + n + ' moves · ' + (n / Math.max(0.01, ms / 1000)).toFixed(2) + ' TPS');
          const r = el.anchor.getBoundingClientRect();
          NS.fx.confetti(r.left + r.width / 2, r.top + r.height / 2, 180);
        }
      }
    }
    el.scr.addEventListener('click', scramble);
    el.solve.addEventListener('click', solve);
    el.reset.addEventListener('click', reset);
    window.addEventListener('keydown', (e) => {
      if (mode !== 'hero' || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const map = { KeyR: 'R', KeyL: 'L', KeyU: 'U', KeyD: 'D', KeyF: 'F', KeyB: 'B', KeyM: 'M' };
      const f = map[e.code];
      if (!f || st === 'scrambling' || st === 'autosolve' || engine.queue.length > 3) return;
      e.preventDefault();
      engine.play(C.parseMove(f + (e.shiftKey ? "'" : '')), 0.13, 'user');
    });
    render();
    return {
      enter() {
        engine.allowTurns = true;
        engine.setState(saved);
      },
      leave() {
        saved = engine.history.slice();
        if (st === 'scrambling' || st === 'autosolve') {
          token++;
          st = 'free';
          render();
          hint(DEFAULT_HINT);
        }
      },
      onMove,
      tick() {
        if (st === 'solving') el.time.textContent = U.fmt(performance.now() - t0);
      },
    };
  })();

  const learn = NS.createLearn(engine, () => mode === 'learn');
  const solver = NS.createSolver(engine);

  function showTimerScramble() {
    engine.setState([]);
    engine.playAlg(C.parseAlg(timer.scramble), reduced ? 0.01 : 0.045, 'auto');
  }
  timer.onScramble = () => {
    if (mode === 'timer') showTimerScramble();
  };

  function base() {
    engine.allowTurns = false;
    engine.allowOrbit = true;
    engine.autoSpin = 0;
    engine.sway = 1;
    engine.glow = 1;
    engine.lookAt(null);
    engine.setUnknown(false);
  }
  const MODES = {
    hero: { enter() { base(); hero.enter(); }, leave: hero.leave },
    tools: { enter() { base(); engine.setState([]); engine.autoSpin = reduced ? 0 : 0.3; engine.sway = 0.4; } },
    timer: { enter() { base(); engine.glow = 0.55; showTimerScramble(); } },
    solver: { enter() { base(); solver.enter(); }, leave: solver.leave },
    learn: { enter() { base(); learn.enter(); }, leave: learn.leave },
    cta: { enter() { base(); engine.setState([]); engine.allowTurns = true; engine.autoSpin = reduced ? 0 : 0.12; } },
  };
  function switchMode(next) {
    if (next === mode) return;
    const prev = MODES[mode];
    if (prev && prev.leave) prev.leave();
    mode = next;
    const m = MODES[next];
    if (m) m.enter();
    else base();
  }
  engine.onMove = (m, src) => {
    if (mode === 'hero') hero.onMove(m, src);
  };

  /* ---------------- cube slots ----------------
     Each [data-cube] element is a slot inside its own section. The canvas is
     mounted inside whichever slot is most in view, so it scrolls with the page
     like any other element. Changing sections shrinks the cube away and grows
     it back in the new slot; it never travels across the page. */
  const slots = Array.from(document.querySelectorAll('[data-cube]'));
  const canvas = $('scene');
  const EXPLODE = { tools: 1 };
  let slot = null, pending = null, p = 1, dir = 1;

  function mount(el) {
    slot = el;
    el.appendChild(canvas);
    const r = el.getBoundingClientRect();
    engine.fit(r.width, r.height);
    engine.targetExplode = engine.explode = EXPLODE[el.dataset.cube] || 0;
    switchMode(el.dataset.cube);
  }
  function score(el, vh) {
    const r = el.getBoundingClientRect();
    if (!r.height || r.bottom <= 0 || r.top >= vh) return 0;
    const visible = (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height;
    const centred = 1 - Math.min(1, Math.abs(r.top + r.height / 2 - vh / 2) / vh);
    return visible * 0.75 + centred * 0.25;
  }
  function pickSlot() {
    const vh = window.innerHeight;
    let best = null, bestScore = 0, current = 0;
    for (const el of slots) {
      const s = score(el, vh);
      if (el === slot) current = s;
      if (s > bestScore) { bestScore = s; best = el; }
    }
    return best && best !== slot && bestScore > current + 0.12 ? best : null;
  }
  const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => {
      for (const en of entries) {
        if (en.target === slot) engine.fit(en.contentRect.width, en.contentRect.height);
      }
    });
    slots.forEach((el) => ro.observe(el));
  } else {
    window.addEventListener('resize', () => {
      if (slot) engine.fit(slot.clientWidth, slot.clientHeight);
    });
  }

  /* pointer input on the slots */
  let activePointer = null;
  slots.forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || activePointer !== null || el !== slot || pending) return;
      if (engine.pointerDown(e.clientX, e.clientY)) {
        activePointer = e.pointerId;
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        el.classList.add('grabbing');
        if (e.pointerType !== 'touch' || el.dataset.touch === 'none') e.preventDefault();
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === activePointer) engine.pointerMove(e.clientX, e.clientY);
    });
    const up = (e) => {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      el.classList.remove('grabbing');
      engine.pointerUp();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!pending && !engine.drag) {
      const next = pickSlot();
      if (next) {
        pending = next;
        dir = -1;
      }
    }
    if (dir < 0) {
      p -= dt / (reduced ? 0.01 : 0.22);
      if (p <= 0) {
        p = 0;
        mount(pending);
        pending = null;
        dir = 1;
      }
    } else if (p < 1) {
      p = Math.min(1, p + dt / (reduced ? 0.01 : 0.6));
    }
    engine.presence = easeOutBack(clamp(p, 0, 1));
    engine.update(dt, score(slot, window.innerHeight) > 0);
    hero.tick();
    timer.tick(now);
    requestAnimationFrame(frame);
  }
  mount(slots[0]);
  if (!reduced) engine.startIntro();
  requestAnimationFrame(frame);
  document.documentElement.classList.add('gl-ready');
})();
