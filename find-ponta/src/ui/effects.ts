import Phaser from "phaser";

const FX_DOT = "__fx_dot__";
const FX_RING = "__fx_ring__";
const FX_GLOW = "__fx_glow__";

export function ensureFxTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FX_DOT)) {
    const g = scene.add.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(FX_DOT, 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists(FX_RING)) {
    const g = scene.add.graphics({ x: 0, y: 0 });
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(16, 16, 14);
    g.generateTexture(FX_RING, 32, 32);
    g.destroy();
  }
  if (!scene.textures.exists(FX_GLOW)) {
    const g = scene.add.graphics({ x: 0, y: 0 });
    for (let r = 24; r > 0; r -= 2) {
      g.fillStyle(0xffffff, 0.05);
      g.fillCircle(24, 24, r);
    }
    g.generateTexture(FX_GLOW, 48, 48);
    g.destroy();
  }
}

export function spawnDamageText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  dmg: number,
  opts: { crit?: boolean; depth?: number } = {},
): void {
  const fontSize = opts.crit ? 26 : 18;
  const color = opts.crit ? "#ffe066" : "#ffffff";
  const stroke = opts.crit ? "#aa6600" : "#000000";
  const t = scene.add.text(x + Phaser.Math.Between(-6, 6), y - 8, String(dmg), {
    fontFamily: "sans-serif",
    fontSize: `${fontSize}px`,
    color,
    stroke,
    strokeThickness: 4,
    fontStyle: "bold",
  }).setOrigin(0.5).setDepth(opts.depth ?? 50);
  if (opts.crit) {
    t.setScale(0.4);
    scene.tweens.add({ targets: t, scale: 1.15, duration: 110, ease: "Back.easeOut" });
  }
  scene.tweens.add({
    targets: t,
    y: y - 50,
    alpha: 0,
    duration: 700,
    delay: opts.crit ? 110 : 0,
    ease: "Cubic.easeOut",
    onComplete: () => t.destroy(),
  });
}

export function spawnKillBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  opts: { count?: number; depth?: number } = {},
): void {
  ensureFxTextures(scene);
  const count = opts.count ?? 14;
  const burst = scene.add.particles(x, y, FX_DOT, {
    speed: { min: 80, max: 240 },
    lifespan: { min: 380, max: 620 },
    scale: { start: 1.4, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: color,
    blendMode: "ADD",
    emitting: false,
  }).setDepth(opts.depth ?? 9);
  burst.explode(count, x, y);

  const ring = scene.add.image(x, y, FX_RING).setDepth(opts.depth ?? 9).setTint(color);
  ring.setScale(0.4);
  scene.tweens.add({
    targets: ring,
    scale: 2.2,
    alpha: 0,
    duration: 360,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });

  scene.time.delayedCall(700, () => burst.destroy());
}

export function spawnHitSpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number = 0xffffff,
): void {
  ensureFxTextures(scene);
  const burst = scene.add.particles(x, y, FX_DOT, {
    speed: { min: 60, max: 140 },
    lifespan: 220,
    scale: { start: 0.9, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: color,
    blendMode: "ADD",
    emitting: false,
  }).setDepth(8);
  burst.explode(5, x, y);
  scene.time.delayedCall(280, () => burst.destroy());
}

export function spawnTrail(
  scene: Phaser.Scene,
  follow: Phaser.GameObjects.GameObject,
  color: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureFxTextures(scene);
  const emitter = scene.add.particles(0, 0, FX_DOT, {
    follow: follow as Phaser.GameObjects.Image,
    speed: 0,
    lifespan: 220,
    scale: { start: 0.7, end: 0 },
    alpha: { start: 0.8, end: 0 },
    tint: color,
    blendMode: "ADD",
    frequency: 35,
    quantity: 1,
  }).setDepth(6);
  return emitter;
}

export function spawnAmbientField(
  scene: Phaser.Scene,
  opts: { color?: number; count?: number } = {},
): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureFxTextures(scene);
  const w = scene.scale.width;
  const h = scene.scale.height;
  const color = opts.color ?? 0xffe89a;
  const count = opts.count ?? 24;
  const e = scene.add.particles(0, 0, FX_DOT, {
    x: { min: 0, max: w },
    y: { min: -20, max: h },
    speedY: { min: 12, max: 30 },
    speedX: { min: -8, max: 8 },
    lifespan: { min: 4000, max: 7000 },
    scale: { start: 0.5, end: 0.1 },
    alpha: { start: 0.4, end: 0 },
    tint: color,
    blendMode: "ADD",
    frequency: 200,
    quantity: 1,
  }).setScrollFactor(0).setDepth(1);
  void count;
  return e;
}

export function flashScreen(
  scene: Phaser.Scene,
  color: number,
  duration = 220,
): void {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  scene.cameras.main.flash(duration, r, g, b, false);
}

export function shakeScreen(
  scene: Phaser.Scene,
  duration = 120,
  intensity = 0.005,
): void {
  scene.cameras.main.shake(duration, intensity);
}

export function spawnVictoryFlash(
  scene: Phaser.Scene,
  text: string,
): Phaser.GameObjects.Text {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const t = scene.add.text(w / 2, h * 0.42, text, {
    fontFamily: "serif",
    fontSize: `${Math.min(w * 0.18, 130)}px`,
    color: "#ffd966",
    stroke: "#000000",
    strokeThickness: 10,
    fontStyle: "bold",
  }).setOrigin(0.5).setDepth(300).setAlpha(0).setScale(0.4);
  scene.tweens.add({
    targets: t,
    alpha: 1,
    scale: 1.0,
    duration: 320,
    ease: "Back.easeOut",
  });
  scene.tweens.add({
    targets: t,
    alpha: 0,
    duration: 600,
    delay: 900,
    onComplete: () => t.destroy(),
  });
  flashScreen(scene, 0xffe89a, 240);
  return t;
}

export function showFloatingLine(
  scene: Phaser.Scene,
  text: string,
  opts: { y?: number; durationMs?: number; color?: string; fontSize?: number } = {},
): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const y = opts.y ?? h * 0.32;
  const t = scene.add.text(w / 2, y, text, {
    fontFamily: "serif",
    fontSize: `${opts.fontSize ?? 22}px`,
    color: opts.color ?? "#ffe6aa",
    stroke: "#000000",
    strokeThickness: 5,
    align: "center",
    fontStyle: "italic",
  }).setOrigin(0.5).setScrollFactor(0).setDepth(220).setAlpha(0);
  scene.tweens.add({ targets: t, alpha: 1, duration: 300 });
  scene.tweens.add({
    targets: t,
    alpha: 0,
    duration: 400,
    delay: opts.durationMs ?? 2200,
    onComplete: () => t.destroy(),
  });
}

export function spawnRedVignette(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const v = scene.add.rectangle(w / 2, h / 2, w, h, 0xff2222, 0.32)
    .setScrollFactor(0).setDepth(298);
  scene.tweens.add({
    targets: v,
    alpha: 0,
    duration: 360,
    onComplete: () => v.destroy(),
  });
}

export function spawnLevelUpBurst(
  scene: Phaser.Scene,
  follow: Phaser.GameObjects.GameObject,
): void {
  ensureFxTextures(scene);
  const target = follow as Phaser.GameObjects.Image;
  const ring = scene.add.image(target.x, target.y, FX_RING).setDepth(11).setTint(0xffe066).setScale(0.3);
  scene.tweens.add({
    targets: ring,
    scale: 3.2,
    alpha: 0,
    duration: 520,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });
  const e = scene.add.particles(target.x, target.y, FX_DOT, {
    speed: { min: 100, max: 200 },
    lifespan: 600,
    scale: { start: 1.2, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: 0xffe066,
    blendMode: "ADD",
    emitting: false,
  }).setDepth(11);
  e.explode(18, target.x, target.y);
  scene.time.delayedCall(700, () => e.destroy());
}
