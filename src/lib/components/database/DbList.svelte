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
      focusedIndex = $databases.findIndex((db) => db.index === $activeDb);
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

  let activeDbInfo = $derived($databases.find((db) => db.index === $activeDb));
</script>

<div class="h-9 px-3 border-b border-[var(--color-border)] flex items-center justify-between relative">
  <div class="flex items-center gap-1.5">
    <span class="ui-section-label">databases</span>

    <div class="relative">
      <button
        class="ui-btn ui-btn-sm"
        onclick={toggleDropdown}
      >
        <span class="text-[var(--color-text-primary)]">db{$activeDb}</span>
        {#if activeDbInfo}
          <span class="text-[var(--color-text-tertiary)]">{activeDbInfo.keys}</span>
        {/if}
        <ChevronDown class="w-3 h-3 text-[var(--color-text-tertiary)]" />
      </button>

      {#if showDropdown}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          bind:this={dropdownEl}
          class="ui-menu-panel absolute top-full left-0 mt-1 w-44 z-50 py-1 max-h-64 overflow-y-auto"
          role="listbox"
          tabindex="-1"
          onkeydown={handleKeydown}
        >
          {#each $databases as db, i}
            <button
              class="ui-menu-item {$activeDb === db.index ? 'ui-menu-item-active' : ''}"
              onclick={() => handleSelectDb(db.index)}
              tabindex="-1"
            >
              <span class="{$activeDb === db.index ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}">
                db{db.index}
              </span>
              <span class="text-[var(--color-text-tertiary)]">{db.keys}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <button class="ui-btn ui-btn-ghost ui-btn-icon" onclick={handleRefresh} title="refresh">
    <RotateCcw class="w-3.5 h-3.5" />
  </button>
</div>

{#if showDropdown}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" onclick={closeDropdown}></div>
{/if}
