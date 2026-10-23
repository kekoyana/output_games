import Phaser from "phaser";
import { WORLD_H, WORLD_W } from "../../game/types";

export const MAX_ZOOM = 3.0;
const INERTIA_DECAY = 0.92; // 1 フレーム(16.67ms)あたりの速度減衰

/**
 * ワールド用カメラの制御。ズーム（最小=背景を覆う倍率〜3.0）・パン・慣性・
 * ワールド内クランプを担当する。状態は (zoom, cx, cy)=カメラ中心の世界座標。
 */
export class CameraRig {
  zoom = 1;
  cx = WORLD_W / 2;
  cy = WORLD_H / 2;
  private vw: number;
  private vh: number;
  /** 慣性速度（世界座標 px / ms） */
  private vx = 0;
  private vy = 0;
  private zoomTarget: { z: number; sx: number; sy: number } | null = null;
  private moveTween: { t: number; dur: number; z0: number; z1: number; x0: number; y0: number; x1: number; y1: number } | null = null;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {
    this.vw = cam.width;
    this.vh = cam.height;
  }

  get minZoom(): number {
    return Math.max(this.vw / WORLD_W, this.vh / WORLD_H);
  }

  get viewW(): number {
    return this.vw;
  }

  get viewH(): number {
    return this.vh;
  }

  setViewport(w: number, h: number): void {
    this.vw = w;
    this.vh = h;
    this.cam.setSize(w, h);
    this.apply();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: this.cx + (sx - this.vw / 2) / this.zoom, y: this.cy + (sy - this.vh / 2) / this.zoom };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.cx) * this.zoom + this.vw / 2, y: (y - this.cy) * this.zoom + this.vh / 2 };
  }

  setView(zoom: number, cx: number, cy: number): void {
    this.zoomTarget = null;
    this.moveTween = null;
    this.vx = 0;
    this.vy = 0;
    this.zoom = zoom;
    this.cx = cx;
    this.cy = cy;
    this.apply();
  }

  stopInertia(): void {
    this.vx = 0;
    this.vy = 0;
  }

  /** 画面上の移動量(px)でパン */
  panByScreen(dx: number, dy: number): void {
    this.cx -= dx / this.zoom;
    this.cy -= dy / this.zoom;
    this.apply();
  }

  /** 画面速度(px/ms)から慣性を開始 */
  fling(svx: number, svy: number): void {
    this.vx = -svx / this.zoom;
    this.vy = -svy / this.zoom;
  }

  /** 画面座標 (sx,sy) の世界座標を固定したままズームを即時変更 */
  zoomAtImmediate(z: number, sx: number, sy: number): void {
    const anchor = this.screenToWorld(sx, sy);
    this.zoom = Phaser.Math.Clamp(z, this.minZoom, MAX_ZOOM);
    this.cx = anchor.x - (sx - this.vw / 2) / this.zoom;
    this.cy = anchor.y - (sy - this.vh / 2) / this.zoom;
    this.apply();
  }

  /** なめらかにズーム（ボタン・ホイール用） */
  zoomTo(z: number, sx: number, sy: number): void {
    this.zoomTarget = { z: Phaser.Math.Clamp(z, this.minZoom, MAX_ZOOM), sx, sy };
  }

  /** 指定のビューへ滑らかに移動（失敗演出など） */
  moveTo(zoom: number, x: number, y: number, durMs: number): void {
    this.zoomTarget = null;
    this.vx = 0;
    this.vy = 0;
    this.moveTween = {
      t: 0, dur: durMs, z0: this.zoom, z1: Phaser.Math.Clamp(zoom, this.minZoom, MAX_ZOOM),
      x0: this.cx, y0: this.cy, x1: x, y1: y,
    };
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 100);
    if (this.moveTween) {
      const m = this.moveTween;
      m.t = Math.min(m.dur, m.t + dt);
      const k = Phaser.Math.Easing.Cubic.InOut(m.t / m.dur);
      this.zoom = m.z0 + (m.z1 - m.z0) * k;
      this.cx = m.x0 + (m.x1 - m.x0) * k;
      this.cy = m.y0 + (m.y1 - m.y0) * k;
      if (m.t >= m.dur) this.moveTween = null;
    }
    if (this.zoomTarget) {
      const zt = this.zoomTarget;
      const k = 1 - Math.pow(0.75, dt / 16.67);
      const nz = this.zoom + (zt.z - this.zoom) * k;
      this.zoomAtImmediate(Math.abs(nz - zt.z) < 0.002 ? zt.z : nz, zt.sx, zt.sy);
      if (this.zoom === zt.z) this.zoomTarget = null;
    }
    if (this.vx !== 0 || this.vy !== 0) {
      this.cx += this.vx * dt;
      this.cy += this.vy * dt;
      const f = Math.pow(INERTIA_DECAY, dt / 16.67);
      this.vx *= f;
      this.vy *= f;
      if (Math.hypot(this.vx, this.vy) < 0.004) {
        this.vx = 0;
        this.vy = 0;
      }
    }
    this.apply();
  }

  /** ズーム・中心をクランプしてカメラへ反映（世界の外が映らないようにする） */
  apply(): void {
    this.zoom = Phaser.Math.Clamp(this.zoom, this.minZoom, MAX_ZOOM);
    const hw = this.vw / (2 * this.zoom);
    const hh = this.vh / (2 * this.zoom);
    const nx = Phaser.Math.Clamp(this.cx, hw, WORLD_W - hw);
    const ny = Phaser.Math.Clamp(this.cy, hh, WORLD_H - hh);
    if (nx !== this.cx) this.vx = 0;
    if (ny !== this.cy) this.vy = 0;
    this.cx = nx;
    this.cy = ny;
    this.cam.setZoom(this.zoom);
    this.cam.centerOn(this.cx, this.cy);
  }
}
