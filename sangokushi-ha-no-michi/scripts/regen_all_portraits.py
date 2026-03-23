"""全キャラポートレート一括再生成 - Flux セミリアル調（三國無双/FF風）"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "ai-sprites-local"))

from PIL import Image
from comfyui_client import ComfyUIClient
from workflows import AUTO_MODEL, build_portrait_workflow_flux

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "portraits"
SIZE = 512

STYLE_PREFIX = (
    "semi-realistic CG portrait art, Dynasty Warriors Musou style, "
    "Final Fantasy character design, highly detailed face, "
    "dramatic cinematic lighting, rich vibrant colors, "
    "close-up head and shoulders portrait, "
    "face centered and large in frame, "
)

STYLE_SUFFIX = ", 8k render, detailed skin texture, sharp focus, ornate costume details"

CHARACTERS = [
    {
        "name": "liu_bei_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Liu Bei, benevolent lord of Shu, "
            "golden imperial dragon-embroidered robes, ornate imperial crown with gold and jade, "
            "warm dignified compassionate expression, gentle wise eyes, neat black beard, "
            "1male, noble ruler, "
            "golden-amber gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15001,
    },
    {
        "name": "guan_yu_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Guan Yu, God of War, legendary general, "
            "green ornate armor pauldrons with gold dragon engravings, "
            "long flowing black beard reaching chest, red-tinted face, "
            "dignified noble stern expression, piercing eyes, "
            "ornate green and gold crown headpiece, "
            "1male, warrior general, "
            "dark crimson-red gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15002,
    },
    {
        "name": "zhang_fei_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Zhang Fei, fierce warrior of Shu, "
            "black heavy ornate armor pauldrons with gold studs, "
            "big round wide-open bulging eyes, wild thick bushy black beard and mustache, "
            "fierce intimidating roaring expression showing teeth, dark tanned weathered skin, "
            "muscular thick neck, wild spiky black hair, "
            "1male, berserker warrior general, "
            "dark blue-black gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15003,
    },
    {
        "name": "zhao_yun_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Zhao Yun, the Silver Dragon, young heroic general, "
            "silver-white ornate armor with blue gem accents, elegant shoulder guards, "
            "young handsome face, heroic calm confident expression, clean-shaven, "
            "flowing black hair with silver headband, "
            "1male, noble knight general, "
            "blue-silver gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15004,
    },
    {
        "name": "zhuge_liang_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Zhuge Liang, the Sleeping Dragon, greatest strategist, "
            "wearing white crane feather cloak Hechang robe with flowing fabric, "
            "Guanjin turban cap on head, traditional scholar headwear, "
            "holding elegant white feather fan near face, "
            "wise serene calm knowing expression, sharp intelligent eyes, "
            "long straight black hair, handsome refined scholarly face, "
            "1male, scholar strategist, "
            "purple-indigo gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15005,
    },
    {
        "name": "pang_tong_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Pang Tong, the Fledgling Phoenix, underestimated genius strategist, "
            "plain wrinkled dark grey-brown scholar robes, no ornate accessories, "
            "unkempt messy black hair partially covering face, straw hat tilted on head, "
            "tired sleepy half-lidded bored eyes, unmotivated lazy expression, stubble on chin, "
            "slouched shoulders, plain unremarkable appearance hiding genius, "
            "1male, disheveled scholar, "
            "dark brown-ochre muted gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15006,
    },
    {
        "name": "zhang_jiao_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Zhang Jiao, leader of Yellow Turban Rebellion, Taoist sorcerer, "
            "yellow ceremonial Taoist robes with mystic symbols, "
            "wild white-grey hair flowing, yellow turban headband, "
            "fanatic zealous mystical expression, glowing intense eyes, aged face, "
            "1male, cult leader sorcerer, "
            "dark yellow-green mystic gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15007,
    },
    {
        "name": "dong_zhuo_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Dong Zhuo, tyrannical warlord, "
            "ornate dark red and gold heavy armor, fur-lined collar, "
            "fat round face with double chin, small cruel cunning eyes, "
            "arrogant contemptuous sneer expression, thick black beard, "
            "1male, tyrant warlord, "
            "dark blood-red gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15008,
    },
    {
        "name": "lu_bu_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Lu Bu, the Flying General, mightiest warrior in all of China, "
            "elaborate red and gold ornate armor, phoenix feathered crown helmet, "
            "overwhelmingly fierce powerful expression, sharp piercing eyes, "
            "handsome but terrifying face, flowing dark hair, "
            "1male, supreme warrior, "
            "crimson-dark gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15009,
    },
    {
        "name": "yuan_shu_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Yuan Shu, self-proclaimed false emperor, "
            "elaborate golden imperial robes with jade ornaments, ornate jade crown, "
            "fat round chubby face, arrogant proud smug expression, "
            "small entitled eyes looking down, thin mustache, "
            "1male, pompous false emperor, "
            "purple and gold gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15010,
    },
    {
        "name": "cao_cao_portrait",
        "prompt": (
            STYLE_PREFIX +
            "Cao Cao, the Hero of Chaos, ambitious supreme ruler, "
            "black and gold ornate armor with elaborate dark helmet crown, "
            "sharp cunning intelligent eyes, ambitious confident smirk, "
            "neat short black beard, commanding powerful presence, "
            "1male, supreme warlord strategist, "
            "dark charcoal-gold gradient background"
            + STYLE_SUFFIX
        ),
        "seed": 15011,
    },
]


def generate_portrait(client, char, model):
    raw_dir = OUTPUT_DIR / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    name = char["name"]
    prompt = char["prompt"]
    seed = char["seed"]

    print(f"\n[Portrait] Generating: {name} (model={model}, seed={seed})")

    if model in ("flux", "flux-lite"):
        preset = "lite" if model == "flux-lite" else "full"
        workflow = build_portrait_workflow_flux(prompt=prompt, seed=seed, preset=preset)
    else:
        # Flux以外のモデルの場合もFluxのワークフローを使用（スタイル統一のため）
        from workflows import build_sdxl_workflow
        workflow = build_sdxl_workflow(
            prompt=prompt, negative="low quality, blurry, text, watermark, deformed",
            seed=seed, steps=30, cfg=7.5, width=1024, height=1024,
        )

    raw_path = raw_dir / f"{name}.png"
    paths = client.generate(workflow, output_path=raw_path, timeout=600)
    print(f"[Portrait] Raw saved: {paths[0]}")

    # Resize to 512x512
    portrait_png = OUTPUT_DIR / f"{name}.png"
    img = Image.open(str(paths[0])).convert("RGBA")
    img_resized = img.resize((SIZE, SIZE), Image.LANCZOS)
    img_resized.save(str(portrait_png))

    # Convert to WebP
    webp_path = OUTPUT_DIR / f"{name}.webp"
    img_resized.save(str(webp_path), "WEBP", quality=90)
    print(f"[Portrait] Done: {webp_path} ({SIZE}x{SIZE})")
    return webp_path


def main():
    model = AUTO_MODEL
    print(f"[System] Auto-detected model: {model}")
    print(f"[System] Generating {len(CHARACTERS)} portraits...")

    client = ComfyUIClient()
    if not client.is_running():
        print("ERROR: ComfyUI not running", file=sys.stderr)
        sys.exit(1)

    success = 0
    failed = []
    for i, char in enumerate(CHARACTERS, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(CHARACTERS)}] {char['name']}")
        print(f"{'='*60}")
        try:
            generate_portrait(client, char, model)
            success += 1
        except Exception as e:
            print(f"[ERROR] {char['name']}: {e}", file=sys.stderr)
            failed.append(char["name"])

    print(f"\n{'='*60}")
    print(f"[Summary] {success}/{len(CHARACTERS)} succeeded")
    if failed:
        print(f"[Failed] {', '.join(failed)}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
