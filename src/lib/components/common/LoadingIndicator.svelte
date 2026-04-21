<script lang="ts">
  import { loadingList, loadingCount } from '$lib/stores/loading';

  let showDetails = $state(false);
</script>

{#if $loadingCount > 0}
  <div class="fixed bottom-3 right-3 z-50">
    <button
      class="ui-btn ui-btn-sm shadow-[var(--shadow-sm)]"
      onclick={() => (showDetails = !showDetails)}
    >
      <div class="w-3.5 h-3.5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs text-[var(--color-text-primary)]">{$loadingCount} tasks</span>
    </button>

    {#if showDetails}
      <div class="absolute bottom-full right-0 mb-1.5 w-60 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[7px] shadow-[var(--shadow-md)] overflow-hidden">
        <div class="px-2.5 py-1.5 border-b border-[var(--color-border)]">
          <span class="text-xs font-medium text-[var(--color-text-primary)]">loading tasks</span>
        </div>
        <div class="max-h-44 overflow-y-auto">
          {#each $loadingList as state}
            <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] last:border-b-0">
              <div class="flex items-center gap-1.5">
                <div class="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
                <span class="text-xs text-[var(--color-text-primary)] truncate">{state.message}</span>
              </div>
              {#if state.progress !== undefined}
                <div class="mt-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div class="h-full bg-[var(--color-accent)] transition-all duration-300" style="width: {state.progress}%"></div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
