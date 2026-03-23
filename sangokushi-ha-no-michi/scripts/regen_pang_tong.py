"""
龐統（Pang Tong）ポートレート再生成スクリプト

キャラクター要件:
- 鳳雛（フォンチュウ）の異名を持つが外見はパッとしない
- 「梲が上がらない」風貌: ぼさぼさの乱れた髪、だるそうな半目、
  猫背気味の姿勢、くたびれた地味な儒者の衣、わら帽子か乱れた帽子
- でも目の奥に隠れた知性の輝きがある
- ミュートなアースカラーのグラデーション背景
"""
from __future__ import annotations

import sys
from pathlib import Path

# 汎用モジュールへのパスを追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "ai-sprites-local"))

from PIL import Image
from comfyui_client import ComfyUIClient
from workflows import AUTO_MODEL

OUTPUT_DIR = Path("/Users/hiromichi.hirakawa/keko/create_game/output_games/sangokushi-ha-no-michi/src/assets/portraits")
SIZE = 512

CHARACTER = {
    "name": "pang_tong_portrait",
    "prompt": (
        "anime game art, Three Kingdoms era, "
        "close-up head and shoulders portrait of Pang Tong the Fledgling Phoenix, "
        "plain dark grey-brown scholar robes at shoulders, "
        "unkempt messy black hair partially covering face, straw hat tilted on head, "
        "tired sleepy half-lidded eyes, bored unmotivated expression, stubble on chin, "
        "1male, scholar strategist, "
        "face centered and large in frame, dramatic lighting, "
        "detailed face, vivid colors, dark brown-ochre gradient background"
    ),
    "negative": (
        "full body, waist shot, far away, small face, low quality, blurry, "
        "text, watermark, deformed face, extra fingers, bad anatomy, "
        "multiple characters, western cartoon, realistic photo, landscape, "
        "handsome pretty face, flashy ornate robes, neat tidy hair, energetic expression"
    ),
    "seed": 9070,
}

RETRY_SEEDS = [9171, 9272, 9373]


def generate_portrait(
    client: ComfyUIClient,
    name: str,
    prompt: str,
    negative: str,
    seed: int,
    model: str,
) -> Path:
    raw_dir = OUTPUT_DIR / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n[Portrait] Generating: {name} (model={model}, seed={seed})")
    print(f"  Prompt: {prompt[:100]}...")

    if model == "sdxl":
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
        from workflows import build_portrait_workflow_flux
        preset = "lite" if model == "flux-lite" else "full"
        workflow = build_portrait_workflow_flux(prompt=prompt, seed=seed, preset=preset)
    else:
        # SD 1.5
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

    portrait_path = OUTPUT_DIR / f"{name}.png"
    img = Image.open(str(paths[0])).convert("RGBA")
    img_resized = img.resize((SIZE, SIZE), Image.LANCZOS)
    img_resized.save(str(portrait_path))

    print(f"[Portrait] Done: {portrait_path} ({SIZE}x{SIZE})")
    return portrait_path


def convert_to_webp(png_path: Path) -> Path:
    """PNG を WebP に変換する"""
    webp_path = png_path.with_suffix(".webp")
    img = Image.open(str(png_path)).convert("RGBA")
    img.save(str(webp_path), "WEBP", quality=90)
    print(f"[WebP] Saved: {webp_path}")
    return webp_path


def main() -> None:
    model = AUTO_MODEL
    print(f"[System] Auto-detected model: {model}")

    client = ComfyUIClient()
    if not client.is_running():
        print("ERROR: ComfyUI not running at http://127.0.0.1:8188", file=sys.stderr)
        sys.exit(1)

    print(f"[System] ComfyUI is running.")
    print(f"[System] Output directory: {OUTPUT_DIR}")

    char = CHARACTER
    seeds = [char["seed"]] + RETRY_SEEDS

    for attempt, seed in enumerate(seeds, start=1):
        print(f"\n[Attempt {attempt}/{len(seeds)}] seed={seed}")
        try:
            portrait_path = generate_portrait(
                client=client,
                name=char["name"],
                prompt=char["prompt"],
                negative=char["negative"],
                seed=seed,
                model=model,
            )
            webp_path = convert_to_webp(portrait_path)
            print(f"\n[Done] Portrait generated:")
            print(f"  PNG:  {portrait_path}")
            print(f"  WebP: {webp_path}")
            return
        except Exception as e:
            print(f"[ERROR] Attempt {attempt} failed: {e}", file=sys.stderr)
            if attempt >= len(seeds):
                print("[ERROR] All attempts failed.", file=sys.stderr)
                sys.exit(1)
            print("[Retry] Trying next seed...")


if __name__ == "__main__":
    main()
