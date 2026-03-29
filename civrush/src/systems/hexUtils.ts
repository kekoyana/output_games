import type { HexCoord } from '../models/types';

// Hexのキー
export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function keyToHex(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

// 隣接方向（offset座標 - flat top hexagons）
// axial coordinates
const DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function getNeighbors(coord: HexCoord): HexCoord[] {
  return DIRECTIONS.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

// Axial距離
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs((a.q + a.r) - (b.q + b.r))
  );
}

// Axial座標をピクセル座標に変換 (pointy-top)
export function hexToPixel(coord: HexCoord, hexSize: number): { x: number; y: number } {
  const x = hexSize * (Math.sqrt(3) * coord.q + Math.sqrt(3) / 2 * coord.r);
  const y = hexSize * (3 / 2 * coord.r);
  return { x, y };
}

// ピクセル座標をAxial座標に変換 (pointy-top)
export function pixelToHex(
  px: number,
  py: number,
  hexSize: number
): HexCoord {
  const q = (Math.sqrt(3) / 3 * px - 1 / 3 * py) / hexSize;
  const r = (2 / 3 * py) / hexSize;
  return hexRound({ q, r });
}

function hexRound(coord: { q: number; r: number }): HexCoord {
  let q = Math.round(coord.q);
  let r = Math.round(coord.r);
  const s = Math.round(-coord.q - coord.r);
  const qDiff = Math.abs(q - coord.q);
  const rDiff = Math.abs(r - coord.r);
  const sDiff = Math.abs(s - (-coord.q - coord.r));
  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }
  return { q, r };
}

// 指定半径内のすべてのhex
export function hexesInRange(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

// グリッド内かどうか
export function isInGrid(coord: HexCoord, gridSize: number): boolean {
  // offset gridのサイズに合わせた判定
  const col = coord.q + Math.floor((coord.r - (coord.r & 1)) / 2);
  const row = coord.r;
  return col >= 0 && col < gridSize && row >= 0 && row < gridSize;
}

// Axial座標をオフセット座標に変換
export function axialToOffset(coord: HexCoord): { col: number; row: number } {
  const col = coord.q + Math.floor((coord.r - (coord.r & 1)) / 2);
  const row = coord.r;
  return { col, row };
}

// オフセット座標をAxial座標に変換
export function offsetToAxial(col: number, row: number): HexCoord {
  const q = col - Math.floor((row - (row & 1)) / 2);
  const r = row;
  return { q, r };
}

export function coordEquals(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}
