const cache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();

/** Load a single image with caching */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = cache.get(src);
  if (cached) return Promise.resolve(cached);

  const inflight = loading.get(src);
  if (inflight) return inflight;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cache.set(src, img);
      loading.delete(src);
      resolve(img);
    };
    img.onerror = () => {
      loading.delete(src);
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });

  loading.set(src, promise);
  return promise;
}

/** Load multiple images, returns progress callback */
export function loadImages(
  srcs: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<HTMLImageElement[]> {
  const total = srcs.length;
  let loaded = 0;
  return Promise.all(
    srcs.map((src) =>
      loadImage(src).then((img) => {
        loaded++;
        onProgress?.(loaded, total);
        return img;
      })
    )
  );
}

/** Get a cached image (returns undefined if not loaded) */
export function getCachedImage(src: string): HTMLImageElement | undefined {
  return cache.get(src);
}

/** Check if image is cached */
export function isImageCached(src: string): boolean {
  return cache.has(src);
}
