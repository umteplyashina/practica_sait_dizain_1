(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width;
  const H = canvas.height;
  const TILE = 40;
  const ROWS = 15;
  const COLS = 280;

  const keys = Object.create(null);
  const justPressed = Object.create(null);

  const STATE = { TITLE: "title", PLAY: "play", WIN: "win", OVER: "over", PAUSE: "pause" };

  let audioCtx = null;
  let muted = false;

  const game = {
    state: STATE.TITLE,
    score: 0,
    coins: 0,
    lives: 3,
    time: 300,
    tick: 0,
    camX: 0,
    shake: 0,
    checkpoint: 3 * TILE,
    flagX: 0,
    map: [],
    blocks: new Map(),
    enemies: [],
    items: [],
    particles: [],
    popups: [],
    player: null,
    titleBob: 0,
  };

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur, type, vol, slide) {
    if (muted || !audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, audioCtx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.06, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }

  const sfx = {
    jump: () => tone(420, 0.18, "square", 0.05, 180),
    bump: () => tone(90, 0.08, "square", 0.07),
    coin: () => { tone(988, 0.08, "square", 0.05); setTimeout(() => tone(1318, 0.18, "square", 0.05), 70); },
    stomp: () => tone(180, 0.12, "triangle", 0.08, 80),
    power: () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.12, "square", 0.05), i * 80));
    },
    hurt: () => tone(220, 0.25, "sawtooth", 0.06, 80),
    die: () => {
      [523, 392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.16, "square", 0.06), i * 110));
    },
    win: () => {
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, "square", 0.055), i * 120));
    },
    kick: () => tone(200, 0.1, "square", 0.06, 400),
    break: () => { tone(140, 0.12, "sawtooth", 0.07, 50); tone(90, 0.16, "triangle", 0.05); },
  };

  const isTouchDevice =
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    navigator.maxTouchPoints > 0;
  const CONFIRM = isTouchDevice ? "Тап по экрану" : "Enter";

  function pressKey(k) {
    if (!k) return;
    if (!keys[k]) justPressed[k] = true;
    keys[k] = true;
  }

  window.addEventListener("keydown", (e) => {
    const mapKey = remap(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code) || e.code === "KeyW") {
      e.preventDefault();
    }
    if (e.code === "KeyM" && !e.repeat) setMuted(!muted);
    pressKey(mapKey);
    ensureAudio();
  });

  window.addEventListener("keyup", (e) => {
    keys[remap(e.code)] = false;
  });

  function remap(code) {
    if (code === "KeyA") return "ArrowLeft";
    if (code === "KeyD") return "ArrowRight";
    if (code === "KeyW" || code === "Space" || code === "KeyK") return "ArrowUp";
    if (code === "KeyS") return "ArrowDown";
    return code;
  }

  const pad = document.getElementById("touch");
  const padPointers = new Map();
  let touchHeld = new Set();

  function padButtonAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.closest) return null;
    const btn = el.closest("button[data-key]");
    return btn && pad.contains(btn) ? btn : null;
  }

  function syncPad() {
    const held = new Set();
    for (const btn of padPointers.values()) {
      if (btn && btn.dataset.key) held.add(btn.dataset.key);
    }
    for (const k of touchHeld) {
      if (!held.has(k)) keys[k] = false;
    }
    for (const k of held) pressKey(k);
    touchHeld = held;

    const active = new Set(padPointers.values());
    for (const btn of pad.querySelectorAll("button")) {
      btn.classList.toggle("pressed", active.has(btn));
    }
  }

  function padDown(id, x, y) {
    const btn = padButtonAt(x, y);
    if (!btn) return false;
    padPointers.set(id, btn);
    syncPad();
    ensureAudio();
    return true;
  }

  // Палец может съехать с кнопки — тогда трекаем его дальше и переключаем
  // клавишу, вместо того чтобы оставить её зажатой навсегда.
  function padMove(id, x, y) {
    if (!padPointers.has(id)) return;
    const btn = padButtonAt(x, y);
    if (padPointers.get(id) === btn) return;
    padPointers.set(id, btn);
    syncPad();
  }

  function padUp(id) {
    if (!padPointers.has(id)) return;
    padPointers.delete(id);
    syncPad();
  }

  if (window.PointerEvent) {
    pad.addEventListener("pointerdown", (e) => {
      if (padDown(e.pointerId, e.clientX, e.clientY)) e.preventDefault();
    });
    window.addEventListener("pointermove", (e) => {
      if (padPointers.has(e.pointerId)) {
        e.preventDefault();
        padMove(e.pointerId, e.clientX, e.clientY);
      }
    }, { passive: false });
    window.addEventListener("pointerup", (e) => padUp(e.pointerId));
    window.addEventListener("pointercancel", (e) => padUp(e.pointerId));
  } else {
    pad.addEventListener("touchstart", (e) => {
      let hit = false;
      for (const t of e.changedTouches) {
        if (padDown(t.identifier, t.clientX, t.clientY)) hit = true;
      }
      if (hit) e.preventDefault();
    }, { passive: false });
    window.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) padMove(t.identifier, t.clientX, t.clientY);
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) padUp(t.identifier);
    };
    window.addEventListener("touchend", endTouch);
    window.addEventListener("touchcancel", endTouch);
  }

  pad.addEventListener("contextmenu", (e) => e.preventDefault());

  function releaseAll() {
    for (const k of Object.keys(keys)) keys[k] = false;
    padPointers.clear();
    touchHeld = new Set();
    for (const btn of pad.querySelectorAll("button")) btn.classList.remove("pressed");
  }

  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    releaseAll();
    if (game.state === STATE.PLAY) game.state = STATE.PAUSE;
  });

  // Тап по игровому полю заменяет Enter на устройствах без клавиатуры.
  canvas.addEventListener("pointerdown", (e) => {
    ensureAudio();
    if (game.state === STATE.PLAY) return;
    e.preventDefault();
    justPressed.Enter = true;
  });

  const soundBtn = document.getElementById("btnSound");
  const fullBtn = document.getElementById("btnFull");
  const pauseBtn = document.getElementById("btnPause");

  function setMuted(v) {
    muted = v;
    soundBtn.textContent = muted ? "ЗВУК: ВЫКЛ" : "ЗВУК: ВКЛ";
    soundBtn.setAttribute("aria-pressed", String(muted));
  }

  function requestFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) req.call(el);
  }

  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
  }

  function fullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  // Кнопки-чипы не должны забирать фокус: иначе пробел начнёт нажимать их,
  // а не прыгать.
  function onChip(btn, handler) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      btn.blur();
      handler();
    });
  }

  onChip(pauseBtn, () => {
    ensureAudio();
    justPressed.KeyP = true;
  });

  onChip(soundBtn, () => {
    ensureAudio();
    setMuted(!muted);
  });

  onChip(fullBtn, () => {
    if (fullscreenActive()) exitFullscreen();
    else requestFullscreen();
  });

  if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) {
    fullBtn.hidden = true;
  }

  const stageArea = document.querySelector(".stage-area");
  const STAGE_BORDER = 12;

  function layout() {
    const aw = stageArea.clientWidth - STAGE_BORDER;
    const ah = stageArea.clientHeight - STAGE_BORDER;
    if (aw <= 0 || ah <= 0) return;
    const width = Math.max(160, Math.floor(Math.min(aw, (ah * W) / H)));
    canvas.style.width = width + "px";
    canvas.style.height = Math.floor((width * H) / W) + "px";
  }

  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", () => setTimeout(layout, 150));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(stageArea);
  if (document.fonts) document.fonts.ready.then(layout).catch(() => {});
  layout();

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function irand(a, b) { return (Math.random() * (b - a + 1) | 0) + a; }

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= COLS) return "#";
    if (ty < 0 || ty >= ROWS) return ".";
    return game.map[ty][tx];
  }

  function setTile(tx, ty, v) {
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return;
    game.map[ty][tx] = v;
  }

  function isSolid(ch, fromBelow) {
    if (ch === "." || ch === "c" || ch === "e") return false;
    if (ch === "=") return !fromBelow;
    return ch === "#" || ch === "T" || ch === "B" || ch === "?" || ch === "M" || ch === "*" || ch === "D" || ch === "P" || ch === "=";
  }

  function isBouncy(ch) {
    return ch === "B" || ch === "?" || ch === "M" || ch === "*" || ch === "D";
  }

  function blockKey(tx, ty) { return tx + "," + ty; }

  function getBlock(tx, ty) {
    const k = blockKey(tx, ty);
    if (!game.blocks.has(k)) {
      const ch = tileAt(tx, ty);
      game.blocks.set(k, {
        used: ch === "D",
        bump: 0,
        coinsLeft: ch === "B" ? (Math.random() < 0.18 ? 5 : 0) : 1,
      });
    }
    return game.blocks.get(k);
  }

  function colRect(x, y, w, h) {
    return {
      c0: Math.floor(x / TILE),
      c1: Math.floor((x + w - 0.001) / TILE),
      r0: Math.floor(y / TILE),
      r1: Math.floor((y + h - 0.001) / TILE),
    };
  }

  function buildLevel() {
    const map = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
    const enemies = [];
    const items = [];

    function ground(x0, x1) {
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= COLS) continue;
        map[12][x] = "T";
        map[13][x] = "#";
        map[14][x] = "#";
      }
    }

    function cut(x0, x1) {
      for (let x = x0; x < x1; x++) {
        map[12][x] = ".";
        map[13][x] = ".";
        map[14][x] = ".";
      }
    }

    function plat(x, y, w, ch) {
      for (let i = 0; i < w; i++) map[y][x + i] = ch || "=";
    }

    function brickRow(x, y, w) {
      for (let i = 0; i < w; i++) map[y][x + i] = "B";
    }

    function q(x, y, type) {
      map[y][x] = type;
    }

    function pipe(x, h) {
      const top = 12 - h;
      for (let y = top; y < 12; y++) {
        map[y][x] = "P";
        map[y][x + 1] = "P";
      }
      return top;
    }

    function walker(x, y, kind) {
      enemies.push({ kind: kind || "walker", tx: x, ty: y });
    }

    ground(0, COLS);
    cut(24, 27);
    cut(52, 56);
    cut(88, 93);
    cut(128, 132);
    cut(168, 174);
    cut(210, 214);
    cut(232, 236);

    q(8, 8, "?");
    q(9, 8, "M");
    q(10, 8, "?");
    q(16, 8, "B");
    q(17, 8, "?");
    q(18, 8, "B");
    walker(14, 11, "walker");
    walker(20, 11, "walker");

    plat(28, 9, 4, "=");
    q(29, 9, "?");
    q(30, 6, "?");
    walker(32, 11, "shell");

    const p1 = pipe(40, 2);
    enemies.push({ kind: "plant", tx: 40, ty: p1, pipeH: 2 });
    pipe(46, 3);
    walker(50, 11, "walker");

    brickRow(60, 8, 5);
    q(62, 8, "*");
    q(64, 5, "?");
    plat(58, 5, 3, "=");
    walker(66, 11, "walker");
    walker(70, 11, "spiky");

    plat(76, 9, 6, "=");
    q(78, 9, "M");
    q(80, 9, "?");
    walker(77, 8, "walker");
    plat(82, 6, 4, "=");
    for (let i = 0; i < 4; i++) items.push({ kind: "coin", tx: 82 + i, ty: 5 });

    pipe(96, 2);
    pipe(102, 4);
    enemies.push({ kind: "plant", tx: 102, ty: 8, pipeH: 4 });
    walker(108, 11, "shell");
    walker(112, 11, "walker");
    walker(116, 11, "spiky");

    brickRow(118, 8, 8);
    q(120, 8, "?");
    q(122, 8, "M");
    q(124, 8, "?");
    plat(118, 5, 5, "=");
    for (let i = 0; i < 5; i++) items.push({ kind: "coin", tx: 118 + i, ty: 4 });
    enemies.push({ kind: "flyer", tx: 121, ty: 3 });

    plat(136, 10, 3, "=");
    plat(141, 8, 3, "=");
    plat(146, 6, 4, "=");
    q(147, 6, "?");
    q(148, 6, "?");
    plat(152, 8, 3, "=");
    plat(157, 10, 3, "=");
    enemies.push({ kind: "flyer", tx: 144, ty: 4 });
    walker(150, 11, "walker");

    ground(174, 210);
    q(178, 8, "?");
    q(179, 8, "B");
    q(180, 8, "?");
    q(181, 8, "B");
    q(182, 8, "M");
    brickRow(186, 5, 6);
    q(188, 5, "*");
    walker(184, 11, "shell");
    walker(190, 11, "spiky");
    walker(194, 11, "walker");
    walker(198, 11, "walker");
    enemies.push({ kind: "flyer", tx: 192, ty: 7 });

    pipe(204, 3);
    enemies.push({ kind: "plant", tx: 204, ty: 9, pipeH: 3 });

    plat(216, 9, 5, "=");
    for (let i = 0; i < 5; i++) items.push({ kind: "coin", tx: 216 + i, ty: 8 });
    plat(222, 6, 4, "=");
    q(223, 6, "?");
    q(224, 6, "M");
    enemies.push({ kind: "flyer", tx: 220, ty: 4 });
    walker(226, 11, "spiky");
    walker(228, 11, "shell");

    for (let i = 0; i < 8; i++) {
      const x = 240 + i;
      const y = 12 - i;
      if (y >= 4) map[y][x] = "#";
      for (let yy = y + 1; yy < 12; yy++) map[yy][x] = "#";
    }
    map[4][248] = "e";
    game.flagX = 248 * TILE;

    for (let x = 0; x < COLS; x++) {
      if (map[12][x] === "T" && map[11][x] === "." && Math.random() < 0.06) {
        if (x > 12 && x < 238) map[11][x] = Math.random() < 0.5 ? "n" : "h";
      }
    }

    game.map = map;
    return { enemies, items };
  }

  function makePlayer(x) {
    return {
      x: x,
      y: 8 * TILE,
      w: 26,
      h: 36,
      vx: 0,
      vy: 0,
      dir: 1,
      onGround: false,
      super: false,
      star: 0,
      hurt: 0,
      dead: false,
      deadTimer: 0,
      grow: 0,
      frame: 0,
      walk: 0,
      coyote: 0,
      buffer: 0,
      jumpHeld: false,
      spawnX: x,
      skid: 0,
    };
  }

  function applySize(p) {
    const feet = p.y + p.h;
    p.h = p.super ? 56 : 36;
    p.w = p.super ? 28 : 26;
    p.y = feet - p.h;
  }

  function spawnWorld(fromCheckpoint) {
    game.blocks = new Map();
    game.particles = [];
    game.popups = [];
    game.time = 300;
    const built = buildLevel();
    const startX = fromCheckpoint ? game.checkpoint : 3 * TILE;
    game.player = makePlayer(startX);
    game.enemies = built.enemies.map((e) => makeEnemy(e));
    game.items = built.items.map((it) => makeItem(it.kind, it.tx * TILE + 8, it.ty * TILE + 8, false));
    game.camX = Math.max(0, startX - 200);
  }

  function makeEnemy(spec) {
    const kind = spec.kind;
    const base = {
      kind,
      x: spec.tx * TILE + 4,
      y: spec.ty * TILE,
      w: 32,
      h: 32,
      vx: kind === "flyer" ? 1.2 : -0.7,
      vy: 0,
      dir: -1,
      alive: true,
      squish: 0,
      shell: false,
      shellMove: 0,
      frame: 0,
      t: Math.random() * 20,
      homeY: spec.ty * TILE,
      pipeX: spec.tx * TILE,
      pipeH: spec.pipeH || 2,
      dead: false,
    };
    if (kind === "plant") {
      base.w = 28;
      base.h = 36;
      base.x = spec.tx * TILE + 6;
      base.y = spec.ty * TILE + TILE;
      base.homeY = spec.ty * TILE;
    }
    if (kind === "flyer") {
      base.y = spec.ty * TILE;
      base.homeY = spec.ty * TILE;
    }
    if (kind === "spiky") base.h = 30;
    return base;
  }

  function makeItem(kind, x, y, emerging) {
    return {
      kind,
      x,
      y,
      w: kind === "coin" && !emerging ? 16 : 28,
      h: kind === "coin" && !emerging ? 24 : 28,
      vx: kind === "mushroom" ? 1.1 : 0,
      vy: kind === "coin" && emerging ? -8 : 0,
      emerging: emerging || false,
      emerge: emerging ? TILE : 0,
      startY: y,
      alive: true,
      t: 0,
      pop: emerging && kind === "coin",
    };
  }

  function addScore(n, x, y) {
    game.score += n;
    if (x != null) {
      game.popups.push({ x, y, text: String(n), t: 0 });
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < (n || 8); i++) {
      game.particles.push({
        x, y,
        vx: rand(-3, 3),
        vy: rand(-6, -1),
        life: rand(18, 36),
        max: 36,
        color,
        g: 0.25,
        s: rand(3, 6),
      });
    }
  }

  function spark(x, y) {
    burst(x, y, "#ffd447", 10);
  }

  function popup(x, y, text) {
    game.popups.push({ x, y, text, t: 0 });
  }

  function collectCoin(x, y, fromBlock) {
    game.coins += 1;
    addScore(200, x, y);
    sfx.coin();
    spark(x, y);
    if (game.coins >= 100) {
      game.coins -= 100;
      game.lives += 1;
      popup(x, y - 20, "1UP");
    }
  }

  function hitBlock(tx, ty, p) {
    const ch = tileAt(tx, ty);
    if (!isBouncy(ch)) {
      sfx.bump();
      return;
    }
    const b = getBlock(tx, ty);
    b.bump = 8;
    game.shake = 4;

    if (ch === "D" || b.used) {
      sfx.bump();
      return;
    }

    if (ch === "?") {
      b.used = true;
      setTile(tx, ty, "D");
      const cx = tx * TILE + TILE / 2 - 8;
      const cy = ty * TILE - 8;
      game.items.push(makeItem("coin", cx, cy, true));
      collectCoin(cx, cy, true);
      sfx.bump();
      return;
    }
    if (ch === "M") {
      b.used = true;
      setTile(tx, ty, "D");
      game.items.push(makeItem("mushroom", tx * TILE + 6, ty * TILE, true));
      sfx.bump();
      return;
    }
    if (ch === "*") {
      b.used = true;
      setTile(tx, ty, "D");
      game.items.push(makeItem("star", tx * TILE + 6, ty * TILE, true));
      sfx.bump();
      return;
    }
    if (ch === "B") {
      if (p.super && b.coinsLeft <= 0) {
        setTile(tx, ty, ".");
        sfx.break();
        burst(tx * TILE + 20, ty * TILE + 20, "#c47a3a", 12);
        addScore(50);
        return;
      }
      if (b.coinsLeft > 0) {
        b.coinsLeft -= 1;
        const cx = tx * TILE + TILE / 2 - 8;
        const cy = ty * TILE - 8;
        game.items.push(makeItem("coin", cx, cy, true));
        collectCoin(cx, cy, true);
        if (b.coinsLeft <= 0) {
          b.used = true;
          setTile(tx, ty, "D");
        }
        sfx.bump();
        return;
      }
      sfx.bump();
    }
  }

  function hurtPlayer() {
    const p = game.player;
    if (p.dead || p.hurt > 0 || p.star > 0) return;
    if (p.super) {
      p.super = false;
      applySize(p);
      p.hurt = 120;
      p.grow = -20;
      sfx.hurt();
      return;
    }
    killPlayer();
  }

  function killPlayer() {
    const p = game.player;
    if (p.dead) return;
    p.dead = true;
    p.deadTimer = 0;
    p.vy = -11;
    p.vx = 0;
    sfx.die();
  }

  function stompBounce(p) {
    p.vy = keys.ArrowUp ? -11 : -6;
    p.onGround = false;
  }

  function updatePlayer(dt) {
    const p = game.player;
    const f = dt * 60;
    p.frame += f;
    if (p.hurt > 0) p.hurt -= f;
    if (p.star > 0) p.star -= f;
    if (p.grow !== 0) {
      p.grow += p.grow > 0 ? -f : f;
      if (Math.abs(p.grow) < 1) p.grow = 0;
    }

    if (p.dead) {
      p.deadTimer += f;
      p.vy += 0.45 * f;
      p.y += p.vy * f;
      if (p.deadTimer > 90) {
        game.lives -= 1;
        if (game.lives <= 0) {
          game.state = STATE.OVER;
        } else {
          spawnWorld(true);
        }
      }
      return;
    }

    const left = keys.ArrowLeft;
    const right = keys.ArrowRight;
    const jump = keys.ArrowUp;
    if (justPressed.ArrowUp) p.buffer = 10;

    const accel = p.onGround ? 0.55 : 0.4;
    const max = p.star > 0 ? 5.4 : 4.2;
    if (left) {
      p.vx -= accel * f;
      if (p.vx < -max) p.vx = -max;
      if (p.onGround && p.vx > 1) p.skid = 8;
      p.dir = -1;
    } else if (right) {
      p.vx += accel * f;
      if (p.vx > max) p.vx = max;
      if (p.onGround && p.vx < -1) p.skid = 8;
      p.dir = 1;
    } else {
      p.vx *= Math.pow(0.78, f);
      if (Math.abs(p.vx) < 0.08) p.vx = 0;
    }
    if (p.skid > 0) p.skid -= f;

    if (p.onGround) p.coyote = 8;
    else p.coyote -= f;
    if (p.buffer > 0) p.buffer -= f;

    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -12.2;
      p.onGround = false;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpHeld = true;
      sfx.jump();
    }
    if (!jump && p.jumpHeld && p.vy < -3) {
      p.vy *= 0.45;
      p.jumpHeld = false;
    }
    if (!jump) p.jumpHeld = false;

    p.vy += (jump && p.vy < 0 ? 0.32 : 0.52) * f;
    if (p.vy > 12) p.vy = 12;

    p.x += p.vx * f;
    resolve(p, true);
    p.onGround = false;
    p.y += p.vy * f;
    resolve(p, false);

    if (p.x < 4) p.x = 4;
    if (p.x + p.w > COLS * TILE - 4) p.x = COLS * TILE - 4 - p.w;

    if (p.y > ROWS * TILE + 40) killPlayer();

    if (Math.abs(p.vx) > 0.4 && p.onGround) p.walk += Math.abs(p.vx) * 0.18 * f;
    else if (p.onGround) p.walk = 0;

    if (p.x > game.checkpoint + 40 * TILE) {
      game.checkpoint = p.x;
    }

    if (p.x + p.w > game.flagX + 8 && p.y < 12 * TILE) {
      game.state = STATE.WIN;
      sfx.win();
    }
  }

  function resolve(p, axisX) {
    const box = colRect(p.x, p.y, p.w, p.h);
    for (let ty = box.r0; ty <= box.r1; ty++) {
      for (let tx = box.c0; tx <= box.c1; tx++) {
        const ch = tileAt(tx, ty);
        if (ch === "=") {
          if (axisX || p.vy < 0) continue;
          const prevBottom = p.y + p.h - p.vy;
          if (prevBottom > ty * TILE + 8) continue;
        }
        const fromBelow = !axisX && p.vy < 0;
        if (!isSolid(ch, fromBelow)) continue;
        const rx = tx * TILE;
        const ry = ty * TILE;
        if (axisX) {
          if (p.vx > 0) p.x = rx - p.w;
          else if (p.vx < 0) p.x = rx + TILE;
          p.vx = 0;
        } else {
          if (p.vy > 0) {
            p.y = ry - p.h;
            p.vy = 0;
            p.onGround = true;
          } else if (p.vy < 0) {
            p.y = ry + TILE;
            p.vy = 0;
            hitBlock(tx, ty, p);
          }
        }
      }
    }
  }

  function solidAt(px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const ch = tileAt(tx, ty);
    return isSolid(ch, false) && ch !== "=";
  }

  function updateEnemies(dt) {
    const f = dt * 60;
    const p = game.player;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      e.t += f;
      e.frame += f;

      if (e.squish > 0) {
        e.squish -= f;
        if (e.squish <= 0) e.alive = false;
        continue;
      }

      if (e.kind === "plant") {
        const pipeTop = e.homeY;
        const hidden = pipeTop + TILE + 8;
        const shown = pipeTop - e.h + 10;
        const near = Math.abs(p.x + p.w / 2 - (e.pipeX + TILE)) < 50 && p.y + p.h <= pipeTop + 8;
        const cycle = (e.t % 180);
        if (near || (cycle > 90 && cycle < 140)) {
          e.y += 1.2 * f;
        } else {
          e.y -= 1.2 * f;
        }
        e.y = clamp(e.y, shown, hidden);
        if (e.y < e.homeY + 6) collideEnemyPlayer(e, p);
        continue;
      }

      if (e.kind === "flyer") {
        e.x += e.vx * f * 1.4;
        e.y = e.homeY + Math.sin(e.t * 0.08) * 28;
        if (e.x < e.pipeX - 70) e.vx = Math.abs(e.vx);
        if (e.x > e.pipeX + 90) e.vx = -Math.abs(e.vx);
        collideEnemyPlayer(e, p);
        continue;
      }

      if (e.shell && e.shellMove === 0) {
        collideEnemyPlayer(e, p);
        continue;
      }

      const spd = e.shell ? 6.2 : (e.kind === "spiky" ? 0.85 : 0.75);
      if (!e.shell) e.vx = (e.vx < 0 ? -spd : spd);
      e.x += (e.shell ? e.shellMove : e.vx) * f;

      const dir = e.shell ? Math.sign(e.shellMove || e.vx) : Math.sign(e.vx);
      const frontX = dir > 0 ? e.x + e.w + 2 : e.x - 2;
      const footX = dir > 0 ? e.x + e.w - 6 : e.x + 6;
      if (solidAt(frontX, e.y + e.h / 2)) {
        if (e.shell) e.shellMove *= -1;
        else e.vx *= -1;
      } else if (!e.shell && !solidAt(footX, e.y + e.h + 4)) {
        e.vx *= -1;
      }

      e.vy += 0.5 * f;
      e.y += e.vy * f;
      const box = colRect(e.x, e.y, e.w, e.h);
      for (let ty = box.r0; ty <= box.r1; ty++) {
        for (let tx = box.c0; tx <= box.c1; tx++) {
          const ch = tileAt(tx, ty);
          if (!isSolid(ch, false) || ch === "=") continue;
          const ry = ty * TILE;
          if (e.y + e.h > ry && e.vy >= 0 && e.y < ry) {
            e.y = ry - e.h;
            e.vy = 0;
          }
        }
      }

      if (e.shell && e.shellMove) {
        for (const o of game.enemies) {
          if (o === e || !o.alive || o.squish || o.kind === "plant") continue;
          if (aabb(e, o)) {
            o.alive = false;
            burst(o.x + 16, o.y + 16, "#f4a261", 10);
            addScore(200, o.x, o.y);
            sfx.stomp();
          }
        }
      }

      collideEnemyPlayer(e, p);
    }
  }

  function collideEnemyPlayer(e, p) {
    if (p.dead || !e.alive || e.squish) return;
    if (!aabb({ x: p.x, y: p.y, w: p.w, h: p.h }, e)) return;

    if (p.star > 0) {
      e.alive = false;
      burst(e.x + 16, e.y + 16, "#ffd447", 12);
      addScore(200, e.x, e.y);
      sfx.kick();
      return;
    }

    const stomp = p.vy > 0 && p.y + p.h - e.y < 18;

    if (e.kind === "plant") {
      hurtPlayer();
      return;
    }
    if (e.kind === "spiky") {
      if (stomp) {
        p.vy = -4;
        hurtPlayer();
      } else hurtPlayer();
      return;
    }
    if (e.kind === "shell" && e.shell) {
      if (stomp) {
        e.shellMove = 0;
        stompBounce(p);
        sfx.stomp();
      } else if (e.shellMove === 0) {
        e.shellMove = p.x + p.w / 2 < e.x + e.w / 2 ? 6.2 : -6.2;
        sfx.kick();
        p.vx = -Math.sign(e.shellMove) * 3;
      } else {
        const fromAbove = p.y + p.h < e.y + 12;
        if (fromAbove) {
          e.shellMove = 0;
          stompBounce(p);
        } else hurtPlayer();
      }
      return;
    }

    if (stomp) {
      if (e.kind === "shell") {
        e.shell = true;
        e.h = 24;
        e.y += 8;
        e.shellMove = 0;
        e.vx = 0;
      } else {
        e.squish = 22;
        e.h = 12;
        e.y += 20;
      }
      stompBounce(p);
      addScore(100, e.x, e.y);
      sfx.stomp();
      game.shake = 5;
      return;
    }
    hurtPlayer();
  }

  function updateItems(dt) {
    const f = dt * 60;
    const p = game.player;
    for (const it of game.items) {
      if (!it.alive) continue;
      it.t += f;

      if (it.pop) {
        it.y += it.vy * f;
        it.vy += 0.45 * f;
        if (it.t > 18) it.alive = false;
        continue;
      }

      if (it.emerging) {
        it.y -= 1.1 * f;
        it.emerge -= 1.1 * f;
        if (it.emerge <= 0) {
          it.emerging = false;
          if (it.kind === "mushroom") it.vx = p.dir * 1.15;
          if (it.kind === "star") it.vy = -6;
        }
        continue;
      }

      if (it.kind === "coin") {
        if (aabb(p, it)) {
          it.alive = false;
          collectCoin(it.x, it.y, false);
        }
        continue;
      }

      it.vy += (it.kind === "star" ? 0.28 : 0.45) * f;
      it.x += it.vx * f;
      if (solidAt(it.x + (it.vx > 0 ? it.w : 0), it.y + it.h / 2)) it.vx *= -1;
      it.y += it.vy * f;
      const box = colRect(it.x, it.y, it.w, it.h);
      for (let ty = box.r0; ty <= box.r1; ty++) {
        for (let tx = box.c0; tx <= box.c1; tx++) {
          const ch = tileAt(tx, ty);
          if (!isSolid(ch, false)) continue;
          const ry = ty * TILE;
          if (it.y + it.h > ry && it.vy >= 0) {
            it.y = ry - it.h;
            if (it.kind === "star") it.vy = -7.5;
            else it.vy = 0;
          }
        }
      }

      if (aabb(p, it)) {
        it.alive = false;
        if (it.kind === "mushroom") {
          if (!p.super) {
            p.super = true;
            applySize(p);
            p.grow = 24;
          }
          addScore(1000, it.x, it.y);
          sfx.power();
        } else if (it.kind === "star") {
          p.star = 420;
          addScore(1000, it.x, it.y);
          sfx.power();
        }
        spark(it.x + 10, it.y);
      }
    }
  }

  function updateFx(dt) {
    const f = dt * 60;
    game.particles = game.particles.filter((pt) => {
      pt.vy += pt.g * f;
      pt.x += pt.vx * f;
      pt.y += pt.vy * f;
      pt.life -= f;
      return pt.life > 0;
    });
    game.popups = game.popups.filter((t) => {
      t.t += f;
      t.y -= 0.6 * f;
      return t.t < 40;
    });
    if (game.shake > 0) game.shake -= f;
    for (const b of game.blocks.values()) {
      if (b.bump > 0) b.bump -= f;
    }
  }

  function updateCamera() {
    const p = game.player;
    const target = p.x - W * 0.38;
    game.camX += (target - game.camX) * 0.12;
    const max = COLS * TILE - W;
    game.camX = clamp(game.camX, 0, Math.max(0, max));
  }

  function worldX(x) { return x - game.camX + (game.shake ? rand(-game.shake, game.shake) : 0); }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4c8cf5");
    g.addColorStop(0.55, "#7ec8ff");
    g.addColorStop(1, "#b8ecff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cam = game.camX;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 12; i++) {
      const x = ((i * 220) - cam * 0.25) % (W + 180) - 60;
      const y = 28 + (i % 4) * 28;
      cloud(x, y, 0.7 + (i % 3) * 0.15);
    }

    ctx.fillStyle = "#3fa34a";
    for (let i = 0; i < 10; i++) {
      const x = ((i * 280) - cam * 0.4) % (W + 260) - 80;
      hill(x, H - 80, 90 + (i % 3) * 30, "#3fa34a");
    }
    ctx.fillStyle = "#2d6a4f";
    for (let i = 0; i < 10; i++) {
      const x = ((i * 240 + 80) - cam * 0.55) % (W + 260) - 80;
      hill(x, H - 40, 70, "#2d6a4f");
    }
  }

  function cloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 16 * s, 0, Math.PI * 2);
    ctx.arc(x + 18 * s, y - 8 * s, 20 * s, 0, Math.PI * 2);
    ctx.arc(x + 38 * s, y, 16 * s, 0, Math.PI * 2);
    ctx.arc(x + 20 * s, y + 6 * s, 14 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function hill(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y + r, r, Math.PI, 0);
    ctx.fill();
  }

  function drawMap() {
    const c0 = Math.max(0, Math.floor(game.camX / TILE) - 1);
    const c1 = Math.min(COLS - 1, Math.ceil((game.camX + W) / TILE) + 1);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = c0; tx <= c1; tx++) {
        const ch = tileAt(tx, ty);
        if (ch === "." || ch === "c") continue;
        const x = worldX(tx * TILE);
        let y = ty * TILE;
        const b = game.blocks.get(blockKey(tx, ty));
        if (b && b.bump > 0) {
          y -= Math.sin((b.bump / 8) * Math.PI) * 8;
        }
        drawTile(ch, x, y, tx, ty);
      }
    }
  }

  function drawTile(ch, x, y, tx, ty) {
    if (ch === "#" || ch === "T") {
      ctx.fillStyle = "#c47a3a";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#8d4a1e";
      ctx.fillRect(x + 2, y + 18, 16, 6);
      ctx.fillRect(x + 22, y + 28, 14, 6);
      if (ch === "T") {
        ctx.fillStyle = "#3d8c40";
        ctx.fillRect(x, y, TILE, 10);
        ctx.fillStyle = "#6ebe4a";
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = "#2d6a4f";
        for (let i = 0; i < 5; i++) ctx.fillRect(x + i * 8 + 2, y + 6, 4, 4);
      } else {
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
      return;
    }
    if (ch === "B" || ch === "D" || ch === "?" || ch === "M" || ch === "*") {
      const used = ch === "D";
      ctx.fillStyle = used ? "#b08968" : (ch === "B" ? "#d0894a" : "#f4c430");
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = used ? "#6b4226" : "#7a4e12";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x + 6, y + 6, 10, 6);
      if (!used && ch !== "B") {
        ctx.fillStyle = "#7a4e12";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("?", x + TILE / 2, y + 28);
        if (ch === "M") {
          ctx.fillStyle = "#e63946";
          ctx.beginPath();
          ctx.arc(x + TILE - 10, y + 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (ch === "*") {
          ctx.fillStyle = "#fff";
          star(x + TILE / 2, y + 12, 4, 5);
        }
      } else if (ch === "B") {
        ctx.fillStyle = "#7a4e12";
        ctx.fillRect(x + 8, y + 10, 8, 8);
        ctx.fillRect(x + 22, y + 10, 8, 8);
        ctx.fillRect(x + 8, y + 24, 8, 8);
        ctx.fillRect(x + 22, y + 24, 8, 8);
      }
      ctx.lineWidth = 1;
      return;
    }
    if (ch === "=") {
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(x, y, TILE, 12);
      ctx.fillStyle = "#d4a373";
      ctx.fillRect(x, y, TILE, 5);
      return;
    }
    if (ch === "P") {
      const above = tileAt(tx, ty - 1) === "P";
      ctx.fillStyle = "#2a9d4a";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#1d6b32";
      ctx.fillRect(x + 4, y, 4, TILE);
      ctx.fillRect(x + TILE - 8, y, 4, TILE);
      if (!above) {
        ctx.fillStyle = "#36c45b";
        ctx.fillRect(x - 4, y, TILE + 8, 14);
        ctx.fillStyle = "#1d6b32";
        ctx.fillRect(x - 4, y, 5, 14);
        ctx.fillRect(x + TILE - 1, y, 5, 14);
      }
      return;
    }
    if (ch === "n") {
      ctx.fillStyle = "#2d6a4f";
      ctx.beginPath();
      ctx.ellipse(x + 20, y + 28, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#40916c";
      ctx.beginPath();
      ctx.ellipse(x + 8, y + 30, 10, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 32, y + 30, 10, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (ch === "h") {
      ctx.fillStyle = "#e63946";
      ctx.fillRect(x + 6, y + 18, 28, 22);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 10, y + 22, 8, 8);
      ctx.fillRect(x + 22, y + 28, 8, 8);
      ctx.fillStyle = "#1d3557";
      ctx.fillRect(x + 18, y + 8, 4, 12);
      return;
    }
    if (ch === "e") {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(x + 18, y - 8 * TILE, 6, 8 * TILE + TILE);
      ctx.fillStyle = "#e63946";
      ctx.beginPath();
      ctx.moveTo(x + 24, y - 8 * TILE + 8);
      ctx.lineTo(x + 24 + 36, y - 8 * TILE + 22);
      ctx.lineTo(x + 24, y - 8 * TILE + 36);
      ctx.fill();
      ctx.fillStyle = "#ffd447";
      ctx.fillRect(x + 14, y - 8 * TILE - 8, 14, 10);
    }
  }

  function star(x, y, r, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rad = i % 2 === 0 ? r : r / 2;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawPlayer() {
    const p = game.player;
    if (p.hurt > 0 && Math.floor(p.hurt / 3) % 2 === 0 && !p.dead) return;
    const x = worldX(p.x);
    const y = p.y;
    const flash = p.star > 0 && Math.floor(game.tick / 4) % 2 === 0;
    const pal = flash
      ? { hat: "#ffd447", shirt: "#fff", pants: "#9b5de5", skin: "#ffe0bd", shoe: "#222" }
      : { hat: "#e63946", shirt: "#e63946", pants: "#1d3557", skin: "#ffcc99", shoe: "#4a2c14" };

    ctx.save();
    ctx.translate(x + p.w / 2, y + p.h);
    ctx.scale(p.dir, 1);
    if (p.dead) ctx.rotate(Math.min(p.deadTimer, 40) * 0.08);

    const h = p.h;
    const walk = p.onGround ? Math.sin(p.walk) : 0;
    const bodyH = h - 20;
    const leg = p.onGround && Math.abs(p.vx) > 0.3;

    ctx.fillStyle = pal.shoe;
    ctx.fillRect(-11, -8 + (leg ? walk * 3 : 0), 10, 8);
    ctx.fillRect(1, -8 + (leg ? -walk * 3 : 0), 10, 8);

    ctx.fillStyle = pal.pants;
    ctx.fillRect(-10, -bodyH, 20, bodyH - 6);

    ctx.fillStyle = pal.shirt;
    ctx.fillRect(-12, -bodyH - 2, 8, 14);
    ctx.fillRect(4, -bodyH - 2, 8, 14);

    ctx.fillStyle = pal.skin;
    ctx.fillRect(-11, -h + 2, 22, 18);
    ctx.fillStyle = "#3d2314";
    ctx.fillRect(p.dir > 0 ? 4 : -10, -h + 8, 6, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, -h + 8, 5, 5);
    ctx.fillStyle = "#222";
    ctx.fillRect(7, -h + 9, 3, 3);
    ctx.fillStyle = pal.hat;
    ctx.fillRect(-13, -h, 26, 8);
    ctx.fillRect(-8, -h - 6, 16, 8);

    ctx.restore();
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const x = worldX(e.x);
      const y = e.y;
      if (x < -60 || x > W + 60) continue;
      if (e.kind === "walker" || (e.kind === "shell" && !e.shell)) {
        if (e.kind === "walker") drawWalker(x, y, e);
        else drawShellBeast(x, y, e);
      } else if (e.kind === "shell" && e.shell) {
        drawShell(x, y, e);
      } else if (e.kind === "spiky") {
        drawSpiky(x, y, e);
      } else if (e.kind === "flyer") {
        drawFlyer(x, y, e);
      } else if (e.kind === "plant") {
        drawPlant(x, y, e);
      }
    }
  }

  function drawWalker(x, y, e) {
    const squash = e.squish > 0;
    ctx.fillStyle = "#8d5524";
    roundRect(x, y + (squash ? 16 : 0), e.w, squash ? 12 : e.h - 6, 10);
    ctx.fill();
    ctx.fillStyle = "#6b3f1a";
    roundRect(x + 2, y + 8, e.w - 4, 12, 6);
    ctx.fill();
    if (!squash) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 6, y + 8, 8, 8);
      ctx.fillRect(x + 18, y + 8, 8, 8);
      ctx.fillStyle = "#111";
      ctx.fillRect(x + 9, y + 10, 4, 4);
      ctx.fillRect(x + 21, y + 10, 4, 4);
      ctx.fillStyle = "#4a2c14";
      ctx.fillRect(x + 2, y + e.h - 8, 10, 8);
      ctx.fillRect(x + 18, y + e.h - 8, 10, 8);
    }
  }

  function drawShellBeast(x, y, e) {
    ctx.fillStyle = "#2a9d4a";
    roundRect(x, y + 6, e.w, e.h - 8, 10);
    ctx.fill();
    ctx.fillStyle = "#ffcc99";
    ctx.fillRect(x + 8, y, 16, 14);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 18, y + 4, 6, 6);
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 21, y + 6, 3, 3);
    ctx.fillStyle = "#1d6b32";
    ctx.fillRect(x + 6, y + 14, 20, 6);
  }

  function drawShell(x, y, e) {
    ctx.fillStyle = "#2a9d4a";
    roundRect(x, y, e.w, e.h, 8);
    ctx.fill();
    ctx.strokeStyle = "#d8f3dc";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 6, e.w - 12, e.h - 12);
    ctx.lineWidth = 1;
  }

  function drawSpiky(x, y, e) {
    ctx.fillStyle = "#7b2cbf";
    roundRect(x, y + 8, e.w, e.h - 8, 8);
    ctx.fill();
    ctx.fillStyle = "#c77dff";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 4 + i * 6, y + 12);
      ctx.lineTo(x + 8 + i * 6, y);
      ctx.lineTo(x + 12 + i * 6, y + 12);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 8, y + 14, 7, 7);
    ctx.fillRect(x + 18, y + 14, 7, 7);
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 11, y + 16, 3, 3);
    ctx.fillRect(x + 21, y + 16, 3, 3);
  }

  function drawFlyer(x, y, e) {
    const flap = Math.sin(e.t * 0.4) * 8;
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 16, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 10 - flap, 12, 6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(x + 30, y + 10 - flap, 12, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e63946";
    ctx.fillRect(x + 10, y + 12, 4, 4);
    ctx.fillRect(x + 18, y + 12, 4, 4);
  }

  function drawPlant(x, y, e) {
    ctx.fillStyle = "#2a9d4a";
    ctx.fillRect(x + 10, y + 18, 8, e.h);
    ctx.fillStyle = "#e63946";
    roundRect(x, y, e.w, 24, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 6 + i * 7, y + 8, 4, 8);
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 6, y + 6, 5, 5);
    ctx.fillRect(x + 16, y + 6, 5, 5);
  }

  function drawItems() {
    for (const it of game.items) {
      if (!it.alive) continue;
      const x = worldX(it.x);
      const y = it.y;
      if (x < -40 || x > W + 40) continue;
      if (it.kind === "coin" || it.pop) drawCoin(x, y, it.t);
      else if (it.kind === "mushroom") drawMushroom(x, y);
      else if (it.kind === "star") drawStarItem(x, y, it.t);
    }
  }

  function drawCoin(x, y, t) {
    const squish = 0.55 + Math.abs(Math.sin(t * 0.25)) * 0.45;
    ctx.save();
    ctx.translate(x + 8, y + 12);
    ctx.scale(squish, 1);
    ctx.fillStyle = "#ffd447";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4a261";
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMushroom(x, y) {
    ctx.fillStyle = "#f1faee";
    ctx.fillRect(x + 8, y + 16, 14, 12);
    ctx.fillStyle = "#e63946";
    ctx.beginPath();
    ctx.ellipse(x + 15, y + 14, 16, 12, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + 8, y + 12, 4, 0, Math.PI * 2);
    ctx.arc(x + 22, y + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.fillRect(x + 10, y + 18, 3, 3);
    ctx.fillRect(x + 18, y + 18, 3, 3);
  }

  function drawStarItem(x, y, t) {
    ctx.save();
    ctx.translate(x + 14, y + 14);
    ctx.rotate(t * 0.1);
    ctx.fillStyle = "#ffd447";
    star(0, 0, 14, 5);
    ctx.fillStyle = "#fff";
    star(0, 0, 7, 5);
    ctx.restore();
  }

  function drawFx() {
    for (const pt of game.particles) {
      ctx.globalAlpha = pt.life / pt.max;
      ctx.fillStyle = pt.color;
      ctx.fillRect(worldX(pt.x), pt.y, pt.s, pt.s);
    }
    ctx.globalAlpha = 1;
    ctx.font = "10px 'Press Start 2P', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    for (const t of game.popups) {
      ctx.globalAlpha = 1 - t.t / 40;
      ctx.fillText(t.text, worldX(t.x), t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    ctx.fillStyle = "rgba(10,16,32,0.35)";
    ctx.fillRect(0, 0, W, 42);
    ctx.font = "11px 'Press Start 2P', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText("СЧЁТ", 16, 18);
    ctx.fillStyle = "#ffd447";
    ctx.fillText(String(game.score).padStart(6, "0"), 16, 36);
    ctx.fillStyle = "#fff";
    ctx.fillText("МОНЕТЫ", 210, 18);
    ctx.fillStyle = "#ffd447";
    ctx.fillText("x" + String(game.coins).padStart(2, "0"), 210, 36);
    ctx.fillStyle = "#fff";
    ctx.fillText("ЖИЗНИ", 400, 18);
    ctx.fillStyle = "#e63946";
    ctx.fillText("♥ " + Math.max(0, game.lives), 400, 36);
    ctx.fillStyle = "#fff";
    ctx.fillText("ВРЕМЯ", 560, 18);
    ctx.fillStyle = game.time < 30 ? "#e63946" : "#fff";
    ctx.fillText(String(Math.ceil(game.time)).padStart(3, "0"), 560, 36);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.fillText("МИР 1-1", W - 16, 28);
  }

  function drawOverlay(title, sub) {
    ctx.fillStyle = "rgba(8,12,24,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd447";
    ctx.font = "22px 'Press Start 2P', sans-serif";
    ctx.fillText(title, W / 2, H / 2 - 20);
    ctx.fillStyle = "#fff";
    ctx.font = "10px 'Press Start 2P', sans-serif";
    ctx.fillText(sub, W / 2, H / 2 + 20);
  }

  function drawTitle() {
    drawSky();
    game.camX = 40;
    if (!game.map.length) buildLevel();
    drawMap();
    const bob = Math.sin(game.titleBob * 0.08) * 6;
    const prev = game.player;
    game.player = {
      x: 180, y: 280 + bob, w: 26, h: 36, dir: 1, onGround: true,
      vx: 1, walk: game.titleBob * 0.2, hurt: 0, star: 0, dead: false, deadTimer: 0,
    };
    drawPlayer();
    game.player = prev;
    drawCoin(520, 210 + Math.sin(game.titleBob * 0.12) * 8, game.titleBob);
    drawMushroom(580, 300);
    drawWalker(700, 12 * TILE - 32, { w: 32, h: 32, squish: 0, t: game.titleBob });

    ctx.textAlign = "center";
    ctx.fillStyle = "#e63946";
    ctx.font = "28px 'Press Start 2P', sans-serif";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.strokeText("СУПЕР ЧЕЛОВЕЧЕК", W / 2, 120);
    ctx.fillText("СУПЕР ЧЕЛОВЕЧЕК", W / 2, 120);
    ctx.lineWidth = 1;
    ctx.fillStyle = "#1d3557";
    ctx.font = "10px 'Press Start 2P', sans-serif";
    ctx.fillText("Бей блоки головой — собирай монеты и грибы", W / 2, 160);
    ctx.fillStyle = Math.sin(game.titleBob * 0.15) > 0 ? "#fff" : "#ffd447";
    ctx.fillText(isTouchDevice ? "НАЖМИ «ПРЫЖОК» ИЛИ ЭКРАН" : "НАЖМИ ENTER ИЛИ ПРОБЕЛ", W / 2, 430);
    ctx.fillStyle = "#1d3557";
    ctx.font = "8px 'Press Start 2P', sans-serif";
    ctx.fillText("Прыгай сверху на злодеев   •   Колючих обходи", W / 2, 460);
  }

  function updatePlay(dt) {
    if (justPressed.Escape || justPressed.KeyP) {
      game.state = STATE.PAUSE;
      return;
    }
    game.time -= dt;
    if (game.time <= 0) {
      game.time = 0;
      killPlayer();
    }
    updatePlayer(dt);
    updateEnemies(dt);
    updateItems(dt);
    updateFx(dt);
    updateCamera();
  }

  function drawPlay() {
    drawSky();
    drawMap();
    drawItems();
    drawEnemies();
    drawPlayer();
    drawFx();
    drawHud();
  }

  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    game.tick++;
    game.titleBob++;

    if (game.state === STATE.TITLE && (justPressed.Enter || justPressed.ArrowUp)) startGame();

    if (game.state === STATE.TITLE) {
      drawTitle();
    } else if (game.state === STATE.PLAY) {
      updatePlay(dt);
      drawPlay();
    } else if (game.state === STATE.PAUSE) {
      drawPlay();
      drawOverlay("ПАУЗА", CONFIRM + " — продолжить");
      if (justPressed.Enter || justPressed.Escape || justPressed.KeyP) game.state = STATE.PLAY;
    } else if (game.state === STATE.WIN) {
      drawPlay();
      drawOverlay("УРОВЕНЬ ПРОЙДЕН!", "Счёт " + game.score + "   " + CONFIRM + " — ещё раз");
      if (justPressed.Enter || justPressed.ArrowUp) startGame();
    } else if (game.state === STATE.OVER) {
      drawSky();
      drawOverlay("ИГРА ОКОНЧЕНА", CONFIRM + " — начать заново");
      if (justPressed.Enter || justPressed.ArrowUp) startGame();
    }

    for (const k of Object.keys(justPressed)) justPressed[k] = false;
    requestAnimationFrame(loop);
  }

  function startGame() {
    ensureAudio();
    game.score = 0;
    game.coins = 0;
    game.lives = 3;
    game.checkpoint = 3 * TILE;
    spawnWorld(false);
    game.state = STATE.PLAY;
  }

  requestAnimationFrame(loop);
})();
