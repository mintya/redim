export interface TreeNode {
  name: string;
  fullPath: string;
  children: Map<string, TreeNode>;
  isLeaf: boolean;
  isExpanded: boolean;
}

export type SortOrder = 'asc' | 'desc' | 'none';

export function buildTree(keys: string[], separator: string = ':'): TreeNode {
  const root: TreeNode = {
    name: '',
    fullPath: '',
    children: new Map(),
    isLeaf: false,
    isExpanded: true
  };

  for (const key of keys) {
    const parts = key.split(separator);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const fullPath = parts.slice(0, i + 1).join(separator);
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath,
          children: new Map(),
          isLeaf: isLast,
          isExpanded: false
        });
      } else if (isLast) {
        // 如果这个路径已经作为中间节点存在，标记为叶子
        const existing = current.children.get(part)!;
        existing.isLeaf = true;
      }

      current = current.children.get(part)!;
    }
  }

  return root;
}

export function sortChildren(node: TreeNode, order: SortOrder): void {
  if (order === 'none') return;

  const sortedEntries = Array.from(node.children.entries()).sort((a, b) => {
    const comparison = a[0].localeCompare(b[0]);
    return order === 'asc' ? comparison : -comparison;
  });

  node.children = new Map(sortedEntries);

  // 递归排序子节点
  for (const child of node.children.values()) {
    sortChildren(child, order);
  }
}

export function flattenTree(
  node: TreeNode, 
  level: number = 0, 
  expandedNodes: Set<string>
): { node: TreeNode; level: number }[] {
  const result: { node: TreeNode; level: number }[] = [];

  for (const child of node.children.values()) {
    result.push({ node: child, level });
    
    // 如果有子节点且已展开，递归展开
    if (child.children.size > 0 && expandedNodes.has(child.fullPath)) {
      result.push(...flattenTree(child, level + 1, expandedNodes));
    }
  }

  return result;
}

export function getAllKeys(node: TreeNode): string[] {
  const keys: string[] = [];
  
  function traverse(n: TreeNode) {
    if (n.isLeaf) {
      keys.push(n.fullPath);
    }
    for (const child of n.children.values()) {
      traverse(child);
    }
  }
  
  traverse(node);
  return keys;
}
