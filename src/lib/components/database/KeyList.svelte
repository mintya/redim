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
  const typeFilterOptions: Array<{ value: string; label: string; dot?: string }> = [
    { value: 'all', label: 'all' },
    { value: 'string', label: 'str', dot: 'var(--color-type-string)' },
    { value: 'hash', label: 'hash', dot: 'var(--color-type-hash)' },
    { value: 'list', label: 'list', dot: 'var(--color-type-list)' },
    { value: 'set', label: 'set', dot: 'var(--color-type-set)' },
    { value: 'zset', label: 'zset', dot: 'var(--color-type-zset)' },
  ];

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

  function toggleTypeFilter(next: string) {
    if (next === 'all') {
      typeFilter = 'all';
      return;
    }
    typeFilter = typeFilter === next ? 'all' : next;
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

<div class="ui-keylist-header">
  <div class="ui-toolbar ui-keylist-toolbar">
    <div class="flex items-center gap-1.5 min-w-[140px] flex-1">
      <input
        type="text"
        bind:value={pattern}
        placeholder="fuzzy search..."
        class="ui-input ui-input-sm ui-keylist-search"
        onkeydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <Button variant="ghost" size="sm" class="ui-btn-icon-sm" onclick={handleSearch}>
        <Search class="w-3 h-3" />
      </Button>
      <span class="ui-keylist-count">{filteredKeys.length}</span>
    </div>
  </div>

  <div class="ui-toolbar ui-keylist-toolbar">
    <div class="flex items-center gap-1 shrink-0">
      <div class="ui-keylist-toggle-group">
        <button
          class="ui-keylist-toggle {viewMode === 'list' ? 'ui-keylist-toggle-active' : ''}"
          onclick={() => (viewMode = 'list')}
          title="List view"
        >
          <List class="w-3 h-3" />
        </button>
        <button
          class="ui-keylist-toggle {viewMode === 'tree' ? 'ui-keylist-toggle-active' : ''}"
          onclick={() => (viewMode = 'tree')}
          title="Tree view"
        >
          <GitBranch class="w-3 h-3" />
        </button>
      </div>

      {#if viewMode === 'tree'}
        <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={expandAll} title="Expand all">
          <ChevronDown class="w-3 h-3" />
        </button>
        <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={collapseAll} title="Collapse all">
          <ChevronRight class="w-3 h-3" />
        </button>
      {/if}

      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cycleSortOrder} title={sortOrder === 'asc' ? 'A→Z' : 'Z→A'}>
        <ArrowUpDown class="w-3 h-3 {sortOrder === 'asc' ? '' : 'rotate-180'}" />
      </button>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      {#if isSelectionMode}
        {#if isBatchDeleting}
          <div class="ui-keylist-delete-progress">
            <span class="text-[10px] text-[var(--color-text-secondary)]">deleting...</span>
            <div class="flex-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden min-w-12">
              <div
                class="h-full bg-[var(--color-text-primary)] transition-all duration-200 rounded-full"
                style="width: {batchDeleteProgress.total > 0 ? (batchDeleteProgress.current / batchDeleteProgress.total) * 100 : 0}%"
              ></div>
            </div>
            <span class="text-[10px] text-[var(--color-text-secondary)]">{batchDeleteProgress.current}/{batchDeleteProgress.total}</span>
          </div>
        {:else}
          <span class="text-xs text-[var(--color-text-secondary)]">{selectedKeys.size} selected</span>
          <button class="ui-btn-link" onclick={selectAll}>all</button>
          <button class="ui-btn-link" onclick={deselectAll}>none</button>
          {#if selectedKeys.size > 0}
            <button class="ui-btn ui-btn-danger ui-btn-sm" onclick={handleBatchDelete}>
              <Trash2 class="w-3 h-3" />
              <span>delete ({selectedKeys.size})</span>
            </button>
          {/if}
        {/if}
        <button class="ui-btn ui-btn-ghost ui-btn-icon-sm border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]" onclick={toggleSelectionMode} title="Exit multi select">
          <CheckSquare class="w-3.5 h-3.5" />
        </button>
      {:else}
        <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => (showCreateModal = true)} title="New key">
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={toggleSelectionMode} title="Multi select">
          <CheckSquare class="w-3.5 h-3.5 opacity-60" />
        </button>
      {/if}
    </div>
  </div>

  <div class="ui-subtoolbar ui-keylist-subtoolbar overflow-x-auto">
    <div class="ui-keylist-chip-group">
      {#each typeFilterOptions as option}
        <button
          class="ui-keylist-chip {typeFilter === option.value ? 'ui-keylist-chip-active' : ''}"
          onclick={() => toggleTypeFilter(option.value)}
          style={typeFilter === option.value && option.dot ? `color:${option.dot};` : undefined}
        >
          {#if option.dot}
            <span class="ui-keylist-chip-dot" style="background-color: {typeFilter === option.value ? 'currentColor' : option.dot}"></span>
          {/if}
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<div class="flex-1 min-h-0">
  {#if $keys.length === 0}
    <div class="px-4 py-6 text-center">
      <div class="text-xs text-[var(--color-text-tertiary)]">no keys</div>
      <div class="text-xs text-[var(--color-text-tertiary)] mt-1">Click <span class="text-[var(--color-text-primary)] font-semibold">+</span> to create a key.</div>
    </div>
  {:else if filteredKeys.length === 0}
    <div class="px-4 py-6 text-center">
      <div class="text-xs text-[var(--color-text-tertiary)]">no keys match filter</div>
      <div class="text-xs text-[var(--color-text-tertiary)] mt-1">Adjust search pattern or type filter.</div>
    </div>
  {:else if viewMode === 'list'}
    <VirtualList
      bind:this={virtualListRef}
      items={filteredKeys}
      itemHeight={34}
      selectedKey={$keyListHighlightKey}
      getKey={(key) => key}
      onItemClick={(key) => handleSelectKey(key)}
      onItemContextMenu={(key, _, e) => handleContextMenu(e, key)}
      rowClassName="ui-keylist-row"
      selectedClassName="ui-keylist-row-selected"
      hoverClassName="ui-keylist-row-hover"
    >
      {#snippet item(key: string, index: number)}
        {@const keyType = $keyTypes.get(key) || 'unknown'}
        <div class="px-2.5 py-1.5 flex items-center gap-2 h-full min-w-0">
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
          <span class="ui-key-badge {getTypeColorBg(keyType)}">{getTypeLabel(keyType)}</span>
          <span class="text-xs text-[var(--color-text-primary)] font-sans truncate flex-1 min-w-0 leading-none">{key}</span>
        </div>
      {/snippet}
    </VirtualList>
  {:else}
    <VirtualList
      bind:this={virtualListRef}
      items={flatTreeNodes}
      itemHeight={34}
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
      rowClassName="ui-keylist-row"
      selectedClassName="ui-keylist-row-selected"
      hoverClassName="ui-keylist-row-hover"
    >
      {#snippet item({ node, level }: { node: TreeNode; level: number }, index: number)}
        {@const hasChildren = node.children.size > 0}
        {@const isBothParentAndLeaf = hasChildren && node.isLeaf}
        {@const isExpanded = expandedSet.has(node.fullPath)}
        {@const keyType = node.isLeaf ? ($keyTypes.get(node.fullPath) || 'unknown') : undefined}
        <div class="flex items-center gap-1.5 h-full min-w-0 pr-2.5" style="padding-left: {level * 14 + 10}px">
          {#if hasChildren}
            <button type="button" class="ui-keytree-toggle" onclick={(e) => { e.stopPropagation(); toggleExpand(node.fullPath); }}>
              {#if isExpanded}
                <ChevronDown class="w-3 h-3" />
              {:else}
                <ChevronRight class="w-3 h-3" />
              {/if}
            </button>
          {:else}
            <span class="w-4 h-4 flex-shrink-0"></span>
          {/if}

          {#if node.isLeaf && keyType}
            <span class="ui-key-badge {getTypeColorBg(keyType)}">{getTypeLabel(keyType)}</span>
          {:else if hasChildren}
            <span class="w-[14px] h-[14px] flex-shrink-0"></span>
          {/if}

          <span class="text-xs font-sans truncate flex-1 min-w-0 {hasChildren && !isBothParentAndLeaf ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}">{node.name}</span>

          {#if hasChildren}
            <span class="text-[10px] text-[var(--color-text-muted)] ml-1 flex-shrink-0">({node.children.size})</span>
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
