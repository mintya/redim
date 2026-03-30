<script lang="ts">
  import type { RedisType } from '$lib/types';
  import { activeConnectionId } from '$lib/stores/connection';
  import { createKey } from '$lib/stores/database';
  import Button from '$lib/components/common/Button.svelte';
  import Modal from '$lib/components/common/Modal.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open = $bindable(), onclose }: Props = $props();

  let keyName = $state('');
  let keyType = $state<RedisType>('string');
  let keyValue = $state('');
  let ttl = $state(-1);
  let error = $state('');

  const typeOptions: { value: RedisType; label: string; placeholder: string }[] = [
    { value: 'string', label: 'String', placeholder: 'value' },
    { value: 'hash', label: 'Hash', placeholder: 'field1=value1,field2=value2' },
    { value: 'list', label: 'List', placeholder: 'item1,item2,item3' },
    { value: 'set', label: 'Set', placeholder: 'member1,member2,member3' },
    { value: 'zset', label: 'ZSet', placeholder: 'member1=1.0,member2=2.0' },
  ];

  function getTypePlaceholder() {
    return typeOptions.find(t => t.value === keyType)?.placeholder || '';
  }

  async function handleCreate() {
    error = '';
    if (!keyName) {
      error = 'key name is required';
      return;
    }
    if (!keyValue) {
      error = 'value is required';
      return;
    }
    if ($activeConnectionId) {
      const success = await createKey($activeConnectionId, keyName, keyType, keyValue, ttl);
      if (success) {
        handleClose();
      } else {
        error = 'Failed to create key';
      }
    }
  }

  function handleClose() {
    keyName = '';
    keyType = 'string';
    keyValue = '';
    ttl = -1;
    open = false;
    onclose();
  }
</script>

<Modal bind:open title="new key" onclose={handleClose}>
  <div class="space-y-4">
    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">key name</span>
      <input 
        type="text" 
        bind:value={keyName}
        placeholder="user:1001"
        class="w-full px-3 py-2 bg-[#fafafa] border border-[#d4d4d4] rounded text-base font-mono focus:outline-none focus:border-[#dc382d]"
      />
    </div>

    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">type</span>
      <select 
        bind:value={keyType}
        class="w-full px-3 py-2 bg-[#fafafa] border border-[#d4d4d4] rounded text-base font-mono focus:outline-none focus:border-[#dc382d]"
      >
        {#each typeOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">value</span>
      {#if keyType === 'string'}
        <textarea 
          bind:value={keyValue}
          placeholder={getTypePlaceholder()}
          class="w-full h-28 px-3 py-2 bg-[#fafafa] border border-[#d4d4d4] rounded text-base font-mono focus:outline-none focus:border-[#dc382d] resize-none"
        ></textarea>
      {:else}
        <input 
          type="text" 
          bind:value={keyValue}
          placeholder={getTypePlaceholder()}
          class="w-full px-3 py-2 bg-[#fafafa] border border-[#d4d4d4] rounded text-base font-mono focus:outline-none focus:border-[#dc382d]"
        />
      {/if}
      <span class="block text-base text-[#9a9a9a] mt-1.5">
        {#if keyType === 'hash'}格式: field1=value1,field2=value2
        {:else if keyType === 'list'}格式: item1,item2,item3
        {:else if keyType === 'set'}格式: member1,member2,member3
        {:else if keyType === 'zset'}格式: member1=1.0,member2=2.0
        {/if}
      </span>
    </div>

    <div>
      <span class="block text-base text-[#6b6b6b] mb-2">ttl (seconds, -1 for no expiry)</span>
      <input 
        type="number" 
        bind:value={ttl}
        placeholder="-1"
        class="w-full px-3 py-2 bg-[#fafafa] border border-[#d4d4d4] rounded text-base font-mono focus:outline-none focus:border-[#dc382d]"
      />
    </div>

    {#if error}
      <div class="text-base text-[#dc382d]">{error}</div>
    {/if}

    <div class="flex gap-2 pt-2">
      <Button variant="ghost" onclick={handleClose}>cancel</Button>
      <div class="flex-1"></div>
      <Button variant="primary" onclick={handleCreate}>create</Button>
    </div>
  </div>
</Modal>
