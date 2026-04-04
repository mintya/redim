<script lang="ts">
  import { keys, keyTypes, activeKey, searchPattern, selectKey, loadKeys, deleteKey } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';
  import { buildTree, flattenTree, type TreeNode, type SortOrder } from '$lib/utils/tree';
  import Button from '$lib/components/common/Button.svelte';
  import ContextMenu from '$lib/components/common/ContextMenu.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';
  import CreateKeyModal from './CreateKeyModal.svelte';
  import TreeNodeComponent from './TreeNode.svelte';
  import VirtualList from '$lib/components/common/VirtualList.svelte';
  import { getTypeColorBg, getTypeLabel } from '$lib/utils/redisType';

  let pattern = $state('*');
  let contextMenu = $state<{ x: number; y: number; key: string } | null>(null);
  let showCreateModal = $state(false);
  let selectedKeys = $state<Set<string>>(new Set());
  let isSelectionMode = $state(false);
  let showConfirm = $state(false);
  let confirmMessage = $state('');
  let confirmAction = $state<(() => void) | null>(null);
  let isBatchDeleting = $state(false);
  let batchDeleteProgress = $state({ current: 0, total: 0 });

  // 视图模式和排序
  let viewMode = $state<'list' | 'tree'>('list');
  let sortOrder = $state<SortOrder>('asc');
  let separator = $state(':');
  let expandedNodes = $state<string[]>([]);
  
  // 类型筛选
  let typeFilter = $state<string>('all');

  // 将数组转换为 Set 用于查找
  let expandedSet = $derived(new Set(expandedNodes));

  // 虚拟滚动引用
  let virtualListRef = $state<VirtualList | null>(null);

  // Type colors and labels imported from shared utility

  // 筛选后的 keys（用于列表视图）
  let filteredKeys = $derived.by(() => {
    let arr = [...$keys];
    if (typeFilter !== 'all') {
      arr = arr.filter(key => $keyTypes.get(key) === typeFilter);
    }
    if (sortOrder === 'asc') {
      arr.sort((a, b) => a.localeCompare(b));
    } else if (sortOrder === 'desc') {
      arr.sort((a, b) => b.localeCompare(a));
    }
    return arr;
  });

  // 构建树（用于树状视图）
  let tree = $derived.by(() => {
    return buildTree(filteredKeys, separator);
  });

  // 扁平化的树节点
  let flatTreeNodes = $derived.by(() => {
    return flattenTree(tree, 0, expandedSet);
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
    for (const child of tree.children.values()) {
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
    selectedKeys = new Set(filteredKeys);
  }

  function deselectAll() {
    selectedKeys = new Set();
  }

  function handleDeleteKey(key: string) {
    confirmMessage = `Are you sure you want to delete key: ${key}?`;
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
      confirmMessage = `Are you sure you want to delete ${selectedKeys.size} key(s)?`;
      confirmAction = async () => {
        isBatchDeleting = true;
        const keysToDelete = [...selectedKeys];
        batchDeleteProgress = { current: 0, total: keysToDelete.length };
        for (const key of keysToDelete) {
          await invoke('delete_key', { id: $activeConnectionId, key });
          batchDeleteProgress.current++;
        }
        await loadKeys($activeConnectionId);
        selectedKeys.clear();
        isSelectionMode = false;
        isBatchDeleting = false;
        batchDeleteProgress = { current: 0, total: 0 };
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
<div class="p-2 border-b border-[var(--color-macos-border)]">
  <div class="flex gap-2">
    <input 
      type="text" 
      bind:value={pattern}
      placeholder="fuzzy search..."
      class="flex-1 px-2 py-1 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <Button variant="secondary" size="sm" onclick={handleSearch}>search</Button>
  </div>
</div>

<!-- Type Filter -->
<div class="px-2 py-1.5 border-b border-[var(--color-macos-border)] flex items-center gap-1">
  <button 
    class="px-1.5 py-0.5 rounded-md text-base transition-colors {typeFilter === 'all' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-macos-text-secondary)] hover:bg-[var(--color-surface-hover)]'}"
    onclick={() => typeFilter = 'all'}
  >all</button>
  <button 
    class="px-1.5 py-0.5 rounded-md text-base transition-colors flex items-center gap-0.5 {typeFilter === 'string' ? 'bg-[var(--color-type-string)] text-white' : 'text-[var(--color-macos-text-secondary)] hover:bg-[var(--color-surface-hover)]'}"
    onclick={() => typeFilter = typeFilter === 'string' ? 'all' : 'string'}
  >
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-string)] {typeFilter === 'string' ? 'bg-white' : ''}"></span>
    str
  </button>
  <button 
    class="px-1.5 py-0.5 rounded-md text-base transition-colors flex items-center gap-0.5 {typeFilter === 'hash' ? 'bg-[var(--color-type-hash)] text-white' : 'text-[var(--color-macos-text-secondary)] hover:bg-[var(--color-surface-hover)]'}"
    onclick={() => typeFilter = typeFilter === 'hash' ? 'all' : 'hash'}
  >
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-hash)] {typeFilter === 'hash' ? 'bg-white' : ''}"></span>
    hash
  </button>
  <button 
    class="px-1.5 py-0.5 rounded-md text-base transition-colors flex items-center gap-0.5 {typeFilter === 'list' ? 'bg-[var(--color-type-list)] text-white' : 'text-[var(--color-macos-text-secondary)] hover:bg-[var(--color-surface-hover)]'}"
    onclick={() => typeFilter = typeFilter === 'list' ? 'all' : 'list'}
  >
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-list)] {typeFilter === 'list' ? 'bg-white' : ''}"></span>
    list
  </button>
  <button 
    class="px-1.5 py-0.5 rounded-md text-base transition-colors flex items-center gap-0.5 {typeFilter === 'set' ? 'bg-[var(--color-type-set)] text-white' : 'text-[var(--color-macos-text-secondary)] hover:bg-[var(--color-surface-hover)]'}"
    onclick={() => typeFilter = typeFilter === 'set' ? 'all' : 'set'}
  >
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-set)] {typeFilter === 'set' ? 'bg-white' : ''}"></span>
    set
  </button>
  <button 
    class="px-1.5 py-0.5 rounded-md text-base transition-colors flex items-center gap-0.5 {typeFilter === 'zset' ? 'bg-[var(--color-type-zset)] text-white' : 'text-[var(--color-macos-text-secondary)] hover:bg-[var(--color-surface-hover)]'}"
    onclick={() => typeFilter = typeFilter === 'zset' ? 'all' : 'zset'}
  >
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-zset)] {typeFilter === 'zset' ? 'bg-white' : ''}"></span>
    zset
  </button>
</div>

<!-- Toolbar -->
<div class="px-2 py-1 border-b border-[var(--color-macos-border)] flex items-center justify-between bg-[var(--color-surface-hover)]">
  <!-- View & Sort Icons -->
  <div class="flex items-center gap-1">
    <!-- List/Tree Toggle -->
    <button 
      class="w-6 h-6 flex items-center justify-center rounded-md text-base transition-colors {viewMode === 'list' ? 'text-[var(--color-accent)]' : 'text-[var(--color-macos-text-tertiary)] hover:text-[var(--color-macos-text-secondary)]'}"
      onclick={() => viewMode = 'list'}
      title="List view"
    >
      ☰
    </button>
    <button 
      class="w-6 h-6 flex items-center justify-center rounded-md text-base transition-colors {viewMode === 'tree' ? 'text-[var(--color-accent)]' : 'text-[var(--color-macos-text-tertiary)] hover:text-[var(--color-macos-text-secondary)]'}"
      onclick={() => viewMode = 'tree'}
      title="Tree view"
    >
      ⊞
    </button>

    {#if viewMode === 'tree'}
      <span class="w-px h-4 bg-[var(--color-macos-border)] mx-1"></span>
      <button 
        class="w-7 h-7 flex items-center justify-center rounded-md text-base text-[var(--color-macos-text-tertiary)] hover:text-[var(--color-macos-text-secondary)] transition-colors"
        onclick={expandAll}
        title="Expand all"
      >
        ▾
      </button>
      <button 
        class="w-7 h-7 flex items-center justify-center rounded-md text-base text-[var(--color-macos-text-tertiary)] hover:text-[var(--color-macos-text-secondary)] transition-colors"
        onclick={collapseAll}
        title="Collapse all"
      >
        ▸
      </button>
    {/if}

    <span class="w-px h-4 bg-[var(--color-macos-border)] mx-1"></span>
    <button 
      class="w-7 h-7 flex items-center justify-center rounded-md text-base text-[var(--color-macos-text-tertiary)] hover:text-[var(--color-macos-text-secondary)] transition-colors"
      onclick={cycleSortOrder}
      title={sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
    >
      {sortOrder === 'asc' ? '↑' : '↓'}
    </button>
    
    <span class="w-px h-4 bg-[var(--color-macos-border)] mx-1"></span>
    <span class="text-base text-[var(--color-macos-text-secondary)]">{filteredKeys.length} keys</span>
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-1">
    <button 
      class="w-7 h-7 flex items-center justify-center rounded-md text-lg text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
      onclick={() => showCreateModal = true}
      title="New key"
    >
      +
    </button>
    <button 
      class="w-7 h-7 flex items-center justify-center rounded-md text-base transition-colors {isSelectionMode ? 'text-[var(--color-accent)]' : 'text-[var(--color-macos-text-tertiary)] hover:text-[var(--color-macos-text-secondary)]'}"
      onclick={toggleSelectionMode}
      title={isSelectionMode ? 'Cancel' : 'Multi select'}
    >
      ☑
    </button>
  </div>
</div>

<!-- Selection Bar -->
{#if isSelectionMode}
  <div class="px-3 py-1.5 border-b border-[var(--color-macos-border)] bg-[var(--color-accent-subtle)] flex items-center gap-2 text-base">
    {#if isBatchDeleting}
      <span class="text-[var(--color-macos-text)]">deleting...</span>
      <div class="flex-1 h-1.5 bg-[var(--color-macos-border)] rounded-full overflow-hidden">
        <div 
          class="h-full bg-[var(--color-accent)] transition-all duration-200 rounded-full"
          style="width: {batchDeleteProgress.total > 0 ? (batchDeleteProgress.current / batchDeleteProgress.total * 100) : 0}%"
        ></div>
      </div>
      <span class="text-[var(--color-macos-text-secondary)]">{batchDeleteProgress.current}/{batchDeleteProgress.total}</span>
    {:else}
      <span class="text-[var(--color-macos-text)]">{selectedKeys.size} selected</span>
      <span class="w-px h-4 bg-[var(--color-macos-border)] mx-1"></span>
      <button class="text-[var(--color-accent)] hover:underline" onclick={selectAll}>all</button>
      <button class="text-[var(--color-macos-text-secondary)] hover:underline" onclick={deselectAll}>none</button>
      {#if selectedKeys.size > 0}
        <button class="text-[var(--color-accent)] hover:underline ml-auto" onclick={handleBatchDelete}>
          delete ({selectedKeys.size})
        </button>
      {/if}
    {/if}
  </div>
{/if}

<!-- Keys List/Tree -->
<div class="flex-1 min-h-0">
  {#if $keys.length === 0}
    <div class="px-4 py-8 text-center">
      <div class="text-base text-[var(--color-macos-text-tertiary)]">no keys</div>
      <div class="text-sm text-[var(--color-macos-text-secondary)] mt-2">No keys found. Click <span class="text-[var(--color-accent)] font-bold">+</span> to create a new key.</div>
    </div>
  {:else if filteredKeys.length === 0}
    <div class="px-4 py-8 text-center">
      <div class="text-base text-[var(--color-macos-text-tertiary)]">no keys match filter</div>
      <div class="text-sm text-[var(--color-macos-text-secondary)] mt-2">Try adjusting your search pattern or type filter</div>
    </div>
  {:else if viewMode === 'list'}
    <!-- List View with Virtual Scrolling -->
    <VirtualList
      bind:this={virtualListRef}
      items={filteredKeys}
      itemHeight={36}
      selectedKey={$activeKey}
      getKey={(key) => key}
      onItemClick={(key) => handleSelectKey(key)}
      onItemContextMenu={(key, _, e) => handleContextMenu(e, key)}
    >
      {#snippet item(key: string, index: number)}
        {@const keyType = $keyTypes.get(key) || 'unknown'}
        <div class="px-4 py-2 flex items-center gap-2 h-full">
          {#if isSelectionMode}
            <input 
              type="checkbox" 
              checked={selectedKeys.has(key)}
              class="accent-[var(--color-accent)] cursor-pointer"
              onclick={(e) => { e.stopPropagation(); toggleSelection(key); }}
            />
          {/if}
          <span class="w-5 h-5 flex items-center justify-center rounded-md text-[10px] text-white font-medium {getTypeColorBg(keyType)}">{getTypeLabel(keyType)}</span>
          <span class="text-base text-[var(--color-macos-text)] font-mono truncate">{key}</span>
        </div>
      {/snippet}
    </VirtualList>
  {:else}
    <!-- Tree View with Virtual Scrolling -->
    <VirtualList
      bind:this={virtualListRef}
      items={flatTreeNodes}
      itemHeight={36}
      selectedKey={$activeKey}
      getKey={({ node }) => node.fullPath}
      onItemClick={({ node }) => {
        if (node.isLeaf || (node.children.size > 0 && node.isLeaf)) {
          handleSelectKey(node.fullPath);
        } else if (node.children.size > 0) {
          toggleExpand(node.fullPath);
        }
      }}
      onItemContextMenu={({ node }, _, e) => {
        if (node.isLeaf) handleContextMenu(e, node.fullPath);
      }}
    >
      {#snippet item({ node, level }: { node: TreeNode; level: number }, index: number)}
        {@const hasChildren = node.children.size > 0}
        {@const isBothParentAndLeaf = hasChildren && node.isLeaf}
        {@const isExpanded = expandedSet.has(node.fullPath)}
        {@const isSelected = node.isLeaf && $activeKey === node.fullPath}
        {@const keyType = node.isLeaf ? ($keyTypes.get(node.fullPath) || 'unknown') : undefined}
        <div
          class="flex items-center gap-1.5 px-2 py-2 h-full cursor-pointer transition-colors {isSelected ? 'bg-[var(--color-accent-subtle)]' : (hasChildren && !node.isLeaf ? 'hover:bg-[var(--color-surface-hover)]' : 'hover:bg-[var(--color-surface-hover)]')}"
          style="padding-left: {level * 16 + 12}px"
        >
          {#if hasChildren}
            <span class="text-[var(--color-text-faint)] text-base w-4 flex-shrink-0 hover:text-[var(--color-accent)] cursor-pointer">
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
      {/snippet}
    </VirtualList>
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
