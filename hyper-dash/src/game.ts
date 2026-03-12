// ゲームロジック

import type { GameState, Lane, Player, Coin, Obstacle, Item, Milestone } from "./types";
import {
  laneDepthToX,
  depthToY,
  spawnParticles,
  spawnSpeedLines,
  rand,
  randInt,
} from "./utils";

const COMBO_TIMEOUT = 1.0;
const BASE_SPEED = 0.5;
const JUMP_FORCE = -480;
const GRAVITY = 900;
const LANE_MOVE_DURATION = 0.15;
const LEVEL_DISTANCE = 150; // レベルアップ間隔(m)

export function createInitialState(): GameState {
  const highScore = parseInt(localStorage.getItem("hyperDashHighScore") ?? "0", 10);
  return {
    scene: "title",
    score: 0,
    highScore,
    combo: 0,
    maxCombo: 0,
    distance: 0,
    speed: BASE_SPEED,
    comboTimer: 0,
    flashRed: 0,
    flashWhite: 0,
    player: createPlayer(),
    coins: [],
    obstacles: [],
    items: [],
    particles: [],
    speedLines: [],
    gridOffset: 0,
    spawnTimer: 0,
    nearMissTimer: 0,
    level: 1,
    nextLevelDist: LEVEL_DISTANCE,
    milestone: null,
    totalCoins: 0,
    nearMissCount: 0,
    screenShake: 0,
  };
}

function createPlayer(): Player {
  return {
    lane: 0,
    targetLane: 0,
    laneProgress: 1,
    y: 0,
    vy: 0,
    isJumping: false,
    shielded: false,
    shieldTimer: 0,
    magnetActive: false,
    magnetTimer: 0,
    runFrame: 0,
    frameTimer: 0,
  };
}

export function startGame(state: GameState): void {
  const highScore = state.highScore;
  Object.assign(state, createInitialState());
  state.highScore = highScore;
  state.scene = "playing";
}

export function update(state: GameState, dt: number, canvasW: number, canvasH: number): void {
  if (state.scene !== "playing") return;

  updateSpeed(state);
  updatePlayer(state, dt);
  updateGrid(state, dt);
  updateSpawnTimer(state, dt, canvasW, canvasH);
  updateCoins(state, dt, canvasW, canvasH);
  updateObstacles(state, dt, canvasW, canvasH);
  updateItems(state, dt, canvasW, canvasH);
  updateParticles(state, dt);
  updateSpeedLines(state, dt, canvasW, canvasH);
  updateComboTimer(state, dt);
  updateFlash(state, dt);
  updateDistance(state, dt);
  updateMilestone(state, dt);
  updateLevelUp(state, canvasW, canvasH);

  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 8);
}

function updateSpeed(state: GameState): void {
  state.speed = BASE_SPEED + (state.level - 1) * 0.07;
}

function updatePlayer(state: GameState, dt: number): void {
  const p = state.player;

  if (p.laneProgress < 1) {
    p.laneProgress = Math.min(1, p.laneProgress + dt / LANE_MOVE_DURATION);
    if (p.laneProgress >= 1) {
      p.lane = p.targetLane;
    }
  }

  if (p.isJumping) {
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= 0) {
      p.y = 0;
      p.vy = 0;
      p.isJumping = false;
    }
  }

  p.frameTimer += dt;
  if (p.frameTimer > 0.06) {
    p.frameTimer = 0;
    p.runFrame++;
  }

  if (p.shielded) {
    p.shieldTimer -= dt;
    if (p.shieldTimer <= 0) {
      p.shielded = false;
      p.shieldTimer = 0;
    }
  }

  if (p.magnetActive) {
    p.magnetTimer -= dt;
    if (p.magnetTimer <= 0) {
      p.magnetActive = false;
      p.magnetTimer = 0;
    }
  }
}

function updateGrid(state: GameState, dt: number): void {
  state.gridOffset += state.speed * dt;
  if (state.gridOffset > 1) state.gridOffset -= 1;
}

function updateDistance(state: GameState, dt: number): void {
  state.distance += state.speed * dt * 40;
}

function updateLevelUp(state: GameState, canvasW: number, canvasH: number): void {
  if (state.distance >= state.nextLevelDist) {
    state.level++;
    state.nextLevelDist += LEVEL_DISTANCE + state.level * 20;

    showMilestone(state, `LEVEL ${state.level}`, "#00ffff");
    state.flashWhite = 0.8;
    state.screenShake = 0.5;

    // レベルアップ時に大量パーティクル
    spawnParticles(state.particles, canvasW / 2, canvasH * 0.4, 25, "#00ffff");
    spawnParticles(state.particles, canvasW / 2, canvasH * 0.4, 15, "#ff00ff");
  }
}

function showMilestone(state: GameState, text: string, color: string): void {
  state.milestone = {
    text,
    timer: 2.0,
    scale: 2.0,
    color,
  };
}

function updateMilestone(state: GameState, dt: number): void {
  if (state.milestone) {
    state.milestone.timer -= dt;
    state.milestone.scale = Math.max(1.0, state.milestone.scale - dt * 2);
    if (state.milestone.timer <= 0) {
      state.milestone = null;
    }
  }
}

function updateSpawnTimer(
  state: GameState,
  dt: number,
  canvasW: number,
  canvasH: number
): void {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  const interval = Math.max(0.5, 1.6 - state.level * 0.08);
  state.spawnTimer = interval * (0.7 + Math.random() * 0.6);

  spawnEntities(state, canvasW, canvasH);
}

function getRandomLane(): Lane {
  const lanes: Lane[] = [-1, 0, 1];
  return lanes[randInt(0, 2)];
}

function spawnEntities(state: GameState, _w: number, _h: number): void {
  const roll = Math.random();

  if (roll < 0.06 && state.items.length < 2) {
    const type = Math.random() < 0.5 ? "magnet" : "shield";
    state.items.push({ lane: getRandomLane(), depth: 0, type, angle: 0 });
  } else if (roll < 0.4) {
    spawnCoins(state);
  } else {
    spawnObstacle(state);
  }
}

function spawnCoins(state: GameState): void {
  const pattern = randInt(0, Math.min(state.level, 4));
  if (pattern <= 1) {
    // 同レーン連続3~5枚
    const lane = getRandomLane();
    const count = randInt(3, Math.min(5, 2 + state.level));
    for (let i = 0; i < count; i++) {
      state.coins.push({ lane, depth: -i * 0.1, collected: false });
    }
  } else if (pattern === 2) {
    // 3レーン横並び
    ([-1, 0, 1] as Lane[]).forEach((l) => {
      state.coins.push({ lane: l, depth: 0, collected: false });
    });
  } else if (pattern === 3) {
    // 斜め配置
    const lanes: Lane[] = [-1, 0, 1];
    lanes.forEach((l, i) => {
      state.coins.push({ lane: l, depth: -i * 0.08, collected: false });
    });
  } else {
    // V字配置
    state.coins.push({ lane: -1, depth: 0, collected: false });
    state.coins.push({ lane: 0, depth: -0.08, collected: false });
    state.coins.push({ lane: 1, depth: 0, collected: false });
  }
}

function spawnObstacle(state: GameState): void {
  const type = Math.random() < 0.5 ? "barricade" : "saw";
  const lane = getRandomLane();

  if (state.level >= 3 && Math.random() < 0.3) {
    // 2レーン塞ぎ（必ず1レーンは空ける）
    const lanes: Lane[] = [-1, 0, 1];
    const open = lanes[randInt(0, 2)];
    const blocked = lanes.filter((l) => l !== open) as Lane[];

    // 空きレーンにコインを置いて誘導
    state.coins.push({ lane: open, depth: 0.05, collected: false });

    blocked.forEach((l) => {
      state.obstacles.push({ lane: l, depth: 0, type, angle: 0 });
    });
  } else {
    state.obstacles.push({ lane, depth: 0, type, angle: 0 });

    // 障害物の隣にコインを置いて誘惑（リスク&リワード）
    if (Math.random() < 0.4) {
      const coinLanes = ([-1, 0, 1] as Lane[]).filter((l) => l !== lane);
      const coinLane = coinLanes[randInt(0, coinLanes.length - 1)];
      state.coins.push({ lane: coinLane, depth: 0.02, collected: false });
    }
  }
}

function updateCoins(
  state: GameState,
  dt: number,
  canvasW: number,
  canvasH: number
): void {
  const p = state.player;
  const playerLane = p.laneProgress >= 0.5 ? p.targetLane : p.lane;

  for (const coin of state.coins) {
    if (coin.collected) continue;
    coin.depth += state.speed * dt;

    // マグネット吸引
    if (p.magnetActive && coin.depth > 0.5) {
      coin.depth = Math.min(coin.depth + 0.5 * dt, 1.05);
    }

    // 収集判定
    if (coin.depth >= 0.88 && coin.depth < 1.1) {
      if (coin.lane === playerLane || p.magnetActive) {
        collectCoin(state, coin, canvasW, canvasH);
      }
    }
  }

  state.coins = state.coins.filter((c) => !c.collected && c.depth < 1.2);
}

function collectCoin(
  state: GameState,
  coin: Coin,
  canvasW: number,
  canvasH: number
): void {
  coin.collected = true;
  state.totalCoins++;

  // コンボ処理
  if (state.comboTimer > 0) {
    state.combo = Math.min(state.combo + 1, 10);
  } else {
    state.combo = 1;
  }
  state.comboTimer = COMBO_TIMEOUT;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  const points = 10 * state.combo;
  state.score += points;
  state.flashWhite = 0.3;

  // コンボマイルストーン
  if (state.combo === 5) {
    showMilestone(state, "COMBO x5!", "#ffd700");
    state.screenShake = 0.3;
  } else if (state.combo === 8) {
    showMilestone(state, "COMBO x8!!", "#ff6600");
    state.screenShake = 0.4;
  } else if (state.combo === 10) {
    showMilestone(state, "MAX COMBO!!!", "#ff00ff");
    state.screenShake = 0.6;
    state.score += 500;
  }

  // コイン数マイルストーン
  if (state.totalCoins === 50) {
    showMilestone(state, "50 COINS!", "#ffd700");
  } else if (state.totalCoins === 100) {
    showMilestone(state, "100 COINS!!", "#ffd700");
    state.score += 1000;
  }

  const x = laneDepthToX(coin.lane, Math.max(coin.depth, 0.01), canvasW);
  const y = depthToY(Math.max(coin.depth, 0.01), canvasH);
  spawnParticles(state.particles, x, y, 6 + state.combo, "#ffd700");
}

function updateObstacles(
  state: GameState,
  dt: number,
  canvasW: number,
  canvasH: number
): void {
  const p = state.player;
  const playerLane = p.laneProgress >= 0.5 ? p.targetLane : p.lane;

  for (const obs of state.obstacles) {
    obs.depth += state.speed * dt;
    obs.angle += dt * (obs.type === "saw" ? 5 : 0);

    // 当たり判定
    if (obs.depth >= 0.88 && obs.depth < 1.02 && obs.lane === playerLane) {
      if (!p.isJumping) {
        handleCollision(state, obs.lane, obs.depth, canvasW, canvasH);
        return;
      }
    }

    // ニアミス判定
    if (
      obs.depth >= 0.86 &&
      obs.depth < 0.94 &&
      Math.abs(obs.lane - playerLane) === 1
    ) {
      if (state.nearMissTimer <= 0) {
        state.nearMissTimer = 0.4;
        state.nearMissCount++;
        const bonus = 50 + state.level * 10;
        state.score += bonus;
        state.flashWhite = 0.2;
        state.screenShake = 0.15;

        if (state.nearMissCount === 10) {
          showMilestone(state, "NEAR MISS MASTER!", "#ff4400");
          state.score += 500;
        }

        const x = laneDepthToX(obs.lane, obs.depth, canvasW);
        const y = depthToY(obs.depth, canvasH);
        spawnParticles(state.particles, x, y, 5, "#ffff00");
      }
    }
  }

  state.obstacles = state.obstacles.filter((o) => o.depth < 1.2);
}

function handleCollision(
  state: GameState,
  lane: Lane,
  depth: number,
  canvasW: number,
  canvasH: number
): void {
  if (state.player.shielded) {
    state.player.shielded = false;
    state.player.shieldTimer = 0;
    state.flashWhite = 0.8;
    state.screenShake = 0.5;
    showMilestone(state, "SHIELD BREAK!", "#00ff88");
    const x = laneDepthToX(lane, depth, canvasW);
    const y = depthToY(depth, canvasH);
    spawnParticles(state.particles, x, y, 20, "#00ff88");
    return;
  }
  gameOver(state, lane, depth, canvasW, canvasH);
}

function gameOver(
  state: GameState,
  lane: Lane,
  depth: number,
  canvasW: number,
  canvasH: number
): void {
  state.scene = "gameover";
  state.flashRed = 1.0;
  state.screenShake = 1.0;

  const x = laneDepthToX(lane, depth, canvasW);
  const y = depthToY(depth, canvasH);
  spawnParticles(state.particles, x, y, 30, "#ff4400");
  spawnParticles(state.particles, x, y, 15, "#ff8800");

  // 距離ボーナス
  state.score += Math.floor(state.distance);

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem("hyperDashHighScore", String(state.highScore));
  }
}

function updateItems(
  state: GameState,
  dt: number,
  canvasW: number,
  canvasH: number
): void {
  const p = state.player;
  const playerLane = p.laneProgress >= 0.5 ? p.targetLane : p.lane;

  for (const item of state.items) {
    item.depth += state.speed * dt;
    item.angle += dt * 2;

    if (item.depth >= 0.88 && item.depth < 1.1 && item.lane === playerLane) {
      collectItem(state, item, canvasW, canvasH);
    }
  }

  state.items = state.items.filter((i) => i.depth < 1.15);
}

function collectItem(
  state: GameState,
  item: Item,
  canvasW: number,
  canvasH: number
): void {
  item.depth = 2;

  const x = laneDepthToX(item.lane, 0.95, canvasW);
  const y = depthToY(0.95, canvasH);

  if (item.type === "magnet") {
    state.player.magnetActive = true;
    state.player.magnetTimer = 5;
    showMilestone(state, "MAGNET!", "#00aaff");
    spawnParticles(state.particles, x, y, 15, "#00aaff");
  } else {
    state.player.shielded = true;
    state.player.shieldTimer = 10;
    showMilestone(state, "SHIELD ON!", "#00ff88");
    spawnParticles(state.particles, x, y, 15, "#00ff88");
  }
  state.flashWhite = 0.6;
  state.screenShake = 0.3;
}

function updateParticles(state: GameState, dt: number): void {
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
    p.life -= dt * 1.8;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function updateSpeedLines(
  state: GameState,
  dt: number,
  canvasW: number,
  canvasH: number
): void {
  if (state.level >= 2 && Math.random() < state.speed * dt * 8) {
    spawnSpeedLines(state.speedLines, canvasW, canvasH);
  }

  for (const line of state.speedLines) {
    line.alpha -= dt * 2;
  }
  state.speedLines = state.speedLines.filter((l) => l.alpha > 0);
}

function updateComboTimer(state: GameState, dt: number): void {
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.comboTimer = 0;
      state.combo = 0;
    }
  }
  if (state.nearMissTimer > 0) {
    state.nearMissTimer -= dt;
  }
}

function updateFlash(state: GameState, dt: number): void {
  if (state.flashRed > 0) state.flashRed = Math.max(0, state.flashRed - dt * 2);
  if (state.flashWhite > 0) state.flashWhite = Math.max(0, state.flashWhite - dt * 4);
}

export function handleMoveLane(state: GameState, dir: -1 | 1): void {
  if (state.scene !== "playing") return;
  const p = state.player;
  const current = p.laneProgress >= 0.5 ? p.targetLane : p.lane;
  const next = Math.max(-1, Math.min(1, current + dir)) as Lane;
  if (next !== current) {
    p.lane = current;
    p.targetLane = next;
    p.laneProgress = 0;
  }
}

export function handleJump(state: GameState): void {
  if (state.scene !== "playing") return;
  const p = state.player;
  if (!p.isJumping) {
    p.isJumping = true;
    p.vy = JUMP_FORCE;
  }
}
