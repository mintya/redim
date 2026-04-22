<script lang="ts">
  import { keyInfo, keyValue, activeKey, activeKeyTab, detailConnectionId, setStringValue, setHashField, deleteHashField, pushListValue, setListValue, removeListValue, addSetMember, removeSetMember, addZSetMember, deleteZSetMember, deleteKey, renameKey, setKeyTtl } from '$lib/stores/database';
  import type { HashField, ZSetMember } from '$lib/types';
  import { getTypeColorText } from '$lib/utils/redisType';
  import { isJsonString, decodeUnicode, formatJson, isJson } from '$lib/utils/json';
  import Button from '$lib/components/common/Button.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';
  import { Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Clock, Edit3 } from '@lucide/svelte';

  let editingValue = $state('');
  let isEditing = $state(false);
  let editingIndex = $state(-1);
  let editingField = $state('');
  let newField = $state('');
  let newValue = $state('');
  let newScore = $state('0');
  let showAddForm = $state(false);
  let error = $state('');
  let showConfirm = $state(false);
  let confirmMessage = $state('');
  let confirmAction = $state<(() => void) | null>(null);
  let jsonViewMode = $state<'raw' | 'format'>('format');
  let expandedJsonItems = $state<Set<string>>(new Set());
  let showInlineInput = $state(false);
  let inlineInputType = $state<'rename' | 'ttl'>('rename');
  let inlineInputValue = $state('');
  const TABLE_VALUE_EXPAND_THRESHOLD = 120;

  function toggleExpandedItem(id: string) {
    if (expandedJsonItems.has(id)) {
      expandedJsonItems.delete(id);
    } else {
      expandedJsonItems.add(id);
    }
    expandedJsonItems = new Set(expandedJsonItems);
  }

  function clearError() {
    error = '';
  }

  function showError(msg: string) {
    error = msg;
    setTimeout(() => error = '', 5000);
  }

  function getDisplayValue(value: string): string {
    if (isJsonString(value)) {
      if (jsonViewMode === 'format') {
        return formatJson(value);
      }
      return decodeUnicode(value);
    }
    return decodeUnicode(value);
  }

  function toggleJsonView() {
    jsonViewMode = jsonViewMode === 'raw' ? 'format' : 'raw';
  }

  function getItemDisplayValue(value: string): string {
    return decodeUnicode(value);
  }

  function getItemFormatValue(value: string): string {
    if (isJsonString(value)) {
      return formatJson(value);
    }
    return decodeUnicode(value);
  }

  function shouldTruncateValue(value: string): boolean {
    return value.length > TABLE_VALUE_EXPAND_THRESHOLD || value.includes('\n');
  }

  function canExpandTableValue(rawValue: string): boolean {
    const displayValue = getItemDisplayValue(rawValue);
    return isJson(rawValue) || shouldTruncateValue(displayValue);
  }


  function startEdit(value: string) {
    editingValue = value;
    isEditing = true;
  }

  async function saveEdit() {
    clearError();
    if ($detailConnectionId && $activeKey && $keyInfo?.key_type === 'string') {
      const success = await setStringValue($detailConnectionId, $activeKey, editingValue);
      if (success) {
        isEditing = false;
      } else {
        showError('Failed to save value');
      }
    }
  }

  function cancelEdit() {
    isEditing = false;
    editingValue = '';
  }

  function handleDeleteKey() {
    clearError();
    if ($detailConnectionId && $activeKey) {
      confirmMessage = `Are you sure you want to delete key: ${$activeKey}?`;
      confirmAction = async () => {
        const success = await deleteKey($detailConnectionId!, $activeKey!);
        if (!success) {
          showError('Failed to delete key');
        }
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

  async function handleRename() {
    clearError();
    if ($detailConnectionId && $activeKey) {
      const newKey = prompt('Enter new key name:', $activeKey);
      if (newKey && newKey !== $activeKey) {
        const success = await renameKey($detailConnectionId, $activeKey, newKey);
        if (!success) {
          showError('Failed to rename key');
        }
      }
    }
  }

  async function handleSetTtl() {
    clearError();
    if ($detailConnectionId && $activeKey) {
      const ttl = prompt('Enter TTL in seconds (-1 for no expiry):', String($keyInfo?.ttl || -1));
      if (ttl !== null) {
        const success = await setKeyTtl($detailConnectionId, $activeKey, parseInt(ttl));
        if (!success) {
          showError('Failed to set TTL');
        }
      }
    }
  }

  async function handleAddHashField() {
    clearError();
    if ($detailConnectionId && $activeKey && newField && newValue) {
      const success = await setHashField($detailConnectionId, $activeKey, newField, newValue);
      if (success) {
        newField = '';
        newValue = '';
        showAddForm = false;
      } else {
        showError('Failed to add hash field');
      }
    }
  }

  async function handleDeleteHashField(field: string) {
    clearError();
    if ($detailConnectionId && $activeKey) {
      const success = await deleteHashField($detailConnectionId, $activeKey, field);
      if (!success) {
        showError('Failed to delete hash field');
      }
    }
  }

  async function handleAddListItem() {
    clearError();
    if ($detailConnectionId && $activeKey && newValue) {
      const success = await pushListValue($detailConnectionId, $activeKey, newValue, true);
      if (success) {
        newValue = '';
        showAddForm = false;
      } else {
        showError('Failed to add list item');
      }
    }
  }

  async function handleAddSetMember() {
    clearError();
    if ($detailConnectionId && $activeKey && newValue) {
      const success = await addSetMember($detailConnectionId, $activeKey, newValue);
      if (success) {
        newValue = '';
        showAddForm = false;
      } else {
        showError('Failed to add set member');
      }
    }
  }

  async function handleRemoveSetMember(member: string) {
    clearError();
    if ($detailConnectionId && $activeKey) {
      const success = await removeSetMember($detailConnectionId, $activeKey, member);
      if (!success) {
        showError('Failed to remove set member');
      }
    }
  }

  async function handleAddZSetMember() {
    clearError();
    if ($detailConnectionId && $activeKey && newField) {
      const score = parseFloat(newScore);
      if (isNaN(score)) {
        showError('Invalid score value');
        return;
      }
      const success = await addZSetMember($detailConnectionId, $activeKey, newField, score);
      if (success) {
        newField = '';
        newScore = '0';
        showAddForm = false;
      } else {
        showError('Failed to add zset member');
      }
    }
  }

  async function handleDeleteZSetMember(member: string) {
    clearError();
    if ($detailConnectionId && $activeKey) {
      const success = await deleteZSetMember($detailConnectionId, $activeKey, member);
      if (!success) {
        showError('Failed to delete zset member');
      }
    }
  }

  function startEditListItem(index: number, value: string) {
    editingIndex = index;
    editingValue = value;
  }

  async function saveListItemEdit() {
    clearError();
    if ($detailConnectionId && $activeKey && editingIndex >= 0) {
      const success = await setListValue($detailConnectionId, $activeKey, editingIndex, editingValue);
      if (success) {
        editingIndex = -1;
        editingValue = '';
      } else {
        showError('Failed to save list item');
      }
    }
  }

  function cancelListItemEdit() {
    editingIndex = -1;
    editingValue = '';
  }

  async function handleRemoveListItem(value: string) {
    clearError();
    if ($detailConnectionId && $activeKey) {
      const success = await removeListValue($detailConnectionId, $activeKey, value, 1);
      if (!success) {
        showError('Failed to remove list item');
      }
    }
  }

  function startEditHashField(field: string, value: string) {
    editingField = field;
    editingValue = value;
  }

  async function saveHashFieldEdit() {
    clearError();
    if ($detailConnectionId && $activeKey && editingField) {
      const success = await setHashField($detailConnectionId, $activeKey, editingField, editingValue);
      if (success) {
        editingField = '';
        editingValue = '';
      } else {
        showError('Failed to save hash field');
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
    clearError();
    if ($detailConnectionId && $activeKey && editingField) {
      const score = parseFloat(editingValue);
      if (isNaN(score)) {
        showError('Invalid score value');
        return;
      }
      const success = await addZSetMember($detailConnectionId, $activeKey, editingField, score);
      if (success) {
        editingField = '';
        editingValue = '';
      } else {
        showError('Failed to save zset member');
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
    clearError();
    if (!$detailConnectionId || !$activeKey) return;
    if (inlineInputType === 'rename') {
      if (inlineInputValue && inlineInputValue !== $activeKey) {
        const success = await renameKey($detailConnectionId, $activeKey, inlineInputValue);
        if (!success) showError('Failed to rename key');
      }
    } else if (inlineInputType === 'ttl') {
      const ttl = parseInt(inlineInputValue);
      if (!isNaN(ttl)) {
        const success = await setKeyTtl($detailConnectionId, $activeKey, ttl);
        if (!success) showError('Failed to set TTL');
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
  <div class="min-h-10 px-3 py-1.5 border-b border-[var(--color-border)] flex items-center justify-between gap-2 relative sticky top-0 z-10 bg-[var(--color-surface)]">
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
      <span class="text-xs text-[var(--color-text-primary)] font-sans truncate min-w-0">{$activeKey}</span>
      <span class="text-xs font-sans {getTypeColorText($keyInfo.key_type)}">{$keyInfo.key_type}</span>
    </div>
    <div class="flex items-center gap-1 text-xs flex-wrap justify-end">
      <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={openInlineTtl}>
        <Clock class="w-3.5 h-3.5" />
        <span>ttl: {$keyInfo.ttl === -1 ? '∞' : $keyInfo.ttl + 's'}</span>
      </button>
      <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={openInlineRename}>
        <Edit3 class="w-3.5 h-3.5" />
        <span>rename</span>
      </button>
      <button class="ui-btn ui-btn-danger ui-btn-sm" onclick={handleDeleteKey}>
        <Trash2 class="w-3.5 h-3.5" />
        <span>delete</span>
      </button>
    </div>

    {#if showInlineInput}
      <div class="absolute inset-0 bg-[var(--color-surface)]/95 backdrop-blur-sm flex items-center justify-center z-10">
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--color-text-tertiary)] font-sans">{inlineInputType === 'rename' ? 'name:' : 'ttl:'}</span>
          <input 
            bind:value={inlineInputValue}
            onkeydown={handleInlineKeydown}
            class="ui-input w-52"
          />
          <button class="ui-btn ui-btn-primary ui-btn-sm" onclick={handleInlineConfirm}>ok</button>
          <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={closeInlineInput}>cancel</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex-1 min-h-0 px-4 py-3 overflow-y-auto bg-[var(--color-bg-surface)]">
    <!-- String -->
    {#if $keyInfo.key_type === 'string' && typeof $keyValue === 'string'}
      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              {#if isJson($keyValue)}
                <div class="ui-segment">
                  <button 
                    class="ui-segment-item {jsonViewMode === 'raw' ? 'ui-segment-item-active' : ''}"
                    onclick={() => jsonViewMode = 'raw'}
                  >raw</button>
                  <button 
                    class="ui-segment-item {jsonViewMode === 'format' ? 'ui-segment-item-active' : ''}"
                    onclick={() => jsonViewMode = 'format'}
                  >format</button>
                </div>
              {:else}
                <span class="text-xs text-[var(--color-text-tertiary)]">value</span>
              {/if}
            </div>
            {#if !isEditing}
              <button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={() => startEdit($keyValue as string)}>
                <Pencil class="w-3.5 h-3.5" />
                <span>edit</span>
              </button>
            {/if}
          </div>
          {#if isEditing}
            <textarea 
              bind:value={editingValue}
              class="ui-input ui-input-mono h-40 py-2 resize-y"
            ></textarea>
            <div class="flex gap-2 mt-2">
              <Button variant="primary" size="sm" onclick={saveEdit}>save</Button>
              <Button variant="ghost" size="sm" onclick={cancelEdit}>cancel</Button>
            </div>
          {:else}
            <pre class="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded p-4 font-mono text-xs text-[var(--color-text-primary)] whitespace-pre-wrap break-all w-full">{getDisplayValue($keyValue)}</pre>
          {/if}
        </div>
      </div>

    <!-- Hash -->
    {:else if $keyInfo.key_type === 'hash' && Array.isArray($keyValue)}
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-tertiary)]">{$keyValue.length} fields</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ field'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-hover)] rounded">
            <input bind:value={newField} placeholder="field" class="ui-input ui-input-mono flex-1" />
            <input bind:value={newValue} placeholder="value" class="ui-input ui-input-mono flex-1" />
            <Button variant="primary" size="sm" onclick={handleAddHashField}>add</Button>
          </div>
        {/if}
        <table class="ui-data-table font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-1/4">field</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">value</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as HashField[]) as item}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td class="py-2.5 px-3 align-top">
                  <div class="flex gap-2">
                    {#if editingField !== item.field}
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => startEditHashField(item.field, item.value)}>
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                    <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleDeleteHashField(item.field)}>
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] truncate align-top">{item.field}</td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  {#if editingField === item.field}
                    <div class="flex gap-1">
                      <input bind:value={editingValue} class="ui-input ui-input-mono flex-1" />
                      <button class="ui-btn ui-btn-primary ui-btn-icon-sm" onclick={saveHashFieldEdit}>
                        <Check class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cancelHashFieldEdit}>
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  {:else}
                    {@const hashItemId = `hash-${item.field}`}
                    {@const hashDisplay = getItemDisplayValue(item.value)}
                    {@const hashExpanded = expandedJsonItems.has(hashItemId)}
                    {@const hashCanExpand = canExpandTableValue(item.value)}
                    <div class="flex items-start gap-1.5 min-w-0">
                      {#if hashCanExpand}
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
                        {#if isJson(item.value)}
                          <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{getItemFormatValue(item.value)}</pre>
                        {:else}
                          <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{hashDisplay}</pre>
                        {/if}
                      {:else}
                        <span class="block min-w-0 flex-1 truncate" title={hashDisplay}>{hashDisplay}</span>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- List -->
    {:else if ($keyInfo.key_type === 'list') && Array.isArray($keyValue)}
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-tertiary)]">{$keyValue.length} items</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ item'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-hover)] rounded">
            <input bind:value={newValue} placeholder="value" class="ui-input ui-input-mono flex-1" />
            <Button variant="primary" size="sm" onclick={handleAddListItem}>add</Button>
          </div>
        {/if}
        <table class="ui-data-table font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-14">#</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">value</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as string[]) as item, i}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td class="py-2.5 px-3 align-top">
                  <div class="flex gap-2">
                    {#if editingIndex !== i}
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => startEditListItem(i, item)}>
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                    <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleRemoveListItem(item)}>
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-muted)] align-top">{i}</td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  {#if editingIndex === i}
                    <div class="flex gap-1">
                      <input bind:value={editingValue} class="ui-input ui-input-mono flex-1" />
                      <button class="ui-btn ui-btn-primary ui-btn-icon-sm" onclick={saveListItemEdit}>
                        <Check class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cancelListItemEdit}>
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  {:else}
                    {@const listItemId = `list-${i}`}
                    {@const listDisplay = getItemDisplayValue(item)}
                    {@const listExpanded = expandedJsonItems.has(listItemId)}
                    {@const listCanExpand = canExpandTableValue(item)}
                    <div class="flex items-start gap-1.5 min-w-0">
                      {#if listCanExpand}
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
                        {#if isJson(item)}
                          <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{getItemFormatValue(item)}</pre>
                        {:else}
                          <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{listDisplay}</pre>
                        {/if}
                      {:else}
                        <span class="block min-w-0 flex-1 truncate" title={listDisplay}>{listDisplay}</span>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- Set -->
    {:else if ($keyInfo.key_type === 'set') && Array.isArray($keyValue)}
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-tertiary)]">{$keyValue.length} members</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-hover)] rounded">
            <input bind:value={newValue} placeholder="member" class="ui-input ui-input-mono flex-1" />
            <Button variant="primary" size="sm" onclick={handleAddSetMember}>add</Button>
          </div>
        {/if}
        <table class="ui-data-table font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">member</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as string[]) as item, i}
              {@const setItemId = `set-${i}`}
              {@const setDisplay = getItemDisplayValue(item)}
              {@const setExpanded = expandedJsonItems.has(setItemId)}
              {@const setCanExpand = canExpandTableValue(item)}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td class="py-2.5 px-3 align-top">
                  <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleRemoveSetMember(item)}>
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  <div class="flex items-start gap-1.5 min-w-0">
                    {#if setCanExpand}
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
                      {#if isJson(item)}
                        <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{getItemFormatValue(item)}</pre>
                      {:else}
                        <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{setDisplay}</pre>
                      {/if}
                    {:else}
                      <span class="block min-w-0 flex-1 truncate" title={setDisplay}>{setDisplay}</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- ZSet -->
    {:else if $keyInfo.key_type === 'zset' && Array.isArray($keyValue)}
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-[var(--color-text-tertiary)]">{$keyValue.length} members</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-hover)] rounded">
            <input bind:value={newField} placeholder="member" class="ui-input ui-input-mono flex-1" />
            <input bind:value={newScore} placeholder="score" type="number" step="0.1" class="ui-input ui-input-mono w-24" />
            <Button variant="primary" size="sm" onclick={handleAddZSetMember}>add</Button>
          </div>
        {/if}
        <table class="ui-data-table font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">member</th>
              <th class="text-right py-2 px-3 text-[var(--color-text-muted)] w-40">score</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as ZSetMember[]) as item, i}
              {@const zsetItemId = `zset-${i}`}
              {@const zsetDisplay = getItemDisplayValue(item.member)}
              {@const zsetExpanded = expandedJsonItems.has(zsetItemId)}
              {@const zsetCanExpand = canExpandTableValue(item.member)}
              <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                <td class="py-2.5 px-3 align-top">
                  <div class="flex gap-2">
                    {#if editingField !== item.member}
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={() => startEditZSetMember(item.member, item.score)}>
                        <Pencil class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                    <button class="ui-btn ui-btn-danger ui-btn-icon-sm" onclick={() => handleDeleteZSetMember(item.member)}>
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-primary)] align-top">
                  <div class="flex items-start gap-1.5 min-w-0">
                    {#if zsetCanExpand}
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
                      {#if isJson(item.member)}
                        <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{getItemFormatValue(item.member)}</pre>
                      {:else}
                        <pre class="p-2 bg-[var(--color-surface-hover)] rounded text-xs whitespace-pre-wrap break-all w-full">{zsetDisplay}</pre>
                      {/if}
                    {:else}
                      <span class="block min-w-0 flex-1 truncate" title={zsetDisplay}>{zsetDisplay}</span>
                    {/if}
                  </div>
                </td>
                <td class="py-2.5 px-3 text-right text-[var(--color-text-muted)] align-top">
                  {#if editingField === item.member}
                    <div class="flex gap-1 justify-end">
                      <input bind:value={editingValue} type="number" step="0.1" class="ui-input ui-input-mono w-20 text-right" />
                      <button class="ui-btn ui-btn-primary ui-btn-icon-sm" onclick={saveZSetMemberEdit}>
                        <Check class="w-3.5 h-3.5" />
                      </button>
                      <button class="ui-btn ui-btn-ghost ui-btn-icon-sm" onclick={cancelZSetMemberEdit}>
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  {:else}
                    <span class="block break-all leading-4" title={String(item.score)}>{item.score}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if error}
      <div class="fixed bottom-4 right-4 bg-[var(--color-text-primary)] text-[var(--color-surface)] px-4 py-2 rounded text-xs font-sans shadow-lg">
        {error}
      </div>
    {/if}
  </div>
  </div>
{:else}
  <div class="h-full min-h-0 flex items-center justify-center">
    <div class="text-center">
      <div class="text-xs text-[var(--color-text-tertiary)]">select a key to view details</div>
    </div>
  </div>
{/if}

<Confirm 
  bind:open={showConfirm}
  title="delete key"
  message={confirmMessage}
  confirmText="delete"
  danger={true}
  onconfirm={handleConfirm}
  oncancel={handleCancel}
/>
