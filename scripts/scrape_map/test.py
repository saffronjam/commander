import numpy as np
from scipy.spatial import KDTree

class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]

    def union(self, x, y):
        root_x = self.find(x)
        root_y = self.find(y)
        if root_x != root_y:
            if self.rank[root_x] > self.rank[root_y]:
                self.parent[root_y] = root_x
            elif self.rank[root_x] < self.rank[root_y]:
                self.parent[root_x] = root_y
            else:
                self.parent[root_y] = root_x
                self.rank[root_x] += 1

def group_points(points, d):
    n = len(points)
    tree = KDTree(points)
    uf = UnionFind(n)

    for i, point in enumerate(points):
        neighbors = tree.query_ball_point(point, d)
        for neighbor in neighbors:
            uf.union(i, neighbor)

    # Group points by their connected components
    groups = {}
    for i in range(n):
        root = uf.find(i)
        if root not in groups:
            groups[root] = []
        groups[root].append(points[i])

    return list(groups.values())

# Example usage
points = np.array([(0, 0), (1, 1), (2, 2), (10, 10)])
d = 2
groups = group_points(points, d)
print(groups)