<script lang="ts">
  import { keyInfo, keyValue, activeKey, activeKeyTab, detailConnectionId, setStringValue, setHashField, deleteHashField, pushListValue, setListValue, removeListValue, addSetMember, removeSetMember, addZSetMember, deleteZSetMember, deleteKey, renameKey, setKeyTtl } from '$lib/stores/database';
  import type { HashField, ZSetMember } from '$lib/types';
  import { getTypeColorText } from '$lib/utils/redisType';
  import { isJsonString, decodeUnicode, formatJson, isJson } from '$lib/utils/json';
  import Button from '$lib/components/common/Button.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';

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

  function toggleItemJson(id: string) {
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
  <div class="h-11 px-6 border-b border-[var(--color-border-divider)] flex items-center justify-between relative sticky top-0 z-10 bg-[var(--color-macos-surface)] shadow-sm">
    <div class="flex items-center gap-3 min-w-0 flex-wrap">
      {#if $activeKeyTab}
        <span
          class="text-xs text-[var(--color-text-muted)] font-mono truncate max-w-[140px]"
          title={$activeKeyTab.connectionLabel}
        >
          {$activeKeyTab.connectionLabel}
        </span>
        <span class="text-xs text-[var(--color-text-faint)] font-mono">db{$activeKeyTab.db}</span>
        <span class="text-[var(--color-border-divider)]">|</span>
      {/if}
      <span class="text-base text-[var(--color-info-text)] font-mono truncate">{$activeKey}</span>
      <span class="text-base font-mono {getTypeColorText($keyInfo.key_type)}">{$keyInfo.key_type}</span>
    </div>
    <div class="flex items-center gap-3 text-base">
      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={openInlineTtl}>
        ttl: {$keyInfo.ttl === -1 ? '∞' : $keyInfo.ttl + 's'}
      </button>
      <span class="text-[var(--color-border-divider)]">|</span>
      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={openInlineRename}>rename</button>
      <span class="text-[var(--color-border-divider)]">|</span>
      <button class="text-[var(--color-accent)] hover:text-[var(--color-accent-light)]" onclick={handleDeleteKey}>delete</button>
    </div>

    {#if showInlineInput}
      <div class="absolute inset-0 bg-[var(--color-macos-surface)]/95 backdrop-blur-sm flex items-center justify-center z-10">
        <div class="flex items-center gap-2">
          <span class="text-base text-[var(--color-text-muted)] font-mono">{inlineInputType === 'rename' ? 'name:' : 'ttl:'}</span>
          <input 
            bind:value={inlineInputValue}
            onkeydown={handleInlineKeydown}
            class="w-48 px-3 py-1.5 bg-[var(--color-macos-surface)] border border-[var(--color-accent)] rounded-lg text-base font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
          />
          <button class="px-3 py-1.5 text-base font-mono bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-light)]" onclick={handleInlineConfirm}>ok</button>
          <button class="px-3 py-1.5 text-base font-mono text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={closeInlineInput}>cancel</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex-1 p-6 overflow-y-auto">
    <!-- String -->
    {#if $keyInfo.key_type === 'string' && typeof $keyValue === 'string'}
      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              {#if isJson($keyValue)}
                <div class="flex items-center gap-1 bg-[var(--color-surface-code)] rounded px-1">
                  <button 
                    class="text-base px-2 py-0.5 rounded {jsonViewMode === 'raw' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]'}"
                    onclick={() => jsonViewMode = 'raw'}
                  >raw</button>
                  <button 
                    class="text-base px-2 py-0.5 rounded {jsonViewMode === 'format' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]'}"
                    onclick={() => jsonViewMode = 'format'}
                  >format</button>
                </div>
              {:else}
                <span class="text-base text-[var(--color-text-muted)]">value</span>
              {/if}
            </div>
            {#if !isEditing}
              <button class="text-base text-[var(--color-text-muted)] hover:text-[var(--color-accent)]" onclick={() => startEdit($keyValue as string)}>edit</button>
            {/if}
          </div>
          {#if isEditing}
            <textarea 
              bind:value={editingValue}
              class="w-full h-40 px-3 py-2 bg-[var(--color-surface-input)] border border-[var(--color-border-divider)] rounded text-base font-mono focus:outline-none focus:border-[var(--color-accent)]"
            ></textarea>
            <div class="flex gap-2 mt-2">
              <Button variant="primary" size="sm" onclick={saveEdit}>save</Button>
              <Button variant="ghost" size="sm" onclick={cancelEdit}>cancel</Button>
            </div>
          {:else}
            <pre class="bg-[var(--color-surface-code)] border border-[var(--color-border-divider)] rounded p-4 font-mono text-base text-[var(--color-info-text)] whitespace-pre-wrap break-all w-full">{getDisplayValue($keyValue)}</pre>
          {/if}
        </div>
      </div>

    <!-- Hash -->
    {:else if $keyInfo.key_type === 'hash' && Array.isArray($keyValue)}
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-base text-[var(--color-text-muted)]">{$keyValue.length} fields</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ field'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-code)] rounded">
            <input bind:value={newField} placeholder="field" class="flex-1 px-2 py-1.5 border border-[var(--color-border-divider)] rounded text-base font-mono" />
            <input bind:value={newValue} placeholder="value" class="flex-1 px-2 py-1.5 border border-[var(--color-border-divider)] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddHashField}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border-divider)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-1/4">field</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">value</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as HashField[]) as item}
              <tr class="border-b border-[var(--color-border-subtle)]">
                <td class="py-2.5 px-3">
                  <div class="flex gap-2">
                    {#if editingField !== item.field}
                      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={() => startEditHashField(item.field, item.value)}>✎</button>
                    {/if}
                    <button class="text-[var(--color-accent)] hover:text-[var(--color-accent-light)]" onclick={() => handleDeleteHashField(item.field)}>×</button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-info-text)] truncate">{item.field}</td>
                <td class="py-2.5 px-3 text-[var(--color-info-text)]">
                  {#if editingField === item.field}
                    <div class="flex gap-1">
                      <input bind:value={editingValue} class="flex-1 px-2 py-1 border border-[var(--color-border-divider)] rounded text-base font-mono" />
                      <button class="text-[var(--color-type-string)] hover:text-[var(--color-accent-light)]" onclick={saveHashFieldEdit}>✓</button>
                      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={cancelHashFieldEdit}>×</button>
                    </div>
                  {:else if isJson(item.value)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[var(--color-type-list)] hover:text-[var(--color-accent-light)] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`hash-${item.field}`)}
                      >{expandedJsonItems.has(`hash-${item.field}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`hash-${item.field}`)}
                        <pre class="p-2 bg-[var(--color-surface-code)] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item.value)}</pre>
                      {:else}
                        <span class="break-all">{getItemDisplayValue(item.value)}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="break-all">{getItemDisplayValue(item.value)}</span>
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
          <span class="text-base text-[var(--color-text-muted)]">{$keyValue.length} items</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ item'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-code)] rounded">
            <input bind:value={newValue} placeholder="value" class="flex-1 px-2 py-1.5 border border-[var(--color-border-divider)] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddListItem}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border-divider)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-14">#</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">value</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as string[]) as item, i}
              <tr class="border-b border-[var(--color-border-subtle)]">
                <td class="py-2.5 px-3">
                  <div class="flex gap-2">
                    {#if editingIndex !== i}
                      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={() => startEditListItem(i, item)}>✎</button>
                    {/if}
                    <button class="text-[var(--color-accent)] hover:text-[var(--color-accent-light)]" onclick={() => handleRemoveListItem(item)}>×</button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-text-faint)]">{i}</td>
                <td class="py-2.5 px-3 text-[var(--color-info-text)]">
                  {#if editingIndex === i}
                    <div class="flex gap-1">
                      <input bind:value={editingValue} class="flex-1 px-2 py-1 border border-[var(--color-border-divider)] rounded text-base font-mono" />
                      <button class="text-[var(--color-type-string)] hover:text-[var(--color-accent-light)]" onclick={saveListItemEdit}>✓</button>
                      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={cancelListItemEdit}>×</button>
                    </div>
                  {:else if isJson(item)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[var(--color-type-list)] hover:text-[var(--color-accent-light)] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`list-${i}`)}
                      >{expandedJsonItems.has(`list-${i}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`list-${i}`)}
                        <pre class="p-2 bg-[var(--color-surface-code)] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item)}</pre>
                      {:else}
                        <span class="break-all">{getItemDisplayValue(item)}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="break-all">{getItemDisplayValue(item)}</span>
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
          <span class="text-base text-[var(--color-text-muted)]">{$keyValue.length} members</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-code)] rounded">
            <input bind:value={newValue} placeholder="member" class="flex-1 px-2 py-1.5 border border-[var(--color-border-divider)] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddSetMember}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border-divider)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">member</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as string[]) as item, i}
              <tr class="border-b border-[var(--color-border-subtle)]">
                <td class="py-2.5 px-3">
                  <button class="text-[var(--color-accent)] hover:text-[var(--color-accent-light)]" onclick={() => handleRemoveSetMember(item)}>×</button>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-info-text)]">
                  {#if isJson(item)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[var(--color-type-list)] hover:text-[var(--color-accent-light)] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`set-${i}`)}
                      >{expandedJsonItems.has(`set-${i}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`set-${i}`)}
                        <pre class="p-2 bg-[var(--color-surface-code)] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item)}</pre>
                      {:else}
                        <span class="break-all">{getItemDisplayValue(item)}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="break-all">{getItemDisplayValue(item)}</span>
                  {/if}
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
          <span class="text-base text-[var(--color-text-muted)]">{$keyValue.length} members</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[var(--color-surface-code)] rounded">
            <input bind:value={newField} placeholder="member" class="flex-1 px-2 py-1.5 border border-[var(--color-border-divider)] rounded text-base font-mono" />
            <input bind:value={newScore} placeholder="score" type="number" step="0.1" class="w-20 px-2 py-1.5 border border-[var(--color-border-divider)] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddZSetMember}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[var(--color-border-divider)]">
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)] w-16">act</th>
              <th class="text-left py-2 px-3 text-[var(--color-text-muted)]">member</th>
              <th class="text-right py-2 px-3 text-[var(--color-text-muted)] w-24">score</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as ZSetMember[]) as item, i}
              <tr class="border-b border-[var(--color-border-subtle)]">
                <td class="py-2.5 px-3">
                  <div class="flex gap-2">
                    {#if editingField !== item.member}
                      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={() => startEditZSetMember(item.member, item.score)}>✎</button>
                    {/if}
                    <button class="text-[var(--color-accent)] hover:text-[var(--color-accent-light)]" onclick={() => handleDeleteZSetMember(item.member)}>×</button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[var(--color-info-text)]">
                  {#if isJson(item.member)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[var(--color-type-list)] hover:text-[var(--color-accent-light)] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`zset-${i}`)}
                      >{expandedJsonItems.has(`zset-${i}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`zset-${i}`)}
                        <pre class="p-2 bg-[var(--color-surface-code)] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item.member)}</pre>
                      {:else}
                        <span class="break-all">{getItemDisplayValue(item.member)}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="break-all">{getItemDisplayValue(item.member)}</span>
                  {/if}
                </td>
                <td class="py-2.5 px-3 text-right text-[var(--color-text-muted)]">
                  {#if editingField === item.member}
                    <div class="flex gap-1 justify-end">
                      <input bind:value={editingValue} type="number" step="0.1" class="w-16 px-1.5 py-0.5 border border-[var(--color-border-divider)] rounded text-base font-mono text-right" />
                      <button class="text-[var(--color-type-string)] hover:text-[var(--color-accent-light)]" onclick={saveZSetMemberEdit}>✓</button>
                      <button class="text-[var(--color-text-muted)] hover:text-[var(--color-info-text)]" onclick={cancelZSetMemberEdit}>×</button>
                    </div>
                  {:else}
                    {item.score}
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if error}
      <div class="fixed bottom-4 right-4 bg-[var(--color-accent)] text-white px-4 py-2 rounded text-base font-mono shadow-lg">
        {error}
      </div>
    {/if}
  </div>
{:else}
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center">
      <div class="text-base text-[var(--color-text-faint)]">select a key to view details</div>
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
