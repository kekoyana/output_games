"""
三国志ダイス英傑伝 - 背景画像生成スクリプト（Counterfeit-V3.0使用）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# 汎用モジュールへのパスを追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "ai-sprites-local"))

from comfyui_client import ComfyUIClient
from postprocess import resize_background

CHECKPOINT = "Counterfeit-V3.0_fix_fp16.safetensors"


def build_background_workflow_anime(
    prompt: str,
    negative: str = "",
    seed: int = 42,
    steps: int = 30,
    cfg: float = 7.5,
    width: int = 768,
    height: int = 512,
) -> dict:
    default_negative = (
        "text, watermark, UI elements, characters, people, persons, "
        "blurry, low quality, jpeg artifacts, lowres, worst quality"
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
            "inputs": {"width": width, "height": height, "batch_size": 1},
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


def generate_background(
    name: str,
    description: str,
    output_dir: str,
    seed: int = 42,
    width: int = 960,
    height: int = 540,
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
        f"masterpiece, best quality, highres, "
        f"{description}, "
        f"wide landscape composition, no characters, no UI elements, no text, "
        f"clean and uncluttered, suitable as a game background layer"
    )

    print(f"[Background] Generating: {name} (checkpoint={CHECKPOINT})...")
    workflow = build_background_workflow_anime(
        prompt=prompt, seed=seed, width=768, height=512,
    )

    raw_path = raw_dir / f"{name}.png"
    paths = client.generate(workflow, output_path=raw_path)
    print(f"[Background] Raw saved: {paths[0]}")

    bg_path = out_dir / f"{name}.png"
    resize_background(str(paths[0]), str(bg_path), width=width, height=height)
    print(f"[Background] Done: {bg_path} ({width}x{height})")

    return {
        "name": name,
        "raw": str(paths[0]),
        "background": str(bg_path),
    }


def main() -> None:
    output_dir = "../workspace/src/assets/backgrounds"
    backgrounds = [
        {
            "name": "battle_background",
            "seed": 2001,
            "description": (
                "ancient Chinese battlefield landscape, ink wash painting style, "
                "dramatic mountains and vast plains, war banners and flags in the distance, "
                "misty atmospheric fog, dark moody sky with dramatic clouds, "
                "Three Kingdoms era military camp in background, "
                "epic scene, traditional Chinese painting aesthetic"
            ),
        },
    ]

    results = []
    for bg in backgrounds:
        try:
            r = generate_background(
                name=bg["name"],
                description=bg["description"],
                output_dir=output_dir,
                seed=bg["seed"],
                width=960,
                height=540,
            )
            results.append(r)
        except Exception as e:
            print(f"[ERROR] Failed to generate {bg['name']}: {e}", file=sys.stderr)
            try:
                print(f"[Retry] Retrying {bg['name']} with seed {bg['seed'] + 999}...")
                r = generate_background(
                    name=bg["name"],
                    description=bg["description"],
                    output_dir=output_dir,
                    seed=bg["seed"] + 999,
                    width=960,
                    height=540,
                )
                results.append(r)
            except Exception as e2:
                print(f"[ERROR] Retry failed for {bg['name']}: {e2}", file=sys.stderr)

    meta_path = Path(output_dir) / "metadata.json"
    with open(meta_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n[Done] {len(results)} backgrounds generated.")


if __name__ == "__main__":
    main()
