export interface TreeNode {
  name: string;
  fullPath: string;
  children: Map<string, TreeNode>;
  isLeaf: boolean;
  isExpanded: boolean;
}

export type SortOrder = 'asc' | 'desc' | 'none';

export function buildTree(keys: string[], separator: string = ':'): TreeNode {
  // Build raw data structure first (plain objects, no Map mutation during iteration)
  const rawTree: Record<string, any> = {
    name: '',
    fullPath: '',
    children: {},
    isLeaf: false,
    isExpanded: true
  };

  for (const key of keys) {
    const parts = key.split(separator);
    let current = rawTree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const fullPath = parts.slice(0, i + 1).join(separator);
      const isLast = i === parts.length - 1;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          fullPath,
          children: {},
          isLeaf: isLast,
          isExpanded: false
        };
      } else if (isLast) {
        current.children[part].isLeaf = true;
      }

      current = current.children[part];
    }
  }

  // Convert plain objects to TreeNode with Map children
  function toTreeNode(raw: Record<string, any>): TreeNode {
    const children = new Map<string, TreeNode>();
    for (const [name, child] of Object.entries(raw.children)) {
      children.set(name, toTreeNode(child as Record<string, any>));
    }
    return {
      name: raw.name,
      fullPath: raw.fullPath,
      children,
      isLeaf: raw.isLeaf,
      isExpanded: raw.isExpanded
    };
  }

  return toTreeNode(rawTree);
}

export function sortChildren(node: TreeNode, order: SortOrder): void {
  if (order === 'none') return;

  const sortedEntries = Array.from(node.children.entries()).sort((a, b) => {
    const comparison = a[0].localeCompare(b[0]);
    return order === 'asc' ? comparison : -comparison;
  });

  node.children = new Map(sortedEntries);

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
