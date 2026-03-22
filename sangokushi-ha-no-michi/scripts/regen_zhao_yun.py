"""趙雲ポートレートを色鮮やかに再生成する"""
from __future__ import annotations

import sys
from pathlib import Path

# 汎用モジュールへのパスを追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "ai-sprites-local"))

from PIL import Image

from comfyui_client import ComfyUIClient

CHECKPOINT = "Counterfeit-V3.0_fix_fp16.safetensors"


def build_workflow(prompt: str, negative: str, seed: int) -> dict:
    return {
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
            "inputs": {"text": negative, "clip": ["4", 1]},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1},
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 30,
                "cfg": 8.0,
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


prompt = (
    "masterpiece, best quality, highres, anime style, "
    "Zhao Yun, Chinese Three Kingdoms general, "
    "gleaming bright white and silver armor with blue accents, "
    "handsome young heroic face, calm confident expression, "
    "white hair decorations, elegant spear warrior, "
    "light blue solid color background, "
    "face close-up portrait, upper chest visible, "
    "sharp clean lines, vivid colors, "
    "game dialogue portrait, detailed expressive face, colorful"
)
negative = (
    "text, watermark, realistic photo, blurry, deformed face, "
    "extra fingers, bad anatomy, full body, landscape, "
    "multiple characters, western cartoon, lowres, worst quality, bad quality, "
    "monochrome, grayscale, sketch, pencil"
)

client = ComfyUIClient()
out_dir = Path("../workspace/src/assets/portraits")
raw_dir = out_dir / "raw"
raw_dir.mkdir(parents=True, exist_ok=True)

for seed in [3001, 3002, 3003]:
    print(f"Trying seed {seed}...")
    workflow = build_workflow(prompt, negative, seed)
    raw_path = raw_dir / f"zhao_yun_portrait_seed{seed}.png"
    paths = client.generate(workflow, output_path=raw_path)
    print(f"  Raw: {paths[0]}")

    img = Image.open(str(paths[0])).convert("RGBA")
    out_path = out_dir / f"zhao_yun_portrait_seed{seed}.png"
    img.resize((512, 512), Image.LANCZOS).save(str(out_path))
    print(f"  Saved: {out_path}")

print("Done - check the seed variants and rename the best one to zhao_yun_portrait.png")
