<script lang="ts">
  import { keys, keyTypes, searchPattern, activeDb, openOrFocusTab, keyListHighlightKey, loadKeys, deleteKey } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';
  import { invoke } from '@tauri-apps/api/core';
  import { buildTree, flattenTree, type TreeNode, type SortOrder } from '$lib/utils/tree';
  import Button from '$lib/components/common/Button.svelte';
  import ContextMenu from '$lib/components/common/ContextMenu.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';
  import CreateKeyModal from './CreateKeyModal.svelte';
  import VirtualList from '$lib/components/common/VirtualList.svelte';
  import { getTypeColorBg, getTypeLabel } from '$lib/utils/redisType';
  import { ChevronRight, ChevronDown, List, GitBranch, ArrowUpDown, Plus, CheckSquare, Search, Trash2 } from '@lucide/svelte';

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

  let viewMode = $state<'list' | 'tree'>('list');
  let sortOrder = $state<SortOrder>('asc');
  let separator = $state(':');
  let expandedNodes = $state<string[]>([]);
  let typeFilter = $state<string>('all');

  let expandedSet = $derived(new Set(expandedNodes));
  let virtualListRef = $state<VirtualList | null>(null);

  let filteredKeys = $derived.by(() => {
    let arr = [...$keys];
    if (typeFilter !== 'all') {
      arr = arr.filter((key) => $keyTypes.get(key) === typeFilter);
    }
    if (sortOrder === 'asc') {
      arr.sort((a, b) => a.localeCompare(b));
    } else if (sortOrder === 'desc') {
      arr.sort((a, b) => b.localeCompare(a));
    }
    return arr;
  });

  let tree = $derived.by(() => buildTree(filteredKeys, separator));
  let flatTreeNodes = $derived.by(() => flattenTree(tree, 0, expandedSet));

  function toggleExpand(path: string) {
    if (expandedNodes.includes(path)) {
      expandedNodes = expandedNodes.filter((p) => p !== path);
    } else {
      expandedNodes = [...expandedNodes, path];
    }
  }

  function expandAll() {
    const allPaths: string[] = [];
    function collectPaths(node: TreeNode) {
      if (node.children.size > 0) {
        allPaths.push(node.fullPath);
        for (const child of node.children.values()) collectPaths(child);
      }
    }
    for (const child of tree.children.values()) collectPaths(child);
    expandedNodes = allPaths;
  }

  function collapseAll() {
    expandedNodes = [];
  }

  function cycleSortOrder() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
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
      await openOrFocusTab($activeConnectionId, $activeDb, key);
    }
  }

  function toggleSelection(key: string) {
    if (selectedKeys.has(key)) selectedKeys.delete(key);
    else selectedKeys.add(key);
    selectedKeys = new Set(selectedKeys);
  }

  function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    if (!isSelectionMode) selectedKeys.clear();
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
      if ($activeConnectionId) await deleteKey($activeConnectionId, key);
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

<div class="px-2 py-1.5 border-b border-[var(--color-border)]">
  <div class="flex gap-1.5">
    <input
      type="text"
      bind:value={pattern}
      placeholder="fuzzy search..."
      class="flex-1 h-7 px-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[5px] text-xs font-sans placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[var(--shadow-input-focus)] transition-all duration-150"
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <Button variant="secondary" size="sm" onclick={handleSearch}>
      <Search class="w-3 h-3" />
    </Button>
  </div>
</div>

<div class="px-2 py-1 border-b border-[var(--color-border)] overflow-x-auto">
  <div class="ui-segment min-w-max">
    <button class="ui-segment-item whitespace-nowrap {typeFilter === 'all' ? 'ui-segment-item-active' : ''}" onclick={() => (typeFilter = 'all')}>all</button>
    <button class="ui-segment-item flex items-center gap-0.5 whitespace-nowrap {typeFilter === 'string' ? 'bg-[var(--color-type-string)] text-white border-[var(--color-type-string)]' : ''}" onclick={() => (typeFilter = typeFilter === 'string' ? 'all' : 'string')}><span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-string)] {typeFilter === 'string' ? 'bg-white' : ''}"></span>str</button>
    <button class="ui-segment-item flex items-center gap-0.5 whitespace-nowrap {typeFilter === 'hash' ? 'bg-[var(--color-type-hash)] text-white border-[var(--color-type-hash)]' : ''}" onclick={() => (typeFilter = typeFilter === 'hash' ? 'all' : 'hash')}><span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-hash)] {typeFilter === 'hash' ? 'bg-white' : ''}"></span>hash</button>
    <button class="ui-segment-item flex items-center gap-0.5 whitespace-nowrap {typeFilter === 'list' ? 'bg-[var(--color-type-list)] text-white border-[var(--color-type-list)]' : ''}" onclick={() => (typeFilter = typeFilter === 'list' ? 'all' : 'list')}><span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-list)] {typeFilter === 'list' ? 'bg-white' : ''}"></span>list</button>
    <button class="ui-segment-item flex items-center gap-0.5 whitespace-nowrap {typeFilter === 'set' ? 'bg-[var(--color-type-set)] text-white border-[var(--color-type-set)]' : ''}" onclick={() => (typeFilter = typeFilter === 'set' ? 'all' : 'set')}><span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-set)] {typeFilter === 'set' ? 'bg-white' : ''}"></span>set</button>
    <button class="ui-segment-item flex items-center gap-0.5 whitespace-nowrap {typeFilter === 'zset' ? 'bg-[var(--color-type-zset)] text-white border-[var(--color-type-zset)]' : ''}" onclick={() => (typeFilter = typeFilter === 'zset' ? 'all' : 'zset')}><span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-zset)] {typeFilter === 'zset' ? 'bg-white' : ''}"></span>zset</button>
  </div>
</div>

<div class="px-2 py-1 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-elevated)]">
  <div class="flex items-center gap-1">
    <div class="ui-segment">
      <button class="ui-segment-item {viewMode === 'list' ? 'ui-segment-item-active' : ''}" onclick={() => (viewMode = 'list')} title="List view">
        <List class="w-3 h-3" />
      </button>
      <button class="ui-segment-item {viewMode === 'tree' ? 'ui-segment-item-active' : ''}" onclick={() => (viewMode = 'tree')} title="Tree view">
        <GitBranch class="w-3 h-3" />
      </button>
    </div>

    {#if viewMode === 'tree'}
      <span class="w-px h-4 bg-[var(--color-border)] mx-1"></span>
      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={expandAll} title="Expand all">
        <ChevronDown class="w-3 h-3" />
      </button>
      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={collapseAll} title="Collapse all">
        <ChevronRight class="w-3 h-3" />
      </button>
    {/if}

    <span class="w-px h-4 bg-[var(--color-border)] mx-1"></span>
    <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cycleSortOrder} title={sortOrder === 'asc' ? 'A→Z' : 'Z→A'}>
      <ArrowUpDown class="w-3 h-3 {sortOrder === 'asc' ? '' : 'rotate-180'}" />
    </button>
    <span class="text-[11px] text-[var(--color-text-secondary)] ml-1">{filteredKeys.length}</span>
  </div>

  <div class="flex items-center gap-1">
    <button class="ui-btn ui-btn-ghost ui-btn-icon" onclick={() => (showCreateModal = true)} title="New key">
      <Plus class="w-3.5 h-3.5" />
    </button>
    <button class="ui-btn ui-btn-ghost ui-btn-icon {isSelectionMode ? 'border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]' : ''}" onclick={toggleSelectionMode} title={isSelectionMode ? 'Cancel' : 'Multi select'}>
      <CheckSquare class="w-3.5 h-3.5 {isSelectionMode ? '' : 'opacity-60'}" />
    </button>
  </div>
</div>

{#if isSelectionMode}
  <div class="px-2.5 py-1 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex items-center gap-2 text-xs">
    {#if isBatchDeleting}
      <span class="text-[var(--color-text-primary)]">deleting...</span>
      <div class="flex-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div class="h-full bg-[var(--color-text-primary)] transition-all duration-200 rounded-full" style="width: {batchDeleteProgress.total > 0 ? (batchDeleteProgress.current / batchDeleteProgress.total * 100) : 0}%"></div>
      </div>
      <span class="text-[var(--color-text-secondary)]">{batchDeleteProgress.current}/{batchDeleteProgress.total}</span>
    {:else}
      <span class="text-[var(--color-text-primary)]">{selectedKeys.size} selected</span>
      <span class="w-px h-3 bg-[var(--color-border)]"></span>
      <button class="ui-btn-link" onclick={selectAll}>all</button>
      <button class="ui-btn-link" onclick={deselectAll}>none</button>
      {#if selectedKeys.size > 0}
        <button class="ui-btn ui-btn-danger ui-btn-sm ml-auto" onclick={handleBatchDelete}>
          <Trash2 class="w-3 h-3" />
          <span>delete ({selectedKeys.size})</span>
        </button>
      {/if}
    {/if}
  </div>
{/if}

<div class="flex-1 min-h-0">
  {#if $keys.length === 0}
    <div class="px-4 py-6 text-center border-b border-[var(--color-border)]">
      <div class="text-sm text-[var(--color-text-tertiary)]">no keys</div>
      <div class="text-xs text-[var(--color-text-tertiary)] mt-1">Click <span class="text-[var(--color-text-primary)] font-semibold">+</span> to create a key.</div>
    </div>
  {:else if filteredKeys.length === 0}
    <div class="px-4 py-6 text-center border-b border-[var(--color-border)]">
      <div class="text-sm text-[var(--color-text-tertiary)]">no keys match filter</div>
      <div class="text-xs text-[var(--color-text-tertiary)] mt-1">Adjust search pattern or type filter.</div>
    </div>
  {:else if viewMode === 'list'}
    <VirtualList
      bind:this={virtualListRef}
      items={filteredKeys}
      itemHeight={32}
      selectedKey={$keyListHighlightKey}
      getKey={(key) => key}
      onItemClick={(key) => handleSelectKey(key)}
      onItemContextMenu={(key, _, e) => handleContextMenu(e, key)}
    >
      {#snippet item(key: string, index: number)}
        {@const keyType = $keyTypes.get(key) || 'unknown'}
        <div class="px-3 py-1.5 flex items-center gap-2 h-full">
          {#if isSelectionMode}
            <input
              type="checkbox"
              checked={selectedKeys.has(key)}
              class="accent-[var(--color-text-primary)] cursor-pointer"
              onclick={(e) => {
                e.stopPropagation();
                toggleSelection(key);
              }}
            />
          {/if}
          <span class="w-4 h-4 flex items-center justify-center rounded text-[9px] text-white font-medium {getTypeColorBg(keyType)}">{getTypeLabel(keyType)}</span>
          <span class="text-xs text-[var(--color-text-primary)] font-sans truncate">{key}</span>
        </div>
      {/snippet}
    </VirtualList>
  {:else}
    <VirtualList
      bind:this={virtualListRef}
      items={flatTreeNodes}
      itemHeight={32}
      selectedKey={$keyListHighlightKey}
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
        {@const keyType = node.isLeaf ? ($keyTypes.get(node.fullPath) || 'unknown') : undefined}
        <div class="flex items-center gap-1.5 px-2 h-full cursor-pointer transition-colors" style="padding-left: {level * 14 + 10}px">
          {#if hasChildren}
            <button type="button" class="ui-btn ui-btn-ghost ui-btn-icon-sm w-4 flex-shrink-0 cursor-pointer" onclick={(e) => { e.stopPropagation(); toggleExpand(node.fullPath); }}>
              {#if isExpanded}
                <ChevronDown class="w-3 h-3" />
              {:else}
                <ChevronRight class="w-3 h-3" />
              {/if}
            </button>
          {:else}
            <span class="w-4 flex-shrink-0"></span>
          {/if}

          {#if node.isLeaf && keyType}
            <span class="w-3.5 h-3.5 flex items-center justify-center rounded text-[8px] text-white font-medium flex-shrink-0 {getTypeColorBg(keyType)}">{getTypeLabel(keyType)}</span>
          {:else if hasChildren}
            <span class="w-3.5 flex-shrink-0"></span>
          {/if}

          <span class="text-xs font-sans truncate {hasChildren && !isBothParentAndLeaf ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}">{node.name}</span>

          {#if hasChildren}
            <span class="text-[var(--color-text-muted)] text-[11px] ml-1">({node.children.size})</span>
          {/if}

          {#if isBothParentAndLeaf}
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-type-string)] ml-1 flex-shrink-0" title="Also a key"></span>
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
    items={[{ label: 'delete', action: () => handleDeleteKey(contextMenu!.key), danger: true, icon: Trash2 }]}
    onclose={closeContextMenu}
  />
{/if}

<CreateKeyModal bind:open={showCreateModal} onclose={() => (showCreateModal = false)} />

<Confirm
  bind:open={showConfirm}
  title="delete key"
  message={confirmMessage}
  confirmText="delete"
  danger={true}
  onconfirm={handleConfirm}
  oncancel={handleCancel}
/>
