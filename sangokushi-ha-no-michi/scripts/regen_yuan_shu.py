"""袁術ポートレート再生成 - 他キャラと画角を統一（顔クローズアップ）"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "ai-sprites-local"))

from PIL import Image
from comfyui_client import ComfyUIClient
from workflows import AUTO_MODEL

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "portraits"
SIZE = 512

CHARACTER = {
    "name": "yuan_shu_portrait",
    "prompt": (
        "anime game art, Three Kingdoms era, "
        "close-up face portrait of Yuan Shu, head and shoulders only, "
        "fat round chubby face filling the frame, thick eyebrows, small cunning eyes, "
        "arrogant proud smug expression, short trimmed beard, "
        "golden ornate crown on head, golden imperial robe collar visible at shoulders, "
        "1male, self-proclaimed emperor, overweight nobleman, "
        "face large and centered in frame, dramatic warm lighting, "
        "detailed face, vivid colors, purple-gold gradient background"
    ),
    "negative": (
        "full body, half body, waist shot, far away, small face, zoomed out, "
        "low quality, blurry, text, watermark, deformed face, extra fingers, bad anatomy, "
        "multiple characters, western cartoon, realistic photo, landscape, "
        "thin face, slim, young face, hands visible, holding objects, "
        "chest visible, torso visible, seated pose"
    ),
    "seed": 9010,
}

RETRY_SEEDS = [9020, 9030, 9040]

def generate_portrait(client, name, prompt, negative, seed, model):
    raw_dir = OUTPUT_DIR / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n[Portrait] Generating: {name} (model={model}, seed={seed})")
    if model == "sdxl":
        from workflows import build_sdxl_workflow
        workflow = build_sdxl_workflow(
            prompt=prompt, negative=negative,
            seed=seed, steps=30, cfg=7.5, width=1024, height=1024,
        )
    elif model in ("flux", "flux-lite"):
        from workflows import build_portrait_workflow_flux
        preset = "lite" if model == "flux-lite" else "full"
        workflow = build_portrait_workflow_flux(prompt=prompt, seed=seed, preset=preset)
    else:
        from workflows import build_sd15_workflow
        workflow = build_sd15_workflow(
            prompt=prompt, negative=negative,
            seed=seed, steps=30, cfg=7.5, width=512, height=512,
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

def main():
    model = AUTO_MODEL
    print(f"[System] Auto-detected model: {model}")
    client = ComfyUIClient()
    if not client.is_running():
        print("ERROR: ComfyUI not running", file=sys.stderr)
        sys.exit(1)
    char = CHARACTER
    seeds = [char["seed"]] + RETRY_SEEDS
    for attempt, seed in enumerate(seeds, start=1):
        print(f"\n[Attempt {attempt}/{len(seeds)}] seed={seed}")
        try:
            path = generate_portrait(client, char["name"], char["prompt"], char["negative"], seed, model)
            print(f"\n[Done] {path}")
            return
        except Exception as e:
            print(f"[ERROR] {e}", file=sys.stderr)
            if attempt >= len(seeds):
                sys.exit(1)

if __name__ == "__main__":
    main()
