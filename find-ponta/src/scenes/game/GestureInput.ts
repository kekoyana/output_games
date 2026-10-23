import Phaser from "phaser";
import type { CameraRig } from "./CameraRig";

export const TAP_MOVE_PX = 8;
export const TAP_MAX_MS = 500;
export const PINCH_COOLDOWN_MS = 150;
export const TAP_INTERVAL_MS = 400;

interface Track {
  x: number;
  y: number;
  sx: number;
  sy: number;
  t0: number;
  moved: boolean;
  lastT: number;
  vx: number;
  vy: number;
}

export interface GestureHooks {
  enabled: () => boolean;
  onTap: (sx: number, sy: number) => void;
}

/**
 * Pointer Events（Phaser の pointer 経由）によるドラッグパン・ピンチ・ホイール・タップ判定。
 * - 移動 8px 未満かつ 500ms 未満の入力のみタップ
 * - ピンチ終了後 150ms / 前回タップから 400ms 以内の入力は無視
 */
export class GestureInput {
  private tracks = new Map<number, Track>();
  private pinch: { d0: number; z0: number } | null = null;
  private gestureWasPinch = false;
  private lastPinchEnd = -1e9;
  private lastTapAt = -1e9;

  constructor(scene: Phaser.Scene, private rig: CameraRig, private hooks: GestureHooks) {
    const inp = scene.input;
    inp.addPointer(2);
    inp.on("pointermove", (p: Phaser.Input.Pointer) => this.move(p));
    inp.on("pointerup", (p: Phaser.Input.Pointer) => this.up(p));
    inp.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.up(p));
    inp.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.hooks.enabled()) return;
      const base = this.rig.zoom;
      this.rig.zoomTo(base * Math.exp(-dy * 0.0016), p.x, p.y);
    });
  }

  /** HUD に取られなかった pointerdown をここへ渡す */
  down(p: Phaser.Input.Pointer): void {
    if (!this.hooks.enabled()) return;
    const now = performance.now();
    this.rig.stopInertia();
    this.tracks.set(p.id, { x: p.x, y: p.y, sx: p.x, sy: p.y, t0: now, moved: false, lastT: now, vx: 0, vy: 0 });
    if (this.tracks.size === 1) this.gestureWasPinch = false;
    if (this.tracks.size >= 2) this.beginPinch();
  }

  cancelAll(): void {
    this.tracks.clear();
    this.pinch = null;
  }

  private beginPinch(): void {
    const [a, b] = [...this.tracks.values()];
    a.moved = true;
    b.moved = true;
    this.gestureWasPinch = true;
    this.pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.rig.zoom };
  }

  private move(p: Phaser.Input.Pointer): void {
    const tr = this.tracks.get(p.id);
    if (!tr || !this.hooks.enabled()) return;
    const now = performance.now();
    if (this.pinch && this.tracks.size >= 2) {
      tr.x = p.x;
      tr.y = p.y;
      const [a, b] = [...this.tracks.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      this.rig.zoomAtImmediate(this.pinch.z0 * (d / this.pinch.d0), mx, my);
      return;
    }
    if (!tr.moved) {
      if (Math.hypot(p.x - tr.sx, p.y - tr.sy) < TAP_MOVE_PX) return;
      tr.moved = true;
      tr.x = tr.sx;
      tr.y = tr.sy;
    }
    const dx = p.x - tr.x;
    const dy = p.y - tr.y;
    const dt = Math.max(1, now - tr.lastT);
    tr.vx = tr.vx * 0.5 + (dx / dt) * 0.5;
    tr.vy = tr.vy * 0.5 + (dy / dt) * 0.5;
    tr.lastT = now;
    tr.x = p.x;
    tr.y = p.y;
    this.rig.panByScreen(dx, dy);
  }

  private up(p: Phaser.Input.Pointer): void {
    const tr = this.tracks.get(p.id);
    if (!tr) return;
    const now = performance.now();
    const wasPinching = this.pinch !== null;
    this.tracks.delete(p.id);
    if (wasPinching) {
      this.lastPinchEnd = now;
      this.pinch = null;
      // 残った指はパンの飛びを防ぐため基準を取り直す
      for (const r of this.tracks.values()) {
        r.sx = r.x;
        r.sy = r.y;
        r.moved = true;
        r.vx = 0;
        r.vy = 0;
        r.lastT = now;
      }
      return;
    }
    if (this.gestureWasPinch) return;
    if (tr.moved) {
      if (now - tr.lastT < 80) this.rig.fling(tr.vx, tr.vy);
      return;
    }
    const isTap =
      now - tr.t0 < TAP_MAX_MS &&
      now - this.lastPinchEnd >= PINCH_COOLDOWN_MS &&
      now - this.lastTapAt >= TAP_INTERVAL_MS;
    if (isTap) {
      this.lastTapAt = now;
      this.hooks.onTap(tr.sx, tr.sy);
    }
  }
}
