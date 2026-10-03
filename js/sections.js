/* Cadence — page sections: effects, stats dashboard, coach, alg player,
   solver demo, screen carousel and the little settings demos. */
(function () {
  'use strict';
  const NS = (window.Cadence = window.Cadence || {});
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* =========================================================
     Effects: confetti, reveal-on-scroll, tilt, ticker
     ========================================================= */
  NS.fx = (function () {
    const cv = $('confetti');
    const ctx = cv ? cv.getContext('2d') : null;
    let parts = [], running = false, dpr = 1;
    function size() {
      if (!cv) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
    }
    size();
    window.addEventListener('resize', size);
    const COLS = ['#5fd39d', '#5fd39d', '#efeee9', '#3fb67f', '#c6f3dc'];
    function confetti(x, y, n) {
      if (!ctx) return;
      n = reduced ? 30 : n || 140;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 11;
        parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 7, w: 5 + Math.random() * 7, h: 4 + Math.random() * 5,
          r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COLS[i % COLS.length], life: 0, max: 80 + Math.random() * 80,
        });
      }
      if (!running) {
        running = true;
        requestAnimationFrame(step);
      }
    }
    function step() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts = parts.filter((p) => p.life < p.max && p.y < window.innerHeight + 40);
      for (const p of parts) {
        p.life++;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.3;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.globalAlpha = 1 - Math.max(0, (p.life - p.max * 0.7) / (p.max * 0.3));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(step);
      else running = false;
    }

    function initReveal() {
      const els = document.querySelectorAll('[data-reveal]');
      if (!('IntersectionObserver' in window)) {
        els.forEach((e) => e.classList.add('in'));
        return;
      }
      // Everything is visible at rest. Blocks animate only when they are about to
      // scroll in from below; anything already on screen at load stays put.
      let armed = false;
      setTimeout(() => (armed = true), 200);
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          if (armed && en.boundingClientRect.top > window.innerHeight * 0.85) en.target.classList.add('in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px 10% 0px', threshold: 0 });
      els.forEach((e) => io.observe(e));
    }

    function initTilt() {
      if (reduced || window.matchMedia('(hover: none)').matches) return;
      document.querySelectorAll('[data-tilt]').forEach((el) => {
        const max = parseFloat(el.dataset.tilt) || 6;
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          el.style.setProperty('--rx', (-y * max).toFixed(2) + 'deg');
          el.style.setProperty('--ry', (x * max).toFixed(2) + 'deg');
          el.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
          el.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
        });
        el.addEventListener('pointerleave', () => {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        });
      });
    }

    function initTicker() {
      const t = $('ticker');
      if (!t) return;
      let html = '';
      for (let i = 0; i < 8; i++) {
        html += '<span><b>' + String(i + 1).padStart(2, '0') + '</b>' + NS.cube.randomScramble(20) + '</span>';
      }
      t.innerHTML = html + html;
    }

    return { confetti, initReveal, initTilt, initTicker };
  })();

  /* =========================================================
     Stats dashboard
     ========================================================= */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sampleSession() {
    const rnd = mulberry32(11);
    const gauss = () => {
      let u = 0;
      while (!u) u = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
    };
    const days = [14, 19, 22, 17, 16, 12], out = [];
    let i = 0;
    days.forEach((n, d) => {
      for (let k = 0; k < n; k++, i++) {
        let t = 57 - 16 * Math.pow(i / 100, 0.8) + gauss() * 3.8;
        if (rnd() < 0.06) t += 5 + rnd() * 8;
        out.push({ t: Math.round(t * 100) * 10, pen: 0, day: d });
      }
    });
    out[37].pen = 2000;
    return out;
  }

  NS.initStats = function () {
    const dash = $('dash');
    if (!dash) return;
    const U = NS.util;
    const sample = sampleSession();
    let src = 'sample', shown = false;
    const srcBtns = dash.querySelectorAll('[data-src]');

    function data() {
      if (src === 'mine') {
        let lastKey = null, d = -1;
        return NS.Timer.solves.map((s) => {
          const key = new Date(s.at || 0).toDateString();
          if (key !== lastKey) { d++; lastKey = key; }
          return { t: s.t, pen: s.pen, day: d };
        });
      }
      return sample;
    }

    function niceStep(range) {
      return range > 40 ? 10 : range > 18 ? 5 : range > 8 ? 2 : 1;
    }

    function scatter(solves, W, H) {
      const vals = solves.map(U.val), fin = vals.filter(isFinite);
      if (!fin.length) return '';
      let lo = Math.floor(Math.min.apply(null, fin) / 1000) - 1, hi = Math.ceil(Math.max.apply(null, fin) / 1000) + 1;
      const padL = 4, padR = 42, padT = 10, padB = 10, pw = W - padL - padR, ph = H - padT - padB;
      const n = solves.length;
      const x = (i) => padL + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
      const y = (v) => padT + (1 - (v / 1000 - lo) / (hi - lo)) * ph;
      const st = niceStep(hi - lo);
      let g = '';
      for (let s = Math.ceil(lo / st) * st; s <= hi; s += st) {
        const yy = y(s * 1000).toFixed(1);
        g += '<line class="grid" x1="' + padL + '" x2="' + (W - padR + 6) + '" y1="' + yy + '" y2="' + yy + '"/>';
        g += '<text class="axis" x="' + (W - padR + 12) + '" y="' + yy + '" dy="4">' + s + 's</text>';
      }
      const best = U.bestSingle(solves);
      let dots = '';
      vals.forEach((v, i) => {
        if (!isFinite(v) || i === best.i) return;
        dots += '<circle class="dot" style="--d:' + (i * 7) + 'ms" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.7"/>';
      });
      let line = '';
      for (let i = 11; i < n; i++) {
        const a = U.aoN(solves, 12, i + 1);
        if (a === null || !isFinite(a)) continue;
        line += (line ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(a).toFixed(1);
      }
      let bestMark = '';
      if (best.i >= 0) {
        const bx = x(best.i), by = y(best.v);
        bestMark = '<circle class="best-ring" cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="8"/>' +
          '<circle class="best" cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="4"/>';
      }
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + g + dots +
        (line ? '<path class="ao" pathLength="1" d="' + line + '"/>' : '') + bestMark +
        '<line class="guide" x1="0" x2="0" y1="' + padT + '" y2="' + (H - padB) + '"/>' +
        '<rect class="hit" x="0" y="0" width="' + (W - padR) + '" height="' + H + '"/></svg>' +
        '<div class="tip" hidden></div>';
    }

    function bindScatter(box, solves) {
      const svg = box.querySelector('svg');
      if (!svg) return;
      const tip = box.querySelector('.tip'), guide = svg.querySelector('.guide'), hit = svg.querySelector('.hit');
      const W = +svg.getAttribute('width'), n = solves.length, pw = W - 46;
      hit.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left;
        const i = clamp(Math.round(((px - 4) / pw) * (n - 1)), 0, n - 1);
        const xx = 4 + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
        guide.setAttribute('x1', xx);
        guide.setAttribute('x2', xx);
        guide.style.opacity = 1;
        const s = solves[i], ao = U.aoN(solves, 12, i + 1);
        tip.innerHTML = '<span>Solve ' + (i + 1) + '</span><b>' + (s.pen === 'DNF' ? 'DNF' : U.fmt(U.val(s)) + (s.pen ? '+' : '')) + '</b>' +
          (ao !== null ? '<span>Ao12 ' + U.fmtAvg(ao) + '</span>' : '');
        tip.hidden = false;
        tip.style.left = clamp(xx, 70, W - 110) + 'px';
      });
      hit.addEventListener('pointerleave', () => {
        tip.hidden = true;
        guide.style.opacity = 0;
      });
    }

    function hist(solves, W, H) {
      const fin = solves.map(U.val).filter(isFinite).map((v) => Math.floor(v / 1000));
      if (!fin.length) return { svg: '', foot: '' };
      const lo = Math.min.apply(null, fin), hi = Math.max.apply(null, fin), nb = hi - lo + 1;
      const counts = new Array(nb).fill(0);
      fin.forEach((s) => counts[s - lo]++);
      const mx = Math.max.apply(null, counts), mode = counts.indexOf(mx);
      const gap = nb > 30 ? 2 : 4, bw = (W - gap * (nb - 1)) / nb;
      let r = '';
      counts.forEach((c, i) => {
        if (!c) return;
        const h = Math.max(4, (c / mx) * (H - 6));
        r += '<rect class="bar' + (i === mode ? ' hi' : '') + '" style="--d:' + i * 18 + 'ms" x="' + (i * (bw + gap)).toFixed(1) +
          '" y="' + (H - h).toFixed(1) + '" width="' + Math.max(1, bw).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"/>';
      });
      return {
        svg: '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + r + '</svg>',
        foot: '<span>' + lo + ' s</span><span>most common ' + (lo + mode) + '–' + (lo + mode + 1) + ' s</span><span>' + hi + ' s</span>',
      };
    }

    function days(solves, W, H) {
      const groups = [];
      solves.forEach((s) => {
        const v = U.val(s);
        if (!isFinite(v)) return;
        (groups[s.day] = groups[s.day] || []).push(v);
      });
      const means = groups.filter(Boolean).map((g) => g.reduce((a, b) => a + b, 0) / g.length).slice(-7);
      if (!means.length) return { svg: '', foot: '' };
      const mx = Math.max.apply(null, means), mn = Math.min.apply(null, means) * 0.82;
      const n = means.length, slot = W / n, bw = Math.min(56, slot * 0.5);
      let r = '';
      means.forEach((m, i) => {
        const h = Math.max(8, ((m - mn) / (mx - mn || 1)) * (H - 26) + 10);
        const x = i * slot + (slot - bw) / 2;
        r += '<rect class="bar' + (i === n - 1 ? ' hi' : '') + '" style="--d:' + i * 70 + 'ms" x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1) +
          '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"/>' +
          '<text class="val" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - h - 8).toFixed(1) + '">' + (m / 1000).toFixed(1) + '</text>';
      });
      const bestDay = Math.min.apply(null, means);
      return {
        svg: '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + r + '</svg>',
        foot: '<span>' + n + (n === 1 ? ' day' : ' days') + '</span><span>Latest ' + U.fmt(means[n - 1]) + ' · best day ' + U.fmt(bestDay) + '</span>',
      };
    }

    function countUp(node) {
      const to = parseFloat(node.dataset.to);
      if (!isFinite(to) || reduced) {
        node.textContent = node.dataset.label;
        return;
      }
      const t0 = performance.now(), dur = 1100;
      (function f(now) {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        node.textContent = k < 1 ? U.fmt(to * e) : node.dataset.label;
        if (k < 1) requestAnimationFrame(f);
      })(t0);
    }

    function render() {
      const solves = data();
      const n = solves.length;
      $('dashMeta').textContent = src === 'sample' ? 'Sample session · ' + n + ' solves' : 'Your solves · ' + n + (n === 1 ? ' solve' : ' solves');
      const best = U.bestSingle(solves);
      const fins = solves.map(U.val).filter(isFinite);
      const mean = fins.length ? fins.reduce((a, b) => a + b, 0) / fins.length : null;
      const tiles = [
        ['Current Ao5', U.aoN(solves, 5), 'Best ' + U.fmtAvg(U.bestAoN(solves, 5))],
        ['Current Ao12', U.aoN(solves, 12), 'Best ' + U.fmtAvg(U.bestAoN(solves, 12))],
        ['Best single', best.v, best.i >= 0 ? 'Solve ' + (best.i + 1) : '—'],
        ['Mean', mean, fins.length + ' counted'],
      ];
      $('dashTiles').innerHTML = tiles.map((t) =>
        '<div class="tile"><p>' + t[0] + '</p><b data-to="' + (t[1] === null || !isFinite(t[1]) ? '' : t[1]) + '" data-label="' + U.fmtAvg(t[1]) + '">' +
        U.fmtAvg(t[1]) + '</b><span>' + t[2] + '</span></div>').join('');

      const sc = $('chScatter');
      const W = Math.max(280, sc.clientWidth);
      sc.innerHTML = scatter(solves, W, W < 520 ? 200 : 250);
      bindScatter(sc, solves);

      const dist = $('chDist'), h = hist(solves, Math.max(220, dist.clientWidth), 150);
      dist.innerHTML = h.svg;
      $('distFoot').innerHTML = h.foot;
      const dy = $('chDays'), dd = days(solves, Math.max(220, dy.clientWidth), 150);
      dy.innerHTML = dd.svg;
      $('daysFoot').innerHTML = dd.foot;

      const last25 = solves.slice(-25).map(U.val).filter(isFinite);
      const m25 = last25.length ? last25.reduce((a, b) => a + b, 0) / last25.length : 0;
      const sd = last25.length > 1 ? Math.sqrt(last25.reduce((a, v) => a + (v - m25) * (v - m25), 0) / (last25.length - 1)) : null;
      const target = Math.floor(m25 / 1000);
      const rate = (lim) => last25.length ? Math.round((last25.filter((v) => v < lim * 1000).length / last25.length) * 100) + '%' : '—';
      const p2 = solves.filter((s) => s.pen === 2000).length, dnf = solves.filter((s) => s.pen === 'DNF').length;
      const total = fins.reduce((a, b) => a + b, 0) / 60000;
      const nDays = new Set(solves.map((s) => s.day)).size;
      const kv = [
        ['Standard deviation, last 25', sd === null ? '—' : (sd / 1000).toFixed(2) + ' s'],
        ['Sub-' + target + ' rate, last 25', rate(target)],
        ['Sub-' + (target + 2) + ' rate, last 25', rate(target + 2)],
        ['Penalties', p2 + ' × +2 · ' + dnf + ' × DNF'],
        ['Total solving time', Math.floor(total / 60) + ' h ' + Math.round(total % 60) + ' min'],
        ['Practice days', String(nDays)],
      ];
      $('kv').innerHTML = kv.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>').join('');

      if (shown) {
        dash.classList.remove('anim');
        void dash.offsetWidth;
        dash.classList.add('anim');
      }
    }

    function syncSrcButtons() {
      const enough = NS.Timer.solves && NS.Timer.solves.length >= 5;
      srcBtns.forEach((b) => {
        if (b.dataset.src === 'mine') {
          b.disabled = !enough;
          b.title = enough ? '' : 'Do 5 solves in the timer above to see your own stats';
        }
        b.setAttribute('aria-pressed', String(b.dataset.src === src));
      });
      if (!enough && src === 'mine') {
        src = 'sample';
        render();
      }
    }
    srcBtns.forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      src = b.dataset.src;
      syncSrcButtons();
      render();
    }));
    if (NS.Timer.listeners) {
      NS.Timer.listeners.push(() => {
        syncSrcButtons();
        if (src === 'mine') render();
      });
    }

    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !shown) {
        shown = true;
        // only replay the build if the dashboard is still below the fold
        if (entries[0].boundingClientRect.top > window.innerHeight * 0.6) {
          dash.classList.add('anim');
          dash.querySelectorAll('.tile b').forEach(countUp);
        }
        io.disconnect();
      }
    }, { rootMargin: '0px 0px 12% 0px', threshold: 0 });
    io.observe(dash);

    let lastW = 0, rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (Math.abs(window.innerWidth - lastW) > 30) {
          lastW = window.innerWidth;
          render();
        }
      }, 180);
    });
    lastW = window.innerWidth;
    syncSrcButtons();
    render();
  };

  /* =========================================================
     Coach ("your next step") + methods
     ========================================================= */
  const STEPS = [
    { max: 14, range: 'sub-14 s', title: 'Sharpen lookahead', body: 'You know the algorithms. Now it is about never stopping: slow, smooth solves where your eyes are always one pair ahead, plus X-crosses and smarter slotting.', chips: ['X-cross', 'Multislotting', 'COLL', 'Slow turning'] },
    { max: 20, range: '14–20 s', title: 'Learn full OLL', body: 'Replace 2-look OLL with all 57 cases so the last layer becomes one look plus PLL. Start with the shapes that come up most often.', chips: ['Dot cases', 'Fish', 'Lightning', 'Awkward'] },
    { max: 30, range: '20–30 s', title: 'Learn full PLL', body: 'All 21 permutations, so you never need two looks to finish. Begin with T, Y and the U-perms — they come up the most.', chips: ['T-perm', 'Y-perm', 'Ua · Ub', 'J-perms'] },
    { max: 40, range: '30–40 s', title: 'Two-look last layer', body: 'Finish the last layer in four quick steps with just 16 algorithms. It is the bridge from beginner method to full CFOP.', chips: ['Edges · 3', 'Corners · 7', 'Corners · 2', 'Edges · 4'] },
    { max: 60, range: '40–60 s', title: 'Learn intuitive F2L', body: 'Pair each corner with its edge and insert them together, instead of corners first and edges after. Understand the 4 basic inserts, then every case builds on them.', chips: ['Pieces on top · 1', 'Pieces on top · 2', 'Pieces on top · 3', 'Pieces on top · 4'] },
    { max: 90, range: '60–90 s', title: 'Plan the cross', body: 'Solve the cross on the bottom and plan it during inspection. Eight moves or fewer unlocks everything that comes after.', chips: ['Cross on bottom', 'Inspection plan', 'Edge pairs', '≤ 8 moves'] },
    { max: Infinity, range: '90 s +', title: 'Finish your first solves', body: 'The beginner layer-by-layer method: cross, corners, middle layer, then the last layer with a handful of short algorithms.', chips: ['Daisy', 'White corners', 'Second layer', 'Yellow cross'] },
  ];
  NS.initCoach = function () {
    const range = $('coachRange'), out = $('coachOut'), card = $('coachCard');
    if (!range) return;
    let lastStep = null;
    function paint() {
      const v = parseFloat(range.value);
      const pct = ((v - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--p', pct + '%');
      out.textContent = v.toFixed(2) + ' s';
      const step = STEPS.find((s) => v < s.max);
      $('coachAo').textContent = 'Your Ao12 ' + v.toFixed(2);
      if (step === lastStep) return;
      lastStep = step;
      card.classList.remove('swap');
      void card.offsetWidth;
      card.classList.add('swap');
      $('coachRangeLbl').textContent = 'Your next step · ' + step.range;
      $('coachTitle').textContent = step.title;
      $('coachBody').textContent = step.body;
      $('coachChips').innerHTML = step.chips.map((c, i) => '<li style="--i:' + i + '"><span class="mini-cube"></span>' + c + '</li>').join('');
    }
    range.addEventListener('input', paint);
    paint();
  };

  const METHODS = {
    Beginner: ['Layer by layer', 'About 100–120 moves · a handful of short algorithms to get your very first solve.'],
    CFOP: ['Cross · F2L · OLL · PLL (Fridrich)', 'About 55–60 moves · 78 last-layer algorithms (16 for the 2-look version).'],
    Roux: ['Blocks · CMLL · LSE', 'About 45–50 moves · 42 CMLL algorithms and lots of fast M-slice turns.'],
    ZZ: ['EOLine · F2L · Last layer', 'About 50–55 moves · edges oriented first, so F2L needs no cube rotations.'],
    Petrus: ['2×2×2 · 2×2×3 · EO · F2L · LL', 'About 45–50 moves · intuitive block-building with few algorithms.'],
  };
  NS.initMethods = function () {
    const seg = $('methodSeg');
    if (!seg) return;
    seg.innerHTML = Object.keys(METHODS).map((k) => '<button type="button" aria-pressed="' + (k === 'CFOP') + '">' + k + '</button>').join('');
    function show(k) {
      $('methodTitle').textContent = METHODS[k][0];
      $('methodBody').textContent = METHODS[k][1];
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === k)));
    }
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) show(b.textContent);
    });
    show('CFOP');
  };

  /* =========================================================
     Algorithm player (drives the 3D cube in "learn" mode)
     ========================================================= */
  const CASES = [
    { set: 'OLL · Cross', name: 'OLL 25 · Bowtie', alg: "F' r U R' U' r' F R", oll: true, freq: '1 in 54',
      rec: 'All four edges already show yellow; only two corners are left to twist.' },
    { set: 'OLL · Cross', name: 'OLL 27 · Sune', alg: "R U R' U R U2 R'", oll: true, freq: '1 in 54',
      rec: 'Yellow cross is done and exactly one corner faces up. The most famous alg in cubing.' },
    { set: 'PLL · Adjacent swap', name: 'PLL · T-perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'", oll: false, freq: '1 in 18',
      rec: 'Swaps two adjacent corners and two opposite edges. Look for headlights beside a solid bar.' },
    { set: 'PLL · Edges only', name: 'PLL · Ua-perm', alg: "R U' R U R U R U' R' U' R2", oll: false, freq: '1 in 18',
      rec: 'Corners are already solved; three edges cycle around. One side shows a complete bar.' },
    { set: 'PLL · Adjacent swap', name: 'PLL · Jb-perm', alg: "R U R' F' R U R' U' R' F R2 U' R'", oll: false, freq: '1 in 18',
      rec: 'Swaps two adjacent corners and two edges. Spot the 1×3 bar on the left side.' },
  ];
  NS.createLearn = function (engine, isActive) {
    const C = NS.cube;
    const el = { chips: $('caseChips'), set: $('caseSet'), name: $('caseName'), alg: $('algRow'), bar: $('algBar'),
      count: $('moveCount'), play: $('pPlay'), prev: $('pPrev'), next: $('pNext'), restart: $('pRestart'),
      speed: $('speedSeg'), rec: $('recogText'), icon: $('recogIcon'), freq: $('caseFreq') };
    let cur = 0, idx = 0, playing = false, speed = 1, token = 0, busy = false;
    const moves = () => C.parseAlg(CASES[cur].alg);
    const setup = () => [C.parseMove('z2')].concat(C.invertAlg(moves()));
    function applyState() {
      engine.setState(setup().concat(moves().slice(0, idx)));
    }
    function recogSVG() {
      const saved = idx;
      idx = 0;
      applyState();
      const v = engine.topView();
      idx = saved;
      applyState();
      const oll = CASES[cur].oll, S = 24, G = 3, O = 13, full = 3 * S + 2 * G, size = full + O * 2;
      const col = (f) => (oll ? (f === 'D' ? C.HEX.D : '#3a3a3a') : C.HEX[f]);
      let s = '<svg viewBox="0 0 ' + size + ' ' + size + '">';
      s += '<rect x="' + (O - 3) + '" y="' + (O - 3) + '" width="' + (full + 6) + '" height="' + (full + 6) + '" rx="7" fill="#0b0b0b"/>';
      v.top.forEach((c) => {
        s += '<rect x="' + (O + c.col * (S + G)) + '" y="' + (O + c.row * (S + G)) + '" width="' + S + '" height="' + S + '" rx="4" fill="' + col(c.face) + '"/>';
      });
      const strip = (list, horiz, fixed) => list.forEach((c) => {
        if (oll && c.face !== 'D') return;
        const a = O + c.i * (S + G) + 3;
        s += horiz
          ? '<rect x="' + a + '" y="' + fixed + '" width="' + (S - 6) + '" height="6" rx="2" fill="' + col(c.face) + '"/>'
          : '<rect x="' + fixed + '" y="' + a + '" width="6" height="' + (S - 6) + '" rx="2" fill="' + col(c.face) + '"/>';
      });
      strip(v.B, true, 1);
      strip(v.F, true, O + full + 6);
      strip(v.L, false, 1);
      strip(v.R, false, O + full + 6);
      return s + '</svg>';
    }
    function render() {
      const ms = CASES[cur].alg.split(' ');
      el.alg.innerHTML = ms.map((m, i) => '<span class="' + (i < idx ? 'done' : '') + (i === idx && playing ? ' cur' : '') + '">' + m + '</span>').join('');
      el.bar.style.width = (idx / ms.length) * 100 + '%';
      el.count.textContent = 'Move ' + idx + ' of ' + ms.length;
      el.play.classList.toggle('is-playing', playing);
      el.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    function selectCase(i) {
      pause();
      cur = i;
      idx = 0;
      const c = CASES[cur];
      el.set.textContent = c.set;
      el.name.textContent = c.name;
      el.rec.textContent = c.rec;
      el.freq.textContent = 'Comes up ' + c.freq + ' solves';
      el.chips.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
      if (isActive()) {
        el.icon.innerHTML = recogSVG();
        applyState();
      } else el.icon.dataset.stale = '1';
      render();
    }
    function pause() {
      playing = false;
      token++;
      render();
    }
    /* idx only advances when the engine really finished the move, so the
       cube and the highlighted notation can never drift apart. */
    async function stepFwd() {
      const ms = moves(), target = idx;
      if (target >= ms.length) return false;
      busy = true;
      render();
      const ok = await engine.play(ms[target], 0.36 / speed, 'auto');
      busy = false;
      if (ok && idx === target) idx++;
      render();
      return ok;
    }
    async function play() {
      if (!isActive() || busy) return;
      const n = moves().length;
      if (idx >= n) {
        idx = 0;
        applyState();
      }
      const my = ++token;
      playing = true;
      render();
      if (idx === 0) await wait(250);
      while (playing && my === token && idx < n) {
        if (!(await stepFwd())) break;
        await wait(110 / speed);
      }
      if (my === token) {
        playing = false;
        render();
      }
    }
    el.chips.innerHTML = CASES.map((c, i) => '<button type="button" aria-pressed="' + (i === 0) + '">' + c.name.replace(' · ', ' <span>') + '</span></button>').join('');
    el.chips.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      selectCase(Array.prototype.indexOf.call(el.chips.children, b));
    });
    el.play.addEventListener('click', () => (playing ? pause() : play()));
    el.next.addEventListener('click', () => {
      if (!isActive()) return;
      pause();
      if (!busy) stepFwd();
    });
    el.prev.addEventListener('click', async () => {
      if (!isActive()) return;
      pause();
      if (busy || idx === 0) return;
      const target = idx;
      busy = true;
      const ok = await engine.play(C.invertMove(moves()[target - 1]), 0.36 / speed, 'auto');
      busy = false;
      if (ok && idx === target) idx--;
      render();
    });
    el.restart.addEventListener('click', () => {
      if (!isActive()) return;
      pause();
      idx = 0;
      applyState();
      busy = false;
      render();
    });
    el.speed.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      speed = parseFloat(b.dataset.speed);
      el.speed.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    selectCase(0);
    return {
      enter() {
        if (el.icon.dataset.stale || !el.icon.innerHTML) {
          delete el.icon.dataset.stale;
          el.icon.innerHTML = recogSVG();
        }
        applyState();
        render();
      },
      leave() {
        pause();
      },
    };
  };

  /* =========================================================
     Solver demo: scan → solution → play it back
     ========================================================= */
  NS.createSolver = function (engine) {
    const C = NS.cube;
    const ORDER = ['F', 'R', 'B', 'L', 'U', 'D'];
    const NAMES = { F: 'front', R: 'right', B: 'back', L: 'left', U: 'top', D: 'bottom' };
    const SW = ['U', 'D', 'F', 'B', 'R', 'L'];
    const status = $('scanStatus'), sol = $('solution'), sw = $('swatches'), frame = $('scanFrame'), panel = $('scanPanel');
    let token = 0;
    const counts = {};
    sw.innerHTML = SW.map((k) => '<div class="sw" data-k="' + k + '"><i style="--c:' + C.HEX[k] + '"></i><span>0/9</span></div>').join('');
    function paintCounts() {
      SW.forEach((k) => {
        const n = sw.querySelector('[data-k="' + k + '"]');
        n.querySelector('span').textContent = counts[k] + '/9';
        n.classList.toggle('full', counts[k] === 9);
      });
    }
    function setStatus(t, state) {
      status.textContent = t;
      panel.dataset.state = state || '';
    }
    async function run(my) {
      while (my === token) {
        const scr = C.parseAlg(C.randomScramble(20));
        engine.setState(scr);
        engine.setUnknown(true);
        SW.forEach((k) => (counts[k] = 0));
        paintCounts();
        sol.innerHTML = '<span class="ph">Waiting for all 54 stickers…</span>';
        frame.classList.add('scanning');
        for (const f of ORDER) {
          if (my !== token) return;
          setStatus('Scanning ' + NAMES[f] + ' face…', 'scan');
          engine.lookAt(f);
          await wait(reduced ? 150 : 560);
          for (const s of engine.stickersFacing(f)) {
            if (my !== token) return;
            engine.reveal(s);
            counts[s.userData.face]++;
            paintCounts();
            await wait(reduced ? 10 : 50);
          }
          await wait(160);
        }
        if (my !== token) return;
        frame.classList.remove('scanning');
        engine.lookAt(null);
        const solution = C.simplify(C.invertAlg(scr));
        setStatus('Solution found · ' + solution.length + ' moves', 'found');
        sol.innerHTML = solution.map((m) => '<span>' + C.moveName(m) + '</span>').join('');
        await wait(1000);
        const spans = sol.children;
        for (let i = 0; i < solution.length; i++) {
          if (my !== token) return;
          for (let k = 0; k < spans.length; k++) spans[k].className = k < i ? 'done' : k === i ? 'cur' : '';
          setStatus('Move ' + (i + 1) + ' of ' + solution.length, 'play');
          await engine.play(solution[i], 0.24, 'auto');
          await wait(60);
        }
        if (my !== token) return;
        for (let k = 0; k < spans.length; k++) spans[k].className = 'done';
        setStatus('Solved. Six clean faces.', 'done');
        await wait(3400);
      }
    }
    $('scanAgain').addEventListener('click', () => {
      if (!panel.dataset.active) return;
      const my = ++token;
      run(my);
    });
    return {
      enter() {
        panel.dataset.active = '1';
        const my = ++token;
        run(my);
      },
      leave() {
        delete panel.dataset.active;
        token++;
        engine.setUnknown(false);
        engine.lookAt(null);
        frame.classList.remove('scanning');
      },
    };
  };

  /* =========================================================
     3D carousel of real app screens
     ========================================================= */
  NS.initRing = function () {
    const stage = $('ringStage'), ring = $('ring'), cap = $('ringCaption');
    if (!stage) return;
    const items = Array.from(ring.children), N = items.length, step = 360 / N;
    let radius = 0, rot = 0, vel = 0, dragging = false, lastX = 0, visible = false, front = -1, raf = 0;
    function layout() {
      const w = ring.offsetWidth;
      radius = Math.round(w / 2 / Math.tan(Math.PI / N)) + (window.innerWidth < 700 ? 20 : 60);
      items.forEach((el, i) => (el.style.transform = 'rotateY(' + i * step + 'deg) translateZ(' + radius + 'px)'));
    }
    function frameFn() {
      if (!dragging) {
        vel *= 0.94;
        rot += vel;
        if (Math.abs(vel) < 0.05 && !reduced) rot -= 0.07;
      }
      ring.style.transform = 'translateZ(' + -radius + 'px) rotateY(' + rot + 'deg)';
      let f = 0, bestA = 999;
      items.forEach((el, i) => {
        let a = (((i * step + rot) % 360) + 360) % 360;
        if (a > 180) a -= 360;
        const c = Math.cos((a * Math.PI) / 180);
        el.style.opacity = (0.12 + 0.88 * Math.pow(Math.max(0, c), 1.6)).toFixed(3);
        if (Math.abs(a) < bestA) { bestA = Math.abs(a); f = i; }
      });
      if (f !== front) {
        front = f;
        cap.innerHTML = '<b>' + items[f].dataset.title + '</b> ' + items[f].dataset.caption;
      }
      raf = visible ? requestAnimationFrame(frameFn) : 0;
    }
    stage.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      vel = 0;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      rot += dx * 0.22;
      vel = dx * 0.22;
    });
    const end = () => (dragging = false);
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    const io = new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frameFn);
    });
    io.observe(stage);
    window.addEventListener('resize', layout);
    layout();
    frameFn();
  };

  /* =========================================================
     Details: settings that drive the live timer + history search
     ========================================================= */
  NS.initDetails = function () {
    document.querySelectorAll('[data-setting]').forEach((seg) => {
      const key = seg.dataset.setting;
      const cur = NS.Timer.settings ? NS.Timer.settings[key] : null;
      seg.querySelectorAll('button').forEach((b) => {
        if (cur != null) b.setAttribute('aria-pressed', String(String(cur) === b.dataset.v));
        b.addEventListener('click', () => {
          const v = key === 'holdMs' ? parseInt(b.dataset.v, 10) : b.dataset.v;
          NS.Timer.set(key, v);
          seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          if (key === 'alerts' && v !== 'off') NS.Timer.previewAlert();
          if (key === 'display') {
            const p = $('displayPreview');
            if (p) p.textContent = v === 'cs' ? '12.84' : v === 's' ? '12' : 'Solving';
          }
        });
      });
    });

    const SAMPLE = [[25, 49.39], [24, 46.68], [23, 44.09], [22, 47.28], [21, 45.7], [20, 57.5], [19, 56.85], [18, 58.25], [17, 49.63], [16, 11.94]];
    const input = $('histSearch'), list = $('histList');
    if (input && list) {
      const paint = () => {
        const q = input.value.trim();
        const m = /^([<>]=?)\s*(\d+(?:\.\d+)?)$/.exec(q);
        const rows = SAMPLE.filter((r) => {
          if (!q) return true;
          if (m) {
            const v = parseFloat(m[2]);
            return m[1] === '<' ? r[1] < v : m[1] === '<=' ? r[1] <= v : m[1] === '>' ? r[1] > v : r[1] >= v;
          }
          return String(r[0]).indexOf(q) === 0 || r[1].toFixed(2).indexOf(q) >= 0;
        });
        list.innerHTML = rows.length
          ? rows.map((r) => '<li><span>' + r[0] + '</span><b>' + r[1].toFixed(2) + '</b></li>').join('')
          : '<li class="empty">No solves match</li>';
      };
      input.addEventListener('input', paint);
      paint();
    }
    const party = $('partyBtn');
    if (party) {
      party.addEventListener('click', () => {
        const r = party.getBoundingClientRect();
        NS.fx.confetti(r.left + r.width / 2, r.top, 150);
      });
    }
  };
})();
