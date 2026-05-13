<script lang="ts">
  import { databases, activeDb, selectDatabase, loadDatabases, loadKeys } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';
  import { portal } from '$lib/utils/portal';
  import { ChevronDown, RotateCcw } from '@lucide/svelte';

  let showDropdown = $state(false);
  let focusedIndex = $state(0);
  let dropdownEl: HTMLDivElement | null = $state(null);
  let btnEl: HTMLButtonElement | null = $state(null);
  let dropdownPos = $state({ top: 0, left: 0 });

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

  function updateDropdownPosition() {
    if (btnEl) {
      const rect = btnEl.getBoundingClientRect();
      dropdownPos = { top: rect.bottom + 4, left: rect.left };
    }
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
    if (showDropdown) {
      focusedIndex = $databases.findIndex((db) => db.index === $activeDb);
      updateDropdownPosition();
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

  function handleDocumentPointerDown(e: PointerEvent) {
    const target = e.target as Node | null;
    if (!target) return;
    if (dropdownEl?.contains(target)) return;
    if (btnEl?.contains(target)) return;
    showDropdown = false;
  }

  function handleDocumentKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') showDropdown = false;
  }

  let activeDbInfo = $derived($databases.find((db) => db.index === $activeDb));

  $effect(() => {
    if (!showDropdown) return;

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    document.addEventListener('keydown', handleDocumentKeydown);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      document.removeEventListener('keydown', handleDocumentKeydown);
    };
  });
</script>

<div class="h-9 px-3 flex items-center justify-between relative glass-subtle-divider-bottom">
  <div class="flex items-center gap-1.5">
    <span class="ui-section-label">databases</span>

    <div class="relative">
      <button
        bind:this={btnEl}
        class="ui-btn ui-btn-sm"
        onclick={toggleDropdown}
      >
        <span class="text-[var(--color-text-primary)]">db{$activeDb}</span>
        {#if activeDbInfo}
          <span class="text-[var(--color-text-tertiary)]">{activeDbInfo.keys}</span>
        {/if}
        <ChevronDown class="w-3 h-3 text-[var(--color-text-tertiary)]" />
      </button>
    </div>
  </div>

  <button class="ui-btn ui-btn-ghost ui-btn-icon" onclick={handleRefresh} title="refresh">
    <RotateCcw class="w-3.5 h-3.5" />
  </button>
</div>

{#if showDropdown}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={dropdownEl}
    use:portal
    class="ui-menu-panel fixed w-44 z-[1000] py-1 max-h-64 overflow-y-auto"
    style="top: {dropdownPos.top}px; left: {dropdownPos.left}px;"
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
