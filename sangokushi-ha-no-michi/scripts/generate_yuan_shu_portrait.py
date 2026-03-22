"""
袁術（Yuan Shu）ポートレート生成スクリプト

既存の三国志ポートレートと同スタイル（anime game art, Three Kingdoms era）で生成する。
出力先: output_games/sangokushi-ha-no-michi/src/assets/portraits/yuan_shu_portrait.png
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
    "name": "yuan_shu_portrait",
    "prompt": (
        "anime game art, Three Kingdoms era, "
        "close-up head and shoulders portrait of Yuan Shu, "
        "elaborate golden imperial robes at shoulders, jade ornate crown, "
        "arrogant proud smug expression, fat round chubby face, thick eyebrows, "
        "overweight nobleman, self-proclaimed emperor, holding imperial jade seal, "
        "purple and gold background, 1male, warlord ruler, "
        "face centered and large in frame, dramatic warm lighting, "
        "detailed face, vivid colors, purple-gold gradient background"
    ),
    "negative": (
        "full body, waist shot, far away, small face, low quality, blurry, "
        "text, watermark, deformed face, extra fingers, bad anatomy, "
        "multiple characters, western cartoon, realistic photo, landscape, "
        "thin face, slim, young face"
    ),
    "seed": 8008,
}

RETRY_SEEDS = [8088, 8808, 8888]


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

    portrait_path = out_dir / f"{name}.png"
    img = Image.open(str(paths[0])).convert("RGBA")
    img_resized = img.resize((SIZE, SIZE), Image.LANCZOS)
    img_resized.save(str(portrait_path))

    print(f"[Portrait] Done: {portrait_path} ({SIZE}x{SIZE})")
    return portrait_path


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
            print(f"\n[Done] Portrait generated: {portrait_path}")
            return
        except Exception as e:
            print(f"[ERROR] Attempt {attempt} failed: {e}", file=sys.stderr)
            if attempt >= len(seeds):
                print("[ERROR] All attempts failed.", file=sys.stderr)
                sys.exit(1)
            print("[Retry] Trying next seed...")


if __name__ == "__main__":
    main()
