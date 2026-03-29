<script lang="ts">
  import { keys, activeKey, searchPattern, selectKey, loadKeys, deleteKey } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';
  import { buildTree, flattenTree, type TreeNode, type SortOrder } from '$lib/utils/tree';
  import Button from '$lib/components/common/Button.svelte';
  import ContextMenu from '$lib/components/common/ContextMenu.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';
  import CreateKeyModal from './CreateKeyModal.svelte';
  import TreeNodeComponent from './TreeNode.svelte';

  let pattern = $state('*');
  let contextMenu = $state<{ x: number; y: number; key: string } | null>(null);
  let showCreateModal = $state(false);
  let selectedKeys = $state<Set<string>>(new Set());
  let isSelectionMode = $state(false);
  let showConfirm = $state(false);
  let confirmMessage = $state('');
  let confirmAction = $state<(() => void) | null>(null);

  // 视图模式和排序
  let viewMode = $state<'list' | 'tree'>('list');
  let sortOrder = $state<SortOrder>('asc');
  let separator = $state(':');
  let expandedNodes = $state<string[]>([]);

  // 将数组转换为 Set 用于查找
  let expandedSet = $derived(new Set(expandedNodes));

  // 排序后的 keys（用于列表视图）
  let sortedKeys = $derived(() => {
    const arr = [...$keys];
    if (sortOrder === 'asc') {
      arr.sort((a, b) => a.localeCompare(b));
    } else if (sortOrder === 'desc') {
      arr.sort((a, b) => b.localeCompare(a));
    }
    return arr;
  });

  // 构建树（用于树状视图）
  let tree = $derived(() => {
    return buildTree(sortedKeys(), separator);
  });

  // 扁平化的树节点
  let flatTreeNodes = $derived(() => {
    return flattenTree(tree(), 0, expandedSet);
  });

  function toggleExpand(path: string) {
    if (expandedNodes.includes(path)) {
      expandedNodes = expandedNodes.filter(p => p !== path);
    } else {
      expandedNodes = [...expandedNodes, path];
    }
  }

  function expandAll() {
    const allPaths: string[] = [];
    function collectPaths(node: TreeNode) {
      if (node.children.size > 0) {
        allPaths.push(node.fullPath);
        for (const child of node.children.values()) {
          collectPaths(child);
        }
      }
    }
    for (const child of tree().children.values()) {
      collectPaths(child);
    }
    expandedNodes = allPaths;
  }

  function collapseAll() {
    expandedNodes = [];
  }

  function cycleSortOrder() {
    if (sortOrder === 'asc') sortOrder = 'desc';
    else sortOrder = 'asc';
  }

  async function handleSearch() {
    if ($activeConnectionId) {
      let searchQuery = pattern.trim();
      if (searchQuery && !searchQuery.includes('*')) {
        searchQuery = `*${searchQuery}*`;
      } else if (!searchQuery) {
        searchQuery = '*';
      }
      searchPattern.set(searchQuery);
      await loadKeys($activeConnectionId, searchQuery);
      selectedKeys.clear();
    }
  }

  async function handleSelectKey(key: string) {
    if (isSelectionMode) {
      toggleSelection(key);
    } else if ($activeConnectionId) {
      await selectKey($activeConnectionId, key);
    }
  }

  function toggleSelection(key: string) {
    if (selectedKeys.has(key)) {
      selectedKeys.delete(key);
    } else {
      selectedKeys.add(key);
    }
    selectedKeys = new Set(selectedKeys);
  }

  function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    if (!isSelectionMode) {
      selectedKeys.clear();
    }
  }

  function selectAll() {
    selectedKeys = new Set($keys);
  }

  function deselectAll() {
    selectedKeys = new Set();
  }

  function handleDeleteKey(key: string) {
    confirmMessage = `确定要删除 key: ${key} 吗？`;
    confirmAction = async () => {
      if ($activeConnectionId) {
        await deleteKey($activeConnectionId, key);
      }
      contextMenu = null;
    };
    showConfirm = true;
  }

  function handleBatchDelete() {
    if ($activeConnectionId && selectedKeys.size > 0) {
      confirmMessage = `确定要删除 ${selectedKeys.size} 个 key 吗？`;
      confirmAction = async () => {
        for (const key of selectedKeys) {
          await invoke('delete_key', { id: $activeConnectionId, key });
        }
        await loadKeys($activeConnectionId);
        selectedKeys.clear();
        isSelectionMode = false;
      };
      showConfirm = true;
    }
  }

  function handleConfirm() {
    if (confirmAction) {
      confirmAction();
      confirmAction = null;
    }
  }

  function handleCancel() {
    confirmAction = null;
  }

  function handleContextMenu(e: MouseEvent, key: string) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, key };
  }

  function closeContextMenu() {
    contextMenu = null;
  }
</script>

<!-- Search -->
<div class="p-3 border-b border-[#d4d4d4]">
  <div class="flex gap-2">
    <input 
      type="text" 
      bind:value={pattern}
      placeholder="fuzzy search..."
      class="flex-1 px-2 py-1 bg-[#fafafa] border border-[#d4d4d4] rounded text-xs font-mono focus:outline-none focus:border-[#dc382d]"
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <Button variant="secondary" size="sm" onclick={handleSearch}>search</Button>
  </div>
</div>

<!-- Toolbar -->
<div class="px-3 py-2 border-b border-[#d4d4d4] flex items-center justify-between bg-[#f5f5f5]">
  <!-- View & Sort Icons -->
  <div class="flex items-center gap-1">
    <!-- List/Tree Toggle -->
    <button 
      class="w-7 h-7 flex items-center justify-center rounded text-xs transition-colors {viewMode === 'list' ? 'text-[#dc382d]' : 'text-[#9a9a9a] hover:text-[#6b6b6b]'}"
      onclick={() => viewMode = 'list'}
      title="List view"
    >
      ☰
    </button>
    <button 
      class="w-7 h-7 flex items-center justify-center rounded text-xs transition-colors {viewMode === 'tree' ? 'text-[#dc382d]' : 'text-[#9a9a9a] hover:text-[#6b6b6b]'}"
      onclick={() => viewMode = 'tree'}
      title="Tree view"
    >
      ⊞
    </button>

    {#if viewMode === 'tree'}
      <span class="text-[#d4d4d4] mx-1">|</span>
      <button 
        class="w-7 h-7 flex items-center justify-center rounded text-xs text-[#9a9a9a] hover:text-[#6b6b6b] transition-colors"
        onclick={expandAll}
        title="Expand all"
      >
        ▾
      </button>
      <button 
        class="w-7 h-7 flex items-center justify-center rounded text-xs text-[#9a9a9a] hover:text-[#6b6b6b] transition-colors"
        onclick={collapseAll}
        title="Collapse all"
      >
        ▸
      </button>
    {/if}

    <span class="text-[#d4d4d4] mx-1">|</span>
    <button 
      class="w-7 h-7 flex items-center justify-center rounded text-xs text-[#9a9a9a] hover:text-[#6b6b6b] transition-colors"
      onclick={cycleSortOrder}
      title={sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
    >
      {sortOrder === 'asc' ? '↑' : '↓'}
    </button>
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-1">
    <button 
      class="w-7 h-7 flex items-center justify-center rounded text-xs text-[#dc382d] hover:text-[#e85d54] transition-colors"
      onclick={() => showCreateModal = true}
      title="New key"
    >
      +
    </button>
    <button 
      class="w-7 h-7 flex items-center justify-center rounded text-xs transition-colors {isSelectionMode ? 'text-[#dc382d]' : 'text-[#9a9a9a] hover:text-[#6b6b6b]'}"
      onclick={toggleSelectionMode}
      title={isSelectionMode ? 'Cancel' : 'Multi select'}
    >
      ☑
    </button>
  </div>
</div>

<!-- Selection Bar -->
{#if isSelectionMode}
  <div class="px-3 py-1.5 border-b border-[#d4d4d4] bg-[#fdf0ef] flex items-center gap-2 text-xs">
    <span class="text-[#1a1a1a]">{selectedKeys.size} selected</span>
    <span class="text-[#d4d4d4]">|</span>
    <button class="text-[#dc382d] hover:underline" onclick={selectAll}>all</button>
    <button class="text-[#6b6b6b] hover:underline" onclick={deselectAll}>none</button>
    {#if selectedKeys.size > 0}
      <button class="text-[#dc382d] hover:underline ml-auto" onclick={handleBatchDelete}>
        delete ({selectedKeys.size})
      </button>
    {/if}
  </div>
{/if}

<!-- Keys List/Tree -->
<div class="flex-1 overflow-y-auto">
  {#if $keys.length === 0}
    <div class="px-4 py-8 text-center">
      <div class="text-xs text-[#9a9a9a]">no keys</div>
    </div>
  {:else if viewMode === 'list'}
    <!-- List View -->
    {#each sortedKeys() as key}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div 
        class="px-4 py-2 cursor-pointer transition-colors border-b border-[#e5e5e5] flex items-center gap-2 {$activeKey === key ? 'bg-[#fdf0ef]' : 'hover:bg-[#f0f0f0]'}"
        onclick={() => handleSelectKey(key)}
        onkeydown={(e) => e.key === 'Enter' && handleSelectKey(key)}
        oncontextmenu={(e) => handleContextMenu(e, key)}
        role="button"
        tabindex="0"
      >
        {#if isSelectionMode}
          <input 
            type="checkbox" 
            checked={selectedKeys.has(key)}
            class="accent-[#dc382d] cursor-pointer"
            onclick={(e) => { e.stopPropagation(); toggleSelection(key); }}
          />
        {/if}
        <span class="text-xs text-[#1a1a1a] font-mono truncate">{key}</span>
      </div>
    {/each}
  {:else}
    <!-- Tree View -->
    {#each flatTreeNodes() as { node, level }}
      <TreeNodeComponent
        {node}
        {level}
        isExpanded={expandedSet.has(node.fullPath)}
        isSelected={node.isLeaf && $activeKey === node.fullPath}
        ontoggle={toggleExpand}
        onselect={handleSelectKey}
        oncontextmenu={handleContextMenu}
      />
    {/each}
  {/if}
</div>

{#if contextMenu}
  <ContextMenu 
    x={contextMenu.x} 
    y={contextMenu.y} 
    items={[
      { label: 'delete', action: () => handleDeleteKey(contextMenu!.key), danger: true },
    ]}
    onclose={closeContextMenu}
  />
{/if}

<CreateKeyModal bind:open={showCreateModal} onclose={() => showCreateModal = false} />

<Confirm 
  bind:open={showConfirm}
  title="delete key"
  message={confirmMessage}
  confirmText="delete"
  danger={true}
  onconfirm={handleConfirm}
  oncancel={handleCancel}
/>
