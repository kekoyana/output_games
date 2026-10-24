// 配置検証: 各ステージ 100 シードで ACCEPTANCE.md「配置」の全項目を検査する。
// 使い方: npm run verify:spawn  （esbuild で src/game を一時バンドルして Node から実行）
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  stdin: {
    contents: [
      'export * from "./src/game/spawn";',
      'export * from "./src/game/geometry";',
      'export * from "./src/game/stages";',
      'export * from "./src/game/types";',
      'export * from "./src/game/motion";',
    ].join("\n"),
    resolveDir: root,
    sourcefile: "verify-entry.ts",
    loader: "ts",
  },
  bundle: true, format: "esm", platform: "node", write: false,
});
const code = result.outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const { STAGES, WALK_POLYGONS, generateScene, allEntities, entityBox, entityCenter, entityHeight,
  pointInPolygon, applyMotions, WORLD_W, WORLD_H } = M;

const SEEDS = 100;
const EXPECT = {
  1: { mobs: 60, decoys: 4, bonus: 0, vis: 0.85, dist: 300, near: 0, types: ["decoy_d", "decoy_e"] },
  2: { mobs: 100, decoys: 8, bonus: 0, vis: 0.8, dist: 300, near: 0, types: ["decoy_a", "decoy_b", "decoy_d", "decoy_e"] },
  3: { mobs: 150, decoys: 12, bonus: 1, vis: 0.75, dist: 150, near: 3, types: ["decoy_a", "decoy_b", "decoy_c", "decoy_d", "decoy_e"] },
  4: { mobs: 200, decoys: 16, bonus: 2, vis: 0.7, dist: 100, near: 4, types: ["decoy_a", "decoy_b", "decoy_c", "decoy_d", "decoy_e"] },
};

/** 独立実装: 1px 格子で手前の箱に隠されない点の割合を数える */
function rasterVisible(l, stage) {
  const t = l.ponta;
  const tb = entityBox(t, stage);
  const fronts = allEntities(l)
    .filter((o) => o !== t && (o.y > t.y || (o.y === t.y && o.id > t.id)))
    .map((o) => entityBox(o, stage));
  let vis = 0, n = 0;
  for (let y = Math.floor(tb.t) + 0.5; y < tb.b; y += 1) {
    for (let x = Math.floor(tb.l) + 0.5; x < tb.r; x += 1) {
      n++;
      if (!fronts.some((b) => x >= b.l && x <= b.r && y >= b.t && y <= b.b)) vis++;
    }
  }
  return vis / n;
}

/** 検証用の独立した時刻列（生成側の標本とは別。決定的） */
const CHECK_TIMES = Array.from({ length: 120 }, (_, i) => ((i * 7919) % 12011) / 100 + 0.013 * i);
const POSES = ["side", "shop", "flee", "chase"];

let totalFail = 0;
for (const stage of STAGES) {
  const ex = EXPECT[stage.id];
  const fails = {};
  const fail = (k, msg) => { (fails[k] ??= []).push(msg); };
  const poly = WALK_POLYGONS[stage.bg].map((p) => ({ x: p.x * WORLD_W, y: p.y * WORLD_H }));
  const stats = { moving: 0, total: 0, pontaMoving: 0, pontaShop: 0, dynMin: 1 };
  let maxAttempt = 0, minVis = 1, minNear = 99, minDecoyDist = 1e9, minGapSeen = 1e9;
  const t0 = performance.now();
  for (let i = 0; i < SEEDS; i++) {
    const seed = stage.fixedSeed + i * 7919 + (i === 0 ? 0 : 13);
    let l;
    try { l = generateScene(stage, seed); } catch (e) { fail("generate", `seed ${seed}: ${e.message}`); continue; }
    const all = allEntities(l);
    maxAttempt = Math.max(maxAttempt, l.attempt);
    if (l.mobs.length !== ex.mobs) fail("count", `seed ${seed}: mobs ${l.mobs.length}`);
    if (l.decoys.length !== ex.decoys) fail("count", `seed ${seed}: decoys ${l.decoys.length}`);
    if (l.bonuses.length !== ex.bonus) fail("count", `seed ${seed}: bonus ${l.bonuses.length}`);
    const pc = all.filter((e) => e.tex === "ponta" || e.kind === "ponta").length;
    if (pc !== 1) fail("ponta1", `seed ${seed}: ${pc}`);
    const l2 = generateScene(stage, seed);
    if (JSON.stringify(l) !== JSON.stringify(l2)) fail("repro", `seed ${seed}`);
    const p = l.ponta;
    const pcen = entityCenter(p, stage);
    for (const pt of [{ x: p.x, y: p.y }, pcen]) {
      const d = Math.hypot(pt.x - WORLD_W / 2, pt.y - WORLD_H / 2);
      if (d < 250) fail("center", `seed ${seed}: ${d.toFixed(0)}`);
      if (pt.x < 80 || pt.y < 80 || pt.x > WORLD_W - 80 || pt.y > WORLD_H - 80) fail("edge", `seed ${seed}: ${pt.x | 0},${pt.y | 0}`);
    }
    let near = 0;
    for (const d of l.decoys) {
      const dc = entityCenter(d, stage);
      const feet = Math.hypot(d.x - p.x, d.y - p.y);
      const cen = Math.hypot(dc.x - pcen.x, dc.y - pcen.y);
      const mn = Math.min(feet, cen);
      minDecoyDist = Math.min(minDecoyDist, mn);
      if (mn < ex.dist) fail("decoyDist", `seed ${seed}: ${mn.toFixed(0)}`);
      if (feet <= 600 && cen <= 600) near++;
    }
    minNear = Math.min(minNear, near);
    if (near < ex.near) fail("near", `seed ${seed}: ${near}`);
    const vis = rasterVisible(l, stage);
    minVis = Math.min(minVis, vis);
    if (vis < ex.vis) fail("visible", `seed ${seed}: ${(vis * 100).toFixed(1)}%`);
    const dtypes = new Set(l.decoys.map((d) => d.tex));
    if (dtypes.size !== ex.types.length || ex.types.some((t) => !dtypes.has(t))) fail("decoyTypes", `seed ${seed}: ${[...dtypes]}`);
    const mtypes = new Set(l.mobs.map((m) => m.tex));
    if (mtypes.size !== stage.mobTypes.length) fail("mobTypes", `seed ${seed}: ${mtypes.size}`);
    for (const e of all) {
      if (!pointInPolygon(e.x, e.y, poly)) fail("walkArea", `seed ${seed}: #${e.id} ${e.tex}`);
      if (e.x < 80 || e.y < 80 || e.x > WORLD_W - 80 || e.y > WORLD_H - 80) fail("edgeAll", `seed ${seed}: #${e.id}`);
      if (e.scale < 0.9 - 1e-9 || e.scale > 1.1 + 1e-9) fail("scale", `seed ${seed}: #${e.id}`);
      void entityHeight;
    }
    // --- 動き ---
    const chars = [l.ponta, ...l.decoys, ...l.mobs];
    const byId = new Map(all.map((e) => [e.id, e]));
    for (const e of chars) {
      if (!e.move) { if (e.pose !== "front" && e.pose !== "shop") fail("motionPose", `seed ${seed}: #${e.id} ${e.pose}`); continue; }
      stats.moving++;
      if (e.pose !== "walk" && e.pose !== "pair") fail("motionPose", `seed ${seed}: #${e.id} ${e.pose}`);
      for (const x of [e.hx - e.move.amp, e.hx + e.move.amp]) {
        if (!pointInPolygon(x, e.y, poly) || x < 80 || x > WORLD_W - 80) fail("motionArea", `seed ${seed}: #${e.id} x=${x | 0}`);
      }
      if (e.pose === "pair") {
        const o = byId.get(e.move.partner);
        const ok = o && o.move && o.move.partner === e.id && o.move.slot === -e.move.slot
          && o.move.amp === e.move.amp && o.move.period === e.move.period && o.move.phase === e.move.phase
          && (e.hx - o.hx) * e.move.slot > 0;
        if (!ok) fail("pairs", `seed ${seed}: #${e.id}`);
      }
    }
    stats.total += chars.length;
    if (l.ponta.move) stats.pontaMoving++;
    if (l.ponta.pose === "shop") stats.pontaShop++;
    let dynMin = 1;
    for (const t of CHECK_TIMES) {
      applyMotions(chars, t);
      dynMin = Math.min(dynMin, rasterVisible(l, stage));
    }
    for (const e of chars) e.x = e.hx;
    stats.dynMin = Math.min(stats.dynMin, dynMin);
    if (dynMin < ex.vis - 0.02) fail("motionVisible", `seed ${seed}: ${(dynMin * 100).toFixed(1)}%`);
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      const g = Math.hypot(all[a].x - all[b].x, all[a].y - all[b].y);
      minGapSeen = Math.min(minGapSeen, g);
      if (g < stage.minGap - 1e-6) fail("minGap", `seed ${seed}: ${g.toFixed(1)}`);
    }
  }
  const ms = ((performance.now() - t0) / SEEDS).toFixed(1);
  const keys = ["generate", "count", "ponta1", "repro", "center", "edge", "decoyDist", "near", "visible", "decoyTypes", "mobTypes", "walkArea", "edgeAll", "scale", "minGap", "motionPose", "motionArea", "pairs", "motionVisible"];
  const bad = keys.filter((k) => fails[k]);
  totalFail += bad.length;
  console.log(`Stage ${stage.id} ${stage.name.en}: ${bad.length === 0 ? "PASS" : "FAIL"}  (${SEEDS} seeds, ${ms}ms/seed, maxRetry=${maxAttempt}, minVisible=${(minVis * 100).toFixed(1)}%, minNear=${minNear}, minDecoyDist=${minDecoyDist.toFixed(0)}, minGap=${minGapSeen.toFixed(0)})`);
  console.log(`   motion: moving=${(stats.moving / stats.total * 100).toFixed(0)}% pontaMoving=${stats.pontaMoving}/${SEEDS} pontaShop=${stats.pontaShop}/${SEEDS} dynamicMinVisible=${(stats.dynMin * 100).toFixed(1)}%`);
  for (const k of keys) console.log(`   ${fails[k] ? "FAIL" : "PASS"} ${k}${fails[k] ? `  x${fails[k].length} e.g. ${fails[k].slice(0, 3).join(" | ")}` : ""}`);
}
console.log(totalFail === 0 ? "\nALL PASS" : `\nFAILED checks: ${totalFail}`);
process.exit(totalFail === 0 ? 1 - 1 : 1);
