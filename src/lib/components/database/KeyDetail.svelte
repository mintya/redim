<script lang="ts">
  import { keyInfo, keyValue, activeKey, setStringValue, setHashField, deleteHashField, pushListValue, addSetMember, removeSetMember, addZSetMember, deleteKey, renameKey, setKeyTtl } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';
  import type { HashField, ZSetMember } from '$lib/types';
  import Button from '$lib/components/common/Button.svelte';
  import Confirm from '$lib/components/common/Confirm.svelte';

  let editingValue = $state('');
  let isEditing = $state(false);
  let newField = $state('');
  let newValue = $state('');
  let newScore = $state('0');
  let showAddForm = $state(false);
  let error = $state('');
  let showConfirm = $state(false);
  let confirmMessage = $state('');
  let confirmAction = $state<(() => void) | null>(null);

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

  function formatJson(str: string): string {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }

  function getDisplayValue(value: string): string {
    if (isJsonString(value)) {
      return formatJson(value);
    }
    return value;
  }

  function isJson(value: string): boolean {
    return isJsonString(value);
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
      confirmMessage = `确定要删除 key: ${$activeKey} 吗？`;
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
      const newKey = prompt('输入新的 key 名称:', $activeKey);
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
      const ttl = prompt('输入 TTL (秒, -1 表示永不过期):', String($keyInfo?.ttl || -1));
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
</script>

{#if $keyInfo && $activeKey}
  <div class="h-9 px-6 border-b border-[#d4d4d4] flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="text-xs text-[#1a1a1a] font-mono">{$activeKey}</span>
      <span class="text-xs font-mono {getTypeColor($keyInfo.key_type)}">{$keyInfo.key_type}</span>
    </div>
    <div class="flex items-center gap-2 text-xs">
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
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
              <span class="text-xs text-[#6b6b6b]">value</span>
              {#if isJson($keyValue)}
                <span class="text-xs text-[#5f9eff] bg-[#eef4ff] px-1.5 py-0.5 rounded">JSON</span>
              {/if}
            </div>
            {#if !isEditing}
              <button class="text-xs text-[#6b6b6b] hover:text-[#dc382d]" onclick={() => startEdit($keyValue as string)}>edit</button>
            {/if}
          </div>
          {#if isEditing}
            <textarea 
              bind:value={editingValue}
              class="w-full h-40 px-3 py-2 bg-[#fafafa] border border-[#d4d4d4] rounded text-sm font-mono focus:outline-none focus:border-[#dc382d]"
            ></textarea>
            <div class="flex gap-2 mt-2">
              <Button variant="primary" size="sm" onclick={saveEdit}>save</Button>
              <Button variant="ghost" size="sm" onclick={cancelEdit}>cancel</Button>
            </div>
          {:else}
            <pre class="bg-[#f0f0f0] border border-[#d4d4d4] rounded p-3 font-mono text-sm text-[#1a1a1a] whitespace-pre-wrap break-all overflow-x-auto">{getDisplayValue($keyValue)}</pre>
          {/if}
        </div>
      </div>

    <!-- Hash -->
    {:else if $keyInfo.key_type === 'hash' && Array.isArray($keyValue)}
      <div class="space-y-4">
        <div class="flex justify-end">
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ add field'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 p-3 bg-[#f0f0f0] rounded">
            <input bind:value={newField} placeholder="field" class="flex-1 px-2 py-1 border border-[#d4d4d4] rounded text-xs font-mono" />
            <input bind:value={newValue} placeholder="value" class="flex-1 px-2 py-1 border border-[#d4d4d4] rounded text-xs font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddHashField}>add</Button>
          </div>
        {/if}
        <table class="w-full text-xs font-mono">
          <thead>
            <tr class="border-b border-[#d4d4d4]">
              <th class="text-left py-2 text-[#6b6b6b] w-1/3">field</th>
              <th class="text-left py-2 text-[#6b6b6b]">value</th>
              <th class="text-right py-2 text-[#6b6b6b] w-16">actions</th>
            </tr>
          </thead>
          <tbody>
            {#each $keyValue as item}
              <tr class="border-b border-[#e5e5e5]">
                <td class="py-2 text-[#1a1a1a]">{item.field}</td>
                <td class="py-2 text-[#6b6b6b]">{item.value}</td>
                <td class="py-2 text-right">
                  <button class="text-[#dc382d] hover:text-[#e85d54]" onclick={() => handleDeleteHashField(item.field)}>×</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- List -->
    {:else if ($keyInfo.key_type === 'list') && Array.isArray($keyValue)}
      <div class="space-y-4">
        <div class="flex justify-end">
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ add item'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 p-3 bg-[#f0f0f0] rounded">
            <input bind:value={newValue} placeholder="value" class="flex-1 px-2 py-1 border border-[#d4d4d4] rounded text-xs font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddListItem}>add</Button>
          </div>
        {/if}
        <div class="space-y-1">
          {#each $keyValue as item, i}
            <div class="flex items-center gap-3 py-1.5 border-b border-[#e5e5e5]">
              <span class="text-[#9a9a9a] w-8">{i}</span>
              <span class="text-[#1a1a1a] flex-1">{item}</span>
            </div>
          {/each}
        </div>
      </div>

    <!-- Set -->
    {:else if ($keyInfo.key_type === 'set') && Array.isArray($keyValue)}
      <div class="space-y-4">
        <div class="flex justify-end">
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ add member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 p-3 bg-[#f0f0f0] rounded">
            <input bind:value={newValue} placeholder="member" class="flex-1 px-2 py-1 border border-[#d4d4d4] rounded text-xs font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddSetMember}>add</Button>
          </div>
        {/if}
        <div class="space-y-1">
          {#each $keyValue as item}
            <div class="flex items-center gap-3 py-1.5 border-b border-[#e5e5e5]">
              <span class="text-[#1a1a1a] flex-1">{item}</span>
              <button class="text-[#dc382d] hover:text-[#e85d54] text-xs" onclick={() => handleRemoveSetMember(item)}>×</button>
            </div>
          {/each}
        </div>
      </div>

    <!-- ZSet -->
    {:else if $keyInfo.key_type === 'zset' && Array.isArray($keyValue)}
      <div class="space-y-4">
        <div class="flex justify-end">
          <Button variant="secondary" size="sm" onclick={() => showAddForm = !showAddForm}>
            {showAddForm ? 'cancel' : '+ add member'}
          </Button>
        </div>
        {#if showAddForm}
          <div class="flex gap-2 p-3 bg-[#f0f0f0] rounded">
            <input bind:value={newField} placeholder="member" class="flex-1 px-2 py-1 border border-[#d4d4d4] rounded text-xs font-mono" />
            <input bind:value={newScore} placeholder="score" type="number" step="0.1" class="w-24 px-2 py-1 border border-[#d4d4d4] rounded text-xs font-mono" />
            <Button variant="primary" size="sm" onclick={handleAddZSetMember}>add</Button>
          </div>
        {/if}
        <table class="w-full text-xs font-mono">
          <thead>
            <tr class="border-b border-[#d4d4d4]">
              <th class="text-left py-2 text-[#6b6b6b]">member</th>
              <th class="text-right py-2 text-[#6b6b6b]">score</th>
            </tr>
          </thead>
          <tbody>
            {#each $keyValue as item}
              <tr class="border-b border-[#e5e5e5]">
                <td class="py-2 text-[#1a1a1a]">{item.member}</td>
                <td class="py-2 text-[#6b6b6b] text-right">{item.score}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if error}
      <div class="fixed bottom-4 right-4 bg-[#dc382d] text-white px-4 py-2 rounded text-xs font-mono shadow-lg">
        {error}
      </div>
    {/if}
  </div>
{:else}
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center">
      <div class="text-xs text-[#9a9a9a]">select a key to view details</div>
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
