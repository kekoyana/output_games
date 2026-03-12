import {
  GameState, Cell, Panel, Player, Scene, Direction, PanelColor,
  Particle, FreedCreature, SpawnWarning, ScreenShake, InputState, DebugInfo, Vec2,
  NextPanel,
} from './types';
import {
  panelColorHex, panelColorDim, drawPanelShape, drawGlow, drawRoundedRect,
  hexToRgba, dirOffset, easeOutQuad, easeOutCubic, easeOutBounce,
  randInt, randFloat, randPanelColor, shuffle, lerp, clamp,
} from './utils';

// ---- Constants ----

const COLS = 8;
const ROWS = 8;
const NUM_COLORS = 5;
const INITIAL_PANELS = 10;
const MOVE_DURATION = 0.08; // seconds for move interpolation
const SPAWN_WARNING_TIME = 1.5; // seconds
const CLEAR_ANIM_TIME = 2.0; // seconds - long enough to allow chain opportunities
const CREATURE_CHANCE = 0.2;
const QUEUE_SIZE = 3;

// ---- Create Initial State ----

export function createGameState(): GameState {
  const grid = createEmptyGrid(COLS, ROWS);
  const player: Player = {
    col: Math.floor(COLS / 2),
    row: Math.floor(ROWS / 2),
    facing: 'down',
    moveT: 1,
    prevCol: Math.floor(COLS / 2),
    prevRow: Math.floor(ROWS / 2),
  };

  return {
    scene: 'title',
    grid,
    cols: COLS,
    rows: ROWS,
    player,
    nextPanel: createNextPanel(),
    score: 0,
    level: 1,
    clearedCount: 0,
    clearTarget: 0,
    chainCount: 0,
    maxChain: 0,
    spawnTimer: 4.0,
    spawnInterval: 4.0,
    spawnWarnings: [],
    particles: [],
    freedCreatures: [],
    screenShake: { intensity: 0, duration: 0, elapsed: 0 },
    sceneTimer: 0,
    inputCooldown: 0.3,
    panelCount: 0,
  };
}

function createNextPanel(): NextPanel {
  const queue: PanelColor[] = [];
  for (let i = 0; i < QUEUE_SIZE; i++) {
    queue.push(randPanelColor(NUM_COLORS));
  }
  return {
    color: randPanelColor(NUM_COLORS),
    queue,
  };
}

function advanceNext(np: NextPanel): void {
  np.color = np.queue[0];
  np.queue.shift();
  np.queue.push(randPanelColor(NUM_COLORS));
}

function createEmptyGrid(cols: number, rows: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ panel: null });
    }
    grid.push(row);
  }
  return grid;
}

// ---- Level Init ----

export function startLevel(state: GameState): void {
  state.scene = 'playing';
  state.grid = createEmptyGrid(state.cols, state.rows);
  state.player.col = Math.floor(state.cols / 2);
  state.player.row = Math.floor(state.rows / 2);
  state.player.prevCol = state.player.col;
  state.player.prevRow = state.player.row;
  state.player.facing = 'down';
  state.player.moveT = 1;
  state.nextPanel = createNextPanel();
  state.clearedCount = 0;
  state.clearTarget = 0;
  state.chainCount = 0;
  state.maxChain = 0;
  state.spawnInterval = 4.0;
  state.spawnTimer = state.spawnInterval;
  state.spawnWarnings = [];
  state.particles = [];
  state.freedCreatures = [];
  state.screenShake = { intensity: 0, duration: 0, elapsed: 0 };

  // Place initial panels (scattered, not where player is)
  const positions: Vec2[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (c === state.player.col && r === state.player.row) continue;
      positions.push({ x: c, y: r });
    }
  }
  shuffle(positions);
  const count = Math.min(INITIAL_PANELS, positions.length);
  for (let i = 0; i < count; i++) {
    const p = positions[i];
    state.grid[p.y][p.x].panel = {
      color: randPanelColor(NUM_COLORS),
      age: 0,
      clearing: 0,
      chainLevel: 0,
      hasCreature: Math.random() < CREATURE_CHANCE,
    };
  }
  state.panelCount = count;
}

// ---- Update ----

export function update(state: GameState, dt: number, input: InputState): void {
  state.inputCooldown = Math.max(0, state.inputCooldown - dt);

  switch (state.scene) {
    case 'title':
      state.sceneTimer += dt;
      if (state.inputCooldown <= 0 && (input.action || input.up || input.down || input.left || input.right)) {
        state.level = 1;
        state.score = 0;
        startLevel(state);
        input.actionConsumed = true;
        input.moveConsumed = true;
      }
      break;

    case 'playing':
      updatePlaying(state, dt, input);
      break;

    case 'gameOver':
      state.sceneTimer += dt;
      updateParticles(state, dt);
      if (state.inputCooldown <= 0 && (input.action || input.up || input.down || input.left || input.right)) {
        state.scene = 'title';
        state.sceneTimer = 0;
        state.inputCooldown = 0.3;
        input.actionConsumed = true;
        input.moveConsumed = true;
      }
      break;
  }
}

function updatePlaying(state: GameState, dt: number, input: InputState): void {
  // Animate panels age
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const p = state.grid[r][c].panel;
      if (p) p.age += dt;
    }
  }

  // Process clearing animations
  let anyClearing = false;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const p = state.grid[r][c].panel;
      if (p && p.clearing > 0) {
        anyClearing = true;
        p.clearing -= dt;
        if (p.clearing <= 0) {
          if (p.hasCreature) {
            spawnFreedCreature(state, c, r);
          }
          state.grid[r][c].panel = null;
          state.panelCount--;
        }
      }
    }
  }

  // Player movement interpolation
  if (state.player.moveT < 1) {
    state.player.moveT = Math.min(1, state.player.moveT + dt / MOVE_DURATION);
  }

  // Handle movement input - player CAN walk over panels
  if (!input.moveConsumed && state.player.moveT >= 1) {
    let dir: Direction | null = null;
    if (input.up) dir = 'up';
    else if (input.down) dir = 'down';
    else if (input.left) dir = 'left';
    else if (input.right) dir = 'right';

    if (dir) {
      state.player.facing = dir;
      const off = dirOffset(dir);
      const nc = state.player.col + off.x;
      const nr = state.player.row + off.y;
      // Can move anywhere within bounds (can walk over panels)
      if (inBounds(state, nc, nr)) {
        state.player.prevCol = state.player.col;
        state.player.prevRow = state.player.row;
        state.player.col = nc;
        state.player.row = nr;
        state.player.moveT = 0;
      }
      input.moveConsumed = true;
    }
  }

  // Handle action input: place next panel on current cell
  // CAN place even during clearing animations (key to chain system!)
  if (input.action && !input.actionConsumed && state.player.moveT >= 1) {
    const pc = state.player.col;
    const pr = state.player.row;

    // Place panel on current cell if empty (clearing panels don't block placement)
    const cell = state.grid[pr][pc];
    if (!cell.panel || cell.panel.clearing > 0) {
      // If a clearing panel is here, it will be replaced
      if (cell.panel && cell.panel.clearing > 0) {
        state.panelCount--;
      }
      cell.panel = {
        color: state.nextPanel.color,
        age: 0,
        clearing: 0,
        chainLevel: 0,
      hasCreature: false,
      };
      state.panelCount++;
      advanceNext(state.nextPanel);

      // Check sandwich clears from placed position
      const result = checkSandwich(state, pc, pr);
      if (result.totalCleared > 0) {
        // Chain: if sandwich involved clearing panels, continue from their chain level
        if (result.maxInvolvedChainLevel > 0) {
          state.chainCount = result.maxInvolvedChainLevel + 1;
        } else {
          state.chainCount = 1;
        }
        if (state.chainCount > state.maxChain) state.maxChain = state.chainCount;

        // Store chain level on all newly cleared panels
        for (let r = 0; r < state.rows; r++) {
          for (let c = 0; c < state.cols; c++) {
            const p = state.grid[r][c].panel;
            if (p && p.clearing > 0 && p.chainLevel === 0) {
              p.chainLevel = state.chainCount;
            }
          }
        }
        // Also update re-involved panels to higher chain level
        for (let r = 0; r < state.rows; r++) {
          for (let c = 0; c < state.cols; c++) {
            const p = state.grid[r][c].panel;
            if (p && p.clearing > 0 && p.chainLevel < state.chainCount) {
              p.chainLevel = state.chainCount;
            }
          }
        }

        // Chain bonus: extra score for chaining
        if (state.chainCount > 1) {
          state.score += result.totalCleared * 10 * state.chainCount;
        }
      }

      // Check game over
      checkGameOver(state);
    }
    input.actionConsumed = true;
  }

  // Gradually speed up spawns based on time played
  state.sceneTimer += dt;
  state.spawnInterval = Math.max(1.5, 4.0 - state.sceneTimer * 0.02);

  // Spawn system: panels appear over time
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = state.spawnInterval;
    scheduleSpawn(state);
  }

  // Update spawn warnings
  for (let i = state.spawnWarnings.length - 1; i >= 0; i--) {
    const w = state.spawnWarnings[i];
    w.timer -= dt;
    if (w.timer <= 0) {
      if (!state.grid[w.row][w.col].panel) {
        state.grid[w.row][w.col].panel = {
          color: w.color,
          age: 0,
          clearing: 0,
          chainLevel: 0,
      hasCreature: Math.random() < CREATURE_CHANCE,
        };
        state.panelCount++;
        checkGameOver(state);
      }
      state.spawnWarnings.splice(i, 1);
    }
  }

  // Update particles & creatures
  updateParticles(state, dt);
  updateFreedCreatures(state, dt);

  // Update screen shake
  if (state.screenShake.duration > 0) {
    state.screenShake.elapsed += dt;
    if (state.screenShake.elapsed >= state.screenShake.duration) {
      state.screenShake.duration = 0;
      state.screenShake.intensity = 0;
      state.screenShake.elapsed = 0;
    }
  }
}

function checkGameOver(state: GameState): void {
  // Count cells where player can place a panel (empty or clearing)
  let placeable = 0;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const p = state.grid[r][c].panel;
      if (!p || p.clearing > 0) placeable++;
    }
  }
  // Game over if no placeable cells
  if (placeable === 0) {
    state.scene = 'gameOver';
    state.sceneTimer = 0;
    state.inputCooldown = 0.5;
  }
}

function scheduleSpawn(state: GameState): void {
  const empties: Vec2[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c].panel) continue;
      if (state.spawnWarnings.some(w => w.col === c && w.row === r)) continue;
      empties.push({ x: c, y: r });
    }
  }
  if (empties.length === 0) return;

  shuffle(empties);
  const count = Math.min(state.sceneTimer > 60 ? 2 : 1, empties.length);
  for (let i = 0; i < count; i++) {
    state.spawnWarnings.push({
      col: empties[i].x,
      row: empties[i].y,
      color: randPanelColor(NUM_COLORS),
      timer: SPAWN_WARNING_TIME,
    });
  }
}

// ---- Sandwich Check ----

interface SandwichResult {
  totalCleared: number;
  /** Max chainLevel among clearing panels involved in this sandwich (0 = none) */
  maxInvolvedChainLevel: number;
}

function checkSandwich(state: GameState, placedCol: number, placedRow: number): SandwichResult {
  const placedPanel = state.grid[placedRow][placedCol].panel;
  if (!placedPanel) return { totalCleared: 0, maxInvolvedChainLevel: 0 };
  const placedColor = placedPanel.color;

  const directions: Vec2[] = [
    { x: 1, y: 0 },  // horizontal
    { x: 0, y: 1 },  // vertical
    { x: 1, y: 1 },  // diagonal \
    { x: 1, y: -1 }, // diagonal /
  ];

  // Collect all panels to clear (between + endpoints, including placed panel)
  const toClear: Vec2[] = [];
  let sandwichHappened = false;

  for (const dir of directions) {
    const fwd = scanForSandwich(state, placedCol, placedRow, dir.x, dir.y, placedColor);
    const bwd = scanForSandwich(state, placedCol, placedRow, -dir.x, -dir.y, placedColor);

    // fwd/bwd include between panels AND the far endpoint
    if (fwd.length > 0) {
      toClear.push(...fwd);
      sandwichHappened = true;
    }
    if (bwd.length > 0) {
      toClear.push(...bwd);
      sandwichHappened = true;
    }
  }

  // If any sandwich happened, the placed panel itself also clears
  if (sandwichHappened) {
    toClear.push({ x: placedCol, y: placedRow });
  }

  // Remove duplicates and apply clears
  let totalCleared = 0;
  let maxInvolvedChainLevel = 0;
  const clearSet = new Set<string>();

  for (const pos of toClear) {
    const key = `${pos.x},${pos.y}`;
    if (clearSet.has(key)) continue;
    clearSet.add(key);

    const panel = state.grid[pos.y][pos.x].panel;
    if (!panel) continue;

    // Check if this panel was already clearing → track its chain level
    if (panel.clearing > 0) {
      if (panel.chainLevel > maxInvolvedChainLevel) {
        maxInvolvedChainLevel = panel.chainLevel;
      }
      // Reset clearing timer so it flashes again
      panel.clearing = CLEAR_ANIM_TIME;
      continue; // already counted, don't double-count
    }

    panel.clearing = CLEAR_ANIM_TIME;
    totalCleared++;
    state.clearedCount++;
    state.score += 10;
    spawnParticle(state, pos.x + 0.5, pos.y + 0.5, panelColorHex(panel.color));
    spawnParticle(state, pos.x + 0.5, pos.y + 0.5, '#ffffff');
  }

  if (totalCleared > 0) {
    state.screenShake = {
      intensity: Math.min(3 + totalCleared * 1.5, 12),
      duration: 0.3,
      elapsed: 0,
    };
  }

  return { totalCleared, maxInvolvedChainLevel };
}

/** Scan one direction for a sandwich. Returns all panels to clear:
 *  the "between" panels (different color) + the far endpoint (same color).
 *  Clearing panels of different color are included in between (they count for chain). */
function scanForSandwich(
  state: GameState, fromCol: number, fromRow: number,
  dx: number, dy: number, matchColor: PanelColor
): Vec2[] {
  const between: Vec2[] = [];
  let c = fromCol + dx;
  let r = fromRow + dy;

  while (inBounds(state, c, r)) {
    const panel = state.grid[r][c].panel;
    if (!panel) return []; // empty cell = no sandwich

    if (panel.color === matchColor) {
      // Found matching endpoint - sandwich!
      // Return between panels + this endpoint (endpoint also clears)
      if (between.length > 0) {
        between.push({ x: c, y: r }); // include the far endpoint
        return between;
      }
      return []; // nothing in between
    }

    // Different color panel (clearing or not) - part of the sandwich
    between.push({ x: c, y: r });
    c += dx;
    r += dy;
  }

  return []; // Reached edge without finding match
}

// ---- Particles ----

function spawnParticle(state: GameState, gridX: number, gridY: number, color: string): void {
  for (let i = 0; i < 5; i++) {
    state.particles.push({
      x: gridX,
      y: gridY,
      vx: randFloat(-3, 3),
      vy: randFloat(-3, 3),
      color,
      life: randFloat(0.3, 0.8),
      maxLife: randFloat(0.3, 0.8),
      size: randFloat(2, 5),
    });
  }
}

function spawnFreedCreature(state: GameState, col: number, row: number): void {
  state.freedCreatures.push({
    x: col + 0.5,
    y: row + 0.5,
    vy: -1.5,
    alpha: 1,
    color: panelColorHex(randPanelColor(NUM_COLORS)),
  });
  state.score += 50;
}

function updateParticles(state: GameState, dt: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function updateFreedCreatures(state: GameState, dt: number): void {
  for (let i = state.freedCreatures.length - 1; i >= 0; i--) {
    const c = state.freedCreatures[i];
    c.y += c.vy * dt;
    c.alpha -= dt * 0.5;
    if (c.alpha <= 0) {
      state.freedCreatures.splice(i, 1);
    }
  }
}

// ---- Helpers ----

function inBounds(state: GameState, col: number, row: number): boolean {
  return col >= 0 && col < state.cols && row >= 0 && row < state.rows;
}

export function countPanels(state: GameState): number {
  let count = 0;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c].panel) count++;
    }
  }
  return count;
}

export function getDebugInfo(state: GameState): DebugInfo {
  return {
    scene: state.scene,
    score: state.score,
    level: state.level,
    panelCount: countPanels(state),
    chainCount: state.maxChain,
  };
}

// ================================
// RENDERING
// ================================

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  cellSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  time: number;
}

export function computeLayout(canvas: HTMLCanvasElement, state: GameState): { cellSize: number; gridOffsetX: number; gridOffsetY: number } {
  const padding = 60;
  const maxW = canvas.width - padding * 2;
  const maxH = canvas.height - padding * 2 - 80;
  const cellSize = Math.floor(Math.min(maxW / state.cols, maxH / state.rows));
  const gridW = cellSize * state.cols;
  const gridH = cellSize * state.rows;
  const gridOffsetX = Math.floor((canvas.width - gridW) / 2);
  const gridOffsetY = Math.floor((canvas.height - gridH) / 2) + 30;
  return { cellSize, gridOffsetX, gridOffsetY };
}

export function render(rc: RenderContext, state: GameState): void {
  const { ctx, canvas } = rc;

  // Screen shake
  ctx.save();
  if (state.screenShake.duration > 0) {
    const progress = state.screenShake.elapsed / state.screenShake.duration;
    const intensity = state.screenShake.intensity * (1 - progress);
    ctx.translate(
      randFloat(-intensity, intensity),
      randFloat(-intensity, intensity)
    );
  }

  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  switch (state.scene) {
    case 'title':
      renderTitle(rc, state);
      break;
    case 'playing':
      renderPlaying(rc, state);
      break;
    case 'gameOver':
      renderPlaying(rc, state);
      renderGameOver(rc, state);
      break;
  }

  ctx.restore();
}

function renderTitle(rc: RenderContext, _state: GameState): void {
  const { ctx, canvas } = rc;
  const cx = canvas.width / 2;
  const isSmall = canvas.width < 500;
  const fs = (ratio: number, max: number) => Math.min(canvas.width * ratio, max);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // --- Title ---
  const titleY = isSmall ? 60 : 80;
  const glowAlpha = 0.5 + 0.3 * Math.sin(rc.time * 2);
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 30 * glowAlpha;
  ctx.font = `bold ${fs(0.1, 64)}px monospace`;
  ctx.fillStyle = '#00ffff';
  ctx.fillText('NEON SWEEP', cx, titleY);
  ctx.shadowBlur = 0;

  // --- Pip ---
  const pipY = titleY + 50 + Math.sin(rc.time * 3) * 8;
  drawPip(ctx, cx, pipY, 16, 'down', rc.time);

  // --- How to play ---
  const baseY = pipY + 40;
  const lineH = isSmall ? 22 : 26;
  const headFs = fs(0.04, 20);
  const bodyFs = fs(0.03, 16);

  // Section: Rules
  ctx.font = `bold ${headFs}px monospace`;
  ctx.fillStyle = '#ffff00';
  ctx.fillText('- 遊び方 -', cx, baseY);

  ctx.font = `${bodyFs}px monospace`;
  ctx.fillStyle = '#ccc';
  const rules = [
    'グリッド上を移動してパネルを配置します',
    '同じ色のパネルで別の色を「挟む」と',
    '挟まれたパネルが全て消えます（オセロ式）',
    '',
    '消去中のパネルは約2秒かけて消えます',
    'その間に別のサンドイッチを決めると',
    'チェインコンボ発生！大量ボーナス！',
  ];
  rules.forEach((line, i) => {
    ctx.fillStyle = line === '' ? '#ccc' : (i >= 4 ? '#ff88ff' : '#ccc');
    ctx.fillText(line, cx, baseY + lineH * (i + 1.5));
  });

  // Section: Controls
  const ctrlY = baseY + lineH * (rules.length + 2.5);
  ctx.font = `bold ${headFs}px monospace`;
  ctx.fillStyle = '#00ff80';
  ctx.fillText('- 操作方法 -', cx, ctrlY);

  ctx.font = `${bodyFs}px monospace`;
  ctx.fillStyle = '#ccc';
  const controls = [
    '移動 : 矢印キー / WASD / 十字ボタン',
    '配置 : Space / Z / Enter / Aボタン',
  ];
  controls.forEach((line, i) => {
    ctx.fillText(line, cx, ctrlY + lineH * (i + 1.5));
  });

  // Section: Tips
  const tipY = ctrlY + lineH * (controls.length + 2.5);
  ctx.font = `bold ${headFs}px monospace`;
  ctx.fillStyle = '#ff8800';
  ctx.fillText('- コツ -', cx, tipY);

  ctx.font = `${bodyFs}px monospace`;
  ctx.fillStyle = '#ccc';
  const tips = [
    'パネルは時間で増えます。埋まるとゲームオーバー！',
    '消去中のパネルも挟む端として使えます',
    'チェインを繋げて高得点を狙おう！',
  ];
  tips.forEach((line, i) => {
    ctx.fillText(line, cx, tipY + lineH * (i + 1.5));
  });

  // --- Start prompt ---
  const promptY = Math.min(tipY + lineH * (tips.length + 3), canvas.height - 40);
  const promptAlpha = 0.5 + 0.5 * Math.sin(rc.time * 4);
  ctx.globalAlpha = promptAlpha;
  ctx.font = `bold ${fs(0.045, 24)}px monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('タップ / キーを押してスタート', cx, promptY);
  ctx.globalAlpha = 1;

  ctx.restore();
}

function renderPlaying(rc: RenderContext, state: GameState): void {
  const { ctx } = rc;
  const { cellSize: cs, gridOffsetX: gx, gridOffsetY: gy } = rc;

  // Draw grid lines
  ctx.save();
  ctx.strokeStyle = '#1a1a3a';
  ctx.lineWidth = 1;
  for (let r = 0; r <= state.rows; r++) {
    ctx.beginPath();
    ctx.moveTo(gx, gy + r * cs);
    ctx.lineTo(gx + state.cols * cs, gy + r * cs);
    ctx.stroke();
  }
  for (let c = 0; c <= state.cols; c++) {
    ctx.beginPath();
    ctx.moveTo(gx + c * cs, gy);
    ctx.lineTo(gx + c * cs, gy + state.rows * cs);
    ctx.stroke();
  }
  ctx.restore();

  // Highlight current cell (where panel would be placed)
  if (state.scene === 'playing' && state.player.moveT >= 1) {
    const hx = gx + state.player.col * cs;
    const hy = gy + state.player.row * cs;
    if (!state.grid[state.player.row][state.player.col].panel) {
      // Empty cell - show where next panel would go
      const nextColor = panelColorHex(state.nextPanel.color);
      ctx.fillStyle = hexToRgba(nextColor, 0.15 + 0.05 * Math.sin(rc.time * 4));
      ctx.fillRect(hx, hy, cs, cs);
      ctx.strokeStyle = hexToRgba(nextColor, 0.4);
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + 1, hy + 1, cs - 2, cs - 2);
    }
  }

  // Spawn warnings
  for (const w of state.spawnWarnings) {
    const flash = Math.sin(rc.time * 10) * 0.3 + 0.3;
    ctx.fillStyle = hexToRgba(panelColorHex(w.color), flash * 0.4);
    ctx.fillRect(gx + w.col * cs, gy + w.row * cs, cs, cs);
    ctx.strokeStyle = hexToRgba(panelColorHex(w.color), flash);
    ctx.lineWidth = 2;
    ctx.strokeRect(gx + w.col * cs + 2, gy + w.row * cs + 2, cs - 4, cs - 4);
  }

  // Draw panels
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const panel = state.grid[r][c].panel;
      if (!panel) continue;
      const px = gx + c * cs;
      const py = gy + r * cs;
      drawPanel(ctx, px, py, cs, panel, rc.time);
    }
  }

  // Draw player (Pip)
  const pt = easeOutQuad(state.player.moveT);
  const pipGridX = lerp(state.player.prevCol, state.player.col, pt);
  const pipGridY = lerp(state.player.prevRow, state.player.row, pt);
  const pipX = gx + (pipGridX + 0.5) * cs;
  const pipY = gy + (pipGridY + 0.5) * cs;
  const pipR = cs * 0.25;

  drawPip(ctx, pipX, pipY, pipR, state.player.facing, rc.time);

  // Draw particles
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    const px = gx + p.x * cs;
    const py = gy + p.y * cs;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Draw freed creatures
  for (const c of state.freedCreatures) {
    const px = gx + c.x * cs;
    const py = gy + c.y * cs;
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    // Wings
    const wingFlap = Math.sin(rc.time * 15) * 4;
    ctx.beginPath();
    ctx.ellipse(px - 8, py - 2 + wingFlap, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + 8, py - 2 - wingFlap, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(px - 2, py - 1, 1.2, 0, Math.PI * 2);
    ctx.arc(px + 2, py - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // HUD
  renderHUD(rc, state);
}

function drawPanel(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  size: number, panel: Panel, time: number
): void {
  const margin = size * 0.08;
  const fadeIn = Math.min(1, panel.age / 0.3);

  ctx.save();

  if (panel.clearing > 0) {
    // progress: 0 (just started) → 1 (about to disappear)
    const progress = 1 - panel.clearing / CLEAR_ANIM_TIME;
    // Smooth fade out: fully visible at start, transparent at end
    ctx.globalAlpha = 1 - progress;

    const color = panelColorHex(panel.color);
    const dimColor = panelColorDim(panel.color);

    // Shrink slightly as it fades
    const shrink = progress * size * 0.15;

    // Glow fades with panel
    drawGlow(ctx, x + size / 2, y + size / 2, size * 0.8, color, 0.4 * (1 - progress));

    // Main rect
    ctx.fillStyle = dimColor;
    drawRoundedRect(ctx, x + margin + shrink, y + margin + shrink,
      size - margin * 2 - shrink * 2, size - margin * 2 - shrink * 2, 4);
    ctx.fill();

    // Colored border
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, x + margin + shrink, y + margin + shrink,
      size - margin * 2 - shrink * 2, size - margin * 2 - shrink * 2, 4);
    ctx.stroke();

    // Shape symbol
    drawPanelShape(ctx, x + size / 2, y + size / 2, size * 0.35 * (1 - progress * 0.5), panel.color);

    ctx.restore();
    return;
  }

  ctx.globalAlpha = fadeIn;

  const color = panelColorHex(panel.color);
  const dimColor = panelColorDim(panel.color);
  const glow = 0.15 + 0.05 * Math.sin(time * 2 + panel.color * 1.3);

  // Glow behind
  drawGlow(ctx, x + size / 2, y + size / 2, size * 0.7, color, glow);

  // Main rect
  ctx.fillStyle = dimColor;
  drawRoundedRect(ctx, x + margin, y + margin, size - margin * 2, size - margin * 2, 4);
  ctx.fill();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x + margin, y + margin, size - margin * 2, size - margin * 2, 4);
  ctx.stroke();

  // Shape symbol
  drawPanelShape(ctx, x + size / 2, y + size / 2, size * 0.35, panel.color);

  // Creature indicator
  if (panel.hasCreature) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 4 + panel.color);
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPip(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  r: number, facing: Direction, time: number
): void {
  ctx.save();

  // Glow trail
  const trailGlow = 0.2 + 0.1 * Math.sin(time * 4);
  drawGlow(ctx, x, y, r * 2.5, '#00ffff', trailGlow);

  // Idle bounce
  const bounce = Math.sin(time * 3) * 2;

  // Body
  const grad = ctx.createRadialGradient(x, y + bounce - r * 0.2, 0, x, y + bounce, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#88ffff');
  grad.addColorStop(1, '#00aaaa');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y + bounce, r, 0, Math.PI * 2);
  ctx.fill();

  // Border glow
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y + bounce, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Eyes
  let eyeOffX = 0;
  let eyeOffY = 0;
  switch (facing) {
    case 'up': eyeOffY = -r * 0.2; break;
    case 'down': eyeOffY = r * 0.2; break;
    case 'left': eyeOffX = -r * 0.2; break;
    case 'right': eyeOffX = r * 0.2; break;
  }

  const eyeSpacing = r * 0.3;
  const eyeR = r * 0.15;

  let e1x: number, e1y: number, e2x: number, e2y: number;
  if (facing === 'up' || facing === 'down') {
    e1x = x - eyeSpacing;
    e2x = x + eyeSpacing;
    e1y = y + bounce + eyeOffY;
    e2y = y + bounce + eyeOffY;
  } else {
    e1x = x + eyeOffX;
    e2x = x + eyeOffX;
    e1y = y + bounce - eyeSpacing;
    e2y = y + bounce + eyeSpacing;
  }

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(e1x + 1, e1y - 1, eyeR * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e2x + 1, e2y - 1, eyeR * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function renderHUD(rc: RenderContext, state: GameState): void {
  const { ctx, canvas } = rc;
  const { cellSize: cs, gridOffsetX: gx, gridOffsetY: gy } = rc;
  ctx.save();
  ctx.textBaseline = 'top';

  const hudY = 8;
  const fontSize = Math.min(canvas.width * 0.035, 18);
  ctx.font = `bold ${fontSize}px monospace`;

  // Score
  ctx.fillStyle = '#00ffff';
  ctx.textAlign = 'left';
  ctx.fillText(`スコア: ${state.score}`, 10, hudY);

  // Cleared count
  ctx.textAlign = 'right';
  ctx.fillStyle = '#00ff80';
  ctx.fillText(`消去: ${state.clearedCount}`, canvas.width - 10, hudY);

  // Chain indicator - show prominently when chaining
  if (state.chainCount > 1) {
    const chainSize = fontSize * (1.5 + state.chainCount * 0.2);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.min(chainSize, 60)}px monospace`;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 20 + state.chainCount * 5;
    ctx.fillStyle = '#ff00ff';
    ctx.fillText(`${state.chainCount} CHAIN!`, canvas.width / 2, gy - 20);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Next panel display (right side of grid)
  const nextX = gx + state.cols * cs + 15;
  const nextY = gy;
  ctx.font = `bold ${fontSize * 0.8}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.fillText('NEXT', nextX, nextY);

  // Current next panel
  const npSize = cs * 0.8;
  drawPanel(ctx, nextX, nextY + fontSize + 5, npSize, {
    color: state.nextPanel.color,
    age: 1,
    clearing: 0,
    chainLevel: 0,
      hasCreature: false,
  }, rc.time);

  // Queue
  for (let i = 0; i < state.nextPanel.queue.length; i++) {
    const qSize = cs * 0.6;
    const qy = nextY + fontSize + 5 + npSize + 8 + i * (qSize + 4);
    ctx.globalAlpha = 0.6;
    drawPanel(ctx, nextX + (npSize - qSize) / 2, qy, qSize, {
      color: state.nextPanel.queue[i],
      age: 1,
      clearing: 0,
      chainLevel: 0,
      hasCreature: false,
    }, rc.time);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function renderGameOver(rc: RenderContext, state: GameState): void {
  const { ctx, canvas } = rc;

  ctx.save();
  ctx.fillStyle = 'rgba(10,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(canvas.width * 0.08, 48)}px monospace`;
  ctx.fillStyle = '#ff3333';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 20;
  ctx.fillText('ゲームオーバー', canvas.width / 2, canvas.height / 2 - 40);
  ctx.shadowBlur = 0;

  ctx.font = `${Math.min(canvas.width * 0.045, 24)}px monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`スコア: ${state.score}`, canvas.width / 2, canvas.height / 2 + 10);
  ctx.fillText(`消去数: ${state.clearedCount}`, canvas.width / 2, canvas.height / 2 + 40);

  const promptAlpha = 0.5 + 0.5 * Math.sin(rc.time * 4);
  ctx.globalAlpha = promptAlpha;
  ctx.font = `${Math.min(canvas.width * 0.035, 18)}px monospace`;
  ctx.fillStyle = '#aaa';
  ctx.fillText('タップ / キーでリトライ', canvas.width / 2, canvas.height / 2 + 90);

  ctx.restore();
}

// ---- Mobile Controls Rendering ----

export interface VirtualControls {
  dpadCenterX: number;
  dpadCenterY: number;
  dpadRadius: number;
  actionX: number;
  actionY: number;
  actionRadius: number;
}

export function computeVirtualControls(canvas: HTMLCanvasElement): VirtualControls {
  const size = Math.min(canvas.width, canvas.height) * 0.12;
  const margin = size * 1.8;
  return {
    dpadCenterX: margin,
    dpadCenterY: canvas.height - margin,
    dpadRadius: size,
    actionX: canvas.width - margin,
    actionY: canvas.height - margin,
    actionRadius: size,
  };
}

export function renderVirtualControls(
  ctx: CanvasRenderingContext2D,
  vc: VirtualControls,
  isMobile: boolean
): void {
  if (!isMobile) return;

  ctx.save();
  ctx.globalAlpha = 0.25;

  const { dpadCenterX: dx, dpadCenterY: dy, dpadRadius: dr } = vc;
  const btnSize = dr * 0.7;

  drawArrowButton(ctx, dx, dy - dr, btnSize, 'up');
  drawArrowButton(ctx, dx, dy + dr, btnSize, 'down');
  drawArrowButton(ctx, dx - dr, dy, btnSize, 'left');
  drawArrowButton(ctx, dx + dr, dy, btnSize, 'right');

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(dx, dy, btnSize * 0.5, 0, Math.PI * 2);
  ctx.fill();

  const { actionX: ax, actionY: ay, actionRadius: ar } = vc;
  ctx.fillStyle = '#00aaaa';
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${ar * 0.6}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', ax, ay);

  ctx.restore();
}

function drawArrowButton(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  size: number, dir: Direction
): void {
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  const s = size * 0.5;
  switch (dir) {
    case 'up':
      ctx.moveTo(x, y - s);
      ctx.lineTo(x - s, y + s * 0.5);
      ctx.lineTo(x + s, y + s * 0.5);
      break;
    case 'down':
      ctx.moveTo(x, y + s);
      ctx.lineTo(x - s, y - s * 0.5);
      ctx.lineTo(x + s, y - s * 0.5);
      break;
    case 'left':
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s * 0.5, y - s);
      ctx.lineTo(x + s * 0.5, y + s);
      break;
    case 'right':
      ctx.moveTo(x + s, y);
      ctx.lineTo(x - s * 0.5, y - s);
      ctx.lineTo(x - s * 0.5, y + s);
      break;
  }
  ctx.closePath();
  ctx.fill();
}
