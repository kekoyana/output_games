export const VALUES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

export function getRadius(value: number): number {
  const idx = VALUES.indexOf(value);
  if (idx === -1) return 20;
  return 14 + idx * 6;
}

export function getBallColor(value: number): string {
  switch (value) {
    case 1: return "#ffffff";
    case 2: return "#44ff44";
    case 4: return "#4488ff";
    case 8: return "#00ffff";
    case 16: return "#aa44ff";
    case 32: return "#ff44ff";
    case 64: return "#ff8800";
    case 128: return "#ff3333";
    case 256: return "#ffd700";
    case 512: return "#ff69b4";
    case 1024: return "#ffffff";
    case 2048: return "#ff4500";
    default: return "#ffffff";
  }
}

export function getBallGlow(value: number): string {
  switch (value) {
    case 1: return "rgba(255,255,255,0.8)";
    case 2: return "rgba(68,255,68,0.8)";
    case 4: return "rgba(68,136,255,0.8)";
    case 8: return "rgba(0,255,255,0.8)";
    case 16: return "rgba(170,68,255,0.8)";
    case 32: return "rgba(255,68,255,0.8)";
    case 64: return "rgba(255,136,0,0.8)";
    case 128: return "rgba(255,51,51,0.8)";
    case 256: return "rgba(255,215,0,0.8)";
    case 512: return "rgba(255,105,180,0.8)";
    case 1024: return "rgba(255,255,255,1.0)";
    case 2048: return "rgba(255,69,0,1.0)";
    default: return "rgba(255,255,255,0.5)";
  }
}

export function getNextValue(currentScore: number): number {
  // As score increases, higher values start appearing
  const maxIdx = Math.min(4, Math.floor(currentScore / 500));
  const idx = Math.floor(Math.random() * (maxIdx + 1));
  return VALUES[idx];
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

let nextId = 0;
export function generateId(): number {
  return nextId++;
}
