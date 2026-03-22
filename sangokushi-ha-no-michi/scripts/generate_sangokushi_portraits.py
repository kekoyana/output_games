"""
三国志ダイスローグライトゲーム用キャラクターポートレート生成スクリプト

全キャラで顔の大きさ・構図を統一した close-up head and shoulders portrait を生成する。
"""
from __future__ import annotations

import sys
from pathlib import Path

# 汎用モジュールへのパスを追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "ai-sprites-local"))

from PIL import Image

from comfyui_client import ComfyUIClient
from workflows import build_portrait_workflow, AUTO_MODEL, build_portrait_workflow_sdxl, build_portrait_workflow_flux

OUTPUT_DIR = Path("/Users/hiromichi.hirakawa/keko/create_game/output_games/sangokushi-ha-no-michi/src/assets/portraits")
SIZE = 512

CHARACTERS = [
    {
        "name": "guan_yu_portrait",
        "prompt": (
            "anime game art, Three Kingdoms era, "
            "close-up head and shoulders portrait of Guan Yu, "
            "green armor pauldrons on shoulders, long flowing black beard, red-tinted face, "
            "dignified noble expression, 1male, warrior general, "
            "face centered and large in frame, dramatic lighting, "
            "detailed face, vivid colors, dark red gradient background"
        ),
        "negative": (
            "full body, waist shot, far away, small face, low quality, blurry, "
            "text, watermark, deformed face, extra fingers, bad anatomy, "
            "multiple characters, western cartoon, realistic photo, landscape"
        ),
        "seed": 1001,
    },
    {
        "name": "zhang_fei_portrait",
        "prompt": (
            "anime game art, Three Kingdoms era, "
            "close-up head and shoulders portrait of Zhang Fei, "
            "black heavy armor pauldrons on shoulders, thick bushy black beard, "
            "fierce intimidating expression, muscular neck, 1male, warrior general, "
            "face centered and large in frame, dramatic lighting, "
            "detailed face, vivid colors, dark blue-black gradient background"
        ),
        "negative": (
            "full body, waist shot, far away, small face, low quality, blurry, "
            "text, watermark, deformed face, extra fingers, bad anatomy, "
            "multiple characters, western cartoon, realistic photo, landscape"
        ),
        "seed": 2002,
    },
    {
        "name": "zhao_yun_portrait",
        "prompt": (
            "anime game art, Three Kingdoms era, "
            "close-up head and shoulders portrait of Zhao Yun, "
            "silver-white armor with blue accents pauldrons on shoulders, "
            "young handsome face, heroic calm expression, clean-shaven, 1male, warrior general, "
            "face centered and large in frame, dramatic lighting, "
            "detailed face, vivid colors, blue-silver gradient background"
        ),
        "negative": (
            "full body, waist shot, far away, small face, low quality, blurry, "
            "text, watermark, deformed face, extra fingers, bad anatomy, "
            "multiple characters, western cartoon, realistic photo, landscape"
        ),
        "seed": 3003,
    },
    {
        "name": "zhuge_liang_portrait",
        "prompt": (
            "anime game art, Three Kingdoms era, "
            "close-up head and shoulders portrait of Zhuge Liang, "
            "white scholar robes at shoulders, black hair with ornate crown headpiece, "
            "wise serene calm expression, feather fan partially visible near chin, 1male, scholar strategist, "
            "face centered and large in frame, soft dramatic lighting, "
            "detailed face, vivid colors, light purple-white gradient background"
        ),
        "negative": (
            "full body, waist shot, far away, small face, low quality, blurry, "
            "text, watermark, deformed face, extra fingers, bad anatomy, "
            "multiple characters, western cartoon, realistic photo, landscape"
        ),
        "seed": 4004,
    },
    {
        "name": "liu_bei_portrait",
        "prompt": (
            "anime game art, Three Kingdoms era, "
            "close-up head and shoulders portrait of Liu Bei, "
            "golden imperial dragon-embroidered robes at shoulders, imperial crown, "
            "benevolent dignified kind expression, gentle ruler, 1male, "
            "face centered and large in frame, warm dramatic lighting, "
            "detailed face, vivid colors, golden-amber gradient background"
        ),
        "negative": (
            "full body, waist shot, far away, small face, low quality, blurry, "
            "text, watermark, deformed face, extra fingers, bad anatomy, "
            "multiple characters, western cartoon, realistic photo, landscape"
        ),
        "seed": 5005,
    },
    {
        "name": "cao_cao_portrait",
        "prompt": (
            "anime game art, Three Kingdoms era, "
            "close-up head and shoulders portrait of Cao Cao, "
            "black and gold ornate armor pauldrons on shoulders, elaborate dark helmet, "
            "sharp cunning eyes, ambitious charismatic expression, dark aura, 1male, warlord, "
            "face centered and large in frame, dramatic dark lighting, "
            "detailed face, vivid colors, dark charcoal-gold gradient background"
        ),
        "negative": (
            "full body, waist shot, far away, small face, low quality, blurry, "
            "text, watermark, deformed face, extra fingers, bad anatomy, "
            "multiple characters, western cartoon, realistic photo, landscape"
        ),
        "seed": 6006,
    },
    {
        "name": "lu_bu_portrait",
        "prompt": (
            "anime game art, Three Kingdoms era, "
            "close-up head and shoulders portrait of Lu Bu, "
            "elaborate red ornate armor pauldrons on shoulders, red feathered phoenix crown helmet, "
            "overwhelming fierce dominating expression, powerful warrior, 1male, "
            "face centered and large in frame, intense dramatic lighting, "
            "detailed face, vivid colors, crimson-dark gradient background"
        ),
        "negative": (
            "full body, waist shot, far away, small face, low quality, blurry, "
            "text, watermark, deformed face, extra fingers, bad anatomy, "
            "multiple characters, western cartoon, realistic photo, landscape"
        ),
        "seed": 7007,
    },
]


def generate_portrait(
    client: ComfyUIClient,
    name: str,
    prompt: str,
    negative: str,
    seed: int,
    model: str,
) -> Path:
    out_dir = OUTPUT_DIR
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[Portrait] Generating: {name} (model={model}, seed={seed})")
    print(f"  Prompt: {prompt[:80]}...")

    if model == "sdxl":
        # SDXLはworkflowのネガティブプロンプトをオーバーライドできないので直接build_sdxl_workflowを使う
        from workflows import build_sdxl_workflow
        workflow = build_sdxl_workflow(
            prompt=prompt,
            negative=negative,
            seed=seed,
            steps=30,
            cfg=7.5,
            width=1024,
            height=1024,
        )
    elif model in ("flux", "flux-lite"):
        preset = "lite" if model == "flux-lite" else "full"
        workflow = build_portrait_workflow_flux(prompt=prompt, seed=seed, preset=preset)
    else:
        # SD 1.5 - build_sd15_workflowを直接使う
        from workflows import build_sd15_workflow
        workflow = build_sd15_workflow(
            prompt=prompt,
            negative=negative,
            seed=seed,
            steps=30,
            cfg=7.5,
            width=512,
            height=512,
        )

    raw_path = raw_dir / f"{name}.png"
    paths = client.generate(workflow, output_path=raw_path, timeout=600)
    print(f"[Portrait] Raw saved: {paths[0]}")

    # SDXLは1024x1024なのでリサイズ、SD15は512x512でそのまま
    portrait_path = out_dir / f"{name}.png"
    img = Image.open(str(paths[0])).convert("RGBA")
    img_resized = img.resize((SIZE, SIZE), Image.LANCZOS)
    img_resized.save(str(portrait_path))

    print(f"[Portrait] Done: {portrait_path} ({SIZE}x{SIZE})")
    return portrait_path


def main() -> None:
    from workflows import AUTO_MODEL
    model = AUTO_MODEL
    print(f"[System] Auto-detected model: {model}")

    client = ComfyUIClient()
    if not client.is_running():
        print("ERROR: ComfyUI not running at http://127.0.0.1:8188", file=sys.stderr)
        sys.exit(1)

    print(f"[System] ComfyUI is running. Generating {len(CHARACTERS)} portraits...")
    print(f"[System] Output directory: {OUTPUT_DIR}")

    results = []
    for char in CHARACTERS:
        try:
            portrait_path = generate_portrait(
                client=client,
                name=char["name"],
                prompt=char["prompt"],
                negative=char["negative"],
                seed=char["seed"],
                model=model,
            )
            results.append({"name": char["name"], "path": str(portrait_path), "status": "ok"})
        except Exception as e:
            print(f"[ERROR] Failed to generate {char['name']}: {e}", file=sys.stderr)
            results.append({"name": char["name"], "status": "error", "error": str(e)})

    print(f"\n[Done] {sum(1 for r in results if r['status'] == 'ok')}/{len(results)} portraits generated.")
    for r in results:
        status = "OK" if r["status"] == "ok" else "FAILED"
        print(f"  [{status}] {r['name']}")


if __name__ == "__main__":
    main()
