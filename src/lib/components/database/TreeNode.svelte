<script lang="ts">
  import type { TreeNode } from '$lib/utils/tree';
  import { getTypeColorBg, getTypeLabel } from '$lib/utils/redisType';

  interface Props {
    node: TreeNode;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    keyType?: string;
    ontoggle: (path: string) => void;
    onselect: (path: string) => void;
    oncontextmenu: (e: MouseEvent, path: string) => void;
  }

  let { node, level, isExpanded, isSelected, keyType, ontoggle, onselect, oncontextmenu }: Props = $props();

  let hasChildren = $derived(node.children.size > 0);
  // 节点既是父节点又是叶子节点（如 aa:bb 同时也是 aa:bb:cc 的父节点）
  let isBothParentAndLeaf = $derived(hasChildren && node.isLeaf);

  function handleToggle(e: MouseEvent) {
    e.stopPropagation();
    ontoggle(node.fullPath);
  }

  function handleClick() {
    if (isBothParentAndLeaf) {
      // 既是父节点又是叶子节点，点击名称选中
      onselect(node.fullPath);
    } else if (hasChildren) {
      // 只是父节点，点击展开/折叠
      ontoggle(node.fullPath);
    } else {
      // 只是叶子节点，点击选中
      onselect(node.fullPath);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    if (node.isLeaf) {
      oncontextmenu(e, node.fullPath);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors {isSelected ? 'bg-[var(--color-accent-subtle)]' : 'hover:bg-[var(--color-surface-code)]'}"
  style="padding-left: {level * 16 + 12}px"
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="0"
>
  {#if hasChildren}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <span 
      class="text-[var(--color-text-faint)] text-base w-4 flex-shrink-0 hover:text-[var(--color-accent)] cursor-pointer"
      onclick={handleToggle}
      role="button"
      tabindex="-1"
    >
      {isExpanded ? '▾' : '▸'}
    </span>
  {:else}
    <span class="w-4 flex-shrink-0"></span>
  {/if}
  
  {#if node.isLeaf && keyType}
    <span class="w-4 h-4 flex items-center justify-center rounded text-[9px] text-white font-medium flex-shrink-0 {getTypeColorBg(keyType)}">{getTypeLabel(keyType)}</span>
  {:else if hasChildren}
    <span class="w-4 flex-shrink-0"></span>
  {/if}
  
  <span class="text-base font-mono truncate {hasChildren && !isBothParentAndLeaf ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-info-text)]'}">
    {node.name}
  </span>
  
  {#if hasChildren}
    <span class="text-[var(--color-text-faint)] text-base ml-1">({node.children.size})</span>
  {/if}
  
  {#if isBothParentAndLeaf}
    <span class="text-[var(--color-text-faint)] text-base ml-1" title="Also a key">⬤</span>
  {/if}
</div>
