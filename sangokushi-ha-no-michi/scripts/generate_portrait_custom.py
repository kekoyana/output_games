"""
三国志ダイス英傑伝 - ポートレート生成スクリプト（Counterfeit-V3.0使用）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# 汎用モジュールへのパスを追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "ai-sprites-local"))

from comfyui_client import ComfyUIClient
from postprocess import pixelize_portrait
from PIL import Image


CHECKPOINT = "Counterfeit-V3.0_fix_fp16.safetensors"


def build_portrait_workflow_anime(
    prompt: str,
    negative: str = "",
    seed: int = 42,
    steps: int = 30,
    cfg: float = 7.5,
) -> dict:
    default_negative = (
        "text, watermark, realistic photo, blurry, deformed face, "
        "extra fingers, bad anatomy, full body, landscape, "
        "multiple characters, western cartoon, lowres, worst quality, bad quality"
    )
    neg = negative or default_negative

    workflow: dict = {
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["4", 1]},
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": neg, "clip": ["4", 1]},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1},
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler_ancestral",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "comfy_gen", "images": ["8", 0]},
        },
    }
    return workflow


def generate_portrait(
    name: str,
    description: str,
    output_dir: str,
    seed: int = 42,
    size: int = 512,
    server: str = "http://127.0.0.1:8188",
) -> dict:
    client = ComfyUIClient(server)
    if not client.is_running():
        print(f"ERROR: ComfyUI not running at {server}", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(output_dir)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    prompt = (
        f"masterpiece, best quality, highres, anime style, "
        f"{description}, "
        f"face close-up portrait, upper chest visible, "
        f"sharp clean lines, vivid colors, solid color background, "
        f"game dialogue portrait, detailed expressive face"
    )

    print(f"[Portrait] Generating: {name} (checkpoint={CHECKPOINT})...")
    workflow = build_portrait_workflow_anime(prompt=prompt, seed=seed)

    raw_path = raw_dir / f"{name}.png"
    paths = client.generate(workflow, output_path=raw_path)
    print(f"[Portrait] Raw saved: {paths[0]}")

    portrait_path = out_dir / f"{name}.png"
    img = Image.open(str(paths[0])).convert("RGBA")
    img.resize((size, size), Image.LANCZOS).save(str(portrait_path))
    print(f"[Portrait] Done: {portrait_path} ({size}x{size})")

    return {
        "name": name,
        "raw": str(paths[0]),
        "portrait": str(portrait_path),
    }


def main() -> None:
    output_dir = "../workspace/src/assets/portraits"
    characters = [
        {
            "name": "guan_yu_portrait",
            "seed": 1001,
            "description": (
                "Guan Yu, Chinese Three Kingdoms general, long flowing beard, "
                "green armor with gold trim, holding Green Dragon Crescent Blade, "
                "determined heroic expression, red face, black hair tied up, "
                "ancient Chinese warrior, noble and powerful"
            ),
        },
        {
            "name": "zhang_fei_portrait",
            "seed": 1002,
            "description": (
                "Zhang Fei, Chinese Three Kingdoms general, thick black beard, "
                "black heavy armor, fierce intimidating expression, "
                "dark complexion, muscular build, wild hair, "
                "ancient Chinese warrior, aggressive battle stance"
            ),
        },
        {
            "name": "zhao_yun_portrait",
            "seed": 1003,
            "description": (
                "Zhao Yun, Chinese Three Kingdoms general, gleaming white armor, "
                "handsome young face, calm heroic expression, "
                "white hair accessories and decorations, elegant warrior, "
                "ancient Chinese general, cool and composed"
            ),
        },
        {
            "name": "zhuge_liang_portrait",
            "seed": 1004,
            "description": (
                "Zhuge Liang, Chinese Three Kingdoms strategist, "
                "white flowing scholar robe, holding feather fan, "
                "wise gentle intelligent expression, black hair with white headband, "
                "ancient Chinese advisor, calm and brilliant"
            ),
        },
        {
            "name": "cao_cao_portrait",
            "seed": 1005,
            "description": (
                "Cao Cao, Chinese Three Kingdoms warlord, black ornate armor, "
                "black robe with gold details, cunning ambitious expression, "
                "middle-aged man, commanding authoritative presence, "
                "ancient Chinese ruler, sharp calculating eyes"
            ),
        },
        {
            "name": "lu_bu_portrait",
            "seed": 1006,
            "description": (
                "Lu Bu, Chinese Three Kingdoms mightiest warrior, "
                "elaborate red armor with feathers on helmet, "
                "arrogant fierce dominating expression, tall imposing figure, "
                "ancient Chinese warrior god, red feathered helmet pheasant feathers"
            ),
        },
    ]

    results = []
    for c in characters:
        try:
            r = generate_portrait(
                name=c["name"],
                description=c["description"],
                output_dir=output_dir,
                seed=c["seed"],
                size=512,
            )
            results.append(r)
        except Exception as e:
            print(f"[ERROR] Failed to generate {c['name']}: {e}", file=sys.stderr)
            # Retry with different seed
            try:
                print(f"[Retry] Retrying {c['name']} with seed {c['seed'] + 999}...")
                r = generate_portrait(
                    name=c["name"],
                    description=c["description"],
                    output_dir=output_dir,
                    seed=c["seed"] + 999,
                    size=512,
                )
                results.append(r)
            except Exception as e2:
                print(f"[ERROR] Retry failed for {c['name']}: {e2}", file=sys.stderr)

    meta_path = Path(output_dir) / "metadata.json"
    with open(meta_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n[Done] {len(results)} portraits generated.")


if __name__ == "__main__":
    main()
