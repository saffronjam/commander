import { Machine, MachineCategory } from 'common/types';
import { MachineGroup } from 'src/types';

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
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

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

export const computeMachineGroups = (machines: Machine[], groupDistance: number) => {
  const groups = groupMachines(machines, groupDistance);
  console.log(`found ${groups.length} groups`);

  return groups.map((machines) => {
    const center = {
      x: machines.reduce((acc, m) => acc + m.x, 0) / machines.length,
      y: machines.reduce((acc, m) => acc + m.y, 0) / machines.length,
    };
    const powerConsumption = machines.reduce((acc, m) => {
      if (m.category === MachineCategory.generator) return acc;
      return acc + (m.input.find((i) => i.name === 'Power')?.current || 0);
    }, 0);
    const powerProduction = machines.reduce((acc, m) => {
      if (m.category !== MachineCategory.generator) return acc;
      return acc + (m.output.find((i) => i.name === 'Power')?.current || 0);
    }, 0);

    const itemProduction: { [key: string]: number } = {};
    const itemConsumption: { [key: string]: number } = {};

    machines.forEach((m) => {
      m.output.forEach((p) => {
        if (p.name === 'Power') return;

        if (itemProduction[p.name] === undefined) {
          itemProduction[p.name] = 0;
        }
        itemProduction[p.name] += p.current;
      });

      m.input.forEach((i) => {
        if (i.name === 'Power') return;

        if (itemConsumption[i.name] === undefined) {
          itemConsumption[i.name] = 0;
        }
        itemConsumption[i.name] += i.current;
      });
    });

    return {
      hash: machines.map((m) => JSON.stringify([m.x, m.y, m.z])).join(','),
      machines,
      center,
      powerConsumption,
      powerProduction,
      itemProduction,
      itemConsumption,
    } as MachineGroup;
  });
};

export const zoomToGroupDistance = (zoom: number) => {
  zoom = Math.floor(zoom);
  switch (zoom) {
    case 3:
      return 12000;
    case 4:
      return 8000;
    case 5:
      return 4000;
    case 6:
      return 100;
    case 7:
      return 0;
    case 8:
      return 0;
    default:
      return 0;
  }
};
