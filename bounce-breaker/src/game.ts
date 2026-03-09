import type { GameData, Ball, Block, BallItem, Particle, Vec2 } from "./types";
import {
  vecAdd, vecScale, vecNormalize, vecLen,
  randInt, randFloat, clampAngle,
  getBlockColor, roundRect,
} from "./utils";

// ---- 定数 ----
const GRID_COLS = 7;
const GRID_VISIBLE_ROWS = 9;  // 表示行数
const BALL_RADIUS = 6;
const BALL_SPEED = 600; // px/sec (通常時)
const LAUNCH_INTERVAL = 0.08; // ボール発射間隔（秒）
const ITEM_RADIUS = 14;
const BLOCK_PADDING = 3;
const BLOCK_CORNER_RADIUS = 6;
const FAST_FORWARD_MULTIPLIER = 3;
const FF_BUTTON_SIZE = 44;

// ---- ゲーム初期化 ----
export function createGame(canvasW: number, canvasH: number): GameData {
  const layout = computeLayout(canvasW, canvasH);
  const game: GameData = {
    state: "title",
    turn: 0,
    score: 0,
    balls: [],
    ballCount: 3,
    blocks: [],
    items: [],
    particles: [],
    launchPos: { x: layout.offsetX + layout.cellSize * GRID_COLS / 2, y: layout.deadlineY },
    aimAngle: Math.PI / 2,
    ballsLaunched: 0,
    launchTimer: 0,
    nextLandX: layout.offsetX + layout.cellSize * GRID_COLS / 2,
    firstLanded: false,
    fastForward: false,
    gridCols: GRID_COLS,
    gridRows: GRID_VISIBLE_ROWS,
    cellSize: layout.cellSize,
    offsetX: layout.offsetX,
    offsetY: layout.offsetY,
    deadlineY: layout.deadlineY,
    canvasW,
    canvasH,
    pointerPos: { x: canvasW / 2, y: canvasH / 2 },
    pointerDown: false,
  };
  return game;
}

interface LayoutInfo {
  cellSize: number;
  offsetX: number;
  offsetY: number;
  deadlineY: number;
}

function computeLayout(canvasW: number, canvasH: number): LayoutInfo {
  // グリッドはCanvas幅に収まるようにする
  const maxCellW = Math.floor(canvasW / GRID_COLS);
  // 高さ方面: 上部にスコア領域、下部にボール発射領域を確保
  const topMargin = 60;
  const bottomMargin = 80;
  const availableH = canvasH - topMargin - bottomMargin;
  const maxCellH = Math.floor(availableH / GRID_VISIBLE_ROWS);
  const cellSize = Math.min(maxCellW, maxCellH, 64); // 最大64pxに制限

  const gridW = cellSize * GRID_COLS;
  const gridH = cellSize * GRID_VISIBLE_ROWS;
  const offsetX = Math.floor((canvasW - gridW) / 2);
  const offsetY = topMargin;
  const deadlineY = offsetY + gridH;

  return { cellSize, offsetX, offsetY, deadlineY };
}

/** リサイズ時にレイアウト再計算 */
export function resizeGame(game: GameData, canvasW: number, canvasH: number): void {
  const layout = computeLayout(canvasW, canvasH);
  // 発射位置を新レイアウトに合わせて調整
  const oldGridW = game.cellSize * game.gridCols;
  const newGridW = layout.cellSize * game.gridCols;
  const relX = oldGridW > 0 ? (game.launchPos.x - game.offsetX) / oldGridW : 0.5;

  game.cellSize = layout.cellSize;
  game.offsetX = layout.offsetX;
  game.offsetY = layout.offsetY;
  game.deadlineY = layout.deadlineY;
  game.canvasW = canvasW;
  game.canvasH = canvasH;
  game.launchPos.x = layout.offsetX + newGridW * relX;
  game.launchPos.y = layout.deadlineY;
  game.nextLandX = layout.offsetX + newGridW * relX;
}

// ---- ターン管理 ----

/** 新しいターンを開始: ブロック行を1行下げて新行を追加 */
function startNewTurn(game: GameData): void {
  game.turn++;
  game.score = game.turn;

  // 全ブロック・アイテムを1行下に移動
  for (const b of game.blocks) {
    b.row++;
  }
  for (const item of game.items) {
    item.row++;
  }

  // ゲームオーバー判定: ブロックがデッドライン行に到達
  for (const b of game.blocks) {
    if (b.row >= GRID_VISIBLE_ROWS) {
      game.state = "gameOver";
      return;
    }
  }

  // 最上段に新しいブロック行を生成
  generateNewRow(game);

  // 発射位置を更新
  game.launchPos.x = game.nextLandX;
  game.launchPos.y = game.deadlineY;
  game.firstLanded = false;
  game.fastForward = false;

  game.state = "aiming";
}

/** 新しいブロック行を生成 */
function generateNewRow(game: GameData): void {
  const hp = game.turn; // HPはターン数に比例
  const filledCols: number[] = [];

  // ランダムにいくつかの列にブロックを配置 (2〜4個)
  const count = randInt(2, 4);
  const available = Array.from({ length: GRID_COLS }, (_, i) => i);

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = randInt(0, available.length - 1);
    const col = available[idx];
    available.splice(idx, 1);
    filledCols.push(col);

    const blockHp = randInt(Math.max(1, Math.floor(hp * 0.3)), Math.ceil(hp * 1.0));
    game.blocks.push({
      col,
      row: 0,
      hp: blockHp,
      color: getBlockColor(blockHp),
    });
  }

  // ブロック列の隣にボール追加アイテムを配置（80%の確率）
  // ブロック隣の空列を優先（ボールが通りやすい場所）
  const emptyCols = Array.from({ length: GRID_COLS }, (_, i) => i).filter(
    (c) => !filledCols.includes(c)
  );
  if (emptyCols.length > 0 && Math.random() < 0.8) {
    // ブロック列に隣接する空列を優先
    const adjacentEmpty = emptyCols.filter((c) =>
      filledCols.some((fc) => Math.abs(fc - c) === 1)
    );
    const candidates = adjacentEmpty.length > 0 ? adjacentEmpty : emptyCols;
    const col = candidates[randInt(0, candidates.length - 1)];
    game.items.push({ col, row: 0, collected: false });
  }
}

// ---- 発射 ----

function launchBalls(game: GameData): void {
  game.state = "shooting";
  game.balls = [];
  game.ballsLaunched = 0;
  game.launchTimer = 0;
  game.firstLanded = false;
}

// ---- 更新 ----

export function update(game: GameData, dt: number): void {
  // パーティクル更新はどの状態でも実行
  updateParticles(game, dt);

  switch (game.state) {
    case "title":
      break;

    case "aiming":
      updateAiming(game);
      break;

    case "shooting":
      updateShooting(game, dt);
      break;

    case "turnEnd":
      startNewTurn(game);
      break;

    case "gameOver":
      break;
  }
}

function updateAiming(game: GameData): void {
  // ポインタ位置から角度を計算
  const dx = game.pointerPos.x - game.launchPos.x;
  const dy = game.pointerPos.y - game.launchPos.y;
  // 上方向に発射したいので、dyが負のときのみ有効
  if (dy < -10) {
    const angle = Math.atan2(-dy, dx); // 上向きを正にする
    game.aimAngle = clampAngle(angle);
  }
}

function updateShooting(game: GameData, dt: number): void {
  const speed = game.fastForward ? FAST_FORWARD_MULTIPLIER : 1;
  const effectiveDt = dt * speed;

  // ボールの順次発射
  if (game.ballsLaunched < game.ballCount) {
    game.launchTimer += effectiveDt;
    while (game.launchTimer >= LAUNCH_INTERVAL && game.ballsLaunched < game.ballCount) {
      game.launchTimer -= LAUNCH_INTERVAL;
      const dir: Vec2 = {
        x: Math.cos(game.aimAngle),
        y: -Math.sin(game.aimAngle),
      };
      const vel = vecScale(dir, BALL_SPEED);
      game.balls.push({
        pos: { x: game.launchPos.x, y: game.launchPos.y },
        vel,
        active: true,
      });
      game.ballsLaunched++;
    }
  }

  // ボール移動・衝突
  const substeps = game.fastForward ? 3 : 2;
  const subDt = effectiveDt / substeps;
  for (let s = 0; s < substeps; s++) {
    for (const ball of game.balls) {
      if (!ball.active) continue;
      updateBall(game, ball, subDt);
    }
  }

  // 全ボールが非アクティブならターン終了
  if (game.ballsLaunched >= game.ballCount && game.balls.every((b) => !b.active)) {
    // 回収されたアイテムを除外
    game.items = game.items.filter((item) => !item.collected);
    // 消滅したブロックを除外
    game.blocks = game.blocks.filter((b) => b.hp > 0);
    game.state = "turnEnd";
  }
}

function updateBall(game: GameData, ball: Ball, dt: number): void {
  const gridLeft = game.offsetX;
  const gridRight = game.offsetX + game.cellSize * game.gridCols;
  const gridTop = game.offsetY;

  // 移動
  ball.pos = vecAdd(ball.pos, vecScale(ball.vel, dt));

  // 壁反射（左右）
  if (ball.pos.x - BALL_RADIUS < gridLeft) {
    ball.pos.x = gridLeft + BALL_RADIUS;
    ball.vel.x = Math.abs(ball.vel.x);
  }
  if (ball.pos.x + BALL_RADIUS > gridRight) {
    ball.pos.x = gridRight - BALL_RADIUS;
    ball.vel.x = -Math.abs(ball.vel.x);
  }

  // 天井反射
  if (ball.pos.y - BALL_RADIUS < gridTop) {
    ball.pos.y = gridTop + BALL_RADIUS;
    ball.vel.y = Math.abs(ball.vel.y);
  }

  // 床落下判定
  if (ball.pos.y > game.deadlineY + BALL_RADIUS * 2) {
    ball.active = false;
    // 最初に落ちたボールの位置を記録
    if (!game.firstLanded) {
      game.firstLanded = true;
      // X座標をグリッド内にクランプ
      game.nextLandX = Math.max(gridLeft + BALL_RADIUS, Math.min(gridRight - BALL_RADIUS, ball.pos.x));
    }
    return;
  }

  // ブロックとの衝突
  collideWithBlocks(game, ball);

  // アイテムとの衝突
  collideWithItems(game, ball);
}

function collideWithBlocks(game: GameData, ball: Ball): void {
  const r = BALL_RADIUS;

  for (const block of game.blocks) {
    if (block.hp <= 0) continue;

    const bx = game.offsetX + block.col * game.cellSize + BLOCK_PADDING;
    const by = game.offsetY + block.row * game.cellSize + BLOCK_PADDING;
    const bw = game.cellSize - BLOCK_PADDING * 2;
    const bh = game.cellSize - BLOCK_PADDING * 2;

    // AABB vs Circle 衝突判定
    const closestX = Math.max(bx, Math.min(ball.pos.x, bx + bw));
    const closestY = Math.max(by, Math.min(ball.pos.y, by + bh));
    const dx = ball.pos.x - closestX;
    const dy = ball.pos.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < r * r) {
      // 衝突！ HP減少
      block.hp--;
      block.color = getBlockColor(block.hp);

      if (block.hp <= 0) {
        // 破壊エフェクト
        spawnDestroyParticles(game, bx + bw / 2, by + bh / 2, block.color);
      }

      // 反射方向を決定
      // ブロックの中心からの相対位置で判定
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const relX = ball.pos.x - cx;
      const relY = ball.pos.y - cy;

      // どの面に当たったかを判定
      const overlapX = bw / 2 + r - Math.abs(relX);
      const overlapY = bh / 2 + r - Math.abs(relY);

      if (overlapX < overlapY) {
        // 左右面に当たった
        ball.vel.x = Math.abs(ball.vel.x) * Math.sign(relX);
        ball.pos.x = closestX + r * Math.sign(relX);
      } else {
        // 上下面に当たった
        ball.vel.y = Math.abs(ball.vel.y) * Math.sign(relY);
        ball.pos.y = closestY + r * Math.sign(relY);
      }

      // 速度を一定に保つ
      const len = vecLen(ball.vel);
      if (len > 0) {
        ball.vel = vecScale(vecNormalize(ball.vel), BALL_SPEED);
      }

      // 1フレームにつき1ブロックのみ衝突
      break;
    }
  }
}

function collideWithItems(game: GameData, ball: Ball): void {
  for (const item of game.items) {
    if (item.collected) continue;

    const ix = game.offsetX + item.col * game.cellSize + game.cellSize / 2;
    const iy = game.offsetY + item.row * game.cellSize + game.cellSize / 2;
    const dx = ball.pos.x - ix;
    const dy = ball.pos.y - iy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < BALL_RADIUS + ITEM_RADIUS) {
      item.collected = true;
      game.ballCount++;
      // アイテム獲得エフェクト
      spawnItemParticles(game, ix, iy);
    }
  }
}

// ---- パーティクル ----

function spawnDestroyParticles(game: GameData, x: number, y: number, color: string): void {
  for (let i = 0; i < 12; i++) {
    const angle = randFloat(0, Math.PI * 2);
    const speed = randFloat(80, 200);
    game.particles.push({
      pos: { x, y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      life: randFloat(0.3, 0.7),
      maxLife: 0.7,
      color,
      size: randFloat(2, 5),
    });
  }
}

function spawnItemParticles(game: GameData, x: number, y: number): void {
  for (let i = 0; i < 8; i++) {
    const angle = randFloat(0, Math.PI * 2);
    const speed = randFloat(50, 150);
    game.particles.push({
      pos: { x, y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      life: randFloat(0.2, 0.5),
      maxLife: 0.5,
      color: "#ffffff",
      size: randFloat(2, 4),
    });
  }
}

function updateParticles(game: GameData, dt: number): void {
  for (const p of game.particles) {
    p.life -= dt;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.vel.x *= 0.97;
    p.vel.y *= 0.97;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

// ---- 描画 ----

export function render(game: GameData, ctx: CanvasRenderingContext2D): void {
  const { canvasW, canvasH } = game;

  // 背景
  ctx.fillStyle = "#0a0e27";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // グリッド領域の薄い背景
  const gridW = game.cellSize * game.gridCols;
  const gridH = game.cellSize * game.gridRows;
  ctx.fillStyle = "rgba(20, 30, 60, 0.5)";
  ctx.fillRect(game.offsetX, game.offsetY, gridW, gridH);

  // グリッド線（薄く）
  ctx.strokeStyle = "rgba(50, 70, 120, 0.3)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= game.gridCols; c++) {
    const x = game.offsetX + c * game.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, game.offsetY);
    ctx.lineTo(x, game.deadlineY);
    ctx.stroke();
  }
  for (let r = 0; r <= game.gridRows; r++) {
    const y = game.offsetY + r * game.cellSize;
    ctx.beginPath();
    ctx.moveTo(game.offsetX, y);
    ctx.lineTo(game.offsetX + gridW, y);
    ctx.stroke();
  }

  // デッドライン
  ctx.strokeStyle = "rgba(255, 50, 50, 0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(game.offsetX, game.deadlineY);
  ctx.lineTo(game.offsetX + gridW, game.deadlineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // ブロック描画
  renderBlocks(game, ctx);

  // アイテム描画
  renderItems(game, ctx);

  // ボール描画
  renderBalls(game, ctx);

  // パーティクル描画
  renderParticles(game, ctx);

  // 照準ライン
  if (game.state === "aiming") {
    renderAimLine(game, ctx);
  }

  // UI
  renderUI(game, ctx);

  // 状態に応じたオーバーレイ
  if (game.state === "title") {
    renderTitleScreen(game, ctx);
  } else if (game.state === "gameOver") {
    renderGameOverScreen(game, ctx);
  }
}

function renderBlocks(game: GameData, ctx: CanvasRenderingContext2D): void {
  for (const block of game.blocks) {
    if (block.hp <= 0) continue;

    const x = game.offsetX + block.col * game.cellSize + BLOCK_PADDING;
    const y = game.offsetY + block.row * game.cellSize + BLOCK_PADDING;
    const w = game.cellSize - BLOCK_PADDING * 2;
    const h = game.cellSize - BLOCK_PADDING * 2;

    // ブロック本体（角丸）
    ctx.save();
    roundRect(ctx, x, y, w, h, BLOCK_CORNER_RADIUS);
    ctx.fillStyle = block.color;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = block.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // グロー効果
    ctx.shadowColor = block.color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // HP数字
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(10, Math.floor(game.cellSize * 0.35))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(block.hp), x + w / 2, y + h / 2);
  }
}

function renderItems(game: GameData, ctx: CanvasRenderingContext2D): void {
  for (const item of game.items) {
    if (item.collected) continue;

    const cx = game.offsetX + item.col * game.cellSize + game.cellSize / 2;
    const cy = game.offsetY + item.row * game.cellSize + game.cellSize / 2;

    // 外円
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, ITEM_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // +マーク
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx + 5, cy);
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx, cy + 5);
    ctx.stroke();
  }
}

function renderBalls(game: GameData, ctx: CanvasRenderingContext2D): void {
  for (const ball of game.balls) {
    if (!ball.active) continue;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.pos.x, ball.pos.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();

    // 軌跡（小さい透明の円）
    ctx.beginPath();
    ctx.arc(ball.pos.x - ball.vel.x * 0.005, ball.pos.y - ball.vel.y * 0.005, BALL_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fill();
  }

  // 発射待ちのボール（発射位置に表示）
  if (game.state === "aiming") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(game.launchPos.x, game.launchPos.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();
  }
}

function renderParticles(game: GameData, ctx: CanvasRenderingContext2D): void {
  for (const p of game.particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function renderAimLine(game: GameData, ctx: CanvasRenderingContext2D): void {
  const dir: Vec2 = {
    x: Math.cos(game.aimAngle),
    y: -Math.sin(game.aimAngle),
  };

  // 点線で照準ラインを描画
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  const maxLen = Math.max(game.canvasW, game.canvasH) * 1.5;
  const gridLeft = game.offsetX;
  const gridRight = game.offsetX + game.cellSize * game.gridCols;
  const gridTop = game.offsetY;

  // 反射シミュレーション（壁＋ブロック）で照準線を描画
  let px = game.launchPos.x;
  let py = game.launchPos.y;
  let dx = dir.x;
  let dy = dir.y;
  let totalLen = 0;

  ctx.beginPath();
  ctx.moveTo(px, py);

  for (let bounces = 0; bounces < 5 && totalLen < maxLen; bounces++) {
    // 次の壁との衝突点を計算
    let minT = maxLen;
    let hitType: "left" | "right" | "top" | "blockH" | "blockV" | "none" = "none";

    // 左壁
    if (dx < 0) {
      const t = (gridLeft - px) / dx;
      if (t > 0.01 && t < minT) { minT = t; hitType = "left"; }
    }
    // 右壁
    if (dx > 0) {
      const t = (gridRight - px) / dx;
      if (t > 0.01 && t < minT) { minT = t; hitType = "right"; }
    }
    // 天井
    if (dy < 0) {
      const t = (gridTop - py) / dy;
      if (t > 0.01 && t < minT) { minT = t; hitType = "top"; }
    }

    // ブロックとのレイ衝突判定
    for (const block of game.blocks) {
      if (block.hp <= 0) continue;

      const bx = game.offsetX + block.col * game.cellSize + BLOCK_PADDING;
      const by = game.offsetY + block.row * game.cellSize + BLOCK_PADDING;
      const bw = game.cellSize - BLOCK_PADDING * 2;
      const bh = game.cellSize - BLOCK_PADDING * 2;

      // AABB のレイキャスト（ボール半径を考慮して膨張させる）
      const r = BALL_RADIUS;
      const left = bx - r;
      const right = bx + bw + r;
      const top = by - r;
      const bottom = by + bh + r;

      let tEnter = 0;
      let tExit = minT;
      let enterSide: "h" | "v" = "h";

      // X軸スラブ
      if (Math.abs(dx) > 1e-8) {
        const t1 = (left - px) / dx;
        const t2 = (right - px) / dx;
        const tMin = Math.min(t1, t2);
        const tMax = Math.max(t1, t2);
        if (tMin > tEnter) { tEnter = tMin; enterSide = "h"; }
        if (tMax < tExit) tExit = tMax;
      } else {
        if (px < left || px > right) continue;
      }

      // Y軸スラブ
      if (Math.abs(dy) > 1e-8) {
        const t1 = (top - py) / dy;
        const t2 = (bottom - py) / dy;
        const tMin = Math.min(t1, t2);
        const tMax = Math.max(t1, t2);
        if (tMin > tEnter) { tEnter = tMin; enterSide = "v"; }
        if (tMax < tExit) tExit = tMax;
      } else {
        if (py < top || py > bottom) continue;
      }

      if (tEnter < tExit && tEnter > 0.01 && tEnter < minT) {
        minT = tEnter;
        hitType = enterSide === "h" ? "blockH" : "blockV";
      }
    }

    const nextX = px + dx * minT;
    const nextY = py + dy * minT;

    ctx.lineTo(nextX, nextY);
    totalLen += minT;

    // 反射
    if (hitType === "left" || hitType === "right" || hitType === "blockH") {
      dx = -dx;
    }
    if (hitType === "top" || hitType === "blockV") {
      dy = -dy;
    }
    if (hitType === "none") {
      break;
    }

    px = nextX;
    py = nextY;
  }

  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ドラッグガイドの表示（初回ターンのみ）
  if (game.turn <= 1) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("↕ ドラッグで狙う", game.launchPos.x, game.launchPos.y - 20);
    ctx.restore();
  }
}

function renderUI(game: GameData, ctx: CanvasRenderingContext2D): void {
  // スコア表示
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`ターン: ${game.turn}`, game.offsetX + 8, 10);

  // ボール数表示
  ctx.textAlign = "right";
  const gridRight = game.offsetX + game.cellSize * game.gridCols;
  ctx.fillText(`×${game.ballCount}`, gridRight - 8, 10);

  // ボールアイコン
  ctx.beginPath();
  ctx.arc(gridRight - ctx.measureText(`×${game.ballCount}`).width - 18, 20, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // 早送りボタン（shooting中のみ）
  if (game.state === "shooting") {
    renderFastForwardButton(game, ctx);
  }
}

function renderFastForwardButton(game: GameData, ctx: CanvasRenderingContext2D): void {
  const btnX = game.offsetX + game.cellSize * game.gridCols - FF_BUTTON_SIZE - 8;
  const btnY = game.deadlineY + 12;
  const size = FF_BUTTON_SIZE;

  ctx.save();
  // ボタン背景
  roundRect(ctx, btnX, btnY, size, size, 8);
  ctx.fillStyle = game.fastForward ? "rgba(0, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.15)";
  ctx.fill();
  ctx.strokeStyle = game.fastForward ? "#00ffff" : "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // >> アイコン
  const cx = btnX + size / 2;
  const cy = btnY + size / 2;
  ctx.fillStyle = game.fastForward ? "#00ffff" : "#ffffff";
  // 三角1
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 8);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx - 10, cy + 8);
  ctx.fill();
  // 三角2
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 8);
  ctx.lineTo(cx + 12, cy);
  ctx.lineTo(cx + 2, cy + 8);
  ctx.fill();
  ctx.restore();
}

function renderTitleScreen(game: GameData, ctx: CanvasRenderingContext2D): void {
  // 半透明オーバーレイ
  ctx.fillStyle = "rgba(10, 14, 39, 0.85)";
  ctx.fillRect(0, 0, game.canvasW, game.canvasH);

  const cx = game.canvasW / 2;
  const cy = game.canvasH / 2;

  // タイトル
  ctx.fillStyle = "#00ffff";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 20;
  ctx.fillText("バウンスブレイカー", cx, cy - 80);
  ctx.restore();

  // サブタイトル
  ctx.fillStyle = "#ff00ff";
  ctx.font = "18px sans-serif";
  ctx.fillText("ブロック崩し × 物理パズル", cx, cy - 40);

  // 操作説明
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "15px sans-serif";
  ctx.fillText("角度を決めてボールを発射し", cx, cy + 20);
  ctx.fillText("ブロックを破壊しよう！", cx, cy + 45);

  // スタートボタン
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
  ctx.globalAlpha = pulse;
  ctx.fillText("タップしてスタート", cx, cy + 110);
  ctx.globalAlpha = 1;
}

function renderGameOverScreen(game: GameData, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(10, 14, 39, 0.92)";
  ctx.fillRect(0, 0, game.canvasW, game.canvasH);

  const cx = game.canvasW / 2;
  const cy = game.canvasH / 2;

  ctx.fillStyle = "#ff3377";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.shadowColor = "#ff3377";
  ctx.shadowBlur = 20;
  ctx.fillText("ゲームオーバー", cx, cy - 60);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "24px sans-serif";
  ctx.fillText(`スコア: ${game.score} ターン`, cx, cy);

  ctx.fillStyle = "#00ffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`ボール数: ${game.ballCount}`, cx, cy + 40);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
  ctx.globalAlpha = pulse;
  ctx.fillText("タップしてリトライ", cx, cy + 100);
  ctx.globalAlpha = 1;
}

// ---- 入力ハンドラ ----

export function handlePointerDown(game: GameData, x: number, y: number): void {
  game.pointerPos = { x, y };
  game.pointerDown = true;

  if (game.state === "title") {
    // ゲーム開始
    startNewTurn(game);
    return;
  }

  if (game.state === "gameOver") {
    // リスタート: 古いプロパティが残らないよう既存キーを全削除してから上書き
    const newGame = createGame(game.canvasW, game.canvasH);
    for (const key of Object.keys(game) as Array<keyof GameData>) {
      delete (game as unknown as Record<string, unknown>)[key];
    }
    Object.assign(game, newGame);
    startNewTurn(game);
    return;
  }

  if (game.state === "shooting") {
    // 早送りボタンの判定
    const btnX = game.offsetX + game.cellSize * game.gridCols - FF_BUTTON_SIZE - 8;
    const btnY = game.deadlineY + 12;
    if (x >= btnX && x <= btnX + FF_BUTTON_SIZE && y >= btnY && y <= btnY + FF_BUTTON_SIZE) {
      game.fastForward = !game.fastForward;
    }
    return;
  }
}

export function handlePointerMove(game: GameData, x: number, y: number): void {
  game.pointerPos = { x, y };
}

// ---- デバッグAPI ----

export interface DebugState {
  state: string;
  turn: number;
  score: number;
  ballCount: number;
  activeBalls: number;
  blocks: Array<{ col: number; row: number; hp: number }>;
  items: Array<{ col: number; row: number; collected: boolean }>;
  launchPos: { x: number; y: number };
  aimAngle: number;
  grid: { cols: number; rows: number; cellSize: number; offsetX: number; offsetY: number; deadlineY: number };
  canvas: { w: number; h: number };
}

export function getDebugState(game: GameData): DebugState {
  return {
    state: game.state,
    turn: game.turn,
    score: game.score,
    ballCount: game.ballCount,
    activeBalls: game.balls.filter(b => b.active).length,
    blocks: game.blocks.filter(b => b.hp > 0).map(b => ({ col: b.col, row: b.row, hp: b.hp })),
    items: game.items.map(i => ({ col: i.col, row: i.row, collected: i.collected })),
    launchPos: { x: game.launchPos.x, y: game.launchPos.y },
    aimAngle: game.aimAngle,
    grid: {
      cols: game.gridCols,
      rows: game.gridRows,
      cellSize: game.cellSize,
      offsetX: game.offsetX,
      offsetY: game.offsetY,
      deadlineY: game.deadlineY,
    },
    canvas: { w: game.canvasW, h: game.canvasH },
  };
}

export function handlePointerUp(game: GameData, x: number, y: number): void {
  game.pointerPos = { x, y };
  game.pointerDown = false;

  if (game.state === "aiming") {
    // 発射角度が有効か確認（上方向）
    const dy = y - game.launchPos.y;
    if (dy < -10) {
      launchBalls(game);
    }
  }
}
