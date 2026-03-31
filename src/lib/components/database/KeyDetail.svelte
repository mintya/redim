<script lang="ts">
  import { keyInfo, keyValue, activeKey, setStringValue, setHashField, deleteHashField, pushListValue, setListValue, removeListValue, addSetMember, removeSetMember, addZSetMember, deleteZSetMember, deleteKey, renameKey, setKeyTtl } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';
  import type { HashField, ZSetMember } from '$lib/types';
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
    setTimeout(() => error = '', 3000);
  }

  function isJsonString(str: string): boolean {
    try {
      const parsed = JSON.parse(str);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  function decodeUnicode(str: string): string {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function formatJson(str: string): string {
    try {
      const parsed = JSON.parse(str);
      const formatted = JSON.stringify(parsed, null, 2);
      return decodeUnicode(formatted);
    } catch {
      return str;
    }
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

  function isJson(value: string): boolean {
    return isJsonString(value);
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

  function getTypeColor(type: string) {
    const colors: Record<string, string> = {
      string: 'text-[#28c840]',
      hash: 'text-[#ff9f43]',
      list: 'text-[#5f9eff]',
      set: 'text-[#a55eea]',
      zset: 'text-[#eb3b5a]',
    };
    return colors[type] || 'text-[#6b6b6b]';
  }

  function startEdit(value: string) {
    editingValue = value;
    isEditing = true;
  }

  async function saveEdit() {
    clearError();
    if ($activeConnectionId && $activeKey && $keyInfo?.key_type === 'string') {
      const success = await setStringValue($activeConnectionId, $activeKey, editingValue);
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
    if ($activeConnectionId && $activeKey) {
      confirmMessage = `Are you sure you want to delete key: ${$activeKey}?`;
      confirmAction = async () => {
        const success = await deleteKey($activeConnectionId!, $activeKey!);
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
    if ($activeConnectionId && $activeKey) {
      const newKey = prompt('Enter new key name:', $activeKey);
      if (newKey && newKey !== $activeKey) {
        const success = await renameKey($activeConnectionId, $activeKey, newKey);
        if (!success) {
          showError('Failed to rename key');
        }
      }
    }
  }

  async function handleSetTtl() {
    clearError();
    if ($activeConnectionId && $activeKey) {
      const ttl = prompt('Enter TTL in seconds (-1 for no expiry):', String($keyInfo?.ttl || -1));
      if (ttl !== null) {
        const success = await setKeyTtl($activeConnectionId, $activeKey, parseInt(ttl));
        if (!success) {
          showError('Failed to set TTL');
        }
      }
    }
  }

  async function handleAddHashField() {
    clearError();
    if ($activeConnectionId && $activeKey && newField && newValue) {
      const success = await setHashField($activeConnectionId, $activeKey, newField, newValue);
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
    if ($activeConnectionId && $activeKey) {
      const success = await deleteHashField($activeConnectionId, $activeKey, field);
      if (!success) {
        showError('Failed to delete hash field');
      }
    }
  }

  async function handleAddListItem() {
    clearError();
    if ($activeConnectionId && $activeKey && newValue) {
      const success = await pushListValue($activeConnectionId, $activeKey, newValue, true);
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
    if ($activeConnectionId && $activeKey && newValue) {
      const success = await addSetMember($activeConnectionId, $activeKey, newValue);
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
    if ($activeConnectionId && $activeKey) {
      const success = await removeSetMember($activeConnectionId, $activeKey, member);
      if (!success) {
        showError('Failed to remove set member');
      }
    }
  }

  async function handleAddZSetMember() {
    clearError();
    if ($activeConnectionId && $activeKey && newField) {
      const score = parseFloat(newScore);
      if (isNaN(score)) {
        showError('Invalid score value');
        return;
      }
      const success = await addZSetMember($activeConnectionId, $activeKey, newField, score);
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
    if ($activeConnectionId && $activeKey) {
      const success = await deleteZSetMember($activeConnectionId, $activeKey, member);
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
    if ($activeConnectionId && $activeKey && editingIndex >= 0) {
      const success = await setListValue($activeConnectionId, $activeKey, editingIndex, editingValue);
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
    if ($activeConnectionId && $activeKey) {
      const success = await removeListValue($activeConnectionId, $activeKey, value, 1);
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
    if ($activeConnectionId && $activeKey && editingField) {
      const success = await setHashField($activeConnectionId, $activeKey, editingField, editingValue);
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
    if ($activeConnectionId && $activeKey && editingField) {
      const score = parseFloat(editingValue);
      if (isNaN(score)) {
        showError('Invalid score value');
        return;
      }
      const success = await addZSetMember($activeConnectionId, $activeKey, editingField, score);
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
</script>

{#if $keyInfo && $activeKey}
  <div class="h-11 px-6 border-b border-[#d4d4d4] flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="text-base text-[#1a1a1a] font-mono">{$activeKey}</span>
      <span class="text-base font-mono {getTypeColor($keyInfo.key_type)}">{$keyInfo.key_type}</span>
    </div>
    <div class="flex items-center gap-3 text-base">
      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={handleSetTtl}>
        ttl: {$keyInfo.ttl === -1 ? '∞' : $keyInfo.ttl + 's'}
      </button>
      <span class="text-[#d4d4d4]">|</span>
      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={handleRename}>rename</button>
      <span class="text-[#d4d4d4]">|</span>
      <button class="text-[#dc382d] hover:text-[#e85d54]" onclick={handleDeleteKey}>delete</button>
    </div>
  </div>

  <div class="flex-1 p-6 overflow-y-auto">
    <!-- String -->
    {#if $keyInfo.key_type === 'string' && typeof $keyValue === 'string'}
      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              {#if isJson($keyValue)}
                <div class="flex items-center gap-1 bg-[#f0f0f0] rounded px-1">
                  <button 
                    class="text-base px-2 py-0.5 rounded {jsonViewMode === 'raw' ? 'bg-[#dc382d] text-white' : 'text-[#6b6b6b] hover:text-[#1a1a1a]'}"
                    onclick={() => jsonViewMode = 'raw'}
                  >raw</button>
                  <button 
                    class="text-base px-2 py-0.5 rounded {jsonViewMode === 'format' ? 'bg-[#dc382d] text-white' : 'text-[#6b6b6b] hover:text-[#1a1a1a]'}"
                    onclick={() => jsonViewMode = 'format'}
                  >format</button>
                </div>
              {:else}
                <span class="text-base text-[#6b6b6b]">value</span>
              {/if}
            </div>
            {#if !isEditing}
              <button class="text-base text-[#6b6b6b] hover:text-[#dc382d]" onclick={() => startEdit($keyValue as string)}>edit</button>
            {/if}
          </div>
          {#if isEditing}
            <textarea 
              bind:value={editingValue}
              class="w-full h-40 px-3 py-2 bg-[#fafafa] border border-[#d4d4d4] rounded text-base font-mono focus:outline-none focus:border-[#dc382d]"
            ></textarea>
            <div class="flex gap-2 mt-2">
              <Button variant="primary" size="sm" onclick={saveEdit}>save</Button>
              <Button variant="ghost" size="sm" onclick={cancelEdit}>cancel</Button>
            </div>
          {:else}
            <pre class="bg-[#f0f0f0] border border-[#d4d4d4] rounded p-4 font-mono text-base text-[#1a1a1a] whitespace-pre-wrap break-all w-full">{getDisplayValue($keyValue)}</pre>
          {/if}
        </div>
      </div>

    <!-- Hash -->
    {:else if $keyInfo.key_type === 'hash' && Array.isArray($keyValue)}
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-base text-[#6b6b6b]">{$keyValue.length} fields</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ field'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[#f0f0f0] rounded">
            <input bind:value={newField} placeholder="field" class="flex-1 px-2 py-1.5 border border-[#d4d4d4] rounded text-base font-mono" />
            <input bind:value={newValue} placeholder="value" class="flex-1 px-2 py-1.5 border border-[#d4d4d4] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddHashField}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[#d4d4d4]">
              <th class="text-left py-2 px-3 text-[#6b6b6b] w-16">act</th>
              <th class="text-left py-2 px-3 text-[#6b6b6b] w-1/4">field</th>
              <th class="text-left py-2 px-3 text-[#6b6b6b]">value</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as HashField[]) as item}
              <tr class="border-b border-[#e5e5e5]">
                <td class="py-2.5 px-3">
                  <div class="flex gap-2">
                    {#if editingField !== item.field}
                      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={() => startEditHashField(item.field, item.value)}>✎</button>
                    {/if}
                    <button class="text-[#dc382d] hover:text-[#e85d54]" onclick={() => handleDeleteHashField(item.field)}>×</button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[#1a1a1a] truncate">{item.field}</td>
                <td class="py-2.5 px-3 text-[#1a1a1a]">
                  {#if editingField === item.field}
                    <div class="flex gap-1">
                      <input bind:value={editingValue} class="flex-1 px-2 py-1 border border-[#d4d4d4] rounded text-base font-mono" />
                      <button class="text-[#28c840] hover:text-[#3dd856]" onclick={saveHashFieldEdit}>✓</button>
                      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={cancelHashFieldEdit}>×</button>
                    </div>
                  {:else if isJson(item.value)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[#5f9eff] hover:text-[#3d8cff] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`hash-${item.field}`)}
                      >{expandedJsonItems.has(`hash-${item.field}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`hash-${item.field}`)}
                        <pre class="p-2 bg-[#f0f0f0] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item.value)}</pre>
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
          <span class="text-base text-[#6b6b6b]">{$keyValue.length} items</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ item'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[#f0f0f0] rounded">
            <input bind:value={newValue} placeholder="value" class="flex-1 px-2 py-1.5 border border-[#d4d4d4] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddListItem}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[#d4d4d4]">
              <th class="text-left py-2 px-3 text-[#6b6b6b] w-16">act</th>
              <th class="text-left py-2 px-3 text-[#6b6b6b] w-14">#</th>
              <th class="text-left py-2 px-3 text-[#6b6b6b]">value</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as string[]) as item, i}
              <tr class="border-b border-[#e5e5e5]">
                <td class="py-2.5 px-3">
                  <div class="flex gap-2">
                    {#if editingIndex !== i}
                      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={() => startEditListItem(i, item)}>✎</button>
                    {/if}
                    <button class="text-[#dc382d] hover:text-[#e85d54]" onclick={() => handleRemoveListItem(item)}>×</button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[#9a9a9a]">{i}</td>
                <td class="py-2.5 px-3 text-[#1a1a1a]">
                  {#if editingIndex === i}
                    <div class="flex gap-1">
                      <input bind:value={editingValue} class="flex-1 px-2 py-1 border border-[#d4d4d4] rounded text-base font-mono" />
                      <button class="text-[#28c840] hover:text-[#3dd856]" onclick={saveListItemEdit}>✓</button>
                      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={cancelListItemEdit}>×</button>
                    </div>
                  {:else if isJson(item)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[#5f9eff] hover:text-[#3d8cff] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`list-${i}`)}
                      >{expandedJsonItems.has(`list-${i}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`list-${i}`)}
                        <pre class="p-2 bg-[#f0f0f0] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item)}</pre>
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
          <span class="text-base text-[#6b6b6b]">{$keyValue.length} members</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[#f0f0f0] rounded">
            <input bind:value={newValue} placeholder="member" class="flex-1 px-2 py-1.5 border border-[#d4d4d4] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddSetMember}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[#d4d4d4]">
              <th class="text-left py-2 px-3 text-[#6b6b6b] w-16">act</th>
              <th class="text-left py-2 px-3 text-[#6b6b6b]">member</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as string[]) as item, i}
              <tr class="border-b border-[#e5e5e5]">
                <td class="py-2.5 px-3">
                  <button class="text-[#dc382d] hover:text-[#e85d54]" onclick={() => handleRemoveSetMember(item)}>×</button>
                </td>
                <td class="py-2.5 px-3 text-[#1a1a1a]">
                  {#if isJson(item)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[#5f9eff] hover:text-[#3d8cff] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`set-${i}`)}
                      >{expandedJsonItems.has(`set-${i}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`set-${i}`)}
                        <pre class="p-2 bg-[#f0f0f0] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item)}</pre>
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
          <span class="text-base text-[#6b6b6b]">{$keyValue.length} members</span>
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 px-3 py-2 bg-[#f0f0f0] rounded">
            <input bind:value={newField} placeholder="member" class="flex-1 px-2 py-1.5 border border-[#d4d4d4] rounded text-base font-mono" />
            <input bind:value={newScore} placeholder="score" type="number" step="0.1" class="w-20 px-2 py-1.5 border border-[#d4d4d4] rounded text-base font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddZSetMember}>add</Button>
          </div>
        {/if}
        <table class="w-full text-base font-mono table-fixed">
          <thead>
            <tr class="border-b border-[#d4d4d4]">
              <th class="text-left py-2 px-3 text-[#6b6b6b] w-16">act</th>
              <th class="text-left py-2 px-3 text-[#6b6b6b]">member</th>
              <th class="text-right py-2 px-3 text-[#6b6b6b] w-24">score</th>
            </tr>
          </thead>
          <tbody>
            {#each ($keyValue as ZSetMember[]) as item, i}
              <tr class="border-b border-[#e5e5e5]">
                <td class="py-2.5 px-3">
                  <div class="flex gap-2">
                    {#if editingField !== item.member}
                      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={() => startEditZSetMember(item.member, item.score)}>✎</button>
                    {/if}
                    <button class="text-[#dc382d] hover:text-[#e85d54]" onclick={() => handleDeleteZSetMember(item.member)}>×</button>
                  </div>
                </td>
                <td class="py-2.5 px-3 text-[#1a1a1a]">
                  {#if isJson(item.member)}
                    <div class="flex items-start gap-1.5">
                      <button 
                        class="text-[#5f9eff] hover:text-[#3d8cff] flex-shrink-0 mt-0.5"
                        onclick={() => toggleItemJson(`zset-${i}`)}
                      >{expandedJsonItems.has(`zset-${i}`) ? '▼' : '▶'}</button>
                      {#if expandedJsonItems.has(`zset-${i}`)}
                        <pre class="p-2 bg-[#f0f0f0] rounded text-base whitespace-pre-wrap break-all w-full">{getItemFormatValue(item.member)}</pre>
                      {:else}
                        <span class="break-all">{getItemDisplayValue(item.member)}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="break-all">{getItemDisplayValue(item.member)}</span>
                  {/if}
                </td>
                <td class="py-2.5 px-3 text-right text-[#6b6b6b]">
                  {#if editingField === item.member}
                    <div class="flex gap-1 justify-end">
                      <input bind:value={editingValue} type="number" step="0.1" class="w-16 px-1.5 py-0.5 border border-[#d4d4d4] rounded text-base font-mono text-right" />
                      <button class="text-[#28c840] hover:text-[#3dd856]" onclick={saveZSetMemberEdit}>✓</button>
                      <button class="text-[#6b6b6b] hover:text-[#1a1a1a]" onclick={cancelZSetMemberEdit}>×</button>
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
      <div class="fixed bottom-4 right-4 bg-[#dc382d] text-white px-4 py-2 rounded text-base font-mono shadow-lg">
        {error}
      </div>
    {/if}
  </div>
{:else}
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center">
      <div class="text-base text-[#9a9a9a]">select a key to view details</div>
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
