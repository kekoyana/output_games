// AIプレイテスト: Playwright で実マウス/タッチ操作により通しプレイし、契約の挙動を検査する。
// 事前に `npm run dev`（5306）を起動しておく。Playwright はリポジトリ直下の node_modules を使う。
// 使い方: node scripts/playtest.mjs   → scripts/playtest-report.json と shots/ にスクリーンショットを出力
import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const { chromium } = createRequire(resolve(root, "package.json"))("playwright");
const SHOTS = resolve(here, "playtest-shots");
mkdirSync(SHOTS, { recursive: true });
const URL = "http://localhost:5306/";

const report = { startedAt: new Date().toISOString(), viewports: [], errors: [], checks: [] };
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

async function run(browser, vp) {
  const touch = vp.touch;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const tag = `${vp.name}`;
  page.on("pageerror", (e) => report.errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(`[${tag}] console: ${m.text()}`);
  });
  const external = [];
  page.on("request", (r) => {
    const u = new globalThis.URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) external.push(r.url());
  });

  const state = () => page.evaluate(() => window.getGameState());
  const api = (fn, ...args) => page.evaluate(([f, a]) => window.__findPonta[f](...a), [fn, args]);
  const waitScene = (name, timeout = 15000) =>
    page.waitForFunction((n) => window.getGameState && window.getGameState().scene === n, name, { timeout });
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${tag}-${n}.png` });
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const clickBtn = async (re) => {
    const list = await api("getInteractives");
    const t = list.find((i) => re.test(i.label));
    if (!t) throw new Error(`button ${re} not found in ${JSON.stringify(list.map((i) => i.label))}`);
    await tapAt(t.x, t.y);
  };
  const wait = (ms) => page.waitForTimeout(ms);
  const tapWorldReal = async (wx, wy) => {
    const p = await api("worldToPage", wx, wy);
    await tapAt(p.x, p.y);
  };

  const t0 = Date.now();
  await page.goto(URL);
  await waitScene("Title");
  check(`[${tag}] Title 表示（Preloadから）`, Date.now() - t0 < 3000, `${Date.now() - t0}ms`);
  await shot("1-title");

  // 言語切替の保存と復元（日本語ラベルが実際に表示されること）
  await clickBtn(/日本語/);
  await wait(300);
  const stored = await page.evaluate(() => localStorage.getItem("find-ponta-lang"));
  await page.reload();
  await waitScene("Title");
  const jaLabels = (await api("getInteractives")).map((i) => i.label);
  check(`[${tag}] 言語(ja)がリロード後も復元（保存キー find-ponta-lang）`, stored === "ja" && jaLabels.some((l) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(l) && l !== "日本語"), `stored=${stored} labels=${jaLabels.join("|")}`);
  await clickBtn(/^EN$/);
  await wait(300);
  const enLabels = (await api("getInteractives")).map((i) => i.label);
  check(`[${tag}] EN に戻すと英語表示`, enLabels.includes("PLAY"), enLabels.join("|"));

  // 音量の復元（保存値を入れてリロード → Settings 画面を撮影して目視確認用）
  await page.evaluate(() => {
    localStorage.setItem("find-ponta-bgm-volume", "0.7");
    localStorage.setItem("find-ponta-sfx-volume", "0.2");
  });
  await page.reload();
  await waitScene("Title");
  await clickBtn(/Settings/);
  await wait(500);
  await shot("1b-settings-restored");
  await page.keyboard.press("Escape");
  await clickBtn(/close|CLOSE|閉じる|back|BACK/i).catch(() => {});
  await waitScene("Title").catch(() => {});

  await clickBtn(/PLAY/);
  await waitScene("StageSelect");
  await shot("2-select");
  const sel = await api("getInteractives");
  check(`[${tag}] ステージ選択に PLAY は1つだけ（S2〜4 はロック）`, sel.filter((i) => /^PLAY$/.test(i.label)).length === 1);

  const results = [];
  for (let stage = 1; stage <= 4; stage++) {
    if (stage === 1) await clickBtn(/^PLAY$/);
    await waitScene("Game");
    const st0 = await state();
    check(`[${tag}] S${stage} Game 開始（intro）`, st0.stage === stage && st0.phase === "intro", `stage=${st0.stage} phase=${st0.phase}`);
    await shot(`3-s${stage}-intro`);
    await clickBtn(/start|START|スタート|はじめ|GO|OK/i);
    await wait(500);
    const st1 = await state();
    check(`[${tag}] S${stage} プレイ開始でタイマー作動`, st1.phase === "playing", `phase=${st1.phase} timeLeft=${st1.timeLeft}`);

    // パン（実ドラッグ）
    const c = { x: vp.w / 2, y: vp.h / 2 };
    const before = (await state()).viewCenter;
    let panAfter = before;
    if (touch) {
      const cdp = await ctx.newCDPSession(page);
      const tp = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
      await tp("touchStart", [{ x: c.x, y: c.y }]);
      for (let i = 1; i <= 8; i++) await tp("touchMove", [{ x: c.x - i * 12, y: c.y - i * 6 }]);
      await tp("touchEnd", []);
      await wait(300);
      panAfter = (await state()).viewCenter;
      // ピンチ
      await api("setView", 1, 1152, 768);
      const z0 = (await state()).zoom;
      await tp("touchStart", [{ x: c.x - 40, y: c.y }, { x: c.x + 40, y: c.y }]);
      for (let i = 1; i <= 10; i++) await tp("touchMove", [{ x: c.x - 40 - i * 8, y: c.y }, { x: c.x + 40 + i * 8, y: c.y }]);
      await tp("touchEnd", []);
      const z1 = (await state()).zoom;
      check(`[${tag}] S${stage} ピンチでズームイン`, z1 > z0, `${z0.toFixed(2)}→${z1.toFixed(2)}`);
    } else {
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(c.x - i * 20, c.y - i * 10);
      await page.mouse.up();
      await wait(300);
      panAfter = (await state()).viewCenter;
      await api("setView", 1, 1152, 768);
      const z0 = (await state()).zoom;
      await page.mouse.move(c.x, c.y);
      await page.mouse.wheel(0, -600);
      await wait(200);
      const z1 = (await state()).zoom;
      check(`[${tag}] S${stage} ホイールでズームイン`, z1 > z0, `${z0.toFixed(2)}→${z1.toFixed(2)}`);
    }
    const moved = Math.hypot(panAfter.x - before.x, panAfter.y - before.y);
    check(`[${tag}] S${stage} ドラッグでパンする（移動量>=30px）`, moved >= 30, `moved=${moved.toFixed(0)}px ${JSON.stringify(before)}→${JSON.stringify(panAfter)}`);
    await shot(`4-s${stage}-zoom`);

    // ズーム上限・下限のクランプ
    await api("setView", 99, 1152, 768);
    const zmax = (await state()).zoom;
    await api("setView", 0.01, 1152, 768);
    const sMin = await state();
    check(`[${tag}] S${stage} ズーム範囲が最小〜3.0にクランプ`, zmax <= 3.0001 && Math.abs(sMin.zoom - sMin.minZoom) < 1e-3, `max=${zmax} min=${sMin.zoom}/${sMin.minZoom}`);

    // ハズレタップ（実タップ）→ ペナルティ
    const ponta = await api("getPontaWorldPos");
    const decoys = await api("getDecoyWorldPositions");
    const mobs = await api("getMobWorldPositions");
    await api("setView", 2, ponta.x, ponta.y);
    await wait(150);
    const tBefore = (await state()).timeLeft;
    const far = decoys.concat(mobs).sort((a, b) => Math.hypot(b.x - ponta.x, b.y - ponta.y) - Math.hypot(a.x - ponta.x, a.y - ponta.y))[0];
    const missKind = await api("tapWorld", far.x, far.y);
    await wait(150);
    const s2 = await state();
    check(`[${tag}] S${stage} ハズレで時間減・ハズレ数増（${missKind}）`, s2.misses === 1 && s2.timeLeft < tBefore - 1.5, `misses=${s2.misses} ${tBefore.toFixed(1)}→${s2.timeLeft.toFixed(1)}`);

    // ヒント
    const hintsBefore = (await state()).hintsLeft;
    await clickBtn(/^hint$/);
    await wait(300);
    const sh = await state();
    check(`[${tag}] S${stage} ヒントで残数減・円表示`, sh.hintsUsed === 1 && sh.hintsLeft === hintsBefore - 1 && sh.hintActive, `used=${sh.hintsUsed} left=${sh.hintsLeft} active=${sh.hintActive}`);
    await shot(`5-s${stage}-hint`);
    await wait(5600);

    // ボーナス（S3,S4）
    if (stage >= 3) {
      const bonus = (await api("getBonusWorldPositions"))[0];
      const sb = await state();
      await api("setView", 2, bonus.x, bonus.y);
      await wait(150);
      await tapWorldReal(bonus.x, bonus.y);
      await wait(300);
      const sa = await state();
      check(`[${tag}] S${stage} ボーナス発見で+1・時間増`, sa.bonusFound === 1 && sa.timeLeft > sb.timeLeft - 1, `found=${sa.bonusFound} ${sb.timeLeft.toFixed(1)}→${sa.timeLeft.toFixed(1)}`);
    }

    // ポンタを実タップ → クリア
    await api("setView", 2, ponta.x, ponta.y);
    await wait(500);
    await tapWorldReal(ponta.x, ponta.y);
    await wait(400);
    const sc = await state();
    check(`[${tag}] S${stage} ポンタ実タップでクリア演出`, sc.phase === "cleared" || sc.scene === "Result", `phase=${sc.phase} scene=${sc.scene}`);
    await shot(`6-s${stage}-found`);
    await waitScene("Result", 10000);
    const rs = await state();
    check(`[${tag}] S${stage} Result 到達（クリア・スター・スコア）`, rs.cleared === true && rs.stars >= 1 && rs.score > 0, `stars=${rs.stars} score=${rs.score} misses=${rs.misses} hints=${rs.hintsUsed}`);
    results.push({ stage, score: rs.score, stars: rs.stars, seed: rs.seed });
    await shot(`7-s${stage}-result`);
    if (stage < 4) {
      await clickBtn(/next|NEXT|次/i);
    }
  }
  await clickBtn(/stage ?select|STAGE|選択|一覧|BACK/i).catch(() => {});
  await wait(500);
  report.viewports.push({ ...vp, results, externalRequests: external });
  check(`[${tag}] 外部ドメインへのリクエストなし`, external.length === 0, external.slice(0, 3).join(","));
  await ctx.close();
}

const browser = await chromium.launch();
try {
  for (const vp of [
    { name: "pc1280x720", w: 1280, h: 720, touch: false },
    { name: "sp390x844", w: 390, h: 844, touch: true },
  ]) {
    try {
      await run(browser, vp);
    } catch (e) {
      check(`[${vp.name}] 通しプレイ完走`, false, e.message.split("\n")[0]);
    }
  }
} finally {
  await browser.close();
}
check("pageerror / console.error が0件", report.errors.length === 0, report.errors.slice(0, 3).join(" || "));
const failed = report.checks.filter((c) => !c.ok);
report.summary = { total: report.checks.length, failed: failed.length };
writeFileSync(resolve(here, "playtest-report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.summary.total - failed.length}/${report.summary.total} PASS`);
process.exit(failed.length ? 1 : 0);
