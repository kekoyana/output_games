import type { GameMap, MapNode, NodeType } from './types';
import { randomInt, shuffle } from './utils';

const COLS = 7;
const ROWS = 6;

export function pickNodeType(row: number, totalRows: number): NodeType {
  if (row === totalRows - 1) return 'boss';
  if (row === 0) return 'start';

  const roll = randomInt(1, 100);
  if (row === Math.floor(totalRows / 2)) {
    // 中間は少し休息・商人を多めに
    if (roll <= 30) return 'battle';
    if (roll <= 45) return 'elite';
    if (roll <= 60) return 'advisor';
    if (roll <= 75) return 'merchant';
    if (roll <= 90) return 'rest';
    return 'event';
  }

  if (roll <= 35) return 'battle';
  if (roll <= 50) return 'elite';
  if (roll <= 62) return 'advisor';
  if (roll <= 74) return 'merchant';
  if (roll <= 86) return 'rest';
  return 'event';
}

export function generateMap(): GameMap {
  const nodes: MapNode[] = [];
  let idCounter = 0;

  // グリッドでノードを生成
  const grid: (MapNode | null)[][] = [];

  for (let row = 0; row < ROWS; row++) {
    grid[row] = [];
    const colCount = row === 0 || row === ROWS - 1 ? 1 : randomInt(3, COLS - 1);
    const colsUsed = shuffle(
      Array.from({ length: COLS }, (_, i) => i)
    ).slice(0, colCount);
    colsUsed.sort((a, b) => a - b);

    for (let col = 0; col < COLS; col++) {
      if (colsUsed.includes(col)) {
        const xSpacing = 500 / COLS;
        const ySpacing = 700 / (ROWS - 1);
        const node: MapNode = {
          id: idCounter++,
          type: pickNodeType(row, ROWS),
          x: 80 + col * xSpacing + randomInt(-10, 10),
          y: 60 + row * ySpacing,
          connections: [],
          visited: false,
          available: row === 0,
        };
        grid[row][col] = node;
        nodes.push(node);
      } else {
        grid[row][col] = null;
      }
    }
  }

  // 接続を生成（各ノードは次の行のノードと接続）
  for (let row = 0; row < ROWS - 1; row++) {
    const currentRow = grid[row].filter((n): n is MapNode => n !== null);
    const nextRow = grid[row + 1].filter((n): n is MapNode => n !== null);

    if (nextRow.length === 0) continue;

    // 各現在行のノードは少なくとも1つの次行ノードと接続
    for (const curr of currentRow) {
      // 最も近い次行ノードに接続
      const sorted = [...nextRow].sort((a, b) => Math.abs(a.x - curr.x) - Math.abs(b.x - curr.x));
      const connectCount = Math.min(randomInt(1, 2), sorted.length);
      for (let i = 0; i < connectCount; i++) {
        if (!curr.connections.includes(sorted[i].id)) {
          curr.connections.push(sorted[i].id);
        }
      }
    }

    // 孤立した次行ノードに接続を追加
    for (const next of nextRow) {
      const hasParent = currentRow.some((c) => c.connections.includes(next.id));
      if (!hasParent) {
        const closest = [...currentRow].sort(
          (a, b) => Math.abs(a.x - next.x) - Math.abs(b.x - next.x)
        )[0];
        if (closest && !closest.connections.includes(next.id)) {
          closest.connections.push(next.id);
        }
      }
    }
  }

  // 出発ノードを自動的に訪問済みにする
  const startNode = nodes.find((n) => n.type === 'start');
  if (startNode) {
    startNode.visited = true;
    startNode.available = false;
    for (const connId of startNode.connections) {
      const conn = nodes.find((n) => n.id === connId);
      if (conn) conn.available = true;
    }
  }

  return {
    nodes,
    currentNodeId: startNode?.id ?? null,
    chapter: 1,
  };
}

export function getAvailableNodes(map: GameMap): MapNode[] {
  return map.nodes.filter((n) => n.available && !n.visited);
}

export function advanceMap(map: GameMap, visitedNodeId: number): void {
  const node = map.nodes.find((n) => n.id === visitedNodeId);
  if (!node) return;

  node.visited = true;
  map.currentNodeId = visitedNodeId;

  // まず全ノードの available をリセット（訪問済み以外）
  for (const n of map.nodes) {
    if (!n.visited) {
      n.available = false;
    }
  }

  // 現在ノードの接続先のみを利用可能にする
  for (const connId of node.connections) {
    const conn = map.nodes.find((n) => n.id === connId);
    if (conn && !conn.visited) conn.available = true;
  }

  // 現在ノード自身をnot availableにする
  node.available = false;
}
