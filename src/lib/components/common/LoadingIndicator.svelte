<script lang="ts">
  import { loadingList, loadingCount } from '$lib/stores/loading';

  let showDetails = $state(false);
</script>

{#if $loadingCount > 0}
  <div class="fixed bottom-4 right-4 z-50">
    <button
      class="flex items-center gap-2 px-3 py-2 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-xl shadow-lg hover:bg-[var(--color-surface-hover)] transition-colors"
      onclick={() => showDetails = !showDetails}
    >
      <div class="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
      <span class="text-base text-[var(--color-macos-text)]">
        {$loadingCount} 个任务进行中
      </span>
    </button>
    
    {#if showDetails}
      <div class="absolute bottom-full right-0 mb-2 w-64 bg-[var(--color-macos-surface)] border border-[var(--color-macos-border)] rounded-xl shadow-lg overflow-hidden">
        <div class="px-3 py-2 border-b border-[var(--color-macos-border)]">
          <span class="text-base font-medium text-[var(--color-macos-text)]">加载任务</span>
        </div>
        <div class="max-h-48 overflow-y-auto">
          {#each $loadingList as state}
            <div class="px-3 py-2 border-b border-[var(--color-macos-border)] last:border-b-0">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
                <span class="text-base text-[var(--color-macos-text)] truncate">{state.message}</span>
              </div>
              {#if state.progress !== undefined}
                <div class="mt-1 h-1 bg-[var(--color-macos-border)] rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-[var(--color-accent)] transition-all duration-300"
                    style="width: {state.progress}%"
                  ></div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
