<script lang="ts">
  import { keyInfo, keyValue, activeKey, activeKeyTab, detailConnectionId, setStringValue, setHashField, deleteHashField, deleteHashFields, pushListValue, setListValue, removeListValue, addSetMember, removeSetMember, addZSetMember, deleteZSetMember, deleteKey, renameKey, setKeyTtl, refreshCurrentKey } from '$lib/stores/database';
  import type { HashField, ZSetMember } from '$lib/types';
  import { getTypeColorBg, getTypeLabel } from '$lib/utils/redisType';
  import { isJsonString, decodeUnicode, formatJson, isJson, highlightJson, escapeHtml } from '$lib/utils/json';
  import { byteSize, formatBytes } from '$lib/utils/format';
  import { toast } from '$lib/stores/toast';
  import Button from '$lib/components/common/Button.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';
  import { Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Clock, Edit3, Copy, RotateCcw, ArrowUpAZ, ArrowDownAZ, ArrowUpDown, Search } from '@lucide/svelte';

  let editingValue = $state('');
  let isEditing = $state(false);
  let editingIndex = $state(-1);
  let editingField = $state('');
  let newField = $state('');
  let newValue = $state('');
  let newScore = $state('0');
  let showAddForm = $state(false);
  let showConfirm = $state(false);
  let confirmMessage = $state('');
  let confirmAction = $state<(() => void | Promise<void>) | null>(null);
  let jsonViewMode = $state<'raw' | 'format' | 'hex'>('format');
  let expandedJsonItems = $state<Set<string>>(new Set());
  let showInlineInput = $state(false);
  let inlineInputType = $state<'rename' | 'ttl'>('rename');
  let inlineInputValue = $state('');
  let pushAtHead = $state(false);
  let zsetSortOrder = $state<'none' | 'asc' | 'desc'>('none');
  let hashSortOrder = $state<'none' | 'asc' | 'desc'>('none');
  let setSortOrder = $state<'none' | 'asc' | 'desc'>('none');
  let hashFilter = $state('');
  let listFilter = $state('');
  let setFilter = $state('');
  let zsetFilter = $state('');
  let refreshing = $state(false);
  let selectedHashFields = $state<Set<string>>(new Set());
  let now = $state(Date.now());
  const TABLE_VALUE_EXPAND_THRESHOLD = 120;
  const RENDER_CAP = 200;

  $effect(() => {
    void $activeKey;
    void $detailConnectionId;
    selectedHashFields = new Set();
    decorationCache.clear();
    formatJsonCache.clear();
  });

  $effect(() => {
    const id = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(id);
  });

  let displayTtl = $derived.by(() => {
    if (!$keyInfo) return null;
    if ($keyInfo.ttl < 0) return $keyInfo.ttl;
    const loadedAt = $activeKeyTab?.keyInfoLoadedAt;
    if (loadedAt == null) return $keyInfo.ttl;
    const elapsed = Math.floor((now - loadedAt) / 1000);
    return Math.max(0, $keyInfo.ttl - elapsed);
  });

  function formatTtl(ttl: number | null): string {
    if (ttl == null) return '—';
    if (ttl < 0) return '∞';
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
    if (ttl < 86400) {
      const h = Math.floor(ttl / 3600);
      const m = Math.floor((ttl % 3600) / 60);
      return `${h}h ${m}m`;
    }
    const d = Math.floor(ttl / 86400);
    const h = Math.floor((ttl % 86400) / 3600);
    return `${d}d ${h}h`;
  }

  function matchesFilter(haystack: string, needle: string): boolean {
    if (!needle) return true;
    return haystack.toLowerCase().includes(needle.toLowerCase());
  }

  function cycleSort(current: 'none' | 'asc' | 'desc'): 'none' | 'asc' | 'desc' {
    if (current === 'none') return 'asc';
    if (current === 'asc') return 'desc';
    return 'none';
  }

  function formatScore(score: number): string {
    if (!Number.isFinite(score)) return String(score);
    if (Number.isInteger(score)) return String(score);
    const s = score.toString();
    if (s.length <= 8) return s;
    return Number(score.toFixed(4)).toString();
  }

  const HEX_VIEW_BYTE_LIMIT = 64 * 1024;

  function toHexView(s: string): string {
    const encoder = new TextEncoder();
    const all = encoder.encode(s);
    const truncated = all.length > HEX_VIEW_BYTE_LIMIT;
    const bytes = truncated ? all.subarray(0, HEX_VIEW_BYTE_LIMIT) : all;
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.subarray(i, Math.min(i + 16, bytes.length));
      const hex: string[] = [];
      const ascii: string[] = [];
      for (let j = 0; j < 16; j++) {
        if (j < chunk.length) {
          const b = chunk[j];
          hex.push(b.toString(16).padStart(2, '0'));
          ascii.push(b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.');
        } else {
          hex.push('  ');
          ascii.push(' ');
        }
      }
      const offset = i.toString(16).padStart(8, '0');
      lines.push(`${offset}  ${hex.slice(0, 8).join(' ')}  ${hex.slice(8).join(' ')}  ${ascii.join('')}`);
    }
    if (truncated) lines.push(`... (truncated at ${HEX_VIEW_BYTE_LIMIT} bytes of ${all.length} total)`);
    return lines.join('\n');
  }

  function parseAsNumber(s: string): number | null {
    if (!s || s.length > 32) return null;
    const trimmed = s.trim();
    if (trimmed === '' || /\s/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Failed to copy');
    }
  }

  function inlineEditKey(e: KeyboardEvent, onSave: () => void, onCancel: () => void) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Enter') {
      const isTextarea = e.target instanceof HTMLTextAreaElement;
      if (isTextarea && !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      onSave();
    }
  }

  async function handleRefresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      await refreshCurrentKey();
    } finally {
      refreshing = false;
    }
  }

  function toggleZsetSort() {
    zsetSortOrder = cycleSort(zsetSortOrder);
  }

  function toggleHashSort() {
    hashSortOrder = cycleSort(hashSortOrder);
  }

  function toggleSetSort() {
    setSortOrder = cycleSort(setSortOrder);
  }

  const DECORATION_CACHE_LIMIT = 2000;
  const FORMAT_JSON_CACHE_LIMIT = 200;
  const decorationCache = new Map<string, { display: string; isJsonValue: boolean; canExpand: boolean }>();
  const formatJsonCache = new Map<string, string>();

  function decorateValue(rawValue: string) {
    let cached = decorationCache.get(rawValue);
    if (!cached) {
      const display = decodeUnicode(rawValue);
      const json = isJson(rawValue);
      cached = {
        display,
        isJsonValue: json,
        canExpand: json || display.length > TABLE_VALUE_EXPAND_THRESHOLD || display.includes('\n'),
      };
      decorationCache.set(rawValue, cached);
      if (decorationCache.size > DECORATION_CACHE_LIMIT) {
        const first = decorationCache.keys().next().value;
        if (first !== undefined) decorationCache.delete(first);
      }
    }
    return cached;
  }

  /**
   * Returns HTML-safe markup for a JSON value: cached, highlighted via
   * .json-* spans. For non-JSON values returns just the html-escaped display
   * (so callers can always render with `{@html ...}`).
   */
  function getFormatted(rawValue: string, isJsonValue: boolean, display: string): string {
    if (!isJsonValue) return escapeHtml(display);
    let cached = formatJsonCache.get(rawValue);
    if (cached === undefined) {
      cached = highlightJson(formatJson(rawValue));
      formatJsonCache.set(rawValue, cached);
      if (formatJsonCache.size > FORMAT_JSON_CACHE_LIMIT) {
        const first = formatJsonCache.keys().next().value;
        if (first !== undefined) formatJsonCache.delete(first);
      }
    }
    return cached;
  }

  // Hash derived chain ----------------------------------------------
  let hashEntries = $derived.by(() => {
    if (!Array.isArray($keyValue) || $keyInfo?.key_type !== 'hash') return [] as HashField[];
    return $keyValue as HashField[];
  });
  let hashTotalBytes = $derived(
    hashEntries.reduce((sum, item) => sum + byteSize(item.field) + byteSize(item.value), 0)
  );
  let hashFiltered = $derived.by(() => {
    if (!hashFilter) return hashEntries;
    return hashEntries.filter(
      (item) => matchesFilter(item.field, hashFilter) || matchesFilter(item.value, hashFilter)
    );
  });
  let hashSorted = $derived.by(() => {
    if (hashSortOrder === 'none') return hashFiltered;
    const arr = [...hashFiltered];
    if (hashSortOrder === 'asc') arr.sort((a, b) => a.field.localeCompare(b.field));
    else arr.sort((a, b) => b.field.localeCompare(a.field));
    return arr;
  });
  let hashRows = $derived(
    hashSorted.slice(0, RENDER_CAP).map((item) => ({ ...item, ...decorateValue(item.value) }))
  );
  let hashAllVisibleSelected = $derived(
    hashRows.length > 0 && hashRows.every((r) => selectedHashFields.has(r.field))
  );
  let hashAnyVisibleSelected = $derived(hashRows.some((r) => selectedHashFields.has(r.field)));

  // List derived chain ----------------------------------------------
  let listEntries = $derived.by(() => {
    if (!Array.isArray($keyValue) || $keyInfo?.key_type !== 'list') return [] as string[];
    return $keyValue as string[];
  });
  let listTotalBytes = $derived(listEntries.reduce((sum, item) => sum + byteSize(item), 0));
  let listValueCounts = $derived.by(() => {
    const m = new Map<string, number>();
    for (const v of listEntries) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  });
  let listFiltered = $derived.by(() => {
    if (!listFilter) return listEntries.map((value, originalIndex) => ({ value, originalIndex }));
    return listEntries
      .map((value, originalIndex) => ({ value, originalIndex }))
      .filter(({ value }) => matchesFilter(value, listFilter));
  });
  let listRows = $derived(
    listFiltered.slice(0, RENDER_CAP).map((row) => ({
      ...row,
      ...decorateValue(row.value),
      duplicateCount: listValueCounts.get(row.value) ?? 1,
    }))
  );

  // Set derived chain -----------------------------------------------
  let setEntries = $derived.by(() => {
    if (!Array.isArray($keyValue) || $keyInfo?.key_type !== 'set') return [] as string[];
    return $keyValue as string[];
  });
  let setTotalBytes = $derived(setEntries.reduce((sum, item) => sum + byteSize(item), 0));
  let setFiltered = $derived.by(() => {
    if (!setFilter) return setEntries;
    return setEntries.filter((item) => matchesFilter(item, setFilter));
  });
  let setSorted = $derived.by(() => {
    if (setSortOrder === 'none') return setFiltered;
    const arr = [...setFiltered];
    if (setSortOrder === 'asc') arr.sort((a, b) => a.localeCompare(b));
    else arr.sort((a, b) => b.localeCompare(a));
    return arr;
  });
  let setRows = $derived(
    setSorted.slice(0, RENDER_CAP).map((member, idx) => ({ member, idx, ...decorateValue(member) }))
  );

  // ZSet derived chain ----------------------------------------------
  let zsetEntries = $derived.by(() => {
    if (!Array.isArray($keyValue) || $keyInfo?.key_type !== 'zset') return [] as ZSetMember[];
    return $keyValue as ZSetMember[];
  });
  let zsetTotalBytes = $derived(
    zsetEntries.reduce((sum, item) => sum + byteSize(item.member) + 8, 0)
  );
  let zsetRanked = $derived.by(() => {
    const arr = [...zsetEntries];
    if (zsetSortOrder === 'asc') arr.sort((a, b) => a.score - b.score);
    else if (zsetSortOrder === 'desc') arr.sort((a, b) => b.score - a.score);
    return arr.map((item, i) => ({ ...item, rank: i + 1 }));
  });
  let zsetFiltered = $derived.by(() => {
    if (!zsetFilter) return zsetRanked;
    return zsetRanked.filter(
      (item) => matchesFilter(item.member, zsetFilter) || matchesFilter(String(item.score), zsetFilter)
    );
  });
  let zsetRows = $derived(
    zsetFiltered.slice(0, RENDER_CAP).map((item, idx) => ({ ...item, idx, ...decorateValue(item.member) }))
  );

  function toggleExpandedItem(id: string) {
    if (expandedJsonItems.has(id)) {
      expandedJsonItems.delete(id);
    } else {
      expandedJsonItems.add(id);
    }
    expandedJsonItems = new Set(expandedJsonItems);
  }

  function getStringDisplay(value: string): string {
    if (jsonViewMode === 'hex') return escapeHtml(toHexView(value));
    if (jsonViewMode === 'format' && isJsonString(value)) {
      return getFormatted(value, true, '');
    }
    return escapeHtml(decodeUnicode(value));
  }


  function startEdit(value: string) {
    editingValue = value;
    isEditing = true;
  }

  async function saveEdit() {
    if ($detailConnectionId && $activeKey && $keyInfo?.key_type === 'string') {
      const success = await setStringValue($detailConnectionId, $activeKey, editingValue);
      if (success) {
        isEditing = false;
      } else {
        toast.error('Failed to save value');
      }
    }
  }

  function cancelEdit() {
    isEditing = false;
    editingValue = '';
  }

  function handleDeleteKey() {
    if ($detailConnectionId && $activeKey) {
      confirmMessage = `Are you sure you want to delete key: ${$activeKey}?`;
      confirmAction = async () => {
        const success = await deleteKey($detailConnectionId!, $activeKey!);
        if (!success) {
          toast.error('Failed to delete key');
        }
      };
      showConfirm = true;
    }
  }

  async function handleConfirm() {
    const action = confirmAction;
    if (!action) return;
    try {
      await action();
    } finally {
      confirmAction = null;
    }
  }

  function handleCancel() {
    confirmAction = null;
  }

  async function handleAddHashField() {
    if ($detailConnectionId && $activeKey && newField && newValue) {
      const success = await setHashField($detailConnectionId, $activeKey, newField, newValue);
      if (success) {
        newField = '';
        newValue = '';
        showAddForm = false;
      } else {
        toast.error('Failed to add hash field');
      }
    }
  }

  async function handleDeleteHashField(field: string) {
    if ($detailConnectionId && $activeKey) {
      const success = await deleteHashField($detailConnectionId, $activeKey, field);
      if (!success) {
        toast.error('Failed to delete hash field');
      } else {
        selectedHashFields.delete(field);
        selectedHashFields = new Set(selectedHashFields);
      }
    }
  }

  function toggleHashSelection(field: string) {
    if (selectedHashFields.has(field)) selectedHashFields.delete(field);
    else selectedHashFields.add(field);
    selectedHashFields = new Set(selectedHashFields);
  }

  function toggleSelectAllVisibleHash() {
    const allSelected = hashRows.length > 0 && hashRows.every((r) => selectedHashFields.has(r.field));
    if (allSelected) {
      for (const r of hashRows) selectedHashFields.delete(r.field);
    } else {
      for (const r of hashRows) selectedHashFields.add(r.field);
    }
    selectedHashFields = new Set(selectedHashFields);
  }

  function clearHashSelection() {
    if (selectedHashFields.size === 0) return;
    selectedHashFields = new Set();
  }

  function handleBulkDeleteHash() {
    if (!$detailConnectionId || !$activeKey) return;
    const fields = Array.from(selectedHashFields);
    if (fields.length === 0) return;
    confirmMessage = `Delete ${fields.length} field${fields.length > 1 ? 's' : ''} from this hash?`;
    confirmAction = async () => {
      const success = await deleteHashFields($detailConnectionId!, $activeKey!, fields);
      if (!success) toast.error('Failed to bulk delete fields');
      selectedHashFields = new Set();
    };
    showConfirm = true;
  }

  async function handleAddListItem() {
    if ($detailConnectionId && $activeKey && newValue) {
      const success = await pushListValue($detailConnectionId, $activeKey, newValue, pushAtHead);
      if (success) {
        newValue = '';
        showAddForm = false;
      } else {
        toast.error('Failed to add list item');
      }
    }
  }

  async function handleAddSetMember() {
    if ($detailConnectionId && $activeKey && newValue) {
      const success = await addSetMember($detailConnectionId, $activeKey, newValue);
      if (success) {
        newValue = '';
        showAddForm = false;
      } else {
        toast.error('Failed to add set member');
      }
    }
  }

  async function handleRemoveSetMember(member: string) {
    if ($detailConnectionId && $activeKey) {
      const success = await removeSetMember($detailConnectionId, $activeKey, member);
      if (!success) {
        toast.error('Failed to remove set member');
      }
    }
  }

  async function handleAddZSetMember() {
    if ($detailConnectionId && $activeKey && newField) {
      const score = parseFloat(newScore);
      if (isNaN(score)) {
        toast.error('Invalid score value');
        return;
      }
      const success = await addZSetMember($detailConnectionId, $activeKey, newField, score);
      if (success) {
        newField = '';
        newScore = '0';
        showAddForm = false;
      } else {
        toast.error('Failed to add zset member');
      }
    }
  }

  async function handleDeleteZSetMember(member: string) {
    if ($detailConnectionId && $activeKey) {
      const success = await deleteZSetMember($detailConnectionId, $activeKey, member);
      if (!success) {
        toast.error('Failed to delete zset member');
      }
    }
  }

  function startEditListItem(index: number, value: string) {
    editingIndex = index;
    editingValue = value;
  }

  async function saveListItemEdit() {
    if ($detailConnectionId && $activeKey && editingIndex >= 0) {
      const success = await setListValue($detailConnectionId, $activeKey, editingIndex, editingValue);
      if (success) {
        editingIndex = -1;
        editingValue = '';
      } else {
        toast.error('Failed to save list item');
      }
    }
  }

  function cancelListItemEdit() {
    editingIndex = -1;
    editingValue = '';
  }

  async function handleRemoveListItem(value: string) {
    if ($detailConnectionId && $activeKey) {
      const success = await removeListValue($detailConnectionId, $activeKey, value, 1);
      if (!success) {
        toast.error('Failed to remove list item');
      }
    }
  }

  function startEditHashField(field: string, value: string) {
    editingField = field;
    editingValue = value;
  }

  async function saveHashFieldEdit() {
    if ($detailConnectionId && $activeKey && editingField) {
      const success = await setHashField($detailConnectionId, $activeKey, editingField, editingValue);
      if (success) {
        editingField = '';
        editingValue = '';
      } else {
        toast.error('Failed to save hash field');
      }
    }
  }

  function cancelHashFieldEdit() {
    editingField = '';
    editingValue = '';
  }

  function startEditZSetMember(member: string, score: number) {
    editingField = member;
    editingValue = String(score);
  }

  async function saveZSetMemberEdit() {
    if ($detailConnectionId && $activeKey && editingField) {
      const score = parseFloat(editingValue);
      if (isNaN(score)) {
        toast.error('Invalid score value');
        return;
      }
      const success = await addZSetMember($detailConnectionId, $activeKey, editingField, score);
      if (success) {
        editingField = '';
        editingValue = '';
      } else {
        toast.error('Failed to save zset member');
      }
    }
  }

  function cancelZSetMemberEdit() {
    editingField = '';
    editingValue = '';
  }

  function openInlineRename() {
    if ($detailConnectionId && $activeKey) {
      inlineInputType = 'rename';
      inlineInputValue = $activeKey;
      showInlineInput = true;
    }
  }

  function openInlineTtl() {
    if ($detailConnectionId && $activeKey) {
      inlineInputType = 'ttl';
      inlineInputValue = String($keyInfo?.ttl ?? -1);
      showInlineInput = true;
    }
  }

  function closeInlineInput() {
    showInlineInput = false;
    inlineInputValue = '';
  }

  async function handleInlineConfirm() {
    if (!$detailConnectionId || !$activeKey) return;
    if (inlineInputType === 'rename') {
      if (inlineInputValue && inlineInputValue !== $activeKey) {
        const success = await renameKey($detailConnectionId, $activeKey, inlineInputValue);
        if (!success) toast.error('Failed to rename key');
      }
    } else if (inlineInputType === 'ttl') {
      const ttl = parseInt(inlineInputValue);
      if (!isNaN(ttl)) {
        const success = await setKeyTtl($detailConnectionId, $activeKey, ttl);
        if (!success) toast.error('Failed to set TTL');
      }
    }
    closeInlineInput();
  }

  function handleInlineKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineConfirm();
    } else if (e.key === 'Escape') {
      closeInlineInput();
    }
  }
</script>

{#if $keyInfo && $activeKey && $detailConnectionId}
  <div class="h-full min-h-0 flex flex-col">
  <div class="min-h-10 px-3 py-1.5 flex items-center justify-between gap-2 relative sticky top-0 z-10 glass-section-header">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      {#if $activeKeyTab}
        <span
          class="ui-subtle truncate max-w-[140px] hidden sm:inline"
          title={$activeKeyTab.connectionLabel}
        >
          {$activeKeyTab.connectionLabel}
        </span>
        <span class="ui-subtle">db{$activeKeyTab.db}</span>
        <span class="text-xs text-[var(--color-border)] hidden sm:inline">|</span>
      {/if}
      <span class="ui-key-badge {getTypeColorBg($keyInfo.key_type)}" title={$keyInfo.key_type}>{getTypeLabel($keyInfo.key_type)}</span>
      <span class="text-xs text-[var(--color-text-primary)] font-sans truncate min-w-0" title={$activeKey}>{$activeKey}</span>
      {#if $keyInfo.size_bytes !== null && $keyInfo.size_bytes !== undefined}
        <span class="text-[10px] text-[var(--color-text-muted)] tabular-nums shrink-0" title="Memory usage (MEMORY USAGE)">{formatBytes($keyInfo.size_bytes)}</span>
      {/if}
    </div>
    <div class="flex items-center gap-1 text-xs flex-wrap justify-end">
      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={handleRefresh} disabled={refreshing} title="Refresh value">
        <RotateCcw class="w-3.5 h-3.5 {refreshing ? 'animate-spin' : ''}" />
      </button>
      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => copyToClipboard($activeKey!)} title="Copy key name">
        <Copy class="w-3.5 h-3.5" />
      </button>
      <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={openInlineTtl}>
        <Clock class="w-3.5 h-3.5" />
        <span>TTL: {formatTtl(displayTtl)}</span>
      </button>
      <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={openInlineRename}>
        <Edit3 class="w-3.5 h-3.5" />
        <span>Rename</span>
      </button>
      <button class="ui-btn ui-btn-danger ui-btn-sm" onclick={handleDeleteKey}>
        <Trash2 class="w-3.5 h-3.5" />
        <span>Delete</span>
      </button>
    </div>

    {#if showInlineInput}
      <div class="absolute inset-0 flex items-center justify-center z-10 glass-inline-overlay">
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--color-text-tertiary)] font-sans">{inlineInputType === 'rename' ? 'Name' : 'TTL'}</span>
          <input
            bind:value={inlineInputValue}
            onkeydown={handleInlineKeydown}
            class="ui-input w-52"
          />
          <button class="ui-btn ui-btn-primary ui-btn-sm" onclick={handleInlineConfirm}>OK</button>
          <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={closeInlineInput}>Cancel</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex-1 min-h-0 px-4 pb-3 overflow-y-auto">
    <!-- String -->
    {#if $keyInfo.key_type === 'string' && typeof $keyValue === 'string'}
      {@const stringNumeric = parseAsNumber($keyValue)}
      <div class="space-y-4 pt-3">
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <div class="ui-segment">
                {#if isJson($keyValue)}
                  <button
                    class="ui-segment-item {jsonViewMode === 'format' ? 'ui-segment-item-active' : ''}"
                    onclick={() => jsonViewMode = 'format'}
                  >Format</button>
                {/if}
                <button
                  class="ui-segment-item {jsonViewMode === 'raw' ? 'ui-segment-item-active' : ''}"
                  onclick={() => jsonViewMode = 'raw'}
                >Raw</button>
                <button
                  class="ui-segment-item {jsonViewMode === 'hex' ? 'ui-segment-item-active' : ''}"
                  onclick={() => jsonViewMode = 'hex'}
                >Hex</button>
              </div>
              <span class="text-[10px] text-[var(--color-text-muted)] tabular-nums">{$keyValue.length} chars · {formatBytes(byteSize($keyValue))}</span>
              {#if stringNumeric !== null}
                <span class="text-[10px] text-[var(--color-text-tertiary)] tabular-nums" title="Value parses as a number">= {stringNumeric}</span>
              {/if}
            </div>
            <div class="flex items-center gap-1">
              {#if !isEditing}
                <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => copyToClipboard($keyValue as string)} title="Copy value">
                  <Copy class="w-3.5 h-3.5" />
                </button>
                <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={() => startEdit($keyValue as string)}>
                  <Pencil class="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              {/if}
            </div>
          </div>
          {#if isEditing}
            <textarea
              bind:value={editingValue}
              onkeydown={(e) => inlineEditKey(e, saveEdit, cancelEdit)}
              class="ui-input ui-input-mono min-h-40 max-h-[60vh] py-2 resize-y"
            ></textarea>
            <div class="flex items-center gap-2 mt-2">
              <Button variant="primary" size="sm" onclick={saveEdit}>Save</Button>
              <Button variant="ghost" size="sm" onclick={cancelEdit}>Cancel</Button>
              <span class="text-[10px] text-[var(--color-text-muted)] ml-auto">⌘↩ to save · Esc to cancel</span>
            </div>
          {:else}
            <pre class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-md p-4 font-mono text-xs text-[var(--color-text-primary)] whitespace-pre-wrap break-all w-full max-h-[60vh] overflow-auto">{@html getStringDisplay($keyValue)}</pre>
          {/if}
        </div>
      </div>

    <!-- Hash -->
    {:else if $keyInfo.key_type === 'hash' && Array.isArray($keyValue)}
      <div>
        <div class="sticky top-0 z-20 -mx-4 px-4 pt-3 pb-2 bg-[var(--color-glass-elevated)] backdrop-blur-md glass-subtle-divider-bottom">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
              {#if hashFilter}{hashFiltered.length} of {hashEntries.length}{:else}{hashEntries.length}{/if} fields
              <span class="text-[var(--color-text-muted)]">·</span>
              <span class="tabular-nums">{formatBytes(hashTotalBytes)}</span>
            </span>
            <div class="relative flex-1 min-w-[120px] max-w-[280px]">
              <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-tertiary)] pointer-events-none" />
              <input
                type="text"
                bind:value={hashFilter}
                placeholder="Filter field or value…"
                class="ui-input ui-input-sm pl-7"
              />
              {#if hashFilter}
                <button class="absolute right-1 top-1/2 -translate-y-1/2 ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => (hashFilter = '')} title="Clear filter">
                  <X class="w-3 h-3" />
                </button>
              {/if}
            </div>
            <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>+ Field</Button>
            {#if selectedHashFields.size > 0}
              <button class="ui-btn ui-btn-danger ui-btn-sm" onclick={handleBulkDeleteHash} title="Delete selected fields">
                <Trash2 class="w-3.5 h-3.5" />
                <span>Delete {selectedHashFields.size}</span>
              </button>
              <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={clearHashSelection} title="Clear selection">Clear</button>
            {/if}
          </div>
          {#if showAddForm}
            <div class="flex gap-2 px-3 py-2 mt-2 bg-[var(--color-surface-hover)] rounded-md">
              <input
                bind:value={newField}
                placeholder="Field"
                class="ui-input ui-input-mono flex-1"
                onkeydown={(e) => inlineEditKey(e, handleAddHashField, () => (showAddForm = false))}
              />
              <input
                bind:value={newValue}
                placeholder="Value"
                class="ui-input ui-input-mono flex-1"
                onkeydown={(e) => inlineEditKey(e, handleAddHashField, () => (showAddForm = false))}
              />
              <Button variant="primary" size="sm" onclick={handleAddHashField}>Add</Button>
              <Button variant="ghost" size="sm" onclick={() => (showAddForm = false)}>Cancel</Button>
            </div>
          {/if}
        </div>
        <table class="ui-data-table font-mono table-fixed mt-3">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-10">
                <input
                  type="checkbox"
                  class="h-3.5 w-3.5 accent-[var(--color-accent)] cursor-pointer"
                  checked={hashAllVisibleSelected}
                  indeterminate={hashAnyVisibleSelected && !hashAllVisibleSelected}
                  onchange={toggleSelectAllVisibleHash}
                  title="Select all visible"
                />
              </th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-20" aria-label="Actions"></th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-1/4">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
                  onclick={toggleHashSort}
                  title="Sort by field name"
                >
                  <span>Field</span>
                  {#if hashSortOrder === 'asc'}
                    <ArrowUpAZ class="w-3 h-3" />
                  {:else if hashSortOrder === 'desc'}
                    <ArrowDownAZ class="w-3 h-3" />
                  {:else}
                    <ArrowUpDown class="w-3 h-3 opacity-50" />
                  {/if}
                </button>
              </th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">Value</th>
            </tr>
          </thead>
          <tbody>
            {#each hashRows as item (item.field)}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] {selectedHashFields.has(item.field) ? 'bg-[var(--color-accent-subtle)]' : ''}">
                <td class="py-2.5 px-3 align-top">
                  <input
                    type="checkbox"
                    class="h-3.5 w-3.5 accent-[var(--color-accent)] cursor-pointer"
                    checked={selectedHashFields.has(item.field)}
                    onchange={() => toggleHashSelection(item.field)}
                  />
                </td>
                <td class="py-2.5 px-3 align-top">
                  <div class="flex gap-1">
                    {#if editingField !== item.field}
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => copyToClipboard(item.value)} title="Copy value">
                        <Copy class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => startEditHashField(item.field, item.value)} title="Edit">
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                    <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleDeleteHashField(item.field)} title="Delete">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] truncate align-top" title={item.field}>{item.field}</td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  {#if editingField === item.field}
                    <div class="flex gap-1 items-start">
                      <textarea
                        bind:value={editingValue}
                        onkeydown={(e) => inlineEditKey(e, saveHashFieldEdit, cancelHashFieldEdit)}
                        rows={Math.min(6, Math.max(1, editingValue.split('\n').length))}
                        class="ui-input ui-input-mono flex-1 resize-y h-auto min-h-8 py-1.5 leading-relaxed"
                      ></textarea>
                      <button class="ui-btn ui-btn-primary ui-btn-icon-sm" onclick={saveHashFieldEdit} title="Save (⌘↩)">
                        <Check class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cancelHashFieldEdit} title="Cancel (Esc)">
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  {:else}
                    {@const hashItemId = `${$activeKeyTab?.id ?? ''}:hash-${item.field}`}
                    {@const hashExpanded = expandedJsonItems.has(hashItemId)}
                    <div class="flex items-start gap-1.5 min-w-0">
                      {#if item.canExpand}
                        <button
                          class="ui-btn ui-btn-ghost ui-btn-icon-sm flex-shrink-0 mt-0.5"
                          onclick={() => toggleExpandedItem(hashItemId)}
                        >
                          {#if hashExpanded}
                            <ChevronDown class="w-3.5 h-3.5" />
                          {:else}
                            <ChevronRight class="w-3.5 h-3.5" />
                          {/if}
                        </button>
                      {/if}
                      {#if hashExpanded}
                        <pre class="p-2 bg-[var(--color-surface-hover)] rounded-md text-xs whitespace-pre-wrap break-all w-full max-h-[40vh] overflow-auto">{@html getFormatted(item.value, item.isJsonValue, item.display)}</pre>
                      {:else}
                        <span class="block min-w-0 flex-1 truncate" title={item.display}>{item.display}</span>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if hashSorted.length > RENDER_CAP}
          <div class="mt-2 px-3 py-2 text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-hover)] rounded-md text-center">
            Showing first {RENDER_CAP} of {hashSorted.length}. Use filter to narrow.
          </div>
        {/if}
      </div>

    <!-- List -->
    {:else if ($keyInfo.key_type === 'list') && Array.isArray($keyValue)}
      <div>
        <div class="sticky top-0 z-20 -mx-4 px-4 pt-3 pb-2 bg-[var(--color-glass-elevated)] backdrop-blur-md glass-subtle-divider-bottom">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
              {#if listFilter}{listFiltered.length} of {listEntries.length}{:else}{listEntries.length}{/if} items
              <span class="text-[var(--color-text-muted)]">·</span>
              <span class="tabular-nums">{formatBytes(listTotalBytes)}</span>
            </span>
            <div class="relative flex-1 min-w-[120px] max-w-[280px]">
              <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-tertiary)] pointer-events-none" />
              <input
                type="text"
                bind:value={listFilter}
                placeholder="Filter value…"
                class="ui-input ui-input-sm pl-7"
              />
              {#if listFilter}
                <button class="absolute right-1 top-1/2 -translate-y-1/2 ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => (listFilter = '')} title="Clear filter">
                  <X class="w-3 h-3" />
                </button>
              {/if}
            </div>
            <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>+ Item</Button>
          </div>
          {#if showAddForm}
            <div class="flex gap-2 px-3 py-2 mt-2 bg-[var(--color-surface-hover)] rounded-md items-center">
              <div class="ui-segment">
                <button class="ui-segment-item {!pushAtHead ? 'ui-segment-item-active' : ''}" onclick={() => (pushAtHead = false)} title="RPUSH — append to tail">Tail</button>
                <button class="ui-segment-item {pushAtHead ? 'ui-segment-item-active' : ''}" onclick={() => (pushAtHead = true)} title="LPUSH — prepend to head">Head</button>
              </div>
              <input
                bind:value={newValue}
                placeholder="Value"
                class="ui-input ui-input-mono flex-1"
                onkeydown={(e) => inlineEditKey(e, handleAddListItem, () => (showAddForm = false))}
              />
              <Button variant="primary" size="sm" onclick={handleAddListItem}>Add</Button>
              <Button variant="ghost" size="sm" onclick={() => (showAddForm = false)}>Cancel</Button>
            </div>
          {/if}
        </div>
        <table class="ui-data-table font-mono table-fixed mt-3">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-20" aria-label="Actions"></th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-14">#</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">Value</th>
            </tr>
          </thead>
          <tbody>
            {#each listRows as row (row.originalIndex)}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td class="py-2.5 px-3 align-top">
                  <div class="flex gap-1">
                    {#if editingIndex !== row.originalIndex}
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => copyToClipboard(row.value)} title="Copy value">
                        <Copy class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => startEditListItem(row.originalIndex, row.value)} title="Edit">
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                    <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleRemoveListItem(row.value)} title="Delete first match">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] font-medium tabular-nums align-top">
                  <span>{row.originalIndex}</span>
                  {#if row.duplicateCount > 1}
                    <span class="ml-1 text-[10px] text-[var(--color-text-tertiary)]" title="{row.duplicateCount} duplicates · trash button only removes the first match (LREM count=1)">×{row.duplicateCount}</span>
                  {/if}
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  {#if editingIndex === row.originalIndex}
                    <div class="flex gap-1 items-start">
                      <textarea
                        bind:value={editingValue}
                        onkeydown={(e) => inlineEditKey(e, saveListItemEdit, cancelListItemEdit)}
                        rows={Math.min(6, Math.max(1, editingValue.split('\n').length))}
                        class="ui-input ui-input-mono flex-1 resize-y h-auto min-h-8 py-1.5 leading-relaxed"
                      ></textarea>
                      <button class="ui-btn ui-btn-primary ui-btn-icon-sm" onclick={saveListItemEdit} title="Save (⌘↩)">
                        <Check class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cancelListItemEdit} title="Cancel (Esc)">
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  {:else}
                    {@const listItemId = `${$activeKeyTab?.id ?? ''}:list-${row.originalIndex}`}
                    {@const listExpanded = expandedJsonItems.has(listItemId)}
                    <div class="flex items-start gap-1.5 min-w-0">
                      {#if row.canExpand}
                        <button
                          class="ui-btn ui-btn-ghost ui-btn-icon-sm flex-shrink-0 mt-0.5"
                          onclick={() => toggleExpandedItem(listItemId)}
                        >
                          {#if listExpanded}
                            <ChevronDown class="w-3.5 h-3.5" />
                          {:else}
                            <ChevronRight class="w-3.5 h-3.5" />
                          {/if}
                        </button>
                      {/if}
                      {#if listExpanded}
                        <pre class="p-2 bg-[var(--color-surface-hover)] rounded-md text-xs whitespace-pre-wrap break-all w-full max-h-[40vh] overflow-auto">{@html getFormatted(row.value, row.isJsonValue, row.display)}</pre>
                      {:else}
                        <span class="block min-w-0 flex-1 truncate" title={row.display}>{row.display}</span>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if listFiltered.length > RENDER_CAP}
          <div class="mt-2 px-3 py-2 text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-hover)] rounded-md text-center">
            Showing first {RENDER_CAP} of {listFiltered.length}. Use filter to narrow.
          </div>
        {/if}
      </div>

    <!-- Set -->
    {:else if ($keyInfo.key_type === 'set') && Array.isArray($keyValue)}
      <div>
        <div class="sticky top-0 z-20 -mx-4 px-4 pt-3 pb-2 bg-[var(--color-glass-elevated)] backdrop-blur-md glass-subtle-divider-bottom">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
              {#if setFilter}{setFiltered.length} of {setEntries.length}{:else}{setEntries.length}{/if} members
              <span class="text-[var(--color-text-muted)]">·</span>
              <span class="tabular-nums">{formatBytes(setTotalBytes)}</span>
            </span>
            <div class="relative flex-1 min-w-[120px] max-w-[280px]">
              <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-tertiary)] pointer-events-none" />
              <input
                type="text"
                bind:value={setFilter}
                placeholder="Filter member…"
                class="ui-input ui-input-sm pl-7"
              />
              {#if setFilter}
                <button class="absolute right-1 top-1/2 -translate-y-1/2 ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => (setFilter = '')} title="Clear filter">
                  <X class="w-3 h-3" />
                </button>
              {/if}
            </div>
            <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>+ Member</Button>
          </div>
          {#if showAddForm}
            <div class="flex gap-2 px-3 py-2 mt-2 bg-[var(--color-surface-hover)] rounded-md">
              <input
                bind:value={newValue}
                placeholder="Member"
                class="ui-input ui-input-mono flex-1"
                onkeydown={(e) => inlineEditKey(e, handleAddSetMember, () => (showAddForm = false))}
              />
              <Button variant="primary" size="sm" onclick={handleAddSetMember}>Add</Button>
              <Button variant="ghost" size="sm" onclick={() => (showAddForm = false)}>Cancel</Button>
            </div>
          {/if}
        </div>
        <table class="ui-data-table font-mono table-fixed mt-3">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-20" aria-label="Actions"></th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
                  onclick={toggleSetSort}
                  title="Sort by member"
                >
                  <span>Member</span>
                  {#if setSortOrder === 'asc'}
                    <ArrowUpAZ class="w-3 h-3" />
                  {:else if setSortOrder === 'desc'}
                    <ArrowDownAZ class="w-3 h-3" />
                  {:else}
                    <ArrowUpDown class="w-3 h-3 opacity-50" />
                  {/if}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each setRows as row (row.idx + ':' + row.member.slice(0, 32))}
              {@const setItemId = `${$activeKeyTab?.id ?? ''}:set-${row.idx}`}
              {@const setExpanded = expandedJsonItems.has(setItemId)}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td class="py-2.5 px-3 align-top">
                  <div class="flex gap-1">
                    <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => copyToClipboard(row.member)} title="Copy member">
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                    <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleRemoveSetMember(row.member)} title="Delete">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  <div class="flex items-start gap-1.5 min-w-0">
                    {#if row.canExpand}
                      <button
                        class="ui-btn ui-btn-ghost ui-btn-icon-sm flex-shrink-0 mt-0.5"
                        onclick={() => toggleExpandedItem(setItemId)}
                      >
                        {#if setExpanded}
                          <ChevronDown class="w-3.5 h-3.5" />
                        {:else}
                          <ChevronRight class="w-3.5 h-3.5" />
                        {/if}
                      </button>
                    {/if}
                    {#if setExpanded}
                      <pre class="p-2 bg-[var(--color-surface-hover)] rounded-md text-xs whitespace-pre-wrap break-all w-full max-h-[40vh] overflow-auto">{@html getFormatted(row.member, row.isJsonValue, row.display)}</pre>
                    {:else}
                      <span class="block min-w-0 flex-1 truncate" title={row.display}>{row.display}</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if setSorted.length > RENDER_CAP}
          <div class="mt-2 px-3 py-2 text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-hover)] rounded-md text-center">
            Showing first {RENDER_CAP} of {setSorted.length}. Use filter to narrow.
          </div>
        {/if}
      </div>

    <!-- ZSet -->
    {:else if $keyInfo.key_type === 'zset' && Array.isArray($keyValue)}
      <div>
        <div class="sticky top-0 z-20 -mx-4 px-4 pt-3 pb-2 bg-[var(--color-glass-elevated)] backdrop-blur-md glass-subtle-divider-bottom">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
              {#if zsetFilter}{zsetFiltered.length} of {zsetEntries.length}{:else}{zsetEntries.length}{/if} members
              <span class="text-[var(--color-text-muted)]">·</span>
              <span class="tabular-nums">{formatBytes(zsetTotalBytes)}</span>
            </span>
            <div class="relative flex-1 min-w-[120px] max-w-[280px]">
              <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--color-text-tertiary)] pointer-events-none" />
              <input
                type="text"
                bind:value={zsetFilter}
                placeholder="Filter member or score…"
                class="ui-input ui-input-sm pl-7"
              />
              {#if zsetFilter}
                <button class="absolute right-1 top-1/2 -translate-y-1/2 ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => (zsetFilter = '')} title="Clear filter">
                  <X class="w-3 h-3" />
                </button>
              {/if}
            </div>
            <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>+ Member</Button>
          </div>
          {#if showAddForm}
            <div class="flex gap-2 px-3 py-2 mt-2 bg-[var(--color-surface-hover)] rounded-md">
              <input
                bind:value={newField}
                placeholder="Member"
                class="ui-input ui-input-mono flex-1"
                onkeydown={(e) => inlineEditKey(e, handleAddZSetMember, () => (showAddForm = false))}
              />
              <input
                bind:value={newScore}
                placeholder="Score"
                type="number"
                step="0.1"
                class="ui-input ui-input-mono w-24"
                onkeydown={(e) => inlineEditKey(e, handleAddZSetMember, () => (showAddForm = false))}
              />
              <Button variant="primary" size="sm" onclick={handleAddZSetMember}>Add</Button>
              <Button variant="ghost" size="sm" onclick={() => (showAddForm = false)}>Cancel</Button>
            </div>
          {/if}
        </div>
        <table class="ui-data-table font-mono table-fixed mt-3">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-20" aria-label="Actions"></th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-14">#</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">Member</th>
              <th class="text-right py-2 px-3 text-[var(--color-text-muted)] w-40">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
                  onclick={toggleZsetSort}
                  title="Sort by score"
                >
                  <span>Score</span>
                  {#if zsetSortOrder === 'asc'}
                    <ArrowUpAZ class="w-3 h-3" />
                  {:else if zsetSortOrder === 'desc'}
                    <ArrowDownAZ class="w-3 h-3" />
                  {:else}
                    <ArrowUpDown class="w-3 h-3 opacity-50" />
                  {/if}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each zsetRows as row (row.idx + ':' + row.member.slice(0, 32))}
              {@const zsetItemId = `${$activeKeyTab?.id ?? ''}:zset-${row.idx}`}
              {@const zsetExpanded = expandedJsonItems.has(zsetItemId)}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td class="py-2.5 px-3 align-top">
                  <div class="flex gap-1">
                    {#if editingField !== row.member}
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => copyToClipboard(row.member)} title="Copy member">
                        <Copy class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => startEditZSetMember(row.member, row.score)} title="Edit score (ZADD overwrite)">
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                    <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleDeleteZSetMember(row.member)} title="Delete">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-secondary)] font-medium tabular-nums align-top">{row.rank}</td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  <div class="flex items-start gap-1.5 min-w-0">
                    {#if row.canExpand}
                      <button
                        class="ui-btn ui-btn-ghost ui-btn-icon-sm flex-shrink-0 mt-0.5"
                        onclick={() => toggleExpandedItem(zsetItemId)}
                      >
                        {#if zsetExpanded}
                          <ChevronDown class="w-3.5 h-3.5" />
                        {:else}
                          <ChevronRight class="w-3.5 h-3.5" />
                        {/if}
                      </button>
                    {/if}
                    {#if zsetExpanded}
                      <pre class="p-2 bg-[var(--color-surface-hover)] rounded-md text-xs whitespace-pre-wrap break-all w-full max-h-[40vh] overflow-auto">{@html getFormatted(row.member, row.isJsonValue, row.display)}</pre>
                    {:else}
                      <span class="block min-w-0 flex-1 truncate" title={row.display}>{row.display}</span>
                    {/if}
                  </div>
                </td>
                <td class="py-2.5 px-3 text-right text-[var(--color-text-primary)] font-medium tabular-nums align-top">
                  {#if editingField === row.member}
                    <div class="flex gap-1 justify-end">
                      <input
                        bind:value={editingValue}
                        type="number"
                        step="0.1"
                        class="ui-input ui-input-mono w-24 text-right"
                        onkeydown={(e) => inlineEditKey(e, saveZSetMemberEdit, cancelZSetMemberEdit)}
                      />
                      <button class="ui-btn ui-btn-primary ui-btn-icon-sm" onclick={saveZSetMemberEdit} title="Save (↩)">
                        <Check class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cancelZSetMemberEdit} title="Cancel (Esc)">
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  {:else}
                    <button
                      class="block break-all leading-4 ml-auto hover:underline cursor-pointer"
                      title={`${row.score} · click to copy`}
                      onclick={() => copyToClipboard(String(row.score))}
                    >{formatScore(row.score)}</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if zsetFiltered.length > RENDER_CAP}
          <div class="mt-2 px-3 py-2 text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-hover)] rounded-md text-center">
            Showing first {RENDER_CAP} of {zsetFiltered.length}. Use filter to narrow.
          </div>
        {/if}
      </div>
    {/if}

  </div>
  </div>
{:else}
  <div class="h-full min-h-0 flex items-center justify-center">
    <div class="text-center">
      <div class="text-xs text-[var(--color-text-tertiary)]">Select a key to view details</div>
    </div>
  </div>
{/if}

<Confirm
  bind:open={showConfirm}
  title="Delete Key"
  message={confirmMessage}
  confirmText="Delete"
  danger={true}
  onconfirm={handleConfirm}
  oncancel={handleCancel}
/>
