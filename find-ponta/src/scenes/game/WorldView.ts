import Phaser from "phaser";
import { NIGHT_TINT } from "../../game/stages";
import { allEntities } from "../../game/spawn";
import { BONUS_SIZE, entityHeight } from "../../game/geometry";
import type { Entity, SceneLayout, StageDef } from "../../game/types";

/** ワールド（背景+エンティティ+演出）の描画。ロジックは持たない。 */
export class WorldView {
  readonly layer: Phaser.GameObjects.Layer;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private hint: Phaser.GameObjects.Graphics | null = null;

  constructor(readonly scene: Phaser.Scene, private stage: StageDef, layout: SceneLayout) {
    this.layer = scene.add.layer();
    const bg = scene.add.image(0, 0, stage.bg).setOrigin(0, 0).setScale(1.5).setDepth(-1);
    if (stage.night) bg.setTint(NIGHT_TINT);
    this.layer.add(bg);
    for (const e of allEntities(layout)) this.createSprite(e);
  }

  private createSprite(e: Entity): void {
    let img: Phaser.GameObjects.Image;
    if (e.kind === "bonus") {
      img = this.scene.add.image(e.x, e.y - BONUS_SIZE / 2, e.tex).setDisplaySize(BONUS_SIZE + 6, BONUS_SIZE + 6);
    } else {
      const h = entityHeight(e, this.stage);
      img = this.scene.add.image(e.x, e.y, e.tex).setOrigin(0.5, 1).setScale(h / 240);
    }
    img.setFlipX(e.flip).setDepth(e.y);
    this.layer.add(img);
    this.sprites.set(e.id, img);
  }

  sprite(id: number): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(id);
  }

  addFx<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.add(o);
    return o;
  }

  removeBonus(e: Entity): void {
    const s = this.sprites.get(e.id);
    if (!s) return;
    this.sprites.delete(e.id);
    this.scene.tweens.add({
      targets: s, y: s.y - 60, scale: s.scale * 1.8, alpha: 0, duration: 500, ease: "Cubic.easeOut",
      onComplete: () => s.destroy(),
    });
  }

  /** ミスタップ位置の × 印（画面上で一定サイズになるよう zoom で補正） */
  missMark(x: number, y: number, zoom: number): void {
    const size = 30 / zoom;
    const g = this.scene.add.graphics().setDepth(1e6);
    g.lineStyle(Math.max(3, 5 / zoom), 0xff3b3b, 1);
    g.lineBetween(x - size / 2, y - size / 2, x + size / 2, y + size / 2);
    g.lineBetween(x + size / 2, y - size / 2, x - size / 2, y + size / 2);
    this.layer.add(g);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 700, delay: 150, onComplete: () => g.destroy() });
  }

  /** タップ位置の小さな波紋 */
  tapRipple(x: number, y: number, zoom: number, color: number): void {
    const g = this.scene.add.graphics().setDepth(1e6);
    g.lineStyle(Math.max(2, 3 / zoom), color, 0.9);
    g.strokeCircle(0, 0, 14 / zoom);
    g.setPosition(x, y);
    this.layer.add(g);
    this.scene.tweens.add({ targets: g, scale: 2, alpha: 0, duration: 380, onComplete: () => g.destroy() });
  }

  showHint(x: number, y: number, radius: number): void {
    this.clearHint();
    const g = this.scene.add.graphics().setDepth(1e6 - 1);
    g.fillStyle(0xfff27a, 0.18).fillCircle(0, 0, radius);
    g.lineStyle(6, 0xffe14a, 0.95).strokeCircle(0, 0, radius);
    g.setPosition(x, y);
    this.layer.add(g);
    this.hint = g;
    this.scene.tweens.add({ targets: g, alpha: { from: 1, to: 0.55 }, duration: 450, yoyo: true, repeat: -1 });
  }

  clearHint(): void {
    if (this.hint) {
      this.scene.tweens.killTweensOf(this.hint);
      this.hint.destroy();
      this.hint = null;
    }
  }

  hintActive(): boolean {
    return this.hint !== null;
  }

  /** 失敗時: ポンタの位置に脈打つリング */
  pulseRing(x: number, y: number, r: number): void {
    for (let i = 0; i < 3; i++) {
      const g = this.scene.add.graphics().setDepth(1e6);
      g.lineStyle(7, i === 0 ? 0xff3b3b : 0xffd23f, 1).strokeCircle(0, 0, r);
      g.setPosition(x, y).setScale(1.8);
      this.layer.add(g);
      this.scene.tweens.add({
        targets: g, scale: { from: 2.4, to: 0.9 }, alpha: { from: 0, to: 1 },
        duration: 700, delay: i * 220, repeat: -1, repeatDelay: 300, ease: "Cubic.easeOut",
      });
    }
  }

  /** クリア時: ポンタのジャンプ */
  jump(e: Entity): void {
    const s = this.sprites.get(e.id);
    if (!s) return;
    s.setDepth(1e6 - 2);
    this.scene.tweens.add({
      targets: s, y: e.y - 70, duration: 260, yoyo: true, repeat: 3, ease: "Quad.easeOut",
      onComplete: () => s.setY(e.y),
    });
  }
}
