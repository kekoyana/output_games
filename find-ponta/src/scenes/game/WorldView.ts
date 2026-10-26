import Phaser from "phaser";
import { NIGHT_TINT } from "../../game/stages";
import { allEntities } from "../../game/spawn";
import { sampleMotion, stillSample } from "../../game/motion";
import { BONUS_SIZE, entityHeight, isItem } from "../../game/geometry";
import type { Entity, SceneLayout, StageDef } from "../../game/types";

/** ワールド（背景+エンティティ+演出）の描画。ロジックは持たない。 */
export class WorldView {
  readonly layer: Phaser.GameObjects.Layer;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private hint: Phaser.GameObjects.Graphics | null = null;
  /** 往復・追いかけっこで動くキャラ（毎フレーム位置とポーズを更新） */
  private movers: { e: Entity; img: Phaser.GameObjects.Image; h: number }[] = [];
  private frozen = false;

  constructor(
    readonly scene: Phaser.Scene, private stage: StageDef, layout: SceneLayout, private animated: boolean,
  ) {
    this.layer = scene.add.layer();
    const bg = scene.add.image(0, 0, stage.bg).setOrigin(0, 0).setScale(1.5).setDepth(-1);
    if (stage.night) bg.setTint(NIGHT_TINT);
    this.layer.add(bg);
    for (const e of allEntities(layout)) this.createSprite(e);
  }

  private createSprite(e: Entity): void {
    let img: Phaser.GameObjects.Image;
    if (isItem(e)) {
      const key = this.scene.textures.exists(e.tex) ? e.tex : "item_balloon";
      img = this.scene.add.image(e.x, e.y - BONUS_SIZE / 2, key).setDisplaySize(BONUS_SIZE + 6, BONUS_SIZE + 6);
    } else {
      const h = entityHeight(e, this.stage);
      img = this.scene.add.image(e.x, e.y, e.tex).setOrigin(0.5, 1).setScale(h / 240);
    }
    img.setFlipX(e.flip).setDepth(e.y);
    this.layer.add(img);
    this.sprites.set(e.id, img);
    if (e.move && this.animated) {
      this.movers.push({ e, img, h: entityHeight(e, this.stage) });
      this.applyMover(e, img, entityHeight(e, this.stage), 0);
    } else if (e.move) {
      // NORMAL: 止まった絵。ポーズと向きは動き出しの瞬間のもの
      const m = stillSample(e);
      img.setTexture(this.scene.textures.exists(m.texKey) ? m.texKey : e.tex).setFlipX(m.flip);
    } else {
      const shop = sampleMotion(e, 0).texKey;
      if (e.pose === "shop" && this.scene.textures.exists(shop)) img.setTexture(shop);
      if (this.animated) this.animate(e, img);
    }
  }

  private applyMover(e: Entity, img: Phaser.GameObjects.Image, h: number, t: number): void {
    const m = sampleMotion(e, t);
    e.x = m.x;
    img.setPosition(m.x, e.y - m.bob * h * 0.035);
    const key = this.scene.textures.exists(m.texKey) ? m.texKey : e.tex;
    if (img.texture.key !== key) img.setTexture(key);
    img.setFlipX(m.flip);
  }

  /** 毎フレーム呼ぶ。t はシーン開始からの秒数。 */
  update(t: number): void {
    if (this.frozen) return;
    for (const m of this.movers) this.applyMover(m.e, m.img, m.h, t);
  }

  /** HARD: 見つけたポンタ/なかまを止めて、緑のチェック印をつける（全部そろうまで残る）。 */
  markFound(e: Entity): void {
    const s = this.sprites.get(e.id);
    if (!s) return;
    const i = this.movers.findIndex((m) => m.e === e);
    if (i >= 0) this.movers.splice(i, 1);
    const h = entityHeight(e, this.stage);
    this.settle(e, s, h / 240);
    const badge = this.scene.add.container(e.x, e.y - h - 16).setDepth(1e6 - 3);
    badge.add([
      this.scene.add.circle(0, 0, 17, 0x2fb457).setStrokeStyle(3, 0xffffff),
      this.scene.add.text(0, 0, "✓", { fontFamily: "sans-serif", fontSize: "22px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5),
    ]);
    this.layer.add(badge);
    badge.setScale(0.2);
    this.scene.tweens.add({ targets: badge, scale: 1, duration: 260, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: s, y: e.y - 30, duration: 160, yoyo: true, ease: "Quad.easeOut" });
  }

  /** クリア/失敗時: 動きを止める。注目するキャラ（最後に見つけたもの/ポンタ）は正面の絵に戻す。 */
  freeze(focus: Entity): void {
    this.frozen = true;
    const s = this.sprites.get(focus.id);
    if (!s) return;
    this.scene.tweens.killTweensOf(s);
    s.setTexture(focus.tex).setAngle(0).setScale(entityHeight(focus, this.stage) / 240).setPosition(focus.x, focus.y);
    s.setFlipX(false);
  }

  /**
   * 待機モーション。足元(origin 下端)を支点にした小さな動きだけにして、当たり判定(論理座標)とずらさない。
   * 種類・周期・位相は ID から決める。ポンタも他キャラと同じ分布で、動きで見分けがつかないようにする。
   */
  private animate(e: Entity, img: Phaser.GameObjects.Image): void {
    if (!this.animated) return;
    const hash = Math.imul(e.id + 1, 2654435761) >>> 0;
    const period = 650 + (hash % 500);
    const delay = (hash >>> 8) % 1000;
    const sx = img.scaleX;
    const sy = img.scaleY;
    const common = { yoyo: true, repeat: -1, delay, duration: period };

    // 宝物・ガラクタは動かさない（ボーナスだけふわふわ浮く）
    if (isItem(e)) {
      if (e.kind !== "bonus") return;
      this.scene.tweens.add({ targets: img, y: img.y - 5, ease: "Sine.easeInOut", ...common, duration: 900 });
      img.setAngle(-6);
      this.scene.tweens.add({ targets: img, angle: 6, ease: "Sine.easeInOut", ...common, duration: 1100 });
      return;
    }
    const h = img.displayHeight;
    switch ((hash >>> 16) % 3) {
      case 0: // ぴょんぴょん
        this.scene.tweens.add({ targets: img, y: e.y - h * 0.05, scaleY: sy * 1.04, scaleX: sx * 0.97, ease: "Quad.easeOut", ...common, duration: period * 0.45, repeatDelay: period * 0.5 });
        break;
      case 1: // ゆらゆら
        img.setAngle(-3.5);
        this.scene.tweens.add({ targets: img, angle: 3.5, ease: "Sine.easeInOut", ...common, duration: period * 1.4 });
        break;
      default: // 深呼吸
        this.scene.tweens.add({ targets: img, scaleY: sy * 1.05, scaleX: sx * 0.97, ease: "Sine.easeInOut", ...common, duration: period * 1.6 });
        break;
    }
  }

  /** 待機モーションを止めて元の姿勢に戻す */
  private settle(e: Entity, img: Phaser.GameObjects.Image, scale: number): void {
    this.scene.tweens.killTweensOf(img);
    img.setPosition(e.x, e.y).setAngle(0).setScale(scale).setTexture(e.tex).setFlipX(false);
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
    this.scene.tweens.killTweensOf(s);
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
    this.settle(e, s, entityHeight(e, this.stage) / 240);
    s.setDepth(1e6 - 2);
    this.scene.tweens.add({
      targets: s, y: e.y - 70, duration: 260, yoyo: true, repeat: 3, ease: "Quad.easeOut",
      onComplete: () => s.setY(e.y),
    });
  }
}
