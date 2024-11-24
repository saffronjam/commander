import { Machine } from 'common/types';

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = new Array(size).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // Path compression
    }
    return this.parent[x];
  }

  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) {
      if (this.rank[rootX] > this.rank[rootY]) {
        this.parent[rootY] = rootX;
      } else if (this.rank[rootX] < this.rank[rootY]) {
        this.parent[rootX] = rootY;
      } else {
        this.parent[rootY] = rootX;
        this.rank[rootX]++;
      }
    }
  }
}

export function groupMachines(nodes: Machine[], distance: number): Machine[][] {
  const n = nodes.length;
  const uf = new UnionFind(n);

  // Helper to calculate Euclidean distance
  const euclideanDistance = (a: Machine, b: Machine): number =>
    Math.sqrt((a.location.x - b.location.x) ** 2 + (a.location.y - b.location.y) ** 2);

  // Compare every pair of nodes (brute force for simplicity)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (euclideanDistance(nodes[i], nodes[j]) < distance) {
        uf.union(i, j);
      }
    }
  }

  // Group nodes by their connected components
  const groups: Map<number, Machine[]> = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(nodes[i]);
  }

  return Array.from(groups.values());
}
