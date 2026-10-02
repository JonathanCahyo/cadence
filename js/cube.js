/* Candence — 3D cube engine + move notation helpers.
   Uses the global THREE (r128) loaded from cdnjs. */
(function () {
  'use strict';
  const NS = (window.Candence = window.Candence || {});
  const HALF = Math.PI / 2;

  /* Standard colour scheme: white top, green front, red right. */
  const HEX = { U: '#f2f1ea', D: '#f8c630', F: '#22b26a', B: '#2d6fe8', R: '#e43b30', L: '#f67e21' };

  /* name: [axis, layers, quarter-turn sign about the +axis] */
  const BASE = {
    R: ['x', [1], -1], L: ['x', [-1], 1], U: ['y', [1], -1], D: ['y', [-1], 1], F: ['z', [1], -1], B: ['z', [-1], 1],
    M: ['x', [0], 1], E: ['y', [0], 1], S: ['z', [0], -1],
    r: ['x', [0, 1], -1], l: ['x', [-1, 0], 1], u: ['y', [0, 1], -1], d: ['y', [-1, 0], 1], f: ['z', [0, 1], -1], b: ['z', [-1, 0], 1],
    x: ['x', [-1, 0, 1], -1], y: ['y', [-1, 0, 1], -1], z: ['z', [-1, 0, 1], -1],
  };

  function parseMove(tok) {
    const m = /^([URFDLBMESurfdlbxyz])(w?)(2?)('?)(2?)$/.exec(String(tok).trim().replace(/[’`]/g, "'"));
    if (!m) return null;
    const key = m[2] ? m[1].toLowerCase() : m[1];
    const b = BASE[key];
    if (!b) return null;
    let q = b[2];
    if (m[3] || m[5]) q *= 2;
    else if (m[4]) q = -q;
    return { axis: b[0], layers: b[1].slice(), q };
  }
  function parseAlg(str) {
    return String(str || '').trim().split(/\s+/).map(parseMove).filter(Boolean);
  }
  function invertMove(m) {
    return { axis: m.axis, layers: m.layers.slice(), q: Math.abs(m.q) === 2 ? m.q : -m.q };
  }
  function invertAlg(ms) {
    return ms.slice().reverse().map(invertMove);
  }
  function sameLayers(a, b) {
    return a.length === b.length && a.every((v) => b.indexOf(v) >= 0);
  }
  function moveName(mv) {
    for (const k in BASE) {
      const b = BASE[k];
      if (b[0] === mv.axis && sameLayers(b[1], mv.layers)) {
        const n = mv.q * b[2];
        return k + (Math.abs(n) === 2 ? '2' : n < 0 ? "'" : '');
      }
    }
    return '?';
  }
  function simplify(ms) {
    const out = [];
    for (const m of ms) {
      const last = out[out.length - 1];
      if (last && last.axis === m.axis && sameLayers(last.layers, m.layers)) {
        const q = (((last.q + m.q) % 4) + 4) % 4;
        if (q === 0) out.pop();
        else last.q = q === 3 ? -1 : q;
      } else out.push({ axis: m.axis, layers: m.layers.slice(), q: m.q });
    }
    return out;
  }
  function randomScramble(len) {
    len = len || 20;
    const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
    const axisOf = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };
    const sfx = ['', "'", '2'];
    const out = [];
    let last = null, prev = null;
    while (out.length < len) {
      const f = faces[(Math.random() * 6) | 0];
      if (f === last) continue;
      if (last && prev && axisOf[f] === axisOf[last] && axisOf[f] === axisOf[prev]) continue;
      out.push(f + sfx[(Math.random() * 3) | 0]);
      prev = last;
      last = f;
    }
    return out.join(' ');
  }

  NS.cube = { HEX, parseMove, parseAlg, invertMove, invertAlg, moveName, simplify, randomScramble };

  if (!window.THREE) return;
  const T = window.THREE;

  const AX = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };
  const FACES = {
    U: { n: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1] },
    D: { n: [0, -1, 0], right: [1, 0, 0], up: [0, 0, 1] },
    F: { n: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
    B: { n: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },
    R: { n: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
    L: { n: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0] },
  };
  /* pitch / yaw that turns a face toward the camera */
  const FACE_VIEW = { F: [0, 0], R: [0, -HALF], B: [0, Math.PI], L: [0, HALF], U: [HALF, 0], D: [-HALF, 0] };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const srgb = (hex) => new T.Color(hex).convertSRGBToLinear();

  function roundedBox(size, radius, seg) {
    const g = new T.BoxGeometry(size, size, size, seg, seg, seg);
    const p = g.attributes.position, nrm = g.attributes.normal;
    const h = size / 2, core = h - radius;
    const v = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
    const remap = (a) => {
      const u = a / h;
      return Math.sign(u) * Math.pow(Math.abs(u), 0.45) * h;
    };
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.set(remap(v.x), remap(v.y), remap(v.z));
      c.set(clamp(v.x, -core, core), clamp(v.y, -core, core), clamp(v.z, -core, core));
      d.copy(v).sub(c);
      const len = d.length();
      if (len > 1e-6) d.divideScalar(len);
      else d.fromBufferAttribute(nrm, i);
      p.setXYZ(i, c.x + d.x * radius, c.y + d.y * radius, c.z + d.z * radius);
      nrm.setXYZ(i, d.x, d.y, d.z);
    }
    p.needsUpdate = true;
    nrm.needsUpdate = true;
    return g;
  }

  function stickerGeometry(size, r, depth) {
    const s = size / 2, sh = new T.Shape();
    sh.moveTo(-s + r, -s);
    sh.lineTo(s - r, -s);
    sh.quadraticCurveTo(s, -s, s, -s + r);
    sh.lineTo(s, s - r);
    sh.quadraticCurveTo(s, s, s - r, s);
    sh.lineTo(-s + r, s);
    sh.quadraticCurveTo(-s, s, -s, s - r);
    sh.lineTo(-s, -s + r);
    sh.quadraticCurveTo(-s, -s, -s + r, -s);
    return new T.ExtrudeGeometry(sh, {
      depth, bevelEnabled: true, bevelThickness: depth * 0.6, bevelSize: depth * 0.6, bevelSegments: 3, curveSegments: 6,
    });
  }

  /* A small studio of emissive panels, prefiltered into an environment map
     so the stickers pick up soft strip-light reflections. */
  function makeEnvironment(renderer) {
    const pmrem = new T.PMREMGenerator(renderer);
    const env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x080808, side: T.BackSide })));
    const box = new T.BoxGeometry(1, 1, 1);
    const panel = (hex, k, pos, scale) => {
      const m = new T.Mesh(box, new T.MeshBasicMaterial({ color: new T.Color(hex).multiplyScalar(k) }));
      m.position.set(pos[0], pos[1], pos[2]);
      m.scale.set(scale[0], scale[1], scale[2]);
      env.add(m);
    };
    panel(0xffffff, 3.2, [0, 13, 2], [16, 0.2, 10]);
    panel(0xffffff, 3, [-13.5, 3, 5], [0.2, 10, 3]);
    panel(0xffffff, 2.2, [13.5, 4, -3], [0.2, 9, 2.5]);
    panel(0x8affcf, 1.4, [0, -3, -13.5], [14, 3, 0.2]);
    panel(0xffffff, 1.8, [5, 7, 13.5], [7, 3, 0.2]);
    const rt = pmrem.fromScene(env, 0.03);
    pmrem.dispose();
    return rt.texture;
  }

  class Engine {
    constructor(canvas) {
      this.canvas = canvas;
      const r = (this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputEncoding = T.sRGBEncoding;
      r.toneMapping = T.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.22;
      r.setClearColor(0x000000, 0);

      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(16, 1, 0.1, 200);
      this.camera.position.set(0, 0, 22);
      this.scene.environment = makeEnvironment(r);

      this.scene.add(new T.HemisphereLight(0xffffff, 0x222222, 0.5));
      const key = new T.DirectionalLight(0xffffff, 1.0);
      key.position.set(5, 5.5, 14);
      this.scene.add(key);
      const rim = new T.DirectionalLight(0x8affcf, 0.55);
      rim.position.set(-10, 2, -8);
      this.scene.add(rim);

      this.root = new T.Group();
      this.spinner = new T.Group();
      this.orient = new T.Group();
      this.puzzle = new T.Group();
      this.scene.add(this.root);
      this.root.add(this.spinner);
      this.spinner.add(this.orient);
      this.orient.add(this.puzzle);

      /* soft mint glow behind the cube, computed per-pixel so it has no edge */
      this.halo = new T.Mesh(new T.PlaneGeometry(6.4, 6.4), new T.ShaderMaterial({
        uniforms: { uColor: { value: new T.Color(0x5fd39d) }, uOpacity: { value: 0.3 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;' +
          'void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.4); gl_FragColor = vec4(uColor, a * uOpacity); }',
        transparent: true, depthWrite: false,
      }));
      this.halo.position.set(0, 0, -3);
      this.root.add(this.halo);

      this.baseQuat = new T.Quaternion().setFromEuler(new T.Euler(0.5, -0.72, 0, 'XYZ'));
      this.userQuat = new T.Quaternion();
      this.viewOverride = null;
      this.tilt = new T.Quaternion().setFromEuler(new T.Euler(0.34, -0.44, 0, 'XYZ'));
      this.explode = 0;
      this.targetExplode = 0;
      this.autoSpin = 0;
      this.spinAngle = 0;
      this.presence = 1;
      this.sway = 1;
      this.swayMix = 1;
      this.glow = 1;
      this.allowTurns = true;
      this.allowOrbit = true;
      this.queue = [];
      this.anim = null;
      this.drag = null;
      this.history = [];
      this.onMove = null;
      this.time = 0;
      this.lastInteract = -1e9;
      this.orbitVel = { x: 0, y: 0 };
      this.introStart = null;
      this.popping = new Set();
      this.raycaster = new T.Raycaster();
      this._q1 = new T.Quaternion();
      this._q2 = new T.Quaternion();
      this._qt = new T.Quaternion();
      this._ndc = new T.Vector2();
      this.cw = 1;
      this.ch = 1;

      this._build();
    }

    _build() {
      const BODY = 0.965, ST = 0.8, DEPTH = 0.02;
      const bodyGeo = roundedBox(BODY, 0.085, 8);
      const stGeo = stickerGeometry(ST, 0.13, DEPTH);
      this.bodyMat = new T.MeshStandardMaterial({ color: srgb('#0c0c0c'), roughness: 0.42, metalness: 0.05, envMapIntensity: 0.9 });
      this.faceMats = {};
      for (const k in HEX) {
        this.faceMats[k] = new T.MeshPhysicalMaterial({
          color: srgb(HEX[k]), roughness: 0.3, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 0.9,
        });
      }
      this.unknownMat = new T.MeshStandardMaterial({ color: srgb('#2b2b2b'), roughness: 0.55, metalness: 0 });
      this.cubies = [];
      this.stickers = [];
      this.pickables = [];
      const zAxis = new T.Vector3(0, 0, 1);
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const g = new T.Group();
        const body = new T.Mesh(bodyGeo, this.bodyMat);
        g.add(body);
        const spinAxis = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const cubie = {
          group: g, body, pos: new T.Vector3(x, y, z), quat: new T.Quaternion(), home: new T.Vector3(x, y, z),
          stickers: [], delay: 0, dir: new T.Vector3(x, y, z).normalize(), spinAxis,
        };
        body.userData.cubie = cubie;
        this.pickables.push(body);
        for (const k in FACES) {
          const n = FACES[k].n;
          if ((n[0] && n[0] === x) || (n[1] && n[1] === y) || (n[2] && n[2] === z)) {
            const s = new T.Mesh(stGeo, this.faceMats[k]);
            const nv = new T.Vector3(n[0], n[1], n[2]);
            s.quaternion.setFromUnitVectors(zAxis, nv);
            s.position.copy(nv).multiplyScalar(BODY / 2 - 0.006);
            s.userData = { cubie, face: k, normal: nv, pop: -1 };
            g.add(s);
            cubie.stickers.push(s);
            this.stickers.push(s);
            this.pickables.push(s);
          }
        }
        this.puzzle.add(g);
        this.cubies.push(cubie);
      }
      const core = new T.Group();
      const coreMat = new T.MeshStandardMaterial({ color: srgb('#161616'), roughness: 0.35, metalness: 0.3, envMapIntensity: 1 });
      core.add(new T.Mesh(new T.SphereGeometry(0.4, 32, 16), coreMat));
      const axle = new T.CylinderGeometry(0.06, 0.06, 2.1, 12);
      const ax1 = new T.Mesh(axle, coreMat);
      const ax2 = new T.Mesh(axle, coreMat);
      ax2.rotation.z = HALF;
      const ax3 = new T.Mesh(axle, coreMat);
      ax3.rotation.x = HALF;
      core.add(ax1, ax2, ax3);
      core.visible = false;
      this.core = core;
      this.puzzle.add(core);
    }

    /* Size the drawing buffer to the canvas's slot and frame the cube so it
       fills the slot's shorter side. */
    fit(w, h) {
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      this.cw = w;
      this.ch = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      const span = 5.8 * (h / Math.min(w, h));
      this.camera.position.z = span / (2 * Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)));
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
    }

    startIntro() {
      this.introStart = this.time + 0.1;
      for (const c of this.cubies) c.delay = Math.random() * 0.5 + (1.6 - c.home.length()) * 0.05;
    }

    /* ---------- moves ---------- */
    _collect(axis, layers) {
      const out = [];
      for (const c of this.cubies) {
        if (layers.indexOf(Math.round(c.pos[axis])) >= 0) out.push({ c, p0: c.pos.clone(), q0: c.quat.clone() });
      }
      return out;
    }
    _setLayerAngle(aff, axis, ang) {
      const q = this._qt.setFromAxisAngle(AX[axis], ang);
      for (const e of aff) {
        e.c.pos.copy(e.p0).applyQuaternion(q);
        e.c.quat.copy(q).multiply(e.q0);
      }
    }
    _snap(aff) {
      for (const e of aff) {
        const c = e.c;
        c.pos.set(Math.round(c.pos.x), Math.round(c.pos.y), Math.round(c.pos.z));
        const m = new T.Matrix4().makeRotationFromQuaternion(c.quat);
        const el = m.elements;
        for (let i = 0; i < 16; i++) el[i] = Math.round(el[i]);
        c.quat.setFromRotationMatrix(m).normalize();
      }
    }
    _applyInstant(m) {
      const aff = this._collect(m.axis, m.layers);
      this._setLayerAngle(aff, m.axis, m.q * HALF);
      this._snap(aff);
    }
    _startQueued() {
      const it = this.queue.shift();
      this.anim = {
        axis: it.move.axis, affected: this._collect(it.move.axis, it.move.layers), from: 0, to: it.move.q * HALF,
        t: 0, dur: Math.max(0.01, it.dur), move: it.move, source: it.source, resolve: it.resolve,
      };
    }
    _finishAnim(silent) {
      const a = this.anim;
      this.anim = null;
      this._setLayerAngle(a.affected, a.axis, a.to);
      this._snap(a.affected);
      if (a.move) {
        this.history.push({ axis: a.move.axis, layers: a.move.layers.slice(), q: a.move.q });
        if (!silent && this.onMove) this.onMove(a.move, a.source);
      }
      if (a.resolve) a.resolve(!silent);
    }
    play(move, dur, source) {
      return new Promise((resolve) => this.queue.push({ move, dur: dur == null ? 0.25 : dur, source: source || 'auto', resolve }));
    }
    playAlg(moves, dur, source) {
      if (!moves.length) return Promise.resolve(true);
      let p;
      for (const m of moves) p = this.play(m, dur, source);
      return p;
    }
    get busy() {
      return !!(this.anim || this.queue.length);
    }
    cancelAll() {
      const pending = this.queue;
      this.queue = [];
      pending.forEach((it) => it.resolve(false));
      if (this.anim) this._finishAnim(true);
      if (this.drag && this.drag.type === 'layer') this._setLayerAngle(this.drag.affected, this.drag.axis, 0);
      this.drag = null;
    }
    setState(moves) {
      this.cancelAll();
      for (const c of this.cubies) {
        c.pos.copy(c.home);
        c.quat.identity();
      }
      for (const m of moves) this._applyInstant(m);
      this.history = moves.map((m) => ({ axis: m.axis, layers: m.layers.slice(), q: m.q }));
    }
    isSolved() {
      const seen = {};
      const n = new T.Vector3();
      for (const s of this.stickers) {
        n.copy(s.userData.normal).applyQuaternion(s.userData.cubie.quat);
        const key = Math.round(n.x) + ',' + Math.round(n.y) + ',' + Math.round(n.z);
        if (seen[key] === undefined) seen[key] = s.userData.face;
        else if (seen[key] !== s.userData.face) return false;
      }
      return true;
    }

    /* ---------- solver / learn helpers ---------- */
    setUnknown(flag) {
      for (const s of this.stickers) s.material = flag ? this.unknownMat : this.faceMats[s.userData.face];
    }
    reveal(s) {
      s.material = this.faceMats[s.userData.face];
      s.userData.pop = this.time;
      this.popping.add(s);
    }
    stickersFacing(faceKey) {
      const F = FACES[faceKey], target = new T.Vector3(F.n[0], F.n[1], F.n[2]);
      const right = new T.Vector3(F.right[0], F.right[1], F.right[2]);
      const up = new T.Vector3(F.up[0], F.up[1], F.up[2]);
      const n = new T.Vector3();
      return this.stickers
        .filter((s) => n.copy(s.userData.normal).applyQuaternion(s.userData.cubie.quat).distanceTo(target) < 0.1)
        .sort((a, b) => {
          const pa = a.userData.cubie.pos, pb = b.userData.cubie.pos;
          const ra = Math.round(-pa.dot(up)) * 3 + Math.round(pa.dot(right));
          const rb = Math.round(-pb.dot(up)) * 3 + Math.round(pb.dot(right));
          return ra - rb;
        });
    }
    lookAt(faceKey) {
      if (!faceKey) {
        this.viewOverride = null;
        return;
      }
      const v = FACE_VIEW[faceKey];
      const qf = new T.Quaternion().setFromEuler(new T.Euler(v[0], v[1], 0, 'XYZ'));
      this.viewOverride = this.tilt.clone().multiply(qf);
    }
    topView() {
      const out = { top: [], F: [], B: [], L: [], R: [] };
      const n = new T.Vector3();
      for (const s of this.stickers) {
        const c = s.userData.cubie;
        if (Math.round(c.pos.y) !== 1) continue;
        n.copy(s.userData.normal).applyQuaternion(c.quat);
        const x = Math.round(c.pos.x), z = Math.round(c.pos.z), face = s.userData.face;
        if (n.y > 0.5) out.top.push({ col: x + 1, row: z + 1, face });
        else if (n.z > 0.5) out.F.push({ i: x + 1, face });
        else if (n.z < -0.5) out.B.push({ i: x + 1, face });
        else if (n.x < -0.5) out.L.push({ i: z + 1, face });
        else if (n.x > 0.5) out.R.push({ i: z + 1, face });
      }
      return out;
    }

    /* ---------- pointer interaction ---------- */
    _toScreen(v) {
      const r = this.canvas.getBoundingClientRect();
      const p = v.clone().project(this.camera);
      return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
    }
    _pick(x, y) {
      const r = this.canvas.getBoundingClientRect();
      if (!r.width || !r.height || this.presence < 0.5) return null;
      this._ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this._ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.pickables, false);
      return hits[0] || null;
    }
    _hitInfo(hit) {
      const obj = hit.object, cubie = obj.userData.cubie;
      if (!cubie) return null;
      let n;
      if (obj.userData.normal) n = obj.userData.normal.clone();
      else if (hit.face) n = hit.face.normal.clone();
      else return null;
      n.applyQuaternion(cubie.quat);
      const ax = Math.abs(n.x) > Math.abs(n.y) ? (Math.abs(n.x) > Math.abs(n.z) ? 'x' : 'z') : Math.abs(n.y) > Math.abs(n.z) ? 'y' : 'z';
      const r = new T.Vector3();
      r[ax] = Math.sign(n[ax]);
      if (Math.round(cubie.pos[ax]) !== r[ax]) return null;
      return { cubie, normal: r, point: hit.point.clone() };
    }
    pointerDown(x, y) {
      if (this.drag) return false;
      this.lastInteract = this.time;
      const introDone = this.introStart === null;
      // a turn still settling from the previous drag shouldn't block the next one
      if (this.anim && this.anim.source === 'user' && !this.queue.length) this._finishAnim(false);
      if (this.allowTurns && introDone && !this.busy && this.explode < 0.05) {
        const hit = this._pick(x, y);
        const info = hit && this._hitInfo(hit);
        if (info) {
          this.drag = Object.assign({ type: 'pending', x0: x, y0: y }, info);
          return true;
        }
      }
      if (this.allowOrbit) {
        this.drag = { type: 'orbit', x, y };
        this.orbitVel.x = this.orbitVel.y = 0;
        return true;
      }
      return false;
    }
    _beginLayer(d, dx, dy) {
      const wq = this.puzzle.getWorldQuaternion(new T.Quaternion());
      const s = this.root.scale.x;
      const p0 = this._toScreen(d.point);
      let best = null;
      for (const a of ['x', 'y', 'z']) {
        if (d.normal[a]) continue;
        const tw = AX[a].clone().applyQuaternion(wq).multiplyScalar(s * 0.5);
        const p1 = this._toScreen(d.point.clone().add(tw));
        const sx = p1[0] - p0[0], sy = p1[1] - p0[1];
        const len = Math.hypot(sx, sy) || 1e-6;
        const dot = (dx * sx + dy * sy) / len;
        if (!best || Math.abs(dot) > Math.abs(best.dot)) best = { a, dir: [sx / len, sy / len], len: len * 2, dot };
      }
      const sign = best.dot >= 0 ? 1 : -1;
      const tLocal = AX[best.a].clone().multiplyScalar(sign);
      const av = new T.Vector3().crossVectors(d.normal, tLocal);
      const axis = Math.abs(av.x) > 0.5 ? 'x' : Math.abs(av.y) > 0.5 ? 'y' : 'z';
      d.axisSign = Math.sign(av[axis]);
      d.axis = axis;
      d.layer = Math.round(d.cubie.pos[axis]);
      d.dir = [best.dir[0] * sign, best.dir[1] * sign];
      d.pxPerRad = Math.max(20, best.len * 1.3);
      d.affected = this._collect(axis, [d.layer]);
      d.angle = 0;
      d.vel = 0;
      d.lt = performance.now();
      d.type = 'layer';
    }
    pointerMove(x, y) {
      const d = this.drag;
      if (!d) return;
      this.lastInteract = this.time;
      if (d.type === 'orbit') {
        const dx = x - d.x, dy = y - d.y;
        this._orbitBy(dx, dy);
        this.orbitVel.x = dx;
        this.orbitVel.y = dy;
        d.x = x;
        d.y = y;
        return;
      }
      const dx = x - d.x0, dy = y - d.y0;
      if (d.type === 'pending') {
        if (Math.hypot(dx, dy) < 7) return;
        this._beginLayer(d, dx, dy);
      }
      const along = dx * d.dir[0] + dy * d.dir[1];
      const ang = (along / d.pxPerRad) * d.axisSign;
      const now = performance.now();
      const dt = Math.max(1, now - d.lt) / 1000;
      d.vel = 0.6 * d.vel + 0.4 * ((ang - d.angle) / dt);
      d.lt = now;
      d.angle = ang;
      this._setLayerAngle(d.affected, d.axis, ang);
    }
    pointerUp() {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      this.lastInteract = this.time;
      if (d.type !== 'layer') return;
      let q = Math.round(d.angle / HALF);
      if (q === 0 && Math.abs(d.vel) > 2.5 && Math.abs(d.angle) > 0.1) q = Math.sign(d.vel);
      const to = q * HALF;
      const qn = ((q % 4) + 4) % 4;
      const move = qn ? { axis: d.axis, layers: [d.layer], q: qn === 3 ? -1 : qn } : null;
      this.anim = {
        axis: d.axis, affected: d.affected, from: d.angle, to, t: 0,
        dur: clamp(Math.abs(to - d.angle) / 10, 0.07, 0.2), move, source: 'user', resolve: null, ease: easeOut,
      };
    }
    _orbitBy(dx, dy) {
      this._q1.setFromAxisAngle(AX.y, dx * 0.0065);
      this._q2.setFromAxisAngle(AX.x, dy * 0.0065);
      this.userQuat.premultiply(this._q1).premultiply(this._q2).normalize();
    }

    /* ---------- frame ---------- */
    update(dt, draw) {
      this.time += dt;
      const t = this.time;

      if (!this.anim && !(this.drag && this.drag.type === 'layer') && this.queue.length) this._startQueued();
      if (this.anim) {
        const a = this.anim;
        a.t += dt / a.dur;
        const k = a.t >= 1 ? 1 : (a.ease || easeInOut)(a.t);
        if (a.t >= 1) this._finishAnim(false);
        else this._setLayerAngle(a.affected, a.axis, a.from + (a.to - a.from) * k);
      }

      this.explode += (this.targetExplode - this.explode) * (1 - Math.exp(-dt * 7));
      const spread = 1 + this.explode * 0.78;
      let introActive = false;
      for (const c of this.cubies) {
        c.group.position.copy(c.pos).multiplyScalar(spread);
        c.group.quaternion.copy(c.quat);
        if (this.introStart !== null) {
          const k = easeOut(clamp((t - this.introStart - c.delay) / 1.1, 0, 1));
          if (k < 1) {
            introActive = true;
            c.group.position.addScaledVector(c.dir, (1 - k) * 2.4);
            this._q1.setFromAxisAngle(c.spinAxis, (1 - k) * 2.5);
            c.group.quaternion.premultiply(this._q1);
          }
          c.group.scale.setScalar(Math.max(0.001, k));
        }
      }
      if (this.introStart !== null && !introActive && t > this.introStart + 0.2) this.introStart = null;
      this.core.visible = this.explode > 0.03;

      if (this.popping.size) {
        for (const s of this.popping) {
          const p = (t - s.userData.pop) / 0.35;
          if (p >= 1) {
            s.scale.setScalar(1);
            this.popping.delete(s);
          } else s.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.28);
        }
      }

      const dragging = !!this.drag;
      if (!dragging || this.drag.type !== 'orbit') {
        const f = Math.exp(-dt * 4);
        if (Math.abs(this.orbitVel.x) + Math.abs(this.orbitVel.y) > 0.05) {
          this.orbitVel.x *= f;
          this.orbitVel.y *= f;
          this._orbitBy(this.orbitVel.x * dt * 30, this.orbitVel.y * dt * 30);
        }
        if (t - this.lastInteract > 2.4) this.userQuat.slerp(this._qt.identity(), 1 - Math.exp(-dt * 1.4));
      }
      const target = this.viewOverride || this._q2.multiplyQuaternions(this.userQuat, this.baseQuat);
      this.orient.quaternion.slerp(target, 1 - Math.exp(-dt * (this.viewOverride ? 3.2 : 14)));

      if (this.autoSpin) this.spinAngle += dt * this.autoSpin;
      else {
        const home = Math.round(this.spinAngle / (Math.PI * 2)) * Math.PI * 2;
        this.spinAngle += (home - this.spinAngle) * (1 - Math.exp(-dt * 2));
      }
      this.swayMix += ((dragging ? 0 : this.sway) - this.swayMix) * (1 - Math.exp(-dt * 3));
      const sy = Math.sin(t * 0.55) * 0.11 * this.swayMix, sx = Math.sin(t * 0.4) * 0.045 * this.swayMix;
      // presence < 1 while the cube swaps between sections: shrink with a quarter twist
      const pr = clamp(this.presence, 0, 1.2);
      this.spinner.rotation.set(sx, this.spinAngle + sy - (1 - Math.min(pr, 1)) * 1.1, 0);
      this.root.scale.setScalar(Math.max(1e-4, pr / (1 + this.explode * 0.6)));
      this.root.visible = pr > 0.01;
      this.halo.material.uniforms.uOpacity.value = 0.3 * this.glow * Math.min(1, pr);

      if (draw !== false) this.renderer.render(this.scene, this.camera);
    }
  }

  NS.cube.Engine = Engine;
})();
