<script lang="ts">
  import { databases, activeDb, selectDatabase, loadDatabases, loadKeys } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';
  import { ChevronDown, RotateCcw } from '@lucide/svelte';

  let showDropdown = $state(false);
  let focusedIndex = $state(0);
  let dropdownEl: HTMLDivElement | null = $state(null);

  async function handleSelectDb(db: number) {
    if ($activeConnectionId) {
      await selectDatabase($activeConnectionId, db);
      showDropdown = false;
    }
  }

  async function handleRefresh() {
    if ($activeConnectionId) {
      await loadDatabases($activeConnectionId);
      await loadKeys($activeConnectionId);
    }
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
    if (showDropdown) {
      focusedIndex = $databases.findIndex(db => db.index === $activeDb);
      setTimeout(() => dropdownEl?.querySelector('button')?.focus(), 0);
    }
  }

  function closeDropdown() {
    showDropdown = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, $databases.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectDb($databases[focusedIndex]?.index);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  }

  // 获取当前活跃数据库信息
  let activeDbInfo = $derived($databases.find(db => db.index === $activeDb));
</script>

<div class="h-10 px-4 border-b border-[var(--color-border)] flex items-center justify-between relative">
  <div class="flex items-center gap-2">
    <span class="text-base text-[var(--color-text-secondary)] font-medium">databases</span>
    
    <!-- Database Dropdown -->
    <div class="relative">
      <button
        class="flex items-center gap-1 px-2 py-1 text-base bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
        onclick={toggleDropdown}
      >
        <span class="text-[var(--color-text-primary)]">db{$activeDb}</span>
        {#if activeDbInfo}
          <span class="text-[var(--color-text-muted)]">({activeDbInfo.keys})</span>
        {/if}
        <ChevronDown class="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-1" />
      </button>
      
      {#if showDropdown}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          bind:this={dropdownEl}
          class="absolute top-full left-0 mt-1 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-md)] z-50 py-1 max-h-64 overflow-y-auto"
          role="listbox"
          tabindex="-1"
          onkeydown={handleKeydown}
        >
          {#each $databases as db, i}
            <button
              class="w-full px-3 py-2 text-left text-base flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors {$activeDb === db.index ? 'bg-[var(--color-accent-subtle)]' : ''}"
              onclick={() => handleSelectDb(db.index)}
              tabindex="-1"
            >
              <span class="font-sans {$activeDb === db.index ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}">
                db{db.index}
              </span>
              <span class="text-[var(--color-text-muted)]">
                {db.keys} keys
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  
  <button 
    class="text-base text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
    onclick={handleRefresh}
    title="refresh"
  >
    <RotateCcw class="w-4 h-4" />
  </button>
</div>

{#if showDropdown}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" onclick={closeDropdown}></div>
{/if}
