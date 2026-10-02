/* Candence — the live timer demo (mirrors the app's Timer tab). */
(function () {
  'use strict';
  const NS = (window.Candence = window.Candence || {});
  const STORE = 'candence.web.solves.v1';
  const SETTINGS = 'candence.web.settings.v1';
  const $ = (id) => document.getElementById(id);

  /* ---------- shared maths (also used by the stats dashboard) ---------- */
  function fmt(ms) {
    if (ms === Infinity) return 'DNF';
    if (ms == null || isNaN(ms)) return '—';
    const cs = Math.floor(ms / 10);
    const m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
    return (m ? m + ':' + String(s).padStart(2, '0') : String(s)) + '.' + String(c).padStart(2, '0');
  }
  const val = (s) => (s.pen === 'DNF' ? Infinity : s.t + (s.pen || 0));
  function avgOf(vals) {
    const n = vals.length, trim = Math.max(1, Math.ceil(n * 0.05));
    const kept = vals.slice().sort((a, b) => a - b).slice(trim, n - trim);
    if (kept.some((v) => v === Infinity)) return Infinity;
    return kept.reduce((a, b) => a + b, 0) / kept.length;
  }
  function aoN(solves, n, end) {
    end = end == null ? solves.length : end;
    if (end < n) return null;
    return avgOf(solves.slice(end - n, end).map(val));
  }
  function bestAoN(solves, n) {
    let best = null;
    for (let e = n; e <= solves.length; e++) {
      const a = aoN(solves, n, e);
      if (a !== null && (best === null || a < best)) best = a;
    }
    return best;
  }
  function bestSingle(solves) {
    let b = null, idx = -1;
    solves.forEach((s, i) => {
      const v = val(s);
      if (v !== Infinity && (b === null || v < b)) { b = v; idx = i; }
    });
    return { v: b, i: idx };
  }
  const fmtAvg = (v) => (v === null ? '—' : fmt(v));
  NS.util = { fmt, fmtAvg, val, avgOf, aoN, bestAoN, bestSingle };

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, v) {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch (e) { /* storage unavailable — demo still works */ }
  }

  NS.Timer = {
    init() {
      const app = $('timerApp');
      if (!app) return this;
      const el = {
        time: $('tTime'), sub: $('tSub'), ao5: $('tAo5'), ao12: $('tAo12'), scr: $('tScramble'), hint: $('tHint'),
        pb: $('tPB'), pbText: $('tPBtext'), stage: $('tStage'), inspect: $('tInspect'), comp: $('tComp'),
        plus2: $('tPlus2'), dnf: $('tDNF'), del: $('tDel'), newScr: $('tNewScr'), table: $('tTable'), clear: $('tClear'),
      };
      const pads = Array.from(app.querySelectorAll('.pad'));
      const S = Object.assign({ holdMs: 300, display: 'cs', alerts: 'voice', inspection: false }, load(SETTINGS, {}));
      const self = this;
      let solves = load(STORE, []).filter((s) => s && typeof s.t === 'number');
      let phase = solves.length ? 'done' : 'idle';
      let comp = false, inspecting = false, pendingInspect = false, swallow = false;
      let holdStart = 0, runStart = 0, inspectStart = 0, runPenalty = 0, alerted = {};
      let subMsg = '';
      const held = new Set();
      const touch = window.matchMedia('(hover: none)').matches;
      let active = false, ac = null;

      this.listeners = [];
      this.onScramble = null;
      Object.defineProperty(this, 'solves', { get: () => solves, configurable: true });
      Object.defineProperty(this, 'settings', { get: () => S, configurable: true });

      function emit() {
        self.listeners.forEach((fn) => fn(solves));
      }
      function persist() {
        save(STORE, solves.slice(-500));
      }

      /* ---------- scramble ---------- */
      function newScramble() {
        self.scramble = NS.cube.randomScramble(20);
        el.scr.innerHTML = self.scramble.split(' ').map((m) => '<span>' + m + '</span>').join('');
        if (self.onScramble) self.onScramble(self.scramble);
      }

      /* ---------- alerts ---------- */
      function beep(freq) {
        try {
          ac = ac || new (window.AudioContext || window.webkitAudioContext)();
          const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          o.connect(g);
          g.connect(ac.destination);
          o.start(t);
          o.stop(t + 0.25);
        } catch (e) { /* audio blocked */ }
      }
      function sayAlert(sec) {
        if (S.alerts === 'off') return;
        if (S.alerts === 'voice' && 'speechSynthesis' in window) {
          try {
            const u = new SpeechSynthesisUtterance(sec === 8 ? 'Eight seconds' : 'Twelve');
            u.rate = 1.15;
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
            return;
          } catch (e) { /* fall through to beep */ }
        }
        beep(sec === 8 ? 660 : 880);
      }
      this.previewAlert = () => sayAlert(8);

      /* ---------- state machine ---------- */
      const rest = () => (solves.length && subMsg ? 'done' : 'idle');
      function press() {
        if (phase === 'running') {
          stop();
          swallow = true;
          return;
        }
        if (S.inspection && !comp && !inspecting) {
          pendingInspect = true;
          return;
        }
        phase = 'holding';
        holdStart = performance.now();
        render();
      }
      function release() {
        if (swallow) {
          swallow = false;
          return;
        }
        if (pendingInspect) {
          pendingInspect = false;
          inspecting = true;
          inspectStart = performance.now();
          alerted = {};
          phase = 'idle';
          render();
          return;
        }
        if (phase === 'ready') startRun();
        else if (phase === 'holding') {
          phase = rest();
          render();
        }
      }
      function startRun() {
        runPenalty = 0;
        if (inspecting) {
          const e = performance.now() - inspectStart;
          if (e > 17000) runPenalty = 'DNF';
          else if (e > 15000) runPenalty = 2000;
        }
        inspecting = false;
        try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
        runStart = performance.now();
        phase = 'running';
        el.pb.hidden = true;
        render();
      }
      function stop() {
        const t = Math.max(0, Math.round(performance.now() - runStart));
        const before = solves.slice();
        const solve = { t, pen: runPenalty, scr: self.scramble, at: Date.now() };
        solves.push(solve);
        phase = 'done';
        // "Solve 25 · 1.20 under your Ao12"
        const ref = aoN(before, 12) !== null ? ['Ao12', aoN(before, 12)] : aoN(before, 5) !== null ? ['Ao5', aoN(before, 5)] : null;
        const v = val(solve);
        subMsg = 'Solve ' + solves.length;
        if (ref && ref[1] !== Infinity && v !== Infinity) {
          const diff = (v - ref[1]) / 1000;
          subMsg += ' · ' + Math.abs(diff).toFixed(2) + (diff < 0 ? ' under' : ' over') + ' your ' + ref[0];
        }
        checkPB(before);
        persist();
        newScramble();
        render();
        emit();
      }
      function checkPB(before) {
        if (!before.length) return;
        const parts = [];
        const cur = val(solves[solves.length - 1]);
        const bs = bestSingle(before).v;
        if (bs !== null && cur < bs) parts.push(['Single', cur - bs]);
        [5, 12].forEach((n) => {
          const prev = bestAoN(before, n), now = aoN(solves, n);
          if (prev !== null && prev !== Infinity && now !== null && now < prev) parts.push(['Ao' + n, now - prev]);
        });
        if (!parts.length) return;
        el.pbText.innerHTML = parts
          .map((p) => '<span>' + p[0] + ' <b>−' + (Math.abs(p[1]) / 1000).toFixed(2) + '</b></span>')
          .join('<i>·</i>');
        el.pb.hidden = false;
        const r = el.time.getBoundingClientRect();
        if (NS.fx) NS.fx.confetti(r.left + r.width / 2, r.top + r.height / 2, 160);
      }

      /* ---------- competition pads ---------- */
      function markPads() {
        pads.forEach((p) => p.classList.toggle('down', held.has('p' + p.dataset.pad) || held.has('k' + p.dataset.key)));
      }
      function padDown(id) {
        if (phase === 'running') {
          stop();
          return;
        }
        held.add(id);
        markPads();
        if (held.size >= 2 && phase !== 'holding' && phase !== 'ready') {
          phase = 'holding';
          holdStart = performance.now();
          render();
        }
      }
      function padUp(id) {
        held.delete(id);
        markPads();
        if (phase === 'ready') startRun();
        else if (phase === 'holding') {
          phase = rest();
          render();
        }
      }

      /* ---------- rendering ---------- */
      function lastLabel() {
        const s = solves[solves.length - 1];
        if (!s) return '0.00';
        if (s.pen === 'DNF') return 'DNF';
        return fmt(s.t + (s.pen || 0)) + (s.pen ? '+' : '');
      }
      function hint(txt) {
        el.hint.innerHTML = txt;
      }
      function render() {
        const insp = inspecting && phase !== 'running';
        el.time.classList.toggle('is-holding', phase === 'holding');
        el.time.classList.toggle('is-ready', phase === 'ready');
        el.time.classList.toggle('is-inspect', insp && phase !== 'holding' && phase !== 'ready');
        el.time.classList.toggle('is-hidden', phase === 'running' && S.display === 'hidden');
        app.classList.toggle('running', phase === 'running');
        app.classList.toggle('ready', phase === 'ready');
        app.classList.toggle('comp', comp);
        if (!insp && phase !== 'running') {
          el.time.textContent = phase === 'done' ? lastLabel() : '0.00';
        }
        const last = solves[solves.length - 1];
        el.sub.textContent = phase === 'done' && subMsg ? subMsg : 'Solve ' + (solves.length + 1);
        el.ao5.textContent = fmtAvg(aoN(solves, 5));
        el.ao12.textContent = fmtAvg(aoN(solves, 12));
        el.plus2.setAttribute('aria-pressed', String(!!last && last.pen === 2000));
        el.dnf.setAttribute('aria-pressed', String(!!last && last.pen === 'DNF'));
        [el.plus2, el.dnf, el.del].forEach((b) => (b.disabled = !last));
        el.inspect.setAttribute('aria-pressed', String(S.inspection && !comp));
        el.inspect.textContent = comp ? 'No inspection' : 'Inspection 15 s';
        el.comp.setAttribute('aria-pressed', String(comp));

        if (phase === 'running') hint(touch ? 'Tap anywhere here to stop' : 'Tap, or press any key, to stop');
        else if (phase === 'ready') hint(comp ? 'Lift your hands to start' : 'Release to start');
        else if (phase === 'holding') hint('Keep holding…');
        else if (comp) hint(touch ? 'Place both thumbs on the pads' : 'Hold both pads, or <kbd>F</kbd> + <kbd>J</kbd>');
        else if (insp) hint(touch ? 'Inspecting — press and hold, then release to start' : 'Inspecting — hold <kbd>Space</kbd> or press and hold, then release to start');
        else if (S.inspection) hint(touch ? 'Tap to start inspection, then press and hold' : 'Tap or press <kbd>Space</kbd> to start inspection, then hold');
        else hint(touch ? 'Press and hold here, then release to start' : 'Hold <kbd>Space</kbd> — or press and hold here — then release to start');

        // Current / Best table
        const bs = bestSingle(solves);
        const rows = [
          ['Single', last ? val(last) : null, bs.v],
          ['Ao5', aoN(solves, 5), bestAoN(solves, 5)],
          ['Ao12', aoN(solves, 12), bestAoN(solves, 12)],
        ];
        el.table.innerHTML =
          '<tr><th></th><th>Current</th><th>Best</th></tr>' +
          rows.map((r) => {
            const isBest = r[1] !== null && r[1] !== Infinity && r[1] === r[2] && solves.length > 1;
            return '<tr><td>' + r[0] + '</td><td>' + fmtAvg(r[1]) + '</td><td class="' + (isBest ? 'best' : '') + '">' + fmtAvg(r[2]) + '</td></tr>';
          }).join('');
      }

      /* ---------- per-frame ---------- */
      this.tick = function (now) {
        if (phase === 'holding' && now - holdStart >= S.holdMs) {
          phase = 'ready';
          render();
        }
        if (phase === 'running') {
          const e = now - runStart;
          if (S.display === 'cs') el.time.textContent = fmt(e);
          else if (S.display === 's') el.time.textContent = String(Math.floor(e / 1000));
          else el.time.textContent = 'Solving';
        } else if (inspecting) {
          const e = now - inspectStart;
          if (e >= 8000 && !alerted[8]) { alerted[8] = 1; sayAlert(8); }
          if (e >= 12000 && !alerted[12]) { alerted[12] = 1; sayAlert(12); }
          el.time.textContent = e < 15000 ? String(15 - Math.floor(e / 1000)) : e < 17000 ? '+2' : 'DNF';
        }
      };

      /* ---------- inputs ---------- */
      const typing = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
      const engaged = () => active || phase === 'running' || phase === 'holding' || phase === 'ready' || inspecting;
      window.addEventListener('keydown', (e) => {
        if (!engaged() || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
        if (comp && (e.code === 'KeyF' || e.code === 'KeyJ')) {
          e.preventDefault();
          if (!e.repeat) padDown('k' + e.code);
          return;
        }
        if (phase === 'running') {
          e.preventDefault();
          press();
          return;
        }
        if (e.code === 'Space' && !comp) {
          e.preventDefault();
          if (!e.repeat) press();
        }
      });
      window.addEventListener('keyup', (e) => {
        if (comp && (e.code === 'KeyF' || e.code === 'KeyJ')) {
          e.preventDefault();
          padUp('k' + e.code);
          return;
        }
        if (swallow) {
          swallow = false;
          if (e.code === 'Space') e.preventDefault();
          return;
        }
        if (e.code === 'Space' && engaged() && !typing(e.target) && !comp) {
          e.preventDefault();
          release();
        }
      });
      el.stage.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        if (e.target.closest('button, .pad')) return;
        if (comp && phase !== 'running') return;
        e.preventDefault();
        try { el.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        press();
      });
      const stageUp = (e) => {
        if (e.target.closest && e.target.closest('button') && !swallow) return;
        if (comp) {
          swallow = false;
          return;
        }
        release();
      };
      el.stage.addEventListener('pointerup', stageUp);
      el.stage.addEventListener('pointercancel', stageUp);
      pads.forEach((p) => {
        p.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          try { p.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          padDown('p' + p.dataset.pad);
        });
        const up = () => padUp('p' + p.dataset.pad);
        p.addEventListener('pointerup', up);
        p.addEventListener('pointercancel', up);
      });

      el.inspect.addEventListener('click', () => {
        if (comp) return;
        S.inspection = !S.inspection;
        inspecting = false;
        save(SETTINGS, S);
        render();
      });
      el.comp.addEventListener('click', () => {
        comp = !comp;
        inspecting = false;
        held.clear();
        markPads();
        if (phase !== 'done') phase = rest();
        render();
      });
      el.newScr.addEventListener('click', newScramble);
      el.plus2.addEventListener('click', () => {
        const s = solves[solves.length - 1];
        if (!s) return;
        s.pen = s.pen === 2000 ? 0 : 2000;
        persist(); render(); emit();
      });
      el.dnf.addEventListener('click', () => {
        const s = solves[solves.length - 1];
        if (!s) return;
        s.pen = s.pen === 'DNF' ? 0 : 'DNF';
        persist(); render(); emit();
      });
      el.del.addEventListener('click', () => {
        solves.pop();
        subMsg = '';
        el.pb.hidden = true;
        phase = 'idle';
        persist(); render(); emit();
      });
      if (el.clear) {
        el.clear.addEventListener('click', () => {
          solves = [];
          subMsg = '';
          el.pb.hidden = true;
          phase = 'idle';
          persist(); render(); emit();
        });
      }

      this.setActive = (v) => { active = v; };
      this.set = (key, v) => {
        S[key] = v;
        save(SETTINGS, S);
        render();
      };
      this.render = render;
      this.fmt = fmt;

      newScramble();
      render();
      return this;
    },
  };
})();
