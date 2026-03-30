<script lang="ts">
  import { databases, activeDb, selectDatabase, loadDatabases, loadKeys } from '$lib/stores/database';
  import { activeConnectionId } from '$lib/stores/connection';

  async function handleSelectDb(db: number) {
    if ($activeConnectionId) {
      await selectDatabase($activeConnectionId, db);
    }
  }

  async function handleRefresh() {
    if ($activeConnectionId) {
      await loadDatabases($activeConnectionId);
      await loadKeys($activeConnectionId);
    }
  }
</script>

<div class="h-11 px-4 border-b border-[#d4d4d4] flex items-center justify-between">
  <span class="text-base text-[#6b6b6b] font-mono">databases</span>
  <button 
    class="text-base text-[#6b6b6b] hover:text-[#dc382d] transition-colors"
    onclick={handleRefresh}
    title="refresh"
  >
    ↻
  </button>
</div>
<div class="border-b border-[#d4d4d4]">
  {#each $databases as db}
    <button 
      class="w-full px-4 py-3 text-left text-base font-mono transition-colors {$activeDb === db.index ? 'bg-[#fdf0ef] text-[#dc382d]' : 'text-[#1a1a1a] hover:bg-[#f0f0f0]'}"
      onclick={() => handleSelectDb(db.index)}
    >
      db{db.index} <span class="text-[#9a9a9a]">({db.keys})</span>
    </button>
  {/each}
</div>
