<script lang="ts">
  import { databases, activeDb, selectDatabase, loadDatabases, loadKeys } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';

  let showDropdown = $state(false);

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
  }

  function closeDropdown() {
    showDropdown = false;
  }

  // 获取当前活跃数据库信息
  let activeDbInfo = $derived($databases.find(db => db.index === $activeDb));
</script>

<div class="h-10 px-4 border-b border-[var(--color-macos-border)] flex items-center justify-between relative">
  <div class="flex items-center gap-2">
    <span class="text-base text-[var(--color-macos-text-secondary)] font-medium">databases</span>
    
    <!-- Database Dropdown -->
    <div class="relative">
      <button
        class="flex items-center gap-1 px-2 py-1 text-base bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-md hover:bg-[#f5f5f7] transition-colors"
        onclick={toggleDropdown}
      >
        <span class="text-[var(--color-macos-text)]">db{$activeDb}</span>
        {#if activeDbInfo}
          <span class="text-[var(--color-macos-text-tertiary)]">({activeDbInfo.keys})</span>
        {/if}
        <span class="text-[var(--color-macos-text-tertiary)] ml-1">▾</span>
      </button>
      
      {#if showDropdown}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="absolute top-full left-0 mt-1 w-48 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto"
          role="listbox"
        >
          {#each $databases as db}
            <button
              class="w-full px-3 py-2 text-left text-base flex items-center justify-between hover:bg-[#f5f5f7] transition-colors {$activeDb === db.index ? 'bg-[var(--color-accent-subtle)]' : ''}"
              onclick={() => handleSelectDb(db.index)}
            >
              <span class="font-mono {$activeDb === db.index ? 'text-[var(--color-accent)]' : 'text-[var(--color-macos-text)]'}">
                db{db.index}
              </span>
              <span class="text-[var(--color-macos-text-tertiary)]">
                {db.keys} keys
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  
  <button 
    class="text-base text-[var(--color-macos-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
    onclick={handleRefresh}
    title="refresh"
  >
    ↻
  </button>
</div>

{#if showDropdown}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" onclick={closeDropdown}></div>
{/if}
