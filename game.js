(() => {
  "use strict";

  // Dimensiones clásicas del laberinto Pac-Man: 28 x 31
  const COLS = 28;
  const ROWS = 31;
  const TILE = 20;
  const CANVAS_W = COLS * TILE; // 560
  const CANVAS_H = ROWS * TILE; // 620

  const HIGH_SCORE_KEY = "pacman_vanilla_high_score_v1";
  const SETTINGS_KEY = "pacman_vanilla_settings_v1";

  // Ajustes por defecto
  const DEFAULT_SETTINGS = {
    difficulty: "normal", // easy | normal | hard
    speed: "normal",      // slow | normal | fast
    startingLives: 3,     // 1 | 3 | 5
    theme: "classic",     // classic | cyber | neon
    volume: 70,           // 0..100
    crt: true,
    mobileMode: null,     // null => autodetección inicial; true/false => preferencia explícita
  };

  const DIFFICULTY_PRESETS = {
    easy: { ghostSpeedMul: 0.85, frightenedMul: 1.35, releaseMul: 1.35 },
    normal: { ghostSpeedMul: 1.0, frightenedMul: 1.0, releaseMul: 1.0 },
    hard: { ghostSpeedMul: 1.14, frightenedMul: 0.72, releaseMul: 0.6 },
  };

  const SPEED_MULTIPLIERS = {
    slow: 0.85,
    normal: 1.0,
    fast: 1.2,
  };

  const MAZE_THEMES = {
    classic: { stroke: "#2b59ff", fill: "#07102e", glow: "#1d4ed8", door: "#ff9ce3" },
    cyber: { stroke: "#00e5ff", fill: "#041c2c", glow: "#0891b2", door: "#ffd166" },
    neon: { stroke: "#c026d3", fill: "#1d072b", glow: "#9333ea", door: "#67e8f9" },
  };

  // Mapa exacto 28x31 (240 puntos pequeños + 4 píldoras de poder = 244)
  // '#' pared | '.' punto | 'o' píldora poder | '-' puerta casa fantasmas
  // '=' interior casa fantasmas | ' ' pasillo vacío | 'X' vacío exterior
  const MAZE_TEMPLATE = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "XXXXX#.##### ## #####.#XXXXX",
    "XXXXX#.##          ##.#XXXXX",
    "XXXXX#.## ###--### ##.#XXXXX",
    "######.## #======# ##.######",
    "      .   #======#   .      ",
    "######.## #======# ##.######",
    "XXXXX#.## ######## ##.#XXXXX",
    "XXXXX#.##          ##.#XXXXX",
    "XXXXX#.## ######## ##.#XXXXX",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#.####.#####.##.#####.####.#",
    "#o..##.......  .......##..o#",
    "###.##.##.########.##.##.###",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################",
  ];

  // Direcciones (orden de desempate clásico de fantasmas: UP, LEFT, DOWN, RIGHT)
  const DIR = {
    NONE: { name: "NONE", x: 0, y: 0 },
    UP: { name: "UP", x: 0, y: -1 },
    LEFT: { name: "LEFT", x: -1, y: 0 },
    DOWN: { name: "DOWN", x: 0, y: 1 },
    RIGHT: { name: "RIGHT", x: 1, y: 0 },
  };
  const GHOST_DIR_ORDER = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT];

  // Casillas especiales donde los fantasmas no pueden girar hacia arriba en Scatter/Chase
  const NO_UP_TILES = new Set(["12,11", "15,11", "12,23", "15,23"]);

  // Definición de frutas por nivel
  const FRUITS = [
    { name: "Cereza", points: 100, color: "#ff2d55", type: "cherry" },
    { name: "Fresa", points: 300, color: "#ff477e", type: "strawberry" },
    { name: "Naranja", points: 500, color: "#ff9f1c", type: "orange" },
    { name: "Manzana", points: 700, color: "#ff3b30", type: "apple" },
    { name: "Melón", points: 1000, color: "#34d399", type: "melon" },
    { name: "Estrella", points: 2000, color: "#38bdf8", type: "star" },
    { name: "Campana", points: 3000, color: "#facc15", type: "bell" },
    { name: "Llave", points: 5000, color: "#67e8f9", type: "key" },
  ];

  // Referencias DOM
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const stageWrapper = document.getElementById("stage-wrapper");
  const cabinetBezel = document.getElementById("cabinet-bezel");
  const crtScanlines = document.getElementById("crt-scanlines");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const levelEl = document.getElementById("level");
  const livesDisplay = document.getElementById("lives-display");
  const fruitDisplay = document.getElementById("fruit-display");

  const overlayEl = document.getElementById("overlay");
  const viewMainEl = document.getElementById("view-main");
  const viewSettingsEl = document.getElementById("view-settings");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySubtitle = document.getElementById("overlay-subtitle");
  const overlayExtra = document.getElementById("overlay-extra");
  const overlayHint = document.getElementById("overlay-hint");

  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const overlaySettingsBtn = document.getElementById("overlay-settings-btn");
  const overlayMobileBtn = document.getElementById("overlay-mobile-btn");
  const overlayHomeBtn = document.getElementById("overlay-home-btn");

  const menuBtn = document.getElementById("menu-btn");
  const homeBtn = document.getElementById("home-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const mobileBtn = document.getElementById("mobile-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const muteBtn = document.getElementById("mute-btn");

  const settingsCloseBtn = document.getElementById("settings-close-btn");
  const settingsBackBtn = document.getElementById("settings-back-btn");
  const resetSettingsBtn = document.getElementById("reset-settings-btn");
  const resetHighscoreBtn = document.getElementById("reset-highscore-btn");
  const settingVolumeInput = document.getElementById("setting-volume");
  const settingVolumeVal = document.getElementById("setting-volume-val");
  const settingCrtInput = document.getElementById("setting-crt");
  const settingMobileInput = document.getElementById("setting-mobile");

  const dpadEl = document.getElementById("dpad");
  const mobileFullscreenBtn = document.getElementById("mobile-fullscreen-btn");
  const mobileExitBtn = document.getElementById("mobile-exit-btn");

  const audio = new window.PacmanAudio();

  // Escala nítida en pantallas HiDPI
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Caché de laberintos prerrenderizados por tema
  const mazeThemeCache = {};
  const mazeCanvasFlash = createMazeCanvas("#e6f0ff", "#1c2a54", "#93c5fd", "#ffffff");

  function getMazeCanvasForTheme(themeKey) {
    const key = MAZE_THEMES[themeKey] ? themeKey : "classic";
    if (!mazeThemeCache[key]) {
      const t = MAZE_THEMES[key];
      mazeThemeCache[key] = createMazeCanvas(t.stroke, t.fill, t.glow, t.door);
    }
    return mazeThemeCache[key];
  }

  function isWallTile(c, r) {
    if (r < 0 || r >= ROWS) return false;
    if (c < 0 || c >= COLS) {
      // Continuar las paredes superior e inferior del túnel fuera del borde
      return r === 13 || r === 15;
    }
    return MAZE_TEMPLATE[r][c] === "#";
  }

  function createMazeCanvas(strokeColor, fillColor, glowColor, doorColor = "#ff9ce3") {
    const off = document.createElement("canvas");
    off.width = CANVAS_W * dpr;
    off.height = CANVAS_H * dpr;
    const octx = off.getContext("2d");
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Pasada 0: resplandor neón suave
    octx.save();
    octx.shadowColor = glowColor;
    octx.shadowBlur = 10;
    drawWallPass(octx, 3, strokeColor);
    octx.restore();

    // Pasada 1: contorno exterior redondeado
    drawWallPass(octx, 3, strokeColor);

    // Pasada 2: interior oscuro concéntrico (crea líneas dobles uniformes de 3px)
    drawWallPass(octx, 6, fillColor);

    // Puerta de la casa de fantasmas (fila 12, columnas 13-14)
    octx.save();
    octx.fillStyle = doorColor;
    octx.shadowColor = doorColor;
    octx.shadowBlur = 6;
    octx.fillRect(13 * TILE - 3, 12 * TILE + 8, TILE * 2 + 6, 4);
    octx.restore();

    return off;
  }

  function drawWallPass(targetCtx, margin, color) {
    const half = TILE / 2;
    targetCtx.fillStyle = color;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!isWallTile(c, r)) continue;
        const x = c * TILE;
        const y = r * TILE;

        const t = isWallTile(c, r - 1);
        const b = isWallTile(c, r + 1);
        const l = isWallTile(c - 1, r);
        const ri = isWallTile(c + 1, r);
        const tl = isWallTile(c - 1, r - 1);
        const tr = isWallTile(c + 1, r - 1);
        const bl = isWallTile(c - 1, r + 1);
        const br = isWallTile(c + 1, r + 1);

        drawWallQuadrant(targetCtx, x, y, half, margin, t, l, tl, 1, 1);
        drawWallQuadrant(targetCtx, x + TILE, y, half, margin, t, ri, tr, -1, 1);
        drawWallQuadrant(targetCtx, x, y + TILE, half, margin, b, l, bl, 1, -1);
        drawWallQuadrant(targetCtx, x + TILE, y + TILE, half, margin, b, ri, br, -1, -1);
      }
    }
  }

  function drawWallQuadrant(targetCtx, ox, oy, half, m, vert, horiz, diag, sx, sy) {
    targetCtx.save();
    targetCtx.translate(ox, oy);
    targetCtx.scale(sx, sy);

    if (vert && horiz && diag) {
      targetCtx.fillRect(0, 0, half + 0.3, half + 0.3);
    } else if (vert && horiz && !diag) {
      targetCtx.beginPath();
      targetCtx.moveTo(m, 0);
      targetCtx.lineTo(half + 0.3, 0);
      targetCtx.lineTo(half + 0.3, half + 0.3);
      targetCtx.lineTo(0, half + 0.3);
      targetCtx.lineTo(0, m);
      targetCtx.arc(0, 0, m, Math.PI / 2, 0, true);
      targetCtx.closePath();
      targetCtx.fill();
    } else if (vert && !horiz) {
      targetCtx.fillRect(m, 0, half - m + 0.3, half + 0.3);
    } else if (!vert && horiz) {
      targetCtx.fillRect(0, m, half + 0.3, half - m + 0.3);
    } else {
      const radius = half - m;
      targetCtx.beginPath();
      targetCtx.moveTo(half + 0.3, m);
      targetCtx.lineTo(half + 0.3, half + 0.3);
      targetCtx.lineTo(m, half + 0.3);
      targetCtx.arc(half, half, radius, Math.PI, Math.PI * 1.5, false);
      targetCtx.closePath();
      targetCtx.fill();
    }

    targetCtx.restore();
  }

  // Persistencia de configuración y récord
  function detectTouchDevice() {
    try {
      const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      const small = window.innerWidth <= 640;
      return Boolean(coarse || small);
    } catch {
      return false;
    }
  }

  function loadSettings() {
    let parsed = {};
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) parsed = JSON.parse(raw) || {};
    } catch {
      parsed = {};
    }

    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!DIFFICULTY_PRESETS[merged.difficulty]) merged.difficulty = "normal";
    if (!SPEED_MULTIPLIERS[merged.speed]) merged.speed = "normal";
    if (![1, 3, 5].includes(Number(merged.startingLives))) merged.startingLives = 3;
    merged.startingLives = Number(merged.startingLives);
    if (!MAZE_THEMES[merged.theme]) merged.theme = "classic";
    merged.volume = Math.max(0, Math.min(100, Number.isFinite(Number(merged.volume)) ? Number(merged.volume) : 70));
    merged.crt = Boolean(merged.crt);
    if (merged.mobileMode === null || merged.mobileMode === undefined) {
      merged.mobileMode = detectTouchDevice();
    } else {
      merged.mobileMode = Boolean(merged.mobileMode);
    }
    return merged;
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  function loadHighScore() {
    try {
      const saved = Number(localStorage.getItem(HIGH_SCORE_KEY));
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore(val) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(val));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  const settings = loadSettings();

  // Estado global del juego
  const state = {
    mode: "TITLE", // TITLE | READY | PLAYING | EAT_FREEZE | DYING | LEVEL_CLEAR | PAUSED | GAME_OVER
    pausedFromMode: null,
    overlayView: "MAIN", // MAIN | SETTINGS
    score: 0,
    highScore: loadHighScore(),
    level: 1,
    lives: settings.startingLives,
    extraLifeAwarded: false,
    grid: [],
    pelletsRemaining: 0,
    pelletsEaten: 0,
    stateTimer: 0,
    globalTime: 0,
    waveIndex: 0,
    waveTimer: 0,
    frightenedTimer: 0,
    frightenedDuration: 6,
    ghostCombo: 0,
    pelletInactivityTimer: 0,
    fruit: {
      active: false,
      timer: 0,
      spawnCount: 0,
      x: 13.5,
      y: 17,
    },
    popups: [],
    particles: [],
    pacman: null,
    ghosts: [],
    eatFreezeGhost: null,
    confirmResetHighScore: false,
  };

  // Adaptación exacta del tablero al espacio visible (escritorio y móvil)
  function fitStageToScreen() {
    if (!stageWrapper || !cabinetBezel) return;
    const availW = stageWrapper.clientWidth;
    const availH = stageWrapper.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    const ratio = CANVAS_W / CANVAS_H; // 28 / 31
    let targetW = availW;
    let targetH = targetW / ratio;

    if (targetH > availH) {
      targetH = availH;
      targetW = targetH * ratio;
    }

    cabinetBezel.style.width = `${Math.floor(targetW)}px`;
    cabinetBezel.style.height = `${Math.floor(targetH)}px`;
  }

  function applySettingsToUI() {
    // Volumen y sonido
    audio.setVolume(settings.volume / 100);
    if (settingVolumeInput) settingVolumeInput.value = String(settings.volume);
    if (settingVolumeVal) settingVolumeVal.textContent = `${settings.volume}%`;
    if (muteBtn) {
      muteBtn.classList.toggle("muted", audio.muted || settings.volume === 0);
    }

    // Efecto CRT
    if (crtScanlines) crtScanlines.classList.toggle("off", !settings.crt);
    if (settingCrtInput) settingCrtInput.checked = settings.crt;

    // Tema visual del bisel
    document.body.classList.remove("theme-classic", "theme-cyber", "theme-neon");
    document.body.classList.add(`theme-${settings.theme}`);

    // Modo móvil
    document.body.classList.toggle("mobile-mode", settings.mobileMode);
    if (settingMobileInput) settingMobileInput.checked = settings.mobileMode;
    if (mobileBtn) {
      mobileBtn.classList.toggle("active", settings.mobileMode);
      mobileBtn.setAttribute("aria-pressed", String(settings.mobileMode));
    }
    if (overlayMobileBtn) {
      overlayMobileBtn.classList.toggle("active", settings.mobileMode);
      overlayMobileBtn.textContent = settings.mobileMode ? "📱 MÓVIL: ON" : "📱 JUGAR EN MÓVIL";
    }

    // Botones segmentados de ajustes
    document.querySelectorAll(".segmented[data-setting]").forEach((group) => {
      const key = group.dataset.setting;
      const currentVal = String(settings[key]);
      group.querySelectorAll(".seg-btn").forEach((btn) => {
        const isActive = btn.dataset.value === currentVal;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-checked", String(isActive));
      });
    });

    // Recalcular tamaño del tablero tras cambiar el layout
    requestAnimationFrame(fitStageToScreen);
  }

  function toggleMobileMode(forceValue = null) {
    settings.mobileMode = forceValue === null ? !settings.mobileMode : Boolean(forceValue);
    saveSettings();
    applySettingsToUI();
    audio.playUiClick();
  }

  function getLevelFruit(level) {
    const idx = Math.min(FRUITS.length - 1, Math.floor((level - 1) === 0 ? 0 : level === 2 ? 1 : (level + 1) / 2));
    return FRUITS[idx];
  }

  function getWaveSchedule(level) {
    if (level === 1) {
      return [
        { mode: "SCATTER", dur: 7 },
        { mode: "CHASE", dur: 20 },
        { mode: "SCATTER", dur: 7 },
        { mode: "CHASE", dur: 20 },
        { mode: "SCATTER", dur: 5 },
        { mode: "CHASE", dur: 20 },
        { mode: "SCATTER", dur: 5 },
        { mode: "CHASE", dur: Infinity },
      ];
    }
    return [
      { mode: "SCATTER", dur: 5 },
      { mode: "CHASE", dur: 20 },
      { mode: "SCATTER", dur: 5 },
      { mode: "CHASE", dur: 20 },
      { mode: "SCATTER", dur: 4 },
      { mode: "CHASE", dur: 25 },
      { mode: "SCATTER", dur: 3 },
      { mode: "CHASE", dur: Infinity },
    ];
  }

  function getCurrentWaveMode() {
    const schedule = getWaveSchedule(state.level);
    return schedule[Math.min(state.waveIndex, schedule.length - 1)].mode;
  }

  function getFrightenedDuration(level) {
    const table = [6.5, 5.5, 4.5, 3.5, 2.8, 2.2, 1.8];
    const preset = DIFFICULTY_PRESETS[settings.difficulty] || DIFFICULTY_PRESETS.normal;
    return Math.max(1.2, table[Math.min(level - 1, table.length - 1)] * preset.frightenedMul);
  }

  function getSpeedMultiplier() {
    return SPEED_MULTIPLIERS[settings.speed] || 1.0;
  }

  function getPacSpeed() {
    const base = Math.min(9.4, 7.6 + (state.level - 1) * 0.28);
    return base * getSpeedMultiplier();
  }

  function getGhostBaseSpeed(ghost) {
    const preset = DIFFICULTY_PRESETS[settings.difficulty] || DIFFICULTY_PRESETS.normal;
    let base = Math.min(8.8, 7.0 + (state.level - 1) * 0.28) * preset.ghostSpeedMul * getSpeedMultiplier();
    // Cruise Elroy para Blinky cuando quedan pocos puntos
    if (ghost.id === "blinky" && ghost.mode === "NORMAL") {
      if (state.pelletsRemaining <= 10) base *= 1.1;
      else if (state.pelletsRemaining <= 20) base *= 1.05;
    }
    return base;
  }

  function resetMazeGrid() {
    state.grid = MAZE_TEMPLATE.map((row) => row.split(""));
    state.pelletsRemaining = 0;
    state.pelletsEaten = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.grid[r][c] === "." || state.grid[r][c] === "o") {
          state.pelletsRemaining++;
        }
      }
    }
    state.fruit.active = false;
    state.fruit.timer = 0;
    state.fruit.spawnCount = 0;
  }

  function resetActors() {
    state.pacman = {
      x: 13.5,
      y: 23,
      dir: DIR.LEFT,
      nextDir: DIR.LEFT,
      facing: DIR.LEFT,
      mouthPhase: 0,
      eatPause: 0,
      deathProgress: 0,
    };

    const preset = DIFFICULTY_PRESETS[settings.difficulty] || DIFFICULTY_PRESETS.normal;
    const baseInky = state.level === 1 ? 28 : state.level === 2 ? 12 : 0;
    const baseClyde = state.level === 1 ? 60 : state.level === 2 ? 32 : 12;
    const inkyThreshold = Math.round(baseInky * preset.releaseMul);
    const clydeThreshold = Math.round(baseClyde * preset.releaseMul);

    state.ghosts = [
      {
        id: "blinky",
        name: "Blinky",
        color: "#ff2a2a",
        x: 13.5,
        y: 11,
        dir: DIR.LEFT,
        mode: "NORMAL", // IN_HOUSE | EXITING | NORMAL | FRIGHTENED | EATEN | ENTERING
        scatterTarget: { x: 25, y: -2 },
        releaseDots: 0,
        releaseDelay: 0,
        bobPhase: 0,
        homeX: 13.5,
        homeY: 14,
        frightenedSafe: false,
      },
      {
        id: "pinky",
        name: "Pinky",
        color: "#ffb8ff",
        x: 13.5,
        y: 14,
        dir: DIR.UP,
        mode: "EXITING",
        scatterTarget: { x: 2, y: -2 },
        releaseDots: 0,
        releaseDelay: 0,
        bobPhase: 1.2,
        homeX: 13.5,
        homeY: 14,
        frightenedSafe: false,
      },
      {
        id: "inky",
        name: "Inky",
        color: "#00f0ff",
        x: 11.5,
        y: 14,
        dir: DIR.UP,
        mode: "IN_HOUSE",
        scatterTarget: { x: 27, y: 31 },
        releaseDots: inkyThreshold,
        releaseDelay: 5 * preset.releaseMul,
        bobPhase: 2.4,
        homeX: 11.5,
        homeY: 14,
        frightenedSafe: false,
      },
      {
        id: "clyde",
        name: "Clyde",
        color: "#ffb852",
        x: 15.5,
        y: 14,
        dir: DIR.UP,
        mode: "IN_HOUSE",
        scatterTarget: { x: 0, y: 31 },
        releaseDots: clydeThreshold,
        releaseDelay: 10 * preset.releaseMul,
        bobPhase: 3.6,
        homeX: 15.5,
        homeY: 14,
        frightenedSafe: false,
      },
    ];

    state.frightenedTimer = 0;
    state.ghostCombo = 0;
    state.pelletInactivityTimer = 0;
    state.eatFreezeGhost = null;
    state.waveIndex = 0;
    state.waveTimer = 0;
  }

  // Navegación del menú interactivo y vistas superpuestas
  function renderMainOverlayForMode() {
    state.overlayView = "MAIN";
    viewMainEl.classList.remove("hidden");
    viewSettingsEl.classList.add("hidden");
    overlayEl.classList.remove("hidden");

    if (state.mode === "TITLE") {
      overlayKicker.textContent = "EDICIÓN ARCADE";
      overlayTitle.textContent = "PAC-MAN";
      overlaySubtitle.textContent = "Come todos los puntos del laberinto y evita a los fantasmas.";
      overlayExtra.classList.remove("hidden");
      startBtn.textContent = "JUGAR";
      restartBtn.classList.add("hidden");
      overlayHomeBtn.classList.add("hidden");
      overlayHint.textContent = settings.mobileMode
        ? "Usa el D-Pad o desliza sobre el tablero para moverte"
        : "Flechas o WASD · P / Espacio pausa · Esc menú · M sonido";
    } else if (state.mode === "PAUSED") {
      overlayKicker.textContent = "MENÚ DE PARTIDA";
      overlayTitle.textContent = "PAUSA";
      overlaySubtitle.textContent = `Nivel ${state.level} · Puntuación: ${state.score.toLocaleString("es-ES")}`;
      overlayExtra.classList.add("hidden");
      startBtn.textContent = "CONTINUAR";
      restartBtn.classList.remove("hidden");
      overlayHomeBtn.classList.remove("hidden");
      overlayHint.textContent = "Pulsa P, Espacio o Esc para continuar";
    } else if (state.mode === "GAME_OVER") {
      overlayKicker.textContent = "FIN DE LA PARTIDA";
      overlayTitle.textContent = "GAME OVER";
      overlaySubtitle.textContent = `Puntuación final: ${state.score.toLocaleString("es-ES")} · Nivel alcanzado: ${state.level}`;
      overlayExtra.classList.add("hidden");
      startBtn.textContent = "JUGAR DE NUEVO";
      restartBtn.classList.add("hidden");
      overlayHomeBtn.classList.remove("hidden");
      overlayHint.textContent = "Pulsa Enter para volver a intentarlo";
    }
  }

  function hideOverlay() {
    overlayEl.classList.add("hidden");
    state.overlayView = "MAIN";
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
  }

  function isActivePlayMode(mode) {
    return mode === "PLAYING" || mode === "READY" || mode === "EAT_FREEZE";
  }

  function openMenu() {
    audio.ensureContext();
    audio.playUiClick();

    if (state.mode === "TITLE" || state.mode === "GAME_OVER") {
      renderMainOverlayForMode();
      return;
    }

    if (isActivePlayMode(state.mode)) {
      state.pausedFromMode = state.mode;
      state.mode = "PAUSED";
    }
    renderMainOverlayForMode();
  }

  function openSettings() {
    audio.ensureContext();
    audio.playUiClick();

    if (isActivePlayMode(state.mode)) {
      state.pausedFromMode = state.mode;
      state.mode = "PAUSED";
    }

    state.confirmResetHighScore = false;
    resetHighscoreBtn.textContent = "Borrar récord";
    state.overlayView = "SETTINGS";
    viewMainEl.classList.add("hidden");
    viewSettingsEl.classList.remove("hidden");
    overlayEl.classList.remove("hidden");
  }

  function closeSettings() {
    audio.playUiClick();
    state.confirmResetHighScore = false;
    resetHighscoreBtn.textContent = "Borrar récord";
    renderMainOverlayForMode();
  }

  function goToHomeScreen() {
    audio.ensureContext();
    audio.playUiClick();
    state.mode = "TITLE";
    state.pausedFromMode = null;
    state.score = 0;
    state.level = 1;
    state.lives = settings.startingLives;
    state.extraLifeAwarded = false;
    state.popups = [];
    state.particles = [];
    resetMazeGrid();
    resetActors();
    updateHUD();
    renderMainOverlayForMode();
  }

  function resumeGame() {
    if (state.mode !== "PAUSED") return;
    audio.playUiClick();
    hideOverlay();
    state.mode = state.pausedFromMode || "PLAYING";
    state.pausedFromMode = null;
  }

  function togglePause() {
    if (state.overlayView === "SETTINGS") {
      closeSettings();
      return;
    }

    if (isActivePlayMode(state.mode)) {
      state.pausedFromMode = state.mode;
      state.mode = "PAUSED";
      renderMainOverlayForMode();
    } else if (state.mode === "PAUSED") {
      resumeGame();
    }
  }

  function startNewGame() {
    audio.ensureContext();
    state.score = 0;
    state.level = 1;
    state.lives = settings.startingLives;
    state.extraLifeAwarded = false;
    state.pausedFromMode = null;
    state.popups = [];
    state.particles = [];
    resetMazeGrid();
    resetActors();
    hideOverlay();
    state.mode = "READY";
    state.stateTimer = 2.25;
    audio.playStartJingle();
    updateHUD();
  }

  function startNextLevel() {
    state.level++;
    state.popups = [];
    state.particles = [];
    resetMazeGrid();
    resetActors();
    state.mode = "READY";
    state.stateTimer = 1.65;
    updateHUD();
  }

  function addScore(points, popupX = null, popupY = null, popupColor = "#67e8f9", label = null) {
    state.score += points;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveHighScore(state.highScore);
    }

    if (!state.extraLifeAwarded && state.score >= 10000) {
      state.extraLifeAwarded = true;
      state.lives++;
      audio.playExtraLife();
      state.popups.push({
        text: "1UP!",
        x: state.pacman.x,
        y: state.pacman.y - 1.2,
        color: "#ffd800",
        timer: 1.4,
        maxTimer: 1.4,
      });
    }

    if (popupX !== null && popupY !== null) {
      state.popups.push({
        text: label || String(points),
        x: popupX,
        y: popupY,
        color: popupColor,
        timer: 0.95,
        maxTimer: 0.95,
      });
    }

    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = state.score.toLocaleString("es-ES");
    highScoreEl.textContent = state.highScore.toLocaleString("es-ES");
    levelEl.textContent = String(state.level);

    livesDisplay.innerHTML = "";
    const shownLives = Math.max(0, Math.min(state.lives - 1, 6));
    for (let i = 0; i < shownLives; i++) {
      const span = document.createElement("span");
      span.className = "life-icon";
      span.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 12 L21.5 6.5 A11 11 0 1 0 21.5 17.5 Z" fill="#ffd800"/></svg>`;
      livesDisplay.appendChild(span);
    }
    if (shownLives === 0) {
      const empty = document.createElement("span");
      empty.style.fontSize = "0.7rem";
      empty.style.color = "#8b99c4";
      empty.textContent = "ÚLTIMA";
      livesDisplay.appendChild(empty);
    }

    const fruit = getLevelFruit(state.level);
    fruitDisplay.innerHTML = `<span class="fruit-badge"><span class="fruit-dot" style="background:${fruit.color};box-shadow:0 0 6px ${fruit.color}"></span>${fruit.name} (${fruit.points})</span>`;
  }

  // Consultas de colisión del mapa
  function wrapCol(c) {
    return ((c % COLS) + COLS) % COLS;
  }

  function getTile(c, r) {
    if (r < 0 || r >= ROWS) return "#";
    if (c < 0 || c >= COLS) {
      return r === 14 ? " " : "#";
    }
    return state.grid[r][c];
  }

  function isWalkableForPac(c, r) {
    const t = getTile(c, r);
    return t !== "#" && t !== "X" && t !== "-" && t !== "=";
  }

  function isWalkableForGhost(c, r, allowHouseDoor) {
    const t = getTile(c, r);
    if (t === "#" || t === "X") return false;
    if (t === "-" || t === "=") return allowHouseDoor;
    return true;
  }

  function isOpposite(d1, d2) {
    return d1.x === -d2.x && d1.y === -d2.y && (d1.x !== 0 || d1.y !== 0);
  }

  // Movimiento de Pac-Man con giro suave (cornering auténtico)
  function updatePacman(dt) {
    const p = state.pacman;

    if (p.eatPause > 0) {
      p.eatPause = Math.max(0, p.eatPause - dt);
      return;
    }

    const speed = getPacSpeed();
    const step = speed * dt;

    if (p.nextDir !== DIR.NONE && isOpposite(p.nextDir, p.dir)) {
      p.dir = p.nextDir;
      p.facing = p.nextDir;
    }

    let cx = wrapCol(Math.round(p.x));
    let cy = Math.round(p.y);

    if (p.nextDir !== DIR.NONE && p.nextDir !== p.dir) {
      const distX = Math.abs(p.x - Math.round(p.x));
      const distY = Math.abs(p.y - cy);
      const canTurn = isWalkableForPac(cx + p.nextDir.x, cy + p.nextDir.y);

      if (canTurn) {
        if (p.dir === DIR.NONE) {
          p.x = Math.round(p.x);
          p.y = cy;
          p.dir = p.nextDir;
          p.facing = p.nextDir;
        } else if (p.nextDir.x !== 0 && distY <= 0.34) {
          p.dir = p.nextDir;
          p.facing = p.nextDir;
        } else if (p.nextDir.y !== 0 && distX <= 0.34) {
          p.dir = p.nextDir;
          p.facing = p.nextDir;
        }
      }
    }

    let moved = false;

    if (p.dir !== DIR.NONE) {
      if (p.dir.x !== 0) {
        const targetY = Math.round(p.y);
        const diffY = targetY - p.y;
        const alignStep = step * 1.45;
        if (Math.abs(diffY) <= alignStep) {
          p.y = targetY;
        } else {
          p.y += Math.sign(diffY) * alignStep;
        }
      } else if (p.dir.y !== 0) {
        const targetX = Math.round(p.x);
        const diffX = targetX - p.x;
        const alignStep = step * 1.45;
        if (Math.abs(diffX) <= alignStep) {
          p.x = targetX;
        } else {
          p.x += Math.sign(diffX) * alignStep;
        }
      }

      const nextX = p.x + p.dir.x * step;
      const nextY = p.y + p.dir.y * step;

      const curCenterX = Math.round(p.x);
      const curCenterY = Math.round(p.y);
      const aheadWalkable = isWalkableForPac(wrapCol(curCenterX) + p.dir.x, curCenterY + p.dir.y);

      if (p.dir.x > 0) {
        if (!aheadWalkable && nextX >= curCenterX) {
          p.x = curCenterX;
          p.y = curCenterY;
          p.dir = DIR.NONE;
        } else {
          p.x = nextX;
          moved = true;
        }
      } else if (p.dir.x < 0) {
        if (!aheadWalkable && nextX <= curCenterX) {
          p.x = curCenterX;
          p.y = curCenterY;
          p.dir = DIR.NONE;
        } else {
          p.x = nextX;
          moved = true;
        }
      } else if (p.dir.y > 0) {
        if (!aheadWalkable && nextY >= curCenterY) {
          p.x = curCenterX;
          p.y = curCenterY;
          p.dir = DIR.NONE;
        } else {
          p.y = nextY;
          moved = true;
        }
      } else if (p.dir.y < 0) {
        if (!aheadWalkable && nextY <= curCenterY) {
          p.x = curCenterX;
          p.y = curCenterY;
          p.dir = DIR.NONE;
        } else {
          p.y = nextY;
          moved = true;
        }
      }

      if (p.x < -0.5) p.x += COLS;
      if (p.x >= COLS - 0.5) p.x -= COLS;
    }

    if (moved) {
      p.mouthPhase += dt * 16;
    } else {
      p.mouthPhase = 0.7;
    }

    cx = wrapCol(Math.round(p.x));
    cy = Math.round(p.y);
    if (cy >= 0 && cy < ROWS) {
      const tile = state.grid[cy][cx];
      const dx = p.x - Math.round(p.x);
      const dy = p.y - cy;
      if ((tile === "." || tile === "o") && Math.hypot(dx, dy) < 0.45) {
        state.grid[cy][cx] = " ";
        state.pelletsRemaining--;
        state.pelletsEaten++;
        state.pelletInactivityTimer = 0;

        if (tile === ".") {
          addScore(10);
          p.eatPause = 0.012;
          audio.playWaka();
        } else {
          addScore(50);
          p.eatPause = 0.036;
          audio.playPowerPellet();
          triggerFrightenedMode();
        }

        if ((state.pelletsEaten === 70 && state.fruit.spawnCount === 0) ||
            (state.pelletsEaten === 170 && state.fruit.spawnCount === 1)) {
          state.fruit.active = true;
          state.fruit.timer = 9.5;
          state.fruit.spawnCount++;
        }

        if (state.pelletsRemaining <= 0) {
          state.mode = "LEVEL_CLEAR";
          state.stateTimer = 2.3;
          state.fruit.active = false;
          audio.playLevelClear();
          return;
        }
      }
    }

    if (state.fruit.active) {
      const distFruit = Math.hypot(p.x - state.fruit.x, p.y - state.fruit.y);
      if (distFruit < 0.7) {
        const fruit = getLevelFruit(state.level);
        state.fruit.active = false;
        audio.playEatFruit();
        addScore(fruit.points, state.fruit.x, state.fruit.y, "#ffd800");
        spawnSparkles(state.fruit.x, state.fruit.y, fruit.color, 12);
      }
    }
  }

  function triggerFrightenedMode() {
    state.frightenedDuration = getFrightenedDuration(state.level);
    state.frightenedTimer = state.frightenedDuration;
    state.ghostCombo = 0;

    for (const g of state.ghosts) {
      g.frightenedSafe = false;
      if (g.mode === "NORMAL" || g.mode === "FRIGHTENED") {
        g.mode = "FRIGHTENED";
        g.dir = reverseDir(g.dir);
      }
    }
  }

  function reverseDir(d) {
    if (d === DIR.UP) return DIR.DOWN;
    if (d === DIR.DOWN) return DIR.UP;
    if (d === DIR.LEFT) return DIR.RIGHT;
    if (d === DIR.RIGHT) return DIR.LEFT;
    return DIR.LEFT;
  }

  function getGhostTarget(ghost) {
    if (ghost.mode === "EATEN") {
      return { x: 13.5, y: 11 };
    }

    const waveMode = getCurrentWaveMode();
    const isElroy = ghost.id === "blinky" && state.pelletsRemaining <= 20;

    if (waveMode === "SCATTER" && !isElroy) {
      return ghost.scatterTarget;
    }

    const px = Math.round(state.pacman.x);
    const py = Math.round(state.pacman.y);
    const f = state.pacman.facing;

    switch (ghost.id) {
      case "blinky":
        return { x: px, y: py };
      case "pinky":
        return { x: px + f.x * 4, y: py + f.y * 4 };
      case "inky": {
        const pivotX = px + f.x * 2;
        const pivotY = py + f.y * 2;
        const blinky = state.ghosts[0];
        return {
          x: pivotX + (pivotX - blinky.x),
          y: pivotY + (pivotY - blinky.y),
        };
      }
      case "clyde": {
        const dist = Math.hypot(ghost.x - px, ghost.y - py);
        return dist > 8 ? { x: px, y: py } : ghost.scatterTarget;
      }
      default:
        return { x: px, y: py };
    }
  }

  function chooseGhostDirectionAtTile(ghost, c, r) {
    const valid = [];
    const tileKey = `${c},${r}`;

    for (const d of GHOST_DIR_ORDER) {
      if (isOpposite(d, ghost.dir)) continue;
      if (d === DIR.UP && ghost.mode === "NORMAL" && NO_UP_TILES.has(tileKey)) {
        continue;
      }
      const nc = c + d.x;
      const nr = r + d.y;
      if (isWalkableForGhost(nc, nr, false)) {
        valid.push(d);
      }
    }

    if (valid.length === 0) {
      const rev = reverseDir(ghost.dir);
      if (isWalkableForGhost(c + rev.x, r + rev.y, false)) {
        return rev;
      }
      return ghost.dir;
    }

    if (ghost.mode === "FRIGHTENED") {
      return valid[Math.floor(Math.random() * valid.length)];
    }

    const target = getGhostTarget(ghost);
    let bestDir = valid[0];
    let bestDistSq = Infinity;

    for (const d of valid) {
      const nx = c + d.x;
      const ny = r + d.y;
      const distSq = (nx - target.x) ** 2 + (ny - target.y) ** 2;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestDir = d;
      }
    }

    return bestDir;
  }

  function updateGhosts(dt) {
    if (state.frightenedTimer > 0) {
      state.frightenedTimer -= dt;
      if (state.frightenedTimer <= 0) {
        state.frightenedTimer = 0;
        for (const g of state.ghosts) {
          if (g.mode === "FRIGHTENED") {
            g.mode = "NORMAL";
          }
        }
      }
    } else {
      const schedule = getWaveSchedule(state.level);
      const current = schedule[Math.min(state.waveIndex, schedule.length - 1)];
      state.waveTimer += dt;
      if (state.waveTimer >= current.dur && state.waveIndex < schedule.length - 1) {
        state.waveTimer = 0;
        state.waveIndex++;
        for (const g of state.ghosts) {
          if (g.mode === "NORMAL") {
            g.dir = reverseDir(g.dir);
          }
        }
      }
    }

    state.pelletInactivityTimer += dt;

    for (const g of state.ghosts) {
      g.bobPhase += dt * 7;

      if (g.mode === "IN_HOUSE") {
        g.y = g.homeY + Math.sin(g.bobPhase) * 0.32;
        if (state.pelletsEaten >= g.releaseDots || state.pelletInactivityTimer >= g.releaseDelay) {
          g.mode = "EXITING";
        }
        continue;
      }

      if (g.mode === "EXITING") {
        const exitSpeed = 4.2 * getSpeedMultiplier() * dt;
        if (Math.abs(g.x - 13.5) > 0.05) {
          const dx = 13.5 - g.x;
          g.dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
          g.x += Math.sign(dx) * Math.min(Math.abs(dx), exitSpeed);
        } else {
          g.x = 13.5;
          g.dir = DIR.UP;
          g.y -= exitSpeed;
          if (g.y <= 11) {
            g.y = 11;
            g.mode = state.frightenedTimer > 0 && !g.frightenedSafe ? "FRIGHTENED" : "NORMAL";
            g.dir = Math.random() < 0.5 ? DIR.LEFT : DIR.RIGHT;
          }
        }
        continue;
      }

      if (g.mode === "ENTERING") {
        const enterSpeed = 8.5 * getSpeedMultiplier() * dt;
        if (Math.abs(g.x - 13.5) > 0.05) {
          const dx = 13.5 - g.x;
          g.dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
          g.x += Math.sign(dx) * Math.min(Math.abs(dx), enterSpeed);
        } else {
          g.x = 13.5;
          g.dir = DIR.DOWN;
          g.y += enterSpeed;
          if (g.y >= 14) {
            g.y = 14;
            g.frightenedSafe = true;
            g.mode = "EXITING";
          }
        }
        continue;
      }

      let speed = getGhostBaseSpeed(g);
      const inTunnel = Math.round(g.y) === 14 && (g.x <= 5.5 || g.x >= 21.5);

      if (g.mode === "EATEN") {
        speed = 14.5 * getSpeedMultiplier();
      } else if (g.mode === "FRIGHTENED") {
        speed *= 0.56;
      } else if (inTunnel) {
        speed *= 0.52;
      }

      let remaining = speed * dt;
      let guard = 0;

      while (remaining > 0.00001 && guard < 5) {
        guard++;

        if (g.mode === "EATEN" && Math.abs(g.y - 11) < 0.15 && Math.abs(g.x - 13.5) <= remaining + 0.15) {
          g.x = 13.5;
          g.y = 11;
          g.mode = "ENTERING";
          break;
        }

        const toCenter = distanceToNextCenter(g);

        if (remaining >= toCenter) {
          g.x += g.dir.x * toCenter;
          g.y += g.dir.y * toCenter;
          remaining -= toCenter;

          if (g.x < -0.5) g.x += COLS;
          if (g.x >= COLS - 0.5) g.x -= COLS;

          const tileC = wrapCol(Math.round(g.x));
          const tileR = Math.round(g.y);
          g.x = tileC;
          g.y = tileR;

          g.dir = chooseGhostDirectionAtTile(g, tileC, tileR);
        } else {
          g.x += g.dir.x * remaining;
          g.y += g.dir.y * remaining;
          remaining = 0;

          if (g.x < -0.5) g.x += COLS;
          if (g.x >= COLS - 0.5) g.x -= COLS;
        }
      }
    }
  }

  function distanceToNextCenter(g) {
    const eps = 1e-6;
    if (g.dir.x > 0) {
      const next = Math.floor(g.x + eps) + 1;
      return next - g.x;
    }
    if (g.dir.x < 0) {
      const next = Math.ceil(g.x - eps) - 1;
      return g.x - next;
    }
    if (g.dir.y > 0) {
      const next = Math.floor(g.y + eps) + 1;
      return next - g.y;
    }
    if (g.dir.y < 0) {
      const next = Math.ceil(g.y - eps) - 1;
      return g.y - next;
    }
    return 1;
  }

  function checkCollisions() {
    const p = state.pacman;

    for (const g of state.ghosts) {
      if (g.mode === "IN_HOUSE" || g.mode === "EXITING" || g.mode === "ENTERING" || g.mode === "EATEN") {
        continue;
      }

      let dx = Math.abs(p.x - g.x);
      if (dx > COLS / 2) dx = COLS - dx;
      const dy = Math.abs(p.y - g.y);

      if (Math.hypot(dx, dy) < 0.66) {
        if (g.mode === "FRIGHTENED") {
          state.ghostCombo++;
          const pts = 200 * (2 ** (state.ghostCombo - 1));
          g.mode = "EATEN";
          state.eatFreezeGhost = g;
          state.mode = "EAT_FREEZE";
          state.stateTimer = 0.55;
          audio.playEatGhost();
          addScore(pts, g.x, g.y, "#5ce1ff");
          spawnSparkles(g.x, g.y, "#5ce1ff", 14);
          return;
        }

        state.mode = "DYING";
        state.stateTimer = 1.45;
        state.pacman.deathProgress = 0;
        state.fruit.active = false;
        audio.playDeath();
        return;
      }
    }
  }

  function spawnSparkles(tileX, tileY, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 1.6 + Math.random() * 3.4;
      state.particles.push({
        x: (tileX + 0.5) * TILE,
        y: (tileY + 0.5) * TILE,
        vx: Math.cos(angle) * speed * TILE,
        vy: Math.sin(angle) * speed * TILE,
        color,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  function updateEffects(dt) {
    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.timer -= dt;
      pop.y -= dt * 0.65;
      if (pop.timer <= 0) state.popups.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  function update(dt) {
    state.globalTime += dt;
    if (state.mode !== "PAUSED") {
      updateEffects(dt);
    }

    switch (state.mode) {
      case "READY":
        state.stateTimer -= dt;
        if (state.stateTimer <= 0) {
          state.mode = "PLAYING";
        }
        break;

      case "PLAYING":
        if (state.fruit.active) {
          state.fruit.timer -= dt;
          if (state.fruit.timer <= 0) state.fruit.active = false;
        }
        updatePacman(dt);
        if (state.mode === "PLAYING") {
          updateGhosts(dt);
          checkCollisions();
        }
        break;

      case "EAT_FREEZE":
        state.stateTimer -= dt;
        if (state.stateTimer <= 0) {
          state.eatFreezeGhost = null;
          state.mode = "PLAYING";
        }
        break;

      case "DYING":
        state.stateTimer -= dt;
        state.pacman.deathProgress = Math.min(1, 1 - state.stateTimer / 1.45);
        if (state.stateTimer <= 0) {
          state.lives--;
          updateHUD();
          if (state.lives <= 0) {
            state.mode = "GAME_OVER";
            renderMainOverlayForMode();
          } else {
            resetActors();
            state.mode = "READY";
            state.stateTimer = 1.4;
          }
        }
        break;

      case "LEVEL_CLEAR":
        state.stateTimer -= dt;
        if (state.stateTimer <= 0) {
          startNextLevel();
        }
        break;

      default:
        break;
    }
  }

  // Renderizado en Canvas
  function render() {
    ctx.fillStyle = "#020309";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const flash =
      state.mode === "LEVEL_CLEAR" &&
      state.stateTimer < 1.7 &&
      Math.floor(state.stateTimer * 7) % 2 === 0;
    const mazeLayer = flash ? mazeCanvasFlash : getMazeCanvasForTheme(settings.theme);
    ctx.drawImage(mazeLayer, 0, 0, CANVAS_W, CANVAS_H);

    drawPellets();

    if (state.fruit.active) {
      drawFruit(state.fruit.x, state.fruit.y, getLevelFruit(state.level));
    }

    if (state.mode === "READY") {
      drawCenterBanner("¡LISTO!", "#ffd800");
    } else if (state.mode === "LEVEL_CLEAR") {
      drawCenterBanner("¡NIVEL SUPERADO!", "#67e8f9");
    }

    if (state.mode === "DYING") {
      drawPacmanDeath();
    } else {
      for (const g of state.ghosts) {
        if (state.mode === "EAT_FREEZE" && g === state.eatFreezeGhost) continue;
        drawGhost(g);
      }
      if (state.mode !== "EAT_FREEZE") {
        drawPacman();
      }
    }

    drawParticles();
    drawPopups();
  }

  function drawPellets() {
    const pulse = 0.5 + 0.5 * Math.sin(state.globalTime * 8);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = state.grid[r][c];
        if (cell === ".") {
          ctx.fillStyle = "#ffd9a8";
          ctx.beginPath();
          ctx.arc((c + 0.5) * TILE, (r + 0.5) * TILE, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === "o") {
          const cx = (c + 0.5) * TILE;
          const cy = (r + 0.5) * TILE;
          const rad = 5.4 + pulse * 1.6;
          ctx.save();
          ctx.fillStyle = "#ffe9bf";
          ctx.shadowColor = "#ffb703";
          ctx.shadowBlur = 10 + pulse * 6;
          ctx.globalAlpha = 0.72 + pulse * 0.28;
          ctx.beginPath();
          ctx.arc(cx, cy, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function drawCenterBanner(text, color) {
    ctx.save();
    ctx.font = "900 15px 'Cascadia Mono', Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillText(text, CANVAS_W / 2, 17.5 * TILE);
    ctx.restore();
  }

  function drawPacman() {
    const p = state.pacman;
    const radius = TILE * 0.72;
    const mouthAngle = 0.08 + Math.abs(Math.sin(p.mouthPhase)) * 0.32 * Math.PI;

    let rot = 0;
    if (p.facing === DIR.LEFT) rot = Math.PI;
    else if (p.facing === DIR.UP) rot = -Math.PI / 2;
    else if (p.facing === DIR.DOWN) rot = Math.PI / 2;

    const offsets = [0];
    if (p.x < 1) offsets.push(COLS);
    else if (p.x > COLS - 2) offsets.push(-COLS);

    for (const off of offsets) {
      const px = (p.x + off + 0.5) * TILE;
      const py = (p.y + 0.5) * TILE;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);

      ctx.fillStyle = "#ffd800";
      ctx.shadowColor = "rgba(255, 216, 0, 0.45)";
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, mouthAngle, Math.PI * 2 - mouthAngle);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPacmanDeath() {
    const p = state.pacman;
    const t = p.deathProgress;
    const px = (p.x + 0.5) * TILE;
    const py = (p.y + 0.5) * TILE;
    const radius = TILE * 0.72;

    ctx.save();
    ctx.translate(px, py);

    if (t < 0.82) {
      const k = t / 0.82;
      const open = k * Math.PI;
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#ffd800";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, open, Math.PI * 2 - open);
      ctx.closePath();
      ctx.fill();
    } else {
      const k = (t - 0.82) / 0.18;
      ctx.strokeStyle = `rgba(255, 226, 74, ${1 - k})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (4 + k * 6), Math.sin(a) * (4 + k * 6));
        ctx.lineTo(Math.cos(a) * (10 + k * 10), Math.sin(a) * (10 + k * 10));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawGhost(g) {
    const offsets = [0];
    if (g.x < 1) offsets.push(COLS);
    else if (g.x > COLS - 2) offsets.push(-COLS);

    const isFrightened =
      g.mode === "FRIGHTENED" ||
      ((g.mode === "IN_HOUSE" || g.mode === "EXITING") && state.frightenedTimer > 0 && !g.frightenedSafe);
    const isEyesOnly = g.mode === "EATEN" || g.mode === "ENTERING";
    const isFlashing =
      isFrightened &&
      state.frightenedTimer <= 2.0 &&
      Math.floor(state.frightenedTimer * 8) % 2 === 0;

    for (const off of offsets) {
      const gx = (g.x + off + 0.5) * TILE;
      const gy = (g.y + 0.5) * TILE;
      const r = TILE * 0.72;

      ctx.save();
      ctx.translate(gx, gy);

      if (!isEyesOnly) {
        const bodyColor = isFrightened ? (isFlashing ? "#f8fafc" : "#1d4ed8") : g.color;

        ctx.fillStyle = bodyColor;
        ctx.shadowColor = isFrightened ? "rgba(59, 130, 246, 0.5)" : g.color;
        ctx.shadowBlur = 7;

        ctx.beginPath();
        ctx.arc(0, -r * 0.14, r, Math.PI, 0, false);
        ctx.lineTo(r, r * 0.82);

        const waveShift = Math.floor(state.globalTime * 10) % 2 === 0 ? 0 : 1;
        const lobes = 3;
        const stepW = (r * 2) / lobes;
        for (let i = 0; i < lobes; i++) {
          const rightX = r - i * stepW;
          const midX = rightX - stepW / 2;
          const leftX = rightX - stepW;
          const lift = ((i + waveShift) % 2 === 0) ? r * 0.48 : r * 0.58;
          ctx.quadraticCurveTo(midX, r * 1.05, leftX, lift);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (isFrightened) {
        const faceColor = isFlashing ? "#ef4444" : "#fef08a";
        ctx.fillStyle = faceColor;
        ctx.beginPath();
        ctx.arc(-4.5, -2, 2.2, 0, Math.PI * 2);
        ctx.arc(4.5, -2, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = faceColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-7, 5);
        for (let i = 0; i < 4; i++) {
          ctx.lineTo(-5.25 + i * 3.5, i % 2 === 0 ? 3 : 5.5);
        }
        ctx.lineTo(7, 5);
        ctx.stroke();
      } else {
        const lookX = g.dir.x * 2.2;
        const lookY = g.dir.y * 2.2;

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-4.6, -2.5, 3.6, 4.5, 0, 0, Math.PI * 2);
        ctx.ellipse(4.6, -2.5, 3.6, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0b1a6e";
        ctx.beginPath();
        ctx.arc(-4.6 + lookX, -2.5 + lookY, 2.1, 0, Math.PI * 2);
        ctx.arc(4.6 + lookX, -2.5 + lookY, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawFruit(tileX, tileY, fruit) {
    const x = (tileX + 0.5) * TILE;
    const y = (tileY + 0.5) * TILE + Math.sin(state.globalTime * 5) * 1.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = fruit.color;
    ctx.shadowBlur = 10;

    switch (fruit.type) {
      case "cherry":
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, 2);
        ctx.quadraticCurveTo(0, -9, 5, -8);
        ctx.moveTo(4, 3);
        ctx.quadraticCurveTo(3, -5, 5, -8);
        ctx.stroke();
        ctx.fillStyle = "#ff2d55";
        ctx.beginPath();
        ctx.arc(-4.5, 4, 4.5, 0, Math.PI * 2);
        ctx.arc(4.5, 5, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(-6, 2.5, 1.3, 0, Math.PI * 2);
        ctx.arc(3, 3.5, 1.3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "strawberry":
        ctx.fillStyle = "#ff3b6b";
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.bezierCurveTo(9, 4, 8, -5, 0, -5);
        ctx.bezierCurveTo(-8, -5, -9, 4, 0, 8);
        ctx.fill();
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(-5, -7, 10, 3);
        ctx.fillStyle = "#fef08a";
        for (const [sx, sy] of [[-3, -1], [3, -1], [0, 2], [-2, 4], [2, 4]]) {
          ctx.fillRect(sx, sy, 1.4, 1.4);
        }
        break;

      case "orange":
        ctx.fillStyle = "#ff9f1c";
        ctx.beginPath();
        ctx.arc(0, 1, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.ellipse(2, -7, 4, 2, -0.4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "apple":
        ctx.fillStyle = "#ff3b30";
        ctx.beginPath();
        ctx.arc(-3, 1, 5.5, 0, Math.PI * 2);
        ctx.arc(3, 1, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#92400e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(2, -8);
        ctx.stroke();
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.ellipse(4, -6, 3.5, 1.8, 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;

      default:
        ctx.fillStyle = fruit.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const outer = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const inner = outer + Math.PI / 5;
          ctx.lineTo(Math.cos(outer) * 8.5, Math.sin(outer) * 8.5);
          ctx.lineTo(Math.cos(inner) * 4, Math.sin(inner) * 4);
        }
        ctx.closePath();
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const pt of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPopups() {
    for (const pop of state.popups) {
      const alpha = Math.min(1, pop.timer / 0.35);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "900 13px 'Cascadia Mono', Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = pop.color;
      ctx.shadowColor = pop.color;
      ctx.shadowBlur = 8;
      ctx.fillText(pop.text, (pop.x + 0.5) * TILE, (pop.y + 0.5) * TILE);
      ctx.restore();
    }
  }

  // Controles de teclado
  function setDesiredDirection(dir) {
    if (!state.pacman) return;
    audio.ensureContext();
    state.pacman.nextDir = dir;
  }

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    const isInputTarget = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");

    if (key === "escape") {
      e.preventDefault();
      if (state.overlayView === "SETTINGS") {
        closeSettings();
      } else if (state.mode === "PAUSED") {
        resumeGame();
      } else if (isActivePlayMode(state.mode)) {
        openMenu();
      }
      return;
    }

    if (isInputTarget) return;

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      e.preventDefault();
    }

    if (key === "m") {
      const isMuted = audio.toggleMute();
      muteBtn.classList.toggle("muted", isMuted || settings.volume === 0);
      return;
    }

    if (key === "p" || key === " ") {
      if (state.overlayView === "SETTINGS") return;
      if (isActivePlayMode(state.mode) || state.mode === "PAUSED") {
        togglePause();
      } else if (state.mode === "TITLE" || state.mode === "GAME_OVER") {
        startNewGame();
      }
      return;
    }

    if (key === "enter") {
      if (state.overlayView === "SETTINGS") {
        closeSettings();
        return;
      }
      if (state.mode === "TITLE" || state.mode === "GAME_OVER") {
        startNewGame();
      } else if (state.mode === "PAUSED") {
        resumeGame();
      }
      return;
    }

    if (state.overlayView === "SETTINGS") return;

    if (key === "arrowup" || key === "w") setDesiredDirection(DIR.UP);
    else if (key === "arrowdown" || key === "s") setDesiredDirection(DIR.DOWN);
    else if (key === "arrowleft" || key === "a") setDesiredDirection(DIR.LEFT);
    else if (key === "arrowright" || key === "d") setDesiredDirection(DIR.RIGHT);
  });

  // Botones del HUD y menú interactivo
  menuBtn.addEventListener("click", () => {
    if (state.mode === "PAUSED" && state.overlayView === "MAIN") {
      resumeGame();
    } else {
      openMenu();
    }
  });

  homeBtn.addEventListener("click", () => {
    goToHomeScreen();
  });

  settingsBtn.addEventListener("click", () => {
    if (state.overlayView === "SETTINGS") {
      closeSettings();
    } else {
      openSettings();
    }
  });

  mobileBtn.addEventListener("click", () => {
    toggleMobileMode();
    if (state.overlayView === "MAIN") renderMainOverlayForMode();
  });

  pauseBtn.addEventListener("click", () => {
    togglePause();
  });

  muteBtn.addEventListener("click", () => {
    if (settings.volume === 0 && !audio.muted) {
      settings.volume = 70;
      saveSettings();
      audio.setVolume(0.7);
      audio.setMuted(false);
      applySettingsToUI();
      return;
    }
    const isMuted = audio.toggleMute();
    muteBtn.classList.toggle("muted", isMuted);
  });

  // Botones dentro de la pantalla principal / pausa / game over
  startBtn.addEventListener("click", () => {
    if (state.mode === "PAUSED") {
      resumeGame();
    } else {
      startNewGame();
    }
  });

  restartBtn.addEventListener("click", () => {
    startNewGame();
  });

  overlaySettingsBtn.addEventListener("click", () => {
    openSettings();
  });

  overlayMobileBtn.addEventListener("click", () => {
    toggleMobileMode();
    renderMainOverlayForMode();
  });

  overlayHomeBtn.addEventListener("click", () => {
    goToHomeScreen();
  });

  // Eventos del panel de Ajustes
  settingsCloseBtn.addEventListener("click", closeSettings);
  settingsBackBtn.addEventListener("click", closeSettings);

  document.querySelectorAll(".segmented[data-setting]").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg-btn");
      if (!btn) return;
      const key = group.dataset.setting;
      const rawVal = btn.dataset.value;
      settings[key] = key === "startingLives" ? Number(rawVal) : rawVal;
      if (state.mode === "TITLE" && key === "startingLives") {
        state.lives = settings.startingLives;
        updateHUD();
      }
      saveSettings();
      applySettingsToUI();
      audio.playUiClick();
    });
  });

  settingVolumeInput.addEventListener("input", () => {
    settings.volume = Number(settingVolumeInput.value);
    if (settings.volume > 0 && audio.muted) {
      audio.setMuted(false);
    }
    saveSettings();
    applySettingsToUI();
  });

  settingVolumeInput.addEventListener("change", () => {
    audio.playUiClick();
  });

  settingCrtInput.addEventListener("change", () => {
    settings.crt = settingCrtInput.checked;
    saveSettings();
    applySettingsToUI();
    audio.playUiClick();
  });

  settingMobileInput.addEventListener("change", () => {
    toggleMobileMode(settingMobileInput.checked);
  });

  resetSettingsBtn.addEventListener("click", () => {
    const keepMobile = settings.mobileMode;
    Object.assign(settings, DEFAULT_SETTINGS, { mobileMode: keepMobile });
    audio.setMuted(false);
    saveSettings();
    applySettingsToUI();
    if (state.mode === "TITLE") {
      state.lives = settings.startingLives;
      updateHUD();
    }
    audio.playUiClick();
  });

  resetHighscoreBtn.addEventListener("click", () => {
    if (!state.confirmResetHighScore) {
      state.confirmResetHighScore = true;
      resetHighscoreBtn.textContent = "¿Confirmar?";
      audio.playUiClick();
      return;
    }
    state.confirmResetHighScore = false;
    state.highScore = 0;
    saveHighScore(0);
    updateHUD();
    resetHighscoreBtn.textContent = "Récord borrado";
    audio.playUiClick();
  });

  // Controles rápidos del deck móvil
  if (mobileExitBtn) {
    mobileExitBtn.addEventListener("click", () => {
      toggleMobileMode(false);
      if (state.overlayView === "MAIN" && !overlayEl.classList.contains("hidden")) {
        renderMainOverlayForMode();
      }
    });
  }

  if (mobileFullscreenBtn) {
    mobileFullscreenBtn.addEventListener("click", () => {
      audio.playUiClick();
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Controles táctiles D-Pad con soporte de deslizamiento de pulgar
  let activeDpadBtn = null;

  function highlightDpadBtn(btn) {
    if (activeDpadBtn && activeDpadBtn !== btn) {
      activeDpadBtn.classList.remove("pressed");
    }
    activeDpadBtn = btn;
    if (activeDpadBtn) {
      activeDpadBtn.classList.add("pressed");
    }
  }

  function triggerDpadFromButton(btn) {
    if (!btn || !btn.dataset.dir) return;
    const d = DIR[btn.dataset.dir];
    if (d) {
      highlightDpadBtn(btn);
      setDesiredDirection(d);
    }
  }

  dpadEl.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-dir]");
    if (!btn) return;
    e.preventDefault();
    if (dpadEl.setPointerCapture) {
      try { dpadEl.setPointerCapture(e.pointerId); } catch {}
    }
    triggerDpadFromButton(btn);
  });

  dpadEl.addEventListener("pointermove", (e) => {
    if (!activeDpadBtn) return;
    if (typeof document.elementFromPoint !== "function") return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el && el.closest ? el.closest("[data-dir]") : null;
    if (btn && btn !== activeDpadBtn) {
      triggerDpadFromButton(btn);
    }
  });

  function clearDpadHighlight() {
    highlightDpadBtn(null);
  }
  dpadEl.addEventListener("pointerup", clearDpadHighlight);
  dpadEl.addEventListener("pointercancel", clearDpadHighlight);

  // Gestos de deslizamiento (swipe) directamente en el canvas
  let touchStartX = 0;
  let touchStartY = 0;
  canvas.addEventListener("touchstart", (e) => {
    if (!e.touches.length) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => {
    if (!e.touches.length) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.hypot(dx, dy) < 22) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      setDesiredDirection(dx > 0 ? DIR.RIGHT : DIR.LEFT);
    } else {
      setDesiredDirection(dy > 0 ? DIR.DOWN : DIR.UP);
    }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  // Observador de tamaño para mantener el laberinto ajustado al 100% de la pantalla
  window.addEventListener("resize", fitStageToScreen);
  window.addEventListener("orientationchange", () => {
    setTimeout(fitStageToScreen, 120);
  });
  if (typeof ResizeObserver === "function" && stageWrapper) {
    new ResizeObserver(fitStageToScreen).observe(stageWrapper);
  }

  // Inicialización
  resetMazeGrid();
  resetActors();
  applySettingsToUI();
  updateHUD();
  renderMainOverlayForMode();
  fitStageToScreen();

  // Bucle de animación con delta-time acotado
  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
})();
