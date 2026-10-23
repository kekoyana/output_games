// LocalStorage 抽象。namespace は setStorageNamespace で差し替え可能。
// ゲーム実装側で main.ts の冒頭で `setStorageNamespace("my-game")` を呼ぶ。

let namespace = "phaser-template";

export function setStorageNamespace(ns: string): void {
  namespace = ns;
}

function fullKey(suffix: string): string {
  return `${namespace}-${suffix}`;
}

export function getString(suffix: string): string | null {
  try {
    return localStorage.getItem(fullKey(suffix));
  } catch {
    return null;
  }
}

export function setString(suffix: string, value: string): void {
  try {
    localStorage.setItem(fullKey(suffix), value);
  } catch {
    /* ignore */
  }
}

export function removeKey(suffix: string): void {
  try {
    localStorage.removeItem(fullKey(suffix));
  } catch {
    /* ignore */
  }
}

export function getNumber(
  suffix: string,
  fallback: number,
  min = -Infinity,
  max = Infinity,
): number {
  const raw = getString(suffix);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function setNumber(suffix: string, value: number): void {
  setString(suffix, String(value));
}

export function getBool(suffix: string, fallback: boolean): boolean {
  const raw = getString(suffix);
  if (raw === null) return fallback;
  return raw === "1";
}

export function setBool(suffix: string, value: boolean): void {
  setString(suffix, value ? "1" : "0");
}

export function getJson<T>(suffix: string): T | null {
  const raw = getString(suffix);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJson<T>(suffix: string, value: T): void {
  setString(suffix, JSON.stringify(value));
}

/**
 * 名前空間配下の全キーを削除（"Reset" ボタン用）。
 * 他名前空間（他ゲーム）のデータには触らない。
 */
export function clearAll(): void {
  try {
    const prefix = `${namespace}-`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
