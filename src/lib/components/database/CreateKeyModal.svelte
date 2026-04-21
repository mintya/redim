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
  let stringValue = $state('');
  let ttl = $state(-1);
  let error = $state('');

  // Hash fields
  let hashFields = $state<{ field: string; value: string }[]>([{ field: '', value: '' }]);

  // List items
  let listItems = $state<string[]>(['']);

  // Set members
  let setMembers = $state<string[]>(['']);

  // ZSet members
  let zsetMembers = $state<{ member: string; score: number }[]>([{ member: '', score: 0 }]);

  const typeOptions: { value: RedisType; label: string; description: string }[] = [
    { value: 'string', label: 'String', description: 'Simple key-value pair' },
    { value: 'hash', label: 'Hash', description: 'Map of field-value pairs' },
    { value: 'list', label: 'List', description: 'Ordered collection of strings' },
    { value: 'set', label: 'Set', description: 'Unordered collection of unique strings' },
    { value: 'zset', label: 'Sorted Set', description: 'Set with scores for ordering' },
  ];

  function addHashField() {
    hashFields = [...hashFields, { field: '', value: '' }];
  }

  function removeHashField(index: number) {
    hashFields = hashFields.filter((_, i) => i !== index);
  }

  function addListItem() {
    listItems = [...listItems, ''];
  }

  function removeListItem(index: number) {
    listItems = listItems.filter((_, i) => i !== index);
  }

  function addSetMember() {
    setMembers = [...setMembers, ''];
  }

  function removeSetMember(index: number) {
    setMembers = setMembers.filter((_, i) => i !== index);
  }

  function addZSetMember() {
    zsetMembers = [...zsetMembers, { member: '', score: 0 }];
  }

  function removeZSetMember(index: number) {
    zsetMembers = zsetMembers.filter((_, i) => i !== index);
  }

  function buildValue(): string {
    switch (keyType) {
      case 'string':
        return stringValue;
      case 'hash':
        return hashFields
          .filter(f => f.field && f.value)
          .map(f => `${f.field}=${f.value}`)
          .join(',');
      case 'list':
        return listItems.filter(i => i).join(',');
      case 'set':
        return setMembers.filter(m => m).join(',');
      case 'zset':
        return zsetMembers
          .filter(m => m.member)
          .map(m => `${m.member}=${m.score}`)
          .join(',');
      default:
        return '';
    }
  }

  async function handleCreate() {
    error = '';
    if (!keyName) {
      error = 'key name is required';
      return;
    }
    
    const value = buildValue();
    if (!value) {
      error = 'value is required';
      return;
    }
    
    if ($activeConnectionId) {
      const success = await createKey($activeConnectionId, keyName, keyType, value, ttl);
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
    stringValue = '';
    ttl = -1;
    error = '';
    hashFields = [{ field: '', value: '' }];
    listItems = [''];
    setMembers = [''];
    zsetMembers = [{ member: '', score: 0 }];
    open = false;
    onclose();
  }

  function resetTypeData() {
    stringValue = '';
    hashFields = [{ field: '', value: '' }];
    listItems = [''];
    setMembers = [''];
    zsetMembers = [{ member: '', score: 0 }];
  }
</script>

<Modal bind:open title="Create New Key" size="lg" onclose={handleClose}>
  <div class="space-y-4">
    <!-- Key Name -->
    <div>
      <label for="key-name" class="block text-sm text-[var(--color-text-secondary)] font-medium mb-1.5">Key Name</label>
      <input 
        id="key-name"
        type="text" 
        bind:value={keyName}
        placeholder="user:1001"
        class="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-subtle)] transition-all duration-200"
      />
    </div>

    <!-- Type Selection -->
    <div>
      <span class="block text-sm text-[var(--color-text-secondary)] font-medium mb-1.5">Type</span>
      <div class="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Key type">
        {#each typeOptions as option}
          <button
            type="button"
            role="radio"
            aria-checked={keyType === option.value}
            class="px-2 py-2 text-sm font-medium rounded-md border transition-all duration-200
              {keyType === option.value 
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' 
                : 'bg-[var(--color-surface)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'}"
            onclick={() => { keyType = option.value; resetTypeData(); }}
          >
            {option.label}
          </button>
        {/each}
      </div>
      <p class="mt-1.5 text-sm text-[var(--color-text-tertiary)]">
        {typeOptions.find(t => t.value === keyType)?.description}
      </p>
    </div>

    <!-- Value Input -->
    <div>
      <label for="key-value" class="block text-sm text-[var(--color-text-secondary)] font-medium mb-1.5">Value</label>
      
      {#if keyType === 'string'}
        <textarea 
          id="key-value"
          bind:value={stringValue}
          placeholder="Enter string value..."
          class="w-full h-24 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 resize-none transition-all duration-200"
        ></textarea>
      
      {:else if keyType === 'hash'}
        <div class="space-y-2">
          {#each hashFields as field, index}
            <div class="flex gap-2">
              <input 
                type="text" 
                bind:value={field.field}
                placeholder="field"
                class="flex-1 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
              />
              <input 
                type="text" 
                bind:value={field.value}
                placeholder="value"
                class="flex-1 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
              />
              {#if hashFields.length > 1}
                <button
                  type="button"
                  class="px-2 text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
                  onclick={() => removeHashField(index)}
                >
                  ✕
                </button>
              {/if}
            </div>
          {/each}
          <button
            type="button"
            class="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            onclick={addHashField}
          >
            + Add field
          </button>
        </div>
      
      {:else if keyType === 'list'}
        <div class="space-y-2">
          {#each listItems as item, index}
            <div class="flex gap-2">
              <span class="flex items-center justify-center w-6 h-6 text-sm text-[var(--color-text-tertiary)]">
                {index}
              </span>
              <input 
                type="text" 
                bind:value={listItems[index]}
                placeholder="item value"
                class="flex-1 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
              />
              {#if listItems.length > 1}
                <button
                  type="button"
                  class="px-2 text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
                  onclick={() => removeListItem(index)}
                >
                  ✕
                </button>
              {/if}
            </div>
          {/each}
          <button
            type="button"
            class="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            onclick={addListItem}
          >
            + Add item
          </button>
        </div>
      
      {:else if keyType === 'set'}
        <div class="space-y-2">
          {#each setMembers as member, index}
            <div class="flex gap-2">
              <input 
                type="text" 
                bind:value={setMembers[index]}
                placeholder="member"
                class="flex-1 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
              />
              {#if setMembers.length > 1}
                <button
                  type="button"
                  class="px-2 text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
                  onclick={() => removeSetMember(index)}
                >
                  ✕
                </button>
              {/if}
            </div>
          {/each}
          <button
            type="button"
            class="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            onclick={addSetMember}
          >
            + Add member
          </button>
        </div>
      
      {:else if keyType === 'zset'}
        <div class="space-y-2">
          {#each zsetMembers as item, index}
            <div class="flex gap-2">
              <input 
                type="text" 
                bind:value={item.member}
                placeholder="member"
                class="flex-1 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
              />
              <input 
                type="number" 
                bind:value={item.score}
                placeholder="score"
                class="w-24 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-lg text-base font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all duration-200"
              />
              {#if zsetMembers.length > 1}
                <button
                  type="button"
                  class="px-2 text-[var(--color-accent)] hover:text-[var(--color-accent-light)] transition-colors"
                  onclick={() => removeZSetMember(index)}
                >
                  ✕
                </button>
              {/if}
            </div>
          {/each}
          <button
            type="button"
            class="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            onclick={addZSetMember}
          >
            + Add member
          </button>
        </div>
      {/if}
    </div>

    <!-- TTL -->
    <div>
      <label for="key-ttl" class="block text-sm text-[var(--color-text-secondary)] font-medium mb-1.5">
        TTL (seconds)
        <span class="text-[var(--color-text-tertiary)] font-normal">-1 for no expiry</span>
      </label>
      <input 
        id="key-ttl"
        type="number" 
        bind:value={ttl}
        placeholder="-1"
        class="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-subtle)] transition-all duration-200"
      />
    </div>

    <!-- Error -->
    {#if error}
      <div class="px-3 py-2 bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20 rounded-lg text-base text-[var(--color-accent)]">
        {error}
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex gap-2 pt-2">
      <Button variant="ghost" onclick={handleClose}>Cancel</Button>
      <div class="flex-1"></div>
      <Button variant="primary" onclick={handleCreate}>Create</Button>
    </div>
  </div>
</Modal>
