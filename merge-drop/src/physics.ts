import { Ball, FieldConfig } from "./types";
import { dist, VALUES, getRadius } from "./utils";

const GRAVITY = 900;       // pixels/sec^2
const FRICTION = 0.998;
const RESTITUTION = 0.2;
const ITERATIONS = 8;

export function stepPhysics(
  balls: Ball[],
  field: FieldConfig,
  dt: number
): Array<{ a: Ball; b: Ball }> {
  const mergeRequests: Array<{ a: Ball; b: Ball }> = [];
  const mergeSet = new Set<number>();

  // Apply gravity and velocity (fully time-based)
  for (const ball of balls) {
    ball.vy += GRAVITY * dt;
    ball.vx *= Math.pow(FRICTION, dt * 60);
    ball.vy *= Math.pow(FRICTION, dt * 60);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.dropTimer > 0) {
      ball.dropTimer -= dt;
      if (ball.dropTimer <= 0) {
        ball.justDropped = false;
      }
    }
  }

  // Iterative collision resolution
  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Wall collisions
    for (const ball of balls) {
      const left = field.x;
      const right = field.x + field.width;
      const bottom = field.y + field.height;

      if (ball.x - ball.radius < left) {
        ball.x = left + ball.radius;
        ball.vx = Math.abs(ball.vx) * RESTITUTION;
      }
      if (ball.x + ball.radius > right) {
        ball.x = right - ball.radius;
        ball.vx = -Math.abs(ball.vx) * RESTITUTION;
      }
      if (ball.y + ball.radius > bottom) {
        ball.y = bottom - ball.radius;
        ball.vy = -Math.abs(ball.vy) * RESTITUTION;
        ball.vx *= 0.85;
      }
    }

    // Ball-ball collisions
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        const d = dist(a.x, a.y, b.x, b.y);
        const minDist = a.radius + b.radius;

        if (d < minDist && d > 0.001) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          const overlap = minDist - d;

          // Separate balls
          const massA = a.radius * a.radius;
          const massB = b.radius * b.radius;
          const totalMass = massA + massB;
          a.x -= nx * overlap * (massB / totalMass);
          a.y -= ny * overlap * (massB / totalMass);
          b.x += nx * overlap * (massA / totalMass);
          b.y += ny * overlap * (massA / totalMass);

          // Check for merge
          if (
            a.value === b.value &&
            !a.merging &&
            !b.merging &&
            !a.justDropped &&
            !b.justDropped &&
            !mergeSet.has(a.id) &&
            !mergeSet.has(b.id)
          ) {
            const nextIdx = VALUES.indexOf(a.value) + 1;
            if (nextIdx < VALUES.length) {
              mergeRequests.push({ a, b });
              mergeSet.add(a.id);
              mergeSet.add(b.id);
              a.merging = true;
              b.merging = true;
            } else {
              // Max value - both disappear (handled as special merge)
              mergeRequests.push({ a, b });
              mergeSet.add(a.id);
              mergeSet.add(b.id);
              a.merging = true;
              b.merging = true;
            }
          } else if (!a.merging && !b.merging) {
            resolveVelocity(a, b, nx, ny);
          }
        }
      }
    }
  }

  return mergeRequests;
}

function resolveVelocity(a: Ball, b: Ball, nx: number, ny: number): void {
  const dvx = b.vx - a.vx;
  const dvy = b.vy - a.vy;
  const dvn = dvx * nx + dvy * ny;

  if (dvn > 0) return;

  const massA = a.radius * a.radius;
  const massB = b.radius * b.radius;
  const totalMass = massA + massB;
  const impulse = (-(1 + RESTITUTION) * dvn) / totalMass;

  a.vx -= (impulse * massB * nx) / totalMass;
  a.vy -= (impulse * massB * ny) / totalMass;
  b.vx += (impulse * massA * nx) / totalMass;
  b.vy += (impulse * massA * ny) / totalMass;
}

export function createMergedBall(
  a: Ball,
  b: Ball,
  id: number
): Ball {
  const newValue = a.value * 2;
  return {
    id,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    vx: (a.vx + b.vx) * 0.3,
    vy: (a.vy + b.vy) * 0.3,
    radius: getRadius(newValue),
    value: newValue,
    merging: false,
    justDropped: false,
    dropTimer: 0,
  };
}
